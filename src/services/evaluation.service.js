import llmConnection from '../config/connection_llm.js';
import ragService from './rag.service.js';
import logger from '../config/logger.js';

class EvaluationService {
  constructor() {
    this.isInitialized = false;
  }

  /**
   * Initialize evaluation service
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      if (!llmConnection.isConnected) {
        await llmConnection.connect();
      }

      if (!ragService.isInitialized) {
        await ragService.initialize();
      }

      this.isInitialized = true;
      logger.info('Evaluation service initialized successfully');

    } catch (error) {
      logger.error('Evaluation service initialization failed:', error);
      throw error;
    }
  }

  /**
   * Perform complete CV and project evaluation
   * @param {Object} evaluationData - Evaluation input data
   * @returns {Promise<Object>} - Evaluation results
   */
  async performEvaluation(evaluationData) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const { jobTitle, cvContent, projectContent, userId } = evaluationData;

    try {
      logger.info(`Starting evaluation for job title: ${jobTitle}`);

      // Step 1: Retrieve context using RAG with fallback
      let cvContext = [];
      let projectContext = [];
      
      try {
        [cvContext, projectContext] = await Promise.all([
          ragService.retrieveEvaluationContext(jobTitle, cvContent, userId),
          ragService.retrieveProjectContext(jobTitle, projectContent, userId)
        ]);
      } catch (ragError) {
        logger.warn('RAG context retrieval failed, proceeding with empty context:', ragError.message);
        cvContext = [];
        projectContext = [];
      }

      // Step 2: Evaluate CV
      const cvEvaluation = await this.evaluateCV({
        jobTitle,
        cvContent,
        context: cvContext
      });

      // Step 3: Evaluate Project
      const projectEvaluation = await this.evaluateProject({
        jobTitle,
        projectContent,
        context: projectContext
      });

      // Step 4: Generate overall recommendation
      const overallRecommendation = await this.generateOverallRecommendation({
        jobTitle,
        cvEvaluation,
        projectEvaluation
      });

      // Compile final results
      const results = {
        cvMatchRate: cvEvaluation.matchRate,
        projectScore: projectEvaluation.overallScore,
        overallRecommendation: overallRecommendation.recommendation,
        cvAnalysis: {
          strengths: cvEvaluation.strengths,
          weaknesses: cvEvaluation.weaknesses,
          missingSkills: cvEvaluation.missingSkills,
          experienceMatch: cvEvaluation.experienceMatch
        },
        projectAnalysis: {
          technicalQuality: projectEvaluation.technicalQuality,
          complexityLevel: projectEvaluation.complexityLevel,
          innovationScore: projectEvaluation.innovationScore,
          documentationQuality: projectEvaluation.documentationQuality,
          strengths: projectEvaluation.strengths,
          improvements: projectEvaluation.improvements
        },
        detailedFeedback: overallRecommendation.detailedFeedback,
        recommendations: overallRecommendation.recommendations,
        processingMetadata: {
          evaluatedAt: new Date().toISOString(),
          jobTitle,
          evaluationVersion: '1.0',
          contextSources: {
            cvContextSources: cvContext.jobRequirements.length + cvContext.rubrics.length,
            projectContextSources: projectContext.projectRubrics.length + projectContext.technicalRequirements.length
          }
        }
      };

      logger.info('Evaluation completed successfully');
      return results;

    } catch (error) {
      logger.error('Evaluation failed:', error);
      throw error;
    }
  }

  /**
   * Evaluate CV against job requirements
   * @param {Object} data - CV evaluation data
   * @returns {Promise<Object>} - CV evaluation results
   */
  async evaluateCV({ jobTitle, cvContent, context }) {
    try {
      const prompt = this.buildCVEvaluationPrompt(jobTitle, cvContent, context);
      
      const llmResult = await llmConnection.generateEvaluation(prompt, {
        jobTitle,
        cvContent,
        jobRequirements: context.jobRequirements.map(req => req.content).join('\n')
      });

      if (llmResult.success) {
        // Parse and validate LLM response
        return this.parseCVEvaluation(llmResult.content, llmResult.parsed);
      } else {
        logger.warn(`CV evaluation LLM failed: ${llmResult.error}, using fallback evaluation`);
        return this.generateFallbackCVEvaluation(jobTitle, cvContent, context);
      }
    } catch (error) {
      logger.error(`CV evaluation error: ${error.message}, using fallback evaluation`);
      return this.generateFallbackCVEvaluation(jobTitle, cvContent, context);
    }
  }

  /**
   * Evaluate project report
   * @param {Object} data - Project evaluation data
   * @returns {Promise<Object>} - Project evaluation results
   */
  async evaluateProject({ jobTitle, projectContent, context }) {
    try {
      const prompt = this.buildProjectEvaluationPrompt(jobTitle, projectContent, context);
      
      const llmResult = await llmConnection.generateEvaluation(prompt, {
        jobTitle,
        projectContent,
        jobRequirements: context.technicalRequirements.map(req => req.content).join('\n')
      });

      if (llmResult.success) {
        // Parse and validate LLM response
        return this.parseProjectEvaluation(llmResult.content, llmResult.parsed);
      } else {
        logger.warn(`Project evaluation LLM failed: ${llmResult.error}, using fallback evaluation`);
        return this.generateFallbackProjectEvaluation(jobTitle, projectContent, context);
      }
    } catch (error) {
      logger.error(`Project evaluation error: ${error.message}, using fallback evaluation`);
      return this.generateFallbackProjectEvaluation(jobTitle, projectContent, context);
    }
  }

  /**
   * Generate overall recommendation combining CV and project evaluations
   * @param {Object} data - Combined evaluation data
   * @returns {Promise<Object>} - Overall recommendation
   */
  async generateOverallRecommendation({ jobTitle, cvEvaluation, projectEvaluation }) {
    const prompt = this.buildOverallRecommendationPrompt(jobTitle, cvEvaluation, projectEvaluation);
    
    const llmResult = await llmConnection.generateCompletion([
      {
        role: 'system',
        content: 'You are a senior HR manager making final hiring recommendations based on comprehensive candidate evaluations.'
      },
      {
        role: 'user',
        content: prompt
      }
    ], {
      temperature: 0.3,
      maxTokens: 2000,
      maxRetries: 2,
      baseDelay: 2000
    });

    if (!llmResult.success) {
      // Handle quota errors with user-friendly messages
      if (llmResult.isQuotaError) {
        const quotaError = new Error('CV evaluation service is temporarily unavailable due to API usage limits. Please try again later or contact support for urgent evaluations.');
        quotaError.isQuotaError = true;
        quotaError.retryAfter = llmResult.retryAfter;
        quotaError.statusCode = llmResult.statusCode;
        quotaError.originalError = llmResult.error;
        
        logger.error('Quota exceeded during overall recommendation generation:', {
          retryAfter: llmResult.retryAfter,
          originalError: llmResult.error
        });
        
        throw quotaError;
      }
      
      // Handle other errors - try fallback evaluation
      // if (llmResult.error && llmResult.error.includes('Rate limit exceeded')) {
      //   logger.warn('LLM rate limit exceeded, using fallback evaluation method');
      //   return this.generateFallbackRecommendation(cvScore, projectScore, matchRate);
      // }
      
      throw new Error(`Overall recommendation generation failed: ${llmResult.error}`);
    }

    return this.parseOverallRecommendation(llmResult.content);
  }

  /**
   * Build CV evaluation prompt
   * @param {string} jobTitle - Job title
   * @param {string} cvContent - CV content
   * @param {Object} context - RAG context
   * @returns {string} - Formatted prompt
   */
  buildCVEvaluationPrompt(jobTitle, cvContent, context) {
    const jobRequirements = context.jobRequirements.map(req => `- ${req.content}`).join('\n');
    const rubrics = context.rubrics.map(rubric => `- ${rubric.content}`).join('\n');

    return `
Evaluate this CV for the position of "${jobTitle}".

JOB REQUIREMENTS:
${jobRequirements || 'No specific requirements provided - use general best practices'}

EVALUATION RUBRICS:
${rubrics || 'Use standard CV evaluation criteria'}

CV CONTENT:
${cvContent}

Provide a detailed evaluation in the following JSON format:
{
  "matchRate": 0.85,
  "experienceMatch": 0.90,
  "strengths": [
    "Strong technical skills in required technologies",
    "Relevant industry experience"
  ],
  "weaknesses": [
    "Limited leadership experience",
    "Missing certification in X"
  ],
  "missingSkills": [
    "Specific technology Y",
    "Domain expertise in Z"
  ],
  "skillsAnalysis": {
    "technical": {
      "score": 4.2,
      "details": "Strong in most required technologies"
    },
    "soft": {
      "score": 3.8,
      "details": "Good communication, needs leadership development"
    }
  },
  "yearsOfExperience": 5,
  "educationMatch": 0.85,
  "certifications": ["AWS Solutions Architect", "PMP"],
  "redFlags": [],
  "overallAssessment": "Strong candidate with minor skill gaps"
}

Focus on:
1. Technical skill alignment with job requirements
2. Experience level and relevance
3. Education and certifications
4. Soft skills indicators
5. Career progression
6. Any red flags or concerns
`;
  }

  /**
   * Build project evaluation prompt
   * @param {string} jobTitle - Job title
   * @param {string} projectContent - Project content
   * @param {Object} context - RAG context
   * @returns {string} - Formatted prompt
   */
  buildProjectEvaluationPrompt(jobTitle, projectContent, context) {
    const rubrics = context.projectRubrics.map(rubric => `- ${rubric.content}`).join('\n');
    const technicalReq = context.technicalRequirements.map(req => `- ${req.content}`).join('\n');

    return `
Evaluate this project report for the position of "${jobTitle}".

TECHNICAL REQUIREMENTS:
${technicalReq || 'General software development best practices'}

PROJECT EVALUATION RUBRICS:
${rubrics || 'Use standard project evaluation criteria'}

PROJECT CONTENT:
${projectContent}

Provide a detailed evaluation in the following JSON format:
{
  "overallScore": 4.2,
  "technicalQuality": 4.5,
  "complexityLevel": 4.0,
  "innovationScore": 3.8,
  "documentationQuality": 4.2,
  "strengths": [
    "Well-architected solution",
    "Good use of modern technologies",
    "Clear documentation"
  ],
  "improvements": [
    "Could benefit from more comprehensive testing",
    "Security considerations could be enhanced"
  ],
  "technicalStack": ["React", "Node.js", "MongoDB"],
  "architectureScore": 4.3,
  "codeQualityIndicators": {
    "structure": 4.2,
    "patterns": 4.0,
    "testing": 3.5,
    "documentation": 4.2
  },
  "problemSolving": 4.1,
  "practicalApplication": 4.4,
  "scalabilityConsiderations": 3.9
}

Evaluate based on:
1. Technical complexity and implementation quality
2. Problem-solving approach and innovation
3. Code structure and best practices
4. Documentation quality and clarity
5. Scalability and performance considerations
6. Testing and quality assurance
7. Relevance to the target job position
`;
  }

  /**
   * Build overall recommendation prompt
   * @param {string} jobTitle - Job title
   * @param {Object} cvEvaluation - CV evaluation results
   * @param {Object} projectEvaluation - Project evaluation results
   * @returns {string} - Formatted prompt
   */
  buildOverallRecommendationPrompt(jobTitle, cvEvaluation, projectEvaluation) {
    return `
Based on the comprehensive evaluation, provide a final hiring recommendation for the "${jobTitle}" position.

CV EVALUATION SUMMARY:
- Match Rate: ${cvEvaluation.matchRate}
- Experience Match: ${cvEvaluation.experienceMatch}
- Strengths: ${cvEvaluation.strengths.join(', ')}
- Weaknesses: ${cvEvaluation.weaknesses.join(', ')}

PROJECT EVALUATION SUMMARY:
- Overall Score: ${projectEvaluation.overallScore}/5
- Technical Quality: ${projectEvaluation.technicalQuality}/5
- Innovation Score: ${projectEvaluation.innovationScore}/5

Provide your recommendation in this format:

RECOMMENDATION: [HIRE/CONDITIONAL_HIRE/REJECT]

DETAILED FEEDBACK:
[Comprehensive 3-4 paragraph assessment combining both CV and project evaluation]

SPECIFIC RECOMMENDATIONS:
1. [Specific actionable recommendation]
2. [Another recommendation]
3. [Additional recommendation if needed]

Consider:
- Overall fit for the role
- Potential for growth
- Compensation level alignment
- Training needs
- Risk factors
`;
  }

  /**
   * Parse CV evaluation LLM response
   * @param {string} content - LLM response content
   * @param {Object} parsed - Pre-parsed JSON (if available)
   * @returns {Object} - Parsed CV evaluation
   */
  parseCVEvaluation(content, parsed) {
    let evaluation;
    
    if (parsed && typeof parsed === 'object') {
      evaluation = parsed;
    } else {
      try {
        // Try to extract JSON from content
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        evaluation = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      } catch (error) {
        logger.warn('Failed to parse CV evaluation JSON, using fallback parsing');
        evaluation = this.fallbackParseCVEvaluation(content);
      }
    }

    // Ensure required fields with defaults
    return {
      matchRate: this.validateScore(evaluation.matchRate, 0.5),
      experienceMatch: this.validateScore(evaluation.experienceMatch, 0.5),
      strengths: Array.isArray(evaluation.strengths) ? evaluation.strengths : [],
      weaknesses: Array.isArray(evaluation.weaknesses) ? evaluation.weaknesses : [],
      missingSkills: Array.isArray(evaluation.missingSkills) ? evaluation.missingSkills : [],
      overallAssessment: evaluation.overallAssessment || 'Evaluation completed'
    };
  }

  /**
   * Parse project evaluation LLM response
   * @param {string} content - LLM response content
   * @param {Object} parsed - Pre-parsed JSON (if available)
   * @returns {Object} - Parsed project evaluation
   */
  parseProjectEvaluation(content, parsed) {
    let evaluation;
    
    if (parsed && typeof parsed === 'object') {
      evaluation = parsed;
    } else {
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        evaluation = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      } catch (error) {
        logger.warn('Failed to parse project evaluation JSON, using fallback parsing');
        evaluation = this.fallbackParseProjectEvaluation(content);
      }
    }

    // Ensure required fields with defaults
    return {
      overallScore: this.validateScore(evaluation.overallScore, 3.0, 1, 5),
      technicalQuality: this.validateScore(evaluation.technicalQuality, 3.0, 1, 5),
      complexityLevel: this.validateScore(evaluation.complexityLevel, 3.0, 1, 5),
      innovationScore: this.validateScore(evaluation.innovationScore, 3.0, 1, 5),
      documentationQuality: this.validateScore(evaluation.documentationQuality, 3.0, 1, 5),
      strengths: Array.isArray(evaluation.strengths) ? evaluation.strengths : [],
      improvements: Array.isArray(evaluation.improvements) ? evaluation.improvements : []
    };
  }

  /**
   * Parse overall recommendation
   * @param {string} content - LLM response content
   * @returns {Object} - Parsed recommendation
   */
  parseOverallRecommendation(content) {
    const recommendationMatch = content.match(/RECOMMENDATION:\s*([^\n]+)/i);
    const feedbackMatch = content.match(/DETAILED FEEDBACK:\s*([\s\S]*?)(?=SPECIFIC RECOMMENDATIONS:|$)/i);
    const recommendationsMatch = content.match(/SPECIFIC RECOMMENDATIONS:\s*([\s\S]*)/i);

    const recommendation = recommendationMatch ? recommendationMatch[1].trim() : 'CONDITIONAL_HIRE';
    const detailedFeedback = feedbackMatch ? feedbackMatch[1].trim() : content;
    
    let recommendations = [];
    if (recommendationsMatch) {
      recommendations = recommendationsMatch[1]
        .split(/\d+\./)
        .filter(item => item.trim())
        .map(item => item.trim());
    }

    return {
      recommendation: this.normalizeRecommendation(recommendation),
      detailedFeedback,
      recommendations
    };
  }

  /**
   * Validate and clamp score values
   * @param {number} score - Score to validate
   * @param {number} defaultValue - Default if invalid
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {number} - Validated score
   */
  validateScore(score, defaultValue, min = 0, max = 1) {
    if (typeof score !== 'number' || isNaN(score)) {
      return defaultValue;
    }
    return Math.min(Math.max(score, min), max);
  }

  /**
   * Normalize recommendation values
   * @param {string} recommendation - Raw recommendation
   * @returns {string} - Normalized recommendation
   */
  normalizeRecommendation(recommendation) {
    const normalized = recommendation.toUpperCase().trim();
    
    if (normalized.includes('HIRE') && !normalized.includes('CONDITIONAL')) {
      return 'HIRE';
    } else if (normalized.includes('CONDITIONAL') || normalized.includes('MAYBE')) {
      return 'CONDITIONAL_HIRE';
    } else if (normalized.includes('REJECT') || normalized.includes('NO')) {
      return 'REJECT';
    }
    
    return 'CONDITIONAL_HIRE'; // Default
  }

  /**
   * Fallback parsing for CV evaluation when JSON parsing fails
   * @param {string} content - Content to parse
   * @returns {Object} - Parsed evaluation
   */
  fallbackParseCVEvaluation(content) {
    return {
      matchRate: 0.5,
      experienceMatch: 0.5,
      strengths: ['Evaluation completed'],
      weaknesses: ['Detailed analysis required'],
      missingSkills: [],
      overallAssessment: content.substring(0, 500)
    };
  }

  /**
   * Fallback parsing for project evaluation when JSON parsing fails
   * @param {string} content - Content to parse
   * @returns {Object} - Parsed evaluation
   */
  fallbackParseProjectEvaluation(content) {
    return {
      overallScore: 3.0,
      technicalQuality: 3.0,
      complexityLevel: 3.0,
      innovationScore: 3.0,
      documentationQuality: 3.0,
      strengths: ['Basic implementation completed'],
      improvements: ['Detailed analysis required'],
      overallAssessment: content.substring(0, 500)
    };
  }

  /**
   * Generate fallback CV evaluation when LLM fails
   * @param {string} jobTitle - Job title
   * @param {string} cvContent - CV content
   * @param {Object} context - Evaluation context
   * @returns {Object} - Fallback CV evaluation
   */
  generateFallbackCVEvaluation(jobTitle, cvContent, context) {
    // Simple keyword-based analysis
    const cvWords = cvContent.toLowerCase().split(/\s+/);
    const jobWords = jobTitle.toLowerCase().split(/\s+/);
    
    // Calculate basic match rate based on keyword overlap
    const matchingWords = jobWords.filter(word => 
      cvWords.some(cvWord => cvWord.includes(word) || word.includes(cvWord))
    );
    const matchRate = Math.min(0.9, Math.max(0.3, matchingWords.length / jobWords.length));
    
    return {
      matchRate: Math.round(matchRate * 100) / 100,
      experienceMatch: Math.round(matchRate * 100) / 100,
      strengths: [
        'CV content reviewed',
        'Basic qualifications identified',
        'Experience level assessed'
      ],
      weaknesses: [
        'Detailed analysis requires LLM processing',
        'Manual review recommended'
      ],
      missingSkills: [],
      overallAssessment: `Fallback evaluation completed for ${jobTitle} position. Basic keyword matching indicates ${Math.round(matchRate * 100)}% relevance. Manual review recommended for detailed assessment.`
    };
  }

  /**
   * Generate fallback project evaluation when LLM fails
   * @param {string} jobTitle - Job title
   * @param {string} projectContent - Project content
   * @param {Object} context - Evaluation context
   * @returns {Object} - Fallback project evaluation
   */
  generateFallbackProjectEvaluation(jobTitle, projectContent, context) {
    // Simple content-based scoring
    const contentLength = projectContent.length;
    const hasCode = /class|function|def|import|export|const|let|var/.test(projectContent);
    const hasDocumentation = /readme|documentation|how to|install|usage/.test(projectContent.toLowerCase());
    
    // Basic scoring based on content analysis
    const baseScore = 3.0;
    const lengthBonus = Math.min(1.0, contentLength / 2000 * 0.5);
    const codeBonus = hasCode ? 0.5 : 0;
    const docBonus = hasDocumentation ? 0.3 : 0;
    
    const finalScore = Math.min(5.0, baseScore + lengthBonus + codeBonus + docBonus);
    
    return {
      overallScore: Math.round(finalScore * 10) / 10,
      technicalQuality: Math.round(finalScore * 10) / 10,
      complexityLevel: Math.round(finalScore * 10) / 10,
      innovationScore: Math.round(finalScore * 10) / 10,
      documentationQuality: hasDocumentation ? 4.0 : 3.0,
      strengths: [
        'Project content analyzed',
        hasCode ? 'Code implementation identified' : 'Project structure reviewed',
        hasDocumentation ? 'Documentation present' : 'Basic project information available'
      ],
      improvements: [
        'Detailed technical analysis requires LLM processing',
        'Manual code review recommended',
        'Architecture assessment needed'
      ],
      overallAssessment: `Fallback evaluation completed for project. Content analysis indicates ${Math.round(finalScore * 20)}% quality score. Manual technical review recommended for comprehensive assessment.`
    };
  }

  /**
   * Generate fallback recommendation when LLM is unavailable
   * @param {number} cvScore - CV score from 0-1
   * @param {number} projectScore - Project score from 1-5
   * @param {number} matchRate - Match rate from 0-1
   * @returns {Object} - Fallback recommendation
   */
  generateFallbackRecommendation(cvScore, projectScore, matchRate) {
    // Calculate overall score based on weighted average
    const normalizedProjectScore = (projectScore - 1) / 4; // Convert 1-5 to 0-1
    const overallScore = (cvScore * 0.4) + (normalizedProjectScore * 0.35) + (matchRate * 0.25);
    
    // Determine recommendation based on thresholds
    let recommendation, confidence;
    if (overallScore >= 0.8) {
      recommendation = 'Strong Hire';
      confidence = 'High';
    } else if (overallScore >= 0.65) {
      recommendation = 'Hire';
      confidence = 'Medium-High';
    } else if (overallScore >= 0.5) {
      recommendation = 'Consider';
      confidence = 'Medium';
    } else if (overallScore >= 0.35) {
      recommendation = 'Weak Consider';
      confidence = 'Low-Medium';
    } else {
      recommendation = 'No Hire';
      confidence = 'High';
    }

    return {
      overallScore: Math.round(overallScore * 100) / 100,
      recommendation,
      confidence,
      reasoning: `Automated evaluation based on CV quality (${Math.round(cvScore * 100)}%), project assessment (${Math.round(normalizedProjectScore * 100)}%), and job match rate (${Math.round(matchRate * 100)}%). Manual review recommended for final decision.`,
      strengths: [
        'Candidate meets basic qualifications',
        'Application materials submitted completely',
        'Quantitative assessment completed'
      ],
      concerns: [
        'Detailed analysis unavailable due to system limitations',
        'Manual interview assessment recommended',
        'Technical deep-dive needed'
      ],
      nextSteps: [
        'Schedule technical interview',
        'Conduct detailed code review',
        'Verify key qualifications manually',
        'Check references if proceeding'
      ],
      note: 'This is a fallback evaluation generated when AI analysis is temporarily unavailable. Results should be supplemented with manual review.'
    };
  }
}

// Create singleton instance
const evaluationService = new EvaluationService();

export default evaluationService;