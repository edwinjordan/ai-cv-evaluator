import mongoose from 'mongoose';
import config from '../../src/config/config.js';

const setupTestDB = () => {
  beforeAll(async () => {
    // Only connect if not already connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.mongoose.url, config.mongoose.options);
    }
  });

  beforeEach(async () => {
    // Ensure connection is ready before cleaning
    if (mongoose.connection.readyState === 1) {
      await Promise.all(Object.values(mongoose.connection.collections).map(async (collection) => collection.deleteMany()));
    }
  });

  afterAll(async () => {
    // Wait a bit for any async operations to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Only disconnect if we're the last test file
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  });
};

export default setupTestDB;