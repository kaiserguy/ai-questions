/**
 * Unit tests for Phi3Inference
 */

const { Phi3Inference } = require('../../../core/public/offline/inference/phi3-inference');

// Mock dependencies
global.Phi3Tokenizer = class {
    constructor() {
        this.isLoaded = false;
        this.specialTokens = {
            '<|end|>': 32007,
            '<|user|>': 32010
        };
    }
    async load() { this.isLoaded = true; }
    encode() { return [1, 100, 101, 102]; }
    decode(tokens) { return tokens.map(t => `token${t}`).join(' '); }
    formatChat(messages) { return messages.map(m => m.content).join(' '); }
    getEosTokenId() { return 2; }
};

global.ONNXSessionManager = class {
    constructor() { this.loaded = false; }
    async loadModel() { this.loaded = true; }
    isReady() { return this.loaded; }
    async runInference() {
        return {
            logits: {
                data: new Float32Array(32000).fill(0.1),
                dims: [1, 4, 32000]
            }
        };
    }
    getStats() { return { totalInferences: 1 }; }
    async release() { this.loaded = false; }
};

describe('Phi3Inference', () => {
    let inference;

    beforeEach(() => {
        inference = new Phi3Inference();
    });

    describe('constructor', () => {
        test('should initialize with default values', () => {
            expect(inference.tokenizer).toBeNull();
            expect(inference.sessionManager).toBeNull();
            expect(inference.isInitialized).toBe(false);
            expect(inference.maxContextLength).toBe(4096);
        });

        test('should have default generation config', () => {
            expect(inference.generationConfig.maxNewTokens).toBe(512);
            expect(inference.generationConfig.temperature).toBe(0.7);
            expect(inference.generationConfig.topK).toBe(50);
            expect(inference.generationConfig.topP).toBe(0.9);
            expect(inference.generationConfig.repetitionPenalty).toBe(1.1);
            expect(inference.generationConfig.doSample).toBe(true);
        });

        test('should initialize generation state', () => {
            expect(inference.isGenerating).toBe(false);
            expect(inference.shouldStop).toBe(false);
        });
    });

    describe('setGenerationConfig', () => {
        test('should update generation config', () => {
            inference.setGenerationConfig({ temperature: 0.5, topK: 100 });
            
            expect(inference.generationConfig.temperature).toBe(0.5);
            expect(inference.generationConfig.topK).toBe(100);
            expect(inference.generationConfig.maxNewTokens).toBe(512); // unchanged
        });
    });

    describe('generate', () => {
        test('should throw when not initialized', async () => {
            await expect(inference.generate('test')).rejects.toThrow('not initialized');
        });
    });

    describe('chat', () => {
        test('should throw when not initialized', async () => {
            await expect(inference.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow('not initialized');
        });
    });

    describe('stop', () => {
        test('should set shouldStop flag', () => {
            inference.stop();
            expect(inference.shouldStop).toBe(true);
        });
    });

    describe('isCurrentlyGenerating', () => {
        test('should return isGenerating state', () => {
            expect(inference.isCurrentlyGenerating()).toBe(false);
            
            inference.isGenerating = true;
            expect(inference.isCurrentlyGenerating()).toBe(true);
        });
    });

    describe('isReady', () => {
        test('should return isInitialized state', () => {
            expect(inference.isReady()).toBe(false);
            
            inference.isInitialized = true;
            expect(inference.isReady()).toBe(true);
        });
    });

    describe('getStats', () => {
        test('should return null when session manager not initialized', () => {
            expect(inference.getStats()).toBeNull();
        });

        test('should return stats from session manager', () => {
            inference.sessionManager = new global.ONNXSessionManager();
            const stats = inference.getStats();
            expect(stats.totalInferences).toBe(1);
        });
    });

    describe('release', () => {
        test('should release session manager and reset state', async () => {
            inference.sessionManager = new global.ONNXSessionManager();
            inference.sessionManager.loaded = true;
            inference.isInitialized = true;
            
            await inference.release();
            
            expect(inference.isInitialized).toBe(false);
            expect(inference.sessionManager.loaded).toBe(false);
        });
    });

    describe('_createInputTensor', () => {
        test('should create correct tensor format', () => {
            const tensor = inference._createInputTensor([1, 2, 3]);
            
            expect(tensor.type).toBe('int64');
            expect(tensor.dims).toEqual([1, 3]);
            expect(tensor.data.length).toBe(3);
        });
    });

    describe('_createAttentionMask', () => {
        test('should create mask of all ones', () => {
            const mask = inference._createAttentionMask(5);
            
            expect(mask.type).toBe('int64');
            expect(mask.dims).toEqual([1, 5]);
            expect(mask.data.every(v => v === 1n)).toBe(true);
        });
    });

    describe('_applyRepetitionPenalty', () => {
        test('should not modify logits when penalty is 1.0', () => {
            const logits = [1.0, 2.0, 3.0];
            const result = inference._applyRepetitionPenalty(logits, [0, 1], 1.0);
            
            expect(result).toEqual(logits);
        });

        test('should reduce probability of seen tokens', () => {
            const logits = [1.0, 2.0, 3.0];
            const result = inference._applyRepetitionPenalty(logits, [0, 1], 1.5);
            
            expect(result[0]).toBeLessThan(logits[0]);
            expect(result[1]).toBeLessThan(logits[1]);
            expect(result[2]).toBe(logits[2]); // unchanged
        });

        test('should handle negative logits', () => {
            const logits = [-1.0, -2.0, 3.0];
            const result = inference._applyRepetitionPenalty(logits, [0, 1], 1.5);
            
            expect(result[0]).toBeLessThan(logits[0]); // more negative
            expect(result[1]).toBeLessThan(logits[1]); // more negative
        });
    });

    describe('_argmax', () => {
        test('should return index of maximum value', () => {
            expect(inference._argmax([1, 5, 3, 2])).toBe(1);
            expect(inference._argmax([10, 5, 3, 2])).toBe(0);
            expect(inference._argmax([1, 5, 3, 20])).toBe(3);
        });

        test('should handle negative values', () => {
            expect(inference._argmax([-1, -5, -3, -2])).toBe(0);
        });

        test('should handle single element', () => {
            expect(inference._argmax([42])).toBe(0);
        });
    });

    describe('_sampleWithTemperature', () => {
        test('should return valid index', () => {
            const logits = [1.0, 2.0, 3.0, 4.0, 5.0];
            const result = inference._sampleWithTemperature(logits, 1.0, 5, 1.0);
            
            expect(result).toBeGreaterThanOrEqual(0);
            expect(result).toBeLessThan(logits.length);
        });

        test('should respect topK filtering', () => {
            const logits = [1.0, 2.0, 3.0, 4.0, 5.0];
            // With topK=2, should only sample from indices 3 and 4 (highest values)
            const results = new Set();
            for (let i = 0; i < 100; i++) {
                results.add(inference._sampleWithTemperature(logits, 1.0, 2, 1.0));
            }
            
            // Should only contain indices 3 and 4
            expect(results.has(0)).toBe(false);
            expect(results.has(1)).toBe(false);
            expect(results.has(2)).toBe(false);
        });

        test('should handle low temperature (more deterministic)', () => {
            const logits = [1.0, 2.0, 3.0, 4.0, 10.0]; // 10.0 is much higher
            const results = [];
            for (let i = 0; i < 50; i++) {
                results.push(inference._sampleWithTemperature(logits, 0.1, 50, 1.0));
            }
            
            // With low temperature, should mostly pick index 4
            const count4 = results.filter(r => r === 4).length;
            expect(count4).toBeGreaterThan(40); // At least 80% should be index 4
        });
    });
});
