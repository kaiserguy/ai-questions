#!/usr/bin/env python3
"""
Enhanced Wikipedia Search with LLM-driven query formation and article review
"""

import sys
import json
import sqlite3
import re
import logging
from pathlib import Path
from typing import List, Dict, Optional
from dataclasses import dataclass

# Import our Wikipedia search modules
try:
    from wikipedia_search import WikipediaSearchEngine, WikipediaContextExtractor, WikipediaStats
except ImportError:
    print(json.dumps({"error": "Wikipedia search modules not found"}))
    sys.exit(1)

# Setup logging
logging.basicConfig(level=logging.WARNING)

@dataclass
class SearchResult:
    """Wikipedia search result"""
    id: int
    article_id: str
    title: str
    summary: str
    content: str
    categories: List[str]
    relevance_score: float
    snippet: str

class EnhancedWikipediaAPI:
    """Enhanced Wikipedia API with LLM-driven search and status feedback"""
    
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
    
    def generate_search_queries(self, question: str) -> List[str]:
        """
        Generate multiple search queries from a user question
        This would normally use an LLM, but for now we'll use rule-based generation
        """
        queries = []
        
        # Original question as-is
        queries.append(question.strip())
        
        # Extract key nouns and entities
        words = re.findall(r'\b[A-Z][a-z]+\b|\b[a-z]{4,}\b', question)
        if words:
            # Individual important words
            for word in words[:3]:  # Limit to top 3
                if len(word) > 3:
                    queries.append(word)
            
            # Combinations of words
            if len(words) >= 2:
                queries.append(f"{words[0]} {words[1]}")
        
        # Remove duplicates while preserving order
        seen = set()
        unique_queries = []
        for query in queries:
            if query.lower() not in seen:
                seen.add(query.lower())
                unique_queries.append(query)
        
        return unique_queries[:5]  # Limit to 5 queries
    
    def extract_key_terms(self, question: str) -> List[str]:
        """Extract key terms from a question"""
        # Remove question words and extract meaningful terms
        question_words = {'what', 'is', 'are', 'how', 'why', 'when', 'where', 'who', 'which', 'the', 'a', 'an'}
        words = re.findall(r'\b[A-Za-z]+\b', question.lower())
        
        key_terms = []
        for word in words:
            if word not in question_words and len(word) > 2:
                # Capitalize first letter for proper nouns
                key_terms.append(word.capitalize())
        
        return key_terms
    
    def search_with_multiple_queries(self, question: str, limit: int = 10) -> Dict:
        """
        Search Wikipedia using multiple LLM-generated queries with status feedback
        """
        try:
            # Generate search queries
            search_queries = self.generate_search_queries(question)
            
            status_log = []
            status_log.append(f"Generated {len(search_queries)} search queries")
            
            all_results = {}
            total_articles_found = 0
            
            # Search with each query
            for i, query in enumerate(search_queries):
                status_log.append(f"Searching Wikipedia with query: '{query}'")
                
                # Use lower threshold for initial search
                results = self.search_engine.search(query, limit=limit, min_score=0.001)  # Even lower threshold
                
                status_log.append(f"Found {len(results)} articles for query '{query}'")
                
                # Add results to collection (avoid duplicates)
                for result in results:
                    if result.article_id not in all_results:
                        all_results[result.article_id] = result
                        total_articles_found += 1
            
            # The issue is that the search isn't finding the actual Poland article
            # Let's force include exact title matches
            
            # Check for exact title matches in the database
            if hasattr(self.search_engine, 'conn'):
                try:
                    # Look for exact title matches
                    cursor = self.search_engine.conn.execute(
                        "SELECT * FROM wikipedia_articles WHERE title = ? LIMIT 1",
                        (question.strip(),)
                    )
                    exact_match = cursor.fetchone()
                    
                    if exact_match:
                        status_log.append(f"Found exact title match: '{exact_match['title']}'")
                        
                        # Create SearchResult object
                        from wikipedia_search import SearchResult
                        exact_result = SearchResult(
                            id=exact_match['id'],
                            article_id=exact_match['article_id'],
                            title=exact_match['title'],
                            summary=exact_match['summary'] or '',
                            content=exact_match['content'],
                            categories=json.loads(exact_match['categories']) if exact_match['categories'] else [],
                            relevance_score=1.0,  # Perfect match
                            snippet=exact_match['summary'][:200] if exact_match['summary'] else ''
                        )
                        
                        all_results[exact_result.article_id] = exact_result
                        total_articles_found += 1
                except Exception as e:
                    status_log.append(f"Exact match search failed: {e}")
            
            # Also try key terms from the question
            key_terms = self.extract_key_terms(question)
            for term in key_terms:
                try:
                    cursor = self.search_engine.conn.execute(
                        "SELECT * FROM wikipedia_articles WHERE title = ? LIMIT 1",
                        (term,)
                    )
                    term_match = cursor.fetchone()
                    
                    if term_match and term_match['article_id'] not in all_results:
                        status_log.append(f"Found key term match: '{term_match['title']}'")
                        
                        from wikipedia_search import SearchResult
                        term_result = SearchResult(
                            id=term_match['id'],
                            article_id=term_match['article_id'],
                            title=term_match['title'],
                            summary=term_match['summary'] or '',
                            content=term_match['content'],
                            categories=json.loads(term_match['categories']) if term_match['categories'] else [],
                            relevance_score=0.9,  # High relevance for key terms
                            snippet=term_match['summary'][:200] if term_match['summary'] else ''
                        )
                        
                        all_results[term_result.article_id] = term_result
                        total_articles_found += 1
                except Exception as e:
                    status_log.append(f"Key term search for '{term}' failed: {e}")
            
            # Convert to list and sort by relevance
            final_results = list(all_results.values())
            final_results.sort(key=lambda x: x.relevance_score, reverse=True)
            
            # Review articles for relevance (simulated LLM review)
            reviewed_results = []
            for i, result in enumerate(final_results[:limit]):
                status_log.append(f"Reviewing article {i+1} of {min(len(final_results), limit)}: '{result.title}'")
                
                # Simple relevance check (would be LLM-driven in real implementation)
                relevance = self.assess_article_relevance(question, result)
                
                if relevance > 0.05:  # Lower threshold for keeping articles
                    result.relevance_score = relevance
                    reviewed_results.append(result)
                    status_log.append(f"Article '{result.title}' deemed relevant (score: {relevance:.2f})")
                else:
                    status_log.append(f"Article '{result.title}' not relevant to question")
            
            status_log.append(f"Final selection: {len(reviewed_results)} relevant articles")
            
            # Convert to dictionaries for JSON serialization
            result_dicts = []
            for result in reviewed_results:
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
                "question": question,
                "search_queries": search_queries,
                "status_log": status_log,
                "total_articles_searched": total_articles_found
            }
            
        except Exception as e:
            return {
                "results": [], 
                "error": str(e),
                "status_log": [f"Search failed: {str(e)}"]
            }
    
    def assess_article_relevance(self, question: str, article: SearchResult) -> float:
        """
        Assess how relevant an article is to the question
        This would normally use an LLM, but we'll use rule-based scoring
        """
        question_lower = question.lower()
        title_lower = article.title.lower()
        summary_lower = article.summary.lower()
        
        score = 0.0
        
        # Question words in title
        question_words = set(re.findall(r'\b\w{3,}\b', question_lower))
        title_words = set(re.findall(r'\b\w{3,}\b', title_lower))
        
        if question_words & title_words:
            overlap_ratio = len(question_words & title_words) / len(question_words)
            score += overlap_ratio * 0.8
        
        # Question words in summary
        if summary_lower:
            summary_words = set(re.findall(r'\b\w{3,}\b', summary_lower))
            if question_words & summary_words:
                overlap_ratio = len(question_words & summary_words) / len(question_words)
                score += overlap_ratio * 0.4
        
        # Exact phrase matches
        for word in question_words:
            if len(word) > 4:  # Focus on longer, more specific words
                if word in title_lower:
                    score += 0.3
                if word in summary_lower:
                    score += 0.1
        
        # Boost for exact title matches
        if any(word in title_lower for word in question_words if len(word) > 3):
            score += 0.2
        
        return min(score, 1.0)
    
    def get_enhanced_context(self, question: str, max_length: int = 2000) -> Dict:
        """
        Get enhanced Wikipedia context using LLM-driven search and review
        """
        try:
            # Search with multiple queries
            search_result = self.search_with_multiple_queries(question, limit=5)
            
            if search_result.get("error"):
                return {
                    "context": "",
                    "sources": [],
                    "confidence": 0,
                    "error": search_result["error"],
                    "status_log": search_result.get("status_log", [])
                }
            
            # Build context from relevant articles
            context_parts = []
            sources = []
            
            for article in search_result["results"]:
                if len(" ".join(context_parts)) < max_length:
                    # Add article summary to context
                    if article["summary"]:
                        context_parts.append(f"From {article['title']}: {article['summary']}")
                    
                    # Add to sources
                    sources.append({
                        "id": article["id"],
                        "article_id": article["article_id"],
                        "title": article["title"],
                        "summary": article["summary"],
                        "relevance_score": article["relevance_score"]
                    })
            
            context_text = " ".join(context_parts)
            
            # Calculate confidence based on relevance scores
            if sources:
                avg_relevance = sum(s["relevance_score"] for s in sources) / len(sources)
                confidence = min(avg_relevance * 1.2, 1.0)  # Boost confidence slightly
            else:
                confidence = 0.0
            
            return {
                "context": context_text[:max_length],
                "sources": sources,
                "confidence": confidence,
                "total_articles": len(sources),
                "question": question,
                "search_queries": search_result.get("search_queries", []),
                "status_log": search_result.get("status_log", [])
            }
            
        except Exception as e:
            return {
                "context": "",
                "sources": [],
                "confidence": 0,
                "error": str(e),
                "status_log": [f"Context extraction failed: {str(e)}"]
            }

def main():
    """Main CLI interface"""
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: python3 enhanced_wikipedia_api.py <action> <params_json>"}))
        sys.exit(1)
    
    action = sys.argv[1]
    
    try:
        params = json.loads(sys.argv[2])
    except json.JSONDecodeError:
        print(json.dumps({"error": "Invalid JSON parameters"}))
        sys.exit(1)
    
    # Initialize Enhanced Wikipedia API
    try:
        wiki_api = EnhancedWikipediaAPI()
    except Exception as e:
        print(json.dumps({"error": f"Failed to initialize Wikipedia: {e}"}))
        sys.exit(1)
    
    # Route to appropriate method
    try:
        if action == 'enhanced_search':
            result = wiki_api.search_with_multiple_queries(
                params.get('question', ''),
                limit=params.get('limit', 5)
            )
        elif action == 'enhanced_context':
            result = wiki_api.get_enhanced_context(
                params.get('question', ''),
                max_length=params.get('maxLength', 2000)
            )
        else:
            result = {"error": f"Unknown action: {action}"}
        
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({"error": f"Action failed: {e}"}))
        sys.exit(1)

if __name__ == '__main__':
    main()

