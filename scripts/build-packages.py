#!/usr/bin/env python3
"""
Wikipedia Package Builder
Creates sized Wikipedia packages with Lunr.js indexes for offline use
"""

import os
import sys
import json
import gzip
import hashlib
import subprocess
from pathlib import Path
from datetime import datetime
import argparse
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class PackageBuilder:
    """Build Wikipedia packages with search indexes"""
    
    def __init__(self, input_file, output_dir='./wikipedia_packages'):
        self.input_file = Path(input_file)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True, parents=True)
        
        # Package configurations
        self.package_configs = {
            'minimal': {
                'name': 'Minimal Wikipedia Package',
                'target_size_mb': 20,
                'target_articles': 2500,
                'description': '2,000-3,000 most popular articles'
            },
            'standard': {
                'name': 'Standard Wikipedia Package',
                'target_size_mb': 50,
                'target_articles': 6000,
                'description': '5,000-7,000 articles'
            },
            'extended': {
                'name': 'Extended Wikipedia Package',
                'target_size_mb': 200,
                'target_articles': 25000,
                'description': '20,000-30,000 articles'
            }
        }
    
    def load_articles(self):
        """Load extracted articles"""
        logger.info(f"Loading articles from {self.input_file}")
        
        if not self.input_file.exists():
            raise FileNotFoundError(f"Input file not found: {self.input_file}")
        
        with open(self.input_file, 'r', encoding='utf-8') as f:
            articles = json.load(f)
        
        logger.info(f"Loaded {len(articles)} articles")
        return articles
    
    def select_articles_for_package(self, articles, config):
        """Select articles for a specific package size"""
        target_count = config['target_articles']
        logger.info(f"Selecting {target_count} articles for {config['name']}")
        
        # Sort by combined score (quality + popularity)
        sorted_articles = sorted(
            articles,
            key=lambda x: (
                x.get('quality_score', 0) * 0.6 + 
                (x.get('pageviews', 0) / 1000) * 0.4
            ),
            reverse=True
        )
        
        # Select top N articles
        selected = sorted_articles[:target_count]
        
        # Calculate actual size
        json_str = json.dumps(selected, ensure_ascii=False)
        size_mb = len(json_str.encode('utf-8')) / (1024 * 1024)
        
        logger.info(f"Selected {len(selected)} articles (~{size_mb:.2f} MB uncompressed)")
        
        return selected
    
    def create_package_json(self, articles, package_name):
        """Create JSON package"""
        output_file = self.output_dir / f'{package_name}-wikipedia.json'
        
        logger.info(f"Creating JSON package: {output_file}")
        
        # Prepare package data
        package_data = {
            'metadata': {
                'package_name': package_name,
                'created_at': datetime.utcnow().isoformat(),
                'article_count': len(articles),
                'version': '1.0.0'
            },
            'articles': articles
        }
        
        # Save JSON
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(package_data, f, ensure_ascii=False, indent=2)
        
        size_mb = output_file.stat().st_size / (1024 * 1024)
        logger.info(f"Created {output_file} ({size_mb:.2f} MB)")
        
        return output_file
    
    def compress_package(self, json_file):
        """Compress package with gzip"""
        import shutil
        
        output_file = Path(str(json_file) + '.gz')
        
        logger.info(f"Compressing {json_file}")
        
        with open(json_file, 'rb') as f_in:
            with gzip.open(output_file, 'wb', compresslevel=9) as f_out:
                shutil.copyfileobj(f_in, f_out)  # Memory-efficient streaming
        
        original_size = json_file.stat().st_size / (1024 * 1024)
        compressed_size = output_file.stat().st_size / (1024 * 1024)
        ratio = (1 - compressed_size / original_size) * 100
        
        logger.info(
            f"Compressed to {output_file} "
            f"({compressed_size:.2f} MB, {ratio:.1f}% reduction)"
        )
        
        return output_file
    
    def build_lunr_index(self, articles, package_name):
        """Build Lunr.js search index"""
        logger.info(f"Building Lunr.js index for {package_name}")
        
        # Create index data for Lunr
        index_data = []
        for i, article in enumerate(articles):
            index_data.append({
                'id': i,
                'title': article['title'],
                'summary': article.get('summary', ''),
                'content': article.get('content', '')[:1000]  # First 1000 chars
            })
        
        # Save index data
        index_file = self.output_dir / f'{package_name}-lunr-data.json'
        with open(index_file, 'w', encoding='utf-8') as f:
            json.dump(index_data, f, ensure_ascii=False)
        
        # Create Node.js script to build Lunr index
        lunr_script = self._create_lunr_builder_script(index_file, package_name)
        
        # Try to run Node.js script
        try:
            result = subprocess.run(
                ['node', lunr_script],
                capture_output=True,
                text=True,
                timeout=300
            )
            
            if result.returncode == 0:
                logger.info(f"Lunr index built successfully")
                return self.output_dir / f'{package_name}-lunr-index.json'
            else:
                logger.warning(f"Lunr index build failed: {result.stderr}")
                logger.info("Index data saved for manual processing")
                return index_file
                
        except FileNotFoundError:
            logger.warning("Node.js not found - skipping Lunr index build")
            logger.info(f"Index data saved to {index_file} for manual processing")
            return index_file
        except Exception as e:
            logger.warning(f"Error building Lunr index: {e}")
            return index_file
    
    def _create_lunr_builder_script(self, index_data_file, package_name):
        """Create Node.js script to build Lunr index"""
        script_file = self.output_dir / f'build-lunr-{package_name}.js'
        
        script_content = f"""
// Lunr.js Index Builder
// Auto-generated script to build search index

const fs = require('fs');
const path = require('path');

// Try to load lunr
let lunr;
try {{
    lunr = require('lunr');
}} catch (e) {{
    console.error('Error: lunr not found. Install with: npm install lunr');
    process.exit(1);
}}

// Load index data
const indexData = JSON.parse(
    fs.readFileSync('{index_data_file}', 'utf8')
);

console.log(`Building Lunr index for ${{indexData.length}} articles...`);

// Build index
const idx = lunr(function () {{
    this.ref('id');
    this.field('title', {{ boost: 10 }});
    this.field('summary', {{ boost: 5 }});
    this.field('content');
    
    indexData.forEach(doc => {{
        this.add(doc);
    }});
}});

// Save index
const outputFile = path.join(
    path.dirname('{index_data_file}'),
    '{package_name}-lunr-index.json'
);

fs.writeFileSync(
    outputFile,
    JSON.stringify({{
        index: idx,
        documents: indexData.map(doc => ({{
            id: doc.id,
            title: doc.title,
            summary: doc.summary
        }}))
    }}),
    'utf8'
);

console.log(`Lunr index saved to ${{outputFile}}`);
"""
        
        with open(script_file, 'w') as f:
            f.write(script_content)
        
        return script_file
    
    def calculate_checksum(self, file_path):
        """Calculate SHA-256 checksum"""
        sha256_hash = hashlib.sha256()
        
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        
        return sha256_hash.hexdigest()
    
    def create_checksums_file(self, files):
        """Create checksums file for all packages"""
        checksums_file = self.output_dir / 'SHA256SUMS.txt'
        
        logger.info("Calculating checksums...")
        
        with open(checksums_file, 'w') as f:
            f.write("# SHA-256 Checksums for Wikipedia Packages\n")
            f.write(f"# Generated: {datetime.utcnow().isoformat()}\n\n")
            
            for file_path in files:
                if file_path.exists():
                    checksum = self.calculate_checksum(file_path)
                    f.write(f"{checksum}  {file_path.name}\n")
                    logger.info(f"  {file_path.name}: {checksum[:16]}...")
        
        logger.info(f"Checksums saved to {checksums_file}")
        return checksums_file
    
    def build_all_packages(self):
        """Build all package sizes"""
        logger.info("Starting package build process")
        
        # Load articles
        all_articles = self.load_articles()
        
        created_files = []
        
        # Build each package size
        for package_name, config in self.package_configs.items():
            logger.info(f"\n{'='*60}")
            logger.info(f"Building {config['name']}")
            logger.info(f"{'='*60}")
            
            # Select articles
            articles = self.select_articles_for_package(all_articles, config)
            
            # Create JSON package
            json_file = self.create_package_json(articles, package_name)
            created_files.append(json_file)
            
            # Compress package
            compressed_file = self.compress_package(json_file)
            created_files.append(compressed_file)
            
            # Build Lunr index
            index_file = self.build_lunr_index(articles, package_name)
            if index_file:
                created_files.append(index_file)
        
        # Create checksums
        checksum_file = self.create_checksums_file(created_files)
        
        # Create summary
        self._create_summary(created_files)
        
        logger.info("\n" + "="*60)
        logger.info("Package build completed successfully!")
        logger.info("="*60)
    
    def _create_summary(self, created_files):
        """Create build summary"""
        summary_file = self.output_dir / 'BUILD_SUMMARY.txt'
        
        with open(summary_file, 'w') as f:
            f.write("Wikipedia Package Build Summary\n")
            f.write("="*60 + "\n\n")
            f.write(f"Build Date: {datetime.utcnow().isoformat()}\n\n")
            
            f.write("Created Files:\n")
            f.write("-"*60 + "\n")
            
            for file_path in sorted(created_files):
                if file_path.exists():
                    size_mb = file_path.stat().st_size / (1024 * 1024)
                    f.write(f"  {file_path.name:<40} {size_mb:>8.2f} MB\n")
            
            f.write("\n")
            f.write("Package Configurations:\n")
            f.write("-"*60 + "\n")
            
            for name, config in self.package_configs.items():
                f.write(f"  {config['name']}:\n")
                f.write(f"    Target Size: {config['target_size_mb']} MB\n")
                f.write(f"    Articles: ~{config['target_articles']:,}\n")
                f.write(f"    Description: {config['description']}\n\n")
        
        logger.info(f"Build summary saved to {summary_file}")


def main():
    """Main CLI interface"""
    parser = argparse.ArgumentParser(
        description='Build Wikipedia packages with Lunr.js indexes'
    )
    parser.add_argument(
        '--input',
        default='./wikipedia_output/extracted_articles.json',
        help='Input JSON file with extracted articles'
    )
    parser.add_argument(
        '--output-dir',
        default='./wikipedia_packages',
        help='Output directory for packages'
    )
    parser.add_argument(
        '--package',
        choices=['minimal', 'standard', 'extended', 'all'],
        default='all',
        help='Package to build (default: all)'
    )
    
    args = parser.parse_args()
    
    builder = PackageBuilder(args.input, args.output_dir)
    
    try:
        if args.package == 'all':
            builder.build_all_packages()
        else:
            # Build single package
            all_articles = builder.load_articles()
            config = builder.package_configs[args.package]
            
            articles = builder.select_articles_for_package(all_articles, config)
            json_file = builder.create_package_json(articles, args.package)
            compressed_file = builder.compress_package(json_file)
            index_file = builder.build_lunr_index(articles, args.package)
            
            files = [json_file, compressed_file]
            if index_file:
                files.append(index_file)
            
            builder.create_checksums_file(files)
            
        logger.info("Build completed successfully!")
        
    except KeyboardInterrupt:
        logger.info("Build interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Build failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
