import express from 'express';
import auth from '../../middlewares/auth.js';
import validate from '../../middlewares/validate.js';
import { uploadController, evaluateController } from '../../controllers/index.js';
import { evaluationValidation } from '../../validations/index.js';

const router = express.Router();

/**
 * @swagger
 * /cv-evaluation/upload:
 *   post:
 *     summary: Upload CV and Project Report documents
 *     tags: [CV Evaluation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               cv:
 *                 type: string
 *                 format: binary
 *                 description: CV file (PDF or DOCX)
 *               project_report:
 *                 type: string
 *                 format: binary
 *                 description: Project report file (PDF or DOCX)
 *     responses:
 *       201:
 *         description: Documents uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 documents:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Document'
 *       400:
 *         description: Bad request - Invalid file format
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */

/**
 * @swagger
 * /cv-evaluation/upload/reference:
 *   post:
 *     summary: Upload reference documents (job descriptions, rubrics, etc.)
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - document
 *               - type
 *             properties:
 *               document:
 *                 type: string
 *                 format: binary
 *                 description: Reference document file
 *               type:
 *                 type: string
 *                 enum: [job_description, case_study, cv_rubric, project_rubric]
 *                 description: Type of reference document
 *     responses:
 *       201:
 *         description: Reference document uploaded successfully
 *       400:
 *         description: Bad request - Invalid file or type
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */

/**
 * @swagger
 * /cv-evaluation/evaluate:
 *   post:
 *     summary: Start CV and project evaluation job
 *     tags: [CV Evaluation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EvaluationRequest'
 *     responses:
 *       202:
 *         description: Evaluation job started successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EvaluationResponse'
 *       400:
 *         description: Bad request - Invalid documents or missing data
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @swagger
 * /cv-evaluation/result/{id}:
 *   get:
 *     summary: Get evaluation result by job ID
 *     tags: [CV Evaluation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Evaluation job ID
 *     responses:
 *       200:
 *         description: Evaluation result retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 job_id:
 *                   type: string
 *                 status:
 *                   type: string
 *                 results:
 *                   $ref: '#/components/schemas/EvaluationResults'
 *       202:
 *         description: Evaluation still processing
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @swagger
 * /cv-evaluation/evaluations:
 *   get:
 *     summary: Get all user evaluations with pagination
 *     tags: [CV Evaluation]
 *     security:
 *       - bearerAuth: []
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
 *         description: Items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [queued, processing, completed, failed, cancelled]
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: Evaluations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 evaluations:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */

/**
 * @swagger
 * /cv-evaluation/documents:
 *   get:
 *     summary: List user documents with filtering
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [cv, project_report, job_description, case_study, cv_rubric, project_rubric]
 *         description: Filter by document type
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Documents retrieved successfully
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */

/**
 * @swagger
 * /cv-evaluation/documents/{documentId}:
 *   get:
 *     summary: Get document details by ID
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Document ID
 *     responses:
 *       200:
 *         description: Document retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Document'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   delete:
 *     summary: Delete document by ID
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Document ID
 *     responses:
 *       200:
 *         description: Document deleted successfully
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */

// Upload endpoints
router.post('/upload', auth('uploadDocuments'), uploadController.uploadFields, uploadController.uploadDocuments);
router.post('/upload/reference', auth('uploadDocuments'), uploadController.uploadSingle, validate(evaluationValidation.uploadSingleDocument), uploadController.uploadSingleDocument);
router.get('/documents', auth('manageOwnDocuments'), validate(evaluationValidation.listDocuments), uploadController.listDocuments);
router.get('/documents/:documentId', auth('manageOwnDocuments'), validate(evaluationValidation.getDocument), uploadController.getDocument);
router.delete('/documents/:documentId', auth('manageOwnDocuments'), validate(evaluationValidation.deleteDocument), uploadController.deleteDocument);

// Evaluation endpoints  
router.post('/evaluate', auth('startEvaluation'), validate(evaluationValidation.startEvaluation), evaluateController.startEvaluation);
router.get('/result/:id', auth('viewOwnEvaluations'), validate(evaluationValidation.getResult), evaluateController.getResult);
router.get('/evaluations', auth('viewOwnEvaluations'), evaluateController.getEvaluations);
router.delete('/evaluations/:id', auth('viewOwnEvaluations'), validate(evaluationValidation.getResult), evaluateController.cancelEvaluation);

export default router;