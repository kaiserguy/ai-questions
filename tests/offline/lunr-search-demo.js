/**
 * Example usage of LunrSearch class
 * This demonstrates how to use the LunrSearch implementation
 */

const LunrSearch = require('../../core/public/offline/search/lunr-search.js');

async function demonstrateLunrSearch() {
    console.log('=== LunrSearch Demo ===\n');

    // Sample Wikipedia articles
    const articles = [
        {
            id: '1',
            title: 'JavaScript',
            content: 'JavaScript is a high-level, interpreted programming language that is one of the core technologies of the World Wide Web, alongside HTML and CSS. It enables interactive web pages and is an essential part of web applications.',
            category: 'Programming'
        },
        {
            id: '2',
            title: 'Python',
            content: 'Python is an interpreted, high-level, general-purpose programming language. Created by Guido van Rossum and first released in 1991, Python design philosophy emphasizes code readability with its notable use of significant whitespace.',
            category: 'Programming'
        },
        {
            id: '3',
            title: 'Artificial Intelligence',
            content: 'Artificial intelligence (AI) is intelligence demonstrated by machines, in contrast to the natural intelligence displayed by humans and animals. Leading AI textbooks define the field as the study of intelligent agents.',
            category: 'Technology'
        },
        {
            id: '4',
            title: 'Machine Learning',
            content: 'Machine learning is the scientific study of algorithms and statistical models that computer systems use to perform a specific task without using explicit instructions, relying on patterns and inference instead.',
            category: 'Technology'
        },
        {
            id: '5',
            title: 'World Wide Web',
            content: 'The World Wide Web (WWW), commonly known as the Web, is an information system where documents and other web resources are identified by Uniform Resource Locators, which may be interlinked by hypertext.',
            category: 'Internet'
        }
    ];

    // Create LunrSearch instance
    const search = new LunrSearch();
    console.log('✓ Created LunrSearch instance\n');

    // Build index from articles
    console.log('Building search index...');
    const startBuild = Date.now();
    await search.buildIndex(articles);
    const buildTime = Date.now() - startBuild;
    console.log(`✓ Index built in ${buildTime}ms\n`);

    // Display stats
    const stats = search.getStats();
    console.log('Index Statistics:');
    console.log(`  - Articles indexed: ${stats.articleCount}`);
    console.log(`  - Index size: ${(stats.indexSize / 1024).toFixed(2)} KB`);
    console.log(`  - Ready: ${stats.indexReady}\n`);

    // Perform searches
    console.log('=== Search Examples ===\n');

    // Example 1: Simple search
    console.log('1. Search for "programming":');
    const results1 = await search.search('programming');
    console.log(`   Found ${results1.length} results`);
    results1.slice(0, 2).forEach((result, idx) => {
        console.log(`   ${idx + 1}. ${result.title} (score: ${result.score.toFixed(3)})`);
        console.log(`      Snippet: ${result.snippet.replace(/<\/?mark>/g, '**')}`);
    });
    console.log();

    // Example 2: Multi-word search
    console.log('2. Search for "machine learning":');
    const results2 = await search.search('machine learning');
    console.log(`   Found ${results2.length} results`);
    results2.slice(0, 2).forEach((result, idx) => {
        console.log(`   ${idx + 1}. ${result.title} (score: ${result.score.toFixed(3)})`);
    });
    console.log();

    // Example 3: Category filtering
    console.log('3. Search for "intelligence" in Technology category:');
    const results3 = await search.searchByCategory('intelligence', 'Technology');
    console.log(`   Found ${results3.length} results`);
    results3.forEach((result, idx) => {
        console.log(`   ${idx + 1}. ${result.title} (category: ${result.category})`);
    });
    console.log();

    // Example 4: Performance test
    console.log('4. Performance test:');
    const searchStart = Date.now();
    await search.search('web');
    const searchTime = Date.now() - searchStart;
    console.log(`   Search completed in ${searchTime}ms (target: <100ms) ${searchTime < 100 ? '✓' : '✗'}\n`);

    // Example 5: Serialization
    console.log('5. Index serialization:');
    const indexData = search.getIndexData();
    console.log(`   Serialized index size: ${(JSON.stringify(indexData).length / 1024).toFixed(2)} KB`);
    
    // Create new instance and load serialized index
    const search2 = new LunrSearch();
    const loadStart = Date.now();
    await search2.loadIndex(indexData, articles);
    const loadTime = Date.now() - loadStart;
    console.log(`   Index loaded in ${loadTime}ms`);
    
    const results4 = await search2.search('programming');
    console.log(`   Verification search found ${results4.length} results ✓\n`);

    // Clean up
    search.clear();
    search2.clear();
    console.log('✓ Demo completed successfully!');
}

// Run the demo
if (require.main === module) {
    demonstrateLunrSearch().catch(console.error);
}

module.exports = demonstrateLunrSearch;
