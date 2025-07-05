// Master panel management - New streamlined approach
import FirebaseHelper from './firebase.js';

export class MasterPanel {
    constructor(authManager, mapSystem, tokenSystem, musicSystem, chatSystem) {
        this.authManager = authManager;
        this.mapSystem = mapSystem;
        this.tokenSystem = tokenSystem;
        this.musicSystem = musicSystem;
        this.chatSystem = chatSystem;
        this.isOpen = false;
        this.assetsData = {
            maps: [],
            tokens: [],
            music: []
        };
        this.assetsListeners = {
            maps: null,
            tokens: null,
            music: null
        };
    }
    
    // Initialize master panel
    init() {
        console.log('⚙️ Inizializzazione pannello master...');
        this.setupEventListeners();
        this.updateVisibility();
        
        // Start listening to assets if master
        if (this.authManager.isMaster()) {
            this.startAssetsListeners();
        }
    }
    
    // Setup event listeners
    setupEventListeners() {
        const masterPanelBtn = document.getElementById('masterPanelBtn');
        const closePanelBtn = document.getElementById('closeMasterPanel');
        
        // Panel toggle
        if (masterPanelBtn) {
            masterPanelBtn.addEventListener('click', () => this.togglePanel());
        }
        
        if (closePanelBtn) {
            closePanelBtn.addEventListener('click', () => this.closePanel());
        }
        
        // Quick actions
        this.setupQuickActions();
        
        // File inputs
        this.setupFileInputs();
        
        console.log('✅ Event listeners pannello master configurati');
    }
    
    // Setup quick actions
    setupQuickActions() {
        const uploadMapBtn = document.getElementById('uploadMapBtn');
        const uploadTokenBtn = document.getElementById('uploadTokenBtn');
        const uploadMusicBtn = document.getElementById('uploadMusicBtn');
        const clearTokensBtn = document.getElementById('clearTokensBtn');
        const resetMapBtn = document.getElementById('resetMapBtn');
        const clearChatBtn = document.getElementById('clearChatBtn');
        
        if (uploadMapBtn) uploadMapBtn.addEventListener('click', () => this.triggerFileUpload('map'));
        if (uploadTokenBtn) uploadTokenBtn.addEventListener('click', () => this.triggerFileUpload('token'));
        if (uploadMusicBtn) uploadMusicBtn.addEventListener('click', () => this.triggerFileUpload('music'));
        if (clearTokensBtn) clearTokensBtn.addEventListener('click', () => this.clearTokens());
        if (resetMapBtn) resetMapBtn.addEventListener('click', () => this.resetMap());
        if (clearChatBtn) clearChatBtn.addEventListener('click', () => this.clearChat());
    }
    
    // Setup file inputs
    setupFileInputs() {
        const mapFileInput = document.getElementById('mapFileInput');
        const tokenFileInput = document.getElementById('tokenFileInput');
        const musicFileInput = document.getElementById('musicFileInput');
        
        if (mapFileInput) {
            mapFileInput.addEventListener('change', (e) => this.handleFileUpload(e, 'map'));
        }
        
        if (tokenFileInput) {
            tokenFileInput.addEventListener('change', (e) => this.handleFileUpload(e, 'token'));
        }
        
        if (musicFileInput) {
            musicFileInput.addEventListener('change', (e) => this.handleFileUpload(e, 'music'));
        }
    }
    
    // Update visibility based on user role
    updateVisibility() {
        const masterPanelBtn = document.getElementById('masterPanelBtn');
        const masterPanel = document.getElementById('masterPanel');
        const isMaster = this.authManager.isMaster();
        
        if (masterPanelBtn) masterPanelBtn.style.display = isMaster ? 'block' : 'none';
        if (masterPanel) masterPanel.style.display = isMaster ? 'none' : 'none'; // Hidden by default
    }
    
    // Toggle panel
    togglePanel() {
        if (this.isOpen) {
            this.closePanel();
        } else {
            this.openPanel();
        }
    }
    
    // Open panel
    openPanel() {
        if (!this.authManager.isMaster()) return;
        
        console.log('📋 Apertura pannello master...');
        
        const masterPanel = document.getElementById('masterPanel');
        if (masterPanel) {
            masterPanel.style.display = 'flex';
            masterPanel.classList.add('panel-open');
            this.isOpen = true;
            
            // Load assets data
            this.loadAllAssets();
        }
    }
    
    // Close panel
    closePanel() {
        console.log('📋 Chiusura pannello master...');
        
        const masterPanel = document.getElementById('masterPanel');
        if (masterPanel) {
            masterPanel.style.display = 'none';
            masterPanel.classList.remove('panel-open');
            this.isOpen = false;
        }
    }
    
    // Start assets listeners
    startAssetsListeners() {
        const room = this.authManager.getCurrentRoom();
        if (!room) return;
        
        console.log('👂 Avvio listeners asset per stanza:', room);
        
        // Listen to maps
        this.assetsListeners.maps = FirebaseHelper.listenToData(`rooms/${room}/assets/map`, (snapshot) => {
            this.handleAssetsUpdate('maps', snapshot);
        });
        
        // Listen to tokens
        this.assetsListeners.tokens = FirebaseHelper.listenToData(`rooms/${room}/assets/token`, (snapshot) => {
            this.handleAssetsUpdate('tokens', snapshot);
        });
        
        // Listen to music
        this.assetsListeners.music = FirebaseHelper.listenToData(`rooms/${room}/playlist`, (snapshot) => {
            this.handleAssetsUpdate('music', snapshot);
        });
    }
    
    // Handle assets update
    handleAssetsUpdate(type, snapshot) {
        try {
            const assetsData = snapshot.val();
            this.assetsData[type] = assetsData ? Object.values(assetsData) : [];
            
            console.log(`📁 Aggiornamento asset ${type}:`, this.assetsData[type].length);
            
            // Update library display
            this.updateLibraryDisplay(type);
            
        } catch (error) {
            console.error(`❌ Errore aggiornamento asset ${type}:`, error);
        }
    }
    
    // Load all assets
    async loadAllAssets() {
        const room = this.authManager.getCurrentRoom();
        if (!room) return;
        
        try {
            console.log('📁 Caricamento tutti gli asset...');
            
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
            const musicRef = FirebaseHelper.getRef(`rooms/${room}/playlist`);
            const musicSnapshot = await musicRef.once('value');
            const musicData = musicSnapshot.val();
            this.assetsData.music = musicData ? Object.values(musicData) : [];
            
            // Update all displays
            this.updateLibraryDisplay('maps');
            this.updateLibraryDisplay('tokens');
            this.updateLibraryDisplay('music');
            
            console.log('✅ Asset caricati:', {
                maps: this.assetsData.maps.length,
                tokens: this.assetsData.tokens.length,
                music: this.assetsData.music.length
            });
            
        } catch (error) {
            console.error('❌ Errore caricamento asset:', error);
        }
    }
    
    // Update library display
    updateLibraryDisplay(type) {
        const libraryContent = document.getElementById(`${type}Library`);
        const libraryCount = document.getElementById(`${type}Count`);
        
        if (!libraryContent || !libraryCount) return;
        
        const assets = this.assetsData[type];
        libraryCount.textContent = assets.length;
        
        libraryContent.innerHTML = '';
        
        if (assets.length === 0) {
            libraryContent.innerHTML = `<div class="no-assets">Nessun ${type === 'maps' ? 'mappa' : type === 'tokens' ? 'token' : 'musica'} disponibile</div>`;
            return;
        }
        
        assets.forEach(asset => {
            const assetElement = this.createAssetElement(asset, type);
            libraryContent.appendChild(assetElement);
        });
    }
    
    // Create asset element
    createAssetElement(asset, type) {
        const assetDiv = document.createElement('div');
        assetDiv.className = 'library-asset';
        assetDiv.dataset.assetId = asset.id;
        assetDiv.dataset.assetType = type;
        
        const fileName = asset.name || asset.title || 'Asset senza nome';
        
        assetDiv.innerHTML = `
            <div class="asset-preview">
                ${type === 'music' ? '🎵' : `<img src="${asset.url}" alt="${fileName}">`}
            </div>
            <div class="asset-info">
                <div class="asset-name">${fileName}</div>
            </div>
            <div class="asset-actions">
                <button class="asset-action-btn use" onclick="window.masterPanel.useAsset('${asset.id}', '${type}')" title="Usa">✅</button>
                <button class="asset-action-btn edit" onclick="window.masterPanel.editAsset('${asset.id}', '${type}')" title="Modifica">✏️</button>
                <button class="asset-action-btn delete" onclick="window.masterPanel.deleteAsset('${asset.id}', '${type}')" title="Elimina">🗑️</button>
            </div>
        `;
        
        // Add click to use
        assetDiv.addEventListener('click', (e) => {
            if (!e.target.closest('.asset-actions')) {
                this.useAsset(asset.id, type);
            }
        });
        
        return assetDiv;
    }
    
    // Trigger file upload
    triggerFileUpload(type) {
        const fileInput = document.getElementById(`${type}FileInput`);
        if (fileInput) {
            fileInput.click();
        }
    }
    
    // Handle file upload
    async handleFileUpload(event, type) {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;
        
        console.log(`📁 Caricamento ${files.length} file di tipo ${type}...`);
        
        const uploadBtn = document.getElementById(`upload${type.charAt(0).toUpperCase() + type.slice(1)}Btn`);
        if (uploadBtn) {
            uploadBtn.classList.add('loading');
            uploadBtn.disabled = true;
        }
        
        try {
            for (const file of files) {
                // Validate file
                if (!this.validateFile(file, type)) {
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
                        title: file.name.replace(/\.[^/.]+$/, ""), // For music compatibility
                        type: type,
                        uploadedBy: this.authManager.getCurrentUser().name,
                        timestamp: FirebaseHelper.getTimestamp(),
                        size: file.size
                    };
                    
                    const room = this.authManager.getCurrentRoom();
                    
                    if (type === 'music') {
                        // Music goes to playlist
                        await FirebaseHelper.pushData(`rooms/${room}/playlist`, assetData);
                    } else {
                        // Maps and tokens go to assets
                        await FirebaseHelper.pushData(`rooms/${room}/assets/${type}`, assetData);
                    }
                    
                    console.log(`✅ Asset ${type} caricato:`, assetData.name);
                } else {
                    console.error(`❌ Errore caricamento asset ${type}:`, result.error);
                    alert(`Errore caricamento ${type}: ${result.error}`);
                }
            }
            
            // Clear file input
            event.target.value = '';
            
        } catch (error) {
            console.error(`❌ Errore upload asset ${type}:`, error);
            alert(`Errore durante il caricamento del ${type}.`);
        } finally {
            if (uploadBtn) {
                uploadBtn.classList.remove('loading');
                uploadBtn.disabled = false;
            }
        }
    }
    
    // Validate file
    validateFile(file, type) {
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
    
    // Use asset
    async useAsset(assetId, type) {
        const assets = this.assetsData[type];
        const asset = assets.find(a => a.id === assetId);
        
        if (!asset) return;
        
        console.log(`🎯 Utilizzo asset ${type}:`, asset.name || asset.title);
        
        const room = this.authManager.getCurrentRoom();
        
        try {
            switch (type) {
                case 'maps':
                    // Set as current map
                    const mapData = {
                        id: asset.id,
                        filename: asset.filename,
                        url: asset.url,
                        name: asset.name,
                        uploadedBy: asset.uploadedBy,
                        timestamp: FirebaseHelper.getTimestamp()
                    };
                    await FirebaseHelper.setData(`rooms/${room}/map`, mapData);
                    break;
                    
                case 'tokens':
                    // Add token to map center
                    const tokenData = {
                        id: FirebaseHelper.generateUserId(),
                        filename: asset.filename,
                        url: asset.url,
                        name: asset.name,
                        x: 200, // Center position
                        y: 200,
                        size: 'medium',
                        color: '#ff6b6b',
                        uploadedBy: this.authManager.getCurrentUser().name,
                        timestamp: FirebaseHelper.getTimestamp()
                    };
                    await FirebaseHelper.setData(`rooms/${room}/tokens/${tokenData.id}`, tokenData);
                    break;
                    
                case 'music':
                    // Select track for playback
                    await this.musicSystem.selectTrackById(assetId);
                    break;
            }
            
            console.log(`✅ Asset ${type} utilizzato con successo`);
            
        } catch (error) {
            console.error(`❌ Errore utilizzo asset ${type}:`, error);
        }
    }
    
    // Edit asset
    async editAsset(assetId, type) {
        const assets = this.assetsData[type];
        const asset = assets.find(a => a.id === assetId);
        
        if (!asset) return;
        
        const currentName = asset.name || asset.title;
        const newName = prompt('Nuovo nome:', currentName);
        
        if (newName && newName.trim() !== currentName) {
            const room = this.authManager.getCurrentRoom();
            
            try {
                const updateData = {
                    name: newName.trim()
                };
                
                if (type === 'music') {
                    updateData.title = newName.trim();
                }
                
                // Find and update the asset in Firebase
                const basePath = type === 'music' ? `rooms/${room}/playlist` : `rooms/${room}/assets/${type}`;
                const assetsRef = FirebaseHelper.getRef(basePath);
                const snapshot = await assetsRef.once('value');
                const assetsData = snapshot.val();
                
                if (assetsData) {
                    for (const [key, value] of Object.entries(assetsData)) {
                        if (value.id === assetId) {
                            await FirebaseHelper.updateData(`${basePath}/${key}`, updateData);
                            break;
                        }
                    }
                }
                
                console.log(`✅ Asset ${type} rinominato:`, currentName, '->', newName.trim());
                
            } catch (error) {
                console.error(`❌ Errore rinomina asset ${type}:`, error);
                alert('Errore durante la rinominazione dell\'asset.');
            }
        }
    }
    
    // Delete asset
    async deleteAsset(assetId, type) {
        const assets = this.assetsData[type];
        const asset = assets.find(a => a.id === assetId);
        
        if (!asset) return;
        
        const fileName = asset.name || asset.title;
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
                    type: type === 'maps' ? 'map' : type === 'tokens' ? 'token' : 'music'
                })
            });
            
            const result = await response.json();
            if (!result.success) {
                console.warn('⚠️ Fallimento eliminazione file:', result.error);
            }
            
            // Remove from Firebase
            const basePath = type === 'music' ? `rooms/${room}/playlist` : `rooms/${room}/assets/${type}`;
            const assetsRef = FirebaseHelper.getRef(basePath);
            const snapshot = await assetsRef.once('value');
            const assetsData = snapshot.val();
            
            if (assetsData) {
                for (const [key, value] of Object.entries(assetsData)) {
                    if (value.id === assetId) {
                        await FirebaseHelper.removeData(`${basePath}/${key}`);
                        break;
                    }
                }
            }
            
            console.log(`✅ Asset ${type} eliminato`);
            
        } catch (error) {
            console.error(`❌ Errore eliminazione asset ${type}:`, error);
            alert('Errore durante l\'eliminazione dell\'asset.');
        }
    }
    
    // Clear tokens
    async clearTokens() {
        if (!confirm('Sei sicuro di voler rimuovere tutti i token?')) {
            return;
        }
        
        await this.tokenSystem.clearAllTokens();
    }
    
    // Reset map
    async resetMap() {
        if (!confirm('Sei sicuro di voler rimuovere la mappa corrente?')) {
            return;
        }
        
        await this.mapSystem.removeMap();
    }
    
    // Clear chat
    async clearChat() {
        if (!confirm('Sei sicuro di voler svuotare la chat?')) {
            return;
        }
        
        await this.chatSystem.clearChat();
    }
    
    // Cleanup
    cleanup() {
        console.log('🧹 Pulizia pannello master...');
        
        // Stop all listeners
        Object.values(this.assetsListeners).forEach(listener => {
            if (listener) {
                FirebaseHelper.stopListening(listener);
            }
        });
        
        this.assetsListeners = {
            maps: null,
            tokens: null,
            music: null
        };
    }
}

export default MasterPanel;