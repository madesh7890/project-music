/**
 * RaagaStream (நாதாலயா) - Client Audio Player & Music Engine
 * Built for Old to New Tamil, Malayalam, Hindi, Telugu, and English songs.
 */

class RaagaPlayer {
  constructor() {
    this.audio = document.getElementById('audioElement');
    this.currentSong = null;
    this.queue = [];
    this.queueIndex = -1;
    this.isPlaying = false;
    this.isShuffled = false;
    this.repeatMode = 'all'; // 'off' | 'all' | 'one'
    this.currentQuality = '320';
    this.favorites = this.loadStoredList('raaga_favorites');
    this.history = this.loadStoredList('raaga_history');
    this.currentLanguage = 'all';

    // Audio Visualizer Context
    this.audioCtx = null;
    this.analyser = null;
    this.dataArray = null;
    this.isVisualizerInit = false;

    this.initDOMElements();
    this.initAudioEvents();
    this.initUIEvents();
    this.initKeyboardShortcuts();
    this.initCanvasVisualizer();
    this.loadCuratedShelves();
    this.updateFavoritesCount();
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
    // Top & Search
    this.searchInput = document.getElementById('searchInput');
    this.clearSearchBtn = document.getElementById('clearSearchBtn');
    this.searchLoader = document.getElementById('searchLoader');
    this.searchResultsSection = document.getElementById('searchResultsSection');
    this.searchResultsGrid = document.getElementById('searchResultsGrid');
    this.searchResultsTitle = document.getElementById('searchResultsTitle');
    this.searchResultsSubtitle = document.getElementById('searchResultsSubtitle');
    this.closeSearchSectionBtn = document.getElementById('closeSearchSectionBtn');
    this.qualitySelect = document.getElementById('qualitySelect');
    this.vinylModeBtn = document.getElementById('vinylModeBtn');
    this.mobileMenuBtn = document.getElementById('mobileMenuBtn');
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

    // Bottom Player
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
    this.queueToggleBtn = document.getElementById('queueToggleBtn');
    this.expandPlayerBtn = document.getElementById('expandPlayerBtn');
    this.openVinylFromThumb = document.getElementById('openVinylFromThumb');
    this.miniEqualizer = document.getElementById('miniEqualizer');

    // Sidebar Player Card
    this.sidebarMiniPlayer = document.getElementById('sidebarMiniPlayer');
    this.sidebarCover = document.getElementById('sidebarCover');
    this.sidebarTitle = document.getElementById('sidebarTitle');
    this.sidebarArtist = document.getElementById('sidebarArtist');

    // Queue Drawer
    this.queueDrawer = document.getElementById('queueDrawer');
    this.closeQueueBtn = document.getElementById('closeQueueBtn');
    this.queueList = document.getElementById('queueList');
    this.queueCount = document.getElementById('queueCount');
    this.clearQueueBtn = document.getElementById('clearQueueBtn');

    // Vinyl Turntable Modal
    this.vinylModal = document.getElementById('vinylModal');
    this.closeVinylModalBtn = document.getElementById('closeVinylModalBtn');
    this.closeVinylModalBackdrop = document.getElementById('closeVinylModalBackdrop');
    this.modalVinylRecord = document.getElementById('modalVinylRecord');
    this.vinylCenterImage = document.getElementById('vinylCenterImage');
    this.tonearmAssembly = document.getElementById('tonearmAssembly');
    this.turntableBase = document.querySelector('.turntable-base');
    this.modalSongTitle = document.getElementById('modalSongTitle');
    this.modalSongArtist = document.getElementById('modalSongArtist');
    this.modalSongAlbum = document.getElementById('modalSongAlbum');
    this.tabVinyl = document.getElementById('tabVinyl');
    this.tabLyrics = document.getElementById('tabLyrics');
    this.modalVinylBody = document.getElementById('modalVinylBody');
    this.modalLyricsBody = document.getElementById('modalLyricsBody');
    this.lyricsText = document.getElementById('lyricsText');
    this.lyricsSongTitle = document.getElementById('lyricsSongTitle');
    this.canvas = document.getElementById('visualizerCanvas');

    // Custom View (Liked Songs & History)
    this.customView = document.getElementById('customView');
    this.customViewTitle = document.getElementById('customViewTitle');
    this.customViewSubtitle = document.getElementById('customViewSubtitle');
    this.customViewGrid = document.getElementById('customViewGrid');
    this.playAllCustomBtn = document.getElementById('playAllCustomBtn');
    this.favoritesCount = document.getElementById('favoritesCount');

    // Toast
    this.toast = document.getElementById('toast');
    this.ambientBackdrop = document.getElementById('ambientBackdrop');
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

  initAudioEvents() {
    this.audio.addEventListener('play', () => {
      this.isPlaying = true;
      this.updatePlayStateUI();
      this.startVisualizer();
    });

    this.audio.addEventListener('pause', () => {
      this.isPlaying = false;
      this.updatePlayStateUI();
    });

    this.audio.addEventListener('ended', () => {
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
      this.progressBar.style.width = `${progress}%`;
      const progressThumb = document.getElementById('progressThumb');
      if (progressThumb) progressThumb.style.left = `${progress}%`;
      this.currentTimeText.textContent = this.formatTime(this.audio.currentTime);
      this.totalDurationText.textContent = this.formatTime(this.audio.duration);
    });

    this.audio.addEventListener('progress', () => {
      if (this.audio.buffered.length > 0 && this.audio.duration) {
        const bufferedEnd = this.audio.buffered.end(this.audio.buffered.length - 1);
        const bufferedPercent = (bufferedEnd / this.audio.duration) * 100;
        this.bufferedBar.style.width = `${bufferedPercent}%`;
      }
    });

    this.audio.addEventListener('error', (e) => {
      console.warn('Audio playback error, attempting fallback stream...');
      if (this.currentSong && this.currentSong.streams) {
        // Fallback quality
        const fallback = this.currentSong.streams.stream_160 || this.currentSong.streams.stream_96 || this.currentSong.playUrl;
        if (this.audio.src !== fallback) {
          this.audio.src = fallback;
          this.audio.play().catch(() => {});
        }
      }
    });
  }

  updatePlayStateUI() {
    if (this.isPlaying) {
      this.playIcon.style.display = 'none';
      this.pauseIcon.style.display = 'block';
      this.sidebarMiniPlayer.classList.add('is-playing');
      this.modalVinylRecord.classList.add('spinning');
      this.tonearmAssembly.classList.add('playing');
      this.turntableBase.classList.add('is-playing');
      this.miniEqualizer.classList.add('playing');
    } else {
      this.playIcon.style.display = 'block';
      this.pauseIcon.style.display = 'none';
      this.sidebarMiniPlayer.classList.remove('is-playing');
      this.modalVinylRecord.classList.remove('spinning');
      this.tonearmAssembly.classList.remove('playing');
      this.turntableBase.classList.remove('is-playing');
      this.miniEqualizer.classList.remove('playing');
    }
  }

  initUIEvents() {
    // Play / Pause Toggle
    this.playPauseBtn.addEventListener('click', () => {
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
    });

    // Next / Prev
    this.nextBtn.addEventListener('click', () => this.playNext());
    this.prevBtn.addEventListener('click', () => this.playPrev());

    // Shuffle Toggle
    this.shuffleBtn.addEventListener('click', () => {
      this.isShuffled = !this.isShuffled;
      this.shuffleBtn.classList.toggle('active', this.isShuffled);
      this.showToast(this.isShuffled ? '🔀 Shuffle On' : '➡️ Shuffle Off');
    });

    // Repeat Mode (all -> one -> off)
    this.repeatBtn.addEventListener('click', () => {
      if (this.repeatMode === 'all') {
        this.repeatMode = 'one';
        this.repeatBtn.classList.add('active');
        this.repeatOneBadge.classList.add('show');
        this.showToast('🔂 Repeat One Song');
      } else if (this.repeatMode === 'one') {
        this.repeatMode = 'off';
        this.repeatBtn.classList.remove('active');
        this.repeatOneBadge.classList.remove('show');
        this.showToast('➡️ Repeat Off');
      } else {
        this.repeatMode = 'all';
        this.repeatBtn.classList.add('active');
        this.repeatOneBadge.classList.remove('show');
        this.showToast('🔁 Repeat All Queue');
      }
    });

    // Progress Bar Scrubber
    this.progressWrapper.addEventListener('click', (e) => {
      if (!this.audio.duration) return;
      const rect = this.progressWrapper.getBoundingClientRect();
      const clickPos = (e.clientX - rect.left) / rect.width;
      this.audio.currentTime = clickPos * this.audio.duration;
    });

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

    // Audio Quality Switch
    this.qualitySelect.addEventListener('change', (e) => {
      this.currentQuality = e.target.value;
      this.showToast(`🎧 Quality set to ${this.currentQuality === '320' ? '320kbps Ultra-HD' : this.currentQuality + 'kbps'}`);
      if (this.currentSong && this.isPlaying) {
        const currentTime = this.audio.currentTime;
        const newUrl = this.getStreamUrlForQuality(this.currentSong, this.currentQuality);
        this.audio.src = newUrl;
        this.audio.currentTime = currentTime;
        this.audio.play();
      }
    });

    // Like / Favorite Current Song
    this.playerFavBtn.addEventListener('click', () => {
      if (!this.currentSong) return;
      this.toggleFavorite(this.currentSong);
    });

    // Search Input with Debounce
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

    this.clearSearchBtn.addEventListener('click', () => {
      this.searchInput.value = '';
      this.clearSearchBtn.style.display = 'none';
      this.hideSearchResults();
      this.searchInput.focus();
    });

    this.closeSearchSectionBtn.addEventListener('click', () => {
      this.hideSearchResults();
    });

    // Language Bar Tabs
    document.querySelectorAll('.lang-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.lang-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentLanguage = tab.dataset.lang;
        this.handleLanguageFilter(this.currentLanguage);
      });
    });

    // Quick Search Suggestion Tags
    document.querySelectorAll('.quick-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        const query = tag.dataset.query;
        this.searchInput.value = query;
        this.clearSearchBtn.style.display = 'block';
        this.performSearch(query);
      });
    });

    // Sidebar Era / Query Tags
    document.querySelectorAll('.tag-nav').forEach(btn => {
      btn.addEventListener('click', () => {
        const query = btn.dataset.query;
        this.searchInput.value = query;
        this.clearSearchBtn.style.display = 'block';
        this.performSearch(query);
      });
    });

    // Navigation Menu (Home, Search, Liked, History)
    document.getElementById('navHome').addEventListener('click', () => this.switchView('home'));
    document.getElementById('navSearch').addEventListener('click', () => {
      this.switchView('home');
      this.searchInput.focus();
    });
    document.getElementById('navFavorites').addEventListener('click', () => this.showCustomView('favorites'));
    document.getElementById('navHistory').addEventListener('click', () => this.showCustomView('history'));

    // Play All from Liked / History view
    this.playAllCustomBtn.addEventListener('click', () => {
      const list = this.currentViewMode === 'favorites' ? this.favorites : this.history;
      if (list && list.length > 0) {
        this.playSong(list[0], list, 0);
        this.showToast(`🎶 Playing ${list.length} songs`);
      }
    });

    // Queue Drawer Toggle
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

    // Vinyl Turntable Modal & Fullscreen
    const openVinylModal = () => {
      this.vinylModal.classList.add('active');
      this.updateVinylModalInfo();
      this.switchModalTab('vinyl');
    };
    this.vinylModeBtn.addEventListener('click', openVinylModal);
    this.expandPlayerBtn.addEventListener('click', openVinylModal);
    this.openVinylFromThumb.addEventListener('click', openVinylModal);

    const closeVinylModal = () => {
      this.vinylModal.classList.remove('active');
    };
    this.closeVinylModalBtn.addEventListener('click', closeVinylModal);
    this.closeVinylModalBackdrop.addEventListener('click', closeVinylModal);

    // Modal Tabs (Turntable vs Lyrics)
    this.tabVinyl.addEventListener('click', () => this.switchModalTab('vinyl'));
    this.tabLyrics.addEventListener('click', () => this.switchModalTab('lyrics'));

    // Mobile Hamburger Menu
    this.mobileMenuBtn.addEventListener('click', () => {
      this.sidebar.classList.toggle('open');
    });
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
      // Ignore if user is typing in search input
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
          this.vinylModal.classList.toggle('active');
          this.updateVinylModalInfo();
          break;
        case 'Slash':
          e.preventDefault();
          this.searchInput.focus();
          break;
        case 'Escape':
          this.vinylModal.classList.remove('active');
          this.queueDrawer.classList.remove('open');
          this.sidebar.classList.remove('open');
          break;
      }
    });
  }

  // ==========================================
  // Web Audio Visualizer
  // ==========================================
  initCanvasVisualizer() {
    this.canvasCtx = this.canvas.getContext('2d');
  }

  setupAudioContext() {
    if (this.isVisualizerInit) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 128;
      
      const source = this.audioCtx.createMediaElementSource(this.audio);
      source.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);
      
      this.bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(this.bufferLength);
      this.isVisualizerInit = true;
    } catch (e) {
      console.warn('AudioContext not allowed yet or CORS restricted:', e.message);
    }
  }

  startVisualizer() {
    this.setupAudioContext();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    this.renderVisualizerFrame();
  }

  renderVisualizerFrame() {
    if (!this.isPlaying) return;
    requestAnimationFrame(() => this.renderVisualizerFrame());

    if (!this.analyser || !this.dataArray) {
      this.renderSimulatedVisualizer();
      return;
    }

    this.analyser.getByteFrequencyData(this.dataArray);
    const width = this.canvas.width;
    const height = this.canvas.height;
    this.canvasCtx.clearRect(0, 0, width, height);

    const barWidth = (width / this.bufferLength) * 2;
    let x = 0;

    for (let i = 0; i < this.bufferLength; i++) {
      const barHeight = (this.dataArray[i] / 255) * height;
      const gradient = this.canvasCtx.createLinearGradient(0, height, 0, 0);
      gradient.addColorStop(0, '#00f0ff');
      gradient.addColorStop(0.5, '#7000ff');
      gradient.addColorStop(1, '#ff007b');

      this.canvasCtx.fillStyle = gradient;
      this.canvasCtx.beginPath();
      this.canvasCtx.roundRect(x, height - barHeight, barWidth - 2, barHeight, [4, 4, 0, 0]);
      this.canvasCtx.fill();

      x += barWidth;
    }
  }

  renderSimulatedVisualizer() {
    const width = this.canvas.width;
    const height = this.canvas.height;
    this.canvasCtx.clearRect(0, 0, width, height);
    const bars = 32;
    const barWidth = width / bars;

    for (let i = 0; i < bars; i++) {
      const barHeight = (Math.sin(Date.now() / 150 + i) * 0.4 + 0.5) * height * 0.8;
      const gradient = this.canvasCtx.createLinearGradient(0, height, 0, 0);
      gradient.addColorStop(0, '#00f0ff');
      gradient.addColorStop(1, '#ff007b');
      this.canvasCtx.fillStyle = gradient;
      this.canvasCtx.beginPath();
      this.canvasCtx.roundRect(i * barWidth, height - barHeight, barWidth - 3, barHeight, [3, 3, 0, 0]);
      this.canvasCtx.fill();
    }
  }

  // ==========================================
  // Audio Playback Management
  // ==========================================
  getStreamUrlForQuality(song, quality) {
    if (!song.streams) return song.playUrl;
    if (quality === '320' && song.streams.stream_320) return song.streams.stream_320;
    if (quality === '160' && song.streams.stream_160) return song.streams.stream_160;
    if (quality === '96' && song.streams.stream_96) return song.streams.stream_96;
    return song.playUrl;
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
    const audioUrl = this.getStreamUrlForQuality(song, this.currentQuality);

    this.audio.src = audioUrl;
    this.audio.play().then(() => {
      this.isPlaying = true;
      this.updatePlayStateUI();
    }).catch(err => {
      console.warn('Playback error, retrying proxy:', err.message);
      // Try through audio proxy if CORS is restricted by browser
      this.audio.src = `/api/proxy-audio?url=${encodeURIComponent(audioUrl)}`;
      this.audio.play().catch(e => console.error('Final play failure:', e));
    });

    // Update Bottom Player UI
    this.playerThumb.src = song.image;
    this.playerTitle.textContent = song.title;
    this.playerArtist.textContent = `${song.album ? song.album + ' • ' : ''}${song.artist}`;
    this.playerFavBtn.classList.toggle('active', this.isFavorite(song.id));

    // Update Sidebar Mini Player
    this.sidebarCover.src = song.image;
    this.sidebarTitle.textContent = song.title;
    this.sidebarArtist.textContent = song.artist || song.album;

    // Update Vinyl Modal
    this.updateVinylModalInfo();

    // Update Dynamic Ambient Glow
    this.updateAmbientGlow(song.image);

    // Save to History
    this.addToHistory(song);

    // Update Queue drawer highlighting
    this.renderQueueDrawer();
  }

  playNext() {
    if (this.queue.length === 0) return;
    if (this.isShuffled) {
      this.queueIndex = Math.floor(Math.random() * this.queue.length);
    } else {
      this.queueIndex = (this.queueIndex + 1) % this.queue.length;
    }
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
    this.saveStoredList('raaga_history', this.history);
  }

  isFavorite(songId) {
    return this.favorites.some(s => s.id === songId);
  }

  toggleFavorite(song) {
    if (this.isFavorite(song.id)) {
      this.favorites = this.favorites.filter(s => s.id !== song.id);
      this.showToast(`💔 Removed "${song.title}" from Liked Songs`);
    } else {
      this.favorites.unshift(song);
      this.showToast(`❤️ Added "${song.title}" to Liked Songs`);
    }
    this.saveStoredList('raaga_favorites', this.favorites);
    this.playerFavBtn.classList.toggle('active', this.isFavorite(song.id));
    this.updateFavoritesCount();

    // If currently on favorites view, refresh grid
    if (this.currentViewMode === 'favorites') {
      this.renderCustomGrid(this.favorites);
    }
  }

  updateFavoritesCount() {
    this.favoritesCount.textContent = this.favorites.length;
  }

  updateAmbientGlow(imgSrc) {
    // Generate gentle ambient backglow reflection
    this.ambientBackdrop.style.background = `
      radial-gradient(circle at 75% 20%, rgba(0, 240, 255, 0.18), transparent 45%),
      radial-gradient(circle at 20% 80%, rgba(255, 0, 123, 0.16), transparent 50%),
      radial-gradient(circle at 50% 50%, rgba(112, 0, 255, 0.14), transparent 60%)
    `;
  }

  // ==========================================
  // Vinyl Turntable Modal & Lyrics
  // ==========================================
  updateVinylModalInfo() {
    if (!this.currentSong) return;
    this.vinylCenterImage.src = this.currentSong.image;
    this.modalSongTitle.textContent = this.currentSong.title;
    this.modalSongArtist.textContent = this.currentSong.artist;
    this.modalSongAlbum.textContent = `Album: ${this.currentSong.album} ${this.currentSong.year ? '(' + this.currentSong.year + ')' : ''}`;
  }

  switchModalTab(tabName) {
    if (tabName === 'vinyl') {
      this.tabVinyl.classList.add('active');
      this.tabLyrics.classList.remove('active');
      this.modalVinylBody.style.display = 'block';
      this.modalLyricsBody.style.display = 'none';
    } else {
      this.tabLyrics.classList.add('active');
      this.tabVinyl.classList.remove('active');
      this.modalVinylBody.style.display = 'none';
      this.modalLyricsBody.style.display = 'block';
      this.loadLyrics();
    }
  }

  async loadLyrics() {
    if (!this.currentSong) {
      this.lyricsText.textContent = 'No track is currently playing.';
      return;
    }
    this.lyricsSongTitle.textContent = `Lyrics: ${this.currentSong.title}`;
    this.lyricsText.textContent = 'Fetching lyrics for this track...';

    try {
      const res = await fetch(`/api/lyrics?id=${this.currentSong.id}`);
      const data = await res.json();
      if (data.success && data.lyrics) {
        this.lyricsText.textContent = data.lyrics;
      } else {
        this.lyricsText.innerHTML = `
          <div style="padding: 30px; color: var(--text-muted);">
            <p style="font-size: 1.1rem; margin-bottom: 8px;">🎶 Live Lyrics Unavailable</p>
            <p style="font-size: 0.85rem;">Enjoy the high-fidelity 320kbps audio playback and 3D Turntable view!</p>
          </div>
        `;
      }
    } catch (e) {
      this.lyricsText.textContent = 'Could not load lyrics. Enjoy the music!';
    }
  }

  // ==========================================
  // Curated Shelves & Home View
  // ==========================================
  async loadCuratedShelves() {
    try {
      const res = await fetch('/api/curated-shelves');
      const data = await res.json();
      if (data.success && data.shelves) {
        this.renderCuratedShelves(data.shelves);

        // Setup Hero Spotlight with first song of Trending Tamil
        const firstShelf = data.shelves[0];
        if (firstShelf && firstShelf.songs.length > 0) {
          this.setupHeroBanner(firstShelf.songs[0]);
        }
      }
    } catch (e) {
      console.error('Failed to load shelves:', e);
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

      // Scroll handlers
      const leftBtn = shelfEl.querySelector('.scroll-left');
      const rightBtn = shelfEl.querySelector('.scroll-right');
      leftBtn.addEventListener('click', () => {
        row.scrollBy({ left: -400, behavior: 'smooth' });
      });
      rightBtn.addEventListener('click', () => {
        row.scrollBy({ left: 400, behavior: 'smooth' });
      });

      this.shelvesContainer.appendChild(shelfEl);
    });
  }

  createSongCard(song, songList) {
    const card = document.createElement('div');
    card.className = 'song-card';
    card.innerHTML = `
      <div class="song-card-thumb-wrap">
        <img src="${song.image}" alt="${song.title}" loading="lazy">
        <span class="song-card-badge">320 KBPS</span>
        <div class="song-play-overlay">
          <button class="overlay-play-btn" title="Play">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          </button>
        </div>
      </div>
      <div class="song-card-info">
        <div class="song-card-title" title="${song.title}">${song.title}</div>
        <div class="song-card-album" title="${song.album}">${song.album || 'Single'}</div>
        <div class="song-card-artist" title="${song.artist}">${song.artist}</div>
        <div class="song-card-footer">
          <span class="song-year-badge">${song.year || ''}</span>
          <div class="song-card-actions">
            <button class="card-action-btn btn-card-queue" title="Add to Queue">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
            <button class="card-action-btn btn-card-fav ${this.isFavorite(song.id) ? 'active' : ''}" title="Like Song">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="${this.isFavorite(song.id) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path></svg>
            </button>
          </div>
        </div>
      </div>
    `;

    // Click card to play
    card.addEventListener('click', (e) => {
      if (e.target.closest('.card-action-btn')) return;
      this.playSong(song, songList);
    });

    // Add to Queue button
    const queueBtn = card.querySelector('.btn-card-queue');
    queueBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.addToQueue(song);
    });

    // Favorite button
    const favBtn = card.querySelector('.btn-card-fav');
    favBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleFavorite(song);
      favBtn.classList.toggle('active', this.isFavorite(song.id));
      favBtn.querySelector('svg').setAttribute('fill', this.isFavorite(song.id) ? 'currentColor' : 'none');
    });

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
        <div style="grid-column: 1/-1; text-align: center; padding: 60px; color: var(--text-muted);">
          <h3>No songs found for "${query}"</h3>
          <p style="margin-top: 8px;">Try searching for a movie name (e.g. Leo, Aavesham, Deva), artist (SPB, Anirudh), or language.</p>
        </div>
      `;
      return;
    }

    songs.forEach(song => {
      const card = this.createSongCard(song, songs);
      this.searchResultsGrid.appendChild(card);
    });

    // Smooth scroll to results
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
  // Custom Views (Liked Songs & History)
  // ==========================================
  showCustomView(mode) {
    this.currentViewMode = mode;
    this.searchResultsSection.style.display = 'none';
    this.homeView.style.display = 'none';
    this.customView.style.display = 'block';

    // Update active nav
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    if (mode === 'favorites') {
      document.getElementById('navFavorites').classList.add('active');
      this.customViewTitle.textContent = '❤️ Liked Songs';
      this.customViewSubtitle.textContent = `${this.favorites.length} songs saved in your collection`;
      this.renderCustomGrid(this.favorites);
    } else {
      document.getElementById('navHistory').classList.add('active');
      this.customViewTitle.textContent = '🕒 Recently Played';
      this.customViewSubtitle.textContent = `Songs you recently listened to`;
      this.renderCustomGrid(this.history);
    }
  }

  renderCustomGrid(list) {
    this.customViewGrid.innerHTML = '';
    if (!list || list.length === 0) {
      this.customViewGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 60px; color: var(--text-muted);">
          <h3>No songs found in this list</h3>
          <p style="margin-top: 8px;">Explore songs from Home or Search to add them here.</p>
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
}

// Initialize player when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  window.player = new RaagaPlayer();
});
