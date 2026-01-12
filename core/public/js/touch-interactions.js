/**
 * Touch Interactions and Gesture Support for AI Questions
 * Provides swipe gestures, touch feedback, and mobile-optimized interactions
 */

(function() {
    'use strict';

    // Touch gesture handler class
    class TouchGestureHandler {
        constructor(element, options = {}) {
            this.element = element;
            this.options = {
                threshold: options.threshold || 50,
                allowedTime: options.allowedTime || 500,
                restraint: options.restraint || 100,
                ...options
            };
            
            this.touchStartX = 0;
            this.touchStartY = 0;
            this.touchEndX = 0;
            this.touchEndY = 0;
            this.startTime = 0;
            
            this.init();
        }
        
        init() {
            this.element.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
            this.element.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: true });
            this.element.addEventListener('touchend', this.handleTouchEnd.bind(this), false);
        }
        
        handleTouchStart(e) {
            const touch = e.changedTouches[0];
            this.touchStartX = touch.pageX;
            this.touchStartY = touch.pageY;
            this.startTime = new Date().getTime();
        }
        
        handleTouchMove(e) {
            const touch = e.changedTouches[0];
            this.touchEndX = touch.pageX;
            this.touchEndY = touch.pageY;
        }
        
        handleTouchEnd(e) {
            const elapsedTime = new Date().getTime() - this.startTime;
            
            if (elapsedTime <= this.options.allowedTime) {
                const distX = this.touchEndX - this.touchStartX;
                const distY = this.touchEndY - this.touchStartY;
                
                if (Math.abs(distX) >= this.options.threshold && Math.abs(distY) <= this.options.restraint) {
                    const direction = distX < 0 ? 'left' : 'right';
                    this.triggerSwipe(direction, distX);
                } else if (Math.abs(distY) >= this.options.threshold && Math.abs(distX) <= this.options.restraint) {
                    const direction = distY < 0 ? 'up' : 'down';
                    this.triggerSwipe(direction, distY);
                }
            }
        }
        
        triggerSwipe(direction, distance) {
            const event = new CustomEvent('swipe', {
                detail: { direction, distance }
            });
            this.element.dispatchEvent(event);
        }
    }

    // Add haptic feedback for touch interactions (if supported)
    function addHapticFeedback(intensity = 'medium') {
        if ('vibrate' in navigator) {
            const patterns = {
                light: 10,
                medium: 20,
                heavy: 30
            };
            navigator.vibrate(patterns[intensity] || 20);
        }
    }

    // Add touch ripple effect to buttons
    function addRippleEffect(button) {
        button.addEventListener('touchstart', function(e) {
            const ripple = document.createElement('span');
            ripple.classList.add('touch-ripple');
            
            const rect = this.getBoundingClientRect();
            const touch = e.touches[0];
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;
            
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            
            this.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
            
            addHapticFeedback('light');
        }, { passive: true });
    }

    // Prevent double-tap zoom on buttons
    function preventDoubleTapZoom(element) {
        let lastTap = 0;
        element.addEventListener('touchend', function(e) {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTap;
            if (tapLength < 500 && tapLength > 0) {
                e.preventDefault();
            }
            lastTap = currentTime;
        });
    }

    // Add pull-to-refresh indicator
    function initPullToRefresh() {
        let startY = 0;
        let isPulling = false;
        const threshold = 80;
        
        const refreshIndicator = document.createElement('div');
        refreshIndicator.id = 'pull-to-refresh-indicator';
        refreshIndicator.style.cssText = `
            position: fixed;
            top: -60px;
            left: 50%;
            transform: translateX(-50%);
            background: white;
            padding: 10px 20px;
            border-radius: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            z-index: 9999;
            transition: top 0.3s ease;
            font-size: 14px;
            color: #666;
        `;
        refreshIndicator.textContent = '↓ Pull to refresh';
        document.body.appendChild(refreshIndicator);
        
        document.addEventListener('touchstart', function(e) {
            if (window.scrollY === 0) {
                startY = e.touches[0].pageY;
                isPulling = true;
            }
        }, { passive: true });
        
        document.addEventListener('touchmove', function(e) {
            if (!isPulling) return;
            
            const currentY = e.touches[0].pageY;
            const diff = currentY - startY;
            
            if (diff > 0 && diff < threshold * 2) {
                refreshIndicator.style.top = Math.min(diff - 60, 20) + 'px';
                refreshIndicator.textContent = diff > threshold ? '↑ Release to refresh' : '↓ Pull to refresh';
            }
        }, { passive: true });
        
        document.addEventListener('touchend', function(e) {
            if (!isPulling) return;
            
            const endY = e.changedTouches[0].pageY;
            const diff = endY - startY;
            
            if (diff > threshold) {
                refreshIndicator.textContent = '⟳ Refreshing...';
                refreshIndicator.style.top = '20px';
                
                setTimeout(() => {
                    location.reload();
                }, 500);
            } else {
                refreshIndicator.style.top = '-60px';
            }
            
            isPulling = false;
        });
    }

    // Swipeable modals
    function makeModalSwipeable(modal) {
        const gestureHandler = new TouchGestureHandler(modal, { threshold: 100 });
        
        modal.addEventListener('swipe', function(e) {
            if (e.detail.direction === 'down') {
                // Close modal on swipe down
                const closeButton = modal.querySelector('.schedule-btn-secondary, .notification-close');
                if (closeButton) {
                    addHapticFeedback('medium');
                    closeButton.click();
                }
            }
        });
    }

    // Swipeable notifications
    function makeNotificationSwipeable(notification) {
        const gestureHandler = new TouchGestureHandler(notification, { threshold: 80 });
        
        notification.addEventListener('swipe', function(e) {
            if (e.detail.direction === 'left' || e.detail.direction === 'right') {
                addHapticFeedback('light');
                notification.style.transform = `translateX(${e.detail.distance * 2}px)`;
                notification.style.opacity = '0';
                
                setTimeout(() => {
                    const closeButton = notification.querySelector('.notification-close');
                    if (closeButton) {
                        closeButton.click();
                    } else {
                        notification.remove();
                    }
                }, 300);
            }
        });
    }

    // Initialize touch interactions when DOM is ready
    function initTouchInteractions() {
        // Add ripple effect to all buttons
        document.querySelectorAll('button, .auth-button, .nav-link, .ask-button').forEach(button => {
            addRippleEffect(button);
            preventDoubleTapZoom(button);
        });

        // Make modals swipeable
        document.querySelectorAll('.schedule-modal, .analytics-modal').forEach(modal => {
            makeModalSwipeable(modal);
        });

        // Observe new notifications and make them swipeable
        const notificationContainer = document.getElementById('notification-container');
        if (notificationContainer) {
            const observer = new MutationObserver(mutations => {
                mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                        if (node.classList && node.classList.contains('notification')) {
                            makeNotificationSwipeable(node);
                        }
                    });
                });
            });
            
            observer.observe(notificationContainer, { childList: true });
        }

        // Initialize pull-to-refresh on touch devices
        if ('ontouchstart' in window) {
            initPullToRefresh();
        }

        // Add smooth scroll behavior
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    addHapticFeedback('light');
                }
            });
        });
    }

    // Add CSS for ripple effect
    const rippleStyle = document.createElement('style');
    rippleStyle.textContent = `
        button, .auth-button, .nav-link, .ask-button {
            position: relative;
            overflow: hidden;
        }
        
        .touch-ripple {
            position: absolute;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.6);
            transform: scale(0);
            animation: ripple-animation 0.6s ease-out;
            pointer-events: none;
        }
        
        @keyframes ripple-animation {
            to {
                transform: scale(4);
                opacity: 0;
            }
        }
        
        /* Improve touch scrolling */
        * {
            -webkit-overflow-scrolling: touch;
        }
        
        /* Prevent text selection on touch */
        button, .auth-button, .nav-link {
            -webkit-touch-callout: none;
            -webkit-user-select: none;
            -khtml-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
            user-select: none;
        }
        
        /* Active state feedback */
        button:active, .auth-button:active, .nav-link:active {
            filter: brightness(0.9);
        }
    `;
    document.head.appendChild(rippleStyle);

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTouchInteractions);
    } else {
        initTouchInteractions();
    }

    // Re-initialize for dynamically added elements
    window.reinitTouchInteractions = initTouchInteractions;

})();
