// Character sheet system management - Enhanced UX
import FirebaseHelper from './firebase.js';

export class SheetSystem {
    constructor(authManager) {
        this.authManager = authManager;
        this.currentSheet = null;
        this.isDrawing = false;
        this.drawingTool = 'draw';
        this.drawColor = '#ff0000';
        this.drawSize = 3;
        this.canvas = null;
        this.ctx = null;
        this.annotations = [];
        this.textBoxes = [];
        this.selectedTextBox = null;
        this.isFollowingMouse = false;
        this.pendingTextBox = null;
    }
    
    // Initialize sheet system
    init() {
        this.setupEventListeners();
        this.loadUserSheet();
    }
    
    // Setup event listeners
    setupEventListeners() {
        const characterSheetBtn = document.getElementById('characterSheetBtn');
        const modal = document.getElementById('characterSheetModal');
        const closeBtn = modal.querySelector('.modal-close');
        const uploadBtn = document.getElementById('uploadSheetBtn');
        const removeBtn = document.getElementById('removeSheetBtn');
        const sheetFile = document.getElementById('sheetFile');
        
        // Drawing tools
        const drawBtn = document.getElementById('drawBtn');
        const eraseBtn = document.getElementById('eraseBtn');
        const textBtn = document.getElementById('textBtn');
        const drawColor = document.getElementById('drawColor');
        const drawSize = document.getElementById('drawSize');
        const clearBtn = document.getElementById('clearAnnotationsBtn');
        
        // Modal controls
        characterSheetBtn.addEventListener('click', () => this.openModal());
        closeBtn.addEventListener('click', () => this.closeModal());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeModal();
        });
        
        // File upload
        uploadBtn.addEventListener('click', () => sheetFile.click());
        removeBtn.addEventListener('click', () => this.removeSheet());
        sheetFile.addEventListener('change', (e) => this.handleSheetUpload(e));
        
        // Drawing tools
        drawBtn.addEventListener('click', () => this.setDrawingTool('draw'));
        eraseBtn.addEventListener('click', () => this.setDrawingTool('erase'));
        textBtn.addEventListener('click', () => this.setDrawingTool('text'));
        drawColor.addEventListener('change', (e) => this.setDrawColor(e.target.value));
        drawSize.addEventListener('input', (e) => this.setDrawSize(e.target.value));
        clearBtn.addEventListener('click', () => this.clearAnnotations());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (modal.style.display === 'block') {
                if (e.key === 'Escape') {
                    if (this.isFollowingMouse) {
                        this.cancelTextBoxPlacement();
                    } else {
                        this.closeModal();
                    }
                }
                if (e.key === 'd' || e.key === 'D') this.setDrawingTool('draw');
                if (e.key === 'e' || e.key === 'E') this.setDrawingTool('erase');
                if (e.key === 't' || e.key === 'T') this.setDrawingTool('text');
                if (e.key === 'Delete' && this.selectedTextBox) this.deleteSelectedTextBox();
            }
        });
    }
    
    // Open modal
    openModal() {
        const modal = document.getElementById('characterSheetModal');
        modal.style.display = 'block';
        
        // Center modal
        modal.style.position = 'fixed';
        modal.style.top = '50%';
        modal.style.left = '50%';
        modal.style.transform = 'translate(-50%, -50%)';
        
        // Initialize canvas if sheet is loaded
        if (this.currentSheet) {
            setTimeout(() => this.initializeCanvas(), 100);
        }
    }
    
    // Close modal
    closeModal() {
        const modal = document.getElementById('characterSheetModal');
        modal.style.display = 'none';
        
        // Cancel any pending operations
        this.cancelTextBoxPlacement();
        
        // Save annotations and text boxes if any
        if (this.annotations.length > 0 || this.textBoxes.length > 0) {
            this.saveSheetData();
        }
    }
    
    // Handle sheet upload
    async handleSheetUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Validate file
        const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
        if (!validTypes.includes(file.type)) {
            alert('Per favore seleziona un file immagine (PNG/JPG) o PDF.');
            return;
        }
        
        if (file.size > 50 * 1024 * 1024) { // 50MB
            alert('Il file è troppo grande. Massimo 50MB.');
            return;
        }
        
        const uploadBtn = document.getElementById('uploadSheetBtn');
        uploadBtn.classList.add('loading');
        uploadBtn.disabled = true;
        
        try {
            // Create FormData for upload
            const formData = new FormData();
            formData.append('sheet', file);
            formData.append('room', this.authManager.getCurrentRoom());
            formData.append('userId', this.authManager.getCurrentUser().id);
            formData.append('type', 'sheet');
            
            // Upload file to server
            const response = await fetch('php/upload.php', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Save sheet data to Firebase
                const sheetData = {
                    filename: result.filename,
                    url: result.url,
                    name: file.name,
                    type: file.type,
                    uploadedAt: FirebaseHelper.getTimestamp(),
                    annotations: [],
                    textBoxes: []
                };
                
                const room = this.authManager.getCurrentRoom();
                const userId = this.authManager.getCurrentUser().id;
                await FirebaseHelper.setData(`rooms/${room}/sheets/${userId}`, sheetData);
                
                // Update UI
                this.currentSheet = sheetData;
                this.annotations = [];
                this.textBoxes = [];
                this.displaySheet();
                
                // Clear file input
                event.target.value = '';
                
            } else {
                alert('Errore durante il caricamento: ' + result.error);
            }
            
        } catch (error) {
            console.error('❌ Errore upload scheda:', error);
            alert('Errore durante il caricamento del file.');
        } finally {
            uploadBtn.classList.remove('loading');
            uploadBtn.disabled = false;
        }
    }
    
    // Load user sheet
    async loadUserSheet() {
        const room = this.authManager.getCurrentRoom();
        const userId = this.authManager.getCurrentUser().id;
        
        try {
            const sheetRef = FirebaseHelper.getRef(`rooms/${room}/sheets/${userId}`);
            const snapshot = await sheetRef.once('value');
            const sheetData = snapshot.val();
            
            if (sheetData) {
                this.currentSheet = sheetData;
                this.annotations = sheetData.annotations || [];
                this.textBoxes = sheetData.textBoxes || [];
                this.displaySheet();
            }
        } catch (error) {
            console.error('❌ Errore caricamento scheda:', error);
        }
    }
    
    // Display sheet
    displaySheet() {
        const sheetViewer = document.getElementById('sheetViewer');
        const noSheet = sheetViewer.querySelector('.no-sheet');
        const sheetContent = document.getElementById('sheetContent');
        const sheetImage = document.getElementById('sheetImage');
        const sheetPdf = document.getElementById('sheetPdf');
        const sheetTools = document.getElementById('sheetTools');
        const removeBtn = document.getElementById('removeSheetBtn');
        
        if (this.currentSheet) {
            noSheet.style.display = 'none';
            sheetContent.style.display = 'flex';
            sheetTools.style.display = 'flex';
            removeBtn.style.display = 'block';
            
            if (this.currentSheet.type === 'application/pdf') {
                // Display PDF
                sheetImage.style.display = 'none';
                sheetPdf.style.display = 'block';
                sheetPdf.src = this.currentSheet.url;
                // Disable tools for PDF for now
                sheetTools.style.display = 'none';
            } else {
                // Display image
                sheetPdf.style.display = 'none';
                sheetImage.style.display = 'block';
                sheetImage.src = this.currentSheet.url;
                sheetImage.onload = () => this.initializeCanvas();
            }
        } else {
            noSheet.style.display = 'block';
            sheetContent.style.display = 'none';
            sheetTools.style.display = 'none';
            removeBtn.style.display = 'none';
        }
    }
    
    // Initialize canvas for annotations
    initializeCanvas() {
        const sheetImage = document.getElementById('sheetImage');
        const canvas = document.getElementById('annotationCanvas');
        const sheetContainer = document.querySelector('.sheet-container');
        
        if (!sheetImage || !canvas || !sheetContainer || this.currentSheet.type === 'application/pdf') return;
        
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        // Calculate optimal size to fit container without vertical scrolling
        const containerRect = sheetContainer.getBoundingClientRect();
        const maxWidth = containerRect.width - 40; // Some padding
        const maxHeight = containerRect.height - 40;
        
        const imageAspectRatio = sheetImage.naturalWidth / sheetImage.naturalHeight;
        
        let displayWidth, displayHeight;
        
        if (maxWidth / maxHeight > imageAspectRatio) {
            // Height is the limiting factor
            displayHeight = maxHeight;
            displayWidth = displayHeight * imageAspectRatio;
        } else {
            // Width is the limiting factor
            displayWidth = maxWidth;
            displayHeight = displayWidth / imageAspectRatio;
        }
        
        // Set canvas size to match natural image size for precision
        canvas.width = sheetImage.naturalWidth;
        canvas.height = sheetImage.naturalHeight;
        
        // Set display size
        canvas.style.width = displayWidth + 'px';
        canvas.style.height = displayHeight + 'px';
        sheetImage.style.width = displayWidth + 'px';
        sheetImage.style.height = displayHeight + 'px';
        
        // Center the image and canvas
        sheetContainer.style.display = 'flex';
        sheetContainer.style.alignItems = 'center';
        sheetContainer.style.justifyContent = 'center';
        
        // Redraw existing annotations
        this.redrawAnnotations();
        
        // Render text boxes
        this.renderTextBoxes();
        
        // Setup canvas event listeners
        this.setupCanvasEvents();
        this.setupTextBoxEvents();
        
        console.log('📋 Canvas inizializzato con dimensioni ottimali:', displayWidth, 'x', displayHeight);
    }
    
    // Setup canvas events
    setupCanvasEvents() {
        if (!this.canvas) return;
        
        let isDrawing = false;
        let lastX = 0;
        let lastY = 0;
        
        const getCanvasCoords = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            return {
                x: (e.clientX - rect.left) * scaleX,
                y: (e.clientY - rect.top) * scaleY
            };
        };
        
        const startDrawing = (e) => {
            if (this.drawingTool === 'text') {
                if (this.isFollowingMouse) {
                    this.placeTextBox(e);
                }
                return;
            }
            
            isDrawing = true;
            const coords = getCanvasCoords(e);
            lastX = coords.x;
            lastY = coords.y;
        };
        
        const draw = (e) => {
            if (!isDrawing || this.drawingTool === 'text') return;
            
            const coords = getCanvasCoords(e);
            
            this.ctx.lineWidth = this.drawSize;
            this.ctx.lineCap = 'round';
            
            if (this.drawingTool === 'draw') {
                this.ctx.globalCompositeOperation = 'source-over';
                this.ctx.strokeStyle = this.drawColor;
            } else {
                this.ctx.globalCompositeOperation = 'destination-out';
            }
            
            this.ctx.beginPath();
            this.ctx.moveTo(lastX, lastY);
            this.ctx.lineTo(coords.x, coords.y);
            this.ctx.stroke();
            
            // Save annotation
            this.annotations.push({
                type: this.drawingTool,
                color: this.drawColor,
                size: this.drawSize,
                from: { x: lastX, y: lastY },
                to: { x: coords.x, y: coords.y }
            });
            
            lastX = coords.x;
            lastY = coords.y;
        };
        
        const stopDrawing = () => {
            isDrawing = false;
        };
        
        // Mouse events
        this.canvas.addEventListener('mousedown', startDrawing);
        this.canvas.addEventListener('mousemove', draw);
        this.canvas.addEventListener('mouseup', stopDrawing);
        this.canvas.addEventListener('mouseout', stopDrawing);
        
        // Touch events
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            startDrawing(e.touches[0]);
        });
        
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            draw(e.touches[0]);
        });
        
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            stopDrawing();
        });
    }
    
    // Start text box placement
    startTextBoxPlacement() {
        if (this.drawingTool !== 'text') return;
        
        this.isFollowingMouse = true;
        this.pendingTextBox = {
            id: Date.now().toString(),
            text: 'Nuovo testo',
            fontSize: 14,
            color: this.drawColor,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            fontWeight: 'normal'
        };
        
        // Create following visual
        this.createFollowingTextBox();
        
        console.log('📝 Modalità posizionamento testo attivata');
    }
    
    // Create following text box visual
    createFollowingTextBox() {
        const textBoxesLayer = document.getElementById('textBoxesLayer');
        if (!textBoxesLayer || !this.pendingTextBox) return;
        
        // Remove any existing following text box
        const existingFollowing = textBoxesLayer.querySelector('.following-text-box');
        if (existingFollowing) {
            existingFollowing.remove();
        }
        
        const element = document.createElement('div');
        element.className = 'text-box following-text-box';
        element.contentEditable = false;
        element.textContent = this.pendingTextBox.text;
        
        element.style.cssText = `
            position: absolute;
            font-size: ${this.pendingTextBox.fontSize}px;
            color: ${this.pendingTextBox.color};
            background: ${this.pendingTextBox.backgroundColor};
            border: 2px solid #8b4513;
            border-radius: 4px;
            padding: 4px 8px;
            font-family: 'Cinzel', serif;
            font-weight: ${this.pendingTextBox.fontWeight};
            pointer-events: none;
            opacity: 0.8;
            z-index: 1000;
            min-width: 60px;
            min-height: 20px;
            transform: translate(-50%, -50%);
        `;
        
        textBoxesLayer.appendChild(element);
        
        // Follow mouse
        const canvas = this.canvas;
        const followMouse = (e) => {
            if (!this.isFollowingMouse) return;
            
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            element.style.left = x + 'px';
            element.style.top = y + 'px';
        };
        
        document.addEventListener('mousemove', followMouse);
        
        // Store cleanup function
        this.followMouseCleanup = () => {
            document.removeEventListener('mousemove', followMouse);
        };
    }
    
    // Place text box
    placeTextBox(e) {
        if (!this.isFollowingMouse || !this.pendingTextBox) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        
        const textBox = {
            ...this.pendingTextBox,
            x: x,
            y: y,
            width: 100,
            height: 30
        };
        
        this.textBoxes.push(textBox);
        this.cancelTextBoxPlacement();
        this.renderTextBoxes();
        
        console.log('📝 Casella di testo posizionata:', textBox);
    }
    
    // Cancel text box placement
    cancelTextBoxPlacement() {
        this.isFollowingMouse = false;
        this.pendingTextBox = null;
        
        // Remove following text box
        const followingTextBox = document.querySelector('.following-text-box');
        if (followingTextBox) {
            followingTextBox.remove();
        }
        
        // Cleanup mouse follower
        if (this.followMouseCleanup) {
            this.followMouseCleanup();
            this.followMouseCleanup = null;
        }
    }
    
    // Render text boxes
    renderTextBoxes() {
        const textBoxesLayer = document.getElementById('textBoxesLayer');
        if (!textBoxesLayer) return;
        
        // Clear existing text boxes (except following)
        const existingBoxes = textBoxesLayer.querySelectorAll('.text-box:not(.following-text-box)');
        existingBoxes.forEach(box => box.remove());
        
        this.textBoxes.forEach(textBox => {
            const element = this.createTextBoxElement(textBox);
            textBoxesLayer.appendChild(element);
        });
    }
    
    // Create text box element
    createTextBoxElement(textBox) {
        const element = document.createElement('div');
        element.className = 'text-box';
        element.dataset.textBoxId = textBox.id;
        element.contentEditable = true;
        element.textContent = textBox.text;
        
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = rect.width / this.canvas.width;
        const scaleY = rect.height / this.canvas.height;
        
        element.style.cssText = `
            position: absolute;
            left: ${textBox.x * scaleX}px;
            top: ${textBox.y * scaleY}px;
            width: ${textBox.width * scaleX}px;
            height: ${textBox.height * scaleY}px;
            font-size: ${textBox.fontSize * scaleX}px;
            color: ${textBox.color};
            background: ${textBox.backgroundColor};
            border: 2px solid #8b4513;
            border-radius: 4px;
            padding: 4px 8px;
            font-family: 'Cinzel', serif;
            font-weight: ${textBox.fontWeight};
            cursor: pointer;
            pointer-events: all;
            min-width: 60px;
            min-height: 20px;
            resize: both;
            overflow: hidden;
        `;
        
        // Text box controls
        const controls = document.createElement('div');
        controls.className = 'text-box-controls';
        controls.style.cssText = `
            position: absolute;
            top: -40px;
            left: 0;
            display: none;
            background: rgba(44, 24, 16, 0.9);
            border: 1px solid #8b4513;
            border-radius: 4px;
            padding: 4px;
            gap: 4px;
            z-index: 1001;
        `;
        
        controls.innerHTML = `
            <input type="color" class="text-color-input" value="${textBox.color}" title="Colore Testo">
            <input type="color" class="bg-color-input" value="${textBox.backgroundColor}" title="Colore Sfondo">
            <button class="bold-btn" title="Grassetto">${textBox.fontWeight === 'bold' ? 'B' : 'b'}</button>
            <button class="delete-btn" title="Elimina">×</button>
        `;
        
        element.appendChild(controls);
        
        // Show controls on selection
        element.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectTextBox(textBox.id);
        });
        
        return element;
    }
    
    // Setup text box events
    setupTextBoxEvents() {
        const textBoxesLayer = document.getElementById('textBoxesLayer');
        if (!textBoxesLayer) return;
        
        // Click outside to deselect
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.text-box')) {
                this.deselectAllTextBoxes();
            }
        });
        
        // Handle text box controls
        textBoxesLayer.addEventListener('change', (e) => {
            if (e.target.classList.contains('text-color-input')) {
                this.updateTextBoxProperty(e.target.closest('.text-box').dataset.textBoxId, 'color', e.target.value);
            } else if (e.target.classList.contains('bg-color-input')) {
                this.updateTextBoxProperty(e.target.closest('.text-box').dataset.textBoxId, 'backgroundColor', e.target.value);
            }
        });
        
        textBoxesLayer.addEventListener('click', (e) => {
            if (e.target.classList.contains('bold-btn')) {
                const textBox = this.textBoxes.find(tb => tb.id === e.target.closest('.text-box').dataset.textBoxId);
                const newWeight = textBox.fontWeight === 'bold' ? 'normal' : 'bold';
                this.updateTextBoxProperty(textBox.id, 'fontWeight', newWeight);
                e.target.textContent = newWeight === 'bold' ? 'B' : 'b';
            } else if (e.target.classList.contains('delete-btn')) {
                this.deleteTextBox(e.target.closest('.text-box').dataset.textBoxId);
            }
        });
        
        textBoxesLayer.addEventListener('input', (e) => {
            if (e.target.classList.contains('text-box')) {
                this.updateTextBoxContent(e.target.dataset.textBoxId, e.target.textContent);
            }
        });
    }
    
    // Select text box
    selectTextBox(id) {
        this.deselectAllTextBoxes();
        
        const element = document.querySelector(`[data-text-box-id="${id}"]`);
        if (element) {
            element.classList.add('selected');
            const controls = element.querySelector('.text-box-controls');
            if (controls) {
                controls.style.display = 'flex';
            }
            this.selectedTextBox = id;
        }
    }
    
    // Deselect all text boxes
    deselectAllTextBoxes() {
        document.querySelectorAll('.text-box').forEach(el => {
            el.classList.remove('selected');
            const controls = el.querySelector('.text-box-controls');
            if (controls) {
                controls.style.display = 'none';
            }
        });
        this.selectedTextBox = null;
    }
    
    // Update text box property
    updateTextBoxProperty(id, property, value) {
        const textBox = this.textBoxes.find(tb => tb.id === id);
        if (textBox) {
            textBox[property] = value;
            this.renderTextBoxes();
        }
    }
    
    // Update text box content
    updateTextBoxContent(id, text) {
        const textBox = this.textBoxes.find(tb => tb.id === id);
        if (textBox) {
            textBox.text = text;
        }
    }
    
    // Delete text box
    deleteTextBox(id) {
        this.textBoxes = this.textBoxes.filter(tb => tb.id !== id);
        this.renderTextBoxes();
    }
    
    // Delete selected text box
    deleteSelectedTextBox() {
        if (this.selectedTextBox) {
            this.deleteTextBox(this.selectedTextBox);
            this.selectedTextBox = null;
        }
    }
    
    // Set drawing tool
    setDrawingTool(tool) {
        this.drawingTool = tool;
        
        const drawBtn = document.getElementById('drawBtn');
        const eraseBtn = document.getElementById('eraseBtn');
        const textBtn = document.getElementById('textBtn');
        
        drawBtn.classList.toggle('active', tool === 'draw');
        eraseBtn.classList.toggle('active', tool === 'erase');
        textBtn.classList.toggle('active', tool === 'text');
        
        if (this.canvas) {
            if (tool === 'text') {
                this.canvas.style.cursor = 'crosshair';
                this.startTextBoxPlacement();
            } else {
                this.canvas.style.cursor = tool === 'draw' ? 'crosshair' : 'grab';
                this.cancelTextBoxPlacement();
            }
        }
    }
    
    // Set draw color
    setDrawColor(color) {
        this.drawColor = color;
    }
    
    // Set draw size
    setDrawSize(size) {
        this.drawSize = parseInt(size);
    }
    
    // Clear annotations
    clearAnnotations() {
        if (!confirm('Sei sicuro di voler cancellare tutte le annotazioni e i testi?')) {
            return;
        }
        
        this.annotations = [];
        this.textBoxes = [];
        
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        this.renderTextBoxes();
        this.saveSheetData();
    }
    
    // Redraw annotations
    redrawAnnotations() {
        if (!this.ctx || !this.annotations.length) return;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.annotations.forEach(annotation => {
            this.ctx.lineWidth = annotation.size;
            this.ctx.lineCap = 'round';
            
            if (annotation.type === 'draw') {
                this.ctx.globalCompositeOperation = 'source-over';
                this.ctx.strokeStyle = annotation.color;
            } else {
                this.ctx.globalCompositeOperation = 'destination-out';
            }
            
            this.ctx.beginPath();
            this.ctx.moveTo(annotation.from.x, annotation.from.y);
            this.ctx.lineTo(annotation.to.x, annotation.to.y);
            this.ctx.stroke();
        });
    }
    
    // Save sheet data to Firebase
    async saveSheetData() {
        if (!this.currentSheet) return;
        
        const room = this.authManager.getCurrentRoom();
        const userId = this.authManager.getCurrentUser().id;
        
        try {
            await FirebaseHelper.updateData(`rooms/${room}/sheets/${userId}`, {
                annotations: this.annotations,
                textBoxes: this.textBoxes
            });
        } catch (error) {
            console.error('❌ Errore salvataggio dati scheda:', error);
        }
    }
    
    // Remove sheet
    async removeSheet() {
        if (!this.currentSheet) return;
        
        if (!confirm('Sei sicuro di voler rimuovere la scheda personaggio?')) {
            return;
        }
        
        const room = this.authManager.getCurrentRoom();
        const userId = this.authManager.getCurrentUser().id;
        
        try {
            // Delete file from server
            const response = await fetch('php/delete.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    filename: this.currentSheet.filename,
                    room: room,
                    type: 'sheet'
                })
            });
            
            const result = await response.json();
            if (!result.success) {
                console.warn('⚠️ Fallimento eliminazione file:', result.error);
            }
            
            // Remove from Firebase
            await FirebaseHelper.removeData(`rooms/${room}/sheets/${userId}`);
            
            // Update UI
            this.currentSheet = null;
            this.annotations = [];
            this.textBoxes = [];
            this.displaySheet();
            
        } catch (error) {
            console.error('❌ Errore rimozione scheda:', error);
        }
    }
    
    // Get current sheet
    getCurrentSheet() {
        return this.currentSheet;
    }
    
    // Cleanup
    cleanup() {
        // Save annotations and text boxes before cleanup
        if (this.annotations.length > 0 || this.textBoxes.length > 0) {
            this.saveSheetData();
        }
        
        this.cancelTextBoxPlacement();
    }
}

export default SheetSystem;