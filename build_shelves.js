const fs = require('fs');
const https = require('https');
const path = require('path');
const CryptoJS = require('crypto-js');

const SAAVN_DES_KEY = CryptoJS.enc.Utf8.parse('38346591');

function decryptMediaUrl(encUrl) {
  if (!encUrl) return null;
  try {
    const decrypted = CryptoJS.DES.decrypt(
      { ciphertext: CryptoJS.enc.Base64.parse(encUrl) },
      SAAVN_DES_KEY,
      { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 }
    );
    const rawUrl = decrypted.toString(CryptoJS.enc.Utf8);
    if (!rawUrl || !rawUrl.startsWith('http')) return null;
    const base = rawUrl.replace(/_[0-9]+\.(mp4|mp3|m4a)$/, '');
    const ext = rawUrl.endsWith('.mp3') ? '.mp3' : '.mp4';
    return {
      stream_320: base + '_320' + ext,
      stream_160: base + '_160' + ext,
      stream_96: base + '_96' + ext,
      mp4_320: base + '_320' + ext,
      mp4_160: base + '_160' + ext,
      mp4_96: base + '_96' + ext,
      mp3_stream: '/api/proxy-audio?format=mp3&url=' + encodeURIComponent(base + '_320' + ext),
      default_stream: rawUrl
    };
  } catch (e) {
    return null;
  }
}

function decodeHtml(str) {
  if (!str) return '';
  return str.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function requestSaavn(param) {
  return new Promise((resolve) => {
    const url = 'https://www.jiosaavn.com/api.php?' + param;
    https.get(url, {
      family: 4,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.jiosaavn.com/',
        'Cookie': 'L=tamil,malayalam,telugu,hindi,english;'
      },
      timeout: 10000
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(d.replace(/^[^{]*/, '').replace(/[^}]*$/, '')));
        } catch (e) {
          resolve({});
        }
      });
    }).on('error', () => resolve({})).on('timeout', () => resolve({}));
  });
}

function formatSongItem(raw) {
  if (!raw) return null;
  const encUrl = raw.encrypted_media_url || raw.more_info?.encrypted_media_url;
  const mediaStreams = decryptMediaUrl(encUrl);
  const songName = decodeHtml(raw.title || raw.song || raw.name);
  const albumName = decodeHtml(raw.more_info?.album || raw.album || raw.album_name || '');
  const primaryArtists = decodeHtml(raw.more_info?.primary_artists || raw.primary_artists || raw.singers || raw.artist || '');
  const img = raw.image || raw.more_info?.image || '';
  const hd = img ? img.replace('150x150', '500x500').replace('50x50', '500x500').replace('http://', 'https://') : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&h=500&fit=crop';
  return {
    id: raw.id,
    title: songName,
    album: albumName,
    artist: primaryArtists,
    year: raw.year || raw.more_info?.year || '2024',
    language: raw.language || 'tamil',
    duration: raw.duration || raw.more_info?.duration || 210,
    image: hd,
    imageLow: img ? img.replace('500x500', '150x150').replace('http://', 'https://') : hd,
    streams: mediaStreams,
    playUrl: mediaStreams?.stream_320 || mediaStreams?.stream_160 || mediaStreams?.default_stream || raw.media_preview_url || ''
  };
}

const CATEGORIES = [
  { id: 'tamil_trending', title: '🔥 Trending Tamil Hits', subtitle: 'Latest chartbusters and blockbuster anthems', query: 'Tamil Hits' },
  { id: 'malayalam_melodies', title: "🌴 God's Own Melodies (Malayalam)", subtitle: 'Aavesham, Manjummel Boys, Premam & Soulful Beats', query: 'Malayalam Hits' },
  { id: 'ilayaraja_gold', title: '🎼 The Maestro Ilaiyaraaja (80s & 90s)', subtitle: 'Evergreen vintage classics that shaped Tamil cinema', query: 'Ilaiyaraaja Evergreen 80s 90s Tamil' },
  { id: 'spb_chithra', title: '💖 SPB & K.S. Chithra Melodies', subtitle: 'Immortal romantic duets from the golden era', query: 'SPB Chithra Tamil Romantic Melodies' },
  { id: 'anirudh_party', title: '⚡ Rockstar Anirudh Hits', subtitle: 'High-voltage beats, Leo, Jailer, Master, Vikram & more', query: 'Anirudh Ravichander Tamil Hits' },
  { id: 'ar_rahman_magic', title: '💎 A.R. Rahman Evergreen Magic', subtitle: 'Roja, Bombay, Jeans, Alaipayuthey, PS-1 & PS-2', query: 'A.R. Rahman Tamil Hits' },
  { id: 'malayalam_classics', title: '📻 Vintage Malayalam Classics', subtitle: 'K.J. Yesudas, M.G. Sreekumar, Johnson master classics', query: 'KJ Yesudas Malayalam Hits' },
  { id: 'hindi_blockbusters', title: '🎧 Bollywood Hits', subtitle: 'Arijit Singh, Shreya Ghoshal & trending Hindi songs', query: 'Hindi Trending Hits' }
];

async function generateCache() {
  console.log('Fetching all shelf categories...');
  const shelves = [];
  for (const cat of CATEGORIES) {
    const p = '__call=search.getResults&_format=json&_marker=0&cc=in&p=1&n=12&q=' + encodeURIComponent(cat.query);
    const data = await requestSaavn(p);
    const rawList = data.results || [];
    const songs = rawList.map(formatSongItem).filter(s => s && s.playUrl);
    if (songs.length > 0) {
      shelves.push({
        id: cat.id,
        title: cat.title,
        subtitle: cat.subtitle,
        songs: songs.slice(0, 10)
      });
      console.log('Got', cat.id, 'with', songs.length, 'songs');
    }
  }

  if (shelves.length > 0) {
    const outPath = path.join(__dirname, 'shelves_cache.json');
    fs.writeFileSync(outPath, JSON.stringify(shelves, null, 2));
    console.log('SAVED shelves_cache.json with', shelves.length, 'shelves and', shelves.reduce((acc, s) => acc + s.songs.length, 0), 'songs total!');
  } else {
    console.log('Warning: No shelves fetched.');
  }
}

generateCache();
