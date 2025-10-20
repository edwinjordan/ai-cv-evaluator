import multer  from 'multer';
import path  from 'path';
import fs from 'fs';
import { generateId }  from '../utils/helpers.js';

// Ensure upload directories exist
const uploadDirs = ['uploads/cv', 'uploads/reports'];
uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'cv') {
      cb(null, 'uploads/cv');
    } else if (file.fieldname === 'project_report') {
      cb(null, 'uploads/reports');
    } else {
      cb(new Error('Invalid field name'));
    }
  },
  filename: (req, file, cb) => {
    const uniqueName = `${generateId()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
  },
});

export default upload;