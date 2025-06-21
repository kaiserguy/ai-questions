/**
 * Mock Wikipedia Database for Offline Mode
 * Provides fallback functionality when real database is not available
 */

class MockWikipediaDB {
    constructor() {
        this.initialized = false;
        this.articles = new Map();
        this.searchIndex = new Map();
    }

    async initialize() {
        console.log('🔄 Initializing Mock Wikipedia Database');
        
        try {
            // Create some mock articles
            this.createMockArticles();
            
            // Create search index
            this.createSearchIndex();
            
            this.initialized = true;
            console.log('✅ Mock Wikipedia Database initialized');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize Mock Wikipedia Database:', error);
            return false;
        }
    }

    createMockArticles() {
        // Add some mock articles
        const mockArticles = [
            {
                id: 'artificial_intelligence',
                title: 'Artificial Intelligence',
                content: `<h2>Introduction</h2>
                <p>Artificial intelligence (AI) is intelligence demonstrated by machines, as opposed to natural intelligence displayed by animals including humans. AI research has been defined as the field of study of intelligent agents, which refers to any system that perceives its environment and takes actions that maximize its chance of achieving its goals.</p>
                
                <h2>History</h2>
                <p>The field of AI research was founded at a workshop held on the campus of Dartmouth College in the summer of 1956. The attendees, including John McCarthy, Marvin Minsky, Allen Newell, and Herbert Simon, became the leaders of AI research for many decades.</p>
                
                <h2>Applications</h2>
                <p>AI applications include advanced web search engines, recommendation systems, understanding human speech, self-driving cars, automated decision-making, and competing at the highest level in strategic game systems.</p>`,
                summary: 'Intelligence demonstrated by machines, as opposed to natural intelligence displayed by animals including humans.',
                categories: 'computer science, technology, machine learning'
            },
            {
                id: 'machine_learning',
                title: 'Machine Learning',
                content: `<h2>Introduction</h2>
                <p>Machine learning (ML) is a field of inquiry devoted to understanding and building methods that 'learn', that is, methods that leverage data to improve performance on some set of tasks. It is seen as a part of artificial intelligence.</p>
                
                <h2>Approaches</h2>
                <p>Machine learning approaches are traditionally divided into three broad categories: supervised learning, unsupervised learning, and reinforcement learning.</p>
                
                <h2>Applications</h2>
                <p>Machine learning is used in a wide variety of applications, such as in medicine, email filtering, speech recognition, and computer vision.</p>`,
                summary: 'A field of inquiry devoted to understanding and building methods that leverage data to improve performance on tasks.',
                categories: 'computer science, artificial intelligence, data science'
            },
            {
                id: 'deep_learning',
                title: 'Deep Learning',
                content: `<h2>Introduction</h2>
                <p>Deep learning is part of a broader family of machine learning methods based on artificial neural networks with representation learning. Learning can be supervised, semi-supervised or unsupervised.</p>
                
                <h2>Neural Networks</h2>
                <p>Deep learning architectures such as deep neural networks, deep belief networks, recurrent neural networks and convolutional neural networks have been applied to fields including computer vision, speech recognition, natural language processing, and more.</p>
                
                <h2>Applications</h2>
                <p>Deep learning has led to breakthroughs in image recognition, language translation, and game playing.</p>`,
                summary: 'Part of machine learning based on artificial neural networks with representation learning.',
                categories: 'computer science, artificial intelligence, machine learning'
            },
            {
                id: 'natural_language_processing',
                title: 'Natural Language Processing',
                content: `<h2>Introduction</h2>
                <p>Natural language processing (NLP) is a subfield of linguistics, computer science, and artificial intelligence concerned with the interactions between computers and human language, in particular how to program computers to process and analyze large amounts of natural language data.</p>
                
                <h2>Challenges</h2>
                <p>The challenges in natural language processing frequently involve speech recognition, natural-language understanding, and natural-language generation.</p>
                
                <h2>Applications</h2>
                <p>NLP applications include machine translation, chatbots, sentiment analysis, and text summarization.</p>`,
                summary: 'A field concerned with the interactions between computers and human language.',
                categories: 'computer science, artificial intelligence, linguistics'
            },
            {
                id: 'computer_vision',
                title: 'Computer Vision',
                content: `<h2>Introduction</h2>
                <p>Computer vision is an interdisciplinary scientific field that deals with how computers can gain high-level understanding from digital images or videos. From the perspective of engineering, it seeks to understand and automate tasks that the human visual system can do.</p>
                
                <h2>Tasks</h2>
                <p>Computer vision tasks include methods for acquiring, processing, analyzing and understanding digital images, and extraction of high-dimensional data from the real world in order to produce numerical or symbolic information.</p>
                
                <h2>Applications</h2>
                <p>Computer vision is used in fields like autonomous vehicles, medical image analysis, and facial recognition systems.</p>`,
                summary: 'A field that deals with how computers can gain understanding from digital images or videos.',
                categories: 'computer science, artificial intelligence, image processing'
            }
        ];
        
        // Add articles to the map
        mockArticles.forEach(article => {
            this.articles.set(article.id, article);
        });
        
        console.log(`📚 Created ${mockArticles.length} mock articles`);
    }

    createSearchIndex() {
        // Create a simple search index
        this.articles.forEach(article => {
            const words = new Set([
                ...article.title.toLowerCase().split(/\W+/),
                ...article.summary.toLowerCase().split(/\W+/),
                ...article.categories.toLowerCase().split(/\W+/)
            ]);
            
            words.forEach(word => {
                if (word.length < 3) return; // Skip short words
                
                if (!this.searchIndex.has(word)) {
                    this.searchIndex.set(word, []);
                }
                
                this.searchIndex.get(word).push(article.id);
            });
        });
        
        console.log(`🔍 Created search index with ${this.searchIndex.size} terms`);
    }

    async search(query, limit = 10) {
        console.log(`🔍 Mock search for: "${query}"`);
        
        if (!this.initialized) {
            await this.initialize();
        }
        
        // Split query into words
        const queryWords = query.toLowerCase().split(/\W+/).filter(word => word.length >= 3);
        
        // Find matching articles
        const matchingArticleIds = new Map();
        
        queryWords.forEach(word => {
            const matchingIds = this.searchIndex.get(word) || [];
            
            matchingIds.forEach(id => {
                if (!matchingArticleIds.has(id)) {
                    matchingArticleIds.set(id, 0);
                }
                
                matchingArticleIds.set(id, matchingArticleIds.get(id) + 1);
            });
        });
        
        // Sort by number of matching words
        const sortedIds = Array.from(matchingArticleIds.entries())
            .sort((a, b) => b[1] - a[1])
            .map(entry => entry[0]);
        
        // Get articles
        const results = sortedIds.slice(0, limit).map(id => {
            const article = this.articles.get(id);
            return {
                id: article.id,
                title: article.title,
                summary: article.summary,
                content: article.content.substring(0, 500) + '...',
                relevance: matchingArticleIds.get(id) / queryWords.length
            };
        });
        
        // If no results, generate some mock results
        if (results.length === 0) {
            return this.generateMockResults(query, limit);
        }
        
        return results;
    }

    async getArticle(id) {
        console.log(`📖 Mock get article: ${id}`);
        
        if (!this.initialized) {
            await this.initialize();
        }
        
        // Get article from map
        const article = this.articles.get(id);
        
        // If article not found, generate a mock article
        if (!article) {
            return this.generateMockArticle(id);
        }
        
        return article;
    }

    generateMockResults(query, limit = 10) {
        console.log(`Generating mock results for "${query}"`);
        
        const results = [];
        
        // Add a result that matches the query
        results.push({
            id: 'mock_' + query.replace(/\W+/g, '_').toLowerCase(),
            title: query.charAt(0).toUpperCase() + query.slice(1),
            summary: `This is a mock Wikipedia article about "${query}".`,
            content: `This is a mock Wikipedia article about "${query}".`,
            relevance: 0.95
        });
        
        // Add a disambiguation result
        results.push({
            id: 'mock_' + query.replace(/\W+/g, '_').toLowerCase() + '_disambiguation',
            title: query.charAt(0).toUpperCase() + query.slice(1) + ' (disambiguation)',
            summary: `"${query}" may refer to multiple topics.`,
            content: `"${query}" may refer to multiple topics.`,
            relevance: 0.8
        });
        
        // Add a history result
        results.push({
            id: 'mock_history_of_' + query.replace(/\W+/g, '_').toLowerCase(),
            title: 'History of ' + query.charAt(0).toUpperCase() + query.slice(1),
            summary: `A mock article about the history of "${query}".`,
            content: `A mock article about the history of "${query}".`,
            relevance: 0.7
        });
        
        return results.slice(0, limit);
    }

    generateMockArticle(id) {
        console.log(`Generating mock article for id: ${id}`);
        
        // Extract title from id
        const title = id.split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        
        return {
            id: id,
            title: title,
            content: `
                <h2>Introduction</h2>
                <p>This is a mock Wikipedia article about "${title}". The content is generated as a placeholder since the actual article was not found in the database.</p>
                
                <h2>Content</h2>
                <p>In a real implementation, this section would contain the actual content of the Wikipedia article, retrieved from a local database that was downloaded as part of the offline package.</p>
                
                <h2>References</h2>
                <p>This section would list references and citations for the information presented in the article.</p>
            `,
            summary: `This is a mock Wikipedia article about "${title}".`,
            categories: 'mock, generated',
            links: ''
        };
    }
}

// Export for browser and Node.js environments
if (typeof window !== 'undefined') {
    window.mockWikipediaDB = new MockWikipediaDB();
} else if (typeof module !== 'undefined') {
    module.exports = MockWikipediaDB;
}
