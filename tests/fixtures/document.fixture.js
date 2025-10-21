import mongoose from 'mongoose';
import { faker } from '@faker-js/faker';
import Document from '../../src/models/document.model.js';
import Evaluation from '../../src/models/evaluation.model.js';

// Sample PDF buffer for testing
const samplePdfBuffer = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n72 720 Td\n(Test CV Content) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000010 00000 n \n0000000053 00000 n \n0000000125 00000 n \n0000000185 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n284\n%%EOF'
);

const sampleProjectPdfBuffer = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 54\n>>\nstream\nBT\n/F1 12 Tf\n72 720 Td\n(Test Project Report Content) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000010 00000 n \n0000000053 00000 n \n0000000125 00000 n \n0000000185 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n294\n%%EOF'
);

const documentIds = {
  cvDocumentOne: new mongoose.Types.ObjectId(),
  projectDocumentOne: new mongoose.Types.ObjectId(),
  jobDescriptionOne: new mongoose.Types.ObjectId(),
  cvRubricOne: new mongoose.Types.ObjectId(),
};

const evaluationIds = {
  evaluationOne: new mongoose.Types.ObjectId(),
  evaluationTwo: new mongoose.Types.ObjectId(),
};

// CV Document fixture
const cvDocumentOne = {
  _id: documentIds.cvDocumentOne,
  filename: 'cv_test_file.pdf',
  originalName: 'John_Doe_CV.pdf',
  mimeType: 'application/pdf',
  size: 2048576, // 2MB
  path: '/uploads/cv_test_file.pdf',
  type: 'cv',
  extractedText: 'John Doe\nSenior Software Engineer\nExperience: 5 years in full-stack development\nSkills: JavaScript, React, Node.js, MongoDB, Python, Docker\nEducation: Computer Science, MIT\nProjects: E-commerce platform, Real-time chat application',
  vectorized: true,
  uploadedBy: null, // Will be set to user ID in tests
  metadata: {
    pages: 2,
    wordCount: 350
  }
};

// Project Document fixture
const projectDocumentOne = {
  _id: documentIds.projectDocumentOne,
  filename: 'project_test_file.pdf',
  originalName: 'E-commerce_Platform_Report.pdf',
  mimeType: 'application/pdf',
  size: 3145728, // 3MB
  path: '/uploads/project_test_file.pdf',
  type: 'project_report',
  extractedText: 'E-commerce Platform Development\nProject Overview: Built a scalable e-commerce platform using MERN stack\nTechnologies Used: React, Node.js, Express, MongoDB, Redis\nFeatures: User authentication, payment processing, inventory management\nPerformance: Handled 10,000 concurrent users\nDeployment: AWS EC2, Docker containers\nTesting: Jest, Cypress, 95% code coverage',
  vectorized: true,
  uploadedBy: null, // Will be set to user ID in tests
  metadata: {
    pages: 15,
    wordCount: 2500
  }
};

// Job Description Document fixture
const jobDescriptionOne = {
  _id: documentIds.jobDescriptionOne,
  filename: 'job_desc_test.pdf',
  originalName: 'Senior_Fullstack_Developer_JD.pdf',
  mimeType: 'application/pdf',
  size: 512000, // 500KB
  path: '/uploads/job_desc_test.pdf',
  type: 'job_description',
  extractedText: 'Senior Full-Stack Developer\nRequirements:\n- 3+ years experience in web development\n- Proficiency in JavaScript, React, Node.js\n- Experience with databases (MongoDB, PostgreSQL)\n- Knowledge of cloud platforms (AWS, Azure)\n- Strong problem-solving skills\n- Bachelor\'s degree in Computer Science or related field',
  vectorized: true,
  uploadedBy: null,
  metadata: {
    pages: 3,
    wordCount: 800
  }
};

// CV Rubric Document fixture  
const cvRubricOne = {
  _id: documentIds.cvRubricOne,
  filename: 'cv_rubric_test.pdf',
  originalName: 'CV_Evaluation_Rubric.pdf',
  mimeType: 'application/pdf',
  size: 256000, // 250KB
  path: '/uploads/cv_rubric_test.pdf',
  type: 'cv_rubric',
  extractedText: 'CV Evaluation Rubric\nCriteria:\n1. Technical Skills (30%): Relevant programming languages, frameworks, tools\n2. Experience Level (25%): Years of experience, project complexity\n3. Achievements (20%): Awards, certifications, notable accomplishments\n4. Cultural Fit (15%): Communication skills, teamwork, leadership\n5. Education (10%): Degree relevance, institution reputation',
  vectorized: true,
  uploadedBy: null,
  metadata: {
    pages: 2,
    wordCount: 400
  }
};

// Evaluation fixture - queued
const evaluationOne = {
  _id: evaluationIds.evaluationOne,
  jobId: 'eval_test_001_queued',
  jobTitle: 'Senior Full-Stack Developer',
  cvDocumentId: documentIds.cvDocumentOne,
  projectDocumentId: documentIds.projectDocumentOne,
  status: 'queued',
  createdBy: null, // Will be set to user ID in tests
  createdAt: new Date(),
  updatedAt: new Date()
};

// Evaluation fixture - completed
const evaluationTwo = {
  _id: evaluationIds.evaluationTwo,
  jobId: 'eval_test_002_completed',
  jobTitle: 'Senior Full-Stack Developer',
  cvDocumentId: documentIds.cvDocumentOne,
  projectDocumentId: documentIds.projectDocumentOne,
  status: 'completed',
  result: {
    cv_match_rate: 0.85,
    cv_feedback: 'Strong technical background with relevant experience in full-stack development. Good alignment with required skills.',
    cv_breakdown: {
      technical_skills: 0.9,
      experience_level: 0.8,
      achievements: 0.7,
      cultural_fit: 0.85
    },
    project_score: 4.2,
    project_feedback: 'Excellent project demonstrating scalability and modern development practices. Good use of technologies and impressive performance metrics.',
    overall_summary: 'HIRE',
    detailed_feedback: 'Candidate shows strong technical competency and project execution skills. Recommended for next interview round.',
    recommendations: [
      'Schedule technical interview focusing on system design',
      'Discuss scalability approaches in detail',
      'Evaluate communication and leadership skills'
    ]
  },
  completedAt: new Date(),
  createdBy: null, // Will be set to user ID in tests
  createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
  updatedAt: new Date()
};

// Helper function to insert documents into database
const insertDocuments = async (documents, userId = null) => {
  const documentsToInsert = documents.map(doc => ({
    ...doc,
    uploadedBy: userId || doc.uploadedBy
  }));
  return Document.insertMany(documentsToInsert);
};

// Helper function to insert evaluations into database
const insertEvaluations = async (evaluations, userId = null) => {
  const evaluationsToInsert = evaluations.map(evaluation => ({
    ...evaluation,
    createdBy: userId || evaluation.createdBy
  }));
  return Evaluation.insertMany(evaluationsToInsert);
};

// Helper function to create test file objects for multer
const createTestFile = (buffer, filename, mimetype = 'application/pdf') => ({
  fieldname: 'cv',
  originalname: filename,
  encoding: '7bit',
  mimetype,
  size: buffer.length,
  buffer
});

// Sample evaluation request data
const evaluationRequest = {
  job_title: 'Senior Full-Stack Developer',
  cv_id: documentIds.cvDocumentOne.toHexString(),
  project_id: documentIds.projectDocumentOne.toHexString()
};

const invalidEvaluationRequest = {
  job_title: '', // Invalid - empty string
  cv_id: 'invalid_id', // Invalid ObjectId
  project_id: documentIds.projectDocumentOne.toHexString()
};

export {
  // Document fixtures
  cvDocumentOne,
  projectDocumentOne,
  jobDescriptionOne,
  cvRubricOne,
  
  // Evaluation fixtures
  evaluationOne,
  evaluationTwo,
  
  // IDs
  documentIds,
  evaluationIds,
  
  // Helper functions
  insertDocuments,
  insertEvaluations,
  createTestFile,
  
  // Test data
  samplePdfBuffer,
  sampleProjectPdfBuffer,
  evaluationRequest,
  invalidEvaluationRequest
};