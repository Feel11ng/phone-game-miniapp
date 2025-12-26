// API Service with caching and request optimization
class ApiService {
    constructor() {
        this.cache = new Map();
        this.pendingRequests = new Map();
        this.cacheTTL = 5 * 60 * 1000; // 5 minutes cache TTL
        this.baseUrl = '/api'; // Update with your API base URL
    }

    // Get data with caching
    async get(endpoint, useCache = true) {
        const cacheKey = `GET:${endpoint}`;
        const now = Date.now();
        
        // Return cached data if available and fresh
        if (useCache && this.cache.has(cacheKey)) {
            const { data, timestamp } = this.cache.get(cacheKey);
            if (now - timestamp < this.cacheTTL) {
                return data;
            }
        }

        // Return pending promise if request is in progress
        if (this.pendingRequests.has(cacheKey)) {
            return this.pendingRequests.get(cacheKey);
        }

        try {
            const request = fetch(`${this.baseUrl}${endpoint}`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    // Cache the response
                    this.cache.set(cacheKey, {
                        data,
                        timestamp: now
                    });
                    return data;
                })
                .finally(() => {
                    // Clean up pending request
                    this.pendingRequests.delete(cacheKey);
                });

            // Store the pending request
            this.pendingRequests.set(cacheKey, request);
            
            return await request;
        } catch (error) {
            console.error(`API Error (${endpoint}):`, error);
            throw error;
        }
    }

    // Post data to the server
    async post(endpoint, data, method = 'POST') {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`API Error (${method} ${endpoint}):`, error);
            throw error;
        }
    }

    // Clear specific cache entry
    clearCache(endpoint) {
        const cacheKey = `GET:${endpoint}`;
        this.cache.delete(cacheKey);
    }

    // Clear all cached data
    clearAllCache() {
        this.cache.clear();
    }
}

// Create a singleton instance
export const apiService = new ApiService();

// Throttle function for event handlers
export function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Debounce function for search inputs
export function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// Lazy load images
export function lazyLoadImages() {
    const lazyImages = document.querySelectorAll('img[data-src]');
    
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                observer.unobserve(img);
            }
        });
    });

    lazyImages.forEach(img => imageObserver.observe(img));
}

// Initialize lazy loading when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    lazyLoadImages();
    
    // Re-run lazy loading when content is dynamically added
    const observer = new MutationObserver(lazyLoadImages);
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
});
