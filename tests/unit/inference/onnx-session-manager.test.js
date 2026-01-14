/**
 * Unit tests for ONNXSessionManager
 */

const { ONNXSessionManager } = require('../../../core/public/offline/inference/onnx-session-manager');

describe('ONNXSessionManager', () => {
    let sessionManager;

    beforeEach(() => {
        sessionManager = new ONNXSessionManager();
    });

    describe('constructor', () => {
        test('should initialize with default values', () => {
            expect(sessionManager.session).toBeNull();
            expect(sessionManager.executionProvider).toBeNull();
            expect(sessionManager.modelMetadata).toBeNull();
            expect(sessionManager.isLoaded).toBe(false);
            expect(sessionManager.inputNames).toEqual([]);
            expect(sessionManager.outputNames).toEqual([]);
        });

        test('should initialize stats', () => {
            expect(sessionManager.stats.loadTimeMs).toBe(0);
            expect(sessionManager.stats.lastInferenceTimeMs).toBe(0);
            expect(sessionManager.stats.totalInferences).toBe(0);
            expect(sessionManager.stats.averageInferenceTimeMs).toBe(0);
        });
    });

    describe('checkWebGPUSupport', () => {
        test('should return false when navigator is undefined', async () => {
            const originalNavigator = global.navigator;
            delete global.navigator;
            
            const result = await sessionManager.checkWebGPUSupport();
            expect(result).toBe(false);
            
            global.navigator = originalNavigator;
        });

        test('should return false when navigator.gpu is undefined', async () => {
            global.navigator = {};
            
            const result = await sessionManager.checkWebGPUSupport();
            expect(result).toBe(false);
        });
    });

    describe('getBestExecutionProvider', () => {
        test('should return wasm when WebGPU is not available', async () => {
            sessionManager.checkWebGPUSupport = jest.fn().mockResolvedValue(false);
            
            const provider = await sessionManager.getBestExecutionProvider();
            expect(provider).toBe('wasm');
        });

        test('should return webgpu when WebGPU is available', async () => {
            sessionManager.checkWebGPUSupport = jest.fn().mockResolvedValue(true);
            
            const provider = await sessionManager.getBestExecutionProvider();
            expect(provider).toBe('webgpu');
        });
    });

    describe('loadModel', () => {
        test('should throw when ONNX Runtime is not loaded', async () => {
            await expect(sessionManager.loadModel('test.onnx')).rejects.toThrow('ONNX Runtime Web (ort) is not loaded');
        });

        test('should throw for invalid model source type', async () => {
            global.ort = {
                InferenceSession: {
                    create: jest.fn()
                }
            };
            sessionManager.getBestExecutionProvider = jest.fn().mockResolvedValue('wasm');
            
            await expect(sessionManager.loadModel(123)).rejects.toThrow('Invalid model source type');
            
            delete global.ort;
        });
    });

    describe('runInference', () => {
        test('should throw when model is not loaded', async () => {
            await expect(sessionManager.runInference({})).rejects.toThrow('Model not loaded');
        });
    });

    describe('createTensor', () => {
        test('should throw when ONNX Runtime is not loaded', () => {
            expect(() => sessionManager.createTensor('float32', [], [1])).toThrow('ONNX Runtime Web (ort) is not loaded');
        });

        test('should create tensor when ONNX Runtime is available', () => {
            const mockTensor = { type: 'float32', data: [], dims: [1] };
            global.ort = {
                Tensor: jest.fn().mockReturnValue(mockTensor)
            };
            
            const tensor = sessionManager.createTensor('float32', [1.0, 2.0], [2]);
            expect(global.ort.Tensor).toHaveBeenCalledWith('float32', [1.0, 2.0], [2]);
            
            delete global.ort;
        });
    });

    describe('getModelInfo', () => {
        test('should return null when not loaded', () => {
            expect(sessionManager.getModelInfo()).toBeNull();
        });

        test('should return metadata when loaded', () => {
            sessionManager.isLoaded = true;
            sessionManager.modelMetadata = {
                inputNames: ['input'],
                outputNames: ['output'],
                executionProvider: 'wasm'
            };
            sessionManager.stats = { loadTimeMs: 100 };
            
            const info = sessionManager.getModelInfo();
            expect(info.inputNames).toEqual(['input']);
            expect(info.outputNames).toEqual(['output']);
            expect(info.stats.loadTimeMs).toBe(100);
        });
    });

    describe('getStats', () => {
        test('should return copy of stats', () => {
            sessionManager.stats.totalInferences = 5;
            
            const stats = sessionManager.getStats();
            stats.totalInferences = 10;
            
            expect(sessionManager.stats.totalInferences).toBe(5);
        });
    });

    describe('release', () => {
        test('should reset state', async () => {
            sessionManager.isLoaded = true;
            sessionManager.inputNames = ['input'];
            sessionManager.outputNames = ['output'];
            sessionManager.modelMetadata = { test: true };
            
            await sessionManager.release();
            
            expect(sessionManager.session).toBeNull();
            expect(sessionManager.isLoaded).toBe(false);
            expect(sessionManager.inputNames).toEqual([]);
            expect(sessionManager.outputNames).toEqual([]);
            expect(sessionManager.modelMetadata).toBeNull();
        });

        test('should release session if exists', async () => {
            const mockRelease = jest.fn();
            sessionManager.session = { release: mockRelease };
            
            await sessionManager.release();
            
            expect(mockRelease).toHaveBeenCalled();
        });
    });

    describe('isReady', () => {
        test('should return false when not loaded', () => {
            expect(sessionManager.isReady()).toBe(false);
        });

        test('should return false when session is null', () => {
            sessionManager.isLoaded = true;
            sessionManager.session = null;
            expect(sessionManager.isReady()).toBe(false);
        });

        test('should return true when loaded and session exists', () => {
            sessionManager.isLoaded = true;
            sessionManager.session = {};
            expect(sessionManager.isReady()).toBe(true);
        });
    });
});
