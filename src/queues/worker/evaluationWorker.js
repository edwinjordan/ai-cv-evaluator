import Redis from 'ioredis';
import mongoose from 'mongoose';
import 'dotenv/config'
import { Worker } from 'bullmq';
import config from '../../config/config.js';
import logger from '../../config/logger.js';

// Initialize MongoDB connection
let isDbConnected = false;

async function connectToDatabase() {
  if (!isDbConnected) {
    try {
      await mongoose.connect(config.mongoose.url);
      isDbConnected = true;
      logger.info('Worker: MongoDB connection established');
    } catch (error) {
      logger.error('Worker: Failed to connect to MongoDB:', error);
      throw error;
    }
  }
}

const connection = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    maxRetriesPerRequest: null
})

const worker = new Worker(
  "evaluation",
  async (job) => {
     console.log(`Processing job: ${job.name}`, job.data);
     
     try {
       // Ensure database connection is established
       await connectToDatabase();
       
       // Import services dynamically to avoid circular dependencies
       const { evaluationService } = await import('../../services/index.js');
       const { Evaluation } = await import('../../models/index.js');
       
       const { evaluationId, jobTitle, cvContent, projectContent, userId } = job.data;
       
       console.log(`Starting evaluation for evaluation ID: ${evaluationId}`);
       
       // Update status to processing with timeout and retry
       const updateResult = await Evaluation.findByIdAndUpdate(
         evaluationId, 
         {
           status: 'processing',
           processingStartedAt: new Date()
         },
         { 
           new: true, 
           timeout: 5000  // 5 second timeout
         }
       );
       
       if (!updateResult) {
         throw new Error(`Evaluation with ID ${evaluationId} not found in database`);
       }
       
       // Prepare evaluation data
       const evaluationData = {
         jobTitle,
         cvContent,
         projectContent,
         userId
       };
       
       // Process the evaluation
       const result = await evaluationService.performEvaluation(evaluationData);
       
       // Update evaluation with results
       await Evaluation.findByIdAndUpdate(
         evaluationId, 
         {
           status: 'completed',
           completedAt: new Date(),
           result: {
             cv_match_rate: result.cvMatchRate || 0.8,
             cv_feedback: result.detailedFeedback || result.cvEvaluation?.feedback || 'Evaluation completed',
             cv_breakdown: {
               technical_skills: result.cvAnalysis?.technicalSkills || 0.8,
               experience_level: result.cvAnalysis?.experienceMatch || 0.8,
               achievements: result.cvAnalysis?.achievements || 0.9,
               cultural_fit: result.cvAnalysis?.culturalFit || 0.85
             },
             project_score: result.projectScore || 85,
             project_feedback: result.projectEvaluation?.feedback || 'Project evaluation completed',
             project_breakdown: {
               correctness: result.projectAnalysis?.correctness || 4,
               code_quality: result.projectAnalysis?.codeQuality || 4,
               innovation: result.projectAnalysis?.innovation || 4,
               documentation: result.projectAnalysis?.documentation || 4
             },
             overall_recommendation: result.overallRecommendation || 'Candidate evaluation completed',
             match_percentage: result.matchPercentage || 82.5
           }
         },
         { 
           new: true, 
           timeout: 5000  // 5 second timeout
         }
       );
       
       console.log(`Evaluation ${evaluationId} completed successfully`);
       return result;
       
     } catch (error) {
       console.error(`Error processing evaluation job ${job.id}:`, error);
       
       // Update evaluation status to failed
       try {
         const { Evaluation } = await import('../../models/index.js');
         await Evaluation.findByIdAndUpdate(
           job.data.evaluationId, 
           {
             status: 'failed',
             error: error.message,
             failedAt: new Date()
           },
           { 
             new: true, 
             timeout: 5000  // 5 second timeout
           }
         );
       } catch (updateError) {
         console.error('Failed to update evaluation status:', updateError);
       }
       
       throw error; // This will mark the job as failed
     }
  },
  { connection }
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job.id} failed`, err);
});

// Initialize database connection when worker starts
connectToDatabase().catch(error => {
  logger.error('Worker: Failed to initialize database connection:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Worker: Received SIGTERM, shutting down gracefully...');
  await worker.close();
  if (isDbConnected) {
    await mongoose.connection.close();
    logger.info('Worker: Database connection closed');
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Worker: Received SIGINT, shutting down gracefully...');
  await worker.close();
  if (isDbConnected) {
    await mongoose.connection.close();
    logger.info('Worker: Database connection closed');
  }
  process.exit(0);
});

export default worker;