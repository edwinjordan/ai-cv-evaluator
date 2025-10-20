import { ChromaClient } from 'chromadb';
import config from './index.js';
import logger from './logger.js';

class ChromaDBConnection {
  constructor() {
    this.client = null;
    this.collections = new Map();
    this.isConnected = false;
  }

  /**
   * Initialize ChromaDB connection
   * @returns {Promise<void>}
   */
  async connect() {
    try {
      this.client = new ChromaClient({
        path: config.chromadb.url || `http://${process.env.CHROMA_HOST}:${process.env.CHROMA_PORT}`
      });

      // Test connection
      await this.client.heartbeat();
      this.isConnected = true;
      
      logger.info('ChromaDB connected successfully');

      // Initialize default collections
      await this.initializeCollections();
      
    } catch (error) {
      logger.error('ChromaDB connection failed:', error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Initialize required collections
   * @returns {Promise<void>}
   */
  async initializeCollections() {
    const collectionConfigs = [
      {
        name: 'job_descriptions',
        metadata: { description: 'Vector embeddings for job descriptions' }
      },
      {
        name: 'cv_documents',
        metadata: { description: 'Vector embeddings for CV documents' }
      },
      {
        name: 'project_documents',
        metadata: { description: 'Vector embeddings for project reports' }
      },
      {
        name: 'rubrics',
        metadata: { description: 'Vector embeddings for evaluation rubrics' }
      },
      {
        name: 'case_studies',
        metadata: { description: 'Vector embeddings for case studies' }
      }
    ];

    for (const collectionConfig of collectionConfigs) {
      try {
        const collection = await this.client.getOrCreateCollection({
          name: collectionConfig.name,
          metadata: collectionConfig.metadata
        });
        
        this.collections.set(collectionConfig.name, collection);
        logger.info(`ChromaDB collection '${collectionConfig.name}' initialized`);
        
      } catch (error) {
        logger.error(`Failed to initialize collection '${collectionConfig.name}':`, error);
      }
    }
  }

  /**
   * Get a collection by name
   * @param {string} collectionName - Name of the collection
   * @returns {Object} - ChromaDB collection instance
   */
  getCollection(collectionName) {
    if (!this.isConnected) {
      throw new Error('ChromaDB is not connected');
    }

    const collection = this.collections.get(collectionName);
    if (!collection) {
      throw new Error(`Collection '${collectionName}' not found`);
    }

    return collection;
  }

  /**
   * Add documents to a collection
   * @param {string} collectionName - Name of the collection
   * @param {Array} documents - Array of document objects
   * @returns {Promise<void>}
   */
  async addDocuments(collectionName, documents) {
    const collection = this.getCollection(collectionName);
    
    const ids = documents.map((_, index) => `${Date.now()}_${index}`);
    const embeddings = documents.map(doc => doc.embedding);
    const metadatas = documents.map(doc => ({
      document_id: doc.documentId,
      user_id: doc.userId,
      document_type: doc.type,
      filename: doc.filename,
      created_at: new Date().toISOString(),
      ...doc.metadata
    }));
    const documentTexts = documents.map(doc => doc.text);

    await collection.add({
      ids,
      embeddings,
      metadatas,
      documents: documentTexts
    });

    logger.info(`Added ${documents.length} documents to collection '${collectionName}'`);
  }

  /**
   * Search for similar documents
   * @param {string} collectionName - Name of the collection
   * @param {Array} queryEmbedding - Query embedding vector
   * @param {number} nResults - Number of results to return
   * @param {Object} where - Filter conditions
   * @returns {Promise<Object>} - Search results
   */
  async searchSimilar(collectionName, queryEmbedding, nResults = 5, where = {}) {
    const collection = this.getCollection(collectionName);
    
    try {
      // Check if collection has any documents first
      const count = await collection.count();
      if (count === 0) {
        logger.info(`Collection '${collectionName}' is empty, returning empty results`);
        return {
          documents: [],
          metadatas: [],
          distances: []
        };
      }

      // Clean up where clause - remove empty objects and undefined values
      const cleanWhere = Object.keys(where).length === 0 ? undefined : where;
      
      const queryParams = {
        queryEmbeddings: [queryEmbedding],
        nResults,
        include: ['documents', 'metadatas', 'distances']
      };
      
      // Only add where clause if it's not empty
      if (cleanWhere) {
        queryParams.where = cleanWhere;
      }

      const results = await collection.query(queryParams);

      return {
        documents: results.documents[0] || [],
        metadatas: results.metadatas[0] || [],
        distances: results.distances[0] || []
      };
      
    } catch (error) {
      logger.error(`ChromaDB search failed in collection '${collectionName}':`, error.message);
      
      // Return empty results on error to prevent cascade failures
      return {
        documents: [],
        metadatas: [],
        distances: []
      };
    }
  }

  /**
   * Health check for ChromaDB connection
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    try {
      await this.client.heartbeat();
      return true;
    } catch (error) {
      logger.error('ChromaDB health check failed:', error);
      return false;
    }
  }

  /**
   * Close ChromaDB connection
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (this.client) {
      this.client = null;
      this.collections.clear();
      this.isConnected = false;
      logger.info('ChromaDB disconnected');
    }
  }
}

// Create singleton instance
const chromaDB = new ChromaDBConnection();

export default chromaDB;