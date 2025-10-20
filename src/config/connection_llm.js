import axios from 'axios';
import config from './index.js';
import logger from './logger.js';
import dotenv from 'dotenv';
import { retryWithBackoff } from '../utils/helper.js';
dotenv.config();

class LLMConnection {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.availableModels = [];
    this.apiProvider = null; // 'openai' or 'openrouter'
  }

  /**
   * Detect API provider based on configuration and API key
   * @param {string} apiKey - API key to analyze
   * @returns {string} - 'openai' or 'openrouter'
   */
  detectApiProvider(apiKey) {
    // Check if explicitly configured
    if (config.llm.provider) {
      return config.llm.provider.toLowerCase();
    }

    // Detect based on API key format
    if (apiKey.startsWith('sk-') && !apiKey.includes('or-v1')) {
      return 'openai';
    } else if (apiKey.startsWith('sk-or-v1') || apiKey.includes('openrouter')) {
      return 'openrouter';
    }

    // Check base URL
    const baseUrl = config.llm.apiUrl || '';
    if (baseUrl.includes('openai.com')) {
      return 'openai';
    } else if (baseUrl.includes('openrouter.ai')) {
      return 'openrouter';
    }

    // Default to OpenRouter for compatibility
    return 'openrouter';
  }

  /**
   * Get API configuration based on provider
   * @param {string} provider - API provider ('openai' or 'openrouter')
   * @param {string} apiKey - API key
   * @returns {Object} - API configuration
   */
  getApiConfig(provider, apiKey) {
    const baseConfigs = {
      openai: {
        baseURL: 'https://api.openai.com/v1',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        defaultModel: 'gpt-3.5-turbo',
        embeddingModel: 'text-embedding-ada-002'
      },
      openrouter: {
        baseURL: 'https://openrouter.ai/api/v1',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': config.llm.httpReferer || 'http://localhost:3002',
          'X-Title': config.llm.appName || 'AI CV Evaluator'
        },
        defaultModel: 'mistralai/mistral-7b-instruct:free',
        embeddingModel: 'text-embedding-ada-002'
      }
    };

    // Get base configuration
    const userConfig = { ...baseConfigs[provider] };
    
    // Override with user configurations if provided
    if (config.llm.apiUrl) {
      userConfig.baseURL = config.llm.apiUrl;
    }

    // For OpenAI, ensure we use OpenAI URL even if not explicitly set
    if (provider === 'openai' && !config.llm.apiUrl) {
      userConfig.baseURL = 'https://api.openai.com/v1';
    }

    return userConfig;
  }

  /**
   * Initialize LLM connection
   * @returns {Promise<void>}
   */
  async connect() {
    try {
      // Get API key from config or environment with proper priority
      const apiKey = process.env.OPENAPI_KEY;
      
      if (!apiKey) {
        throw new Error('LLM API key not found. Please set OPENAI_API_KEY environment variable.');
      }

      logger.info('Found API key, detecting provider...');

      // Detect API provider
      this.apiProvider = this.detectApiProvider(apiKey);
      logger.info(`Detected API provider: ${this.apiProvider}`);

      // Get API configuration
      const apiConfig = this.getApiConfig(this.apiProvider, apiKey);
      
      logger.info(`Connecting to ${this.apiProvider.toUpperCase()} API at ${apiConfig.baseURL}...`);
      
      this.client = axios.create({
        baseURL: apiConfig.baseURL,
        headers: apiConfig.headers,
        timeout: 60000 // 60 second timeout
      });

      // Store configuration for later use
      this.defaultModel = apiConfig.defaultModel;
      this.embeddingModel = apiConfig.embeddingModel;

      // Test connection and get available models
      await this.testConnection();
      this.isConnected = true;
      
      logger.info(`${this.apiProvider.toUpperCase()} API connected successfully`);
      
    } catch (error) {
      logger.error(`${this.apiProvider || 'LLM'} API connection failed:`, error.message);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Test LLM API connection and get available models
   * @returns {Promise<void>}
   */
  async testConnection() {
    try {
      const response = await this.client.get('/models');
      this.availableModels = response.data.data || [];
      
      logger.info(`Found ${this.availableModels.length} available LLM models`);
      
    } catch (error) {
      logger.error('Failed to fetch LLM models:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Generate chat completion
   * @param {Array} messages - Array of message objects
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} - LLM response
   */
  async generateCompletion(messages, options = {}) {
    if (!this.isConnected) {
      await this.connect();
    }

    // Get default model based on provider
    const defaultModel = this.getDefaultModel();
    
    const {
      model = process.env.LLM_MODEL || defaultModel,
      temperature = 0.7,
      maxTokens = 2000,
      stream = false
    } = options;

    try {
      // Prepare request payload based on API provider
      const requestPayload = {
        model,
        messages,
        temperature,
        stream
      };

      // Handle max_tokens vs max_completion_tokens
      if (this.apiProvider === 'openai') {
        requestPayload.max_completion_tokens = maxTokens;
      } else {
        requestPayload.max_tokens = maxTokens;
      }

      logger.debug(`Making ${this.apiProvider.toUpperCase()} API request with model: ${model}`);

      const response = await retryWithBackoff(async () => {
         return await this.client.post('/chat/completions', requestPayload);
      }, 3, 2000);

      // Log the response for debugging
      logger.debug('LLM API Response:', JSON.stringify(response.data, null, 2));

      // Flexible validation - handle different response formats
      if (!response.data) {
        throw new Error('No data in LLM API response');
      }

      // Handle OpenRouter format
      if (response.data.choices && Array.isArray(response.data.choices) && response.data.choices.length > 0) {
        const choice = response.data.choices[0];
        
        if (choice && choice.message && choice.message.content !== undefined) {
          return {
            success: true,
            content: choice.message.content || '',
            usage: response.data.usage || {},
            model: response.data.model || model,
            finishReason: choice.finish_reason || 'unknown'
          };
        }
      }

      // Handle alternative response formats
      if (response.data.content) {
        return {
          success: true,
          content: response.data.content,
          usage: response.data.usage || {},
          model: response.data.model || model,
          finishReason: 'complete'
        };
      }

      // Handle text-only response
      if (typeof response.data === 'string') {
        return {
          success: true,
          content: response.data,
          usage: {},
          model: model,
          finishReason: 'complete'
        };
      }

      // If we get here, log the unexpected format and throw error
      logger.error('Unexpected LLM response format:', JSON.stringify(response.data, null, 2));
      throw new Error(`Unexpected response format from LLM API. Got: ${typeof response.data}`);

    } catch (error) {
      // Enhanced error logging
      if (error.response) {
        logger.error('LLM API error response:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
      } else {
        logger.error('LLM completion failed:', error.message);
      }
      
      return {
        success: false,
        content: '',
        error: error.response?.data?.error?.message || error.message,
        statusCode: error.response?.status
      };
    }
  }

  /**
   * Get default model based on API provider
   * @returns {string} - Default model name
   */
  getDefaultModel() {
    // Get user-configured model first
    const userModel = config.llm.defaultModel || process.env.LLM_MODEL;
    
    if (this.apiProvider === 'openai') {
      // Validate OpenAI model name or use safe default
      if (userModel && this.isValidOpenAIModel(userModel)) {
        return userModel;
      }
      return 'gpt-3.5-turbo'; // Safe OpenAI default
    } else {
      // For OpenRouter, use configured model or default
      return userModel || 'meta-llama/llama-3.1-8b-instruct:free';
    }
  }

  /**
   * Validate if a model name is a valid OpenAI model
   * @param {string} model - Model name to validate
   * @returns {boolean} - Whether the model is valid for OpenAI
   */
  isValidOpenAIModel(model) {
    const validOpenAIModels = [
      'gpt-4',
      'gpt-4-turbo',
      'gpt-4-turbo-preview',
      'gpt-3.5-turbo',
      'gpt-3.5-turbo-16k',
      'text-davinci-003',
      'text-embedding-ada-002'
    ];
    
    // Check if model starts with valid prefixes or is in the list
    return validOpenAIModels.includes(model) || 
           model.startsWith('gpt-4') || 
           model.startsWith('gpt-3.5') ||
           model.startsWith('text-');
  }

  /**
   * Get embedding model based on API provider
   * @param {string} customModel - Custom model override
   * @returns {string} - Embedding model name
   */
  getEmbeddingModel(customModel) {
    if (customModel) {
      return customModel;
    }
    
    if (this.apiProvider === 'openai') {
      return 'text-embedding-ada-002';
    } else {
      return 'text-embedding-ada-002'; // OpenRouter supports this too
    }
  }

  /**
   * Generate embeddings for text using available models
   * @param {string|string[]} input - Text or array of texts to embed
   * @param {Object} options - Embedding options
   * @returns {Promise<Object>} - Embedding result
   */
  async generateEmbeddings(input, options = {}) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const inputTexts = Array.isArray(input) ? input : [input];
      
      // Get embedding model based on provider
      const embeddingModel = this.getEmbeddingModel(options.model);
      
      // Method 1: Try dedicated embedding endpoint
      try {
        logger.debug(`Attempting ${this.apiProvider.toUpperCase()} embeddings with model: ${embeddingModel}`);
        
        const requestPayload = {
          model: embeddingModel,
          input: inputTexts
        };

        // Add encoding format for OpenAI
        if (this.apiProvider === 'openai') {
          requestPayload.encoding_format = 'float';
        }

        const response = await retryWithBackoff(async () => {
            return await this.client.post('/embeddings', requestPayload);
        });

        if (response.data && response.data.data && Array.isArray(response.data.data)) {
          const embeddings = response.data.data.map(item => item.embedding);
          
          logger.info(`Successfully generated embeddings using ${this.apiProvider.toUpperCase()} API`);
          
          return {
            success: true,
            embeddings: Array.isArray(input) ? embeddings : embeddings[0],
            model: response.data.model || embeddingModel,
            usage: response.data.usage,
            method: `${this.apiProvider}_embeddings`
          };
        }
      } catch (embeddingError) {
        logger.warn(`${this.apiProvider.toUpperCase()} embeddings endpoint failed: ${embeddingError.message}, trying LLM-based embeddings`);
      }

      // Method 2: Use LLM to generate text-based embeddings (fallback)
      logger.info('Generating embeddings using LLM completion method');
      
      const embeddingResults = [];
      for (const text of inputTexts) {
        const messages = [
          {
            role: 'system',
            content: 'You are an embedding generator. Convert the following text into a normalized numerical representation. Return only a comma-separated list of 128 floating-point numbers between -1 and 1 that represent the semantic meaning of the text.'
          },
          {
            role: 'user',
            content: `Generate embeddings for: "${text.substring(0, 500)}"`
          }
        ];

        const result = await this.generateCompletion(messages, {
          model: config.llm.defaultModel,
          temperature: 0.1,
          maxTokens: 1000
        });

        if (result.success && result.content) {
          try {
            // Parse the comma-separated numbers
            const numbers = result.content
              .replace(/[^\d,.-]/g, '') // Keep only digits, commas, dots, and minus signs
              .split(',')
              .map(str => parseFloat(str.trim()))
              .filter(num => !isNaN(num))
              .slice(0, 128); // Take first 128 numbers

            // Pad with random numbers if we don't have enough
            while (numbers.length < 128) {
              numbers.push((Math.random() - 0.5) * 2);
            }

            // Normalize the vector
            const magnitude = Math.sqrt(numbers.reduce((sum, num) => sum + num * num, 0));
            const normalizedEmbedding = numbers.map(num => num / (magnitude || 1));

            embeddingResults.push(normalizedEmbedding);
          } catch (parseError) {
            logger.warn('Failed to parse LLM-generated embedding, using random embedding');
            embeddingResults.push(new Array(128).fill(0).map(() => (Math.random() - 0.5) * 2));
          }
        } else {
          // Generate a simple hash-based embedding as last resort
          const hashEmbedding = this.generateHashBasedEmbedding(text);
          embeddingResults.push(hashEmbedding);
        }
      }

      return {
        success: true,
        embeddings: Array.isArray(input) ? embeddingResults : embeddingResults[0],
        model: 'llm_generated',
        usage: { total_tokens: inputTexts.reduce((sum, text) => sum + text.length, 0) },
        method: 'llm_completion'
      };

    } catch (error) {
      logger.error('All embedding generation methods failed:', error.message);
      
      // Final fallback: return deterministic mock embeddings
      const mockEmbeddings = Array.isArray(input) ? 
        input.map(text => this.generateHashBasedEmbedding(text)) :
        [this.generateHashBasedEmbedding(input)];
      
      logger.warn('Using deterministic hash-based embeddings as final fallback');
      
      return {
        success: false,
        embeddings: Array.isArray(input) ? mockEmbeddings : mockEmbeddings[0],
        error: error.message,
        fallback: true,
        method: 'hash_based'
      };
    }
  }

  /**
   * Generate a deterministic hash-based embedding from text
   * @param {string} text - Input text
   * @returns {number[]} - Embedding vector
   */
  generateHashBasedEmbedding(text) {
    const embedding = new Array(128).fill(0);
    
    // Simple hash-based embedding generation
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      const index = (char + i) % 128;
      embedding[index] += Math.sin(char * 0.1) * Math.cos(i * 0.1);
    }
    
    // Normalize the vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / (magnitude || 1));
  }

  /**
   * Generate structured evaluation using LLM
   * @param {string} prompt - Evaluation prompt
   * @param {Object} context - Context data for evaluation
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} - Structured evaluation result
   */
  async generateEvaluation(prompt, context, options = {}) {
    const messages = [
      {
        role: 'system',
        content: `You are an expert HR professional and technical recruiter. You evaluate CVs and project reports against job requirements with high accuracy and provide detailed, constructive feedback.

Context:
- Job Title: ${context.jobTitle}
- CV Content: ${context.cvContent}
- Project Content: ${context.projectContent}
- Job Requirements: ${context.jobRequirements || 'General evaluation criteria'}

Provide your evaluation in JSON format with specific scores and detailed feedback.`
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    // Try primary model, fallback to default if not available
    let modelToUse = options.model || config.llm.evaluationModel;
    
    try {
      const result = await this.generateCompletion(messages, {
        model: modelToUse,
        temperature: 0.3, // Lower temperature for more consistent evaluations
        maxTokens: options.maxTokens || 3000
      });

      if (result.success) {
        try {
          // Try to parse JSON response
          const parsed = JSON.parse(result.content);
          return { ...result, parsed };
        } catch (parseError) {
          logger.warn('LLM returned non-JSON response, using text content');
          return result;
        }
      }

      return result;
      
    } catch (error) {
      if (error.message.includes('No endpoints found') && modelToUse !== config.llm.defaultModel) {
        logger.warn(`Model ${modelToUse} not available, falling back to ${config.llm.defaultModel}`);
        
        // Retry with default model
        return this.generateEvaluation(prompt, context, {
          ...options,
          model: config.llm.defaultModel
        });
      }
      
      throw error;
    }
  }

  /**
   * Health check for LLM API
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    try {
      const response = await this.client.get('/models', { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      logger.error('LLM health check failed:', error.message);
      return false;
    }
  }
}

// Create singleton instance
const llmConnection = new LLMConnection();

export default llmConnection;