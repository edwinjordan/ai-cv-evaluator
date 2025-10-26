// Global test setup
import { jest } from '@jest/globals';

// Increase timeout for all tests
jest.setTimeout(30000);

// Suppress console warnings during tests
const originalWarn = console.warn;
const originalError = console.error;

beforeAll(() => {
  console.warn = (...args) => {
    if (
      args[0] && 
      typeof args[0] === 'string' && 
      (args[0].includes('ExperimentalWarning') || 
       args[0].includes('DeprecationWarning') ||
       args[0].includes('punycode'))
    ) {
      return;
    }
    originalWarn(...args);
  };

  console.error = (...args) => {
    if (
      args[0] && 
      typeof args[0] === 'string' && 
      (args[0].includes('DeprecationWarning') ||
       args[0].includes('punycode'))
    ) {
      return;
    }
    originalError(...args);
  };
});

afterAll(() => {
  console.warn = originalWarn;
  console.error = originalError;
});