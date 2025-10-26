import mongoose from 'mongoose';
import { Evaluation } from '../models/index.js';
import logger from '../config/logger.js';

class EvaluationCreationService {
  /**
   * Create a new evaluation record
   * @param {Object} evaluationData - Data for creating evaluation
   * @returns {Promise<Object>} - Created evaluation record
   */
  async createEvaluation({ jobId, userId, jobTitle, cvDocumentId, projectDocumentId }) {
    try {
      logger.info(`📝 Creating evaluation record for job: ${jobId}`);
      
      const evaluation = await Evaluation.create({
        jobId,
        createdBy: new mongoose.Types.ObjectId(userId),
        jobTitle: jobTitle,
        cvDocumentId: cvDocumentId || new mongoose.Types.ObjectId('68f627eead6cd34be5186fa0'), // Default placeholder
        projectDocumentId: projectDocumentId || new mongoose.Types.ObjectId('68f627eead6cd34be5186fa2'), // Default placeholder
        status: 'processing'
      });
      
      logger.info(`✅ Evaluation record created: ${evaluation._id}`);
      return evaluation;
      
    } catch (error) {
      logger.error(`❌ Failed to create evaluation for job ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Update evaluation with results
   * @param {string} evaluationId - Evaluation ID
   * @param {Object} result - Evaluation results
   * @param {string} status - New status (completed/failed)
   * @returns {Promise<Object>} - Updated evaluation
   */
  async updateEvaluationResult(evaluationId, result, status = 'completed') {
    try {
      logger.info(`📊 Updating evaluation ${evaluationId} with status: ${status}`);
      
      // Validate evaluationId first
      if (!evaluationId) {
        throw new Error('No evaluationId provided');
      }
      
      if (!mongoose.Types.ObjectId.isValid(evaluationId)) {
        throw new Error(`Invalid evaluationId format: ${evaluationId}`);
      }
      
      // Check if evaluation exists first
      const existingEvaluation = await Evaluation.findById(evaluationId);
      if (!existingEvaluation) {
        logger.warn(`⚠️ Evaluation ${evaluationId} not found in database - may have been deleted`);
        // Return a mock object to prevent cascading failures
        return {
          _id: evaluationId,
          status: status,
          notFound: true,
          message: 'Evaluation not found - may have been deleted'
        };
      }
      
      const updatedEvaluation = await Evaluation.findByIdAndUpdate(
        evaluationId,
        { 
          status: status,
          result: result,
          processingCompletedAt: new Date()
        },
        { new: true }
      );
      
      if (!updatedEvaluation) {
        throw new Error(`Failed to update evaluation ${evaluationId} - concurrent modification possible`);
      }
      
      logger.info(`✅ Evaluation ${evaluationId} updated successfully to status: ${status}`);
      return updatedEvaluation;
      
    } catch (error) {
      logger.error(`❌ Failed to update evaluation ${evaluationId}:`, error);
      throw error;
    }
  }

  /**
   * Mark evaluation as failed with error details
   * @param {string} evaluationId - Evaluation ID
   * @param {Error} error - Error that occurred
   * @returns {Promise<Object>} - Updated evaluation
   */
  async markEvaluationFailed(evaluationId, error) {
    try {
      logger.warn(`⚠️ Marking evaluation ${evaluationId} as failed due to: ${error.message}`);
      
      const errorResult = {
        error: error.message,
        timestamp: new Date(),
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      };
      
      const result = await this.updateEvaluationResult(evaluationId, errorResult, 'failed');
      
      if (result.notFound) {
        logger.warn(`⚠️ Could not mark evaluation ${evaluationId} as failed - evaluation not found`);
        return result;
      }
      
      logger.info(`✅ Evaluation ${evaluationId} marked as failed`);
      return result;
      
    } catch (updateError) {
      logger.error(`❌ Failed to mark evaluation ${evaluationId} as failed:`, updateError);
      // Don't throw here to prevent cascading failures
      return {
        _id: evaluationId,
        status: 'failed',
        error: 'Failed to update evaluation status',
        originalError: error.message,
        updateError: updateError.message
      };
    }
  }

  /**
   * Generate simple evaluation result
   * @param {Object} data - Evaluation input data
   * @returns {Object} - Simple evaluation result
   */
  generateSimpleEvaluationResult({ jobTitle, cvContent, projectContent }) {
    // Simple scoring based on content analysis
    const cvScore = this.analyzeCV(cvContent, jobTitle);
    const projectScore = this.analyzeProject(projectContent);
    
    return {
      cv_match_rate: cvScore.matchRate,
      cv_feedback: `CV evaluated for ${jobTitle} position. ${cvScore.feedback}`,
      cv_breakdown: {
        technical_skills: cvScore.technicalSkills,
        experience_level: cvScore.experienceLevel,
        achievements: cvScore.achievements,
        cultural_fit: cvScore.culturalFit
      },
      project_score: projectScore.overallScore,
      project_feedback: `Project evaluation completed. ${projectScore.feedback}`,
      project_breakdown: {
        technical_quality: projectScore.technicalQuality,
        complexity_level: projectScore.complexityLevel,
        innovation_score: projectScore.innovationScore,
        documentation_quality: projectScore.documentationQuality
      },
      overall_summary: `Candidate evaluated for ${jobTitle} role. CV match rate: ${Math.round(cvScore.matchRate * 100)}%, Project score: ${projectScore.overallScore}/5.`,
      recommendation: this.generateRecommendation(cvScore.matchRate, projectScore.overallScore),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Simple CV analysis
   * @param {string} cvContent - CV content
   * @param {string} jobTitle - Job title
   * @returns {Object} - CV analysis result
   */
  analyzeCV(cvContent, jobTitle) {
    const cvWords = cvContent.toLowerCase().split(/\s+/);
    const jobWords = jobTitle.toLowerCase().split(/\s+/);
    
    // Basic keyword matching
    const matchingWords = jobWords.filter(word => 
      cvWords.some(cvWord => cvWord.includes(word) || word.includes(cvWord))
    );
    const matchRate = Math.min(0.95, Math.max(0.3, matchingWords.length / jobWords.length));
    
    // Simple content analysis
    const hasExperience = /years?|experience|worked|developed/i.test(cvContent);
    const hasTechnicalSkills = /javascript|python|java|react|node|sql|database/i.test(cvContent);
    const hasAchievements = /led|managed|built|created|achieved|improved/i.test(cvContent);
    
    return {
      matchRate: Math.round(matchRate * 100) / 100,
      technicalSkills: hasTechnicalSkills ? Math.min(0.9, matchRate + 0.1) : matchRate * 0.8,
      experienceLevel: hasExperience ? Math.min(0.9, matchRate + 0.05) : matchRate * 0.9,
      achievements: hasAchievements ? Math.min(0.9, matchRate + 0.15) : matchRate * 0.7,
      culturalFit: matchRate,
      feedback: `Shows ${matchRate > 0.7 ? 'strong' : matchRate > 0.5 ? 'good' : 'basic'} alignment with job requirements.`
    };
  }

  /**
   * Simple project analysis
   * @param {string} projectContent - Project content
   * @returns {Object} - Project analysis result
   */
  analyzeProject(projectContent) {
    const contentLength = projectContent.length;
    const hasCode = /class|function|def|import|export|const|let|var/i.test(projectContent);
    const hasDocumentation = /readme|documentation|how to|install|usage/i.test(projectContent);
    const hasTechnologies = /react|node|express|mongodb|sql|api|frontend|backend/i.test(projectContent);
    
    // Scoring based on content analysis
    let baseScore = 3.0;
    if (contentLength > 500) baseScore += 0.5;
    if (hasCode) baseScore += 0.5;
    if (hasDocumentation) baseScore += 0.3;
    if (hasTechnologies) baseScore += 0.4;
    
    const finalScore = Math.min(5.0, baseScore);
    
    return {
      overallScore: Math.round(finalScore * 10) / 10,
      technicalQuality: Math.round((finalScore - 0.2) * 10) / 10,
      complexityLevel: Math.round((finalScore - 0.1) * 10) / 10,
      innovationScore: Math.round((finalScore - 0.3) * 10) / 10,
      documentationQuality: hasDocumentation ? 4.5 : 3.0,
      feedback: `Project shows ${finalScore > 4 ? 'excellent' : finalScore > 3.5 ? 'good' : 'adequate'} technical implementation.`
    };
  }

  /**
   * Generate recommendation based on scores
   * @param {number} cvMatchRate - CV match rate (0-1)
   * @param {number} projectScore - Project score (1-5)
   * @returns {string} - Recommendation
   */
  generateRecommendation(cvMatchRate, projectScore) {
    const normalizedProjectScore = (projectScore - 1) / 4; // Convert to 0-1
    const overallScore = (cvMatchRate * 0.6) + (normalizedProjectScore * 0.4);
    
    if (overallScore >= 0.8) return 'STRONG_HIRE';
    if (overallScore >= 0.65) return 'HIRE';
    if (overallScore >= 0.5) return 'CONDITIONAL_HIRE';
    return 'NO_HIRE';
  }
}

// Create singleton instance
const evaluationCreationService = new EvaluationCreationService();

export default evaluationCreationService;