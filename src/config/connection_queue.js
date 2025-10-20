import Queue from 'bull';
import dotenv from 'dotenv';

dotenv.config();

export const evaluationQueue = new Queue('evaluation', {
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
    },
});

console.log('✓ Evaluation queue initialized');