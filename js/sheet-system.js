// Character sheet system management
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
        this.isDraggingTextBox = false;
        this.dragOffset = { x: 0, y: 0 };
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
                if (e.key === 'Escape') this.closeModal();
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
        
        // Initialize canvas if sheet is loaded
        if (this.currentSheet) {
            setTimeout(() => this.initializeCanvas(), 100);
        }
    }
    
    // Close modal
    closeModal() {
        const modal = document.getElementById('characterSheetModal');
        modal.style.display = 'none';
        
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
            console.error('Upload error:', error);
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
            console.error('Error loading sheet:', error);
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
        
        // Set canvas size to match image
        const rect = sheetImage.getBoundingClientRect();
        canvas.width = sheetImage.naturalWidth;
        canvas.height = sheetImage.naturalHeight;
        canvas.style.width = '100%';
        canvas.style.height = 'auto';
        
        // Redraw existing annotations
        this.redrawAnnotations();
        
        // Render text boxes
        this.renderTextBoxes();
        
        // Setup canvas event listeners
        this.setupCanvasEvents();
        this.setupTextBoxEvents();
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
                this.addTextBox(e);
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
    
    // Add text box
    addTextBox(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        
        const textBox = {
            id: Date.now().toString(),
            x: x,
            y: y,
            width: 100,
            height: 30,
            text: 'Nuovo testo',
            fontSize: 14,
            color: this.drawColor
        };
        
        this.textBoxes.push(textBox);
        this.renderTextBoxes();
    }
    
    // Render text boxes
    renderTextBoxes() {
        const textBoxesLayer = document.getElementById('textBoxesLayer');
        if (!textBoxesLayer) return;
        
        textBoxesLayer.innerHTML = '';
        
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
            background: rgba(255, 255, 255, 0.9);
            border: 2px solid #8b4513;
            border-radius: 4px;
            padding: 4px 8px;
            font-family: 'Cinzel', serif;
            cursor: move;
            pointer-events: all;
            min-width: 60px;
            min-height: 20px;
            resize: both;
            overflow: hidden;
        `;
        
        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'text-box-delete';
        deleteBtn.innerHTML = '×';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            this.deleteTextBox(textBox.id);
        };
        element.appendChild(deleteBtn);
        
        return element;
    }
    
    // Setup text box events
    setupTextBoxEvents() {
        const textBoxesLayer = document.getElementById('textBoxesLayer');
        if (!textBoxesLayer) return;
        
        textBoxesLayer.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('text-box')) {
                this.selectTextBox(e.target.dataset.textBoxId);
                this.startDragTextBox(e);
            }
        });
        
        textBoxesLayer.addEventListener('mousemove', (e) => {
            if (this.isDraggingTextBox) {
                this.dragTextBox(e);
            }
        });
        
        textBoxesLayer.addEventListener('mouseup', () => {
            this.stopDragTextBox();
        });
        
        textBoxesLayer.addEventListener('input', (e) => {
            if (e.target.classList.contains('text-box')) {
                this.updateTextBoxContent(e.target.dataset.textBoxId, e.target.textContent);
            }
        });
    }
    
    // Select text box
    selectTextBox(id) {
        // Remove previous selection
        document.querySelectorAll('.text-box').forEach(el => {
            el.classList.remove('selected');
        });
        
        // Select new text box
        const element = document.querySelector(`[data-text-box-id="${id}"]`);
        if (element) {
            element.classList.add('selected');
            this.selectedTextBox = id;
        }
    }
    
    // Start dragging text box
    startDragTextBox(e) {
        if (e.target.classList.contains('text-box-delete')) return;
        
        this.isDraggingTextBox = true;
        const rect = e.target.getBoundingClientRect();
        this.dragOffset = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }
    
    // Drag text box
    dragTextBox(e) {
        if (!this.isDraggingTextBox || !this.selectedTextBox) return;
        
        const element = document.querySelector(`[data-text-box-id="${this.selectedTextBox}"]`);
        if (!element) return;
        
        const containerRect = this.canvas.getBoundingClientRect();
        const newX = e.clientX - containerRect.left - this.dragOffset.x;
        const newY = e.clientY - containerRect.top - this.dragOffset.y;
        
        element.style.left = newX + 'px';
        element.style.top = newY + 'px';
        
        // Update text box data
        const textBox = this.textBoxes.find(tb => tb.id === this.selectedTextBox);
        if (textBox) {
            const scaleX = this.canvas.width / containerRect.width;
            const scaleY = this.canvas.height / containerRect.height;
            textBox.x = newX * scaleX;
            textBox.y = newY * scaleY;
        }
    }
    
    // Stop dragging text box
    stopDragTextBox() {
        this.isDraggingTextBox = false;
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
            } else {
                this.canvas.style.cursor = tool === 'draw' ? 'crosshair' : 'grab';
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
            console.error('Error saving sheet data:', error);
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
                console.warn('File deletion failed:', result.error);
            }
            
            // Remove from Firebase
            await FirebaseHelper.removeData(`rooms/${room}/sheets/${userId}`);
            
            // Update UI
            this.currentSheet = null;
            this.annotations = [];
            this.textBoxes = [];
            this.displaySheet();
            
        } catch (error) {
            console.error('Error removing sheet:', error);
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
    }
}

export default SheetSystem;