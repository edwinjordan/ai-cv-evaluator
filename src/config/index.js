import dotenv from 'dotenv';
import Joi from 'joi';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

const envVarsSchema = Joi.object()
  .keys({
    NODE_ENV: Joi.string().valid('production', 'development', 'test').required(),
    PORT: Joi.number().default(3002),
    
    // Database
    MONGODB_URL: Joi.string().required().description('Mongo DB url'),
    
    // JWT
    JWT_SECRET: Joi.string().required().description('JWT secret key'),
    JWT_ACCESS_EXPIRATION_MINUTES: Joi.number().default(30).description('minutes after which access tokens expire'),
    JWT_REFRESH_EXPIRATION_DAYS: Joi.number().default(30).description('days after which refresh tokens expire'),
    JWT_RESET_PASSWORD_EXPIRATION_MINUTES: Joi.number().default(10).description('minutes after which reset password token expires'),
    JWT_VERIFY_EMAIL_EXPIRATION_MINUTES: Joi.number().default(10).description('minutes after which verify email token expires'),
    
    // ChromaDB
    CHROMA_HOST: Joi.string().default('localhost').description('ChromaDB host'),
    CHROMA_PORT: Joi.number().default(8000).description('ChromaDB port'),
    CHROMADB_URL: Joi.string().description('ChromaDB full URL (overrides host/port)'),
    
    // LLM Configuration
    LLM_API_URL: Joi.string().default('https://openrouter.ai/api/v1').description('LLM API base URL'),
    LLM_API_KEY: Joi.string().description('LLM API key'),
    OPENAPI_KEY: Joi.string().description('OpenRouter API key (legacy)'),
    OPENAI_API_KEY: Joi.string().description('OpenAI API key'),
    LLM_PROVIDER: Joi.string().valid('openai', 'openrouter').description('LLM provider (openai or openrouter)'),
    LLM_MODEL: Joi.string().default('meta-llama/llama-3.1-8b-instruct:free').description('Default LLM model'),
    LLM_EVALUATION_MODEL: Joi.string().description('Model for evaluations'),
    LLM_TEMPERATURE: Joi.number().default(0.3).description('LLM temperature'),
    LLM_MAX_TOKENS: Joi.number().default(2000).description('LLM max tokens'),
    LLM_HTTP_REFERER: Joi.string().default('http://localhost:3002').description('HTTP referer for LLM API'),
    LLM_APP_NAME: Joi.string().default('AI CV Evaluator').description('App name for LLM API'),
    
    // Redis
    REDIS_URL: Joi.string().description('Redis URL for queue management'),
    REDIS_HOST: Joi.string().default('localhost').description('Redis host'),
    REDIS_PORT: Joi.number().default(6379).description('Redis port'),
    REDIS_PASSWORD: Joi.string().description('Redis password'),
    
    // File Upload
    UPLOAD_MAX_SIZE: Joi.number().default(10485760).description('Max file size in bytes (10MB default)'),
    UPLOAD_ALLOWED_TYPES: Joi.string().default('application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword').description('Allowed file types'),
  })
  .unknown();

const { value: envVars, error } = envVarsSchema.prefs({ errors: { label: 'key' } }).validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

const config = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  
  mongoose: {
    url: envVars.MONGODB_URL + (envVars.NODE_ENV === 'test' ? '-test' : ''),
    options: {},
  },
  
  jwt: {
    secret: envVars.JWT_SECRET,
    accessExpirationMinutes: envVars.JWT_ACCESS_EXPIRATION_MINUTES,
    refreshExpirationDays: envVars.JWT_REFRESH_EXPIRATION_DAYS,
    resetPasswordExpirationMinutes: envVars.JWT_RESET_PASSWORD_EXPIRATION_MINUTES,
    verifyEmailExpirationMinutes: envVars.JWT_VERIFY_EMAIL_EXPIRATION_MINUTES,
  },
  
  chromadb: {
    host: envVars.CHROMA_HOST,
    port: envVars.CHROMA_PORT,
    url: envVars.CHROMADB_URL || `http://${envVars.CHROMA_HOST}:${envVars.CHROMA_PORT}`,
  },
  
  llm: {
    apiUrl: envVars.LLM_API_URL,
    apiKey: envVars.LLM_API_KEY || envVars.OPENAPI_KEY || envVars.OPENAI_API_KEY,
    provider: envVars.LLM_PROVIDER,
    defaultModel: envVars.LLM_MODEL,
    evaluationModel: envVars.LLM_EVALUATION_MODEL || envVars.LLM_MODEL || 'meta-llama/llama-3.1-8b-instruct:free',
    temperature: envVars.LLM_TEMPERATURE,
    maxTokens: envVars.LLM_MAX_TOKENS,
    httpReferer: envVars.LLM_HTTP_REFERER,
    appName: envVars.LLM_APP_NAME,
  },
  
  redis: {
    url: envVars.REDIS_URL,
    host: envVars.REDIS_HOST,
    port: envVars.REDIS_PORT,
    password: envVars.REDIS_PASSWORD,
  },
  
  upload: {
    maxSize: envVars.UPLOAD_MAX_SIZE,
    allowedTypes: envVars.UPLOAD_ALLOWED_TYPES.split(',').map(type => type.trim()),
    destination: 'uploads/',
  },
};

export default config;