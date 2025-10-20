import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import auth from '../../middlewares/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

/**
 * @swagger
 * /dashboard:
 *   get:
 *     summary: Serve CV evaluation dashboard
 *     tags: [Dashboard]
 *     description: Serves the HTML dashboard for viewing CV evaluation results
 *     responses:
 *       200:
 *         description: Dashboard HTML page
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *       404:
 *         description: Dashboard not found
 */
router.get('/', (req, res) => {
  try {
    const dashboardPath = path.join(__dirname, '../../../dashboard.html');
    res.sendFile(dashboardPath);
  } catch (error) {
    res.status(404).json({
      message: 'Dashboard not found',
      error: error.message
    });
  }
});

// Serve dashboard overview HTML
router.get('/overview', (req, res) => {
  try {
    const dashboardPath = path.join(__dirname, '../../../dashboard-overview.html');
    res.sendFile(dashboardPath);
  } catch (error) {
    res.status(404).json({
      message: 'Dashboard overview not found',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /dashboard/api/evaluations:
 *   get:
 *     summary: Get all evaluations for current user
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     description: Returns a list of all evaluations for the authenticated user
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [queued, processing, completed, failed]
 *         description: Filter by evaluation status
 *     responses:
 *       200:
 *         description: List of evaluations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 evaluations:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       job_id:
 *                         type: string
 *                       job_title:
 *                         type: string
 *                       status:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       completed_at:
 *                         type: string
 *                         format: date-time
 *                       cv_match_rate:
 *                         type: number
 *                       project_score:
 *                         type: number
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 */
router.get('/api/evaluations', auth(), async (req, res) => {
  try {
    const { Evaluation } = await import('../../models/index.js');
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;
    
    const query = { createdBy: userId };
    if (status) {
      query.status = status;
    }
    
    const skip = (page - 1) * limit;
    
    const [evaluations, total] = await Promise.all([
      Evaluation.find(query)
        .populate([
          { path: 'cvDocumentId', select: 'filename originalName' },
          { path: 'projectDocumentId', select: 'filename originalName' }
        ])
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Evaluation.countDocuments(query)
    ]);
    
    const formattedEvaluations = evaluations.map(evaluation => ({
      job_id: evaluation.jobId,
      job_title: evaluation.jobTitle,
      status: evaluation.status,
      created_at: evaluation.createdAt,
      completed_at: evaluation.processingCompletedAt,
      processing_time_seconds: evaluation.processingCompletedAt ? 
        Math.round((evaluation.processingCompletedAt - evaluation.createdAt) / 1000) : null,
      cv_match_rate: evaluation.result?.cv_match_rate || null,
      project_score: evaluation.result?.project_score || null,
      cv_document: {
        filename: evaluation.cvDocumentId?.originalName,
        id: evaluation.cvDocumentId?._id
      },
      project_document: {
        filename: evaluation.projectDocumentId?.originalName,
        id: evaluation.projectDocumentId?._id
      },
      error_message: evaluation.errorMessage
    }));
    
    res.json({
      evaluations: formattedEvaluations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    res.status(500).json({
      message: 'Failed to fetch evaluations',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /dashboard/api/stats:
 *   get:
 *     summary: Get evaluation statistics for current user
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     description: Returns statistics about user's evaluations
 *     responses:
 *       200:
 *         description: Evaluation statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total_evaluations:
 *                   type: integer
 *                 completed_evaluations:
 *                   type: integer
 *                 average_cv_match_rate:
 *                   type: number
 *                 average_project_score:
 *                   type: number
 *                 status_breakdown:
 *                   type: object
 *                   properties:
 *                     queued:
 *                       type: integer
 *                     processing:
 *                       type: integer
 *                     completed:
 *                       type: integer
 *                     failed:
 *                       type: integer
 *                 recent_jobs:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Unauthorized
 */
router.get('/api/stats', auth(), async (req, res) => {
  try {
    const { Evaluation } = await import('../../models/index.js');
    const userId = req.user.id;
    
    // Get overall statistics
    const [
      totalEvaluations,
      completedEvaluations,
      statusBreakdown,
      recentJobs
    ] = await Promise.all([
      Evaluation.countDocuments({ createdBy: userId }),
      Evaluation.countDocuments({ createdBy: userId, status: 'completed' }),
      Evaluation.aggregate([
        { $match: { createdBy: userId } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Evaluation.find({ createdBy: userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('jobId jobTitle status createdAt result.cv_match_rate result.project_score')
    ]);
    
    // Calculate averages for completed evaluations
    const completedWithResults = await Evaluation.find({
      createdBy: userId,
      status: 'completed',
      'result.cv_match_rate': { $exists: true }
    }).select('result.cv_match_rate result.project_score');
    
    let averageCvMatchRate = 0;
    let averageProjectScore = 0;
    
    if (completedWithResults.length > 0) {
      const totalCvRate = completedWithResults.reduce((sum, evaluation) => 
        sum + (evaluation.result?.cv_match_rate || 0), 0);
      const totalProjectScore = completedWithResults.reduce((sum, evaluation) => 
        sum + (evaluation.result?.project_score || 0), 0);
      
      averageCvMatchRate = totalCvRate / completedWithResults.length;
      averageProjectScore = totalProjectScore / completedWithResults.length;
    }
    
    // Format status breakdown
    const statusCounts = {
      queued: 0,
      processing: 0,
      completed: 0,
      failed: 0
    };
    
    statusBreakdown.forEach(item => {
      statusCounts[item._id] = item.count;
    });
    
    // Format recent jobs
    const formattedRecentJobs = recentJobs.map(job => ({
      job_id: job.jobId,
      job_title: job.jobTitle,
      status: job.status,
      created_at: job.createdAt,
      cv_match_rate: job.result?.cv_match_rate,
      project_score: job.result?.project_score
    }));
    
    res.json({
      total_evaluations: totalEvaluations,
      completed_evaluations: completedEvaluations,
      average_cv_match_rate: Math.round(averageCvMatchRate * 100) / 100,
      average_project_score: Math.round(averageProjectScore * 100) / 100,
      status_breakdown: statusCounts,
      recent_jobs: formattedRecentJobs
    });
    
  } catch (error) {
    res.status(500).json({
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
});

export default router;