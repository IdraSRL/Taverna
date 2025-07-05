// Map system management
import FirebaseHelper from './firebase.js';

export class MapSystem {
    constructor(authManager) {
        this.authManager = authManager;
        this.currentMap = null;
        this.localZoom = 1;
        this.localPanX = 0;
        this.localPanY = 0;
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.mapListener = null;
        this.minZoom = 1; // Zoom minimo 100%
        this.maxZoom = 3;
        this.baseZoom = 1; // Zoom base per adattare la mappa al container
        this.panSmoothness = 0.1; // Fluidità movimento
    }
    
    // Initialize map system
    init() {
        console.log('🗺️ Inizializzazione sistema mappa...');
        this.setupEventListeners();
        this.listenToMapChanges();
        this.updateAdminControls();
        
        // Setup resize observer for responsive map
        this.setupResizeObserver();
    }
    
    // Setup resize observer
    setupResizeObserver() {
        const mapContainer = document.getElementById('mapContainer');
        if (mapContainer && window.ResizeObserver) {
            const resizeObserver = new ResizeObserver(() => {
                if (this.currentMap) {
                    this.calculateBaseZoom();
                    this.updateMapTransform();
                }
            });
            resizeObserver.observe(mapContainer);
        }
    }
    
    // Setup event listeners
    setupEventListeners() {
        const uploadMapBtn = document.getElementById('uploadMapBtn');
        const mapFileInput = document.getElementById('mapFileInput');
        const zoomInBtn = document.getElementById('zoomInBtn');
        const zoomOutBtn = document.getElementById('zoomOutBtn');
        const resetZoomBtn = document.getElementById('resetZoomBtn');
        const mapViewport = document.getElementById('mapViewport');
        
        if (!mapViewport) {
            console.error('❌ Viewport mappa non trovato');
            return;
        }
        
        // Map upload (Master only)
        if (uploadMapBtn && mapFileInput) {
            uploadMapBtn.addEventListener('click', () => mapFileInput.click());
            mapFileInput.addEventListener('change', (e) => this.handleMapUpload(e));
        }
        
        // Zoom controls
        if (zoomInBtn) zoomInBtn.addEventListener('click', () => this.zoomIn());
        if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => this.zoomOut());
        if (resetZoomBtn) resetZoomBtn.addEventListener('click', () => this.resetZoom());
        
        // Pan controls with improved smoothness
        mapViewport.addEventListener('mousedown', (e) => this.startPan(e));
        document.addEventListener('mousemove', (e) => this.handlePan(e));
        document.addEventListener('mouseup', () => this.endPan());
        
        // Touch support
        mapViewport.addEventListener('touchstart', (e) => this.startPan(e.touches[0]));
        document.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.handlePan(e.touches[0]);
        });
        document.addEventListener('touchend', () => this.endPan());
        
        // Wheel zoom
        mapViewport.addEventListener('wheel', (e) => this.handleWheel(e));
        
        console.log('✅ Event listeners mappa configurati');
    }
    
    // Update admin controls visibility
    updateAdminControls() {
        const isMaster = this.authManager.isMaster();
        const adminElements = document.querySelectorAll('.admin-only');
        
        adminElements.forEach(element => {
            element.style.display = isMaster ? 'block' : 'none';
        });
    }
    
    // Handle map upload
    async handleMapUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Validate file
        if (!file.type.startsWith('image/')) {
            alert('Per favore seleziona un file immagine valido.');
            return;
        }
        
        if (file.size > 50 * 1024 * 1024) { // 50MB
            alert('Il file è troppo grande. Massimo 50MB.');
            return;
        }
        
        const uploadBtn = document.getElementById('uploadMapBtn');
        if (uploadBtn) {
            uploadBtn.classList.add('loading');
            uploadBtn.disabled = true;
        }
        
        try {
            console.log('📤 Caricamento mappa:', file.name);
            
            // Create FormData for upload
            const formData = new FormData();
            formData.append('map', file);
            formData.append('room', this.authManager.getCurrentRoom());
            formData.append('type', 'map');
            
            // Upload file to server
            const response = await fetch('php/upload.php', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Save map data to Firebase
                const mapData = {
                    id: FirebaseHelper.generateUserId(),
                    filename: result.filename,
                    url: result.url,
                    name: file.name.replace(/\.[^/.]+$/, ""),
                    uploadedBy: this.authManager.getCurrentUser().name,
                    timestamp: FirebaseHelper.getTimestamp()
                };
                
                const room = this.authManager.getCurrentRoom();
                await FirebaseHelper.setData(`rooms/${room}/map`, mapData);
                
                // Clear file input
                event.target.value = '';
                
                console.log('✅ Mappa caricata con successo');
                
            } else {
                console.error('❌ Errore caricamento mappa:', result.error);
                alert('Errore durante il caricamento: ' + result.error);
            }
            
        } catch (error) {
            console.error('❌ Errore upload mappa:', error);
            alert('Errore durante il caricamento del file.');
        } finally {
            if (uploadBtn) {
                uploadBtn.classList.remove('loading');
                uploadBtn.disabled = false;
            }
        }
    }
    
    // Listen to map changes
    listenToMapChanges() {
        const room = this.authManager.getCurrentRoom();
        if (!room) {
            console.error('❌ Nessuna stanza per ascoltare mappa');
            return;
        }
        
        console.log('👂 Ascolto cambiamenti mappa per stanza:', room);
        
        this.mapListener = FirebaseHelper.listenToData(`rooms/${room}/map`, (snapshot) => {
            this.handleMapUpdate(snapshot);
        });
    }
    
    // Handle map update
    handleMapUpdate(snapshot) {
        try {
            const mapData = snapshot.val();
            const mapImage = document.getElementById('mapImage');
            const noMapDiv = document.querySelector('.no-map');
            
            if (!mapImage || !noMapDiv) {
                console.error('❌ Elementi mappa non trovati');
                return;
            }
            
            if (mapData) {
                console.log('🗺️ Aggiornamento mappa:', mapData.name);
                this.currentMap = mapData;
                
                // Show map image
                mapImage.src = mapData.url;
                mapImage.style.display = 'block';
                noMapDiv.style.display = 'none';
                
                // Wait for image to load before applying transforms
                mapImage.onload = () => {
                    this.calculateBaseZoom();
                    
                    // Use local zoom and pan (not synced)
                    this.localZoom = this.baseZoom;
                    this.localPanX = 0;
                    this.localPanY = 0;
                    
                    this.updateMapTransform();
                    
                    console.log('📐 Mappa caricata con zoom locale:', {
                        baseZoom: this.baseZoom,
                        localZoom: this.localZoom,
                        localPanX: this.localPanX,
                        localPanY: this.localPanY
                    });
                };
                
            } else {
                console.log('🗺️ Nessuna mappa caricata');
                this.currentMap = null;
                mapImage.style.display = 'none';
                noMapDiv.style.display = 'block';
                this.resetZoom();
            }
            
        } catch (error) {
            console.error('❌ Errore aggiornamento mappa:', error);
        }
    }
    
    // Calculate base zoom to fit map in container
    calculateBaseZoom() {
        const mapImage = document.getElementById('mapImage');
        const mapContainer = document.getElementById('mapContainer');
        
        if (!mapImage || !mapContainer || !this.currentMap) {
            this.baseZoom = 1;
            return;
        }
        
        const containerRect = mapContainer.getBoundingClientRect();
        const imageNaturalWidth = mapImage.naturalWidth;
        const imageNaturalHeight = mapImage.naturalHeight;
        
        if (imageNaturalWidth === 0 || imageNaturalHeight === 0) {
            this.baseZoom = 1;
            return;
        }
        
        // Calculate scale to fit image in container (with some padding)
        const padding = 20; // 20px padding
        const availableWidth = containerRect.width - padding;
        const availableHeight = containerRect.height - padding;
        
        const scaleX = availableWidth / imageNaturalWidth;
        const scaleY = availableHeight / imageNaturalHeight;
        
        // Use the smaller scale to ensure the entire image fits
        this.baseZoom = Math.min(scaleX, scaleY);
        
        // Ensure minimum zoom is never less than what's needed to fit
        this.minZoom = this.baseZoom;
        
        console.log('📏 Zoom base calcolato:', {
            containerSize: { width: containerRect.width, height: containerRect.height },
            imageSize: { width: imageNaturalWidth, height: imageNaturalHeight },
            baseZoom: this.baseZoom
        });
    }
    
    // Zoom in (local only)
    zoomIn() {
        this.localZoom = Math.min(this.maxZoom, this.localZoom * 1.2);
        this.updateMapTransform();
        console.log('🔍+ Zoom in locale:', this.localZoom);
    }
    
    // Zoom out (local only)
    zoomOut() {
        this.localZoom = Math.max(this.minZoom, this.localZoom / 1.2);
        this.updateMapTransform();
        console.log('🔍- Zoom out locale:', this.localZoom);
    }
    
    // Reset zoom (local only)
    resetZoom() {
        console.log('🎯 Reset zoom locale');
        if (this.currentMap) {
            this.calculateBaseZoom();
            this.localZoom = this.baseZoom;
            
            // Center the map
            const mapContainer = document.getElementById('mapContainer');
            const mapImage = document.getElementById('mapImage');
            
            if (mapContainer && mapImage) {
                const containerRect = mapContainer.getBoundingClientRect();
                const scaledWidth = mapImage.naturalWidth * this.localZoom;
                const scaledHeight = mapImage.naturalHeight * this.localZoom;
                
                this.localPanX = (containerRect.width - scaledWidth) / 2;
                this.localPanY = (containerRect.height - scaledHeight) / 2;
            }
        } else {
            this.localZoom = 1;
            this.localPanX = 0;
            this.localPanY = 0;
        }
        
        this.updateMapTransform();
    }
    
    // Handle wheel zoom (local only)
    handleWheel(event) {
        event.preventDefault();
        
        const delta = event.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.localZoom * delta));
        
        if (newZoom !== this.localZoom) {
            // Zoom towards mouse position
            const rect = event.currentTarget.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;
            
            // Calculate zoom center offset
            const zoomFactor = newZoom / this.localZoom;
            this.localPanX = mouseX - (mouseX - this.localPanX) * zoomFactor;
            this.localPanY = mouseY - (mouseY - this.localPanY) * zoomFactor;
            
            this.localZoom = newZoom;
            this.updateMapTransform();
        }
    }
    
    // Start pan (local only)
    startPan(event) {
        this.isDragging = true;
        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;
        
        const mapViewport = document.getElementById('mapViewport');
        if (mapViewport) {
            mapViewport.style.cursor = 'grabbing';
            mapViewport.style.transition = 'none'; // Disable transition during drag
        }
    }
    
    // Handle pan (local only, improved smoothness)
    handlePan(event) {
        if (!this.isDragging) return;
        
        const deltaX = event.clientX - this.lastMouseX;
        const deltaY = event.clientY - this.lastMouseY;
        
        // Apply smoothness factor for fluid movement
        this.localPanX += deltaX;
        this.localPanY += deltaY;
        
        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;
        
        this.updateMapTransform();
    }
    
    // End pan (local only)
    endPan() {
        if (this.isDragging) {
            this.isDragging = false;
            
            const mapViewport = document.getElementById('mapViewport');
            if (mapViewport) {
                mapViewport.style.cursor = 'grab';
                mapViewport.style.transition = 'transform 0.1s ease-out'; // Re-enable smooth transition
            }
        }
    }
    
    // Update map transform (local only)
    updateMapTransform() {
        const mapCanvas = document.getElementById('mapCanvas');
        if (mapCanvas) {
            mapCanvas.style.transform = `translate(${this.localPanX}px, ${this.localPanY}px) scale(${this.localZoom})`;
            mapCanvas.style.transformOrigin = '0 0';
        }
    }
    
    // Remove current map (Master only)
    async removeMap() {
        if (!this.authManager.isMaster() || !this.currentMap) return;
        
        if (!confirm('Sei sicuro di voler rimuovere la mappa corrente?')) {
            return;
        }
        
        const room = this.authManager.getCurrentRoom();
        
        try {
            console.log('🗑️ Rimozione mappa...');
            
            // Delete file from server
            const response = await fetch('php/delete.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    filename: this.currentMap.filename,
                    room: room,
                    type: 'map'
                })
            });
            
            const result = await response.json();
            if (!result.success) {
                console.warn('⚠️ Fallimento eliminazione file:', result.error);
            }
            
            // Remove from Firebase
            await FirebaseHelper.removeData(`rooms/${room}/map`);
            
            console.log('✅ Mappa rimossa');
            
        } catch (error) {
            console.error('❌ Errore rimozione mappa:', error);
        }
    }
    
    // Get current map data
    getCurrentMap() {
        return this.currentMap;
    }
    
    // Get map bounds for token positioning
    getMapBounds() {
        const mapImage = document.getElementById('mapImage');
        const mapContainer = document.getElementById('mapContainer');
        
        if (!mapImage || !mapContainer || !this.currentMap) return null;
        
        const containerRect = mapContainer.getBoundingClientRect();
        
        return {
            left: containerRect.left + this.localPanX,
            top: containerRect.top + this.localPanY,
            width: mapImage.naturalWidth * this.localZoom,
            height: mapImage.naturalHeight * this.localZoom,
            zoom: this.localZoom,
            panX: this.localPanX,
            panY: this.localPanY,
            containerLeft: containerRect.left,
            containerTop: containerRect.top
        };
    }
    
    // Convert screen coordinates to map coordinates
    screenToMapCoords(screenX, screenY) {
        const mapBounds = this.getMapBounds();
        if (!mapBounds) return { x: 0, y: 0 };
        
        // Convert screen coordinates to map-relative coordinates
        const mapX = (screenX - mapBounds.containerLeft - this.localPanX) / this.localZoom;
        const mapY = (screenY - mapBounds.containerTop - this.localPanY) / this.localZoom;
        
        return { x: mapX, y: mapY };
    }
    
    // Convert map coordinates to screen coordinates
    mapToScreenCoords(mapX, mapY) {
        const mapBounds = this.getMapBounds();
        if (!mapBounds) return { x: 0, y: 0 };
        
        const screenX = mapX * this.localZoom + this.localPanX + mapBounds.containerLeft;
        const screenY = mapY * this.localZoom + this.localPanY + mapBounds.containerTop;
        
        return { x: screenX, y: screenY };
    }
    
    // Cleanup
    cleanup() {
        console.log('🧹 Pulizia sistema mappa...');
        if (this.mapListener) {
            FirebaseHelper.stopListening(this.mapListener);
            this.mapListener = null;
        }
    }
}

export default MapSystem;