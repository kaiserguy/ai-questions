/**
 * Local Package Generator
 * 
 * This module handles the generation of the downloadable package for the local version.
 * It creates a zip file containing all necessary files for the local installation.
 */

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { exec } = require('child_process');

class PackageGenerator {
    constructor(options = {}) {
        this.options = {
            outputDir: options.outputDir || path.join(__dirname, 'dist'),
            tempDir: options.tempDir || path.join(__dirname, 'temp'),
            packageName: options.packageName || 'ai-questions-local',
            version: options.version || '1.0.0',
            ...options
        };
        
        // Ensure directories exist
        this.ensureDirectoryExists(this.options.outputDir);
        this.ensureDirectoryExists(this.options.tempDir);
    }
    
    ensureDirectoryExists(dir) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
    
    async generatePackage() {
        console.log('Starting package generation...');
        
        try {
            // Create output paths
            const outputPath = path.join(this.options.outputDir, `${this.options.packageName}-${this.options.version}.zip`);
            const innerPackagePath = path.join(this.options.tempDir, `${this.options.packageName}-files.zip`);
            
            // Generate inner package first
            await this.generateInnerPackage(innerPackagePath);
            
            // Create outer package
            await this.generateOuterPackage(innerPackagePath, outputPath);
            
            console.log(`Package generated successfully: ${outputPath}`);
            return {
                success: true,
                packagePath: outputPath,
                size: fs.statSync(outputPath).size
            };
        } catch (error) {
            console.error('Error generating package:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    async generateInnerPackage(outputPath) {
        return new Promise((resolve, reject) => {
            const output = fs.createWriteStream(outputPath);
            const archive = archiver('zip', {
                zlib: { level: 9 } // Maximum compression
            });
            
            output.on('close', () => {
                console.log(`Inner package created: ${archive.pointer()} total bytes`);
                resolve();
            });
            
            archive.on('error', (err) => {
                reject(err);
            });
            
            archive.pipe(output);
            
            // Add core files
            archive.directory(path.join(__dirname, 'core'), 'core');
            
            // Add local-version specific files
            archive.directory(path.join(__dirname, 'local-version'), 'local-version');
            
            // Add views
            archive.directory(path.join(__dirname, 'views'), 'views');
            
            // Add public assets
            archive.directory(path.join(__dirname, 'public'), 'public');
            
            // Add local-app.js
            archive.file(path.join(__dirname, 'local-app.js'), { name: 'local-app.js' });
            
            // Add package.json with dependencies
            archive.file(path.join(__dirname, 'package.json'), { name: 'package.json' });
            
            archive.finalize();
        });
    }
    
    async generateOuterPackage(innerPackagePath, outputPath) {
        return new Promise((resolve, reject) => {
            const output = fs.createWriteStream(outputPath);
            const archive = archiver('zip', {
                zlib: { level: 9 } // Maximum compression
            });
            
            output.on('close', () => {
                console.log(`Outer package created: ${archive.pointer()} total bytes`);
                resolve();
            });
            
            archive.on('error', (err) => {
                reject(err);
            });
            
            archive.pipe(output);
            
            // Add inner package
            archive.file(innerPackagePath, { name: `${this.options.packageName}-files.zip` });
            
            // Add README
            archive.file(path.join(__dirname, 'README.md'), { name: 'README.md' });
            
            // Add installation scripts
            archive.file(path.join(__dirname, 'local-version/setup-local.sh'), { name: 'setup-local.sh' });
            archive.file(path.join(__dirname, 'local-version/start-local.sh'), { name: 'start-local.sh' });
            
            // Add license
            if (fs.existsSync(path.join(__dirname, 'LICENSE'))) {
                archive.file(path.join(__dirname, 'LICENSE'), { name: 'LICENSE' });
            }
            
            archive.finalize();
        });
    }
    
    async cleanupTempFiles() {
        return new Promise((resolve, reject) => {
            exec(`rm -rf ${this.options.tempDir}/*`, (error) => {
                if (error) {
                    console.error('Error cleaning up temp files:', error);
                    reject(error);
                } else {
                    console.log('Temporary files cleaned up');
                    resolve();
                }
            });
        });
    }
}

module.exports = PackageGenerator;

