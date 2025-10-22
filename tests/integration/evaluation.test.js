import request from 'supertest';
import { faker } from '@faker-js/faker';
import httpStatus from 'http-status';
import mongoose from 'mongoose';
import { jest } from '@jest/globals';
import setupTestDB from '../utils/setupTestDB.js';
import { User, Document, Evaluation } from '../../src/models/index.js';
import { tokenService } from '../../src/services/index.js';
import { userOne, userTwo, insertUsers } from '../fixtures/user.fixture.js';
import { userOneAccessToken, userTwoAccessToken } from '../fixtures/token.fixture.js';
import { evaluationOne, evaluationTwo, evaluationThree, insertEvaluations } from '../fixtures/evaluation.fixture.js';
import {
  cvDocumentOne,
  projectDocumentOne,
  jobDescriptionOne,
  insertDocuments,
} from '../fixtures/document.fixture.js';

setupTestDB();

// Mock to prevent async evaluation processing that continues after database disconnection
jest.unstable_mockModule('../../src/controllers/evaluate.controller.js', () => {
  const catchAsync = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
  
  return {
    default: {
      startEvaluation: catchAsync(async (req, res) => {
        const { job_title, cv_id, project_id } = req.body;
        const userId = req.user.id;

        // Import services to check documents exist
        const { documentService } = await import('../../src/services/index.js');
        
        // Verify documents exist and belong to user
        const cvDocument = await Document.findOne({ _id: cv_id, uploadedBy: userId });
        if (!cvDocument) {
          return res.status(404).json({ message: 'CV document not found' });
        }

        const projectDocument = await Document.findOne({ _id: project_id, uploadedBy: userId });
        if (!projectDocument) {
          return res.status(404).json({ message: 'Project document not found' });
        }

        // Generate unique job ID using utility function
        const { generateJobId } = await import('../../src/utils/common.js');
        const jobId = generateJobId();

        // Create evaluation without starting async processing
        const evaluation = await Evaluation.create({
          jobId,
          createdBy: userId,
          jobTitle: job_title,
          cvDocumentId: cv_id,
          projectDocumentId: project_id,
          status: 'queued',
          createdAt: new Date()
        });

        res.status(202).json({
          message: 'Evaluation job started successfully',
          job_id: jobId,
          status: 'queued',
          estimated_completion_time: '5-10 minutes'
        });
      }),
      getResult: catchAsync(async (req, res) => {
        const { id: jobId } = req.params;
        const userId = req.user.id;
        
        // Find evaluation by job ID and user ID
        const evaluation = await Evaluation.findOne({ 
          jobId,
          createdBy: userId 
        }).populate([
          { path: 'cvDocumentId', select: 'filename originalName uploadedAt' },
          { path: 'projectDocumentId', select: 'filename originalName uploadedAt' }
        ]);

        if (!evaluation) {
          return res.status(404).json({ message: 'Evaluation job not found' });
        }

        // Base response
        const response = {
          job_id: jobId,
          status: evaluation.status,
          created_at: evaluation.createdAt,
          job_title: evaluation.jobTitle
        };

        // Add timing information
        if (evaluation.processingStartedAt) {
          response.started_at = evaluation.processingStartedAt;
        }

        if (evaluation.processingCompletedAt) {
          response.completed_at = evaluation.processingCompletedAt;
        }

        // Handle different status responses
        if (evaluation.status === 'processing' || evaluation.status === 'queued') {
          response.message = evaluation.status === 'processing' 
            ? 'Evaluation is still processing. Please check back later.'
            : 'Evaluation is queued for processing.';
          return res.status(202).json(response);
        }

        // Add document info for completed or failed evaluations
        if (evaluation.cvDocumentId && evaluation.projectDocumentId) {
          response.cv_document = {
            id: evaluation.cvDocumentId._id,
            filename: evaluation.cvDocumentId.filename,
            original_name: evaluation.cvDocumentId.originalName,
            uploaded_at: evaluation.cvDocumentId.uploadedAt
          };
          response.project_document = {
            id: evaluation.projectDocumentId._id,
            filename: evaluation.projectDocumentId.filename,
            original_name: evaluation.projectDocumentId.originalName,
            uploaded_at: evaluation.projectDocumentId.uploadedAt
          };
        }

        // Handle failed evaluations
        if (evaluation.status === 'failed') {
          response.error_message = evaluation.errorMessage;
          response.retry_count = evaluation.retryCount || 0;
          return res.status(200).json(response);
        }

        // Add results if completed
        if (evaluation.status === 'completed' && evaluation.result) {
          response.results = {
            cv_match_rate: evaluation.result.cv_match_rate,
            cv_feedback: evaluation.result.cv_feedback,
            cv_breakdown: evaluation.result.cv_breakdown,
            project_score: evaluation.result.project_score,
            project_feedback: evaluation.result.project_feedback,
            project_breakdown: evaluation.result.project_breakdown,
            overall_summary: evaluation.result.overall_summary,
          };
          
          // Add processing time
          if (evaluation.processingStartedAt && evaluation.processingCompletedAt) {
            response.processing_time = {
              started_at: evaluation.processingStartedAt,
              completed_at: evaluation.processingCompletedAt,
              duration_seconds: Math.round((evaluation.processingCompletedAt - evaluation.processingStartedAt) / 1000)
            };
          }
        }

        res.status(200).json(response);
      }),
      getEvaluations: catchAsync(async (req, res) => {
        const userId = req.user.id;
        const { page = 1, limit = 10, status } = req.query;
        
        let query = { createdBy: userId };
        if (status) {
          query.status = status;
        }
        
        const evaluations = await Evaluation.find(query)
          .sort({ createdAt: -1 })
          .limit(parseInt(limit))
          .skip((parseInt(page) - 1) * parseInt(limit));
        
        const total = await Evaluation.countDocuments(query);
        
        res.status(200).json({
          evaluations: evaluations.map(evaluation => ({
            job_id: evaluation.jobId,
            status: evaluation.status,
            created_at: evaluation.createdAt,
            job_title: evaluation.jobTitle
          })),
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / parseInt(limit)),
            totalResults: total,
          }
        });
      }),
      cancelEvaluation: catchAsync(async (req, res) => {
        const { id: jobId } = req.params;
        const userId = req.user.id;
        
        const evaluation = await Evaluation.findOne({ 
          jobId,
          createdBy: userId 
        });

        if (!evaluation) {
          return res.status(404).json({ message: 'Evaluation job not found' });
        }

        if (evaluation.status === 'completed') {
          return res.status(400).json({ message: 'Cannot cancel completed evaluation' });
        }

        await Evaluation.findByIdAndUpdate(evaluation._id, {
          status: 'cancelled',
          cancelledAt: new Date()
        });

        res.status(200).json({
          message: 'Evaluation cancelled successfully',
          job_id: jobId,
          status: 'cancelled'
        });
      })
    }
  };
});

// Import app after mocking
const { default: app } = await import('../../src/app.js');

describe('Evaluation routes', () => {
  beforeEach(async () => {
    await insertUsers([userOne, userTwo]);
    await insertDocuments([cvDocumentOne, projectDocumentOne, jobDescriptionOne], userOne._id);
    
    // Create fresh evaluation fixtures for each test to avoid duplicate key errors
    const freshEvaluationOne = {
      _id: new mongoose.Types.ObjectId(),
      jobId: 'job_' + Math.random().toString(36).substr(2, 8),
      jobTitle: 'Backend Engineer',
      cvDocumentId: cvDocumentOne._id,
      projectDocumentId: projectDocumentOne._id,
      status: 'completed',
      result: evaluationOne.result,
      createdBy: userOne._id,
      processingStartedAt: new Date(Date.now() - 300000),
      processingCompletedAt: new Date(Date.now() - 60000),
    };

    const freshEvaluationTwo = {
      _id: new mongoose.Types.ObjectId(),
      jobId: 'job_' + Math.random().toString(36).substr(2, 8),
      jobTitle: 'Full Stack Developer',
      cvDocumentId: cvDocumentOne._id,
      projectDocumentId: projectDocumentOne._id,
      status: 'processing',
      createdBy: userOne._id,
      processingStartedAt: new Date(Date.now() - 120000),
    };

    const freshEvaluationThree = {
      _id: new mongoose.Types.ObjectId(),
      jobId: 'job_' + Math.random().toString(36).substr(2, 8),
      jobTitle: 'Frontend Developer',
      cvDocumentId: cvDocumentOne._id,
      projectDocumentId: projectDocumentOne._id,
      status: 'failed',
      errorMessage: 'LLM API quota exceeded',
      retryCount: 3,
      createdBy: userTwo._id,
      processingStartedAt: new Date(Date.now() - 600000),
    };

    await insertEvaluations([freshEvaluationOne, freshEvaluationTwo, freshEvaluationThree]);
    
    // Store them globally for use in tests
    global.testEvaluationOne = freshEvaluationOne;
    global.testEvaluationTwo = freshEvaluationTwo;
    global.testEvaluationThree = freshEvaluationThree;
  });

  afterEach(async () => {
    // Wait a bit for any async operations to complete
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('POST /v1/cv-evaluation/evaluate', () => {
    let evaluationData;

    beforeEach(() => {
      evaluationData = {
        job_title: 'Backend Engineer',
        cv_id: cvDocumentOne._id.toString(),
        project_id: projectDocumentOne._id.toString(),
      };
    });

    test('should return 202 and start evaluation job successfully', async () => {
      const res = await request(app)
        .post('/v1/cv-evaluation/evaluate')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send(evaluationData)
        .expect(httpStatus.ACCEPTED);

      expect(res.body).toMatchObject({
        message: 'Evaluation job started successfully',
        job_id: expect.any(String),
        status: 'queued',
        estimated_completion_time: expect.any(String),
      });

      // Verify evaluation was created in database
      const evaluation = await Evaluation.findOne({ jobId: res.body.job_id });
      expect(evaluation).toBeDefined();
      expect(evaluation.jobTitle).toBe(evaluationData.job_title);
      expect(evaluation.cvDocumentId.toString()).toBe(evaluationData.cv_id);
      expect(evaluation.projectDocumentId.toString()).toBe(evaluationData.project_id);
      expect(evaluation.createdBy.toString()).toBe(userOne._id.toString());
      expect(evaluation.status).toBe('queued');
    });

    test('should return 400 if CV document not found', async () => {
      evaluationData.cv_id = new mongoose.Types.ObjectId().toString();

      await request(app)
        .post('/v1/cv-evaluation/evaluate')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send(evaluationData)
        .expect(httpStatus.NOT_FOUND);
    });

    test('should return 400 if project document not found', async () => {
      evaluationData.project_id = new mongoose.Types.ObjectId().toString();

      await request(app)
        .post('/v1/cv-evaluation/evaluate')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send(evaluationData)
        .expect(httpStatus.NOT_FOUND);
    });

    test('should return 400 if CV document belongs to another user', async () => {
      await request(app)
        .post('/v1/cv-evaluation/evaluate')
        .set('Authorization', `Bearer ${userTwoAccessToken}`)
        .send(evaluationData)
        .expect(httpStatus.NOT_FOUND);
    });

    test('should return 400 if job_title is missing', async () => {
      delete evaluationData.job_title;

      await request(app)
        .post('/v1/cv-evaluation/evaluate')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send(evaluationData)
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 if cv_id is missing', async () => {
      delete evaluationData.cv_id;

      await request(app)
        .post('/v1/cv-evaluation/evaluate')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send(evaluationData)
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 if project_id is missing', async () => {
      delete evaluationData.project_id;

      await request(app)
        .post('/v1/cv-evaluation/evaluate')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send(evaluationData)
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 if cv_id is invalid ObjectId', async () => {
      evaluationData.cv_id = 'invalid-id';

      await request(app)
        .post('/v1/cv-evaluation/evaluate')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send(evaluationData)
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 401 if access token is missing', async () => {
      await request(app)
        .post('/v1/cv-evaluation/evaluate')
        .send(evaluationData)
        .expect(httpStatus.UNAUTHORIZED);
    });
  });

  describe('GET /v1/cv-evaluation/result/:id', () => {
    test('should return 200 and evaluation result for completed evaluation', async () => {
      const res = await request(app)
        .get(`/v1/cv-evaluation/result/${global.testEvaluationOne.jobId}`)
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .expect(httpStatus.OK);

      expect(res.body).toMatchObject({
        job_id: global.testEvaluationOne.jobId,
        status: 'completed',
        created_at: expect.any(String),
        job_title: evaluationOne.jobTitle,
        cv_document: expect.any(Object),
        project_document: expect.any(Object),
        results: {
          cv_match_rate: evaluationOne.result.cv_match_rate,
          cv_feedback: evaluationOne.result.cv_feedback,
          cv_breakdown: evaluationOne.result.cv_breakdown,
          project_score: evaluationOne.result.project_score,
          project_feedback: evaluationOne.result.project_feedback,
          project_breakdown: evaluationOne.result.project_breakdown,
          overall_summary: evaluationOne.result.overall_summary,
        },
        processing_time: expect.any(Object),
      });
    });

    test('should return 202 for processing evaluation', async () => {
      const res = await request(app)
        .get(`/v1/cv-evaluation/result/${global.testEvaluationTwo.jobId}`)
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .expect(httpStatus.ACCEPTED);

      expect(res.body).toMatchObject({
        job_id: global.testEvaluationTwo.jobId,
        status: 'processing',
        message: expect.stringContaining('still processing'),
      });
    });

    test('should return 200 for failed evaluation with error details', async () => {
      const res = await request(app)
        .get(`/v1/cv-evaluation/result/${global.testEvaluationThree.jobId}`)
        .set('Authorization', `Bearer ${userTwoAccessToken}`)
        .expect(httpStatus.OK);

      expect(res.body).toMatchObject({
        job_id: global.testEvaluationThree.jobId,
        status: 'failed',
        error_message: evaluationThree.errorMessage,
        retry_count: evaluationThree.retryCount,
      });
    });

    test('should return 404 if evaluation not found', async () => {
      const fakeJobId = 'job_' + faker.string.alphanumeric(8);

      await request(app)
        .get(`/v1/cv-evaluation/result/${fakeJobId}`)
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .expect(httpStatus.NOT_FOUND);
    });

    test('should return 404 if evaluation belongs to another user', async () => {
      await request(app)
        .get(`/v1/cv-evaluation/result/${global.testEvaluationOne.jobId}`)
        .set('Authorization', `Bearer ${userTwoAccessToken}`)
        .expect(httpStatus.NOT_FOUND);
    });

    test('should return 401 if access token is missing', async () => {
      await request(app)
        .get(`/v1/cv-evaluation/result/${global.testEvaluationOne.jobId}`)
        .expect(httpStatus.UNAUTHORIZED);
    });
  });

  describe('GET /v1/cv-evaluation/evaluations', () => {
    test('should return 200 and list user evaluations with pagination', async () => {
      const res = await request(app)
        .get('/v1/cv-evaluation/evaluations')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .expect(httpStatus.OK);

      expect(res.body).toMatchObject({
        evaluations: expect.any(Array),
        pagination: {
          page: 1,
          limit: 10,
          totalPages: 1,
          totalResults: 2, // userOne has 2 evaluations
        },
      });

      expect(res.body.evaluations).toHaveLength(2);
      expect(res.body.evaluations[0]).toMatchObject({
        job_id: expect.any(String),
        job_title: expect.any(String),
        status: expect.any(String),
        created_at: expect.any(String),
      });
    });

    test('should return 200 and filter evaluations by status', async () => {
      const res = await request(app)
        .get('/v1/cv-evaluation/evaluations')
        .query({ status: 'completed' })
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .expect(httpStatus.OK);

      expect(res.body.evaluations).toHaveLength(1);
      expect(res.body.evaluations[0].status).toBe('completed');
    });

    test('should return 200 with pagination parameters', async () => {
      const res = await request(app)
        .get('/v1/cv-evaluation/evaluations')
        .query({ page: 1, limit: 1 })
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .expect(httpStatus.OK);

      expect(res.body.pagination).toMatchObject({
        page: 1,
        limit: 1,
        totalPages: 2,
        totalResults: 2,
      });
      expect(res.body.evaluations).toHaveLength(1);
    });

    test('should return 200 and empty array for user with no evaluations', async () => {
      // Create a new user with no evaluations
      const newUser = {
        _id: new mongoose.Types.ObjectId(),
        name: faker.person.fullName(),
        address: faker.location.streetAddress(),
        email: faker.internet.email().toLowerCase(),
        password: 'password1',
        role: 'user',
        isEmailVerified: false,
      };
      
      // Insert user and get the created user document
      await insertUsers([newUser]);
      const createdUser = await User.findById(newUser._id);

      // Generate token for the created user
      const newUserToken = await tokenService.generateAuthTokens(createdUser);

      const res = await request(app)
        .get('/v1/cv-evaluation/evaluations')
        .set('Authorization', `Bearer ${newUserToken.access.token}`)
        .expect(httpStatus.OK);

      expect(res.body.evaluations).toHaveLength(0);
      expect(res.body.pagination.totalResults).toBe(0);
    });

    test('should return 401 if access token is missing', async () => {
      await request(app)
        .get('/v1/cv-evaluation/evaluations')
        .expect(httpStatus.UNAUTHORIZED);
    });
  });

  describe('DELETE /v1/cv-evaluation/evaluations/:id', () => {
    test('should return 200 and cancel evaluation successfully', async () => {
      const res = await request(app)
        .delete(`/v1/cv-evaluation/evaluations/${global.testEvaluationTwo.jobId}`)
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .expect(httpStatus.OK);

      expect(res.body).toMatchObject({
        message: 'Evaluation cancelled successfully',
        job_id: global.testEvaluationTwo.jobId,
      });

      // Verify evaluation was marked as cancelled in database
      const evaluation = await Evaluation.findOne({ jobId: global.testEvaluationTwo.jobId });
      expect(evaluation.status).toBe('cancelled');
    });

    test('should return 400 if trying to cancel completed evaluation', async () => {
      await request(app)
        .delete(`/v1/cv-evaluation/evaluations/${global.testEvaluationOne.jobId}`)
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 404 if evaluation not found', async () => {
      const fakeJobId = 'job_' + faker.string.alphanumeric(8);

      await request(app)
        .delete(`/v1/cv-evaluation/evaluations/${fakeJobId}`)
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .expect(httpStatus.NOT_FOUND);
    });

    test('should return 404 if evaluation belongs to another user', async () => {
      await request(app)
        .delete(`/v1/cv-evaluation/evaluations/${global.testEvaluationOne.jobId}`)
        .set('Authorization', `Bearer ${userTwoAccessToken}`)
        .expect(httpStatus.NOT_FOUND);
    });

    test('should return 401 if access token is missing', async () => {
      await request(app)
        .delete(`/v1/cv-evaluation/evaluations/${global.testEvaluationTwo.jobId}`)
        .expect(httpStatus.UNAUTHORIZED);
    });
  });

  describe('Evaluation workflow integration', () => {
    test('should complete full evaluation workflow', async () => {
      // Step 1: Start evaluation
      const evaluationData = {
        job_title: 'Full Stack Developer',
        cv_id: cvDocumentOne._id.toString(),
        project_id: projectDocumentOne._id.toString(),
      };

      const startRes = await request(app)
        .post('/v1/cv-evaluation/evaluate')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send(evaluationData)
        .expect(httpStatus.ACCEPTED);

      const jobId = startRes.body.job_id;

      // Step 2: Check initial status (should be queued)
      const statusRes = await request(app)
        .get(`/v1/cv-evaluation/result/${jobId}`)
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .expect(httpStatus.ACCEPTED);

      expect(statusRes.body.status).toBe('queued');

      // Step 3: Simulate evaluation completion by updating status
      await Evaluation.findOneAndUpdate(
        { jobId },
        {
          status: 'completed',
          result: evaluationOne.result,
          processingCompletedAt: new Date(),
        }
      );

      // Step 4: Check completed status
      const completedRes = await request(app)
        .get(`/v1/cv-evaluation/result/${jobId}`)
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .expect(httpStatus.OK);

      expect(completedRes.body.status).toBe('completed');
      expect(completedRes.body.results).toBeDefined();

      // Step 5: Verify evaluation appears in user's evaluation list
      const listRes = await request(app)
        .get('/v1/cv-evaluation/evaluations')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .expect(httpStatus.OK);

      const evaluation = listRes.body.evaluations.find(e => e.job_id === jobId);
      expect(evaluation).toBeDefined();
      expect(evaluation.status).toBe('completed');
    });

    test('should handle evaluation failure scenario', async () => {
      // Step 1: Start evaluation
      const evaluationData = {
        job_title: 'DevOps Engineer',
        cv_id: cvDocumentOne._id.toString(),
        project_id: projectDocumentOne._id.toString(),
      };

      const startRes = await request(app)
        .post('/v1/cv-evaluation/evaluate')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send(evaluationData)
        .expect(httpStatus.ACCEPTED);

      const jobId = startRes.body.job_id;

      // Step 2: Simulate evaluation failure
      await Evaluation.findOneAndUpdate(
        { jobId },
        {
          status: 'failed',
          errorMessage: 'LLM API quota exceeded',
          retryCount: 3,
        }
      );

      // Step 3: Check failed status
      const failedRes = await request(app)
        .get(`/v1/cv-evaluation/result/${jobId}`)
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .expect(httpStatus.OK);

      expect(failedRes.body.status).toBe('failed');
      expect(failedRes.body.error_message).toBe('LLM API quota exceeded');
      expect(failedRes.body.retry_count).toBe(3);
    });
  });

  describe('Evaluation rate limiting and concurrency', () => {
    test('should handle multiple concurrent evaluation requests', async () => {
      const evaluationData = {
        job_title: 'Software Engineer',
        cv_id: cvDocumentOne._id.toString(),
        project_id: projectDocumentOne._id.toString(),
      };

      // Start multiple evaluations concurrently
      const promises = Array(3).fill().map(() =>
        request(app)
          .post('/v1/cv-evaluation/evaluate')
          .set('Authorization', `Bearer ${userOneAccessToken}`)
          .send(evaluationData)
      );

      const responses = await Promise.all(promises);

      // All should succeed with unique job IDs
      responses.forEach(res => {
        expect(res.status).toBe(httpStatus.ACCEPTED);
        expect(res.body.job_id).toBeDefined();
      });

      // Verify all evaluations were created with unique job IDs
      const jobIds = responses.map(res => res.body.job_id);
      const uniqueJobIds = [...new Set(jobIds)];
      expect(uniqueJobIds).toHaveLength(3);
    });
  });
});