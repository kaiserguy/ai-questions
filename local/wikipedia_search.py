#!/usr/bin/env python3
"""
Wikipedia Search and Retrieval System
Provides fast search and context extraction from offline Wikipedia
"""

import sqlite3
import json
import re
import math
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

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

@dataclass
class WikipediaContext:
    """Context extracted from Wikipedia for AI prompts"""
    query: str
    sources: List[SearchResult]
    context_text: str
    total_articles: int
    confidence_score: float

class WikipediaSearchEngine:
    """Fast search and retrieval engine for offline Wikipedia"""
    
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.conn = None
        self.initialize()
    
    def initialize(self):
        """Initialize database connection and verify schema"""
        try:
            self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
            self.conn.row_factory = sqlite3.Row
            
            # Verify tables exist
            tables = self.conn.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name IN ('wikipedia_articles', 'wikipedia_fts')
            """).fetchall()
            
            if len(tables) < 2:
                raise Exception("Wikipedia database not properly initialized")
            
            logger.info(f"Wikipedia search engine initialized with {self.get_article_count()} articles")
            
        except Exception as e:
            logger.error(f"Failed to initialize Wikipedia search engine: {e}")
            raise
    
    def get_article_count(self) -> int:
        """Get total number of articles in database"""
        result = self.conn.execute("SELECT COUNT(*) FROM wikipedia_articles").fetchone()
        return result[0] if result else 0
    
    def search(self, query: str, limit: int = 10, min_score: float = 0.1) -> List[SearchResult]:
        """
        Search Wikipedia articles using full-text search
        
        Args:
            query: Search query
            limit: Maximum number of results
            min_score: Minimum relevance score threshold
            
        Returns:
            List of SearchResult objects
        """
        if not query.strip():
            return []
        
        # Prepare FTS query
        fts_query = self.prepare_fts_query(query)
        
        try:
            # Execute full-text search with ranking
            cursor = self.conn.execute("""
                SELECT 
                    a.id,
                    a.article_id,
                    a.title,
                    a.summary,
                    a.content,
                    a.categories,
                    fts.rank,
                    snippet(wikipedia_fts, 1, '<mark>', '</mark>', '...', 32) as snippet
                FROM wikipedia_fts fts
                JOIN wikipedia_articles a ON a.id = fts.rowid
                WHERE wikipedia_fts MATCH ?
                ORDER BY fts.rank DESC
                LIMIT ?
            """, (fts_query, limit))
            
            results = []
            for row in cursor.fetchall():
                # Calculate relevance score
                relevance_score = self.calculate_relevance_score(query, row)
                
                if relevance_score >= min_score:
                    categories = json.loads(row['categories']) if row['categories'] else []
                    
                    result = SearchResult(
                        id=row['id'],
                        article_id=row['article_id'],
                        title=row['title'],
                        summary=row['summary'] or '',
                        content=row['content'],
                        categories=categories,
                        relevance_score=relevance_score,
                        snippet=self.clean_snippet(row['snippet'])
                    )
                    results.append(result)
            
            return results
            
        except Exception as e:
            logger.error(f"Search failed for query '{query}': {e}")
            return []
    
    def prepare_fts_query(self, query: str) -> str:
        """Prepare query for FTS5 search"""
        # Clean and tokenize query
        words = re.findall(r'\b\w+\b', query.lower())
        
        if not words:
            return query
        
        # Build FTS query with phrase and term matching
        if len(words) == 1:
            return words[0]
        elif len(words) <= 3:
            # Use phrase search for short queries
            return f'"{" ".join(words)}"'
        else:
            # Use AND search for longer queries
            return " AND ".join(words[:5])  # Limit to 5 terms
    
    def calculate_relevance_score(self, query: str, row: sqlite3.Row) -> float:
        """Calculate relevance score for search result"""
        title = row['title'].lower()
        summary = (row['summary'] or '').lower()
        query_lower = query.lower()
        
        score = 0.0
        
        # Title exact match bonus
        if query_lower in title:
            score += 1.0
        
        # Title word match bonus
        query_words = set(re.findall(r'\b\w+\b', query_lower))
        title_words = set(re.findall(r'\b\w+\b', title))
        title_overlap = len(query_words & title_words) / len(query_words) if query_words else 0
        score += title_overlap * 0.8
        
        # Summary relevance
        if summary:
            summary_words = set(re.findall(r'\b\w+\b', summary))
            summary_overlap = len(query_words & summary_words) / len(query_words) if query_words else 0
            score += summary_overlap * 0.5
        
        # FTS rank bonus (from SQLite FTS)
        fts_rank = abs(row['rank']) if row['rank'] else 0
        score += min(fts_rank / 100.0, 0.3)  # Normalize FTS rank
        
        return min(score, 1.0)  # Cap at 1.0
    
    def clean_snippet(self, snippet: str) -> str:
        """Clean and format search snippet"""
        if not snippet:
            return ''
        
        # Remove extra whitespace
        snippet = re.sub(r'\s+', ' ', snippet).strip()
        
        # Ensure reasonable length
        if len(snippet) > 200:
            snippet = snippet[:200] + '...'
        
        return snippet
    
    def get_article_by_id(self, article_id: str) -> Optional[SearchResult]:
        """Get full article by ID"""
        try:
            cursor = self.conn.execute("""
                SELECT id, article_id, title, summary, content, categories
                FROM wikipedia_articles
                WHERE article_id = ?
            """, (article_id,))
            
            row = cursor.fetchone()
            if not row:
                return None
            
            categories = json.loads(row['categories']) if row['categories'] else []
            
            return SearchResult(
                id=row['id'],
                article_id=row['article_id'],
                title=row['title'],
                summary=row['summary'] or '',
                content=row['content'],
                categories=categories,
                relevance_score=1.0,
                snippet=row['summary'] or row['content'][:200] + '...'
            )
            
        except Exception as e:
            logger.error(f"Failed to get article {article_id}: {e}")
            return None
    
    def get_article_by_title(self, title: str) -> Optional[SearchResult]:
        """Get full article by title"""
        try:
            cursor = self.conn.execute("""
                SELECT id, article_id, title, summary, content, categories
                FROM wikipedia_articles
                WHERE title = ?
            """, (title,))
            
            row = cursor.fetchone()
            if not row:
                return None
            
            categories = json.loads(row['categories']) if row['categories'] else []
            
            return SearchResult(
                id=row['id'],
                article_id=row['article_id'],
                title=row['title'],
                summary=row['summary'] or '',
                content=row['content'],
                categories=categories,
                relevance_score=1.0,
                snippet=row['summary'] or row['content'][:200] + '...'
            )
            
        except Exception as e:
            logger.error(f"Failed to get article '{title}': {e}")
            return None
    
    def get_random_articles(self, count: int = 5) -> List[SearchResult]:
        """Get random articles for exploration"""
        try:
            cursor = self.conn.execute("""
                SELECT id, article_id, title, summary, content, categories
                FROM wikipedia_articles
                ORDER BY RANDOM()
                LIMIT ?
            """, (count,))
            
            results = []
            for row in cursor.fetchall():
                categories = json.loads(row['categories']) if row['categories'] else []
                
                result = SearchResult(
                    id=row['id'],
                    article_id=row['article_id'],
                    title=row['title'],
                    summary=row['summary'] or '',
                    content=row['content'],
                    categories=categories,
                    relevance_score=1.0,
                    snippet=row['summary'] or row['content'][:200] + '...'
                )
                results.append(result)
            
            return results
            
        except Exception as e:
            logger.error(f"Failed to get random articles: {e}")
            return []
    
    def search_by_category(self, category: str, limit: int = 10) -> List[SearchResult]:
        """Search articles by category"""
        try:
            cursor = self.conn.execute("""
                SELECT id, article_id, title, summary, content, categories
                FROM wikipedia_articles
                WHERE categories LIKE ?
                ORDER BY title
                LIMIT ?
            """, (f'%"{category}"%', limit))
            
            results = []
            for row in cursor.fetchall():
                categories = json.loads(row['categories']) if row['categories'] else []
                
                result = SearchResult(
                    id=row['id'],
                    article_id=row['article_id'],
                    title=row['title'],
                    summary=row['summary'] or '',
                    content=row['content'],
                    categories=categories,
                    relevance_score=1.0,
                    snippet=row['summary'] or row['content'][:200] + '...'
                )
                results.append(result)
            
            return results
            
        except Exception as e:
            logger.error(f"Failed to search category '{category}': {e}")
            return []
    
    def get_popular_categories(self, limit: int = 20) -> List[Tuple[str, int]]:
        """Get most popular categories"""
        try:
            cursor = self.conn.execute("""
                SELECT categories FROM wikipedia_articles 
                WHERE categories IS NOT NULL AND categories != '[]'
            """)
            
            category_counts = {}
            for row in cursor.fetchall():
                try:
                    categories = json.loads(row['categories'])
                    for category in categories:
                        category_counts[category] = category_counts.get(category, 0) + 1
                except:
                    continue
            
            # Sort by count and return top categories
            sorted_categories = sorted(category_counts.items(), key=lambda x: x[1], reverse=True)
            return sorted_categories[:limit]
            
        except Exception as e:
            logger.error(f"Failed to get popular categories: {e}")
            return []

class WikipediaContextExtractor:
    """Extract relevant context from Wikipedia for AI prompts"""
    
    def __init__(self, search_engine: WikipediaSearchEngine):
        self.search_engine = search_engine
    
    def get_context_for_query(self, query: str, max_length: int = 2000, 
                            max_articles: int = 5) -> WikipediaContext:
        """
        Extract Wikipedia context for AI prompts
        
        Args:
            query: User query or question
            max_length: Maximum context length in characters
            max_articles: Maximum number of articles to include
            
        Returns:
            WikipediaContext object with relevant information
        """
        # Search for relevant articles
        search_results = self.search_engine.search(query, limit=max_articles * 2)
        
        if not search_results:
            return WikipediaContext(
                query=query,
                sources=[],
                context_text="No relevant Wikipedia articles found.",
                total_articles=0,
                confidence_score=0.0
            )
        
        # Select best articles
        selected_articles = self.select_best_articles(search_results, max_articles)
        
        # Extract context text
        context_text = self.build_context_text(selected_articles, max_length)
        
        # Calculate confidence score
        confidence_score = self.calculate_confidence_score(selected_articles, query)
        
        return WikipediaContext(
            query=query,
            sources=selected_articles,
            context_text=context_text,
            total_articles=len(selected_articles),
            confidence_score=confidence_score
        )
    
    def select_best_articles(self, search_results: List[SearchResult], 
                           max_articles: int) -> List[SearchResult]:
        """Select the best articles for context"""
        # Sort by relevance score
        sorted_results = sorted(search_results, key=lambda x: x.relevance_score, reverse=True)
        
        # Take top articles with good scores
        selected = []
        for result in sorted_results:
            if len(selected) >= max_articles:
                break
            if result.relevance_score >= 0.2:  # Minimum threshold
                selected.append(result)
        
        return selected
    
    def build_context_text(self, articles: List[SearchResult], max_length: int) -> str:
        """Build context text from selected articles"""
        if not articles:
            return "No relevant information found."
        
        context_parts = []
        current_length = 0
        
        for article in articles:
            # Use summary if available, otherwise first part of content
            text = article.summary if article.summary else article.content[:500]
            
            # Format article context
            article_context = f"**{article.title}**\n{text}\n"
            
            # Check if adding this article would exceed max length
            if current_length + len(article_context) > max_length:
                # Try to fit a shorter version
                remaining_length = max_length - current_length - 50  # Leave some buffer
                if remaining_length > 100:
                    short_text = text[:remaining_length] + "..."
                    article_context = f"**{article.title}**\n{short_text}\n"
                    context_parts.append(article_context)
                break
            
            context_parts.append(article_context)
            current_length += len(article_context)
        
        # Add source attribution
        source_list = ", ".join([article.title for article in articles])
        context_text = "\n".join(context_parts)
        context_text += f"\n*Sources: {source_list}*"
        
        return context_text
    
    def calculate_confidence_score(self, articles: List[SearchResult], query: str) -> float:
        """Calculate confidence score for the context"""
        if not articles:
            return 0.0
        
        # Average relevance score
        avg_relevance = sum(article.relevance_score for article in articles) / len(articles)
        
        # Number of articles factor
        article_factor = min(len(articles) / 3.0, 1.0)  # Optimal around 3 articles
        
        # Query coverage factor
        query_words = set(re.findall(r'\b\w+\b', query.lower()))
        covered_words = set()
        
        for article in articles:
            article_words = set(re.findall(r'\b\w+\b', 
                                         (article.title + " " + article.summary).lower()))
            covered_words.update(article_words & query_words)
        
        coverage_factor = len(covered_words) / len(query_words) if query_words else 0
        
        # Combine factors
        confidence = (avg_relevance * 0.5 + article_factor * 0.3 + coverage_factor * 0.2)
        
        return min(confidence, 1.0)
    
    def get_fact_snippets(self, query: str, max_snippets: int = 3) -> List[str]:
        """Extract specific fact snippets for a query"""
        search_results = self.search_engine.search(query, limit=max_snippets * 2)
        
        snippets = []
        for result in search_results[:max_snippets]:
            if result.snippet and len(result.snippet) > 20:
                snippet = f"{result.snippet} (Source: {result.title})"
                snippets.append(snippet)
        
        return snippets

class WikipediaStats:
    """Wikipedia database statistics and analytics"""
    
    def __init__(self, search_engine: WikipediaSearchEngine):
        self.search_engine = search_engine
    
    def get_database_stats(self) -> Dict:
        """Get comprehensive database statistics"""
        conn = self.search_engine.conn
        
        try:
            # Basic stats
            basic_stats = conn.execute("""
                SELECT 
                    COUNT(*) as total_articles,
                    SUM(word_count) as total_words,
                    AVG(word_count) as avg_words_per_article,
                    MIN(word_count) as min_words,
                    MAX(word_count) as max_words
                FROM wikipedia_articles
            """).fetchone()
            
            # Database size
            db_size = Path(self.search_engine.db_path).stat().st_size
            
            # Category stats
            category_count = len(self.search_engine.get_popular_categories(1000))
            
            return {
                'total_articles': basic_stats['total_articles'],
                'total_words': basic_stats['total_words'],
                'avg_words_per_article': round(basic_stats['avg_words_per_article'], 1),
                'min_words': basic_stats['min_words'],
                'max_words': basic_stats['max_words'],
                'database_size_mb': round(db_size / (1024 * 1024), 1),
                'total_categories': category_count
            }
            
        except Exception as e:
            logger.error(f"Failed to get database stats: {e}")
            return {}
    
    def get_search_performance_stats(self, test_queries: List[str]) -> Dict:
        """Test search performance with sample queries"""
        import time
        
        performance_stats = {
            'queries_tested': len(test_queries),
            'total_time': 0,
            'avg_time_ms': 0,
            'results_found': 0
        }
        
        start_time = time.time()
        total_results = 0
        
        for query in test_queries:
            query_start = time.time()
            results = self.search_engine.search(query, limit=5)
            query_time = time.time() - query_start
            
            total_results += len(results)
        
        total_time = time.time() - start_time
        
        performance_stats.update({
            'total_time': round(total_time, 3),
            'avg_time_ms': round((total_time / len(test_queries)) * 1000, 1),
            'results_found': total_results,
            'avg_results_per_query': round(total_results / len(test_queries), 1)
        })
        
        return performance_stats

