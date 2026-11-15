// =====================================================================================
// SEARCH ENGINE & QUERY INTELLIGENCE PIPELINE (Phase 1)
// Architecture:
// 1. Query Normalizer (Unicode transliteration, possessive stripping, phonetic normalization)
// 2. Intent Classifier (Movie/Album, Artist, Track, Recency/Chartbuster, Decade)
// 3. Multi-source Candidate Retrieval (Albums, Tracks, Playlists, Artist catalogs)
// 4. Multi-factor Scoring & Ranking Engine (Text + Album match + Recency + Language - Noise)
// 5. Deduplication, Section Grouping (Top Result, Songs, Albums, Noise) & Caching
// =====================================================================================

const https = require('https');

// ── 1. TAMIL TRANSLITERATION ENGINE ──
const TAMIL_VOWELS = {
  'அ':'a','ஆ':'aa','இ':'i','ஈ':'ee','உ':'u','ஊ':'oo','எ':'e','ஏ':'ae','ஐ':'ai','ஒ':'o','ஓ':'oa','ஔ':'au'
};
const TAMIL_CONSONANTS = {
  'க':'k','ங':'ng','ச':'s','ஞ':'nj','ட':'t','ண':'n','த':'th','ந':'n','ப':'p','ம':'m','ய':'y','ர':'r','ல':'l','வ':'v','ழ':'zh','ள':'l','ற':'r','ன':'n',
  'ஜ':'j','ஷ':'sh','ஸ':'s','ஹ':'h'
};
const TAMIL_MATRAS = {
  'ா':'aa','ி':'i','ீ':'ee','ு':'u','ூ':'oo','ெ':'e','ே':'ae','ை':'ai','ொ':'o','ோ':'oa','ௌ':'au','்':''
};

function transliterateTamil(text) {
  if (!text || !/[\u0B80-\u0BFF]/.test(text)) return text || '';
  let out = '';
  const len = text.length;
  for (let i = 0; i < len; i++) {
    const ch = text[i];
    if (TAMIL_VOWELS[ch]) {
      out += TAMIL_VOWELS[ch];
    } else if (TAMIL_CONSONANTS[ch]) {
      const next = i + 1 < len ? text[i + 1] : '';
      if (TAMIL_MATRAS[next] !== undefined) {
        out += TAMIL_CONSONANTS[ch] + TAMIL_MATRAS[next];
        i++; // skip matra
      } else {
        out += TAMIL_CONSONANTS[ch] + 'a';
      }
    } else {
      out += ch;
    }
  }
  return out;
}

// ── 2. PHONETIC & TYPO NORMALIZER ──
const SEARCH_CORRECTIONS = [
  { pattern: /\bmoives?\b/gi, replacement: 'movie' },
  { pattern: /\bmuvie\b/gi, replacement: 'movie' },
  { pattern: /\bvedio\b/gi, replacement: 'video' },
  { pattern: /\bpaatu\b/gi, replacement: 'paattu' },
  { pattern: /\bpattu\b/gi, replacement: 'paattu' },
  { pattern: /\bpadal\b/gi, replacement: 'paadal' },
  { pattern: /\bpadalgal\b/gi, replacement: 'paadalgal' },
  { pattern: /\bpadalkal\b/gi, replacement: 'paadalgal' },
  { pattern: /\bpaatugal\b/gi, replacement: 'paattugal' },
  { pattern: /\bpaatalkal\b/gi, replacement: 'paadalgal' },
  { pattern: /\btreanding\b/gi, replacement: 'trending' },
  { pattern: /\bjeyilar\b/gi, replacement: 'jailer' },
  { pattern: /\bjailor\b/gi, replacement: 'jailer' },
  { pattern: /\bkaathal\b/gi, replacement: 'kadhal' },
  { pattern: /\bennamo\s*kanavu\b/gi, replacement: 'kanave kanave' },
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

// Strip Tamil possessive suffixes: "dhanush-oda", "dhanushin", "padathula", etc.
function stripTamilSuffixes(str) {
  if (!str) return '';
  return str
    .replace(/\b([a-z0-9]+)(?:oda|udeaya)\b/gi, '$1') // e.g. dhanushoda -> dhanush
    .replace(/\b([a-z0-9]+)(?:in)\b/gi, '$1')         // e.g. dhanushin -> dhanush
    .replace(/\b([a-z0-9]+)(?:kku|ku)\b/gi, '$1')     // e.g. paatukku -> paatu
    .replace(/\b([a-z0-9]+)(?:la)\b/gi, '$1')         // e.g. padathula -> padathu
    .replace(/\b(oda|udeaya|la|ku|kku|in)\b/gi, '')    // standalone connectors
    .replace(/\s+/g, ' ')
    .trim();
}

// Phonetic compression for loose matching (kaadhal == kadhal, vaa == va)
function phoneticNormalize(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/aa+/g, 'a')
    .replace(/ee+|ii+/g, 'i')
    .replace(/oo+|uu+/g, 'u')
    .replace(/dh/g, 'th')
    .replace(/zh/g, 'l')
    .replace(/tt/g, 't')
    .replace(/pp/g, 'p')
    .replace(/kk/g, 'k')
    .replace(/ss/g, 's')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// Standard string title normalization for deduplication
function normalizeTitle(str) {
  if (!str) return '';
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

// Fast Levenshtein distance & similarity (0.0 to 1.0)
function levenshteinDistance(s1, s2) {
  if (s1 === s2) return 0;
  if (!s1.length) return s2.length;
  if (!s2.length) return s1.length;
  let prevRow = Array.from({ length: s2.length + 1 }, (_, i) => i);
  for (let i = 0; i < s1.length; i++) {
    let curRow = [i + 1];
    for (let j = 0; j < s2.length; j++) {
      const cost = s1[i] === s2[j] ? 0 : 1;
      curRow[j + 1] = Math.min(curRow[j] + 1, prevRow[j + 1] + 1, prevRow[j] + cost);
    }
    prevRow = curRow;
  }
  return prevRow[s2.length];
}

function stringSimilarity(a, b) {
  if (!a || !b) return 0;
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();
  if (s1 === s2) return 1.0;
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(s1, s2);
  return Math.max(0, (maxLen - dist) / maxLen);
}

// ── ROBUST MOVIE & ALBUM MATCHER ──
function normalizeMovieTitle(str) {
  if (!str) return '';
  return str.toLowerCase()
    .replace(/\b(the beginning|part 1|chapter 1|first|vol 1|vol\. 1)\b/gi, ' 1 ')
    .replace(/\b(the conclusion|part 2|chapter 2|second|vol 2|vol\. 2)\b/gi, ' 2 ')
    .replace(/\b(the rule|part 3|chapter 3|third|vol 3|vol\. 3)\b/gi, ' 3 ')
    .replace(/\b(tamil|telugu|malayalam|hindi|kannada|english)\b/gi, ' ')
    .replace(/\b(original motion picture soundtrack|soundtrack|ost|songs?|movie|film|album|paadalgal|paattu|pattu|audio)\b/gi, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function doesMovieAlbumMatch(albumTitle, query) {
  if (!albumTitle || !query) return false;
  const normQ = normalizeMovieTitle(query);
  const normAlb = normalizeMovieTitle(albumTitle);

  const qNum = normQ.match(/\b\d+\b/)?.[0];
  const albNum = normAlb.match(/\b\d+\b/)?.[0];
  // If one query specifically specifies part 1 and album is part 2, reject!
  if (qNum && albNum && qNum !== albNum) return false;

  const phonQ = phoneticNormalize(normQ.replace(/\b\d+\b/g, ''));
  const phonAlb = phoneticNormalize(normAlb.replace(/\b\d+\b/g, ''));

  if (!phonQ || !phonAlb) return false;
  if (phonAlb === phonQ) return true;
  if (phonAlb.includes(phonQ) || phonQ.includes(phonAlb)) return true;
  if (stringSimilarity(phonQ, phonAlb) >= 0.75) return true;
  return false;
}

// ── 3. INTENT DETECTION ENGINE ──
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

// Known artists directory
const KNOWN_ARTISTS = [
  {
    name: 'deva',
    match: /\b(?:deva|thenisai\s*thendral)\b/i,
    artistId: '455219',
    playlists: ['1267537810', '1267515862'],
    queries: ['Deva Hits Tamil', 'Deva Gana Songs', 'Best of Deva']
  },
  {
    name: 'ilaiyaraaja',
    match: /\b(?:ilaiyaraaja|ilayaraja|ilayarajah|ilaiyaraja|isaignani|raaja)\b/i,
    artistId: '456269',
    playlists: ['827647904', '743037878'],
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
    name: 'dhanush',
    match: /\b(?:dhanush|actor\s*dhanush)\b/i,
    artistId: '455662',
    queries: ['Dhanush Tamil Hits', 'Dhanush Best Songs', 'Best of Dhanush']
  },
  {
    name: 'sai_abhyankkar',
    match: /\b(?:sai\s*abhyankkar|abhyankkar)\b/i,
    artistId: '16928738',
    queries: ['Sai Abhyankkar Tamil Hits', 'iSaiAbhyankkar']
  }
];

function cleanSearchStopwords(q) {
  if (!q) return '';
  return q
    .replace(/\b(songs?|movie|movies|album|albums|padam|track|tracks|audio|mp3|video|lyrics|hd|bgm|ost|paadal|paattu|pattu|paatalkal|padalkal|paadalgal|full|ringtone|remix|new|latest|trending|viral|hits?|top|best|recent|superhit|chartbusters?)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripSearchLanguage(q) {
  if (!q) return '';
  return q
    .replace(/\b(tamil|telugu|malayalam|hindi|kannada|english|punjabi|marathi|bengali)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseSearchIntent(rawQuery, explicitLanguage) {
  const transliterated = transliterateTamil(rawQuery);
  const corrected = applySearchCorrections(transliterated);
  const suffixStripped = stripTamilSuffixes(corrected);
  const lang = detectLanguage(suffixStripped, explicitLanguage || 'tamil');
  const year = detectYear(suffixStripped);
  const decade = detectDecade(suffixStripped);

  const explicitLanguageRequested = Boolean(
    explicitLanguage || suffixStripped.match(/\b(tamil|telugu|malayalam|hindi|kannada|english|punjabi|marathi|bengali)\b/i)
  );

  const isDevotionalExplicit = /\b(devotional|bhakti|bhajan|bakthi|god|shiva|krishna|murugan|vinayagar|amman|temple|mantra|chanting|suprabhatam|slokas?)\b/i.test(suffixStripped);
  const isRemixExplicit = /\b(remix|dj|mashup|club\s*mix|edm)\b/i.test(suffixStripped);
  const isKaraokeExplicit = /\b(karaoke|instrumental|minus\s*one)\b/i.test(suffixStripped);

  const noStopwords = cleanSearchStopwords(suffixStripped);
  const coreKeywords = stripSearchLanguage(noStopwords);
  const coreWithoutYear = coreKeywords.replace(/\b(19\d{2}|20\d{2})\b/g, '').trim();

  const isLatestOrTrending = /\b(new|latest|trending|viral|chartbusters?)\b/i.test(suffixStripped);
  const isGenericNewOrYear = (!coreWithoutYear || coreWithoutYear.length < 2) && (isLatestOrTrending || year);

  // Check OM Movie Intent specifically ("OM Chapter 1: Udhiram - The Blood Wood")
  const isOmMovie = (
    /\bom\b/i.test(coreWithoutYear) ||
    (/\bom\b/i.test(suffixStripped) && (/\b(movie|dhanush|chapter|udhiram|sai\s*abhyankkar|2026)\b/i.test(suffixStripped) || coreWithoutYear === 'om'))
  );

  // Check Artist Intent (only when not an OM movie query)
  const matchedArtist = !isOmMovie ? KNOWN_ARTISTS.find(a => a.match.test(suffixStripped)) : null;

  // Movie Intent (e.g. query has "movie", "padam", "film", or is a short movie title like "leo", "jailer", "om")
  const isMovieIntent = isOmMovie || /\b(movie|movies|padam|film|soundtrack)\b/i.test(rawQuery) || Boolean(coreWithoutYear && coreWithoutYear.length >= 2);

  return {
    rawQuery,
    transliterated,
    corrected,
    suffixStripped,
    coreKeywords,
    coreWithoutYear,
    lang,
    year,
    decade,
    explicitLanguageRequested,
    isDevotionalExplicit,
    isRemixExplicit,
    isKaraokeExplicit,
    isLatestOrTrending,
    isGenericNewOrYear,
    isOmMovie,
    matchedArtist,
    isMovieIntent
  };
}

// ── 4. SCORING & RANKING FORMULA (Step D) ──
// Score = textMatchScore + movieAlbumBonus + artistBonus + languageBonus + recencyBoost - noisePenalties
function computeSongRelevanceScore(song, intent) {
  if (!song) return -999;
  let score = 0;

  const rawTitle = (song.title || '').toLowerCase();
  const rawAlbum = (song.album || '').toLowerCase();
  const rawArtist = (song.artist || '').toLowerCase();
  const rawLang = (song.language || '').toLowerCase();
  const songYear = parseInt(song.year, 10) || 0;

  const coreQ = (intent.coreWithoutYear || intent.coreKeywords || intent.suffixStripped).toLowerCase().trim();
  const phonCoreQ = phoneticNormalize(coreQ);
  const phonTitle = phoneticNormalize(rawTitle);
  const phonAlbum = phoneticNormalize(rawAlbum);

  // 1. Text Match Scoring (Title, Album, Artist)
  if (phonTitle === phonCoreQ || rawTitle === coreQ) {
    score += 120; // Exact title match!
  } else if (phonTitle.startsWith(phonCoreQ) || rawTitle.startsWith(coreQ)) {
    score += 80;  // Title starts with query
  } else if (phonTitle.includes(phonCoreQ) || rawTitle.includes(coreQ)) {
    score += 55;  // Title contains query
  } else {
    // Fuzzy matching on title
    const sim = stringSimilarity(phonCoreQ, phonTitle);
    if (sim >= 0.75) {
      score += Math.round(sim * 50);
    }
  }

  // 2. Movie / Album Match Bonus (Guarantees all songs from searched movie rank together at the top)
  if (intent.isMovieIntent || coreQ.length >= 2) {
    const isAlbMovieMatch = doesMovieAlbumMatch(rawAlbum, coreQ) || doesMovieAlbumMatch(rawAlbum, intent.rawQuery);
    if (isAlbMovieMatch) {
      score += 260; // HUGE BONUS: Song belongs to the searched movie's album!
    } else if (phonAlbum === phonCoreQ || rawAlbum === coreQ) {
      score += 70; // Album title exact match!
    } else if (phonAlbum.includes(phonCoreQ) || rawAlbum.includes(coreQ)) {
      score += 45; // Album title contains query
    } else {
      const albSim = stringSimilarity(phonCoreQ, phonAlbum);
      if (albSim >= 0.75) {
        score += Math.round(albSim * 40);
      }
    }
  }

  // 3. Special OM Movie Intent
  const isOmChapter1Song = (
    rawAlbum.includes('udhiram') || rawAlbum.includes('blood wood') ||
    rawAlbum.includes('om chapter') || rawTitle.includes('udhiram') ||
    rawAlbum.includes('om - chapter') || rawAlbum.includes('om chapter 1')
  );
  if (intent.isOmMovie) {
    if (isOmChapter1Song) {
      score += 150; // Massively boost OM Chapter 1: Udhiram!
    } else if (rawAlbum.includes('kgf') || rawAlbum.includes('kantara') || rawAlbum.includes('mafia')) {
      score -= 100; // Strictly penalize KGF/Kantara/Mafia Chapter 1 leakage
    }
  }

  // Also boost OM Chapter 1 songs in generic "new 2026 tamil" queries
  if (intent.isGenericNewOrYear && isOmChapter1Song) {
    score += 80; // OM Chapter 1 is a top 2026 Tamil chartbuster
  }

  // 4. Artist Match Bonus
  if (intent.matchedArtist) {
    if (rawArtist.includes(intent.matchedArtist.name) || intent.matchedArtist.match.test(rawArtist)) {
      score += 50;
    }
  }

  // 5. Language Match Bonus & Isolation
  if (intent.explicitLanguageRequested) {
    const isStrictLangMatch = (
      rawLang === intent.lang ||
      rawTitle.includes(`[${intent.lang}]`) ||
      rawTitle.includes(`(${intent.lang})`) ||
      rawAlbum.includes(`[${intent.lang}]`) ||
      rawAlbum.includes(`(${intent.lang})`)
    );
    if (isStrictLangMatch) {
      score += 60; // Strong reward for requested language
    } else if (isOmChapter1Song) {
      // OM Chapter 1, but dubbed in Telugu/Hindi/etc.
      score -= 30; // Deprioritize so Tamil version always ranks above dubs!
    } else {
      score -= 150; // Heavy penalty for language mismatch when explicit language was specified!
    }
  } else {
    if (rawLang === intent.lang) {
      score += 25;
    }
  }

  // 6. Recency Boost
  if (intent.isLatestOrTrending || intent.year === '2026') {
    if (songYear === 2026) score += 60;
    else if (songYear === 2025) score += 35;
    else if (songYear === 2024) score += 15;
    else if (songYear > 0 && songYear < 2020) score -= 30; // Deprioritize older songs for "new" query
  } else if (intent.year) {
    const targetYr = parseInt(intent.year, 10);
    if (songYear === targetYr) score += 70;
    else score -= Math.min(50, Math.abs(songYear - targetYr) * 10);
  } else if (intent.decade) {
    // Decade boost
    if (intent.decade === '80s' && songYear >= 1980 && songYear <= 1989) score += 60;
    if (intent.decade === '90s' && songYear >= 1990 && songYear <= 1999) score += 60;
    if (intent.decade === '2000s' && songYear >= 2000 && songYear <= 2009) score += 60;
    if (intent.decade === '70s' && songYear >= 1970 && songYear <= 1979) score += 60;
  } else {
    // Default small recency tiebreaker
    if (songYear >= 2024) score += 15;
    else if (songYear >= 2020) score += 10;
  }

  // 7. Noise Penalties (Devotional, Karaoke, Covers, Slowed/Reverb)
  const isDevotionalSong = /\b(devotional|bhakti|bhajan|bakthi|suprabhatam|chanting|slokas?|namavali|om namo|om namashivaya|sahasranamam|gayatri|aarti|stotram)\b/i.test(rawTitle + ' ' + rawAlbum);
  // OM Chapter 1 movie songs should NEVER be flagged as devotional, even if album has "om"
  const isOmChapter1Album = rawAlbum.includes('udhiram') || rawAlbum.includes('blood wood') || rawAlbum.includes('om chapter');
  if (isDevotionalSong && !intent.isDevotionalExplicit && !isOmChapter1Album) {
    score -= 120; // Severe penalty unless user searched for devotional
  }

  const isKaraokeSong = /\b(karaoke|instrumental|minus\s*one|backing\s*track)\b/i.test(rawTitle + ' ' + rawAlbum);
  if (isKaraokeSong && !intent.isKaraokeExplicit) {
    score -= 80;
  }

  const isRemixSong = /\b(remix|dj\s*remix|club\s*mix|mashup|dhol\s*mix)\b/i.test(rawTitle);
  if (isRemixSong && !intent.isRemixExplicit) {
    score -= 40;
  }

  const isLoFiOrCover = /\b(slowed|reverb|lofi|lo-fi|8d|cover|acoustic|unplugged)\b/i.test(rawTitle);
  if (isLoFiOrCover && !/\b(slowed|reverb|lofi|cover|acoustic)\b/i.test(intent.rawQuery)) {
    score -= 30;
  }

  return score;
}

// ── 5. SAAVN API CLIENT WITH RETRIES & DECRYPT ──
function requestSaavn(query) {
  return new Promise((resolve) => {
    https.get('https://www.jiosaavn.com/api.php?' + query, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const clean = data.trim().replace(/^<!--.*?-->/, '').replace(/<!--.*?-->$/, '');
          resolve(JSON.parse(clean));
        } catch(e) {
          resolve({});
        }
      });
    }).on('error', () => resolve({}));
  });
}

function decodeHtml(html) {
  if (!html) return '';
  return html.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

// ── 6. DEDUPLICATION & SECTION GROUPING (Step E) ──
function deduplicateAndGroup(rawCandidates, intent) {
  const seenNormTitles = new Map();
  const idMap = new Map();

  // Score all candidates & keep higher score when duplicate IDs are present
  for (const s of rawCandidates) {
    if (!s || !s.id || !s.playUrl) continue;
    const score = s._pinnedScore !== undefined
      ? s._pinnedScore
      : computeSongRelevanceScore(s, intent);

    if (idMap.has(s.id)) {
      const existing = idMap.get(s.id);
      if (score > existing.score) {
        idMap.set(s.id, { ...s, score });
      }
    } else {
      idMap.set(s.id, { ...s, score });
    }
  }

  const scored = Array.from(idMap.values());

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  const cleanSongs = [];
  const noiseSongs = [];

  for (const s of scored) {
    const norm = normalizeTitle(s.title);
    // If we've seen this exact normalized title with a much higher score, skip or demote
    if (seenNormTitles.has(norm)) {
      const existing = seenNormTitles.get(norm);
      if (existing.score > s.score + 10) {
        // Duplicate version of an already selected song
        continue;
      }
    } else {
      seenNormTitles.set(norm, s);
    }

    if (s.score < 0) {
      // Noise tracks (devotional when not asked, karaoke, or language mismatch)
      noiseSongs.push(s);
    } else {
      cleanSongs.push(s);
    }
  }

  // Top result: the absolute best match
  const topMatch = cleanSongs.length > 0 ? cleanSongs[0] : null;

  // Extract distinct albums
  const seenAlbumNames = new Set();
  const albums = [];
  for (const s of cleanSongs) {
    if (s.album && !seenAlbumNames.has(s.album)) {
      seenAlbumNames.add(s.album);
      albums.push({
        id: s.id,
        title: s.album,
        artist: s.artist,
        year: s.year,
        image: s.image,
        language: s.language
      });
      if (albums.length >= 8) break;
    }
  }

  return {
    topMatch,
    songs: cleanSongs,
    albums,
    noise: noiseSongs
  };
}

module.exports = {
  transliterateTamil,
  applySearchCorrections,
  stripTamilSuffixes,
  phoneticNormalize,
  normalizeTitle,
  normalizeMovieTitle,
  doesMovieAlbumMatch,
  levenshteinDistance,
  stringSimilarity,
  detectLanguage,
  detectYear,
  detectDecade,
  parseSearchIntent,
  computeSongRelevanceScore,
  deduplicateAndGroup,
  requestSaavn,
  KNOWN_ARTISTS
};
