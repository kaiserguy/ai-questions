#!/usr/bin/env python3
"""
Wikipedia Download and Processing System
Downloads Wikipedia dumps and processes them for offline AI integration
"""

import os
import sys
import json
import sqlite3
import requests
import xml.etree.ElementTree as ET
from urllib.parse import urljoin
import bz2
import gzip
import re
import argparse
from datetime import datetime
import logging
from pathlib import Path

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class WikipediaDownloader:
    """Download and process Wikipedia dumps for offline use"""
    
    def __init__(self, data_dir="./wikipedia_data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(exist_ok=True)
        
        # Wikipedia dump URLs
        self.base_url = "https://dumps.wikimedia.org"
        
        # Available datasets
        self.datasets = {
            'simple': {
                'name': 'Simple English Wikipedia',
                'url': 'simplewiki/latest/simplewiki-latest-pages-articles.xml.bz2',
                'size_mb': 200,
                'articles': 200000,
                'description': 'Simplified English articles, perfect for basic knowledge'
            },
            'featured': {
                'name': 'English Wikipedia Featured Articles',
                'url': 'enwiki/latest/enwiki-latest-pages-articles1.xml-p1p41242.bz2',
                'size_mb': 50,
                'articles': 6000,
                'description': 'High-quality featured articles only'
            },
            'full': {
                'name': 'Full English Wikipedia',
                'url': 'enwiki/latest/enwiki-latest-pages-articles.xml.bz2',
                'size_mb': 20000,
                'articles': 6000000,
                'description': 'Complete English Wikipedia (very large)'
            }
        }
    
    def get_available_datasets(self):
        """Get list of available Wikipedia datasets"""
        return self.datasets
    
    def download_dataset(self, dataset_name, progress_callback=None):
        """Download a Wikipedia dataset"""
        if dataset_name not in self.datasets:
            raise ValueError(f"Unknown dataset: {dataset_name}")
        
        dataset = self.datasets[dataset_name]
        url = urljoin(self.base_url, dataset['url'])
        filename = self.data_dir / f"{dataset_name}_wikipedia.xml.bz2"
        
        logger.info(f"Downloading {dataset['name']} from {url}")
        
        try:
            response = requests.get(url, stream=True)
            response.raise_for_status()
            
            total_size = int(response.headers.get('content-length', 0))
            downloaded = 0
            
            with open(filename, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                        
                        if progress_callback and total_size > 0:
                            progress = (downloaded / total_size) * 100
                            progress_callback(progress, downloaded, total_size)
            
            logger.info(f"Downloaded {dataset['name']} to {filename}")
            return str(filename)
            
        except Exception as e:
            logger.error(f"Failed to download {dataset['name']}: {e}")
            if filename.exists():
                filename.unlink()
            raise
    
    def extract_and_process(self, compressed_file, db_path, progress_callback=None):
        """Extract and process Wikipedia XML dump into SQLite database"""
        logger.info(f"Processing {compressed_file} into {db_path}")
        
        # Initialize database
        db = WikipediaDatabase(db_path)
        db.initialize()
        
        # Process XML file
        try:
            with bz2.open(compressed_file, 'rt', encoding='utf-8') as f:
                processor = WikipediaXMLProcessor(db, progress_callback)
                processor.process_xml_stream(f)
            
            # Create search indexes
            db.create_search_index()
            
            logger.info("Wikipedia processing completed successfully")
            return db_path
            
        except Exception as e:
            logger.error(f"Failed to process Wikipedia dump: {e}")
            raise

class WikipediaXMLProcessor:
    """Process Wikipedia XML dumps"""
    
    def __init__(self, database, progress_callback=None):
        self.db = database
        self.progress_callback = progress_callback
        self.articles_processed = 0
        
        # Regex patterns for cleaning
        self.cleanup_patterns = [
            (r'\{\{[^}]*\}\}', ''),  # Remove templates
            (r'\[\[Category:[^\]]*\]\]', ''),  # Remove category links
            (r'\[\[File:[^\]]*\]\]', ''),  # Remove file links
            (r'\[\[Image:[^\]]*\]\]', ''),  # Remove image links
            (r'<ref[^>]*>.*?</ref>', ''),  # Remove references
            (r'<ref[^>]*\/>', ''),  # Remove self-closing refs
            (r'&lt;.*?&gt;', ''),  # Remove HTML entities
            (r'\n\s*\n', '\n'),  # Remove extra newlines
        ]
    
    def process_xml_stream(self, xml_file):
        """Process Wikipedia XML stream"""
        logger.info("Starting XML processing...")
        
        # Parse XML incrementally
        context = ET.iterparse(xml_file, events=('start', 'end'))
        context = iter(context)
        event, root = next(context)
        
        current_page = {}
        current_element = None
        
        for event, elem in context:
            current_element = elem.tag.split('}')[-1]  # Get tag name without namespace
            if event == 'end':
                #logger.info(current_element)
                if current_element == 'page':
                    # Process complete page
                    if self.is_valid_article(current_page):
                        self.process_article(current_page)
                        self.articles_processed += 1
                        
                        if self.progress_callback and self.articles_processed % 1000 == 0:
                            self.progress_callback(self.articles_processed)
                    
                    current_page = {}
                    root.clear()  # Free memory
                    
                elif current_element in ['title', 'text', 'id']:
                    current_page[current_element] = elem.text or ''

                current_element = None
    
    def is_valid_article(self, page):
        """Check if page is a valid article"""
        title = page.get('title', '')
        text = page.get('text', '')
        
        # Skip redirects, disambiguation, and special pages
        if (title.startswith('Category:') or 
            title.startswith('Template:') or 
            title.startswith('File:') or
            title.startswith('Wikipedia:') or
            '#REDIRECT' in text.upper() or
            len(text.strip()) < 100):
            return False
        
        return True
    
    def process_article(self, page):
        """Process and store a single article"""
        title = page.get('title', '').strip()
        content = page.get('text', '')
        article_id = page.get('id', '')
        
        # Clean content
        cleaned_content = self.clean_wikipedia_markup(content)
        
        # Extract summary (first paragraph)
        summary = self.extract_summary(cleaned_content)
        
        # Extract categories
        categories = self.extract_categories(content)
        
        # Store in database
        self.db.insert_article(
            article_id=article_id,
            title=title,
            content=cleaned_content,
            summary=summary,
            categories=categories
        )
    
    def clean_wikipedia_markup(self, text):
        """Clean Wikipedia markup from text"""
        # Apply cleanup patterns
        for pattern, replacement in self.cleanup_patterns:
            text = re.sub(pattern, replacement, text, flags=re.DOTALL | re.IGNORECASE)
        
        # Clean wiki links [[Link|Text]] -> Text
        text = re.sub(r'\[\[([^|\]]+\|)?([^\]]+)\]\]', r'\2', text)
        
        # Clean simple formatting
        text = re.sub(r"'''([^']+)'''", r'\1', text)  # Bold
        text = re.sub(r"''([^']+)''", r'\1', text)    # Italic
        
        # Clean up whitespace
        text = re.sub(r'\n\s*\n', '\n\n', text)
        text = text.strip()
        
        return text
    
    def extract_summary(self, content):
        """Extract article summary (first paragraph)"""
        paragraphs = content.split('\n\n')
        for para in paragraphs:
            para = para.strip()
            if len(para) > 50 and not para.startswith('='):
                return para[:500] + ('...' if len(para) > 500 else '')
        return ''
    
    def extract_categories(self, content):
        """Extract categories from article"""
        categories = re.findall(r'\[\[Category:([^\]]+)\]\]', content)
        return json.dumps(categories)

class WikipediaDatabase:
    """Database management for Wikipedia content"""
    
    def __init__(self, db_path):
        self.db_path = db_path
        self.conn = None
    
    def initialize(self):
        """Initialize database schema"""
        self.conn = sqlite3.connect(self.db_path)
        self.conn.execute('PRAGMA journal_mode=WAL')
        self.conn.execute('PRAGMA synchronous=NORMAL')
        self.conn.execute('PRAGMA cache_size=10000')
        
        # Create tables
        self.conn.executescript('''
            CREATE TABLE IF NOT EXISTS wikipedia_articles (
                id INTEGER PRIMARY KEY,
                article_id TEXT UNIQUE,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                summary TEXT,
                categories TEXT,
                word_count INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS wikipedia_metadata (
                key TEXT PRIMARY KEY,
                value TEXT
            );
            
            CREATE INDEX IF NOT EXISTS idx_title ON wikipedia_articles(title);
            CREATE INDEX IF NOT EXISTS idx_article_id ON wikipedia_articles(article_id);
        ''')
        
        self.conn.commit()
    
    def insert_article(self, article_id, title, content, summary, categories):
        """Insert article into database"""
        word_count = len(content.split())
        
        self.conn.execute('''
            INSERT OR REPLACE INTO wikipedia_articles 
            (article_id, title, content, summary, categories, word_count)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (article_id, title, content, summary, categories, word_count))
        
        # Commit every 1000 articles
        if self.conn.total_changes % 1000 == 0:
            self.conn.commit()
    
    def create_search_index(self):
        """Create full-text search index"""
        logger.info("Creating full-text search index...")
        
        self.conn.executescript('''
            CREATE VIRTUAL TABLE IF NOT EXISTS wikipedia_fts USING fts5(
                title, content, summary,
                content='wikipedia_articles',
                content_rowid='id'
            );
            
            INSERT INTO wikipedia_fts(wikipedia_fts) VALUES('rebuild');
        ''')
        
        self.conn.commit()
        logger.info("Search index created successfully")
    
    def get_stats(self):
        """Get database statistics"""
        cursor = self.conn.execute('''
            SELECT 
                COUNT(*) as total_articles,
                SUM(word_count) as total_words,
                AVG(word_count) as avg_words_per_article
            FROM wikipedia_articles
        ''')
        
        return cursor.fetchone()
    
    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.commit()
            self.conn.close()

def main():
    """Main CLI interface"""
    parser = argparse.ArgumentParser(description='Wikipedia Download and Processing Tool')
    parser.add_argument('--action', choices=['list', 'download', 'process'], required=True,
                       help='Action to perform')
    parser.add_argument('--dataset', choices=['simple', 'featured', 'full'],
                       help='Dataset to download/process')
    parser.add_argument('--data-dir', default='./wikipedia_data',
                       help='Directory for Wikipedia data')
    parser.add_argument('--db-path', default='./wikipedia.db',
                       help='SQLite database path')
    
    args = parser.parse_args()
    
    downloader = WikipediaDownloader(args.data_dir)
    
    if args.action == 'list':
        print("Available Wikipedia datasets:")
        for name, info in downloader.get_available_datasets().items():
            print(f"\n{name}:")
            print(f"  Name: {info['name']}")
            print(f"  Size: ~{info['size_mb']}MB")
            print(f"  Articles: ~{info['articles']:,}")
            print(f"  Description: {info['description']}")
    
    elif args.action == 'download':
        if not args.dataset:
            print("Error: --dataset required for download")
            sys.exit(1)
        
        def progress_callback(progress, downloaded, total):
            print(f"\rDownload progress: {progress:.1f}% ({downloaded:,}/{total:,} bytes)", end='')
        
        try:
            filename = downloader.download_dataset(args.dataset, progress_callback)
            print(f"\nDownload completed: {filename}")
        except Exception as e:
            print(f"\nDownload failed: {e}")
            sys.exit(1)
    
    elif args.action == 'process':
        if not args.dataset:
            print("Error: --dataset required for processing")
            sys.exit(1)
        
        compressed_file = Path(args.data_dir) / f"{args.dataset}_wikipedia.xml.bz2"
        if not compressed_file.exists():
            print(f"Error: {compressed_file} not found. Download first.")
            sys.exit(1)
        
        def progress_callback(articles_processed):
            print(f"\rProcessed {articles_processed:,} articles", end='')
        
        try:
            db_path = downloader.extract_and_process(compressed_file, args.db_path, progress_callback)
            print(f"\nProcessing completed: {db_path}")
            
            # Show statistics
            db = WikipediaDatabase(db_path)
            db.initialize()
            stats = db.get_stats()
            print(f"Stats: {stats}")
            # print(f"Total articles: {stats[0]:,}")
            # print(f"Total words: {stats[1]:,}")
            # print(f"Average words per article: {stats[2]:.1f}")
            db.close()
            
        except Exception as e:
            print(f"\nProcessing failed: {e}")
            sys.exit(1)

if __name__ == '__main__':
    main()

