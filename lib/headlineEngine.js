// lib/headlineEngine.js
// Hybrid Headline Engine - Rule-based + AI Groq (Optimized)

// Template library (rule-based fallback)
const TEMPLATES = {
  event: [
    "🎉 Ada {event} di {nama}! Warga berbondong-bondong",
    "Hari ini {nama} ada {event}, suasana meriah!",
    "Warga memadati {nama} untuk {event}, rame banget!",
    "{event} seru di {nama}, sayang kalau dilewatkan"
  ],
  
  viral: [
    "🔥 Viral! {nama} jadi perbincangan warga",
    "Hits banget! {nama} lagi naik daun di TikTok",
    "FYP terus! {nama} jadi primadona baru",
    "Warga berbondong ke {nama} setelah viral"
  ],
  
  official: [
    "📢 Info resmi: {update}",
    "Kabar dari pengelola {nama}: {update}",
    "Update resmi: {update}"
  ],
  
  hujan: [
    "🌧️ Hujan turun di {nama}, warga berteduh",
    "Neduh dulu lur, hujan di {nama}",
    "Rintik hujan temani aktivitas di {nama}"
  ],
  
  antrian: [
    "⏳ Antrian panjang di {nama}, siap-siap sabar",
    "Warga mengantre di {nama}, lagi rame nih",
    "Antrean mengular, {nama} lagi jadi favorit"
  ],
  
  antrian_dengan_waktu: [
    "⏳ Antrian {estimasi} menit di {nama}, siap-siap sabar",
    "Ngantri {estimasi} menit nih di {nama}, worth it?",
    "Warga ngantre {estimasi} menit, lagi rame nih"
  ],
  
  ramai: [
    "🏃‍♂️ Suasana meriah! {nama} dipenuhi warga",
    "Meriah! {nama} jadi tempat nongkrong favorit",
    "Warga tumplek blek, {nama} lagi ramai"
  ],
  
  mulai_ramai: [
    "👥 Mulai ramai nih di {nama}",
    "Warga mulai berdatangan ke {nama}",
    "Suasana hangat, {nama} mulai dipadati"
  ],
  
  sepi: [
    "🍃 Lengang di {nama}, cocok buat santai",
    "Suasana tenang di {nama}, tempat masih longgar",
    "Sepi pengunjung, {nama} lagi adem"
  ],
  
  macet: [
    "🚗 Macet parah di {nama}, kendaraan mengular",
    "Kemacetan panjang, hati-hati di {nama}",
    "Padat merayap di {nama}, waspada ya!"
  ],
  
  pagi: [
    "🌅 Pagi cerah di {nama}, warga mulai berdatangan",
    "Semangat pagi dari {nama}, udara segar",
    "Pagi-pagi udah rame di {nama}"
  ],
  
  siang: [
    "☀️ Siang terik, warga berteduh di {nama}",
    "Jam makan siang, {nama} mulai dipadati",
    "Istirahat siang di {nama}, warga membludak"
  ],
  
  sore: [
    "🌆 Sore santai di {nama}, warga mulai nongkrong",
    "Menjelang maghrib di {nama}, suasana hangat",
    "Pulang kerja mampir ke {nama} dulu"
  ],
  
  malam: [
    "🌙 Malam di {nama}",
    "Lampu temaram temani malam di {nama}",
    "Suasana malam di {nama}",
    "✨ Malam di {nama}",
    "🌙 Suasana malam di {nama}"
  ],
  
  kuliner: [
    "🍽️ Enak! {nama} jadi rekomendasi warga",
    "Kuliner hits di {nama}, wajib coba!",
    "Hidden gem! {nama} favorit warga sekitar"
  ],
  
  umum: [
    "📍 Update dari {nama}: {cerita}",
    "Warga sekitar lapor: {cerita}",
    "Pantauan di {nama}: {cerita}"
  ]
};

// ============================================
// TEMPLATE KHUSUS KATEGORI (Masjid, Puskesmas, Sekolah, Industri)
// ============================================

const CATEGORY_TEMPLATES = {
  masjid: {
    pagi: "🕌 Subuh di {nama}, jamaah mulai berdatangan",
    siang: "🕌 Dzuhur di {nama}, jamaah memenuhi saf",
    sore: "🕌 Ashar di {nama}, warga beribadah",
    malam: "🕌 Isya di {nama}, suasana khusyuk",
    ramai: "🕌 {nama} dipenuhi jamaah, waktu sholat berjamaah",
    sepi: "🍃 {nama} tenang, di luar waktu sholat"
  },
  puskesmas: {
    pagi: "🏥 Pagi di {nama}, warga mulai berdatangan",
    siang: "🏥 Siang di {nama}, antrian panjang",
    sore: "🏥 Sore di {nama}, warga mulai berkurang",
    malam: "🏥 Malam di {nama}, layanan darurat",
    ramai: "🏥 {nama} ramai, warga berobat",
    sepi: "🍃 {nama} sepi, sedikit warga berobat"
  },
  sekolah: {
    pagi: "📚 Pagi di {nama}, siswa mulai berdatangan",
    siang: "📚 Siang di {nama}, jam istirahat",
    sore: "📚 Sore di {nama}, kegiatan ekstrakurikuler",
    malam: "📚 Malam di {nama}, sepi dan tenang",
    ramai: "📚 {nama} ramai, jam masuk sekolah",
    sepi: "🍃 {nama} sepi, libur sekolah"
  },
  industri: {
    pagi: "🏭 Pagi di {nama}, aktivitas produksi dimulai",
    siang: "🏭 Siang di {nama}, produksi berjalan",
    sore: "🏭 Sore di {nama}, karyawan pulang",
    malam: "🏭 Malam di {nama}, shift malam beroperasi",
    ramai: "🏭 {nama} ramai, jam operasional puncak",
    sepi: "🍃 {nama} sepi, di luar jam operasional"
  }
};

// Fungsi untuk mendapatkan kategori tempat
function getPlaceCategory(item) {
  const name = item.name?.toLowerCase() || '';
  const category = item.category?.toLowerCase() || '';
  
  if (category.includes('masjid') || name.includes('masjid')) return 'masjid';
  if (category.includes('puskesmas') || name.includes('puskesmas') || name.includes('klinik')) return 'puskesmas';
  if (category.includes('sekolah') || name.includes('sd') || name.includes('smp') || name.includes('sma')) return 'sekolah';
  if (name.includes('pabrik') || name.includes('pt ') || category.includes('industri')) return 'industri';
  
  return null;
}

function getCategoryIcon(category) {
  const icons = {
    masjid: '🕌',
    puskesmas: '🏥',
    sekolah: '📚',
    industri: '🏭'
  };
  return icons[category] || '📍';
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function isFresh(data, maxHours) {
  if (!data) return false;
  const timestamp = data.latest_estimated_at || data.created_at || data.updated_at;
  if (!timestamp) return false;
  const cutoff = new Date(Date.now() - maxHours * 60 * 60 * 1000);
  return new Date(timestamp) > cutoff;
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
    { kata: 'pengajian', event: 'Pengajian Akbar' },
    { kata: 'tabligh', event: 'Tabligh Akbar' },
    { kata: 'lomba', event: 'Lomba' },
    { kata: 'agustusan', event: 'HUT RI' },
    { kata: 'bazar', event: 'Bazar' },
    { kata: 'pentas seni', event: 'Pentas Seni' },
    { kata: 'wayangan', event: 'Wayangan' }
  ];
  
  for (const signal of signals) {
    const text = signal.text?.toLowerCase() || signal.deskripsi?.toLowerCase() || '';
    for (const kw of eventKeywords) {
      if (text.includes(kw.kata)) {
        return kw.event;
      }
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
  const isWeekend = day === 0 || day === 6;
  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  return {
    isWeekend,
    dayName: dayNames[day],
    dayNumber: day
  };
}

// ============================================
// RULE-BASED HEADLINE GENERATOR (SYNC)
// ============================================

export function generateHeadlineSync({ item, estimasiOrang, antrian, externalSignals = [], allSignals = [] }) {
  const nama = item.name || item.nama || "tempat ini";
  const waktu = getWaktuSekarang();
  const dayInfo = getDayInfo();
  const kategori = item.category?.toLowerCase() || '';
  const estimasiDariLaporan = estimasiOrang || item.latest_estimated_people || null;
  const estimasiWaitTime = item.latest_estimated_wait_time || null;
  const seed = `${item.id}_${item.updated_at || item.created_at || Date.now()}`;
  
  // 🔥 PRIORITAS UTAMA: Laporan warga terbaru (2 jam)
  const recentWargaReport = item.recentWargaLaporan;
  if (recentWargaReport && item.hasRecentWargaReport) {
    let headlineText = recentWargaReport.deskripsi || recentWargaReport.content || recentWargaReport.text;
    if (headlineText && headlineText.length > 55) {
      headlineText = headlineText.substring(0, 52) + "...";
    }
    
    if (headlineText) {
      let icon = '🗣️';
      if (recentWargaReport.tipe === 'Sepi') icon = '🍃';
      else if (recentWargaReport.tipe === 'Ramai') icon = '🏃';
      else if (recentWargaReport.tipe === 'Antri') icon = '⏳';
      else if (recentWargaReport.traffic_condition === 'Macet') icon = '🚗';
      else if (recentWargaReport.traffic_condition === 'Ramai') icon = '🚙';
      
      return {
        text: headlineText,
        type: 'laporan_warga',
        icon: icon,
        isFromWarga: true
      };
    }
  }
  
  // 🔥 PRIORITAS 2: Laporan warga dari allSignals (fallback)
  const freshLaporan = allSignals.find(s => 
    (s.tipe === 'laporan' || s.type === 'laporan') && 
    (s.deskripsi || s.text) && 
    (s.deskripsi?.length > 5 || s.text?.length > 5) &&
    isTimestampFresh(s.created_at, 2) // 2 jam, bukan 6
  );
  
  if (freshLaporan) {
    let cerita = freshLaporan.deskripsi || freshLaporan.text;
    if (cerita.length > 50) cerita = cerita.substring(0, 47) + "...";
    
    let icon = '🗣️';
    if (freshLaporan.tipe === 'Sepi') icon = '🍃';
    else if (freshLaporan.tipe === 'Ramai') icon = '🏃';
    else if (freshLaporan.tipe === 'Antri') icon = '⏳';
    
    return {
      text: cerita,
      type: 'laporan_warga',
      icon: icon,
      isFromWarga: true
    };
  }
  
  // Priority 3: EVENT
  const eventDetected = detectEvent(allSignals);
  if (eventDetected) {
    const template = getDeterministicTemplate(TEMPLATES.event, `${seed}_event`);
    return {
      text: template.replace('{nama}', nama).replace('{event}', eventDetected),
      type: 'event',
      icon: '🎉'
    };
  }
  
  // Priority 4: VIRAL
  const hasViralSignal = externalSignals.some(s => 
    (s.likes_count && s.likes_count > 100) || (s.comments_count && s.comments_count > 20)
  );
  if (hasViralSignal) {
    const template = getDeterministicTemplate(TEMPLATES.viral, `${seed}_viral`);
    return {
      text: template.replace('{nama}', nama),
      type: 'viral',
      icon: '🔥'
    };
  }
  
  // Priority 5: OFFICIAL UPDATE
  const officialSignal = externalSignals.find(s => s.source_tier <= 2 && s.content);
  if (officialSignal) {
    const template = getDeterministicTemplate(TEMPLATES.official, `${seed}_official`);
    const update = officialSignal.content.substring(0, 45) + (officialSignal.content.length > 45 ? "..." : "");
    return {
      text: template.replace('{nama}', nama).replace('{update}', update),
      type: 'official',
      icon: '📢'
    };
  }
  
  // Priority 6: HUJAN
  const isHujan = allSignals.some(s => /hujan|gerimis|deras|basah|mantol|neduh/i.test(s.text || s.deskripsi || ''));
  if (isHujan) {
    const template = getDeterministicTemplate(TEMPLATES.hujan, `${seed}_hujan`);
    return {
      text: template.replace('{nama}', nama),
      type: 'hujan',
      icon: '🌧️'
    };
  }
  
  // Priority 7: ANTRIAN
  const antrianFresh = antrian && isFresh(antrian, 2);
  if (antrianFresh && estimasiWaitTime) {
    const template = getDeterministicTemplate(TEMPLATES.antrian_dengan_waktu, `${seed}_antrian_waktu`);
    return {
      text: template.replace('{estimasi}', estimasiWaitTime).replace('{nama}', nama),
      type: 'antrian',
      icon: estimasiWaitTime > 15 ? '🐢' : '⏳'
    };
  }
  if (antrianFresh) {
    const template = getDeterministicTemplate(TEMPLATES.antrian, `${seed}_antrian`);
    return {
      text: template.replace('{nama}', nama),
      type: 'antrian',
      icon: '⏳'
    };
  }
  
  // Priority 8: MACET
  const isMacet = allSignals.some(s => /macet|padat|merayap|mengular/i.test(s.text || s.deskripsi || ''));
  const isJalan = kategori.includes('jalan') || item.name?.toLowerCase().includes('jalan') || item.name?.toLowerCase().includes('simpang');
  if (isMacet && isJalan) {
    const template = getDeterministicTemplate(TEMPLATES.macet, `${seed}_macet`);
    return {
      text: template.replace('{nama}', nama),
      type: 'macet',
      icon: '🚗'
    };
  }
  
  // ============================================
  // 🔥 TEMPLATE KHUSUS KATEGORI (Masjid, Puskesmas, Sekolah, Industri)
  // ============================================
  const placeCategory = getPlaceCategory(item);
  const categoryTemplates = placeCategory ? CATEGORY_TEMPLATES[placeCategory] : null;
  
  if (categoryTemplates) {
    const estimasiAngka = estimasiDariLaporan || 0;
    const isRamai = estimasiAngka > 15 || allSignals.some(s => /ramai|rame|padat|mbludak/i.test(s.text || s.deskripsi || ''));
    const isSepi = estimasiAngka > 0 && estimasiAngka <= 8;
    
    // Cek kondisi ramai/sepi dulu
    if (isRamai && categoryTemplates.ramai) {
      return {
        text: categoryTemplates.ramai.replace('{nama}', nama),
        type: `${placeCategory}_ramai`,
        icon: getCategoryIcon(placeCategory)
      };
    }
    if (isSepi && categoryTemplates.sepi) {
      return {
        text: categoryTemplates.sepi.replace('{nama}', nama),
        type: `${placeCategory}_sepi`,
        icon: getCategoryIcon(placeCategory)
      };
    }
    
    // Cek template waktu
    const timeTemplate = categoryTemplates[waktu.nama];
    if (timeTemplate) {
      return {
        text: timeTemplate.replace('{nama}', nama),
        type: `${placeCategory}_${waktu.nama}`,
        icon: getCategoryIcon(placeCategory)
      };
    }
  }
  
  // ============================================
  // DEFAULT: RAMAI / SEPI / WAKTU
  // ============================================
  const estimasiAngka = estimasiDariLaporan || 0;
  const isRamai = estimasiAngka > 15 || allSignals.some(s => /ramai|rame|padat|mbludak/i.test(s.text || s.deskripsi || ''));
  const isMulaiRamai = estimasiAngka > 8 && estimasiAngka <= 15;
  const isSepi = estimasiAngka > 0 && estimasiAngka <= 8;
  
  if (isRamai) {
    if (kategori.includes('kuliner') || kategori.includes('cafe') || kategori.includes('restoran')) {
      const template = getDeterministicTemplate(TEMPLATES.kuliner, `${seed}_kuliner`);
      return {
        text: template.replace('{nama}', nama),
        type: 'ramai',
        icon: '🍽️'
      };
    }
    const template = getDeterministicTemplate(TEMPLATES.ramai, `${seed}_ramai`);
    return {
      text: template.replace('{nama}', nama),
      type: 'ramai',
      icon: '🏃‍♂️'
    };
  }
  
  if (isMulaiRamai) {
    const template = getDeterministicTemplate(TEMPLATES.mulai_ramai, `${seed}_mulai_ramai`);
    return {
      text: template.replace('{nama}', nama),
      type: 'mulai_ramai',
      icon: '👥'
    };
  }
  
  if (isSepi) {
    const template = getDeterministicTemplate(TEMPLATES.sepi, `${seed}_sepi`);
    return {
      text: template.replace('{nama}', nama),
      type: 'sepi',
      icon: '🍃'
    };
  }
  
  // FALLBACK: BERDASARKAN WAKTU
  if (waktu.nama === 'malam' && dayInfo.isWeekend) {
    const weekendNightTemplates = [
      `🌙 Malam ${dayInfo.dayName} di {nama}`,
      `🎉 Malam ${dayInfo.dayName} di {nama}, suasana meriah`,
      `✨ Malam ${dayInfo.dayName} di {nama}`,
      `🌙 Malam ${dayInfo.dayName} di {nama}`
    ];
    const template = getDeterministicTemplate(weekendNightTemplates, `${seed}_weekend_night`);
    return {
      text: template.replace('{nama}', nama),
      type: 'malam_weekend',
      icon: '🌙'
    };
  }
  
  const waktuTemplates = TEMPLATES[waktu.nama] || TEMPLATES.siang;
  const template = getDeterministicTemplate(waktuTemplates, `${seed}_${waktu.nama}`);
  return {
    text: template.replace('{nama}', nama),
    type: waktu.nama,
    icon: waktu.icon
  };
}

// ============================================
// HYBRID HEADLINE ENGINE CLASS
// ============================================

class HybridHeadlineEngine {
  constructor() {
    this.aiCache = new Map();
    this.lastAICallTimes = [];
    this.pendingRequests = new Map();
    this.MAX_CALLS_PER_MINUTE = 8;
    this.CACHE_TTL = 30 * 60 * 1000;
    this.COOLDOWN_PER_ITEM = 20 * 60 * 1000;
  }

  shouldUseAI({ item, estimasiOrang, externalSignals, allSignals }) {
    const estimasiAngka = estimasiOrang || item.latest_estimated_people || 0;
    const waitTime = item.latest_estimated_wait_time || 0;
    
    if (detectEvent(allSignals)) return true;
    
    const hasSuperViral = externalSignals.some(s => 
      (s.likes_count && s.likes_count > 500) || 
      (s.comments_count && s.comments_count > 100)
    );
    if (hasSuperViral) return true;
    
    if (estimasiAngka > 50) return true;
    if (estimasiAngka === 0 && item.latest_estimated_people !== null) return true;
    if (waitTime > 30) return true;
    
    const isHujan = allSignals.some(s => /hujan|gerimis/i.test(s.text || s.deskripsi || ''));
    const isRamai = estimasiAngka > 15;
    const isAntrian = waitTime > 10;
    
    if ((isHujan && isRamai) || (isRamai && isAntrian)) return true;
    if (item.total_likes > 200 || item.total_comments > 50) return true;
    
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

  getCacheKey(item) {
    return `${item.id}_${item.updated_at || item.created_at || ''}_${item.latest_estimated_people || ''}_${item.latest_estimated_wait_time || ''}`;
  }

  async generateWithAI({ item, estimasiOrang, antrian, externalSignals, allSignals }) {
    const cacheKey = this.getCacheKey(item);
    
    const cached = this.aiCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.headline;
    }
    
    const lastCall = this.pendingRequests.get(item.id);
    if (lastCall && Date.now() - lastCall < this.COOLDOWN_PER_ITEM) {
      return null;
    }
    
    if (!this.canCallAI()) return null;
    
    this.pendingRequests.set(item.id, Date.now());
    
    try {
      const response = await fetch('/api/groq-headline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item: {
            id: item.id,
            name: item.name,
            category: item.category,
            latest_estimated_people: item.latest_estimated_people,
            latest_estimated_wait_time: item.latest_estimated_wait_time
          },
          context: {
            estimasiOrang,
            hasAntrian: !!antrian,
            waitTime: item.latest_estimated_wait_time,
            recentReports: allSignals.slice(0, 3).map(s => s.text || s.deskripsi).filter(Boolean),
            hasEvent: !!detectEvent(allSignals),
            isViral: externalSignals.some(s => s.likes_count > 100),
            isHujan: allSignals.some(s => /hujan|gerimis/i.test(s.text || s.deskripsi || '')),
            isMacet: allSignals.some(s => /macet|padat/i.test(s.text || s.deskripsi || ''))
          }
        })
      });
      
      if (!response.ok) throw new Error('AI request failed');
      
      const data = await response.json();
      
      if (data.headline && data.headline.text) {
        const headline = { ...data.headline, isAI: true };
        this.aiCache.set(cacheKey, { headline, timestamp: Date.now() });
        return headline;
      }
      
      return null;
    } catch (error) {
      console.error('AI headline error:', error);
      return null;
    }
  }

  async getHeadline({ item, estimasiOrang, antrian, externalSignals = [], allSignals = [] }) {
    const syncHeadline = generateHeadlineSync({
      item,
      estimasiOrang,
      antrian,
      externalSignals,
      allSignals
    });
    
    const needsAI = this.shouldUseAI({
      item,
      estimasiOrang,
      externalSignals,
      allSignals
    });
    
    if (!needsAI) return syncHeadline;
    
    const aiHeadline = await this.generateWithAI({
      item,
      estimasiOrang,
      antrian,
      externalSignals,
      allSignals
    });
    
    return aiHeadline || syncHeadline;
  }
}

// ============================================
// EXPORTS
// ============================================

export const headlineEngine = new HybridHeadlineEngine();

export async function getHeadline(props) {
  return headlineEngine.getHeadline(props);
}

export function getHeadlineSync(props) {
  return generateHeadlineSync(props);
}

export const generateHeadline = generateHeadlineSync;

export default {
  generateHeadline: generateHeadlineSync,
  generateHeadlineSync,
  getHeadline,
  headlineEngine
};