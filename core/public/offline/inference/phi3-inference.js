/**
 * Phi-3 Inference Engine
 * Handles text generation with Phi-3 models using ONNX Runtime Web
 * 
 * Supports streaming generation, various sampling strategies, and chat formatting
 */

class Phi3Inference {
    constructor() {
        this.tokenizer = null;
        this.sessionManager = null;
        this.isInitialized = false;
        this.maxContextLength = 4096;
        this.generationConfig = {
            maxNewTokens: 512,
            temperature: 0.7,
            topK: 50,
            topP: 0.9,
            repetitionPenalty: 1.1,
            doSample: true
        };
        
        // Generation state
        this.isGenerating = false;
        this.shouldStop = false;
    }

    /**
     * Initialize the inference engine
     * @param {Object} options - Initialization options
     */
    async initialize(options = {}) {
        const {
            tokenizerPath,
            modelPath,
            onProgress = null,
            executionProvider = 'auto'
        } = options;

        try {
            // Initialize tokenizer
            if (!this.tokenizer) {
                if (typeof Phi3Tokenizer === 'undefined') {
                    throw new Error('Phi3Tokenizer not loaded. Include phi3-tokenizer.js first.');
                }
                this.tokenizer = new Phi3Tokenizer();
            }
            
            if (tokenizerPath) {
                await this.tokenizer.load(tokenizerPath);
                console.log('[Phi3Inference] Tokenizer loaded');
            }

            // Initialize ONNX session manager
            if (!this.sessionManager) {
                if (typeof ONNXSessionManager === 'undefined') {
                    throw new Error('ONNXSessionManager not loaded. Include onnx-session-manager.js first.');
                }
                this.sessionManager = new ONNXSessionManager();
            }
            
            if (modelPath) {
                await this.sessionManager.loadModel(modelPath, {
                    executionProvider,
                    onProgress
                });
                console.log('[Phi3Inference] Model loaded');
            }

            this.isInitialized = this.tokenizer.isLoaded && this.sessionManager.isReady();
            
            if (this.isInitialized) {
                console.log('[Phi3Inference] Initialization complete');
            }

        } catch (error) {
            console.error('[Phi3Inference] Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Set generation configuration
     * @param {Object} config - Generation parameters
     */
    setGenerationConfig(config) {
        this.generationConfig = {
            ...this.generationConfig,
            ...config
        };
    }

    /**
     * Generate text from a prompt
     * @param {string} prompt - Input prompt
     * @param {Object} options - Generation options
     * @returns {Promise<string>} Generated text
     */
    async generate(prompt, options = {}) {
        if (!this.isInitialized) {
            throw new Error('Inference engine not initialized. Call initialize() first.');
        }

        const config = { ...this.generationConfig, ...options };
        const {
            maxNewTokens,
            temperature,
            topK,
            topP,
            repetitionPenalty,
            doSample,
            stopTokens = [],
            onToken = null
        } = config;

        this.isGenerating = true;
        this.shouldStop = false;

        try {
            // Encode the prompt
            const inputIds = this.tokenizer.encode(prompt, { addSpecialTokens: true });
            
            // Check context length
            if (inputIds.length >= this.maxContextLength) {
                throw new Error(`Prompt too long: ${inputIds.length} tokens (max: ${this.maxContextLength})`);
            }

            const generatedTokens = [];
            let currentIds = [...inputIds];
            const eosTokenId = this.tokenizer.getEosTokenId();
            
            // Add stop tokens
            const allStopTokens = new Set([eosTokenId, ...stopTokens]);

            for (let i = 0; i < maxNewTokens; i++) {
                if (this.shouldStop) {
                    console.log('[Phi3Inference] Generation stopped by user');
                    break;
                }

                // Prepare input tensor
                const inputTensor = this._createInputTensor(currentIds);
                const attentionMask = this._createAttentionMask(currentIds.length);

                // Run inference
                const outputs = await this.sessionManager.runInference({
                    input_ids: inputTensor,
                    attention_mask: attentionMask
                });

                // Get logits for the last token
                const logits = this._extractLastTokenLogits(outputs);

                // Apply repetition penalty
                const penalizedLogits = this._applyRepetitionPenalty(
                    logits, 
                    currentIds, 
                    repetitionPenalty
                );

                // Sample next token
                let nextTokenId;
                if (doSample && temperature > 0) {
                    nextTokenId = this._sampleWithTemperature(
                        penalizedLogits, 
                        temperature, 
                        topK, 
                        topP
                    );
                } else {
                    nextTokenId = this._argmax(penalizedLogits);
                }

                // Check for stop tokens
                if (allStopTokens.has(nextTokenId)) {
                    break;
                }

                // Add token to sequence
                generatedTokens.push(nextTokenId);
                currentIds.push(nextTokenId);

                // Callback for streaming
                if (onToken) {
                    const tokenText = this.tokenizer.decode([nextTokenId], { skipSpecialTokens: true });
                    onToken(tokenText, nextTokenId);
                }

                // Truncate if exceeding context length
                if (currentIds.length >= this.maxContextLength) {
                    console.warn('[Phi3Inference] Reached max context length');
                    break;
                }
            }

            // Decode generated tokens
            const generatedText = this.tokenizer.decode(generatedTokens, { skipSpecialTokens: true });
            
            return generatedText;

        } finally {
            this.isGenerating = false;
        }
    }

    /**
     * Generate a chat response
     * @param {Array} messages - Array of {role, content} messages
     * @param {Object} options - Generation options
     * @returns {Promise<string>} Assistant response
     */
    async chat(messages, options = {}) {
        if (!this.isInitialized) {
            throw new Error('Inference engine not initialized. Call initialize() first.');
        }

        // Format messages for Phi-3
        const prompt = this.tokenizer.formatChat(messages);
        
        // Generate response
        const response = await this.generate(prompt, {
            ...options,
            stopTokens: [
                this.tokenizer.specialTokens['<|end|>'],
                this.tokenizer.specialTokens['<|user|>']
            ]
        });

        return response.trim();
    }

    /**
     * Stream chat response with callbacks
     * @param {Array} messages - Chat messages
     * @param {Function} onToken - Callback for each token
     * @param {Object} options - Generation options
     * @returns {Promise<string>} Complete response
     */
    async streamChat(messages, onToken, options = {}) {
        return this.chat(messages, {
            ...options,
            onToken
        });
    }

    /**
     * Stop ongoing generation
     */
    stop() {
        this.shouldStop = true;
    }

    /**
     * Check if currently generating
     * @returns {boolean} True if generating
     */
    isCurrentlyGenerating() {
        return this.isGenerating;
    }

    /**
     * Check if ready for inference
     * @returns {boolean} True if initialized
     */
    isReady() {
        return this.isInitialized;
    }

    /**
     * Get inference statistics
     * @returns {Object} Stats from session manager
     */
    getStats() {
        if (!this.sessionManager) return null;
        return this.sessionManager.getStats();
    }

    /**
     * Release resources
     */
    async release() {
        if (this.sessionManager) {
            await this.sessionManager.release();
        }
        this.isInitialized = false;
    }

    // ==================== Private Methods ====================

    /**
     * Create input tensor from token IDs
     * @private
     */
    _createInputTensor(tokenIds) {
        return {
            type: 'int64',
            data: BigInt64Array.from(tokenIds.map(id => BigInt(id))),
            dims: [1, tokenIds.length]
        };
    }

    /**
     * Create attention mask tensor
     * @private
     */
    _createAttentionMask(length) {
        return {
            type: 'int64',
            data: BigInt64Array.from(Array(length).fill(1n)),
            dims: [1, length]
        };
    }

    /**
     * Extract logits for the last token from model output
     * @private
     */
    _extractLastTokenLogits(outputs) {
        // Get the logits output (usually named 'logits')
        const logitsOutput = outputs.logits || outputs[Object.keys(outputs)[0]];
        const logitsData = logitsOutput.data;
        const dims = logitsOutput.dims;
        
        // Logits shape is typically [batch, seq_len, vocab_size]
        const vocabSize = dims[dims.length - 1];
        const seqLen = dims[dims.length - 2];
        
        // Extract last token's logits
        const startIdx = (seqLen - 1) * vocabSize;
        return Array.from(logitsData.slice(startIdx, startIdx + vocabSize));
    }

    /**
     * Apply repetition penalty to logits
     * @private
     */
    _applyRepetitionPenalty(logits, previousTokens, penalty) {
        if (penalty === 1.0) return logits;
        
        const penalizedLogits = [...logits];
        const seenTokens = new Set(previousTokens);
        
        for (const tokenId of seenTokens) {
            if (tokenId >= 0 && tokenId < penalizedLogits.length) {
                if (penalizedLogits[tokenId] > 0) {
                    penalizedLogits[tokenId] /= penalty;
                } else {
                    penalizedLogits[tokenId] *= penalty;
                }
            }
        }
        
        return penalizedLogits;
    }

    /**
     * Sample token with temperature, top-k, and top-p
     * @private
     */
    _sampleWithTemperature(logits, temperature, topK, topP) {
        // Apply temperature
        const scaledLogits = logits.map(l => l / temperature);
        
        // Convert to probabilities
        const maxLogit = Math.max(...scaledLogits);
        const expLogits = scaledLogits.map(l => Math.exp(l - maxLogit));
        const sumExp = expLogits.reduce((a, b) => a + b, 0);
        let probs = expLogits.map(e => e / sumExp);
        
        // Create sorted indices
        const indices = probs.map((p, i) => ({ prob: p, index: i }));
        indices.sort((a, b) => b.prob - a.prob);
        
        // Apply top-k filtering
        if (topK > 0 && topK < indices.length) {
            indices.length = topK;
        }
        
        // Apply top-p (nucleus) filtering
        if (topP < 1.0) {
            let cumSum = 0;
            let cutoffIdx = indices.length;
            
            for (let i = 0; i < indices.length; i++) {
                cumSum += indices[i].prob;
                if (cumSum >= topP) {
                    cutoffIdx = i + 1;
                    break;
                }
            }
            
            indices.length = cutoffIdx;
        }
        
        // Renormalize probabilities
        const totalProb = indices.reduce((sum, item) => sum + item.prob, 0);
        indices.forEach(item => item.prob /= totalProb);
        
        // Sample from filtered distribution
        const rand = Math.random();
        let cumProb = 0;
        
        for (const item of indices) {
            cumProb += item.prob;
            if (rand < cumProb) {
                return item.index;
            }
        }
        
        // Fallback to highest probability
        return indices[0].index;
    }

    /**
     * Get index of maximum value (greedy decoding)
     * @private
     */
    _argmax(array) {
        let maxIdx = 0;
        let maxVal = array[0];
        
        for (let i = 1; i < array.length; i++) {
            if (array[i] > maxVal) {
                maxVal = array[i];
                maxIdx = i;
            }
        }
        
        return maxIdx;
    }
}

// Export for both browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Phi3Inference };
}
if (typeof window !== 'undefined') {
    window.Phi3Inference = Phi3Inference;
}
