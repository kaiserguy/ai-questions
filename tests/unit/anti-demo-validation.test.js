/**
 * Anti-Demo Validation Tests
 * 
 * These tests prevent the introduction of demo, placeholder, or mock functionality
 * in production code. They scan the codebase for prohibited terms and patterns
 * that indicate non-functional demo implementations.
 * 
 * CRITICAL: These tests must FAIL if demo code is introduced to prevent regressions.
 * 
 * STRENGTHENED (Issue #75): Enhanced detection to catch:
 * - All TODO comments in offline mode implementations
 * - Incomplete implementations with "actual" placeholders
 * - Unfinished code paths in critical offline functionality
 * - Any TODO comments indicating missing features
 */

const fs = require('fs');
const path = require('path');

describe('Anti-Demo Validation Tests', () => {
    // Prohibited terms that indicate demo/placeholder functionality
    const PROHIBITED_TERMS = [
        'demo',
        'dummy',
        'simulate',
        'simulated',
        'simulation',
        'placeholder',
        'fake',
        'mock', // except in test files
        'TODO: Replace with actual',
        'TODO: Load actual',
        'TODO: Implement actual',
        'TODO: Use actual',
        'TODO: Initialize actual',
        'TODO: Process actual',
        'TODO: Generate actual',
        'TODO: Complete actual',
        'TODO: Create actual',
        'TODO: Download actual',
        'TODO: Check actual',
        'TODO: Scan actual',
        'TODO: Free actual',
        'This is a demo',
        'demo mode',
        'placeholder implementation',
        'simulated response',
        'fake response'
    ];

    // Files and directories to scan (excluding test files and node_modules)
    const SCAN_DIRECTORIES = [
        'core/public/offline',
        'hosted/public/offline',
        'core/views',
        'hosted',
        'local'
    ];

    // File extensions to scan
    const SCAN_EXTENSIONS = ['.js', '.ejs', '.html', '.css'];

    /**
     * Get all files to scan for prohibited terms
     */
    function getFilesToScan() {
        const files = [];
        
        SCAN_DIRECTORIES.forEach(dir => {
            if (fs.existsSync(dir)) {
                const dirFiles = getAllFilesRecursive(dir);
                files.push(...dirFiles);
            }
        });
        
        return files.filter(file => {
            const ext = path.extname(file);
            return SCAN_EXTENSIONS.includes(ext) && !file.includes('test') && !file.includes('node_modules') && !file.includes('libs');
        });
    }

    /**
     * Recursively get all files in a directory
     */
    function getAllFilesRecursive(dir) {
        const files = [];
        const items = fs.readdirSync(dir);
        
        items.forEach(item => {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                files.push(...getAllFilesRecursive(fullPath));
            } else {
                files.push(fullPath);
            }
        });
        
        return files;
    }

    /**
     * Scan a file for prohibited terms
     */
    function scanFileForProhibitedTerms(filePath) {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        const violations = [];
        const seenLines = new Set(); // Track unique violations by file:line
        
        lines.forEach((line, lineNumber) => {
            const lowerLine = line.toLowerCase();
            const lineKey = `${filePath}:${lineNumber + 1}`;
            
            // Skip if we've already flagged this line
            if (seenLines.has(lineKey)) {
                return;
            }
            
            // Check for TODO comments in offline mode files (comprehensive catch)
            if (filePath.includes('offline') && /TODO:.*(?:actual|load|process|implement|generate|initialize|download|use|create|query|check|scan|free|complete)/i.test(line)) {
                violations.push({
                    file: filePath,
                    line: lineNumber + 1,
                    term: 'TODO comment in offline implementation',
                    content: line.trim()
                });
                seenLines.add(lineKey);
                return;
            }
            
            // Check prohibited terms
            PROHIBITED_TERMS.forEach(term => {
                if (lowerLine.includes(term.toLowerCase()) && !seenLines.has(lineKey)) {
                    violations.push({
                        file: filePath,
                        line: lineNumber + 1,
                        term: term,
                        content: line.trim()
                    });
                    seenLines.add(lineKey);
                }
            });
        });
        
        return violations;
    }

    describe('Production Code Validation', () => {
        test('should not contain demo or placeholder functionality', () => {
            const filesToScan = getFilesToScan();
            const allViolations = [];
            
            filesToScan.forEach(file => {
                const violations = scanFileForProhibitedTerms(file);
                allViolations.push(...violations);
            });
            
            if (allViolations.length > 0) {
                const errorMessage = [
                    '🚨 DEMO/PLACEHOLDER CODE DETECTED IN PRODUCTION FILES!',
                    '',
                    'The following files contain prohibited demo/placeholder terms:',
                    '',
                    ...allViolations.map(v => 
                        `❌ ${v.file}:${v.line} - "${v.term}" in: ${v.content}`
                    ),
                    '',
                    '🔥 CRITICAL: Remove all demo/placeholder code and implement real functionality!',
                    '',
                    'Prohibited terms include:',
                    ...PROHIBITED_TERMS.map(term => `  - ${term}`),
                    ''
                ].join('\n');
                
                throw new Error(errorMessage);
            }
            
            expect(allViolations).toHaveLength(0);
        });

        test('should not contain simulated delays or fake responses', () => {
            const filesToScan = getFilesToScan();
            const simulationPatterns = [
                /setTimeout.*resolve/i,
                /Math\.random\(\).*\d+/i,
                /await new Promise.*setTimeout/i,
                /simulated.*delay/i,
                /fake.*response/i
            ];
            
            const violations = [];
            
            filesToScan.forEach(file => {
                const content = fs.readFileSync(file, 'utf8');
                const lines = content.split('\n');
                
                lines.forEach((line, lineNumber) => {
                    simulationPatterns.forEach(pattern => {
                        if (pattern.test(line)) {
                            violations.push({
                                file: file,
                                line: lineNumber + 1,
                                pattern: pattern.toString(),
                                content: line.trim()
                            });
                        }
                    });
                });
            });
            
            if (violations.length > 0) {
                const errorMessage = [
                    '🚨 SIMULATED FUNCTIONALITY DETECTED!',
                    '',
                    'The following files contain simulated delays or fake responses:',
                    '',
                    ...violations.map(v => 
                        `❌ ${v.file}:${v.line} - Pattern: ${v.pattern}`
                    ),
                    '',
                    '🔥 Replace with real implementation!'
                ].join('\n');
                
                throw new Error(errorMessage);
            }
            
            expect(violations).toHaveLength(0);
        });

        test('should not contain hardcoded demo data', () => {
            const filesToScan = getFilesToScan();
            const demoDataPatterns = [
                /demo.*article/i,
                /placeholder.*data/i,
                /test.*response/i,
                /sample.*content/i,
                /example.*data/i
            ];
            
            const violations = [];
            
            filesToScan.forEach(file => {
                const content = fs.readFileSync(file, 'utf8');
                
                // Skip if it's clearly a comment or documentation
                const codeLines = content.split('\n').filter(line => {
                    const trimmed = line.trim();
                    return !trimmed.startsWith('//') && 
                           !trimmed.startsWith('*') && 
                           !trimmed.startsWith('/*') &&
                           trimmed.length > 0;
                });
                
                codeLines.forEach((line, lineNumber) => {
                    demoDataPatterns.forEach(pattern => {
                        if (pattern.test(line)) {
                            violations.push({
                                file: file,
                                line: lineNumber + 1,
                                pattern: pattern.toString(),
                                content: line.trim()
                            });
                        }
                    });
                });
            });
            
            if (violations.length > 0) {
                const errorMessage = [
                    '🚨 HARDCODED DEMO DATA DETECTED!',
                    '',
                    'The following files contain hardcoded demo data:',
                    '',
                    ...violations.map(v => 
                        `❌ ${v.file}:${v.line} - ${v.content}`
                    ),
                    '',
                    '🔥 Replace with real data sources!'
                ].join('\n');
                
                throw new Error(errorMessage);
            }
            
            expect(violations).toHaveLength(0);
        });
    });

    describe('Functionality Validation', () => {
        test('should validate Wikipedia manager has real database implementation', () => {
            const wikipediaFiles = [
                'core/public/offline/wikipedia.js',
                'hosted/public/offline/wikipedia.js'
            ];
            
            wikipediaFiles.forEach(file => {
                if (fs.existsSync(file)) {
                    const content = fs.readFileSync(file, 'utf8');
                    
                    // Should not contain TODO comments for core functionality
                    expect(content).not.toMatch(/TODO: Replace with actual database search/i);
                    expect(content).not.toMatch(/TODO: Load actual Wikipedia article/i);
                    expect(content).not.toMatch(/TODO: Generate actual results/i);
                    
                    // Should contain real database operations
                    expect(content).toMatch(/database|db|sql/i);
                }
            });
        });

        test('should validate AI manager has real model implementation', () => {
            const aiFiles = [
                'core/public/offline/ai-models.js',
                'hosted/public/offline/ai-models.js',
                'core/public/offline/local-ai-model.js'
            ];
            
            aiFiles.forEach(file => {
                if (fs.existsSync(file)) {
                    const content = fs.readFileSync(file, 'utf8');
                    
                    // Should not contain TODO comments for core functionality
                    expect(content).not.toMatch(/TODO: Load actual AI model/i);
                    expect(content).not.toMatch(/TODO: Process with real AI/i);
                    expect(content).not.toMatch(/TODO: Generate actual response/i);
                    
                    // Should contain real AI model operations
                    expect(content).toMatch(/model|inference|onnx|webassembly/i);
                }
            });
        });
    });

    describe('Regression Prevention', () => {
        test('should document what this test suite prevents', () => {
            const preventedIssues = [
                'Demo code replacing real functionality',
                'Placeholder responses instead of actual AI',
                'Simulated delays instead of real processing',
                'Hardcoded demo data instead of real databases',
                'TODO comments in production code paths',
                'Mock implementations in non-test files',
                'Incomplete offline mode implementations (Issue #75)',
                'TODO comments indicating missing features (Issue #75)',
                'Unfinished code with "actual" placeholders (Issue #75)'
            ];
            
            // This test always passes but documents the purpose
            expect(preventedIssues.length).toBeGreaterThan(0);
            
            console.log('\n🛡️  Anti-Demo Validation Suite Active');
            console.log('This test suite prevents:');
            preventedIssues.forEach(issue => {
                console.log(`  ❌ ${issue}`);
            });
            console.log('\n✨ Strengthened to catch offline mode TODOs (Issue #75)');
            console.log('');
        });
    });
});

