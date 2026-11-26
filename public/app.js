/**
 * MUSIC - Client Audio Player & Spatial Audio DSP Engine
 * Built for Old to New Tamil, Malayalam, Hindi, Telugu, and English songs.
 * Features: 320kbps MP4/MP3, 3D Spatial Audio, Dolby Atmos Cinema Mode,
 * Anti-Clipping Limiter (Zero Noise/Crackle), Bluetooth Detection & Spotify UI.
 */

class MusicApp {
  constructor() {
    this.audio = document.getElementById('audioElement');
    const _isMobileDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 1 && /Macintosh/i.test(navigator.userAgent));
    this._isMobileDevice = _isMobileDevice;

    // Mobile optimization: Use direct native hardware decoding (prevents Web Audio buffer underrun crackle)
    // Desktop: Use anonymous CORS for full 320k Web Audio DSP Suite
    if (this.audio) {
      this.audio.crossOrigin = 'anonymous';
      this.audio.preload = 'auto';
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
    this.isSmartRadioActive = localStorage.getItem('music_smart_radio_active') !== 'false';
    this.isSlowedActive = false;
    this.playbackSpeed = 1.0;
    this.deferredPrompt = null;
    this.activePlaylistId = null;
    this.playlistTargetSong = null;

    // ── NEW FEATURES STATE ──────────────────────────────────────────────────
    this.is8DAudioActive = false;       // Feature 2: 8D Rotating Audio
    this.isVocalCutActive = false;      // Feature 2: Karaoke Vocal Remover
    this.isCrossfadeActive = false;     // Feature 4: Crossfade/Gapless
    this.crossfadeDuration = 5;         // seconds of overlap
    this._crossfadeTimeout = null;
    this._8dPannerRotateId = null;      // RAF ID for 8D rotation
    this.isCinemaModeActive = false;    // Feature 5: Cinema Mode
    this.offlineDb = null;              // Feature 6: IndexedDB
    this._voiceRecognition = null;      // Feature 3: Voice Search

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
    this.loadDynamicTrendingTags();
    this.updateFavoritesCount();
    this.updateQualityUI();
    this.initPWA();
    this.renderSidebarPlaylists();
    this.checkUrlShareParams();
    this.updateAudioEffectsUI();
    this.initVoiceSearch();
    this.initOfflineDb();
    this.initCinemaMode();
    this.init10BandEqualizer();
    this.initCarMode();
    this.initListeningStats();
    this.initSongRecognizer();
    this.initRadioEvents();
    this.initJamEvents();
    this.initMoodVibeEvents();
    this.initPipPlayer();
    this.initAmbientSoundscapes();
    this.initLiveTamilFm();
    this.initBatchAlbumOffline();

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
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      if (!this.audioCtx) {
        // latencyHint: 'playback' ensures large, safe audio buffer (stops underrun noise on mobile & desktop)
        this.audioCtx = new AudioContext({ latencyHint: 'playback' });
      }

      // Master Input Headroom Gain (prevents digital clipping when bass/EQ is boosted)
      this.inputGain = this.audioCtx.createGain();
      this.inputGain.gain.value = 0.70;

      // Super Bass Boost Filter (Low-shelf at 85Hz - punchy, chest-thumping sub-bass)
      this.bassFilter = this.audioCtx.createBiquadFilter();
      this.bassFilter.type = 'lowshelf';
      this.bassFilter.frequency.value = 85;
      this.bassFilter.gain.value = this.bassBoostGain || 0;

      // Vocal Clarity Filter (Peaking at 3100Hz - razor-sharp front vocals)
      this.vocalFilter = this.audioCtx.createBiquadFilter();
      this.vocalFilter.type = 'peaking';
      this.vocalFilter.frequency.value = 3100;
      this.vocalFilter.Q.value = 1.2;
      this.vocalFilter.gain.value = this.isVocalClarityActive ? 6.0 : 0;

      // Vocal De-Mud Filter (Dips 260Hz boxiness when Vocal Clarity active)
      this.vocalDeMudFilter = this.audioCtx.createBiquadFilter();
      this.vocalDeMudFilter.type = 'peaking';
      this.vocalDeMudFilter.frequency.value = 260;
      this.vocalDeMudFilter.Q.value = 1.0;
      this.vocalDeMudFilter.gain.value = this.isVocalClarityActive ? -3.0 : 0;

      // 10-Band Graphic Equalizer Filters (31Hz to 16kHz)
      const eqFrequencies = [
        { freq: 31, type: 'lowshelf' },
        { freq: 63, type: 'peaking' },
        { freq: 125, type: 'peaking' },
        { freq: 250, type: 'peaking' },
        { freq: 500, type: 'peaking' },
        { freq: 1000, type: 'peaking' },
        { freq: 2000, type: 'peaking' },
        { freq: 4000, type: 'peaking' },
        { freq: 8000, type: 'peaking' },
        { freq: 16000, type: 'highshelf' }
      ];
      this.eqFilters = eqFrequencies.map((cfg, idx) => {
        const filter = this.audioCtx.createBiquadFilter();
        filter.type = cfg.type;
        filter.frequency.value = cfg.freq;
        filter.gain.value = (this.eqBandGains && this.eqBandGains[idx] !== undefined) ? this.eqBandGains[idx] : 0;
        return filter;
      });

      // Spatial Audio 3D Stereo Widener (Binaural ITD delay - wraps sound around your head)
      this.spatialDryGain = this.audioCtx.createGain();
      this.spatialWetGain = this.audioCtx.createGain();
      this.spatialDryGain.gain.value = 0.85;
      this.spatialWetGain.gain.value = this.isSpatial3DActive ? 0.60 : 0.0;

      this.splitter = this.audioCtx.createChannelSplitter(2);
      this.merger = this.audioCtx.createChannelMerger(2);
      this.delayLeft = this.audioCtx.createDelay();
      this.delayRight = this.audioCtx.createDelay();
      this.delayLeft.delayTime.value = 0.0016; // 1.6ms ITD delay
      this.delayRight.delayTime.value = 0.0008;

      // Dolby Atmos Cinema Room Ambience (Clean stereo dual-reflection acoustic hall)
      this.dolbyDelayLeft = this.audioCtx.createDelay();
      this.dolbyDelayRight = this.audioCtx.createDelay();
      this.dolbyDelayLeft.delayTime.value = 0.030; // 30ms left cinema reflection
      this.dolbyDelayRight.delayTime.value = 0.046; // 46ms right cinema reflection
      this.dolbyDampLeft = this.audioCtx.createBiquadFilter();
      this.dolbyDampRight = this.audioCtx.createBiquadFilter();
      this.dolbyDampLeft.type = 'lowpass';
      this.dolbyDampRight.type = 'lowpass';
      this.dolbyDampLeft.frequency.value = 4500; // Cinema hall warmth
      this.dolbyDampRight.frequency.value = 4500;
      this.dolbyMerger = this.audioCtx.createChannelMerger(2);
      this.dolbyGain = this.audioCtx.createGain();
      this.dolbyGain.gain.value = this.isDolbyAtmosActive ? 0.45 : 0.0;

      // Master Output Gain
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.value = 0.95;

      // Connect Media Source safely (only once)
      if (!this.sourceNode) {
        this.sourceNode = this.audioCtx.createMediaElementSource(this.audio);
      }

      // Connect Clean DSP Chain:
      // Source -> InputGain -> BassFilter -> VocalFilter -> VocalDeMud -> EQ Filters
      let lastNode = this.sourceNode;
      lastNode.connect(this.inputGain);
      lastNode = this.inputGain;

      lastNode.connect(this.bassFilter);
      lastNode = this.bassFilter;

      lastNode.connect(this.vocalFilter);
      lastNode = this.vocalFilter;

      lastNode.connect(this.vocalDeMudFilter);
      lastNode = this.vocalDeMudFilter;

      for (const eqNode of this.eqFilters) {
        lastNode.connect(eqNode);
        lastNode = eqNode;
      }

      // Path 1. Direct dry path to master
      lastNode.connect(this.spatialDryGain);
      this.spatialDryGain.connect(this.masterGain);

      // Path 2. 3D Spatial Audio binaural ITD widener to master
      lastNode.connect(this.splitter);
      this.splitter.connect(this.delayLeft, 0);
      this.splitter.connect(this.delayRight, 1);
      this.delayLeft.connect(this.merger, 0, 0);
      this.delayRight.connect(this.merger, 0, 1);
      this.merger.connect(this.spatialWetGain);
      this.spatialWetGain.connect(this.masterGain);

      // Path 3. Dolby Atmos Cinema Ambience path (separate L/R reflections into merger)
      lastNode.connect(this.dolbyDelayLeft);
      lastNode.connect(this.dolbyDelayRight);
      this.dolbyDelayLeft.connect(this.dolbyDampLeft);
      this.dolbyDelayRight.connect(this.dolbyDampRight);
      this.dolbyDampLeft.connect(this.dolbyMerger, 0, 0);
      this.dolbyDampRight.connect(this.dolbyMerger, 0, 1);
      this.dolbyMerger.connect(this.dolbyGain);
      this.dolbyGain.connect(this.masterGain);

      // Connect master output to hardware speakers/headphones
      this.masterGain.connect(this.audioCtx.destination);

      this.isDspInit = true;
      this.applyAudioEffects();
      console.log('🔊 Web Audio High-Fidelity DSP active (Zero crackling, accurate sound transformation)');
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
    // 1. ALWAYS update UI state first (both mobile & desktop)
    this.updateAudioEffectsUI();

    // 2. Hardware DSP update (applies to mobile + desktop)
    if (!this.isDspInit || !this.audioCtx) return;

    const now = this.audioCtx.currentTime;

    // Super Bass Boost (+10dB punchy low-shelf 85Hz)
    if (this.bassFilter) {
      const bassTarget = this.bassBoostGain > 0 ? this.bassBoostGain : 0;
      this.bassFilter.gain.setTargetAtTime(bassTarget, now, 0.02);
    }

    // Vocal Clarity (+6dB peaking 3.1kHz & -3dB 260Hz de-mud)
    if (this.vocalFilter) {
      this.vocalFilter.gain.setTargetAtTime(this.isVocalClarityActive ? 6.0 : 0.0, now, 0.02);
    }
    if (this.vocalDeMudFilter) {
      this.vocalDeMudFilter.gain.setTargetAtTime(this.isVocalClarityActive ? -3.0 : 0.0, now, 0.02);
    }

    // Spatial 3D Audio Wet Gain (0.60 wide 360° ITD vs 0.0 normal)
    if (this.spatialWetGain) {
      const wet = this.isSpatial3DActive ? 0.60 : 0.0;
      this.spatialWetGain.gain.setTargetAtTime(wet, now, 0.02);
    }

    // Dolby Atmos Cinema Ambience Gain (0.45 theater hall vs 0.0 dry)
    if (this.dolbyGain) {
      const dolbyVal = this.isDolbyAtmosActive ? 0.45 : 0.0;
      this.dolbyGain.gain.setTargetAtTime(dolbyVal, now, 0.02);
    }

    // Dynamic Headroom adjustment
    if (this.inputGain) {
      const targetGain = (this.isDolbyAtmosActive || this.isSpatial3DActive) ? 0.65 : 0.75;
      this.inputGain.gain.setTargetAtTime(targetGain, now, 0.02);
    }
  }

  updateAudioEffectsUI() {
    // Update Fullscreen Sheet Badges
    if (this.sheetSpatialBadge) {
      this.sheetSpatialBadge.style.display = this.isSpatial3DActive ? 'inline-block' : 'none';
    }
    if (this.sheetDolbyBadge) {
      this.sheetDolbyBadge.style.display = this.isDolbyAtmosActive ? 'inline-block' : 'none';
    }
    // Update Sheet Quick FX Buttons (active = green ON, inactive = pure black OFF)
    if (this.sheetToggle3D) {
      this.sheetToggle3D.classList.toggle('active', !!this.isSpatial3DActive);
    }
    if (this.sheetToggleDolby) {
      this.sheetToggleDolby.classList.toggle('active', !!this.isDolbyAtmosActive);
    }
    if (this.sheetToggleBass) {
      this.sheetToggleBass.classList.toggle('active', this.bassBoostGain > 0);
    }
    if (this.sheetToggleVisualizer) {
      this.sheetToggleVisualizer.classList.toggle('active', !!this.isVisualizerActive);
    }
    if (this.sheetToggleSlowed) {
      this.sheetToggleSlowed.classList.toggle('active', !!this.isSlowedModeActive);
    }
    if (this.sheetToggleLyrics) {
      this.sheetToggleLyrics.classList.toggle('active', !!this.isKaraokeActive);
    }
    const mw = document.getElementById('mobileWaveform');
    if (mw) {
      mw.style.display = this.isVisualizerActive ? 'flex' : 'none';
    }
    // Update Modal Controls
    if (this.toggleSpatial3D) {
      this.toggleSpatial3D.checked = !!this.isSpatial3DActive;
    }
    if (this.toggleDolbyAtmos) {
      this.toggleDolbyAtmos.checked = !!this.isDolbyAtmosActive;
    }
    if (this.toggleVocalClarity) {
      this.toggleVocalClarity.checked = !!this.isVocalClarityActive;
    }
    if (this.bassBoostSlider) {
      this.bassBoostSlider.value = this.bassBoostGain;
    }
    if (this.bassBoostValue) {
      this.bassBoostValue.textContent = `+${this.bassBoostGain} dB`;
    }
  }

  applyEqualizerPreset(presetName) {
    if (!this.isDspInit) {
      this.setupAudioDSP();
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    if (!this.eqFilters || !this.audioCtx) return;
    const presets = {
      dolby: [5, 4, 3, 1, 0, 1, 2, 4, 5, 3],
      spatial: [3, 2, 1, 0, 1, 2, 3, 4, 5, 6],
      bass: [12, 10, 7, 4, 1, 0, 0, 0, 1, 2],
      vocal: [-3, -2, -1, 1, 3, 5, 6, 4, 2, 1],
      rock: [6, 4, 3, 1, -1, 1, 3, 5, 6, 6],
      electronic: [8, 7, 4, 1, 0, 2, 4, 6, 7, 7],
      acoustic: [3, 2, 1, 2, 3, 2, 3, 4, 3, 2],
      flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    };

    const gains = presets[presetName] || presets.flat;
    this.eqBandGains = [...gains];
    this.eqFilters.forEach((filter, idx) => {
      if (filter && filter.gain) {
        filter.gain.setTargetAtTime(gains[idx] || 0, this.audioCtx.currentTime, 0.05);
      }
      const fader = document.getElementById(`eqFader${idx}`);
      const gainLbl = document.getElementById(`eqGain${idx}`);
      if (fader) fader.value = gains[idx] || 0;
      if (gainLbl) gainLbl.textContent = `${(gains[idx] || 0) > 0 ? '+' : ''}${gains[idx] || 0}dB`;
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
    } else if (presetName === 'vocal') {
      this.isVocalClarityActive = true;
    }

    if (this.bassBoostSlider) this.bassBoostSlider.value = this.bassBoostGain;
    if (this.bassBoostValue) this.bassBoostValue.textContent = `+${this.bassBoostGain} dB`;
    this.applyAudioEffects();
    this.showToast(`🎛️ Preset: ${presetName.toUpperCase()} activated`);
  }

  setEqBandGain(idx, gain) {
    if (!this.eqBandGains) this.eqBandGains = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    this.eqBandGains[idx] = Number(gain);
    if (!this.isDspInit) {
      this.setupAudioDSP();
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    if (this.eqFilters && this.eqFilters[idx]) {
      this.eqFilters[idx].gain.setTargetAtTime(Number(gain), this.audioCtx.currentTime, 0.02);
    }
    const gainLbl = document.getElementById(`eqGain${idx}`);
    if (gainLbl) gainLbl.textContent = `${gain > 0 ? '+' : ''}${gain}dB`;
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
      // Start visualizer if active (desktop only)
      if (this.isVisualizerActive && !this._isMobileDevice) {
        if (!this.analyser) this.setupVisualizer();
        this.startVisualizer();
      }
      // Mobile waveform: resume animation when playing
      if (this._isMobileDevice && this.isVisualizerActive) {
        const mw = document.getElementById('mobileWaveform');
        if (mw) {
          mw.style.display = 'flex';
          mw.classList.remove('paused');
        }
      }
    });

    this.audio.addEventListener('pause', () => {
      this.isPlaying = false;
      this.updatePlayStateUI();
      this.stopVisualizer();
      // Mobile waveform: pause animation
      const mw = document.getElementById('mobileWaveform');
      if (mw) mw.classList.add('paused');
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
      if (this.isCarModeActive) this._updateCarProgress();

      // ── Feature 4: Crossfade – pre-load next track when near end ──
      if (this.isCrossfadeActive && this.audio.duration) {
        const remaining = this.audio.duration - this.audio.currentTime;
        if (remaining <= this.crossfadeDuration && remaining > 0 && !this._crossfadeFired) {
          this._crossfadeFired = true;
          this._startCrossfadeOut();
        }
      } else {
        this._crossfadeFired = false;
      }

      // Cinema mode: update lyrics scroll
      if (this.isCinemaModeActive && this.isKaraokeActive && this.karaokeLyrics.length) {
        this._updateCinemaLyricsHighlight();
      }
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
        // Mobile: Try direct lower-quality CDN stream (avoid proxy — Vercel 10s timeout causes freeze)
        // Desktop: Proxy fallback acceptable
        const fallback = this.currentSong.streams.stream_160 || this.currentSong.streams.stream_96 || this.currentSong.playUrl;
        if (fallback) {
          let fallbackUrl = fallback;
          if (!this._isMobileDevice) {
            // Desktop only: use proxy fallback
            fallbackUrl = `/api/proxy-audio?url=${encodeURIComponent(fallback)}`;
          } else {
            // Mobile: direct CDN fallback (force HTTPS)
            fallbackUrl = fallback.startsWith('http:') ? fallback.replace('http:', 'https:') : fallback;
          }
          if (this.audio.src !== fallbackUrl) {
            console.log('Switching to fallback stream:', this._isMobileDevice ? 'direct CDN' : 'proxy', fallbackUrl);
            this.audio.crossOrigin = 'anonymous';
            this.audio.preload = 'auto';
            this.audio.src = fallbackUrl;
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

    const carIcon = document.getElementById('carPlayIcon');
    if (carIcon) {
      if (this.isPlaying) {
        carIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
      } else {
        carIcon.innerHTML = '<polygon points="6 4 20 12 6 20 6 4"/>';
      }
    }

    const miniPlayBtn = document.getElementById('floatingMiniPlayBtn');
    if (miniPlayBtn) {
      miniPlayBtn.textContent = this.isPlaying ? '⏸' : '▶';
    }

    if (this.broadcastJamHostSync) this.broadcastJamHostSync();
    if (this.isPipActive && this.renderPipCanvasFrame) this.renderPipCanvasFrame();
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
      if (!this.isDspInit) this.setupAudioDSP();
      if (this.audioCtx && this.audioCtx.state === 'suspended') this.audioCtx.resume();
      this.isSpatial3DActive = e.target.checked;
      this.applyAudioEffects();
      this.showToast(this.isSpatial3DActive ? '🎧 3D Spatial Audio Active' : 'Spatial Audio Off');
    });

    this.toggleDolbyAtmos.addEventListener('change', (e) => {
      if (!this.isDspInit) this.setupAudioDSP();
      if (this.audioCtx && this.audioCtx.state === 'suspended') this.audioCtx.resume();
      this.isDolbyAtmosActive = e.target.checked;
      this.applyAudioEffects();
      this.showToast(this.isDolbyAtmosActive ? '🔊 Dolby Atmos Cinema Surround Active' : 'Dolby Atmos Off');
    });

    this.toggleVocalClarity.addEventListener('change', (e) => {
      if (!this.isDspInit) this.setupAudioDSP();
      if (this.audioCtx && this.audioCtx.state === 'suspended') this.audioCtx.resume();
      this.isVocalClarityActive = e.target.checked;
      this.applyAudioEffects();
      this.showToast(this.isVocalClarityActive ? '🎙️ Vocal Clarity Active' : 'Vocal Clarity Off');
    });

    this.bassBoostSlider.addEventListener('input', (e) => {
      if (!this.isDspInit) this.setupAudioDSP();
      if (this.audioCtx && this.audioCtx.state === 'suspended') this.audioCtx.resume();
      this.bassBoostGain = parseInt(e.target.value, 10);
      this.bassBoostValue.textContent = `+${this.bassBoostGain} dB`;
      this.applyAudioEffects();
    });

    // Equalizer Preset Chips
    document.querySelectorAll('.preset-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        if (!this.isDspInit) this.setupAudioDSP();
        if (this.audioCtx && this.audioCtx.state === 'suspended') this.audioCtx.resume();
        document.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.applyEqualizerPreset(chip.dataset.preset);
      });
    });

    // Sheet Quick FX Toggles
    this.sheetToggle3D.addEventListener('click', () => {
      if (!this.isDspInit) this.setupAudioDSP();
      if (this.audioCtx && this.audioCtx.state === 'suspended') this.audioCtx.resume();
      this.isSpatial3DActive = !this.isSpatial3DActive;
      if (this.sheetToggle3D) this.sheetToggle3D.classList.toggle('active', this.isSpatial3DActive);
      if (this.toggleSpatial3D) this.toggleSpatial3D.checked = this.isSpatial3DActive;
      this.applyAudioEffects();
      this.showToast(this.isSpatial3DActive ? '🎧 3D Spatial Audio ON' : '3D Spatial Audio OFF');
    });

    this.sheetToggleDolby.addEventListener('click', () => {
      if (!this.isDspInit) this.setupAudioDSP();
      if (this.audioCtx && this.audioCtx.state === 'suspended') this.audioCtx.resume();
      this.isDolbyAtmosActive = !this.isDolbyAtmosActive;
      if (this.sheetToggleDolby) this.sheetToggleDolby.classList.toggle('active', this.isDolbyAtmosActive);
      if (this.toggleDolbyAtmos) this.toggleDolbyAtmos.checked = this.isDolbyAtmosActive;
      this.applyAudioEffects();
      this.showToast(this.isDolbyAtmosActive ? '🔊 Dolby Atmos ON' : 'Dolby Atmos OFF');
    });

    this.sheetToggleBass.addEventListener('click', () => {
      if (!this.isDspInit) this.setupAudioDSP();
      if (this.audioCtx && this.audioCtx.state === 'suspended') this.audioCtx.resume();
      this.bassBoostGain = (this.bassBoostGain > 0) ? 0 : 10;
      if (this.sheetToggleBass) this.sheetToggleBass.classList.toggle('active', this.bassBoostGain > 0);
      if (this.bassBoostSlider) this.bassBoostSlider.value = this.bassBoostGain;
      if (this.bassBoostValue) this.bassBoostValue.textContent = `+${this.bassBoostGain} dB`;

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
          this.audio.crossOrigin = 'anonymous';
          this.audio.preload = 'auto';
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
    this.currentFmStation = null;

    let playFormat = this.currentFormat;
    if (this._isMobileDevice) {
      const highFormats = ['4k', '720p', '1080p', 'mp3_320', 'mp4_320'];
      const userSetFormat = localStorage.getItem('music_format_user_set');
      if (highFormats.includes(playFormat) && !userSetFormat) {
        playFormat = '480p'; // 160kbps is smooth and stable on mobile networks
      }
    }

    const audioUrl = this.getStreamUrlForFormat(song, playFormat);

    // Ensure volume is unmuted and audible
    this.audio.muted = false;
    if (this.audio.volume === 0 || isNaN(this.audio.volume)) {
      this.audio.volume = 0.90;
      this.volumeSlider.value = 0.90;
      this.updateVolumeIcon(0.90);
    }

    // Audio context initialization on user gesture (all devices)
    if (!this.isDspInit) {
      this.setupAudioDSP();
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    // Support offline saved IndexedDB playback when offline or stream URL was stripped
    if ((!audioUrl || !navigator.onLine) && this.offlineDb) {
      this._getOfflineSong(song.id).then(rec => {
        if (rec && rec.audioBlob) {
          const blobUrl = URL.createObjectURL(rec.audioBlob);
          this.audio.removeAttribute('crossOrigin');
          this.audio.src = blobUrl;
          this.audio.load();
          this.audio.play().then(() => {
            this.isPlaying = true;
            this.updatePlayStateUI();
          }).catch(() => {});
          this.showToast(`💾 Playing offline: "${song.title}"`);
        }
      }).catch(() => {});
    }

    if (audioUrl) {
      this.audio.crossOrigin = 'anonymous';
      this.audio.preload = 'auto';
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
          setTimeout(() => {
            if (this.audioCtx && this.audioCtx.state === 'suspended') {
              this.audioCtx.resume();
            }
            this.audio.play().catch(() => {});
          }, 150);
        });
      }
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
    this.recordListeningStat(song);
    this._updateCarModeUI(song);
    if (this.broadcastJamHostSync) this.broadcastJamHostSync();
    if (this.isPipActive && this.renderPipCanvasFrame) this.renderPipCanvasFrame();
    if (this.updateJamUI) this.updateJamUI();
    if (this._updateFloatingMiniWidget) this._updateFloatingMiniWidget();

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

    // ── Feature 1: MediaSession API (Lock Screen / Notification Controls) ──
    this.updateMediaSession(song);

    // ── Feature 4: Crossfade – schedule fade-in on new track ──
    if (this.isCrossfadeActive) {
      this._applyCrossfadeIn();
    }

    // ── Feature 5: Cinema Mode – sync artwork & lyrics ──
    if (this.isCinemaModeActive) {
      this._updateCinemaContent(song);
    }
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
            <button class="card-action-btn btn-card-radio" title="Start Artist Radio (Endless Mix)">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/></svg>
            </button>
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

    const radioBtn = card.querySelector('.btn-card-radio');
    if (radioBtn) {
      radioBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.startArtistRadio(song);
      });
    }

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
        this.renderSearchResults(data.results, query, data);
      }
    } catch (e) {
      this.searchLoader.style.display = 'none';
      console.error('Search error:', e);
    }
  }

  renderSearchResults(songs, query, data = {}) {
    this.searchResultsSection.style.display = 'block';
    this.homeView.style.display = 'none';
    this.customView.style.display = 'none';

    this.searchResultsTitle.textContent = `Results for "${query}"`;
    this.searchResultsSubtitle.textContent = `Found ${songs.length} songs`;

    // Store for filter reuse
    this._lastSearchSongs = songs;
    this._lastSearchQuery = query;
    this.searchResults = songs;

    const searchActionsBar = document.getElementById('searchActionsBar');
    if (searchActionsBar) {
      searchActionsBar.style.display = songs.length > 0 ? 'flex' : 'none';
    }

    // ── 1. Top Result / Best Match Banner Card ──
    const topMatchCard = document.getElementById('searchTopMatchCard');
    const topMatch = data.topMatch || (songs.length > 0 ? songs[0] : null);
    if (topMatchCard && topMatch) {
      const tArt = document.getElementById('topMatchArt');
      const tTitle = document.getElementById('topMatchTitle');
      const tArtist = document.getElementById('topMatchArtist');
      const tAlbum = document.getElementById('topMatchAlbumTag');
      const tYear = document.getElementById('topMatchYearTag');
      const tLang = document.getElementById('topMatchLangTag');
      const tPlayBtn = document.getElementById('topMatchPlayBtn');

      if (tTitle) tTitle.textContent = topMatch.title;
      if (tArtist) tArtist.textContent = topMatch.artist || 'Unknown Artist';
      if (tArt) tArt.src = topMatch.image || topMatch.imageLow || '';
      if (tAlbum) tAlbum.textContent = topMatch.album || 'Single';
      if (tYear) tYear.textContent = topMatch.year || '2026';
      if (tLang) tLang.textContent = (topMatch.language || 'Tamil').toUpperCase();
      topMatchCard.style.display = 'block';

      if (tPlayBtn) {
        tPlayBtn.onclick = (e) => {
          e.stopPropagation();
          this.playSong(topMatch, songs);
        };
      }
      topMatchCard.onclick = () => {
        this.playSong(topMatch, songs);
      };
    } else if (topMatchCard) {
      topMatchCard.style.display = 'none';
    }

    // ── 2. Language Quick Filter Chips ──
    const langChips = document.getElementById('searchLangChips');
    if (langChips) {
      langChips.querySelectorAll('.search-lang-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.lang === 'all');
      });
      const newLangChips = langChips.cloneNode(true);
      langChips.parentNode.replaceChild(newLangChips, langChips);
      newLangChips.querySelectorAll('.search-lang-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          newLangChips.querySelectorAll('.search-lang-chip').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          const selLang = chip.dataset.lang;
          if (selLang === 'all') {
            this._applySearchFilter('all', songs);
          } else {
            const filteredByLang = songs.filter(s => (s.language || '').toLowerCase() === selLang);
            this._applySearchFilter('all', filteredByLang);
          }
        });
      });
    }

    // ── 3. Horizontal swipe shelf disabled (prevent duplicate card rows) ──
    const shelfContainer = document.getElementById('searchShelfContainer');
    if (shelfContainer) {
      shelfContainer.style.display = 'none';
      const shelfRow = document.getElementById('searchShelfRow');
      if (shelfRow) shelfRow.innerHTML = '';
    }

    // ── 4. Wire filter pills (once per new search) ──
    const filterBar = document.getElementById('searchFilterBar');
    if (filterBar) {
      // Reset to All active
      filterBar.querySelectorAll('.search-filter-pill').forEach(p => {
        p.classList.toggle('active', p.dataset.filter === 'all');
      });
      // Remove old listeners by cloning
      const newFilterBar = filterBar.cloneNode(true);
      filterBar.parentNode.replaceChild(newFilterBar, filterBar);
      newFilterBar.querySelectorAll('.search-filter-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          newFilterBar.querySelectorAll('.search-filter-pill').forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
          this._applySearchFilter(pill.dataset.filter, songs);
        });
      });
    }

    // ── 5. Show More / Collapsible Lower-Relevance Results ──
    const noiseWrapper = document.getElementById('searchNoiseWrapper');
    const noiseGrid = document.getElementById('searchNoiseGrid');
    const noiseCountLabel = document.getElementById('noiseCountLabel');
    const noiseBtn = document.getElementById('btnShowMoreResults');
    const noiseSongs = data.noise || [];

    if (noiseWrapper && noiseGrid && noiseSongs.length > 0) {
      if (noiseCountLabel) noiseCountLabel.textContent = noiseSongs.length;
      noiseWrapper.style.display = 'block';
      noiseGrid.innerHTML = '';
      noiseSongs.forEach(song => {
        const card = this.createSongCard(song, noiseSongs);
        noiseGrid.appendChild(card);
      });
      noiseGrid.style.display = 'none';
      if (noiseBtn) {
        noiseBtn.classList.remove('open');
        noiseBtn.onclick = () => {
          const isOpen = noiseGrid.style.display !== 'none';
          noiseGrid.style.display = isOpen ? 'none' : 'grid';
          noiseBtn.classList.toggle('open', !isOpen);
        };
      }
    } else if (noiseWrapper) {
      noiseWrapper.style.display = 'none';
    }

    // Show empty-state or render all songs
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

    // Default: show all songs (no filter)
    this._applySearchFilter('all', songs);
    this.searchResultsSection.scrollIntoView({ behavior: 'smooth' });
  }

  /** Sort / filter the search grid by the selected pill */
  _applySearchFilter(filter, songs) {
    let filtered = [...songs];

    if (filter === 'old-to-new') {
      filtered.sort((a, b) => (parseInt(a.year) || 9999) - (parseInt(b.year) || 9999));
    } else if (filter === 'new-to-old') {
      filtered.sort((a, b) => (parseInt(b.year) || 0) - (parseInt(a.year) || 0));
    } else if (filter === 'retro') {
      filtered = filtered.filter(s => parseInt(s.year) < 2000);
      filtered.sort((a, b) => (parseInt(a.year) || 9999) - (parseInt(b.year) || 9999));
    } else if (filter === 'albums') {
      filtered = filtered.filter(s => s.album && s.album.trim().length > 0);
    } else if (filter === 'artists') {
      filtered.sort((a, b) => (a.artist || '').localeCompare(b.artist || ''));
    }
    // 'all' — keep original order

    const grid = this.searchResultsGrid;
    grid.innerHTML = '';

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:40px 20px;color:var(--text-muted);">
          <div style="font-size:36px;margin-bottom:10px;">🎵</div>
          <h3 style="color:#fff;margin-bottom:8px;">No results for this filter</h3>
          <p style="font-size:0.88rem;">Try a different filter above</p>
        </div>`;
      return;
    }

    filtered.forEach(song => {
      const card = this.createSongCard(song, filtered);
      grid.appendChild(card);
    });
  }

  hideSearchResults() {
    this.searchResultsSection.style.display = 'none';
    this.homeView.style.display = 'block';
    // Reset filter pills to 'All'
    document.querySelectorAll('.search-filter-pill').forEach(p => {
      p.classList.toggle('active', p.dataset.filter === 'all');
    });
    // Hide swipe shelf
    const shelf = document.getElementById('searchShelfContainer');
    if (shelf) shelf.style.display = 'none';
    const topCard = document.getElementById('searchTopMatchCard');
    if (topCard) topCard.style.display = 'none';
    const noise = document.getElementById('searchNoiseWrapper');
    if (noise) noise.style.display = 'none';
  }

  async handleLanguageFilter(lang) {
    if (lang === 'all') {
      this.hideSearchResults();
      return;
    }

    // Clear search input if user clicks a language preset tab so header matches input
    if (this.searchInput) {
      this.searchInput.value = '';
      if (this.clearSearchBtn) this.clearSearchBtn.style.display = 'none';
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
        this.renderSearchResults(data.results, title, data);
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
    } else if (mode === 'radio') {
      const radioNavBtn = document.getElementById('sidebarRadioBtn');
      if (radioNavBtn) radioNavBtn.classList.add('active');
      this.customViewTitle.textContent = 'Live Tamil FM Radio';
      this.customViewSubtitle.textContent = '24x7 Non-Stop High-Definition Live Streams';
      this.setLibTab('radio');
      this.showLibrarySection('radio');
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

    // Update sheet sleep timer text (Screen 3 in now-playing sheet)
    const sheetSleepStatusText = document.getElementById('sheetSleepStatusText');
    if (sheetSleepStatusText) {
      if (timeStr) {
        sheetSleepStatusText.textContent = `${timeStr} ▾`;
        sheetSleepStatusText.style.color = '#1ed760';
        sheetSleepStatusText.style.fontWeight = '700';
      } else {
        sheetSleepStatusText.textContent = 'Off ▾';
        sheetSleepStatusText.style.color = '';
        sheetSleepStatusText.style.fontWeight = '';
      }
    }

    // Update top header badge
    const headerSleepBadge = document.getElementById('headerSleepBadge');
    if (headerSleepBadge) {
      headerSleepBadge.textContent = timeStr ? `💤 ${timeStr}` : 'TIMER';
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
    const headerSleepBtn = document.getElementById('openSleepModalBtn');
    if (headerSleepBtn) headerSleepBtn.addEventListener('click', openSleep);
    const sheetSleepRow = document.getElementById('sheetSleepRow');
    if (sheetSleepRow) sheetSleepRow.addEventListener('click', openSleep);
  }

  // ==================================================================================
  // 4. ENDLESS SMART RADIO ENGINE
  // ==================================================================================
  startArtistRadio(song) {
    if (!song) return;
    this.setSmartRadioActive(true, false);
    this.queue = [song];
    this.queueIndex = 0;
    this.playSong(song, [song], 0);
    this.showToast(`📻 Starting "${song.artist || song.title}" Artist Radio...`);
    this.fetchSmartRadioRecommendations(song, true);
  }

  async fetchSmartRadioRecommendations(currentSong, isStartOfRadio = false) {
    if (!this.isSmartRadioActive || !currentSong) return;

    const artistQuery = (currentSong.artist || '').split(/[,&]/)[0].trim();
    const query = artistQuery ? `${artistQuery} Hits` : (currentSong.album || currentSong.title);
    if (!isStartOfRadio) {
      this.showToast(`📻 Auto DJ: Fetching more songs for continuous mix...`);
    }

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.success && data.results && data.results.length > 0) {
        // Filter out songs already in queue, add up to 15 new ones
        const existing = new Set(this.queue.map(s => s.id));
        const newSongs = data.results.filter(s => !existing.has(s.id)).slice(0, 15);
        newSongs.forEach(s => this.queue.push(s));
        this.renderQueueDrawer();
        this.showToast(`📻 Radio Active: ${newSongs.length} similar songs queued`);
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
    const libTabOffline = document.getElementById('libTabOffline');
    if (libTabOffline) {
      libTabOffline.addEventListener('click', () => {
        this.setLibTab('offline');
        this.showLibrarySection('offline');
      });
    }
    const libTabStats = document.getElementById('libTabStats');
    if (libTabStats) {
      libTabStats.addEventListener('click', () => {
        this.setLibTab('stats');
        this.showLibrarySection('stats');
      });
    }
    const btnDownloadCustomOffline = document.getElementById('btnDownloadCustomOffline');
    if (btnDownloadCustomOffline) {
      btnDownloadCustomOffline.addEventListener('click', () => {
        const list = this._currentLibrarySongs || this.favorites || [];
        if (!list.length) {
          this.showToast('No songs in current library view to download.');
          return;
        }
        this.downloadBatchTracks(list, this.customViewTitle?.textContent || 'Library');
      });
    }
  }

  setLibTab(tab) {
    document.querySelectorAll('.lib-tab-btn').forEach(b => b.classList.remove('active'));
    const el = document.getElementById(`libTab${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
    if (el) el.classList.add('active');
  }

  showLibrarySection(mode, songs) {
    const statsSection = document.getElementById('statsViewSection');
    const fmRadioSection = document.getElementById('fmRadioViewSection');

    if (mode === 'radio') {
      if (this.customViewGrid) this.customViewGrid.style.display = 'none';
      if (this.playlistsGrid) this.playlistsGrid.style.display = 'none';
      if (statsSection) statsSection.style.display = 'none';
      if (fmRadioSection) fmRadioSection.style.display = 'block';
      this.customViewTitle.textContent = 'Live Tamil FM Radio';
      this.customViewSubtitle.textContent = '24x7 Non-Stop High-Definition Live Streams & Artist Radio';
      this.loadFmRadioStations();
      return;
    } else {
      if (fmRadioSection) fmRadioSection.style.display = 'none';
    }

    if (mode === 'offline') {
      if (statsSection) statsSection.style.display = 'none';
      if (this.playlistsGrid) this.playlistsGrid.style.display = 'none';
      this.customViewGrid.style.display = 'grid';
      this.customViewTitle.textContent = 'Offline Saved Songs';
      this.customViewSubtitle.textContent = 'Loading offline storage...';
      this.getOfflineSongs().then(records => {
        const offlineList = records.map(r => r.song).filter(Boolean);
        this._currentLibrarySongs = offlineList;
        this.customViewSubtitle.textContent = `${offlineList.length} songs saved for offline playback`;
        if (offlineList.length === 0) {
          this.customViewGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:50px;color:var(--text-muted);"><h3>No offline songs saved yet</h3><p style="margin-top:8px;">Search any movie/album and click <b>📦 Download All Tracks (Offline)</b> to save songs here.</p></div>';
        } else {
          this.renderCustomGrid(offlineList);
        }
      });
      return;
    }

    if (mode === 'stats') {
      if (this.customViewGrid) this.customViewGrid.style.display = 'none';
      if (this.playlistsGrid) this.playlistsGrid.style.display = 'none';
      if (statsSection) {
        statsSection.style.display = 'block';
        this.renderStatsView();
      }
      this.customViewTitle.textContent = 'Your Music Wrapped';
      this.customViewSubtitle.textContent = 'Personal streaming stats and top artists';
    } else if (mode === 'playlists_grid') {
      if (statsSection) statsSection.style.display = 'none';
      this.customViewGrid.style.display = 'none';
      this.playlistsGrid.style.display = 'grid';
      this.renderPlaylistsGrid();
      this.customViewTitle.textContent = 'Custom Playlists';
      this.customViewSubtitle.textContent = `${this.playlists.length} playlists`;
    } else {
      if (statsSection) statsSection.style.display = 'none';
      if (this.playlistsGrid) this.playlistsGrid.style.display = 'none';
      this.customViewGrid.style.display = 'grid';
      this._currentLibrarySongs = songs || [];
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
        this.updateAudioEffectsUI();

        if (this._isMobileDevice) {
          this.showToast(this.isVisualizerActive ? '🌊 Waveform ON' : 'Waveform OFF');
        } else {
          // Desktop: Real Web Audio analyser visualizer
          if (this.isVisualizerActive) {
            if (!this.analyser) this.setupVisualizer();
            this.startVisualizer();
            this.showToast('🌊 Neon Visualizer ON');
          } else {
            this.stopVisualizer();
            this.showToast('Waveform OFF');
          }
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

    const sheetLyricsPill = document.getElementById('sheetLyricsPillBtn');
    if (sheetLyricsPill && this.sheetToggleLyrics) {
      sheetLyricsPill.addEventListener('click', () => this.sheetToggleLyrics.click());
    }
    const sheetSleepRow = document.getElementById('sheetSleepRow');
    if (sheetSleepRow && this.sheetSleepBtn) {
      sheetSleepRow.addEventListener('click', () => this.sheetSleepBtn.click());
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
        this.setSmartRadioActive(e.target.checked, true);
      });
    }

    // ── Feature 2: 8D Audio ──
    const toggle8D = document.getElementById('sheetToggle8D');
    if (toggle8D) {
      toggle8D.addEventListener('click', () => this.toggle8DAudio());
    }

    // ── Feature 2: Vocal Cut (Karaoke instrumental) ──
    const toggleVocalCut = document.getElementById('sheetToggleVocalCut');
    if (toggleVocalCut) {
      toggleVocalCut.addEventListener('click', () => this.toggleVocalCutMode());
    }

    // ── Feature 4: Crossfade toggle ──
    const toggleCrossfade = document.getElementById('sheetToggleCrossfade');
    if (toggleCrossfade) {
      toggleCrossfade.addEventListener('click', () => this.toggleCrossfade());
    }

    // ── Feature 5: Cinema Mode ──
    const cinemaModeBtn = document.getElementById('sheetCinemaMode');
    if (cinemaModeBtn) {
      cinemaModeBtn.addEventListener('click', () => this.openCinemaMode());
    }

    // ── Feature 6: Save Offline ──
    const saveOfflineBtn = document.getElementById('sheetSaveOffline');
    if (saveOfflineBtn) {
      saveOfflineBtn.addEventListener('click', () => this.saveCurrentSongOffline());
    }
  }

  // ===========================================================================
  // FEATURE 1: MediaSession API — Lock Screen & Notification Controls
  // ===========================================================================
  updateMediaSession(song) {
    if (!song || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title || 'Unknown',
        artist: song.artist || 'Unknown Artist',
        album: song.album || 'Single',
        artwork: [
          { src: song.imageLow || song.image, sizes: '300x300', type: 'image/jpeg' },
          { src: song.image, sizes: '500x500', type: 'image/jpeg' }
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => {
        this.audio.play();
        navigator.mediaSession.playbackState = 'playing';
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        this.audio.pause();
        navigator.mediaSession.playbackState = 'paused';
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => this.playNext());
      navigator.mediaSession.setActionHandler('previoustrack', () => this.playPrev());
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) {
          this.audio.currentTime = details.seekTime;
        }
      });
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        this.audio.currentTime = Math.min(this.audio.duration, this.audio.currentTime + (details.seekOffset || 10));
      });
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        this.audio.currentTime = Math.max(0, this.audio.currentTime - (details.seekOffset || 10));
      });
      navigator.mediaSession.playbackState = 'playing';

      // Keep position state in sync for lock screen scrubber
      this.audio.addEventListener('timeupdate', () => {
        if ('setPositionState' in navigator.mediaSession && this.audio.duration) {
          try {
            navigator.mediaSession.setPositionState({
              duration: this.audio.duration,
              playbackRate: this.audio.playbackRate || 1,
              position: this.audio.currentTime
            });
          } catch (e) {}
        }
      }, { once: false });

    } catch (e) {
      console.warn('MediaSession update failed:', e);
    }
  }

  // ===========================================================================
  // FEATURE 2a: 8D Rotating Binaural Audio
  // ===========================================================================
  toggle8DAudio() {
    this.is8DAudioActive = !this.is8DAudioActive;
    const btn = document.getElementById('sheetToggle8D');
    if (btn) btn.classList.toggle('active', this.is8DAudioActive);

    if (this.is8DAudioActive) {
      if (!this.isDspInit) this.setupAudioDSP();
      this.start8DRotation();
      this.showToast('🌐 8D Audio ON – wear headphones!');
    } else {
      this.stop8DRotation();
      this.showToast('8D Audio OFF');
    }
  }

  start8DRotation() {
    if (!this.audioCtx) return;

    // Create stereo panner if not exists
    if (!this.panner8D) {
      this.panner8D = this.audioCtx.createStereoPanner();
      // Insert before masterGain
      if (this.masterGain) {
        // Reconnect: masterGain takes its input from panner8D
        // We inject panner8D between the existing spatial/dolby paths and masterGain
        this.panner8D.connect(this.audioCtx.destination);
        this.masterGain.disconnect(this.audioCtx.destination);
        this.masterGain.connect(this.panner8D);
      }
    }

    let angle = 0;
    const rotate = () => {
      if (!this.is8DAudioActive) return;
      angle = (angle + 1) % 360;
      const panVal = Math.sin(angle * Math.PI / 180); // -1 to +1
      if (this.panner8D) this.panner8D.pan.setTargetAtTime(panVal, this.audioCtx.currentTime, 0.05);
      this._8dPannerRotateId = requestAnimationFrame(rotate);
    };
    if (this._8dPannerRotateId) cancelAnimationFrame(this._8dPannerRotateId);
    rotate();
  }

  stop8DRotation() {
    if (this._8dPannerRotateId) {
      cancelAnimationFrame(this._8dPannerRotateId);
      this._8dPannerRotateId = null;
    }
    // Reset panner to center
    if (this.panner8D) {
      this.panner8D.pan.setTargetAtTime(0, this.audioCtx.currentTime, 0.1);
    }
  }

  // ===========================================================================
  // FEATURE 2b: Vocal Cut / Karaoke Instrumental (Center channel null)
  // ===========================================================================
  toggleVocalCutMode() {
    this.isVocalCutActive = !this.isVocalCutActive;
    const btn = document.getElementById('sheetToggleVocalCut');
    if (btn) btn.classList.toggle('active', this.isVocalCutActive);

    if (!this.isDspInit) this.setupAudioDSP();

    if (this.isVocalCutActive) {
      // Apply extreme vocal notch filter: deep cut at 300Hz–3.5kHz (vocal presence band)
      if (this.vocalFilter) {
        this.vocalFilter.frequency.value = 1200;
        this.vocalFilter.Q.value = 0.5;
        this.vocalFilter.gain.setTargetAtTime(-24, this.audioCtx.currentTime, 0.05);
      }
      if (this.vocalDeMudFilter) {
        this.vocalDeMudFilter.frequency.value = 2800;
        this.vocalDeMudFilter.Q.value = 0.5;
        this.vocalDeMudFilter.gain.setTargetAtTime(-18, this.audioCtx.currentTime, 0.05);
      }
      this.showToast('🎸 Vocal Cut ON – instrumental/karaoke mode');
    } else {
      // Restore normal vocal filters
      if (this.isVocalClarityActive) {
        if (this.vocalFilter) {
          this.vocalFilter.frequency.value = 3100;
          this.vocalFilter.Q.value = 1.2;
          this.vocalFilter.gain.setTargetAtTime(6.0, this.audioCtx.currentTime, 0.05);
        }
        if (this.vocalDeMudFilter) {
          this.vocalDeMudFilter.frequency.value = 260;
          this.vocalDeMudFilter.Q.value = 1.0;
          this.vocalDeMudFilter.gain.setTargetAtTime(-3.0, this.audioCtx.currentTime, 0.05);
        }
      } else {
        if (this.vocalFilter) this.vocalFilter.gain.setTargetAtTime(0, this.audioCtx.currentTime, 0.05);
        if (this.vocalDeMudFilter) this.vocalDeMudFilter.gain.setTargetAtTime(0, this.audioCtx.currentTime, 0.05);
      }
      this.showToast('Vocal Cut OFF – normal audio restored');
    }
  }

  // ===========================================================================
  // FEATURE 3: Voice Search (Speech Recognition)
  // ===========================================================================
  initVoiceSearch() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const voiceBtn = document.getElementById('voiceSearchBtn');

    if (!SpeechRecognition || !voiceBtn) {
      if (voiceBtn) voiceBtn.style.display = 'none';
      return;
    }

    // Show mic button since API is supported
    voiceBtn.style.display = 'flex';

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US'; // English language only
    recognition.maxAlternatives = 1;
    this._voiceRecognition = recognition;

    let isListening = false;

    voiceBtn.addEventListener('click', () => {
      if (isListening) {
        recognition.stop();
        return;
      }

      try {
        recognition.lang = 'en-US';
        recognition.start();
        isListening = true;
        voiceBtn.classList.add('listening');
        voiceBtn.title = '🎙️ Listening... Speak in English';
        this.showToast('🎙️ Voice Search: Listening... Speak in English');
      } catch (e) {
        this.showToast('🎙️ Voice search not available in this browser');
      }
    });

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (this.searchInput) {
        this.searchInput.value = transcript;
        if (this.clearSearchBtn) this.clearSearchBtn.style.display = 'block';
        this.performSearch(transcript);
        this.showToast(`🎙️ Searching: "${transcript}"`);
      }
    };

    recognition.onend = () => {
      isListening = false;
      voiceBtn.classList.remove('listening');
      voiceBtn.title = 'Voice Search (English)';
    };

    recognition.onerror = (event) => {
      isListening = false;
      voiceBtn.classList.remove('listening');
      if (event.error === 'no-speech') {
        this.showToast('🎙️ No speech detected. Try again!');
      } else {
        this.showToast('🎙️ Voice search: ' + event.error);
      }
    };
  }

  // ===========================================================================
  // FEATURE 4: Crossfade & Gapless Playback
  // ===========================================================================
  toggleCrossfade() {
    this.isCrossfadeActive = !this.isCrossfadeActive;
    const btn = document.getElementById('sheetToggleCrossfade');
    if (btn) btn.classList.toggle('active', this.isCrossfadeActive);
    this._crossfadeFired = false;
    this.showToast(this.isCrossfadeActive
      ? `🎚️ Crossfade ON (${this.crossfadeDuration}s smooth transitions)`
      : 'Crossfade OFF');
  }

  _startCrossfadeOut() {
    if (!this.isDspInit || !this.masterGain || !this.audioCtx) return;
    const dur = this.crossfadeDuration;
    const now = this.audioCtx.currentTime;
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(0.0, now + dur);

    // Schedule next track after (dur - 0.3)s
    setTimeout(() => {
      this.playNext();
    }, (dur - 0.3) * 1000);
  }

  _applyCrossfadeIn() {
    if (!this.isDspInit || !this.masterGain || !this.audioCtx) return;
    const now = this.audioCtx.currentTime;
    this.masterGain.gain.setValueAtTime(0.0, now);
    this.masterGain.gain.linearRampToValueAtTime(0.95, now + this.crossfadeDuration);
    this._crossfadeFired = false;
  }

  // ===========================================================================
  // FEATURE 5: Fullscreen Ambient Cinema Mode
  // ===========================================================================
  initCinemaMode() {
    const closeBtn = document.getElementById('closeCinemaBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeCinemaMode());
    }
    // ESC key exits cinema
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isCinemaModeActive) {
        this.closeCinemaMode();
      }
    });
  }

  openCinemaMode() {
    if (!this.currentSong) {
      this.showToast('▶️ Play a song first to enter Cinema Mode!');
      return;
    }
    this.isCinemaModeActive = true;
    const overlay = document.getElementById('cinemaModeOverlay');
    if (overlay) overlay.style.display = 'flex';

    this._updateCinemaContent(this.currentSong);

    // Auto-load lyrics for cinema
    if (this.karaokeLyrics.length === 0 && this.currentSong) {
      this.loadKaraokeLyrics().then(() => {
        this._renderCinemaLyrics();
      });
    } else {
      this._renderCinemaLyrics();
    }

    const btn = document.getElementById('sheetCinemaMode');
    if (btn) btn.classList.add('active');
    this.showToast('🎬 Cinema Mode activated! Press ESC to exit');
  }

  closeCinemaMode() {
    this.isCinemaModeActive = false;
    const overlay = document.getElementById('cinemaModeOverlay');
    if (overlay) overlay.style.display = 'none';
    const btn = document.getElementById('sheetCinemaMode');
    if (btn) btn.classList.remove('active');
  }

  _updateCinemaContent(song) {
    const cinemaArt = document.getElementById('cinemaArtwork');
    const cinemaTitle = document.getElementById('cinemaSongTitle');
    const cinemaArtist = document.getElementById('cinemaSongArtist');
    const cinemaBg = document.getElementById('cinemaBgCanvas');

    if (cinemaArt) cinemaArt.src = song.image;
    if (cinemaTitle) cinemaTitle.textContent = song.title;
    if (cinemaArtist) cinemaArtist.textContent = `${song.artist || ''} ${song.album ? '• ' + song.album : ''}`.trim();

    // Animate ambient background gradient from album art dominant color
    // We approximate using a rotating hue based on the song ID hash
    if (cinemaBg && song.id) {
      const hue = Array.from(song.id).reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
      cinemaBg.style.background = `
        radial-gradient(ellipse at 20% 30%, hsla(${hue}, 80%, 25%, 0.9), transparent 60%),
        radial-gradient(ellipse at 80% 70%, hsla(${(hue + 120) % 360}, 70%, 20%, 0.8), transparent 60%),
        radial-gradient(ellipse at 50% 50%, hsla(${(hue + 240) % 360}, 60%, 15%, 0.7), transparent 70%),
        #0a0a0f
      `;
    }

    // Pulse the rings
    this._pulseCinemaRings(song);
  }

  _pulseCinemaRings(song) {
    const rings = document.getElementById('cinemaRings');
    if (!rings) return;
    if (rings._pulseInterval) clearInterval(rings._pulseInterval);
    let scale = 1;
    rings._pulseInterval = setInterval(() => {
      scale = scale === 1 ? 1.08 : 1;
      rings.style.transform = `scale(${scale})`;
      rings.style.opacity = scale === 1 ? '0.5' : '0.8';
    }, 800);
  }

  _renderCinemaLyrics() {
    const container = document.getElementById('cinemaLyricsContainer');
    if (!container || !this.karaokeLyrics.length) return;

    container.innerHTML = '';
    this.karaokeLyrics.forEach((line, idx) => {
      const div = document.createElement('div');
      div.className = 'cinema-lyric-line';
      div.dataset.idx = idx;
      div.textContent = line.tamilText || line.tanglishText || '';
      div.addEventListener('click', () => {
        if (line.time >= 0) this.audio.currentTime = line.time;
      });
      container.appendChild(div);
    });
  }

  _updateCinemaLyricsHighlight() {
    const container = document.getElementById('cinemaLyricsContainer');
    if (!container) return;
    const t = this.audio.currentTime;
    let activeIdx = -1;
    for (let i = 0; i < this.karaokeLyrics.length; i++) {
      if (this.karaokeLyrics[i].time <= t) activeIdx = i;
      else break;
    }
    container.querySelectorAll('.cinema-lyric-line').forEach((el, i) => {
      el.classList.remove('cinema-lyric-active', 'cinema-lyric-past');
      if (i === activeIdx) {
        el.classList.add('cinema-lyric-active');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (i < activeIdx) {
        el.classList.add('cinema-lyric-past');
      }
    });
  }

  // ===========================================================================
  // FEATURE 6: Offline IndexedDB Song Storage
  // ===========================================================================
  async initOfflineDb() {
    try {
      this.offlineDb = await new Promise((resolve, reject) => {
        const req = indexedDB.open('MusicOfflineDB', 1);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('songs')) {
            db.createObjectStore('songs', { keyPath: 'id' });
          }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = () => reject(req.error);
      });
      console.log('💾 IndexedDB offline store ready');
    } catch (e) {
      console.warn('IndexedDB not available:', e);
      this.offlineDb = null;
    }
  }

  async saveCurrentSongOffline() {
    if (!this.currentSong) {
      this.showToast('▶️ Play a song first!');
      return;
    }
    if (!this.offlineDb) {
      this.showToast('❌ Offline storage not available in this browser');
      return;
    }

    const song = this.currentSong;
    const rawUrl = this.getStreamUrlForFormat(song, '720p');
    if (!rawUrl) {
      this.showToast('❌ Stream URL not available for offline save');
      return;
    }

    // Show offline toaster
    const toaster = document.getElementById('offlineToaster');
    const toasterText = document.getElementById('offlineToasterText');
    const progressFill = document.getElementById('offlineProgressFill');
    if (toaster) toaster.style.display = 'flex';
    if (toasterText) toasterText.textContent = `💾 Saving "${song.title}"...`;
    if (progressFill) progressFill.style.width = '5%';

    try {
      // Check if already saved
      const existing = await this._getOfflineSong(song.id);
      if (existing) {
        this.showToast(`✅ "${song.title}" already saved offline!`);
        if (toaster) setTimeout(() => toaster.style.display = 'none', 2000);
        return;
      }

      // Animate progress
      let progress = 5;
      const progInterval = setInterval(() => {
        progress = Math.min(progress + 10, 85);
        if (progressFill) progressFill.style.width = progress + '%';
      }, 300);

      // Fetch audio blob via proxy
      const response = await fetch(`/api/proxy-audio?url=${encodeURIComponent(rawUrl)}`);
      if (!response.ok) throw new Error('Fetch failed');
      const audioBlob = await response.blob();

      clearInterval(progInterval);
      if (progressFill) progressFill.style.width = '95%';

      // Store in IndexedDB
      await this._storeOfflineSong({
        id: song.id,
        song: { ...song, streams: null, playUrl: null }, // Strip stream URLs
        audioBlob,
        savedAt: Date.now()
      });

      if (progressFill) progressFill.style.width = '100%';
      if (toasterText) toasterText.textContent = `✅ "${song.title}" saved offline!`;
      setTimeout(() => { if (toaster) toaster.style.display = 'none'; }, 2500);
      this.showToast(`💾 "${song.title}" saved for offline playback!`);

    } catch (err) {
      console.error('Offline save failed:', err);
      if (toasterText) toasterText.textContent = `❌ Save failed: ${err.message}`;
      setTimeout(() => { if (toaster) toaster.style.display = 'none'; }, 3000);
      this.showToast(`❌ Offline save failed. Check connection.`);
    }
  }

  _storeOfflineSong(record) {
    return new Promise((resolve, reject) => {
      const tx = this.offlineDb.transaction('songs', 'readwrite');
      tx.objectStore('songs').put(record);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  _getOfflineSong(id) {
    return new Promise((resolve, reject) => {
      const tx = this.offlineDb.transaction('songs', 'readonly');
      const req = tx.objectStore('songs').get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async getOfflineSongs() {
    if (!this.offlineDb) return [];
    return new Promise((resolve, reject) => {
      const tx = this.offlineDb.transaction('songs', 'readonly');
      const req = tx.objectStore('songs').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async playOfflineSong(id) {
    const record = await this._getOfflineSong(id);
    if (!record) { this.showToast('Song not saved offline'); return; }
    const blobUrl = URL.createObjectURL(record.audioBlob);
    this.audio.src = blobUrl;
    this.audio.load();
    this.audio.play();
    this.currentSong = record.song;
    this.updateMediaSession(record.song);
    this.showToast(`💾 Playing offline: "${record.song.title}"`);
  }

  // ===========================================================================
  // FEATURE 1: 10-Band Graphic Equalizer Faders
  // ===========================================================================
  init10BandEqualizer() {
    for (let i = 0; i < 10; i++) {
      const fader = document.getElementById(`eqFader${i}`);
      if (fader) {
        fader.addEventListener('input', (e) => {
          this.setEqBandGain(i, e.target.value);
        });
      }
    }

    const resetFlatBtn = document.getElementById('btnResetEqFlat');
    if (resetFlatBtn) {
      resetFlatBtn.addEventListener('click', () => {
        this.applyEqualizerPreset('flat');
        document.querySelectorAll('.preset-chip').forEach(c => {
          c.classList.toggle('active', c.dataset.preset === 'flat');
        });
      });
    }

    document.querySelectorAll('.preset-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.applyEqualizerPreset(chip.dataset.preset);
      });
    });
  }

  // ===========================================================================
  // FEATURE 2: Artist Radio & Auto DJ Mix Events & Dynamic Trending Updates
  // ===========================================================================
  setSmartRadioActive(isActive, showToast = true) {
    this.isSmartRadioActive = Boolean(isActive);
    try {
      localStorage.setItem('music_smart_radio_active', this.isSmartRadioActive ? 'true' : 'false');
    } catch (e) {}

    const sheetRadioBtn = document.getElementById('sheetToggleRadio');
    if (sheetRadioBtn) {
      sheetRadioBtn.classList.toggle('active', this.isSmartRadioActive);
    }
    if (this.toggleSmartRadio) {
      this.toggleSmartRadio.checked = this.isSmartRadioActive;
    }
    if (showToast) {
      this.showToast(this.isSmartRadioActive ? '📻 Auto DJ Radio turned ON – Continuous mix enabled' : '📻 Auto DJ Radio turned OFF');
    }
  }

  initRadioEvents() {
    const sheetRadioBtn = document.getElementById('sheetToggleRadio');
    if (sheetRadioBtn) {
      sheetRadioBtn.addEventListener('click', () => {
        // Toggle the active state (Proper ON/OFF)
        const newState = !this.isSmartRadioActive;
        this.setSmartRadioActive(newState, true);
        if (newState && this.currentSong) {
          this.fetchSmartRadioRecommendations(this.currentSong, false);
        }
      });
    }

    // Synchronize UI on load
    this.setSmartRadioActive(this.isSmartRadioActive, false);
  }

  async loadDynamicTrendingTags() {
    const bar = document.getElementById('quickTagsBar');
    if (!bar) return;

    // 1. Try local cache first for instant 0ms render
    try {
      const cached = localStorage.getItem('music_dynamic_trending_tags');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this._renderTrendingTags(parsed);
        }
      }
    } catch (e) {}

    // 2. Fetch fresh live tags from server
    try {
      const res = await fetch('/api/trending-tags');
      const data = await res.json();
      if (data.success && Array.isArray(data.tags) && data.tags.length > 0) {
        this._renderTrendingTags(data.tags);
        try {
          localStorage.setItem('music_dynamic_trending_tags', JSON.stringify(data.tags));
        } catch (e) {}
      }
    } catch (e) {
      console.warn('Failed to fetch dynamic trending tags:', e);
    }
  }

  _renderTrendingTags(tags) {
    const bar = document.getElementById('quickTagsBar');
    if (!bar) return;
    bar.innerHTML = '<span class="quick-tag-label">Trending:</span>';
    tags.forEach(t => {
      const btn = document.createElement('button');
      btn.className = 'quick-tag';
      btn.dataset.query = t.query;
      btn.textContent = t.label;
      btn.addEventListener('click', () => {
        if (this.searchInput) {
          this.searchInput.value = t.query;
          if (this.clearSearchBtn) this.clearSearchBtn.style.display = 'block';
        }
        this.performSearch(t.query);
      });
      bar.appendChild(btn);
    });
  }

  // ===========================================================================
  // FEATURE 3: Car Drive Mode (Distraction-Free UI)
  // ===========================================================================
  initCarMode() {
    this.isCarModeActive = false;
    const headerBtn = document.getElementById('headerCarModeBtn');
    const sheetBtn = document.getElementById('sheetCarModeBtn');
    const closeBtn = document.getElementById('closeCarModeBtn');
    const playPauseBtn = document.getElementById('carPlayPauseBtn');
    const prevBtn = document.getElementById('carPrevBtn');
    const nextBtn = document.getElementById('carNextBtn');
    const rewindBtn = document.getElementById('carRewindBtn');
    const forwardBtn = document.getElementById('carForwardBtn');
    const volSlider = document.getElementById('carVolSlider');
    const progressBg = document.getElementById('carProgressBarBg');

    const openCar = () => this.openCarMode();
    if (headerBtn) headerBtn.addEventListener('click', openCar);
    if (sheetBtn) sheetBtn.addEventListener('click', openCar);
    if (closeBtn) closeBtn.addEventListener('click', () => this.closeCarMode());

    if (playPauseBtn) {
      playPauseBtn.addEventListener('click', () => {
        if (this.isPlaying) {
          this.audio.pause();
        } else {
          this.audio.play();
        }
      });
    }

    if (prevBtn) prevBtn.addEventListener('click', () => this.playPrev());
    if (nextBtn) nextBtn.addEventListener('click', () => this.playNext());

    if (rewindBtn) {
      rewindBtn.addEventListener('click', () => {
        if (this.audio.duration) {
          this.audio.currentTime = Math.max(0, this.audio.currentTime - 15);
          this.showToast('↺ -15s');
        }
      });
    }

    if (forwardBtn) {
      forwardBtn.addEventListener('click', () => {
        if (this.audio.duration) {
          this.audio.currentTime = Math.min(this.audio.duration, this.audio.currentTime + 15);
          this.showToast('+15s ↻');
        }
      });
    }

    if (volSlider) {
      volSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.audio.volume = val;
        if (this.volumeSlider) this.volumeSlider.value = val;
        this.updateVolumeIcon(val);
      });
    }

    if (progressBg) {
      progressBg.addEventListener('click', (e) => {
        if (!this.audio.duration) return;
        const rect = progressBg.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        this.audio.currentTime = pct * this.audio.duration;
      });
    }
  }

  openCarMode() {
    const overlay = document.getElementById('carModeOverlay');
    if (!overlay) return;
    this.isCarModeActive = true;
    overlay.style.display = 'flex';
    if (this.currentSong) {
      this._updateCarModeUI(this.currentSong);
    }
    const volSlider = document.getElementById('carVolSlider');
    if (volSlider) volSlider.value = this.audio.volume || 0.85;
    this.showToast('🚗 Car Drive Mode Activated');
  }

  closeCarMode() {
    const overlay = document.getElementById('carModeOverlay');
    if (overlay) overlay.style.display = 'none';
    this.isCarModeActive = false;
  }

  _updateCarModeUI(song) {
    if (!song) return;
    const titleEl = document.getElementById('carModeTitle');
    const artistEl = document.getElementById('carModeArtist');
    const artEl = document.getElementById('carModeArt');
    const durEl = document.getElementById('carDuration');

    if (titleEl) titleEl.textContent = song.title || 'Untitled';
    if (artistEl) artistEl.textContent = song.artist || 'Unknown Artist';
    if (artEl) artEl.src = song.image || '/icons/icon-512x512.png';
    if (durEl && this.audio.duration) durEl.textContent = this.formatTime(this.audio.duration);
    this._updateCarProgress();
  }

  _updateCarProgress() {
    if (!this.audio.duration) return;
    const curEl = document.getElementById('carCurrentTime');
    const durEl = document.getElementById('carDuration');
    const fillEl = document.getElementById('carProgressFill');

    const pct = (this.audio.currentTime / this.audio.duration) * 100;
    if (fillEl) fillEl.style.width = `${pct}%`;
    if (curEl) curEl.textContent = this.formatTime(this.audio.currentTime);
    if (durEl) durEl.textContent = this.formatTime(this.audio.duration);
  }

  // ===========================================================================
  // FEATURE 4: Personal Listening Stats & Spotify Wrapped
  // ===========================================================================
  initListeningStats() {
    const shareBtn = document.getElementById('btnShareWrapped');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => this.shareWrappedCard());
    }

    const resetBtn = document.getElementById('btnResetStats');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Reset your listening stats history?')) {
          localStorage.removeItem('music_listening_stats');
          this.renderStatsView();
          this.showToast('Listening stats reset!');
        }
      });
    }
  }

  recordListeningStat(song) {
    if (!song) return;
    try {
      const stats = JSON.parse(localStorage.getItem('music_listening_stats') || '{"plays":{},"artists":{},"totalPlays":0}');
      stats.totalPlays = (stats.totalPlays || 0) + 1;
      
      const trackKey = `${song.title}:::${song.artist || ''}`;
      stats.plays[trackKey] = (stats.plays[trackKey] || 0) + 1;

      const artistName = (song.artist || 'Various Artists').split(/[,&]/)[0].trim();
      if (artistName) {
        stats.artists[artistName] = (stats.artists[artistName] || 0) + 1;
      }

      localStorage.setItem('music_listening_stats', JSON.stringify(stats));
    } catch (e) {
      console.warn('Stat record error:', e);
    }
  }

  renderStatsView() {
    let stats = { plays: {}, artists: {}, totalPlays: 0 };
    try {
      stats = JSON.parse(localStorage.getItem('music_listening_stats') || '{"plays":{},"artists":{},"totalPlays":0}');
    } catch (e) {}

    const totalPlays = Math.max(stats.totalPlays || 0, this.history ? this.history.length : 0);
    const estMinutes = Math.round(totalPlays * 3.6);

    // Top artist
    let topArtist = '--';
    let topArtistCount = 0;
    for (const [artist, cnt] of Object.entries(stats.artists || {})) {
      if (cnt > topArtistCount) {
        topArtistCount = cnt;
        topArtist = artist;
      }
    }
    if (topArtist === '--' && this.history && this.history.length > 0) {
      topArtist = (this.history[0].artist || 'Anirudh Ravichander').split(/[,&]/)[0].trim();
    }

    // Top track
    let topTrack = '--';
    let topTrackCount = 0;
    for (const [track, cnt] of Object.entries(stats.plays || {})) {
      if (cnt > topTrackCount) {
        topTrackCount = cnt;
        topTrack = track.split(':::')[0];
      }
    }
    if (topTrack === '--' && this.history && this.history.length > 0) {
      topTrack = this.history[0].title;
    }

    // Populate Hero Cards
    const playsEl = document.getElementById('statsTotalPlays');
    const minsEl = document.getElementById('statsTotalMinutes');
    const artistEl = document.getElementById('statsTopArtist');
    const trackEl = document.getElementById('statsTopTrack');

    if (playsEl) playsEl.textContent = totalPlays.toLocaleString();
    if (minsEl) minsEl.textContent = `${estMinutes.toLocaleString()}m`;
    if (artistEl) artistEl.textContent = topArtist;
    if (trackEl) trackEl.textContent = topTrack;

    // Top 5 Artists List
    const artistsListEl = document.getElementById('statsTopArtistsList');
    if (artistsListEl) {
      const sortedArtists = Object.entries(stats.artists || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      if (sortedArtists.length === 0 && this.history) {
        const unique = [...new Set(this.history.map(s => (s.artist || '').split(/[,&]/)[0].trim()))].filter(Boolean).slice(0, 5);
        unique.forEach((art, i) => sortedArtists.push([art, 5 - i]));
      }

      artistsListEl.innerHTML = sortedArtists.map(([name, count], idx) => `
        <div class="stats-list-item">
          <div class="stats-item-left">
            <span class="stats-item-rank">#${idx + 1}</span>
            <span class="stats-item-name">${name}</span>
          </div>
          <span class="stats-item-count">${count} plays</span>
        </div>
      `).join('') || '<div style="color:#b3b3b3;padding:12px;">Start listening to see your top artists!</div>';
    }

    // Top 5 Tracks List
    const tracksListEl = document.getElementById('statsTopTracksList');
    if (tracksListEl) {
      const sortedTracks = Object.entries(stats.plays || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      if (sortedTracks.length === 0 && this.history) {
        this.history.slice(0, 5).forEach((s, i) => sortedTracks.push([`${s.title}:::${s.artist}`, 5 - i]));
      }

      tracksListEl.innerHTML = sortedTracks.map(([key, count], idx) => {
        const title = key.split(':::')[0];
        return `
          <div class="stats-list-item">
            <div class="stats-item-left">
              <span class="stats-item-rank">#${idx + 1}</span>
              <span class="stats-item-name">${title}</span>
            </div>
            <span class="stats-item-count">${count} plays</span>
          </div>
        `;
      }).join('') || '<div style="color:#b3b3b3;padding:12px;">Play some songs to see your chart!</div>';
    }
  }

  shareWrappedCard() {
    const artist = document.getElementById('statsTopArtist')?.textContent || 'My Favorite Artist';
    const plays = document.getElementById('statsTotalPlays')?.textContent || '0';
    const mins = document.getElementById('statsTotalMinutes')?.textContent || '0m';
    const shareText = `🎵 My Music Wrapped 2026 on MUSIC App:\n🎧 ${plays} songs played (${mins})\n👑 Top Artist: ${artist}\n🔊 Streamed in 320k Hi-Res Audio with Dolby Atmos!`;

    if (navigator.share) {
      navigator.share({
        title: 'My Music Wrapped',
        text: shareText,
        url: window.location.origin
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareText).then(() => {
        this.showToast('📋 Wrapped summary copied to clipboard!');
      }).catch(() => {
        this.showToast('📋 ' + shareText);
      });
    }
  }

  // ===========================================================================
  // FEATURE 5: Song Recognition Engine (Shazam-Style)
  // ===========================================================================
  initSongRecognizer() {
    const triggerBtn = document.getElementById('recognizeSongBtn');
    const closeBtn = document.getElementById('closeRecognizeBtn');
    const closeBackdrop = document.getElementById('closeRecognizeBackdrop');
    const playBtn = document.getElementById('btnPlayRecognized');

    if (triggerBtn) triggerBtn.addEventListener('click', () => this.openSongRecognizer());
    if (closeBtn) closeBtn.addEventListener('click', () => this.closeSongRecognizer());
    if (closeBackdrop) closeBackdrop.addEventListener('click', () => this.closeSongRecognizer());

    if (playBtn) {
      playBtn.addEventListener('click', () => {
        if (this._recognizedTrack) {
          this.closeSongRecognizer();
          this.playSong(this._recognizedTrack, [this._recognizedTrack], 0);
          this.showToast(`▶️ Playing: "${this._recognizedTrack.title}"`);
        }
      });
    }
  }

  openSongRecognizer() {
    const modal = document.getElementById('recognizeModal');
    if (!modal) return;
    modal.classList.add('active');

    const resultCard = document.getElementById('recognizeResultCard');
    const statusText = document.getElementById('recognizeStatusText');
    const countdown = document.getElementById('recognizeCountdown');
    const radar = document.getElementById('recognizeRadar');

    if (resultCard) resultCard.style.display = 'none';
    if (radar) radar.style.display = 'flex';
    if (statusText) statusText.textContent = 'Listening to music around you...';
    if (countdown) countdown.textContent = '5s';

    this.startAudioRecognition();
  }

  closeSongRecognizer() {
    const modal = document.getElementById('recognizeModal');
    if (modal) modal.classList.remove('active');
    if (this._recognizeCountdownTimer) {
      clearInterval(this._recognizeCountdownTimer);
      this._recognizeCountdownTimer = null;
    }
    if (this._mediaRecorder && this._mediaRecorder.state !== 'inactive') {
      try { this._mediaRecorder.stop(); } catch (e) {}
    }
  }

  async startAudioRecognition() {
    let timeLeft = 5;
    const countdown = document.getElementById('recognizeCountdown');
    const statusText = document.getElementById('recognizeStatusText');

    this._recognizeCountdownTimer = setInterval(() => {
      timeLeft--;
      if (countdown) countdown.textContent = `${timeLeft}s`;
      if (timeLeft <= 0) {
        clearInterval(this._recognizeCountdownTimer);
        this._recognizeCountdownTimer = null;
      }
    }, 1000);

    let audioBlob = null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      this._mediaRecorder = recorder;
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        audioBlob = new Blob(chunks, { type: 'audio/webm' });
        await this._sendRecognitionRequest(audioBlob);
      };

      recorder.start();
      setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop();
      }, 4500);

    } catch (err) {
      console.warn('Microphone permission / stream issue, using acoustic fallback:', err.message);
      // Fallback: wait 4s and search top trending
      setTimeout(async () => {
        await this._sendRecognitionRequest(null);
      }, 4000);
    }
  }

  async _sendRecognitionRequest(audioBlob) {
    const statusText = document.getElementById('recognizeStatusText');
    const countdown = document.getElementById('recognizeCountdown');
    if (statusText) statusText.textContent = 'Analyzing audio frequencies...';
    if (countdown) countdown.textContent = '⚡';

    let base64Audio = null;
    if (audioBlob) {
      base64Audio = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(audioBlob);
      });
    }

    try {
      const res = await fetch('/api/recognize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: base64Audio })
      });
      const data = await res.json();

      if (data.success && data.match) {
        this._recognizedTrack = data.match;
        const resultCard = document.getElementById('recognizeResultCard');
        const radar = document.getElementById('recognizeRadar');
        const art = document.getElementById('recognizeResultArt');
        const title = document.getElementById('recognizeResultTitle');
        const artist = document.getElementById('recognizeResultArtist');
        const album = document.getElementById('recognizeResultAlbum');
        const badge = document.getElementById('recognizeMatchBadge');

        if (statusText) statusText.textContent = '🎉 Song Identified!';
        if (countdown) countdown.textContent = '✓';
        if (radar) radar.style.display = 'none';

        if (art) art.src = data.match.image || '/icons/icon-512x512.png';
        if (title) title.textContent = data.match.title;
        if (artist) artist.textContent = data.match.artist;
        if (album) album.textContent = data.match.album || 'Single';
        if (badge) badge.textContent = `🎯 ${Math.round((data.match.confidence || 0.95) * 100)}% Match`;

        if (resultCard) resultCard.style.display = 'flex';
        this.showToast(`🎵 Identified: "${data.match.title}"`);
      } else {
        if (statusText) statusText.textContent = data.message || 'No match found. Please try again!';
        if (countdown) countdown.textContent = '✕';
      }
    } catch (e) {
      console.error('Recognition error:', e);
      if (statusText) statusText.textContent = 'Audio recognition service temporary error.';
    }
  }

  // ==================================================================================
  // FEATURE 1: FRIENDS JAM / PARTY ROOM ENGINE
  // ==================================================================================
  openJamModal() {
    const modal = document.getElementById('jamModal');
    if (modal) {
      modal.classList.add('active');
      this.updateJamUI();
    }
  }

  closeJamModal() {
    const modal = document.getElementById('jamModal');
    if (modal) {
      modal.classList.remove('active');
    }
  }

  initJamEvents() {
    this.jamRoom = null;
    this.jamUserId = localStorage.getItem('music_jam_user_id') || ('user_' + Math.random().toString(36).substring(2, 9));
    localStorage.setItem('music_jam_user_id', this.jamUserId);
    this.isJamHost = false;
    this._jamPollInterval = null;
    this._jamSyncDebounce = null;
    this._jamHostHeartbeat = null;

    const openBtn = document.getElementById('openJamBtn');
    const toolJamBtn = document.getElementById('toolJamBtn');
    const closeBtn = document.getElementById('closeJamBtn');
    const backdrop = document.getElementById('closeJamBackdrop');

    const tabCreate = document.getElementById('jamTabCreate');
    const tabJoin = document.getElementById('jamTabJoin');
    const createSec = document.getElementById('jamCreateTabContent');
    const joinSec = document.getElementById('jamJoinTabContent');

    const btnCreate = document.getElementById('btnCreateJamRoom');
    const btnJoin = document.getElementById('btnJoinJamRoom');
    const btnLeave = document.getElementById('btnLeaveJamRoom');
    const btnCopy = document.getElementById('btnCopyJamLink');

    if (openBtn) openBtn.addEventListener('click', () => this.openJamModal());
    if (toolJamBtn) toolJamBtn.addEventListener('click', () => this.openJamModal());
    if (closeBtn) closeBtn.addEventListener('click', () => this.closeJamModal());
    if (backdrop) backdrop.addEventListener('click', () => this.closeJamModal());

    // Quick Tools Strip extra bindings
    const toolDriveBtn = document.getElementById('toolDriveBtn');
    const toolIdentifyBtn = document.getElementById('toolIdentifyBtn');
    if (toolDriveBtn) {
      toolDriveBtn.addEventListener('click', () => document.getElementById('headerCarModeBtn')?.click());
    }
    if (toolIdentifyBtn) {
      toolIdentifyBtn.addEventListener('click', () => document.getElementById('recognizeSongBtn')?.click());
    }

    if (tabCreate && tabJoin) {
      tabCreate.addEventListener('click', () => {
        tabCreate.classList.add('active');
        tabJoin.classList.remove('active');
        if (createSec) createSec.style.display = 'block';
        if (joinSec) joinSec.style.display = 'none';
      });
      tabJoin.addEventListener('click', () => {
        tabJoin.classList.add('active');
        tabCreate.classList.remove('active');
        if (joinSec) joinSec.style.display = 'block';
        if (createSec) createSec.style.display = 'none';
      });
    }

    if (btnCreate) {
      btnCreate.addEventListener('click', async () => {
        const nameInput = document.getElementById('jamHostNameInput');
        const hostName = nameInput?.value?.trim() || 'DJ';
        this.jamHostName = hostName;
        try {
          btnCreate.disabled = true;
          const res = await fetch('/api/jam/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              hostName,
              currentTrack: this.currentSong || null,
              currentTime: this.audio?.currentTime || 0,
              isPlaying: Boolean(this.audio && !this.audio.paused)
            })
          });
          const data = await res.json();
          if (data.success) {
            this.jamRoom = data.room;
            this.jamUserId = data.hostId;
            this.isJamHost = true;
            this.startJamPolling();
            this.updateJamUI();
            this.showToast(`👥 Jam Room ${data.roomId} Created! Share code with friends.`);
          } else {
            this.showToast(data.message || 'Could not create room.');
          }
        } catch (e) {
          this.showToast('Failed to create Jam Room.');
        } finally {
          btnCreate.disabled = false;
        }
      });
    }

    if (btnJoin) {
      btnJoin.addEventListener('click', async () => {
        const codeInput = document.getElementById('jamRoomCodeInput');
        const nameInput = document.getElementById('jamGuestNameInput');
        const roomId = codeInput?.value?.trim().toUpperCase();
        const userName = nameInput?.value?.trim() || 'Friend';
        if (!roomId) {
          this.showToast('Please enter a Jam Room code.');
          return;
        }
        try {
          btnJoin.disabled = true;
          const res = await fetch('/api/jam/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId, userName })
          });
          const data = await res.json();
          if (data.success) {
            this.jamRoom = data.room;
            this.jamUserId = data.userId;
            this.isJamHost = false;
            this.startJamPolling();
            this.updateJamUI();
            this.showToast(`🎉 Joined Jam Room ${data.roomId}! Playback synced.`);
            if (this.jamRoom.currentTrack) {
              this.syncGuestPlayback(this.jamRoom.currentTrack, this.jamRoom.currentTime, this.jamRoom.isPlaying);
            }
          } else {
            this.showToast(data.message || 'Room not found.');
          }
        } catch (e) {
          this.showToast('Failed to join Jam room.');
        } finally {
          btnJoin.disabled = false;
        }
      });
    }

    if (btnLeave) {
      btnLeave.addEventListener('click', async () => {
        if (this.jamRoom) {
          try {
            await fetch('/api/jam/leave', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ roomId: this.jamRoom.id, userId: this.jamUserId })
            });
          } catch (e) {}
        }
        this.stopJamPolling();
        this.jamRoom = null;
        this.isJamHost = false;
        this.updateJamUI();
        this.showToast('Left Jam Session.');
      });
    }

    if (btnCopy) {
      btnCopy.addEventListener('click', () => {
        if (!this.jamRoom) return;
        const shareText = `Join my live music party in MUSIC! Room Code: ${this.jamRoom.id}\n${window.location.origin}/?jam=${this.jamRoom.id}`;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(shareText);
          this.showToast('📋 Jam invite link copied to clipboard!');
        } else {
          prompt('Copy Jam link:', shareText);
        }
      });
    }

    // Check URL for ?jam=JAM-XXXX on initial load
    const urlParams = new URLSearchParams(window.location.search);
    const jamCode = urlParams.get('jam');
    if (jamCode) {
      const codeInput = document.getElementById('jamRoomCodeInput');
      if (codeInput) codeInput.value = jamCode.toUpperCase();
      if (tabJoin) tabJoin.click();
      this.openJamModal();
    }
  }

  startJamPolling() {
    this.stopJamPolling();

    // Host sends periodic heartbeat every 3s so playback position & serverless room stay fresh
    if (this.isJamHost) {
      this._jamHostHeartbeat = setInterval(() => {
        this.broadcastJamHostSync(true);
      }, 3000);
    }

    this._jamPollInterval = setInterval(async () => {
      if (!this.jamRoom) return;
      try {
        const res = await fetch(`/api/jam/poll/${this.jamRoom.id}?userId=${encodeURIComponent(this.jamUserId)}`);
        const data = await res.json();
        if (data.success && data.room) {
          this.jamRoom = data.room;
          this.updateJamUI();
          if (!this.isJamHost) {
            if (this.jamRoom.currentTrack) {
              const currentSongId = this.currentSong?.id;
              const remoteSongId = this.jamRoom.currentTrack?.id;
              if (currentSongId !== remoteSongId) {
                this.syncGuestPlayback(this.jamRoom.currentTrack, this.jamRoom.currentTime, this.jamRoom.isPlaying);
              } else {
                const localTime = this.audio?.currentTime || 0;
                const remoteTime = this.jamRoom.currentTime || 0;
                if (Math.abs(localTime - remoteTime) > 3.5) {
                  this.audio.currentTime = remoteTime;
                }
                if (this.jamRoom.isPlaying && this.audio.paused) {
                  this.audio.play().catch(() => {});
                } else if (!this.jamRoom.isPlaying && !this.audio.paused) {
                  this.audio.pause();
                }
              }
            }
          }
        } else if (!this.isJamHost) {
          this.stopJamPolling();
          this.jamRoom = null;
          this.updateJamUI();
          this.showToast('Jam room has ended.');
        }
      } catch (e) {}
    }, 2500);
  }

  stopJamPolling() {
    if (this._jamPollInterval) {
      clearInterval(this._jamPollInterval);
      this._jamPollInterval = null;
    }
    if (this._jamHostHeartbeat) {
      clearInterval(this._jamHostHeartbeat);
      this._jamHostHeartbeat = null;
    }
  }

  broadcastJamHostSync(immediate = false) {
    if (!this.jamRoom || !this.isJamHost) return;
    const doSync = async () => {
      try {
        await fetch('/api/jam/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId: this.jamRoom.id,
            userId: this.jamUserId,
            hostName: this.jamHostName || this.jamRoom.hostName || 'DJ',
            currentTrack: this.currentSong || null,
            currentTime: this.audio?.currentTime || 0,
            isPlaying: Boolean(this.audio && !this.audio.paused)
          })
        });
      } catch (e) {}
    };
    if (immediate) {
      doSync();
      return;
    }
    clearTimeout(this._jamSyncDebounce);
    this._jamSyncDebounce = setTimeout(doSync, 350);
  }

  syncGuestPlayback(track, time = 0, isPlaying = true) {
    if (!track) return;
    this.playSong(track, [track], 0);
    if (time > 0 && this.audio) {
      const seekOnce = () => {
        try { this.audio.currentTime = time; } catch (e) {}
        if (!isPlaying) this.audio.pause();
      };
      this.audio.addEventListener('canplay', seekOnce, { once: true });
    } else if (!isPlaying && this.audio) {
      setTimeout(() => this.audio.pause(), 350);
    }
  }

  updateJamUI() {
    const noRoomSec = document.getElementById('jamNoRoomSection');
    const activeSec = document.getElementById('jamActiveRoomSection');
    const jamBadge = document.getElementById('headerJamBadge');
    const toolJamBtn = document.getElementById('toolJamBtn');
    const roomCodeEl = document.getElementById('jamRoomCodeDisplay');
    const listenersEl = document.getElementById('jamListenersCount');
    const rolePill = document.getElementById('jamRolePill');
    const trackArt = document.getElementById('jamTrackArt');
    const trackTitle = document.getElementById('jamTrackTitle');
    const trackArtist = document.getElementById('jamTrackArtist');

    if (this.jamRoom) {
      if (noRoomSec) noRoomSec.style.display = 'none';
      if (activeSec) activeSec.style.display = 'block';
      if (jamBadge) {
        jamBadge.textContent = '🟢 LIVE';
        jamBadge.parentElement?.classList.add('active-glow');
      }
      if (toolJamBtn) toolJamBtn.classList.add('active-glow');
      if (roomCodeEl) roomCodeEl.textContent = this.jamRoom.id;
      if (listenersEl) listenersEl.textContent = `👥 ${this.jamRoom.listenersCount || 1} listening`;
      if (rolePill) rolePill.textContent = this.isJamHost ? '👑 You are Host (DJ)' : `🎧 Host: ${this.jamRoom.hostName || 'Host'}`;

      const cur = this.jamRoom.currentTrack || this.currentSong;
      if (cur) {
        if (trackArt) trackArt.src = cur.image || '/icons/icon-512x512.png';
        if (trackTitle) trackTitle.textContent = cur.title || 'Playing';
        if (trackArtist) trackArtist.textContent = cur.artist || '';
      }
    } else {
      if (noRoomSec) noRoomSec.style.display = 'block';
      if (activeSec) activeSec.style.display = 'none';
      if (jamBadge) {
        jamBadge.textContent = 'JAM';
        jamBadge.parentElement?.classList.remove('active-glow');
      }
      if (toolJamBtn) toolJamBtn.classList.remove('active-glow');
    }
  }

  // ==================================================================================
  // FEATURE 2: MOOD & VIBE AI MATCHER
  // ==================================================================================
  initMoodVibeEvents() {
    const pills = document.querySelectorAll('.vibe-pill');
    pills.forEach(pill => {
      pill.addEventListener('click', async () => {
        const vibe = pill.getAttribute('data-vibe');
        if (!vibe) return;

        pills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');

        const vibeName = pill.querySelector('.vibe-label')?.textContent || vibe;
        this.showToast(`🎭 Loading 320k tracks for ${vibeName}...`);

        try {
          const res = await fetch(`/api/mood/${vibe}`);
          const data = await res.json();
          if (data.success && Array.isArray(data.results) && data.results.length > 0) {
            this.playSong(data.results[0], data.results, 0);
            this.showToast(`✨ Playing ${data.title || vibeName} (${data.results.length} songs)`);

            const searchInput = document.getElementById('searchInput');
            if (searchInput) searchInput.value = data.title || vibeName;
            this.renderSearchResults(data.results, data.title || vibeName);
          } else {
            this.showToast('Could not load vibe tracks. Please try another vibe.');
          }
        } catch (e) {
          console.error('Mood fetch error:', e);
          this.showToast('Failed to load mood tracks.');
        }
      });
    });
  }

  // ==================================================================================
  // FEATURE 3: MINI FLOATING PLAYER (PIP + MOBILE IN-APP MINI WIDGET)
  // ==================================================================================
  initPipPlayer() {
    const pipBtn = document.getElementById('pipPlayerBtn');
    const sheetPipBtn = document.getElementById('sheetPipBtn');
    const toolPipBtn = document.getElementById('toolPipBtn');

    this.pipCanvas = document.getElementById('pipHiddenCanvas');
    this.pipVideo = document.getElementById('pipHiddenVideo');
    this.isPipActive = false;
    this._pipDrawInterval = null;
    this._pipCachedImgUrl = null;
    this._pipCachedImg = null;

    const handleToggle = () => this.togglePipPlayer();
    if (pipBtn) pipBtn.addEventListener('click', handleToggle);
    if (sheetPipBtn) sheetPipBtn.addEventListener('click', handleToggle);
    if (toolPipBtn) toolPipBtn.addEventListener('click', handleToggle);

    // Floating In-App Mini Widget controls
    const miniPlayBtn = document.getElementById('floatingMiniPlayBtn');
    const miniNextBtn = document.getElementById('floatingMiniNextBtn');
    const miniCloseBtn = document.getElementById('floatingMiniCloseBtn');

    if (miniPlayBtn) {
      miniPlayBtn.addEventListener('click', () => document.getElementById('playPauseBtn')?.click());
    }
    if (miniNextBtn) {
      miniNextBtn.addEventListener('click', () => this.nextSong && this.nextSong());
    }
    if (miniCloseBtn) {
      miniCloseBtn.addEventListener('click', () => {
        const w = document.getElementById('floatingMiniWidget');
        if (w) w.style.display = 'none';
        this.isPipActive = false;
        this._updatePipButtonsState(false);
      });
    }

    if (this.pipVideo) {
      this.pipVideo.addEventListener('leavepictureinpicture', () => {
        this.isPipActive = false;
        clearInterval(this._pipDrawInterval);
        this._updatePipButtonsState(false);
      });
    }
  }

  _updatePipButtonsState(active) {
    ['pipPlayerBtn', 'sheetPipBtn', 'toolPipBtn'].forEach(id => {
      document.getElementById(id)?.classList.toggle('active-glow', active);
    });
  }

  _updateFloatingMiniWidget() {
    const w = document.getElementById('floatingMiniWidget');
    if (!w) return;
    const art = document.getElementById('floatingMiniArt');
    const title = document.getElementById('floatingMiniTitle');
    const artist = document.getElementById('floatingMiniArtist');
    const playBtn = document.getElementById('floatingMiniPlayBtn');

    const song = this.currentSong;
    if (song) {
      if (art) art.src = song.image || '/icons/icon-512x512.png';
      if (title) title.textContent = song.title || 'MUSIC';
      if (artist) artist.textContent = song.artist || song.album || '320k Audio';
    }
    if (playBtn) {
      playBtn.textContent = this.isPlaying ? '⏸' : '▶';
    }
  }

  async togglePipPlayer() {
    const miniWidget = document.getElementById('floatingMiniWidget');

    // Exit active PiP if already open
    if (document.pictureInPictureElement) {
      try { await document.exitPictureInPicture(); } catch (e) {}
      this.isPipActive = false;
      clearInterval(this._pipDrawInterval);
      this._updatePipButtonsState(false);
      return;
    }

    if (miniWidget && miniWidget.style.display === 'flex') {
      miniWidget.style.display = 'none';
      this.isPipActive = false;
      this._updatePipButtonsState(false);
      return;
    }

    // Try Native Browser Picture-in-Picture first (Desktop Chrome / Edge / Safari)
    const canNativePip = Boolean(
      this.pipCanvas &&
      this.pipVideo &&
      document.pictureInPictureEnabled &&
      typeof this.pipCanvas.captureStream === 'function'
    );

    if (canNativePip) {
      try {
        this.renderPipCanvasFrame();
        if (!this.pipVideo.srcObject) {
          this.pipVideo.srcObject = this.pipCanvas.captureStream(10);
        }
        await this.pipVideo.play();
        await this.pipVideo.requestPictureInPicture();
        this.isPipActive = true;
        this._updatePipButtonsState(true);
        clearInterval(this._pipDrawInterval);
        this._pipDrawInterval = setInterval(() => this.renderPipCanvasFrame(), 1000);
        this.showToast('🖼️ Mini Floating Player active');
        return;
      } catch (e) {
        console.warn('Native PiP unavailable, activating in-app floating mini player:', e.message);
      }
    }

    // Mobile / Fallback: Show crisp In-App Floating Mini Widget
    if (miniWidget) {
      this._updateFloatingMiniWidget();
      miniWidget.style.display = 'flex';
      this.isPipActive = true;
      this._updatePipButtonsState(true);
      this.showToast('🖼️ Floating Mini Player active');
    }
  }

  renderPipCanvasFrame() {
    if (!this.pipCanvas) return;
    const ctx = this.pipCanvas.getContext('2d');
    const w = 512;
    const h = 512;

    const song = this.currentSong || {
      title: 'MUSIC App',
      artist: 'Select a song to play',
      image: '/icons/icon-512x512.png'
    };

    const drawLayout = (loadedImg = null) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(1, '#020617');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      if (loadedImg) {
        try {
          ctx.save();
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(76, 36, 360, 290, 18);
          else ctx.rect(76, 36, 360, 290);
          ctx.clip();
          ctx.drawImage(loadedImg, 76, 36, 360, 290);
          ctx.restore();
        } catch (e) {}
      } else {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(76, 36, 360, 290);
        ctx.fillStyle = '#1ed760';
        ctx.font = 'bold 68px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🎵', 256, 200);
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText((song.title || 'MUSIC').slice(0, 26), 256, 372);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '19px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText((song.artist || 'Ready').slice(0, 32), 256, 408);

      const progress = (this.audio && this.audio.duration && isFinite(this.audio.duration))
        ? Math.min(1, Math.max(0, this.audio.currentTime / this.audio.duration))
        : 0;
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(56, 444, 400, 8);
      ctx.fillStyle = '#1ed760';
      ctx.fillRect(56, 444, 400 * progress, 8);

      ctx.fillStyle = '#1ed760';
      ctx.font = 'bold 15px monospace';
      ctx.fillText(this.audio && !this.audio.paused ? '▶ PLAYING • 320K' : '⏸ PAUSED', 256, 484);
    };

    // Always draw synchronously first so captureStream produces an immediate frame
    const rawArt = song.image || '/icons/icon-512x512.png';
    const safeSrc = rawArt.startsWith('http') ? `/api/proxy-image?url=${encodeURIComponent(rawArt)}` : rawArt;

    if (this._pipCachedImgUrl === safeSrc && this._pipCachedImg) {
      drawLayout(this._pipCachedImg);
      return;
    }

    drawLayout(null);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this._pipCachedImgUrl = safeSrc;
      this._pipCachedImg = img;
      drawLayout(img);
    };
    img.src = safeSrc;
  }

  // ==================================================================================
  // FEATURE 4: AMBIENT NATURE SOUNDSCAPES DSP
  // ==================================================================================
  openAmbienceModal() {
    const modal = document.getElementById('ambienceModal');
    if (modal) modal.classList.add('active');
  }

  closeAmbienceModal() {
    const modal = document.getElementById('ambienceModal');
    if (modal) modal.classList.remove('active');
  }

  initAmbientSoundscapes() {
    this.ambienceActive = false;
    this.ambienceNodes = {
      rainGain: null,
      oceanGain: null,
      cafeGain: null,
      noiseGain: null,
      masterGain: null
    };

    const openBtn = document.getElementById('openAmbienceBtn');
    const toolAmbienceBtn = document.getElementById('toolAmbienceBtn');
    const closeBtn = document.getElementById('closeAmbienceBtn');
    const backdrop = document.getElementById('closeAmbienceBackdrop');

    if (openBtn) openBtn.addEventListener('click', () => this.openAmbienceModal());
    if (toolAmbienceBtn) toolAmbienceBtn.addEventListener('click', () => this.openAmbienceModal());
    if (closeBtn) closeBtn.addEventListener('click', () => this.closeAmbienceModal());
    if (backdrop) backdrop.addEventListener('click', () => this.closeAmbienceModal());

    const masterToggle = document.getElementById('ambienceMasterToggle');
    if (masterToggle) {
      masterToggle.addEventListener('change', (e) => {
        this.toggleAmbienceMaster(e.target.checked);
      });
    }

    const bindSlider = (sliderId, textId, type) => {
      const slider = document.getElementById(sliderId);
      const text = document.getElementById(textId);
      if (slider) {
        slider.addEventListener('input', (e) => {
          const val = parseFloat(e.target.value);
          if (text) text.textContent = `${Math.round(val * 100)}%`;
          if (val > 0 && masterToggle && !masterToggle.checked) {
            masterToggle.checked = true;
            this.toggleAmbienceMaster(true);
          }
          this.setAmbienceVolume(type, val);
        });
      }
    };

    bindSlider('ambienceRainSlider', 'ambienceRainVal', 'rain');
    bindSlider('ambienceOceanSlider', 'ambienceOceanVal', 'ocean');
    bindSlider('ambienceCafeSlider', 'ambienceCafeVal', 'cafe');
    bindSlider('ambienceNoiseSlider', 'ambienceNoiseVal', 'noise');

    const rainBtn = document.getElementById('presetRainOnly');
    const oceanBtn = document.getElementById('presetOceanChill');
    const sleepBtn = document.getElementById('presetDeepSleep');
    const resetBtn = document.getElementById('presetResetAmbience');

    if (rainBtn) {
      rainBtn.addEventListener('click', () => {
        this.setAmbiencePreset({ rain: 0.75, ocean: 0, cafe: 0, noise: 0.15 });
      });
    }
    if (oceanBtn) {
      oceanBtn.addEventListener('click', () => {
        this.setAmbiencePreset({ rain: 0, ocean: 0.80, cafe: 0, noise: 0.20 });
      });
    }
    if (sleepBtn) {
      sleepBtn.addEventListener('click', () => {
        this.setAmbiencePreset({ rain: 0.35, ocean: 0.35, cafe: 0, noise: 0.65 });
      });
    }
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.setAmbiencePreset({ rain: 0, ocean: 0, cafe: 0, noise: 0 });
      });
    }
  }

  setupAmbienceDSP() {
    if (this.ambienceNodes.masterGain) {
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      return;
    }
    if (!this.audioCtx) this.setupAudioDSP();
    const ctx = this.audioCtx;
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    const master = ctx.createGain();
    master.gain.value = 0.85;
    master.connect(ctx.destination);
    this.ambienceNodes.masterGain = master;

    // Pink noise buffer (crisp, natural for Rain/Ocean/Cafe)
    const bufferSize = ctx.sampleRate * 4;
    const pinkBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const pinkOut = pinkBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      pinkOut[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }

    // Brown noise buffer (deep warm bassy focus/sleep)
    const brownBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const brownOut = brownBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + (0.02 * white)) / 1.02;
      brownOut[i] = lastOut * 3.5;
    }

    const createLoopSource = (buf) => {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.start(0);
      return src;
    };

    // Rain: Bright steady rainfall hiss
    const rainSrc = createLoopSource(pinkBuffer);
    const rainHP = ctx.createBiquadFilter();
    rainHP.type = 'highpass';
    rainHP.frequency.value = 450;
    const rainLP = ctx.createBiquadFilter();
    rainLP.type = 'lowpass';
    rainLP.frequency.value = 4200;
    const rainGain = ctx.createGain();
    rainGain.gain.value = 0;
    rainSrc.connect(rainHP);
    rainHP.connect(rainLP);
    rainLP.connect(rainGain);
    rainGain.connect(master);
    this.ambienceNodes.rainGain = rainGain;

    // Ocean Waves: Rolling LFO modulated surf
    const oceanSrc = createLoopSource(pinkBuffer);
    const oceanFilter = ctx.createBiquadFilter();
    oceanFilter.type = 'lowpass';
    oceanFilter.frequency.value = 500;
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.16;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 380;
    lfo.connect(lfoGain);
    lfoGain.connect(oceanFilter.frequency);
    lfo.start();
    const oceanGain = ctx.createGain();
    oceanGain.gain.value = 0;
    oceanSrc.connect(oceanFilter);
    oceanFilter.connect(oceanGain);
    oceanGain.connect(master);
    this.ambienceNodes.oceanGain = oceanGain;

    // Cozy Cafe: Warm midrange murmur
    const cafeSrc = createLoopSource(pinkBuffer);
    const cafeFilter = ctx.createBiquadFilter();
    cafeFilter.type = 'bandpass';
    cafeFilter.frequency.value = 780;
    cafeFilter.Q.value = 1.4;
    const cafeGain = ctx.createGain();
    cafeGain.gain.value = 0;
    cafeSrc.connect(cafeFilter);
    cafeFilter.connect(cafeGain);
    cafeGain.connect(master);
    this.ambienceNodes.cafeGain = cafeGain;

    // Brown Noise: Deep low rumble
    const noiseSrc = createLoopSource(brownBuffer);
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 260;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0;
    noiseSrc.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(master);
    this.ambienceNodes.noiseGain = noiseGain;
  }

  toggleAmbienceMaster(isOn) {
    this.setupAmbienceDSP();
    if (!this.audioCtx) return;
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    const badge = document.getElementById('headerAmbienceBadge');
    const toolBtn = document.getElementById('toolAmbienceBtn');
    if (this.ambienceNodes.masterGain) {
      this.ambienceNodes.masterGain.gain.setTargetAtTime(isOn ? 0.85 : 0, this.audioCtx.currentTime, 0.05);
    }
    this.ambienceActive = isOn;
    if (badge) {
      badge.textContent = isOn ? '🟢 ON' : 'SOUNDS';
      badge.parentElement?.classList.toggle('active-glow', isOn);
    }
    if (toolBtn) toolBtn.classList.toggle('active-glow', isOn);
    this.showToast(isOn ? '🌧️ Ambient soundscape mixer ON' : 'Ambience muted');
  }

  setAmbienceVolume(type, val) {
    this.setupAmbienceDSP();
    const gainNode = this.ambienceNodes[`${type}Gain`];
    if (gainNode && this.audioCtx) {
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume().catch(() => {});
      gainNode.gain.setTargetAtTime(val, this.audioCtx.currentTime, 0.05);
    }
  }

  setAmbiencePreset(levels) {
    const masterToggle = document.getElementById('ambienceMasterToggle');
    const hasAny = Object.values(levels).some(v => v > 0);
    if (masterToggle) masterToggle.checked = hasAny;
    this.toggleAmbienceMaster(hasAny);

    const updateOne = (type, val, sliderId, textId) => {
      this.setAmbienceVolume(type, val);
      const slider = document.getElementById(sliderId);
      const text = document.getElementById(textId);
      if (slider) slider.value = val;
      if (text) text.textContent = `${Math.round(val * 100)}%`;
    };
    updateOne('rain', levels.rain, 'ambienceRainSlider', 'ambienceRainVal');
    updateOne('ocean', levels.ocean, 'ambienceOceanSlider', 'ambienceOceanVal');
    updateOne('cafe', levels.cafe, 'ambienceCafeSlider', 'ambienceCafeVal');
    updateOne('noise', levels.noise, 'ambienceNoiseSlider', 'ambienceNoiseVal');
  }

  // ==================================================================================
  // FEATURE 5: LIVE TAMIL FM & 24x7 ARTIST RADIO ENGINE
  // ==================================================================================
  initLiveTamilFm() {
    this.fmStations = [];
    this.currentFmStation = null;

    const radioNavBtn = document.getElementById('sidebarRadioBtn');
    const libTabRadio = document.getElementById('libTabRadio');
    const toolRadioBtn = document.getElementById('toolRadioBtn');

    const openRadioView = () => {
      this.showCustomView('radio');
      this.loadFmRadioStations();
    };

    if (radioNavBtn) radioNavBtn.addEventListener('click', openRadioView);
    if (libTabRadio) libTabRadio.addEventListener('click', openRadioView);
    if (toolRadioBtn) toolRadioBtn.addEventListener('click', openRadioView);
  }

  async loadFmRadioStations() {
    const grid = document.getElementById('fmStationsGrid');
    if (!grid) return;

    if (this.fmStations.length === 0) {
      try {
        grid.innerHTML = '<div style="color:var(--text-secondary);padding:30px;">Loading live Tamil FM stations...</div>';
        const res = await fetch('/api/radio/stations');
        const data = await res.json();
        if (data.success && Array.isArray(data.stations)) {
          this.fmStations = data.stations;
        }
      } catch (e) {
        console.warn('Failed to load FM stations:', e);
      }
    }

    if (this.fmStations.length === 0) {
      grid.innerHTML = '<div style="color:var(--text-secondary);padding:30px;">Failed to load radio stations. Please try again.</div>';
      return;
    }

    grid.innerHTML = this.fmStations.map(station => {
      const isPlaying = this.currentFmStation?.id === station.id && this.isPlaying;
      const badgeLabel = station.type === 'artist_radio' ? '24x7 MIX' : 'LIVE FM';
      return `
        <div class="fm-card ${isPlaying ? 'playing' : ''}" data-station-id="${station.id}">
          <div class="fm-cover-wrap">
            <img src="${station.logo}" alt="${station.name}" class="fm-cover-img">
            <div class="fm-live-tag">${badgeLabel}</div>
            <button class="fm-play-btn" title="${isPlaying ? 'Pause Station' : 'Play Live Station'}">
              ${isPlaying ? '⏸' : '▶'}
            </button>
          </div>
          <div class="fm-meta">
            <h4 class="fm-name">${station.name}</h4>
            <p class="fm-tagline">${station.tagline}</p>
            <span class="fm-category-badge" style="border-color:${station.color};color:${station.color};">${station.category}</span>
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.fm-card').forEach(card => {
      card.addEventListener('click', () => {
        const stationId = card.getAttribute('data-station-id');
        const station = this.fmStations.find(s => s.id === stationId);
        if (station) this.playFmStation(station);
      });
    });
  }

  async playFmStation(station) {
    // Toggle pause if tapping currently playing station
    if (this.currentFmStation?.id === station.id && this.isPlaying && this.audio && !this.audio.paused) {
      this.audio.pause();
      this.isPlaying = false;
      this.updatePlayStateUI();
      this.loadFmRadioStations();
      return;
    }

    // 1. Artist 24x7 Radio (High-yield 320k Saavn queue + Auto DJ Radio)
    if (station.type === 'artist_radio' && station.query) {
      this.showToast(`📻 Tuning in to ${station.name} (320k Auto DJ)...`);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(station.query)}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.results) && data.results.length > 0) {
          this.setSmartRadioActive && this.setSmartRadioActive(true, false);
          this.playSong(data.results[0], data.results, 0);
          this.currentFmStation = station;
          this.loadFmRadioStations();
          return;
        }
      } catch (e) {
        console.warn('Artist radio fetch failed:', e);
      }
      this.showToast('Unable to load artist radio tracks.');
      return;
    }

    // 2. Live Broadcast Stream (Verified HTTPS CORS * FM Streams)
    this.currentFmStation = station;
    const fakeSong = {
      id: 'radio_' + station.id,
      title: station.name,
      artist: 'Live Tamil FM • ' + station.category,
      album: 'Live 24x7 Broadcast',
      image: station.logo,
      playUrl: station.streamUrl,
      isRadio: true
    };

    this.currentSong = fakeSong;
    this.queue = [fakeSong];
    this.queueIndex = 0;

    if (!this.isDspInit) this.setupAudioDSP();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    if (this.audio) {
      this.audio.crossOrigin = 'anonymous';
      this.audio.src = station.streamUrl;
      this.audio.load();
      this.showToast(`📻 Connecting to ${station.name} (Live)...`);
      this.audio.play().then(() => {
        this.isPlaying = true;
        this.updatePlayStateUI();
        if (this.playerThumb) this.playerThumb.src = fakeSong.image;
        if (this.playerTitle) this.playerTitle.textContent = fakeSong.title;
        if (this.playerArtist) this.playerArtist.textContent = fakeSong.artist;
        if (this.sidebarCover) this.sidebarCover.src = fakeSong.image;
        if (this.sidebarTitle) this.sidebarTitle.textContent = fakeSong.title;
        if (this.sidebarArtist) this.sidebarArtist.textContent = fakeSong.artist;
        if (this.sheetArtwork) this.sheetArtwork.src = fakeSong.image;
        if (this.sheetSongTitle) this.sheetSongTitle.textContent = fakeSong.title;
        if (this.sheetSongArtist) this.sheetSongArtist.textContent = fakeSong.artist;
        this.updateMediaSession && this.updateMediaSession(fakeSong);
        this._updateFloatingMiniWidget && this._updateFloatingMiniWidget();
        this.loadFmRadioStations();
      }).catch(err => {
        console.warn('Direct FM stream failed, trying CORS proxy:', err.message);
        this.audio.src = `/api/proxy-audio?url=${encodeURIComponent(station.streamUrl)}`;
        this.audio.load();
        this.audio.play().then(() => {
          this.isPlaying = true;
          this.updatePlayStateUI();
          this.loadFmRadioStations();
        }).catch(() => {
          this.showToast('FM station temporarily unreachable. Try another station!');
        });
      });
    }
  }

  // ==================================================================================
  // FEATURE 6: ONE-CLICK BATCH OFFLINE DOWNLOAD
  // ==================================================================================
  initBatchAlbumOffline() {
    const btnSearchOffline = document.getElementById('btnDownloadSearchOffline');
    const btnPlayAllSearch = document.getElementById('btnPlayAllSearch');

    if (btnSearchOffline) {
      btnSearchOffline.addEventListener('click', () => {
        const tracks = this.searchResults || this._lastSearchSongs || [];
        if (tracks.length === 0) {
          this.showToast('No search results to download.');
          return;
        }
        this.downloadBatchTracks(tracks, this._lastSearchQuery || 'Search Results');
      });
    }

    if (btnPlayAllSearch) {
      btnPlayAllSearch.addEventListener('click', () => {
        const tracks = this.searchResults || this._lastSearchSongs || [];
        if (tracks.length === 0) return;
        this.playSong(tracks[0], tracks, 0);
        this.showToast(`▶ Playing all ${tracks.length} tracks`);
      });
    }
  }

  async downloadSongForOffline(song) {
    if (!song || !this.offlineDb) return false;
    const existing = await this._getOfflineSong(song.id);
    if (existing) return true;

    const rawUrl = this.getStreamUrlForFormat(song, '720p');
    if (!rawUrl) return false;

    let audioBlob = null;
    try {
      // Fast direct CDN fetch (CORS enabled on Saavn CDN — avoids Vercel 10s proxy limit)
      const directRes = await fetch(rawUrl, { mode: 'cors' });
      if (directRes.ok) audioBlob = await directRes.blob();
    } catch (e) {}

    if (!audioBlob) {
      const proxyRes = await fetch(`/api/proxy-audio?url=${encodeURIComponent(rawUrl)}`);
      if (!proxyRes.ok) throw new Error('Fetch failed');
      audioBlob = await proxyRes.blob();
    }

    await this._storeOfflineSong({
      id: song.id,
      song: { ...song, streams: null, playUrl: null },
      audioBlob,
      savedAt: Date.now()
    });
    return true;
  }

  async downloadBatchTracks(tracks, albumName = 'Album') {
    if (!tracks || tracks.length === 0) return;
    if (!this.offlineDb) {
      this.showToast('❌ Offline storage not available in this browser');
      return;
    }
    const validTracks = tracks.filter(t => t && (t.playUrl || t.streams || t.url));
    if (validTracks.length === 0) {
      this.showToast('No downloadable tracks found.');
      return;
    }

    const toaster = document.getElementById('offlineToaster');
    const toastText = document.getElementById('offlineToasterText');
    const progressFill = document.getElementById('offlineProgressFill');

    if (toaster) toaster.style.display = 'flex';
    this.showToast(`📦 Starting batch download for ${validTracks.length} tracks...`);

    let downloadedCount = 0;
    for (let i = 0; i < validTracks.length; i++) {
      const track = validTracks[i];
      const percent = Math.round(((i + 1) / validTracks.length) * 100);

      if (toastText) toastText.textContent = `📦 Saving ${albumName}: ${i + 1} of ${validTracks.length} (${percent}%)...`;
      if (progressFill) progressFill.style.width = `${percent}%`;

      try {
        const ok = await this.downloadSongForOffline(track);
        if (ok) downloadedCount++;
      } catch (err) {
        console.warn(`Failed to download ${track.title}:`, err);
      }
    }

    if (toastText) toastText.textContent = `🎉 Saved ${downloadedCount} tracks offline! Check Library → Offline Saved`;
    if (progressFill) progressFill.style.width = '100%';
    setTimeout(() => {
      if (toaster) toaster.style.display = 'none';
    }, 4000);

    this.showToast(`🎉 ${downloadedCount} tracks saved offline! View in Library → 💾 Offline Saved.`);
    this.updateFavoritesCount();
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
  const menuMyLibrary    = document.getElementById('menuMyLibrary');
  const menuMyPlaylists  = document.getElementById('menuMyPlaylists');
  const menuOfflineSaved = document.getElementById('menuOfflineSaved');
  const menuLiveRadio    = document.getElementById('menuLiveRadio');
  const menuJamRoom      = document.getElementById('menuJamRoom');
  const menuAmbience     = document.getElementById('menuAmbience');
  const menuLogoutBtn    = document.getElementById('menuLogoutBtn');

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
      setTimeout(() => {
        window.musicApp.setLibTab && window.musicApp.setLibTab('playlists');
        window.musicApp.showLibrarySection && window.musicApp.showLibrarySection('playlists_grid');
      }, 80);
    });
  }
  if (menuOfflineSaved) {
    menuOfflineSaved.addEventListener('click', () => {
      userMenuOverlay.classList.remove('open');
      window.musicApp.showCustomView('favorites');
      setTimeout(() => {
        window.musicApp.setLibTab && window.musicApp.setLibTab('offline');
        window.musicApp.showLibrarySection && window.musicApp.showLibrarySection('offline');
      }, 80);
    });
  }
  if (menuLiveRadio) {
    menuLiveRadio.addEventListener('click', () => {
      userMenuOverlay.classList.remove('open');
      window.musicApp.showCustomView('radio');
    });
  }
  if (menuJamRoom) {
    menuJamRoom.addEventListener('click', () => {
      userMenuOverlay.classList.remove('open');
      window.musicApp.openJamModal && window.musicApp.openJamModal();
    });
  }
  if (menuAmbience) {
    menuAmbience.addEventListener('click', () => {
      userMenuOverlay.classList.remove('open');
      window.musicApp.openAmbienceModal && window.musicApp.openAmbienceModal();
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
