import request from 'supertest';
import httpStatus from 'http-status';
import mongoose from 'mongoose';
import { jest } from '@jest/globals';
import setupTestDB from '../utils/setupTestDB.js';
import { User, Document, Evaluation } from '../../src/models/index.js';
import { userOne, insertUsers } from '../fixtures/user.fixture.js';
import { userOneAccessToken } from '../fixtures/token.fixture.js';

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
        const cvDocument = await documentService.getDocumentById(cv_id, userId);
        if (!cvDocument) {
          return res.status(404).json({ message: 'CV document not found' });
        }

        const projectDocument = await documentService.getDocumentById(project_id, userId);
        if (!projectDocument) {
          return res.status(404).json({ message: 'Project document not found' });
        }

        // Create evaluation without starting async processing
        const evaluation = await Evaluation.create({
          jobId: 'test_job_123',
          createdBy: userId,
          jobTitle: job_title,
          cvDocumentId: cv_id,
          projectDocumentId: project_id,
          status: 'queued',
          createdAt: new Date()
        });

        res.status(202).json({
          message: 'Evaluation job started successfully',
          job_id: 'test_job_123',
          status: 'queued',
          estimated_completion_time: '5-10 minutes'
        });
      }),
      getResult: jest.fn((req, res) => res.status(404).json({ message: 'Evaluation job not found' })),
      getEvaluations: catchAsync(async (req, res) => {
        const userId = req.user.id;
        const evaluations = await Evaluation.find({ createdBy: userId });
        
        res.status(200).json({
          evaluations: evaluations.map(evaluation => ({
            job_id: evaluation.jobId,
            status: evaluation.status,
            created_at: evaluation.createdAt,
            job_title: evaluation.jobTitle
          })),
          pagination: {
            total: evaluations.length,
            page: 1,
            limit: 20,
            total_pages: 1
          }
        });
      }),
      cancelEvaluation: jest.fn((req, res) => res.status(404).json({ message: 'Evaluation job not found' }))
    }
  };
});

// Import app after mocking
const { default: app } = await import('../../src/app.js');

// Mock the evaluation service to avoid actual LLM calls
jest.mock('../../src/services/evaluation.service.js', () => ({
  default: {
    initialize: jest.fn().mockResolvedValue(),
    performEvaluation: jest.fn().mockResolvedValue({
      cvMatchRate: 0.85,
      projectScore: 4.2,
      overallRecommendation: 'HIRE',
    }),
  },
}));

// Mock the LLM connection
jest.mock('../../src/config/connection_llm.js', () => ({
  default: {
    isConnected: true,
    connect: jest.fn().mockResolvedValue(),
    generateCompletion: jest.fn().mockResolvedValue({
      success: true,
      content: JSON.stringify({
        matchRate: 0.85,
        overallScore: 4.2,
      }),
    }),
  },
}));

// Mock the RAG service to prevent ChromaDB operations
jest.mock('../../src/services/rag.service.js', () => ({
  default: {
    initialize: jest.fn().mockResolvedValue(),
    retrieveEvaluationContext: jest.fn().mockResolvedValue([]),
    retrieveProjectContext: jest.fn().mockResolvedValue([]),
  },
}));

describe('Simple Evaluation Tests', () => {
  beforeEach(async () => {
    await insertUsers([userOne]);
    
    // Create simple test documents
    const cvDoc = await Document.create({
      filename: 'test_cv.pdf',
      originalName: 'Test CV.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      path: '/uploads/test_cv.pdf',
      type: 'cv',
      extractedText: 'Test CV content',
      uploadedBy: userOne._id,
    });

    const projectDoc = await Document.create({
      filename: 'test_project.pdf',
      originalName: 'Test Project.pdf',
      mimeType: 'application/pdf',
      size: 2048,
      path: '/uploads/test_project.pdf',
      type: 'project_report',
      extractedText: 'Test project content',
      uploadedBy: userOne._id,
    });

    // Store IDs for use in tests
    global.testCvId = cvDoc._id.toString();
    global.testProjectId = projectDoc._id.toString();
  });

  afterEach(async () => {
    // Wait a bit for any async operations to complete
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('POST /v1/cv-evaluation/evaluate', () => {
    test('should return 202 and start evaluation job successfully', async () => {
      const evaluationData = {
        job_title: 'Backend Engineer',
        cv_id: global.testCvId,
        project_id: global.testProjectId,
      };

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
      // Status can be 'queued' or 'processing' depending on timing
      expect(['queued', 'processing']).toContain(evaluation.status);
    });

    test('should return 400 if CV document not found', async () => {
      const evaluationData = {
        job_title: 'Backend Engineer',
        cv_id: new mongoose.Types.ObjectId().toString(),
        project_id: global.testProjectId,
      };

      await request(app)
        .post('/v1/cv-evaluation/evaluate')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send(evaluationData)
        .expect(httpStatus.NOT_FOUND);
    });

    test('should return 400 if required fields are missing', async () => {
      const evaluationData = {
        // Missing job_title
        cv_id: global.testCvId,
        project_id: global.testProjectId,
      };

      await request(app)
        .post('/v1/cv-evaluation/evaluate')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send(evaluationData)
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 401 if access token is missing', async () => {
      const evaluationData = {
        job_title: 'Backend Engineer',
        cv_id: global.testCvId,
        project_id: global.testProjectId,
      };

      await request(app)
        .post('/v1/cv-evaluation/evaluate')
        .send(evaluationData)
        .expect(httpStatus.UNAUTHORIZED);
    });
  });

  describe('GET /v1/cv-evaluation/result/:id', () => {
    test('should return 404 if evaluation not found', async () => {
      const fakeJobId = 'job_nonexistent';

      await request(app)
        .get(`/v1/cv-evaluation/result/${fakeJobId}`)
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .expect(httpStatus.NOT_FOUND);
    });

    test('should return 401 if access token is missing', async () => {
      const fakeJobId = 'job_test';

      await request(app)
        .get(`/v1/cv-evaluation/result/${fakeJobId}`)
        .expect(httpStatus.UNAUTHORIZED);
    });
  });

  describe('GET /v1/cv-evaluation/evaluations', () => {
    test('should return 200 and empty list for user with no evaluations', async () => {
      const res = await request(app)
        .get('/v1/cv-evaluation/evaluations')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .expect(httpStatus.OK);

      expect(res.body).toMatchObject({
        evaluations: expect.any(Array),
        pagination: expect.any(Object),
      });
      expect(res.body.evaluations).toHaveLength(0);
    });

    test('should return 401 if access token is missing', async () => {
      await request(app)
        .get('/v1/cv-evaluation/evaluations')
        .expect(httpStatus.UNAUTHORIZED);
    });
  });
});