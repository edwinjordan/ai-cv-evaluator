import mongoose from 'mongoose';
import config from '../../src/config/config.js';

const setupTestDB = () => {
  beforeAll(async () => {
    try {
      // Only connect if not already connected
      if (mongoose.connection.readyState === 0) {
        const connectionOptions = {
          ...config.mongoose.options,
          connectTimeoutMS: 10000,
          serverSelectionTimeoutMS: 10000,
        };
        await mongoose.connect(config.mongoose.url, connectionOptions);
        console.log('✅ Test database connected');
      }
    } catch (error) {
      console.error('❌ Test database connection failed:', error.message);
      console.error('Please ensure MongoDB is running with: npm run mongodb:start');
      throw error;
    }
  }, 15000); // 15 second timeout for beforeAll

  beforeEach(async () => {
    // Ensure connection is ready before cleaning
    if (mongoose.connection.readyState === 1) {
      const collections = mongoose.connection.collections;
      await Promise.all(
        Object.values(collections).map(async (collection) => {
          await collection.deleteMany({});
        })
      );
    }
  });

  afterAll(async () => {
    try {
      // Wait longer for any async operations to complete
      // This gives time for any background evaluation processing to finish
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Force close any remaining connections
      if (mongoose.connection.readyState === 1) {
        // Close the connection more gracefully
        await mongoose.connection.close();
        console.log('✅ Test database disconnected');
      }
    } catch (error) {
      console.error('Error during test cleanup:', error.message);
      // Force disconnect if graceful close fails
      try {
        await mongoose.disconnect();
      } catch (disconnectError) {
        console.error('Force disconnect also failed:', disconnectError.message);
      }
    }
  }, 10000); // 10 second timeout for cleanup
};

export default setupTestDB;