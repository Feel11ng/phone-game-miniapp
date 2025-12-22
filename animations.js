// Animation utilities for smooth transitions and loading states
class AnimationManager {
    static init() {
        // Add CSS for animations if not already present
        this.injectAnimationStyles();
    }

    static injectAnimationStyles() {
        if (document.getElementById('animation-styles')) return;

        const style = document.createElement('style');
        style.id = 'animation-styles';
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
            @keyframes slideInUp {
                from { 
                    opacity: 0;
                    transform: translateY(20px);
                }
                to { 
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            @keyframes slideOutDown {
                from { 
                    opacity: 1;
                    transform: translateY(0);
                }
                to { 
                    opacity: 0;
                    transform: translateY(20px);
                }
            }
            .fade-in {
                animation: fadeIn 0.3s ease-out forwards;
            }
            .fade-out {
                animation: fadeOut 0.3s ease-out forwards;
            }
            .slide-in-up {
                animation: slideInUp 0.3s ease-out forwards;
            }
            .slide-out-down {
                animation: slideOutDown 0.3s ease-out forwards;
            }
            .skeleton-loading {
                background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                background-size: 200% 100%;
                animation: shimmer 1.5s infinite linear;
            }
            @keyframes shimmer {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
            }
            .pulse {
                animation: pulse 2s infinite;
            }
            @keyframes pulse {
                0% { opacity: 0.6; }
                50% { opacity: 1; }
                100% { opacity: 0.6; }
            }
        `;
        document.head.appendChild(style);
    }

    // Page transitions
    static async transitionPage(oldPage, newPage, transitionType = 'fade') {
        if (!newPage) return;

        // Set initial states
        if (oldPage) {
            oldPage.style.position = 'absolute';
            oldPage.style.width = '100%';
            oldPage.style.top = '0';
            oldPage.style.left = '0';
        }

        newPage.style.display = 'block';
        newPage.style.opacity = '0';
        document.body.appendChild(newPage);

        // Start animations
        const animations = [];
        
        if (oldPage) {
            const oldAnimation = oldPage.animate(
                [{ opacity: 1 }, { opacity: 0 }],
                { duration: 300, easing: 'ease-in-out' }
            );
            animations.push(new Promise(resolve => {
                oldAnimation.onfinish = () => {
                    oldPage.style.display = 'none';
                    oldPage.style.opacity = '';
                    resolve();
                };
            }));
        }

        const newAnimation = newPage.animate(
            [{ opacity: 0 }, { opacity: 1 }],
            { duration: 300, delay: 100, easing: 'ease-in-out' }
        );
        animations.push(new Promise(resolve => {
            newAnimation.onfinish = () => {
                newPage.style.opacity = '1';
                resolve();
            };
        }));

        await Promise.all(animations);
        
        // Clean up old page
        if (oldPage && oldPage.parentNode) {
            oldPage.parentNode.removeChild(oldPage);
        }
    }

    // Show loading state
    static showLoading(element, options = {}) {
        const { text = 'Loading...', fullPage = false } = options;
        
        const loadingElement = document.createElement('div');
        loadingElement.className = `loading-overlay ${fullPage ? 'full-page' : ''}`;
        loadingElement.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                ${text ? `<div class="loading-text">${text}</div>` : ''}
            </div>
        `;
        
        element.style.position = 'relative';
        element.appendChild(loadingElement);
        
        return {
            hide: () => {
                loadingElement.classList.add('fade-out');
                setTimeout(() => {
                    if (loadingElement.parentNode) {
                        loadingElement.parentNode.removeChild(loadingElement);
                    }
                }, 300);
            }
        };
    }

    // Create skeleton loading placeholders
    static createSkeletonLoader(count = 1, options = {}) {
        const { 
            width = '100%', 
            height = '1rem', 
            className = '',
            style = ''
        } = options;
        
        const elements = [];
        for (let i = 0; i < count; i++) {
            const element = document.createElement('div');
            element.className = `skeleton-loading ${className}`;
            element.style.width = width;
            element.style.height = height;
            element.style.marginBottom = '0.5rem';
            element.style.borderRadius = '4px';
            
            if (style) {
                Object.assign(element.style, style);
            }
            
            elements.push(element);
        }
        
        return elements.length === 1 ? elements[0] : elements;
    }

    // Animate element with a shake effect
    static shake(element) {
        element.style.animation = 'shake 0.5s';
        element.addEventListener('animationend', () => {
            element.style.animation = '';
        }, { once: true });
    }
}

// Initialize animations when the script loads
document.addEventListener('DOMContentLoaded', () => {
    AnimationManager.init();
});

// Export for use in other modules
export default AnimationManager;
