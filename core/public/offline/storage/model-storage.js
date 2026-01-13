/**
 * Model Storage Manager
 * Handles Phi-3 ONNX model storage in IndexedDB
 */
class ModelStorage extends IndexedDBManager {
    constructor() {
        super('phi3-models', 1);
        this.schema = {
            'model-files': {
                keyPath: 'name',
                indexes: {
                    'modelId': { keyPath: 'modelId' },
                    'downloadedAt': { keyPath: 'downloadedAt' }
                }
            },
            'model-metadata': {
                keyPath: 'id'
            }
        };
    }

    /**
     * Initialize storage
     * @returns {Promise<void>}
     */
    async initialize() {
        await this.open(this.schema);
    }

    /**
     * Store model file
     * @param {string} modelId - Model identifier
     * @param {string} fileName - File name
     * @param {Blob} blob - File data
     * @param {string} checksum - SHA-256 checksum
     * @returns {Promise<void>}
     */
    async storeModelFile(modelId, fileName, blob, checksum) {
        const fileData = {
            name: fileName,
            modelId: modelId,
            blob: blob,
            size: blob.size,
            checksum: checksum,
            downloadedAt: new Date().toISOString()
        };
        
        await this.put('model-files', fileData);
    }

    /**
     * Get model file
     * @param {string} fileName - File name
     * @returns {Promise<Blob>}
     */
    async getModelFile(fileName) {
        const fileData = await this.get('model-files', fileName);
        if (!fileData) {
            throw new Error(`Model file not found: ${fileName}`);
        }
        return fileData.blob;
    }

    /**
     * Check if model is fully downloaded
     * @param {string} modelId - Model identifier
     * @param {Array<string>} requiredFiles - Array of required file names
     * @returns {Promise<boolean>}
     */
    async isModelComplete(modelId, requiredFiles) {
        const files = await this.queryByIndex('model-files', 'modelId', modelId);
        const fileNames = files.map(f => f.name);
        return requiredFiles.every(rf => fileNames.includes(rf));
    }

    /**
     * Get model metadata
     * @param {string} modelId - Model identifier
     * @returns {Promise<Object|null>}
     */
    async getModelMetadata(modelId) {
        return await this.get('model-metadata', modelId);
    }

    /**
     * Update model metadata
     * @param {string} modelId - Model identifier
     * @param {Object} metadata - Metadata object
     * @returns {Promise<void>}
     */
    async updateModelMetadata(modelId, metadata) {
        const existing = await this.getModelMetadata(modelId) || { id: modelId };
        const updated = { ...existing, ...metadata, updatedAt: new Date().toISOString() };
        await this.put('model-metadata', updated);
    }

    /**
     * Delete model and all its files
     * @param {string} modelId - Model identifier
     * @returns {Promise<void>}
     */
    async deleteModel(modelId) {
        const files = await this.queryByIndex('model-files', 'modelId', modelId);
        for (const file of files) {
            await this.delete('model-files', file.name);
        }
        await this.delete('model-metadata', modelId);
    }

    /**
     * Get total storage used by models
     * @returns {Promise<number>} Size in bytes
     */
    async getTotalStorageUsed() {
        const files = await this.getAll('model-files');
        return files.reduce((total, file) => total + file.size, 0);
    }
}

// Export for use in browser
if (typeof window !== 'undefined') {
    window.ModelStorage = ModelStorage;
}
