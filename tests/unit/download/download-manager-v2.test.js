/**
 * Unit tests for DownloadManagerV2 class
 * Tests file downloads, progress tracking, checksum validation, and retry logic
 */

const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');

// Mock fetch for testing
global.fetch = jest.fn();

// Mock crypto.subtle for checksum validation
global.crypto = {
    subtle: {
        digest: jest.fn()
    }
};

describe('DownloadManagerV2', () => {
    let downloadManager;
    
    beforeEach(() => {
        const { DownloadManagerV2 } = require('../../../core/public/offline/download/download-manager-v2.js');
        downloadManager = new DownloadManagerV2();
        
        // Reset fetch mock
        global.fetch.mockReset();
        
        // Reinitialize crypto mock (clearAllMocks clears the structure)
        if (!global.crypto) {
            global.crypto = {};
        }
        if (!global.crypto.subtle) {
            global.crypto.subtle = {};
        }
        global.crypto.subtle.digest = jest.fn();
    });
    
    afterEach(() => {
        if (downloadManager) {
            downloadManager.cancelDownload();
        }
    });
    
    describe('downloadFile', () => {
        test('should download file successfully', async () => {
            const mockBlob = new Blob(['test data']);
            const mockResponse = {
                ok: true,
                headers: new Map([['Content-Length', '3']]),
                body: {
                    getReader: () => ({
                        read: jest.fn()
                            .mockResolvedValueOnce({ done: false, value: new Uint8Array([1, 2, 3]) })
                            .mockResolvedValueOnce({ done: true })
                    })
                }
            };
            
            global.fetch.mockResolvedValue(mockResponse);
            
            const progressUpdates = [];
            const result = await downloadManager.downloadFile(
                'https://example.com/test.txt',
                'test.txt',
                {
                    onProgress: (progress) => progressUpdates.push(progress)
                }
            );
            
            expect(result).toBeInstanceOf(Blob);
            expect(progressUpdates.length).toBeGreaterThan(0);
            expect(progressUpdates[progressUpdates.length - 1].percentage).toBe(100);
        });
        
        test('should throw error for failed download', async () => {
            global.fetch.mockResolvedValue({
                ok: false,
                status: 404,
                statusText: 'Not Found'
            });
            
            await expect(
                downloadManager.downloadFile('https://example.com/notfound.txt', 'notfound.txt')
            ).rejects.toThrow('404');
        });
        
        test('should retry on failure', async () => {
            global.fetch
                .mockRejectedValueOnce(new Error('Network error'))
                .mockRejectedValueOnce(new Error('Network error'))
                .mockResolvedValueOnce({
                    ok: true,
                    headers: new Map([['Content-Length', '4']]),
                    body: {
                        getReader: () => ({
                            read: jest.fn()
                                .mockResolvedValueOnce({ done: false, value: new Uint8Array([1, 2, 3, 4]) })
                                .mockResolvedValueOnce({ done: true })
                        })
                    }
                });
            
            const result = await downloadManager.downloadFile(
                'https://example.com/test.txt',
                'test.txt',
                { retryAttempts: 3 }
            );
            
            expect(result).toBeInstanceOf(Blob);
            expect(global.fetch).toHaveBeenCalledTimes(3);
        });
        
        test('should fail after max retries', async () => {
            global.fetch.mockRejectedValue(new Error('Network error'));
            
            await expect(
                downloadManager.downloadFile(
                    'https://example.com/test.txt',
                    'test.txt',
                    { retryAttempts: 2 }
                )
            ).rejects.toThrow('Network error');
            
            expect(global.fetch).toHaveBeenCalledTimes(2);
        });
    });
    
    describe('downloadMultiple', () => {
        test('should download multiple files', async () => {
            const mockResponse = {
                ok: true,
                headers: new Map([['Content-Length', '10']]),
                body: {
                    getReader: () => ({
                        read: jest.fn()
                            .mockResolvedValueOnce({ done: false, value: new Uint8Array(10) })
                            .mockResolvedValueOnce({ done: true })
                    })
                }
            };
            
            global.fetch.mockResolvedValue(mockResponse);
            
            const files = [
                { url: 'https://example.com/file1.txt', fileName: 'file1.txt' },
                { url: 'https://example.com/file2.txt', fileName: 'file2.txt' },
                { url: 'https://example.com/file3.txt', fileName: 'file3.txt' }
            ];
            
            const progressUpdates = [];
            const results = await downloadManager.downloadMultiple(files, (progress) => {
                progressUpdates.push(progress);
            });
            
            expect(results.length).toBe(3);
            expect(results.every(r => r.blob instanceof Blob)).toBe(true);
            expect(progressUpdates[progressUpdates.length - 1].overall).toBe(100);
        });
        
        test('should handle partial failures', async () => {
            global.fetch
                .mockResolvedValueOnce({
                    ok: true,
                    headers: new Map([['Content-Length', '10']]),
                    body: {
                        getReader: () => ({
                            read: jest.fn()
                                .mockResolvedValueOnce({ done: false, value: new Uint8Array(10) })
                                .mockResolvedValueOnce({ done: true })
                        })
                    }
                })
                .mockRejectedValueOnce(new Error('Failed'))
                .mockResolvedValueOnce({
                    ok: true,
                    headers: new Map([['Content-Length', '10']]),
                    body: {
                        getReader: () => ({
                            read: jest.fn()
                                .mockResolvedValueOnce({ done: false, value: new Uint8Array(10) })
                                .mockResolvedValueOnce({ done: true })
                        })
                    }
                });
            
            const files = [
                { url: 'https://example.com/file1.txt', fileName: 'file1.txt' },
                { url: 'https://example.com/file2.txt', fileName: 'file2.txt' },
                { url: 'https://example.com/file3.txt', fileName: 'file3.txt' }
            ];
            
            await expect(
                downloadManager.downloadMultiple(files, null, { retryAttempts: 1 })
            ).rejects.toThrow();
        });
    });
    
    describe('validateChecksum', () => {
        test('should validate correct checksum', async () => {
            const testData = 'test data';
            const blob = new Blob([testData]);
            
            // Mock crypto.subtle.digest to return a known hash
            const mockHash = new Uint8Array([1, 2, 3, 4]).buffer;
            global.crypto.subtle.digest.mockResolvedValue(mockHash);
            
            const expectedChecksum = '01020304'; // hex representation
            
            const isValid = await downloadManager.validateChecksum(blob, expectedChecksum);
            expect(isValid).toBe(true);
        });
        
        test('should reject incorrect checksum', async () => {
            const blob = new Blob(['test data']);
            
            const mockHash = new Uint8Array([1, 2, 3, 4]).buffer;
            global.crypto.subtle.digest.mockResolvedValue(mockHash);
            
            const wrongChecksum = 'ffffffff';
            
            const isValid = await downloadManager.validateChecksum(blob, wrongChecksum);
            expect(isValid).toBe(false);
        });
    });
    
    describe('calculateChecksum', () => {
        test('should calculate SHA-256 checksum', async () => {
            const blob = new Blob(['test data']);
            
            const mockHash = new Uint8Array([1, 2, 3, 4]).buffer;
            global.crypto.subtle.digest.mockResolvedValue(mockHash);
            
            const checksum = await downloadManager.calculateChecksum(blob);
            
            expect(checksum).toBe('01020304');
            expect(global.crypto.subtle.digest).toHaveBeenCalledWith('SHA-256', expect.any(ArrayBuffer));
        });
    });
    
    describe('cancelDownload', () => {
        test('should cancel ongoing download', async () => {
            const mockResponse = {
                ok: true,
                headers: new Map([['Content-Length', '1000']]),
                body: {
                    getReader: () => ({
                        read: jest.fn().mockImplementation(() => {
                            return new Promise((resolve) => {
                                setTimeout(() => {
                                    resolve({ done: false, value: new Uint8Array(100) });
                                }, 100);
                            });
                        })
                    })
                }
            };
            
            global.fetch.mockResolvedValue(mockResponse);
            
            const downloadPromise = downloadManager.downloadFile(
                'https://example.com/large.txt',
                'large.txt'
            );
            
            // Cancel after a short delay
            setTimeout(() => {
                downloadManager.cancelDownload('large.txt');
            }, 50);
            
            await expect(downloadPromise).rejects.toThrow('cancelled');
        });
    });
    
    describe('delay', () => {
        test('should delay for specified time', async () => {
            const start = Date.now();
            await downloadManager.delay(100);
            const elapsed = Date.now() - start;
            
            expect(elapsed).toBeGreaterThanOrEqual(95); // Allow small timing variance
        });
    });
});
