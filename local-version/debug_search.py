#!/usr/bin/env python3
"""
Test script to debug Wikipedia search issues
"""

import sys
import json
import sqlite3
import re
from pathlib import Path

def calculate_relevance_score(query, row):
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

def prepare_fts_query(query):
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

def debug_search(query, limit=5, min_score=0.01):  # Lower threshold for testing
    """Debug Wikipedia search"""
    print(f"=== Debugging search for: '{query}' ===")
    
    # Check database exists
    db_path = './wikipedia.db'
    if not Path(db_path).exists():
        print(f"❌ Database not found: {db_path}")
        return
    
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    
    # Prepare FTS query
    fts_query = prepare_fts_query(query)
    print(f"FTS query: '{fts_query}'")
    
    try:
        # Execute search
        cursor = conn.execute("""
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
        """, (fts_query, limit * 3))  # Get more results to test scoring
        
        results = []
        all_results = cursor.fetchall()
        print(f"Raw FTS results: {len(all_results)}")
        
        for row in all_results:
            # Calculate relevance score
            relevance_score = calculate_relevance_score(query, row)
            
            print(f"  Title: '{row['title']}', Score: {relevance_score:.3f}, FTS Rank: {row['rank']:.3f}")
            
            if relevance_score >= min_score:
                categories = json.loads(row['categories']) if row['categories'] else []
                
                result = {
                    "id": row['id'],
                    "article_id": row['article_id'],
                    "title": row['title'],
                    "summary": row['summary'] or '',
                    "snippet": row['snippet'],
                    "categories": categories,
                    "relevance_score": relevance_score
                }
                results.append(result)
        
        print(f"Results above threshold ({min_score}): {len(results)}")
        
        # Return top results
        results.sort(key=lambda x: x['relevance_score'], reverse=True)
        final_results = results[:limit]
        
        print(f"Final results returned: {len(final_results)}")
        for i, result in enumerate(final_results):
            print(f"  {i+1}. {result['title']} (score: {result['relevance_score']:.3f})")
        
        return {
            "results": final_results,
            "total": len(final_results),
            "query": query
        }
        
    except Exception as e:
        print(f"❌ Search failed: {e}")
        return {"results": [], "error": str(e)}

if __name__ == '__main__':
    # Test various queries
    test_queries = ["Poland", "United States", "artificial intelligence", "climate change"]
    
    for query in test_queries:
        result = debug_search(query)
        print(f"Query '{query}': {result['total']} results")
        print()

