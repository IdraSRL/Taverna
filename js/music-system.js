// Music system management - Enhanced synchronization
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
        this.syncFrequency = 1000; // Sync every 1 second for better precision
        this.isSyncing = false;
        this.masterStateCheckInterval = null;
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
        
        // Start sync interval for master
        if (this.authManager.isMaster()) {
            this.startSyncInterval();
            this.startMasterStateCheck();
        }
    }
    
    // Setup event listeners
    setupEventListeners() {
        const playPauseBtn = document.getElementById('playPauseBtn');
        const loopBtn = document.getElementById('loopBtn');
        const volumeSlider = document.getElementById('volumeSlider');
        
        // Playback controls - only for master
        if (this.authManager.isMaster()) {
            if (playPauseBtn) playPauseBtn.addEventListener('click', () => this.togglePlayPause());
            if (loopBtn) loopBtn.addEventListener('click', () => this.toggleLoop());
        }
        
        // Volume control - available for all users (local only)
        if (volumeSlider) {
            volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value / 100));
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
        
        // Prevent seeking for non-masters
        if (!this.authManager.isMaster()) {
            this.audioElement.addEventListener('seeking', (e) => {
                e.preventDefault();
                return false;
            });
        }
    }
    
    // Update master controls visibility
    updateMasterControls() {
        const playPauseBtn = document.getElementById('playPauseBtn');
        const loopBtn = document.getElementById('loopBtn');
        const isMaster = this.authManager.isMaster();
        
        // Show/hide master controls
        if (playPauseBtn) playPauseBtn.style.display = isMaster ? 'block' : 'none';
        if (loopBtn) loopBtn.style.display = isMaster ? 'block' : 'none';
    }
    
    // Start sync interval (Master only)
    startSyncInterval() {
        if (!this.authManager.isMaster()) return;
        
        this.syncInterval = setInterval(() => {
            if (this.currentTrack && !this.isSyncing) {
                this.syncMusicState();
            }
        }, this.syncFrequency);
        
        console.log('🎵 Intervallo sincronizzazione musica avviato');
    }
    
    // Start master state check (Master only)
    startMasterStateCheck() {
        if (!this.authManager.isMaster()) return;
        
        this.masterStateCheckInterval = setInterval(() => {
            if (this.currentTrack && this.audioElement) {
                // Ensure audio element state matches our state
                if (this.isPlaying && this.audioElement.paused) {
                    this.audioElement.play().catch(console.error);
                } else if (!this.isPlaying && !this.audioElement.paused) {
                    this.audioElement.pause();
                }
            }
        }, 500); // Check every 500ms
        
        console.log('🎵 Controllo stato master avviato');
    }
    
    // Stop sync interval
    stopSyncInterval() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
            console.log('🎵 Intervallo sincronizzazione musica fermato');
        }
        
        if (this.masterStateCheckInterval) {
            clearInterval(this.masterStateCheckInterval);
            this.masterStateCheckInterval = null;
            console.log('🎵 Controllo stato master fermato');
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
            if (!this.authManager.isMaster()) {
                this.handleMusicStateUpdate(snapshot);
            }
        });
    }
    
    // Handle music state update (synchronization for players)
    handleMusicStateUpdate(snapshot) {
        if (this.authManager.isMaster() || this.isSyncing) return;
        
        try {
            const musicState = snapshot.val();
            if (!musicState) return;
            
            this.isSyncing = true;
            
            console.log('🎵 Sincronizzazione stato musica:', musicState);
            
            // Sync current track
            if (musicState.currentTrackId && musicState.currentTrackId !== this.currentTrack?.id) {
                this.selectTrackById(musicState.currentTrackId, false); // Don't sync back
            }
            
            // Sync play/pause state with precise timing
            if (musicState.isPlaying !== this.isPlaying) {
                if (musicState.isPlaying && this.audioElement && this.currentTrack) {
                    // Calculate expected current time based on timestamp
                    const timeSinceUpdate = Date.now() - musicState.timestamp;
                    const expectedTime = (musicState.currentTime || 0) + (timeSinceUpdate / 1000);
                    
                    this.audioElement.currentTime = expectedTime;
                    this.audioElement.play().catch(error => {
                        console.error('❌ Errore riproduzione sincronizzata:', error);
                    });
                    this.isPlaying = true;
                } else if (!musicState.isPlaying && this.audioElement) {
                    this.audioElement.pause();
                    this.audioElement.currentTime = musicState.currentTime || 0;
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
            
            // Sync time if playing and significant difference
            if (musicState.isPlaying && this.isPlaying && this.audioElement && musicState.currentTime) {
                const timeSinceUpdate = Date.now() - musicState.timestamp;
                const expectedTime = musicState.currentTime + (timeSinceUpdate / 1000);
                const timeDiff = Math.abs(this.audioElement.currentTime - expectedTime);
                
                if (timeDiff > 2) { // More than 2 seconds difference
                    this.audioElement.currentTime = expectedTime;
                    console.log('🎵 Sincronizzazione tempo audio:', expectedTime);
                }
            }
            
            setTimeout(() => {
                this.isSyncing = false;
            }, 200);
            
        } catch (error) {
            console.error('❌ Errore aggiornamento stato musica:', error);
            this.isSyncing = false;
        }
    }
    
    // Sync music state to Firebase (Master only)
    async syncMusicState() {
        if (!this.authManager.isMaster() || this.isSyncing) return;
        
        const room = this.authManager.getCurrentRoom();
        if (!room) return;
        
        try {
            const musicState = {
                currentTrackId: this.currentTrack?.id || null,
                isPlaying: this.isPlaying,
                isLooping: this.isLooping,
                currentTime: this.audioElement?.currentTime || 0,
                timestamp: Date.now()
            };
            
            await FirebaseHelper.setData(`rooms/${room}/musicState`, musicState);
            
        } catch (error) {
            console.error('❌ Errore sincronizzazione stato musica:', error);
        }
    }
    
    // Handle playlist update
    handlePlaylistUpdate(snapshot) {
        try {
            const playlistData = snapshot.val();
            
            if (!playlistData) {
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
            
        } catch (error) {
            console.error('❌ Errore aggiornamento playlist:', error);
        }
    }
    
    // Select track by ID (Master only or internal sync)
    async selectTrackById(trackId, shouldSync = true) {
        if (!this.authManager.isMaster() && shouldSync) {
            return; // Only master can manually select tracks
        }
        
        const room = this.authManager.getCurrentRoom();
        if (!room) return;
        
        try {
            console.log('🎵 Selezione traccia per ID:', trackId);
            
            // Find track in playlist
            const playlistRef = FirebaseHelper.getRef(`rooms/${room}/playlist`);
            const snapshot = await playlistRef.once('value');
            const playlistData = snapshot.val();
            
            if (!playlistData) return;
            
            let trackData = null;
            let trackKey = null;
            
            for (const [key, track] of Object.entries(playlistData)) {
                if (track.id === trackId) {
                    trackData = track;
                    trackKey = key;
                    break;
                }
            }
            
            if (!trackData) return;
            
            // Update current track
            this.currentTrack = { key: trackKey, ...trackData };
            
            // Load audio
            if (this.audioElement) {
                this.audioElement.src = trackData.url;
                this.audioElement.load();
            }
            
            // Update UI
            this.updateTrackDisplay();
            
            // Enable play button for master
            const playPauseBtn = document.getElementById('playPauseBtn');
            if (this.authManager.isMaster() && playPauseBtn) {
                playPauseBtn.disabled = false;
            }
            
            // Sync state if master
            if (this.authManager.isMaster() && shouldSync) {
                await this.syncMusicState();
            }
            
            console.log('✅ Traccia selezionata:', trackData.title || trackData.name);
            
        } catch (error) {
            console.error('❌ Errore selezione traccia:', error);
        }
    }
    
    // Delete track (Master only)
    async deleteTrack(trackId) {
        if (!this.authManager.isMaster()) {
            console.warn('⚠️ Solo i master possono eliminare tracce');
            return;
        }
        
        if (!confirm('Sei sicuro di voler eliminare questa traccia?')) {
            return;
        }
        
        const room = this.authManager.getCurrentRoom();
        
        try {
            console.log('🗑️ Eliminazione traccia:', trackId);
            
            // Find and get track data
            const playlistRef = FirebaseHelper.getRef(`rooms/${room}/playlist`);
            const snapshot = await playlistRef.once('value');
            const playlistData = snapshot.val();
            
            if (!playlistData) return;
            
            let trackData = null;
            let trackKey = null;
            
            for (const [key, track] of Object.entries(playlistData)) {
                if (track.id === trackId) {
                    trackData = track;
                    trackKey = key;
                    break;
                }
            }
            
            if (!trackData) return;
            
            // Delete file from server
            if (trackData.filename) {
                const response = await fetch('php/delete.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        filename: trackData.filename,
                        room: room,
                        type: 'music'
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
            if (this.currentTrack && this.currentTrack.id === trackId) {
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
    
    // Set volume (Available for all users - local only)
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        if (this.audioElement) {
            this.audioElement.volume = this.volume;
        }
        
        const volumeSlider = document.getElementById('volumeSlider');
        if (volumeSlider) {
            volumeSlider.value = this.volume * 100;
        }
        
        console.log('🔊 Volume locale impostato:', this.volume);
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
            trackName.textContent = this.currentTrack.title || this.currentTrack.name;
            
            const currentTime = this.audioElement?.currentTime || 0;
            const duration = this.audioElement?.duration || 0;
            
            trackTime.textContent = `${this.formatTime(currentTime)} / ${this.formatTime(duration)}`;
        } else if (trackName && trackTime) {
            trackName.textContent = 'Nessuna traccia selezionata';
            trackTime.textContent = '--:-- / --:--';
        }
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
        
        this.stopSyncInterval();
        
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.src = '';
        }
    }
}

export default MusicSystem;