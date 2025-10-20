import express from 'express';
import helmet from 'helmet';
import xss from 'xss-clean';
import mongoSanitize from 'express-mongo-sanitize';
import compression from 'compression';
import cors from 'cors';
import passport from 'passport';
import httpStatus from 'http-status';
import config from './config/config.js';
import morgan from './config/morgan.js';
import { jwtStrategy } from './config/passport.js';
import { authLimiter } from './middlewares/rateLimiter.js';
import routes from './routes/v1/index.js';
import { errorConverter, errorHandler } from './middlewares/error.js';
import ApiError from './utils/ApiError.js';

const app = express();

if (config.env !== 'test') {
  app.use(morgan.successHandler);
  app.use(morgan.errorHandler);
}

// set security HTTP headers with relaxed CSP for dashboard
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Allow inline scripts for dashboard
        "'unsafe-eval'", // Allow eval for chart.js
        "https://cdn.jsdelivr.net",
        "https://cdn.tailwindcss.com",
        "https://cdnjs.cloudflare.com"
      ],
      scriptSrcAttr: [
        "'self'",
        "'unsafe-inline'", // Allow inline event handlers
        "'unsafe-hashes'" // Allow hashed inline event handlers
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // Allow inline styles
        "https://cdn.tailwindcss.com",
        "https://cdnjs.cloudflare.com"
      ],
      fontSrc: [
        "'self'",
        "https://cdnjs.cloudflare.com"
      ],
      connectSrc: [
        "'self'",
        "http://localhost:3000", // Allow API calls to localhost
        "https://cdn.jsdelivr.net" // Allow source map downloads
      ],
      imgSrc: [
        "'self'",
        "data:", // Allow data URLs for images
        "https:"
      ]
    }
  }
}));

// parse json request body
app.use(express.json());

// parse urlencoded request body
app.use(express.urlencoded({ extended: true }));

// sanitize request data
app.use(xss());
app.use(mongoSanitize());

// gzip compression
app.use(compression());

// enable cors
app.use(cors());
app.options('*', cors());

// jwt authentication
app.use(passport.initialize());
passport.use('jwt', jwtStrategy);

// limit repeated failed requests to auth endpoints
if (config.env === 'production') {
  app.use('/v1/auth', authLimiter);
}

// v1 api routes
app.use('/v1', routes);

// Handle Chrome DevTools requests silently
app.use('/.well-known', (req, res) => {
  res.status(404).end();
});

// Handle favicon requests silently
app.use('/favicon.ico', (req, res) => {
  res.status(404).end();
});

// send back a 404 error for any unknown api request
app.use((req, res, next) => {
  next(new ApiError(httpStatus.NOT_FOUND, 'Not found'));
});

// convert error to ApiError, if needed
app.use(errorConverter);

// handle error
app.use(errorHandler);

export default app;