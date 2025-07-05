// Main application entry point
import UIManager from './ui.js';
import AppVersion from './version.js';

// Application state
const App = {
    uiManager: null,
    initialized: false,
    
    // Initialize the application
    init() {
        if (this.initialized) return;
        
        console.log('🐺 Inizializzazione Taverna dei Cani di Odino...');
        console.log('📦 Versione:', AppVersion.getDisplayVersion());
        
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.bootstrap());
        } else {
            this.bootstrap();
        }
    },
    
    // Bootstrap the application
    bootstrap() {
        try {
            // Check version and show update notification if needed
            if (AppVersion.checkVersion()) {
                console.log('🔄 Nuova versione rilevata:', AppVersion.getDisplayVersion());
            }
            
            // Initialize version display
            this.initVersionDisplay();
            
            // Initialize UI Manager
            this.uiManager = new UIManager();
            this.uiManager.init();
            
            // Setup global error handling
            this.setupErrorHandling();
            
            // Setup performance monitoring
            this.setupPerformanceMonitoring();
            
            // Initialize tooltips
            this.uiManager.initTooltips();
            
            // Application is ready
            this.initialized = true;
            console.log('✅ Taverna dei Cani di Odino inizializzata con successo!');
            console.log('🏗️ Build info:', AppVersion.getBuildInfo());
            
            // Dispatch ready event
            document.dispatchEvent(new CustomEvent('tavernaReady'));
            
        } catch (error) {
            console.error('❌ Errore durante l\'inizializzazione:', error);
            this.handleCriticalError(error);
        }
    },
    
    // Initialize version display
    initVersionDisplay() {
        const versionText = document.getElementById('versionText');
        const reloadBtn = document.getElementById('reloadBtn');
        
        if (versionText) {
            versionText.textContent = AppVersion.getDisplayVersion();
        }
        
        if (reloadBtn) {
            reloadBtn.addEventListener('click', () => {
                if (confirm('Ricaricare l\'applicazione? Eventuali dati non salvati andranno persi.')) {
                    AppVersion.forceReload();
                }
            });
        }
    },
    
    // Setup global error handling
    setupErrorHandling() {
        // Handle uncaught errors
        window.addEventListener('error', (event) => {
            console.error('Errore non gestito:', event.error);
            this.handleError(event.error, 'Errore imprevisto');
        });
        
        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Promise rifiutata:', event.reason);
            this.handleError(event.reason, 'Errore di connessione');
        });
        
        // Handle Firebase errors
        window.addEventListener('firebase-error', (event) => {
            console.error('Errore Firebase:', event.detail);
            this.handleError(event.detail, 'Errore del server');
        });
    },
    
    // Setup performance monitoring
    setupPerformanceMonitoring() {
        // Monitor page load time
        window.addEventListener('load', () => {
            const loadTime = performance.now();
            console.log(`⏱️ Tempo di caricamento: ${Math.round(loadTime)}ms`);
        });
        
        // Monitor memory usage (if available)
        if (performance.memory) {
            setInterval(() => {
                const memory = performance.memory;
                if (memory.usedJSHeapSize > 50 * 1024 * 1024) { // 50MB
                    console.warn('⚠️ Uso memoria elevato:', Math.round(memory.usedJSHeapSize / 1024 / 1024) + 'MB');
                }
            }, 60000); // Check every minute
        }
    },
    
    // Handle application errors
    handleError(error, userMessage = 'Si è verificato un errore') {
        // Ensure error is an object with message property
        const errorMessage = error && error.message ? error.message : (error || 'Errore sconosciuto');
        const errorStack = error && error.stack ? error.stack : 'Stack non disponibile';
        
        if (this.uiManager) {
            this.uiManager.showNotification(userMessage, 'error');
        }
        
        // Log error details
        console.error('Dettagli errore:', {
            message: errorMessage,
            stack: errorStack,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            version: AppVersion.getDisplayVersion()
        });
    },
    
    // Handle critical errors
    handleCriticalError(error) {
        const errorMessage = `
            <div style="text-align: center; padding: 2rem; color: #ff6b6b;">
                <h2>🚨 Errore Critico</h2>
                <p>Si è verificato un errore critico nell'applicazione.</p>
                <p>Versione: ${AppVersion.getDisplayVersion()}</p>
                <p>Per favore, ricarica la pagina per continuare.</p>
                <button onclick="window.location.reload()" style="
                    padding: 0.75rem 1.5rem;
                    background: #8b4513;
                    color: #d4af37;
                    border: none;
                    border-radius: 6px;
                    font-family: 'Cinzel', serif;
                    font-weight: 600;
                    cursor: pointer;
                    margin-top: 1rem;
                ">Ricarica Pagina</button>
            </div>
        `;
        
        document.body.innerHTML = errorMessage;
        
        // Log critical error
        console.error('ERRORE CRITICO:', error);
    },
    
    // Get application info
    getInfo() {
        return {
            name: 'Taverna dei Cani di Odino',
            ...AppVersion.getBuildInfo(),
            initialized: this.initialized
        };
    }
};

// Global app reference
window.TavernaApp = App;

// Initialize the application
App.init();

// Export for module usage
export default App;