import fs from 'fs/promises';
import path from 'path';
import pdf2json from 'pdf2json';
import mammoth from 'mammoth';

/**
 * Extract text from PDF file
 * @param {string} filePath - Path to PDF file
 * @returns {Promise<string>} Extracted text content
 */
const extractTextFromPDF = (filePath) => {
  return new Promise((resolve, reject) => {
    const pdfParser = new pdf2json();

    pdfParser.on('pdfParser_dataError', (errData) => {
      reject(new Error(`PDF parsing error: ${errData.parserError}`));
    });

    pdfParser.on('pdfParser_dataReady', (pdfData) => {
      try {
        let extractedText = '';
        
        if (pdfData.Pages) {
          pdfData.Pages.forEach(page => {
            if (page.Texts) {
              page.Texts.forEach(text => {
                if (text.R) {
                  text.R.forEach(run => {
                    if (run.T) {
                      extractedText += decodeURIComponent(run.T) + ' ';
                    }
                  });
                }
              });
            }
          });
        }

        resolve(extractedText.trim());
      } catch (error) {
        reject(new Error(`Failed to extract text: ${error.message}`));
      }
    });

    pdfParser.loadPDF(filePath);
  });
};

/**
 * Extract text from DOCX file
 * @param {string} filePath - Path to DOCX file
 * @returns {Promise<string>} Extracted text content
 */
const extractTextFromDOCX = async (filePath) => {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  } catch (error) {
    throw new Error(`DOCX parsing error: ${error.message}`);
  }
};

/**
 * Extract text from document based on file extension
 * @param {string} filePath - Path to document file
 * @returns {Promise<string>} Extracted text content
 */
const extractText = async (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  
  switch (ext) {
    case '.pdf':
      return await extractTextFromPDF(filePath);
    case '.docx':
      return await extractTextFromDOCX(filePath);
    case '.txt':
      return await fs.readFile(filePath, 'utf-8');
    default:
      throw new Error(`Unsupported file format: ${ext}`);
  }
};

/**
 * Clean and normalize extracted text
 * @param {string} text - Raw extracted text
 * @returns {string} Cleaned text
 */
const cleanText = (text) => {
  return text
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/\n\s*\n/g, '\n') // Remove empty lines
    .replace(/[^\w\s\-.,!?()]/g, '') // Remove special characters except basic punctuation
    .trim();
};

/**
 * Extract structured data from CV text
 * @param {string} text - CV text content
 * @returns {Object} Structured CV data
 */
const parseCV = (text) => {
  const cleanedText = cleanText(text);
  
  // Basic extraction patterns (can be enhanced with NLP)
  const emailPattern = /[\w.-]+@[\w.-]+\.\w+/g;
  const phonePattern = /[\+]?[\d\s\-\(\)]{10,}/g;
  const skillsKeywords = [
    'javascript', 'python', 'java', 'react', 'node', 'express', 'mongodb', 
    'sql', 'aws', 'docker', 'kubernetes', 'git', 'api', 'backend', 'frontend',
    'ai', 'machine learning', 'llm', 'rag', 'vector database'
  ];

  const emails = cleanedText.match(emailPattern) || [];
  const phones = cleanedText.match(phonePattern) || [];
  
  // Extract skills mentioned
  const foundSkills = skillsKeywords.filter(skill => 
    cleanedText.toLowerCase().includes(skill.toLowerCase())
  );

  // Extract experience years (simple pattern)
  const experiencePattern = /(\d+)\s*(?:years?|yr)/gi;
  const experienceMatches = cleanedText.match(experiencePattern) || [];
  const experienceYears = experienceMatches.map(match => 
    parseInt(match.match(/\d+/)[0])
  );

  return {
    rawText: cleanedText,
    contact: {
      emails: emails.slice(0, 3), // Limit to 3 emails
      phones: phones.slice(0, 2), // Limit to 2 phones
    },
    skills: foundSkills,
    experience: {
      years: experienceYears,
      maxYears: Math.max(...experienceYears, 0),
    },
    sections: extractSections(cleanedText),
  };
};

/**
 * Extract sections from CV text
 * @param {string} text - CV text
 * @returns {Object} Extracted sections
 */
const extractSections = (text) => {
  const sections = {};
  const sectionKeywords = {
    education: ['education', 'academic', 'degree', 'university', 'college'],
    experience: ['experience', 'work', 'employment', 'career', 'position'],
    skills: ['skills', 'technical', 'competencies', 'expertise'],
    projects: ['projects', 'portfolio', 'work samples'],
    achievements: ['achievements', 'accomplishments', 'awards', 'recognition'],
  };

  Object.keys(sectionKeywords).forEach(section => {
    const keywords = sectionKeywords[section];
    const found = keywords.some(keyword => 
      text.toLowerCase().includes(keyword)
    );
    
    if (found) {
      // Simple section extraction - can be enhanced
      sections[section] = extractSectionContent(text, keywords);
    }
  });

  return sections;
};

/**
 * Extract content for a specific section
 * @param {string} text - Full text
 * @param {string[]} keywords - Section keywords
 * @returns {string} Section content
 */
const extractSectionContent = (text, keywords) => {
  // This is a simplified implementation
  // In production, you'd want more sophisticated NLP parsing
  const lines = text.split('\n');
  let sectionStart = -1;
  let sectionEnd = lines.length;

  // Find section start
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    if (keywords.some(keyword => line.includes(keyword))) {
      sectionStart = i;
      break;
    }
  }

  if (sectionStart === -1) return '';

  // Find next section (simplified)
  for (let i = sectionStart + 1; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    if (line.match(/^[a-z\s]+:?\s*$/)) { // Potential section header
      sectionEnd = i;
      break;
    }
  }

  return lines.slice(sectionStart, sectionEnd).join('\n').trim();
};

export default {
  extractText,
  extractTextFromPDF,
  extractTextFromDOCX,
  cleanText,
  parseCV,
  extractSections,
};