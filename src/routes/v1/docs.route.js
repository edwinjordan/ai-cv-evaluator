import express from 'express';
import { swaggerUi, specs } from '../../config/swagger.js';

const router = express.Router();

// Swagger UI setup
router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(specs, {
  explorer: true,
  customCss: `
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info hgroup.main h2 { color: #3b82f6; }
    .swagger-ui .info .title { color: #1f2937; }
  `,
  customSiteTitle: 'AI CV Evaluator API Documentation',
  customfavIcon: '/assets/favicon.ico',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    tryItOutEnabled: true,
  },
}));

// JSON endpoint for the raw swagger spec
router.get('/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(specs);
});

export default router;
