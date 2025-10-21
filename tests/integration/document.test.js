import request from 'supertest';
import { faker } from '@faker-js/faker';
import httpStatus from 'http-status';
import { jest } from '@jest/globals';
import app from '../../src/app.js';
import setupTestDB from '../utils/setupTestDB.js';
import { User, Document } from '../../src/models/index.js';
import { userOne, admin, insertUsers } from '../fixtures/user.fixture.js';
import { userOneAccessToken, adminAccessToken } from '../fixtures/token.fixture.js';
import {
  cvDocumentOne,
  projectDocumentOne,
  jobDescriptionOne,
  cvRubricOne,
  insertDocuments,
  createTestFile,
  samplePdfBuffer,
  sampleProjectPdfBuffer,
  documentIds
} from '../fixtures/document.fixture.js';

// Mock only the external dependencies that shouldn't be tested
jest.mock('../../src/utils/pdf-parser.js', () => ({
  default: {
    extractText: jest.fn().mockResolvedValue('Extracted PDF text content')
  }
}));

setupTestDB();

describe('Document routes', () => {
  beforeEach(async () => {
    await insertUsers([userOne, admin]);
  });

  describe('POST /v1/cv-evaluation/upload', () => {
    test('should return 201 and successfully upload CV and project report', async () => {
      const res = await request(app)
        .post('/v1/cv-evaluation/upload')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .attach('cv', samplePdfBuffer, 'test-cv.pdf')
        .attach('project_report', sampleProjectPdfBuffer, 'test-project.pdf')
        .expect(httpStatus.CREATED);

      expect(res.body).toEqual({
        success: true,
        message: 'Documents uploaded successfully',
        data: {
          cv_id: expect.any(String),
          project_id: expect.any(String)
        }
      });

      // Verify documents were saved to database
      const cvDocument = await Document.findById(res.body.data.cv_id);
      const projectDocument = await Document.findById(res.body.data.project_id);

      expect(cvDocument).toBeDefined();
      expect(cvDocument.type).toBe('cv');
      expect(cvDocument.originalName).toBe('test-cv.pdf');
      expect(cvDocument.uploadedBy.toString()).toBe(userOne._id.toString());

      expect(projectDocument).toBeDefined();
      expect(projectDocument.type).toBe('project_report');
      expect(projectDocument.originalName).toBe('test-project.pdf');
      expect(projectDocument.uploadedBy.toString()).toBe(userOne._id.toString());
    });

    test('should return 400 error when CV file is missing', async () => {
      await request(app)
        .post('/v1/cv-evaluation/upload')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .attach('project_report', sampleProjectPdfBuffer, 'test-project.pdf')
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 error when project report file is missing', async () => {
      await request(app)
        .post('/v1/cv-evaluation/upload')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .attach('cv', samplePdfBuffer, 'test-cv.pdf')
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 error when invalid file type is uploaded', async () => {
      const invalidFile = Buffer.from('invalid file content');
      
      await request(app)
        .post('/v1/cv-evaluation/upload')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .attach('cv', invalidFile, 'test-cv.txt')
        .attach('project_report', sampleProjectPdfBuffer, 'test-project.pdf')
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 401 error when access token is missing', async () => {
      await request(app)
        .post('/v1/cv-evaluation/upload')
        .attach('cv', samplePdfBuffer, 'test-cv.pdf')
        .attach('project_report', sampleProjectPdfBuffer, 'test-project.pdf')
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 413 error when file size exceeds limit', async () => {
      // Create a large buffer (>10MB)
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
      
      await request(app)
        .post('/v1/cv-evaluation/upload')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .attach('cv', largeBuffer, 'large-cv.pdf')
        .attach('project_report', sampleProjectPdfBuffer, 'test-project.pdf')
        .expect(httpStatus.REQUEST_ENTITY_TOO_LARGE);
    });
  });

  describe('POST /v1/cv-evaluation/upload/reference', () => {
    test('should return 201 and successfully upload job description reference document', async () => {
      const res = await request(app)
        .post('/v1/cv-evaluation/upload/reference')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .attach('document', samplePdfBuffer, 'job-description.pdf')
        .field('type', 'job_description')
        .expect(httpStatus.CREATED);

      expect(res.body).toEqual({
        success: true,
        message: 'Document uploaded successfully',
        data: {
          document_id: expect.any(String),
          type: 'job_description',
          filename: 'job-description.pdf'
        }
      });

      const document = await Document.findById(res.body.data.document_id);
      expect(document).toBeDefined();
      expect(document.type).toBe('job_description');
      expect(document.originalName).toBe('job-description.pdf');
    });

    test('should return 201 and successfully upload CV rubric reference document', async () => {
      const res = await request(app)
        .post('/v1/cv-evaluation/upload/reference')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .attach('document', samplePdfBuffer, 'cv-rubric.pdf')
        .field('type', 'cv_rubric')
        .expect(httpStatus.CREATED);

      expect(res.body.data.type).toBe('cv_rubric');
    });

    test('should return 400 error when document type is missing', async () => {
      await request(app)
        .post('/v1/cv-evaluation/upload/reference')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .attach('document', samplePdfBuffer, 'test-document.pdf')
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 error when document type is invalid', async () => {
      await request(app)
        .post('/v1/cv-evaluation/upload/reference')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .attach('document', samplePdfBuffer, 'test-document.pdf')
        .field('type', 'invalid_type')
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 error when document file is missing', async () => {
      await request(app)
        .post('/v1/cv-evaluation/upload/reference')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .field('type', 'job_description')
        .expect(httpStatus.BAD_REQUEST);
    });
  });

  describe('GET /v1/cv-evaluation/documents', () => {
    beforeEach(async () => {
      // Only insert reference documents (not user documents like CV and project reports)
      await insertDocuments([jobDescriptionOne, cvRubricOne], userOne._id);
    });

    test('should return 200 and return all reference documents when no filter is applied', async () => {
      const res = await request(app)
        .get('/v1/cv-evaluation/documents')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .expect(httpStatus.OK);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2); // Only reference documents
      expect(res.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            filename: expect.any(String),
            type: expect.stringMatching(/^(job_description|cv_rubric|case_study|project_rubric)$/),
            size: expect.any(Number),
            uploadedAt: expect.any(String)
          })
        ])
      );
    });

    test('should return 200 and return filtered documents by type', async () => {
      const res = await request(app)
        .get('/v1/cv-evaluation/documents')
        .query({ type: 'job_description' })
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .expect(httpStatus.OK);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].type).toBe('job_description');
    });

    test('should return 200 and apply pagination', async () => {
      const res = await request(app)
        .get('/v1/cv-evaluation/documents')
        .query({ page: 1, limit: 2 })
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .expect(httpStatus.OK);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeLessThanOrEqual(2);
    });

    test('should return 401 error when access token is missing', async () => {
      await request(app)
        .get('/v1/cv-evaluation/documents')
        .expect(httpStatus.UNAUTHORIZED);
    });
  });

  describe('GET /v1/cv-evaluation/documents/:documentId', () => {
    beforeEach(async () => {
      await insertDocuments([cvDocumentOne], userOne._id);
    });

    test('should return 200 and the document data', async () => {
      const res = await request(app)
        .get(`/v1/cv-evaluation/documents/${cvDocumentOne._id}`)
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        success: true,
        data: {
          id: cvDocumentOne._id.toHexString(),
          filename: cvDocumentOne.originalName,
          type: cvDocumentOne.type,
          size: cvDocumentOne.size,
          mimeType: cvDocumentOne.mimeType,
          uploadedAt: expect.any(String),
          extractedText: expect.stringContaining('...') // Should be truncated
        }
      });
    });

    test('should return 401 error when access token is missing', async () => {
      await request(app)
        .get(`/v1/cv-evaluation/documents/${cvDocumentOne._id}`)
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 400 error when documentId is not a valid ObjectId', async () => {
      await request(app)
        .get('/v1/cv-evaluation/documents/invalid-id')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 404 error when document is not found', async () => {
      const nonExistentId = documentIds.projectDocumentOne; // This ID wasn't inserted
      await request(app)
        .get(`/v1/cv-evaluation/documents/${nonExistentId}`)
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .expect(httpStatus.NOT_FOUND);
    });
  });

  describe('DELETE /v1/cv-evaluation/documents/:documentId', () => {
    beforeEach(async () => {
      await insertDocuments([cvDocumentOne], userOne._id);
    });

    test('should return 204 and delete the document', async () => {
      await request(app)
        .delete(`/v1/cv-evaluation/documents/${cvDocumentOne._id}`)
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .expect(httpStatus.NO_CONTENT);

      const document = await Document.findById(cvDocumentOne._id);
      expect(document).toBeNull();
    });

    test('should return 401 error when access token is missing', async () => {
      await request(app)
        .delete(`/v1/cv-evaluation/documents/${cvDocumentOne._id}`)
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 400 error when documentId is not a valid ObjectId', async () => {
      await request(app)
        .delete('/v1/cv-evaluation/documents/invalid-id')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 404 error when document is not found', async () => {
      const nonExistentId = documentIds.projectDocumentOne;
      await request(app)
        .delete(`/v1/cv-evaluation/documents/${nonExistentId}`)
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .expect(httpStatus.NOT_FOUND);
    });

    test('should not allow user to delete other user\'s documents', async () => {
      // Insert document with different user ID
      await Document.deleteMany({});
      await insertDocuments([cvDocumentOne], admin._id);

      await request(app)
        .delete(`/v1/cv-evaluation/documents/${cvDocumentOne._id}`)
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .expect(httpStatus.NOT_FOUND); // Should not find document for this user
    });
  });
});