// AI Questions - Main JavaScript File

// Service Worker Registration with Update Handling
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
                
                // Check for updates periodically (every 5 minutes)
                setInterval(() => {
                    registration.update();
                }, 5 * 60 * 1000);
                
                // Handle service worker updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New service worker is ready, notify user
                            showUpdateNotification();
                        }
                    });
                });
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
        
        // Listen for controller change (new service worker activated)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('New service worker activated, reloading page...');
            window.location.reload();
        });
    });
}

// Show update notification to user
function showUpdateNotification() {
    const notification = document.createElement('div');
    notification.id = 'sw-update-notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        max-width: 400px;
    `;
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <div style="flex: 1;">
                <strong>Update Available</strong>
                <p style="margin: 4px 0 0 0; font-size: 14px;">A new version is ready. Click to refresh.</p>
            </div>
            <button id="sw-update-button" style="
                background: white;
                color: #4CAF50;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                font-weight: 600;
            ">Refresh</button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    document.getElementById('sw-update-button').addEventListener('click', () => {
        // Tell the new service worker to skip waiting
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
        }
    });
}

// Connection status check
function updateConnectionStatus() {
    const statusElement = document.getElementById('status-text');
    const statusContainer = document.getElementById('connection-status');
    
    if (statusElement && statusContainer) {
        if (navigator.onLine) {
            statusElement.textContent = 'You are currently online. All features are available.';
            statusContainer.classList.add('online');
            statusContainer.classList.remove('offline');
        } else {
            statusElement.textContent = 'You are currently offline. Only cached content is available.';
            statusContainer.classList.add('offline');
            statusContainer.classList.remove('online');
        }
    }
}

// Initial check
document.addEventListener('DOMContentLoaded', () => {
    updateConnectionStatus();
    
    // Listen for changes
    window.addEventListener('online', updateConnectionStatus);
    window.addEventListener('offline', updateConnectionStatus);
    
    // Load cached questions if on offline page
    if (document.getElementById('questions-container')) {
        loadCachedQuestions();
    }
});

// Load cached questions
async function loadCachedQuestions() {
    const container = document.getElementById('questions-container');
    
    if (!container) return;
    
    try {
        // Try to fetch from cache first
        const cache = await caches.open('ai-questions-cache-v1');
        const cachedResponse = await cache.match('/api/cached-questions');
        
        if (cachedResponse) {
            const data = await cachedResponse.json();
            displayQuestions(data.questions);
        } else {
            // If not in cache and online, fetch from server
            if (navigator.onLine) {
                try {
                    const response = await fetch('/api/daily-question');
                    if (response.ok) {
                        const data = await response.json();
                        
                        // Store in cache for offline use
                        const questionsCache = {
                            questions: [
                                {
                                    question: data.question.question,
                                    context: data.question.context,
                                    answer: data.answer ? data.answer.answer : 'No answer available',
                                    model: data.answer ? data.answer.model_name : 'Unknown',
                                    date: new Date().toISOString()
                                }
                            ]
                        };
                        
                        const cache = await caches.open('ai-questions-cache-v1');
                        await cache.put('/api/cached-questions', new Response(JSON.stringify(questionsCache)));
                        
                        displayQuestions(questionsCache.questions);
                    } else {
                        container.innerHTML = '<p>Failed to fetch questions from server.</p>';
                    }
                } catch (error) {
                    container.innerHTML = '<p>Error fetching questions: ' + error.message + '</p>';
                }
            } else {
                container.innerHTML = '<p>No cached questions available. Connect to the internet to download questions.</p>';
            }
        }
    } catch (error) {
        console.error('Error loading cached questions:', error);
        container.innerHTML = '<p>Error loading questions: ' + error.message + '</p>';
    }
}

function displayQuestions(questions) {
    const container = document.getElementById('questions-container');
    
    if (!container) return;
    
    if (!questions || questions.length === 0) {
        container.innerHTML = '<p>No cached questions available.</p>';
        return;
    }
    
    let html = '';
    
    questions.forEach(question => {
        html += `
            <div class="question-card">
                <h3>${question.question}</h3>
                <div class="context">${question.context}</div>
                <div class="answer">${question.answer}</div>
                <div class="meta">
                    Model: ${question.model} | 
                    Date: ${new Date(question.date).toLocaleDateString()}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}
