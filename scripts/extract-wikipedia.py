#!/usr/bin/env python3
"""
Wikipedia Article Extraction Pipeline
Downloads and extracts Wikipedia articles for offline use with selection criteria
"""

import os
import sys
import json
import sqlite3
import requests
import re
import bz2
import gzip
import hashlib
from pathlib import Path
from datetime import datetime
from urllib.parse import urljoin
import argparse
import logging

try:
    import mwparserfromhell
    import mwxml
    from tqdm import tqdm
except ImportError as e:
    print(f"Error: Missing required dependency: {e}")
    print("Install dependencies with: pip install -r requirements.txt")
    sys.exit(1)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('wikipedia_extraction.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class WikipediaExtractor:
    """Extract and process Wikipedia articles"""
    
    def __init__(self, output_dir='./wikipedia_output'):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True, parents=True)
        
        # Wikipedia dump URLs
        self.base_url = "https://dumps.wikimedia.org"
        
        # Dataset configurations
        self.datasets = {
            'simple': {
                'name': 'Simple English Wikipedia',
                'url': 'simplewiki/latest/simplewiki-latest-pages-articles.xml.bz2',
                'pageviews_url': 'simplewiki/latest/simplewiki-latest-pageviews.gz',
                'expected_size_mb': 200,
                'description': 'Simplified English articles'
            },
            'english': {
                'name': 'English Wikipedia',
                'url': 'enwiki/latest/enwiki-latest-pages-articles1.xml-p1p41242.bz2',
                'pageviews_url': 'enwiki/latest/enwiki-latest-pageviews.gz',
                'expected_size_mb': 1000,
                'description': 'First segment of English Wikipedia'
            }
        }
        
        # Article selection criteria
        self.featured_articles = set()
        self.good_articles = set()
        self.vital_articles = set()
        self.article_pageviews = {}
        
    def download_file(self, url, dest_path, description="Downloading"):
        """Download a file with progress bar"""
        logger.info(f"Downloading from {url}")
        
        try:
            response = requests.get(url, stream=True)
            response.raise_for_status()
            
            total_size = int(response.headers.get('content-length', 0))
            
            with open(dest_path, 'wb') as f, tqdm(
                desc=description,
                total=total_size,
                unit='iB',
                unit_scale=True,
                unit_divisor=1024,
            ) as pbar:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        pbar.update(len(chunk))
            
            logger.info(f"Downloaded to {dest_path}")
            return str(dest_path)
            
        except Exception as e:
            logger.error(f"Download failed: {e}")
            if dest_path.exists():
                dest_path.unlink()
            raise
    
    def download_dataset(self, dataset_name):
        """Download Wikipedia XML dump"""
        if dataset_name not in self.datasets:
            raise ValueError(f"Unknown dataset: {dataset_name}")
        
        dataset = self.datasets[dataset_name]
        url = urljoin(self.base_url, dataset['url'])
        filename = self.output_dir / f"{dataset_name}_wikipedia.xml.bz2"
        
        if filename.exists():
            logger.info(f"Dataset already exists: {filename}")
            return str(filename)
        
        return self.download_file(url, filename, f"Downloading {dataset['name']}")
    
    def download_pageviews(self, dataset_name):
        """Download page view statistics"""
        if dataset_name not in self.datasets:
            return None
        
        dataset = self.datasets[dataset_name]
        if 'pageviews_url' not in dataset:
            return None
        
        url = urljoin(self.base_url, dataset['pageviews_url'])
        filename = self.output_dir / f"{dataset_name}_pageviews.gz"
        
        try:
            if filename.exists():
                logger.info(f"Pageviews already exist: {filename}")
            else:
                self.download_file(url, filename, "Downloading pageviews")
            return str(filename)
        except Exception as e:
            logger.warning(f"Could not download pageviews: {e}")
            return None
    
    def parse_pageviews(self, pageviews_file):
        """Parse page view statistics"""
        if not pageviews_file or not Path(pageviews_file).exists():
            logger.warning("No pageviews file available")
            return {}
        
        logger.info("Parsing pageviews...")
        pageviews = {}
        
        try:
            with gzip.open(pageviews_file, 'rt', encoding='utf-8') as f:
                for line_num, line in enumerate(f):
                    if line_num > 100000:  # Limit for performance
                        break
                    parts = line.strip().split()
                    if len(parts) >= 3:
                        title = parts[1]
                        views = int(parts[2])
                        pageviews[title] = views
        except Exception as e:
            logger.warning(f"Error parsing pageviews: {e}")
        
        logger.info(f"Parsed {len(pageviews)} pageview entries")
        return pageviews
    
    def extract_articles(self, dump_file, max_articles=None, selection_criteria=None):
        """Extract articles from Wikipedia dump"""
        logger.info(f"Extracting articles from {dump_file}")
        
        articles = []
        criteria = selection_criteria or {}
        
        try:
            dump = mwxml.Dump.from_file(bz2.open(dump_file))
            
            with tqdm(desc="Processing articles", unit=" articles") as pbar:
                for page in dump:
                    if max_articles and len(articles) >= max_articles:
                        break
                    
                    # Skip non-article pages
                    if page.namespace != 0:
                        continue
                    
                    # Get latest revision
                    for revision in page:
                        try:
                            article = self._process_article(page, revision, criteria)
                            if article:
                                articles.append(article)
                                pbar.update(1)
                        except Exception as e:
                            logger.debug(f"Error processing article {page.title}: {e}")
                        break  # Only process latest revision
        
        except Exception as e:
            logger.error(f"Error extracting articles: {e}")
            raise
        
        logger.info(f"Extracted {len(articles)} articles")
        return articles
    
    def _process_article(self, page, revision, criteria):
        """Process a single article"""
        title = page.title
        text = revision.text or ""
        
        # Skip redirects and short articles
        if '#REDIRECT' in text.upper() or len(text) < 500:
            return None
        
        # Parse wiki markup
        try:
            wikicode = mwparserfromhell.parse(text)
            
            # Extract plain text
            plain_text = wikicode.strip_code()
            
            # Clean up
            plain_text = self._clean_text(plain_text)
            
            # Skip if too short after cleaning
            if len(plain_text) < 200:
                return None
            
            # Extract summary (first paragraph)
            summary = self._extract_summary(plain_text)
            
            # Extract categories
            categories = self._extract_categories(wikicode)
            
            # Calculate quality score
            quality_score = self._calculate_quality_score(
                title, plain_text, categories, criteria
            )
            
            # Get pageviews
            pageviews = self.article_pageviews.get(title.replace(' ', '_'), 0)
            
            return {
                'id': page.id,
                'title': title,
                'content': plain_text,
                'summary': summary,
                'categories': categories,
                'quality_score': quality_score,
                'pageviews': pageviews,
                'word_count': len(plain_text.split()),
                'url': f'https://en.wikipedia.org/wiki/{title.replace(" ", "_")}'
            }
            
        except Exception as e:
            logger.debug(f"Error parsing {title}: {e}")
            return None
    
    def _clean_text(self, text):
        """Clean extracted text"""
        # Remove multiple newlines
        text = re.sub(r'\n\s*\n', '\n\n', text)
        
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text)
        
        # Remove common artifacts
        text = re.sub(r'\[edit\]', '', text)
        text = re.sub(r'\{\{[^}]*\}\}', '', text)
        
        return text.strip()
    
    def _extract_summary(self, text):
        """Extract article summary (first paragraph)"""
        paragraphs = text.split('\n\n')
        for para in paragraphs:
            para = para.strip()
            if len(para) > 100:
                # Take first 500 characters
                return para[:500] + ('...' if len(para) > 500 else '')
        return text[:500] if text else ""
    
    def _extract_categories(self, wikicode):
        """Extract categories from wikicode"""
        categories = []
        for link in wikicode.filter_wikilinks():
            title = str(link.title)
            if title.startswith('Category:'):
                category = title[9:].strip()
                categories.append(category)
        return categories
    
    def _calculate_quality_score(self, title, content, categories, criteria):
        """Calculate article quality score"""
        score = 0.0
        
        # Length bonus (articles with more content are generally better)
        word_count = len(content.split())
        if word_count > 1000:
            score += 2.0
        elif word_count > 500:
            score += 1.0
        
        # Category bonus (well-categorized articles are better)
        if len(categories) > 3:
            score += 1.0
        elif len(categories) > 1:
            score += 0.5
        
        # Featured article bonus
        if title in self.featured_articles:
            score += 5.0
        
        # Good article bonus
        if title in self.good_articles:
            score += 3.0
        
        # Vital article bonus
        if title in self.vital_articles:
            score += 2.0
        
        # Pageview bonus
        pageviews = self.article_pageviews.get(title.replace(' ', '_'), 0)
        if pageviews > 10000:
            score += 3.0
        elif pageviews > 1000:
            score += 2.0
        elif pageviews > 100:
            score += 1.0
        
        return score
    
    def select_top_articles(self, articles, count, criteria='balanced'):
        """Select top N articles based on criteria"""
        logger.info(f"Selecting top {count} articles using '{criteria}' criteria")
        
        if criteria == 'popularity':
            # Sort by pageviews
            sorted_articles = sorted(
                articles,
                key=lambda x: x.get('pageviews', 0),
                reverse=True
            )
        elif criteria == 'quality':
            # Sort by quality score
            sorted_articles = sorted(
                articles,
                key=lambda x: x.get('quality_score', 0),
                reverse=True
            )
        elif criteria == 'balanced':
            # Sort by combined score
            sorted_articles = sorted(
                articles,
                key=lambda x: (
                    x.get('quality_score', 0) * 0.6 + 
                    (x.get('pageviews', 0) / 1000) * 0.4
                ),
                reverse=True
            )
        elif criteria == 'recent':
            # For now, just use quality since we don't have timestamps
            sorted_articles = sorted(
                articles,
                key=lambda x: x.get('quality_score', 0),
                reverse=True
            )
        else:
            sorted_articles = articles
        
        return sorted_articles[:count]
    
    def save_articles_json(self, articles, output_file):
        """Save articles as JSON"""
        logger.info(f"Saving {len(articles)} articles to {output_file}")
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(articles, f, ensure_ascii=False, indent=2)
        
        # Calculate file size
        size_mb = Path(output_file).stat().st_size / (1024 * 1024)
        logger.info(f"Saved to {output_file} ({size_mb:.2f} MB)")
        
        return output_file
    
    def calculate_checksum(self, file_path):
        """Calculate SHA-256 checksum"""
        sha256_hash = hashlib.sha256()
        
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        
        return sha256_hash.hexdigest()


def main():
    """Main CLI interface"""
    parser = argparse.ArgumentParser(
        description='Wikipedia Article Extraction Pipeline'
    )
    parser.add_argument(
        '--dataset',
        choices=['simple', 'english'],
        default='simple',
        help='Dataset to download and process'
    )
    parser.add_argument(
        '--output-dir',
        default='./wikipedia_output',
        help='Output directory for extracted data'
    )
    parser.add_argument(
        '--max-articles',
        type=int,
        help='Maximum number of articles to extract (for testing)'
    )
    parser.add_argument(
        '--skip-download',
        action='store_true',
        help='Skip download step (use existing files)'
    )
    
    args = parser.parse_args()
    
    extractor = WikipediaExtractor(args.output_dir)
    
    try:
        # Step 1: Download dataset
        if not args.skip_download:
            dump_file = extractor.download_dataset(args.dataset)
            pageviews_file = extractor.download_pageviews(args.dataset)
            
            # Parse pageviews
            if pageviews_file:
                extractor.article_pageviews = extractor.parse_pageviews(pageviews_file)
        else:
            dump_file = extractor.output_dir / f"{args.dataset}_wikipedia.xml.bz2"
            if not dump_file.exists():
                logger.error(f"Dump file not found: {dump_file}")
                sys.exit(1)
        
        # Step 2: Extract articles
        logger.info("Extracting articles...")
        articles = extractor.extract_articles(dump_file, max_articles=args.max_articles)
        
        if not articles:
            logger.error("No articles extracted!")
            sys.exit(1)
        
        # Step 3: Save raw extracted data
        raw_output = extractor.output_dir / 'extracted_articles.json'
        extractor.save_articles_json(articles, raw_output)
        
        logger.info(f"Extraction completed successfully!")
        logger.info(f"Total articles extracted: {len(articles)}")
        logger.info(f"Raw data saved to: {raw_output}")
        logger.info("Run build-packages.py to create sized packages")
        
    except KeyboardInterrupt:
        logger.info("Extraction interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Extraction failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
