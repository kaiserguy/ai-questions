/**
 * Unit tests for ModelStorage class
 * Tests model file storage, retrieval, and management in IndexedDB
 */

const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');
const { Blob } = require('node:buffer');
const { setupIndexedDBEnvironment } = require('../../test-utils');

// Setup test environment
setupIndexedDBEnvironment();

// Load IndexedDBManager base class first
require('../../../core/public/offline/storage/indexeddb-manager');

describe('ModelStorage', () => {
    let modelStorage;
    
    beforeEach(async () => {
        // Import ModelStorage (will need to be adapted for browser/node compatibility)
        const { ModelStorage } = require('../../../core/public/offline/storage/model-storage.js');
        modelStorage = new ModelStorage();
        await modelStorage.initialize();
    });
    
    afterEach(async () => {
        if (modelStorage) {
            await modelStorage.deleteModel('test-model');
            // Close database connection
        }
    });
    
    describe('storeModelFile', () => {
        test('should store a model file successfully', async () => {
            const modelId = 'test-model';
            const fileName = 'model.onnx';
            const blob = new Blob(['test data'], { type: 'application/octet-stream' });
            const checksum = 'abc123';
            
            await modelStorage.storeModelFile(modelId, fileName, blob, checksum);
            
            const retrieved = await modelStorage.getModelFile(fileName);
            expect(retrieved).toBeDefined();
            expect(retrieved.size).toBe(blob.size);
        });
        
        test('should throw error for invalid inputs', async () => {
            await expect(
                modelStorage.storeModelFile(null, 'file.onnx', new Blob([]), 'checksum')
            ).rejects.toThrow();
            
            await expect(
                modelStorage.storeModelFile('model', null, new Blob([]), 'checksum')
            ).rejects.toThrow();
        });
        
        test('should handle large files', async () => {
            const modelId = 'large-model';
            const fileName = 'large-model.onnx';
            // Create a 10MB blob
            const largeBlob = new Blob([new ArrayBuffer(10 * 1024 * 1024)]);
            const checksum = 'large-checksum';
            
            await modelStorage.storeModelFile(modelId, fileName, largeBlob, checksum);
            
            const retrieved = await modelStorage.getModelFile(fileName);
            expect(retrieved.size).toBe(largeBlob.size);
        });
    });
    
    describe('getModelFile', () => {
        test('should retrieve stored model file', async () => {
            const fileName = 'test.onnx';
            const blob = new Blob(['test'], { type: 'application/octet-stream' });
            
            await modelStorage.storeModelFile('model', fileName, blob, 'checksum');
            const retrieved = await modelStorage.getModelFile(fileName);
            
            expect(retrieved).toBeDefined();
            expect(retrieved.size).toBe(blob.size);
        });
        
        test('should return null for non-existent file', async () => {
            const retrieved = await modelStorage.getModelFile('nonexistent.onnx');
            expect(retrieved).toBeNull();
        });
    });
    
    describe('isModelComplete', () => {
        test('should return true when all files present', async () => {
            const modelId = 'complete-model';
            const requiredFiles = ['model.onnx', 'model.onnx_data', 'tokenizer.json'];
            
            for (const fileName of requiredFiles) {
                await modelStorage.storeModelFile(
                    modelId,
                    fileName,
                    new Blob(['data']),
                    'checksum'
                );
            }
            
            const isComplete = await modelStorage.isModelComplete(modelId, requiredFiles);
            expect(isComplete).toBe(true);
        });
        
        test('should return false when files missing', async () => {
            const modelId = 'incomplete-model';
            const requiredFiles = ['model.onnx', 'model.onnx_data'];
            
            // Only store one file
            await modelStorage.storeModelFile(
                modelId,
                'model.onnx',
                new Blob(['data']),
                'checksum'
            );
            
            const isComplete = await modelStorage.isModelComplete(modelId, requiredFiles);
            expect(isComplete).toBe(false);
        });
    });
    
    describe('getModelMetadata', () => {
        test('should retrieve model metadata', async () => {
            const modelId = 'meta-model';
            const metadata = {
                modelId,
                name: 'Phi-3 Mini',
                version: '1.0',
                size: 4000000000
            };
            
            await modelStorage.updateModelMetadata(modelId, metadata);
            const retrieved = await modelStorage.getModelMetadata(modelId);
            
            expect(retrieved).toMatchObject(metadata);
        });
        
        test('should return null for non-existent model', async () => {
            const retrieved = await modelStorage.getModelMetadata('nonexistent');
            expect(retrieved).toBeNull();
        });
    });
    
    describe('updateModelMetadata', () => {
        test('should update existing metadata', async () => {
            const modelId = 'update-model';
            const initialMetadata = { modelId, version: '1.0' };
            const updatedMetadata = { modelId, version: '2.0' };
            
            await modelStorage.updateModelMetadata(modelId, initialMetadata);
            await modelStorage.updateModelMetadata(modelId, updatedMetadata);
            
            const retrieved = await modelStorage.getModelMetadata(modelId);
            expect(retrieved.version).toBe('2.0');
        });
    });
    
    describe('deleteModel', () => {
        test('should delete all model files and metadata', async () => {
            const modelId = 'delete-model';
            const files = ['file1.onnx', 'file2.json'];
            
            for (const fileName of files) {
                await modelStorage.storeModelFile(modelId, fileName, new Blob(['data']), 'checksum');
            }
            await modelStorage.updateModelMetadata(modelId, { modelId });
            
            await modelStorage.deleteModel(modelId);
            
            const metadata = await modelStorage.getModelMetadata(modelId);
            expect(metadata).toBeNull();
            
            for (const fileName of files) {
                const file = await modelStorage.getModelFile(fileName);
                expect(file).toBeNull();
            }
        });
    });
    
    describe('getTotalStorageUsed', () => {
        test('should calculate total storage used', async () => {
            const modelId = 'storage-test';
            const blob1 = new Blob([new ArrayBuffer(1000)]);
            const blob2 = new Blob([new ArrayBuffer(2000)]);
            
            await modelStorage.storeModelFile(modelId, 'file1.onnx', blob1, 'checksum1');
            await modelStorage.storeModelFile(modelId, 'file2.onnx', blob2, 'checksum2');
            
            const totalUsed = await modelStorage.getTotalStorageUsed();
            expect(totalUsed).toBeGreaterThanOrEqual(3000);
        });
    });
});
