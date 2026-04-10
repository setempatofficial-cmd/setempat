// lib/headlineEngine.js
// Hybrid Headline Engine - Rule-based + AI Groq (Optimized)
// Versi: Realistis, tidak lebay, berdasarkan data aktual
// UPDATE: 
// 1. Menambahkan filter freshness untuk semua tipe kejadian
// 2. Menambahkan kategori KHUSUS JALAN dengan logika berbeda

// ============================================
// KONFIGURASI FRESHNESS (jam)
// ============================================
const FRESHNESS_CONFIG = {
  hujan: 3,           // Hujan semalam tidak relevan pagi
  macet: 1,           // Lalu lintas cepat berubah
  antrian: 2,         // Antrian bisa berubah dalam 1-2 jam
  laporan_warga: 2,   // Laporan warga cepat basi
  event: 12,          // Event bisa seharian
  official: 6,        // Update official relevan 6 jam
  viral: 24,          // Viral masih menarik sehari
};

// Template library (rule-based fallback)
const TEMPLATES = {
  event: [
    "🎉 Ada {event} di {nama}",
    "Hari ini {nama} ada {event}",
    "Warga memadati {nama} untuk {event}"
  ],
  
  viral: [
    "🔥 {nama} lagi ramai diperbincangkan",
    "Hits! {nama} jadi favorit warga",
    "Warga berbondong ke {nama}"
  ],
  
  official: [
    "📢 Info dari pengelola {nama}",
    "Kabar resmi: {update}",
    "Update dari {nama}"
  ],
  
  hujan: [
    "🌧️ Hujan turun di {nama}",
    "Neduh dulu, hujan di {nama}",
    "Rintik hujan di {nama}"
  ],
  
  antrian: [
    "⏳ Antrian di {nama}",
    "Warga mengantre di {nama}",
    "Antrean mengular di {nama}"
  ],
  
  antrian_dengan_waktu: [
    "⏳ Antrian {estimasi} menit di {nama}",
    "Ngantri {estimasi} menit di {nama}",
    "Antrean sekitar {estimasi} menit"
  ],
  
  ramai: [
    "🏃 {nama} ramai pengunjung",
    "👥 Suasana ramai di {nama}",
    "📍 {nama} dipadati warga"
  ],
  
  mulai_ramai: [
    "👥 {nama} mulai ramai",
    "📍 {nama} mulai dipadati",
    "🏃 Suasana hangat di {nama}"
  ],
  
  sepi: [
    "🍃 {nama} sepi pengunjung",
    "📍 Suasana tenang di {nama}",
    "🌿 {nama} lengang"
  ],
  
  macet: [
    "🚗 Macet di sekitar {nama}",
    "Kemacetan di {nama}",
    "Padat merayap di {nama}"
  ],
  
  netral: [
    "📍 Belum ada laporan dari {nama}",
    "🔍 {nama} belum terpantau",
    "📢 Belum ada update dari {nama}"
  ],
  
  normal: [
    "📍 {nama} dalam kondisi normal",
    "📢 {nama} beroperasi normal",
    "🔍 {nama} kondisinya biasa"
  ]
};

// ============================================
// TEMPLATE KHUSUS KATEGORI (DENGAN JALAN)
// ============================================

const CATEGORY_TEMPLATES = {
  masjid: {
    pagi: "🕌 Suasana subuh di {nama}",
    siang: "🕌 Waktu dzuhur di {nama}",
    sore: "🕌 Waktu ashar di {nama}",
    malam: "🕌 Waktu isya di {nama}",
    ramai: "🕌 {nama} dipenuhi jamaah",
    sepi: "🍃 {nama} tenang"
  },
  puskesmas: {
    pagi: "🏥 Pagi di {nama}",
    siang: "🏥 Siang di {nama}",
    sore: "🏥 Sore di {nama}",
    malam: "🏥 Malam di {nama}",
    ramai: "🏥 {nama} ramai pengunjung",
    sepi: "🍃 {nama} sepi"
  },
  sekolah: {
    pagi: "📚 Pagi di {nama}",
    siang: "📚 Siang di {nama}",
    sore: "📚 Sore di {nama}",
    malam: "📚 Malam di {nama}",
    ramai: "📚 {nama} ramai siswa",
    sepi: "🍃 {nama} sepi"
  },
  industri: {
    pagi: "🏭 Pagi di {nama}",
    siang: "🏭 Siang di {nama}",
    sore: "🏭 Sore di {nama}",
    malam: "🏭 Malam di {nama}",
    ramai: "🏭 {nama} ramai aktivitas",
    sepi: "🍃 {nama} sepi"
  },
  jalan: {
    pagi: "🌅 Lalu lintas pagi di {nama}",
    siang: "☀️ Lalu lintas siang di {nama}",
    sore: "🌆 Lalu lintas sore di {nama}",
    malam: "🌙 Lalu lintas malam di {nama}",
    macet: "🚗 Macet di {nama}",
    padat: "🚗 Lalu lintas padat di {nama}",
    lancar: "🚗 Lalu lintas lancar di {nama}",
    sepi_kendaraan: "🍃 Jalan {nama} sepi kendaraan"
  }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function getPlaceCategory(item) {
  const name = item.name?.toLowerCase() || '';
  const category = item.category?.toLowerCase() || '';
  
  // PRIORITAS TERTINGGI: JALAN
  if (category.includes('jalan') || name.includes('jalan') || 
      category.includes('road') || name.includes('road') ||
      category.includes('ruas') || name.includes('ruas') ||
      category.includes('tol') || name.includes('tol')) {
    return 'jalan';
  }
  
  if (category.includes('masjid') || name.includes('masjid')) return 'masjid';
  if (category.includes('puskesmas') || name.includes('puskesmas')) return 'puskesmas';
  if (category.includes('sekolah') || name.includes('sd') || name.includes('smp') || name.includes('sma')) return 'sekolah';
  if (name.includes('pabrik') || name.includes('pt ') || category.includes('industri')) return 'industri';
  return null;
}

function getCategoryIcon(category) {
  const icons = { masjid: '🕌', puskesmas: '🏥', sekolah: '📚', industri: '🏭', jalan: '🚗' };
  return icons[category] || '📍';
}

/**
 * Cek apakah timestamp masih fresh (dalam maxHours terakhir)
 */
function isTimestampFresh(timestamp, maxHours) {
  if (!timestamp) return false;
  const cutoff = new Date(Date.now() - maxHours * 60 * 60 * 1000);
  return new Date(timestamp) > cutoff;
}

/**
 * Cek signal dengan filter freshness
 */
function checkFreshSignal(signals, pattern, maxHours, field = null) {
  if (!signals || signals.length === 0) return false;
  
  return signals.some(s => {
    let text = '';
    if (field) {
      text = s[field] || '';
    } else {
      text = s.text || s.deskripsi || '';
    }
    const isMatch = pattern.test(text);
    return isMatch && isTimestampFresh(s.created_at, maxHours);
  });
}

/**
 * Ambil signal fresh pertama yang match pattern
 */
function getFirstFreshSignal(signals, pattern, maxHours, field = null) {
  if (!signals || signals.length === 0) return null;
  
  return signals.find(s => {
    let text = '';
    if (field) {
      text = s[field] || '';
    } else {
      text = s.text || s.deskripsi || '';
    }
    const isMatch = pattern.test(text);
    return isMatch && isTimestampFresh(s.created_at, maxHours);
  });
}

function getDeterministicTemplate(templates, seed) {
  if (!templates || templates.length === 0) return "";
  const index = Math.abs(hashCode(seed)) % templates.length;
  return templates[index];
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash;
}

function detectEvent(signals) {
  const eventKeywords = [
    { kata: 'car free day', event: 'Car Free Day' },
    { kata: 'cfd', event: 'Car Free Day' },
    { kata: 'pasar malam', event: 'Pasar Malam' },
    { kata: 'festival', event: 'Festival' },
    { kata: 'konser', event: 'Konser' },
    { kata: 'pengajian', event: 'Pengajian' },
    { kata: 'lomba', event: 'Lomba' },
    { kata: 'bazar', event: 'Bazar' }
  ];
  
  for (const signal of signals) {
    const text = signal.text?.toLowerCase() || signal.deskripsi?.toLowerCase() || '';
    for (const kw of eventKeywords) {
      if (text.includes(kw.kata)) return kw.event;
    }
  }
  return null;
}

function getWaktuSekarang() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return { nama: 'pagi', icon: '🌅' };
  if (hour >= 11 && hour < 15) return { nama: 'siang', icon: '☀️' };
  if (hour >= 15 && hour < 19) return { nama: 'sore', icon: '🌆' };
  return { nama: 'malam', icon: '🌙' };
}

// ============================================
// CORE HEADLINE GENERATOR - REALISTIS
// ============================================

export function generateHeadlineSync({ item, estimasiOrang, antrian, externalSignals = [], allSignals = [] }) {
  const nama = item.name || item.nama || "tempat ini";
  const waktu = getWaktuSekarang();
  const estimasiWaitTime = item.latest_estimated_wait_time || null;
  const seed = `${item.id}_${item.updated_at || item.created_at || Date.now()}`;
  
  // ============================================
  // PRIORITAS 1: Laporan warga terbaru (2 jam)
  // ============================================
  const recentWargaReport = item.recentWargaLaporan;
  if (recentWargaReport && item.hasRecentWargaReport) {
    if (isTimestampFresh(recentWargaReport.created_at, FRESHNESS_CONFIG.laporan_warga)) {
      let text = recentWargaReport.deskripsi || recentWargaReport.content || "";
      if (text.length > 55) text = text.substring(0, 52) + "...";
      if (text) {
        let icon = '🗣️';
        if (recentWargaReport.tipe === 'Sepi') icon = '🍃';
        else if (recentWargaReport.tipe === 'Ramai') icon = '🏃';
        else if (recentWargaReport.tipe === 'Antri') icon = '⏳';
        else if (recentWargaReport.traffic_condition === 'Macet') icon = '🚗';
        return { text, type: 'laporan_warga', icon };
      }
    }
  }
  
  // ============================================
  // PRIORITAS 2: Laporan fresh dari allSignals (2 jam)
  // ============================================
  const freshLaporan = getFirstFreshSignal(
    allSignals, 
    /.*/, 
    FRESHNESS_CONFIG.laporan_warga,
    null
  );
  if (freshLaporan) {
    let text = freshLaporan.deskripsi || freshLaporan.text;
    if (text.length > 50) text = text.substring(0, 47) + "...";
    let icon = '🗣️';
    if (freshLaporan.tipe === 'Sepi') icon = '🍃';
    else if (freshLaporan.tipe === 'Ramai') icon = '🏃';
    else if (freshLaporan.tipe === 'Antri') icon = '⏳';
    return { text, type: 'laporan_warga', icon };
  }
  
  // ============================================
  // PRIORITAS 3: Event (12 jam)
  // ============================================
  const eventDetected = detectEvent(allSignals);
  if (eventDetected) {
    const template = getDeterministicTemplate(TEMPLATES.event, `${seed}_event`);
    return { text: template.replace('{nama}', nama).replace('{event}', eventDetected), type: 'event', icon: '🎉' };
  }
  
  // ============================================
  // PRIORITAS 4: Viral (24 jam)
  // ============================================
  const hasViralSignal = externalSignals.some(s => {
    const isViral = (s.likes_count > 100) || (s.comments_count > 20);
    return isViral && isTimestampFresh(s.created_at, FRESHNESS_CONFIG.viral);
  });
  if (hasViralSignal) {
    const template = getDeterministicTemplate(TEMPLATES.viral, `${seed}_viral`);
    return { text: template.replace('{nama}', nama), type: 'viral', icon: '🔥' };
  }
  
  // ============================================
  // PRIORITAS 5: Official update (6 jam)
  // ============================================
  const officialSignal = externalSignals.find(s => {
    const isOfficial = (s.source_tier <= 2 && s.content);
    return isOfficial && isTimestampFresh(s.created_at, FRESHNESS_CONFIG.official);
  });
  if (officialSignal) {
    const template = getDeterministicTemplate(TEMPLATES.official, `${seed}_official`);
    const update = officialSignal.content.substring(0, 40) + (officialSignal.content.length > 40 ? "..." : "");
    return { text: template.replace('{nama}', nama).replace('{update}', update), type: 'official', icon: '📢' };
  }
  
  // ============================================
  // PRIORITAS 6: Hujan (3 jam) - DENGAN FILTER
  // ============================================
  const hujanFresh = checkFreshSignal(
    allSignals,
    /hujan|gerimis|hujan rintik|hujan deras/i,
    FRESHNESS_CONFIG.hujan
  );
  if (hujanFresh) {
    const template = getDeterministicTemplate(TEMPLATES.hujan, `${seed}_hujan`);
    return { text: template.replace('{nama}', nama), type: 'hujan', icon: '🌧️' };
  }
  
  // ============================================
  // PRIORITAS 7: Antrian (2 jam)
  // ============================================
  const antrianFresh = antrian && isTimestampFresh(antrian.created_at, FRESHNESS_CONFIG.antrian);
  if (antrianFresh && estimasiWaitTime) {
    const template = getDeterministicTemplate(TEMPLATES.antrian_dengan_waktu, `${seed}_antrian_waktu`);
    return { text: template.replace('{estimasi}', estimasiWaitTime).replace('{nama}', nama), type: 'antrian', icon: '⏳' };
  }
  if (antrianFresh) {
    const template = getDeterministicTemplate(TEMPLATES.antrian, `${seed}_antrian`);
    return { text: template.replace('{nama}', nama), type: 'antrian', icon: '⏳' };
  }
  
  // ============================================
  // PRIORITAS 8: Macet (1 jam) - DENGAN FILTER
  // ============================================
  const macetFresh = checkFreshSignal(
    allSignals,
    /macet|padat|merayap|tersendat|lalu lintas|volume tinggi/i,
    FRESHNESS_CONFIG.macet
  );
  const isJalan = getPlaceCategory(item) === 'jalan';
  
  if (macetFresh && isJalan) {
    const template = getDeterministicTemplate(CATEGORY_TEMPLATES.jalan.macet, `${seed}_jalan_macet`);
    return { text: template.replace('{nama}', nama), type: 'jalan_macet', icon: '🚗' };
  }
  
  // Macet untuk non-jalan (lebih jarang)
  if (macetFresh && !isJalan) {
    const template = getDeterministicTemplate(TEMPLATES.macet, `${seed}_macet`);
    return { text: template.replace('{nama}', nama), type: 'macet', icon: '🚗' };
  }
  
  // ============================================
  // PRIORITAS 9: KHUSUS JALAN (logika berbeda)
  // ============================================
  const placeCategory = getPlaceCategory(item);
  
  if (placeCategory === 'jalan') {
    const estimasiVolume = estimasiOrang || 0;
    
    // Jika ada data volume kendaraan
    if (estimasiVolume > 40) {
      return { 
        text: CATEGORY_TEMPLATES.jalan.padat.replace('{nama}', nama), 
        type: 'jalan_padat', 
        icon: '🚗' 
      };
    }
    
    if (estimasiVolume > 0 && estimasiVolume <= 40) {
      return { 
        text: CATEGORY_TEMPLATES.jalan.lancar.replace('{nama}', nama), 
        type: 'jalan_lancar', 
        icon: '🚗' 
      };
    }
    
    // Jika tidak ada data volume, gunakan template berdasarkan waktu
    if (CATEGORY_TEMPLATES.jalan[waktu.nama]) {
      return { 
        text: CATEGORY_TEMPLATES.jalan[waktu.nama].replace('{nama}', nama), 
        type: `jalan_${waktu.nama}`, 
        icon: '🚗' 
      };
    }
    
    // Fallback untuk jalan
    return { 
      text: `🚗 Kondisi {nama} normal`, 
      type: 'jalan_normal', 
      icon: '🚗' 
    };
  }
  
  // ============================================
  // PRIORITAS 10: Kategori spesifik (masjid, puskesmas, dll)
  // ============================================
  if (placeCategory && CATEGORY_TEMPLATES[placeCategory]) {
    const categoryTemplates = CATEGORY_TEMPLATES[placeCategory];
    const estimasiAngka = estimasiOrang || 0;
    const isRamai = estimasiAngka > 12;
    const isSepi = estimasiAngka > 0 && estimasiAngka <= 6;
    
    if (isRamai && categoryTemplates.ramai) {
      return { text: categoryTemplates.ramai.replace('{nama}', nama), type: `${placeCategory}_ramai`, icon: getCategoryIcon(placeCategory) };
    }
    if (isSepi && categoryTemplates.sepi) {
      return { text: categoryTemplates.sepi.replace('{nama}', nama), type: `${placeCategory}_sepi`, icon: getCategoryIcon(placeCategory) };
    }
    if (categoryTemplates[waktu.nama]) {
      return { text: categoryTemplates[waktu.nama].replace('{nama}', nama), type: `${placeCategory}_${waktu.nama}`, icon: getCategoryIcon(placeCategory) };
    }
  }
  
  // ============================================
  // PRIORITAS 11: Berdasarkan estimasi orang
  // ============================================
  const estimasiAngka = estimasiOrang || 0;
  const hasAnyLaporan = allSignals.length > 0 || estimasiAngka > 0;
  
  if (!hasAnyLaporan) {
    const template = getDeterministicTemplate(TEMPLATES.netral, `${seed}_netral`);
    return { text: template.replace('{nama}', nama), type: 'netral', icon: '📍' };
  }
  
  if (estimasiAngka > 12) {
    const template = getDeterministicTemplate(TEMPLATES.ramai, `${seed}_ramai`);
    return { text: template.replace('{nama}', nama), type: 'ramai', icon: '🏃' };
  }
  
  if (estimasiAngka > 6 && estimasiAngka <= 12) {
    const template = getDeterministicTemplate(TEMPLATES.mulai_ramai, `${seed}_mulai_ramai`);
    return { text: template.replace('{nama}', nama), type: 'mulai_ramai', icon: '👥' };
  }
  
  if (estimasiAngka > 0 && estimasiAngka <= 6) {
    const template = getDeterministicTemplate(TEMPLATES.sepi, `${seed}_sepi`);
    return { text: template.replace('{nama}', nama), type: 'sepi', icon: '🍃' };
  }
  
  // ============================================
  // FALLBACK TERAKHIR: Normal
  // ============================================
  const template = getDeterministicTemplate(TEMPLATES.normal, `${seed}_normal`);
  return { text: template.replace('{nama}', nama), type: 'normal', icon: '📍' };
}

// ============================================
// HYBRID AI ENGINE (Opsional)
// ============================================

class HybridHeadlineEngine {
  constructor() {
    this.aiCache = new Map();
    this.lastAICallTimes = [];
    this.pendingRequests = new Map();
    this.MAX_CALLS_PER_MINUTE = 8;
    this.CACHE_TTL = 30 * 60 * 1000;
  }

  shouldUseAI({ estimasiOrang, externalSignals, allSignals }) {
    const estimasiAngka = estimasiOrang || 0;
    if (detectEvent(allSignals)) return true;
    if (estimasiAngka > 50) return true;
    if (estimasiAngka === 0 && estimasiOrang !== null) return true;
    return false;
  }

  canCallAI() {
    const now = Date.now();
    this.lastAICallTimes = this.lastAICallTimes.filter(t => now - t < 60000);
    if (this.lastAICallTimes.length < this.MAX_CALLS_PER_MINUTE) {
      this.lastAICallTimes.push(now);
      return true;
    }
    return false;
  }

  async getHeadline({ item, estimasiOrang, antrian, externalSignals = [], allSignals = [] }) {
    const syncHeadline = generateHeadlineSync({ item, estimasiOrang, antrian, externalSignals, allSignals });
    const needsAI = this.shouldUseAI({ estimasiOrang, externalSignals, allSignals });
    
    if (!needsAI || !this.canCallAI()) return syncHeadline;
    
    try {
      const response = await fetch('/api/groq-headline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item: { id: item.id, name: item.name, category: item.category },
          context: { recentReports: allSignals.slice(0, 3).map(s => s.text || s.deskripsi).filter(Boolean) }
        })
      });
      const data = await response.json();
      return data.headline || syncHeadline;
    } catch {
      return syncHeadline;
    }
  }
}

// ============================================
// EXPORTS
// ============================================

export const headlineEngine = new HybridHeadlineEngine();

export async function getHeadline(props) {
  return headlineEngine.getHeadline(props);
}

export { generateHeadlineSync };

export { generateHeadlineSync as generateHeadline };

export { FRESHNESS_CONFIG };

export default {
  generateHeadline: generateHeadlineSync,
  generateHeadlineSync,
  getHeadline,
  headlineEngine,
  FRESHNESS_CONFIG
};