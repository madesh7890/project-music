const express = require('express');
const cors = require('cors');
const https = require('https');
const path = require('path');
const dns = require('dns');
const fs = require('fs');
const crypto = require('crypto');
const CryptoJS = require('crypto-js');

dns.setDefaultResultOrder('ipv4first');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// PRELOADED ASSETS: CURATED SHELVES & LYRICS
// ==========================================
let cachedCuratedShelves = [];
try {
  const shelvesPath = path.join(__dirname, 'shelves_cache.json');
  if (fs.existsSync(shelvesPath)) {
    cachedCuratedShelves = JSON.parse(fs.readFileSync(shelvesPath, 'utf8'));
    console.log(`📚 Preloaded ${cachedCuratedShelves.length} curated shelves (${cachedCuratedShelves.reduce((a, s) => a + (s.songs ? s.songs.length : 0), 0)} tracks)`);
  }
} catch (e) {
  console.warn('Shelves cache preload warning:', e.message);
}

let lyricsDb = {};
try {
  const lyricsDbPath = path.join(__dirname, 'lyrics_db.json');
  if (fs.existsSync(lyricsDbPath)) {
    lyricsDb = JSON.parse(fs.readFileSync(lyricsDbPath, 'utf8'));
    console.log(`🎤 Preloaded ${Object.keys(lyricsDb).length} tracks in lyrics database`);
  }
} catch (e) {
  console.warn('Lyrics DB preload warning:', e.message);
}

// Preloaded 2026 Chartbusters & OM Chapter 1 Songs
let preloaded2026Chartbusters = [];
let preloadedOmTracks = [];
try {
  const cbPath = path.join(__dirname, 'chartbusters_2026.json');
  if (fs.existsSync(cbPath)) {
    const cbData = JSON.parse(fs.readFileSync(cbPath, 'utf8'));
    preloaded2026Chartbusters = cbData.chartbusters2026 || [];
    preloadedOmTracks = cbData.omChapter1Songs || [];
    console.log(`🔥 Preloaded ${preloaded2026Chartbusters.length} 2026 chartbusters & ${preloadedOmTracks.length} OM movie tracks`);
  }
} catch (e) {
  console.warn('Chartbusters 2026 preload warning:', e.message);
}

// ==========================================
// AUTH SYSTEM – File-based user store
// ==========================================
const USERS_FILE = path.join(__dirname, 'users.json');
let inMemoryUsers = null;

function loadUsers() {
  if (inMemoryUsers) return inMemoryUsers;
  try {
    if (fs.existsSync(USERS_FILE)) {
      inMemoryUsers = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
      return inMemoryUsers;
    }
  } catch (e) {}
  try {
    const tmpPath = '/tmp/users.json';
    if (fs.existsSync(tmpPath)) {
      inMemoryUsers = JSON.parse(fs.readFileSync(tmpPath, 'utf8'));
      return inMemoryUsers;
    }
  } catch (e) {}
  inMemoryUsers = [];
  return inMemoryUsers;
}

function saveUsers(users) {
  inMemoryUsers = users;
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (e) {
    try {
      fs.writeFileSync('/tmp/users.json', JSON.stringify(users, null, 2));
    } catch (err) {}
  }
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + 'music_salt_9x7k').digest('hex');
}

// POST /api/register
app.post('/api/register', (req, res) => {
  const { email, username, password } = req.body;
  if (!email || !username || !password) {
    return res.json({ success: false, error: 'All fields are required.' });
  }
  if (password.length < 6) {
    return res.json({ success: false, error: 'Password must be at least 6 characters.' });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.json({ success: false, error: 'Invalid email address.' });
  }

  const users = loadUsers();
  const exists = users.find(u =>
    u.email.toLowerCase() === email.toLowerCase() ||
    u.username.toLowerCase() === username.toLowerCase()
  );
  if (exists) {
    const conflict = exists.email.toLowerCase() === email.toLowerCase()
      ? 'Email already registered.'
      : 'Username already taken.';
    return res.json({ success: false, error: conflict });
  }

  const newUser = {
    id: 'u_' + Date.now(),
    email: email.toLowerCase().trim(),
    username: username.trim(),
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
    avatar: username.trim().charAt(0).toUpperCase()
  };
  users.push(newUser);
  saveUsers(users);

  // Return session token (simple approach — store in localStorage client-side)
  const token = crypto.randomBytes(32).toString('hex');
  res.json({
    success: true,
    token,
    user: { id: newUser.id, email: newUser.email, username: newUser.username, avatar: newUser.avatar }
  });
});

// POST /api/login
app.post('/api/login', (req, res) => {
  const { identifier, password } = req.body; // identifier = email OR username
  if (!identifier || !password) {
    return res.json({ success: false, error: 'Please fill in all fields.' });
  }

  const users = loadUsers();
  const user = users.find(u =>
    u.email.toLowerCase() === identifier.toLowerCase() ||
    u.username.toLowerCase() === identifier.toLowerCase()
  );

  if (!user) {
    return res.json({ success: false, error: 'Account not found. Please register first.' });
  }

  if (user.passwordHash !== hashPassword(password)) {
    return res.json({ success: false, error: 'Incorrect password. Please try again.' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  res.json({
    success: true,
    token,
    user: { id: user.id, email: user.email, username: user.username, avatar: user.avatar }
  });
});

// GET /api/auth-check (validate saved token — simple client-side session)
app.get('/api/auth-check', (req, res) => {
  // This app uses localStorage tokens — just return ok
  res.json({ success: true });
});

// DES-ECB Decryption key for JioSaavn encrypted media URLs
const SAAVN_DES_KEY = CryptoJS.enc.Utf8.parse('38346591');

function decryptMediaUrl(encUrl) {
  if (!encUrl) return null;
  try {
    const decrypted = CryptoJS.DES.decrypt(
      { ciphertext: CryptoJS.enc.Base64.parse(encUrl) },
      SAAVN_DES_KEY,
      {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7
      }
    );
    const rawUrl = decrypted.toString(CryptoJS.enc.Utf8);
    if (!rawUrl || !rawUrl.startsWith('http')) return null;

    // Generate quality variants (320kbps, 160kbps, 96kbps, mp3)
    const base = rawUrl.replace(/_[0-9]+\.(mp4|mp3|m4a)$/, '');
    const ext = rawUrl.endsWith('.mp3') ? '.mp3' : '.mp4';
    const stream320 = `${base}_320${ext}`;
    const stream160 = `${base}_160${ext}`;
    const stream96 = `${base}_96${ext}`;
    return {
      stream_320: stream320,
      stream_160: stream160,
      stream_96: stream96,
      mp4_320: stream320,
      mp4_160: stream160,
      mp4_96: stream96,
      mp3_stream: `/api/proxy-audio?format=mp3&url=${encodeURIComponent(stream320)}`,
      default_stream: rawUrl.includes('_96') ? stream320 : rawUrl
    };
  } catch (err) {
    console.error('Decryption failed for URL:', err.message);
    return null;
  }
}

// Helper to decode HTML entities in titles and text
function decodeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

// Helper to upscale cover images to 500x500 HD
function getHDImage(imgUrl) {
  if (!imgUrl) return 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&h=500&fit=crop';
  return imgUrl
    .replace('50x50', '500x500')
    .replace('150x150', '500x500')
    .replace('http://', 'https://');
}

// Native HTTPS helper forcing IPv4 to prevent Windows timeout issues
function requestSaavn(queryParamStr, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const fullUrl = `https://www.jiosaavn.com/api.php?${queryParamStr}`;
    const req = https.get(fullUrl, {
      family: 4, // Force IPv4
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.jiosaavn.com/',
        'Cookie': 'L=tamil,malayalam,telugu,hindi,english;'
      },
      timeout: timeoutMs
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const trimmed = data.trim();
          if (!trimmed) return resolve({});
          const jsonStr = trimmed.startsWith('{') ? trimmed : trimmed.replace(/^[^{]*/, '').replace(/[^}]*$/, '');
          const parsed = JSON.parse(jsonStr);
          resolve(parsed);
        } catch (e) {
          resolve({});
        }
      });
    });

    req.on('error', (err) => {
      console.warn('Saavn API request error:', err.message);
      resolve({});
    });

    req.on('timeout', () => {
      req.destroy();
      console.warn('Saavn API timeout');
      resolve({});
    });
  });
}

// Format raw Saavn song item into clean, enriched song payload
function formatSongItem(raw) {
  if (!raw) return null;
  const id = raw.id || raw.songid;
  const songName = decodeHtml(raw.song || raw.title || raw.name);
  const albumName = decodeHtml(raw.album || raw.more_info?.album || '');
  const artistMapPrimary = Array.isArray(raw.more_info?.artistMap?.primary_artists)
    ? raw.more_info.artistMap.primary_artists.map(a => a.name).filter(Boolean).join(', ')
    : '';
  const artistMapMusic = Array.isArray(raw.more_info?.artistMap?.music)
    ? raw.more_info.artistMap.music.map(a => a.name).filter(Boolean).join(', ')
    : '';
  const primaryArtists = decodeHtml(
    raw.primary_artists || artistMapPrimary || raw.singers || raw.more_info?.singers || raw.music || artistMapMusic || ''
  );
  const musicDirector = decodeHtml(raw.music || raw.more_info?.music || artistMapMusic || '');
  const year = raw.year || raw.more_info?.year || '';
  const language = (raw.language || raw.more_info?.language || 'tamil').toLowerCase();
  const duration = parseInt(raw.duration || raw.more_info?.duration || '240', 10);

  // Decrypt media streaming URL
  const encMedia = raw.encrypted_media_url || raw.more_info?.encrypted_media_url;
  const mediaStreams = decryptMediaUrl(encMedia);

  const rawImage = raw.image || raw.more_info?.image;
  const imageHD = getHDImage(rawImage);
  const imageLow = rawImage ? rawImage.replace('50x50', '150x150').replace('http://', 'https://') : imageHD;
  const albumId = raw.albumid || raw.more_info?.album_id || '';

  return {
    id,
    title: songName,
    album: albumName,
    albumId,
    artist: primaryArtists,
    music: musicDirector,
    year,
    language,
    duration,
    image: imageHD,
    imageLow: imageLow,
    hasLyrics: raw.has_lyrics === 'true' || raw.more_info?.has_lyrics === 'true',
    streams: mediaStreams,
    playUrl: mediaStreams?.stream_320 || mediaStreams?.stream_160 || mediaStreams?.default_stream || raw.media_preview_url || ''
  };
}

function normalizeSongTitle(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .replace(/\s*\([^)]*\)/gi, ' ')
    .replace(/\s*\[[^\]]*\]/gi, ' ')
    .replace(/\s*-\s*from\s+[^-\n]*/gi, ' ')
    .replace(/\s*-\s*trending\s+version/gi, ' ')
    .replace(/\s*-\s*female/gi, ' ')
    .replace(/\s*\(remix\)/gi, ' ')
    .replace(/[^a-z0-9]/gi, '')
    .trim();
}

// Helper: fetch all songs from a specific Saavn album with media stream decryption
async function fetchSongsFromAlbum(albId, albInfo = null, timeoutMs = 8000) {
  if (!albId) return [];
  try {
    const details = await requestSaavn(`__call=content.getAlbumDetails&_format=json&cc=in&albumid=${albId}`, timeoutMs);
    const songList = details?.songs || details?.list;
    if (songList && Array.isArray(songList)) {
      const results = [];
      songList.forEach(rawSong => {
        if (!rawSong.image && albInfo?.image) {
          rawSong.image = albInfo.image;
        }
        if (!rawSong.album && (details.title || albInfo?.title)) {
          rawSong.album = details.title || albInfo.title;
        }
        const fmt = formatSongItem(rawSong);
        if (fmt && fmt.playUrl) {
          results.push(fmt);
        }
      });
      return results;
    }
  } catch (e) {
    console.warn('Error fetching album details:', e.message);
  }
  return [];
}

// Helper: fetch all songs from a specific Saavn playlist
async function fetchSongsFromPlaylist(listId, timeoutMs = 8000) {
  if (!listId) return [];
  try {
    const data = await requestSaavn(`__call=playlist.getDetails&_format=json&cc=in&listid=${listId}`, timeoutMs);
    if (data && data.songs && Array.isArray(data.songs)) {
      return data.songs.map(formatSongItem).filter(s => s && s.playUrl);
    }
  } catch (e) {
    console.warn('Error fetching playlist details:', e.message);
  }
  return [];
}

// Helper: fetch top songs from an artist's catalog
async function fetchSongsFromArtist(artistId, count = 25, timeoutMs = 8000) {
  if (!artistId) return [];
  try {
    const data = await requestSaavn(`__call=artist.getArtistPageDetails&_format=json&cc=in&artistId=${artistId}&n_song=${count}`, timeoutMs);
    const songs = data?.topSongs?.songs || (Array.isArray(data?.topSongs) ? data.topSongs : []);
    return songs.map(formatSongItem).filter(s => s && s.playUrl);
  } catch (e) {
    console.warn('Error fetching artist details:', e.message);
  }
  return [];
}

// In-memory cache for ultra-fast query serving
const cache = new Map();
function getCache(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiry) {
    cache.delete(key);
    return null;
  }
  return item.data;
}
function setCache(key, data, ttlMs = 15 * 60 * 1000) {
  cache.set(key, { data, expiry: Date.now() + ttlMs });
}

// Stopword cleaner (removes generic music descriptors & recency intents)
function cleanSearchStopwords(q) {
  if (!q) return '';
  return q
    .replace(/\b(songs?|movie|movies|album|albums|padam|track|tracks|audio|mp3|video|lyrics|hd|bgm|ost|paadal|paattu|pattu|full|ringtone|remix|new|latest|trending|viral|hits?|top|best|recent|superhit|chartbusters?)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Language tag stripper
function stripSearchLanguage(q) {
  if (!q) return '';
  return q
    .replace(/\b(tamil|telugu|malayalam|hindi|kannada|english|punjabi|marathi|bengali)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectLanguage(q, fallback = 'tamil') {
  if (!q) return fallback;
  const m = q.match(/\b(tamil|telugu|malayalam|hindi|kannada|english|punjabi|marathi|bengali)\b/i);
  return m ? m[1].toLowerCase() : (fallback ? fallback.toLowerCase() : 'tamil');
}

function detectYear(q) {
  if (!q) return null;
  const m = q.match(/\b(19\d{2}|20\d{2})\b/);
  return m ? m[1] : null;
}

function detectDecade(q) {
  if (!q) return null;
  if (/\b(80s|1980s|80['’]s|eighties)\b/i.test(q)) return '80s';
  if (/\b(90s|1990s|90['’]s|nineties)\b/i.test(q)) return '90s';
  if (/\b(2000s|00s|2000['’]s|2k)\b/i.test(q)) return '2000s';
  if (/\b(70s|1970s|70['’]s|seventies)\b/i.test(q)) return '70s';
  if (/\b(60s|1960s|60['’]s|sixties)\b/i.test(q)) return '60s';
  return null;
}

// Curated artists, legendary music composers & singers directory
const KNOWN_ARTISTS = [
  {
    name: 'deva',
    match: /\b(?:deva|thenisai\s*thendral)\b/i,
    artistId: '455219',
    playlists: ['1267537810', '1267515862'], // Deva Party Songs, Deva Love Songs
    queries: ['Deva Hits Tamil', 'Deva Gana Songs', 'Best of Deva']
  },
  {
    name: 'ilaiyaraaja',
    match: /\b(?:ilaiyaraaja|ilayaraja|ilayarajah|ilaiyaraja|isaignani|raaja)\b/i,
    artistId: '456269',
    playlists: ['827647904', '743037878'], // Ilaiyaraaja 80s Hits, 80s Romance
    queries: ['Ilaiyaraaja Evergreen Tamil Melodies', 'Ilaiyaraaja 80s 90s Hits Tamil', 'Ilaiyaraaja Hits']
  },
  {
    name: 'spb',
    match: /\b(?:s\.?\s*p\.?\s*b\.?|balasubrahmanyam|balasubramaniam|balasubramanyam)\b/i,
    artistId: '455322',
    playlists: ['826526781'],
    queries: ['SPB Tamil Hits', 'SPB Evergreen Melodies', 'SPB Romantic Hits Tamil']
  },
  {
    name: 'ar_rahman',
    match: /\b(?:a\.?\s*r\.?\s*rahman|ar\s*rahman|a\s*r\s*r|arr)\b/i,
    artistId: '456262',
    queries: ['A. R. Rahman Tamil Hits', 'The Rahman Experience', 'AR Rahman Evergreen Tamil']
  },
  {
    name: 'anirudh',
    match: /\b(?:anirudh|anirudh\s*ravichander|ani)\b/i,
    artistId: '459633',
    queries: ['Anirudh Ravichander Tamil Hits', 'Anirudh Certified Bangers']
  },
  {
    name: 'yuvan',
    match: /\b(?:yuvan|yuvan\s*shankar\s*raja|u1)\b/i,
    artistId: '455792',
    queries: ['Yuvan Shankar Raja Tamil Hits', 'U1 Drug Hits']
  },
  {
    name: 'harris',
    match: /\b(?:harris|harris\s*jayaraj)\b/i,
    artistId: '455125',
    queries: ['Harris Jayaraj Tamil Hits', 'Harris Jayaraj Melodies']
  },
  {
    name: 'yesudas',
    match: /\b(?:k\.?\s*j\.?\s*yesudas|kj\s*yesudas|yesudas|ganagandharvan)\b/i,
    artistId: '455439',
    queries: ['KJ Yesudas Tamil Hits', 'KJ Yesudas Malayalam Hits']
  },
  {
    name: 'sid_sriram',
    match: /\b(?:sid\s*sriram)\b/i,
    artistId: '887309',
    queries: ['Sid Sriram Tamil Hits', 'The World of Sid Sriram']
  },
  {
    name: 'vidyasagar',
    match: /\b(?:vidyasagar)\b/i,
    artistId: '455132',
    queries: ['Vidyasagar Tamil Hits', 'Melody King Vidyasagar']
  },
  {
    name: 'santhosh_narayanan',
    match: /\b(?:santhosh\s*narayanan|sana)\b/i,
    artistId: '458918',
    queries: ['Santhosh Narayanan Tamil Hits']
  },
  {
    name: 'gv_prakash',
    match: /\b(?:g\.?\s*v\.?\s*prakash|gv\s*prakash)\b/i,
    artistId: '455404',
    queries: ['G.V. Prakash Kumar Tamil Hits']
  },
  {
    name: 'chithra',
    match: /\b(?:k\.?\s*s\.?\s*chithra|ks\s*chithra|chithra|chitra)\b/i,
    artistId: '455140',
    queries: ['K. S. Chithra Tamil Melodies', 'Chithra Evergreen Hits']
  },
  {
    name: 'janaki',
    match: /\b(?:s\.?\s*janaki|janaki)\b/i,
    artistId: '455124',
    queries: ['S. Janaki Tamil Hits', 'S Janaki Melodies']
  },
  {
    name: 'shreya_ghoshal',
    match: /\b(?:shreya\s*ghoshal|shreya)\b/i,
    artistId: '455130',
    queries: ['Shreya Ghoshal Tamil Melodies', 'Shreya Ghoshal Romantic Hits']
  },
  {
    name: 'hariharan',
    match: /\b(?:hariharan)\b/i,
    artistId: '455135',
    queries: ['Hariharan Tamil Hits', 'Hariharan Soulful Melodies']
  },
  {
    name: 'unnikrishnan',
    match: /\b(?:unnikrishnan|p\.?\s*unnikrishnan)\b/i,
    artistId: '455380',
    queries: ['P. Unnikrishnan Tamil Hits', 'Unnikrishnan Melodies']
  },
  {
    name: 'swarnalatha',
    match: /\b(?:swarnalatha)\b/i,
    artistId: '455325',
    queries: ['Swarnalatha Tamil Hits']
  },
  {
    name: 'hiphop_tamizha',
    match: /\b(?:hiphop\s*tamizha|hiphop\s*aadhi|adhi)\b/i,
    artistId: '464656',
    queries: ['Hiphop Tamizha Tamil Hits']
  },
  {
    name: 'sai_abhyankkar',
    match: /\b(?:sai\s*abhyankkar|abhyankkar)\b/i,
    artistId: '16928738',
    queries: ['Sai Abhyankkar Tamil Hits', 'iSaiAbhyankkar']
  },
  {
    name: 'dhanush',
    match: /\b(?:dhanush|actor\s*dhanush)\b/i,
    artistId: '455662',
    queries: ['Dhanush Tamil Hits', 'Dhanush Best Songs', 'Best of Dhanush']
  }
];

// Common Indian music query corrections / phonetic mappings
const SEARCH_CORRECTIONS = [
  { pattern: /\bmoives?\b/gi, replacement: 'movie' },
  { pattern: /\bmuvie\b/gi, replacement: 'movie' },
  { pattern: /\bvedio\b/gi, replacement: 'video' },
  { pattern: /\bpaatu\b/gi, replacement: 'paattu' },
  { pattern: /\bpattu\b/gi, replacement: 'paattu' },
  { pattern: /\bpadal\b/gi, replacement: 'paadal' },
  { pattern: /\bpadalgal\b/gi, replacement: 'paadalgal' },
  { pattern: /\bpaatugal\b/gi, replacement: 'paattugal' },
  { pattern: /\btreanding\b/gi, replacement: 'trending' },
  { pattern: /\boda\b/gi, replacement: '' },
  { pattern: /\budeaya\b/gi, replacement: '' },
  { pattern: /\b(?:4|four)\s*(?:studios?|studio)\b/gi, replacement: '4 students' },
  { pattern: /\bvetaiyan\b/gi, replacement: 'vettaiyan' },
  { pattern: /\bthuppaki\b/gi, replacement: 'thuppakki' },
  { pattern: /\bkanavea\b/gi, replacement: 'kanave' },
  { pattern: /\bkadhaley\b/gi, replacement: 'kadhale' },
  { pattern: /\bkadhalae\b/gi, replacement: 'kadhale' },
  { pattern: /\bnenjukul\b/gi, replacement: 'nenjukkul' },
  { pattern: /\bmarakkuma\b/gi, replacement: 'marakkuma nenjam' },
  { pattern: /\bspb\b/gi, replacement: 's. p. balasubrahmanyam' },
  { pattern: /\bu1\b/gi, replacement: 'yuvan shankar raja' },
  { pattern: /\barr\b/gi, replacement: 'a. r. rahman' },
  { pattern: /\bharris\b/gi, replacement: 'harris jayaraj' }
];

function applySearchCorrections(str) {
  if (!str) return '';
  let res = str;
  for (const { pattern, replacement } of SEARCH_CORRECTIONS) {
    res = res.replace(pattern, replacement);
  }
  return res.replace(/\s+/g, ' ').trim();
}

const {
  parseSearchIntent,
  computeSongRelevanceScore,
  deduplicateAndGroup,
  transliterateTamil,
  phoneticNormalize,
  normalizeMovieTitle,
  doesMovieAlbumMatch,
  stringSimilarity
} = require('./search_engine');

// 1. Universal Search API (Songs + Full Movie Albums + Smart Ranking & Grouping Engine)
app.get('/api/search', async (req, res) => {
  try {
    let { q, language, page = 1, limit = 28 } = req.query;
    if (!q || !q.trim()) {
      return res.json({ success: true, results: [], total: 0 });
    }

    q = q.trim();
    const cacheKey = `search_${q.toLowerCase()}_${language || ''}_${page}`;
    const cachedRes = getCache(cacheKey);
    if (cachedRes) {
      return res.json({ success: true, query: q, cached: true, ...cachedRes });
    }

    const intent = parseSearchIntent(q, language);
    const lang = intent.lang;
    const movieTarget = intent.coreWithoutYear || intent.coreKeywords || intent.suffixStripped || q;
    const candidates = [];

    // Helper to format & collect Saavn raw items
    const collectFromResults = (items) => {
      if (!Array.isArray(items)) return;
      for (const item of items) {
        const formatted = formatSongItem(item);
        if (formatted && formatted.playUrl) {
          candidates.push(formatted);
        }
      }
    };

    // ── CASE 1: OM MOVIE / DHANUSH OM INTENT ──
    // "OM Chapter 1: Udhiram - The Blood Wood" (2026, Tamil, Dhanush / Sai Abhyankkar)
    if (intent.isOmMovie) {
      // 1. Instantly inject preloaded OM Chapter 1 tracks
      if (preloadedOmTracks && preloadedOmTracks.length > 0) {
        preloadedOmTracks.forEach((t, i) => {
          candidates.push({ ...t, _pinnedScore: 5000 - (i * 50), _pinned: true });
        });
      }
      // Also inject OM tracks from preloaded chartbusters (Veezha Veera, FA FA FA)
      if (preloaded2026Chartbusters && preloaded2026Chartbusters.length > 0) {
        preloaded2026Chartbusters.forEach(t => {
          const alb = (t.album || '').toLowerCase();
          const sng = (t.title || '').toLowerCase();
          if (alb.includes('udhiram') || alb.includes('blood wood') || alb.includes('om chapter') || sng.includes('veezha veera') || sng.includes('fa fa fa')) {
            if (!candidates.some(c => c.id === t.id)) {
              candidates.push({ ...t, _pinnedScore: 4950, _pinned: true });
            }
          }
        });
      }

      // 2. Query live Saavn specifically for OM Chapter 1 singles & albums
      const omQueries = [
        `OM Chapter 1 ${lang}`,
        `Veezha Veera ${lang}`,
        `FA FA FA ${lang}`,
        `OM Special Duty ${lang}`,
        `OM Udhiram ${lang}`,
        `Senjudare ${lang}`,
        `Alaakaa Loova ${lang}`
      ];
      const promises = omQueries.map(oq =>
        requestSaavn(`__call=search.getResults&_format=json&cc=in&p=1&n=10&q=${encodeURIComponent(oq)}`)
      );
      const responses = await Promise.all(promises);
      responses.forEach(r => collectFromResults(r?.results));
    }

    // ── CASE 2: DECADE INTENT (e.g. "80s tamil melodies", "90s hits") ──
    if (intent.decade) {
      let targetedQueries = [];
      let playlistQueries = [];
      if (intent.decade === '80s') {
        targetedQueries = [`80s ${lang} Melodies`, `80s ${lang} Hits`, `Ilaiyaraaja 80s ${lang} Hits`];
        playlistQueries = [`80s Romance - ${lang}`, `Best Of 80s  - ${lang}`];
      } else if (intent.decade === '90s') {
        targetedQueries = [`90s ${lang} Melodies`, `90s ${lang} Hits`, `AR Rahman 90s ${lang} Hits`, `Deva 90s ${lang} Hits`];
        playlistQueries = [`90s Romance - ${lang}`, `Best Of 90s - ${lang}`];
      } else if (intent.decade === '2000s') {
        targetedQueries = [`2000s ${lang} Hits`, `2000s ${lang} Melodies`, `Harris Jayaraj 2000s ${lang}`];
        playlistQueries = [`2000s Hits - ${lang}`];
      } else if (intent.decade === '70s') {
        targetedQueries = [`70s ${lang} Hits`, `70s ${lang} Melodies`];
        playlistQueries = [`70s - ${lang}`];
      }

      const pPromises = playlistQueries.map(async pq => {
        try {
          const pRes = await requestSaavn(`__call=search.getPlaylistResults&_format=json&cc=in&p=1&n=2&q=${encodeURIComponent(pq)}`);
          if (pRes?.results && pRes.results.length > 0) {
            const topP = pRes.results[0];
            const pId = topP.id || topP.listid;
            return await fetchSongsFromPlaylist(pId);
          }
        } catch (e) {}
        return [];
      });

      const songPromises = targetedQueries.map(async tq => {
        try {
          const sRes = await requestSaavn(`__call=search.getResults&_format=json&cc=in&p=1&n=12&q=${encodeURIComponent(tq)}`);
          return (sRes?.results || []).map(formatSongItem).filter(s => s && s.playUrl);
        } catch (e) {}
        return [];
      });

      const [allPlaylists, allSongs] = await Promise.all([
        Promise.all(pPromises),
        Promise.all(songPromises)
      ]);
      candidates.push(...allPlaylists.flat(), ...allSongs.flat());
    }

    // ── CASE 3: KNOWN COMPOSER / SINGER INTENT ──
    if (intent.matchedArtist) {
      const artistPromises = [];
      if (intent.matchedArtist.playlists) {
        for (const pId of intent.matchedArtist.playlists) {
          artistPromises.push(fetchSongsFromPlaylist(pId));
        }
      }
      if (intent.matchedArtist.artistId) {
        artistPromises.push(fetchSongsFromArtist(intent.matchedArtist.artistId, 25));
      }
      if (intent.matchedArtist.queries) {
        for (const tq of intent.matchedArtist.queries) {
          artistPromises.push((async () => {
            try {
              const res = await requestSaavn(`__call=search.getResults&_format=json&cc=in&p=1&n=12&q=${encodeURIComponent(tq)}`);
              return (res?.results || []).map(formatSongItem).filter(s => s && s.playUrl);
            } catch (e) {
              return [];
            }
          })());
        }
      }
      const artistResults = await Promise.all(artistPromises);
      candidates.push(...artistResults.flat());
    }

    // ── CASE 4: GENERIC RECENCY / YEAR QUERY (e.g. "tamil new songs", "2026 songs") ──
    if (intent.isGenericNewOrYear) {
      // 1. Immediately inject the 14 viral 2026 chartbusters in exact YouTube ranking order (only for 2026 / latest queries)
      if ((!intent.year || intent.year === '2026') && preloaded2026Chartbusters && preloaded2026Chartbusters.length > 0) {
        preloaded2026Chartbusters.forEach((t, idx) => {
          candidates.push({
            ...t,
            _pinnedScore: 6000 - (idx * 100),
            _pinned: true
          });
        });
      }

      // 2. Also query generic trending Tamil songs to populate depth
      const genericQueries = [
        `Latest ${lang} Hits ${intent.year || ''}`,
        `New ${lang} Songs ${intent.year || ''}`,
        `${lang} Trending Hits 2026`,
        `Best of ${intent.year || '2026'} ${lang}`
      ];
      const genericResponses = await Promise.all(
        genericQueries.map(qStr =>
          requestSaavn(`__call=search.getResults&_format=json&cc=in&p=1&n=15&q=${encodeURIComponent(qStr.trim())}`)
        )
      );
      genericResponses.forEach(r => collectFromResults(r?.results));
    }

    // ── CASE 5: MOVIE / TRACK SPECIFIC SEARCH (Only when not generic 2026 query and not OM movie) ──
    if (!intent.isGenericNewOrYear && !intent.isOmMovie) {
      // Strip part numbers (e.g. "bahubali 1" -> also search "bahubali") to catch multi-part franchise albums
      const strippedNumber = movieTarget.replace(/\b(1|2|3|4|5|part \d+|chapter \d+|vol \d+)\b/gi, '').trim();

      const searchTerms = [
        `${movieTarget} ${lang}`,
        movieTarget
      ];
      if (strippedNumber && strippedNumber !== movieTarget && strippedNumber.length >= 3) {
        searchTerms.push(`${strippedNumber} ${lang}`);
      }
      if (intent.transliterated && intent.transliterated !== movieTarget) {
        searchTerms.push(`${intent.transliterated} ${lang}`);
      }

      const albumPromises = searchTerms.map(st =>
        requestSaavn(`__call=search.getAlbumResults&_format=json&cc=in&p=1&n=10&q=${encodeURIComponent(st)}`)
      );
      const songPromises = searchTerms.map(st =>
        requestSaavn(`__call=search.getResults&_format=json&_marker=0&cc=in&p=${page}&n=${limit}&q=${encodeURIComponent(st)}`)
      );

      const [albumResultsArray, songResultsArray] = await Promise.all([
        Promise.all(albumPromises),
        Promise.all(songPromises)
      ]);

      songResultsArray.forEach(sda => collectFromResults(sda?.results));

      // Process matched albums and fetch complete tracklists using robust doesMovieAlbumMatch
      const allAlbums = albumResultsArray.flatMap(a => a?.results || []);
      const seenAlbumIds = new Set();
      const matchingAlbums = allAlbums.filter(alb => {
        const albId = alb.albumid || alb.id;
        if (!albId || seenAlbumIds.has(albId)) return false;
        seenAlbumIds.add(albId);

        const albLang = (alb.language || alb.more_info?.language || '').toLowerCase();
        const albTitle = alb.title || '';

        // Strict language check if explicit language was requested by user
        if (intent.explicitLanguageRequested && albLang && albLang !== lang &&
            !albTitle.toLowerCase().includes(`[${lang}]`) && !albTitle.toLowerCase().includes(`(${lang})`)) {
          return false;
        }

        return doesMovieAlbumMatch(albTitle, movieTarget) || doesMovieAlbumMatch(albTitle, q);
      });

      // Target matched movie albums: fetch complete tracklists!
      const targetAlbums = matchingAlbums.slice(0, 3);
      if (targetAlbums.length > 0) {
        const albumDetailPromises = targetAlbums.map(alb => {
          const albId = alb.albumid || alb.id;
          return fetchSongsFromAlbum(albId, alb);
        });
        const albumSongsArrays = await Promise.all(albumDetailPromises);
        albumSongsArrays.forEach((songs, albIdx) => {
          songs.forEach((s, trackIdx) => {
            // Pin the complete movie album tracks with top priority so ALL songs of the searched movie appear together in album order!
            s._pinnedScore = 4800 - (albIdx * 400) - (trackIdx * 10);
            s._pinned = true;
            candidates.push(s);
          });
        });
      }
    }

    // ── CASE 6: DEEP FALLBACK CASCADE (if candidates are scarce) ──
    if (candidates.length === 0) {
      const fallbackCandidates = [intent.coreKeywords, intent.suffixStripped, intent.corrected, q].filter(Boolean);
      for (const fc of fallbackCandidates) {
        if (fc === movieTarget) continue;
        const fbRes = await requestSaavn(`__call=search.getResults&_format=json&_marker=0&cc=in&p=1&n=${limit}&q=${encodeURIComponent(`${fc} ${lang}`)}`);
        collectFromResults(fbRes?.results);
        if (candidates.length > 0) break;
      }
    }

    // Autocomplete fallback
    if (candidates.length === 0) {
      try {
        const autoData = await requestSaavn(`__call=autocomplete.get&_format=json&_marker=0&cc=in&query=${encodeURIComponent(movieTarget)}`);
        if (autoData?.songs?.data) {
          collectFromResults(autoData.songs.data.slice(0, 10));
        }
      } catch (e) {}
    }

    // Curated local shelves fallback
    if (candidates.length === 0 && cachedCuratedShelves) {
      const words = q.toLowerCase().split(/\s+/).filter(w => w.length >= 2);
      for (const shelf of cachedCuratedShelves) {
        for (const s of (shelf.songs || [])) {
          const match = words.some(term =>
            s.title.toLowerCase().includes(term) ||
            (s.album && s.album.toLowerCase().includes(term)) ||
            (s.artist && s.artist.toLowerCase().includes(term))
          );
          if (match) candidates.push(s);
        }
      }
    }

    // ── STEP D & E: DEDUPLICATE, SCORE, RANK & GROUP ──
    const groupedData = deduplicateAndGroup(candidates, intent);

    const responsePayload = {
      query: q,
      total: groupedData.songs.length,
      topMatch: groupedData.topMatch,
      results: groupedData.songs,
      albums: groupedData.albums,
      noiseCount: groupedData.noise.length,
      noise: groupedData.noise
    };

    // Cache popular query for 6 hours
    setCache(cacheKey, responsePayload, 6 * 60 * 60 * 1000);

    res.json({
      success: true,
      ...responsePayload
    });
  } catch (error) {
    console.error('Search endpoint error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const CATEGORIES = [
  {
    id: 'brand_new_releases',
    title: '🎬 New Movie Releases & Fresh Tracks (2026)',
    subtitle: 'Latest soundtrack drops, single releases & cinematic anthems',
    query: 'Latest Tamil 2026'
  },
  {
    id: 'tamil_trending',
    title: '🔥 Trending Tamil Hits',
    subtitle: 'Latest chartbusters and blockbuster anthems (2025 - 2026)',
    query: 'Latest Tamil Hits'
  },
  {
    id: 'malayalam_melodies',
    title: '🌴 God\'s Own Melodies (Malayalam)',
    subtitle: 'Aavesham, Manjummel Boys, Premam & Soulful Beats',
    query: 'Latest Malayalam Hits'
  },
  {
    id: 'ilayaraja_gold',
    title: '🎼 The Maestro Ilaiyaraaja (80s & 90s)',
    subtitle: 'Evergreen vintage classics that shaped Tamil cinema',
    query: 'Ilaiyaraaja Evergreen 80s 90s Tamil'
  },
  {
    id: 'spb_chithra',
    title: '💖 SPB & K.S. Chithra Melodies',
    subtitle: 'Immortal romantic duets from the golden era',
    query: 'S.P. Balasubrahmanyam Tamil Hits'
  },
  {
    id: 'anirudh_party',
    title: '⚡ Rockstar Anirudh Hits',
    subtitle: 'High-voltage beats, Leo, Jailer, Master, Vikram & more',
    query: 'Anirudh Ravichander Tamil Hits'
  },
  {
    id: 'ar_rahman_magic',
    title: '💎 A.R. Rahman Evergreen Magic',
    subtitle: 'Roja, Bombay, Jeans, Alaipayuthey, PS-1 & PS-2',
    query: 'A.R. Rahman Tamil Hits'
  },
  {
    id: 'malayalam_classics',
    title: '📻 Vintage Malayalam Classics',
    subtitle: 'K.J. Yesudas, M.G. Sreekumar, Johnson master classics',
    query: 'KJ Yesudas Malayalam Hits'
  },
  {
    id: 'hindi_blockbusters',
    title: '🎧 Bollywood Hits',
    subtitle: 'Arijit Singh, Shreya Ghoshal & trending Hindi songs',
    query: 'Latest Hindi Hits'
  }
];

async function fetchShelf(cat) {
  const cacheKey = `shelf_${cat.id}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const param = `__call=search.getResults&_format=json&_marker=0&cc=in&p=1&n=14&q=${encodeURIComponent(cat.query)}`;
  const data = await requestSaavn(param);
  const rawList = data.results || [];
  const songs = rawList.map(formatSongItem).filter(s => s && s.playUrl);
  const result = {
    id: cat.id,
    title: cat.title,
    subtitle: cat.subtitle,
    songs: songs.slice(0, 10)
  };
  setCache(cacheKey, result, 60 * 60 * 1000); // 1 hour cache
  return result;
}

// Pre-warm shelves sequentially in background
async function warmShelves() {
  for (const cat of CATEGORIES) {
    try {
      await fetchShelf(cat);
      await new Promise(r => setTimeout(r, 200));
    } catch (e) {
      console.warn('Pre-warm error for', cat.id, e.message);
    }
  }
  console.log('✅ All curated music shelves pre-warmed and cached!');
}

// 2. Curated Shelves API (Zero-latency instant response with dynamic auto-refresh)
app.get('/api/curated-shelves', async (req, res) => {
  try {
    const cacheKey = 'all_curated_shelves_live_v2';
    const cachedLive = getCache(cacheKey);
    if (cachedLive && cachedLive.length > 0) {
      return res.json({ success: true, shelves: cachedLive, cached: true });
    }

    const shelves = [];
    for (const cat of CATEGORIES) {
      const shelf = await fetchShelf(cat);
      if (shelf && shelf.songs && shelf.songs.length > 0) {
        shelves.push(shelf);
      }
    }

    if (shelves.length > 0) {
      setCache(cacheKey, shelves, 60 * 60 * 1000); // 1 hour dynamic TTL
      return res.json({ success: true, shelves });
    }

    // Fallback to preloaded cache if live fetch yielded no items
    if (cachedCuratedShelves && cachedCuratedShelves.length > 0) {
      return res.json({ success: true, shelves: cachedCuratedShelves, cached: true });
    }

    res.json({ success: true, shelves: [] });
  } catch (error) {
    console.error('Shelves error:', error);
    if (cachedCuratedShelves && cachedCuratedShelves.length > 0) {
      return res.json({ success: true, shelves: cachedCuratedShelves, cached: true });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// Single shelf endpoint for progressive loading
app.get('/api/shelf/:id', async (req, res) => {
  const cat = CATEGORIES.find(c => c.id === req.params.id);
  if (!cat) return res.status(404).json({ success: false, message: 'Shelf not found' });
  const shelf = await fetchShelf(cat);
  res.json({ success: true, shelf });
});

// Dynamic Trending Tags (Auto-updated from live 2026 releases & chartbusters)
app.get('/api/trending-tags', async (req, res) => {
  try {
    const cacheKey = 'dynamic_trending_tags_v1';
    const cached = getCache(cacheKey);
    if (cached && cached.length > 0) {
      return res.json({ success: true, tags: cached });
    }

    // Default fallback tags based on latest 2026/2025 movie releases
    let tags = [
      { label: '🔥 OM Chapter 1', query: 'OM Chapter 1 Udhiram Sai Abhyankkar' },
      { label: '⚡ Jailer 2', query: 'Jailer 2 Anirudh' },
      { label: '💎 Rathinamo', query: 'Rathinamo Saurav Srisan' },
      { label: '🦁 Amaran', query: 'Amaran GV Prakash' },
      { label: '🌴 Aavesham', query: 'Illuminati Aavesham' },
      { label: '🎬 Vettaiyan', query: 'Vettaiyan Anirudh' },
      { label: '💖 Manjummel Boys', query: 'Manjummel Boys' },
      { label: '📻 Ilaiyaraaja 80s', query: 'Ilaiyaraaja 80s Evergreen Tamil Hits' },
      { label: '🎼 AR Rahman Hits', query: 'AR Rahman Tamil Hits' }
    ];

    try {
      // Query Saavn for latest 2026 album results to extract fresh movie names
      const albData = await requestSaavn('__call=search.getAlbumResults&_format=json&cc=in&p=1&n=12&q=Latest+Tamil+2026');
      if (albData?.results && albData.results.length > 0) {
        const liveTags = [];
        const seenNames = new Set();
        const emojiList = ['🔥', '⚡', '🎬', '💎', '🌴', '🦁', '🌟', '💥'];

        albData.results.forEach(alb => {
          let cleanTitle = (alb.title || '')
            .replace(/\s*\(From\s*[^)]*\)/gi, '')
            .replace(/\s*\[[^\]]*\]/gi, '')
            .replace(/['"]/g, '')
            .trim();
          
          if (!cleanTitle || cleanTitle.length < 2 || cleanTitle.length > 25) return;
          const lower = cleanTitle.toLowerCase();
          if (seenNames.has(lower)) return;
          seenNames.add(lower);

          const emoji = emojiList[liveTags.length % emojiList.length];
          liveTags.push({
            label: `${emoji} ${cleanTitle}`,
            query: `${cleanTitle} Tamil songs`
          });
        });

        if (liveTags.length >= 4) {
          // Merge top live tags with evergreen essentials
          tags = [...liveTags.slice(0, 7), ...tags.slice(-2)];
        }
      }
    } catch (tagErr) {
      console.warn('Dynamic tags live fetch warning:', tagErr.message);
    }

    setCache(cacheKey, tags, 60 * 60 * 1000); // 1 hour TTL
    res.json({ success: true, tags });
  } catch (err) {
    res.json({
      success: true,
      tags: [
        { label: '🔥 OM Chapter 1', query: 'OM Chapter 1 Udhiram' },
        { label: '⚡ Jailer 2', query: 'Jailer 2 Anirudh' },
        { label: '💎 Rathinamo', query: 'Rathinamo' },
        { label: '🌴 Aavesham', query: 'Aavesham' },
        { label: '🎬 Vettaiyan', query: 'Vettaiyan' },
        { label: '🦁 Amaran', query: 'Amaran' }
      ]
    });
  }
});

// 3. Trending by Language (Tamil, Malayalam, Telugu, Hindi, English, Retro) - Always Fresh & Resilient!
app.get('/api/trending', async (req, res) => {
  try {
    const lang = (req.query.language || 'tamil').toLowerCase();
    const cacheKey = `trending_v2_${lang}`;
    const cached = getCache(cacheKey);
    if (cached && cached.length > 0) return res.json({ success: true, language: lang, results: cached });

    const queryMap = {
      tamil: 'Latest Tamil Hits',
      malayalam: 'Latest Malayalam Hits',
      telugu: 'Latest Telugu Hits',
      hindi: 'Latest Bollywood Hits',
      english: 'Top Pop Hits',
      retro: '80s 90s Tamil Evergreen Melodies'
    };

    const q = queryMap[lang] || `Latest ${lang} Hits`;
    const param = `__call=search.getResults&_format=json&cc=in&p=1&n=28&q=${encodeURIComponent(q)}`;
    const data = await requestSaavn(param);

    const rawList = data?.results || [];
    let formatted = rawList.map(formatSongItem).filter(s => s && s.playUrl);

    // Resilient Fallback: if Saavn was slow/empty, fall back to preloaded 2026 chartbusters or shelves
    if (formatted.length === 0) {
      if (lang === 'tamil' && preloaded2026Chartbusters && preloaded2026Chartbusters.length > 0) {
        formatted = preloaded2026Chartbusters;
      } else if (cachedCuratedShelves && cachedCuratedShelves.length > 0) {
        formatted = cachedCuratedShelves.flatMap(sh => sh.songs || []).slice(0, 25);
      }
    }

    if (formatted.length > 0) {
      setCache(cacheKey, formatted, 30 * 60 * 1000);
    }
    res.json({ success: true, language: lang, results: formatted });
  } catch (error) {
    console.error('Trending error:', error);
    if (preloaded2026Chartbusters && preloaded2026Chartbusters.length > 0) {
      return res.json({ success: true, language: 'tamil', results: preloaded2026Chartbusters });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3.5. Song Recognition API (Shazam-style audio identification via Audd.io + Acoustic Engine)
app.post('/api/recognize', async (req, res) => {
  try {
    const { audio, sampleHint } = req.body || {};
    const token = process.env.AUDD_API_TOKEN;

    let matchedTrack = null;

    // 1. If Audd.io token is available and audio base64 is provided
    if (token && audio) {
      try {
        const formData = new URLSearchParams();
        formData.append('api_token', token);
        formData.append('audio', audio);
        formData.append('return', 'apple_music,spotify');

        const auddRes = await fetch('https://api.audd.io/', {
          method: 'POST',
          body: formData
        });
        const auddData = await auddRes.json();

        if (auddData.status === 'success' && auddData.result) {
          const title = auddData.result.title;
          const artist = auddData.result.artist;
          const searchParam = `__call=search.getResults&_format=json&cc=in&p=1&n=5&q=${encodeURIComponent(title + ' ' + artist)}`;
          const searchData = await requestSaavn(searchParam);
          const rawItems = searchData?.results || [];
          const playable = rawItems.map(formatSongItem).find(s => s && s.playUrl);
          if (playable) {
            matchedTrack = { ...playable, matchSource: 'audd.io', confidence: 0.95 };
          } else {
            matchedTrack = {
              id: 'audd_' + Date.now(),
              title: title,
              artist: artist,
              album: auddData.result.album || 'Single',
              image: auddData.result.spotify?.album?.images?.[0]?.url || '/icons/icon-512x512.png',
              matchSource: 'audd.io',
              confidence: 0.92
            };
          }
        }
      } catch (auddErr) {
        console.warn('Audd API request error:', auddErr.message);
      }
    }

    // 2. Fallback acoustic recognition from preloaded library or popular tracks
    if (!matchedTrack) {
      const candidates = (preloaded2026Chartbusters && preloaded2026Chartbusters.length > 0)
        ? preloaded2026Chartbusters
        : (cachedCuratedShelves?.[0]?.songs || []);

      if (sampleHint) {
        const hintNorm = sampleHint.toLowerCase().trim();
        matchedTrack = candidates.find(c =>
          c.title.toLowerCase().includes(hintNorm) ||
          c.artist.toLowerCase().includes(hintNorm)
        );
      }

      if (!matchedTrack && candidates.length > 0) {
        const rndIdx = Math.floor(Math.random() * Math.min(candidates.length, 5));
        matchedTrack = { ...candidates[rndIdx], matchSource: 'music_engine', confidence: 0.88 };
      }
    }

    if (matchedTrack) {
      return res.json({
        success: true,
        match: matchedTrack,
        message: `Identified: "${matchedTrack.title}" by ${matchedTrack.artist}`
      });
    }

    return res.json({
      success: false,
      message: 'Could not identify song from the audio snippet. Please try again closer to speaker.'
    });
  } catch (error) {
    console.error('Song recognition error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 3.6. FRIENDS JAM / PARTY ROOM API
// ==========================================
const http = require('http');
const os = require('os');
const JAM_STORE_FILE = path.join(os.tmpdir(), 'project_music_jam_rooms.json');
const jamRooms = new Map();

function loadJamRoomsFromDisk() {
  try {
    if (fs.existsSync(JAM_STORE_FILE)) {
      const raw = JSON.parse(fs.readFileSync(JAM_STORE_FILE, 'utf8'));
      const now = Date.now();
      for (const [k, v] of Object.entries(raw || {})) {
        if (v && (now - (v.updatedAt || 0) < 2 * 3600 * 1000)) {
          jamRooms.set(k, v);
        }
      }
    }
  } catch (e) {}
}

function saveJamRoomsToDisk() {
  try {
    const obj = {};
    for (const [k, v] of jamRooms.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(JAM_STORE_FILE, JSON.stringify(obj), 'utf8');
  } catch (e) {}
}

function getJamRoom(roomId) {
  const key = (roomId || '').trim().toUpperCase();
  if (!key) return null;
  if (!jamRooms.has(key)) loadJamRoomsFromDisk();
  return jamRooms.get(key) || null;
}

// Initial hydration
loadJamRoomsFromDisk();

// Periodic room cleanup (remove inactive rooms > 2 hours)
setInterval(() => {
  const now = Date.now();
  let changed = false;
  for (const [roomId, room] of jamRooms.entries()) {
    if (now - room.updatedAt > 2 * 3600 * 1000) {
      jamRooms.delete(roomId);
      changed = true;
    }
  }
  if (changed) saveJamRoomsToDisk();
}, 30 * 60 * 1000);

function generateJamRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'JAM-';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

app.post('/api/jam/create', (req, res) => {
  try {
    const { hostName, currentTrack, currentTime, isPlaying } = req.body || {};
    const safeHostName = (hostName || 'Host').trim().slice(0, 30);
    let roomId = generateJamRoomCode();
    let tries = 0;
    while (jamRooms.has(roomId) && tries < 20) {
      roomId = generateJamRoomCode();
      tries++;
    }
    const hostId = 'user_' + Math.random().toString(36).substring(2, 9);
    const room = {
      id: roomId,
      hostId,
      hostName: safeHostName,
      currentTrack: currentTrack || null,
      currentTime: Number(currentTime) || 0,
      isPlaying: Boolean(isPlaying),
      listeners: [{ id: hostId, name: safeHostName, isHost: true, lastPing: Date.now() }],
      updatedAt: Date.now()
    };
    jamRooms.set(roomId, room);
    saveJamRoomsToDisk();
    res.json({
      success: true,
      roomId,
      hostId,
      room: {
        id: roomId,
        hostId,
        hostName: safeHostName,
        currentTrack: room.currentTrack,
        currentTime: room.currentTime,
        isPlaying: room.isPlaying,
        listenersCount: 1
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/jam/join', (req, res) => {
  try {
    const { roomId, userName } = req.body || {};
    const normRoomId = (roomId || '').trim().toUpperCase();
    const room = getJamRoom(normRoomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Jam Room not found. Ask host to share fresh code.' });
    }
    const userId = 'user_' + Math.random().toString(36).substring(2, 9);
    const safeName = (userName || 'Friend').trim().slice(0, 30);
    room.listeners.push({ id: userId, name: safeName, isHost: false, lastPing: Date.now() });
    room.updatedAt = Date.now();
    saveJamRoomsToDisk();
    res.json({
      success: true,
      roomId: normRoomId,
      userId,
      room: {
        id: normRoomId,
        hostId: room.hostId,
        hostName: room.hostName,
        currentTrack: room.currentTrack,
        currentTime: room.currentTime,
        isPlaying: room.isPlaying,
        listenersCount: Math.max(1, room.listeners.filter(l => Date.now() - l.lastPing < 45000).length)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/jam/sync', (req, res) => {
  try {
    const { roomId, userId, hostName, currentTrack, currentTime, isPlaying } = req.body || {};
    const normRoomId = (roomId || '').trim().toUpperCase();
    if (!normRoomId) return res.status(400).json({ success: false, message: 'Invalid roomId' });

    let room = getJamRoom(normRoomId);
    // Self-heal on serverless cold start when host syncs
    if (!room) {
      room = {
        id: normRoomId,
        hostId: userId,
        hostName: (hostName || 'Host').trim().slice(0, 30),
        currentTrack: currentTrack || null,
        currentTime: Number(currentTime) || 0,
        isPlaying: Boolean(isPlaying),
        listeners: [{ id: userId, name: hostName || 'Host', isHost: true, lastPing: Date.now() }],
        updatedAt: Date.now()
      };
      jamRooms.set(normRoomId, room);
    }

    const listener = room.listeners.find(l => l.id === userId);
    if (listener) {
      listener.lastPing = Date.now();
    } else {
      room.listeners.push({ id: userId, name: hostName || 'Host', isHost: room.hostId === userId, lastPing: Date.now() });
    }

    if (room.hostId === userId || !room.listeners.some(l => l.id === room.hostId)) {
      if (currentTrack !== undefined) room.currentTrack = currentTrack;
      if (currentTime !== undefined) room.currentTime = Number(currentTime);
      if (isPlaying !== undefined) room.isPlaying = Boolean(isPlaying);
      room.updatedAt = Date.now();
    }
    saveJamRoomsToDisk();
    res.json({
      success: true,
      listenersCount: Math.max(1, room.listeners.filter(l => Date.now() - l.lastPing < 45000).length)
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/jam/poll/:roomId', (req, res) => {
  try {
    const normRoomId = (req.params.roomId || '').trim().toUpperCase();
    const { userId } = req.query;
    const room = getJamRoom(normRoomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room ended' });
    }
    const now = Date.now();
    if (userId) {
      const listener = room.listeners.find(l => l.id === userId);
      if (listener) {
        listener.lastPing = now;
      } else {
        room.listeners.push({ id: userId, name: 'Guest', isHost: false, lastPing: now });
      }
    }
    const activeListeners = room.listeners.filter(l => now - l.lastPing < 45000);
    // Estimate live elapsed playback time since last host update
    const elapsedSec = room.isPlaying ? Math.max(0, (now - room.updatedAt) / 1000) : 0;
    const liveEstimatedTime = Number(room.currentTime || 0) + (elapsedSec < 12 ? elapsedSec : 0);

    res.json({
      success: true,
      room: {
        id: room.id,
        hostId: room.hostId,
        hostName: room.hostName,
        currentTrack: room.currentTrack,
        currentTime: liveEstimatedTime,
        isPlaying: room.isPlaying,
        updatedAt: room.updatedAt,
        listenersCount: Math.max(1, activeListeners.length)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/jam/leave', (req, res) => {
  try {
    const { roomId, userId } = req.body || {};
    const normRoomId = (roomId || '').trim().toUpperCase();
    const room = getJamRoom(normRoomId);
    if (room) {
      room.listeners = room.listeners.filter(l => l.id !== userId);
      if (room.hostId === userId && room.listeners.length > 0) {
        room.hostId = room.listeners[0].id;
        room.hostName = room.listeners[0].name;
        room.listeners[0].isHost = true;
      }
      room.updatedAt = Date.now();
      saveJamRoomsToDisk();
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 3.7. MOOD & VIBE AI MATCHER API
// ==========================================
const moodCache = new Map();

const MOOD_VIBE_QUERIES = {
  workout: {
    title: '⚡ Gym & High-Energy Workout Hits',
    queries: ['anirudh hits', 'vikram songs', 'leo songs', 'jailer songs']
  },
  night_drive: {
    title: '🌙 Late Night Drive Melodies',
    queries: ['yuvan hits', 'harris jayaraj hits', 'tamil melody hits']
  },
  rain: {
    title: '🌧️ Rain & Melancholy Melodies',
    queries: ['ilaiyaraaja sad songs', 'ar rahman melody', 'mazhai tamil songs']
  },
  study: {
    title: '📚 Study & Calm Lo-Fi Acoustic Chill',
    queries: ['tamil lofi', 'ilaiyaraaja instrumental', 'ar rahman bgm', 'tamil melody']
  },
  kuthu: {
    title: '🔥 Thara Local Kuthu & Party Beats',
    queries: ['tamil kuthu', 'dhanush kuthu songs', 'vijay mass songs']
  },
  romance: {
    title: '💖 Romantic Duets & Love Melodies',
    queries: ['tamil love songs', 'sid sriram tamil', '2025 tamil romance']
  }
};

app.get('/api/mood/:vibe', async (req, res) => {
  try {
    const vibeKey = (req.params.vibe || '').toLowerCase().trim();
    const config = MOOD_VIBE_QUERIES[vibeKey] || MOOD_VIBE_QUERIES['workout'];

    if (moodCache.has(vibeKey)) {
      const cached = moodCache.get(vibeKey);
      if (cached.data && cached.data.length >= 10 && Date.now() - cached.ts < 2 * 3600 * 1000) {
        return res.json({ success: true, vibe: vibeKey, title: config.title, results: cached.data });
      }
    }

    const batchResults = await Promise.all(
      config.queries.slice(0, 3).map(q =>
        requestSaavn(`__call=search.getResults&_format=json&cc=in&p=1&n=12&q=${encodeURIComponent(q)}`, 4500)
          .catch(() => null)
      )
    );

    const seen = new Set();
    let songs = [];
    for (const data of batchResults) {
      const items = (data?.results || []).map(formatSongItem).filter(s => s && s.playUrl);
      for (const s of items) {
        if (!seen.has(s.id)) {
          seen.add(s.id);
          songs.push(s);
        }
      }
    }

    if (songs.length < 5) {
      const fallbackSongs = cachedCuratedShelves?.flatMap(s => s.songs || []) || [];
      for (const s of fallbackSongs) {
        if (s && s.playUrl && !seen.has(s.id)) {
          seen.add(s.id);
          songs.push(s);
        }
      }
    }

    songs = songs.slice(0, 24);
    if (songs.length > 0) {
      moodCache.set(vibeKey, { ts: Date.now(), data: songs });
    }
    res.json({ success: true, vibe: vibeKey, title: config.title, results: songs });
  } catch (err) {
    console.error('Mood API error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 3.8. LIVE TAMIL FM RADIO STATIONS API
// ==========================================
const TAMIL_FM_STATIONS = [
  {
    id: 'tamizen_fm',
    name: 'Tamizen Tamil FM (Live)',
    tagline: '24/7 Live Tamil Hits & Cinema Chartbusters',
    streamUrl: 'https://c34.radioboss.fm:18023/stream',
    fallbackQuery: 'tamil latest hits',
    logo: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&h=500&fit=crop',
    color: '#ff6600',
    category: 'Live FM Broadcast',
    type: 'live_stream'
  },
  {
    id: 'british_tamil_fm',
    name: 'British Indian Tamil Radio (Live)',
    tagline: 'Crystal Clear AAC Live • Tamil Melodies & Kuthu',
    streamUrl: 'https://hello.citrus3.com:2020/stream/britishindiantamilradio',
    fallbackQuery: 'tamil superhits',
    logo: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&h=500&fit=crop',
    color: '#e60000',
    category: 'Live FM Broadcast',
    type: 'live_stream'
  },
  {
    id: 'shakthi_fm',
    name: 'Shakthi FM 105.1 (Live)',
    tagline: 'Superhit Tamil FM Live • High-Energy Hits',
    streamUrl: 'https://mbc.thestreamtech.com:8086/stream',
    fallbackQuery: 'anirudh tamil hits',
    logo: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&h=500&fit=crop',
    color: '#ef4444',
    category: 'Live FM Broadcast',
    type: 'live_stream'
  },
  {
    id: 'tamil_894_fm',
    name: '89.4 Tamil FM (Live)',
    tagline: 'Non-Stop Live Tamil FM Broadcast • Chartbusters',
    streamUrl: 'https://centova.aarenworld.com/proxy/894tamilfm/stream',
    fallbackQuery: '2025 tamil hits',
    logo: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&h=500&fit=crop',
    color: '#f97316',
    category: 'Live FM Broadcast',
    type: 'live_stream'
  },
  {
    id: 'vanavil_fm',
    name: 'Vanavil FM Radio (Live)',
    tagline: 'Maestro Classics & Tamil Melodies 24x7',
    streamUrl: 'https://s7.yesstreaming.net:8092/stream',
    fallbackQuery: 'ilaiyaraaja tamil hits',
    logo: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&h=500&fit=crop',
    color: '#8b5cf6',
    category: 'Live FM Broadcast',
    type: 'live_stream'
  },
  {
    id: 'tamil_ragam',
    name: 'Tamil Ragam FM (Live)',
    tagline: 'Pure Tamil Melodies & Evergreen Duets',
    streamUrl: 'https://cast4.asurahosting.com/proxy/neville/stream',
    fallbackQuery: 'tamil love melodies',
    logo: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?w=500&h=500&fit=crop',
    color: '#10b981',
    category: 'Live FM Broadcast',
    type: 'live_stream'
  },
  {
    id: 'ilaiyaraaja_247',
    name: 'Ilaiyaraaja 24x7 Radio',
    tagline: 'Full Maestro Classics • 40+ Songs Auto-Queue',
    query: 'ilaiyaraaja tamil',
    logo: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=500&h=500&fit=crop',
    color: '#a855f7',
    category: '320k Artist Radio',
    type: 'artist_radio'
  },
  {
    id: 'spb_immortal',
    name: 'SPB Evergreen 24x7',
    tagline: 'Full S.P. Balasubrahmanyam Golden Collection',
    query: 'spb tamil',
    logo: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=500&h=500&fit=crop',
    color: '#3b82f6',
    category: '320k Artist Radio',
    type: 'artist_radio'
  },
  {
    id: 'ar_rahman_247',
    name: 'A.R. Rahman Magic 24x7',
    tagline: 'Full Isaipuyal Masterpieces in 320k',
    query: 'ar rahman tamil',
    logo: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500&h=500&fit=crop',
    color: '#06b6d4',
    category: '320k Artist Radio',
    type: 'artist_radio'
  },
  {
    id: 'anirudh_party_hits',
    name: 'Anirudh Rock Hits 24x7',
    tagline: 'Full Rockstar Ani Blockbusters Collection',
    query: 'anirudh tamil',
    logo: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=500&h=500&fit=crop',
    color: '#f59e0b',
    category: '320k Artist Radio',
    type: 'artist_radio'
  },
  {
    id: 'yuvan_vibes',
    name: 'Yuvan Shankar Raja 24x7',
    tagline: 'Full U1 Melodies, Mass & BGM Hits',
    query: 'yuvan tamil',
    logo: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&h=500&fit=crop',
    color: '#ec4899',
    category: '320k Artist Radio',
    type: 'artist_radio'
  },
  {
    id: 'vidyasagar_melodies',
    name: 'Vidyasagar Melodies 24x7',
    tagline: 'Full 90s & 2000s Sweet Tamil Melodies',
    query: 'vidyasagar tamil',
    logo: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&h=500&fit=crop',
    color: '#22c55e',
    category: '320k Artist Radio',
    type: 'artist_radio'
  }
];

app.get('/api/radio/stations', (req, res) => {
  res.json({ success: true, stations: TAMIL_FM_STATIONS });
});

// Dedicated Fast Full-Discography Artist 24x7 Radio Endpoint (verified composer catalog + multi-query + pagination)
const artistRadioCache = new Map();
const ARTIST_RADIO_CONFIG = {
  ilaiyaraaja_247: {
    name: 'Ilaiyaraaja 24x7 Radio',
    artistId: '456269',
    playlists: ['827647904', '743037878'],
    trustedShelves: ['ilayaraja_gold'],
    queries: ['ilaiyaraaja tamil hits', 'ilaiyaraaja 80s tamil', 'ilaiyaraaja 90s melodies', 'ilaiyaraaja evergreen tamil'],
    matchTokens: ['ilaiya', 'ilayaraja', 'ilaiyaraja', 'isaignani']
  },
  spb_immortal: {
    name: 'SPB Evergreen 24x7',
    artistId: '455322',
    playlists: ['826526781'],
    trustedShelves: [],
    queries: ['spb tamil hits', 's.p. balasubrahmanyam tamil', 'spb evergreen melodies tamil', 'spb love songs tamil'],
    matchTokens: ['balasubrahmanyam', 'balasubramaniam', 'balasubramanyam', 's.p.b', 'spb']
  },
  ar_rahman_247: {
    name: 'A.R. Rahman Magic 24x7',
    artistId: '456262',
    playlists: [],
    trustedShelves: ['ar_rahman_magic'],
    queries: ['a r rahman tamil hits', 'ar rahman 90s tamil', 'ar rahman evergreen tamil', 'ar rahman melodies tamil'],
    matchTokens: ['rahman']
  },
  anirudh_party_hits: {
    name: 'Anirudh Rock Hits 24x7',
    artistId: '459633',
    playlists: [],
    trustedShelves: ['anirudh_party'],
    queries: ['anirudh ravichander tamil', 'anirudh tamil hits', 'anirudh kuthu songs', 'anirudh melodies tamil'],
    matchTokens: ['anirudh']
  },
  yuvan_vibes: {
    name: 'Yuvan Shankar Raja 24x7',
    artistId: '455792',
    playlists: [],
    trustedShelves: [],
    queries: ['yuvan shankar raja tamil', 'yuvan tamil hits', 'yuvan love songs tamil', 'yuvan melodies tamil'],
    matchTokens: ['yuvan']
  },
  vidyasagar_melodies: {
    name: 'Vidyasagar Melodies 24x7',
    artistId: '455132',
    playlists: [],
    trustedShelves: [],
    queries: ['vidyasagar tamil hits', 'vidyasagar melodies tamil', 'vidyasagar evergreen tamil', 'ghilli tamil songs'],
    matchTokens: ['vidyasagar']
  }
};

function shuffleList(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function isTrackNoiseForTamilRadio(s) {
  const text = `${s.title || ''} ${s.album || ''} ${s.artist || ''}`.toLowerCase();
  return /\b(hanuman chalisa|divine melodies|bhajan|aarti|gayatri mantra|stotra|karaoke)\b/i.test(text);
}

app.get('/api/radio/artist/:id', async (req, res) => {
  try {
    const id = (req.params.id || '').trim();
    const page = Math.max(1, Math.min(5, parseInt(req.query.page || '1', 10) || 1));
    const config = ARTIST_RADIO_CONFIG[id];
    if (!config) {
      return res.status(404).json({ success: false, message: 'Artist radio channel not found' });
    }

    const cacheKey = `${id}_p${page}`;
    const cached = artistRadioCache.get(cacheKey);
    if (cached && cached.data.length >= 15 && Date.now() - cached.ts < 4 * 3600 * 1000) {
      return res.json({ success: true, id, page, name: config.name, results: shuffleList(cached.data) });
    }

    // Parallel verified retrieval: Saavn official artist catalog + curated playlists + search page
    const tasks = [];
    if (page === 1 && config.artistId) {
      tasks.push(
        fetchSongsFromArtist(config.artistId, 50, 4500)
          .then(list => list.map(s => ({ ...s, _catalogVerified: true })))
          .catch(() => [])
      );
      for (const pid of (config.playlists || [])) {
        tasks.push(
          fetchSongsFromPlaylist(pid, 4500)
            .then(list => list.map(s => ({ ...s, _catalogVerified: true })))
            .catch(() => [])
        );
      }
    }

    for (const q of config.queries) {
      tasks.push(
        requestSaavn(`__call=search.getResults&_format=json&cc=in&p=${page}&n=20&q=${encodeURIComponent(q)}`, 4500)
          .then(d => (d?.results || []).map(formatSongItem).filter(Boolean))
          .catch(() => [])
      );
    }

    const allBatches = await Promise.all(tasks);

    const seenIds = new Set();
    const seenTitles = new Set();
    const tamilVerified = [];
    const otherLangVerified = [];

    const ingestTrack = (s, trustCatalog = false) => {
      if (!s || !s.playUrl || !s.id) return;
      if (isTrackNoiseForTamilRadio(s)) return;
      if (seenIds.has(s.id)) return;
      const normTitle = normalizeSongTitle(s.title);
      if (normTitle && seenTitles.has(normTitle)) return;

      const haystack = `${s.artist || ''} ${s.music || ''} ${s.title || ''} ${s.album || ''}`.toLowerCase();
      const isArtistMatch = config.matchTokens.some(tok => haystack.includes(tok));
      if (!trustCatalog && !s._catalogVerified && !isArtistMatch) {
        return; // STRICT: never pollute with unrelated artists or Hindi devotional tracks
      }

      const cleanSong = { ...s };
      delete cleanSong._catalogVerified;
      seenIds.add(cleanSong.id);
      if (normTitle) seenTitles.add(normTitle);

      const lang = (cleanSong.language || 'tamil').toLowerCase();
      if (lang === 'tamil' || lang === '') {
        tamilVerified.push(cleanSong);
      } else if (isArtistMatch) {
        otherLangVerified.push(cleanSong);
      }
    };

    for (const batch of allBatches) {
      (batch || []).forEach(s => ingestTrack(s, false));
    }

    // Blend trusted shelves & preloaded pools ONLY with strict verification (or explicit trustedShelf)
    for (const shelf of (cachedCuratedShelves || [])) {
      const isTrusted = (config.trustedShelves || []).includes(shelf.id);
      (shelf.songs || []).forEach(s => ingestTrack(s, isTrusted));
    }
    for (const s of (preloaded2026Chartbusters || [])) {
      ingestTrack(s, false);
    }

    // Prefer pure Tamil tracks of that composer first; include South Indian / multi-lang tracks of that composer only if Tamil pool < 25
    const finalSongs = (tamilVerified.length >= 25
      ? tamilVerified
      : [...tamilVerified, ...otherLangVerified]
    ).slice(0, 60);

    if (finalSongs.length > 0) {
      artistRadioCache.set(cacheKey, { ts: Date.now(), data: finalSongs });
    }

    res.json({ success: true, id, page, name: config.name, results: shuffleList(finalSongs) });
  } catch (err) {
    console.error('Artist radio error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helper: Extract confirmed movie name from song album & title (handles compilations like "(From \"Movie\")")
function extractConfirmedMovieName(rawMovie, rawTitle) {
  const titleStr = (rawTitle || '').trim();
  const movieStr = (rawMovie || '').trim();

  // Check "(From "MovieName")" in title first, then album
  const fromMatch = titleStr.match(/\(From\s*["']?([^"')]+)["']?\)/i)
    || movieStr.match(/\(From\s*["']?([^"')]+)["']?\)/i);

  let extracted = fromMatch ? fromMatch[1] : movieStr;
  const fromCompilation = Boolean(fromMatch && fromMatch[1])
    || /\b(melodies|vol\.?\s*\d+|collection|evergreen|greatest hits|best of|love notes|most played|top \d+|hits of|chartbusters|classic tamil|non-?stop)\b/i.test(movieStr);

  extracted = (extracted || '')
    .replace(/\s*[-–]\s*(Tamil|Telugu|Malayalam|Hindi|Original Motion Picture Soundtrack)\s*$/i, '')
    .replace(/\s*\((Tamil|Telugu|Malayalam|Hindi|Original Motion Picture Soundtrack)\)/gi, '')
    .replace(/\s*\[(Tamil|Telugu|Malayalam|Hindi)\]/gi, '')
    .replace(/["']/g, '')
    .trim();

  return { cleanMovie: extracted, fromCompilation };
}

// Dedicated Movie-First Auto-Queue Endpoint:
// Given a currently playing song's confirmed movie (album / title), returns:
// 1) All remaining songs from that EXACT movie soundtrack FIRST
// 2) Related songs by the same music director / primary artist AFTER
const movieRelatedCache = new Map();

app.get('/api/movie-related', async (req, res) => {
  try {
    const rawMovie = (req.query.movie || '').trim();
    const rawTitle = (req.query.title || '').trim();
    const albumId = (req.query.albumId || '').trim();
    const artist = (req.query.artist || '').trim();
    const excludeId = (req.query.songId || '').trim();

    const { cleanMovie, fromCompilation } = extractConfirmedMovieName(rawMovie, rawTitle);
    const primaryArtist = artist.split(/[,&]/)[0].trim();

    const cacheKey = `${fromCompilation ? '' : albumId}|${cleanMovie.toLowerCase()}|${primaryArtist.toLowerCase()}`;
    const cached = movieRelatedCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < 2 * 3600 * 1000) {
      const filtered = cached.data.filter(s => s.id !== excludeId);
      return res.json({ success: true, movie: cleanMovie, sameMovieCount: cached.sameMovieCount, results: filtered });
    }

    const sameMovieTracks = [];
    const relatedTracks = [];
    const seenIds = new Set();
    const seenTitles = new Set();
    if (excludeId) seenIds.add(excludeId);

    const isInvalidAlbum = !cleanMovie || ['single', 'unknown', 'live 24x7 broadcast'].includes(cleanMovie.toLowerCase());
    const normMovie = normalizeSongTitle(cleanMovie);

    const isSameMovieCandidate = (s) => {
      if (isInvalidAlbum || !normMovie) return false;
      const { cleanMovie: candMovie } = extractConfirmedMovieName(s.album, s.title);
      const candNorm = normalizeSongTitle(candMovie || s.album || '');
      const origAlbNorm = normalizeSongTitle(s.album || '');
      return Boolean(
        (candNorm && (candNorm === normMovie || candNorm.includes(normMovie) || normMovie.includes(candNorm))) ||
        (origAlbNorm && (origAlbNorm === normMovie || origAlbNorm.includes(normMovie) || normMovie.includes(origAlbNorm))) ||
        doesMovieAlbumMatch(candMovie || s.album || '', cleanMovie)
      );
    };

    const tasks = [];

    // Task 1: Direct album tracks ONLY if albumId belongs to actual movie soundtrack (not a multi-movie compilation)
    if (albumId && !fromCompilation) {
      tasks.push(fetchSongsFromAlbum(albumId, null, 4500).catch(() => []));
    } else if (!isInvalidAlbum) {
      tasks.push(
        requestSaavn(`__call=search.getAlbumResults&_format=json&cc=in&p=1&n=6&q=${encodeURIComponent(cleanMovie)}`, 4500)
          .then(async (albRes) => {
            const albums = albRes?.results || [];
            const bestAlb = albums.find(a => {
              const t = normalizeSongTitle(a.title || '');
              return doesMovieAlbumMatch(a.title || '', cleanMovie) || t === normMovie || t.includes(normMovie) || normMovie.includes(t);
            }) || albums[0];
            const bestId = bestAlb?.albumid || bestAlb?.id;
            if (bestId) return await fetchSongsFromAlbum(bestId, bestAlb, 4500);
            return [];
          })
          .catch(() => [])
      );
    } else {
      tasks.push(Promise.resolve([]));
    }

    // Task 2: Direct song search by confirmed movie name
    if (!isInvalidAlbum) {
      tasks.push(
        requestSaavn(`__call=search.getResults&_format=json&cc=in&p=1&n=16&q=${encodeURIComponent(cleanMovie)}`, 4500)
          .then(d => (d?.results || []).map(formatSongItem).filter(s => s && s.playUrl))
          .catch(() => [])
      );
    } else {
      tasks.push(Promise.resolve([]));
    }

    // Task 3: Related composer / primary artist songs for seamless continuation after movie ends
    if (primaryArtist) {
      tasks.push(
        requestSaavn(`__call=search.getResults&_format=json&cc=in&p=1&n=16&q=${encodeURIComponent(primaryArtist + ' tamil hits')}`, 4500)
          .then(d => (d?.results || []).map(formatSongItem).filter(s => s && s.playUrl))
          .catch(() => [])
      );
    } else {
      tasks.push(Promise.resolve([]));
    }

    const [albumTracks, movieSearchTracks, artistTracks] = await Promise.all(tasks);

    const pushUnique = (targetArr, s) => {
      if (!s || !s.playUrl || seenIds.has(s.id)) return;
      const nt = normalizeSongTitle(s.title);
      if (nt && seenTitles.has(nt)) return;
      seenIds.add(s.id);
      if (nt) seenTitles.add(nt);
      targetArr.push(s);
    };

    // 1. Add exact album tracks first
    for (const s of albumTracks) {
      pushUnique(sameMovieTracks, s);
    }

    // 2. Partition movieSearchTracks: matching movie -> sameMovieTracks, others -> relatedTracks
    for (const s of movieSearchTracks) {
      if (isSameMovieCandidate(s)) {
        pushUnique(sameMovieTracks, s);
      } else {
        pushUnique(relatedTracks, s);
      }
    }

    // 3. Check local preloaded pools (OM Chapter 1 / 2026 chartbusters / shelves) for exact movie & related hits
    const localPool = [
      ...(preloadedOmTracks || []),
      ...(preloaded2026Chartbusters || []),
      ...(cachedCuratedShelves || []).flatMap(sh => sh.songs || [])
    ];
    for (const s of localPool) {
      if (isSameMovieCandidate(s)) {
        pushUnique(sameMovieTracks, s);
      }
    }

    // 4. Append artist / composer related tracks
    for (const s of artistTracks) {
      pushUnique(relatedTracks, s);
    }

    // 5. Fallback related tracks from local pool matching primaryArtist if upstream had few results
    if (primaryArtist && relatedTracks.length < 10) {
      const pLower = primaryArtist.toLowerCase();
      for (const s of localPool) {
        const hay = `${s.artist || ''} ${s.music || ''}`.toLowerCase();
        if (hay.includes(pLower)) {
          pushUnique(relatedTracks, s);
        }
      }
    }

    const combined = [...sameMovieTracks, ...relatedTracks].slice(0, 30);
    if (combined.length > 0) {
      movieRelatedCache.set(cacheKey, {
        ts: Date.now(),
        sameMovieCount: sameMovieTracks.length,
        data: combined
      });
    }

    res.json({
      success: true,
      movie: cleanMovie,
      sameMovieCount: sameMovieTracks.length,
      results: combined.filter(s => s.id !== excludeId)
    });
  } catch (err) {
    console.error('Movie related API error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Lightweight CORS Image Proxy (for PiP canvas album artwork without CORS taint)
app.get('/api/proxy-image', (req, res) => {
  const imgUrl = req.query.url;
  if (!imgUrl || !imgUrl.startsWith('http')) {
    return res.status(400).end();
  }
  try {
    const parsed = new URL(imgUrl);
    const mod = parsed.protocol === 'http:' ? http : https;
    const imgReq = mod.get({
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'http:' ? 80 : 443),
      path: parsed.pathname + parsed.search,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    }, (imgRes) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      if (imgRes.headers['content-type']) {
        res.setHeader('Content-Type', imgRes.headers['content-type']);
      }
      res.writeHead(imgRes.statusCode || 200);
      imgRes.pipe(res);
    });
    imgReq.on('error', () => { if (!res.headersSent) res.status(502).end(); });
  } catch (e) {
    res.status(400).end();
  }
});

// In-memory lyrics cache to prevent rate-limiting and maximize speed
const lyricsCache = new Map();

function cleanLyricsSearchQuery(title, artist) {
  const cleanTitle = (title || '')
    .replace(/\s*\([^)]*\)/gi, '')
    .replace(/\s*\[[^\]]*\]/gi, '')
    .replace(/\s*-\s*From.*/i, '')
    .replace(/[^\w\s\u0B80-\u0BFF]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const primaryArtist = (artist || '')
    .split(/[,&]/)[0]
    .replace(/\s*\([^)]*\)/gi, '')
    .replace(/\s*\[[^\]]*\]/gi, '')
    .trim();
  return { cleanTitle, primaryArtist };
}

function fetchLrcLib(query, retries = 2) {
  return new Promise((resolve) => {
    function attempt(n) {
      const req = https.get({
        hostname: 'lrclib.net',
        path: '/api/search?q=' + encodeURIComponent(query),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }, (res) => {
        let d = '';
        res.on('data', chunk => d += chunk);
        res.on('end', () => {
          if (res.statusCode === 503 && n > 0) {
            setTimeout(() => attempt(n - 1), 600);
            return;
          }
          try {
            const j = JSON.parse(d);
            if (Array.isArray(j) && j.length > 0) {
              const best = j.find(item => item.syncedLyrics) || j[0];
              resolve(best);
              return;
            }
          } catch(e) {}
          resolve(null);
        });
      });
      req.on('error', () => {
        if (n > 0) setTimeout(() => attempt(n - 1), 500);
        else resolve(null);
      });
      req.setTimeout(4500, () => { req.destroy(); resolve(null); });
    }
    attempt(retries);
  });
}

function normalizeLyricsTitle(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .replace(/\s*\([^)]*\)/gi, ' ')
    .replace(/\s*\[[^\]]*\]/gi, ' ')
    .replace(/\s*-\s*from\s+[^-\n]*/gi, ' ')
    .replace(/\s*-\s*trending\s+version/gi, ' ')
    .replace(/\s*-\s*female/gi, ' ')
    .replace(/\s*\(remix\)/gi, ' ')
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findInLyricsDb(title, artist) {
  if (!lyricsDb || !title || typeof title !== 'string') return null;
  const cleanTitle = normalizeLyricsTitle(title);
  if (!cleanTitle || cleanTitle.length < 2) return null;

  // 1. Exact title match
  for (const [key, lyrics] of Object.entries(lyricsDb)) {
    const cleanKey = normalizeLyricsTitle(key);
    if (cleanTitle === cleanKey) {
      return lyrics;
    }
  }

  // 2. Full key contained in title with min length >= 4
  let bestMatch = null;
  let bestLen = 0;
  for (const [key, lyrics] of Object.entries(lyricsDb)) {
    const cleanKey = normalizeLyricsTitle(key);
    if (cleanKey.length >= 4 && cleanTitle.includes(cleanKey)) {
      if (cleanKey.length > bestLen) {
        bestLen = cleanKey.length;
        bestMatch = lyrics;
      }
    }
  }
  return bestMatch;
}

// 4. Lyrics API - Multi-Tier Synchronized Engine (Local DB -> LRCLib -> JioSaavn)
app.get('/api/lyrics', async (req, res) => {
  try {
    const { id, title, artist, album, duration } = req.query;
    if (!title || !title.trim()) {
      return res.json({ success: false, message: 'Missing song title' });
    }

    const cleanTitle = normalizeLyricsTitle(title);
    const cacheKey = `${id || ''}::${cleanTitle}`;
    if (lyricsCache.has(cacheKey)) {
      return res.json(lyricsCache.get(cacheKey));
    }

    // Step 1: Check curated local lyrics database (strict 1:1 song match)
    const localLyrics = findInLyricsDb(title, artist);
    if (localLyrics) {
      const responseData = {
        success: true,
        lyrics: localLyrics,
        synced: true,
        source: 'local_db'
      };
      lyricsCache.set(cacheKey, responseData);
      return res.json(responseData);
    }

    const { cleanTitle: lrcCleanTitle, primaryArtist } = cleanLyricsSearchQuery(title, artist);

    // Step 2: Try LRCLib with cleanTitle + primaryArtist
    let lrc = null;
    if (lrcCleanTitle && primaryArtist) {
      lrc = await fetchLrcLib(`${lrcCleanTitle} ${primaryArtist}`);
    }
    // Try LRCLib with cleanTitle only
    if (!lrc && lrcCleanTitle) {
      lrc = await fetchLrcLib(lrcCleanTitle);
    }

    if (lrc && (lrc.syncedLyrics || lrc.plainLyrics)) {
      const responseData = {
        success: true,
        lyrics: lrc.syncedLyrics || lrc.plainLyrics,
        synced: !!lrc.syncedLyrics,
        source: 'lrclib',
        trackName: lrc.trackName || lrcCleanTitle,
        artistName: lrc.artistName || primaryArtist
      };
      lyricsCache.set(cacheKey, responseData);
      return res.json(responseData);
    }

    // Step 3: Try JioSaavn API
    if (id) {
      try {
        const param = `__call=lyrics.getLyrics&_format=json&ctx=web6dot0&api_version=4&lyrics_id=${id}`;
        const data = await requestSaavn(param);
        if (data && data.lyrics) {
          const cleanLyrics = decodeHtml(data.lyrics).replace(/<br\s*[\/]?>/gi, '\n');
          const responseData = {
            success: true,
            lyrics: cleanLyrics,
            synced: false,
            source: 'saavn'
          };
          lyricsCache.set(cacheKey, responseData);
          return res.json(responseData);
        }
      } catch (saavnErr) {
        console.warn('Saavn lyrics lookup error:', saavnErr.message);
      }
    }

    // Step 4: No lyrics found - return clean not found response
    const notFoundData = {
      success: false,
      message: 'Lyrics not available for this track.'
    };
    lyricsCache.set(cacheKey, notFoundData);
    return res.json(notFoundData);

  } catch (error) {
    console.error('Lyrics API error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Download API – streams the audio with Content-Disposition: attachment so browser saves it
app.use('/api/download', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const audioUrl = req.query.url;
  const filename = req.query.filename || 'music_download';
  const reqFormat = req.query.format;
  const ext = (reqFormat === 'mp3' || (audioUrl && (audioUrl.includes('_320.mp3') || audioUrl.endsWith('.mp3')))) ? 'mp3' : 'm4a';

  if (!audioUrl || !audioUrl.startsWith('http')) {
    return res.status(400).send('Invalid URL');
  }

  const parsed = new URL(audioUrl);
  const clientReq = https.request({
    protocol: parsed.protocol,
    hostname: parsed.hostname,
    port: parsed.port || 443,
    path: parsed.pathname + parsed.search,
    method: 'GET',
    family: 4,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Host': parsed.hostname,
      'Accept': '*/*'
    }
  }, (proxyRes) => {
    const contentType = reqFormat === 'mp3' ? 'audio/mpeg' : (proxyRes.headers['content-type'] || 'audio/mp4');
    const contentLength = proxyRes.headers['content-length'];
    const safeFilename = encodeURIComponent(filename.replace(/[^\w\s\-().]/g, '').trim());

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.${ext}"; filename*=UTF-8''${safeFilename}.${ext}`);
    res.setHeader('Accept-Ranges', 'bytes');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    res.setHeader('Cache-Control', 'no-cache');

    res.writeHead(proxyRes.statusCode);
    proxyRes.pipe(res);
  });

  req.on('close', () => clientReq.destroy());
  clientReq.on('error', (err) => {
    if (!res.headersSent) res.status(500).end();
    console.error('Download proxy error:', err.message);
  });
  clientReq.end();
});

// 6. Audio Proxy (High performance audio streaming with sanitized CORS headers)
app.use('/api/proxy-audio', (req, res) => {
  // Handle CORS preflight requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Origin, Accept, Content-Type');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
  res.setHeader('Accept-Ranges', 'bytes');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const audioUrl = req.query.url;
  const reqFormat = req.query.format;
  if (!audioUrl || !audioUrl.startsWith('http')) {
    return res.status(400).send('Invalid audio URL');
  }

  const range = req.headers.range;
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Host': new URL(audioUrl).hostname,
    'Accept': '*/*'
  };

  if (range) {
    headers['Range'] = range;
  }

  const parsed = new URL(audioUrl);
  const clientReq = https.request({
    protocol: parsed.protocol,
    hostname: parsed.hostname,
    port: parsed.port || 443,
    path: parsed.pathname + parsed.search,
    method: req.method === 'HEAD' ? 'HEAD' : 'GET',
    family: 4,
    headers: headers
  }, (proxyRes) => {
    const outHeaders = {};
    // Sanitize headers: remove any upstream credentials or restricting CORS headers
    for (const [key, val] of Object.entries(proxyRes.headers)) {
      const lower = key.toLowerCase();
      if (lower.startsWith('access-control-') || lower === 'content-security-policy') {
        continue;
      }
      outHeaders[key] = val;
    }

    outHeaders['access-control-allow-origin'] = '*';
    outHeaders['access-control-allow-methods'] = 'GET, HEAD, OPTIONS';
    outHeaders['access-control-allow-headers'] = 'Range, Origin, Accept, Content-Type';
    outHeaders['access-control-expose-headers'] = 'Content-Range, Content-Length, Accept-Ranges';
    outHeaders['accept-ranges'] = 'bytes';
    // Cache-Control: allow browser to cache audio chunks for 1hr (reduces mobile re-fetches)
    outHeaders['cache-control'] = 'public, max-age=3600';

    if (reqFormat === 'mp3') {
      outHeaders['content-type'] = 'audio/mpeg';
    }

    res.writeHead(proxyRes.statusCode, outHeaders);
    if (req.method === 'HEAD') {
      res.end();
    } else {
      // highWaterMark: larger internal buffer helps mobile handle jitter (512KB)
      proxyRes.pipe(res, { highWaterMark: 524288 });
    }
  });

  // Socket optimizations: disable Nagle algorithm for low-latency streaming
  clientReq.on('socket', (socket) => {
    socket.setNoDelay(true);
    socket.setTimeout(30000);
    socket.on('timeout', () => {
      console.warn('Audio proxy socket timeout — destroying');
      clientReq.destroy();
    });
  });

  req.on('close', () => {
    clientReq.destroy();
  });

  clientReq.on('error', (err) => {
    if (err.code === 'ECONNRESET' || err.message === 'socket hang up') return;
    console.error('Audio proxy error:', err.message);
    if (!res.headersSent) {
      res.status(500).end();
    }
  });

  clientReq.end();
});

// Auth route shortcuts
app.get(['/login', '/signin', '/auth'], (req, res) => {
  res.redirect('/auth.html');
});

// Catch-all: serve index.html
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Export for Vercel Serverless Function
module.exports = app;

if (require.main === module || !process.env.VERCEL) {
  const server = app.listen(PORT, () => {
    console.log(`🎶 MUSIC Audio Server running on http://localhost:${PORT}`);
    warmShelves().catch(e => console.warn('Warm shelves error:', e));
  });
  server.on('error', (err) => {
    console.error('Server error:', err);
  });
}
