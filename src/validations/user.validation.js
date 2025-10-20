import Joi from 'joi';
import { password, objectId } from './custom.validation.js';
import { roles } from '../config/roles.js';

const createUser = {
  body: Joi.object().keys({
    email: Joi.string().required().email(),
    password: Joi.string().required().custom(password),
    name: Joi.string().required(),
    address: Joi.string().required(),
    gender: Joi.number(),
    dateOfBirth: Joi.date(),
    phoneNumber: Joi.string(),
    role: Joi.string()
      .required()
      .valid(...roles),
  }),
};

const getUsers = {
  query: Joi.object().keys({
    name: Joi.string().allow(null, ''),
    role: Joi.string(),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

const getUser = {
  params: Joi.object().keys({
    userId: Joi.string().custom(objectId),
  }),
};

const updateUser = {
  params: Joi.object().keys({
    userId: Joi.required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      email: Joi.string().email(),
      password: Joi.string().custom(password),
      name: Joi.string(),
      address: Joi.string(),
      gender: Joi.number(),
      dateOfBirth: Joi.date(),
      phoneNumber: Joi.string()
    })
    .min(0),
  file: Joi.string()
};

const deleteUser = {
  params: Joi.object().keys({
    userId: Joi.string().custom(objectId),
  }),
};

export default {
  createUser,
  getUsers,
  getUser,
  updateUser,
  deleteUser,
};
