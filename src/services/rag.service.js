import chromaDB from '../config/connection_chromadb.js';
import llmConnection from '../config/connection_llm.js';
import logger from '../config/logger.js';

class RAGService {
  constructor() {
    this.isInitialized = false;
  }

  /**
   * Initialize RAG service
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      if (!chromaDB.isConnected) {
        await chromaDB.connect();
      }

      if (!llmConnection.isConnected) {
        await llmConnection.connect();
      }

      this.isInitialized = true;
      logger.info('RAG service initialized successfully');

    } catch (error) {
      logger.error('RAG service initialization failed:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for text chunks
   * @param {string|Array<string>} text - Text to embed
   * @returns {Promise<Array<number>|Array<Array<number>>>}
   */
  async generateEmbeddings(text) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const result = await llmConnection.generateEmbeddings(text);
    
    if (!result.success && !result.fallback) {
      throw new Error(`Embedding generation failed: ${result.error}`);
    }

    return result.embeddings;
  }

  /**
   * Index document content into vector database
   * @param {Object} document - Document object
   * @param {string} collectionName - Target collection name
   * @returns {Promise<void>}
   */
  async indexDocument(document, collectionName) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Split document into chunks if needed
      const chunks = this.splitTextIntoChunks(document.content, 1000, 200);
      
      // Generate embeddings for all chunks
      const embeddings = await this.generateEmbeddings(chunks);
      
      // Prepare documents for ChromaDB
      const vectorDocuments = chunks.map((chunk, index) => ({
        documentId: document.id,
        userId: document.userId,
        type: document.type,
        filename: document.filename,
        text: chunk,
        embedding: embeddings[index],
        metadata: {
          chunk_index: index,
          total_chunks: chunks.length,
          document_type: document.type,
          indexed_at: new Date().toISOString()
        }
      }));

      // Add to ChromaDB collection
      await chromaDB.addDocuments(collectionName, vectorDocuments);
      
      logger.info(`Indexed document ${document.id} into collection ${collectionName} (${chunks.length} chunks)`);

    } catch (error) {
      logger.error(`Failed to index document ${document.id}:`, error);
      throw error;
    }
  }

  /**
   * Search for relevant document chunks
   * @param {string} query - Search query
   * @param {string} collectionName - Collection to search in
   * @param {Object} options - Search options
   * @returns {Promise<Array>} - Relevant document chunks
   */
  async searchRelevantChunks(query, collectionName, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const {
      maxResults = 5,
      similarityThreshold = 0.3,
      filter = {}
    } = options;

    try {
      // Generate embedding for query
      const queryEmbedding = await this.generateEmbeddings(query);
      
      // Search in ChromaDB
      const searchResults = await chromaDB.searchSimilar(
        collectionName,
        queryEmbedding,
        maxResults,
        filter
      );

      // Handle empty results
      if (!searchResults.documents || searchResults.documents.length === 0) {
        logger.info(`No documents found in collection ${collectionName}`);
        return [];
      }

      // Filter by similarity threshold and format results
      const relevantChunks = searchResults.documents
        .map((doc, index) => ({
          content: doc,
          metadata: searchResults.metadatas[index] || {},
          similarity: 1 - (searchResults.distances[index] || 1), // Convert distance to similarity
          distance: searchResults.distances[index] || 1
        }))
        .filter(chunk => chunk.similarity >= similarityThreshold)
        .sort((a, b) => b.similarity - a.similarity);

      logger.info(`Found ${relevantChunks.length} relevant chunks for query in ${collectionName}`);
      
      return relevantChunks;

    } catch (error) {
      logger.error(`RAG search failed in collection ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Retrieve context for CV evaluation
   * @param {string} jobTitle - Job position title
   * @param {string} cvContent - CV text content
   * @param {string} userId - User ID for filtering
   * @returns {Promise<Object>} - Retrieved context
   */
  async retrieveEvaluationContext(jobTitle, cvContent, userId) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const context = {
        jobRequirements: [],
        similarCVs: [],
        rubrics: [],
        caseStudies: []
      };

      // Search job descriptions for requirements
      try {
        const jobContext = await this.searchRelevantChunks(
          jobTitle,
          'job_descriptions',
          { maxResults: 3, filter: { user_id: userId } }
        );
        context.jobRequirements = jobContext;
      } catch (error) {
        logger.warn('Failed to retrieve job requirements context:', error.message);
      }

      // Search CV rubrics for evaluation criteria
      try {
        const rubricContext = await this.searchRelevantChunks(
          `${jobTitle} CV evaluation criteria`,
          'rubrics',
          { maxResults: 2, filter: { user_id: userId, document_type: 'cv_rubric' } }
        );
        context.rubrics = rubricContext;
      } catch (error) {
        logger.warn('Failed to retrieve rubrics context:', error.message);
      }

      // Search case studies for examples
      try {
        const caseStudyContext = await this.searchRelevantChunks(
          jobTitle,
          'case_studies',
          { maxResults: 2, filter: { user_id: userId } }
        );
        context.caseStudies = caseStudyContext;
      } catch (error) {
        logger.warn('Failed to retrieve case studies context:', error.message);
      }

      // Search similar CVs (if any indexed)
      try {
        const similarCVContext = await this.searchRelevantChunks(
          cvContent.substring(0, 500), // Use first part of CV for similarity
          'cv_documents',
          { maxResults: 2, filter: { user_id: userId } }
        );
        context.similarCVs = similarCVContext;
      } catch (error) {
        logger.warn('Failed to retrieve similar CVs context:', error.message);
      }

      logger.info('Retrieved evaluation context successfully');
      
      return context;

    } catch (error) {
      logger.error('Failed to retrieve evaluation context:', error.message);
      // Return empty context instead of throwing
      return {
        jobRequirements: [],
        similarCVs: [],
        rubrics: [],
        caseStudies: []
      };
    }
  }

  /**
   * Retrieve context for project evaluation
   * @param {string} jobTitle - Job position title
   * @param {string} projectContent - Project report content
   * @param {string} userId - User ID for filtering
   * @returns {Promise<Object>} - Retrieved context
   */
  async retrieveProjectContext(jobTitle, projectContent, userId) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const context = {
      projectRubrics: [],
      similarProjects: [],
      technicalRequirements: []
    };

    // Search project rubrics for evaluation criteria
    try {
      const rubricContext = await this.searchRelevantChunks(
        `${jobTitle} project evaluation criteria`,
        'rubrics',
        { maxResults: 3, filter: { user_id: userId, document_type: 'project_rubric' } }
      );
      context.projectRubrics = rubricContext;
    } catch (error) {
      logger.warn('Failed to retrieve project rubrics context:', error.message);
      context.projectRubrics = [];
    }

    // Search for technical requirements based on job title
    try {
      const techContext = await this.searchRelevantChunks(
        `${jobTitle} technical requirements skills`,
        'job_descriptions',
        { maxResults: 2, filter: { user_id: userId } }
      );
      context.technicalRequirements = techContext;
    } catch (error) {
      logger.warn('Failed to retrieve technical requirements context:', error.message);
      context.technicalRequirements = [];
    }

    // Search similar projects
    try {
      const projectSummary = this.extractProjectSummary(projectContent);
      const similarProjectContext = await this.searchRelevantChunks(
        projectSummary,
        'project_documents',
        { maxResults: 2, filter: { user_id: userId } }
      );
      context.similarProjects = similarProjectContext;
    } catch (error) {
      logger.warn('Failed to retrieve similar projects context:', error.message);
      context.similarProjects = [];
    }

    logger.info('Retrieved project evaluation context successfully');
    
    return context;
  }

  /**
   * Remove document from vector database
   * @param {string} documentId - Document ID to remove
   * @param {string} collectionName - Collection name
   * @returns {Promise<void>}
   */
  async removeDocument(documentId, collectionName) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      await chromaDB.deleteDocument(collectionName, documentId);
      logger.info(`Removed document ${documentId} from collection ${collectionName}`);

    } catch (error) {
      logger.error(`Failed to remove document ${documentId}:`, error);
      throw error;
    }
  }

  /**
   * Split text into chunks with overlap
   * @param {string} text - Text to split
   * @param {number} chunkSize - Maximum chunk size
   * @param {number} overlap - Overlap between chunks
   * @returns {Array<string>} - Text chunks
   */
  splitTextIntoChunks(text, chunkSize = 1000, overlap = 200) {
    const chunks = [];
    let start = 0;

    while (start < text.length) {
      let end = start + chunkSize;
      
      // Try to split at sentence boundary
      if (end < text.length) {
        const lastPeriod = text.lastIndexOf('.', end);
        const lastNewline = text.lastIndexOf('\n', end);
        const lastBoundary = Math.max(lastPeriod, lastNewline);
        
        if (lastBoundary > start + chunkSize * 0.5) {
          end = lastBoundary + 1;
        }
      }

      chunks.push(text.slice(start, end).trim());
      start = end - overlap;
    }

    return chunks.filter(chunk => chunk.length > 50); // Filter out very small chunks
  }

  /**
   * Extract project summary for similarity search
   * @param {string} projectContent - Full project content
   * @returns {string} - Project summary
   */
  extractProjectSummary(projectContent) {
    // Extract first few paragraphs and any section titles
    const lines = projectContent.split('\n');
    const summaryLines = [];
    let charCount = 0;

    for (const line of lines) {
      if (charCount > 800) break;
      
      const trimmed = line.trim();
      if (trimmed.length > 0) {
        summaryLines.push(trimmed);
        charCount += trimmed.length;
      }
    }

    return summaryLines.join(' ');
  }

  /**
   * Get RAG service health status
   * @returns {Promise<Object>} - Health status
   */
  async getHealthStatus() {
    return {
      isInitialized: this.isInitialized,
      chromadbConnected: chromaDB.isConnected,
      llmConnected: llmConnection.isConnected,
      timestamp: new Date().toISOString()
    };
  }
}

// Create singleton instance
const ragService = new RAGService();

export default ragService;