// Token system management - Improved with click-to-move and better UX
import FirebaseHelper from './firebase.js';

export class TokenSystem {
    constructor(authManager, mapSystem) {
        this.authManager = authManager;
        this.mapSystem = mapSystem;
        this.tokens = new Map();
        this.tokensListener = null;
        this.selectedToken = null;
        this.isFollowingMouse = false;
        this.allowPlayerMovement = false;
        this.tokenColors = [
            '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57',
            '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43'
        ];
        this.tokenSizes = {
            small: 30,
            medium: 50,
            large: 70
        };
        this.pendingTokens = new Map(); // Tokens not yet placed on map
    }
    
    // Initialize token system
    init() {
        this.setupEventListeners();
        this.listenToTokens();
        this.listenToSettings();
        this.updateAdminControls();
    }
    
    // Setup event listeners
    setupEventListeners() {
        const uploadTokenBtn = document.getElementById('uploadTokenBtn');
        const tokenFileInput = document.getElementById('tokenFileInput');
        const tokensLayer = document.getElementById('tokensLayer');
        const mapViewport = document.getElementById('mapViewport');
        
        // Token upload (Master only)
        if (uploadTokenBtn) uploadTokenBtn.addEventListener('click', () => tokenFileInput.click());
        if (tokenFileInput) tokenFileInput.addEventListener('change', (e) => this.handleTokenUpload(e));
        
        // Token interactions with click-to-move
        if (tokensLayer) {
            tokensLayer.addEventListener('click', (e) => this.handleTokenClick(e));
        }
        
        // Map click to place following token
        if (mapViewport) {
            mapViewport.addEventListener('click', (e) => this.handleMapClick(e));
            mapViewport.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        }
        
        // Escape to cancel token following
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isFollowingMouse) {
                this.cancelTokenFollow();
            }
        });
    }
    
    // Update admin controls visibility
    updateAdminControls() {
        const isMaster = this.authManager.isMaster();
        const adminElements = document.querySelectorAll('.admin-only');
        
        adminElements.forEach(element => {
            element.style.display = isMaster ? 'block' : 'none';
        });
    }
    
    // Handle token upload
    async handleTokenUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Validate file
        if (!file.type.startsWith('image/')) {
            alert('Per favore seleziona un file immagine valido.');
            return;
        }
        
        if (file.size > 10 * 1024 * 1024) { // 10MB
            alert('Il file è troppo grande. Massimo 10MB.');
            return;
        }
        
        const uploadBtn = document.getElementById('uploadTokenBtn');
        if (uploadBtn) {
            uploadBtn.classList.add('loading');
            uploadBtn.disabled = true;
        }
        
        try {
            // Create FormData for upload
            const formData = new FormData();
            formData.append('token', file);
            formData.append('room', this.authManager.getCurrentRoom());
            formData.append('type', 'token');
            
            // Upload file to server
            const response = await fetch('php/upload.php', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Create token data but don't place on map yet
                const tokenData = {
                    id: FirebaseHelper.generateUserId(),
                    filename: result.filename,
                    url: result.url,
                    name: file.name.replace(/\.[^/.]+$/, ""),
                    size: 'medium',
                    color: this.tokenColors[this.pendingTokens.size % this.tokenColors.length],
                    uploadedBy: this.authManager.getCurrentUser().name,
                    timestamp: FirebaseHelper.getTimestamp(),
                    onMap: false // Not on map yet
                };
                
                // Add to pending tokens (asset library)
                const room = this.authManager.getCurrentRoom();
                await FirebaseHelper.setData(`rooms/${room}/assets/token/${tokenData.id}`, tokenData);
                
                // Clear file input
                event.target.value = '';
                
                console.log('✅ Token caricato nella libreria:', tokenData.name);
                
            } else {
                alert('Errore durante il caricamento: ' + result.error);
            }
            
        } catch (error) {
            console.error('❌ Errore upload token:', error);
            alert('Errore durante il caricamento del file.');
        } finally {
            if (uploadBtn) {
                uploadBtn.classList.remove('loading');
                uploadBtn.disabled = false;
            }
        }
    }
    
    // Add token to map from library
    async addTokenToMap(tokenData) {
        if (!this.authManager.isMaster()) return;
        
        // Start following mouse
        this.selectedToken = tokenData;
        this.isFollowingMouse = true;
        
        // Create temporary visual token
        this.createFollowingToken(tokenData);
        
        console.log('🎭 Token in modalità posizionamento:', tokenData.name);
    }
    
    // Create following token visual
    createFollowingToken(tokenData) {
        const tokensLayer = document.getElementById('tokensLayer');
        if (!tokensLayer) return;
        
        // Remove any existing following token
        const existingFollowing = tokensLayer.querySelector('.following-token');
        if (existingFollowing) {
            existingFollowing.remove();
        }
        
        const tokenElement = document.createElement('div');
        tokenElement.className = 'token following-token';
        tokenElement.dataset.tokenId = 'following';
        
        const size = this.tokenSizes[tokenData.size] || this.tokenSizes.medium;
        
        tokenElement.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            border: 3px solid ${tokenData.color};
            border-radius: 50%;
            background-image: url(${tokenData.url});
            background-size: cover;
            background-position: center;
            z-index: 200;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            opacity: 0.8;
            pointer-events: none;
            transform: translate(-50%, -50%);
        `;
        
        tokensLayer.appendChild(tokenElement);
    }
    
    // Handle mouse move for following token
    handleMouseMove(event) {
        if (!this.isFollowingMouse || !this.selectedToken) return;
        
        const followingToken = document.querySelector('.following-token');
        if (!followingToken) return;
        
        const mapContainer = document.getElementById('mapContainer');
        const mapRect = mapContainer.getBoundingClientRect();
        
        const x = event.clientX - mapRect.left;
        const y = event.clientY - mapRect.top;
        
        followingToken.style.left = x + 'px';
        followingToken.style.top = y + 'px';
    }
    
    // Handle map click to place token
    async handleMapClick(event) {
        if (!this.isFollowingMouse || !this.selectedToken) return;
        
        event.preventDefault();
        event.stopPropagation();
        
        const mapContainer = document.getElementById('mapContainer');
        const mapRect = mapContainer.getBoundingClientRect();
        
        const x = event.clientX - mapRect.left;
        const y = event.clientY - mapRect.top;
        
        // Place token on map
        const tokenData = {
            ...this.selectedToken,
            x: x,
            y: y,
            onMap: true,
            placedAt: FirebaseHelper.getTimestamp()
        };
        
        const room = this.authManager.getCurrentRoom();
        
        try {
            // Add to active tokens on map
            await FirebaseHelper.setData(`rooms/${room}/tokens/${tokenData.id}`, tokenData);
            
            console.log('✅ Token posizionato sulla mappa:', tokenData.name, 'alle coordinate:', x, y);
            
        } catch (error) {
            console.error('❌ Errore posizionamento token:', error);
        }
        
        this.cancelTokenFollow();
    }
    
    // Cancel token following
    cancelTokenFollow() {
        this.isFollowingMouse = false;
        this.selectedToken = null;
        
        // Remove following token visual
        const followingToken = document.querySelector('.following-token');
        if (followingToken) {
            followingToken.remove();
        }
        
        console.log('❌ Posizionamento token annullato');
    }
    
    // Handle token click for movement
    handleTokenClick(event) {
        const tokenElement = event.target.closest('.token');
        if (!tokenElement || tokenElement.classList.contains('following-token')) return;
        if (!this.canMoveToken()) return;
        
        event.preventDefault();
        event.stopPropagation();
        
        const tokenId = tokenElement.dataset.tokenId;
        
        if (this.isFollowingMouse && this.selectedToken && this.selectedToken.id === tokenId) {
            // Stop following
            this.stopTokenFollow(tokenId);
        } else {
            // Start following
            this.startTokenFollow(tokenId, tokenElement);
        }
    }
    
    // Start token following mouse
    startTokenFollow(tokenId, tokenElement) {
        this.selectedToken = { id: tokenId };
        this.isFollowingMouse = true;
        
        tokenElement.classList.add('following');
        tokenElement.style.zIndex = '200';
        tokenElement.style.opacity = '0.8';
        
        console.log('🎯 Token in movimento:', tokenId);
    }
    
    // Stop token following and place
    async stopTokenFollow(tokenId) {
        const tokenElement = document.querySelector(`[data-token-id="${tokenId}"]`);
        if (!tokenElement) return;
        
        tokenElement.classList.remove('following');
        tokenElement.style.zIndex = '100';
        tokenElement.style.opacity = '1';
        
        // Save position to Firebase
        const newX = parseInt(tokenElement.style.left);
        const newY = parseInt(tokenElement.style.top);
        
        const room = this.authManager.getCurrentRoom();
        
        try {
            await FirebaseHelper.updateData(`rooms/${room}/tokens/${tokenId}`, {
                x: newX,
                y: newY,
                lastMoved: FirebaseHelper.getTimestamp()
            });
            
            console.log('✅ Token posizionato:', tokenId, 'alle coordinate:', newX, newY);
            
        } catch (error) {
            console.error('❌ Errore aggiornamento posizione token:', error);
        }
        
        this.isFollowingMouse = false;
        this.selectedToken = null;
    }
    
    // Listen to tokens
    listenToTokens() {
        const room = this.authManager.getCurrentRoom();
        if (room) {
            this.tokensListener = FirebaseHelper.listenToData(`rooms/${room}/tokens`, (snapshot) => {
                this.handleTokensUpdate(snapshot);
            });
        }
    }
    
    // Listen to settings
    listenToSettings() {
        const room = this.authManager.getCurrentRoom();
        if (room) {
            FirebaseHelper.listenToData(`rooms/${room}/settings`, (snapshot) => {
                const settings = snapshot.val();
                if (settings) {
                    this.allowPlayerMovement = settings.allowTokenMovement || false;
                }
            });
        }
    }
    
    // Handle tokens update
    handleTokensUpdate(snapshot) {
        const tokensData = snapshot.val();
        const tokensLayer = document.getElementById('tokensLayer');
        
        // Clear existing tokens (except following token)
        const existingTokens = tokensLayer.querySelectorAll('.token:not(.following-token)');
        existingTokens.forEach(token => token.remove());
        
        this.tokens.clear();
        
        if (tokensData) {
            Object.entries(tokensData).forEach(([id, tokenData]) => {
                this.tokens.set(id, tokenData);
                this.createTokenElement(id, tokenData);
            });
        }
        
        console.log(`🎭 Aggiornamento token: ${this.tokens.size} token sulla mappa`);
    }
    
    // Create token element
    createTokenElement(id, tokenData) {
        const tokensLayer = document.getElementById('tokensLayer');
        const tokenElement = document.createElement('div');
        tokenElement.className = 'token';
        tokenElement.dataset.tokenId = id;
        
        const size = this.tokenSizes[tokenData.size] || this.tokenSizes.medium;
        
        tokenElement.style.cssText = `
            position: absolute;
            left: ${tokenData.x}px;
            top: ${tokenData.y}px;
            width: ${size}px;
            height: ${size}px;
            border: 3px solid ${tokenData.color};
            border-radius: 50%;
            background-image: url(${tokenData.url});
            background-size: cover;
            background-position: center;
            cursor: ${this.canMoveToken() ? 'pointer' : 'default'};
            z-index: 100;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            transition: transform 0.2s ease, opacity 0.2s ease;
            transform: translate(-50%, -50%);
        `;
        
        // Add name label
        const nameLabel = document.createElement('div');
        nameLabel.className = 'token-name';
        nameLabel.textContent = tokenData.name;
        nameLabel.style.cssText = `
            position: absolute;
            bottom: -25px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.8);
            color: #d4af37;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 10px;
            white-space: nowrap;
            pointer-events: none;
        `;
        
        tokenElement.appendChild(nameLabel);
        tokensLayer.appendChild(tokenElement);
        
        // Add hover effect
        tokenElement.addEventListener('mouseenter', () => {
            if (!this.isFollowingMouse) {
                tokenElement.style.transform = 'translate(-50%, -50%) scale(1.1)';
            }
        });
        
        tokenElement.addEventListener('mouseleave', () => {
            if (!this.isFollowingMouse) {
                tokenElement.style.transform = 'translate(-50%, -50%) scale(1)';
            }
        });
        
        // Update position if following mouse
        if (this.isFollowingMouse && this.selectedToken && this.selectedToken.id === id) {
            document.addEventListener('mousemove', this.updateFollowingTokenPosition.bind(this, tokenElement));
        }
    }
    
    // Update following token position
    updateFollowingTokenPosition(tokenElement, event) {
        if (!this.isFollowingMouse) return;
        
        const mapContainer = document.getElementById('mapContainer');
        const mapRect = mapContainer.getBoundingClientRect();
        
        const x = event.clientX - mapRect.left;
        const y = event.clientY - mapRect.top;
        
        tokenElement.style.left = x + 'px';
        tokenElement.style.top = y + 'px';
    }
    
    // Check if user can move tokens
    canMoveToken() {
        return this.authManager.isMaster() || this.allowPlayerMovement;
    }
    
    // Update token properties (Master only)
    async updateTokenProperty(tokenId, property, value) {
        if (!this.authManager.isMaster()) return;
        
        const room = this.authManager.getCurrentRoom();
        
        try {
            await FirebaseHelper.updateData(`rooms/${room}/tokens/${tokenId}`, {
                [property]: value,
                lastModified: FirebaseHelper.getTimestamp()
            });
            
            console.log(`✅ Token ${property} aggiornato:`, tokenId, value);
            
        } catch (error) {
            console.error(`❌ Errore aggiornamento ${property} token:`, error);
        }
    }
    
    // Delete token from map (Master only)
    async deleteTokenFromMap(tokenId) {
        if (!this.authManager.isMaster()) return;
        
        const tokenData = this.tokens.get(tokenId);
        if (!tokenData) return;
        
        if (!confirm(`Sei sicuro di voler rimuovere il token "${tokenData.name}" dalla mappa?`)) {
            return;
        }
        
        const room = this.authManager.getCurrentRoom();
        
        try {
            // Remove from active tokens
            await FirebaseHelper.removeData(`rooms/${room}/tokens/${tokenId}`);
            
            console.log('✅ Token rimosso dalla mappa:', tokenData.name);
            
        } catch (error) {
            console.error('❌ Errore rimozione token dalla mappa:', error);
        }
    }
    
    // Clear all tokens (Master only)
    async clearAllTokens() {
        if (!this.authManager.isMaster()) return;
        
        if (!confirm('Sei sicuro di voler rimuovere tutti i token dalla mappa?')) {
            return;
        }
        
        const room = this.authManager.getCurrentRoom();
        
        try {
            // Remove all from Firebase
            await FirebaseHelper.removeData(`rooms/${room}/tokens`);
            
            console.log('✅ Tutti i token rimossi dalla mappa');
            
        } catch (error) {
            console.error('❌ Errore pulizia token:', error);
        }
    }
    
    // Set player movement permission
    async setPlayerMovement(allowed) {
        if (!this.authManager.isMaster()) return;
        
        const room = this.authManager.getCurrentRoom();
        try {
            await FirebaseHelper.setData(`rooms/${room}/settings/allowTokenMovement`, allowed);
            this.allowPlayerMovement = allowed;
        } catch (error) {
            console.error('❌ Errore impostazione movimento giocatori:', error);
        }
    }
    
    // Get all tokens
    getAllTokens() {
        return Array.from(this.tokens.values());
    }
    
    // Get pending tokens (in library)
    getPendingTokens() {
        return Array.from(this.pendingTokens.values());
    }
    
    // Cleanup
    cleanup() {
        if (this.tokensListener) {
            FirebaseHelper.stopListening(this.tokensListener);
            this.tokensListener = null;
        }
        
        this.cancelTokenFollow();
    }
}

export default TokenSystem;