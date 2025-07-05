// Version management system - Enhanced cache busting
export const AppVersion = {
    version: '1.0.8',
    buildDate: new Date().toISOString(),
    
    // Get version string for aggressive cache busting
    getVersionString() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `v=${this.version}&t=${timestamp}&r=${random}&nocache=true&bust=${timestamp}&force=reload`;
    },
    
    // Get version for display
    getDisplayVersion() {
        return `v${this.version}`;
    },
    
    // Get build info
    getBuildInfo() {
        return {
            version: this.version,
            buildDate: this.buildDate,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString()
        };
    },
    
    // Check if version has changed (for future updates)
    checkVersion() {
        const storedVersion = localStorage.getItem('tavernaVersion');
        if (storedVersion !== this.version) {
            localStorage.setItem('tavernaVersion', this.version);
            return true; // Version changed
        }
        return false; // Same version
    },
    
    // Force reload with aggressive cache clear
    forceReload() {
        console.log('🔄 Forzatura ricaricamento con pulizia cache aggressiva...');
        
        // Clear all possible caches
        if ('caches' in window) {
            caches.keys().then(names => {
                names.forEach(name => {
                    caches.delete(name);
                });
            });
        }
        
        // Clear all localStorage except session data
        const sessionData = localStorage.getItem('tavernaSession');
        localStorage.clear();
        if (sessionData) {
            localStorage.setItem('tavernaSession', sessionData);
        }
        
        // Clear sessionStorage
        sessionStorage.clear();
        
        // Add aggressive cache busting parameters to current URL
        const url = new URL(window.location);
        url.searchParams.set('v', this.version);
        url.searchParams.set('t', Date.now());
        url.searchParams.set('r', Math.random().toString(36).substr(2, 9));
        url.searchParams.set('nocache', 'true');
        url.searchParams.set('bust', Date.now());
        url.searchParams.set('reload', 'force');
        url.searchParams.set('clear', 'all');
        
        // Force hard reload
        window.location.replace(url.toString());
    },
    
    // Disable cache for all resources
    disableCache() {
        // Add meta tags to disable cache
        const metaTags = [
            { name: 'Cache-Control', content: 'no-cache, no-store, must-revalidate, max-age=0' },
            { name: 'Pragma', content: 'no-cache' },
            { name: 'Expires', content: '0' }
        ];
        
        metaTags.forEach(tag => {
            const meta = document.createElement('meta');
            meta.httpEquiv = tag.name;
            meta.content = tag.content;
            document.head.appendChild(meta);
        });
        
        // Override fetch to add cache busting
        const originalFetch = window.fetch;
        window.fetch = function(url, options = {}) {
            if (typeof url === 'string') {
                const separator = url.includes('?') ? '&' : '?';
                const timestamp = Date.now();
                const random = Math.random().toString(36).substr(2, 9);
                url += `${separator}nocache=${timestamp}&v=${AppVersion.version}&r=${random}&bust=${timestamp}`;
            }
            
            options.cache = 'no-cache';
            options.headers = {
                ...options.headers,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            };
            
            return originalFetch(url, options);
        };
        
        console.log('🚫 Cache disabilitata per tutte le risorse');
    }
};

// Initialize cache disabling
AppVersion.disableCache();

export default AppVersion;