import Joi from 'joi';
import { objectId } from './custom.validation.js';

const startEvaluation = {
  body: Joi.object().keys({
    job_title: Joi.string().required().min(3).max(100),
    cv_id: Joi.string().required().custom(objectId),
    project_id: Joi.string().required().custom(objectId),
  }),
};

const getResult = {
  params: Joi.object().keys({
    id: Joi.string().required().min(3).max(100),
  }),
};

const uploadSingleDocument = {
  body: Joi.object().keys({
    type: Joi.string().required().valid('job_description', 'case_study', 'cv_rubric', 'project_rubric'),
  }),
};

const getDocument = {
  params: Joi.object().keys({
    documentId: Joi.string().required().custom(objectId),
  }),
};

const deleteDocument = {
  params: Joi.object().keys({
    documentId: Joi.string().required().custom(objectId),
  }),
};

const listDocuments = {
  query: Joi.object().keys({
    type: Joi.string().optional().valid('cv', 'project_report', 'job_description', 'case_study', 'cv_rubric', 'project_rubric'),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
  }),
};

export default {
  startEvaluation,
  getResult,
  uploadSingleDocument,
  getDocument,
  deleteDocument,
  listDocuments,
};