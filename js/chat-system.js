// Chat system management
import FirebaseHelper from './firebase.js';

export class ChatSystem {
    constructor(authManager) {
        this.authManager = authManager;
        this.messagesListener = null;
        this.maxMessages = 100;
    }
    
    // Initialize chat system
    init() {
        console.log('🗨️ Inizializzazione sistema chat...');
        this.setupEventListeners();
        this.listenToMessages();
    }
    
    // Setup event listeners
    setupEventListeners() {
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendMessageBtn');
        
        if (!messageInput || !sendBtn) {
            console.error('❌ Elementi chat non trovati');
            return;
        }
        
        // Send message on button click
        sendBtn.addEventListener('click', () => this.sendMessage());
        
        // Send message on Enter key
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Auto-resize input and character limit feedback
        messageInput.addEventListener('input', (e) => {
            this.updateInputState(e.target);
        });
        
        console.log('✅ Event listeners chat configurati');
    }
    
    // Update input state
    updateInputState(input) {
        const sendBtn = document.getElementById('sendMessageBtn');
        const message = input.value.trim();
        
        // Enable/disable send button
        sendBtn.disabled = message.length === 0;
        
        // Visual feedback for character limit
        if (message.length > 450) {
            input.style.borderColor = '#ff6b6b';
        } else {
            input.style.borderColor = '#8b4513';
        }
    }
    
    // Send message
    async sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();
        
        if (!message) return;
        
        const user = this.authManager.getCurrentUser();
        const room = this.authManager.getCurrentRoom();
        
        if (!user || !room) {
            console.error('❌ Utente o stanza non disponibili per invio messaggio');
            return;
        }
        
        const sendBtn = document.getElementById('sendMessageBtn');
        sendBtn.classList.add('loading');
        sendBtn.disabled = true;
        
        try {
            const messageData = {
                id: FirebaseHelper.generateUserId(),
                userId: user.id,
                userName: user.name,
                userAvatar: user.avatar,
                userRole: user.role,
                message: message,
                timestamp: FirebaseHelper.getTimestamp()
            };
            
            console.log('📤 Invio messaggio:', messageData);
            
            // Save message to Firebase
            await FirebaseHelper.pushData(`rooms/${room}/messages`, messageData);
            
            // Clear input
            messageInput.value = '';
            messageInput.focus();
            
            console.log('✅ Messaggio inviato con successo');
            
        } catch (error) {
            console.error('❌ Errore invio messaggio:', error);
        } finally {
            sendBtn.classList.remove('loading');
            this.updateInputState(messageInput);
        }
    }
    
    // Listen to messages
    listenToMessages() {
        const room = this.authManager.getCurrentRoom();
        if (!room) {
            console.error('❌ Nessuna stanza disponibile per ascoltare messaggi');
            return;
        }
        
        console.log('👂 Ascolto messaggi per stanza:', room);
        
        this.messagesListener = FirebaseHelper.listenToData(`rooms/${room}/messages`, (snapshot) => {
            this.handleMessagesUpdate(snapshot);
        });
    }
    
    // Handle messages update
    handleMessagesUpdate(snapshot) {
        try {
            const messagesData = snapshot.val();
            const messagesContainer = document.getElementById('chatMessages');
            
            if (!messagesContainer) {
                console.error('❌ Container messaggi non trovato');
                return;
            }
            
            if (!messagesData) {
                messagesContainer.innerHTML = '<div class="no-messages">Nessun messaggio ancora...</div>';
                console.log('📭 Nessun messaggio nella chat');
                return;
            }
            
            // Convert to array and sort by timestamp (newest first for display)
            const messages = Object.values(messagesData).sort((a, b) => {
                const timeA = typeof a.timestamp === 'number' ? a.timestamp : 0;
                const timeB = typeof b.timestamp === 'number' ? b.timestamp : 0;
                return timeB - timeA;
            });
            
            // Keep only recent messages
            const recentMessages = messages.slice(0, this.maxMessages);
            
            console.log(`💬 Aggiornamento chat: ${recentMessages.length} messaggi`);
            
            // Check if we need to scroll to bottom (if user was already at bottom)
            const shouldScrollToBottom = this.isScrolledToBottom(messagesContainer);
            
            // Render messages
            messagesContainer.innerHTML = '';
            recentMessages.forEach(message => {
                const messageElement = this.createMessageElement(message);
                messagesContainer.appendChild(messageElement);
            });
            
            // Auto-scroll to bottom if needed
            if (shouldScrollToBottom) {
                this.scrollToBottom(messagesContainer);
            }
            
            // Clean up old messages in Firebase (keep only last 100)
            const currentRoom = this.authManager.getCurrentRoom();
            if (currentRoom) {
                this.cleanupOldMessages(currentRoom, messages);
            }
            
        } catch (error) {
            console.error('❌ Errore aggiornamento messaggi:', error);
        }
    }
    
    // Create message element
    createMessageElement(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';
        
        // Add special styling for master messages
        if (message.userRole === 'master') {
            messageDiv.style.borderLeftColor = '#d4af37';
        }
        
        const timestamp = typeof message.timestamp === 'number' ? 
                         new Date(message.timestamp).toLocaleTimeString('it-IT', { 
                             hour: '2-digit', 
                             minute: '2-digit' 
                         }) : '--:--';
        
        // Escape HTML and convert line breaks
        const escapedMessage = this.escapeHtml(message.message).replace(/\n/g, '<br>');
        
        messageDiv.innerHTML = `
            <div class="message-header">
                <div class="message-avatar" style="${message.userAvatar ? `background-image: url(${message.userAvatar})` : ''}">
                    ${!message.userAvatar ? (message.userRole === 'master' ? '👑' : '⚔️') : ''}
                </div>
                <span class="message-user" style="${message.userRole === 'master' ? 'color: #d4af37;' : ''}">${message.userName}</span>
                ${message.userRole === 'master' ? '<span style="color: #d4af37; font-size: 0.8rem;">👑</span>' : ''}
                <span class="message-time">${timestamp}</span>
            </div>
            <div class="message-text">${escapedMessage}</div>
        `;
        
        // Add pulse animation for new messages
        messageDiv.classList.add('pulse');
        
        return messageDiv;
    }
    
    // Escape HTML to prevent XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Check if scrolled to bottom
    isScrolledToBottom(container) {
        const threshold = 50; // pixels
        return container.scrollTop <= threshold;
    }
    
    // Scroll to bottom
    scrollToBottom(container) {
        container.scrollTop = 0; // Since messages are in reverse order
    }
    
    // Clean up old messages
    async cleanupOldMessages(room, messages) {
        if (messages.length > this.maxMessages) {
            const messagesToDelete = messages.slice(this.maxMessages);
            
            for (const message of messagesToDelete) {
                try {
                    // Find and remove the message by its data
                    const messagesRef = FirebaseHelper.getRoomMessagesRef(room);
                    const snapshot = await messagesRef.once('value');
                    const allMessages = snapshot.val();
                    
                    if (allMessages) {
                        for (const [key, value] of Object.entries(allMessages)) {
                            if (value.id === message.id) {
                                await FirebaseHelper.removeData(`rooms/${room}/messages/${key}`);
                                break;
                            }
                        }
                    }
                } catch (error) {
                    console.error('❌ Errore pulizia messaggio vecchio:', error);
                }
            }
        }
    }
    
    // Get message history
    getMessageHistory() {
        const messagesContainer = document.getElementById('chatMessages');
        const messages = Array.from(messagesContainer.querySelectorAll('.chat-message'));
        
        return messages.map(msg => {
            const user = msg.querySelector('.message-user').textContent;
            const text = msg.querySelector('.message-text').textContent;
            const time = msg.querySelector('.message-time').textContent;
            return { user, text, time };
        });
    }
    
    // Clear chat (Master only)
    async clearChat() {
        const user = this.authManager.getCurrentUser();
        const room = this.authManager.getCurrentRoom();
        
        if (!user || !room || user.role !== 'master') {
            console.warn('⚠️ Solo i master possono cancellare la chat');
            return;
        }
        
        try {
            console.log('🗑️ Cancellazione chat...');
            await FirebaseHelper.removeData(`rooms/${room}/messages`);
            console.log('✅ Chat cancellata');
        } catch (error) {
            console.error('❌ Errore cancellazione chat:', error);
        }
    }
    
    // Cleanup
    cleanup() {
        console.log('🧹 Pulizia sistema chat...');
        if (this.messagesListener) {
            FirebaseHelper.stopListening(this.messagesListener);
            this.messagesListener = null;
        }
    }
}

export default ChatSystem;