import mongoose from 'mongoose';
import config from '../../src/config/config.js';

describe('Database connection test', () => {
  test('should connect to test database', async () => {
    const connectionOptions = {
      ...config.mongoose.options,
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 10000,
    };
    
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.mongoose.url, connectionOptions);
    }
    
    expect(mongoose.connection.readyState).toBe(1);
    
    // Cleanup
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  }, 15000);
});