import httpStatus from 'http-status';
import { Document } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import pdfParser from '../utils/pdf-parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOAD_DIR = path.join(__dirname, '../../uploads');

// Ensure upload directory exists
await fs.mkdir(UPLOAD_DIR, { recursive: true });

/**
 * Save uploaded file and create document record
 * @param {Object} file - Multer file object
 * @param {string} type - Document type (cv, project_report, etc.)
 * @param {string} userId - User ID who uploaded
 * @returns {Promise<Document>}
 */
const saveDocument = async (file, type, userId = null) => {
  try {
    // Generate unique filename
    const fileExt = path.extname(file.originalname);
    const uniqueFilename = `${uuidv4()}${fileExt}`;
    const filePath = path.join(UPLOAD_DIR, uniqueFilename);

    // Save file to disk
    await fs.writeFile(filePath, file.buffer);

    // Extract text content
    let extractedText = '';
    try {
      extractedText = await pdfParser.extractText(filePath);
    } catch (error) {
      console.warn('Failed to extract text from PDF:', error.message);
    }

    // Create document record
    const document = await Document.create({
      filename: uniqueFilename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      path: filePath,
      type,
      extractedText,
      uploadedBy: userId,
      metadata: {
        uploadedAt: new Date(),
        processed: false,
      },
    });

    return document;
  } catch (error) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Failed to save document: ${error.message}`);
  }
};

/**
 * Get document by ID
 * @param {string} documentId
 * @returns {Promise<Document>}
 */
const getDocumentById = async (documentId) => {
  const document = await Document.findById(documentId);
  if (!document) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Document not found');
  }
  return document;
};

/**
 * Get documents by type
 * @param {string} type - Document type
 * @returns {Promise<Document[]>}
 */
const getDocumentsByType = async (type) => {
  return Document.find({ type }).sort({ createdAt: -1 });
};

/**
 * Delete document
 * @param {string} documentId
 * @returns {Promise<void>}
 */
const deleteDocument = async (documentId) => {
  const document = await getDocumentById(documentId);
  
  try {
    // Delete file from disk
    await fs.unlink(document.path);
  } catch (error) {
    console.warn('Failed to delete file from disk:', error.message);
  }

  // Delete database record
  await Document.findByIdAndDelete(documentId);
};

/**
 * Get document content (text or file buffer)
 * @param {string} documentId
 * @param {boolean} asBuffer - Return file buffer instead of text
 * @returns {Promise<string|Buffer>}
 */
const getDocumentContent = async (documentId, asBuffer = false) => {
  const document = await getDocumentById(documentId);
  
  if (!asBuffer && document.extractedText) {
    return document.extractedText;
  }

  try {
    const buffer = await fs.readFile(document.path);
    return asBuffer ? buffer : buffer.toString();
  } catch (error) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to read document content');
  }
};

/**
 * Update document metadata
 * @param {string} documentId
 * @param {Object} metadata
 * @returns {Promise<Document>}
 */
const updateDocumentMetadata = async (documentId, metadata) => {
  const document = await Document.findByIdAndUpdate(
    documentId,
    { $set: { metadata } },
    { new: true }
  );

  if (!document) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Document not found');
  }

  return document;
};

/**
 * Mark document as vectorized
 * @param {string} documentId
 * @returns {Promise<Document>}
 */
const markAsVectorized = async (documentId) => {
  const document = await Document.findByIdAndUpdate(
    documentId,
    { vectorized: true },
    { new: true }
  );

  if (!document) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Document not found');
  }

  return document;
};

/**
 * Get all reference documents (job descriptions, rubrics, case studies)
 * @returns {Promise<Object>}
 */
const getReferenceDocuments = async () => {
  const [jobDescriptions, caseStudies, cvRubrics, projectRubrics] = await Promise.all([
    Document.find({ type: 'job_description' }),
    Document.find({ type: 'case_study' }),
    Document.find({ type: 'cv_rubric' }),
    Document.find({ type: 'project_rubric' }),
  ]);

  return {
    jobDescriptions,
    caseStudies,
    cvRubrics,
    projectRubrics,
  };
};

export default {
  saveDocument,
  getDocumentById,
  getDocumentsByType,
  deleteDocument,
  getDocumentContent,
  updateDocumentMetadata,
  markAsVectorized,
  getReferenceDocuments,
};