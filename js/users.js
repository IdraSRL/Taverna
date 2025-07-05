// User management and presence system
import FirebaseHelper from './firebase.js';

export class UserManager {
    constructor(authManager) {
        this.authManager = authManager;
        this.users = new Map();
        this.heartbeatInterval = null;
        this.usersListener = null;
        this.heartbeatFrequency = 30000; // 30 seconds
    }
    
    // Initialize user management
    init() {
        console.log('👥 Inizializzazione gestione utenti...');
        this.startHeartbeat();
        this.listenToUsers();
    }
    
    // Start heartbeat to maintain presence
    startHeartbeat() {
        console.log('💓 Avvio heartbeat utente...');
        
        this.heartbeatInterval = setInterval(() => {
            this.updatePresence();
        }, this.heartbeatFrequency);
        
        // Initial presence update
        this.updatePresence();
        
        // Handle page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.handleUserInactive();
            } else {
                this.handleUserActive();
            }
        });
        
        // Handle window beforeunload
        window.addEventListener('beforeunload', () => {
            this.handleUserDisconnect();
        });
    }
    
    // Stop heartbeat
    stopHeartbeat() {
        console.log('💔 Stop heartbeat utente...');
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
    
    // Update user presence
    async updatePresence() {
        const user = this.authManager.getCurrentUser();
        const room = this.authManager.getCurrentRoom();
        
        if (user && room) {
            try {
                await FirebaseHelper.updateData(`rooms/${room}/users/${user.id}`, {
                    lastSeen: FirebaseHelper.getTimestamp(),
                    status: 'online'
                });
                console.log('💓 Presenza aggiornata per:', user.name);
            } catch (error) {
                console.error('❌ Errore aggiornamento presenza:', error);
            }
        }
    }
    
    // Handle user becoming inactive
    async handleUserInactive() {
        const user = this.authManager.getCurrentUser();
        const room = this.authManager.getCurrentRoom();
        
        if (user && room) {
            try {
                await FirebaseHelper.updateData(`rooms/${room}/users/${user.id}`, {
                    status: 'away',
                    lastSeen: FirebaseHelper.getTimestamp()
                });
                console.log('😴 Utente inattivo:', user.name);
            } catch (error) {
                console.error('❌ Errore aggiornamento stato inattivo:', error);
            }
        }
    }
    
    // Handle user becoming active
    async handleUserActive() {
        const user = this.authManager.getCurrentUser();
        const room = this.authManager.getCurrentRoom();
        
        if (user && room) {
            try {
                await FirebaseHelper.updateData(`rooms/${room}/users/${user.id}`, {
                    status: 'online',
                    lastSeen: FirebaseHelper.getTimestamp()
                });
                console.log('😊 Utente attivo:', user.name);
            } catch (error) {
                console.error('❌ Errore aggiornamento stato attivo:', error);
            }
        }
    }
    
    // Handle user disconnect
    async handleUserDisconnect() {
        const user = this.authManager.getCurrentUser();
        const room = this.authManager.getCurrentRoom();
        
        if (user && room) {
            try {
                await FirebaseHelper.updateData(`rooms/${room}/users/${user.id}`, {
                    status: 'offline',
                    lastSeen: FirebaseHelper.getTimestamp()
                });
                console.log('👋 Utente disconnesso:', user.name);
            } catch (error) {
                console.error('❌ Errore aggiornamento disconnessione:', error);
            }
        }
    }
    
    // Listen to users in current room
    listenToUsers() {
        const room = this.authManager.getCurrentRoom();
        if (!room) {
            console.error('❌ Nessuna stanza per ascoltare utenti');
            return;
        }
        
        console.log('👂 Ascolto utenti per stanza:', room);
        
        this.usersListener = FirebaseHelper.listenToData(`rooms/${room}/users`, (snapshot) => {
            this.handleUsersUpdate(snapshot);
        });
    }
    
    // Stop listening to users
    stopListeningToUsers() {
        console.log('🔇 Stop ascolto utenti...');
        if (this.usersListener) {
            FirebaseHelper.stopListening(this.usersListener);
            this.usersListener = null;
        }
    }
    
    // Handle users update
    handleUsersUpdate(snapshot) {
        try {
            const usersData = snapshot.val();
            const previousUserCount = this.users.size;
            this.users.clear();
            
            if (usersData) {
                Object.keys(usersData).forEach(userId => {
                    const user = usersData[userId];
                    if (user && user.name && user.id) { // Ensure user has required properties
                        this.users.set(userId, user);
                    }
                });
            }
            
            console.log(`👥 Aggiornamento utenti: ${this.users.size} utenti connessi`);
            
            // Log user changes
            if (this.users.size !== previousUserCount) {
                console.log('📊 Cambiamento numero utenti:', previousUserCount, '->', this.users.size);
            }
            
            this.updateUsersDisplay();
            this.cleanupOfflineUsers();
            
        } catch (error) {
            console.error('❌ Errore aggiornamento utenti:', error);
        }
    }
    
    // Update users display in header
    updateUsersDisplay() {
        const usersList = document.getElementById('usersList');
        if (!usersList) {
            console.error('❌ Lista utenti non trovata');
            return;
        }
        
        usersList.innerHTML = '';
        
        // Sort users: masters first, then by name (with null check)
        const sortedUsers = Array.from(this.users.values()).sort((a, b) => {
            // Ensure both users have names
            if (!a.name || !b.name) return 0;
            
            if (a.role === 'master' && b.role !== 'master') return -1;
            if (b.role === 'master' && a.role !== 'master') return 1;
            return a.name.localeCompare(b.name);
        });
        
        console.log('👥 Visualizzazione utenti ordinati:', sortedUsers.map(u => `${u.name} (${u.role})`));
        
        sortedUsers.forEach(user => {
            if (user && user.name && user.id) { // Double check before creating element
                const userElement = this.createUserElement(user);
                usersList.appendChild(userElement);
            }
        });
    }
    
    // Create user element for display
    createUserElement(user) {
        const userItem = document.createElement('div');
        userItem.className = `user-item ${user.role === 'master' ? 'master' : ''}`;
        userItem.setAttribute('data-user-id', user.id);
        
        // Create avatar
        const avatar = document.createElement('div');
        avatar.className = 'user-avatar';
        
        if (user.avatar) {
            avatar.style.backgroundImage = `url(${user.avatar})`;
        } else {
            // Default avatar based on role
            avatar.textContent = user.role === 'master' ? '👑' : '⚔️';
        }
        
        // Create name element
        const nameElement = document.createElement('span');
        nameElement.className = 'user-name';
        nameElement.textContent = user.name || 'Utente senza nome';
        
        // Add status indicator
        const statusClass = this.getStatusClass(user);
        userItem.classList.add(statusClass);
        
        userItem.appendChild(avatar);
        userItem.appendChild(nameElement);
        
        console.log('👤 Creato elemento utente:', user.name, statusClass);
        
        return userItem;
    }
    
    // Get status class for user
    getStatusClass(user) {
        if (!user.status || user.status === 'offline') {
            return 'offline';
        }
        
        // Check if user is really online (last seen within 2 minutes)
        if (user.lastSeen && typeof user.lastSeen === 'number') {
            const now = Date.now();
            const lastSeen = user.lastSeen;
            const timeDiff = now - lastSeen;
            
            if (timeDiff > 2 * 60 * 1000) { // 2 minutes
                return 'offline';
            }
        }
        
        return user.status || 'online';
    }
    
    // Clean up offline users (remove after 5 minutes)
    async cleanupOfflineUsers() {
        const room = this.authManager.getCurrentRoom();
        if (!room) return;
        
        const now = Date.now();
        const offlineThreshold = 5 * 60 * 1000; // 5 minutes
        
        for (const [userId, user] of this.users) {
            if (user.lastSeen && typeof user.lastSeen === 'number') {
                const timeDiff = now - user.lastSeen;
                
                if (timeDiff > offlineThreshold) {
                    try {
                        console.log('🗑️ Rimozione utente offline:', user.name);
                        await FirebaseHelper.removeData(`rooms/${room}/users/${userId}`);
                    } catch (error) {
                        console.error('❌ Errore rimozione utente offline:', error);
                    }
                }
            }
        }
    }
    
    // Get all users
    getAllUsers() {
        return Array.from(this.users.values());
    }
    
    // Get user by ID
    getUserById(userId) {
        return this.users.get(userId);
    }
    
    // Get masters
    getMasters() {
        return Array.from(this.users.values()).filter(user => user.role === 'master');
    }
    
    // Get players
    getPlayers() {
        return Array.from(this.users.values()).filter(user => user.role === 'player');
    }
    
    // Get online users
    getOnlineUsers() {
        return Array.from(this.users.values()).filter(user => {
            const statusClass = this.getStatusClass(user);
            return statusClass === 'online' || statusClass === 'away';
        });
    }
    
    // Cleanup when leaving
    cleanup() {
        console.log('🧹 Pulizia gestione utenti...');
        this.stopHeartbeat();
        this.stopListeningToUsers();
        this.handleUserDisconnect();
    }
}

export default UserManager;