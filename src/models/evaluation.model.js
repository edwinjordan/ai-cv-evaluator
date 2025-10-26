import mongoose from 'mongoose';
import { toJSON, paginate } from './plugins/index.js';

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
        experience: { type: Number, min: 0, max: 1 },
        education: { type: Number, min: 0, max: 1 },
        soft_skills: { type: Number, min: 0, max: 1 },
      },
      project_match_rate: {
        type: Number,
        min: 0,
        max: 1,
      },
      project_feedback: {
        type: String,
      },
      project_breakdown: {
        technical_complexity: { type: Number, min: 0, max: 1 },
        problem_solving: { type: Number, min: 0, max: 1 },
        implementation: { type: Number, min: 0, max: 1 },
        innovation: { type: Number, min: 0, max: 1 },
      },
      overall_summary: {
        type: String,
      },
      overallScore: {
        type: Number,
        min: 0,
        max: 1,
      },
      matchPercentage: {
        type: Number,
        min: 0,
        max: 100,
      },
      recommendation: {
        type: String,
        enum: ['Recommended', 'Consider', 'Not Recommended'],
      },
      generatedAt: {
        type: Date,
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
evaluationSchema.plugin(paginate);

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