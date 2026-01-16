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
            if (typeof IntegrationManager !== 'undefined') {
                window.app = new IntegrationManager();
                console.log('[OfflineInit] IntegrationManager initialized');
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

            // Initialize Wikipedia Public Search
            if (typeof WikipediaPublicSearch !== 'undefined') {
                window.wikipediaSearch = new WikipediaPublicSearch();
                window.wikipediaSearch.initialize();
                console.log('[OfflineInit] Wikipedia search initialized');
            } else {
                console.error('[OfflineInit] WikipediaPublicSearch not loaded');
            }

            // Initialize OfflineAIChat
            if (typeof OfflineAIChat !== 'undefined') {
                window.offlineAIChat = new OfflineAIChat();
                console.log('[OfflineInit] OfflineAIChat instance created');
                
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
