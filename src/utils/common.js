import { randomBytes } from 'crypto';

/**
 * Generate a unique job ID for evaluation tasks
 * @returns {string} - Unique job identifier
 */
export const generateJobId = () => {
  const timestamp = Date.now().toString(36);
  const randomPart = randomBytes(6).toString('hex');
  return `eval_${timestamp}_${randomPart}`;
};

/**
 * Generate a unique filename with timestamp
 * @param {string} originalName - Original filename
 * @returns {string} - Unique filename
 */
export const generateUniqueFilename = (originalName) => {
  const timestamp = Date.now();
  const randomPart = randomBytes(4).toString('hex');
  const extension = originalName.split('.').pop();
  const nameWithoutExt = originalName.replace(/\.[^/.]+$/, "");
  
  return `${nameWithoutExt}_${timestamp}_${randomPart}.${extension}`;
};

/**
 * Validate file type for document uploads
 * @param {string} mimetype - File mimetype
 * @param {Array<string>} allowedTypes - Allowed mimetypes
 * @returns {boolean} - Whether file type is valid
 */
export const isValidFileType = (mimetype, allowedTypes = []) => {
  const defaultAllowedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ];
  
  const typesToCheck = allowedTypes.length > 0 ? allowedTypes : defaultAllowedTypes;
  return typesToCheck.includes(mimetype);
};

/**
 * Format file size to human readable string
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted file size
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Extract job ID from evaluation job identifier
 * @param {string} jobId - Full job identifier
 * @returns {string} - Clean job ID
 */
export const extractJobId = (jobId) => {
  return jobId.replace(/^eval_/, '');
};

/**
 * Generate evaluation summary text
 * @param {Object} results - Evaluation results
 * @returns {string} - Summary text
 */
export const generateEvaluationSummary = (results) => {
  if (!results) return 'Evaluation pending';
  
  const { cvMatchRate, projectScore, overallRecommendation } = results;
  
  return `CV Match: ${Math.round(cvMatchRate * 100)}% | Project Score: ${projectScore}/5 | ${overallRecommendation}`;
};

/**
 * Calculate processing time in human readable format
 * @param {Date} startTime - Start timestamp
 * @param {Date} endTime - End timestamp
 * @returns {string} - Formatted duration
 */
export const formatProcessingTime = (startTime, endTime) => {
  const diffMs = endTime - startTime;
  const diffSeconds = Math.round(diffMs / 1000);
  
  if (diffSeconds < 60) {
    return `${diffSeconds} seconds`;
  }
  
  const diffMinutes = Math.round(diffSeconds / 60);
  return `${diffMinutes} minutes`;
};

export default {
  generateJobId,
  generateUniqueFilename,
  isValidFileType,
  formatFileSize,
  extractJobId,
  generateEvaluationSummary,
  formatProcessingTime
};