# AI CV Evaluator - API Documentation

Backend API system untuk evaluasi CV kandidat dan project reports menggunakan Large Language Models (LLMs).

**Version:** 1.0.0  
**Base URL:** `http://localhost:3000`

## Table of Contents
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Authentication](#authentication)
  - [Register](#register)
  - [Login](#login)
- [Evaluation](#evaluation)
  - [Upload Files](#upload-files)
  - [Trigger Evaluation](#trigger-evaluation)
  - [Get Result](#get-result)
- [Dashboard Monitoring](#dashboard-monitoring)  
- [Setup & Installation](#setup--installation)
- [Error Codes](#error-codes)

---
## Features

- **Automated CV Screening** - AI-powered matching against job requirements
- **Project Evaluation** - Detailed scoring of technical deliverables
- **Asynchronous Processing** - Non-blocking evaluation with status tracking
- **Multi-format Support** - Upload PDF, DOCX, or TXT files
- **JWT Authentication** - Secure API access with role-based permissions
- **Custom Job Descriptions** - Dynamic job posting management
- **RAG Integration** - Context-aware evaluation using vector search
- **Retry Logic** - Automatic retry with exponential backoff for API failures

*Key Metrics:**
- Match Rate: 0-100% compatibility score
- Project Score: 0-10 quality rating
- Detailed Breakdown: Individual parameter scores
- Processing Time: 2-4 minutes average
---
## Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Runtime | Node.js 20.x | JavaScript server environment |
| Framework | Express.js | REST API framework |
| Database | MongoDB | Structured data storage |
| Vector DB | ChromaDB | Semantic search for RAG |
| LLM Provider | OpenRouter | Multi-model LLM access |
| Authentication | JWT | Token-based auth |
| File Processing | pdf2json, mammoth | Document parsing |

---
## Authentication

### Register

Membuat akun user baru.

- **Metode**: POST
- **URL**: `/v1/auth/register`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
```json
{
  "username": "STRING (3-50 chars)",
  "email": "STRING (valid email)",
  "password": "STRING (min 6 chars)",
  "address" : "STRING"
}
```

- Jika registrasi berhasil, server akan mengembalikan respons:
  - **Status Code**: 201
  - **Response Body**:
  ```json
  {
      "user": {
        "id": 1,
        "name": "john_doe",
        "address": "kediri",
        "email": "john@example.com",
        "role": "user",
        "isEmailVerified" : false
      },
      "token": {
        "access": {
            "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OGY2NTBkYzEyZThlNDA2MmMzNzI1NTUiLCJpYXQiOjE3NjA5NzMwMjAsImV4cCI6MTc2MDk3NDgyMCwidHlwZSI6ImFjY2VzcyJ9.LjI9-ZyjtsSX5WXFrALsPOyVtBNbjo_CzBsC2_jJN8c",
            "expires": "2025-10-20T15:40:20.245Z"
        },
         "refresh": {
            "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OGY2NTBkYzEyZThlNDA2MmMzNzI1NTUiLCJpYXQiOjE3NjA5NzMwMjAsImV4cCI6MTc2MzU2NTAyMCwidHlwZSI6InJlZnJlc2gifQ.5u7HNN-swiI4H2gVshTzsDTFGvIdh_h3_FvVq_L4wgg",
            "expires": "2025-11-19T15:10:20.247Z"
        }
      }
  }
  ```

- Jika email sudah digunakan, server akan mengembalikan respons:
  - **Status Code**: 400
  - **Response Body**:
```json
  {
    "code": 400,
    "message": "Email already taken",
    "stack": "Error: Email already taken ... "
  }
  ```

- Jika validasi gagal, server akan mengembalikan respons:
  - **Status Code**: 400
  - **Response Body**:
  ```json
  {
    "code": 400,
    "message": "Username, email, and password are required",
    "stack" : "Error: \'address\' is not allowed to be empty"
  }
  ```
---  
### Login

Autentikasi user dan mendapatkan JWT token.

- **Metode**: POST
- **URL**: `/v1/auth/login`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
```json
{
  "username": "STRING",
  "password": "STRING"
}
```

- Jika login berhasil, server akan mengembalikan respons:
  - **Status Code**: 200
  - **Response Body**:
  ```json
  {
      "user": {
        "id": 1,
        "name": "john_doe",
        "address": "kediri",
        "email": "john@example.com",
        "role": "user",
        "isEmailVerified" : false
      },
      "token": {
        "access": {
            "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OGY2NTBkYzEyZThlNDA2MmMzNzI1NTUiLCJpYXQiOjE3NjA5NzMwMjAsImV4cCI6MTc2MDk3NDgyMCwidHlwZSI6ImFjY2VzcyJ9.LjI9-ZyjtsSX5WXFrALsPOyVtBNbjo_CzBsC2_jJN8c",
            "expires": "2025-10-20T15:40:20.245Z"
        },
         "refresh": {           
            "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OGY2NTBkYzEyZThlNDA2MmMzNzI1NTUiLCJpYXQiOjE3NjA5NzMwMjAsImV4cCI6MTc2MzU2NTAyMCwidHlwZSI6InJlZnJlc2gifQ.5u7HNN-swiI4H2gVshTzsDTFGvIdh_h3_FvVq_L4wgg",
            "expires": "2025-11-19T15:10:20.247Z"
        }
      }
  }
  ```
  - Jika kredensial salah, server akan mengembalikan respons:
  - **Status Code**: 401
  - **Response Body**:
  ```json
  {
    "code": 401,
    "message": "Incorrect email or password",
    "stack": "Error: Incorrect email or password..."
  }
  ```

- Jika field kosong, server akan mengembalikan respons:
  - **Status Code**: 400
  - **Response Body**:
  ```json
  {
    "code": 400,
    "message": "Password is not allowed to be empty",
    "stack": "Error: \"password\" is not allowed to be empty"
  }
  ```

**Default Admin Account:**
- Username: `admin`
- Password: `admin123`

---
## Evaluation

### Upload Files

Upload CV dan project report untuk evaluasi.

- **Metode**: POST
- **URL**: `/upload`
- **Headers**: 
  - `Authorization: Bearer <token>`
  - `Content-Type: multipart/form-data`
- **Request Body**:
  - `cv`: FILE (PDF, max 10MB, required)
  - `project_report`: FILE (PDF, max 10MB, required)

- Jika upload berhasil, server akan mengembalikan respons:
  - **Status Code**: 200
  - **Response Body**:
  ```json
  {
    "success": true,
    "message": "Documents uploaded successfully",
    "data": {
        "cv_id": "68f6be2bb88ddee29d63afc0",
        "project_id": "68f6be2cb88ddee29d63afc2"
    }
  }
  ```  

- Jika format file tidak valid, server akan mengembalikan respons:
  - **Status Code**: 400
  - **Response Body**:
  ```json
  {
    "code": 400,
    "message": "Only PDF and DOCX files are allowed",
    "stack": "Error: Only PDF and DOCX files are allowed"
  }
  ```

- Jika file tidak ada, server akan mengembalikan respons:
  - **Status Code**: 400
  - **Response Body**:
  ```json
  {
    "code": 400,
    "message": "Both CV and Project Report files are required",
    "stack": "Error: Both CV and Project Report files are required"
  }
  ```

**Supported Formats:**
- PDF (.pdf)
---      

### Trigger Evaluation

Memulai proses evaluasi (asynchronous).

- **Metode**: POST
- **URL**: `/evaluate`
- **Headers**: 
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Request Body**:
```json
{
  "job_title": "Senior Full Stack Developer",
  "cv_id": "68f627eead6cd34be5186fa0",
  "project_id": "68f627eead6cd34be5186fa2"
}
```

- Jika evaluasi berhasil dimulai, server akan mengembalikan respons:
  - **Status Code**: 200
  - **Response Body**:
  ```json
  {
      "message": "Evaluation job started successfully",
      "job_id": "eval_mgzqrn0p_c9140dce0eb6",
      "status": "queued",
      "estimated_completion_time": "5-10 minutes"
  }
  ```

**Catatan:**
- Proses evaluasi berjalan di background
- Waktu proses: 5-10 menit
- Gunakan evaluation ID untuk cek status

---  

### Get Result

Mendapatkan status dan hasil evaluasi.

- **Metode**: GET
- **URL**: `/result/:id`
- **Headers**: `Authorization: Bearer <token>`
- **URL Parameter**: `id` = Evaluation UUID

- Jika evaluasi selesai, server akan mengembalikan respons:
  - **Status Code**: 200
  - **Response Body**:
  ```json
    {
    "job_id": "string",
    "status": "string",
    "results": {
      "cv_match_rate": 1,
      "project_score": 5,
      "overall_recommendation": "HIRE",
      "detailed_feedback": "string",
      "recommendations": [
        "string"
      ]
    }
  }
  ```


- Jika evaluation tidak ditemukan, server akan mengembalikan respons:
  - **Status Code**: 404
  - **Response Body**:
  ```json
  {
    "code": 400,
    "message": "\"\"cv_id\"\" must be a valid mongo id, \"\"project_id\"\" must be a valid mongo id",
    "stack": "Error: \"\"cv_id\"\" must be a valid mongo id, \"\"project_id\"\" must be a valid mongo id"
  }
  ```

**CV Scores (1-5 scale):**
- `technical_skills` (Weight: 40%) - Backend, databases, APIs, cloud, AI/LLM
- `experience_level` (Weight: 25%) - Years and project complexity
- `achievements` (Weight: 20%) - Impact and measurable outcomes
- `cultural_fit` (Weight: 15%) - Communication and teamwork

**Project Scores (1-5 scale):**
- `correctness` (Weight: 30%) - Meets requirements
- `code_quality` (Weight: 25%) - Clean, modular, tested
- `resilience` (Weight: 20%) - Error handling and retries
- `documentation` (Weight: 15%) - README clarity
- `creativity` (Weight: 10%) - Extra features

**Polling Recommendation:**
- Poll setiap 5 detik
- Timeout setelah 10 menit
- Stop polling saat status = completed atau failed

---

## Dashboard Monitoring

- ```bash 
  http://127.0.0.1:3000/v1/dashboard
  ```

- ```bash
  http://127.0.0.1:3000/v1/dashboard/api/evaluation
  ```

- ```bash
  http://127.0.0.1:3000/v1/dashboard/api/stats
  ```

---
## Setup & Installation

### Prerequisites

- Node.js 20.x or higher
- Docker Desktop
- OpenRouter API key
- Git

### Installation Steps

```bash
# 1. Clone repository
git clone <repository-url>
cd ai-cv-evaluator

# 2. Install dependencies
npm install

# 3. Setup environment variables
cp .env.example .env
# Edit .env dengan API key Anda

# 4. Start Docker services
docker-compose up -d

# 5. Start API server (Terminal 1)
npm run dev
```

### Environment Variables

```env
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cv_evaluator
DB_USER=postgres
DB_PASSWORD=postgres123

# OpenRouter
OPENROUTER_API_KEY=your_api_key_here
LLM_MODEL=mistralai/mistral-7b-instruct:free
LLM_TEMPERATURE=0.3
LLM_MAX_TOKENS=2000

# ChromaDB
CHROMA_HOST=localhost
CHROMA_PORT=8000

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
```

---

## Error Codes

### Standard Error Format

```json
{
  "code": 400,
  "message": "Error description",
  "stack" : "Error description",
}
```

### HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Request berhasil |
| 201 | Created | Resource berhasil dibuat |
| 400 | Bad Request | Input tidak valid |
| 401 | Unauthorized | Token tidak ada/invalid |
| 403 | Forbidden | Tidak punya permission |
| 404 | Not Found | Resource tidak ditemukan |
| 409 | Conflict | Duplicate resource |
| 413 | Payload Too Large | File > 10MB |
| 500 | Internal Server Error | Server error |

---


```