/**
 * Prompt untuk ekstraksi informasi dari CV
 */
export const extractCVInfoPrompt = (cvText) => {
    return `You are an expert HR analyst. Extract structured information from the following CV.

CV TEXT:
${cvText}

Extract and return a JSON object with the following structure:
{
  "skills": ["skill1", "skill2", ...],
  "experiences": [
    {
      "title": "job title",
      "company": "company name",
      "duration": "time period",
      "description": "brief description"
    }
  ],
  "projects": ["project1", "project2", ...],
  "education": ["degree/certification", ...],
  "years_of_experience": number
}

Return ONLY the JSON object, no additional text.`;
};

/**
 * Prompt untuk evaluasi CV match rate
 */
export const evaluateCVMatchPrompt = (extractedCV, jobDescription) => {
    return `You are an expert technical recruiter evaluating a candidate for a Backend Engineer position.

JOB REQUIREMENTS:
${jobDescription}

CANDIDATE INFORMATION:
${JSON.stringify(extractedCV, null, 2)}

Evaluate the candidate on these 4 parameters (score 1-5 for each):

1. Technical Skills Match (Weight: 40%)
   - Alignment with backend, databases, APIs, cloud, AI/LLM
   - 1=Irrelevant, 2=Few overlaps, 3=Partial match, 4=Strong match, 5=Excellent + AI/LLM exposure

2. Experience Level (Weight: 25%)
   - Years and project complexity
   - 1=<1yr/trivial, 2=1-2yrs, 3=2-3yrs mid-scale, 4=3-4yrs solid, 5=5+yrs high-impact

3. Relevant Achievements (Weight: 20%)
   - Impact of past work (scaling, performance, adoption)
   - 1=None, 2=Minimal, 3=Some measurable, 4=Significant, 5=Major impact

4. Cultural/Collaboration Fit (Weight: 15%)
   - Communication, learning mindset, teamwork
   - 1=Not shown, 2=Minimal, 3=Average, 4=Good, 5=Excellent

Return a JSON object:
{
  "scores": {
    "technical_skills": score (1-5, one decimal),
    "experience_level": score (1-5, one decimal),
    "achievements": score (1-5, one decimal),
    "cultural_fit": score (1-5, one decimal)
  },
  "feedback": "2-3 sentences about strengths and gaps"
}

Return ONLY the JSON object.`;
};

/**
 * Prompt untuk ekstraksi informasi project
 */
export const extractProjectInfoPrompt = (projectText) => {
    return `You are a senior software engineer reviewing a technical project report.

PROJECT REPORT:
${projectText}

Analyze and extract:
{
  "features_implemented": ["feature1", "feature2", ...],
  "technologies_used": ["tech1", "tech2", ...],
  "architecture_approach": "brief description",
  "has_prompt_design": boolean,
  "has_llm_chaining": boolean,
  "has_rag": boolean,
  "has_error_handling": boolean,
  "has_tests": boolean
}

Return ONLY the JSON object.`;
};

/**
 * Prompt untuk evaluasi project (first pass)
 */
export const evaluateProjectPrompt = (extractedProject, scoringRubric) => {
    return `You are a senior backend engineer evaluating a technical project deliverable.

SCORING RUBRIC:
${scoringRubric}

PROJECT ANALYSIS:
${JSON.stringify(extractedProject, null, 2)}

Evaluate on these 5 parameters (score 1-5 for each):

1. Correctness - Prompt & Chaining (Weight: 30%)
   - Implements prompt design, LLM chaining, RAG
   - 1=Not implemented, 2=Minimal, 3=Partial, 4=Correct, 5=Excellent

2. Code Quality & Structure (Weight: 25%)
   - Clean, modular, testable
   - 1=Poor, 2=Some structure, 3=Decent, 4=Good+tests, 5=Excellent+strong tests

3. Resilience & Error Handling (Weight: 20%)
   - Long jobs, retries, randomness, API failures
   - 1=Missing, 2=Minimal, 3=Partial, 4=Solid, 5=Production-ready

4. Documentation & Explanation (Weight: 15%)
   - README, setup, trade-offs
   - 1=Missing, 2=Minimal, 3=Adequate, 4=Clear, 5=Excellent+insightful

5. Creativity/Bonus (Weight: 10%)
   - Extra features beyond requirements
   - 1=None, 2=Basic, 3=Useful, 4=Strong, 5=Outstanding

Return a JSON object:
{
  "scores": {
    "correctness": score (1-5, one decimal),
    "code_quality": score (1-5, one decimal),
    "resilience": score (1-5, one decimal),
    "documentation": score (1-5, one decimal),
    "creativity": score (1-5, one decimal)
  },
  "feedback": "2-3 sentences about what works and what needs improvement"
}

Return ONLY the JSON object.`;
};

/**
 * Prompt untuk refine project evaluation (second pass)
 */
export const refineProjectEvaluationPrompt = (initialScores, initialFeedback) => {
    return `You are reviewing an initial project evaluation. Refine the scores and feedback.

INITIAL EVALUATION:
Scores: ${JSON.stringify(initialScores, null, 2)}
Feedback: ${initialFeedback}

Review and refine:
1. Are the scores fair and consistent?
2. Is the feedback specific and actionable?
3. Any scores that should be adjusted?

Return refined evaluation:
{
  "scores": {
    "correctness": score (1-5, one decimal),
    "code_quality": score (1-5, one decimal),
    "resilience": score (1-5, one decimal),
    "documentation": score (1-5, one decimal),
    "creativity": score (1-5, one decimal)
  },
  "feedback": "improved 2-3 sentences"
}

Return ONLY the JSON object.`;
};

export const generateSummaryPrompt = (cvScores, cvFeedback, projectScores, projectFeedback, cvMatchRate, projectScore) => {
    return `You are writing a final evaluation summary for a backend engineer candidate.

CV EVALUATION:
- Match Rate: ${(cvMatchRate * 100).toFixed(0)}%
- Scores: ${JSON.stringify(cvScores, null, 2)}
- Feedback: ${cvFeedback}

PROJECT EVALUATION:
- Score: ${projectScore.toFixed(1)}/10
- Scores: ${JSON.stringify(projectScores, null, 2)}
- Feedback: ${projectFeedback}

Write a concise 3-5 sentence summary that:
1. States overall candidate fit (strong/good/moderate/weak)
2. Highlights key strengths
3. Notes main gaps or areas for improvement
4. Gives a recommendation

Return ONLY the summary text (not JSON).`;
};