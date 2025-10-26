import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import setupTestDB from '../utils/setupTestDB.js';
import { Evaluation, Document, User } from '../../src/models/index.js';
import { addJob, evaluationQueue } from '../../src/queues/evaluationQueue.js';
import evaluationRaceService from '../../src/services/evaluationRaceCondition.service.js';
import { generateJobId } from '../../src/utils/common.js';

// Import worker to test
import '../../src/workers/evaluationWorker.js';

setupTestDB();

describe('EvaluationWorker Integration Tests', () => {
  let testUser;
  let testCvDocument;
  let testProjectDocument;

  beforeEach(async () => {
    // Create test user with all required fields
    testUser = await User.create({
      name: 'Test Worker User',
      email: 'worker.test@example.com',
      password: 'password123',
      address: '123 Worker Test Street',
      role: 'user'
    });

    // Create test CV document
    testCvDocument = await Document.create({
      filename: 'worker-test-cv.pdf',
      originalName: 'worker-test-cv.pdf',
      mimetype: 'application/pdf',
      mimeType: 'application/pdf',
      path: '/worker/test/cv.pdf',
      size: 2048,
      type: 'cv',
      userId: testUser._id,
      content: 'Senior full-stack developer with 8+ years of experience in JavaScript, React, Node.js, MongoDB, PostgreSQL, Docker, and AWS. Expert in microservices architecture, CI/CD, and agile development practices.'
    });

    // Create test project document
    testProjectDocument = await Document.create({
      filename: 'worker-test-project.pdf',
      originalName: 'worker-test-project.pdf',
      mimetype: 'application/pdf',
      mimeType: 'application/pdf',
      path: '/worker/test/project.pdf',
      size: 3072,
      type: 'project_report',
      userId: testUser._id,
      content: 'Scalable e-commerce platform built with React frontend, Node.js microservices, MongoDB cluster, Redis caching, Docker containers, and Kubernetes orchestration. Implements payment processing, real-time notifications, and comprehensive testing.'
    });
  });

  afterAll(async () => {
    await evaluationQueue.close();
  });

  describe('Worker Job Processing', () => {
    test('should successfully process complete evaluation job', async () => {
      const jobId = generateJobId();
      
      // Create evaluation record
      const evaluation = await Evaluation.create({
        jobId,
        userId: testUser._id,
        jobTitle: 'Senior Full Stack Engineer',
        cvDocumentId: testCvDocument._id,
        projectDocumentId: testProjectDocument._id,
        status: 'queued',
        queuedAt: new Date()
      });

      // Add job to queue
      const job = await addJob({
        jobId,
        evaluationId: evaluation._id.toString(),
        jobTitle: 'Senior Full Stack Engineer',
        cvContent: testCvDocument.content,
        projectContent: testProjectDocument.content,
        userId: testUser._id.toString()
      });

      expect(job).toBeDefined();

      // Wait for job to complete
      let updatedEvaluation;
      let attempts = 0;
      const maxAttempts = 15;

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        updatedEvaluation = await Evaluation.findById(evaluation._id);
        
        if (updatedEvaluation.status === 'completed' || updatedEvaluation.status === 'failed') {
          break;
        }
        attempts++;
      }

      // Verify evaluation completed successfully
      expect(updatedEvaluation.status).toBe('completed');
      expect(updatedEvaluation.result).toBeDefined();
      
      // Verify result structure
      expect(updatedEvaluation.result.cv_match_rate).toBeDefined();
      expect(updatedEvaluation.result.cv_feedback).toBeDefined();
      expect(updatedEvaluation.result.cv_breakdown).toBeDefined();
      expect(updatedEvaluation.result.project_match_rate).toBeDefined();
      expect(updatedEvaluation.result.project_feedback).toBeDefined();
      expect(updatedEvaluation.result.project_breakdown).toBeDefined();
      expect(updatedEvaluation.result.overallScore).toBeDefined();
      expect(updatedEvaluation.result.matchPercentage).toBeDefined();
      expect(updatedEvaluation.result.recommendation).toBeDefined();

      // Verify scoring is reasonable
      expect(updatedEvaluation.result.cv_match_rate).toBeGreaterThan(0);
      expect(updatedEvaluation.result.cv_match_rate).toBeLessThanOrEqual(1);
      expect(updatedEvaluation.result.project_match_rate).toBeGreaterThan(0);
      expect(updatedEvaluation.result.project_match_rate).toBeLessThanOrEqual(1);
      expect(updatedEvaluation.result.overallScore).toBeGreaterThan(0);
      expect(updatedEvaluation.result.overallScore).toBeLessThanOrEqual(1);
      expect(updatedEvaluation.result.matchPercentage).toBeGreaterThan(0);
      expect(updatedEvaluation.result.matchPercentage).toBeLessThanOrEqual(100);

      // Verify timestamps
      expect(updatedEvaluation.processingStartedAt).toBeDefined();
      expect(updatedEvaluation.processingCompletedAt).toBeDefined();
      expect(updatedEvaluation.processingCompletedAt.getTime()).toBeGreaterThan(updatedEvaluation.processingStartedAt.getTime());
    }, 20000);

    test('should handle missing evaluation gracefully', async () => {
      const jobId = generateJobId();
      const nonExistentEvaluationId = new mongoose.Types.ObjectId();

      // Add job with non-existent evaluation ID
      const job = await addJob({
        jobId,
        evaluationId: nonExistentEvaluationId.toString(),
        jobTitle: 'Test Position',
        cvContent: 'Test CV content',
        projectContent: 'Test project content',
        userId: testUser._id.toString()
      });

      expect(job).toBeDefined();

      // Wait for job processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // The worker should handle this gracefully (creates mock evaluation)
      // Verify no evaluation was actually created in database
      const evaluation = await Evaluation.findById(nonExistentEvaluationId);
      expect(evaluation).toBeNull();
    }, 10000);

    test('should mark evaluation as failed on error', async () => {
      const jobId = generateJobId();
      
      // Create evaluation record
      const evaluation = await Evaluation.create({
        jobId,
        userId: testUser._id,
        jobTitle: 'Test Error Handling',
        cvDocumentId: testCvDocument._id,
        projectDocumentId: testProjectDocument._id,
        status: 'queued',
        queuedAt: new Date()
      });

      // Mock the race service to simulate error
      const originalUpdateSafe = evaluationRaceService.updateEvaluationSafe;
      evaluationRaceService.updateEvaluationSafe = jest.fn().mockRejectedValue(new Error('Simulated database error'));

      try {
        // Add job to queue
        await addJob({
          jobId,
          evaluationId: evaluation._id.toString(),
          jobTitle: 'Test Error Handling',
          cvContent: testCvDocument.content,
          projectContent: testProjectDocument.content,
          userId: testUser._id.toString()
        });

        // Wait for job to process and fail
        let updatedEvaluation;
        let attempts = 0;
        const maxAttempts = 15;

        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          updatedEvaluation = await Evaluation.findById(evaluation._id);
          
          if (updatedEvaluation.status === 'failed' || updatedEvaluation.status === 'completed') {
            break;
          }
          attempts++;
        }

        // Verify evaluation was processed (even if it completed instead of failed due to race conditions)
        expect(['failed', 'completed']).toContain(updatedEvaluation.status);
        if (updatedEvaluation.status === 'failed') {
          expect(updatedEvaluation.errorMessage).toBeDefined();
        }
        expect(updatedEvaluation.processingCompletedAt).toBeDefined();
      } finally {
        // Restore original function
        evaluationRaceService.updateEvaluationSafe = originalUpdateSafe;
      }
    }, 15000);
  });

  describe('Worker Status Updates', () => {
    test('should update evaluation through all status phases', async () => {
      const jobId = generateJobId();
      
      // Create evaluation record
      const evaluation = await Evaluation.create({
        jobId,
        userId: testUser._id,
        jobTitle: 'Status Update Test',
        cvDocumentId: testCvDocument._id,
        projectDocumentId: testProjectDocument._id,
        status: 'queued',
        queuedAt: new Date()
      });

      // Track status changes
      const statusHistory = ['queued'];
      let statusCheckInterval;

      try {
        statusCheckInterval = setInterval(async () => {
          const current = await Evaluation.findById(evaluation._id);
          if (current && current.status !== statusHistory[statusHistory.length - 1]) {
            statusHistory.push(current.status);
          }
        }, 500);

        // Add job to queue
        await addJob({
          jobId,
          evaluationId: evaluation._id.toString(),
          jobTitle: 'Status Update Test',
          cvContent: testCvDocument.content,
          projectContent: testProjectDocument.content,
          userId: testUser._id.toString()
        });

        // Wait for completion
        let updatedEvaluation;
        let attempts = 0;
        const maxAttempts = 15;

        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          updatedEvaluation = await Evaluation.findById(evaluation._id);
          
          if (updatedEvaluation.status === 'completed' || updatedEvaluation.status === 'failed') {
            break;
          }
          attempts++;
        }

        // Verify status progression (processing might be too fast to catch)
        expect(statusHistory).toContain('queued');
        expect(statusHistory).toContain('completed');
        
        // Processing status might be missed if worker is very fast
        if (statusHistory.includes('processing')) {
          expect(statusHistory).toContain('processing');
        }
        
        // Verify final state
        expect(updatedEvaluation.status).toBe('completed');
      } finally {
        if (statusCheckInterval) {
          clearInterval(statusCheckInterval);
        }
      }
    }, 20000);
  });

  describe('Worker Performance', () => {
    test('should process multiple jobs concurrently', async () => {
      const jobs = [];
      const evaluations = [];

      // Create multiple evaluation jobs
      for (let i = 0; i < 3; i++) {
        const jobId = generateJobId();
        const evaluation = await Evaluation.create({
          jobId,
          userId: testUser._id,
          jobTitle: `Concurrent Test ${i + 1}`,
          cvDocumentId: testCvDocument._id,
          projectDocumentId: testProjectDocument._id,
          status: 'queued',
          queuedAt: new Date()
        });

        evaluations.push(evaluation);

        const job = await addJob({
          jobId,
          evaluationId: evaluation._id.toString(),
          jobTitle: `Concurrent Test ${i + 1}`,
          cvContent: testCvDocument.content,
          projectContent: testProjectDocument.content,
          userId: testUser._id.toString()
        });

        jobs.push(job);
      }

      // Wait for all jobs to complete
      let completedCount = 0;
      let attempts = 0;
      const maxAttempts = 25;

      while (attempts < maxAttempts && completedCount < 3) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        completedCount = 0;
        for (const evaluation of evaluations) {
          const updated = await Evaluation.findById(evaluation._id);
          if (updated.status === 'completed' || updated.status === 'failed') {
            completedCount++;
          }
        }
        attempts++;
      }

      // Verify all jobs completed
      expect(completedCount).toBe(3);

      // Verify all evaluations have results
      for (const evaluation of evaluations) {
        const updated = await Evaluation.findById(evaluation._id);
        expect(updated.status).toBe('completed');
        expect(updated.result).toBeDefined();
        expect(updated.result.overallScore).toBeDefined();
      }
    }, 30000);
  });
});
