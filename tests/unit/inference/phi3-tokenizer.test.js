/**
 * Unit tests for Phi3Tokenizer
 */

const { Phi3Tokenizer } = require('../../../core/public/offline/inference/phi3-tokenizer');

describe('Phi3Tokenizer', () => {
    let tokenizer;

    beforeEach(() => {
        tokenizer = new Phi3Tokenizer();
    });

    describe('constructor', () => {
        test('should initialize with default values', () => {
            expect(tokenizer.vocab).toBeNull();
            expect(tokenizer.encoder).toBeNull();
            expect(tokenizer.decoder).toBeNull();
            expect(tokenizer.isLoaded).toBe(false);
        });

        test('should have correct special tokens', () => {
            expect(tokenizer.specialTokens['<s>']).toBe(1);
            expect(tokenizer.specialTokens['</s>']).toBe(2);
            expect(tokenizer.specialTokens['<unk>']).toBe(0);
            expect(tokenizer.specialTokens['<|user|>']).toBe(32010);
            expect(tokenizer.specialTokens['<|assistant|>']).toBe(32001);
        });

        test('should have correct EOS and BOS token IDs', () => {
            expect(tokenizer.eosTokenId).toBe(2);
            expect(tokenizer.bosTokenId).toBe(1);
            expect(tokenizer.padTokenId).toBe(0);
        });
    });

    describe('encode', () => {
        beforeEach(() => {
            // Mock a loaded tokenizer
            tokenizer.isLoaded = true;
            tokenizer.encoder = new Map([
                ['hello', 100],
                ['world', 101],
                ['▁', 200],
                ['▁hello', 300],
                ['▁world', 301],
                ['<s>', 1],
                ['</s>', 2],
                ['<unk>', 0]
            ]);
            tokenizer.decoder = new Map([
                [100, 'hello'],
                [101, 'world'],
                [200, '▁'],
                [300, '▁hello'],
                [301, '▁world'],
                [1, '<s>'],
                [2, '</s>'],
                [0, '<unk>']
            ]);
        });

        test('should throw if not loaded', () => {
            const unloadedTokenizer = new Phi3Tokenizer();
            expect(() => unloadedTokenizer.encode('test')).toThrow('Tokenizer not loaded');
        });

        test('should add BOS token by default', () => {
            const tokens = tokenizer.encode('hello');
            expect(tokens[0]).toBe(1); // BOS token
        });

        test('should not add BOS token when disabled', () => {
            const tokens = tokenizer.encode('hello', { addSpecialTokens: false });
            expect(tokens[0]).not.toBe(1);
        });

        test('should truncate when exceeding maxLength', () => {
            const tokens = tokenizer.encode('hello world', { maxLength: 3, truncation: true });
            expect(tokens.length).toBeLessThanOrEqual(3);
        });
    });

    describe('decode', () => {
        beforeEach(() => {
            tokenizer.isLoaded = true;
            tokenizer.decoder = new Map([
                [100, 'hello'],
                [101, '▁world'],
                [1, '<s>'],
                [2, '</s>'],
                [0, '<unk>']
            ]);
        });

        test('should throw if not loaded', () => {
            const unloadedTokenizer = new Phi3Tokenizer();
            expect(() => unloadedTokenizer.decode([100])).toThrow('Tokenizer not loaded');
        });

        test('should decode token IDs to text', () => {
            const text = tokenizer.decode([100, 101]);
            expect(text).toContain('hello');
            expect(text).toContain('world');
        });

        test('should skip special tokens by default', () => {
            const text = tokenizer.decode([1, 100, 2]);
            expect(text).not.toContain('<s>');
            expect(text).not.toContain('</s>');
        });

        test('should include special tokens when requested', () => {
            const text = tokenizer.decode([1, 100, 2], { skipSpecialTokens: false });
            expect(text).toContain('<s>');
        });

        test('should replace SentencePiece underscore with space', () => {
            const text = tokenizer.decode([100, 101]);
            expect(text).toContain(' ');
        });
    });

    describe('formatChat', () => {
        test('should format user message correctly', () => {
            const messages = [{ role: 'user', content: 'Hello' }];
            const formatted = tokenizer.formatChat(messages);
            expect(formatted).toContain('<|user|>');
            expect(formatted).toContain('Hello');
            expect(formatted).toContain('<|end|>');
            expect(formatted).toContain('<|assistant|>');
        });

        test('should format system message correctly', () => {
            const messages = [{ role: 'system', content: 'You are helpful' }];
            const formatted = tokenizer.formatChat(messages);
            expect(formatted).toContain('<|system|>');
            expect(formatted).toContain('You are helpful');
        });

        test('should format multi-turn conversation', () => {
            const messages = [
                { role: 'system', content: 'Be helpful' },
                { role: 'user', content: 'Hi' },
                { role: 'assistant', content: 'Hello!' },
                { role: 'user', content: 'How are you?' }
            ];
            const formatted = tokenizer.formatChat(messages);
            expect(formatted).toContain('<|system|>');
            expect(formatted).toContain('<|user|>');
            expect(formatted).toContain('<|assistant|>');
            expect(formatted.split('<|user|>').length).toBe(3); // 2 user messages + 1 at end
        });

        test('should end with assistant turn marker', () => {
            const messages = [{ role: 'user', content: 'Test' }];
            const formatted = tokenizer.formatChat(messages);
            expect(formatted.endsWith('<|assistant|>\n')).toBe(true);
        });
    });

    describe('getVocabSize', () => {
        test('should return 0 when not loaded', () => {
            expect(tokenizer.getVocabSize()).toBe(0);
        });

        test('should return correct size when loaded', () => {
            tokenizer.encoder = new Map([['a', 0], ['b', 1], ['c', 2]]);
            expect(tokenizer.getVocabSize()).toBe(3);
        });
    });

    describe('isSpecialToken', () => {
        test('should identify special tokens', () => {
            expect(tokenizer.isSpecialToken(1)).toBe(true); // BOS
            expect(tokenizer.isSpecialToken(2)).toBe(true); // EOS
            expect(tokenizer.isSpecialToken(0)).toBe(true); // UNK
        });

        test('should return false for regular tokens', () => {
            expect(tokenizer.isSpecialToken(100)).toBe(false);
            expect(tokenizer.isSpecialToken(5000)).toBe(false);
        });
    });

    describe('_normalizeText', () => {
        test('should normalize unicode', () => {
            const text = tokenizer._normalizeText('café');
            expect(text).toBe('café');
        });

        test('should collapse multiple spaces', () => {
            const text = tokenizer._normalizeText('hello    world');
            expect(text).toBe('hello world');
        });
    });
});
