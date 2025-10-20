import passport from 'passport';
import httpStatus from 'http-status';
import ApiError from '../utils/ApiError.js';
import { roleRights } from '../config/roles.js';

const verifyCallback = (req, resolve, reject, requiredRights) => async (err, user, info) => {
  if (err || info || !user) {
    return reject(new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate'));
  }
  req.user = user;

  if (requiredRights.length) {
    const userRights = roleRights.get(user.role);
    console.log('User:', user);
    if (!userRights) {
      return reject(new ApiError(httpStatus.FORBIDDEN, 'User role not found'));
    }
    
    const hasRequiredRights = requiredRights.every((requiredRight) => userRights.includes(requiredRight));
    
    if (!hasRequiredRights) {
      return reject(new ApiError(httpStatus.FORBIDDEN, `Access denied. Required permissions: ${requiredRights.join(', ')}`));
    }
    
    // Additional check for user-specific resources
    if (requiredRights.includes('manageUsers') && req.params.userId && req.params.userId !== user.id && user.role !== 'admin') {
      return reject(new ApiError(httpStatus.FORBIDDEN, 'Cannot access other user resources'));
    }
  }

  resolve();
};

const auth =
  (...requiredRights) =>
  async (req, res, next) => {
    return new Promise((resolve, reject) => {
      passport.authenticate('jwt', { session: false }, verifyCallback(req, resolve, reject, requiredRights))(req, res, next);
    })
      .then(() => next())
      .catch((err) => next(err));
  };

export default auth;
