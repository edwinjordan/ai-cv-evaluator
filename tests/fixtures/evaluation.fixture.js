import mongoose from 'mongoose';
import { faker } from '@faker-js/faker';
import Evaluation from '../../src/models/evaluation.model.js';
import { userOne, userTwo } from './user.fixture.js';

const evaluationIds = {
  evaluationOne: () => new mongoose.Types.ObjectId(),
  evaluationTwo: () => new mongoose.Types.ObjectId(),
  evaluationThree: () => new mongoose.Types.ObjectId(),
};

const evaluationOne = {
  _id: evaluationIds.evaluationOne(),
  jobId: 'job_' + faker.string.alphanumeric(8),
  jobTitle: 'Backend Engineer',
  cvDocumentId: new mongoose.Types.ObjectId(),
  projectDocumentId: new mongoose.Types.ObjectId(),
  status: 'completed',
  result: {
    cv_match_rate: 0.85,
    cv_feedback: 'Strong technical background with relevant experience in Node.js and MongoDB.',
    cv_breakdown: {
      technical_skills: 0.9,
      experience_level: 0.8,
      achievements: 0.75,
      cultural_fit: 0.85,
    },
    project_score: 4.2,
    project_feedback: 'Well-structured project demonstrating good coding practices and architectural decisions.',
    project_breakdown: {
      correctness: 4.5,
      code_quality: 4.0,
      resilience: 4.0,
      documentation: 4.2,
      creativity: 4.3,
    },
    overall_summary: 'Strong candidate with excellent technical skills and good project implementation. Recommended for hire.',
  },
  createdBy: userOne._id,
  processingStartedAt: new Date(Date.now() - 300000), // 5 minutes ago
  processingCompletedAt: new Date(Date.now() - 60000), // 1 minute ago
};

const evaluationTwo = {
  _id: evaluationIds.evaluationTwo(),
  jobId: 'job_' + faker.string.alphanumeric(8),
  jobTitle: 'Full Stack Developer',
  cvDocumentId: new mongoose.Types.ObjectId(),
  projectDocumentId: new mongoose.Types.ObjectId(),
  status: 'processing',
  createdBy: userOne._id,
  processingStartedAt: new Date(Date.now() - 120000), // 2 minutes ago
};

const evaluationThree = {
  _id: evaluationIds.evaluationThree(),
  jobId: 'job_' + faker.string.alphanumeric(8),
  jobTitle: 'Frontend Developer',
  cvDocumentId: new mongoose.Types.ObjectId(),
  projectDocumentId: new mongoose.Types.ObjectId(),
  status: 'failed',
  errorMessage: 'LLM API quota exceeded',
  retryCount: 3,
  createdBy: userTwo._id,
  processingStartedAt: new Date(Date.now() - 600000), // 10 minutes ago
};

const insertEvaluations = async (evaluations) => {
  await Evaluation.insertMany(evaluations.map((evaluation) => ({ ...evaluation })));
};

export {
  evaluationOne,
  evaluationTwo,
  evaluationThree,
  evaluationIds,
  insertEvaluations,
};