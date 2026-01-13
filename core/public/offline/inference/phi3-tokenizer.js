/**
 * Phi-3 Tokenizer
 * Handles text tokenization and decoding for Phi-3 models using SentencePiece/BPE
 * 
 * This tokenizer is designed to work with Phi-3 models in the browser using
 * the tokenizer.json file from HuggingFace.
 */

class Phi3Tokenizer {
    constructor() {
        this.vocab = null;
        this.merges = null;
        this.encoder = null;
        this.decoder = null;
        this.specialTokens = {
            '<s>': 1,           // BOS (beginning of sequence)
            '</s>': 2,          // EOS (end of sequence)
            '<unk>': 0,         // Unknown token
            '<|user|>': 32010,  // User turn marker
            '<|assistant|>': 32001, // Assistant turn marker
            '<|end|>': 32007,   // End of turn marker
            '<|system|>': 32006 // System prompt marker
        };
        this.eosTokenId = 2;
        this.bosTokenId = 1;
        this.padTokenId = 0;
        this.isLoaded = false;
    }

    /**
     * Load tokenizer from JSON file
     * @param {string} tokenizerPath - Path to tokenizer.json file
     */
    async load(tokenizerPath) {
        try {
            const response = await fetch(tokenizerPath);
            if (!response.ok) {
                throw new Error(`Failed to load tokenizer: ${response.status}`);
            }
            
            const tokenizerData = await response.json();
            
            // Extract vocabulary
            if (tokenizerData.model && tokenizerData.model.vocab) {
                this.vocab = tokenizerData.model.vocab;
            } else if (tokenizerData.vocab) {
                this.vocab = tokenizerData.vocab;
            } else {
                throw new Error('Tokenizer vocab not found in expected location');
            }
            
            // Build encoder (token -> id) and decoder (id -> token)
            this.encoder = new Map();
            this.decoder = new Map();
            
            if (Array.isArray(this.vocab)) {
                // Array format: [[token, score], ...]
                this.vocab.forEach((item, index) => {
                    const token = Array.isArray(item) ? item[0] : item;
                    this.encoder.set(token, index);
                    this.decoder.set(index, token);
                });
            } else {
                // Object format: {token: id, ...}
                for (const [token, id] of Object.entries(this.vocab)) {
                    this.encoder.set(token, id);
                    this.decoder.set(id, token);
                }
            }
            
            // Extract merges for BPE
            if (tokenizerData.model && tokenizerData.model.merges) {
                this.merges = new Map();
                tokenizerData.model.merges.forEach((merge, index) => {
                    this.merges.set(merge, index);
                });
            }
            
            // Extract special tokens if present
            if (tokenizerData.added_tokens) {
                tokenizerData.added_tokens.forEach(token => {
                    if (token.special) {
                        this.specialTokens[token.content] = token.id;
                        this.encoder.set(token.content, token.id);
                        this.decoder.set(token.id, token.content);
                    }
                });
            }
            
            this.isLoaded = true;
            console.log(`[Phi3Tokenizer] Loaded ${this.encoder.size} tokens`);
            
        } catch (error) {
            console.error('[Phi3Tokenizer] Failed to load tokenizer:', error);
            throw error;
        }
    }

    /**
     * Encode text to token IDs
     * @param {string} text - Input text to tokenize
     * @param {Object} options - Encoding options
     * @returns {number[]} Array of token IDs
     */
    encode(text, options = {}) {
        if (!this.isLoaded) {
            throw new Error('Tokenizer not loaded. Call load() first.');
        }

        const {
            addSpecialTokens = true,
            maxLength = null,
            truncation = true
        } = options;

        // Normalize text
        let normalizedText = this._normalizeText(text);
        
        // Tokenize using BPE
        let tokens = this._bpeTokenize(normalizedText);
        
        // Convert tokens to IDs
        let tokenIds = tokens.map(token => {
            if (this.encoder.has(token)) {
                return this.encoder.get(token);
            }
            // Handle unknown tokens
            return this.specialTokens['<unk>'];
        });

        // Add special tokens if requested
        if (addSpecialTokens) {
            tokenIds = [this.bosTokenId, ...tokenIds];
        }

        // Truncate if needed
        if (maxLength && truncation && tokenIds.length > maxLength) {
            tokenIds = tokenIds.slice(0, maxLength);
        }

        return tokenIds;
    }

    /**
     * Decode token IDs back to text
     * @param {number[]} tokenIds - Array of token IDs
     * @param {Object} options - Decoding options
     * @returns {string} Decoded text
     */
    decode(tokenIds, options = {}) {
        if (!this.isLoaded) {
            throw new Error('Tokenizer not loaded. Call load() first.');
        }

        const {
            skipSpecialTokens = true,
            cleanUpTokenizationSpaces = true
        } = options;

        const specialTokenIds = new Set(Object.values(this.specialTokens));
        
        let tokens = tokenIds.map(id => {
            // Skip special tokens if requested
            if (skipSpecialTokens && specialTokenIds.has(id)) {
                return '';
            }
            
            if (this.decoder.has(id)) {
                return this.decoder.get(id);
            }
            return '';
        });

        // Join tokens and clean up
        let text = tokens.join('');
        
        // Handle SentencePiece underscore convention (▁ represents space)
        text = text.replace(/▁/g, ' ');
        
        // Clean up tokenization artifacts
        if (cleanUpTokenizationSpaces) {
            text = text.replace(/\s+/g, ' ').trim();
        }

        return text;
    }

    /**
     * Format a chat conversation for Phi-3
     * @param {Array} messages - Array of {role, content} messages
     * @returns {string} Formatted prompt
     */
    formatChat(messages) {
        let prompt = '';
        
        for (const message of messages) {
            const role = message.role.toLowerCase();
            const content = message.content;
            
            if (role === 'system') {
                prompt += `<|system|>\n${content}<|end|>\n`;
            } else if (role === 'user') {
                prompt += `<|user|>\n${content}<|end|>\n`;
            } else if (role === 'assistant') {
                prompt += `<|assistant|>\n${content}<|end|>\n`;
            }
        }
        
        // Add assistant turn marker for generation
        prompt += '<|assistant|>\n';
        
        return prompt;
    }

    /**
     * Encode a chat conversation
     * @param {Array} messages - Array of {role, content} messages
     * @param {Object} options - Encoding options
     * @returns {number[]} Token IDs
     */
    encodeChat(messages, options = {}) {
        const formattedPrompt = this.formatChat(messages);
        return this.encode(formattedPrompt, options);
    }

    /**
     * Get vocabulary size
     * @returns {number} Number of tokens in vocabulary
     */
    getVocabSize() {
        return this.encoder ? this.encoder.size : 0;
    }

    /**
     * Check if a token ID is a special token
     * @param {number} tokenId - Token ID to check
     * @returns {boolean} True if special token
     */
    isSpecialToken(tokenId) {
        return Object.values(this.specialTokens).includes(tokenId);
    }

    /**
     * Get the EOS token ID
     * @returns {number} EOS token ID
     */
    getEosTokenId() {
        return this.eosTokenId;
    }

    /**
     * Normalize text before tokenization
     * @private
     */
    _normalizeText(text) {
        // Unicode normalization (NFC)
        text = text.normalize('NFC');
        
        // Replace multiple spaces with single space
        text = text.replace(/\s+/g, ' ');
        
        return text;
    }

    /**
     * BPE tokenization
     * @private
     */
    _bpeTokenize(text) {
        if (!this.merges || this.merges.size === 0) {
            // Fallback to character-level tokenization if no merges
            return this._characterTokenize(text);
        }

        // Split text into words (preserving spaces as special tokens)
        const words = text.split(/(\s+)/);
        const allTokens = [];

        for (const word of words) {
            if (word.match(/^\s+$/)) {
                // Handle whitespace
                allTokens.push('▁');
                continue;
            }

            // Add space prefix for non-first words
            const wordWithPrefix = allTokens.length > 0 ? '▁' + word : word;
            
            // Convert word to characters
            let tokens = wordWithPrefix.split('');
            
            // Apply BPE merges
            tokens = this._applyBpeMerges(tokens);
            
            allTokens.push(...tokens);
        }

        return allTokens;
    }

    /**
     * Apply BPE merges to token list
     * @private
     */
    _applyBpeMerges(tokens) {
        if (tokens.length < 2) return tokens;

        while (true) {
            // Find the best merge
            let bestMerge = null;
            let bestMergeIndex = -1;
            let bestMergeRank = Infinity;

            for (let i = 0; i < tokens.length - 1; i++) {
                const pair = tokens[i] + ' ' + tokens[i + 1];
                if (this.merges.has(pair)) {
                    const rank = this.merges.get(pair);
                    if (rank < bestMergeRank) {
                        bestMerge = pair;
                        bestMergeIndex = i;
                        bestMergeRank = rank;
                    }
                }
            }

            // No more merges possible
            if (bestMerge === null) break;

            // Apply the merge
            const merged = tokens[bestMergeIndex] + tokens[bestMergeIndex + 1];
            tokens = [
                ...tokens.slice(0, bestMergeIndex),
                merged,
                ...tokens.slice(bestMergeIndex + 2)
            ];
        }

        return tokens;
    }

    /**
     * Character-level tokenization fallback
     * @private
     */
    _characterTokenize(text) {
        const tokens = [];
        const chars = [...text]; // Handle Unicode properly
        
        for (let i = 0; i < chars.length; i++) {
            const char = chars[i];
            
            if (char === ' ') {
                tokens.push('▁');
            } else if (this.encoder.has(char)) {
                tokens.push(char);
            } else if (this.encoder.has('▁' + char)) {
                tokens.push('▁' + char);
            } else {
                // Try to find the token in vocab
                let found = false;
                for (const [token] of this.encoder) {
                    if (token.includes(char)) {
                        tokens.push(token);
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    tokens.push('<unk>');
                }
            }
        }
        
        return tokens;
    }
}

// Export for both browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Phi3Tokenizer };
}
if (typeof window !== 'undefined') {
    window.Phi3Tokenizer = Phi3Tokenizer;
}
