/**
 * Toast Notification System
 * Provides user feedback for actions, errors, and success messages
 */

class ToastManager {
    constructor() {
        this.container = null;
        this.toasts = [];
        this.init();
    }

    init() {
        // Create toast container if it doesn't exist
        if (!document.getElementById('toast-container')) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            this.container.className = 'toast-container';
            this.container.setAttribute('role', 'region');
            this.container.setAttribute('aria-label', 'Notifications');
            this.container.setAttribute('aria-live', 'polite');
            document.body.appendChild(this.container);
        } else {
            this.container = document.getElementById('toast-container');
        }
    }

    /**
     * Show a toast notification
     * @param {string} message - The message to display
     * @param {string} type - Type of toast (success, error, warning, info)
     * @param {number} duration - Duration in milliseconds (0 for persistent)
     * @param {string} title - Optional title for the toast
     */
    show(message, type = 'info', duration = 5000, title = null) {
        const toast = this.createToast(message, type, title);
        this.container.appendChild(toast);
        this.toasts.push(toast);

        // Auto-dismiss after duration
        if (duration > 0) {
            setTimeout(() => {
                this.dismiss(toast);
            }, duration);
        }

        return toast;
    }

    createToast(message, type, title) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');

        const icon = this.getIcon(type);
        const titleText = title || this.getDefaultTitle(type);

        toast.innerHTML = `
            <span class="toast-icon" aria-hidden="true">${icon}</span>
            <div class="toast-content">
                ${titleText ? `<div class="toast-title">${titleText}</div>` : ''}
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close" aria-label="Close notification">×</button>
        `;

        // Add close button functionality
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => this.dismiss(toast));

        return toast;
    }

    getIcon(type) {
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };
        return icons[type] || icons.info;
    }

    getDefaultTitle(type) {
        const titles = {
            success: 'Success',
            error: 'Error',
            warning: 'Warning',
            info: 'Info'
        };
        return titles[type] || '';
    }

    dismiss(toast) {
        toast.classList.add('hiding');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
            this.toasts = this.toasts.filter(t => t !== toast);
        }, 300);
    }

    dismissAll() {
        this.toasts.forEach(toast => this.dismiss(toast));
    }

    // Convenience methods
    success(message, title = null, duration = 5000) {
        return this.show(message, 'success', duration, title);
    }

    error(message, title = null, duration = 7000) {
        return this.show(message, 'error', duration, title);
    }

    warning(message, title = null, duration = 6000) {
        return this.show(message, 'warning', duration, title);
    }

    info(message, title = null, duration = 5000) {
        return this.show(message, 'info', duration, title);
    }
}

// Create global toast instance
const toast = new ToastManager();

/**
 * Loading State Manager
 * Manages loading states for buttons and page overlays
 */
class LoadingManager {
    constructor() {
        this.activeLoaders = new Set();
    }

    /**
     * Show loading state on a button
     * @param {HTMLElement} button - The button element
     */
    showButton(button) {
        if (!button) return;
        button.classList.add('loading');
        button.disabled = true;
        button.dataset.originalText = button.textContent;
    }

    /**
     * Hide loading state on a button
     * @param {HTMLElement} button - The button element
     */
    hideButton(button) {
        if (!button) return;
        button.classList.remove('loading');
        button.disabled = false;
        if (button.dataset.originalText) {
            button.textContent = button.dataset.originalText;
            delete button.dataset.originalText;
        }
    }

    /**
     * Show a full-page loading overlay
     * @param {string} message - Optional loading message
     */
    showOverlay(message = 'Loading...') {
        const existingOverlay = document.getElementById('loading-overlay');
        if (existingOverlay) return;

        const overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.className = 'loading-overlay';
        overlay.setAttribute('role', 'alert');
        overlay.setAttribute('aria-busy', 'true');
        overlay.setAttribute('aria-label', message);
        
        overlay.innerHTML = `
            <div style="text-align: center;">
                <div class="spinner-large"></div>
                <div class="loading-text">${message}</div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        this.activeLoaders.add('overlay');
    }

    /**
     * Hide the full-page loading overlay
     */
    hideOverlay() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.remove();
            this.activeLoaders.delete('overlay');
        }
    }

    /**
     * Show a progress bar at the top of the page
     */
    showProgressBar() {
        const existingBar = document.getElementById('progress-bar');
        if (existingBar) return;

        const bar = document.createElement('div');
        bar.id = 'progress-bar';
        bar.className = 'progress-bar';
        bar.setAttribute('role', 'progressbar');
        bar.setAttribute('aria-label', 'Loading progress');
        
        document.body.appendChild(bar);
        this.activeLoaders.add('progressbar');
    }

    /**
     * Hide the progress bar
     */
    hideProgressBar() {
        const bar = document.getElementById('progress-bar');
        if (bar) {
            setTimeout(() => bar.remove(), 300);
            this.activeLoaders.delete('progressbar');
        }
    }

    /**
     * Create an inline spinner
     * @param {boolean} dark - Use dark spinner for light backgrounds
     */
    createSpinner(dark = false) {
        const spinner = document.createElement('span');
        spinner.className = `spinner ${dark ? 'dark' : ''}`;
        spinner.setAttribute('role', 'status');
        spinner.setAttribute('aria-label', 'Loading');
        return spinner;
    }
}

// Create global loading instance
const loading = new LoadingManager();

/**
 * Async Action Handler
 * Wraps async functions with loading states and error handling
 */
async function handleAsyncAction(action, button = null, options = {}) {
    const {
        loadingMessage = 'Processing...',
        successMessage = 'Action completed successfully',
        errorMessage = 'An error occurred',
        showOverlay = false,
        showProgressBar = false,
        onSuccess = null,
        onError = null
    } = options;

    try {
        // Show loading state
        if (button) {
            loading.showButton(button);
        }
        if (showOverlay) {
            loading.showOverlay(loadingMessage);
        }
        if (showProgressBar) {
            loading.showProgressBar();
        }

        // Execute action
        const result = await action();

        // Show success message
        if (successMessage) {
            toast.success(successMessage);
        }

        // Call success callback
        if (onSuccess) {
            onSuccess(result);
        }

        return result;
    } catch (error) {
        console.error('Async action error:', error);
        
        // Show error message
        const errorMsg = error.message || errorMessage;
        toast.error(errorMsg);

        // Call error callback
        if (onError) {
            onError(error);
        }

        throw error;
    } finally {
        // Hide loading states
        if (button) {
            loading.hideButton(button);
        }
        if (showOverlay) {
            loading.hideOverlay();
        }
        if (showProgressBar) {
            loading.hideProgressBar();
        }
    }
}

/**
 * Fetch with loading and error handling
 */
async function fetchWithFeedback(url, options = {}, feedbackOptions = {}) {
    const {
        method = 'GET',
        headers = {},
        body = null,
        ...fetchOptions
    } = options;

    const {
        showLoading = true,
        successMessage = null,
        errorMessage = 'Request failed',
        ...handlerOptions
    } = feedbackOptions;

    const action = async () => {
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            },
            body: body ? JSON.stringify(body) : null,
            ...fetchOptions
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
        }

        return await response.json();
    };

    if (showLoading) {
        return handleAsyncAction(action, null, {
            successMessage,
            errorMessage,
            ...handlerOptions
        });
    } else {
        return action();
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { toast, loading, handleAsyncAction, fetchWithFeedback };
}
