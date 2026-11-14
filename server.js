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
app.use(express.json());
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
function requestSaavn(queryParamStr) {
  return new Promise((resolve, reject) => {
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
      timeout: 10000
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
  const primaryArtists = decodeHtml(raw.primary_artists || raw.more_info?.artistMap?.primary_artists?.map(a => a.name).join(', ') || raw.singers || raw.music || '');
  const musicDirector = decodeHtml(raw.music || raw.more_info?.music || '');
  const year = raw.year || raw.more_info?.year || '';
  const language = (raw.language || raw.more_info?.language || 'tamil').toLowerCase();
  const duration = parseInt(raw.duration || raw.more_info?.duration || '240', 10);

  // Decrypt media streaming URL
  const encMedia = raw.encrypted_media_url || raw.more_info?.encrypted_media_url;
  const mediaStreams = decryptMediaUrl(encMedia);

  const rawImage = raw.image || raw.more_info?.image;
  const imageHD = getHDImage(rawImage);
  const imageLow = rawImage ? rawImage.replace('50x50', '150x150').replace('http://', 'https://') : imageHD;

  return {
    id,
    title: songName,
    album: albumName,
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
async function fetchSongsFromAlbum(albId, albInfo = null) {
  if (!albId) return [];
  try {
    const details = await requestSaavn(`__call=content.getAlbumDetails&_format=json&cc=in&albumid=${albId}`);
    if (details && details.songs && Array.isArray(details.songs)) {
      const results = [];
      details.songs.forEach(rawSong => {
        if (!rawSong.image && albInfo?.image) {
          rawSong.image = albInfo.image;
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
async function fetchSongsFromPlaylist(listId) {
  if (!listId) return [];
  try {
    const data = await requestSaavn(`__call=playlist.getDetails&_format=json&cc=in&listid=${listId}`);
    if (data && data.songs && Array.isArray(data.songs)) {
      return data.songs.map(formatSongItem).filter(s => s && s.playUrl);
    }
  } catch (e) {
    console.warn('Error fetching playlist details:', e.message);
  }
  return [];
}

// Helper: fetch top songs from an artist's catalog
async function fetchSongsFromArtist(artistId, count = 25) {
  if (!artistId) return [];
  try {
    const data = await requestSaavn(`__call=artist.getArtistPageDetails&_format=json&cc=in&artistId=${artistId}&n_song=${count}`);
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
      const omQueries = [
        `OM Chapter 1 ${lang}`,
        `OM Chapter ${lang}`,
        `OM Udhiram ${lang}`,
        `Veezha Veera ${lang}`,
        `FA FA FA ${lang}`,
        `OM Special Duty ${lang}`,
        `OM Dhanush`,
        `Senjudare ${lang}`,
        `Alaakaa Loova ${lang}`
      ];
      const promises = omQueries.map(oq =>
        requestSaavn(`__call=search.getResults&_format=json&_marker=0&cc=in&p=1&n=12&q=${encodeURIComponent(oq)}`)
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
      // Generic trending queries
      const genericQueries = [
        `Latest ${lang} Hits ${intent.year || ''}`,
        `New ${lang} Songs ${intent.year || ''}`,
        `Latest ${lang} ${intent.year || ''}`,
        `Best of ${intent.year || ''} ${lang}`,
        `${lang} Trending Hits`
      ];

      // ── Curated 2026 Tamil chartbuster targeted queries ──
      // These ensure the viral trending Tamil songs appear in results
      // when searching "new movie songs 2026 tamil" / "tamil new songs" / "latest tamil 2026"
      const curatedChartbusters2026 = [
        // OM Chapter 1: Udhiram - The Blood Wood (Dhanush, Mammootty, Sai Abhyankkar)
        'Veezha Veera OM Chapter 1 Tamil',
        'FA FA FA OM Chapter 1 Dhanush Tamil',
        'OM Chapter 1 Udhiram Tamil Songs',
        'OM Udhiram Blood Wood Tamil 2026',
        // Jailer 2 (Rajinikanth, Anirudh, Nelson)
        'Ala Bolelo Jailer 2 Rajinikanth Anirudh Tamil',
        'Putaapu Gang Jailer 2 Anirudh Tamil',
        // Rathinamo - Tamil Indie (Saurav Srisan / Tanisha Gnanavel)
        'Rathinamo Saurav Srisan Tamil Indie',
        'Rathinamo Female Version Tamil',
        // Pattampoochi - Vishwanath and Sons (Suriya, GV Prakash)
        'Pattampoochi Vishwanath and Sons Suriya GV Prakash Tamil',
        // Vaama Vaama - Idhayam Murali (Dhanush, Thaman)
        'Vaama Vaama Idhayam Murali Dhanush Thaman Tamil',
        // Ooroda Oththa Don - Baththa (Vijay Sethupathi, Sai Abhyankkar)
        'Ooroda Oththa Don Baththa Vijay Sethupathi Tamil',
        // Aeroplane - SCENE (Suriya, Sushin Shyam)
        'Aeroplane SCENE Suriya Sushin Shyam Tamil',
        // Usure Needhan Pulla - MANDAADI (Soori, GV Prakash)
        'Usure Needhan Pulla Mandaadi Soori GV Prakash Tamil',
        // KALYANI (Shreya Ghoshal, ARJN)
        'Kalyani Shreya Ghoshal ARJN Tamil',
        // Kalyana Virundhu - DOROTHY (Ilaiyaraaja, Karthik Subbaraj)
        'Kalyana Virundhu Dorothy Ilaiyaraaja Tamil',
        // Athis Brothers (Slim Lazer YD)
        'Athis Brothers Slim Lazer YD Kash Villanz Tamil'
      ];

      const allQueries = [...genericQueries, ...curatedChartbusters2026];
      const promises = allQueries.map(qStr =>
        requestSaavn(`__call=search.getResults&_format=json&cc=in&p=1&n=10&q=${encodeURIComponent(qStr.trim())}`)
      );
      const responses = await Promise.all(promises);
      responses.forEach(r => collectFromResults(r?.results));

      // ── Also fetch OM Chapter 1 album tracklist directly to guarantee all songs appear ──
      // Search for OM album and fetch full tracklist
      try {
        const omAlbumSearch = await requestSaavn(`__call=search.getAlbumResults&_format=json&cc=in&p=1&n=5&q=${encodeURIComponent('OM Chapter 1 Udhiram Tamil')}`);
        const omAlbums = omAlbumSearch?.results || [];
        const omAlbum = omAlbums.find(a => {
          const t = (a.title || '').toLowerCase();
          return t.includes('udhiram') || t.includes('om chapter') || t.includes('blood wood');
        });
        if (omAlbum) {
          const omAlbumSongs = await fetchSongsFromAlbum(omAlbum.id || omAlbum.albumid, omAlbum);
          candidates.push(...omAlbumSongs);
        }
      } catch(e) {
        // silent — curated song queries above already cover OM songs
      }
    }

    // ── CASE 5: MOVIE / TRACK SPECIFIC SEARCH ──
    const movieTarget = intent.coreWithoutYear || intent.coreKeywords || intent.suffixStripped || q;
    const searchTerms = [
      `${movieTarget} ${lang}`,
      movieTarget
    ];
    if (intent.transliterated && intent.transliterated !== movieTarget) {
      searchTerms.push(`${intent.transliterated} ${lang}`);
    }

    const albumPromises = searchTerms.map(st =>
      requestSaavn(`__call=search.getAlbumResults&_format=json&_marker=0&cc=in&p=1&n=8&q=${encodeURIComponent(st)}`)
    );
    const songPromises = searchTerms.map(st =>
      requestSaavn(`__call=search.getResults&_format=json&_marker=0&cc=in&p=${page}&n=${limit}&q=${encodeURIComponent(st)}`)
    );

    const [albumResultsArray, songResultsArray] = await Promise.all([
      Promise.all(albumPromises),
      Promise.all(songPromises)
    ]);

    songResultsArray.forEach(sda => collectFromResults(sda?.results));

    // Process matched albums and fetch full tracklists
    const cleanMovieLower = movieTarget.toLowerCase();
    const allAlbums = albumResultsArray.flatMap(a => a?.results || []);
    const matchingAlbums = allAlbums.filter(alb => {
      const albLang = (alb.language || alb.more_info?.language || '').toLowerCase();
      const albTitle = (alb.title || '').toLowerCase();
      const isMatch = albTitle.includes(cleanMovieLower) || cleanMovieLower.includes(albTitle) || stringSimilarity(cleanMovieLower, albTitle) >= 0.7;
      if (!isMatch) return false;
      if (intent.explicitLanguageRequested && albLang && albLang !== lang && !albTitle.includes(`[${lang}]`) && !albTitle.includes(`(${lang})`)) {
        return false;
      }
      return true;
    });

    const targetAlbums = matchingAlbums.slice(0, 3);
    if (targetAlbums.length > 0) {
      const albumDetailPromises = targetAlbums.map(alb => {
        const albId = alb.id || alb.albumid;
        return fetchSongsFromAlbum(albId, alb);
      });
      const albumSongsArrays = await Promise.all(albumDetailPromises);
      albumSongsArrays.forEach(songs => candidates.push(...songs));
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
    query: 'SPB Janaki Tamil Evergreen Duet'
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

// 3. Trending by Language (Tamil, Malayalam, Telugu, Hindi, English, Retro) - Always Fresh!
app.get('/api/trending', async (req, res) => {
  try {
    const lang = (req.query.language || 'tamil').toLowerCase();
    const cacheKey = `trending_v2_${lang}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json({ success: true, language: lang, results: cached });

    const queryMap = {
      tamil: 'Latest Tamil Hits',
      malayalam: 'Latest Malayalam Hits',
      telugu: 'Latest Telugu Hits',
      hindi: 'Latest Bollywood Hits',
      english: 'Top Pop Hits',
      retro: '80s 90s Tamil Evergreen Melodies'
    };

    const q = queryMap[lang] || `Latest ${lang} Hits`;
    const param = `__call=search.getResults&_format=json&_marker=0&cc=in&p=1&n=28&q=${encodeURIComponent(q)}`;
    const data = await requestSaavn(param);

    const rawList = data.results || [];
    const formatted = rawList.map(formatSongItem).filter(s => s && s.playUrl);

    setCache(cacheKey, formatted, 30 * 60 * 1000);
    res.json({ success: true, language: lang, results: formatted });
  } catch (error) {
    console.error('Trending error:', error);
    res.status(500).json({ success: false, error: error.message });
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
