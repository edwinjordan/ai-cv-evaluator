import Redis from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redisClient = Redis.createClient({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
});

redisClient.on('connect', () => {
    console.log('✓ Connected to Redis');
});

redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
});

await redisClient.connect();

export default redisClient;