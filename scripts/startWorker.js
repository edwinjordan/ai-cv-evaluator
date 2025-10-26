#!/usr/bin/env node

/**
 * Simple worker startup script
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

console.log('🚀 Starting evaluation worker...');

// Import the worker (this will auto-start it)
import '../src/queues/worker/evaluationWorker.js';

console.log('✅ Evaluation worker started successfully');

// Keep the process alive
setInterval(() => {
  // Keep alive
}, 1000);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down worker gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down worker gracefully...');
  process.exit(0);
});