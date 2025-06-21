#!/usr/bin/env python3
"""
Test script to demonstrate the enhanced Wikipedia search and logging functionality
"""

import json
import sys
import os

# Add the current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from enhanced_wikipedia_api import EnhancedWikipediaAPI

def test_wikipedia_search():
    """Test the enhanced Wikipedia search with detailed logging"""
    
    print("🔍 Testing Enhanced Wikipedia Search with Query Logging")
    print("=" * 60)
    
    # Initialize the enhanced API
    api = EnhancedWikipediaAPI()
    
    # Test questions
    test_questions = [
        "What is Poland?",
        "Tell me about artificial intelligence",
        "What is the capital of France?"
    ]
    
    for i, question in enumerate(test_questions, 1):
        print(f"\n📝 Test {i}: {question}")
        print("-" * 40)
        
        try:
            # Perform enhanced search
            result = api.search_with_multiple_queries(question, limit=3)
            
            # Display status logs (what the user would see)
            print("📊 Status Logs:")
            for log_entry in result.get('status_log', []):
                print(f"   • {log_entry}")
            
            # Display search queries (SQL-like queries)
            print(f"\n🔍 Generated Search Queries:")
            for query in result.get('search_queries', []):
                print(f"   • '{query}'")
            
            # Display results
            print(f"\n✅ Results Found: {len(result.get('results', []))}")
            for j, article in enumerate(result.get('results', []), 1):
                print(f"   {j}. {article['title']} (relevance: {article['relevance_score']:.2f})")
                print(f"      Preview: {article['snippet'][:100]}...")
            
            print(f"\n📈 Total Articles Searched: {result.get('total_articles_searched', 0)}")
            
        except Exception as e:
            print(f"❌ Error: {e}")
        
        print("\n" + "=" * 60)

if __name__ == "__main__":
    test_wikipedia_search()

