import { jest, describe, test, expect } from '@jest/globals';
import { specs } from '../src/config/swagger.js';

describe('Swagger Configuration Tests', () => {
  test('should have valid OpenAPI specification', () => {
    expect(specs).toBeDefined();
    expect(specs.openapi).toBe('3.0.0');
    expect(specs.info).toBeDefined();
    expect(specs.info.title).toBe('AI CV Evaluator API');
    expect(specs.info.version).toBe('1.0.0');
  });

  test('should have servers configuration', () => {
    expect(specs.servers).toBeDefined();
    expect(Array.isArray(specs.servers)).toBe(true);
    expect(specs.servers.length).toBeGreaterThan(0);
  });

  test('should have security schemes', () => {
    expect(specs.components).toBeDefined();
    expect(specs.components.securitySchemes).toBeDefined();
    expect(specs.components.securitySchemes.bearerAuth).toBeDefined();
    expect(specs.components.securitySchemes.bearerAuth.type).toBe('http');
    expect(specs.components.securitySchemes.bearerAuth.scheme).toBe('bearer');
  });

  test('should have required schemas', () => {
    const { schemas } = specs.components;
    
    expect(schemas.User).toBeDefined();
    expect(schemas.Token).toBeDefined();
    expect(schemas.AuthTokens).toBeDefined();
    expect(schemas.CVEvaluation).toBeDefined();
    expect(schemas.Error).toBeDefined();
  });

  test('should have proper User schema structure', () => {
    const userSchema = specs.components.schemas.User;
    
    expect(userSchema.type).toBe('object');
    expect(userSchema.properties).toBeDefined();
    expect(userSchema.properties.id).toBeDefined();
    expect(userSchema.properties.email).toBeDefined();
    expect(userSchema.properties.name).toBeDefined();
    expect(userSchema.properties.role).toBeDefined();
    expect(userSchema.required).toContain('id');
    expect(userSchema.required).toContain('email');
  });

  test('should have proper CVEvaluation schema structure', () => {
    const cvEvaluationSchema = specs.components.schemas.CVEvaluation;
    
    expect(cvEvaluationSchema.type).toBe('object');
    expect(cvEvaluationSchema.properties).toBeDefined();
    expect(cvEvaluationSchema.properties.id).toBeDefined();
    expect(cvEvaluationSchema.properties.userId).toBeDefined();
    expect(cvEvaluationSchema.properties.aiAnalysis).toBeDefined();
    expect(cvEvaluationSchema.properties.status).toBeDefined();
  });

  test('should have error responses defined', () => {
    const { responses } = specs.components;
    
    expect(responses.DuplicateEmail).toBeDefined();
    expect(responses.Unauthorized).toBeDefined();
    expect(responses.Forbidden).toBeDefined();
    expect(responses.NotFound).toBeDefined();
  });

  test('should have proper tags configuration', () => {
    expect(specs.tags).toBeDefined();
    expect(Array.isArray(specs.tags)).toBe(true);
    
    const tagNames = specs.tags.map(tag => tag.name);
    expect(tagNames).toContain('Auth');
    expect(tagNames).toContain('Users');
    expect(tagNames).toContain('CV Evaluation');
  });

  test('should have valid contact information', () => {
    const { contact } = specs.info;
    
    expect(contact).toBeDefined();
    expect(contact.name).toBe('AI CV Evaluator Team');
    expect(contact.email).toBe('support@aicvevaluator.com');
  });

  test('should have license information', () => {
    const { license } = specs.info;
    
    expect(license).toBeDefined();
    expect(license.name).toBe('MIT');
    expect(license.url).toBe('https://opensource.org/licenses/MIT');
  });
});