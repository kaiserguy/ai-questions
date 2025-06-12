/**
 * Mock Wikipedia Database for Offline Mode
 * This file provides a minimal SQLite database structure for offline Wikipedia access
 */

class MockWikipediaDatabase {
    constructor() {
        this.initialized = false;
        this.articles = new Map();
        this.searchIndex = new Map();
        
        // Sample articles for offline use
        this.sampleArticles = [
            {
                id: 1,
                title: "Poland",
                summary: "Poland is a country in Central Europe with a rich history and culture.",
                content: `Poland (Polish: Polska), officially the Republic of Poland, is a country in Central Europe. It is divided into 16 administrative provinces called voivodeships, covering an area of 312,696 km2 (120,733 sq mi). Poland has a population of over 38 million and is the fifth-most populous member state of the European Union. Warsaw is the nation's capital and largest metropolis. Other major cities include Kraków, Łódź, Wrocław, Poznań, Gdańsk, and Szczecin.

Poland has a temperate transitional climate and its territory traverses the Central European Plain, extending from the Baltic Sea in the north to the Sudetes and Carpathian Mountains in the south. The longest Polish river is the Vistula, and Poland's highest point is Mount Rysy, situated in the Tatra mountain range of the Carpathians. The country is bordered by the Baltic Sea, Lithuania, and Russia's Kaliningrad Oblast to the north, Belarus and Ukraine to the east, and the Czech Republic and Slovakia to the south. It also shares a maritime border with Denmark and Sweden.

The history of human activity on Polish soil spans thousands of years. Throughout the late antiquity period it became extensively diverse, with various cultures and tribes settling on the vast Central European Plain. However, it was the Western Polans who dominated the region and gave Poland its name. The establishment of Polish statehood can be traced to 966, when the pagan ruler of a realm coextensive with the territory of present-day Poland embraced Christianity and converted to Catholicism.`,
                categories: ["Countries", "Europe", "Central Europe", "History"],
                links: ["Warsaw", "Kraków", "European Union", "Baltic Sea"]
            },
            {
                id: 2,
                title: "Artificial Intelligence",
                summary: "Artificial intelligence (AI) is intelligence demonstrated by machines.",
                content: `Artificial intelligence (AI) is intelligence—perceiving, synthesizing, and inferring information—demonstrated by machines, as opposed to intelligence displayed by humans or by other animals. Example tasks in which this is done include speech recognition, computer vision, translation between (natural) languages, as well as other mappings of inputs.

AI applications include advanced web search engines (e.g., Google Search), recommendation systems (used by YouTube, Amazon, and Netflix), understanding human speech (such as Siri and Alexa), self-driving cars (e.g., Waymo), generative or creative tools (ChatGPT and AI art), automated decision-making, and competing at the highest level in strategic game systems (such as chess and Go).

As machines become increasingly capable, tasks considered to require "intelligence" are often removed from the definition of AI, a phenomenon known as the AI effect. For instance, optical character recognition is frequently excluded from things considered to be AI, having become a routine technology.

Artificial intelligence was founded as an academic discipline in 1956, and in the years since it has experienced several waves of optimism, followed by disappointment and the loss of funding (known as an "AI winter"), followed by new approaches, success, and renewed funding. AI research has tried and discarded many different approaches, including simulating the brain, modeling human problem solving, formal logic, large databases of knowledge, and imitating animal behavior. In the first decades of the 21st century, highly mathematical and statistical machine learning has dominated the field, and this technique has proved highly successful, helping to solve many challenging problems throughout industry and academia.`,
                categories: ["Technology", "Computer Science", "Machine Learning"],
                links: ["Machine Learning", "Neural Networks", "Computer Vision", "Natural Language Processing"]
            },
            {
                id: 3,
                title: "Machine Learning",
                summary: "Machine learning is a field of study that gives computers the ability to learn without being explicitly programmed.",
                content: `Machine learning (ML) is a field of study in artificial intelligence concerned with the development and study of statistical algorithms that can learn from data and generalize to unseen data, and thus perform tasks without explicit instructions. Recently, generative artificial intelligence approaches have been developed based on machine learning algorithms that can generate content such as images, text, and audio from natural language descriptions called prompts.

Machine learning approaches have been applied to large language models, computer vision, speech recognition, email filtering, agriculture, and medicine, where it is too costly to develop algorithms to perform the needed tasks. Machine learning is known in its application across business problems under the name predictive analytics.

Machine learning algorithms build a model based on sample data, known as training data, in order to make predictions or decisions without being explicitly programmed to do so. Machine learning algorithms are used in a wide variety of applications, such as in medicine, email filtering, speech recognition, agriculture, and computer vision, where it is difficult or unfeasible to develop conventional algorithms to perform the needed tasks.

A subset of machine learning is closely related to computational statistics, which focuses on making predictions using computers, but not all machine learning is statistical learning. The study of mathematical optimization delivers methods, theory and application domains to the field of machine learning. Data mining is a related field of study, focusing on exploratory data analysis through unsupervised learning.`,
                categories: ["Technology", "Computer Science", "Artificial Intelligence"],
                links: ["Artificial Intelligence", "Deep Learning", "Neural Networks", "Data Science"]
            },
            {
                id: 4,
                title: "Neural Networks",
                summary: "Neural networks are computing systems inspired by the biological neural networks that constitute animal brains.",
                content: `Neural networks, also known as artificial neural networks (ANNs) or simulated neural networks (SNNs), are a subset of machine learning and are at the heart of deep learning algorithms. Their name and structure are inspired by the human brain, mimicking the way that biological neurons signal to one another.

Artificial neural networks (ANNs) are comprised of a node layers, containing an input layer, one or more hidden layers, and an output layer. Each node, or artificial neuron, connects to another and has an associated weight and threshold. If the output of any individual node is above the specified threshold value, that node is activated, sending data to the next layer of the network. Otherwise, no data is passed along to the next layer of the network.

Neural networks rely on training data to learn and improve their accuracy over time. However, once these learning algorithms are fine-tuned for accuracy, they are powerful tools in computer science and artificial intelligence, allowing us to classify and cluster data at a high velocity. Tasks in speech recognition or image recognition can take minutes versus hours when compared to the manual identification by human experts. One of the most well-known neural networks is Google's search algorithm.`,
                categories: ["Technology", "Computer Science", "Artificial Intelligence", "Machine Learning"],
                links: ["Artificial Intelligence", "Machine Learning", "Deep Learning", "Backpropagation"]
            },
            {
                id: 5,
                title: "Climate Change",
                summary: "Climate change refers to significant changes in global temperature, precipitation, wind patterns, and other measures of climate that occur over several decades or longer.",
                content: `Climate change refers to significant, long-term changes in the global climate. The global climate is the connected system of sun, earth and oceans, wind, rain and snow, forests, deserts and savannas, and everything people do, too. The climate of a place, say New York, can be described as its rainfall, changing temperatures during the year and so on.

Climate change refers to changes in these statistics over years, decades, or even centuries. Enormous progress has been made in increasing our understanding of climate change and its causes, and a clearer picture of current and future impacts is emerging. Research has shown that the Earth's climate has changed over almost every conceivable timescale since the beginning of geologic time and that the influence of human activities since at least the beginning of the Industrial Revolution has been deeply woven into the very fabric of climate change.

Human activities are changing Earth's climate. At the global level, atmospheric concentrations of carbon dioxide and other heat-trapping greenhouse gases have increased sharply since the Industrial Revolution. Fossil fuel burning dominates this increase. Human-caused increases in greenhouse gases are responsible for most of the observed global average surface warming of roughly 1.0°C (1.8°F) over the past 140 years. Because natural processes cannot quickly remove some of these gases (notably carbon dioxide) from the atmosphere, our past, present, and future emissions will influence the climate system for millennia.

While some amount of climate change is inevitable, the strength of expected impacts depends on the total amount of carbon dioxide we emit. Limiting climate change requires substantial and sustained reductions in net global greenhouse gas emissions.`,
                categories: ["Environment", "Science", "Global Issues"],
                links: ["Global Warming", "Greenhouse Effect", "Carbon Dioxide", "Renewable Energy"]
            }
        ];
    }

    async initialize() {
        console.log('📚 Initializing Mock Wikipedia Database');
        
        try {
            // Simulate database initialization
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Load sample articles into memory
            this.sampleArticles.forEach(article => {
                this.articles.set(article.id, article);
                
                // Create search index
                const searchTerms = [
                    article.title.toLowerCase(),
                    ...article.categories.map(c => c.toLowerCase()),
                    ...article.summary.toLowerCase().split(' ')
                ];
                
                searchTerms.forEach(term => {
                    if (!this.searchIndex.has(term)) {
                        this.searchIndex.set(term, []);
                    }
                    
                    if (!this.searchIndex.get(term).includes(article.id)) {
                        this.searchIndex.get(term).push(article.id);
                    }
                });
            });
            
            this.initialized = true;
            console.log(`✅ Mock Wikipedia Database initialized with ${this.articles.size} articles`);
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize Mock Wikipedia Database:', error);
            return false;
        }
    }

    async search(query, limit = 10) {
        if (!this.initialized) {
            console.warn('Wikipedia database not initialized');
            return [];
        }

        try {
            console.log(`🔍 Searching Wikipedia for: "${query}"`);
            
            // Normalize query
            const normalizedQuery = query.toLowerCase().trim();
            const queryTerms = normalizedQuery.split(/\s+/);
            
            // Check for exact title match first
            const exactMatch = Array.from(this.articles.values()).find(
                article => article.title.toLowerCase() === normalizedQuery
            );
            
            if (exactMatch) {
                console.log(`✅ Found exact match: "${exactMatch.title}"`);
                return [{
                    id: exactMatch.id,
                    title: exactMatch.title,
                    summary: exactMatch.summary,
                    content: exactMatch.content.substring(0, 500) + '...',
                    relevance: 1.0
                }];
            }
            
            // Search for each term
            const resultScores = new Map();
            
            queryTerms.forEach(term => {
                // Find articles containing this term
                const matchingIds = this.searchIndex.get(term) || [];
                
                matchingIds.forEach(id => {
                    const currentScore = resultScores.get(id) || 0;
                    resultScores.set(id, currentScore + 1);
                });
            });
            
            // Sort by score and convert to result objects
            const results = Array.from(resultScores.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, limit)
                .map(([id, score]) => {
                    const article = this.articles.get(id);
                    return {
                        id: article.id,
                        title: article.title,
                        summary: article.summary,
                        content: article.content.substring(0, 500) + '...',
                        relevance: score / queryTerms.length
                    };
                });
            
            console.log(`✅ Found ${results.length} results for "${query}"`);
            return results;
            
        } catch (error) {
            console.error('Search error:', error);
            return [];
        }
    }

    async getArticle(id) {
        if (!this.initialized) {
            return null;
        }

        try {
            const article = this.articles.get(id);
            return article || null;
        } catch (error) {
            console.error('Error getting article:', error);
            return null;
        }
    }

    async getRandomArticle() {
        if (!this.initialized || this.articles.size === 0) {
            return null;
        }

        try {
            const articleIds = Array.from(this.articles.keys());
            const randomId = articleIds[Math.floor(Math.random() * articleIds.length)];
            return this.articles.get(randomId);
        } catch (error) {
            console.error('Error getting random article:', error);
            return null;
        }
    }
}

// Create a global instance
window.mockWikipediaDB = new MockWikipediaDatabase();

// Override WikipediaManager if it doesn't exist
if (typeof WikipediaManager === 'undefined') {
    console.log('Creating mock WikipediaManager');
    
    window.WikipediaManager = class WikipediaManager {
        constructor() {
            this.db = window.mockWikipediaDB;
            this.isInitialized = false;
        }
        
        async initialize() {
            console.log('Initializing WikipediaManager with mock database');
            const result = await this.db.initialize();
            this.isInitialized = result;
            return result;
        }
        
        async search(query, limit = 10) {
            return this.db.search(query, limit);
        }
        
        async getArticle(id) {
            return this.db.getArticle(id);
        }
        
        async getRandomArticle() {
            return this.db.getRandomArticle();
        }
    };
}
