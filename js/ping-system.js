// Ping system for map interactions
import FirebaseHelper from './firebase.js';

export class PingSystem {
    constructor(authManager, mapSystem) {
        this.authManager = authManager;
        this.mapSystem = mapSystem;
        this.pingsListener = null;
        this.activePings = new Map();
        this.pingDuration = 3000; // 3 seconds
        this.pingColors = [
            '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57',
            '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43'
        ];
    }
    
    // Initialize ping system
    init() {
        console.log('📍 Inizializzazione sistema ping...');
        this.setupEventListeners();
        this.listenToPings();
    }
    
    // Setup event listeners
    setupEventListeners() {
        const mapViewport = document.getElementById('mapViewport');
        
        if (!mapViewport) {
            console.error('❌ Viewport mappa non trovato per ping');
            return;
        }
        
        // Double-click to ping
        mapViewport.addEventListener('dblclick', (e) => this.handleMapDoubleClick(e));
        
        // Touch support for mobile
        let touchTime = 0;
        mapViewport.addEventListener('touchend', (e) => {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - touchTime;
            
            if (tapLength < 500 && tapLength > 0) {
                // Double tap detected
                this.handleMapDoubleClick(e.changedTouches[0]);
            }
            touchTime = currentTime;
        });
        
        console.log('✅ Event listeners ping configurati');
    }
    
    // Handle map double click
    async handleMapDoubleClick(event) {
        event.preventDefault();
        event.stopPropagation();
        
        // Don't ping if dragging
        if (this.mapSystem.isDragging) return;
        
        const user = this.authManager.getCurrentUser();
        const room = this.authManager.getCurrentRoom();
        
        if (!user || !room) return;
        
        // Check if we have a map loaded
        if (!this.mapSystem.getCurrentMap()) {
            console.log('📍 Nessuna mappa per ping');
            return;
        }
        
        // Get click position relative to map
        const mapCoords = this.mapSystem.screenToMapCoords(
            event.clientX,
            event.clientY
        );
        
        console.log('📍 Ping creato alle coordinate:', mapCoords);
        
        // Create ping data
        const pingData = {
            id: FirebaseHelper.generateUserId(),
            userId: user.id,
            userName: user.name,
            userAvatar: user.avatar,
            userColor: this.getUserColor(user.id),
            x: mapCoords.x,
            y: mapCoords.y,
            timestamp: FirebaseHelper.getTimestamp(),
            expiresAt: Date.now() + this.pingDuration
        };
        
        try {
            // Send ping to Firebase
            await FirebaseHelper.setData(`rooms/${room}/pings/${pingData.id}`, pingData);
            console.log('📍 Ping inviato:', pingData);
        } catch (error) {
            console.error('❌ Errore invio ping:', error);
        }
    }
    
    // Get user color for ping
    getUserColor(userId) {
        // Generate consistent color based on user ID
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            hash = userId.charCodeAt(i) + ((hash << 5) - hash);
        }
        return this.pingColors[Math.abs(hash) % this.pingColors.length];
    }
    
    // Listen to pings
    listenToPings() {
        const room = this.authManager.getCurrentRoom();
        if (!room) {
            console.error('❌ Nessuna stanza per ascoltare ping');
            return;
        }
        
        console.log('👂 Ascolto ping per stanza:', room);
        
        this.pingsListener = FirebaseHelper.listenToData(`rooms/${room}/pings`, (snapshot) => {
            this.handlePingsUpdate(snapshot);
        });
    }
    
    // Handle pings update
    handlePingsUpdate(snapshot) {
        try {
            const pingsData = snapshot.val();
            const now = Date.now();
            
            // Clear expired pings
            this.clearExpiredPings();
            
            if (!pingsData) {
                this.clearAllPingElements();
                return;
            }
            
            // Process each ping
            Object.entries(pingsData).forEach(([pingId, pingData]) => {
                if (pingData.expiresAt > now) {
                    this.showPing(pingId, pingData);
                } else {
                    this.removePing(pingId);
                }
            });
            
        } catch (error) {
            console.error('❌ Errore aggiornamento ping:', error);
        }
    }
    
    // Show ping on map
    showPing(pingId, pingData) {
        // Don't show ping if already exists
        if (this.activePings.has(pingId)) return;
        
        // Check if we have a map
        if (!this.mapSystem.getCurrentMap()) return;
        
        const tokensLayer = document.getElementById('tokensLayer');
        if (!tokensLayer) {
            console.error('❌ Layer token non trovato per ping');
            return;
        }
        
        const pingElement = document.createElement('div');
        pingElement.className = 'map-ping';
        pingElement.dataset.pingId = pingId;
        
        // Position ping using map coordinates
        pingElement.style.cssText = `
            position: absolute;
            left: ${pingData.x}px;
            top: ${pingData.y}px;
            width: 40px;
            height: 40px;
            border: 3px solid ${pingData.userColor};
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.2);
            pointer-events: none;
            z-index: 1000;
            animation: pingPulse 0.6s ease-out;
            transform: translate(-50%, -50%);
            box-shadow: 0 0 20px ${pingData.userColor};
        `;
        
        // Add user name label
        const nameLabel = document.createElement('div');
        nameLabel.className = 'ping-name';
        nameLabel.textContent = pingData.userName;
        nameLabel.style.cssText = `
            position: absolute;
            bottom: -30px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.8);
            color: ${pingData.userColor};
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 11px;
            white-space: nowrap;
            pointer-events: none;
            font-weight: 600;
            border: 1px solid ${pingData.userColor};
        `;
        
        pingElement.appendChild(nameLabel);
        tokensLayer.appendChild(pingElement);
        
        // Store ping reference
        this.activePings.set(pingId, {
            element: pingElement,
            data: pingData
        });
        
        console.log('📍 Ping visualizzato:', pingData.userName, 'alle coordinate:', pingData.x, pingData.y);
        
        // Auto-remove after duration
        setTimeout(() => {
            this.removePing(pingId);
        }, this.pingDuration);
    }
    
    // Remove ping
    removePing(pingId) {
        const ping = this.activePings.get(pingId);
        if (ping && ping.element && ping.element.parentNode) {
            ping.element.style.animation = 'pingFadeOut 0.3s ease-in';
            setTimeout(() => {
                if (ping.element.parentNode) {
                    ping.element.parentNode.removeChild(ping.element);
                }
            }, 300);
        }
        this.activePings.delete(pingId);
        
        // Remove from Firebase if it's our ping
        const room = this.authManager.getCurrentRoom();
        if (room) {
            FirebaseHelper.removeData(`rooms/${room}/pings/${pingId}`).catch(error => {
                console.error('❌ Errore rimozione ping:', error);
            });
        }
    }
    
    // Clear all ping elements
    clearAllPingElements() {
        this.activePings.forEach((ping, pingId) => {
            this.removePing(pingId);
        });
    }
    
    // Clear expired pings
    clearExpiredPings() {
        const now = Date.now();
        this.activePings.forEach((ping, pingId) => {
            if (ping.data.expiresAt <= now) {
                this.removePing(pingId);
            }
        });
    }
    
    // Update ping positions when map transforms
    updatePingPositions() {
        // Pings are positioned in map coordinates, so they move with the map automatically
        // No need to update positions as they're children of the map canvas
        console.log('📍 Aggiornamento posizioni ping (automatico con trasformazione mappa)');
    }
    
    // Cleanup
    cleanup() {
        console.log('🧹 Pulizia sistema ping...');
        if (this.pingsListener) {
            FirebaseHelper.stopListening(this.pingsListener);
            this.pingsListener = null;
        }
        this.clearAllPingElements();
    }
}

export default PingSystem;