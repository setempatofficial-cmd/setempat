// lib/signal-extractor.js

// ============================================
// JENIS SIGNAL & KEYWORD
// ============================================
const SIGNAL_TYPES = {
  // DARURAT (prioritas tertinggi)
  kecelakaan: {
    keywords: ['kecelakaan', 'tabrakan', 'laka', 'tumburan', 'jatuh', 'tertabrak'],
    template: '⚠️ {lokasi}: kecelakaan',
    icon: '⚠️',
    priority: 1,
    isUrgent: true,
  },
  macet: {
    keywords: ['macet', 'padat', 'merayap', 'antre', 'stop and go', 'lalu lintas'],
    template: '🚗 {lokasi}: kemacetan',
    icon: '🚗',
    priority: 1,
    isUrgent: true,
  },
  banjir: {
    keywords: ['banjir', 'genangan', 'rendam', 'air naik', 'luapan', 'sungai meluap'],
    template: '🌊 {lokasi}: banjir',
    icon: '🌊',
    priority: 1,
    isUrgent: true,
  },
  longsor: {
    keywords: ['longsor', 'tanah bergerak', 'ambar', 'tebing', 'batu jatuh'],
    template: '⛰️ {lokasi}: longsor',
    icon: '⛰️',
    priority: 1,
    isUrgent: true,
  },
  kebakaran: {
    keywords: ['kebakaran', 'api', 'terbakar', 'pulung'],
    template: '🔥 {lokasi}: kebakaran',
    icon: '🔥',
    priority: 1,
    isUrgent: true,
  },

  // KERAMAIAN (prioritas sedang)
  ramai: {
    keywords: ['ramai', 'padat pengunjung', 'antre panjang', 'penuh sesak', 'membludak'],
    template: '👥 {lokasi}: ramai',
    icon: '👥',
    priority: 2,
    isUrgent: false,
  },
  sepi: {
    keywords: ['sepi', 'lengang', 'kosong', 'sunyi', 'tak ada pengunjung'],
    template: '🍃 {lokasi}: sepi',
    icon: '🍃',
    priority: 2,
    isUrgent: false,
  },

  // EVENT & ACARA (prioritas sedang)
  event: {
    keywords: ['festival', 'event', 'acara', 'perayaan', 'resepsi', 'pesta', 
               'lomba', 'kompetisi', 'pameran', 'bazar', 'pentas', 'pertunjukan',
               'karnaval', 'arak-arakan', 'tradisi', 'upacara'],
    template: '📅 {lokasi}: {deskripsi}',
    icon: '📅',
    priority: 2,
    isUrgent: false,
  },

  // KUNJUNGAN (prioritas sedang)
  kunjungan: {
    keywords: ['kunjungan', 'dikunjungi', 'datang ke', 'meninjau', 'menyambangi',
               'kunker', 'kunjungan kerja', 'silaturahmi', 'hadiri', 'menghadiri'],
    template: '🏛️ {lokasi}: {deskripsi}',
    icon: '🏛️',
    priority: 2,
    isUrgent: false,
  },

  // LAYANAN PUBLIK (prioritas rendah)
  layanan: {
    keywords: ['vaksinasi', 'imunisasi', 'sunat massal', 'pengobatan gratis',
               'posyandu', 'puskesmas', 'kesehatan', 'cek kesehatan'],
    template: '💉 {lokasi}: {deskripsi}',
    icon: '💉',
    priority: 3,
    isUrgent: false,
  },

  // SOSIAL & KOMUNITAS (prioritas rendah)
  sosial: {
    keywords: ['kerja bakti', 'gotong royong', 'donor darah', 'pengajian',
               'arisan', 'ronda', 'siskamling', 'poskamling'],
    template: '🧹 {lokasi}: {deskripsi}',
    icon: '🧹',
    priority: 3,
    isUrgent: false,
  },

  // EKONOMI (prioritas rendah)
  ekonomi: {
    keywords: ['harga turun', 'harga naik', 'sembako murah', 'diskon', 'obral',
               'pasar murah', 'gerakan pangan'],
    template: '💰 {lokasi}: {deskripsi}',
    icon: '💰',
    priority: 3,
    isUrgent: false,
  },

  // HIBURAN & KEBUDAYAAN (prioritas rendah)
  hiburan: {
    keywords: ['wayang', 'ketoprak', 'reog', 'jaranan', 'tari', 'musik',
               'konser', 'pentas seni', 'budaya', 'kesenian'],
    template: '🎭 {lokasi}: {deskripsi}',
    icon: '🎭',
    priority: 3,
    isUrgent: false,
  },
};

// Lokasi prioritas (Pasuruan Raya)
const LOCATIONS = [
  // Kecamatan
  'Bangil', 'Gempol', 'Pandaan', 'Purwosari', 'Rembang', 'Kraton', 'Beji',
  'Wonorejo', 'Tosari', 'Lumbang', 'Rejoso', 'Winongan', 'Grati', 'Nguling', 'Lekok',
  'Kecamatan Prigen', 'Kecamatan Pandaan', 'Kecamatan Bangil',
  
  // Tempat terkenal
  'Pasar Bangil', 'Alun-alun Bangil', 'Kantor Kecamatan Bangil', 'Jalan Raya Bangil',
  'Terminal Bangil', 'Stasiun Bangil', 'Pasar Gempol', 'Pasar Pandaan',
  
  // Desa-desa
  'Sedaeng', 'Pasrepan', 'Tiris', 'Suwayuwo', 'Kedungcangkring',
];

// Kata kunci yang menunjukkan ini adalah "berita biasa" (bukan signal)
const EXCLUDE_KEYWORDS = [
  'profil', 'sejarah', 'wawancara', 'opini', 'editorial',
  'tips', 'cara', 'tutorial', 'resep', 'review produk',
  'jadwal', 'info jadwal', 'lowongan kerja', 'rekrutmen',
];

/**
 * Ekstrak deskripsi singkat dari teks
 */
function extractDescription(text, maxLength = 60) {
  // Ambil kalimat pertama atau potong sampai maxLength
  const firstSentence = text.split(/[.!?]/)[0];
  if (firstSentence.length <= maxLength) return firstSentence;
  return firstSentence.substring(0, maxLength) + '...';
}

/**
 * Deteksi lokasi dari teks
 */
function extractLocation(text) {
  const normalizedText = text.toLowerCase();
  
  // Cari match terpanjang (prioritas)
  let bestMatch = null;
  let bestLength = 0;
  
  for (const loc of LOCATIONS) {
    const locLower = loc.toLowerCase();
    if (normalizedText.includes(locLower) && locLower.length > bestLength) {
      bestMatch = loc;
      bestLength = locLower.length;
    }
  }
  
  return bestMatch;
}

/**
 * Deteksi jenis signal dari teks
 */
function detectSignalType(text) {
  const normalizedText = text.toLowerCase();
  let bestMatch = null;
  let bestPriority = 999;
  
  for (const [type, config] of Object.entries(SIGNAL_TYPES)) {
    for (const keyword of config.keywords) {
      if (normalizedText.includes(keyword.toLowerCase())) {
        if (config.priority < bestPriority) {
          bestPriority = config.priority;
          bestMatch = { type, ...config };
        }
        break;
      }
    }
  }
  
  return bestMatch;
}

/**
 * Cek apakah ini berita biasa (bukan signal)
 */
function isNewsOnly(text) {
  const normalizedText = text.toLowerCase();
  
  for (const kw of EXCLUDE_KEYWORDS) {
    if (normalizedText.includes(kw)) {
      return true;
    }
  }
  
  // Berita yang terlalu pendek (< 30 karakter) mungkin hanya judul
  if (text.length < 30) return false;
  
  return false;
}

/**
 * Generate signal text
 */
function generateSignalText(signalType, location, originalText) {
  const config = SIGNAL_TYPES[signalType];
  if (!config) return null;
  
  let signalText = config.template;
  
  // Ganti {lokasi}
  signalText = signalText.replace('{lokasi}', location);
  
  // Ganti {deskripsi} jika ada
  if (signalText.includes('{deskripsi}')) {
    const description = extractDescription(originalText, 40);
    signalText = signalText.replace('{deskripsi}', description);
  }
  
  // Tambahkan icon
  return `${config.icon} ${signalText}`;
}

/**
 * MAIN FUNCTION: Ekstrak signal dari teks berita
 */
export function extractSignalFromText(title, content = '') {
  const fullText = (title + ' ' + (content || '')).trim();
  
  if (!fullText) return null;
  
  // 1. Skip berita biasa (bukan signal)
  if (isNewsOnly(fullText)) {
    console.log(`📰 Skip (berita biasa): ${title.substring(0, 50)}...`);
    return null;
  }
  
  // 2. Deteksi lokasi
  const location = extractLocation(fullText);
  if (!location) {
    console.log(`📍 Skip (lokasi tidak dikenali): ${title.substring(0, 50)}...`);
    return null; // Tidak relevan dengan Pasuruan
  }
  
  // 3. Deteksi jenis signal
  const signalType = detectSignalType(fullText);
  if (!signalType) {
    console.log(`⏭️ Skip (bukan signal yang dikenali): ${title.substring(0, 50)}...`);
    return null;
  }
  
  // 4. Generate signal pendek
  const signalText = generateSignalText(signalType.type, location, fullText);
  
  return {
    location,
    signalType: signalType.type,
    signalText,
    originalTitle: title,
    confidence: signalType.priority === 1 ? 0.9 : 0.7,
    isUrgent: signalType.isUrgent,
    priority: signalType.priority,
    icon: signalType.icon,
  };
}

/**
 * Batch extract untuk banyak artikel
 */
export function extractSignalsFromArticles(articles) {
  const signals = [];
  
  for (const article of articles) {
    const signal = extractSignalFromText(article.title, article.content);
    if (signal) {
      signals.push({
        ...signal,
        url: article.url,
        source: article.source,
      });
    }
  }
  
  return signals;
}