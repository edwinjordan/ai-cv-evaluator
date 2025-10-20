#!/usr/bin/env node

/**
 * Standalone Swagger Documentation Server
 * Jalankan dokumentasi API tanpa menjalankan server utama
 * 
 * Usage:
 *   node scripts/docs-server.js
 *   npm run docs:serve
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { swaggerUi, specs } from '../src/config/swagger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.DOCS_PORT || 3001;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// CORS untuk development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Welcome page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>AI CV Evaluator - API Documentation</title>
        <style>
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
                margin: 0; padding: 40px; background: #f8fafc; 
            }
            .container { 
                max-width: 800px; margin: 0 auto; 
                background: white; padding: 40px; border-radius: 8px; 
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            }
            h1 { color: #1e293b; margin-bottom: 24px; }
            .btn { 
                display: inline-block; padding: 12px 24px; 
                background: #3b82f6; color: white; text-decoration: none; 
                border-radius: 6px; margin: 8px 8px 8px 0;
                font-weight: 500;
            }
            .btn:hover { background: #2563eb; }
            .info-box {
                background: #f1f5f9; padding: 20px; border-radius: 6px;
                border-left: 4px solid #3b82f6; margin: 20px 0;
            }
            .endpoint { 
                font-family: 'Monaco', 'Consolas', monospace; 
                background: #1e293b; color: #e2e8f0; padding: 12px; 
                border-radius: 4px; margin: 8px 0; 
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🚀 AI CV Evaluator API Documentation</h1>
            
            <p>Welcome to the AI CV Evaluator API documentation server. This standalone server provides comprehensive API documentation for the AI-powered CV evaluation system.</p>
            
            <div class="info-box">
                <strong>📚 Available Documentation:</strong><br>
                • Interactive Swagger UI with try-it-out functionality<br>
                • Complete API schema and examples<br>
                • Authentication and authorization guides<br>
                • File upload documentation for CV processing
            </div>
            
            <h3>🔗 Quick Access Links:</h3>
            <a href="/docs" class="btn">📖 Swagger UI Documentation</a>
            <a href="/docs/swagger.json" class="btn">📄 Raw JSON Schema</a>
            
            <h3>📋 Available Endpoints:</h3>
            <div class="endpoint">GET  /docs - Interactive API Documentation</div>
            <div class="endpoint">GET  /docs/swagger.json - OpenAPI JSON Specification</div>
            
            <h3>🔧 Server Information:</h3>
            <ul>
                <li><strong>Documentation Server Port:</strong> ${PORT}</li>
                <li><strong>API Base URL:</strong> ${process.env.API_BASE_URL || 'http://localhost:3000'}/v1</li>
                <li><strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}</li>
                <li><strong>Documentation Version:</strong> ${specs.info.version}</li>
            </ul>
            
            <div class="info-box">
                <strong>💡 Tips:</strong><br>
                • Use the "Authorize" button in Swagger UI to set your JWT token<br>
                • Try out endpoints directly from the documentation<br>
                • Check the schemas section for detailed request/response formats<br>
                • Use the search functionality to quickly find specific endpoints
            </div>
        </div>
    </body>
    </html>
  `);
});

// Swagger Documentation
app.use('/docs', swaggerUi.serve, swaggerUi.setup(specs, {
  explorer: true,
  customCss: `
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info hgroup.main h2 { color: #3b82f6; }
    .swagger-ui .info .title { color: #1f2937; }
    .swagger-ui .scheme-container { 
      background: #f8fafc; 
      padding: 20px; 
      border-radius: 8px; 
      margin: 20px 0; 
    }
  `,
  customSiteTitle: 'AI CV Evaluator API - Documentation Server',
  customfavIcon: '/assets/favicon.ico',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    tryItOutEnabled: true,
    requestInterceptor: (request) => {
      console.log('📤 API Request:', request.method, request.url);
      return request;
    },
    responseInterceptor: (response) => {
      console.log('📥 API Response:', response.status, response.url);
      return response;
    }
  }
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'AI CV Evaluator Documentation Server',
    version: specs.info.version,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    endpoints: {
      docs: `/docs`,
      schema: `/docs/swagger.json`,
      health: `/health`
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    availableRoutes: ['/docs', '/docs/swagger.json', '/health']
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Documentation server error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'Something went wrong with the documentation server'
  });
});

// Start server
app.listen(PORT, () => {
  console.log('\n🚀 AI CV Evaluator - Documentation Server Started');
  console.log('─'.repeat(50));
  console.log(`📖 Documentation: http://localhost:${PORT}/docs`);
  console.log(`📄 JSON Schema:   http://localhost:${PORT}/docs/swagger.json`);
  console.log(`💡 Welcome Page:  http://localhost:${PORT}`);
  console.log(`🏥 Health Check:  http://localhost:${PORT}/health`);
  console.log('─'.repeat(50));
  console.log(`🌍 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⚡ API Version: ${specs.info.version}\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📴 Documentation server shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n📴 Documentation server stopped by user');
  process.exit(0);
});

export default app;