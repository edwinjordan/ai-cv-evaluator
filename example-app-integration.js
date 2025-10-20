// Example integration in app.js or server.js
const express = require('express');
const cors = require('cors');
const routes = require('./src/routes/v1');

const app = express();

// Enable CORS
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// V1 API routes
app.use('/v1', routes);

// Error handling middleware
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      code: 413,
      message: 'File size exceeds limit'
    });
  }
  
  if (err.message.includes('Only PDF and DOCX files are allowed')) {
    return res.status(400).json({
      code: 400,
      message: err.message
    });
  }

  res.status(500).json({
    code: 500,
    message: 'Internal Server Error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    code: 404,
    message: 'Route not found'
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/v1/docs`);
});

module.exports = app;