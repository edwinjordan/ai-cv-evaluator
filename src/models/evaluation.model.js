import mongoose from 'mongoose';
import { toJSON } from './plugins/index.js';

const evaluationSchema = mongoose.Schema(
  {
    jobId: {
      type: String,
      required: true,
      unique: true,
    },
    jobTitle: {
      type: String,
      required: true,
    },
    cvDocumentId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Document',
      required: true,
    },
    projectDocumentId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Document',
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['queued', 'processing', 'completed', 'failed'],
      default: 'queued',
    },
    result: {
      cv_match_rate: {
        type: Number,
        min: 0,
        max: 1,
      },
      cv_feedback: {
        type: String,
      },
      cv_breakdown: {
        technical_skills: { type: Number, min: 0, max: 1 },
        experience_level: { type: Number, min: 0, max: 1 },
        achievements: { type: Number, min: 0, max: 1 },
        cultural_fit: { type: Number, min: 0, max: 1 },
      },
      project_score: {
        type: Number,
        min: 1,
        max: 5,
      },
      project_feedback: {
        type: String,
      },
      project_breakdown: {
        correctness: { type: Number, min: 1, max: 5 },
        code_quality: { type: Number, min: 1, max: 5 },
        resilience: { type: Number, min: 1, max: 5 },
        documentation: { type: Number, min: 1, max: 5 },
        creativity: { type: Number, min: 1, max: 5 },
      },
      overall_summary: {
        type: String,
      },
    },
    errorMessage: {
      type: String,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    processingStartedAt: {
      type: Date,
    },
    processingCompletedAt: {
      type: Date,
    },
    createdBy: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
evaluationSchema.plugin(toJSON);

/**
 * Check if job ID exists
 * @param {string} jobId
 * @returns {Promise<boolean>}
 */
evaluationSchema.statics.isJobIdTaken = async function (jobId) {
  const evaluation = await this.findOne({ jobId });
  return !!evaluation;
};

/**
 * @typedef Evaluation
 */
const Evaluation = mongoose.model('Evaluation', evaluationSchema);

export default Evaluation;