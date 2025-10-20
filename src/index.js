import mongoose from 'mongoose';
import app from './app.js';
import config from './config/config.js';
import logger from './config/logger.js';

logger.info('Starting server...');
logger.info(`Configuration loaded: ${JSON.stringify({ port: config.port, env: config.env })}`);

let server;
mongoose.connect(config.mongoose.url, config.mongoose.options).then(() => {
  logger.info('Connected to MongoDB');
  
  logger.info(`Attempting to listen on port ${config.port}...`);
  server = app.listen(config.port, () => {
    logger.info(`🚀 Server is running on port ${config.port}`);
    logger.info(`📚 API Documentation: http://localhost:${config.port}/v1/docs`);
  });
  
  server.on('error', (error) => {
    logger.error('Server error:', error);
    if (error.code === 'EADDRINUSE') {
      logger.error(`Port ${config.port} is already in use`);
    }
  });
  
  server.on('listening', () => {
    logger.info('Server listening event fired');
  });
  
}).catch((error) => {
  logger.error('Failed to connect to MongoDB:', error);
  process.exit(1);
});

const exitHandler = () => {
  if (server) {
    server.close(() => {
      logger.info('Server closed');
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
};

const unexpectedErrorHandler = (error) => {
  logger.error('Unexpected error occurred:', error);
  logger.error('Error stack:', error.stack);
  exitHandler();
};

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  logger.error('Error stack:', error.stack);
  unexpectedErrorHandler(error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  unexpectedErrorHandler(new Error(`Unhandled rejection: ${reason}`));
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received');
  if (server) {
    server.close();
  }
});