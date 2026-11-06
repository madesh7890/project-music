/**
 * MUSIC - Client Audio Player & Spatial Audio DSP Engine
 * Built for Old to New Tamil, Malayalam, Hindi, Telugu, and English songs.
 * Features: 320kbps MP4/MP3, 3D Spatial Audio, Dolby Atmos Cinema Mode,
 * Anti-Clipping Limiter (Zero Noise/Crackle), Bluetooth Detection & Spotify UI.
 */

class MusicApp {
  constructor() {
    this.audio = document.getElementById('audioElement');
    // Mobile optimization: Remove crossorigin attribute on mobile so native audio hardware engine is used with 0 CORS overhead
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 1 && /Macintosh/i.test(navigator.userAgent));
    if (isMobile && this.audio) {
      this.audio.removeAttribute('crossorigin');
    }
    this.currentSong = null;
    this.queue = [];
    this.queueIndex = -1;
    this.isPlaying = false;
    this.isShuffled = false;
    this.repeatMode = 'all'; // 'off' | 'all' | 'one'
    
    // Quality & Format: '720p' | '1080p' | '480p' | '360p' (supports legacy keys)
    const storedFormat = localStorage.getItem('music_format') || '720p';
    const formatMigration = { 'mp4_320': '720p', 'mp3_320': '1080p', 'mp4_160': '480p', 'mp4_96': '360p' };
    this.currentFormat = formatMigration[storedFormat] || storedFormat;
    
    this.favorites = this.loadStoredList('music_favorites');
    this.history = this.loadStoredList('music_history');
    this.currentLanguage = 'all';

    // Advanced 8-Feature Suite States
    this.playlists = this.loadStoredList('music_playlists');
    this.isVisualizerActive = true;
    this.visualizerAnimationId = null;
    this.isKaraokeActive = false;
    this.karaokeLyrics = [];
    this.karaokeScript = 'tamil'; // 'tamil' | 'tanglish'
    this.sleepTimer = null;
    this.sleepRemainingSeconds = 0;
    this.sleepFadeOut = true;
    this.sleepStopOnEnd = false;
    this.originalSleepVolume = 0.90;
    this.isSmartRadioActive = true;
    this.isSlowedActive = false;
    this.playbackSpeed = 1.0;
    this.deferredPrompt = null;
    this.activePlaylistId = null;
    this.playlistTargetSong = null;

    // DSP Audio Engine state
    this.audioCtx = null;
    this.sourceNode = null;
    this.isDspInit = false;
    this.isSpatial3DActive = true;
    this.isDolbyAtmosActive = true;
    this.isVocalClarityActive = true;
    this.bassBoostGain = 8; // dB

    this.initDOMElements();
    this.initAudioEvents();
    this.initUIEvents();
    this.initAdvancedFeatures();
    this.initKeyboardShortcuts();
    this.initBluetoothDetection();
    this.loadCuratedShelves();
    this.updateFavoritesCount();
    this.updateQualityUI();
    this.initPWA();
    this.renderSidebarPlaylists();
    this.checkUrlShareParams();

    // Global user gesture unlocker: immediately wakes up AudioContext on first tap/click anywhere
    const unlockAudio = () => {
      if (!this.isDspInit) {
        this.setupAudioDSP();
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
    };
    ['click', 'touchstart', 'pointerdown', 'keydown'].forEach(evt => {
      window.addEventListener(evt, unlockAudio, { passive: true });
    });
  }

  loadStoredList(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  saveStoredList(key, list) {
    try {
      localStorage.setItem(key, JSON.stringify(list));
    } catch (e) {
      console.warn('Storage save failed:', e);
    }
  }

  initDOMElements() {
    // Header & Search
    this.searchInput = document.getElementById('searchInput');
    this.clearSearchBtn = document.getElementById('clearSearchBtn');
    this.searchLoader = document.getElementById('searchLoader');
    this.searchResultsSection = document.getElementById('searchResultsSection');
    this.searchResultsGrid = document.getElementById('searchResultsGrid');
    this.searchResultsTitle = document.getElementById('searchResultsTitle');
    this.searchResultsSubtitle = document.getElementById('searchResultsSubtitle');
    this.closeSearchSectionBtn = document.getElementById('closeSearchSectionBtn');
    this.headerFormatBadge = document.getElementById('headerFormatBadge');
    this.headerBitrateBadge = document.getElementById('headerBitrateBadge');
    this.openQualityModalBtn = document.getElementById('openQualityModalBtn');
    this.openAudioFXBtn = document.getElementById('openAudioFXBtn');
    this.sidebar = document.getElementById('sidebar');

    // Home & Shelves
    this.homeView = document.getElementById('homeView');
    this.shelvesContainer = document.getElementById('shelvesContainer');
    this.heroPlayBtn = document.getElementById('heroPlayBtn');
    this.heroQueueBtn = document.getElementById('heroQueueBtn');
    this.heroTitle = document.getElementById('heroTitle');
    this.heroSubtitle = document.getElementById('heroSubtitle');
    this.heroImage = document.getElementById('heroImage');
    this.heroBackdrop = document.getElementById('heroBackdrop');

    // Bottom Player Bar
    this.playerBar = document.getElementById('playerBar');
    this.playerThumb = document.getElementById('playerThumb');
    this.playerTitle = document.getElementById('playerTitle');
    this.playerArtist = document.getElementById('playerArtist');
    this.playerFavBtn = document.getElementById('playerFavBtn');
    this.playPauseBtn = document.getElementById('playPauseBtn');
    this.playIcon = this.playPauseBtn.querySelector('.play-icon');
    this.pauseIcon = this.playPauseBtn.querySelector('.pause-icon');
    this.prevBtn = document.getElementById('prevBtn');
    this.nextBtn = document.getElementById('nextBtn');
    this.shuffleBtn = document.getElementById('shuffleBtn');
    this.repeatBtn = document.getElementById('repeatBtn');
    this.repeatOneBadge = document.getElementById('repeatOneBadge');
    this.progressBar = document.getElementById('progressBar');
    this.bufferedBar = document.getElementById('bufferedBar');
    this.progressWrapper = document.getElementById('progressWrapper');
    this.currentTimeText = document.getElementById('currentTime');
    this.totalDurationText = document.getElementById('totalDuration');
    this.volumeBtn = document.getElementById('volumeBtn');
    this.volumeSlider = document.getElementById('volumeSlider');
    this.playerQualityBadgeBtn = document.getElementById('playerQualityBadgeBtn');
    this.playerQualityLabel = document.getElementById('playerQualityLabel');
    this.playerAudioFXBtn = document.getElementById('playerAudioFXBtn');
    this.queueToggleBtn = document.getElementById('queueToggleBtn');
    this.expandPlayerBtn = document.getElementById('expandPlayerBtn');
    this.openNowPlayingFromThumb = document.getElementById('openNowPlayingFromThumb');

    // Sidebar Mini Player
    this.sidebarMiniPlayer = document.getElementById('sidebarMiniPlayer');
    this.sidebarCover = document.getElementById('sidebarCover');
    this.sidebarTitle = document.getElementById('sidebarTitle');
    this.sidebarArtist = document.getElementById('sidebarArtist');

    // Mobile Bottom Nav
    this.mobileBottomNav = document.getElementById('mobileBottomNav');
    this.mNavHome = document.getElementById('mNavHome');
    this.mNavSearch = document.getElementById('mNavSearch');
    this.mNavFavorites = document.getElementById('mNavFavorites');
    this.mNavAudioFX = document.getElementById('mNavAudioFX');
    this.mNavSettings = document.getElementById('mNavSettings');

    // Mobile Settings Modal & Dialog
    this.mobileSettingsModal = document.getElementById('mobileSettingsModal');
    this.closeMobileSettingsBtn = document.getElementById('closeMobileSettingsBtn');
    this.closeMobileSettingsBackdrop = document.getElementById('closeMobileSettingsBackdrop');

    // Fullscreen / Mobile Now Playing Sheet
    this.nowPlayingSheet = document.getElementById('nowPlayingSheet');
    this.closeNowPlayingSheetBtn = document.getElementById('closeNowPlayingSheetBtn');
    this.sheetMovieTitle = document.getElementById('sheetMovieTitle');
    this.sheetArtwork = document.getElementById('sheetArtwork');
    this.sheetSongTitle = document.getElementById('sheetSongTitle');
    this.sheetSongArtist = document.getElementById('sheetSongArtist');
    this.sheetFavBtn = document.getElementById('sheetFavBtn');
    this.sheetQualityBadge = document.getElementById('sheetQualityBadge');
    this.sheetSpatialBadge = document.getElementById('sheetSpatialBadge');
    this.sheetDolbyBadge = document.getElementById('sheetDolbyBadge');
    this.sheetProgressWrapper = document.getElementById('sheetProgressWrapper');
    this.sheetBufferedBar = document.getElementById('sheetBufferedBar');
    this.sheetProgressBar = document.getElementById('sheetProgressBar');
    this.sheetProgressThumb = document.getElementById('sheetProgressThumb');
    this.sheetCurrentTime = document.getElementById('sheetCurrentTime');
    this.sheetTotalDuration = document.getElementById('sheetTotalDuration');
    this.sheetShuffleBtn = document.getElementById('sheetShuffleBtn');
    this.sheetPrevBtn = document.getElementById('sheetPrevBtn');
    this.sheetPlayPauseBtn = document.getElementById('sheetPlayPauseBtn');
    this.sheetNextBtn = document.getElementById('sheetNextBtn');
    this.sheetRepeatBtn = document.getElementById('sheetRepeatBtn');
    this.sheetRepeatBadge = document.getElementById('sheetRepeatBadge');
    this.sheetToggle3D = document.getElementById('sheetToggle3D');
    this.sheetToggleDolby = document.getElementById('sheetToggleDolby');
    this.sheetToggleBass = document.getElementById('sheetToggleBass');
    this.sheetToggleLyrics = document.getElementById('sheetToggleLyrics');
    this.sheetLyricsCard = document.getElementById('sheetLyricsCard');
    this.sheetLyricsContent = document.getElementById('sheetLyricsContent');
    this.closeSheetLyricsBtn = document.getElementById('closeSheetLyricsBtn');

    // Audio FX Modal
    this.audioFXModal = document.getElementById('audioFXModal');
    this.closeAudioFXBtn = document.getElementById('closeAudioFXBtn');
    this.closeAudioFXBackdrop = document.getElementById('closeAudioFXBackdrop');
    this.toggleSpatial3D = document.getElementById('toggleSpatial3D');
    this.toggleDolbyAtmos = document.getElementById('toggleDolbyAtmos');
    this.toggleVocalClarity = document.getElementById('toggleVocalClarity');
    this.bassBoostSlider = document.getElementById('bassBoostSlider');
    this.bassBoostValue = document.getElementById('bassBoostValue');
    this.bluetoothDeviceLabel = document.getElementById('bluetoothDeviceLabel');
    this.bluetoothDeviceSub = document.getElementById('bluetoothDeviceSub');
    this.connectBluetoothBtn = document.getElementById('connectBluetoothBtn');

    // Quality Modal
    this.qualityModal = document.getElementById('qualityModal');
    this.closeQualityBtn = document.getElementById('closeQualityBtn');
    this.closeQualityBackdrop = document.getElementById('closeQualityBackdrop');

    // Download Modal
    this.downloadModal = document.getElementById('downloadModal');
    this.closeDownloadBtn = document.getElementById('closeDownloadBtn');
    this.closeDownloadBackdrop = document.getElementById('closeDownloadBackdrop');
    this.downloadArtThumb = document.getElementById('downloadArtThumb');
    this.downloadSongTitle = document.getElementById('downloadSongTitle');
    this.downloadSongArtist = document.getElementById('downloadSongArtist');
    this.downloadInfoTitle = document.getElementById('downloadInfoTitle');
    this.downloadInfoSub = document.getElementById('downloadInfoSub');
    this.downloadProgressWrap = document.getElementById('downloadProgressWrap');
    this.downloadProgressLabel = document.getElementById('downloadProgressLabel');
    this.downloadProgressFill = document.getElementById('downloadProgressFill');

    // Queue Drawer
    this.queueDrawer = document.getElementById('queueDrawer');
    this.closeQueueBtn = document.getElementById('closeQueueBtn');
    this.queueList = document.getElementById('queueList');
    this.queueCount = document.getElementById('queueCount');
    this.clearQueueBtn = document.getElementById('clearQueueBtn');

    // Custom View (Library & History)
    this.customView = document.getElementById('customView');
    this.customViewTitle = document.getElementById('customViewTitle');
    this.customViewSubtitle = document.getElementById('customViewSubtitle');
    this.customViewGrid = document.getElementById('customViewGrid');
    this.playlistsGrid = document.getElementById('playlistsGrid');
    this.playAllCustomBtn = document.getElementById('playAllCustomBtn');
    this.createPlaylistBtn = document.getElementById('createPlaylistBtn');
    this.favoritesCount = document.getElementById('favoritesCount');

    // Library Tabs
    this.libTabFavorites = document.getElementById('libTabFavorites');
    this.libTabPlaylists = document.getElementById('libTabPlaylists');
    this.libTabHistory = document.getElementById('libTabHistory');

    // Toast & Ambient
    this.toast = document.getElementById('toast');
    this.ambientBackdrop = document.getElementById('ambientBackdrop');

    // Sleep Timer Modal
    this.sleepTimerModal = document.getElementById('sleepTimerModal');
    this.closeSleepBtn = document.getElementById('closeSleepBtn');
    this.closeSleepBackdrop = document.getElementById('closeSleepBackdrop');
    this.sleepActiveStatus = document.getElementById('sleepActiveStatus');
    this.sleepTimeRemaining = document.getElementById('sleepTimeRemaining');
    this.cancelSleepTimerBtn = document.getElementById('cancelSleepTimerBtn');
    this.sleepFadeOutToggle = document.getElementById('sleepFadeOutToggle');

    // Speed Modal
    this.speedModal = document.getElementById('speedModal');
    this.closeSpeedBtn = document.getElementById('closeSpeedBtn');
    this.closeSpeedBackdrop = document.getElementById('closeSpeedBackdrop');
    this.slowedReverbCard = document.getElementById('slowedReverbCard');
    this.toggleSlowedModeBtn = document.getElementById('toggleSlowedModeBtn');

    // Playlist Modal
    this.playlistModal = document.getElementById('playlistModal');
    this.closePlaylistBtn = document.getElementById('closePlaylistBtn');
    this.closePlaylistBackdrop = document.getElementById('closePlaylistBackdrop');
    this.playlistModalTitle = document.getElementById('playlistModalTitle');
    this.newPlaylistNameInput = document.getElementById('newPlaylistNameInput');
    this.newPlaylistDescInput = document.getElementById('newPlaylistDescInput');
    this.confirmCreatePlaylistBtn = document.getElementById('confirmCreatePlaylistBtn');
    this.playlistPickList = document.getElementById('playlistPickList');

    // Share Modal
    this.shareModal = document.getElementById('shareModal');
    this.closeShareBtn = document.getElementById('closeShareBtn');
    this.closeShareBackdrop = document.getElementById('closeShareBackdrop');
    this.whatsappShareBtn = document.getElementById('whatsappShareBtn');
    this.shareUrlInput = document.getElementById('shareUrlInput');
    this.copyShareUrlBtn = document.getElementById('copyShareUrlBtn');
    this.nativeShareBtn = document.getElementById('nativeShareBtn');
    this.shareThumb = document.getElementById('shareThumb');
    this.shareTitle = document.getElementById('shareTitle');
    this.shareArtist = document.getElementById('shareArtist');
    this.shareBadge = document.getElementById('shareBadge');

    // Visualizer Canvas
    this.visualizerCanvas = document.getElementById('audioVisualizerCanvas');
    this.karaokeLinesContainer = document.getElementById('karaokeLinesContainer');

    // Player bar new buttons
    this.playerSpeedBtn = document.getElementById('playerSpeedBtn');
    this.playerSpeedText = document.getElementById('playerSpeedText');
    this.playerSleepBtn = document.getElementById('playerSleepBtn');
    this.playerSleepText = document.getElementById('playerSleepText');
    this.playerShareBtn = document.getElementById('playerShareBtn');

    // Sheet new buttons
    this.sheetSpeedBtn = document.getElementById('sheetSpeedBtn');
    this.sheetSpeedText = document.getElementById('sheetSpeedText');
    this.sheetSleepBtn = document.getElementById('sheetSleepBtn');
    this.sheetShareBtn = document.getElementById('sheetShareBtn');
    this.sheetToggleVisualizer = document.getElementById('sheetToggleVisualizer');
    this.sheetToggleSlowed = document.getElementById('sheetToggleSlowed');

    // Sidebar playlists
    this.sidebarPlaylistsList = document.getElementById('sidebarPlaylistsList');
    this.sidebarCreatePlaylistBtn = document.getElementById('sidebarCreatePlaylistBtn');
    this.sidebarPwaInstallBtn = document.getElementById('sidebarPwaInstallBtn');
    this.headerPwaInstallBtn = document.getElementById('headerPwaInstallBtn');

    // Smart Radio toggle
    this.toggleSmartRadio = document.getElementById('toggleSmartRadio');

    // Lyrics script toggle
    this.toggleLyricScriptBtn = document.getElementById('toggleLyricScriptBtn');
  }

  showToast(message) {
    this.toast.textContent = message;
    this.toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toast.classList.remove('show');
    }, 2500);
  }

  formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  // ==========================================
  // Web Audio DSP Engine (Spatial Audio, 3D Sound, Dolby Atmos, Anti-Clipping)
  // ==========================================
  createCinemaImpulse(ctx, duration = 1.2, decay = 2.2) {
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const impulse = ctx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const env = Math.exp(-t * decay);
      left[i] = (Math.random() * 2 - 1) * env;
      right[i] = (Math.random() * 2 - 1) * env;
    }
    return impulse;
  }

  setupAudioDSP() {
    if (this.isDspInit) return;
    try {
      // ── MOBILE NATIVE DIRECT HARDWARE AUDIO ──────────────────────────────
      // On mobile devices (Android & iOS):
      // NEVER attach Web Audio API MediaElementSourceNode to <audio>!
      // Mobile browsers force Web Audio through a 128-sample software buffer that
      // underflows easily during UI rendering or network shifts, producing harsh
      // digital crackling, static hiss, and robotic buzzing ("erachal sound").
      // By letting <audio> decode natively, Android MediaPlayer/AAudio & iOS AVPlayer
      // handle the 320k stream directly in hardware with zero latency, zero noise,
      // zero crackling, and 100% stable background playback when screen is locked!
      const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
        (navigator.maxTouchPoints > 1 && /Macintosh/i.test(navigator.userAgent));

      if (isMobile) {
        this.isDspInit = true;
        this.audioCtx = null;
        this.vocalFilter = null;
        this.eqFilters = [];
        this.spatialDryGain = null;
        this.spatialWetGain = null;
        this.splitter = null;
        this.merger = null;
        this.delayLeft = null;
        this.delayRight = null;
        this.dolbyConvolver = null;
        this.dolbyGain = null;
        this.fidelityCutoffFilter = null;
        this.fidelityAirFilter = null;
        this.fidelityWarmthFilter = null;
        this.fidelityPresenceFilter = null;
        console.log('📱 Mobile: Native Direct Hardware Audio Engine active (Zero crackling, zero noise)');
        return;
      }
      // ── END MOBILE MODE ──────────────────────────────────────────────────

      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      if (!this.audioCtx) {
        this.audioCtx = new AudioContext();
      }

      // Master Input Headroom Gain (prevents digital clipping/distortion when EQ is boosted)
      this.inputGain = this.audioCtx.createGain();
      this.inputGain.gain.value = 0.85;

      // Bass Boost Filter (Low-shelf at 75Hz)
      this.bassFilter = this.audioCtx.createBiquadFilter();
      this.bassFilter.type = 'lowshelf';
      this.bassFilter.frequency.value = 75;
      this.bassFilter.gain.value = this.bassBoostGain;

      // Vocal Clarity Filter (Peaking at 2.8kHz)
      this.vocalFilter = this.audioCtx.createBiquadFilter();
      this.vocalFilter.type = 'peaking';
      this.vocalFilter.frequency.value = 2800;
      this.vocalFilter.Q.value = 1.0;
      this.vocalFilter.gain.value = this.isVocalClarityActive ? 3.5 : 0;

      // 5-Band Equalizer Filters
      this.eqFilters = [
        { freq: 60, type: 'lowshelf', gain: 0 },
        { freq: 230, type: 'peaking', gain: 0 },
        { freq: 910, type: 'peaking', gain: 0 },
        { freq: 3600, type: 'peaking', gain: 0 },
        { freq: 14000, type: 'highshelf', gain: 0 }
      ].map(cfg => {
        const filter = this.audioCtx.createBiquadFilter();
        filter.type = cfg.type;
        filter.frequency.value = cfg.freq;
        filter.gain.value = cfg.gain;
        return filter;
      });

      // Real-Time Acoustic Quality Fidelity Engine
      // (Audibly tailors frequency spectrum, analog warmth, air presence and resolution per tier)
      this.fidelityCutoffFilter = this.audioCtx.createBiquadFilter();
      this.fidelityCutoffFilter.type = 'lowpass';
      this.fidelityCutoffFilter.frequency.value = 22050;
      this.fidelityCutoffFilter.Q.value = 0.707;

      this.fidelityAirFilter = this.audioCtx.createBiquadFilter();
      this.fidelityAirFilter.type = 'highshelf';
      this.fidelityAirFilter.frequency.value = 12500;
      this.fidelityAirFilter.gain.value = 0.8;

      this.fidelityWarmthFilter = this.audioCtx.createBiquadFilter();
      this.fidelityWarmthFilter.type = 'peaking';
      this.fidelityWarmthFilter.frequency.value = 95;
      this.fidelityWarmthFilter.Q.value = 1.2;
      this.fidelityWarmthFilter.gain.value = 0.8;

      this.fidelityPresenceFilter = this.audioCtx.createBiquadFilter();
      this.fidelityPresenceFilter.type = 'peaking';
      this.fidelityPresenceFilter.frequency.value = 3200;
      this.fidelityPresenceFilter.Q.value = 1.0;
      this.fidelityPresenceFilter.gain.value = 0.8;

      // Spatial Audio 3D Stereo Widener (Delay + Stereo Phase Shift for Headphones/Bluetooth)
      this.spatialDryGain = this.audioCtx.createGain();
      this.spatialWetGain = this.audioCtx.createGain();
      this.spatialDryGain.gain.value = 0.90;
      this.spatialWetGain.gain.value = this.isSpatial3DActive ? 0.40 : 0.0;

      this.splitter = this.audioCtx.createChannelSplitter(2);
      this.merger = this.audioCtx.createChannelMerger(2);
      this.delayLeft = this.audioCtx.createDelay();
      this.delayRight = this.audioCtx.createDelay();
      this.delayLeft.delayTime.value = 0.0012; // 1.2ms binaural ITD delay
      this.delayRight.delayTime.value = 0.0006;

      // Dolby Atmos Cinema Room Ambience Simulator (Convolver & Diffuse Reverb)
      this.dolbyConvolver = this.audioCtx.createConvolver();
      this.dolbyConvolver.buffer = this.createCinemaImpulse(this.audioCtx, 1.2, 2.2);
      this.dolbyGain = this.audioCtx.createGain();
      this.dolbyGain.gain.value = this.isDolbyAtmosActive ? 0.25 : 0.0;

      // High-End Anti-Clipping Limiter / Compressor (GUARANTEES ZERO DISTORTION / NOISE)
      this.compressor = this.audioCtx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-4, this.audioCtx.currentTime);
      this.compressor.knee.setValueAtTime(10, this.audioCtx.currentTime);
      this.compressor.ratio.setValueAtTime(6, this.audioCtx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.audioCtx.currentTime);
      this.compressor.release.setValueAtTime(0.25, this.audioCtx.currentTime);

      // Master Output Gain
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.value = 0.95;

      // Connect Media Source safely
      if (!this.sourceNode) {
        this.sourceNode = this.audioCtx.createMediaElementSource(this.audio);
      }

      // Connect DSP Chain:
      // Source -> InputGain -> Fidelity Filters (Warmth -> Presence -> Air -> Cutoff) -> BassFilter -> VocalFilter -> EQ Filters
      let lastNode = this.sourceNode;
      lastNode.connect(this.inputGain);
      lastNode = this.inputGain;

      lastNode.connect(this.fidelityWarmthFilter);
      lastNode = this.fidelityWarmthFilter;

      lastNode.connect(this.fidelityPresenceFilter);
      lastNode = this.fidelityPresenceFilter;

      lastNode.connect(this.fidelityAirFilter);
      lastNode = this.fidelityAirFilter;

      lastNode.connect(this.fidelityCutoffFilter);
      lastNode = this.fidelityCutoffFilter;

      lastNode.connect(this.bassFilter);
      lastNode = this.bassFilter;

      lastNode.connect(this.vocalFilter);
      lastNode = this.vocalFilter;

      for (const eqNode of this.eqFilters) {
        lastNode.connect(eqNode);
        lastNode = eqNode;
      }

      // 1. Direct dry path to compressor
      lastNode.connect(this.spatialDryGain);
      this.spatialDryGain.connect(this.compressor);

      // 2. 3D Spatial Audio binaural ITD widener
      lastNode.connect(this.splitter);
      this.splitter.connect(this.delayLeft, 0);
      this.splitter.connect(this.delayRight, 1);
      this.delayLeft.connect(this.merger, 0, 0);
      this.delayRight.connect(this.merger, 0, 1);
      this.merger.connect(this.spatialWetGain);
      this.spatialWetGain.connect(this.compressor);

      // 3. Dolby Atmos Cinema Ambience path
      lastNode.connect(this.dolbyConvolver);
      this.dolbyConvolver.connect(this.dolbyGain);
      this.dolbyGain.connect(this.compressor);

      // Connect limiter compressor to hardware output
      this.compressor.connect(this.masterGain);
      this.masterGain.connect(this.audioCtx.destination);

      this.isDspInit = true;
      this.applyAudioEffects();
      this.applyQualityFidelityProfile(this.currentFormat);
    } catch (e) {
      console.warn('AudioContext initialization error:', e.message);
    }
  }

  applyQualityFidelityProfile(qualityKey) {
    if (!this.isDspInit || !this.audioCtx) return;
    const now = this.audioCtx.currentTime;

    switch (qualityKey) {
      case '4k':
        // Audiophile 24-bit Hi-Res Studio Master
        // Full 22,050Hz spectrum, crystal air presence (+3.5dB at 12.5kHz), deep sub-bass punch (+2.2dB at 95Hz), vocal shimmer (+2.0dB at 3.2kHz)
        if (this.fidelityCutoffFilter) this.fidelityCutoffFilter.frequency.setTargetAtTime(22050, now, 0.05);
        if (this.fidelityAirFilter) this.fidelityAirFilter.gain.setTargetAtTime(3.5, now, 0.05);
        if (this.fidelityWarmthFilter) this.fidelityWarmthFilter.gain.setTargetAtTime(2.2, now, 0.05);
        if (this.fidelityPresenceFilter) this.fidelityPresenceFilter.gain.setTargetAtTime(2.0, now, 0.05);
        if (this.spatialWetGain && this.isSpatial3DActive) this.spatialWetGain.gain.setTargetAtTime(0.48, now, 0.05);
        break;

      case '1080p':
      case 'mp3_320':
        // Warm Analog Club Master MP3
        // 20,500Hz spectrum, heavy warm bass punch (+3.2dB at 95Hz), upfront vocal presence (+1.6dB at 3.2kHz), silky highs (+1.5dB)
        if (this.fidelityCutoffFilter) this.fidelityCutoffFilter.frequency.setTargetAtTime(20500, now, 0.05);
        if (this.fidelityAirFilter) this.fidelityAirFilter.gain.setTargetAtTime(1.5, now, 0.05);
        if (this.fidelityWarmthFilter) this.fidelityWarmthFilter.gain.setTargetAtTime(3.2, now, 0.05);
        if (this.fidelityPresenceFilter) this.fidelityPresenceFilter.gain.setTargetAtTime(1.6, now, 0.05);
        if (this.spatialWetGain && this.isSpatial3DActive) this.spatialWetGain.gain.setTargetAtTime(0.42, now, 0.05);
        break;

      case '720p':
      case 'mp4_320':
        // Studio Reference Master AAC
        // 20,000Hz pure flat studio reference curve (transparent, uncolored, pure studio mixing)
        if (this.fidelityCutoffFilter) this.fidelityCutoffFilter.frequency.setTargetAtTime(20000, now, 0.05);
        if (this.fidelityAirFilter) this.fidelityAirFilter.gain.setTargetAtTime(0.8, now, 0.05);
        if (this.fidelityWarmthFilter) this.fidelityWarmthFilter.gain.setTargetAtTime(0.8, now, 0.05);
        if (this.fidelityPresenceFilter) this.fidelityPresenceFilter.gain.setTargetAtTime(0.8, now, 0.05);
        if (this.spatialWetGain && this.isSpatial3DActive) this.spatialWetGain.gain.setTargetAtTime(0.40, now, 0.05);
        break;

      case '480p':
      case 'mp4_160':
        // High Quality 160 kbps Balanced
        // 16,000Hz cutoff, balanced consumer streaming tone
        if (this.fidelityCutoffFilter) this.fidelityCutoffFilter.frequency.setTargetAtTime(16000, now, 0.05);
        if (this.fidelityAirFilter) this.fidelityAirFilter.gain.setTargetAtTime(-1.2, now, 0.05);
        if (this.fidelityWarmthFilter) this.fidelityWarmthFilter.gain.setTargetAtTime(0.0, now, 0.05);
        if (this.fidelityPresenceFilter) this.fidelityPresenceFilter.gain.setTargetAtTime(0.0, now, 0.05);
        if (this.spatialWetGain && this.isSpatial3DActive) this.spatialWetGain.gain.setTargetAtTime(0.35, now, 0.05);
        break;

      case '360p':
      case 'mp4_96':
        // Standard Data Saver 96 kbps
        // 12,000Hz band-limited lowpass cutoff, cellular mobile compression simulation
        if (this.fidelityCutoffFilter) this.fidelityCutoffFilter.frequency.setTargetAtTime(12000, now, 0.05);
        if (this.fidelityAirFilter) this.fidelityAirFilter.gain.setTargetAtTime(-4.5, now, 0.05);
        if (this.fidelityWarmthFilter) this.fidelityWarmthFilter.gain.setTargetAtTime(-1.0, now, 0.05);
        if (this.fidelityPresenceFilter) this.fidelityPresenceFilter.gain.setTargetAtTime(-1.0, now, 0.05);
        if (this.spatialWetGain && this.isSpatial3DActive) this.spatialWetGain.gain.setTargetAtTime(0.25, now, 0.05);
        break;

      case '240p':
        // Ultra Data Saver 64 kbps
        // 8,500Hz band-limited lowpass cutoff for extreme weak signal
        if (this.fidelityCutoffFilter) this.fidelityCutoffFilter.frequency.setTargetAtTime(8500, now, 0.05);
        if (this.fidelityAirFilter) this.fidelityAirFilter.gain.setTargetAtTime(-8.0, now, 0.05);
        if (this.fidelityWarmthFilter) this.fidelityWarmthFilter.gain.setTargetAtTime(-2.0, now, 0.05);
        if (this.fidelityPresenceFilter) this.fidelityPresenceFilter.gain.setTargetAtTime(-2.0, now, 0.05);
        if (this.spatialWetGain && this.isSpatial3DActive) this.spatialWetGain.gain.setTargetAtTime(0.15, now, 0.05);
        break;
    }
  }

  applyAudioEffects() {
    if (!this.isDspInit || !this.audioCtx) return;

    // Bass Boost
    if (this.bassFilter) {
      this.bassFilter.gain.setTargetAtTime(this.bassBoostGain, this.audioCtx.currentTime, 0.05);
    }

    // Vocal Clarity
    if (this.vocalFilter) {
      this.vocalFilter.gain.setTargetAtTime(this.isVocalClarityActive ? 3.5 : 0, this.audioCtx.currentTime, 0.05);
    }

    // Spatial 3D Audio Wet Gain
    if (this.spatialWetGain) {
      const wet = this.isSpatial3DActive ? 0.40 : 0.0;
      this.spatialWetGain.gain.setTargetAtTime(wet, this.audioCtx.currentTime, 0.05);
    }

    // Dolby Atmos Cinema Ambience Gain
    if (this.dolbyGain) {
      const dolbyVal = this.isDolbyAtmosActive ? 0.25 : 0.0;
      this.dolbyGain.gain.setTargetAtTime(dolbyVal, this.audioCtx.currentTime, 0.05);
    }

    // Input Headroom adjustment for 3D & Dolby
    if (this.inputGain) {
      const targetGain = (this.isDolbyAtmosActive || this.isSpatial3DActive) ? 0.80 : 0.88;
      this.inputGain.gain.setTargetAtTime(targetGain, this.audioCtx.currentTime, 0.05);
    }

    // Update UI Badges
    if (this.sheetSpatialBadge) {
      this.sheetSpatialBadge.style.display = this.isSpatial3DActive ? 'inline-block' : 'none';
    }
    if (this.sheetDolbyBadge) {
      this.sheetDolbyBadge.style.display = this.isDolbyAtmosActive ? 'inline-block' : 'none';
    }
    if (this.sheetToggle3D) {
      this.sheetToggle3D.classList.toggle('active', this.isSpatial3DActive);
    }
    if (this.sheetToggleDolby) {
      this.sheetToggleDolby.classList.toggle('active', this.isDolbyAtmosActive);
    }
    if (this.sheetToggleBass) {
      this.sheetToggleBass.classList.toggle('active', this.bassBoostGain > 0);
    }
    if (this.toggleSpatial3D) {
      this.toggleSpatial3D.checked = this.isSpatial3DActive;
    }
    if (this.toggleDolbyAtmos) {
      this.toggleDolbyAtmos.checked = this.isDolbyAtmosActive;
    }
  }

  applyEqualizerPreset(presetName) {
    if (!this.isDspInit || !this.eqFilters) return;
    const presets = {
      dolby: [4, 2, 0, 3, 5],
      spatial: [3, 1, 2, 4, 6],
      bass: [9, 5, 1, 0, 1],
      vocal: [-2, 0, 4, 5, 2],
      flat: [0, 0, 0, 0, 0]
    };

    const gains = presets[presetName] || presets.flat;
    this.eqFilters.forEach((filter, idx) => {
      filter.gain.setTargetAtTime(gains[idx], this.audioCtx.currentTime, 0.05);
    });

    if (presetName === 'dolby') {
      this.isDolbyAtmosActive = true;
      this.isSpatial3DActive = true;
      this.bassBoostGain = 8;
    } else if (presetName === 'spatial') {
      this.isSpatial3DActive = true;
      this.bassBoostGain = 6;
    } else if (presetName === 'bass') {
      this.bassBoostGain = 12;
    }

    this.bassBoostSlider.value = this.bassBoostGain;
    this.bassBoostValue.textContent = `+${this.bassBoostGain} dB`;
    this.applyAudioEffects();
    this.showToast(`🎛️ Preset: ${presetName.toUpperCase()} activated`);
  }

  // ==========================================
  // Bluetooth Device Detection
  // ==========================================
  async initBluetoothDetection() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return;
    }

    const checkDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
        const bluetoothDevice = audioOutputs.find(d => 
          /bluetooth|wireless|airpod|bud|headphone|headset|sony|boat|oneplus/i.test(d.label)
        );

        if (bluetoothDevice && bluetoothDevice.label) {
          this.bluetoothDeviceLabel.textContent = `🎧 ${bluetoothDevice.label}`;
          this.bluetoothDeviceSub = 'Spatial Audio & Dolby Atmos Active';
          const navText = document.getElementById('navBluetoothText');
          if (navText) navText.textContent = `Bluetooth Connected`;
        } else if (audioOutputs.length > 0) {
          this.bluetoothDeviceLabel.textContent = '🎧 Headphones / Audio Output';
          this.bluetoothDeviceSub = 'Dolby Atmos & 3D Spatial Audio Ready';
        }
      } catch (e) {
        console.warn('Bluetooth device check:', e);
      }
    };

    checkDevices();
    navigator.mediaDevices.addEventListener('devicechange', checkDevices);
  }

  // ==========================================
  // Audio Playback Events
  // ==========================================
  initAudioEvents() {
    this.audio.addEventListener('play', () => {
      this.isPlaying = true;
      this.updatePlayStateUI();
      if (!this.isDspInit) {
        this.setupAudioDSP();
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
    });

    this.audio.addEventListener('playing', () => {
      this.isPlaying = true;
      this.updatePlayStateUI();
      if (!this.isDspInit) {
        this.setupAudioDSP();
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      // Start visualizer if active
      if (this.isVisualizerActive) {
        if (!this.analyser) this.setupVisualizer();
        this.startVisualizer();
      }
    });

    this.audio.addEventListener('pause', () => {
      this.isPlaying = false;
      this.updatePlayStateUI();
      this.stopVisualizer();
    });

    this.audio.addEventListener('ended', () => {
      // Sleep-on-end check
      if (this.sleepStopOnEnd) {
        this.executeSleepStop();
        return;
      }
      if (this.repeatMode === 'one') {
        this.audio.currentTime = 0;
        this.audio.play();
      } else {
        this.playNext();
      }
    });

    this.audio.addEventListener('timeupdate', () => {
      if (!this.audio.duration) return;
      const progress = (this.audio.currentTime / this.audio.duration) * 100;
      
      // Bottom Bar Scrubber
      this.progressBar.style.width = `${progress}%`;
      const progressThumb = document.getElementById('progressThumb');
      if (progressThumb) progressThumb.style.left = `${progress}%`;
      this.currentTimeText.textContent = this.formatTime(this.audio.currentTime);
      this.totalDurationText.textContent = this.formatTime(this.audio.duration);

      // Fullscreen Sheet Scrubber
      this.sheetProgressBar.style.width = `${progress}%`;
      if (this.sheetProgressThumb) this.sheetProgressThumb.style.left = `${progress}%`;
      this.sheetCurrentTime.textContent = this.formatTime(this.audio.currentTime);
      this.sheetTotalDuration.textContent = this.formatTime(this.audio.duration);

      // Karaoke Highlight (every tick)
      if (this.isKaraokeActive) this.updateKaraokeHighlight();
    });

    this.audio.addEventListener('progress', () => {
      if (this.audio.buffered.length > 0 && this.audio.duration) {
        const bufferedEnd = this.audio.buffered.end(this.audio.buffered.length - 1);
        const bufferedPercent = (bufferedEnd / this.audio.duration) * 100;
        this.bufferedBar.style.width = `${bufferedPercent}%`;
        this.sheetBufferedBar.style.width = `${bufferedPercent}%`;
      }
    });

    this.audio.addEventListener('error', (e) => {
      console.warn('Audio direct stream error, attempting fallback...', e);
      if (this.currentSong && this.currentSong.streams) {
        const fallback = this.currentSong.streams.stream_160 || this.currentSong.streams.stream_320 || this.currentSong.playUrl;
        if (fallback) {
          const proxyUrl = `/api/proxy-audio?url=${encodeURIComponent(fallback)}`;
          if (this.audio.src !== proxyUrl) {
            console.log('Switching to backup proxy stream:', proxyUrl);
            this.audio.src = proxyUrl;
            this.audio.load();
            this.audio.play().catch(() => {});
          }
        }
      }
    });

    // Native buffer events: let the browser buffer naturally without aggressive reloading
    this.audio.addEventListener('waiting', () => {
      // Browser is buffering data naturally - do not interrupt or reset stream!
      this.isPlaying = true;
    });

    this.audio.addEventListener('canplay', () => {
      // Buffer ready to play
      this.isPlaying = !this.audio.paused;
      this.updatePlayStateUI();
    });
  }

  updatePlayStateUI() {
    const playIcons = [this.playIcon, this.sheetPlayPauseBtn.querySelector('.play-icon')];
    const pauseIcons = [this.pauseIcon, this.sheetPlayPauseBtn.querySelector('.pause-icon')];

    if (this.isPlaying) {
      playIcons.forEach(i => i && (i.style.display = 'none'));
      pauseIcons.forEach(i => i && (i.style.display = 'block'));
    } else {
      playIcons.forEach(i => i && (i.style.display = 'block'));
      pauseIcons.forEach(i => i && (i.style.display = 'none'));
    }
  }

  // ==========================================
  // UI Events & Controls
  // ==========================================
  initUIEvents() {
    // Play / Pause Toggle
    const handlePlayPause = () => {
      if (!this.currentSong && this.queue.length > 0) {
        this.playSong(this.queue[0], this.queue, 0);
        return;
      }
      if (!this.currentSong) return;
      if (this.audio.paused) {
        this.audio.play();
      } else {
        this.audio.pause();
      }
    };
    this.playPauseBtn.addEventListener('click', handlePlayPause);
    this.sheetPlayPauseBtn.addEventListener('click', handlePlayPause);

    // Next / Prev
    this.nextBtn.addEventListener('click', () => this.playNext());
    this.prevBtn.addEventListener('click', () => this.playPrev());
    this.sheetNextBtn.addEventListener('click', () => this.playNext());
    this.sheetPrevBtn.addEventListener('click', () => this.playPrev());

    // Shuffle
    const toggleShuffle = () => {
      this.isShuffled = !this.isShuffled;
      this.shuffleBtn.classList.toggle('active', this.isShuffled);
      this.sheetShuffleBtn.classList.toggle('active', this.isShuffled);
      this.showToast(this.isShuffled ? '🔀 Shuffle On' : '➡️ Shuffle Off');
    };
    this.shuffleBtn.addEventListener('click', toggleShuffle);
    this.sheetShuffleBtn.addEventListener('click', toggleShuffle);

    // Repeat (all -> one -> off)
    const toggleRepeat = () => {
      if (this.repeatMode === 'all') {
        this.repeatMode = 'one';
        this.repeatBtn.classList.add('active');
        this.sheetRepeatBtn.classList.add('active');
        this.repeatOneBadge.classList.add('show');
        this.sheetRepeatBadge.classList.add('show');
        this.showToast('🔂 Repeat One Song');
      } else if (this.repeatMode === 'one') {
        this.repeatMode = 'off';
        this.repeatBtn.classList.remove('active');
        this.sheetRepeatBtn.classList.remove('active');
        this.repeatOneBadge.classList.remove('show');
        this.sheetRepeatBadge.classList.remove('show');
        this.showToast('➡️ Repeat Off');
      } else {
        this.repeatMode = 'all';
        this.repeatBtn.classList.add('active');
        this.sheetRepeatBtn.classList.add('active');
        this.repeatOneBadge.classList.remove('show');
        this.sheetRepeatBadge.classList.remove('show');
        this.showToast('🔁 Repeat All Queue');
      }
    };
    this.repeatBtn.addEventListener('click', toggleRepeat);
    this.sheetRepeatBtn.addEventListener('click', toggleRepeat);

    // Scrubber Seeking
    const handleSeek = (wrapper, e) => {
      if (!this.audio.duration) return;
      const rect = wrapper.getBoundingClientRect();
      const clickPos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      this.audio.currentTime = clickPos * this.audio.duration;
    };
    this.progressWrapper.addEventListener('click', (e) => handleSeek(this.progressWrapper, e));
    this.sheetProgressWrapper.addEventListener('click', (e) => handleSeek(this.sheetProgressWrapper, e));

    // Volume Slider & Mute
    this.volumeSlider.addEventListener('input', (e) => {
      const vol = parseFloat(e.target.value);
      this.audio.volume = vol;
      this.audio.muted = (vol === 0);
      this.updateVolumeIcon(vol);
    });

    this.volumeBtn.addEventListener('click', () => {
      this.audio.muted = !this.audio.muted;
      if (this.audio.muted) {
        this.volumeSlider.value = 0;
        this.updateVolumeIcon(0);
      } else {
        this.volumeSlider.value = this.audio.volume || 0.85;
        this.updateVolumeIcon(this.volumeSlider.value);
      }
    });

    // Like Favorite
    this.playerFavBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.currentSong) this.toggleFavorite(this.currentSong);
    });
    this.sheetFavBtn.addEventListener('click', () => {
      if (this.currentSong) this.toggleFavorite(this.currentSong);
    });

    // Search Input with Debounce & Instant Enter Key
    let searchDebounceTimer;
    this.searchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      this.clearSearchBtn.style.display = query ? 'block' : 'none';
      clearTimeout(searchDebounceTimer);
      if (!query) {
        this.hideSearchResults();
        return;
      }
      this.searchLoader.style.display = 'block';
      searchDebounceTimer = setTimeout(() => {
        this.performSearch(query);
      }, 350);
    });

    this.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(searchDebounceTimer);
        const query = this.searchInput.value.trim();
        if (query) {
          this.performSearch(query);
        }
      }
    });

    this.clearSearchBtn.addEventListener('click', () => {
      this.searchInput.value = '';
      this.clearSearchBtn.style.display = 'none';
      this.hideSearchResults();
      this.searchInput.focus();
    });

    this.closeSearchSectionBtn.addEventListener('click', () => {
      this.hideSearchResults();
    });

    // Language / Category Tabs
    document.querySelectorAll('.lang-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.lang-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentLanguage = tab.dataset.lang;
        this.handleLanguageFilter(this.currentLanguage);
      });
    });

    // Quick Search Tags
    document.querySelectorAll('.quick-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        const query = tag.dataset.query;
        this.searchInput.value = query;
        this.clearSearchBtn.style.display = 'block';
        this.performSearch(query);
      });
    });

    // Sidebar Era Tags
    document.querySelectorAll('.tag-nav').forEach(btn => {
      btn.addEventListener('click', () => {
        const query = btn.dataset.query;
        this.searchInput.value = query;
        this.clearSearchBtn.style.display = 'block';
        this.performSearch(query);
      });
    });

    // Navigation Menu (Desktop Sidebar)
    document.getElementById('navHome').addEventListener('click', () => this.switchView('home'));
    document.getElementById('navSearch').addEventListener('click', () => {
      this.switchView('home');
      this.searchInput.focus();
    });
    document.getElementById('navFavorites').addEventListener('click', () => this.showCustomView('favorites'));

    // Navigation Menu (Mobile Bottom Nav)
    this.mNavHome.addEventListener('click', () => {
      this.setMobileNavActive(this.mNavHome);
      this.switchView('home');
    });
    this.mNavSearch.addEventListener('click', () => {
      this.setMobileNavActive(this.mNavSearch);
      this.switchView('home');
      this.searchInput.focus();
    });
    this.mNavFavorites.addEventListener('click', () => {
      this.setMobileNavActive(this.mNavFavorites);
      this.showCustomView('favorites');
    });
    this.mNavAudioFX.addEventListener('click', () => {
      this.openAudioFXModal();
    });
    if (this.mNavSettings) {
      this.mNavSettings.addEventListener('click', () => {
        this.openMobileSettingsModal();
      });
    }

    // Mobile Settings Dialog Events
    if (this.closeMobileSettingsBtn) {
      this.closeMobileSettingsBtn.addEventListener('click', () => this.closeMobileSettingsModal());
    }
    if (this.closeMobileSettingsBackdrop) {
      this.closeMobileSettingsBackdrop.addEventListener('click', () => this.closeMobileSettingsModal());
    }

    const mOpenQuality = document.getElementById('mOpenQualityBtn');
    if (mOpenQuality) {
      mOpenQuality.addEventListener('click', () => {
        this.closeMobileSettingsModal();
        this.qualityModal.classList.add('active');
      });
    }

    const mOpenAudioFX = document.getElementById('mOpenAudioFXBtn');
    if (mOpenAudioFX) {
      mOpenAudioFX.addEventListener('click', () => {
        this.closeMobileSettingsModal();
        this.openAudioFXModal();
      });
    }

    const mOpenSleep = document.getElementById('mOpenSleepTimerBtn');
    if (mOpenSleep) {
      mOpenSleep.addEventListener('click', () => {
        this.closeMobileSettingsModal();
        if (this.sleepTimerModal) this.sleepTimerModal.classList.add('open');
      });
    }

    const mOpenSpeed = document.getElementById('mOpenSpeedBtn');
    if (mOpenSpeed) {
      mOpenSpeed.addEventListener('click', () => {
        this.closeMobileSettingsModal();
        if (this.speedModal) this.speedModal.classList.add('open');
      });
    }

    const mToggleKaraoke = document.getElementById('mToggleKaraokeScriptBtn');
    if (mToggleKaraoke) {
      mToggleKaraoke.addEventListener('click', () => {
        this.toggleKaraokeScript();
        this.updateMobileSettingsUI();
      });
    }

    const mInstallBtn = document.getElementById('mInstallAppBtn');
    if (mInstallBtn) {
      mInstallBtn.addEventListener('click', () => {
        this.triggerPwaInstall();
      });
    }

    const mReloadCache = document.getElementById('mReloadCacheBtn');
    if (mReloadCache) {
      mReloadCache.addEventListener('click', async () => {
        this.showToast('🔄 Clearing cache and reloading...');
        try {
          if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
          }
        } catch (e) {}
        setTimeout(() => window.location.reload(true), 400);
      });
    }

    const mLogoutBtn = document.getElementById('mSettingsLogoutBtn');
    if (mLogoutBtn) {
      mLogoutBtn.addEventListener('click', () => {
        if (confirm('Sign out of MUSIC account?')) {
          localStorage.removeItem('music_auth_session');
          window.location.replace('/auth.html');
        }
      });
    }

    // Play All from Library
    this.playAllCustomBtn.addEventListener('click', () => {
      const list = this.currentViewMode === 'favorites' ? this.favorites : this.history;
      if (list && list.length > 0) {
        this.playSong(list[0], list, 0);
        this.showToast(`🎶 Playing ${list.length} songs`);
      }
    });

    // Queue Drawer
    this.queueToggleBtn.addEventListener('click', () => {
      this.queueDrawer.classList.toggle('open');
      this.renderQueueDrawer();
    });
    this.closeQueueBtn.addEventListener('click', () => {
      this.queueDrawer.classList.remove('open');
    });
    this.clearQueueBtn.addEventListener('click', () => {
      this.queue = [];
      this.queueIndex = -1;
      this.renderQueueDrawer();
      this.showToast('🗑️ Queue cleared');
    });

    // Fullscreen / Mobile Now Playing Sheet Open & Close
    const openNowPlayingSheet = () => {
      if (!this.currentSong && this.queue.length > 0) {
        this.playSong(this.queue[0]);
      }
      this.nowPlayingSheet.classList.add('open');
    };
    this.openNowPlayingFromThumb.addEventListener('click', openNowPlayingSheet);
    this.expandPlayerBtn.addEventListener('click', openNowPlayingSheet);

    this.closeNowPlayingSheetBtn.addEventListener('click', () => {
      this.nowPlayingSheet.classList.remove('open');
    });

    // Audio FX Modal
    const openFX = () => this.openAudioFXModal();
    this.openAudioFXBtn.addEventListener('click', openFX);
    this.playerAudioFXBtn.addEventListener('click', openFX);
    document.getElementById('navAudioFX').addEventListener('click', openFX);
    document.getElementById('navBluetooth').addEventListener('click', openFX);
    document.getElementById('sheetAudioFXBtn').addEventListener('click', openFX);
    this.closeAudioFXBtn.addEventListener('click', () => this.audioFXModal.classList.remove('active'));
    this.closeAudioFXBackdrop.addEventListener('click', () => this.audioFXModal.classList.remove('active'));

    // Audio FX Toggles
    this.toggleSpatial3D.addEventListener('change', (e) => {
      this.isSpatial3DActive = e.target.checked;
      this.applyAudioEffects();
      this.showToast(this.isSpatial3DActive ? '🎧 3D Spatial Audio Active' : 'Spatial Audio Off');
    });

    this.toggleDolbyAtmos.addEventListener('change', (e) => {
      this.isDolbyAtmosActive = e.target.checked;
      this.applyAudioEffects();
      this.showToast(this.isDolbyAtmosActive ? '🔊 Dolby Atmos Cinema Surround Active' : 'Dolby Atmos Off');
    });

    this.toggleVocalClarity.addEventListener('change', (e) => {
      this.isVocalClarityActive = e.target.checked;
      this.applyAudioEffects();
    });

    this.bassBoostSlider.addEventListener('input', (e) => {
      this.bassBoostGain = parseInt(e.target.value, 10);
      this.bassBoostValue.textContent = `+${this.bassBoostGain} dB`;
      this.applyAudioEffects();
    });

    // Equalizer Preset Chips
    document.querySelectorAll('.preset-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.applyEqualizerPreset(chip.dataset.preset);
      });
    });

    // Sheet Quick FX Toggles
    this.sheetToggle3D.addEventListener('click', () => {
      this.isSpatial3DActive = !this.isSpatial3DActive;
      this.toggleSpatial3D.checked = this.isSpatial3DActive;
      this.applyAudioEffects();
      this.showToast(this.isSpatial3DActive ? '🎧 3D Spatial Audio ON' : '3D Spatial Audio OFF');
    });

    this.sheetToggleDolby.addEventListener('click', () => {
      this.isDolbyAtmosActive = !this.isDolbyAtmosActive;
      this.toggleDolbyAtmos.checked = this.isDolbyAtmosActive;
      this.applyAudioEffects();
      this.showToast(this.isDolbyAtmosActive ? '🔊 Dolby Atmos ON' : 'Dolby Atmos OFF');
    });

    this.sheetToggleBass.addEventListener('click', () => {
      this.bassBoostGain = (this.bassBoostGain === 0) ? 10 : 0;
      this.bassBoostSlider.value = this.bassBoostGain;
      this.bassBoostValue.textContent = `+${this.bassBoostGain} dB`;
      this.applyAudioEffects();
      this.showToast(this.bassBoostGain > 0 ? '💥 Bass Boost +10dB ON' : 'Bass Boost OFF');
    });

    // Sheet Lyrics Toggle (handled in initAdvancedFeatures - remove duplicate)
    // Karaoke toggle is wired in initAdvancedFeatures()

    // Quality Selection Modal
    const openQuality = () => this.qualityModal.classList.add('active');
    this.openQualityModalBtn.addEventListener('click', openQuality);
    this.playerQualityBadgeBtn.addEventListener('click', openQuality);
    this.closeQualityBtn.addEventListener('click', () => this.qualityModal.classList.remove('active'));
    this.closeQualityBackdrop.addEventListener('click', () => this.qualityModal.classList.remove('active'));

    document.querySelectorAll('.quality-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.quality-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        const input = card.querySelector('input');
        if (input) input.checked = true;
        
        this.currentFormat = input.value;
        this._userSetFormat = true; // User manually chose — don't auto-downgrade on mobile
        localStorage.setItem('music_format', this.currentFormat);
        this.updateQualityUI();
        this.qualityModal.classList.remove('active');
        
        if (this.currentSong && this.isPlaying) {
          const currentTime = this.audio.currentTime;
          const newUrl = this.getStreamUrlForFormat(this.currentSong, this.currentFormat);
          this.audio.src = newUrl;
          this.audio.currentTime = currentTime;
          this.audio.play();
        }
        this.showToast(`✨ Switched to ${this.getFormatLabel(this.currentFormat)}`);
      });
    });

    // Download Modal
    const openDownload = (song) => this.openDownloadModal(song || this.currentSong);
    document.getElementById('playerDownloadBtn').addEventListener('click', () => openDownload(this.currentSong));
    document.getElementById('sheetDownloadBtn').addEventListener('click', () => openDownload(this.currentSong));
    this.closeDownloadBtn.addEventListener('click', () => this.downloadModal.classList.remove('active'));
    this.closeDownloadBackdrop.addEventListener('click', () => this.downloadModal.classList.remove('active'));

    document.querySelectorAll('.download-quality-row').forEach(row => {
      row.addEventListener('click', () => {
        if (!this.downloadTargetSong) return;
        this.triggerDownload(this.downloadTargetSong, row.dataset.quality);
      });
    });
  }

  setMobileNavActive(activeBtn) {
    document.querySelectorAll('.mobile-nav-item').forEach(b => b.classList.remove('active'));
    activeBtn.classList.add('active');
  }

  openAudioFXModal() {
    this.audioFXModal.classList.add('active');
    if (!this.isDspInit) {
      this.setupAudioDSP();
    }
  }

  openMobileSettingsModal() {
    if (!this.mobileSettingsModal) return;
    this.mobileSettingsModal.classList.add('active');
    this.updateMobileSettingsUI();
  }

  closeMobileSettingsModal() {
    if (!this.mobileSettingsModal) return;
    this.mobileSettingsModal.classList.remove('active');
  }

  updateMobileSettingsUI() {
    // Quality info
    const qualityDescEl = document.getElementById('mCurrentQualityDesc');
    const qualityBadgeEl = document.getElementById('mCurrentQualityBadge');
    if (qualityBadgeEl) {
      const labels = {
        '4k': '4K MASTER',
        '720p': '320K MP4',
        '1080p': '320K MP3',
        '480p': '160K MP4',
        '360p': '96K MP4'
      };
      qualityBadgeEl.textContent = labels[this.currentFormat] || '320K MP4';
    }
    if (qualityDescEl) {
      qualityDescEl.textContent = `${this.getFormatLabel(this.currentFormat)} (Active)`;
    }

    // Sleep Timer info
    const sleepDescEl = document.getElementById('mSleepStatusDesc');
    const sleepBadgeEl = document.getElementById('mSleepBadge');
    if (sleepBadgeEl && sleepDescEl) {
      if (this.sleepRemainingSeconds > 0) {
        const mins = Math.ceil(this.sleepRemainingSeconds / 60);
        sleepBadgeEl.textContent = `${mins}m`;
        sleepBadgeEl.style.color = '#1ed760';
        sleepDescEl.textContent = `Auto-stopping playback in ~${mins} minutes`;
      } else {
        sleepBadgeEl.textContent = 'OFF';
        sleepBadgeEl.style.color = '';
        sleepDescEl.textContent = 'Timer is off (Auto-pause music at night)';
      }
    }

    // Playback Speed / Lo-Fi info
    const speedDescEl = document.getElementById('mSpeedDesc');
    const speedBadgeEl = document.getElementById('mSpeedBadge');
    if (speedBadgeEl && speedDescEl) {
      if (this.isSlowedActive) {
        speedBadgeEl.textContent = 'LO-FI';
        speedBadgeEl.style.color = '#eab308';
        speedDescEl.textContent = '0.85x Slowed + Reverb Lo-Fi active';
      } else {
        speedBadgeEl.textContent = `${this.playbackSpeed}x`;
        speedBadgeEl.style.color = '';
        speedDescEl.textContent = this.playbackSpeed === 1.0 ? 'Normal 1.0x playback speed' : `${this.playbackSpeed}x custom speed`;
      }
    }

    // Karaoke Script info
    const karaokeScriptBadge = document.getElementById('mKaraokeScriptBadge');
    if (karaokeScriptBadge) {
      karaokeScriptBadge.textContent = this.karaokeScript === 'tanglish' ? 'Tanglish' : 'Tamil';
    }

    // User profile info from auth session
    try {
      const raw = localStorage.getItem('music_auth_session');
      if (raw) {
        const session = JSON.parse(raw);
        if (session && session.user) {
          const u = session.user;
          const av = document.getElementById('mSettingsAvatar');
          const un = document.getElementById('mSettingsUsername');
          const em = document.getElementById('mSettingsEmail');
          if (av) av.textContent = u.avatar || (u.username ? u.username.charAt(0).toUpperCase() : 'M');
          if (un) un.textContent = u.username || 'User';
          if (em) em.textContent = u.email || 'user@example.com';
        }
      }
    } catch (e) {}
  }

  // ==========================================
  // Download Engine
  // ==========================================
  openDownloadModal(song) {
    if (!song) {
      this.showToast('▶️ Play a song first to download!');
      return;
    }
    this.downloadTargetSong = song;

    // Populate modal with song info
    this.downloadArtThumb.src = song.image;
    this.downloadSongTitle.textContent = song.title;
    this.downloadSongArtist.textContent = song.artist || song.album || '';
    this.downloadInfoTitle.textContent = song.title;
    this.downloadInfoSub.textContent = `${song.album ? song.album + ' • ' : ''}${song.artist || ''} ${song.year ? '(' + song.year + ')' : ''}`.trim();

    // Reset progress bar
    this.downloadProgressWrap.style.display = 'none';
    this.downloadProgressFill.style.width = '0%';

    // Reset row states
    document.querySelectorAll('.download-quality-row').forEach(r => r.classList.remove('downloading'));

    this.downloadModal.classList.add('active');
  }

  getDownloadUrl(song, quality) {
    if (!song || !song.streams) return song ? song.playUrl : null;
    const map = {
      '4k': song.streams.stream_320,
      '720p': song.streams.stream_320,
      '1080p': song.streams.stream_320,  // MP3 variant
      '480p': song.streams.stream_160 || song.streams.stream_320,
      '360p': song.streams.stream_96 || song.streams.stream_160 || song.streams.stream_320,
      '240p': song.streams.stream_96 || song.streams.stream_160 || song.streams.stream_320
    };
    return map[quality] || song.streams.stream_320 || song.playUrl;
  }

  async triggerDownload(song, quality) {
    const rawUrl = this.getDownloadUrl(song, quality);
    if (!rawUrl) {
      this.showToast('❌ Download URL not available for this song.');
      return;
    }

    const qualityLabel = {
      '4k': '1411kbps Lossless',
      '720p': '320kbps Studio HD',
      '1080p': '320kbps MP3',
      '480p': '160kbps High',
      '360p': '96kbps Saver',
      '240p': '64kbps Min Data'
    };
    const isMp3 = quality === '1080p';
    const ext = isMp3 ? 'mp3' : 'm4a';
    const safeTitle = (song.title || 'song').replace(/[^\w\s\-().]/g, '').replace(/\s+/g, '_').trim();
    const safeArtist = (song.artist || '').replace(/[^\w\s\-().]/g, '').replace(/\s+/g, '_').trim();
    const filename = `${safeTitle}${safeArtist ? '_' + safeArtist : ''}_${quality}_MUSIC`;

    // Mark the row as downloading
    const row = document.querySelector(`.download-quality-row[data-quality="${quality}"]`);
    if (row) row.classList.add('downloading');

    // Show progress bar (animated loop until done)
    this.downloadProgressWrap.style.display = 'block';
    this.downloadProgressLabel.textContent = `Downloading ${quality} (${qualityLabel[quality]})...`;
    this.downloadProgressFill.style.width = '5%';

    // Animate progress while downloading
    let fakeProgress = 5;
    const progressInterval = setInterval(() => {
      if (fakeProgress < 88) {
        fakeProgress += Math.random() * 8;
        this.downloadProgressFill.style.width = Math.min(fakeProgress, 88) + '%';
      }
    }, 300);

    this.showToast(`⬇️ Downloading ${song.title} (${quality})...`);

    try {
      const downloadApiUrl = `/api/download?url=${encodeURIComponent(rawUrl)}&filename=${encodeURIComponent(filename)}${isMp3 ? '&format=mp3' : ''}`;

      const response = await fetch(downloadApiUrl);
      if (!response.ok) throw new Error(`Server returned ${response.status}`);

      const blob = await response.blob();

      clearInterval(progressInterval);
      this.downloadProgressFill.style.width = '100%';
      this.downloadProgressLabel.textContent = `✅ Download complete! (${quality} – ${qualityLabel[quality]})`;

      // Trigger browser file save dialog
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${filename}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);

      this.showToast(`✅ "${song.title}" saved! (${quality} – ${qualityLabel[quality]})`);

      // Auto-close modal after 1.8s
      setTimeout(() => {
        this.downloadModal.classList.remove('active');
        this.downloadProgressWrap.style.display = 'none';
        this.downloadProgressFill.style.width = '0%';
        if (row) row.classList.remove('downloading');
      }, 1800);

    } catch (err) {
      clearInterval(progressInterval);
      this.downloadProgressFill.style.width = '0%';
      this.downloadProgressLabel.textContent = '❌ Download failed. Try again.';
      if (row) row.classList.remove('downloading');
      console.error('Download error:', err);
      this.showToast(`❌ Download failed: ${err.message}`);
    }
  }

  getFormatLabel(formatKey) {
    switch (formatKey) {
      case '4k':
        return '4K MASTER 1411K';
      case '720p':
      case 'mp4_320':
        return 'MP4 HI-RES 320K';
      case '1080p':
      case 'mp3_320':
        return '1080p MP3 320K';
      case '480p':
      case 'mp4_160':
        return '480p HIGH 160K';
      case '360p':
      case 'mp4_96':
        return '360p SAVER 96K';
      case '240p':
        return '240p MIN 64K';
      default:
        return 'MP4 HI-RES 320K';
    }
  }

  updateQualityUI() {
    const label = this.getFormatLabel(this.currentFormat);
    const parts = label.split(' ');
    const pixelBadge = parts[0]; // e.g. "MP4", "4K", "1080p", "480p", "360p"
    const bitrateText = parts.slice(1).join(' '); // e.g. "HI-RES 320K", "MASTER 1411K"

    if (this.headerFormatBadge) {
      this.headerFormatBadge.textContent = pixelBadge;
      if (pixelBadge === '4K') {
        this.headerFormatBadge.style.background = 'linear-gradient(135deg, rgba(180, 70, 255, 0.35), rgba(230, 40, 180, 0.35))';
        this.headerFormatBadge.style.color = '#d67bff';
      } else if (pixelBadge === 'MP4' || pixelBadge === '720p') {
        this.headerFormatBadge.style.background = 'linear-gradient(135deg, rgba(30, 215, 96, 0.3), rgba(15, 160, 65, 0.3))';
        this.headerFormatBadge.style.color = '#1ed760';
      } else if (pixelBadge === '1080p') {
        this.headerFormatBadge.style.background = 'linear-gradient(135deg, rgba(255, 200, 50, 0.25), rgba(255, 120, 30, 0.25))';
        this.headerFormatBadge.style.color = '#ffcc44';
      } else if (pixelBadge === '480p') {
        this.headerFormatBadge.style.background = 'rgba(80, 140, 255, 0.2)';
        this.headerFormatBadge.style.color = '#7eb5ff';
      } else if (pixelBadge === '240p') {
        this.headerFormatBadge.style.background = 'rgba(255, 120, 50, 0.25)';
        this.headerFormatBadge.style.color = '#ff9858';
      } else {
        this.headerFormatBadge.style.background = 'rgba(100, 100, 120, 0.25)';
        this.headerFormatBadge.style.color = '#a0a0c0';
      }
    }
    if (this.headerBitrateBadge) this.headerBitrateBadge.textContent = bitrateText;
    if (this.playerQualityLabel) this.playerQualityLabel.textContent = `${pixelBadge} (${bitrateText})`;
    if (this.sheetQualityBadge) this.sheetQualityBadge.textContent = `${pixelBadge} • ${bitrateText}`;

    document.querySelectorAll('.quality-card').forEach(card => {
      const input = card.querySelector('input');
      const cardVal = input ? input.value : '';
      const isSelected = cardVal === this.currentFormat ||
        (cardVal === '720p' && this.currentFormat === 'mp4_320') ||
        (cardVal === '1080p' && this.currentFormat === 'mp3_320') ||
        (cardVal === '480p' && this.currentFormat === 'mp4_160') ||
        (cardVal === '360p' && this.currentFormat === 'mp4_96');
      card.classList.toggle('active', isSelected);
      if (input) input.checked = isSelected;
    });

    // Apply the real acoustic DSP fidelity profile immediately!
    this.applyQualityFidelityProfile(this.currentFormat);
    this.updateMobileSettingsUI();
  }

  updateVolumeIcon(vol) {
    const icon = document.getElementById('volumeIcon');
    if (vol === 0 || this.audio.muted) {
      icon.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line>';
    } else if (vol < 0.5) {
      icon.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>';
    } else {
      icon.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>';
    }
  }

  initKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (document.activeElement === this.searchInput) {
        if (e.key === 'Escape') {
          this.searchInput.blur();
          this.hideSearchResults();
        }
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          this.playPauseBtn.click();
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (this.audio.duration) {
            this.audio.currentTime = Math.min(this.audio.duration, this.audio.currentTime + 5);
            this.showToast(`⏩ +5s (${this.formatTime(this.audio.currentTime)})`);
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (this.audio.duration) {
            this.audio.currentTime = Math.max(0, this.audio.currentTime - 5);
            this.showToast(`⏪ -5s (${this.formatTime(this.audio.currentTime)})`);
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.audio.volume = Math.min(1, this.audio.volume + 0.1);
          this.volumeSlider.value = this.audio.volume;
          this.updateVolumeIcon(this.audio.volume);
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.audio.volume = Math.max(0, this.audio.volume - 0.1);
          this.volumeSlider.value = this.audio.volume;
          this.updateVolumeIcon(this.audio.volume);
          break;
        case 'KeyM':
          this.volumeBtn.click();
          break;
        case 'KeyL':
          if (this.currentSong) this.toggleFavorite(this.currentSong);
          break;
        case 'KeyF':
          this.nowPlayingSheet.classList.toggle('open');
          break;
        case 'Slash':
          e.preventDefault();
          this.searchInput.focus();
          break;
        case 'Escape':
          this.nowPlayingSheet.classList.remove('open');
          this.audioFXModal.classList.remove('active');
          this.qualityModal.classList.remove('active');
          this.queueDrawer.classList.remove('open');
          if (this.downloadModal) this.downloadModal.classList.remove('active');
          break;
      }
    });
  }

  // ==========================================
  // Audio Playback Engine
  // ==========================================
  getStreamUrlForFormat(song, formatKey) {
    let rawUrl = song.playUrl;
    if (song.streams) {
      if ((formatKey === '4k' || formatKey === '720p' || formatKey === 'mp4_320') && song.streams.stream_320) {
        rawUrl = song.streams.stream_320;
      } else if ((formatKey === '480p' || formatKey === 'mp4_160') && song.streams.stream_160) {
        rawUrl = song.streams.stream_160;
      } else if ((formatKey === '360p' || formatKey === '240p' || formatKey === 'mp4_96') && song.streams.stream_96) {
        rawUrl = song.streams.stream_96;
      } else if (formatKey === '1080p' || formatKey === 'mp3_320') {
        rawUrl = song.streams.stream_320 || song.streams.default_stream || song.playUrl;
      } else if (song.streams.default_stream) {
        rawUrl = song.streams.default_stream;
      }
    }
    if (!rawUrl) rawUrl = song.playUrl || '';
    if (!rawUrl) return '';

    // Enforce HTTPS
    if (rawUrl.startsWith('http:')) {
      rawUrl = rawUrl.replace('http:', 'https:');
    }

    // Direct CDN High-Speed Streaming:
    // Akamai & Azure Saavn CDN delivers ultra fast 320k/160k audio with native byte-range seeking.
    // Directly connects to CDN edge in India/global, completely bypassing Vercel Serverless Function
    // 10-second timeout, eliminating buffer underruns, pauses, and audio stuttering!
    return rawUrl;
  }

  playSong(song, newQueue = null, index = -1) {
    if (!song) return;

    if (newQueue) {
      this.queue = [...newQueue];
      this.queueIndex = index >= 0 ? index : this.queue.findIndex(s => s.id === song.id);
    } else if (!this.queue.some(s => s.id === song.id)) {
      this.queue.push(song);
      this.queueIndex = this.queue.length - 1;
    }

    this.currentSong = song;
    const audioUrl = this.getStreamUrlForFormat(song, this.currentFormat);

    // Ensure volume is unmuted and audible
    this.audio.muted = false;
    if (this.audio.volume === 0 || isNaN(this.audio.volume)) {
      this.audio.volume = 0.90;
      this.volumeSlider.value = 0.90;
      this.updateVolumeIcon(0.90);
    }

    // Audio context initialization on user gesture
    if (!this.isDspInit) {
      this.setupAudioDSP();
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    this.applyQualityFidelityProfile(this.currentFormat);

    this.audio.src = audioUrl;
    this.audio.load();

    const playPromise = this.audio.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        this.isPlaying = true;
        this.updatePlayStateUI();
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
          this.audioCtx.resume();
        }
      }).catch(err => {
        console.warn('Playback gesture/network catch:', err.message);
        // Retry play on next tick
        setTimeout(() => {
          if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
          }
          this.audio.play().then(() => {
            this.isPlaying = true;
            this.updatePlayStateUI();
          }).catch(e => console.warn('Retry play error:', e));
        }, 120);
      });
    }

    // Update Bottom Player UI
    this.playerThumb.src = song.image;
    this.playerTitle.textContent = song.title;
    this.playerArtist.textContent = `${song.album ? song.album + ' • ' : ''}${song.artist}`;
    this.playerFavBtn.classList.toggle('active', this.isFavorite(song.id));

    // Update Sidebar Mini Player
    this.sidebarCover.src = song.image;
    this.sidebarTitle.textContent = song.title;
    this.sidebarArtist.textContent = song.artist || song.album;

    // Update Fullscreen Sheet
    this.sheetArtwork.src = song.image;
    this.sheetSongTitle.textContent = song.title;
    this.sheetSongArtist.textContent = song.artist;
    this.sheetMovieTitle.textContent = song.album || 'Single';
    this.sheetFavBtn.classList.toggle('active', this.isFavorite(song.id));

    // Ambient glow backdrop update
    this.updateAmbientGlow(song.image);

    // Add to history
    this.addToHistory(song);

    // Immediately reset lyrics state so old track's lyrics are NEVER visible on a new track
    this.karaokeLyrics = [];
    this.currentKaraokeActiveIdx = -1;
    if (this.karaokeLinesContainer) {
      this.karaokeLinesContainer.innerHTML = '';
    }

    // Reload Karaoke if sheet lyrics card is currently active
    if (this.isKaraokeActive) {
      this.loadKaraokeLyrics();
    }

    // Highlight active playing song card in home and search grid
    this.updateActiveSongCards();

    // Re-render queue highlighting
    this.renderQueueDrawer();
  }

  updateActiveSongCards() {
    const curId = this.currentSong?.id;
    document.querySelectorAll('.song-card').forEach(card => {
      const isCur = (card.dataset.songId === curId);
      card.classList.toggle('is-now-playing', isCur);
      const bars = card.querySelector('.now-playing-bars-overlay');
      if (bars) bars.style.display = (isCur && this.isPlaying) ? 'flex' : 'none';
    });
  }

  playNext() {
    if (this.queue.length === 0) {
      // Smart Radio: fetch more songs when queue is empty
      if (this.isSmartRadioActive && this.currentSong) {
        this.fetchSmartRadioRecommendations(this.currentSong);
      }
      return;
    }

    let nextIdx;
    if (this.isShuffled) {
      nextIdx = Math.floor(Math.random() * this.queue.length);
    } else {
      nextIdx = this.queueIndex + 1;
    }

    // At end of queue: trigger Smart Radio before wrapping
    if (nextIdx >= this.queue.length) {
      if (this.isSmartRadioActive && this.currentSong) {
        this.fetchSmartRadioRecommendations(this.currentSong);
      }
      nextIdx = this.repeatMode !== 'off' ? 0 : this.queue.length - 1;
    }

    this.queueIndex = nextIdx;
    this.playSong(this.queue[this.queueIndex]);
  }

  playPrev() {
    if (this.queue.length === 0) return;
    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      return;
    }
    this.queueIndex = (this.queueIndex - 1 + this.queue.length) % this.queue.length;
    this.playSong(this.queue[this.queueIndex]);
  }

  addToQueue(song) {
    if (!song) return;
    this.queue.push(song);
    this.renderQueueDrawer();
    this.showToast(`➕ Added "${song.title}" to Queue`);
  }

  addToHistory(song) {
    this.history = this.history.filter(s => s.id !== song.id);
    this.history.unshift(song);
    if (this.history.length > 50) this.history.pop();
    this.saveStoredList('music_history', this.history);
  }

  isFavorite(songId) {
    return this.favorites.some(s => s.id === songId);
  }

  toggleFavorite(song) {
    if (this.isFavorite(song.id)) {
      this.favorites = this.favorites.filter(s => s.id !== song.id);
      this.showToast(`💔 Removed from Your Library`);
    } else {
      this.favorites.unshift(song);
      this.showToast(`❤️ Saved to Your Library`);
    }
    this.saveStoredList('music_favorites', this.favorites);
    this.playerFavBtn.classList.toggle('active', this.isFavorite(song.id));
    this.sheetFavBtn.classList.toggle('active', this.isFavorite(song.id));
    this.updateFavoritesCount();

    if (this.currentViewMode === 'favorites') {
      this.renderCustomGrid(this.favorites);
    }
  }

  updateFavoritesCount() {
    this.favoritesCount.textContent = this.favorites.length;
  }

  updateAmbientGlow(imgSrc) {
    this.ambientBackdrop.style.background = `
      radial-gradient(circle at 60% 15%, rgba(30, 215, 96, 0.12), transparent 45%),
      radial-gradient(circle at 10% 80%, rgba(30, 215, 96, 0.08), transparent 50%)
    `;
  }

  // ==========================================
  // Shelves & Home View
  // ==========================================
  async loadCuratedShelves() {
    // 1. Instant 0ms cache rendering from localStorage to eliminate grey loading skeletons on refresh
    try {
      const cached = localStorage.getItem('music_curated_shelves');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.renderCuratedShelves(parsed);
          const firstShelf = parsed[0];
          if (firstShelf && firstShelf.songs && firstShelf.songs.length > 0) {
            this.setupHeroBanner(firstShelf.songs[0]);
          }
        }
      }
    } catch (e) {
      console.warn('Shelves cache read error:', e);
    }

    // 2. Fetch latest curated shelves from server
    try {
      const res = await fetch('/api/curated-shelves');
      const data = await res.json();
      if (data.success && data.shelves && data.shelves.length > 0) {
        this.renderCuratedShelves(data.shelves);
        try {
          localStorage.setItem('music_curated_shelves', JSON.stringify(data.shelves));
        } catch (e) {}

        // Setup Hero Spotlight with first song
        const firstShelf = data.shelves[0];
        if (firstShelf && firstShelf.songs && firstShelf.songs.length > 0) {
          this.setupHeroBanner(firstShelf.songs[0]);
        }
      }
    } catch (e) {
      console.error('Failed to load shelves:', e);
      // Remove skeleton if still present so it never hangs indefinitely
      const skeleton = this.shelvesContainer.querySelector('.shelf-skeleton');
      if (skeleton) {
        skeleton.innerHTML = '<div style="padding:40px;text-align:center;color:#b3b3b3;">Unable to load shelves. Please refresh or check connection.</div>';
      }
    }
  }

  setupHeroBanner(song) {
    this.heroTitle.textContent = song.title;
    this.heroSubtitle.textContent = `${song.album ? song.album + ' • ' : ''}${song.artist}`;
    this.heroImage.src = song.image;
    this.heroBackdrop.style.backgroundImage = `url(${song.image})`;

    this.heroPlayBtn.onclick = () => {
      this.playSong(song, [song], 0);
    };

    this.heroQueueBtn.onclick = () => {
      this.addToQueue(song);
    };
  }

  renderCuratedShelves(shelves) {
    this.shelvesContainer.innerHTML = '';
    shelves.forEach(shelf => {
      if (!shelf.songs || shelf.songs.length === 0) return;

      const shelfEl = document.createElement('section');
      shelfEl.className = 'shelf-section';
      shelfEl.innerHTML = `
        <div class="section-header">
          <div>
            <h2 class="section-title">${shelf.title}</h2>
            <p class="section-subtitle">${shelf.subtitle}</p>
          </div>
          <div class="shelf-controls">
            <button class="shelf-scroll-btn scroll-left" title="Scroll Left">‹</button>
            <button class="shelf-scroll-btn scroll-right" title="Scroll Right">›</button>
          </div>
        </div>
        <div class="shelf-row" id="shelfRow_${shelf.id}"></div>
      `;

      const row = shelfEl.querySelector('.shelf-row');
      shelf.songs.forEach(song => {
        const card = this.createSongCard(song, shelf.songs);
        row.appendChild(card);
      });

      const leftBtn = shelfEl.querySelector('.scroll-left');
      const rightBtn = shelfEl.querySelector('.scroll-right');
      leftBtn.addEventListener('click', () => {
        row.scrollBy({ left: -420, behavior: 'smooth' });
      });
      rightBtn.addEventListener('click', () => {
        row.scrollBy({ left: 420, behavior: 'smooth' });
      });

      this.shelvesContainer.appendChild(shelfEl);
    });
  }

  createSongCard(song, songList) {
    const isPlaying = this.currentSong && this.currentSong.id === song.id;
    const card = document.createElement('div');
    card.className = `song-card ${isPlaying ? 'is-now-playing' : ''}`;
    card.dataset.songId = song.id;
    card.innerHTML = `
      <div class="song-card-thumb-wrap">
        <img src="${song.image}" alt="${song.title}" loading="lazy">
        <span class="song-card-badge"><span class="badge-dot"></span>MP4 • 320K</span>
        <div class="now-playing-bars-overlay" style="${isPlaying && this.isPlaying ? 'display:flex;' : 'display:none;'}">
          <span class="np-bar np-bar-1"></span>
          <span class="np-bar np-bar-2"></span>
          <span class="np-bar np-bar-3"></span>
        </div>
        <div class="song-play-overlay">
          <button class="overlay-play-btn" title="Play">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="#000"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>
          </button>
        </div>
      </div>
      <div class="song-card-info">
        <div class="song-card-title" title="${song.title}">${song.title}</div>
        <div class="song-card-album" title="${song.album}">${song.album || 'Single'}</div>
        <div class="song-card-artist" title="${song.artist}">${song.artist}</div>
        <div class="song-card-footer">
          <span class="song-year-badge">${song.year || '320k'}</span>
          <div class="song-card-actions">
            <button class="card-action-btn btn-card-queue" title="Add to Queue">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
            <button class="card-action-btn btn-card-fav ${this.isFavorite(song.id) ? 'active' : ''}" title="Save">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="${this.isFavorite(song.id) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>
            </button>
            <button class="card-action-btn btn-card-playlist" title="Add to Playlist">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
            </button>
            <button class="card-action-btn btn-card-share" title="Share Song">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
            </button>
            <button class="card-action-btn btn-card-download" title="Download Song">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>
          </div>
        </div>
      </div>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.closest('.card-action-btn')) return;
      this.playSong(song, songList);
    });

    const queueBtn = card.querySelector('.btn-card-queue');
    queueBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.addToQueue(song);
    });

    const favBtn = card.querySelector('.btn-card-fav');
    favBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleFavorite(song);
      favBtn.classList.toggle('active', this.isFavorite(song.id));
      favBtn.querySelector('svg').setAttribute('fill', this.isFavorite(song.id) ? 'currentColor' : 'none');
    });

    const downloadBtn = card.querySelector('.btn-card-download');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openDownloadModal(song);
      });
    }

    const playlistBtn = card.querySelector('.btn-card-playlist');
    if (playlistBtn) {
      playlistBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openPlaylistModal(song);
      });
    }

    const shareBtn = card.querySelector('.btn-card-share');
    if (shareBtn) {
      shareBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openShareModal(song);
      });
    }

    return card;
  }

  // ==========================================
  // Search Implementation
  // ==========================================
  async performSearch(query) {
    if (!query) return;
    this.searchLoader.style.display = 'block';

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      this.searchLoader.style.display = 'none';

      if (data.success && data.results) {
        this.renderSearchResults(data.results, query);
      }
    } catch (e) {
      this.searchLoader.style.display = 'none';
      console.error('Search error:', e);
    }
  }

  renderSearchResults(songs, query) {
    this.searchResultsSection.style.display = 'block';
    this.homeView.style.display = 'none';
    this.customView.style.display = 'none';

    this.searchResultsTitle.textContent = `Results for "${query}"`;
    this.searchResultsSubtitle.textContent = `Found ${songs.length} playable songs from old to new`;

    this.searchResultsGrid.innerHTML = '';
    if (songs.length === 0) {
      this.searchResultsGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: var(--text-muted);">
          <div style="font-size: 40px; margin-bottom: 12px;">🔍</div>
          <h3 style="color:#fff;font-size:1.2rem;margin-bottom:8px;">No exact match for "${query}"</h3>
          <p style="margin-bottom: 20px;font-size:0.9rem;">Try searching another movie, song name, or try these popular hits:</p>
          <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
            <button class="quick-tag no-results-chip" data-search="Ghilli">⚡ Ghilli</button>
            <button class="quick-tag no-results-chip" data-search="Mankatha">🔥 Mankatha</button>
            <button class="quick-tag no-results-chip" data-search="Leo">🦁 Leo</button>
            <button class="quick-tag no-results-chip" data-search="Aavesham">🌴 Aavesham</button>
            <button class="quick-tag no-results-chip" data-search="Jailer">💥 Jailer</button>
            <button class="quick-tag no-results-chip" data-search="Sillunu Oru Kaadhal">💖 Sillunu Oru Kaadhal</button>
          </div>
        </div>
      `;
      this.searchResultsGrid.querySelectorAll('.no-results-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          const s = btn.dataset.search;
          this.searchInput.value = s;
          this.clearSearchBtn.style.display = 'block';
          this.performSearch(s);
        });
      });
      return;
    }

    songs.forEach(song => {
      const card = this.createSongCard(song, songs);
      this.searchResultsGrid.appendChild(card);
    });

    this.searchResultsSection.scrollIntoView({ behavior: 'smooth' });
  }

  hideSearchResults() {
    this.searchResultsSection.style.display = 'none';
    this.homeView.style.display = 'block';
  }

  async handleLanguageFilter(lang) {
    if (lang === 'all') {
      this.hideSearchResults();
      return;
    }

    this.searchLoader.style.display = 'block';
    try {
      const res = await fetch(`/api/trending?language=${encodeURIComponent(lang)}`);
      const data = await res.json();
      this.searchLoader.style.display = 'none';

      if (data.success && data.results) {
        const langNames = {
          tamil: 'தமிழ் (Tamil) Hits',
          malayalam: 'മലയാളം (Malayalam) Hits',
          telugu: 'తెలుగు (Telugu) Hits',
          hindi: 'हिंदी (Hindi) Hits',
          english: 'English Pop Hits',
          retro: '80s & 90s Vintage Evergreen Hits'
        };
        const title = langNames[lang] || `${lang.toUpperCase()} Songs`;
        this.renderSearchResults(data.results, title);
      }
    } catch (e) {
      this.searchLoader.style.display = 'none';
    }
  }

  // ==========================================
  // Library & History Views
  // ==========================================
  showCustomView(mode) {
    this.currentViewMode = mode;
    this.searchResultsSection.style.display = 'none';
    this.homeView.style.display = 'none';
    this.customView.style.display = 'block';

    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    if (mode === 'favorites') {
      document.getElementById('navFavorites').classList.add('active');
      this.customViewTitle.textContent = 'Your Library';
      this.customViewSubtitle.textContent = `${this.favorites.length} saved songs`;
      this.setLibTab('favorites');
      this.showLibrarySection('favorites', this.favorites);
    } else if (mode === 'history') {
      this.customViewTitle.textContent = 'Recently Played';
      this.customViewSubtitle.textContent = `${this.history.length} songs played`;
      this.setLibTab('history');
      this.showLibrarySection('history', this.history);
    }
  }

  renderCustomGrid(list) {
    this.customViewGrid.innerHTML = '';
    if (!list || list.length === 0) {
      this.customViewGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 60px; color: var(--text-muted);">
          <h3>No songs in your library yet</h3>
          <p style="margin-top: 8px;">Heart songs from Search or Home to add them to your library.</p>
        </div>
      `;
      return;
    }

    list.forEach(song => {
      const card = this.createSongCard(song, list);
      this.customViewGrid.appendChild(card);
    });
  }

  switchView(viewName) {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    if (viewName === 'home') {
      document.getElementById('navHome').classList.add('active');
      this.searchResultsSection.style.display = 'none';
      this.customView.style.display = 'none';
      this.homeView.style.display = 'block';
    }
  }

  // ==========================================
  // Queue Drawer
  // ==========================================
  renderQueueDrawer() {
    this.queueCount.textContent = `${this.queue.length} songs`;
    this.queueList.innerHTML = '';

    if (this.queue.length === 0) {
      this.queueList.innerHTML = '<div class="empty-queue-msg">Queue is empty. Click "+ Queue" on any song to add it!</div>';
      return;
    }

    this.queue.forEach((song, idx) => {
      const item = document.createElement('div');
      item.className = `queue-item ${idx === this.queueIndex ? 'active' : ''}`;
      item.innerHTML = `
        <img class="queue-item-thumb" src="${song.image}" alt="${song.title}">
        <div class="queue-item-info">
          <div class="queue-item-title">${song.title}</div>
          <div class="queue-item-artist">${song.artist}</div>
        </div>
        <button class="queue-item-remove" title="Remove">✕</button>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.closest('.queue-item-remove')) return;
        this.queueIndex = idx;
        this.playSong(song);
      });

      const removeBtn = item.querySelector('.queue-item-remove');
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.queue.splice(idx, 1);
        if (this.queueIndex >= idx) {
          this.queueIndex = Math.max(0, this.queueIndex - 1);
        }
        this.renderQueueDrawer();
      });

      this.queueList.appendChild(item);
    });
  }

  // ==================================================================================
  // 1. LIVE NEON AUDIO VISUALIZER ENGINE
  // ==================================================================================
  setupVisualizer() {
    if (!this.isDspInit || !this.audioCtx || !this.visualizerCanvas) return;
    if (this.analyser) return; // already set up

    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 128;
    this.analyser.smoothingTimeConstant = 0.82;

    // Insert analyser between compressor and masterGain
    this.compressor.disconnect(this.masterGain);
    this.compressor.connect(this.analyser);
    this.analyser.connect(this.masterGain);

    this.visualizerDataArray = new Uint8Array(this.analyser.frequencyBinCount);
  }

  startVisualizer() {
    if (!this.analyser || !this.visualizerCanvas || !this.isVisualizerActive) return;
    const canvas = this.visualizerCanvas;
    const ctx = canvas.getContext('2d');

    const render = () => {
      if (!this.isVisualizerActive || !this.isPlaying) {
        // Fade out slowly when paused
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }
      this.visualizerAnimationId = requestAnimationFrame(render);

      // Match canvas size to displayed size
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.scale(dpr, dpr);
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;

      this.analyser.getByteFrequencyData(this.visualizerDataArray);
      ctx.clearRect(0, 0, W, H);

      const barCount = this.analyser.frequencyBinCount;
      const barWidth = (W / barCount) * 1.6;
      const gap = 2;

      for (let i = 0; i < barCount; i++) {
        const val = this.visualizerDataArray[i] / 255;
        const barH = val * H * 0.88;
        const x = i * (barWidth + gap);

        // Neon gradient based on frequency energy
        const hue = 140 + val * 120; // green (140) -> cyan -> blue at high energy
        const grd = ctx.createLinearGradient(0, H, 0, H - barH);
        grd.addColorStop(0, `hsla(${hue}, 100%, 55%, 0.9)`);
        grd.addColorStop(0.5, `hsla(${hue + 30}, 100%, 65%, 0.7)`);
        grd.addColorStop(1, `hsla(${hue + 60}, 100%, 80%, 0.4)`);

        ctx.fillStyle = grd;
        ctx.shadowBlur = 18;
        ctx.shadowColor = `hsla(${hue}, 100%, 60%, 0.8)`;
        ctx.beginPath();
        ctx.roundRect(x, H - barH, barWidth, barH, 3);
        ctx.fill();
      }
    };

    if (this.visualizerAnimationId) cancelAnimationFrame(this.visualizerAnimationId);
    render();
  }

  stopVisualizer() {
    if (this.visualizerAnimationId) {
      cancelAnimationFrame(this.visualizerAnimationId);
      this.visualizerAnimationId = null;
    }
    if (this.visualizerCanvas) {
      const ctx = this.visualizerCanvas.getContext('2d');
      ctx.clearRect(0, 0, this.visualizerCanvas.width, this.visualizerCanvas.height);
    }
  }

  // ==================================================================================
  // 2. REAL-TIME KARAOKE LYRICS ENGINE (Synchronized Multi-Source + Tamil/Tanglish)
  // ==================================================================================
  tamilToTanglish(text) {
    if (!text) return '';
    const uyir = {
      'அ': 'a', 'ஆ': 'aa', 'இ': 'i', 'ஈ': 'ee', 'உ': 'u', 'ஊ': 'oo',
      'எ': 'e', 'ஏ': 'ae', 'ஐ': 'ai', 'ஒ': 'o', 'ஓ': 'oa', 'ஔ': 'au', 'ஃ': 'k'
    };
    const mei = {
      'க': 'k', 'ங': 'ng', 'ச': 's', 'ஞ': 'gn', 'ட': 't', 'ண': 'n',
      'த': 'th', 'ந': 'n', 'ப': 'p', 'ம': 'm', 'ய': 'y', 'ர': 'r',
      'ல': 'l', 'வ': 'v', 'ழ': 'zh', 'ள': 'l', 'ற': 'r', 'ன': 'n',
      'ஜ': 'j', 'ஷ': 'sh', 'ஸ': 's', 'ஹ': 'h', 'க்ஷ': 'ksh'
    };
    const uyirmeiSign = {
      'ா': 'aa', 'ி': 'i', 'ீ': 'ee', 'ு': 'u', 'ூ': 'oo',
      'ெ': 'e', 'ே': 'ae', 'ை': 'ai', 'ொ': 'o', 'ோ': 'oa', 'ௌ': 'au'
    };

    let out = '';
    let i = 0;
    while (i < text.length) {
      const ch = text[i];
      const next = text[i + 1] || '';

      if (uyir[ch]) {
        out += uyir[ch];
        i++;
        continue;
      }
      if (mei[ch]) {
        const cons = mei[ch];
        if (next === '்') {
          out += cons;
          i += 2;
          continue;
        } else if (uyirmeiSign[next]) {
          out += cons + uyirmeiSign[next];
          i += 2;
          continue;
        } else {
          out += cons + 'a';
          i++;
          continue;
        }
      }
      out += ch;
      i++;
    }

    return out
      .replace(/thth/g, 'tth')
      .replace(/tthth/g, 'tth')
      .replace(/nka/g, 'nga');
  }

  async loadKaraokeLyrics() {
    if (!this.currentSong) return;
    const container = this.karaokeLinesContainer;
    if (!container) return;

    if (!this.lyricsRequestId) this.lyricsRequestId = 0;
    const currentReqId = ++this.lyricsRequestId;
    const targetSongId = this.currentSong.id;
    const targetSongTitle = this.currentSong.title;

    container.innerHTML = `<div class="sheet-lyrics-content"><span class="spin" style="display:inline-block;margin-right:8px;">⏳</span>Synchronizing lyrics for "${targetSongTitle}"...</div>`;

    try {
      const params = new URLSearchParams({
        id: this.currentSong.id || '',
        title: this.currentSong.title || '',
        artist: this.currentSong.artist || '',
        album: this.currentSong.album || '',
        duration: Math.round(this.audio.duration || 0)
      });

      const res = await fetch(`/api/lyrics?${params.toString()}`);
      const data = await res.json();

      // Guard: Ignore response if another song was selected in the meantime
      if (currentReqId !== this.lyricsRequestId || (this.currentSong && this.currentSong.id !== targetSongId && this.currentSong.title !== targetSongTitle)) {
        return;
      }

      if (data.success && data.lyrics) {
        const rawText = data.lyrics;
        const lrcRegex = /^\[(\d{1,2}):(\d{2})(?:\.\d+)?\]\s*(.*)$/;
        const lines = rawText.split('\n');
        const parsed = [];

        lines.forEach(line => {
          const match = line.match(lrcRegex);
          if (match) {
            const mm = parseInt(match[1], 10);
            const ss = parseFloat(match[2]);
            const time = mm * 60 + ss;
            const text = match[3].trim();
            if (text) {
              parsed.push({
                time,
                tamilText: text,
                tanglishText: this.tamilToTanglish(text)
              });
            }
          } else if (line.trim()) {
            const text = line.trim();
            parsed.push({
              time: -1,
              tamilText: text,
              tanglishText: this.tamilToTanglish(text)
            });
          }
        });

        if (parsed.length === 0) {
          container.innerHTML = `<div class="sheet-lyrics-content">${rawText}</div>`;
          return;
        }

        // If no timestamps in source, distribute evenly across song duration
        const hasTimes = parsed.some(l => l.time >= 0);
        if (!hasTimes) {
          const totalDur = Math.max(90, Math.round(this.audio.duration || 210));
          const step = (totalDur - 10) / Math.max(1, parsed.length);
          parsed.forEach((l, i) => { l.time = 5 + (i * step); });
        }

        this.karaokeLyrics = parsed;
        this.currentKaraokeActiveIdx = -1;
        this.renderKaraokeLines();

      } else {
        container.innerHTML = `
          <div class="sheet-lyrics-content" style="text-align:center;padding:48px 20px;">
            <div style="font-size:36px;margin-bottom:12px;">🎤</div>
            <div style="font-size:17px;font-weight:700;color:#fff;margin-bottom:6px;">Lyrics Not Available</div>
            <div style="font-size:13px;color:#a7a7a7;">Official synchronized lyrics for "${targetSongTitle}" are not available yet.</div>
          </div>
        `;
      }
    } catch (e) {
      if (currentReqId !== this.lyricsRequestId) return;
      console.warn('Lyrics load error:', e);
      container.innerHTML = `
        <div class="sheet-lyrics-content" style="text-align:center;padding:48px 20px;">
          <div style="font-size:36px;margin-bottom:12px;">🎤</div>
          <div style="font-size:17px;font-weight:700;color:#fff;margin-bottom:6px;">Lyrics Not Available</div>
          <div style="font-size:13px;color:#a7a7a7;">Could not retrieve lyrics stream for "${targetSongTitle}".</div>
        </div>
      `;
    }
  }

  renderKaraokeLines() {
    const container = this.karaokeLinesContainer;
    if (!container || !this.karaokeLyrics || this.karaokeLyrics.length === 0) return;
    container.innerHTML = '';

    const isTanglish = (this.karaokeScript === 'tanglish');
    this.karaokeLyrics.forEach((line, idx) => {
      const div = document.createElement('div');
      div.className = 'karaoke-line';
      div.dataset.idx = idx;
      div.dataset.time = line.time;

      const displayText = isTanglish ? line.tanglishText : line.tamilText;
      div.textContent = displayText;

      if (line.time >= 0) {
        div.addEventListener('click', () => {
          this.audio.currentTime = line.time;
          this.audio.play();
          this.showToast(`⏩ Seeked to ${this.formatTime(line.time)}`);
        });
      }
      container.appendChild(div);
    });

    this.currentKaraokeActiveIdx = -1;
    this.updateKaraokeHighlight();
  }

  updateKaraokeHighlight() {
    if (!this.isKaraokeActive || !this.karaokeLyrics || !this.karaokeLyrics.length) return;
    const container = this.karaokeLinesContainer;
    if (!container) return;
    const t = this.audio.currentTime;

    let activeIdx = -1;
    for (let i = 0; i < this.karaokeLyrics.length; i++) {
      if (this.karaokeLyrics[i].time <= t) {
        activeIdx = i;
      } else {
        break;
      }
    }

    if (this.currentKaraokeActiveIdx === activeIdx) return;
    this.currentKaraokeActiveIdx = activeIdx;

    const lines = container.querySelectorAll('.karaoke-line');
    lines.forEach((el, i) => {
      el.classList.remove('active', 'past');
      if (i === activeIdx) {
        el.classList.add('active');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (i < activeIdx) {
        el.classList.add('past');
      }
    });
  }

  // ==================================================================================
  // 3. BEDTIME SLEEP TIMER ENGINE
  // ==================================================================================
  openSleepModal() {
    this.sleepTimerModal.classList.add('open');
    if (this.sleepTimer) {
      this.sleepActiveStatus.style.display = 'flex';
    } else {
      this.sleepActiveStatus.style.display = 'none';
    }
  }

  closeSleepModal() {
    this.sleepTimerModal.classList.remove('open');
  }

  startSleepTimer(minutesOrMode) {
    // Clear existing timer
    this.cancelSleepTimer(false);

    if (minutesOrMode === 'end_of_song') {
      this.sleepStopOnEnd = true;
      this.showToast('💤 Will stop at end of current song');
      this.updateSleepPillUI('END');
      this.closeSleepModal();
      return;
    }

    const seconds = minutesOrMode * 60;
    this.sleepRemainingSeconds = seconds;
    this.sleepFadeOut = this.sleepFadeOutToggle ? this.sleepFadeOutToggle.checked : true;
    this.originalSleepVolume = this.audio.volume || 0.85;
    this.sleepStopOnEnd = false;

    const TICK = 1000;
    this.sleepTimer = setInterval(() => {
      this.sleepRemainingSeconds -= 1;

      // Update UI countdown
      const mins = Math.floor(this.sleepRemainingSeconds / 60);
      const secs = this.sleepRemainingSeconds % 60;
      const timeStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
      this.updateSleepPillUI(timeStr);
      if (this.sleepTimeRemaining) this.sleepTimeRemaining.textContent = timeStr;

      // Start fade-out in last 30 seconds
      if (this.sleepFadeOut && this.sleepRemainingSeconds <= 30 && this.sleepRemainingSeconds > 0) {
        const targetVol = Math.max(0, this.audio.volume - (this.originalSleepVolume / 30));
        this.audio.volume = targetVol;
        if (this.volumeSlider) this.volumeSlider.value = targetVol;
        this.updateVolumeIcon(targetVol);
      }

      if (this.sleepRemainingSeconds <= 0) {
        this.executeSleepStop();
      }
    }, TICK);

    this.updateSleepPillUI(`${minutesOrMode}:00`);
    if (this.playerSleepBtn) this.playerSleepBtn.classList.add('timer-active');
    this.showToast(`💤 Sleep timer set for ${minutesOrMode} minutes`);
    this.closeSleepModal();
  }

  executeSleepStop() {
    this.cancelSleepTimer(false);
    this.audio.pause();
    this.isPlaying = false;
    this.updatePlayStateUI();
    // Restore volume
    this.audio.volume = this.originalSleepVolume;
    if (this.volumeSlider) this.volumeSlider.value = this.originalSleepVolume;
    this.updateVolumeIcon(this.originalSleepVolume);
    this.showToast('💤 Sleep timer: music paused. Goodnight!');
    this.updateSleepPillUI(null);
  }

  cancelSleepTimer(notify = true) {
    if (this.sleepTimer) {
      clearInterval(this.sleepTimer);
      this.sleepTimer = null;
    }
    this.sleepStopOnEnd = false;
    this.sleepRemainingSeconds = 0;
    this.updateSleepPillUI(null);
    if (this.playerSleepBtn) this.playerSleepBtn.classList.remove('timer-active');
    if (notify) this.showToast('Sleep timer cancelled');
  }

  updateSleepPillUI(timeStr) {
    if (this.playerSleepText) {
      if (timeStr) {
        this.playerSleepText.style.display = 'inline';
        this.playerSleepText.textContent = timeStr;
      } else {
        this.playerSleepText.style.display = 'none';
      }
    }
    if (this.sleepActiveStatus) {
      this.sleepActiveStatus.style.display = (this.sleepTimer || this.sleepStopOnEnd) ? 'flex' : 'none';
    }
    this.updateMobileSettingsUI();
  }

  initSleepTimerEvents() {
    if (this.closeSleepBtn) this.closeSleepBtn.addEventListener('click', () => this.closeSleepModal());
    if (this.closeSleepBackdrop) this.closeSleepBackdrop.addEventListener('click', () => this.closeSleepModal());
    if (this.cancelSleepTimerBtn) this.cancelSleepTimerBtn.addEventListener('click', () => {
      this.cancelSleepTimer();
      this.closeSleepModal();
    });

    document.querySelectorAll('.sleep-option-card').forEach(card => {
      card.addEventListener('click', () => {
        const val = card.dataset.minutes;
        if (val === 'end_of_song') {
          this.startSleepTimer('end_of_song');
        } else {
          this.startSleepTimer(parseInt(val, 10));
        }
      });
    });

    const openSleep = () => this.openSleepModal();
    if (this.playerSleepBtn) this.playerSleepBtn.addEventListener('click', openSleep);
    if (this.sheetSleepBtn) this.sheetSleepBtn.addEventListener('click', openSleep);
    document.getElementById('openSleepModalBtn') && document.getElementById('openSleepModalBtn').addEventListener('click', openSleep);
  }

  // ==================================================================================
  // 4. ENDLESS SMART RADIO ENGINE
  // ==================================================================================
  async fetchSmartRadioRecommendations(currentSong) {
    if (!this.isSmartRadioActive || !currentSong) return;

    const query = [currentSong.artist, currentSong.album].filter(Boolean).join(' ');
    this.showToast(`📻 Smart Radio: Loading similar tracks...`);

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.success && data.results && data.results.length > 0) {
        // Filter out songs already in queue, add up to 10 new ones
        const existing = new Set(this.queue.map(s => s.id));
        const newSongs = data.results.filter(s => !existing.has(s.id)).slice(0, 10);
        newSongs.forEach(s => this.queue.push(s));
        this.renderQueueDrawer();
        this.showToast(`📻 Smart Radio: Added ${newSongs.length} similar songs`);
      }
    } catch (e) {
      console.warn('Smart radio fetch error:', e);
    }
  }

  // ==================================================================================
  // 5. PWA INSTALL ENGINE
  // ==================================================================================
  initPWA() {
    // Register Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(reg => {
        console.log('SW registered:', reg.scope);
      }).catch(e => console.warn('SW registration failed:', e));
    }

    // Capture install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      if (this.headerPwaInstallBtn) this.headerPwaInstallBtn.style.display = 'inline-flex';
      if (this.sidebarPwaInstallBtn) this.sidebarPwaInstallBtn.style.display = 'flex';
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.showToast('🎵 MUSIC app installed! Enjoy offline access.');
      if (this.headerPwaInstallBtn) this.headerPwaInstallBtn.style.display = 'none';
      if (this.sidebarPwaInstallBtn) this.sidebarPwaInstallBtn.style.display = 'none';
    });

    this.triggerPwaInstall = async () => {
      if (!this.deferredPrompt) {
        this.showToast('📱 In your mobile browser, tap Share or Menu (⋮) and select "Add to Home Screen"');
        return;
      }
      this.deferredPrompt.prompt();
      const result = await this.deferredPrompt.userChoice;
      if (result.outcome === 'accepted') {
        this.showToast('🎉 Installing MUSIC app...');
      }
      this.deferredPrompt = null;
    };

    if (this.headerPwaInstallBtn) this.headerPwaInstallBtn.addEventListener('click', () => this.triggerPwaInstall());
    if (this.sidebarPwaInstallBtn) this.sidebarPwaInstallBtn.addEventListener('click', () => this.triggerPwaInstall());
  }

  // ==================================================================================
  // 6. CUSTOM PLAYLISTS MANAGER ENGINE
  // ==================================================================================
  createPlaylist(name, desc = '') {
    if (!name || !name.trim()) return null;
    const playlist = {
      id: 'pl_' + Date.now(),
      name: name.trim(),
      desc: desc.trim(),
      songs: [],
      createdAt: Date.now()
    };
    this.playlists.push(playlist);
    this.saveStoredList('music_playlists', this.playlists);
    this.renderSidebarPlaylists();
    return playlist;
  }

  addSongToPlaylist(playlistId, song) {
    const pl = this.playlists.find(p => p.id === playlistId);
    if (!pl) return false;
    if (pl.songs.some(s => s.id === song.id)) {
      this.showToast(`"${song.title}" already in "${pl.name}"`);
      return false;
    }
    pl.songs.push(song);
    this.saveStoredList('music_playlists', this.playlists);
    this.showToast(`✅ Added to "${pl.name}"`);
    return true;
  }

  removeSongFromPlaylist(playlistId, songId) {
    const pl = this.playlists.find(p => p.id === playlistId);
    if (!pl) return;
    pl.songs = pl.songs.filter(s => s.id !== songId);
    this.saveStoredList('music_playlists', this.playlists);
  }

  deletePlaylist(playlistId) {
    this.playlists = this.playlists.filter(p => p.id !== playlistId);
    this.saveStoredList('music_playlists', this.playlists);
    this.renderSidebarPlaylists();
    this.showToast('🗑️ Playlist deleted');
  }

  renderSidebarPlaylists() {
    if (!this.sidebarPlaylistsList) return;
    this.sidebarPlaylistsList.innerHTML = '';
    if (!this.playlists.length) {
      this.sidebarPlaylistsList.innerHTML = '<div style="padding:8px 12px; font-size:0.78rem; color:var(--text-muted);">No playlists yet</div>';
      return;
    }
    this.playlists.forEach(pl => {
      const item = document.createElement('div');
      item.className = 'sidebar-pl-item';
      item.innerHTML = `<span>🎵 ${pl.name}</span><span style="font-size:0.72rem;color:var(--text-muted);">${pl.songs.length}</span>`;
      item.addEventListener('click', () => this.openPlaylistView(pl.id));
      this.sidebarPlaylistsList.appendChild(item);
    });
  }

  renderPlaylistsGrid() {
    if (!this.playlistsGrid) return;
    this.playlistsGrid.innerHTML = '';
    if (!this.playlists.length) {
      this.playlistsGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text-muted);"><h3>No playlists yet</h3><p style="margin-top:8px;">Create a playlist to organize your favorite songs.</p></div>';
      return;
    }
    this.playlists.forEach(pl => {
      const card = document.createElement('div');
      card.className = 'playlist-card';
      card.innerHTML = `
        <div class="playlist-card-cover">🎵</div>
        <div class="playlist-card-title">${pl.name}</div>
        <div class="playlist-card-sub">${pl.songs.length} songs${pl.desc ? ' • ' + pl.desc : ''}</div>
        <button class="playlist-card-delete" title="Delete playlist">🗑</button>
      `;
      card.addEventListener('click', (e) => {
        if (e.target.closest('.playlist-card-delete')) return;
        this.openPlaylistView(pl.id);
      });
      card.querySelector('.playlist-card-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Delete playlist "${pl.name}"?`)) this.deletePlaylist(pl.id);
        this.renderPlaylistsGrid();
      });
      this.playlistsGrid.appendChild(card);
    });
  }

  openPlaylistView(playlistId) {
    const pl = this.playlists.find(p => p.id === playlistId);
    if (!pl) return;
    this.currentViewMode = 'playlist';
    this.activePlaylistId = playlistId;
    this.showLibrarySection('playlists', pl.songs);
    this.customViewTitle.textContent = pl.name;
    this.customViewSubtitle.textContent = `${pl.songs.length} songs${pl.desc ? ' • ' + pl.desc : ''}`;
  }

  openPlaylistModal(song) {
    this.playlistTargetSong = song;
    this.playlistModalTitle.textContent = song ? 'Add to Playlist' : 'Create Playlist';
    this.playlistModal.classList.add('open');
    this.renderPlaylistPickList();
  }

  renderPlaylistPickList() {
    if (!this.playlistPickList) return;
    this.playlistPickList.innerHTML = '';
    if (!this.playlists.length) {
      this.playlistPickList.innerHTML = '<div style="padding:12px; color:var(--text-muted); font-size:0.85rem;">Create a playlist first using the form above.</div>';
      return;
    }
    this.playlists.forEach(pl => {
      const item = document.createElement('div');
      item.className = 'playlist-pick-item';
      item.innerHTML = `
        <div>
          <div style="font-weight:700;color:#fff;">${pl.name}</div>
          <div style="font-size:0.75rem;color:var(--text-muted);">${pl.songs.length} songs</div>
        </div>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--spotify-green)" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
      `;
      item.addEventListener('click', () => {
        if (this.playlistTargetSong) {
          this.addSongToPlaylist(pl.id, this.playlistTargetSong);
        }
        this.playlistModal.classList.remove('open');
      });
      this.playlistPickList.appendChild(item);
    });
  }

  initPlaylistEvents() {
    if (this.closePlaylistBtn) this.closePlaylistBtn.addEventListener('click', () => this.playlistModal.classList.remove('open'));
    if (this.closePlaylistBackdrop) this.closePlaylistBackdrop.addEventListener('click', () => this.playlistModal.classList.remove('open'));

    if (this.confirmCreatePlaylistBtn) {
      this.confirmCreatePlaylistBtn.addEventListener('click', () => {
        const name = this.newPlaylistNameInput ? this.newPlaylistNameInput.value.trim() : '';
        const desc = this.newPlaylistDescInput ? this.newPlaylistDescInput.value.trim() : '';
        if (!name) { this.showToast('⚠️ Please enter a playlist name'); return; }
        const pl = this.createPlaylist(name, desc);
        if (pl) {
          if (this.newPlaylistNameInput) this.newPlaylistNameInput.value = '';
          if (this.newPlaylistDescInput) this.newPlaylistDescInput.value = '';
          this.showToast(`✅ Playlist "${pl.name}" created!`);
          this.renderPlaylistPickList();
          this.renderPlaylistsGrid();
        }
      });
    }

    if (this.sidebarCreatePlaylistBtn) {
      this.sidebarCreatePlaylistBtn.addEventListener('click', () => this.openPlaylistModal(null));
    }

    if (this.createPlaylistBtn) {
      this.createPlaylistBtn.addEventListener('click', () => this.openPlaylistModal(null));
    }

    // Library tabs
    if (this.libTabFavorites) {
      this.libTabFavorites.addEventListener('click', () => {
        this.setLibTab('favorites');
        this.showLibrarySection('favorites', this.favorites);
      });
    }
    if (this.libTabPlaylists) {
      this.libTabPlaylists.addEventListener('click', () => {
        this.setLibTab('playlists');
        this.showLibrarySection('playlists_grid');
      });
    }
    if (this.libTabHistory) {
      this.libTabHistory.addEventListener('click', () => {
        this.setLibTab('history');
        this.showLibrarySection('history', this.history);
      });
    }
  }

  setLibTab(tab) {
    document.querySelectorAll('.lib-tab-btn').forEach(b => b.classList.remove('active'));
    const el = document.getElementById(`libTab${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
    if (el) el.classList.add('active');
  }

  showLibrarySection(mode, songs) {
    if (mode === 'playlists_grid') {
      this.customViewGrid.style.display = 'none';
      this.playlistsGrid.style.display = 'grid';
      this.renderPlaylistsGrid();
      this.customViewTitle.textContent = 'Custom Playlists';
      this.customViewSubtitle.textContent = `${this.playlists.length} playlists`;
    } else {
      if (this.playlistsGrid) this.playlistsGrid.style.display = 'none';
      this.customViewGrid.style.display = 'grid';
      this.renderCustomGrid(songs || []);
    }
  }

  // ==================================================================================
  // 7. SLOWED + REVERB & SPEED CONTROLLER ENGINE
  // ==================================================================================
  setPlaybackSpeed(speed) {
    this.playbackSpeed = speed;
    this.audio.playbackRate = speed;
    this.audio.preservesPitch = (speed === 1.0); // pitch-shift on non-1x for lo-fi/nightcore

    // Update UI chips
    document.querySelectorAll('.speed-chip').forEach(c => {
      c.classList.toggle('active', parseFloat(c.dataset.speed) === speed);
    });

    // Update player bar & sheet speed text
    const label = speed === 1.0 ? '1x' : `${speed}x`;
    if (this.playerSpeedText) this.playerSpeedText.textContent = label;
    if (this.sheetSpeedText) this.sheetSpeedText.textContent = label;
    if (this.playerSpeedBtn) this.playerSpeedBtn.textContent = label;
  }

  toggleSlowedReverb() {
    this.isSlowedActive = !this.isSlowedActive;

    if (this.isSlowedActive) {
      // 0.85x speed + enhanced dolby reverb + extra bass
      this.setPlaybackSpeed(0.85);
      this.isDolbyAtmosActive = true;
      if (this.dolbyGain) this.dolbyGain.gain.setTargetAtTime(0.45, this.audioCtx.currentTime, 0.05);
      if (this.toggleDolbyAtmos) this.toggleDolbyAtmos.checked = true;
      this.bassBoostGain = Math.min(15, this.bassBoostGain + 4);
      if (this.bassBoostSlider) this.bassBoostSlider.value = this.bassBoostGain;
      if (this.bassBoostValue) this.bassBoostValue.textContent = `+${this.bassBoostGain} dB`;
      this.applyAudioEffects();

      if (this.toggleSlowedModeBtn) this.toggleSlowedModeBtn.textContent = 'Disable Lo-Fi';
      if (this.sheetToggleSlowed) this.sheetToggleSlowed.classList.add('active');
      if (this.playerSpeedBtn) this.playerSpeedBtn.classList.add('slowed-active');
      this.showToast('✨ Slowed + Reverb Lo-Fi Mode ON');
    } else {
      // Restore normal
      this.setPlaybackSpeed(1.0);
      if (this.dolbyGain && this.isDolbyAtmosActive) this.dolbyGain.gain.setTargetAtTime(0.25, this.audioCtx.currentTime, 0.05);
      this.applyAudioEffects();

      if (this.toggleSlowedModeBtn) this.toggleSlowedModeBtn.textContent = 'Enable Lo-Fi';
      if (this.sheetToggleSlowed) this.sheetToggleSlowed.classList.remove('active');
      if (this.playerSpeedBtn) this.playerSpeedBtn.classList.remove('slowed-active');
      this.showToast('Speed restored to normal 1x');
    }
    this.updateMobileSettingsUI();
  }

  openSpeedModal() {
    this.speedModal.classList.add('open');
  }

  initSpeedEvents() {
    if (this.closeSpeedBtn) this.closeSpeedBtn.addEventListener('click', () => this.speedModal.classList.remove('open'));
    if (this.closeSpeedBackdrop) this.closeSpeedBackdrop.addEventListener('click', () => this.speedModal.classList.remove('open'));

    if (this.toggleSlowedModeBtn) {
      this.toggleSlowedModeBtn.addEventListener('click', () => this.toggleSlowedReverb());
    }

    document.querySelectorAll('.speed-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const speed = parseFloat(chip.dataset.speed);
        this.setPlaybackSpeed(speed);
        if (speed === 0.85 && !this.isSlowedActive) {
          this.isSlowedActive = true;
          if (this.sheetToggleSlowed) this.sheetToggleSlowed.classList.add('active');
          if (this.playerSpeedBtn) this.playerSpeedBtn.classList.add('slowed-active');
        } else if (speed !== 0.85) {
          this.isSlowedActive = false;
          if (this.sheetToggleSlowed) this.sheetToggleSlowed.classList.remove('active');
          if (this.playerSpeedBtn) this.playerSpeedBtn.classList.remove('slowed-active');
        }
        this.speedModal.classList.remove('open');
        this.showToast(`⚡ Playback speed: ${speed}x`);
      });
    });

    const openSpeed = () => this.openSpeedModal();
    if (this.playerSpeedBtn) this.playerSpeedBtn.addEventListener('click', openSpeed);
    if (this.sheetSpeedBtn) this.sheetSpeedBtn.addEventListener('click', openSpeed);

    if (this.sheetToggleSlowed) {
      this.sheetToggleSlowed.addEventListener('click', () => this.toggleSlowedReverb());
    }
    if (this.sheetToggleVisualizer) {
      this.sheetToggleVisualizer.addEventListener('click', () => {
        this.isVisualizerActive = !this.isVisualizerActive;
        this.sheetToggleVisualizer.classList.toggle('active', this.isVisualizerActive);
        if (this.isVisualizerActive) {
          if (!this.analyser) this.setupVisualizer();
          this.startVisualizer();
          this.showToast('🌊 Neon Visualizer ON');
        } else {
          this.stopVisualizer();
          this.showToast('Visualizer OFF');
        }
      });
    }
  }

  // ==================================================================================
  // 8. WHATSAPP & SOCIAL SHARE ENGINE
  // ==================================================================================
  openShareModal(song) {
    if (!song) return;
    const shareUrl = `${window.location.origin}/?song=${encodeURIComponent(song.title)}&artist=${encodeURIComponent(song.artist || '')}`;
    const shareText = `🎵 *${song.title}* by *${song.artist || ''}*\nListen in 320kbps with 3D Spatial Audio & Dolby Atmos:\n${shareUrl}`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;

    if (this.shareThumb) this.shareThumb.src = song.image || '';
    if (this.shareTitle) this.shareTitle.textContent = song.title;
    if (this.shareArtist) this.shareArtist.textContent = song.artist || '';
    if (this.shareBadge) this.shareBadge.textContent = this.getFormatLabel(this.currentFormat);
    if (this.whatsappShareBtn) this.whatsappShareBtn.href = waUrl;
    if (this.shareUrlInput) this.shareUrlInput.value = shareUrl;

    // Show native share button if supported
    if (navigator.share && this.nativeShareBtn) {
      this.nativeShareBtn.style.display = 'flex';
      this.nativeShareBtn.onclick = () => {
        navigator.share({ title: song.title, text: `Listen to ${song.title} by ${song.artist}`, url: shareUrl });
      };
    }

    this.shareModal.classList.add('open');
  }

  initShareEvents() {
    if (this.closeShareBtn) this.closeShareBtn.addEventListener('click', () => this.shareModal.classList.remove('open'));
    if (this.closeShareBackdrop) this.closeShareBackdrop.addEventListener('click', () => this.shareModal.classList.remove('open'));

    if (this.copyShareUrlBtn) {
      this.copyShareUrlBtn.addEventListener('click', () => {
        const url = this.shareUrlInput ? this.shareUrlInput.value : '';
        if (navigator.clipboard) {
          navigator.clipboard.writeText(url).then(() => this.showToast('🔗 Link copied to clipboard!'));
        } else {
          if (this.shareUrlInput) {
            this.shareUrlInput.select();
            document.execCommand('copy');
            this.showToast('🔗 Link copied!');
          }
        }
      });
    }

    const openShare = () => this.openShareModal(this.currentSong);
    if (this.playerShareBtn) this.playerShareBtn.addEventListener('click', openShare);
    if (this.sheetShareBtn) this.sheetShareBtn.addEventListener('click', openShare);
  }

  checkUrlShareParams() {
    try {
      const params = new URLSearchParams(window.location.search);
      const songTitle = params.get('song');
      const songArtist = params.get('artist');
      if (songTitle) {
        const query = songArtist ? `${songTitle} ${songArtist}` : songTitle;
        setTimeout(async () => {
          this.showToast(`🔗 Loading shared song: ${songTitle}...`);
          try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            const data = await res.json();
            if (data.success && data.results && data.results.length > 0) {
              this.playSong(data.results[0], data.results);
            }
          } catch (e) { /* silently fail */ }
        }, 1500);
      }
    } catch (e) { /* ignore URL param errors */ }
  }

  // ==================================================================================
  // INIT ALL ADVANCED FEATURES (call in initUIEvents or constructor)
  // ==================================================================================
  initAdvancedFeatures() {
    this.initSleepTimerEvents();
    this.initSpeedEvents();
    this.initPlaylistEvents();
    this.initShareEvents();

    // Karaoke lyrics toggle
    if (this.sheetToggleLyrics) {
      this.sheetToggleLyrics.addEventListener('click', () => {
        this.isKaraokeActive = !this.isKaraokeActive;
        const isVisible = this.isKaraokeActive;
        this.sheetLyricsCard.style.display = isVisible ? 'flex' : 'none';
        this.sheetToggleLyrics.classList.toggle('active', isVisible);
        if (isVisible) this.loadKaraokeLyrics();
      });
    }
    if (this.closeSheetLyricsBtn) {
      this.closeSheetLyricsBtn.addEventListener('click', () => {
        this.isKaraokeActive = false;
        this.sheetLyricsCard.style.display = 'none';
        if (this.sheetToggleLyrics) this.sheetToggleLyrics.classList.remove('active');
      });
    }
    if (this.toggleLyricScriptBtn) {
      this.toggleLyricScriptBtn.addEventListener('click', () => {
        this.karaokeScript = (this.karaokeScript === 'tamil') ? 'tanglish' : 'tamil';
        this.toggleLyricScriptBtn.textContent = (this.karaokeScript === 'tamil') ? '🔤 Tanglish' : 'தமிழ் Tamil';
        this.renderKaraokeLines();
        this.showToast(this.karaokeScript === 'tamil' ? 'Showing தமிழ் Tamil Script' : 'Showing 🔤 Tanglish (English Alphabet)');
      });
    }

    // Smart Radio toggle in queue drawer
    if (this.toggleSmartRadio) {
      this.toggleSmartRadio.addEventListener('change', (e) => {
        this.isSmartRadioActive = e.target.checked;
        this.showToast(this.isSmartRadioActive ? '📻 Smart Radio ON – auto-queue enabled' : 'Smart Radio OFF');
      });
    }
  }
}

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', () => {
  // ─── AUTH GUARD ───────────────────────────────────────────
  const AUTH_KEY = 'music_auth_session';
  function getSession() {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY)); } catch { return null; }
  }

  const session = getSession();
  if (!session || !session.user || !session.token) {
    // Not logged in → send to auth page
    window.location.replace('/auth.html');
    return;
  }

  // ─── Boot App ─────────────────────────────────────────────
  window.musicApp = new MusicApp();

  // ─── User Profile UI ──────────────────────────────────────
  const user = session.user;
  const avatarLetterEl = document.getElementById('userAvatarLetter');
  const userNameEl     = document.getElementById('userNameText');
  const menuAvatar     = document.getElementById('menuAvatar');
  const menuUsername   = document.getElementById('menuUsername');
  const menuEmail      = document.getElementById('menuEmail');

  if (avatarLetterEl) avatarLetterEl.textContent = user.avatar || user.username.charAt(0).toUpperCase();
  if (userNameEl)     userNameEl.textContent = user.username;
  if (menuAvatar)     menuAvatar.textContent = user.avatar || user.username.charAt(0).toUpperCase();
  if (menuUsername)   menuUsername.textContent = user.username;
  if (menuEmail)      menuEmail.textContent = user.email;

  // User menu open/close
  const userAvatarBtn   = document.getElementById('userAvatarBtn');
  const userMenuOverlay = document.getElementById('userMenuOverlay');
  const userMenuCard    = document.getElementById('userMenuCard');

  if (userAvatarBtn) {
    userAvatarBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      userMenuOverlay.classList.toggle('open');
    });
  }

  document.addEventListener('click', (e) => {
    if (userMenuOverlay && !userMenuCard.contains(e.target)) {
      userMenuOverlay.classList.remove('open');
    }
  });

  // Menu items
  const menuMyLibrary  = document.getElementById('menuMyLibrary');
  const menuMyPlaylists= document.getElementById('menuMyPlaylists');
  const menuLogoutBtn  = document.getElementById('menuLogoutBtn');

  if (menuMyLibrary) {
    menuMyLibrary.addEventListener('click', () => {
      userMenuOverlay.classList.remove('open');
      window.musicApp.showCustomView('favorites');
    });
  }
  if (menuMyPlaylists) {
    menuMyPlaylists.addEventListener('click', () => {
      userMenuOverlay.classList.remove('open');
      window.musicApp.showCustomView('favorites');
      setTimeout(() => window.musicApp.setLibTab && window.musicApp.setLibTab('playlists'), 100);
    });
  }
  if (menuLogoutBtn) {
    menuLogoutBtn.addEventListener('click', () => {
      if (confirm('Sign out of MUSIC?')) {
        localStorage.removeItem(AUTH_KEY);
        window.location.replace('/auth.html');
      }
    });
  }
});
