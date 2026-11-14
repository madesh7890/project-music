const fs = require('fs');
const CryptoJS = require('crypto-js');
const { requestSaavn } = require('./search_engine');

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
      default_stream: rawUrl
    };
  } catch (e) {
    return null;
  }
}

function getHDImage(imgUrl) {
  if (!imgUrl) return 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop';
  return imgUrl
    .replace('50x50', '500x500')
    .replace('150x150', '500x500')
    .replace('http://', 'https://');
}

function decodeHtml(html) {
  if (!html) return '';
  return html.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function formatSongItem(raw) {
  if (!raw) return null;
  const id = raw.id || raw.songid;
  const songName = decodeHtml(raw.song || raw.title || raw.name);
  const albumName = decodeHtml(raw.album || raw.more_info?.album || '');
  const primaryArtists = decodeHtml(raw.primary_artists || raw.more_info?.artistMap?.primary_artists?.map(a => a.name).join(', ') || raw.singers || raw.music || '');
  const musicDirector = decodeHtml(raw.music || raw.more_info?.music || '');
  const year = raw.year || raw.more_info?.year || '2026';
  const language = (raw.language || raw.more_info?.language || 'tamil').toLowerCase();
  const duration = parseInt(raw.duration || raw.more_info?.duration || '240', 10);
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

const PINNED_CONFIG = [
  { rank: 1, q: 'Rathinamo Saurav Srisan', filter: s => !/female/i.test(s.song) },
  { rank: 2, q: 'Veezha Veera OM Chapter 1 Tamil' },
  { rank: 3, q: 'Ala Bolelo Jailer 2 Rajinikanth Tamil' },
  { rank: 4, q: 'Athis Brothers Slim Lazer YD' },
  { rank: 5, q: 'Ooroda Oththa Don Baththa Vijay Sethupathi Tamil' },
  { rank: 6, q: 'Aeroplane SCENE Suriya Sushin Shyam Tamil' },
  { rank: 7, q: 'Rathinamo Female Version Tamil', filter: s => /female/i.test(s.song) },
  { rank: 8, q: 'Usure Needhan Pulla Mandaadi GV Prakash Tamil' },
  { rank: 9, q: 'Kalyani Shreya Ghoshal Fifty4' },
  { rank: 10, q: 'Putaapu Gang Jailer 2 Anirudh Tamil' },
  { rank: 11, q: 'Kalyana Virundhu Dorothy Ilaiyaraaja Tamil' },
  { rank: 12, q: 'FA FA FA OM Chapter 1 Dhanush Tamil' },
  { rank: 13, q: 'Vaama Vaama Idhayam Murali Dhanush Tamil' },
  { rank: 14, q: 'Pattampoochi Suriya GV Prakash Tamil' }
];

async function generateCache() {
  console.log('Fetching 2026 chartbusters...');
  const chartbusters = [];
  for (const item of PINNED_CONFIG) {
    const res = await requestSaavn('__call=search.getResults&_format=json&cc=in&p=1&n=5&q=' + encodeURIComponent(item.q));
    const rawList = res?.results || [];
    const matched = item.filter ? rawList.find(item.filter) || rawList[0] : rawList[0];
    if (matched) {
      const formatted = formatSongItem(matched);
      if (formatted && formatted.playUrl) {
        formatted._pinnedScore = 6000 - (item.rank * 100);
        formatted._pinned = true;
        chartbusters.push(formatted);
        console.log(`✓ Added [Rank ${item.rank}]:`, formatted.title, '| Album:', formatted.album);
      }
    }
  }

  // Pre-fetch all OM Chapter 1 tracks
  console.log('\nFetching OM Chapter 1 tracks...');
  // The official singles in priority order:
  const OM_ORDER = [
    { q: 'Veezha Veera OM Chapter 1 Tamil', lang: 'tamil' },
    { q: 'FA FA FA OM Chapter 1 Dhanush Tamil', lang: 'tamil' },
    { q: 'OM Special Duty Udhiram Tamil', lang: 'tamil' },
    { q: 'Alaakaa Loova OM Chapter 1 Tamil', lang: 'tamil' },
    { q: 'Senjudare OM Chapter 1 Tamil', lang: 'tamil' },
    { q: 'The Wild Theme OM Chapter 1', lang: 'tamil' },
    { q: 'Siya Entry OM Chapter 1', lang: 'tamil' },
    { q: 'Alaakaa Loova Unplugged OM Tamil', lang: 'tamil' }
  ];

  const omSongs = [];
  const seenOmIds = new Set();
  for (const item of OM_ORDER) {
    const res = await requestSaavn('__call=search.getResults&_format=json&cc=in&p=1&n=5&q=' + encodeURIComponent(item.q));
    const rawList = res?.results || [];
    // Find item that belongs to OM Chapter 1
    const match = rawList.find(r => {
      const alb = (r.album || '').toLowerCase();
      const sng = (r.song || '').toLowerCase();
      const isOm = alb.includes('udhiram') || alb.includes('blood wood') || alb.includes('om chapter') || sng.includes('udhiram') || sng.includes('special duty');
      const isTamil = (r.language || '').toLowerCase() === 'tamil' || sng.includes('[tamil]') || alb.includes('[tamil]');
      return isOm && isTamil;
    }) || rawList[0];

    if (match) {
      const f = formatSongItem(match);
      if (f && f.playUrl && !seenOmIds.has(f.id)) {
        seenOmIds.add(f.id);
        omSongs.push(f);
        console.log('✓ Added OM track:', f.title, '| Lang:', f.language);
      }
    }
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    chartbusters2026: chartbusters,
    omChapter1Songs: omSongs
  };

  fs.writeFileSync('chartbusters_2026.json', JSON.stringify(payload, null, 2), 'utf8');
  console.log(`\n🎉 Successfully saved chartbusters_2026.json with ${chartbusters.length} chartbusters and ${omSongs.length} OM tracks!`);
}

generateCache();
