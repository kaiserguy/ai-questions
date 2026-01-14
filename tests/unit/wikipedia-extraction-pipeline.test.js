/**
 * Tests for Wikipedia Extraction Pipeline Scripts
 * Validates script structure, dependencies, and documentation
 */

const fs = require('fs');
const path = require('path');

describe('Wikipedia Extraction Pipeline Tests', () => {
    const scriptsDir = path.join(__dirname, '../../scripts');
    
    describe('Directory Structure', () => {
        test('scripts directory should exist', () => {
            expect(fs.existsSync(scriptsDir)).toBe(true);
        });
        
        test('should have requirements.txt', () => {
            const reqFile = path.join(scriptsDir, 'requirements.txt');
            expect(fs.existsSync(reqFile)).toBe(true);
        });
        
        test('should have extract-wikipedia.py', () => {
            const extractFile = path.join(scriptsDir, 'extract-wikipedia.py');
            expect(fs.existsSync(extractFile)).toBe(true);
        });
        
        test('should have build-packages.py', () => {
            const buildFile = path.join(scriptsDir, 'build-packages.py');
            expect(fs.existsSync(buildFile)).toBe(true);
        });
        
        test('should have README.md', () => {
            const readmeFile = path.join(scriptsDir, 'README.md');
            expect(fs.existsSync(readmeFile)).toBe(true);
        });
    });
    
    describe('Python Scripts Validation', () => {
        let extractScript, buildScript;
        
        beforeAll(() => {
            extractScript = fs.readFileSync(
                path.join(scriptsDir, 'extract-wikipedia.py'),
                'utf8'
            );
            buildScript = fs.readFileSync(
                path.join(scriptsDir, 'build-packages.py'),
                'utf8'
            );
        });
        
        describe('extract-wikipedia.py', () => {
            test('should have shebang', () => {
                expect(extractScript.startsWith('#!/usr/bin/env python3')).toBe(true);
            });
            
            test('should import required modules', () => {
                expect(extractScript).toContain('import mwparserfromhell');
                expect(extractScript).toContain('import mwxml');
                expect(extractScript).toContain('import requests');
            });
            
            test('should have WikipediaExtractor class', () => {
                expect(extractScript).toContain('class WikipediaExtractor');
            });
            
            test('should handle download functionality', () => {
                expect(extractScript).toContain('def download_dataset');
                expect(extractScript).toContain('def download_pageviews');
            });
            
            test('should handle article extraction', () => {
                expect(extractScript).toContain('def extract_articles');
                expect(extractScript).toContain('def _process_article');
            });
            
            test('should implement article selection criteria', () => {
                expect(extractScript).toContain('def _calculate_quality_score');
                expect(extractScript).toContain('quality_score');
                expect(extractScript).toContain('pageviews');
            });
            
            test('should have article cleaning methods', () => {
                expect(extractScript).toContain('def _clean_text');
                expect(extractScript).toContain('def _extract_summary');
                expect(extractScript).toContain('def _extract_categories');
            });
            
            test('should support command-line arguments', () => {
                expect(extractScript).toContain('argparse');
                expect(extractScript).toContain('--dataset');
                expect(extractScript).toContain('--output-dir');
            });
            
            test('should have logging setup', () => {
                expect(extractScript).toContain('import logging');
                expect(extractScript).toContain('logger');
            });
            
            test('should have main function', () => {
                expect(extractScript).toContain('def main()');
                expect(extractScript).toContain('if __name__ == "__main__"');
            });
        });
        
        describe('build-packages.py', () => {
            test('should have shebang', () => {
                expect(buildScript.startsWith('#!/usr/bin/env python3')).toBe(true);
            });
            
            test('should import required modules', () => {
                expect(buildScript).toContain('import json');
                expect(buildScript).toContain('import gzip');
                expect(buildScript).toContain('import hashlib');
            });
            
            test('should have PackageBuilder class', () => {
                expect(buildScript).toContain('class PackageBuilder');
            });
            
            test('should define package configurations', () => {
                expect(buildScript).toContain('minimal');
                expect(buildScript).toContain('standard');
                expect(buildScript).toContain('extended');
                expect(buildScript).toContain('target_size_mb');
                expect(buildScript).toContain('target_articles');
            });
            
            test('should have correct package sizes', () => {
                expect(buildScript).toContain('20'); // 20MB minimal
                expect(buildScript).toContain('50'); // 50MB standard
                expect(buildScript).toContain('200'); // 200MB extended
            });
            
            test('should handle article selection', () => {
                expect(buildScript).toContain('def select_articles_for_package');
                expect(buildScript).toContain('quality_score');
                expect(buildScript).toContain('pageviews');
            });
            
            test('should create JSON packages', () => {
                expect(buildScript).toContain('def create_package_json');
                expect(buildScript).toContain('package_data');
                expect(buildScript).toContain('metadata');
            });
            
            test('should support compression', () => {
                expect(buildScript).toContain('def compress_package');
                expect(buildScript).toContain('gzip.open');
            });
            
            test('should build Lunr indexes', () => {
                expect(buildScript).toContain('def build_lunr_index');
                expect(buildScript).toContain('lunr');
            });
            
            test('should calculate checksums', () => {
                expect(buildScript).toContain('def calculate_checksum');
                expect(buildScript).toContain('sha256');
            });
            
            test('should create checksums file', () => {
                expect(buildScript).toContain('SHA256SUMS');
            });
            
            test('should support command-line arguments', () => {
                expect(buildScript).toContain('argparse');
                expect(buildScript).toContain('--input');
                expect(buildScript).toContain('--output-dir');
            });
            
            test('should have main function', () => {
                expect(buildScript).toContain('def main()');
                expect(buildScript).toContain('if __name__ == "__main__"');
            });
        });
    });
    
    describe('Requirements File', () => {
        let requirementsContent;
        
        beforeAll(() => {
            requirementsContent = fs.readFileSync(
                path.join(scriptsDir, 'requirements.txt'),
                'utf8'
            );
        });
        
        test('should include mwparserfromhell', () => {
            expect(requirementsContent).toContain('mwparserfromhell');
        });
        
        test('should include mwxml', () => {
            expect(requirementsContent).toContain('mwxml');
        });
        
        test('should include requests', () => {
            expect(requirementsContent).toContain('requests');
        });
        
        test('should include beautifulsoup4', () => {
            expect(requirementsContent).toContain('beautifulsoup4');
        });
        
        test('should include tqdm for progress bars', () => {
            expect(requirementsContent).toContain('tqdm');
        });
    });
    
    describe('README Documentation', () => {
        let readmeContent;
        
        beforeAll(() => {
            readmeContent = fs.readFileSync(
                path.join(scriptsDir, 'README.md'),
                'utf8'
            );
        });
        
        test('should have title', () => {
            expect(readmeContent).toContain('# Wikipedia Article Extraction Pipeline');
        });
        
        test('should document both scripts', () => {
            expect(readmeContent).toContain('extract-wikipedia.py');
            expect(readmeContent).toContain('build-packages.py');
        });
        
        test('should document installation steps', () => {
            expect(readmeContent).toContain('## Installation');
            expect(readmeContent).toContain('pip install -r requirements.txt');
        });
        
        test('should document usage', () => {
            expect(readmeContent).toContain('## Usage');
            expect(readmeContent).toContain('python extract-wikipedia.py');
            expect(readmeContent).toContain('python build-packages.py');
        });
        
        test('should document package sizes', () => {
            expect(readmeContent).toContain('Minimal');
            expect(readmeContent).toContain('Standard');
            expect(readmeContent).toContain('Extended');
            expect(readmeContent).toContain('20');
            expect(readmeContent).toContain('50');
            expect(readmeContent).toContain('200');
        });
        
        test('should document article selection criteria', () => {
            expect(readmeContent).toContain('Article Selection Criteria');
            expect(readmeContent).toContain('Popularity');
            expect(readmeContent).toContain('Quality');
        });
        
        test('should document output files', () => {
            expect(readmeContent).toContain('Output Files');
            expect(readmeContent).toContain('.json');
            expect(readmeContent).toContain('.gz');
            expect(readmeContent).toContain('SHA256SUMS');
        });
        
        test('should have troubleshooting section', () => {
            expect(readmeContent).toContain('Troubleshooting');
        });
        
        test('should document Lunr.js integration', () => {
            expect(readmeContent).toContain('Lunr');
            expect(readmeContent).toContain('lunr');
        });
    });
    
    describe('Script Features', () => {
        test('extract script should support dataset selection', () => {
            const extractScript = fs.readFileSync(
                path.join(scriptsDir, 'extract-wikipedia.py'),
                'utf8'
            );
            expect(extractScript).toContain("'simple'");
            expect(extractScript).toContain("'english'");
        });
        
        test('build script should support all package types', () => {
            const buildScript = fs.readFileSync(
                path.join(scriptsDir, 'build-packages.py'),
                'utf8'
            );
            expect(buildScript).toContain("'minimal'");
            expect(buildScript).toContain("'standard'");
            expect(buildScript).toContain("'extended'");
        });
        
        test('scripts should be executable', () => {
            const extractStat = fs.statSync(path.join(scriptsDir, 'extract-wikipedia.py'));
            const buildStat = fs.statSync(path.join(scriptsDir, 'build-packages.py'));
            
            // Check if executable bit is set (on Unix-like systems)
            if (process.platform !== 'win32') {
                expect((extractStat.mode & 0o111) !== 0).toBe(true);
                expect((buildStat.mode & 0o111) !== 0).toBe(true);
            }
        });
    });
    
    describe('Error Handling', () => {
        let extractScript, buildScript;
        
        beforeAll(() => {
            extractScript = fs.readFileSync(
                path.join(scriptsDir, 'extract-wikipedia.py'),
                'utf8'
            );
            buildScript = fs.readFileSync(
                path.join(scriptsDir, 'build-packages.py'),
                'utf8'
            );
        });
        
        test('extract script should handle missing dependencies', () => {
            expect(extractScript).toContain('ImportError');
            expect(extractScript).toContain('Missing required dependency');
        });
        
        test('extract script should handle download errors', () => {
            expect(extractScript).toContain('except Exception');
            expect(extractScript).toContain('Download failed');
        });
        
        test('build script should handle missing input file', () => {
            expect(buildScript).toContain('FileNotFoundError');
            expect(buildScript).toContain('not found');
        });
        
        test('scripts should handle KeyboardInterrupt', () => {
            expect(extractScript).toContain('KeyboardInterrupt');
            expect(buildScript).toContain('KeyboardInterrupt');
        });
    });
    
    describe('Integration Requirements', () => {
        test('should generate files compatible with offline mode', () => {
            const buildScript = fs.readFileSync(
                path.join(scriptsDir, 'build-packages.py'),
                'utf8'
            );
            expect(buildScript).toContain('.json');
            expect(buildScript).toContain('gzip');
        });
        
        test('should calculate checksums for integrity', () => {
            const buildScript = fs.readFileSync(
                path.join(scriptsDir, 'build-packages.py'),
                'utf8'
            );
            expect(buildScript).toContain('sha256');
            expect(buildScript).toContain('checksum');
        });
        
        test('should generate metadata for packages', () => {
            const buildScript = fs.readFileSync(
                path.join(scriptsDir, 'build-packages.py'),
                'utf8'
            );
            expect(buildScript).toContain('metadata');
            expect(buildScript).toContain('created_at');
            expect(buildScript).toContain('article_count');
        });
    });
});
