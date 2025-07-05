// UI management and interface interactions
import AuthManager from './auth.js';
import UserManager from './users.js';
import DiceSystem from './dice-system.js';
import ChatSystem from './chat-system.js';
import MusicSystem from './music-system.js';
import MapSystem from './map-system.js';
import TokenSystem from './token-system.js';
import SheetSystem from './sheet-system.js';
import AdminPanel from './admin-panel.js';
import PingSystem from './ping-system.js';

export class UIManager {
    constructor() {
        this.authManager = new AuthManager();
        this.userManager = new UserManager(this.authManager);
        this.diceSystem = new DiceSystem(this.authManager);
        this.chatSystem = new ChatSystem(this.authManager);
        this.musicSystem = new MusicSystem(this.authManager);
        this.mapSystem = new MapSystem(this.authManager);
        this.tokenSystem = new TokenSystem(this.authManager, this.mapSystem);
        this.sheetSystem = new SheetSystem(this.authManager);
        this.pingSystem = new PingSystem(this.authManager, this.mapSystem);
        this.adminPanel = new AdminPanel(this.authManager, this.mapSystem, this.tokenSystem, this.musicSystem, this.chatSystem);
        this.currentView = 'login';
        this.systemsInitialized = false;
        this.initializationInProgress = false;
    }
    
    // Initialize UI
    init() {
        console.log('🎮 Inizializzazione UI Manager...');
        this.setupEventListeners();
        this.authManager.init();
        
        // Make systems globally available for onclick handlers
        window.diceSystem = this.diceSystem;
        window.musicSystem = this.musicSystem;
        window.adminPanel = this.adminPanel;
        
        // Check for existing session
        if (this.authManager.loadSession()) {
            console.log('🔄 Sessione esistente trovata, caricamento interfaccia gioco...');
            this.showGameInterface();
        }
        
        console.log('✅ UI Manager inizializzato');
    }
    
    // Setup global event listeners
    setupEventListeners() {
        // Exit button
        const exitBtn = document.getElementById('exitBtn');
        if (exitBtn) {
            exitBtn.addEventListener('click', () => this.handleExit());
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
        
        // Window resize
        window.addEventListener('resize', () => this.handleWindowResize());
        
        console.log('✅ Event listeners globali configurati');
    }
    
    // Handle keyboard shortcuts
    handleKeyboardShortcuts(event) {
        // Escape key to exit
        if (event.key === 'Escape' && this.currentView === 'game') {
            // Check if any modal is open first
            const modals = document.querySelectorAll('.modal-overlay');
            const openModal = Array.from(modals).find(modal => modal.style.display === 'block');
            
            if (!openModal) {
                this.handleExit();
            }
        }
        
        // Enter key in login form
        if (event.key === 'Enter' && this.currentView === 'login') {
            const activeElement = document.activeElement;
            if (activeElement.tagName === 'INPUT') {
                const loginForm = document.getElementById('loginForm');
                if (loginForm && loginForm.checkValidity()) {
                    loginForm.dispatchEvent(new Event('submit'));
                }
            }
        }
        
        // Ctrl+Enter to roll dice
        if (event.ctrlKey && event.key === 'Enter' && this.currentView === 'game') {
            const rollBtn = document.getElementById('rollAllDice');
            if (rollBtn && !rollBtn.disabled) {
                this.diceSystem.rollAllDice();
            }
        }
        
        // Space to play/pause music (when not typing) - Only for master
        if (event.code === 'Space' && this.currentView === 'game' && this.authManager.isMaster()) {
            const activeElement = document.activeElement;
            if (activeElement.tagName !== 'INPUT' && activeElement.tagName !== 'TEXTAREA') {
                event.preventDefault();
                this.musicSystem.togglePlayPause();
            }
        }
        
        // F1 for character sheet
        if (event.key === 'F1' && this.currentView === 'game') {
            event.preventDefault();
            const sheetBtn = document.getElementById('characterSheetBtn');
            if (sheetBtn) sheetBtn.click();
        }
        
        // F2 for admin panel (Master only)
        if (event.key === 'F2' && this.currentView === 'game' && this.authManager.isMaster()) {
            event.preventDefault();
            const adminBtn = document.getElementById('adminPanelBtn');
            if (adminBtn) adminBtn.click();
        }
    }
    
    // Handle window resize
    handleWindowResize() {
        // Update responsive layout if needed
        this.updateResponsiveLayout();
        
        // Reinitialize canvas if character sheet is open
        if (this.sheetSystem.canvas) {
            setTimeout(() => this.sheetSystem.initializeCanvas(), 100);
        }
        
        // Update ping positions
        if (this.pingSystem) {
            this.pingSystem.updatePingPositions();
        }
    }
    
    // Update responsive layout
    updateResponsiveLayout() {
        const gameInterface = document.getElementById('gameInterface');
        const usersList = document.getElementById('usersList');
        
        if (window.innerWidth <= 768) {
            if (gameInterface) gameInterface.classList.add('mobile-layout');
            if (usersList) usersList.classList.add('mobile-users');
        } else {
            if (gameInterface) gameInterface.classList.remove('mobile-layout');
            if (usersList) usersList.classList.remove('mobile-users');
        }
    }
    
    // Show game interface
    showGameInterface() {
        console.log('🎮 Visualizzazione interfaccia gioco...');
        this.currentView = 'game';
        this.authManager.showGameInterface();
        this.updateRoomDisplay();
        
        // Initialize all systems with proper sequencing - only once and prevent multiple calls
        if (!this.systemsInitialized && !this.initializationInProgress) {
            this.initializationInProgress = true;
            console.log('⚙️ Inizializzazione sistemi di gioco...');
            
            // Use a longer timeout to ensure DOM is ready
            setTimeout(() => {
                try {
                    this.userManager.init();
                    this.diceSystem.init();
                    this.chatSystem.init();
                    this.musicSystem.init();
                    this.mapSystem.init();
                    this.tokenSystem.init();
                    this.sheetSystem.init();
                    this.pingSystem.init();
                    this.adminPanel.init();
                    
                    // Update responsive layout
                    this.updateResponsiveLayout();
                    
                    // Update admin controls visibility
                    this.updateAdminControlsVisibility();
                    
                    this.systemsInitialized = true;
                    this.initializationInProgress = false;
                    console.log('✅ Tutti i sistemi inizializzati con successo');
                    
                } catch (error) {
                    console.error('❌ Errore inizializzazione sistemi:', error);
                    this.initializationInProgress = false;
                }
            }, 500); // Increased timeout
        } else if (this.systemsInitialized) {
            console.log('♻️ Sistemi già inizializzati, aggiornamento visibilità controlli...');
            this.updateAdminControlsVisibility();
        }
    }
    
    // Show login screen
    showLoginScreen() {
        console.log('🔐 Visualizzazione schermata login...');
        this.currentView = 'login';
        this.authManager.showLoginScreen();
        
        // Cleanup all systems
        if (this.systemsInitialized) {
            console.log('🧹 Pulizia sistemi...');
            this.userManager.cleanup();
            this.diceSystem.cleanup();
            this.chatSystem.cleanup();
            this.musicSystem.cleanup();
            this.mapSystem.cleanup();
            this.tokenSystem.cleanup();
            this.sheetSystem.cleanup();
            this.pingSystem.cleanup();
            this.systemsInitialized = false;
            this.initializationInProgress = false;
        }
    }
    
    // Update room display
    updateRoomDisplay() {
        const roomName = this.authManager.getCurrentRoom();
        const roomNameElement = document.getElementById('currentRoomName');
        
        if (roomName && roomNameElement) {
            roomNameElement.textContent = roomName;
            console.log('🏠 Aggiornamento display stanza:', roomName);
        }
    }
    
    // Update admin controls visibility
    updateAdminControlsVisibility() {
        const isMaster = this.authManager.isMaster();
        const adminElements = document.querySelectorAll('.admin-only');
        
        console.log('👑 Aggiornamento visibilità controlli admin, isMaster:', isMaster);
        
        adminElements.forEach(element => {
            element.style.display = isMaster ? 'block' : 'none';
        });
    }
    
    // Handle exit
    async handleExit() {
        if (this.showStyledConfirm('Sei sicuro di voler uscire dalla taverna?', 'Conferma Uscita')) {
            console.log('👋 Uscita dalla taverna...');
            await this.authManager.logout();
            this.showLoginScreen();
        }
    }
    
    // Show styled notification
    showNotification(message, type = 'info', duration = 3000) {
        console.log(`📢 Notifica ${type}:`, message);
        
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Style notification with tavern theme
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 12px;
            color: #d4af37;
            font-family: 'Cinzel', serif;
            font-weight: 600;
            z-index: 10000;
            box-shadow: 0 8px 24px rgba(0,0,0,0.4);
            border: 2px solid #8b4513;
            animation: slideInRight 0.4s ease-out;
            backdrop-filter: blur(10px);
        `;
        
        // Set background based on type
        switch (type) {
            case 'success':
                notification.style.background = 'linear-gradient(135deg, rgba(34, 139, 34, 0.9) 0%, rgba(50, 205, 50, 0.9) 100%)';
                notification.style.borderColor = '#32cd32';
                break;
            case 'error':
                notification.style.background = 'linear-gradient(135deg, rgba(139, 0, 0, 0.9) 0%, rgba(220, 20, 60, 0.9) 100%)';
                notification.style.borderColor = '#dc143c';
                break;
            case 'warning':
                notification.style.background = 'linear-gradient(135deg, rgba(255, 140, 0, 0.9) 0%, rgba(255, 165, 0, 0.9) 100%)';
                notification.style.borderColor = '#ffa500';
                break;
            default:
                notification.style.background = 'linear-gradient(135deg, rgba(139, 69, 19, 0.9) 0%, rgba(160, 82, 45, 0.9) 100%)';
                notification.style.borderColor = '#8b4513';
        }
        
        document.body.appendChild(notification);
        
        // Remove after duration
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.4s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 400);
        }, duration);
    }
    
    // Show styled confirm dialog
    showStyledConfirm(message, title = 'Conferma') {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(26, 15, 8, 0.9);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                backdrop-filter: blur(5px);
                animation: fadeIn 0.3s ease-out;
            `;
            
            modal.innerHTML = `
                <div class="modal-dialog" style="
                    background: linear-gradient(135deg, #3d2716 0%, #2c1810 100%);
                    border: 3px solid #8b4513;
                    border-radius: 15px;
                    max-width: 400px;
                    width: 90%;
                    color: #d4af37;
                    font-family: 'Cinzel', serif;
                    box-shadow: 0 0 30px rgba(212, 175, 55, 0.3);
                    animation: scaleIn 0.3s ease-out;
                ">
                    <div class="modal-header" style="
                        padding: 1.5rem;
                        border-bottom: 2px solid #8b4513;
                        text-align: center;
                    ">
                        <h3 style="
                            font-family: 'Uncial Antiqua', serif;
                            font-size: 1.3rem;
                            color: #d4af37;
                            margin: 0;
                        ">${title}</h3>
                    </div>
                    <div class="modal-content" style="
                        padding: 1.5rem;
                        text-align: center;
                        line-height: 1.5;
                    ">
                        <p style="margin: 0 0 1.5rem 0; font-size: 1rem;">${message}</p>
                        <div style="display: flex; gap: 1rem; justify-content: center;">
                            <button id="confirmYes" style="
                                padding: 0.75rem 1.5rem;
                                background: linear-gradient(135deg, #8b4513 0%, #a0522d 100%);
                                color: #d4af37;
                                border: none;
                                border-radius: 8px;
                                font-family: 'Cinzel', serif;
                                font-weight: 600;
                                cursor: pointer;
                                transition: all 0.3s ease;
                            ">Sì</button>
                            <button id="confirmNo" style="
                                padding: 0.75rem 1.5rem;
                                background: linear-gradient(135deg, #8b0000 0%, #a52a2a 100%);
                                color: #d4af37;
                                border: none;
                                border-radius: 8px;
                                font-family: 'Cinzel', serif;
                                font-weight: 600;
                                cursor: pointer;
                                transition: all 0.3s ease;
                            ">No</button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            const yesBtn = modal.querySelector('#confirmYes');
            const noBtn = modal.querySelector('#confirmNo');
            
            yesBtn.addEventListener('click', () => {
                modal.remove();
                resolve(true);
            });
            
            noBtn.addEventListener('click', () => {
                modal.remove();
                resolve(false);
            });
            
            // Close on outside click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                    resolve(false);
                }
            });
        });
    }
    
    // Show loading overlay
    showLoadingOverlay(message = 'Caricamento...') {
        console.log('⏳ Mostra overlay caricamento:', message);
        
        const overlay = document.createElement('div');
        overlay.id = 'loadingOverlay';
        overlay.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <p>${message}</p>
            </div>
        `;
        
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(26, 15, 8, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            backdrop-filter: blur(5px);
        `;
        
        const loadingContent = overlay.querySelector('.loading-content');
        loadingContent.style.cssText = `
            text-align: center;
            color: #d4af37;
            font-family: 'Cinzel', serif;
        `;
        
        const spinner = overlay.querySelector('.loading-spinner');
        spinner.style.cssText = `
            width: 50px;
            height: 50px;
            border: 3px solid #8b4513;
            border-top: 3px solid #d4af37;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 1rem;
        `;
        
        document.body.appendChild(overlay);
    }
    
    // Hide loading overlay
    hideLoadingOverlay() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.remove();
            console.log('✅ Overlay caricamento nascosto');
        }
    }
    
    // Show modal dialog
    showModal(title, content, buttons = []) {
        console.log('📋 Mostra modal:', title);
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-content">
                    ${content}
                </div>
                <div class="modal-buttons">
                    ${buttons.map(btn => `<button class="modal-btn ${btn.class || ''}" data-action="${btn.action || ''}">${btn.text}</button>`).join('')}
                </div>
            </div>
        `;
        
        // Style modal
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(26, 15, 8, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            backdrop-filter: blur(5px);
        `;
        
        const dialog = modal.querySelector('.modal-dialog');
        dialog.style.cssText = `
            background: linear-gradient(135deg, #3d2716 0%, #2c1810 100%);
            border: 3px solid #8b4513;
            border-radius: 15px;
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            color: #d4af37;
            font-family: 'Cinzel', serif;
        `;
        
        document.body.appendChild(modal);
        
        // Handle modal events
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.classList.contains('modal-close')) {
                modal.remove();
            }
            
            if (e.target.classList.contains('modal-btn')) {
                const action = e.target.dataset.action;
                if (action) {
                    this.handleModalAction(action, modal);
                }
            }
        });
        
        return modal;
    }
    
    // Handle modal actions
    handleModalAction(action, modal) {
        console.log('🎬 Azione modal:', action);
        
        switch (action) {
            case 'close':
                modal.remove();
                break;
            case 'confirm':
                // Handle confirmation
                modal.remove();
                break;
            case 'clear-chat':
                this.chatSystem.clearChat();
                modal.remove();
                break;
            // Add more actions as needed
        }
    }
    
    // Update interface theme
    updateTheme(theme) {
        document.body.className = theme;
        localStorage.setItem('tavernaTheme', theme);
        console.log('🎨 Tema aggiornato:', theme);
    }
    
    // Get current theme
    getCurrentTheme() {
        return localStorage.getItem('tavernaTheme') || 'default';
    }
    
    // Initialize tooltips
    initTooltips() {
        const tooltipElements = document.querySelectorAll('[data-tooltip]');
        
        tooltipElements.forEach(element => {
            element.addEventListener('mouseenter', (e) => {
                this.showTooltip(e.target, e.target.dataset.tooltip);
            });
            
            element.addEventListener('mouseleave', () => {
                this.hideTooltip();
            });
        });
        
        console.log('💡 Tooltips inizializzati:', tooltipElements.length);
    }
    
    // Show tooltip
    showTooltip(element, text) {
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.textContent = text;
        tooltip.style.cssText = `
            position: absolute;
            background: rgba(44, 24, 16, 0.95);
            color: #d4af37;
            padding: 0.5rem 0.75rem;
            border-radius: 6px;
            font-size: 0.85rem;
            z-index: 10001;
            pointer-events: none;
            border: 1px solid #8b4513;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        `;
        
        document.body.appendChild(tooltip);
        
        // Position tooltip
        const rect = element.getBoundingClientRect();
        tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
        tooltip.style.top = rect.top - tooltip.offsetHeight - 5 + 'px';
        
        this.currentTooltip = tooltip;
    }
    
    // Hide tooltip
    hideTooltip() {
        if (this.currentTooltip) {
            this.currentTooltip.remove();
            this.currentTooltip = null;
        }
    }
    
    // Get all systems for external access
    getSystems() {
        return {
            auth: this.authManager,
            users: this.userManager,
            dice: this.diceSystem,
            chat: this.chatSystem,
            music: this.musicSystem,
            map: this.mapSystem,
            tokens: this.tokenSystem,
            sheet: this.sheetSystem,
            ping: this.pingSystem,
            admin: this.adminPanel
        };
    }
}

export default UIManager;