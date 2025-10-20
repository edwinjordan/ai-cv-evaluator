import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync.js';
import documentService from '../services/document.service.js';
import ApiError from '../utils/ApiError.js';
import multer from 'multer';
import path from 'path';

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ApiError(httpStatus.BAD_REQUEST, 'Only PDF and DOCX files are allowed'), false);
    }
  },
});

/**
 * Upload CV and Project Report files
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
const uploadDocuments = catchAsync(async (req, res) => {
  if (!req.files || !req.files.cv || !req.files.project_report) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Both CV and Project Report files are required');
  }

  const cvFile = Array.isArray(req.files.cv) ? req.files.cv[0] : req.files.cv;
  const projectFile = Array.isArray(req.files.project_report) ? req.files.project_report[0] : req.files.project_report;

  try {
    // Save both documents
    const [cvDocument, projectDocument] = await Promise.all([
      documentService.saveDocument(cvFile, 'cv', req.user?.id),
      documentService.saveDocument(projectFile, 'project_report', req.user?.id),
    ]);

    res.status(httpStatus.CREATED).send({
      success: true,
      message: 'Documents uploaded successfully',
      data: {
        cv_id: cvDocument.id,
        project_id: projectDocument.id,
      },
    });
  } catch (error) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Upload failed: ${error.message}`);
  }
});

/**
 * Upload single document (for reference documents)
 * @param {Request} req - Express request object  
 * @param {Response} res - Express response object
 */
const uploadSingleDocument = catchAsync(async (req, res) => {
  if (!req.file) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'File is required');
  }

  const { type } = req.body;
  const allowedTypes = ['job_description', 'case_study', 'cv_rubric', 'project_rubric'];
  
  if (!type || !allowedTypes.includes(type)) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Document type must be one of: ${allowedTypes.join(', ')}`);
  }

  try {
    const document = await documentService.saveDocument(req.file, type, req.user?.id);

    res.status(httpStatus.CREATED).send({
      success: true,
      message: 'Document uploaded successfully',
      data: {
        document_id: document.id,
        type: document.type,
        filename: document.originalName,
      },
    });
  } catch (error) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Upload failed: ${error.message}`);
  }
});

/**
 * Get document information
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
const getDocument = catchAsync(async (req, res) => {
  const { documentId } = req.params;
  
  const document = await documentService.getDocumentById(documentId);
  
  res.send({
    success: true,
    data: {
      id: document.id,
      filename: document.originalName,
      type: document.type,
      size: document.size,
      mimeType: document.mimeType,
      uploadedAt: document.createdAt,
      extractedText: document.extractedText ? document.extractedText.substring(0, 500) + '...' : null,
    },
  });
});

/**
 * List documents by type
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
const listDocuments = catchAsync(async (req, res) => {
  const { type } = req.query;
  
  let documents;
  if (type) {
    documents = await documentService.getDocumentsByType(type);
  } else {
    // Get all reference documents
    const referenceDocuments = await documentService.getReferenceDocuments();
    documents = [
      ...referenceDocuments.jobDescriptions,
      ...referenceDocuments.caseStudies, 
      ...referenceDocuments.cvRubrics,
      ...referenceDocuments.projectRubrics,
    ];
  }
  
  res.send({
    success: true,
    data: documents.map(doc => ({
      id: doc.id,
      filename: doc.originalName,
      type: doc.type,
      size: doc.size,
      uploadedAt: doc.createdAt,
      vectorized: doc.vectorized,
    })),
  });
});

/**
 * Delete document
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
const deleteDocument = catchAsync(async (req, res) => {
  const { documentId } = req.params;
  
  await documentService.deleteDocument(documentId);
  
  res.status(httpStatus.NO_CONTENT).send();
});

// Multer middleware configurations
const uploadFields = upload.fields([
  { name: 'cv', maxCount: 1 },
  { name: 'project_report', maxCount: 1 }
]);

const uploadSingle = upload.single('document');

export default {
  uploadDocuments,
  uploadSingleDocument,
  getDocument,
  listDocuments,
  deleteDocument,
  uploadFields,
  uploadSingle,
};