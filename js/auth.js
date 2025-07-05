// Authentication and session management
import FirebaseHelper from './firebase.js';

export class AuthManager {
    constructor() {
        this.currentUser = null;
        this.currentRoom = null;
        this.sessionKey = 'tavernaSession';
    }
    
    // Initialize auth manager
    init() {
        console.log('🔐 Inizializzazione gestore autenticazione...');
        this.setupEventListeners();
    }
    
    // Setup event listeners for login form
    setupEventListeners() {
        const loginForm = document.getElementById('loginForm');
        const playerTab = document.getElementById('playerTab');
        const masterTab = document.getElementById('masterTab');
        const avatarUpload = document.getElementById('avatarUpload');
        
        if (!loginForm) {
            console.error('❌ Form login non trovato');
            return;
        }
        
        // Role tab switching
        if (playerTab) playerTab.addEventListener('click', () => this.switchRole('player'));
        if (masterTab) masterTab.addEventListener('click', () => this.switchRole('master'));
        
        // Avatar upload preview
        if (avatarUpload) avatarUpload.addEventListener('change', (e) => this.handleAvatarUpload(e));
        
        // Form submission
        loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        
        console.log('✅ Event listeners autenticazione configurati');
    }
    
    // Switch between player and master roles
    switchRole(role) {
        const playerTab = document.getElementById('playerTab');
        const masterTab = document.getElementById('masterTab');
        const passwordGroup = document.getElementById('passwordGroup');
        
        if (role === 'player') {
            if (playerTab) playerTab.classList.add('active');
            if (masterTab) masterTab.classList.remove('active');
            if (passwordGroup) passwordGroup.style.display = 'none';
        } else {
            if (masterTab) masterTab.classList.add('active');
            if (playerTab) playerTab.classList.remove('active');
            if (passwordGroup) passwordGroup.style.display = 'block';
        }
        
        console.log('🔄 Cambio ruolo:', role);
    }
    
    // Handle avatar upload and preview
    handleAvatarUpload(event) {
        const file = event.target.files[0];
        const preview = document.getElementById('avatarPreview');
        
        if (file && preview) {
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.style.backgroundImage = `url(${e.target.result})`;
                preview.style.display = 'block';
            };
            reader.readAsDataURL(file);
            console.log('📷 Avatar caricato per preview');
        } else if (preview) {
            preview.style.display = 'none';
        }
    }
    
    // Handle login form submission
    async handleLogin(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const name = formData.get('name').trim();
        const room = formData.get('room').trim();
        const password = formData.get('password') || '';
        const isMaster = document.getElementById('masterTab')?.classList.contains('active') || false;
        
        console.log('🔐 Tentativo login:', { name, room, isMaster });
        
        // Validation
        if (!name || !room) {
            this.showError('Nome e nome stanza sono obbligatori');
            return;
        }
        
        if (isMaster && password !== 'admin') {
            this.showError('Password Master non corretta');
            return;
        }
        
        // Get avatar data
        const avatarFile = document.getElementById('avatarUpload')?.files[0];
        let avatarData = null;
        
        if (avatarFile) {
            avatarData = await this.processAvatar(avatarFile);
            console.log('📷 Avatar processato per login');
        }
        
        // Create user object
        const user = {
            id: FirebaseHelper.generateUserId(),
            name: name,
            role: isMaster ? 'master' : 'player',
            avatar: avatarData,
            room: room,
            timestamp: FirebaseHelper.getTimestamp(),
            lastSeen: FirebaseHelper.getTimestamp()
        };
        
        // Attempt to join room
        const loginBtn = document.querySelector('.enter-btn');
        if (loginBtn) {
            loginBtn.classList.add('loading');
            loginBtn.disabled = true;
        }
        
        try {
            const success = await this.joinRoom(user, room);
            if (success) {
                this.saveSession(user);
                
                // Force page refresh to ensure clean state
                console.log('🔄 Forzatura refresh per stato pulito...');
                setTimeout(() => {
                    window.location.reload();
                }, 100);
            } else {
                this.showError('Errore durante l\'accesso alla stanza');
            }
        } catch (error) {
            console.error('❌ Errore login:', error);
            this.showError('Errore di connessione');
        } finally {
            if (loginBtn) {
                loginBtn.classList.remove('loading');
                loginBtn.disabled = false;
            }
        }
    }
    
    // Process avatar file
    async processAvatar(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                resolve(e.target.result);
            };
            reader.readAsDataURL(file);
        });
    }
    
    // Join a room
    async joinRoom(user, roomName) {
        try {
            console.log('🏠 Accesso alla stanza:', roomName, 'come', user.role);
            
            // Add user to room
            await FirebaseHelper.setData(`rooms/${roomName}/users/${user.id}`, user);
            
            // Set room info if it doesn't exist
            const roomRef = FirebaseHelper.getRoomRef(roomName);
            const roomSnapshot = await roomRef.once('value');
            
            if (!roomSnapshot.exists()) {
                await FirebaseHelper.setData(`rooms/${roomName}/info`, {
                    name: roomName,
                    created: FirebaseHelper.getTimestamp(),
                    lastActivity: FirebaseHelper.getTimestamp()
                });
                console.log('🏠 Stanza creata:', roomName);
            }
            
            this.currentUser = user;
            this.currentRoom = roomName;
            
            console.log('✅ Accesso alla stanza riuscito');
            return true;
        } catch (error) {
            console.error('❌ Errore accesso stanza:', error);
            return false;
        }
    }
    
    // Save session to localStorage
    saveSession(user) {
        const sessionData = {
            user: user,
            room: user.room,
            timestamp: Date.now()
        };
        localStorage.setItem(this.sessionKey, JSON.stringify(sessionData));
        console.log('💾 Sessione salvata per:', user.name);
    }
    
    // Load session from localStorage
    loadSession() {
        const sessionData = localStorage.getItem(this.sessionKey);
        if (sessionData) {
            try {
                const session = JSON.parse(sessionData);
                // Check if session is not too old (24 hours)
                if (Date.now() - session.timestamp < 24 * 60 * 60 * 1000) {
                    this.currentUser = session.user;
                    this.currentRoom = session.room;
                    console.log('📂 Sessione caricata per:', session.user.name);
                    return true;
                }
            } catch (error) {
                console.error('❌ Errore caricamento sessione:', error);
            }
        }
        return false;
    }
    
    // Clear session
    clearSession() {
        localStorage.removeItem(this.sessionKey);
        this.currentUser = null;
        this.currentRoom = null;
        console.log('🗑️ Sessione cancellata');
    }
    
    // Show game interface
    showGameInterface() {
        const loginScreen = document.getElementById('loginScreen');
        const gameInterface = document.getElementById('gameInterface');
        
        if (loginScreen) loginScreen.style.display = 'none';
        if (gameInterface) {
            gameInterface.style.display = 'flex';
            gameInterface.classList.add('fade-in');
        }
        
        console.log('🎮 Interfaccia gioco mostrata');
    }
    
    // Show login screen
    showLoginScreen() {
        const gameInterface = document.getElementById('gameInterface');
        const loginScreen = document.getElementById('loginScreen');
        
        if (gameInterface) gameInterface.style.display = 'none';
        if (loginScreen) {
            loginScreen.style.display = 'flex';
            loginScreen.classList.add('fade-in');
        }
        
        console.log('🔐 Schermata login mostrata');
    }
    
    // Show error message
    showError(message) {
        console.log('❌ Errore login:', message);
        
        // Create error element if it doesn't exist
        let errorElement = document.getElementById('loginError');
        if (!errorElement) {
            errorElement = document.createElement('div');
            errorElement.id = 'loginError';
            errorElement.style.cssText = `
                color: #ff6b6b;
                background: rgba(255, 107, 107, 0.1);
                border: 1px solid #ff6b6b;
                padding: 0.75rem;
                border-radius: 6px;
                margin-bottom: 1rem;
                font-size: 0.9rem;
                text-align: center;
            `;
            const loginForm = document.getElementById('loginForm');
            const loginFormParent = loginForm?.parentNode;
            if (loginFormParent) {
                loginFormParent.insertBefore(errorElement, loginForm);
            }
        }
        
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        
        // Hide after 5 seconds
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 5000);
    }
    
    // Logout user
    async logout() {
        console.log('👋 Logout utente...');
        
        if (this.currentUser && this.currentRoom) {
            // Remove user from room
            await FirebaseHelper.removeData(`rooms/${this.currentRoom}/users/${this.currentUser.id}`);
        }
        
        this.clearSession();
        this.showLoginScreen();
    }
    
    // Get current user
    getCurrentUser() {
        return this.currentUser;
    }
    
    // Get current room
    getCurrentRoom() {
        return this.currentRoom;
    }
    
    // Check if user is master
    isMaster() {
        return this.currentUser && this.currentUser.role === 'master';
    }
}

export default AuthManager;