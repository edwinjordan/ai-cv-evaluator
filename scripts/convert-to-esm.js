#!/usr/bin/env node

/**
 * Automated CommonJS to ES Modules Converter
 * This script converts all remaining CommonJS files to ES modules
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.join(__dirname, '..');

// Files to process (all .js files in src directory)
const filesToConvert = [
  // Services
  'src/services/auth.service.js',
  'src/services/user.service.js', 
  'src/services/token.service.js',
  
  // Controllers
  'src/controllers/user.controller.js',
  
  // Middlewares
  'src/middlewares/auth.js',
  'src/middlewares/validate.js',
  
  // Routes
  'src/routes/v1/user.route.js',
  'src/routes/v1/cv-evaluation.route.js',
  
  // Utils
  'src/utils/pick.js',
  'src/utils/helper.js',
  'src/utils/prompts.js',
  'src/utils/logger.js'
];

// Conversion patterns
const conversions = [
  // Basic require to import
  {
    pattern: /const\s+(\w+)\s+=\s+require\(['"`]([^'"`]+)['"`]\)/g,
    replacement: "import $1 from '$2.js'"
  },
  {
    pattern: /const\s+\{\s*([^}]+)\s*\}\s+=\s+require\(['"`]([^'"`]+)['"`]\)/g,
    replacement: "import { $1 } from '$2.js'"
  },
  
  // Module exports
  {
    pattern: /module\.exports\s+=\s+(\w+)/g,
    replacement: "export default $1"
  },
  {
    pattern: /module\.exports\s+=\s+\{([^}]+)\}/gs,
    replacement: "export default {$1}"
  },
  {
    pattern: /module\.exports\.(\w+)\s+=\s+([^;]+);?/g,
    replacement: "export const $1 = $2;"
  }
];

function convertFile(filePath) {
  const fullPath = path.join(projectRoot, filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  let hasChanges = false;
  
  // Apply conversions
  conversions.forEach(({ pattern, replacement }) => {
    if (pattern.test(content)) {
      content = content.replace(pattern, replacement);
      hasChanges = true;
    }
  });
  
  // Additional manual fixes
  content = content
    // Fix relative imports to include .js extension
    .replace(/from\s+['"`](\.\.?\/[^'"`]+)['"`]/g, (match, p1) => {
      if (!p1.endsWith('.js') && !p1.includes('/node_modules/')) {
        return `from '${p1}.js'`;
      }
      return match;
    })
    // Fix __dirname and __filename for ES modules
    .replace(/const\s+__dirname\s+=\s+.*/, `
import { fileURLToPath } from 'url';
import path from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);`)
    .replace(/__dirname/g, '__dirname')
    .replace(/__filename/g, '__filename');
  
  if (hasChanges) {
    fs.writeFileSync(fullPath, content);
    console.log(`✅ Converted: ${filePath}`);
  } else {
    console.log(`🔄 No changes: ${filePath}`);
  }
}

// Process all files
console.log('🚀 Starting CommonJS to ES Modules conversion...\n');

filesToConvert.forEach(convertFile);

console.log('\n✨ Conversion completed!');
console.log('🔧 Some files may need manual adjustments for complex patterns.');
console.log('🧪 Run tests to verify everything works correctly.');

export default { convertFile, conversions };