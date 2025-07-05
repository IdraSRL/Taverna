// Version management system
export const AppVersion = {
    version: '1.0.6',
    buildDate: new Date().toISOString(),
    
    // Get version string for cache busting
    getVersionString() {
        return `v=${this.version}&t=${Date.now()}&r=${Math.random().toString(36).substr(2, 9)}`;
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
        
        // Add cache busting parameters to current URL
        const url = new URL(window.location);
        url.searchParams.set('v', this.version);
        url.searchParams.set('t', Date.now());
        url.searchParams.set('r', Math.random().toString(36).substr(2, 9));
        
        // Force reload with cache bypass
        window.location.href = url.toString();
    }
};

export default AppVersion;