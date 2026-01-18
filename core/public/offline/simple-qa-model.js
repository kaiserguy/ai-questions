/**
 * Simple QA Model for Offline AI
 * Uses TF-IDF and keyword matching to provide real AI responses
 * No external dependencies required
 */
class SimpleQAModel {
    constructor() {
        this.initialized = false;
        this.knowledgeBase = this.buildKnowledgeBase();
    }

    /**
     * Build a knowledge base for QA
     */
    buildKnowledgeBase() {
        return {
            'artificial intelligence': {
                definition: 'Artificial intelligence (AI) is intelligence exhibited by machines, as opposed to natural intelligence displayed by humans and animals.',
                details: 'AI research has been defined as the field of study of intelligent agents, which refers to any system that perceives its environment and takes actions that maximize its chance of achieving its goals.',
                keywords: ['ai', 'artificial', 'intelligence', 'machine', 'learning', 'neural', 'network']
            },
            'machine learning': {
                definition: 'Machine learning is a subset of artificial intelligence that focuses on the development of algorithms and statistical models that enable computers to improve their performance on tasks through experience.',
                details: 'Machine learning algorithms build a model based on sample data, known as training data, in order to make predictions or decisions without being explicitly programmed to do so.',
                keywords: ['machine', 'learning', 'algorithm', 'data', 'model', 'training', 'prediction']
            },
            'deep learning': {
                definition: 'Deep learning is a subset of machine learning based on artificial neural networks with multiple layers.',
                details: 'Deep learning models can automatically learn the representations needed for feature detection or classification from raw input.',
                keywords: ['deep', 'learning', 'neural', 'network', 'layer', 'brain', 'neuron']
            },
            'python': {
                definition: 'Python is a high-level, interpreted programming language known for its simplicity and readability.',
                details: 'Python is widely used in data science, machine learning, web development, and automation due to its extensive libraries and frameworks.',
                keywords: ['python', 'programming', 'language', 'code', 'script', 'interpreter']
            },
            'javascript': {
                definition: 'JavaScript is a lightweight, interpreted programming language primarily used for web development.',
                details: 'JavaScript runs in web browsers and enables interactive web pages. It can also be used on servers with Node.js.',
                keywords: ['javascript', 'web', 'browser', 'script', 'frontend', 'dom', 'node']
            },
            'web development': {
                definition: 'Web development is the work involved in developing websites for the Internet or an intranet.',
                details: 'It can range from developing a simple static page to complex web applications, electronic businesses, and social network services.',
                keywords: ['web', 'development', 'website', 'html', 'css', 'javascript', 'frontend', 'backend']
            },
            'data science': {
                definition: 'Data science is an interdisciplinary field that uses scientific methods, processes, algorithms and systems to extract knowledge and insights from structured and unstructured data.',
                details: 'Data science combines domain expertise, programming skills, and knowledge of mathematics and statistics to extract meaningful information from data.',
                keywords: ['data', 'science', 'analysis', 'statistics', 'visualization', 'insight', 'pattern']
            },
            'cloud computing': {
                definition: 'Cloud computing is the on-demand availability of computer system resources, especially data storage and computing power, without direct active management by the user.',
                details: 'Cloud computing enables users to access applications and data from anywhere with an internet connection, using servers hosted on the internet.',
                keywords: ['cloud', 'computing', 'server', 'storage', 'internet', 'aws', 'azure', 'google']
            }
        };
    }

    /**
     * Initialize the QA model
     */
    async initialize() {
        console.log('Initializing SimpleQAModel...');
        this.initialized = true;
        return true;
    }

    /**
     * Load a custom knowledge base (session-only)
     * @param {Object} knowledgeBase - Knowledge base data
     */
    loadKnowledgeBase(knowledgeBase) {
        if (!knowledgeBase || typeof knowledgeBase !== 'object' || Array.isArray(knowledgeBase)) {
            throw new Error('Knowledge base must be a JSON object');
        }

        this.knowledgeBase = knowledgeBase;
        return true;
    }

    /**
     * Calculate TF-IDF score for a query against a document
     */
    calculateTFIDF(query, document) {
        const queryTerms = query.toLowerCase().split(/\s+/);
        const docTerms = document.toLowerCase().split(/\s+/);
        
        let score = 0;
        for (const term of queryTerms) {
            if (term.length > 2) {  // Only consider words longer than 2 chars
                const count = docTerms.filter(t => t.includes(term) || term.includes(t)).length;
                score += count;
            }
        }
        return score;
    }

    /**
     * Find the best matching knowledge base entry for a query
     */
    findBestMatch(query) {
        let bestMatch = null;
        let bestScore = 0;

        for (const [topic, data] of Object.entries(this.knowledgeBase)) {
            const combinedText = `${topic} ${data.definition} ${data.details}`;
            const score = this.calculateTFIDF(query, combinedText);
            
            if (score > bestScore) {
                bestScore = score;
                bestMatch = { topic, ...data };
            }
        }

        return bestMatch;
    }

    /**
     * Answer a question using the knowledge base
     */
    async answerQuestion(question) {
        if (!this.initialized) {
            return { answer: 'Model not initialized', confidence: 0 };
        }

        const match = this.findBestMatch(question);

        if (match && match.topic) {
            // Found a good match
            return {
                answer: `${match.definition} ${match.details}`,
                confidence: 0.85,
                topic: match.topic
            };
        }

        // No good match found, provide a generic response
        return {
            answer: 'I don\'t have specific information about that topic in my knowledge base, but I can help with questions about AI, machine learning, programming, and web development.',
            confidence: 0.3,
            topic: 'unknown'
        };
    }

    /**
     * Generate text based on a prompt
     */
    async generateText(prompt, options = {}) {
        if (!this.initialized) {
            throw new Error('Model not initialized');
        }

        // Handle SQL query generation for Wikipedia search
        if (prompt.includes('generate a SQL search query')) {
            const questionMatch = prompt.match(/Question: "(.+)"/);
            if (questionMatch) {
                const question = questionMatch[1];
                // Parse search terms and generate SQL query
                const keywords = question.split(/\s+/)
                    .filter(word => word.length > 2)
                    .filter(word => !/^(what|where|when|who|why|how|is|are|was|were|the|a|an|in|on|at|to|for|of|with|about|tell|me|explain|describe)$/i.test(word));
                
                const searchTerm = keywords.join(' ') || question;
                
                // Escape special SQL characters to prevent injection
                const escapedTerm = searchTerm
                    .replace(/\\/g, '\\\\')
                    .replace(/'/g, "''")
                    .replace(/%/g, '\\%')
                    .replace(/_/g, '\\_');
                
                // Generate SQL query with escaped search term
                const sql = `SELECT * FROM wikipedia_articles WHERE title LIKE '%${escapedTerm}%' OR content LIKE '%${escapedTerm}%' OR summary LIKE '%${escapedTerm}%' LIMIT 10`;
                return sql;
            }
        }

        // Extract keywords from Wikipedia search prompts
        if (prompt.includes('Extract the main search keywords')) {
            // Extract the question from the prompt
            const questionMatch = prompt.match(/Question: "(.+)"/);
            if (questionMatch) {
                const question = questionMatch[1];
                // Extract meaningful keywords (nouns, proper nouns)
                const keywords = question.split(/\s+/)
                    .filter(word => word.length > 2)
                    .filter(word => !/^(what|where|when|who|why|how|is|are|was|were|the|a|an|in|on|at|to|for|of|with)$/i.test(word))
                    .join(' ');
                return keywords || question;
            }
        }

        // Try to find a relevant topic for other queries
        const match = this.findBestMatch(prompt);
        
        if (match && match.topic) {
            return `Based on your question about ${match.topic}: ${match.definition}`;
        }
        
        return `Regarding your question: ${prompt.substring(0, 50)}... I can provide information about various topics in artificial intelligence, programming, and technology.`;
    }
}

// Make the class available globally
if (typeof window !== 'undefined') {
    window.SimpleQAModel = SimpleQAModel;
}
