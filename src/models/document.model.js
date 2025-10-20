import mongoose from 'mongoose';
import { toJSON } from './plugins/index.js';

const documentSchema = mongoose.Schema(
  {
    filename: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
      enum: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    },
    size: {
      type: Number,
      required: true,
    },
    path: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['cv', 'project_report', 'job_description', 'case_study', 'cv_rubric', 'project_rubric'],
    },
    extractedText: {
      type: String,
    },
    vectorized: {
      type: Boolean,
      default: false,
    },
    uploadedBy: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'User',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
documentSchema.plugin(toJSON);

/**
 * Check if document exists by filename
 * @param {string} filename
 * @returns {Promise<boolean>}
 */
documentSchema.statics.isFilenameTaken = async function (filename) {
  const document = await this.findOne({ filename });
  return !!document;
};

/**
 * @typedef Document
 */
const Document = mongoose.model('Document', documentSchema);

export default Document;