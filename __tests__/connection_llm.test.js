import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';

// Mock axios and dotenv at the top level
const mockAxiosInstance = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  request: jest.fn(),
  defaults: {
    baseURL: 'https://openrouter.ai/api/v1',
    timeout: 60000,
    headers: {}
  }
};

const mockAxiosCreate = jest.fn(() => mockAxiosInstance);

jest.unstable_mockModule('axios', () => ({
  default: {
    create: mockAxiosCreate
  }
}));

jest.unstable_mockModule('dotenv', () => ({
  default: {
    config: jest.fn()
  }
}));

describe('LLM Connection Tests', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.OPENAPI_KEY = 'test-api-key';
    process.env.LLM_MODEL = 'test-model';
    process.env.LLM_TEMPERATURE = '0.5';
    process.env.LLM_MAX_TOKENS = '1500';
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('should create axios client with correct configuration', async () => {
    const module = await import('../src/config/connection_llm.js');

    expect(mockAxiosCreate).toHaveBeenCalledWith({
      baseURL: 'https://openrouter.ai/api/v1',
      headers: {
        'Authorization': 'Bearer test-api-key',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'CV AI Evaluator',
        'Content-Type': 'application/json',
      },
      timeout: 60000
    });
  });

  test('should export LLM_CONFIG with correct structure', async () => {
    const { LLM_CONFIG } = await import('../src/config/connection_llm.js?t=' + Date.now());

    expect(LLM_CONFIG).toBeDefined();
    expect(LLM_CONFIG).toHaveProperty('model');
    expect(LLM_CONFIG).toHaveProperty('temperature');
    expect(LLM_CONFIG).toHaveProperty('max_tokens');
    expect(typeof LLM_CONFIG.temperature).toBe('number');
    expect(typeof LLM_CONFIG.max_tokens).toBe('number');
  });

  test('should use environment variables when provided', async () => {
    const { LLM_CONFIG } = await import('../src/config/connection_llm.js?t=' + Date.now());

    expect(LLM_CONFIG.model).toBe('test-model');
    expect(LLM_CONFIG.temperature).toBe(0.5);
    expect(LLM_CONFIG.max_tokens).toBe(1500);
  });
});
