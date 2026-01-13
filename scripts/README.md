# Wikipedia Article Extraction Pipeline

This pipeline extracts and packages Wikipedia articles for offline use with search capabilities.

## Overview

The Wikipedia extraction pipeline consists of two main scripts:

1. **extract-wikipedia.py** - Downloads and extracts articles from Wikipedia dumps
2. **build-packages.py** - Creates sized packages with Lunr.js search indexes

## Features

- **Automated Download**: Downloads Wikipedia XML dumps from Wikimedia
- **Article Selection**: Selects articles based on:
  - Page view statistics (popularity)
  - Quality scores (featured/good articles)
  - Content length and completeness
  - Category coverage
- **Multiple Package Sizes**:
  - **Minimal (20MB)**: 2,000-3,000 most popular articles
  - **Standard (50MB)**: 5,000-7,000 articles
  - **Extended (200MB)**: 20,000-30,000 articles
- **Search Indexing**: Builds Lunr.js indexes for fast client-side search
- **Compression**: Gzip compression for efficient distribution
- **Checksums**: SHA-256 checksums for integrity verification

## Installation

### Prerequisites

- Python 3.7+
- Node.js (for Lunr.js index building)
- ~5GB free disk space (for processing)

### Install Python Dependencies

```bash
cd scripts
pip install -r requirements.txt
```

### Install Node.js Dependencies (for Lunr indexes)

```bash
npm install -g lunr
```

## Usage

### Step 1: Extract Articles

Download and extract Wikipedia articles:

```bash
python extract-wikipedia.py --dataset simple --output-dir ./wikipedia_output
```

**Options:**
- `--dataset`: Choose 'simple' (Simple English) or 'english' (English Wikipedia)
- `--output-dir`: Directory for output files
- `--max-articles`: Limit number of articles (for testing)
- `--skip-download`: Use existing downloaded files

**Example with limited articles (for testing):**
```bash
python extract-wikipedia.py --dataset simple --max-articles 10000
```

### Step 2: Build Packages

Create sized packages with search indexes:

```bash
python build-packages.py --input ./wikipedia_output/extracted_articles.json --output-dir ./wikipedia_packages
```

**Options:**
- `--input`: Path to extracted articles JSON
- `--output-dir`: Directory for package files
- `--package`: Build specific package ('minimal', 'standard', 'extended', or 'all')

**Example building single package:**
```bash
python build-packages.py --package minimal
```

## Output Files

### After Extraction (extract-wikipedia.py)

```
wikipedia_output/
├── simple_wikipedia.xml.bz2          # Downloaded Wikipedia dump
├── simple_pageviews.gz               # Page view statistics
├── extracted_articles.json           # All extracted articles
└── wikipedia_extraction.log          # Extraction log
```

### After Package Building (build-packages.py)

```
wikipedia_packages/
├── minimal-wikipedia.json            # Minimal package (uncompressed)
├── minimal-wikipedia.json.gz         # Minimal package (compressed)
├── minimal-lunr-data.json            # Search index data
├── minimal-lunr-index.json           # Lunr.js search index
├── standard-wikipedia.json           # Standard package
├── standard-wikipedia.json.gz
├── standard-lunr-data.json
├── standard-lunr-index.json
├── extended-wikipedia.json           # Extended package
├── extended-wikipedia.json.gz
├── extended-lunr-data.json
├── extended-lunr-index.json
├── SHA256SUMS.txt                    # Checksums for all files
└── BUILD_SUMMARY.txt                 # Build statistics
```

## Article Selection Criteria

Articles are scored based on:

1. **Popularity** (40% weight):
   - Page view statistics
   - Higher views = higher score

2. **Quality** (60% weight):
   - Featured articles: +5 points
   - Good articles: +3 points
   - Vital articles: +2 points
   - Content length: up to +2 points
   - Category coverage: up to +1 point

## Package Sizes

| Package  | Target Size | Articles      | Use Case                    |
|----------|-------------|---------------|-----------------------------|
| Minimal  | ~20 MB      | 2,000-3,000   | Basic offline reference     |
| Standard | ~50 MB      | 5,000-7,000   | Comprehensive knowledge     |
| Extended | ~200 MB     | 20,000-30,000 | Extensive offline library   |

*Note: Actual sizes may vary based on article content and compression*

## Advanced Usage

### Extract with Custom Criteria

Modify the quality score calculation in `extract-wikipedia.py`:

```python
def _calculate_quality_score(self, title, content, categories, criteria):
    # Customize scoring logic here
    score = 0.0
    # ... your custom criteria
    return score
```

### Custom Package Configuration

Edit `build-packages.py` package configurations:

```python
self.package_configs = {
    'custom': {
        'name': 'Custom Package',
        'target_size_mb': 100,
        'target_articles': 10000,
        'description': 'Custom article selection'
    }
}
```

## Integration with AI Questions App

### Deployment

1. Build packages with this pipeline
2. Upload compressed packages to CDN or hosting
3. Update package URLs in the application
4. Deploy Lunr indexes alongside packages

### Using in Application

The generated packages integrate with the existing Wikipedia infrastructure:

```javascript
// Load package
const response = await fetch('/offline-resources/wikipedia/minimal-wikipedia.json.gz');
const articles = await response.json();

// Load search index
const indexResponse = await fetch('/offline-resources/wikipedia/minimal-lunr-index.json');
const searchIndex = await indexResponse.json();
```

## Troubleshooting

### Download Issues

**Problem**: Download fails or times out
**Solution**: 
- Check internet connection
- Use `--skip-download` to resume with existing files
- Try a different mirror (edit URLs in script)

### Memory Issues

**Problem**: Out of memory during extraction
**Solution**:
- Use `--max-articles` to limit processing
- Process in smaller batches
- Increase system RAM or swap space

### Lunr Index Build Fails

**Problem**: Node.js not found or lunr not installed
**Solution**:
```bash
# Install Node.js (Ubuntu/Debian)
sudo apt-get install nodejs npm

# Install lunr globally
npm install -g lunr
```

### Package Too Large/Small

**Problem**: Package doesn't meet target size
**Solution**:
- Adjust `target_articles` in package config
- Modify article selection criteria
- Change compression settings

## Performance

### Extraction Performance

- **Simple English Wikipedia**: ~2-3 hours
- **English Wikipedia (full)**: ~8-12 hours
- **Memory usage**: ~2-4 GB RAM
- **Disk space needed**: ~5-10 GB temporary

### Package Building Performance

- **Per package**: ~5-10 minutes
- **Memory usage**: ~1-2 GB RAM
- **All packages**: ~15-30 minutes total

## Maintenance

### Updating Packages

Wikipedia is updated regularly. To refresh packages:

```bash
# Remove old dumps
rm -rf wikipedia_output/*.bz2 wikipedia_output/*.gz

# Extract fresh articles
python extract-wikipedia.py --dataset simple

# Rebuild packages
python build-packages.py
```

### Scheduled Updates

For automated updates, create a cron job:

```bash
# Update weekly on Sunday at 2 AM
0 2 * * 0 cd /path/to/scripts && ./update_wikipedia.sh
```

## Architecture

### Extraction Pipeline

```
Wikipedia Dumps → Download → Parse XML → Extract Articles → 
Select by Criteria → Clean Content → Output JSON
```

### Package Building Pipeline

```
Extracted JSON → Select Top N → Create Packages → 
Build Lunr Indexes → Compress → Calculate Checksums
```

## Data Format

### Article Structure

```json
{
  "id": "12345",
  "title": "Artificial Intelligence",
  "content": "Full article text...",
  "summary": "First paragraph summary...",
  "categories": ["Computer Science", "AI"],
  "quality_score": 8.5,
  "pageviews": 125000,
  "word_count": 3500,
  "url": "https://en.wikipedia.org/wiki/Artificial_Intelligence"
}
```

### Package Structure

```json
{
  "metadata": {
    "package_name": "minimal",
    "created_at": "2026-01-13T08:00:00Z",
    "article_count": 2500,
    "version": "1.0.0"
  },
  "articles": [ /* array of articles */ ]
}
```

## Testing

### Test Extraction (Small Sample)

```bash
python extract-wikipedia.py --dataset simple --max-articles 100 --output-dir ./test_output
```

### Test Package Building

```bash
python build-packages.py --input ./test_output/extracted_articles.json --package minimal
```

### Verify Checksums

```bash
cd wikipedia_packages
sha256sum -c SHA256SUMS.txt
```

## Dependencies

See `requirements.txt` for complete list:

- `mwparserfromhell` - Wikipedia markup parsing
- `mwxml` - XML dump processing
- `requests` - HTTP downloads
- `beautifulsoup4` - HTML/XML parsing
- `tqdm` - Progress bars

## Contributing

To improve the pipeline:

1. **Better Selection Criteria**: Enhance quality scoring
2. **Faster Processing**: Optimize XML parsing
3. **Additional Datasets**: Add more Wikipedia editions
4. **Better Compression**: Explore better compression methods
5. **Incremental Updates**: Support for differential updates

## License

MIT License - Same as parent project

## Credits

- Wikipedia content is licensed under CC BY-SA 3.0
- Wikimedia Foundation for providing dumps
- mwparserfromhell and mwxml libraries

## Support

For issues or questions:
- Check troubleshooting section
- Review logs in `wikipedia_extraction.log`
- Open issue on GitHub repository

## Next Steps

After building packages:

1. Test packages locally
2. Upload to CDN/hosting
3. Update application URLs
4. Test offline functionality
5. Deploy to production

---

**Note**: This pipeline is designed for Phase 2 of the Wikipedia integration project. It generates packages for the hosted/offline versions of AI Questions.
