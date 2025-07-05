// Token system management
import FirebaseHelper from './firebase.js';

export class TokenSystem {
    constructor(authManager, mapSystem) {
        this.authManager = authManager;
        this.mapSystem = mapSystem;
        this.tokens = new Map();
        this.tokensListener = null;
        this.selectedToken = null;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
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
        const contextMenu = document.getElementById('tokenContextMenu');
        
        // Token upload (Master only)
        uploadTokenBtn.addEventListener('click', () => tokenFileInput.click());
        tokenFileInput.addEventListener('change', (e) => this.handleTokenUpload(e));
        
        // Token interactions
        tokensLayer.addEventListener('mousedown', (e) => this.handleTokenMouseDown(e));
        document.addEventListener('mousemove', (e) => this.handleTokenMouseMove(e));
        document.addEventListener('mouseup', (e) => this.handleTokenMouseUp(e));
        tokensLayer.addEventListener('contextmenu', (e) => this.handleTokenContextMenu(e));
        
        // Context menu
        contextMenu.addEventListener('click', (e) => this.handleContextMenuClick(e));
        
        // Close context menu on outside click
        document.addEventListener('click', (e) => {
            if (!contextMenu.contains(e.target)) {
                contextMenu.style.display = 'none';
            }
        });
        
        // Touch support
        tokensLayer.addEventListener('touchstart', (e) => this.handleTokenMouseDown(e.touches[0]));
        document.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.handleTokenMouseMove(e.touches[0]);
        });
        document.addEventListener('touchend', (e) => this.handleTokenMouseUp(e));
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
        uploadBtn.classList.add('loading');
        uploadBtn.disabled = true;
        
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
                // Create token data
                const tokenData = {
                    id: FirebaseHelper.generateUserId(),
                    filename: result.filename,
                    url: result.url,
                    name: file.name.replace(/\.[^/.]+$/, ""),
                    x: 100, // Default position
                    y: 100,
                    size: 'medium',
                    color: this.tokenColors[this.tokens.size % this.tokenColors.length],
                    uploadedBy: this.authManager.getCurrentUser().name,
                    timestamp: FirebaseHelper.getTimestamp()
                };
                
                const room = this.authManager.getCurrentRoom();
                await FirebaseHelper.setData(`rooms/${room}/tokens/${tokenData.id}`, tokenData);
                
                // Clear file input
                event.target.value = '';
                
            } else {
                alert('Errore durante il caricamento: ' + result.error);
            }
            
        } catch (error) {
            console.error('Upload error:', error);
            alert('Errore durante il caricamento del file.');
        } finally {
            uploadBtn.classList.remove('loading');
            uploadBtn.disabled = false;
        }
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
        
        // Clear existing tokens
        this.tokens.clear();
        tokensLayer.innerHTML = '';
        
        if (tokensData) {
            Object.entries(tokensData).forEach(([id, tokenData]) => {
                this.tokens.set(id, tokenData);
                this.createTokenElement(id, tokenData);
            });
        }
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
            cursor: ${this.canMoveToken() ? 'grab' : 'default'};
            z-index: 100;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            transition: transform 0.1s ease;
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
            if (!this.isDragging) {
                tokenElement.style.transform = 'scale(1.1)';
            }
        });
        
        tokenElement.addEventListener('mouseleave', () => {
            if (!this.isDragging) {
                tokenElement.style.transform = 'scale(1)';
            }
        });
    }
    
    // Check if user can move tokens
    canMoveToken() {
        return this.authManager.isMaster() || this.allowPlayerMovement;
    }
    
    // Handle token mouse down
    handleTokenMouseDown(event) {
        const tokenElement = event.target.closest('.token');
        if (!tokenElement || !this.canMoveToken()) return;
        
        event.preventDefault();
        event.stopPropagation();
        
        const tokenId = tokenElement.dataset.tokenId;
        const tokenData = this.tokens.get(tokenId);
        if (!tokenData) return;
        
        this.selectedToken = tokenId;
        this.isDragging = true;
        
        const rect = tokenElement.getBoundingClientRect();
        this.dragOffset = {
            x: event.clientX - rect.left - rect.width / 2,
            y: event.clientY - rect.top - rect.height / 2
        };
        
        tokenElement.style.cursor = 'grabbing';
        tokenElement.style.zIndex = '200';
        tokenElement.style.transform = 'scale(1.1)';
    }
    
    // Handle token mouse move
    handleTokenMouseMove(event) {
        if (!this.isDragging || !this.selectedToken) return;
        
        event.preventDefault();
        
        const tokenElement = document.querySelector(`[data-token-id="${this.selectedToken}"]`);
        if (!tokenElement) return;
        
        // Get map container bounds
        const mapContainer = document.getElementById('mapContainer');
        const mapRect = mapContainer.getBoundingClientRect();
        
        // Calculate new position relative to map container
        const newX = event.clientX - mapRect.left - this.dragOffset.x;
        const newY = event.clientY - mapRect.top - this.dragOffset.y;
        
        // Update token position with smooth movement
        tokenElement.style.left = newX + 'px';
        tokenElement.style.top = newY + 'px';
    }
    
    // Handle token mouse up
    async handleTokenMouseUp(event) {
        if (!this.isDragging || !this.selectedToken) return;
        
        const tokenElement = document.querySelector(`[data-token-id="${this.selectedToken}"]`);
        if (tokenElement) {
            tokenElement.style.cursor = this.canMoveToken() ? 'grab' : 'default';
            tokenElement.style.zIndex = '100';
            tokenElement.style.transform = 'scale(1)';
            
            // Save new position to Firebase
            const newX = parseInt(tokenElement.style.left);
            const newY = parseInt(tokenElement.style.top);
            
            const room = this.authManager.getCurrentRoom();
            try {
                await FirebaseHelper.updateData(`rooms/${room}/tokens/${this.selectedToken}`, {
                    x: newX,
                    y: newY
                });
            } catch (error) {
                console.error('Error updating token position:', error);
            }
        }
        
        this.isDragging = false;
        this.selectedToken = null;
    }
    
    // Handle token context menu
    handleTokenContextMenu(event) {
        if (!this.authManager.isMaster()) return;
        
        const tokenElement = event.target.closest('.token');
        if (!tokenElement) return;
        
        event.preventDefault();
        
        const tokenId = tokenElement.dataset.tokenId;
        this.selectedToken = tokenId;
        
        const contextMenu = document.getElementById('tokenContextMenu');
        contextMenu.style.display = 'block';
        contextMenu.style.left = event.pageX + 'px';
        contextMenu.style.top = event.pageY + 'px';
    }
    
    // Handle context menu click
    async handleContextMenuClick(event) {
        const action = event.target.dataset.action;
        if (!action || !this.selectedToken) return;
        
        const contextMenu = document.getElementById('tokenContextMenu');
        contextMenu.style.display = 'none';
        
        switch (action) {
            case 'rename':
                await this.renameToken(this.selectedToken);
                break;
            case 'resize':
                await this.resizeToken(this.selectedToken);
                break;
            case 'color':
                await this.changeTokenColor(this.selectedToken);
                break;
            case 'delete':
                await this.deleteToken(this.selectedToken);
                break;
        }
        
        this.selectedToken = null;
    }
    
    // Rename token
    async renameToken(tokenId) {
        const tokenData = this.tokens.get(tokenId);
        if (!tokenData) return;
        
        const newName = prompt('Nuovo nome per il token:', tokenData.name);
        if (newName && newName.trim() !== tokenData.name) {
            const room = this.authManager.getCurrentRoom();
            try {
                await FirebaseHelper.updateData(`rooms/${room}/tokens/${tokenId}`, {
                    name: newName.trim()
                });
            } catch (error) {
                console.error('Error renaming token:', error);
            }
        }
    }
    
    // Resize token
    async resizeToken(tokenId) {
        const tokenData = this.tokens.get(tokenId);
        if (!tokenData) return;
        
        const sizes = ['small', 'medium', 'large'];
        const currentIndex = sizes.indexOf(tokenData.size);
        const newSize = sizes[(currentIndex + 1) % sizes.length];
        
        const room = this.authManager.getCurrentRoom();
        try {
            await FirebaseHelper.updateData(`rooms/${room}/tokens/${tokenId}`, {
                size: newSize
            });
        } catch (error) {
            console.error('Error resizing token:', error);
        }
    }
    
    // Change token color
    async changeTokenColor(tokenId) {
        const tokenData = this.tokens.get(tokenId);
        if (!tokenData) return;
        
        const currentIndex = this.tokenColors.indexOf(tokenData.color);
        const newColor = this.tokenColors[(currentIndex + 1) % this.tokenColors.length];
        
        const room = this.authManager.getCurrentRoom();
        try {
            await FirebaseHelper.updateData(`rooms/${room}/tokens/${tokenId}`, {
                color: newColor
            });
        } catch (error) {
            console.error('Error changing token color:', error);
        }
    }
    
    // Delete token
    async deleteToken(tokenId) {
        const tokenData = this.tokens.get(tokenId);
        if (!tokenData) return;
        
        if (!confirm(`Sei sicuro di voler eliminare il token "${tokenData.name}"?`)) {
            return;
        }
        
        const room = this.authManager.getCurrentRoom();
        
        try {
            // Delete file from server
            const response = await fetch('php/delete.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    filename: tokenData.filename,
                    room: room,
                    type: 'token'
                })
            });
            
            const result = await response.json();
            if (!result.success) {
                console.warn('File deletion failed:', result.error);
            }
            
            // Remove from Firebase
            await FirebaseHelper.removeData(`rooms/${room}/tokens/${tokenId}`);
            
        } catch (error) {
            console.error('Error deleting token:', error);
        }
    }
    
    // Clear all tokens (Master only)
    async clearAllTokens() {
        if (!this.authManager.isMaster()) return;
        
        if (!confirm('Sei sicuro di voler rimuovere tutti i token?')) {
            return;
        }
        
        const room = this.authManager.getCurrentRoom();
        
        try {
            // Delete all token files
            for (const [tokenId, tokenData] of this.tokens) {
                const response = await fetch('php/delete.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        filename: tokenData.filename,
                        room: room,
                        type: 'token'
                    })
                });
                
                const result = await response.json();
                if (!result.success) {
                    console.warn('File deletion failed:', result.error);
                }
            }
            
            // Remove all from Firebase
            await FirebaseHelper.removeData(`rooms/${room}/tokens`);
            
        } catch (error) {
            console.error('Error clearing tokens:', error);
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
            console.error('Error setting player movement:', error);
        }
    }
    
    // Get all tokens
    getAllTokens() {
        return Array.from(this.tokens.values());
    }
    
    // Cleanup
    cleanup() {
        if (this.tokensListener) {
            FirebaseHelper.stopListening(this.tokensListener);
            this.tokensListener = null;
        }
    }
}

export default TokenSystem;