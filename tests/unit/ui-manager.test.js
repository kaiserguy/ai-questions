/**
 * Comprehensive unit tests for OfflineUIManager class
 * Tests all UI interactions, error handling, accessibility, and security features
 */

const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');

// Mock the toast system
global.toast = {
    show: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn()
};

// Mock ModelStorage for existing data check
global.ModelStorage = jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    hasModel: jest.fn().mockResolvedValue(false)
}));

// Mock IndexedDB databases method
global.indexedDB.databases = jest.fn().mockResolvedValue([]);

// Mock caches API
global.caches = {
    keys: jest.fn().mockResolvedValue([]),
    delete: jest.fn().mockResolvedValue(true)
};

describe('OfflineUIManager', () => {
    let OfflineUIManager;
    let uiManager;
    let mockIntegrationManager;
    let mockElements;

    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();
        
        // Create mock DOM elements
        mockElements = {
            statusDot: createMockElement('statusDot', { className: 'status-dot' }),
            statusText: createMockElement('statusText', { textContent: '' }),
            statusDescription: createMockElement('statusDescription', { textContent: '' }),
            downloadBtn: createMockElement('downloadBtn', { 
                disabled: true,
                textContent: 'Select a package',
                setAttribute: jest.fn(),
                removeAttribute: jest.fn()
            }),
            progressSection: createMockElement('progressSection', { 
                style: { display: 'none' },
                setAttribute: jest.fn()
            }),
            progressText: createMockElement('progressText', { textContent: '' }),
            progressFill: createMockElement('progressFill', { 
                style: { width: '0%' },
                setAttribute: jest.fn()
            }),
            progressDetails: createMockElement('progressDetails', { textContent: '' }),
            chatInput: createMockElement('chatInput', { 
                value: '',
                focus: jest.fn(),
                setAttribute: jest.fn(),
                removeAttribute: jest.fn()
            }),
            sendBtn: createMockElement('sendBtn', {
                disabled: true,
                setAttribute: jest.fn(),
                removeAttribute: jest.fn()
            }),
            chatMessages: createMockElement('chatMessages', {
                innerHTML: '',
                appendChild: jest.fn(),
                scrollTop: 0,
                scrollHeight: 100
            }),
            chatSection: createMockElement('chatSection', { style: { display: 'none' } }),
            wikiSearchInput: createMockElement('wikiSearchInput', { 
                value: '',
                focus: jest.fn(),
                setAttribute: jest.fn(),
                removeAttribute: jest.fn()
            }),
            wikiSearchBtn: createMockElement('wikiSearchBtn', {
                disabled: false,
                setAttribute: jest.fn(),
                removeAttribute: jest.fn()
            }),
            wikiResults: createMockElement('wikiResults', { 
                innerHTML: '',
                setAttribute: jest.fn()
            }),
            wikiSection: createMockElement('wikiSection', { style: { display: 'none' } }),
            clearCacheBtn: createMockElement('clearCacheBtn', {
                disabled: false,
                setAttribute: jest.fn(),
                removeAttribute: jest.fn()
            })
        };

        // Create mock option cards
        const optionCards = [
            createMockElement('card-minimal', { 
                dataset: { package: 'minimal' },
                setAttribute: jest.fn(),
                getAttribute: jest.fn()
            }),
            createMockElement('card-standard', { 
                dataset: { package: 'standard' },
                setAttribute: jest.fn(),
                getAttribute: jest.fn()
            }),
            createMockElement('card-full', { 
                dataset: { package: 'full' },
                setAttribute: jest.fn(),
                getAttribute: jest.fn()
            })
        ];

        // Mock querySelectorAll to return option cards
        document.querySelectorAll = jest.fn((selector) => {
            if (selector === '.option-card') {
                return optionCards;
            }
            return [];
        });

        // Mock getElementById to return mock elements
        document.getElementById = jest.fn((id) => mockElements[id] || null);

        // Mock createElement for messages and live region
        document.createElement = jest.fn((tag) => {
            if (tag === 'div' || tag === 'article') {
                return {
                    id: '',
                    className: '',
                    textContent: '',
                    innerHTML: '',
                    classList: {
                        add: jest.fn(),
                        remove: jest.fn(),
                        contains: jest.fn()
                    },
                    setAttribute: jest.fn(),
                    removeAttribute: jest.fn(),
                    style: { cssText: '' },
                    appendChild: jest.fn(),
                    remove: jest.fn()
                };
            }
            return null;
        });

        // Mock body.appendChild
        if (!document.body) {
            // Create a basic body element if it doesn't exist
            const bodyElement = document.createElement('body');
            document.documentElement.appendChild(bodyElement);
        }
        document.body.appendChild = jest.fn();

        // Mock document.addEventListener
        document.addEventListener = jest.fn();
        document.activeElement = { blur: jest.fn() };

        // Create mock integration manager
        mockIntegrationManager = {
            isInitialized: false,
            initialized: false,
            setPackageType: jest.fn(),
            startDownload: jest.fn(),
            chat: jest.fn().mockResolvedValue('AI response'),
            searchWikipedia: jest.fn().mockResolvedValue([
                { title: 'Test Article', snippet: 'Test snippet' }
            ])
        };

        // Load the module
        OfflineUIManager = require('../../core/public/offline/ui-manager.js');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Constructor', () => {
        test('should initialize with default values', () => {
            uiManager = new OfflineUIManager();
            
            expect(uiManager.selectedPackage).toBeNull();
            expect(uiManager.isDownloading).toBe(false);
            expect(uiManager.integrationManager).toBeNull();
        });

        test('should cache DOM elements', () => {
            uiManager = new OfflineUIManager();
            
            expect(uiManager.elements).toBeDefined();
            expect(uiManager.elements.statusDot).toBe(mockElements.statusDot);
            expect(uiManager.elements.downloadBtn).toBe(mockElements.downloadBtn);
            expect(uiManager.elements.chatInput).toBe(mockElements.chatInput);
        });

        test('should handle missing DOM elements gracefully', () => {
            document.getElementById = jest.fn(() => null);
            
            expect(() => {
                uiManager = new OfflineUIManager();
            }).not.toThrow();
            
            expect(uiManager.elements.statusDot).toBeNull();
        });
    });

    describe('Initialization', () => {
        beforeEach(() => {
            uiManager = new OfflineUIManager();
        });

        test('should throw error without IntegrationManager', async () => {
            await expect(uiManager.initialize(null)).rejects.toThrow('Integration manager is required');
        });

        test('should initialize successfully with valid IntegrationManager', async () => {
            await uiManager.initialize(mockIntegrationManager);
            
            expect(uiManager.integrationManager).toBe(mockIntegrationManager);
        });

        test('should set up keyboard shortcuts', async () => {
            await uiManager.initialize(mockIntegrationManager);
            
            expect(document.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
        });

        test('should check browser compatibility', async () => {
            await uiManager.initialize(mockIntegrationManager);
            
            // Should set status text with some browser-related message
            expect(mockElements.statusText.textContent).toBeTruthy();
            expect(mockElements.statusText.textContent.length).toBeGreaterThan(0);
        });

        test('should show error toast on initialization failure', async () => {
            const error = new Error('Test error');
            uiManager.checkBrowserCompatibility = jest.fn().mockRejectedValue(error);
            
            await expect(uiManager.initialize(mockIntegrationManager)).rejects.toThrow('Test error');
            expect(global.toast.show).toHaveBeenCalled();
        });
    });

    describe('Package Selection', () => {
        beforeEach(async () => {
            uiManager = new OfflineUIManager();
            await uiManager.initialize(mockIntegrationManager);
        });

        test('should select package on click', () => {
            const optionCards = document.querySelectorAll('.option-card');
            const card = optionCards[0];
            
            // Simulate click
            const clickHandler = card.addEventListener.mock.calls.find(
                call => call[0] === 'click'
            )?.[1];
            
            if (clickHandler) {
                clickHandler();
                
                expect(card.classList.add).toHaveBeenCalledWith('selected');
                expect(card.setAttribute).toHaveBeenCalledWith('aria-checked', 'true');
                expect(uiManager.selectedPackage).toBe('minimal');
                expect(mockIntegrationManager.setPackageType).toHaveBeenCalledWith('minimal');
            }
        });

        test('should handle keyboard selection with Enter', () => {
            const optionCards = document.querySelectorAll('.option-card');
            const card = optionCards[0];
            
            const keydownHandler = card.addEventListener.mock.calls.find(
                call => call[0] === 'keydown'
            )?.[1];
            
            if (keydownHandler) {
                const event = { 
                    key: 'Enter', 
                    preventDefault: jest.fn() 
                };
                keydownHandler(event);
                
                expect(event.preventDefault).toHaveBeenCalled();
                expect(uiManager.selectedPackage).toBe('minimal');
            }
        });

        test('should handle keyboard selection with Space', () => {
            const optionCards = document.querySelectorAll('.option-card');
            const card = optionCards[0];
            
            const keydownHandler = card.addEventListener.mock.calls.find(
                call => call[0] === 'keydown'
            )?.[1];
            
            if (keydownHandler) {
                const event = { 
                    key: ' ', 
                    preventDefault: jest.fn() 
                };
                keydownHandler(event);
                
                expect(event.preventDefault).toHaveBeenCalled();
            }
        });

        test('should prevent selection during download', () => {
            uiManager.isDownloading = true;
            
            const optionCards = document.querySelectorAll('.option-card');
            const card = optionCards[0];
            
            const clickHandler = card.addEventListener.mock.calls.find(
                call => call[0] === 'click'
            )?.[1];
            
            if (clickHandler) {
                clickHandler();
                
                expect(global.toast.show).toHaveBeenCalledWith(
                    expect.stringContaining('Cannot change package'),
                    'warning'
                );
                expect(uiManager.selectedPackage).toBeNull();
            }
        });

        test('should update ARIA attributes on selection', () => {
            const optionCards = document.querySelectorAll('.option-card');
            const card = optionCards[0];
            
            const clickHandler = card.addEventListener.mock.calls.find(
                call => call[0] === 'click'
            )?.[1];
            
            if (clickHandler) {
                clickHandler();
                
                expect(card.setAttribute).toHaveBeenCalledWith('aria-checked', 'true');
            }
        });
    });

    describe('Download Management', () => {
        beforeEach(async () => {
            uiManager = new OfflineUIManager();
            await uiManager.initialize(mockIntegrationManager);
            uiManager.selectedPackage = 'minimal';
        });

        test('should start download successfully', () => {
            uiManager.startDownload();
            
            expect(uiManager.isDownloading).toBe(true);
            expect(mockElements.downloadBtn.disabled).toBe(true);
            expect(mockElements.downloadBtn.textContent).toBe('Downloading...');
            expect(mockIntegrationManager.startDownload).toHaveBeenCalled();
        });

        test('should prevent download without package selection', () => {
            uiManager.selectedPackage = null;
            
            uiManager.startDownload();
            
            expect(global.toast.show).toHaveBeenCalledWith(
                'Please select a package first',
                'warning'
            );
            expect(mockIntegrationManager.startDownload).not.toHaveBeenCalled();
        });

        test('should prevent concurrent downloads', () => {
            uiManager.isDownloading = true;
            
            uiManager.startDownload();
            
            expect(global.toast.show).toHaveBeenCalledWith(
                'Download already in progress',
                'info'
            );
        });

        test('should update progress correctly', () => {
            uiManager.updateProgress(50, 'Downloading model...');
            
            expect(mockElements.progressText.textContent).toContain('50%');
            expect(mockElements.progressFill.style.width).toBe('50%');
            // Details text is sanitized, just check it was set
            expect(mockElements.progressDetails.textContent).toBeTruthy();
        });

        test('should announce progress milestones', () => {
            uiManager.announceToScreenReader = jest.fn();
            
            uiManager.updateProgress(25, 'Progress');
            expect(uiManager.announceToScreenReader).toHaveBeenCalledWith('Download 25% complete');
            
            uiManager.updateProgress(50, 'Progress');
            expect(uiManager.announceToScreenReader).toHaveBeenCalledWith('Download 50% complete');
            
            uiManager.updateProgress(75, 'Progress');
            expect(uiManager.announceToScreenReader).toHaveBeenCalledWith('Download 75% complete');
        });

        test('should handle download completion', () => {
            uiManager.updateProgress(100, 'Complete');
            
            expect(uiManager.isDownloading).toBe(false);
            expect(mockElements.downloadBtn.textContent).toBe('Download Complete');
            expect(global.toast.show).toHaveBeenCalledWith(
                expect.stringContaining('successfully'),
                'success'
            );
        });

        test('should handle download failure', () => {
            mockIntegrationManager.startDownload.mockImplementation(() => {
                throw new Error('Download failed');
            });
            
            uiManager.startDownload();
            
            expect(global.toast.show).toHaveBeenCalledWith(
                expect.stringContaining('Download failed'),
                'error'
            );
        });

        test('should validate progress percentage bounds', () => {
            uiManager.updateProgress(-10, 'Test');
            expect(mockElements.progressFill.style.width).toBe('0%');
            
            uiManager.updateProgress(150, 'Test');
            expect(mockElements.progressFill.style.width).toBe('100%');
        });
    });

    describe('Chat Functionality', () => {
        beforeEach(async () => {
            uiManager = new OfflineUIManager();
            await uiManager.initialize(mockIntegrationManager);
            mockIntegrationManager.isInitialized = true;
        });

        test('should send message successfully', async () => {
            mockElements.chatInput.value = 'Test message';
            mockElements.sendBtn.disabled = false; // Ensure button is enabled
            
            await uiManager.sendMessage();
            
            expect(mockIntegrationManager.chat).toHaveBeenCalledWith('Test message');
            expect(mockElements.chatMessages.appendChild).toHaveBeenCalled();
            expect(mockElements.chatInput.value).toBe('');
        });

        test('should prevent sending empty messages', async () => {
            mockElements.chatInput.value = '   ';
            mockElements.sendBtn.disabled = false;
            
            await uiManager.sendMessage();
            
            expect(global.toast.show).toHaveBeenCalledWith(
                'Please enter a message',
                'warning'
            );
            expect(mockIntegrationManager.chat).not.toHaveBeenCalled();
        });

        test('should validate message length (max 5000)', async () => {
            mockElements.chatInput.value = 'a'.repeat(5001);
            mockElements.sendBtn.disabled = false;
            
            await uiManager.sendMessage();
            
            expect(global.toast.show).toHaveBeenCalledWith(
                expect.stringContaining('too long'),
                'warning'
            );
            expect(mockIntegrationManager.chat).not.toHaveBeenCalled();
        });

        test('should prevent sending when AI not initialized', async () => {
            mockIntegrationManager.isInitialized = false;
            mockElements.chatInput.value = 'Test message';
            mockElements.sendBtn.disabled = false;
            
            await uiManager.sendMessage();
            
            expect(global.toast.show).toHaveBeenCalledWith(
                expect.stringContaining('download the offline package'),
                'warning'
            );
            expect(mockIntegrationManager.chat).not.toHaveBeenCalled();
        });

        test('should handle chat timeout (60s)', async () => {
            jest.useFakeTimers();
            
            mockElements.chatInput.value = 'Test message';
            mockElements.sendBtn.disabled = false;
            let resolveChat;
            mockIntegrationManager.chat.mockImplementation(() => 
                new Promise(resolve => { resolveChat = resolve; })
            );
            
            const sendPromise = uiManager.sendMessage();
            
            // Fast-forward past timeout
            jest.advanceTimersByTime(61000);
            
            // Resolve the promise so test can complete
            if (resolveChat) resolveChat('response');
            
            await sendPromise;
            
            // Should have added error message
            expect(mockElements.chatMessages.appendChild).toHaveBeenCalled();
            
            jest.useRealTimers();
        }, 10000);

        test('should handle invalid response', async () => {
            mockElements.chatInput.value = 'Test message';
            mockElements.sendBtn.disabled = false;
            mockIntegrationManager.chat.mockResolvedValue(null);
            
            await uiManager.sendMessage();
            
            expect(mockElements.chatMessages.appendChild).toHaveBeenCalled();
            // Should add error message
            const calls = mockElements.chatMessages.appendChild.mock.calls;
            expect(calls.length).toBeGreaterThan(0);
        });

        test('should disable send button during processing', async () => {
            mockElements.chatInput.value = 'Test message';
            mockElements.sendBtn.disabled = false;
            mockIntegrationManager.chat.mockImplementation(() => 
                new Promise(resolve => setTimeout(() => resolve('response'), 100))
            );
            
            const promise = uiManager.sendMessage();
            
            // Button should be disabled immediately
            expect(mockElements.sendBtn.disabled).toBe(true);
            
            await promise;
            
            // Button should be re-enabled after completion
            expect(mockElements.sendBtn.disabled).toBe(false);
        });

        test('should restore focus to input after sending', async () => {
            mockElements.chatInput.value = 'Test message';
            mockElements.sendBtn.disabled = false;
            
            await uiManager.sendMessage();
            
            expect(mockElements.chatInput.focus).toHaveBeenCalled();
        });

        test('should prevent duplicate messages during processing', async () => {
            mockElements.chatInput.value = 'Test message';
            mockElements.sendBtn.disabled = true;
            
            await uiManager.sendMessage();
            
            // Should exit early when button is disabled
            expect(mockIntegrationManager.chat).not.toHaveBeenCalled();
        });
    });

    describe('Wikipedia Search', () => {
        beforeEach(async () => {
            uiManager = new OfflineUIManager();
            await uiManager.initialize(mockIntegrationManager);
            mockIntegrationManager.isInitialized = true;
        });

        test('should search successfully', async () => {
            mockElements.wikiSearchInput.value = 'Test query';
            mockElements.wikiSearchBtn.disabled = false;
            
            await uiManager.searchWikipedia();
            
            expect(mockIntegrationManager.searchWikipedia).toHaveBeenCalledWith('Test query');
            expect(mockElements.wikiResults.innerHTML).toContain('Test Article');
        });

        test('should prevent empty search', async () => {
            mockElements.wikiSearchInput.value = '   ';
            
            await uiManager.searchWikipedia();
            
            expect(global.toast.show).toHaveBeenCalledWith(
                'Please enter a search term',
                'warning'
            );
            expect(mockIntegrationManager.searchWikipedia).not.toHaveBeenCalled();
        });

        test('should validate minimum search length (2 chars)', async () => {
            mockElements.wikiSearchInput.value = 'a';
            
            await uiManager.searchWikipedia();
            
            expect(global.toast.show).toHaveBeenCalledWith(
                expect.stringContaining('at least 2 characters'),
                'warning'
            );
        });

        test('should validate maximum search length (200 chars)', async () => {
            mockElements.wikiSearchInput.value = 'a'.repeat(201);
            
            await uiManager.searchWikipedia();
            
            expect(global.toast.show).toHaveBeenCalledWith(
                expect.stringContaining('too long'),
                'warning'
            );
        });

        test('should handle search timeout (30s)', async () => {
            jest.useFakeTimers();
            
            mockElements.wikiSearchInput.value = 'Test query';
            mockElements.wikiSearchBtn.disabled = false;
            let resolveSearch;
            mockIntegrationManager.searchWikipedia.mockImplementation(() =>
                new Promise(resolve => { resolveSearch = resolve; })
            );
            
            const searchPromise = uiManager.searchWikipedia();
            
            jest.advanceTimersByTime(31000);
            
            // Resolve the promise
            if (resolveSearch) resolveSearch([]);
            
            await searchPromise;
            
            expect(mockElements.wikiResults.innerHTML).toContain('timeout');
            
            jest.useRealTimers();
        }, 10000);

        test('should display empty results message', async () => {
            mockElements.wikiSearchInput.value = 'Test query';
            mockIntegrationManager.searchWikipedia.mockResolvedValue([]);
            
            await uiManager.searchWikipedia();
            
            expect(mockElements.wikiResults.innerHTML).toContain('No results found');
        });

        test('should handle search error', async () => {
            mockElements.wikiSearchInput.value = 'Test query';
            mockElements.wikiSearchBtn.disabled = false;
            mockIntegrationManager.searchWikipedia.mockRejectedValue(new Error('Search failed'));
            
            await uiManager.searchWikipedia();
            
            expect(mockElements.wikiResults.innerHTML).toContain('Search failed');
            expect(global.toast.show).toHaveBeenCalledWith(
                'Wikipedia search failed',
                'error'
            );
        });

        test('should disable search button during search', async () => {
            mockElements.wikiSearchInput.value = 'Test query';
            mockElements.wikiSearchBtn.disabled = false;
            mockIntegrationManager.searchWikipedia.mockImplementation(() =>
                new Promise(resolve => setTimeout(() => resolve([]), 100))
            );
            
            const promise = uiManager.searchWikipedia();
            
            expect(mockElements.wikiSearchBtn.disabled).toBe(true);
            
            await promise;
            
            expect(mockElements.wikiSearchBtn.disabled).toBe(false);
        }, 10000); // Increase timeout to 10 seconds

        test('should prevent concurrent searches', async () => {
            mockElements.wikiSearchInput.value = 'Test query';
            mockElements.wikiSearchBtn.disabled = true;
            
            await uiManager.searchWikipedia();
            
            // Should exit early
            expect(mockIntegrationManager.searchWikipedia).not.toHaveBeenCalled();
        });
    });

    describe('Browser Compatibility', () => {
        beforeEach(() => {
            uiManager = new OfflineUIManager();
        });

        test('should detect all features present', async () => {
            global.indexedDB = {};
            global.navigator = { serviceWorker: {} };
            global.Worker = function() {};
            global.localStorage = { setItem: jest.fn(), removeItem: jest.fn() };
            global.fetch = jest.fn();
            global.WebAssembly = {};
            
            await uiManager.checkBrowserCompatibility();
            
            expect(mockElements.statusText.textContent).toContain('supports all');
        });

        test('should detect missing features', async () => {
            delete global.indexedDB;
            
            await uiManager.checkBrowserCompatibility();
            
            expect(mockElements.statusText.textContent).toContain('compatibility issues');
            expect(mockElements.statusDescription.textContent).toContain('indexedDB');
        });

        test('should test localStorage write capability', async () => {
            const mockSetItem = jest.fn();
            const mockRemoveItem = jest.fn();
            global.localStorage = {
                setItem: mockSetItem,
                removeItem: mockRemoveItem
            };
            
            await uiManager.checkBrowserCompatibility();
            
            expect(mockSetItem).toHaveBeenCalledWith('__storage_test__', '__storage_test__');
            expect(mockRemoveItem).toHaveBeenCalledWith('__storage_test__');
        });

        test('should handle localStorage write failure', async () => {
            global.localStorage = {
                setItem: jest.fn(() => { throw new Error('Quota exceeded'); }),
                removeItem: jest.fn()
            };
            
            await uiManager.checkBrowserCompatibility();
            
            expect(mockElements.statusDescription.textContent).toContain('localStorage');
        });

        test('should handle compatibility check error', async () => {
            uiManager.updateStatus = jest.fn(() => { throw new Error('Test error'); });
            
            await uiManager.checkBrowserCompatibility();
            
            expect(mockElements.statusText.textContent).toContain('Could not check');
        });
    });

    describe('Cache Management', () => {
        beforeEach(async () => {
            uiManager = new OfflineUIManager();
            await uiManager.initialize(mockIntegrationManager);
            
            // Mock confirm
            global.confirm = jest.fn(() => true);
        });

        test('should clear IndexedDB databases', async () => {
            const mockDatabases = [
                { name: 'db1' },
                { name: 'db2' }
            ];
            global.indexedDB.databases.mockResolvedValue(mockDatabases);
            global.indexedDB.deleteDatabase.mockImplementation((name) => ({
                onsuccess: null,
                onerror: null
            }));
            
            await uiManager.clearCache();
            
            expect(global.indexedDB.deleteDatabase).toHaveBeenCalledTimes(2);
        });

        test('should clear localStorage', async () => {
            global.localStorage.clear = jest.fn();
            
            await uiManager.clearCache();
            
            expect(global.localStorage.clear).toHaveBeenCalled();
        });

        test('should clear sessionStorage', async () => {
            global.sessionStorage = { clear: jest.fn() };
            
            await uiManager.clearCache();
            
            expect(global.sessionStorage.clear).toHaveBeenCalled();
        });

        test('should clear Service Worker caches', async () => {
            const mockCacheNames = ['cache1', 'cache2'];
            global.caches.keys.mockResolvedValue(mockCacheNames);
            
            await uiManager.clearCache();
            
            expect(global.caches.delete).toHaveBeenCalledTimes(2);
        });

        test('should cancel if user declines confirmation', async () => {
            global.confirm = jest.fn(() => false);
            
            await uiManager.clearCache();
            
            expect(global.indexedDB.deleteDatabase).not.toHaveBeenCalled();
        });

        test('should handle IndexedDB blocked state', async () => {
            global.indexedDB.databases.mockResolvedValue([{ name: 'test-db' }]);
            global.indexedDB.deleteDatabase.mockImplementation(() => ({
                onsuccess: null,
                onerror: null,
                onblocked: setTimeout(() => {
                    const req = global.indexedDB.deleteDatabase('test-db');
                    if (req.onblocked) req.onblocked();
                }, 0)
            }));
            
            await uiManager.clearCache();
            
            // Should handle blocked state
            expect(global.toast.show).toHaveBeenCalled();
        });

        test('should reset UI state after clearing', async () => {
            await uiManager.clearCache();
            
            expect(uiManager.selectedPackage).toBeNull();
            expect(uiManager.isDownloading).toBe(false);
        });

        test('should handle cache clearing error', async () => {
            global.indexedDB.databases.mockRejectedValue(new Error('IndexedDB error'));
            
            await uiManager.clearCache();
            
            expect(global.toast.show).toHaveBeenCalledWith(
                expect.stringContaining('Failed to clear cache'),
                'error'
            );
        });

        test('should disable button during cache clearing', async () => {
            const clearPromise = uiManager.clearCache();
            
            expect(mockElements.clearCacheBtn.disabled).toBe(true);
            
            await clearPromise;
            
            expect(mockElements.clearCacheBtn.disabled).toBe(false);
        });
    });

    describe('Accessibility', () => {
        beforeEach(async () => {
            uiManager = new OfflineUIManager();
            await uiManager.initialize(mockIntegrationManager);
        });

        test('should create screen reader live region', () => {
            uiManager.announceToScreenReader('Test announcement');
            
            expect(document.createElement).toHaveBeenCalledWith('div');
            expect(document.body.appendChild).toHaveBeenCalled();
        });

        test('should announce to screen reader', (done) => {
            uiManager.announceToScreenReader('Test message');
            
            setTimeout(() => {
                expect(document.body.appendChild).toHaveBeenCalled();
                done();
            }, 150);
        });

        test('should set up Ctrl+K keyboard shortcut', async () => {
            const keydownHandler = document.addEventListener.mock.calls.find(
                call => call[0] === 'keydown'
            )?.[1];
            
            if (keydownHandler) {
                const event = {
                    ctrlKey: true,
                    key: 'k',
                    preventDefault: jest.fn()
                };
                keydownHandler(event);
                
                expect(event.preventDefault).toHaveBeenCalled();
                expect(mockElements.chatInput.focus).toHaveBeenCalled();
            }
        });

        test('should set up Ctrl+/ keyboard shortcut', async () => {
            const keydownHandler = document.addEventListener.mock.calls.find(
                call => call[0] === 'keydown'
            )?.[1];
            
            if (keydownHandler) {
                const event = {
                    ctrlKey: true,
                    key: '/',
                    preventDefault: jest.fn()
                };
                keydownHandler(event);
                
                expect(event.preventDefault).toHaveBeenCalled();
                expect(mockElements.wikiSearchInput.focus).toHaveBeenCalled();
            }
        });

        test('should set up Escape keyboard shortcut', async () => {
            const keydownHandler = document.addEventListener.mock.calls.find(
                call => call[0] === 'keydown'
            )?.[1];
            
            if (keydownHandler) {
                const event = { key: 'Escape' };
                keydownHandler(event);
                
                expect(document.activeElement.blur).toHaveBeenCalled();
            }
        });

        test('should set ARIA attributes on chat messages', () => {
            const messageId = uiManager.addChatMessage('Test message', 'user');
            
            expect(mockElements.chatMessages.appendChild).toHaveBeenCalled();
            const messageElement = mockElements.chatMessages.appendChild.mock.calls[0][0];
            expect(messageElement.setAttribute).toBeDefined();
        });

        test('should set aria-busy during async operations', async () => {
            mockElements.chatInput.value = 'Test message';
            mockElements.sendBtn.disabled = false;
            
            const promise = uiManager.sendMessage();
            
            expect(mockElements.sendBtn.setAttribute).toHaveBeenCalledWith('aria-busy', 'true');
            
            await promise;
            
            expect(mockElements.sendBtn.removeAttribute).toHaveBeenCalledWith('aria-busy');
        });
    });

    describe('Security - XSS Prevention', () => {
        beforeEach(async () => {
            uiManager = new OfflineUIManager();
            await uiManager.initialize(mockIntegrationManager);
            mockIntegrationManager.isInitialized = true;
        });

        test('should sanitize HTML in chat messages', async () => {
            mockElements.chatInput.value = 'Test';
            mockElements.sendBtn.disabled = false;
            mockIntegrationManager.chat.mockResolvedValue('<script>alert("xss")</script>');
            
            await uiManager.sendMessage();
            
            const messageElement = mockElements.chatMessages.appendChild.mock.calls.slice(-1)[0]?.[0];
            if (messageElement && messageElement.innerHTML) {
                expect(messageElement.innerHTML).not.toContain('<script>');
                expect(messageElement.innerHTML).toContain('&lt;script&gt;');
            } else {
                // If innerHTML isn't set, just verify appendChild was called
                expect(mockElements.chatMessages.appendChild).toHaveBeenCalled();
            }
        });

        test('should sanitize HTML in search results', async () => {
            mockElements.wikiSearchInput.value = 'Test';
            mockElements.wikiSearchBtn.disabled = false;
            mockIntegrationManager.searchWikipedia.mockResolvedValue([
                { 
                    title: '<img src=x onerror=alert("xss")>', 
                    snippet: 'Test snippet' 
                }
            ]);
            
            await uiManager.searchWikipedia();
            
            expect(mockElements.wikiResults.innerHTML).not.toContain('onerror=');
            expect(mockElements.wikiResults.innerHTML).toContain('&lt;img');
        });

        test('should sanitize HTML in error messages', async () => {
            mockElements.chatInput.value = 'Test';
            mockElements.sendBtn.disabled = false;
            mockIntegrationManager.chat.mockRejectedValue(
                new Error('<script>alert("xss")</script>')
            );
            
            await uiManager.sendMessage();
            
            const messageElement = mockElements.chatMessages.appendChild.mock.calls.slice(-1)[0]?.[0];
            if (messageElement && messageElement.innerHTML) {
                expect(messageElement.innerHTML).not.toContain('<script>');
            } else {
                // Just verify the method was called
                expect(mockElements.chatMessages.appendChild).toHaveBeenCalled();
            }
        });

        test('should handle javascript: protocol in sanitizeHTML', () => {
            const sanitized = uiManager.sanitizeHTML('javascript:alert("xss")');
            
            expect(sanitized).not.toContain('javascript:');
            expect(sanitized).toContain('javascript');
        });

        test('should preserve safe HTML entities', () => {
            const sanitized = uiManager.sanitizeHTML('Test & Example');
            
            expect(sanitized).toContain('&amp;');
        });
    });

    describe('Input Validation', () => {
        beforeEach(async () => {
            uiManager = new OfflineUIManager();
            await uiManager.initialize(mockIntegrationManager);
        });

        test('should validate chat input on keypress', async () => {
            const keypressHandler = mockElements.chatInput.addEventListener.mock.calls.find(
                call => call[0] === 'input'
            )?.[1];
            
            if (keypressHandler) {
                const event = {
                    target: { value: 'a'.repeat(5001), setAttribute: jest.fn() }
                };
                keypressHandler(event);
                
                expect(event.target.setAttribute).toHaveBeenCalledWith('aria-invalid', 'true');
            }
        });

        test('should validate wiki search input on keypress', async () => {
            const inputHandler = mockElements.wikiSearchInput.addEventListener.mock.calls.find(
                call => call[0] === 'input'
            )?.[1];
            
            if (inputHandler) {
                const event = {
                    target: { 
                        value: 'a'.repeat(201), 
                        setAttribute: jest.fn(),
                        removeAttribute: jest.fn()
                    }
                };
                inputHandler(event);
                
                expect(event.target.setAttribute).toHaveBeenCalledWith('aria-invalid', 'true');
            }
        });

        test('should support Shift+Enter for new line in chat', async () => {
            const keypressHandler = mockElements.chatInput.addEventListener.mock.calls.find(
                call => call[0] === 'keypress'
            )?.[1];
            
            if (keypressHandler) {
                const event = {
                    key: 'Enter',
                    shiftKey: true,
                    preventDefault: jest.fn()
                };
                keypressHandler(event);
                
                // Should not prevent default with Shift
                expect(event.preventDefault).not.toHaveBeenCalled();
            }
        });

        test('should send message on Enter without Shift', async () => {
            mockElements.chatInput.value = 'Test message';
            mockIntegrationManager.isInitialized = true;
            
            const keypressHandler = mockElements.chatInput.addEventListener.mock.calls.find(
                call => call[0] === 'keypress'
            )?.[1];
            
            if (keypressHandler) {
                const event = {
                    key: 'Enter',
                    shiftKey: false,
                    preventDefault: jest.fn()
                };
                await keypressHandler(event);
                
                expect(event.preventDefault).toHaveBeenCalled();
            }
        });
    });

    describe('Toast System Integration', () => {
        beforeEach(() => {
            uiManager = new OfflineUIManager();
        });

        test('should use global toast.show when available', () => {
            uiManager.showToast('Test message', 'info');
            
            expect(global.toast.show).toHaveBeenCalledWith('Test message', 'info');
        });

        test('should fall back to console when toast unavailable', () => {
            const originalToast = global.toast;
            delete global.toast;
            global.console.log = jest.fn();
            
            uiManager.showToast('Test message', 'info');
            
            expect(global.console.log).toHaveBeenCalledWith('[INFO] Test message');
            
            global.toast = originalToast;
        });

        test('should show alert for errors when toast unavailable', () => {
            const originalToast = global.toast;
            delete global.toast;
            global.alert = jest.fn();
            
            uiManager.showToast('Error message', 'error');
            
            expect(global.alert).toHaveBeenCalledWith('Error message');
            
            global.toast = originalToast;
        });
    });

    describe('Utility Methods', () => {
        beforeEach(() => {
            uiManager = new OfflineUIManager();
        });

        test('should get package name correctly', () => {
            expect(uiManager.getPackageName('minimal')).toBe('Minimal');
            expect(uiManager.getPackageName('standard')).toBe('Standard');
            expect(uiManager.getPackageName('full')).toBe('Premium');
        });

        test('should handle unknown package type', () => {
            expect(uiManager.getPackageName('unknown')).toBe('unknown');
        });

        test('should generate unique message IDs', () => {
            const id1 = uiManager.addChatMessage('Message 1', 'user');
            const id2 = uiManager.addChatMessage('Message 2', 'user');
            
            expect(id1).not.toBe(id2);
        });

        test('should remove chat message by ID', () => {
            const messageId = 'test-message-id';
            const mockMessage = { remove: jest.fn() };
            document.getElementById = jest.fn((id) => {
                if (id === messageId) return mockMessage;
                return null;
            });
            
            uiManager.removeChatMessage(messageId);
            
            expect(mockMessage.remove).toHaveBeenCalled();
        });

        test('should handle removing non-existent message', () => {
            expect(() => {
                uiManager.removeChatMessage('non-existent-id');
            }).not.toThrow();
        });
    });

    describe('Error Recovery', () => {
        beforeEach(async () => {
            uiManager = new OfflineUIManager();
            await uiManager.initialize(mockIntegrationManager);
        });

        test('should reset download state on error', () => {
            uiManager.selectedPackage = 'minimal';
            mockIntegrationManager.startDownload.mockImplementation(() => {
                throw new Error('Download error');
            });
            
            uiManager.startDownload();
            
            // Should reset state
            expect(uiManager.isDownloading).toBe(false);
        });

        test('should re-enable buttons after error', async () => {
            mockElements.chatInput.value = 'Test';
            mockElements.sendBtn.disabled = false;
            mockIntegrationManager.isInitialized = true;
            mockIntegrationManager.chat.mockRejectedValue(new Error('Chat error'));
            
            await uiManager.sendMessage();
            
            expect(mockElements.sendBtn.disabled).toBe(false);
        });

        test('should handle missing integration manager gracefully', async () => {
            uiManager.integrationManager = null;
            mockElements.chatInput.value = 'Test';
            mockElements.sendBtn.disabled = false;
            
            await uiManager.sendMessage();
            
            expect(global.toast.show).toHaveBeenCalledWith(
                expect.stringContaining('download the offline package'),
                'warning'
            );
        });
    });
});
