// Admin panel management
import FirebaseHelper from './firebase.js';

export class AdminPanel {
    constructor(authManager, mapSystem, tokenSystem, musicSystem, chatSystem) {
        this.authManager = authManager;
        this.mapSystem = mapSystem;
        this.tokenSystem = tokenSystem;
        this.musicSystem = musicSystem;
        this.chatSystem = chatSystem;
        this.currentTab = 'assets';
        this.assetsData = {
            maps: [],
            tokens: [],
            music: []
        };
    }
    
    // Initialize admin panel
    init() {
        console.log('⚙️ Inizializzazione pannello admin...');
        this.setupEventListeners();
        this.updateVisibility();
    }
    
    // Setup event listeners
    setupEventListeners() {
        const adminBtn = document.getElementById('adminPanelBtn');
        const modal = document.getElementById('adminPanelModal');
        const closeBtn = modal.querySelector('.modal-close');
        const tabs = modal.querySelectorAll('.admin-tab');
        
        // Modal controls
        adminBtn.addEventListener('click', () => this.openPanel());
        closeBtn.addEventListener('click', () => this.closePanel());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closePanel();
        });
        
        // Tab switching
        tabs.forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
        });
        
        // Asset upload controls
        this.setupAssetControls();
        
        // Room actions
        this.setupRoomActions();
        
        // User management
        this.setupUserManagement();
        
        console.log('✅ Event listeners admin panel configurati');
    }
    
    // Setup asset controls
    setupAssetControls() {
        // Maps
        const uploadMapAssetBtn = document.getElementById('uploadMapAssetBtn');
        const mapAssetInput = document.getElementById('mapAssetInput');
        
        uploadMapAssetBtn.addEventListener('click', () => mapAssetInput.click());
        mapAssetInput.addEventListener('change', (e) => this.handleAssetUpload(e, 'map'));
        
        // Tokens
        const uploadTokenAssetBtn = document.getElementById('uploadTokenAssetBtn');
        const tokenAssetInput = document.getElementById('tokenAssetInput');
        
        uploadTokenAssetBtn.addEventListener('click', () => tokenAssetInput.click());
        tokenAssetInput.addEventListener('change', (e) => this.handleAssetUpload(e, 'token'));
        
        // Music
        const uploadMusicAssetBtn = document.getElementById('uploadMusicAssetBtn');
        const musicAssetInput = document.getElementById('musicAssetInput');
        
        uploadMusicAssetBtn.addEventListener('click', () => musicAssetInput.click());
        musicAssetInput.addEventListener('change', (e) => this.handleAssetUpload(e, 'music'));
    }
    
    // Handle asset upload
    async handleAssetUpload(event, type) {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;
        
        console.log(`📁 Caricamento ${files.length} asset di tipo ${type}...`);
        
        const uploadBtn = document.getElementById(`upload${type.charAt(0).toUpperCase() + type.slice(1)}AssetBtn`);
        uploadBtn.classList.add('loading');
        uploadBtn.disabled = true;
        
        try {
            for (const file of files) {
                // Validate file
                if (!this.validateAssetFile(file, type)) {
                    continue;
                }
                
                // Create FormData for upload
                const formData = new FormData();
                formData.append(type, file);
                formData.append('room', this.authManager.getCurrentRoom());
                formData.append('type', type);
                
                // Upload file to server
                const response = await fetch('php/upload.php', {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                
                if (result.success) {
                    // Save asset data to Firebase
                    const assetData = {
                        id: FirebaseHelper.generateUserId(),
                        filename: result.filename,
                        url: result.url,
                        name: file.name.replace(/\.[^/.]+$/, ""),
                        type: type,
                        uploadedBy: this.authManager.getCurrentUser().name,
                        timestamp: FirebaseHelper.getTimestamp(),
                        size: file.size
                    };
                    
                    const room = this.authManager.getCurrentRoom();
                    await FirebaseHelper.pushData(`rooms/${room}/assets/${type}`, assetData);
                    
                    console.log(`✅ Asset ${type} caricato:`, assetData.name);
                } else {
                    console.error(`❌ Errore caricamento asset ${type}:`, result.error);
                }
            }
            
            // Reload assets
            await this.loadAssetsData();
            
            // Clear file input
            event.target.value = '';
            
        } catch (error) {
            console.error(`❌ Errore upload asset ${type}:`, error);
        } finally {
            uploadBtn.classList.remove('loading');
            uploadBtn.disabled = false;
        }
    }
    
    // Validate asset file
    validateAssetFile(file, type) {
        const validTypes = {
            map: ['image/png', 'image/jpeg', 'image/jpg'],
            token: ['image/png', 'image/jpeg', 'image/jpg'],
            music: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg']
        };
        
        const maxSizes = {
            map: 50 * 1024 * 1024, // 50MB
            token: 10 * 1024 * 1024, // 10MB
            music: 100 * 1024 * 1024 // 100MB
        };
        
        if (!validTypes[type].includes(file.type)) {
            alert(`Tipo file non valido per ${type}. Tipi supportati: ${validTypes[type].join(', ')}`);
            return false;
        }
        
        if (file.size > maxSizes[type]) {
            const maxSizeMB = Math.round(maxSizes[type] / 1024 / 1024);
            alert(`File troppo grande per ${type}. Massimo ${maxSizeMB}MB.`);
            return false;
        }
        
        return true;
    }
    
    // Setup room actions
    setupRoomActions() {
        const clearTokensBtn = document.getElementById('clearTokensBtn');
        const resetMapBtn = document.getElementById('resetMapBtn');
        const clearChatBtn = document.getElementById('clearChatBtn');
        const clearPlaylistBtn = document.getElementById('clearPlaylistBtn');
        const clearPingsBtn = document.getElementById('clearPingsBtn');
        const deleteRoomBtn = document.getElementById('deleteRoomBtn');
        
        clearTokensBtn.addEventListener('click', () => this.clearTokens());
        resetMapBtn.addEventListener('click', () => this.resetMap());
        clearChatBtn.addEventListener('click', () => this.clearChat());
        clearPlaylistBtn.addEventListener('click', () => this.clearPlaylist());
        clearPingsBtn.addEventListener('click', () => this.clearPings());
        deleteRoomBtn.addEventListener('click', () => this.deleteRoom());
    }
    
    // Setup user management
    setupUserManagement() {
        const allowTokenMovement = document.getElementById('allowTokenMovement');
        
        allowTokenMovement.addEventListener('change', (e) => {
            this.setTokenMovementPermission(e.target.checked);
        });
        
        // Load current setting
        this.loadTokenMovementSetting();
    }
    
    // Update visibility based on user role
    updateVisibility() {
        const adminBtn = document.getElementById('adminPanelBtn');
        const isMaster = this.authManager.isMaster();
        
        adminBtn.style.display = isMaster ? 'block' : 'none';
    }
    
    // Open panel
    async openPanel() {
        if (!this.authManager.isMaster()) return;
        
        console.log('📋 Apertura pannello admin...');
        
        const modal = document.getElementById('adminPanelModal');
        modal.style.display = 'block';
        
        // Load data for current tab
        await this.loadTabData(this.currentTab);
    }
    
    // Close panel
    closePanel() {
        console.log('📋 Chiusura pannello admin...');
        const modal = document.getElementById('adminPanelModal');
        modal.style.display = 'none';
    }
    
    // Switch tab
    async switchTab(tabName) {
        this.currentTab = tabName;
        
        console.log('📑 Cambio tab admin:', tabName);
        
        // Update tab buttons
        const tabs = document.querySelectorAll('.admin-tab');
        tabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });
        
        // Update tab content
        const contents = document.querySelectorAll('.admin-tab-content');
        contents.forEach(content => {
            content.classList.toggle('active', content.id === tabName + 'Tab');
        });
        
        // Load data for new tab
        await this.loadTabData(tabName);
    }
    
    // Load tab data
    async loadTabData(tabName) {
        switch (tabName) {
            case 'assets':
                await this.loadAssetsData();
                break;
            case 'users':
                await this.loadUsersData();
                break;
            case 'room':
                // Room tab doesn't need dynamic loading
                break;
        }
    }
    
    // Load assets data
    async loadAssetsData() {
        const room = this.authManager.getCurrentRoom();
        
        try {
            console.log('📁 Caricamento dati asset...');
            
            // Load maps
            const mapsRef = FirebaseHelper.getRef(`rooms/${room}/assets/map`);
            const mapsSnapshot = await mapsRef.once('value');
            const mapsData = mapsSnapshot.val();
            this.assetsData.maps = mapsData ? Object.values(mapsData) : [];
            
            // Load tokens
            const tokensRef = FirebaseHelper.getRef(`rooms/${room}/assets/token`);
            const tokensSnapshot = await tokensRef.once('value');
            const tokensData = tokensSnapshot.val();
            this.assetsData.tokens = tokensData ? Object.values(tokensData) : [];
            
            // Load music
            const musicRef = FirebaseHelper.getRef(`rooms/${room}/assets/music`);
            const musicSnapshot = await musicRef.once('value');
            const musicData = musicSnapshot.val();
            this.assetsData.music = musicData ? Object.values(musicData) : [];
            
            // Update UI
            this.updateAssetsDisplay();
            
            console.log('✅ Dati asset caricati:', {
                maps: this.assetsData.maps.length,
                tokens: this.assetsData.tokens.length,
                music: this.assetsData.music.length
            });
            
        } catch (error) {
            console.error('❌ Errore caricamento dati asset:', error);
        }
    }
    
    // Update assets display
    updateAssetsDisplay() {
        this.updateAssetsList('mapsAssetList', this.assetsData.maps, 'map');
        this.updateAssetsList('tokensAssetList', this.assetsData.tokens, 'token');
        this.updateAssetsList('musicAssetList', this.assetsData.music, 'music');
    }
    
    // Update assets list
    updateAssetsList(containerId, assets, type) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = '';
        
        if (assets.length === 0) {
            container.innerHTML = '<div class="no-assets">Nessun asset caricato</div>';
            return;
        }
        
        assets.forEach(asset => {
            const assetElement = this.createAssetElement(asset, type);
            container.appendChild(assetElement);
        });
    }
    
    // Create asset element
    createAssetElement(asset, type) {
        const assetDiv = document.createElement('div');
        assetDiv.className = 'asset-item';
        
        const fileName = asset.name || 'Asset senza nome';
        const fileSize = asset.size ? this.formatFileSize(asset.size) : '';
        
        assetDiv.innerHTML = `
            <div class="asset-preview">
                ${type === 'music' ? '🎵' : `<img src="${asset.url}" alt="${fileName}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;">`}
            </div>
            <div class="asset-info">
                <div class="asset-name">${fileName}</div>
                <div class="asset-details">${fileSize}</div>
            </div>
            <div class="asset-actions">
                <button class="asset-btn" onclick="window.adminPanel.useAsset('${asset.id}', '${type}')" title="Usa">✅</button>
                <button class="asset-btn" onclick="window.adminPanel.renameAsset('${asset.id}', '${type}')" title="Rinomina">✏️</button>
                <button class="asset-btn" onclick="window.adminPanel.deleteAsset('${asset.id}', '${type}')" title="Elimina">🗑️</button>
            </div>
        `;
        
        return assetDiv;
    }
    
    // Use asset
    async useAsset(assetId, type) {
        const assets = this.assetsData[type + 's'] || this.assetsData[type];
        const asset = assets.find(a => a.id === assetId);
        
        if (!asset) return;
        
        console.log(`🎯 Utilizzo asset ${type}:`, asset.name);
        
        const room = this.authManager.getCurrentRoom();
        
        try {
            switch (type) {
                case 'map':
                    // Set as current map
                    const mapData = {
                        id: asset.id,
                        filename: asset.filename,
                        url: asset.url,
                        name: asset.name,
                        uploadedBy: asset.uploadedBy,
                        timestamp: FirebaseHelper.getTimestamp(),
                        zoom: 1,
                        panX: 0,
                        panY: 0
                    };
                    await FirebaseHelper.setData(`rooms/${room}/map`, mapData);
                    break;
                    
                case 'token':
                    // Add token to map
                    const tokenData = {
                        id: FirebaseHelper.generateUserId(),
                        filename: asset.filename,
                        url: asset.url,
                        name: asset.name,
                        x: 100,
                        y: 100,
                        size: 'medium',
                        color: '#ff6b6b',
                        uploadedBy: this.authManager.getCurrentUser().name,
                        timestamp: FirebaseHelper.getTimestamp()
                    };
                    await FirebaseHelper.setData(`rooms/${room}/tokens/${tokenData.id}`, tokenData);
                    break;
                    
                case 'music':
                    // Add to playlist
                    const trackData = {
                        id: asset.id,
                        title: asset.name,
                        filename: asset.filename,
                        url: asset.url,
                        duration: 0,
                        uploadedBy: asset.uploadedBy,
                        timestamp: FirebaseHelper.getTimestamp()
                    };
                    await FirebaseHelper.pushData(`rooms/${room}/playlist`, trackData);
                    break;
            }
            
            console.log(`✅ Asset ${type} utilizzato con successo`);
            
        } catch (error) {
            console.error(`❌ Errore utilizzo asset ${type}:`, error);
        }
    }
    
    // Rename asset
    async renameAsset(assetId, type) {
        const assets = this.assetsData[type + 's'] || this.assetsData[type];
        const asset = assets.find(a => a.id === assetId);
        
        if (!asset) return;
        
        const currentName = asset.name;
        const newName = prompt('Nuovo nome:', currentName);
        
        if (newName && newName.trim() !== currentName) {
            const room = this.authManager.getCurrentRoom();
            
            try {
                // Find and update the asset in Firebase
                const assetsRef = FirebaseHelper.getRef(`rooms/${room}/assets/${type}`);
                const snapshot = await assetsRef.once('value');
                const assetsData = snapshot.val();
                
                if (assetsData) {
                    for (const [key, value] of Object.entries(assetsData)) {
                        if (value.id === assetId) {
                            await FirebaseHelper.updateData(`rooms/${room}/assets/${type}/${key}`, {
                                name: newName.trim()
                            });
                            break;
                        }
                    }
                }
                
                // Reload data
                await this.loadAssetsData();
                
                console.log(`✅ Asset ${type} rinominato:`, currentName, '->', newName.trim());
                
            } catch (error) {
                console.error(`❌ Errore rinomina asset ${type}:`, error);
                alert('Errore durante la rinominazione dell\'asset.');
            }
        }
    }
    
    // Delete asset
    async deleteAsset(assetId, type) {
        const assets = this.assetsData[type + 's'] || this.assetsData[type];
        const asset = assets.find(a => a.id === assetId);
        
        if (!asset) return;
        
        const fileName = asset.name;
        if (!confirm(`Sei sicuro di voler eliminare "${fileName}"?`)) {
            return;
        }
        
        const room = this.authManager.getCurrentRoom();
        
        try {
            console.log(`🗑️ Eliminazione asset ${type}:`, fileName);
            
            // Delete file from server
            const response = await fetch('php/delete.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    filename: asset.filename,
                    room: room,
                    type: type
                })
            });
            
            const result = await response.json();
            if (!result.success) {
                console.warn('⚠️ Fallimento eliminazione file:', result.error);
            }
            
            // Remove from Firebase
            const assetsRef = FirebaseHelper.getRef(`rooms/${room}/assets/${type}`);
            const snapshot = await assetsRef.once('value');
            const assetsData = snapshot.val();
            
            if (assetsData) {
                for (const [key, value] of Object.entries(assetsData)) {
                    if (value.id === assetId) {
                        await FirebaseHelper.removeData(`rooms/${room}/assets/${type}/${key}`);
                        break;
                    }
                }
            }
            
            // Reload data
            await this.loadAssetsData();
            
            console.log(`✅ Asset ${type} eliminato`);
            
        } catch (error) {
            console.error(`❌ Errore eliminazione asset ${type}:`, error);
            alert('Errore durante l\'eliminazione dell\'asset.');
        }
    }
    
    // Format file size
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    // Load users data
    async loadUsersData() {
        const room = this.authManager.getCurrentRoom();
        
        try {
            console.log('👥 Caricamento dati utenti admin...');
            
            const usersRef = FirebaseHelper.getRef(`rooms/${room}/users`);
            const snapshot = await usersRef.once('value');
            const usersData = snapshot.val();
            
            const usersList = document.getElementById('usersListAdmin');
            usersList.innerHTML = '';
            
            if (usersData) {
                Object.entries(usersData).forEach(([userId, userData]) => {
                    const userElement = this.createUserElement(userId, userData);
                    usersList.appendChild(userElement);
                });
            } else {
                usersList.innerHTML = '<div class="no-users">Nessun utente connesso</div>';
            }
            
        } catch (error) {
            console.error('❌ Errore caricamento dati utenti:', error);
        }
    }
    
    // Create user element
    createUserElement(userId, userData) {
        const userDiv = document.createElement('div');
        userDiv.className = 'user-item-admin';
        
        const roleIcon = userData.role === 'master' ? '👑' : '⚔️';
        const statusClass = this.getUserStatus(userData);
        
        userDiv.innerHTML = `
            <div class="user-info">
                <div class="user-avatar" style="${userData.avatar ? `background-image: url(${userData.avatar})` : ''}">
                    ${!userData.avatar ? roleIcon : ''}
                </div>
                <div class="user-details">
                    <div class="user-name">${userData.name}</div>
                    <div class="user-status ${statusClass}">${this.getStatusText(statusClass)}</div>
                </div>
            </div>
            <div class="user-actions">
                ${userData.role !== 'master' ? `<button class="user-btn" onclick="window.adminPanel.kickUser('${userId}')">🚪</button>` : ''}
            </div>
        `;
        
        return userDiv;
    }
    
    // Get user status
    getUserStatus(userData) {
        if (!userData.lastSeen) return 'offline';
        
        const now = Date.now();
        const lastSeen = typeof userData.lastSeen === 'number' ? userData.lastSeen : 0;
        const timeDiff = now - lastSeen;
        
        if (timeDiff > 2 * 60 * 1000) return 'offline';
        if (userData.status === 'away') return 'away';
        return 'online';
    }
    
    // Get status text
    getStatusText(status) {
        switch (status) {
            case 'online': return 'Online';
            case 'away': return 'Assente';
            case 'offline': return 'Offline';
            default: return 'Sconosciuto';
        }
    }
    
    // Kick user
    async kickUser(userId) {
        if (!confirm('Sei sicuro di voler disconnettere questo utente?')) {
            return;
        }
        
        const room = this.authManager.getCurrentRoom();
        
        try {
            console.log('🚪 Disconnessione utente:', userId);
            await FirebaseHelper.removeData(`rooms/${room}/users/${userId}`);
            await this.loadUsersData();
        } catch (error) {
            console.error('❌ Errore disconnessione utente:', error);
        }
    }
    
    // Load token movement setting
    async loadTokenMovementSetting() {
        const room = this.authManager.getCurrentRoom();
        
        try {
            const settingsRef = FirebaseHelper.getRef(`rooms/${room}/settings/allowTokenMovement`);
            const snapshot = await settingsRef.once('value');
            const allowed = snapshot.val() || false;
            
            const checkbox = document.getElementById('allowTokenMovement');
            checkbox.checked = allowed;
            
        } catch (error) {
            console.error('❌ Errore caricamento impostazione movimento token:', error);
        }
    }
    
    // Set token movement permission
    async setTokenMovementPermission(allowed) {
        await this.tokenSystem.setPlayerMovement(allowed);
    }
    
    // Clear tokens
    async clearTokens() {
        await this.tokenSystem.clearAllTokens();
    }
    
    // Reset map
    async resetMap() {
        await this.mapSystem.removeMap();
    }
    
    // Clear chat
    async clearChat() {
        await this.chatSystem.clearChat();
    }
    
    // Clear playlist
    async clearPlaylist() {
        if (!confirm('Sei sicuro di voler svuotare la playlist?')) {
            return;
        }
        
        const room = this.authManager.getCurrentRoom();
        
        try {
            console.log('🎵 Svuotamento playlist...');
            
            // Get all music files
            const musicRef = FirebaseHelper.getRef(`rooms/${room}/playlist`);
            const snapshot = await musicRef.once('value');
            const musicData = snapshot.val();
            
            if (musicData) {
                // Delete all music files
                for (const [key, music] of Object.entries(musicData)) {
                    const response = await fetch('php/delete.php', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            filename: music.filename,
                            room: room,
                            type: 'music'
                        })
                    });
                    
                    const result = await response.json();
                    if (!result.success) {
                        console.warn('⚠️ Fallimento eliminazione file:', result.error);
                    }
                }
            }
            
            // Clear playlist from Firebase
            await FirebaseHelper.removeData(`rooms/${room}/playlist`);
            
            console.log('✅ Playlist svuotata');
            
        } catch (error) {
            console.error('❌ Errore svuotamento playlist:', error);
        }
    }
    
    // Clear pings
    async clearPings() {
        if (!confirm('Sei sicuro di voler cancellare tutti i ping attivi?')) {
            return;
        }
        
        const room = this.authManager.getCurrentRoom();
        
        try {
            console.log('📍 Cancellazione ping...');
            await FirebaseHelper.removeData(`rooms/${room}/pings`);
            console.log('✅ Ping cancellati');
        } catch (error) {
            console.error('❌ Errore cancellazione ping:', error);
        }
    }
    
    // Delete room
    async deleteRoom() {
        const roomName = this.authManager.getCurrentRoom();
        
        if (!confirm(`Sei sicuro di voler eliminare completamente la stanza "${roomName}"? Questa azione non può essere annullata.`)) {
            return;
        }
        
        const confirmText = prompt('Scrivi "ELIMINA" per confermare:');
        if (confirmText !== 'ELIMINA') {
            return;
        }
        
        try {
            console.log('🗑️ Eliminazione stanza:', roomName);
            
            // Delete all files associated with the room
            const room = this.authManager.getCurrentRoom();
            
            // Get all data first
            const roomRef = FirebaseHelper.getRef(`rooms/${room}`);
            const snapshot = await roomRef.once('value');
            const roomData = snapshot.val();
            
            if (roomData) {
                // Delete map files
                if (roomData.map && roomData.map.filename) {
                    await this.deleteFileFromServer(roomData.map.filename, room, 'map');
                }
                
                // Delete token files
                if (roomData.tokens) {
                    for (const token of Object.values(roomData.tokens)) {
                        if (token.filename) {
                            await this.deleteFileFromServer(token.filename, room, 'token');
                        }
                    }
                }
                
                // Delete music files
                if (roomData.playlist) {
                    for (const music of Object.values(roomData.playlist)) {
                        if (music.filename) {
                            await this.deleteFileFromServer(music.filename, room, 'music');
                        }
                    }
                }
                
                // Delete sheet files
                if (roomData.sheets) {
                    for (const sheet of Object.values(roomData.sheets)) {
                        if (sheet.filename) {
                            await this.deleteFileFromServer(sheet.filename, room, 'sheet');
                        }
                    }
                }
                
                // Delete asset files
                if (roomData.assets) {
                    for (const [type, assets] of Object.entries(roomData.assets)) {
                        if (assets) {
                            for (const asset of Object.values(assets)) {
                                if (asset.filename) {
                                    await this.deleteFileFromServer(asset.filename, room, type);
                                }
                            }
                        }
                    }
                }
            }
            
            // Delete room from Firebase
            await FirebaseHelper.removeData(`rooms/${room}`);
            
            console.log('✅ Stanza eliminata');
            
            // Logout user
            await this.authManager.logout();
            
        } catch (error) {
            console.error('❌ Errore eliminazione stanza:', error);
            alert('Errore durante l\'eliminazione della stanza.');
        }
    }
    
    // Delete file from server
    async deleteFileFromServer(filename, room, type) {
        try {
            const response = await fetch('php/delete.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    filename: filename,
                    room: room,
                    type: type
                })
            });
            
            const result = await response.json();
            if (!result.success) {
                console.warn('⚠️ Fallimento eliminazione file:', result.error);
            }
        } catch (error) {
            console.error('❌ Errore eliminazione file dal server:', error);
        }
    }
}

export default AdminPanel;