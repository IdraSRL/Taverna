// Music system management
import FirebaseHelper from './firebase.js';

export class MusicSystem {
    constructor(authManager) {
        this.authManager = authManager;
        this.playlistListener = null;
        this.musicStateListener = null;
        this.currentTrack = null;
        this.isPlaying = false;
        this.isLooping = false;
        this.volume = 0.5;
        this.audioElement = null;
        this.syncInterval = null;
        this.lastSyncTime = 0;
    }
    
    // Initialize music system
    init() {
        console.log('🎵 Inizializzazione sistema musica...');
        this.audioElement = document.getElementById('musicPlayer');
        this.setupEventListeners();
        this.setupAudioEvents();
        this.listenToPlaylist();
        this.listenToMusicState();
        this.updateMasterControls();
    }
    
    // Setup event listeners
    setupEventListeners() {
        const playPauseBtn = document.getElementById('playPauseBtn');
        const loopBtn = document.getElementById('loopBtn');
        const volumeSlider = document.getElementById('volumeSlider');
        const uploadBtn = document.getElementById('uploadMusicBtn');
        const musicFile = document.getElementById('musicFile');
        
        // Playback controls - only for master
        if (this.authManager.isMaster()) {
            if (playPauseBtn) playPauseBtn.addEventListener('click', () => this.togglePlayPause());
            if (loopBtn) loopBtn.addEventListener('click', () => this.toggleLoop());
        }
        
        // Volume control - available for all users
        if (volumeSlider) {
            volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value / 100));
        }
        
        // Upload controls (Master only)
        if (this.authManager.isMaster()) {
            if (uploadBtn) uploadBtn.addEventListener('click', () => musicFile.click());
            if (musicFile) musicFile.addEventListener('change', (e) => this.handleFileUpload(e));
        }
        
        console.log('✅ Event listeners musica configurati');
    }
    
    // Setup audio events
    setupAudioEvents() {
        if (!this.audioElement) return;
        
        this.audioElement.addEventListener('loadedmetadata', () => {
            this.updateTrackDisplay();
        });
        
        this.audioElement.addEventListener('timeupdate', () => {
            this.updateTrackDisplay();
        });
        
        this.audioElement.addEventListener('ended', () => {
            if (this.isLooping) {
                this.audioElement.currentTime = 0;
                this.audioElement.play();
            } else {
                this.isPlaying = false;
                this.updatePlayPauseButton();
                if (this.authManager.isMaster()) {
                    this.syncMusicState();
                }
            }
        });
        
        this.audioElement.addEventListener('error', (e) => {
            console.error('❌ Errore audio:', e);
            this.isPlaying = false;
            this.updatePlayPauseButton();
        });
    }
    
    // Update master controls visibility
    updateMasterControls() {
        const uploadSection = document.getElementById('musicUpload');
        const playPauseBtn = document.getElementById('playPauseBtn');
        const loopBtn = document.getElementById('loopBtn');
        const isMaster = this.authManager.isMaster();
        
        if (uploadSection) uploadSection.style.display = isMaster ? 'block' : 'none';
        
        // Hide play/pause and loop controls for players
        if (!isMaster) {
            if (playPauseBtn) playPauseBtn.style.display = 'none';
            if (loopBtn) loopBtn.style.display = 'none';
        }
    }
    
    // Handle file upload
    async handleFileUpload(event) {
        if (!this.authManager.isMaster()) {
            alert('Solo il master può caricare musica.');
            return;
        }
        
        const file = event.target.files[0];
        if (!file) return;
        
        // Validate file
        if (!file.type.startsWith('audio/')) {
            alert('Per favore seleziona un file audio valido.');
            return;
        }
        
        if (file.size > 100 * 1024 * 1024) { // 100MB
            alert('Il file è troppo grande. Massimo 100MB.');
            return;
        }
        
        const uploadBtn = document.getElementById('uploadMusicBtn');
        if (uploadBtn) {
            uploadBtn.classList.add('loading');
            uploadBtn.disabled = true;
        }
        
        try {
            console.log('📤 Caricamento musica:', file.name);
            
            // Create FormData for upload
            const formData = new FormData();
            formData.append('music', file);
            formData.append('room', this.authManager.getCurrentRoom());
            
            // Upload file to server
            const response = await fetch('php/upload.php', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Add to Firebase playlist
                const trackData = {
                    id: FirebaseHelper.generateUserId(),
                    title: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
                    filename: result.filename,
                    url: result.url,
                    duration: 0, // Will be updated when loaded
                    uploadedBy: this.authManager.getCurrentUser().name,
                    timestamp: FirebaseHelper.getTimestamp()
                };
                
                const room = this.authManager.getCurrentRoom();
                await FirebaseHelper.pushData(`rooms/${room}/playlist`, trackData);
                
                // Clear file input
                event.target.value = '';
                
                console.log('✅ Musica caricata con successo');
                
            } else {
                console.error('❌ Errore caricamento musica:', result.error);
                alert('Errore durante il caricamento: ' + result.error);
            }
            
        } catch (error) {
            console.error('❌ Errore upload musica:', error);
            alert('Errore durante il caricamento del file.');
        } finally {
            if (uploadBtn) {
                uploadBtn.classList.remove('loading');
                uploadBtn.disabled = false;
            }
        }
    }
    
    // Listen to playlist
    listenToPlaylist() {
        const room = this.authManager.getCurrentRoom();
        if (!room) {
            console.error('❌ Nessuna stanza per ascoltare playlist');
            return;
        }
        
        console.log('👂 Ascolto playlist per stanza:', room);
        
        this.playlistListener = FirebaseHelper.listenToData(`rooms/${room}/playlist`, (snapshot) => {
            this.handlePlaylistUpdate(snapshot);
        });
    }
    
    // Listen to music state (for synchronization)
    listenToMusicState() {
        const room = this.authManager.getCurrentRoom();
        if (!room) {
            console.error('❌ Nessuna stanza per ascoltare stato musica');
            return;
        }
        
        console.log('👂 Ascolto stato musica per stanza:', room);
        
        this.musicStateListener = FirebaseHelper.listenToData(`rooms/${room}/musicState`, (snapshot) => {
            this.handleMusicStateUpdate(snapshot);
        });
    }
    
    // Handle music state update (synchronization)
    handleMusicStateUpdate(snapshot) {
        if (this.authManager.isMaster()) return; // Master doesn't sync from others
        
        try {
            const musicState = snapshot.val();
            if (!musicState) return;
            
            console.log('🎵 Aggiornamento stato musica:', musicState);
            
            // Sync current track
            if (musicState.currentTrackKey && musicState.currentTrackKey !== this.currentTrack?.key) {
                this.selectTrackFromState(musicState.currentTrackKey);
            }
            
            // Sync play/pause state
            if (musicState.isPlaying !== this.isPlaying) {
                if (musicState.isPlaying && this.audioElement && this.currentTrack) {
                    this.audioElement.currentTime = musicState.currentTime || 0;
                    this.audioElement.play().catch(error => {
                        console.error('❌ Errore riproduzione sincronizzata:', error);
                    });
                    this.isPlaying = true;
                } else if (!musicState.isPlaying && this.audioElement) {
                    this.audioElement.pause();
                    this.isPlaying = false;
                }
                this.updatePlayPauseButton();
            }
            
            // Sync loop state
            if (musicState.isLooping !== this.isLooping) {
                this.isLooping = musicState.isLooping;
                if (this.audioElement) {
                    this.audioElement.loop = this.isLooping;
                }
                this.updateLoopButton();
            }
            
            // Sync time if playing and not too far off
            if (musicState.isPlaying && this.isPlaying && this.audioElement && musicState.currentTime) {
                const timeDiff = Math.abs(this.audioElement.currentTime - musicState.currentTime);
                if (timeDiff > 2) { // More than 2 seconds difference
                    this.audioElement.currentTime = musicState.currentTime;
                    console.log('🎵 Sincronizzazione tempo audio:', musicState.currentTime);
                }
            }
            
        } catch (error) {
            console.error('❌ Errore aggiornamento stato musica:', error);
        }
    }
    
    // Select track from state (for synchronization)
    async selectTrackFromState(trackKey) {
        const room = this.authManager.getCurrentRoom();
        if (!room) return;
        
        try {
            // Get track data
            const trackRef = FirebaseHelper.getRef(`rooms/${room}/playlist/${trackKey}`);
            const snapshot = await trackRef.once('value');
            const trackData = snapshot.val();
            
            if (!trackData) return;
            
            // Update current track
            this.currentTrack = { key: trackKey, ...trackData };
            
            // Load audio
            if (this.audioElement) {
                this.audioElement.src = trackData.url;
                this.audioElement.load();
            }
            
            // Update UI
            this.updatePlaylistDisplay();
            this.updateTrackDisplay();
            
            console.log('🎵 Traccia sincronizzata:', trackData.title);
            
        } catch (error) {
            console.error('❌ Errore selezione traccia da stato:', error);
        }
    }
    
    // Sync music state to Firebase (Master only)
    async syncMusicState() {
        if (!this.authManager.isMaster()) return;
        
        const room = this.authManager.getCurrentRoom();
        if (!room) return;
        
        try {
            const musicState = {
                currentTrackKey: this.currentTrack?.key || null,
                isPlaying: this.isPlaying,
                isLooping: this.isLooping,
                currentTime: this.audioElement?.currentTime || 0,
                timestamp: Date.now()
            };
            
            await FirebaseHelper.setData(`rooms/${room}/musicState`, musicState);
            console.log('🎵 Stato musica sincronizzato:', musicState);
            
        } catch (error) {
            console.error('❌ Errore sincronizzazione stato musica:', error);
        }
    }
    
    // Handle playlist update
    handlePlaylistUpdate(snapshot) {
        try {
            const playlistData = snapshot.val();
            const playlistContainer = document.getElementById('playlist');
            
            if (!playlistContainer) {
                console.error('❌ Container playlist non trovato');
                return;
            }
            
            if (!playlistData) {
                playlistContainer.innerHTML = '<div style="text-align: center; color: #cd853f; padding: 1rem; font-style: italic;">Nessuna traccia nella playlist</div>';
                console.log('🎵 Nessuna traccia nella playlist');
                return;
            }
            
            // Convert to array and sort by timestamp
            const tracks = Object.entries(playlistData).map(([key, track]) => ({
                key,
                ...track
            })).sort((a, b) => {
                const timeA = typeof a.timestamp === 'number' ? a.timestamp : 0;
                const timeB = typeof b.timestamp === 'number' ? b.timestamp : 0;
                return timeA - timeB;
            });
            
            console.log(`🎵 Aggiornamento playlist: ${tracks.length} tracce`);
            
            playlistContainer.innerHTML = '';
            tracks.forEach(track => {
                const trackElement = this.createTrackElement(track);
                playlistContainer.appendChild(trackElement);
            });
            
        } catch (error) {
            console.error('❌ Errore aggiornamento playlist:', error);
        }
    }
    
    // Create track element
    createTrackElement(track) {
        const trackDiv = document.createElement('div');
        trackDiv.className = 'playlist-item';
        trackDiv.setAttribute('data-track-key', track.key);
        
        if (this.currentTrack && this.currentTrack.key === track.key) {
            trackDiv.classList.add('active');
        }
        
        const isMaster = this.authManager.isMaster();
        
        trackDiv.innerHTML = `
            <div class="track-info">
                <div class="track-title">${track.title}</div>
                <div class="track-duration">${this.formatDuration(track.duration)}</div>
            </div>
            <div class="track-actions">
                ${isMaster ? `<button class="track-btn" onclick="window.musicSystem.selectTrack('${track.key}')">▶️</button>` : ''}
                ${isMaster ? `<button class="track-btn" onclick="window.musicSystem.deleteTrack('${track.key}')">🗑️</button>` : ''}
            </div>
        `;
        
        return trackDiv;
    }
    
    // Select track (Master only)
    async selectTrack(trackKey) {
        if (!this.authManager.isMaster()) {
            alert('Solo il master può selezionare le tracce.');
            return;
        }
        
        const room = this.authManager.getCurrentRoom();
        if (!room) return;
        
        try {
            console.log('🎵 Selezione traccia:', trackKey);
            
            // Get track data
            const trackRef = FirebaseHelper.getRef(`rooms/${room}/playlist/${trackKey}`);
            const snapshot = await trackRef.once('value');
            const trackData = snapshot.val();
            
            if (!trackData) return;
            
            // Update current track
            this.currentTrack = { key: trackKey, ...trackData };
            
            // Load audio
            if (this.audioElement) {
                this.audioElement.src = trackData.url;
                this.audioElement.load();
            }
            
            // Update UI
            this.updatePlaylistDisplay();
            this.updateTrackDisplay();
            
            // Enable play button
            const playPauseBtn = document.getElementById('playPauseBtn');
            if (this.authManager.isMaster() && playPauseBtn) {
                playPauseBtn.disabled = false;
            }
            
            // Sync state
            await this.syncMusicState();
            
            console.log('✅ Traccia selezionata:', trackData.title);
            
        } catch (error) {
            console.error('❌ Errore selezione traccia:', error);
        }
    }
    
    // Delete track (Master only)
    async deleteTrack(trackKey) {
        if (!this.authManager.isMaster()) {
            console.warn('⚠️ Solo i master possono eliminare tracce');
            return;
        }
        
        if (!confirm('Sei sicuro di voler eliminare questa traccia?')) {
            return;
        }
        
        const room = this.authManager.getCurrentRoom();
        
        try {
            console.log('🗑️ Eliminazione traccia:', trackKey);
            
            // Get track data for file deletion
            const trackRef = FirebaseHelper.getRef(`rooms/${room}/playlist/${trackKey}`);
            const snapshot = await trackRef.once('value');
            const trackData = snapshot.val();
            
            if (trackData && trackData.filename) {
                // Delete file from server
                const response = await fetch('php/delete.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        filename: trackData.filename,
                        room: room
                    })
                });
                
                const result = await response.json();
                if (!result.success) {
                    console.warn('⚠️ Fallimento eliminazione file:', result.error);
                }
            }
            
            // Remove from Firebase
            await FirebaseHelper.removeData(`rooms/${room}/playlist/${trackKey}`);
            
            // If this was the current track, stop playback
            if (this.currentTrack && this.currentTrack.key === trackKey) {
                if (this.audioElement) {
                    this.audioElement.pause();
                    this.audioElement.src = '';
                }
                this.currentTrack = null;
                this.isPlaying = false;
                this.updatePlayPauseButton();
                this.updateTrackDisplay();
                await this.syncMusicState();
            }
            
            console.log('✅ Traccia eliminata');
            
        } catch (error) {
            console.error('❌ Errore eliminazione traccia:', error);
        }
    }
    
    // Toggle play/pause (Master only)
    async togglePlayPause() {
        if (!this.authManager.isMaster()) {
            return;
        }
        
        if (!this.currentTrack || !this.audioElement) return;
        
        console.log('🎵 Toggle play/pause, stato attuale:', this.isPlaying);
        
        if (this.isPlaying) {
            this.audioElement.pause();
            this.isPlaying = false;
        } else {
            try {
                await this.audioElement.play();
                this.isPlaying = true;
            } catch (error) {
                console.error('❌ Errore riproduzione:', error);
                this.isPlaying = false;
            }
        }
        
        this.updatePlayPauseButton();
        await this.syncMusicState();
        
        console.log('🎵 Nuovo stato riproduzione:', this.isPlaying);
    }
    
    // Toggle loop (Master only)
    async toggleLoop() {
        if (!this.authManager.isMaster()) {
            return;
        }
        
        this.isLooping = !this.isLooping;
        if (this.audioElement) {
            this.audioElement.loop = this.isLooping;
        }
        
        this.updateLoopButton();
        await this.syncMusicState();
        
        console.log('🎵 Loop:', this.isLooping);
    }
    
    // Set volume (Available for all users)
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        if (this.audioElement) {
            this.audioElement.volume = this.volume;
        }
        
        const volumeSlider = document.getElementById('volumeSlider');
        if (volumeSlider) {
            volumeSlider.value = this.volume * 100;
        }
        
        console.log('🔊 Volume impostato:', this.volume);
    }
    
    // Update play/pause button
    updatePlayPauseButton() {
        const playPauseBtn = document.getElementById('playPauseBtn');
        if (this.authManager.isMaster() && playPauseBtn) {
            playPauseBtn.textContent = this.isPlaying ? '⏸️' : '▶️';
        }
    }
    
    // Update loop button
    updateLoopButton() {
        const loopBtn = document.getElementById('loopBtn');
        if (this.authManager.isMaster() && loopBtn) {
            loopBtn.style.background = this.isLooping ? '#d4af37' : '#8b4513';
            loopBtn.style.color = this.isLooping ? '#2c1810' : '#d4af37';
        }
    }
    
    // Update track display
    updateTrackDisplay() {
        const currentTrackElement = document.getElementById('currentTrack');
        if (!currentTrackElement) return;
        
        const trackName = currentTrackElement.querySelector('.track-name');
        const trackTime = currentTrackElement.querySelector('.track-time');
        
        if (this.currentTrack && trackName && trackTime) {
            trackName.textContent = this.currentTrack.title;
            
            const currentTime = this.audioElement?.currentTime || 0;
            const duration = this.audioElement?.duration || 0;
            
            trackTime.textContent = `${this.formatTime(currentTime)} / ${this.formatTime(duration)}`;
        } else if (trackName && trackTime) {
            trackName.textContent = 'Nessuna traccia selezionata';
            trackTime.textContent = '--:-- / --:--';
        }
    }
    
    // Update playlist display
    updatePlaylistDisplay() {
        const playlistItems = document.querySelectorAll('.playlist-item');
        playlistItems.forEach(item => {
            const trackKey = item.getAttribute('data-track-key');
            if (this.currentTrack && trackKey === this.currentTrack.key) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }
    
    // Format time in MM:SS
    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '--:--';
        
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
    // Format duration
    formatDuration(duration) {
        if (!duration) return '--:--';
        return this.formatTime(duration);
    }
    
    // Cleanup
    cleanup() {
        console.log('🧹 Pulizia sistema musica...');
        
        if (this.playlistListener) {
            FirebaseHelper.stopListening(this.playlistListener);
            this.playlistListener = null;
        }
        
        if (this.musicStateListener) {
            FirebaseHelper.stopListening(this.musicStateListener);
            this.musicStateListener = null;
        }
        
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.src = '';
        }
    }
}

export default MusicSystem;