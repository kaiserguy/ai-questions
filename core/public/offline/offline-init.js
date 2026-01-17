/**
 * Offline Mode Initialization Script
 * Handles setup of UI managers, chat, and offline components.
 */

(function() {
    console.log('[OfflineInit] Script execution started');

    // Initialize function that can be called immediately or on DOMContentLoaded
    const initializeApp = async () => {
        console.log('[OfflineInit] initializeApp started');
        try {
            // Initialize chat first (defined in offline.ejs)
            if (typeof initializeChat === 'function') {
                initializeChat();
            }

            // Initialize Integration Manager (for offline mode)
            if (typeof OfflineIntegrationManager !== 'undefined') {
                window.offlineIntegrationManager = new OfflineIntegrationManager();
                window.app = window.offlineIntegrationManager; // Keep backward compatibility
                console.log('[OfflineInit] OfflineIntegrationManager initialized');
                
                // Initialize to detect existing components
                await window.offlineIntegrationManager.initialize();
            } else {
                console.log('[OfflineInit] Running in server mode - using API chat endpoint');
            }
            
            // Initialize UI Manager (for offline mode)
            if (typeof OfflineUIManager !== 'undefined') {
                window.uiManager = new OfflineUIManager();
                await window.uiManager.initialize(window.app);
                console.log('[OfflineInit] OfflineUIManager initialized');
            } else {
                console.log('[OfflineInit] OfflineUIManager not loaded - offline features disabled');
            }

            // Initialize AI-Powered Wikipedia Search (primary)
            if (typeof AIWikipediaSearch !== 'undefined') {
                window.aiWikipediaSearch = new AIWikipediaSearch();
                await window.aiWikipediaSearch.initialize();
                console.log('[OfflineInit] AI Wikipedia search initialized');
                
                // Update status indicator and show the wiki section
                const statusEl = document.getElementById('wikiSearchStatus');
                const statusText = document.getElementById('wikiStatusText');
                const wikiSection = document.getElementById('wikiSection');
                
                if (statusEl && statusText) {
                    const status = window.aiWikipediaSearch.getStatus();
                    if (status.dbReady) {
                        statusEl.style.display = 'block';
                        statusEl.style.background = '#d1fae5';
                        statusText.textContent = '✅ AI search ready - Local Wikipedia database loaded';
                        // Show the wiki section when database is ready
                        if (wikiSection) {
                            wikiSection.style.display = 'block';
                            console.log('[OfflineInit] Wiki section shown - database ready');
                        }
                    } else {
                        statusEl.style.display = 'block';
                        statusEl.style.background = '#fef3c7';
                        statusText.textContent = '⚠️ Download the offline package to enable local Wikipedia search';
                        // Still show the wiki section so users know it exists
                        if (wikiSection) {
                            wikiSection.style.display = 'block';
                            console.log('[OfflineInit] Wiki section shown - waiting for download');
                        }
                    }
                }
            } else if (typeof WikipediaPublicSearch !== 'undefined') {
                // Fallback to public search if AI search not available
                window.wikipediaSearch = new WikipediaPublicSearch();
                window.wikipediaSearch.initialize();
                console.log('[OfflineInit] Wikipedia public search initialized (fallback)');
            } else {
                console.error('[OfflineInit] No Wikipedia search module loaded');
            }

            // Initialize OfflineAIChat
            if (typeof OfflineAIChat !== 'undefined') {
                window.offlineAIChat = new OfflineAIChat();
                console.log('[OfflineInit] OfflineAIChat instance created');
                
                // Initialize the chat (this sets initialized = true)
                await window.offlineAIChat.initialize();
                console.log('[OfflineInit] OfflineAIChat initialized');
                
                // Update model status (defined in offline.ejs)
                if (typeof updateModelStatus === 'function') {
                    await updateModelStatus();
                    
                    // Listen for model download events
                    window.addEventListener('modelDownloaded', updateModelStatus);
                    window.addEventListener('modelLoaded', updateModelStatus);
                }
            } else {
                console.error('[OfflineInit] OfflineAIChat not loaded');
            }
            
            console.log('[OfflineInit] Application initialization complete');
        } catch (err) {
            console.error('[OfflineInit] Failed to initialize application:', err);
        }
    };

    // Execute immediately if DOM is already loaded, otherwise wait for DOMContentLoaded
    console.log('[OfflineInit] Checking document.readyState:', document.readyState);
    if (document.readyState === 'loading') {
        console.log('[OfflineInit] DOM still loading, adding event listener');
        document.addEventListener('DOMContentLoaded', initializeApp);
    } else {
        // DOM is already loaded, execute immediately
        console.log('[OfflineInit] DOM already loaded, executing immediately');
        initializeApp().catch(e => console.error('[OfflineInit] Initialization error:', e));
    }
})();
