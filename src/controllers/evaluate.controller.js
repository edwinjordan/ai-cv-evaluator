import catchAsync from '../utils/catchAsync.js';
import ApiError from '../utils/ApiError.js';
import { documentService, evaluationCreationService } from '../services/index.js';
import evaluationService from '../services/evaluationRaceCondition.service.js';
import { Evaluation } from '../models/index.js';
import { generateJobId } from '../utils/common.js';
import httpStatus from 'http-status';
import logger from '../config/logger.js';
import evaluationQueue from '../queues/evaluationQueue.js';

/**
 * Start CV evaluation job
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const startEvaluation = catchAsync(async (req, res) => {
  const { job_title, cv_id, project_id } = req.body;
  const userId = req.user.id;

  // Verify documents exist and belong to user
  const cvDocument = await documentService.getDocumentById(cv_id, userId);
  if (!cvDocument) {
    throw new ApiError(httpStatus.NOT_FOUND, 'CV document not found');
  }

  const projectDocument = await documentService.getDocumentById(project_id, userId);
  if (!projectDocument) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Project document not found');
  }

  // Verify documents are of correct type
  if (cvDocument.type !== 'cv') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Document must be of type CV');
  }

  if (projectDocument.type !== 'project_report') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Document must be of type project report');
  }

  // Generate unique job ID with timestamp to prevent race conditions
  const jobId = generateJobId();
  
  try {
    // Create evaluation record using atomic operation
    const evaluation = await evaluationService.createEvaluationAtomic({
      jobId,
      userId,
      jobTitle: job_title,
      cvDocumentId: cvDocument._id,
      projectDocumentId: projectDocument._id
    });

    // Ensure evaluation is committed to database before queuing
    // await new Promise(resolve => setTimeout(resolve, 100));

    // Add job to queue for automatic processing
    // const queueJob = await addJob({
    //   jobId,
    //   evaluationId: evaluation._id.toString(),
    //   jobTitle: job_title,
    //   cvContent: cvDocument.extractedText,
    //   projectContent: projectDocument.extractedText,
    //   userId,
    //   status: 'queued'
    // });

     const queueJob = await evaluationQueue.addEvaluationJob({
            jobId,
            evaluationId: evaluation._id.toString(),
            jobTitle: job_title,
            cvContent: cvDocument.extractedText,
            projectContent: projectDocument.extractedText,
            userId,
            status: 'queued'
     });

    logger.info(`Evaluation job ${jobId} queued successfully`);

    res.status(httpStatus.ACCEPTED).json({
      message: 'Evaluation job started successfully',
      job_id: jobId,
      status: 'queued',
      queue_position: 1,
      estimated_completion_time: '5-10 minutes'
    });

  } catch (error) {
    logger.error(`❌ Failed to start evaluation job: ${error.message}`, {
      jobId,
      userId,
      error: error.stack
    });
    
    // Provide more specific error messages based on the error type
    if (error.message.includes('Redis')) {
      throw new ApiError(httpStatus.SERVICE_UNAVAILABLE, 'Queue service temporarily unavailable. Please try again later.');
    } else if (error.message.includes('validation')) {
      throw new ApiError(httpStatus.BAD_REQUEST, `Validation error: ${error.message}`);
    } else if (error.message.includes('duplicate')) {
      throw new ApiError(httpStatus.CONFLICT, 'Evaluation job already exists for this request.');
    } else {
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Failed to start evaluation job: ${error.message}`);
    }
  }
});

/**
 * Get evaluation result
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const getResult = catchAsync(async (req, res) => {
  const { id: jobId } = req.params;
  const userId = req.user.id;
  
  // Find evaluation by job ID and user ID (using createdBy field)
  const evaluation = await Evaluation.findOne({ 
    jobId,
    createdBy: userId 
  }).populate([
    { path: 'cvDocumentId', select: 'filename originalName uploadedAt' },
    { path: 'projectDocumentId', select: 'filename originalName uploadedAt' }
  ]);

  if (!evaluation) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Evaluation job not found');
  }

  // Base response
  const response = {
    job_id: jobId,
    status: evaluation.status,
    created_at: evaluation.createdAt,
    job_title: evaluation.jobTitle,
    cv_document: {
      id: evaluation.cvDocumentId._id,
      filename: evaluation.cvDocumentId.filename,
      original_name: evaluation.cvDocumentId.originalName,
      uploaded_at: evaluation.cvDocumentId.uploadedAt
    },
    project_document: {
      id: evaluation.projectDocumentId._id,
      filename: evaluation.projectDocumentId.filename,
      original_name: evaluation.projectDocumentId.originalName,
      uploaded_at: evaluation.projectDocumentId.uploadedAt
    }
  };

  // Add timing information
  if (evaluation.startedAt) {
    response.started_at = evaluation.startedAt;
  }

  if (evaluation.completedAt) {
    response.completed_at = evaluation.completedAt;
    response.processing_time_seconds = Math.round(
      (evaluation.completedAt - evaluation.createdAt) / 1000
    );
  }

  // Add results if completed
  if (evaluation.status === 'completed' && evaluation.result) {
    response.results = {
      cv_match_rate: evaluation.result.cv_match_rate,
      project_score: evaluation.result.project_score,
      overall_recommendation: evaluation.result.overall_summary,
      cv_analysis: {
        strengths: ['Strong technical background', 'Relevant experience'], // Default values
        weaknesses: ['Can be enhanced based on detailed analysis'], // Default values
        missing_skills: [], // Can be enhanced
        experience_match: evaluation.result.cv_breakdown?.experience_level || 0
      },
      project_analysis: {
        technical_quality: evaluation.result.project_breakdown?.correctness || 1,
        complexity_level: evaluation.result.project_breakdown?.code_quality || 1,
        innovation_score: evaluation.result.project_breakdown?.creativity || 1,
        documentation_quality: evaluation.result.project_breakdown?.documentation || 1,
        strengths: ['Good technical implementation'], // Default values
        improvements: ['Continue current practices'] // Default values
      },
      detailed_feedback: evaluation.result.cv_feedback || evaluation.result.overall_summary || '',
      recommendations: ['Based on evaluation results'] // Default values
    };
  }

  // Add error information if failed
  if (evaluation.status === 'failed' && evaluation.errorMessage) {
    response.error = {
      message: evaluation.errorMessage,
      retry_count: evaluation.retryCount || 0
    };
  }

  // Add progress information for processing status
  if (evaluation.status === 'processing') {
    response.progress = {
      current_step: evaluation.currentStep || 'initializing',
      estimated_remaining_minutes: 3 // Default estimate
    };
  }

  res.json(response);
});

/**
 * Get all evaluations for current user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const getEvaluations = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 10, status } = req.query;

  const filter = { createdBy: userId };
  if (status) {
    filter.status = status;
  }

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    sort: { createdAt: -1 },
    populate: [
      { path: 'cvDocumentId', select: 'filename originalName' },
      { path: 'projectDocumentId', select: 'filename originalName' }
    ]
  };

  const evaluations = await Evaluation.paginate(filter, options);

  const formattedDocs = evaluations.docs.map(evaluation => ({
    job_id: evaluation.jobId,
    status: evaluation.status,
    job_title: evaluation.jobTitle,
    created_at: evaluation.createdAt,
    completed_at: evaluation.completedAt,
    cv_document: {
      id: evaluation.cvDocumentId._id,
      filename: evaluation.cvDocumentId.filename,
      original_name: evaluation.cvDocumentId.originalName
    },
    project_document: {
      id: evaluation.projectDocumentId._id,
      filename: evaluation.projectDocumentId.filename,
      original_name: evaluation.projectDocumentId.originalName
    },
    results_summary: evaluation.result ? {
      cv_match_rate: evaluation.result.cv_match_rate,
      project_score: evaluation.result.project_score,
      overall_recommendation: evaluation.result.overall_summary
    } : null
  }));

  res.json({
    evaluations: formattedDocs,
    pagination: {
      page: evaluations.page,
      limit: evaluations.limit,
      total_pages: evaluations.totalPages,
      total_results: evaluations.totalDocs,
      has_next_page: evaluations.hasNextPage,
      has_prev_page: evaluations.hasPrevPage
    }
  });
});

/**
 * Cancel evaluation job
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const cancelEvaluation = catchAsync(async (req, res) => {
  const { id: jobId } = req.params;
  const userId = req.user.id;

  const evaluation = await Evaluation.findOne({ jobId, createdBy: userId });

  if (!evaluation) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Evaluation job not found');
  }

  if (!['queued', 'processing'].includes(evaluation.status)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Can only cancel queued or processing jobs');
  }

  evaluation.status = 'cancelled';
  evaluation.completedAt = new Date();
  await evaluation.save();

  // TODO: Remove from processing queue
  // await queueService.cancelEvaluationJob(jobId);

  logger.info(`Evaluation job ${jobId} cancelled by user ${userId}`);

  res.json({
    message: 'Evaluation job cancelled successfully',
    job_id: jobId,
    status: 'cancelled'
  });
});

/**
 * Process evaluation asynchronously
 * @param {string} evaluationId - Evaluation document ID
 * @param {Object} evaluationData - Data for evaluation
 */
async function processEvaluationAsync(evaluationId, evaluationData) {
  try {
    logger.info(`Starting async evaluation processing for ID: ${evaluationId}`);
    
    // Update status to processing
    await Evaluation.findByIdAndUpdate(evaluationId, {
      status: 'processing',
      processingStartedAt: new Date()
    });
    
    // Perform the AI evaluation
    const results = await evaluationService.performEvaluation(evaluationData);
    
    // Update evaluation with results
    await Evaluation.findByIdAndUpdate(evaluationId, {
      status: 'completed',
      result: {
        cv_match_rate: results.cvMatchRate,
        cv_feedback: results.detailedFeedback,
        cv_breakdown: {
          technical_skills: results.cvAnalysis.experienceMatch || 0.8,
          experience_level: results.cvAnalysis.experienceMatch || 0.8,
          achievements: 0.9, // Default value, can be enhanced
          cultural_fit: 0.85 // Default value, can be enhanced
        },
        project_score: results.projectScore,
        project_feedback: results.detailedFeedback,
        project_breakdown: {
          correctness: results.projectAnalysis.technicalQuality || 4,
          code_quality: results.projectAnalysis.technicalQuality || 4,
          resilience: results.projectAnalysis.technicalQuality || 4,
          documentation: results.projectAnalysis.documentationQuality || 4,
          creativity: results.projectAnalysis.innovationScore || 4
        },
        overall_summary: results.detailedFeedback
      },
      processingCompletedAt: new Date()
    });
    
    logger.info(`Evaluation completed successfully for ID: ${evaluationId}`);
    
  } catch (error) {
    logger.error(`Evaluation processing failed for ID: ${evaluationId}`, error);
    
    // Update evaluation with error
    await Evaluation.findByIdAndUpdate(evaluationId, {
      status: 'failed',
      errorMessage: error.message,
      $inc: { retryCount: 1 },
      processingCompletedAt: new Date()
    });
  }
}

export default {
  startEvaluation,
  getResult,
  getEvaluations,
  cancelEvaluation
};