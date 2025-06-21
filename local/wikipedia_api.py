#!/usr/bin/env python3
"""
Wikipedia API Bridge
Provides Python-based Wikipedia search functionality for Node.js application
"""

import sys
import json
import sqlite3
import logging
from pathlib import Path

# Import our Wikipedia search modules
try:
    from wikipedia_search import WikipediaSearchEngine, WikipediaContextExtractor, WikipediaStats
except ImportError:
    print(json.dumps({"error": "Wikipedia search modules not found"}))
    sys.exit(1)

# Setup logging
logging.basicConfig(level=logging.WARNING)  # Reduce log noise

class WikipediaAPI:
    """API bridge for Wikipedia functionality"""
    
    def __init__(self, db_path="./wikipedia.db"):
        self.db_path = db_path
        self.search_engine = None
        self.context_extractor = None
        self.stats = None
        self.initialize()
    
    def initialize(self):
        """Initialize Wikipedia components"""
        try:
            if not Path(self.db_path).exists():
                raise Exception(f"Wikipedia database not found: {self.db_path}")
            
            self.search_engine = WikipediaSearchEngine(self.db_path)
            self.context_extractor = WikipediaContextExtractor(self.search_engine)
            self.stats = WikipediaStats(self.search_engine)
            
        except Exception as e:
            raise Exception(f"Failed to initialize Wikipedia API: {e}")
    
    def search(self, params):
        """Search Wikipedia articles"""
        try:
            query = params.get('query', '')
            limit = params.get('limit', 5)
            
            if not query:
                return {"results": [], "error": "Empty query"}
            
            results = self.search_engine.search(query, limit=limit)
            
            # Convert SearchResult objects to dictionaries
            result_dicts = []
            for result in results:
                result_dict = {
                    "id": result.id,
                    "article_id": result.article_id,
                    "title": result.title,
                    "summary": result.summary,
                    "snippet": result.snippet,
                    "categories": result.categories,
                    "relevance_score": result.relevance_score
                }
                result_dicts.append(result_dict)
            
            return {
                "results": result_dicts,
                "total": len(result_dicts),
                "query": query
            }
            
        except Exception as e:
            return {"results": [], "error": str(e)}
    
    def get_context(self, params):
        """Get Wikipedia context for AI prompts"""
        try:
            query = params.get('query', '')
            max_length = params.get('maxLength', 2000)
            
            if not query:
                return {"context": "", "sources": [], "confidence": 0, "error": "Empty query"}
            
            context_result = self.context_extractor.get_context_for_query(
                query, max_length=max_length
            )
            
            # Convert sources to dictionaries
            sources = []
            for source in context_result.sources:
                source_dict = {
                    "id": source.id,
                    "article_id": source.article_id,
                    "title": source.title,
                    "summary": source.summary,
                    "relevance_score": source.relevance_score
                }
                sources.append(source_dict)
            
            return {
                "context": context_result.context_text,
                "sources": sources,
                "confidence": context_result.confidence_score,
                "total_articles": context_result.total_articles,
                "query": query
            }
            
        except Exception as e:
            return {"context": "", "sources": [], "confidence": 0, "error": str(e)}
    
    def get_article(self, params):
        """Get full Wikipedia article by title"""
        try:
            title = params.get('title', '')
            
            if not title:
                return {"article": None, "error": "Missing title"}
            
            article = self.search_engine.get_article_by_title(title)
            
            if not article:
                return {"article": None, "error": "Article not found"}
            
            article_dict = {
                "id": article.id,
                "article_id": article.article_id,
                "title": article.title,
                "summary": article.summary,
                "content": article.content,
                "categories": article.categories,
                "relevance_score": article.relevance_score
            }
            
            return {"article": article_dict}
            
        except Exception as e:
            return {"article": None, "error": str(e)}
    
    def get_article_by_id(self, params):
        """Get full Wikipedia article by ID"""
        try:
            article_id = params.get('article_id', '')
            
            if not article_id:
                return {"article": None, "error": "Missing article_id"}
            
            article = self.search_engine.get_article_by_id(article_id)
            
            if not article:
                return {"article": None, "error": "Article not found"}
            
            article_dict = {
                "id": article.id,
                "article_id": article.article_id,
                "title": article.title,
                "summary": article.summary,
                "content": article.content,
                "categories": article.categories,
                "relevance_score": article.relevance_score
            }
            
            return {"article": article_dict}
            
        except Exception as e:
            return {"article": None, "error": str(e)}
    
    def get_random_articles(self, params):
        """Get random Wikipedia articles"""
        try:
            count = params.get('count', 5)
            
            articles = self.search_engine.get_random_articles(count)
            
            article_dicts = []
            for article in articles:
                article_dict = {
                    "id": article.id,
                    "article_id": article.article_id,
                    "title": article.title,
                    "summary": article.summary,
                    "snippet": article.snippet,
                    "categories": article.categories
                }
                article_dicts.append(article_dict)
            
            return {"articles": article_dicts, "count": len(article_dicts)}
            
        except Exception as e:
            return {"articles": [], "error": str(e)}
    
    def search_by_category(self, params):
        """Search articles by category"""
        try:
            category = params.get('category', '')
            limit = params.get('limit', 10)
            
            if not category:
                return {"results": [], "error": "Missing category"}
            
            results = self.search_engine.search_by_category(category, limit)
            
            result_dicts = []
            for result in results:
                result_dict = {
                    "id": result.id,
                    "article_id": result.article_id,
                    "title": result.title,
                    "summary": result.summary,
                    "categories": result.categories
                }
                result_dicts.append(result_dict)
            
            return {"results": result_dicts, "category": category, "total": len(result_dicts)}
            
        except Exception as e:
            return {"results": [], "error": str(e)}
    
    def get_categories(self, params):
        """Get popular categories"""
        try:
            limit = params.get('limit', 20)
            
            categories = self.search_engine.get_popular_categories(limit)
            
            category_list = []
            for category, count in categories:
                category_list.append({"name": category, "count": count})
            
            return {"categories": category_list, "total": len(category_list)}
            
        except Exception as e:
            return {"categories": [], "error": str(e)}
    
    def get_stats(self, params):
        """Get Wikipedia database statistics"""
        try:
            db_stats = self.stats.get_database_stats()
            
            # Add some test queries for performance stats
            test_queries = [
                "artificial intelligence",
                "climate change",
                "World War II",
                "quantum physics",
                "democracy"
            ]
            
            performance_stats = self.stats.get_search_performance_stats(test_queries)
            
            return {
                "database": db_stats,
                "performance": performance_stats,
                "status": "available"
            }
            
        except Exception as e:
            return {"error": str(e), "status": "error"}

def main():
    """Main CLI interface"""
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: python3 wikipedia_api.py <action> <params_json>"}))
        sys.exit(1)
    
    action = sys.argv[1]
    
    try:
        params = json.loads(sys.argv[2])
    except json.JSONDecodeError:
        print(json.dumps({"error": "Invalid JSON parameters"}))
        sys.exit(1)
    
    # Initialize Wikipedia API
    try:
        wiki_api = WikipediaAPI()
    except Exception as e:
        print(json.dumps({"error": f"Failed to initialize Wikipedia: {e}"}))
        sys.exit(1)
    
    # Route to appropriate method
    try:
        if action == 'search':
            result = wiki_api.search(params)
        elif action == 'context':
            result = wiki_api.get_context(params)
        elif action == 'article':
            result = wiki_api.get_article_by_id(params)  # Keep existing behavior for 'article'
        elif action == 'get_article':
            result = wiki_api.get_article(params)  # New action for get by title
        elif action == 'random':
            result = wiki_api.get_random_articles(params)
        elif action == 'category':
            result = wiki_api.search_by_category(params)
        elif action == 'categories':
            result = wiki_api.get_categories(params)
        elif action == 'stats':
            result = wiki_api.get_stats(params)
        else:
            result = {"error": f"Unknown action: {action}"}
        
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({"error": f"Action failed: {e}"}))
        sys.exit(1)

if __name__ == '__main__':
    main()

