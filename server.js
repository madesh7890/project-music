const express = require('express');
const cors = require('cors');
const https = require('https');
const path = require('path');
const dns = require('dns');
const CryptoJS = require('crypto-js');

dns.setDefaultResultOrder('ipv4first');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

    // Generate quality variants (320kbps, 160kbps, 96kbps)
    const base = rawUrl.replace(/_[0-9]+\.(mp4|mp3|m4a)$/, '');
    const ext = rawUrl.endsWith('.mp3') ? '.mp3' : '.mp4';
    return {
      stream_320: `${base}_320${ext}`,
      stream_160: `${base}_160${ext}`,
      stream_96: `${base}_96${ext}`,
      default_stream: rawUrl.includes('_96') ? `${base}_320${ext}` : rawUrl
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

// 1. Search API: Handles queries like "Leo", "Vikram", "Naa Ready", "Ilaiyaraaja 90s", "Malayalam songs", etc.
app.get('/api/search', async (req, res) => {
  try {
    let { q, language, page = 1, limit = 24 } = req.query;
    if (!q || !q.trim()) {
      return res.json({ success: true, results: [], total: 0 });
    }

    q = q.trim();

    // If query is generic like "tamil songs" or "malayalam songs" or language is set
    let searchQuery = q;
    if (language && !q.toLowerCase().includes(language.toLowerCase())) {
      searchQuery = `${q} ${language}`;
    }

    const encodedQ = encodeURIComponent(searchQuery);
    const param = `__call=search.getResults&_format=json&_marker=0&cc=in&p=${page}&n=${limit}&q=${encodedQ}`;
    const data = await requestSaavn(param);

    const rawList = data.results || [];
    const formatted = rawList
      .map(formatSongItem)
      .filter(song => song && song.playUrl);

    res.json({
      success: true,
      query: q,
      total: data.total || formatted.length,
      results: formatted
    });
  } catch (error) {
    console.error('Search endpoint error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Simple in-memory cache for fast loading
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

const CATEGORIES = [
  {
    id: 'tamil_trending',
    title: '🔥 Trending Tamil Hits',
    subtitle: 'Latest chartbusters and blockbuster anthems',
    query: 'Tamil Hits'
  },
  {
    id: 'malayalam_melodies',
    title: '🌴 God\'s Own Melodies (Malayalam)',
    subtitle: 'Aavesham, Manjummel Boys, Premam & Soulful Beats',
    query: 'Malayalam Hits'
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
    query: 'SPB Chithra Tamil Romantic Melodies'
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
    query: 'Hindi Trending Hits'
  }
];

async function fetchShelf(cat) {
  const cacheKey = `shelf_${cat.id}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const param = `__call=search.getResults&_format=json&_marker=0&cc=in&p=1&n=12&q=${encodeURIComponent(cat.query)}`;
  const data = await requestSaavn(param);
  const rawList = data.results || [];
  const songs = rawList.map(formatSongItem).filter(s => s && s.playUrl);
  const result = {
    id: cat.id,
    title: cat.title,
    subtitle: cat.subtitle,
    songs: songs.slice(0, 10)
  };
  setCache(cacheKey, result, 30 * 60 * 1000); // 30 min cache
  return result;
}

// Pre-warm shelves sequentially in background
async function warmShelves() {
  for (const cat of CATEGORIES) {
    try {
      await fetchShelf(cat);
      // Small pause between fetches to prevent rate-limiting
      await new Promise(r => setTimeout(r, 250));
    } catch (e) {
      console.warn('Pre-warm error for', cat.id, e.message);
    }
  }
  console.log('✅ All curated music shelves pre-warmed and cached!');
}

// 2. Curated Shelves API
app.get('/api/curated-shelves', async (req, res) => {
  try {
    const shelves = [];
    for (const cat of CATEGORIES) {
      const shelf = await fetchShelf(cat);
      if (shelf && shelf.songs && shelf.songs.length > 0) {
        shelves.push(shelf);
      }
    }
    res.json({ success: true, shelves });
  } catch (error) {
    console.error('Shelves error:', error);
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

// 3. Trending by Language (Tamil, Malayalam, Telugu, Hindi, English, Retro)
app.get('/api/trending', async (req, res) => {
  try {
    const lang = (req.query.language || 'tamil').toLowerCase();
    const cacheKey = `trending_${lang}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json({ success: true, language: lang, results: cached });

    const queryMap = {
      tamil: 'Tamil Hits',
      malayalam: 'Malayalam Hits',
      telugu: 'Telugu Hits',
      hindi: 'Hindi Hits',
      english: 'English Pop Hits',
      retro: 'Ilaiyaraaja SPB Tamil Hits'
    };

    const q = queryMap[lang] || `${lang} hits`;
    const param = `__call=search.getResults&_format=json&_marker=0&cc=in&p=1&n=24&q=${encodeURIComponent(q)}`;
    const data = await requestSaavn(param);

    const rawList = data.results || [];
    const formatted = rawList.map(formatSongItem).filter(s => s && s.playUrl);

    setCache(cacheKey, formatted);
    res.json({ success: true, language: lang, results: formatted });
  } catch (error) {
    console.error('Trending error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Lyrics API
app.get('/api/lyrics', async (req, res) => {
  try {
    const songId = req.query.id;
    if (!songId) return res.json({ success: false, message: 'Missing song id' });

    const param = `__call=lyrics.getLyrics&_format=json&_marker=0&cc=in&lyrics_id=${songId}`;
    const data = await requestSaavn(param);

    if (data && data.lyrics) {
      const cleanLyrics = decodeHtml(data.lyrics).replace(/<br\s*[\/]?>/gi, '\n');
      res.json({ success: true, lyrics: cleanLyrics });
    } else {
      res.json({ success: false, message: 'Lyrics not available for this song.' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Audio Proxy (Optional failover for browser restrictions or strict CORS)
app.get('/api/proxy-audio', (req, res) => {
  const audioUrl = req.query.url;
  if (!audioUrl || !audioUrl.startsWith('http')) {
    return res.status(400).send('Invalid audio URL');
  }

  const range = req.headers.range;
  const options = {
    family: 4,
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Referer': 'https://www.jiosaavn.com/'
    }
  };

  if (range) {
    options.headers['Range'] = range;
  }

  https.get(audioUrl, options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  }).on('error', (err) => {
    console.error('Audio proxy error:', err.message);
    res.status(500).end();
  });
});

// Catch-all: serve index.html
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🎶 RaagaStream Audio Server running on http://localhost:${PORT}`);
  warmShelves();
});
