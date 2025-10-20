const { v4: uuidv4 } = require('uuid');

const generateId = () => uuidv4();

const calculateWeightedScore = (scores, weights) => {
  let totalScore = 0;
  let totalWeight = 0;

  for (const [key, score] of Object.entries(scores)) {
    const weight = weights[key] || 0;
    totalScore += score * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? totalScore / totalWeight : 0;
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const delayMs = baseDelay * Math.pow(2, i);
      await delay(delayMs);
    }
  }
};

const sanitizeText = (text) => {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim();
};

const chunkText = (text, maxChunkSize = 1000) => {
  const chunks = [];
  const sentences = text.split(/[.!?]+/);
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxChunkSize) {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += sentence + '.';
    }
  }

  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks;
};

module.exports = {
  generateId,
  calculateWeightedScore,
  delay,
  retryWithBackoff,
  sanitizeText,
  chunkText,
};
