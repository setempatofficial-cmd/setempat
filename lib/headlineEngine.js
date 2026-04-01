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
    "🌙 Malam minggu di {nama}, muda-mudi berkumpul",
    "Lampu temaram temani malam di {nama}",
    "Ngopi malam di {nama}, diskusi hangat"
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

// Helper functions
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

// Rule-based headline generator (synchronous, FREE)
export function generateHeadlineSync({ item, estimasiOrang, antrian, externalSignals = [], allSignals = [] }) {
  const nama = item.name || item.nama || "tempat ini";
  const waktu = getWaktuSekarang();
  const kategori = item.category?.toLowerCase() || '';
  const estimasiDariLaporan = estimasiOrang || item.latest_estimated_people || null;
  const estimasiWaitTime = item.latest_estimated_wait_time || null;
  const seed = `${item.id}_${item.updated_at || item.created_at || Date.now()}`;
  
  // Priority 1: EVENT
  const eventDetected = detectEvent(allSignals);
  if (eventDetected) {
    const template = getDeterministicTemplate(TEMPLATES.event, `${seed}_event`);
    return {
      text: template.replace('{nama}', nama).replace('{event}', eventDetected),
      type: 'event',
      icon: '🎉'
    };
  }
  
  // Priority 2: VIRAL
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
  
  // Priority 3: OFFICIAL UPDATE
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
  
  // Priority 4: HUJAN
  const isHujan = allSignals.some(s => /hujan|gerimis|deras|basah|mantol|neduh/i.test(s.text || s.deskripsi || ''));
  if (isHujan) {
    const template = getDeterministicTemplate(TEMPLATES.hujan, `${seed}_hujan`);
    return {
      text: template.replace('{nama}', nama),
      type: 'hujan',
      icon: '🌧️'
    };
  }
  
  // Priority 5: ANTRIAN
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
  
  // Priority 6: MACET
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
  
  // Priority 7: RAMAI
  const estimasiAngka = estimasiDariLaporan || 0;
  const isRamai = estimasiAngka > 15 || allSignals.some(s => /ramai|rame|padat|mbludak/i.test(s.text || s.deskripsi || ''));
  const isMulaiRamai = estimasiAngka > 8 && estimasiAngka <= 15;
  
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
  
  // Priority 8: SEPI
  const isSepi = estimasiAngka > 0 && estimasiAngka <= 8;
  if (isSepi) {
    const template = getDeterministicTemplate(TEMPLATES.sepi, `${seed}_sepi`);
    return {
      text: template.replace('{nama}', nama),
      type: 'sepi',
      icon: '🍃'
    };
  }
  
  // Priority 9: LAPORAN WARGA
  const freshLaporan = allSignals.find(s => 
    (s.tipe === 'laporan' || s.type === 'laporan') && 
    (s.deskripsi || s.text) && 
    (s.deskripsi?.length > 5 || s.text?.length > 5) &&
    isTimestampFresh(s.created_at, 6)
  );
  
  if (freshLaporan) {
    let cerita = freshLaporan.deskripsi || freshLaporan.text;
    if (cerita.length > 50) cerita = cerita.substring(0, 47) + "...";
    const template = getDeterministicTemplate(TEMPLATES.umum, `${seed}_laporan`);
    return {
      text: template.replace('{nama}', nama).replace('{cerita}', cerita),
      type: 'laporan_warga',
      icon: '🗣️'
    };
  }
  
  // Priority 10: FALLBACK BERDASARKAN WAKTU
  const waktuTemplates = TEMPLATES[waktu.nama] || TEMPLATES.siang;
  const template = getDeterministicTemplate(waktuTemplates, `${seed}_${waktu.nama}`);
  return {
    text: template.replace('{nama}', nama),
    type: waktu.nama,
    icon: waktu.icon
  };
}

// Hybrid Headline Engine Class
class HybridHeadlineEngine {
  constructor() {
    this.aiCache = new Map();
    this.lastAICallTimes = [];
    this.pendingRequests = new Map();
    this.MAX_CALLS_PER_MINUTE = 8;
    this.CACHE_TTL = 30 * 60 * 1000; // 30 menit
    this.COOLDOWN_PER_ITEM = 20 * 60 * 1000; // 20 menit per item
  }

  shouldUseAI({ item, estimasiOrang, externalSignals, allSignals }) {
    const estimasiAngka = estimasiOrang || item.latest_estimated_people || 0;
    const waitTime = item.latest_estimated_wait_time || 0;
    
    // Situasi yang memerlukan AI:
    // 1. Ada event spesial
    if (detectEvent(allSignals)) return true;
    
    // 2. Super viral (engagement tinggi)
    const hasSuperViral = externalSignals.some(s => 
      (s.likes_count && s.likes_count > 500) || 
      (s.comments_count && s.comments_count > 100)
    );
    if (hasSuperViral) return true;
    
    // 3. Kondisi ekstrim
    if (estimasiAngka > 50) return true; // Super ramai
    if (estimasiAngka === 0 && item.latest_estimated_people !== null) return true; // Sepi total
    
    // 4. Antrian sangat panjang
    if (waitTime > 30) return true;
    
    // 5. Kombinasi unik
    const isHujan = allSignals.some(s => /hujan|gerimis/i.test(s.text || s.deskripsi || ''));
    const isRamai = estimasiAngka > 15;
    const isAntrian = waitTime > 10;
    
    if ((isHujan && isRamai) || (isRamai && isAntrian)) return true;
    
    // 6. Item populer dengan banyak interaksi
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
    
    // Cek cache
    const cached = this.aiCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.headline;
    }
    
    // Cek cooldown per item
    const lastCall = this.pendingRequests.get(item.id);
    if (lastCall && Date.now() - lastCall < this.COOLDOWN_PER_ITEM) {
      return null;
    }
    
    // Rate limiting
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
        const headline = {
          ...data.headline,
          isAI: true
        };
        
        // Simpan ke cache
        this.aiCache.set(cacheKey, {
          headline,
          timestamp: Date.now()
        });
        
        return headline;
      }
      
      return null;
      
    } catch (error) {
      console.error('AI headline error:', error);
      return null;
    }
  }

  async getHeadline({ item, estimasiOrang, antrian, externalSignals = [], allSignals = [] }) {
    // Selalu punya fallback sync (GRATIS)
    const syncHeadline = generateHeadlineSync({
      item,
      estimasiOrang,
      antrian,
      externalSignals,
      allSignals
    });
    
    // Cek apakah perlu AI
    const needsAI = this.shouldUseAI({
      item,
      estimasiOrang,
      externalSignals,
      allSignals
    });
    
    if (!needsAI) {
      return syncHeadline;
    }
    
    // Coba generate dengan AI
    const aiHeadline = await this.generateWithAI({
      item,
      estimasiOrang,
      antrian,
      externalSignals,
      allSignals
    });
    
    // Return AI headline jika berhasil,否则 fallback ke sync
    return aiHeadline || syncHeadline;
  }
}

// Export singleton instance
export const headlineEngine = new HybridHeadlineEngine();

// Main function for components
export async function getHeadline(props) {
  return headlineEngine.getHeadline(props);
}

// Sync version for immediate use
export function getHeadlineSync(props) {
  return generateHeadlineSync(props);
}


// Alias generateHeadline untuk kompatibilitas dengan feedEngine.js
export const generateHeadline = generateHeadlineSync;

// Export default untuk fleksibilitas
export default {
  generateHeadline: generateHeadlineSync,
  generateHeadlineSync,
  getHeadline,
  headlineEngine
};