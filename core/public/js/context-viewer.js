// Context Viewer JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Initialize context viewers
    initializeContextViewers();
});

function initializeContextViewers() {
    const contextViewers = document.querySelectorAll('.context-viewer');
    
    contextViewers.forEach(viewer => {
        const content = viewer.querySelector('.context-content');
        const toggle = viewer.querySelector('.context-toggle');
        
        if (content && toggle) {
            toggle.addEventListener('click', function() {
                const isExpanded = content.classList.contains('expanded');
                
                if (isExpanded) {
                    content.classList.remove('expanded');
                    viewer.classList.remove('expanded');
                    toggle.textContent = 'Show more';
                } else {
                    content.classList.add('expanded');
                    viewer.classList.add('expanded');
                    toggle.textContent = 'Show less';
                }
            });
        }
    });
}

// Utility function to create context viewer
function createContextViewer(title, content) {
    const viewer = document.createElement('div');
    viewer.className = 'context-viewer';
    
    viewer.innerHTML = `
        <h3>${title}</h3>
        <div class="context-content">
            <p>${content}</p>
        </div>
        <button class="context-toggle">Show more</button>
    `;
    
    return viewer;
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initializeContextViewers,
        createContextViewer
    };
}

