/**
 * Context Viewer Module
 * 
 * Provides functionality to view the context and prompt version used for AI answers
 */

function showContextModal(context, promptVersion) {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'context-modal-overlay';
    
    // Create modal content
    const modal = document.createElement('div');
    modal.className = 'context-modal';
    
    modal.innerHTML = `
        <div class="context-modal-header">
            <h3>Context & Prompt Details</h3>
            <button class="context-modal-close">&times;</button>
        </div>
        <div class="context-modal-body">
            <div class="context-section">
                <h4>Prompt Version</h4>
                <div class="prompt-version-badge">${promptVersion || '1.0'}</div>
                <div class="prompt-version-info">
                    ${getPromptVersionInfo(promptVersion)}
                </div>
            </div>
            <div class="context-section">
                <h4>Context Used</h4>
                <div class="context-content">${context || 'No context was used for this answer.'}</div>
            </div>
        </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Add event listeners
    const closeButton = modal.querySelector('.context-modal-close');
    closeButton.addEventListener('click', () => {
        document.body.removeChild(overlay);
    });
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            document.body.removeChild(overlay);
        }
    });
    
    // Add escape key listener
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            document.body.removeChild(overlay);
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);
}

function getPromptVersionInfo(version) {
    switch(version) {
        case '1.0':
            return 'Original verbose prompt format that provides detailed answers.';
        case '2.0':
            return 'Concise prompt format that focuses on direct and efficient answers.';
        default:
            return 'Custom or unknown prompt version.';
    }
}

// Export functions for use in other scripts
window.showContextModal = showContextModal;

