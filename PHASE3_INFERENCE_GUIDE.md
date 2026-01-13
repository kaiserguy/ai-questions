# Phase 3: Inference Pipeline Implementation Guide

This document provides complete code structures for implementing the Phi-3 inference pipeline (Issue #157).

## Overview

Phase 3 integrates the Phi-3 ONNX model with ONNX Runtime Web to enable real AI inference in the browser.

## Architecture

```
User Input → Tokenizer → Input Tensors → ONNX Session → Output Tensors → Detokenizer → Response
```

## 1. Tokenizer Integration

### File: `core/public/offline/tokenizer/phi3-tokenizer.js`

```javascript
/**
 * Phi-3 Tokenizer
 * Handles text tokenization and detokenization for Phi-3 model
 */
class Phi3Tokenizer {
    constructor() {
        this.vocabulary = null;
        this.specialTokens = {
            bos: '<|begin_of_text|>',
            eos: '<|end_of_text|>',
            pad: '<|pad|>',
            unk: '<|unk|>'
        };
        this.maxLength = 4096; // Phi-3 context length
    }
    
    /**
     * Load tokenizer from model files
     * @param {Object} tokenizerConfig - tokenizer_config.json
     * @param {Object} tokenizerData - tokenizer.json
     */
    async load(tokenizerConfig, tokenizerData) {
        if (!tokenizerConfig || !tokenizerData) {
            throw new Error('Tokenizer config and data required');
        }
        
        this.vocabulary = tokenizerData.model.vocab;
        this.config = tokenizerConfig;
        
        console.log(`[Phi3Tokenizer] Loaded vocabulary with ${Object.keys(this.vocabulary).length} tokens`);
    }
    
    /**
     * Encode text to token IDs
     * @param {string} text - Input text
     * @param {Object} options - Encoding options
     * @returns {number[]} Token IDs
     */
    encode(text, options = {}) {
        if (!this.vocabulary) {
            throw new Error('Tokenizer not loaded');
        }
        
        const {
            addSpecialTokens = true,
            maxLength = this.maxLength,
            truncation = true
        } = options;
        
        // Simple word-based tokenization (real implementation would use BPE)
        const words = text.toLowerCase().split(/\s+/);
        let tokens = [];
        
        if (addSpecialTokens) {
            tokens.push(this._getTokenId(this.specialTokens.bos));
        }
        
        for (const word of words) {
            const tokenId = this._getTokenId(word);
            tokens.push(tokenId);
        }
        
        if (addSpecialTokens) {
            tokens.push(this._getTokenId(this.specialTokens.eos));
        }
        
        // Truncate if needed
        if (truncation && tokens.length > maxLength) {
            tokens = tokens.slice(0, maxLength);
        }
        
        return tokens;
    }
    
    /**
     * Decode token IDs to text
     * @param {number[]} tokenIds - Token IDs
     * @param {Object} options - Decoding options
     * @returns {string} Decoded text
     */
    decode(tokenIds, options = {}) {
        if (!this.vocabulary) {
            throw new Error('Tokenizer not loaded');
        }
        
        const { skipSpecialTokens = true } = options;
        
        const reverseVocab = this._getReverseVocabulary();
        const tokens = [];
        
        for (const tokenId of tokenIds) {
            const token = reverseVocab[tokenId];
            if (token) {
                if (skipSpecialTokens && this._isSpecialToken(token)) {
                    continue;
                }
                tokens.push(token);
            }
        }
        
        return tokens.join(' ');
    }
    
    /**
     * Get token ID for a word
     * @private
     */
    _getTokenId(word) {
        return this.vocabulary[word] || this.vocabulary[this.specialTokens.unk];
    }
    
    /**
     * Get reverse vocabulary (ID -> token)
     * @private
     */
    _getReverseVocabulary() {
        if (!this._reverseVocab) {
            this._reverseVocab = {};
            for (const [token, id] of Object.entries(this.vocabulary)) {
                this._reverseVocab[id] = token;
            }
        }
        return this._reverseVocab;
    }
    
    /**
     * Check if token is a special token
     * @private
     */
    _isSpecialToken(token) {
        return Object.values(this.specialTokens).includes(token);
    }
}

// Export to window
if (typeof window !== 'undefined') {
    window.Phi3Tokenizer = Phi3Tokenizer;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Phi3Tokenizer };
}
```

## 2. ONNX Session Manager

### File: `core/public/offline/inference/onnx-session-manager.js`

```javascript
/**
 * ONNX Session Manager
 * Manages ONNX Runtime Web session for Phi-3 model
 */
class ONNXSessionManager {
    constructor() {
        this.session = null;
        this.modelLoaded = false;
    }
    
    /**
     * Initialize ONNX Runtime and create session
     * @param {Blob} modelBlob - ONNX model file
     * @param {Object} options - Session options
     */
    async initialize(modelBlob, options = {}) {
        if (!window.ort) {
            throw new Error('ONNX Runtime Web not loaded');
        }
        
        console.log('[ONNXSessionManager] Initializing ONNX Runtime Web...');
        
        // Check WebGPU availability
        const hasWebGPU = await this._checkWebGPU();
        
        // Configure execution providers
        const executionProviders = hasWebGPU 
            ? ['webgpu', 'wasm']
            : ['wasm'];
        
        console.log(`[ONNXSessionManager] Using execution providers: ${executionProviders.join(', ')}`);
        
        // Convert Blob to ArrayBuffer
        const modelBuffer = await modelBlob.arrayBuffer();
        
        // Create session
        try {
            this.session = await ort.InferenceSession.create(modelBuffer, {
                executionProviders,
                graphOptimizationLevel: 'all',
                ...options
            });
            
            this.modelLoaded = true;
            console.log('[ONNXSessionManager] Session created successfully');
            console.log('[ONNXSessionManager] Input names:', this.session.inputNames);
            console.log('[ONNXSessionManager] Output names:', this.session.outputNames);
            
        } catch (error) {
            console.error('[ONNXSessionManager] Failed to create session:', error);
            throw new Error(`Failed to create ONNX session: ${error.message}`);
        }
    }
    
    /**
     * Run inference
     * @param {Object} inputs - Input tensors
     * @returns {Object} Output tensors
     */
    async run(inputs) {
        if (!this.session) {
            throw new Error('Session not initialized');
        }
        
        try {
            const results = await this.session.run(inputs);
            return results;
        } catch (error) {
            console.error('[ONNXSessionManager] Inference failed:', error);
            throw new Error(`Inference failed: ${error.message}`);
        }
    }
    
    /**
     * Check WebGPU availability
     * @private
     */
    async _checkWebGPU() {
        if (!navigator.gpu) {
            console.warn('[ONNXSessionManager] WebGPU not available');
            return false;
        }
        
        try {
            const adapter = await navigator.gpu.requestAdapter();
            if (!adapter) {
                console.warn('[ONNXSessionManager] WebGPU adapter not available');
                return false;
            }
            
            console.log('[ONNXSessionManager] WebGPU available');
            return true;
        } catch (error) {
            console.warn('[ONNXSessionManager] WebGPU check failed:', error);
            return false;
        }
    }
    
    /**
     * Release session resources
     */
    async dispose() {
        if (this.session) {
            await this.session.release();
            this.session = null;
            this.modelLoaded = false;
            console.log('[ONNXSessionManager] Session disposed');
        }
    }
}

// Export to window
if (typeof window !== 'undefined') {
    window.ONNXSessionManager = ONNXSessionManager;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ONNXSessionManager };
}
```

## 3. Inference Pipeline

### File: `core/public/offline/inference/phi3-inference.js`

```javascript
/**
 * Phi-3 Inference Pipeline
 * Complete pipeline for text generation with Phi-3 model
 */
class Phi3Inference {
    constructor(tokenizer, sessionManager) {
        this.tokenizer = tokenizer;
        this.sessionManager = sessionManager;
        this.generationConfig = {
            maxNewTokens: 512,
            temperature: 0.7,
            topK: 50,
            topP: 0.9,
            repetitionPenalty: 1.1
        };
    }
    
    /**
     * Generate text from prompt
     * @param {string} prompt - Input prompt
     * @param {Object} options - Generation options
     * @returns {string} Generated text
     */
    async generate(prompt, options = {}) {
        const config = { ...this.generationConfig, ...options };
        
        console.log('[Phi3Inference] Generating response for prompt:', prompt.substring(0, 50) + '...');
        
        // Encode prompt
        const inputIds = this.tokenizer.encode(prompt);
        console.log(`[Phi3Inference] Encoded to ${inputIds.length} tokens`);
        
        // Prepare input tensor
        const inputTensor = new ort.Tensor('int64', BigInt64Array.from(inputIds.map(id => BigInt(id))), [1, inputIds.length]);
        
        // Generate tokens
        const outputIds = await this._generateTokens(inputTensor, config);
        
        // Decode output
        const generatedText = this.tokenizer.decode(outputIds);
        console.log('[Phi3Inference] Generation complete');
        
        return generatedText;
    }
    
    /**
     * Generate tokens autoregressively
     * @private
     */
    async _generateTokens(inputTensor, config) {
        const { maxNewTokens, temperature, topK, topP } = config;
        
        let currentIds = Array.from(inputTensor.data).map(id => Number(id));
        const generatedIds = [];
        
        for (let i = 0; i < maxNewTokens; i++) {
            // Prepare input
            const inputTensorCurrent = new ort.Tensor(
                'int64',
                BigInt64Array.from(currentIds.map(id => BigInt(id))),
                [1, currentIds.length]
            );
            
            // Run inference
            const outputs = await this.sessionManager.run({
                input_ids: inputTensorCurrent
            });
            
            // Get logits for next token
            const logits = outputs.logits.data;
            const vocabSize = outputs.logits.dims[outputs.logits.dims.length - 1];
            const lastTokenLogits = logits.slice(-vocabSize);
            
            // Sample next token
            const nextTokenId = this._sampleToken(lastTokenLogits, temperature, topK, topP);
            
            // Check for EOS token
            if (this._isEOSToken(nextTokenId)) {
                break;
            }
            
            generatedIds.push(nextTokenId);
            currentIds.push(nextTokenId);
            
            // Truncate if exceeds context length
            if (currentIds.length > this.tokenizer.maxLength) {
                currentIds = currentIds.slice(-this.tokenizer.maxLength);
            }
        }
        
        return generatedIds;
    }
    
    /**
     * Sample next token from logits
     * @private
     */
    _sampleToken(logits, temperature, topK, topP) {
        // Apply temperature
        const scaledLogits = logits.map(l => l / temperature);
        
        // Convert to probabilities
        const maxLogit = Math.max(...scaledLogits);
        const expLogits = scaledLogits.map(l => Math.exp(l - maxLogit));
        const sumExp = expLogits.reduce((a, b) => a + b, 0);
        const probs = expLogits.map(e => e / sumExp);
        
        // Apply top-k filtering
        const topKProbs = this._applyTopK(probs, topK);
        
        // Apply top-p (nucleus) filtering
        const topPProbs = this._applyTopP(topKProbs, topP);
        
        // Sample from distribution
        return this._sampleFromDistribution(topPProbs);
    }
    
    /**
     * Apply top-k filtering
     * @private
     */
    _applyTopK(probs, k) {
        const indexed = probs.map((p, i) => ({ prob: p, index: i }));
        indexed.sort((a, b) => b.prob - a.prob);
        
        const topK = indexed.slice(0, k);
        const result = new Array(probs.length).fill(0);
        
        for (const item of topK) {
            result[item.index] = item.prob;
        }
        
        // Renormalize
        const sum = result.reduce((a, b) => a + b, 0);
        return result.map(p => p / sum);
    }
    
    /**
     * Apply top-p (nucleus) filtering
     * @private
     */
    _applyTopP(probs, p) {
        const indexed = probs.map((prob, i) => ({ prob, index: i }));
        indexed.sort((a, b) => b.prob - a.prob);
        
        let cumSum = 0;
        const selected = [];
        
        for (const item of indexed) {
            cumSum += item.prob;
            selected.push(item);
            if (cumSum >= p) break;
        }
        
        const result = new Array(probs.length).fill(0);
        for (const item of selected) {
            result[item.index] = item.prob;
        }
        
        // Renormalize
        const sum = result.reduce((a, b) => a + b, 0);
        return result.map(prob => prob / sum);
    }
    
    /**
     * Sample from probability distribution
     * @private
     */
    _sampleFromDistribution(probs) {
        const rand = Math.random();
        let cumSum = 0;
        
        for (let i = 0; i < probs.length; i++) {
            cumSum += probs[i];
            if (rand < cumSum) {
                return i;
            }
        }
        
        return probs.length - 1;
    }
    
    /**
     * Check if token is EOS
     * @private
     */
    _isEOSToken(tokenId) {
        const eosId = this.tokenizer._getTokenId(this.tokenizer.specialTokens.eos);
        return tokenId === eosId;
    }
}

// Export to window
if (typeof window !== 'undefined') {
    window.Phi3Inference = Phi3Inference;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Phi3Inference };
}
```

## 4. Integration with LocalAIModel

### Modifications to `core/public/offline/local-ai-model.js`

```javascript
// Add to LocalAIModel class:

async loadModel() {
    if (this.model) {
        console.log('[LocalAIModel] Model already loaded');
        return;
    }
    
    console.log('[LocalAIModel] Loading Phi-3 model...');
    
    try {
        // Initialize storage
        const modelStorage = new ModelStorage();
        await modelStorage.initialize();
        
        // Check if model is complete
        const requiredFiles = [
            'phi3-mini-4k-instruct-web.onnx',
            'phi3-mini-4k-instruct-web.onnx_data',
            'tokenizer.json',
            'tokenizer_config.json'
        ];
        
        const isComplete = await modelStorage.isModelComplete('phi3-mini', requiredFiles);
        if (!isComplete) {
            throw new Error('Model files not complete. Please download the model first.');
        }
        
        // Load model file
        const modelBlob = await modelStorage.getModelFile('phi3-mini-4k-instruct-web.onnx');
        
        // Load tokenizer files
        const tokenizerBlob = await modelStorage.getModelFile('tokenizer.json');
        const tokenizerConfigBlob = await modelStorage.getModelFile('tokenizer_config.json');
        
        const tokenizerData = JSON.parse(await tokenizerBlob.text());
        const tokenizerConfig = JSON.parse(await tokenizerConfigBlob.text());
        
        // Initialize tokenizer
        this.tokenizer = new Phi3Tokenizer();
        await this.tokenizer.load(tokenizerConfig, tokenizerData);
        
        // Initialize ONNX session
        this.sessionManager = new ONNXSessionManager();
        await this.sessionManager.initialize(modelBlob);
        
        // Create inference pipeline
        this.inference = new Phi3Inference(this.tokenizer, this.sessionManager);
        
        this.model = {
            type: 'phi3-mini',
            loaded: true,
            timestamp: new Date().toISOString()
        };
        
        console.log('[LocalAIModel] Model loaded successfully');
        
    } catch (error) {
        console.error('[LocalAIModel] Failed to load model:', error);
        throw new Error(`Failed to load model: ${error.message}`);
    }
}

async generateResponse(prompt) {
    if (!this.model || !this.inference) {
        throw new Error('Model not loaded. Call loadModel() first.');
    }
    
    try {
        const response = await this.inference.generate(prompt, {
            maxNewTokens: 256,
            temperature: 0.7
        });
        
        return response;
        
    } catch (error) {
        console.error('[LocalAIModel] Generation failed:', error);
        throw new Error(`Failed to generate response: ${error.message}`);
    }
}
```

## 5. Testing Checklist

- [ ] Tokenizer loads vocabulary correctly
- [ ] Tokenizer encodes text to token IDs
- [ ] Tokenizer decodes token IDs to text
- [ ] ONNX session initializes with WebGPU (if available)
- [ ] ONNX session falls back to WASM if WebGPU unavailable
- [ ] Inference pipeline generates coherent text
- [ ] Temperature parameter affects randomness
- [ ] Top-k and top-p sampling work correctly
- [ ] EOS token stops generation
- [ ] Max tokens limit is respected
- [ ] Memory usage is acceptable
- [ ] Generation speed is acceptable (target: <5s for 256 tokens)

## 6. Performance Considerations

- **WebGPU**: 10-20x faster than WASM for large models
- **Context length**: Phi-3 supports 4096 tokens
- **Memory**: ~4GB for model + activations
- **Generation speed**: ~10-50 tokens/second (WebGPU), ~1-5 tokens/second (WASM)

## 7. Error Handling

- Model files missing → Clear error message
- WebGPU not available → Fallback to WASM with warning
- Out of memory → Suggest clearing cache or using smaller model
- Generation timeout → Cancel and return partial result

## 8. Next Steps (Phase 3)

1. Implement tokenizer class
2. Implement ONNX session manager
3. Implement inference pipeline
4. Integrate with LocalAIModel
5. Add Web Worker for background inference
6. Test with real Phi-3 model
7. Optimize performance
8. Add streaming generation support
