#!/usr/bin/env python3
"""
Test the Wikipedia content parsing to debug the infobox issue
"""

import sys
import os
sys.path.append('/home/ubuntu/ai-questions/local-version')

from wikipedia_search import WikipediaSearchEngine

def test_content_parsing():
    # Get the Poland article
    engine = WikipediaSearchEngine('./wikipedia.db')
    article = engine.get_article_by_title('Poland')
    
    if not article:
        print("Article not found")
        return
    
    print("=== RAW CONTENT (first 500 chars) ===")
    print(repr(article.content[:500]))
    print("\n=== RAW CONTENT (readable) ===")
    print(article.content[:1000])
    
    # Find where the actual article content starts
    lines = article.content.split('\n')
    for i, line in enumerate(lines):
        line = line.strip()
        if line and not line.startswith('|') and not line.startswith('{{') and not line.startswith('}}') and len(line) > 30:
            print(f"\n=== FIRST REAL CONTENT LINE (line {i}) ===")
            print(f"'{line}'")
            print(f"\n=== CONTENT FROM LINE {i} ===")
            print('\n'.join(lines[i:i+10]))
            break

if __name__ == '__main__':
    test_content_parsing()

