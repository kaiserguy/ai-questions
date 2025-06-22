// AI Questions - Main JavaScript File

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
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
