// lib/headlineEngine.js
// Hybrid Headline Engine - Rule-based + AI Groq (Optimized)
// Versi: Realistis, tidak lebay, berdasarkan data aktual

// Template library (rule-based fallback) - DIPERKECIL dan REALISTIS
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
// TEMPLATE KHUSUS KATEGORI
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
  }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function getPlaceCategory(item) {
  const name = item.name?.toLowerCase() || '';
  const category = item.category?.toLowerCase() || '';
  
  if (category.includes('masjid') || name.includes('masjid')) return 'masjid';
  if (category.includes('puskesmas') || name.includes('puskesmas')) return 'puskesmas';
  if (category.includes('sekolah') || name.includes('sd') || name.includes('smp') || name.includes('sma')) return 'sekolah';
  if (name.includes('pabrik') || name.includes('pt ') || category.includes('industri')) return 'industri';
  return null;
}

function getCategoryIcon(category) {
  const icons = { masjid: '🕌', puskesmas: '🏥', sekolah: '📚', industri: '🏭' };
  return icons[category] || '📍';
}

function isTimestampFresh(timestamp, maxHours) {
  if (!timestamp) return false;
  const cutoff = new Date(Date.now() - maxHours * 60 * 60 * 1000);
  return new Date(timestamp) > cutoff;
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

function getDayInfo() {
  const day = new Date().getDay();
  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  return { isWeekend: day === 0 || day === 6, dayName: dayNames[day] };
}

// ============================================
// CORE HEADLINE GENERATOR - REALISTIS
// ============================================

export function generateHeadlineSync({ item, estimasiOrang, antrian, externalSignals = [], allSignals = [] }) {
  const nama = item.name || item.nama || "tempat ini";
  const waktu = getWaktuSekarang();
  const estimasiWaitTime = item.latest_estimated_wait_time || null;
  const seed = `${item.id}_${item.updated_at || item.created_at || Date.now()}`;
  
  // PRIORITAS 1: Laporan warga terbaru (2 jam)
  const recentWargaReport = item.recentWargaLaporan;
  if (recentWargaReport && item.hasRecentWargaReport) {
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
  
  // PRIORITAS 2: Laporan fresh dari allSignals
  const freshLaporan = allSignals.find(s => 
    (s.deskripsi || s.text) && isTimestampFresh(s.created_at, 2)
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
  
  // PRIORITAS 3: Event
  const eventDetected = detectEvent(allSignals);
  if (eventDetected) {
    const template = getDeterministicTemplate(TEMPLATES.event, `${seed}_event`);
    return { text: template.replace('{nama}', nama).replace('{event}', eventDetected), type: 'event', icon: '🎉' };
  }
  
  // PRIORITAS 4: Viral
  const hasViralSignal = externalSignals.some(s => (s.likes_count > 100) || (s.comments_count > 20));
  if (hasViralSignal) {
    const template = getDeterministicTemplate(TEMPLATES.viral, `${seed}_viral`);
    return { text: template.replace('{nama}', nama), type: 'viral', icon: '🔥' };
  }
  
  // PRIORITAS 5: Official update
  const officialSignal = externalSignals.find(s => s.source_tier <= 2 && s.content);
  if (officialSignal) {
    const template = getDeterministicTemplate(TEMPLATES.official, `${seed}_official`);
    const update = officialSignal.content.substring(0, 40) + (officialSignal.content.length > 40 ? "..." : "");
    return { text: template.replace('{nama}', nama).replace('{update}', update), type: 'official', icon: '📢' };
  }
  
  // PRIORITAS 6: Hujan
  const isHujan = allSignals.some(s => /hujan|gerimis/i.test(s.text || s.deskripsi || ''));
  if (isHujan) {
    const template = getDeterministicTemplate(TEMPLATES.hujan, `${seed}_hujan`);
    return { text: template.replace('{nama}', nama), type: 'hujan', icon: '🌧️' };
  }
  
  // PRIORITAS 7: Antrian
  const antrianFresh = antrian && isTimestampFresh(antrian.created_at, 2);
  if (antrianFresh && estimasiWaitTime) {
    const template = getDeterministicTemplate(TEMPLATES.antrian_dengan_waktu, `${seed}_antrian_waktu`);
    return { text: template.replace('{estimasi}', estimasiWaitTime).replace('{nama}', nama), type: 'antrian', icon: '⏳' };
  }
  if (antrianFresh) {
    const template = getDeterministicTemplate(TEMPLATES.antrian, `${seed}_antrian`);
    return { text: template.replace('{nama}', nama), type: 'antrian', icon: '⏳' };
  }
  
  // PRIORITAS 8: Macet (khusus jalan)
  const isMacet = allSignals.some(s => /macet|padat|merayap/i.test(s.text || s.deskripsi || ''));
  const isJalan = item.category?.toLowerCase().includes('jalan') || item.name?.toLowerCase().includes('jalan');
  if (isMacet && isJalan) {
    const template = getDeterministicTemplate(TEMPLATES.macet, `${seed}_macet`);
    return { text: template.replace('{nama}', nama), type: 'macet', icon: '🚗' };
  }
  
  // PRIORITAS 9: Kategori spesifik
  const placeCategory = getPlaceCategory(item);
  if (placeCategory) {
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
  
  // PRIORITAS 10: Berdasarkan estimasi orang
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
  
  // FALLBACK TERAKHIR: Normal
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
// 🔥 EXPORTS (DIPERBAIKI - TIDAK ADA DUPLIKASI)
// ============================================

export const headlineEngine = new HybridHeadlineEngine();

export async function getHeadline(props) {
  return headlineEngine.getHeadline(props);
}

// Ekspor generateHeadlineSync (fungsi asli)
export { generateHeadlineSync };

// Ekspor generateHeadline sebagai alias dari generateHeadlineSync
export { generateHeadlineSync as generateHeadline };

// Default export
export default {
  generateHeadline: generateHeadlineSync,
  generateHeadlineSync,
  getHeadline,
  headlineEngine
};