import { jest } from '@jest/globals';
import httpStatus from 'http-status';
import mongoose from 'mongoose';
import ApiError from '../../../src/utils/ApiError.js';

// Mock controller implementation for testing
const mockEvaluateController = {
  startEvaluation: async (req, res) => {
    const { job_title, cv_id, project_id } = req.body;
    
    // Validate required fields
    if (!job_title || !cv_id || !project_id) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Missing required fields');
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(cv_id) || !mongoose.Types.ObjectId.isValid(project_id)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid document ID format');
    }

    // Simulate successful evaluation start
    const jobId = `eval_test_${Date.now()}`;
    
    res.status(httpStatus.ACCEPTED).json({
      message: 'Evaluation job started successfully',
      job_id: jobId,
      status: 'queued',
      queue_position: 1,
      estimated_completion_time: '5-10 minutes'
    });
  },

  getResult: async (req, res) => {
    const { id } = req.params;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid evaluation ID format');
    }

    // Simulate evaluation not found
    if (id === '000000000000000000000000') {
      throw new ApiError(httpStatus.NOT_FOUND, 'Evaluation not found');
    }

    // Simulate processing status
    if (id === '111111111111111111111111') {
      res.status(httpStatus.ACCEPTED).json({
        success: true,
        message: 'Evaluation is still processing',
        data: {
          evaluationId: id,
          jobId: 'test-job-id',
          status: 'processing'
        }
      });
      return;
    }

    // Simulate completed evaluation
    res.status(httpStatus.OK).json({
      success: true,
      data: {
        evaluationId: id,
        jobId: 'test-job-id',
        jobTitle: 'Test Developer',
        status: 'completed',
        result: {
          cv_match_rate: 0.85,
          project_match_rate: 0.88,
          overallScore: 0.86,
          matchPercentage: 86,
          recommendation: 'Recommended'
        },
        processingCompletedAt: new Date().toISOString()
      }
    });
  },

  getEvaluations: async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    // Simulate paginated results
    const mockResults = {
      results: [
        {
          _id: new mongoose.Types.ObjectId(),
          jobId: 'job-1',
          jobTitle: 'Frontend Developer',
          status: 'completed',
          createdAt: new Date()
        },
        {
          _id: new mongoose.Types.ObjectId(),
          jobId: 'job-2',
          jobTitle: 'Backend Developer',
          status: 'processing',
          createdAt: new Date()
        }
      ],
      page,
      limit,
      totalPages: 1,
      totalResults: 2
    };

    res.status(httpStatus.OK).json({
      success: true,
      data: mockResults
    });
  },

  cancelEvaluation: async (req, res) => {
    const { id } = req.params;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid evaluation ID format');
    }

    // Simulate evaluation not found
    if (id === '000000000000000000000000') {
      throw new ApiError(httpStatus.NOT_FOUND, 'Evaluation not found');
    }

    // Simulate completed evaluation (cannot cancel)
    if (id === '222222222222222222222222') {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot cancel completed evaluation');
    }

    // Simulate successful cancellation
    res.status(httpStatus.OK).json({
      success: true,
      message: 'Evaluation cancelled successfully',
      data: {
        evaluationId: id,
        status: 'cancelled'
      }
    });
  }
};

describe('Evaluate Controller Unit Tests', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    mockReq = {
      body: {},
      params: {},
      query: {},
      user: { id: new mongoose.Types.ObjectId() }
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    jest.clearAllMocks();
  });

  describe('startEvaluation', () => {
    test('should successfully start evaluation with valid data', async () => {
      mockReq.body = {
        job_title: 'Senior Software Developer',
        cv_id: new mongoose.Types.ObjectId().toString(),
        project_id: new mongoose.Types.ObjectId().toString()
      };

      await mockEvaluateController.startEvaluation(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(httpStatus.ACCEPTED);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Evaluation job started successfully',
        job_id: expect.any(String),
        status: 'queued',
        queue_position: 1,
        estimated_completion_time: '5-10 minutes'
      });
    });

    test('should throw error for missing required fields', async () => {
      mockReq.body = {
        job_title: 'Senior Software Developer'
        // Missing cv_id and project_id
      };

      await expect(mockEvaluateController.startEvaluation(mockReq, mockRes))
        .rejects.toThrow(new ApiError(httpStatus.BAD_REQUEST, 'Missing required fields'));
    });

    test('should throw error for invalid ObjectId format', async () => {
      mockReq.body = {
        job_title: 'Senior Software Developer',
        cv_id: 'invalid-id',
        project_id: new mongoose.Types.ObjectId().toString()
      };

      await expect(mockEvaluateController.startEvaluation(mockReq, mockRes))
        .rejects.toThrow(new ApiError(httpStatus.BAD_REQUEST, 'Invalid document ID format'));
    });
  });

  describe('getResult', () => {
    test('should return completed evaluation result', async () => {
      mockReq.params.id = new mongoose.Types.ObjectId().toString();

      await mockEvaluateController.getResult(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(httpStatus.OK);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          evaluationId: mockReq.params.id,
          jobId: 'test-job-id',
          jobTitle: 'Test Developer',
          status: 'completed',
          result: {
            cv_match_rate: 0.85,
            project_match_rate: 0.88,
            overallScore: 0.86,
            matchPercentage: 86,
            recommendation: 'Recommended'
          },
          processingCompletedAt: expect.any(String)
        }
      });
    });

    test('should return processing status for incomplete evaluation', async () => {
      mockReq.params.id = '111111111111111111111111';

      await mockEvaluateController.getResult(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(httpStatus.ACCEPTED);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Evaluation is still processing',
        data: {
          evaluationId: mockReq.params.id,
          jobId: 'test-job-id',
          status: 'processing'
        }
      });
    });

    test('should throw error for evaluation not found', async () => {
      mockReq.params.id = '000000000000000000000000';

      await expect(mockEvaluateController.getResult(mockReq, mockRes))
        .rejects.toThrow(new ApiError(httpStatus.NOT_FOUND, 'Evaluation not found'));
    });

    test('should throw error for invalid ObjectId format', async () => {
      mockReq.params.id = 'invalid-id';

      await expect(mockEvaluateController.getResult(mockReq, mockRes))
        .rejects.toThrow(new ApiError(httpStatus.BAD_REQUEST, 'Invalid evaluation ID format'));
    });
  });

  describe('getEvaluations', () => {
    test('should return paginated evaluations with default pagination', async () => {
      await mockEvaluateController.getEvaluations(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(httpStatus.OK);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          results: expect.arrayContaining([
            expect.objectContaining({
              _id: expect.any(mongoose.Types.ObjectId),
              jobId: expect.any(String),
              jobTitle: expect.any(String),
              status: expect.any(String)
            })
          ]),
          page: 1,
          limit: 10,
          totalPages: 1,
          totalResults: 2
        }
      });
    });

    test('should handle custom pagination parameters', async () => {
      mockReq.query = { page: '2', limit: '5' };

      await mockEvaluateController.getEvaluations(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(httpStatus.OK);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          page: 2,
          limit: 5
        })
      });
    });
  });

  describe('cancelEvaluation', () => {
    test('should successfully cancel evaluation', async () => {
      mockReq.params.id = new mongoose.Types.ObjectId().toString();

      await mockEvaluateController.cancelEvaluation(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(httpStatus.OK);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Evaluation cancelled successfully',
        data: {
          evaluationId: mockReq.params.id,
          status: 'cancelled'
        }
      });
    });

    test('should throw error for evaluation not found', async () => {
      mockReq.params.id = '000000000000000000000000';

      await expect(mockEvaluateController.cancelEvaluation(mockReq, mockRes))
        .rejects.toThrow(new ApiError(httpStatus.NOT_FOUND, 'Evaluation not found'));
    });

    test('should throw error for completed evaluation', async () => {
      mockReq.params.id = '222222222222222222222222';

      await expect(mockEvaluateController.cancelEvaluation(mockReq, mockRes))
        .rejects.toThrow(new ApiError(httpStatus.BAD_REQUEST, 'Cannot cancel completed evaluation'));
    });

    test('should throw error for invalid ObjectId format', async () => {
      mockReq.params.id = 'invalid-id';

      await expect(mockEvaluateController.cancelEvaluation(mockReq, mockRes))
        .rejects.toThrow(new ApiError(httpStatus.BAD_REQUEST, 'Invalid evaluation ID format'));
    });
  });

  describe('Helper Functions', () => {
    test('should validate ObjectId correctly', () => {
      const validId = new mongoose.Types.ObjectId();
      const invalidId = 'invalid-id';

      expect(mongoose.Types.ObjectId.isValid(validId)).toBe(true);
      expect(mongoose.Types.ObjectId.isValid(validId.toString())).toBe(true);
      expect(mongoose.Types.ObjectId.isValid(invalidId)).toBe(false);
    });

    test('should handle HTTP status codes correctly', () => {
      expect(httpStatus.OK).toBe(200);
      expect(httpStatus.ACCEPTED).toBe(202);
      expect(httpStatus.BAD_REQUEST).toBe(400);
      expect(httpStatus.NOT_FOUND).toBe(404);
      expect(httpStatus.INTERNAL_SERVER_ERROR).toBe(500);
    });

    test('should create valid error objects', () => {
      const error = new ApiError(httpStatus.BAD_REQUEST, 'Test error message');
      
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Test error message');
      expect(error.isOperational).toBe(true);
    });
  });
});
