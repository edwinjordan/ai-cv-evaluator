import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import config from './index.js';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AI CV Evaluator API',
      version: '1.0.0',
      description: 'API documentation for AI CV Evaluator - A comprehensive system for evaluating CVs and project reports using AI',
      contact: {
        name: 'AI CV Evaluator Team',
        email: 'support@aicvevaluator.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.port}/v1`,
        description: 'Development server',
      },
      {
        url: 'https://api.aicvevaluator.com/v1',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            code: {
              type: 'number',
            },
            message: {
              type: 'string',
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'User ID',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
            },
            name: {
              type: 'string',
              description: 'User full name',
            },
            role: {
              type: 'string',
              enum: ['user', 'admin'],
              description: 'User role',
            },
            isEmailVerified: {
              type: 'boolean',
              description: 'Email verification status',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'User creation timestamp',
            },
          },
          required: ['id', 'email', 'name', 'role'],
        },
        Token: {
          type: 'object',
          properties: {
            token: {
              type: 'string',
              description: 'JWT token',
            },
            expires: {
              type: 'string',
              format: 'date-time',
              description: 'Token expiration time',
            },
          },
          required: ['token', 'expires'],
        },
        AuthTokens: {
          type: 'object',
          properties: {
            access: {
              $ref: '#/components/schemas/Token',
            },
            refresh: {
              $ref: '#/components/schemas/Token',
            },
          },
          required: ['access', 'refresh'],
        },
        Document: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Document ID',
            },
            userId: {
              type: 'string',
              description: 'ID of the document owner',
            },
            type: {
              type: 'string',
              enum: ['cv', 'project_report', 'job_description', 'case_study', 'cv_rubric', 'project_rubric'],
              description: 'Document type',
            },
            filename: {
              type: 'string',
              description: 'System filename',
            },
            originalName: {
              type: 'string',
              description: 'Original filename',
            },
            mimeType: {
              type: 'string',
              description: 'File MIME type',
            },
            size: {
              type: 'number',
              description: 'File size in bytes',
            },
            uploadedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Upload timestamp',
            },
          },
          required: ['id', 'userId', 'type', 'filename', 'originalName'],
        },
        EvaluationRequest: {
          type: 'object',
          properties: {
            job_title: {
              type: 'string',
              description: 'Target job position',
              example: 'Senior Full Stack Developer',
            },
            cv_id: {
              type: 'string',
              description: 'ID of uploaded CV document',
            },
            project_id: {
              type: 'string',
              description: 'ID of uploaded project report',
            },
          },
          required: ['job_title', 'cv_id', 'project_id'],
        },
        EvaluationResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Response message',
            },
            job_id: {
              type: 'string',
              description: 'Unique job identifier',
            },
            status: {
              type: 'string',
              description: 'Initial status',
            },
            estimated_completion_time: {
              type: 'string',
              description: 'Estimated completion time',
            },
          },
        },
        EvaluationResults: {
          type: 'object',
          properties: {
            cv_match_rate: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              description: 'CV match rate (0-1)',
            },
            project_score: {
              type: 'number',
              minimum: 1,
              maximum: 5,
              description: 'Project overall score (1-5)',
            },
            overall_recommendation: {
              type: 'string',
              enum: ['HIRE', 'CONDITIONAL_HIRE', 'REJECT'],
              description: 'Final hiring recommendation',
            },
            detailed_feedback: {
              type: 'string',
              description: 'Comprehensive evaluation feedback',
            },
            recommendations: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Specific recommendations for candidate',
            },
          },
        },
      },
      responses: {
        Unauthorized: {
          description: 'Unauthorized',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                code: 401,
                message: 'Please authenticate',
              },
            },
          },
        },
        NotFound: {
          description: 'Not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                code: 404,
                message: 'Not found',
              },
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: [
      {
        name: 'Auth',
        description: 'Authentication and authorization endpoints',
      },
      {
        name: 'Users', 
        description: 'User management endpoints',
      },
      {
        name: 'CV Evaluation',
        description: 'AI-powered CV and project evaluation endpoints',
      },
      {
        name: 'Documents',
        description: 'Document upload and management endpoints',
      },
    ],
  },
  apis: ['./src/routes/v1/*.js'],
};

const specs = swaggerJSDoc(options);

export { swaggerUi, specs };
export default { swaggerUi, specs };