// app/api/chat/route.js
// VERSION: 2.0.0 - Final Production Ready
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// ============================================
// KONFIGURASI
// ============================================
const CONFIG = {
  RATE_LIMIT: {
    PER_MINUTE: 8,        // Lebih konservatif
    PER_HOUR: 20,         // Batas per jam
    PER_DAY: 30,          // Batas per hari
    BURST_MULTIPLIER: 1.5 // Allow burst untuk user aktif
  },
  AI: {
    MODEL: 'gpt-oss-20b',
    MAX_TOKENS: 300,      // Dikurangi untuk hemat
    TEMPERATURE: 0.7,
    TIMEOUT: 8000,        // 8 detik
    FALLBACK_MODEL: 'mixtral-8x7b-32768' // Backup jika main model down
  },
  CACHE: {
    TTL: 60000,           // 1 menit
    WEATHER_TTL: 300000,  // 5 menit
    MAX_ENTRIES: 100
  },
  QUICK_RESPONSE: {
    MIN_CONFIDENCE: 0.7,  // Threshold untuk quick response
    MAX_TOKENS_SAVED: 200 // Estimasi token yang dihemat
  }
};

// ============================================
// RATE LIMITING CERDAS
// ============================================
class SmartRateLimiter {
  constructor() {
    this.store = new Map();
    this.whitelist = new Set(); // Untuk admin/verified users
  }

  check(ip, userId = null) {
    // Whitelist untuk admin atau user premium
    if (userId && this.isWhitelisted(userId)) {
      return { allowed: true, limit: 'whitelist' };
    }

    const now = Date.now();
    const entry = this.store.get(ip) || this.createEntry(now);

    // Reset expired entries
    if (now > entry.dayResetAt) {
      Object.assign(entry, this.createEntry(now));
    }

    // Hitung skor rate limit dengan adaptive threshold
    const minuteScore = entry.minuteCount / CONFIG.RATE_LIMIT.PER_MINUTE;
    const hourScore = entry.hourCount / CONFIG.RATE_LIMIT.PER_HOUR;
    const dayScore = entry.dailyCount / CONFIG.RATE_LIMIT.PER_DAY;

    // User dengan riwayat baik dapat burst lebih tinggi
    const burstBonus = entry.goodBehaviorScore > 0.8 ? CONFIG.RATE_LIMIT.BURST_MULTIPLIER : 1;
    const adjustedMinuteLimit = CONFIG.RATE_LIMIT.PER_MINUTE * burstBonus;

    // Cek limit
    if (entry.minuteCount > adjustedMinuteLimit) {
      return {
        allowed: false,
        reason: 'minute',
        resetAt: entry.resetAt,
        retryAfter: Math.ceil((entry.resetAt - now) / 1000)
      };
    }

    if (entry.hourCount > CONFIG.RATE_LIMIT.PER_HOUR) {
      return {
        allowed: false,
        reason: 'hour',
        resetAt: entry.hourResetAt,
        retryAfter: Math.ceil((entry.hourResetAt - now) / 1000)
      };
    }

    if (entry.dailyCount > CONFIG.RATE_LIMIT.PER_DAY) {
      return {
        allowed: false,
        reason: 'day',
        resetAt: entry.dayResetAt,
        retryAfter: Math.ceil((entry.dayResetAt - now) / 1000)
      };
    }

    // Update counters
    entry.minuteCount++;
    entry.hourCount++;
    entry.dailyCount++;
    entry.totalRequests++;
    entry.lastRequestAt = now;

    // Update good behavior score (semakin banyak request yang valid, semakin baik)
    if (entry.minuteCount < adjustedMinuteLimit * 0.8) {
      entry.goodBehaviorScore = Math.min(1, entry.goodBehaviorScore + 0.01);
    }

    this.store.set(ip, entry);
    this.cleanup();

    return {
      allowed: true,
      remaining: {
        minute: Math.max(0, adjustedMinuteLimit - entry.minuteCount),
        hour: Math.max(0, CONFIG.RATE_LIMIT.PER_HOUR - entry.hourCount),
        day: Math.max(0, CONFIG.RATE_LIMIT.PER_DAY - entry.dailyCount)
      }
    };
  }

  createEntry(now) {
    return {
      minuteCount: 0,
      hourCount: 0,
      dailyCount: 0,
      totalRequests: 0,
      resetAt: now + 60000,
      hourResetAt: now + 3600000,
      dayResetAt: now + 86400000,
      lastRequestAt: now,
      goodBehaviorScore: 0.5,
      failedAttempts: 0
    };
  }

  isWhitelisted(userId) {
    return this.whitelist.has(userId);
  }

  addToWhitelist(userId) {
    this.whitelist.add(userId);
  }

  cleanup() {
    const now = Date.now();
    let deleted = 0;
    for (const [ip, entry] of this.store.entries()) {
      if (now > entry.dayResetAt) {
        this.store.delete(ip);
        deleted++;
      }
    }
    if (deleted > 0) {
      console.log(`[RateLimiter] Cleaned up ${deleted} expired entries`);
    }
  }

  // Panggil saat request gagal (untuk penalize)
  recordFailure(ip) {
    const entry = this.store.get(ip);
    if (entry) {
      entry.failedAttempts++;
      entry.goodBehaviorScore = Math.max(0, entry.goodBehaviorScore - 0.05);
    }
  }
}

const rateLimiter = new SmartRateLimiter();

// ============================================
// CACHE MANAGER
// ============================================
class CacheManager {
  constructor() {
    this.cache = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return entry.value;
  }

  set(key, value, ttl = CONFIG.CACHE.TTL) {
    // Evict oldest if too many entries
    if (this.cache.size >= CONFIG.CACHE.MAX_ENTRIES) {
      const oldest = [...this.cache.entries()]
        .sort((a, b) => a[1].createdAt - b[1].createdAt)[0];
      this.cache.delete(oldest[0]);
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
      createdAt: Date.now()
    });
  }

  getStats() {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? (this.hits / total * 100).toFixed(1) + '%' : '0%'
    };
  }

  clear() {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }
}

const cacheManager = new CacheManager();

// ============================================
// WEATHER API (DENGAN CACHE)
// ============================================
async function getWeatherFromAPI(kodeWilayah) {
  if (!kodeWilayah) return null;

  const cacheKey = `weather_${kodeWilayah}`;
  const cached = cacheManager.get(cacheKey);
  if (cached) return cached;

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/weather?kode=${kodeWilayah}`, {
      signal: AbortSignal.timeout(3000)
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (data?.weather) {
      cacheManager.set(cacheKey, data.weather, CONFIG.CACHE.WEATHER_TTL);
      return data.weather;
    }
    return null;
  } catch (error) {
    console.error('[Weather] Error:', error.message);
    return null;
  }
}

// ============================================
// FORMAT JAM BUKA
// ============================================
function formatJamBuka(jamBuka, tempatName) {
  if (!jamBuka) return null;

  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const today = days[new Date().getDay()];
  const possibleDayKeys = [today, today.toLowerCase(), today.toUpperCase()];

  if (typeof jamBuka === 'string') {
    return `Jam buka ${tempatName}: ${jamBuka}`;
  }

  if (typeof jamBuka === 'object') {
    let todaySchedule = null;
    for (const key of possibleDayKeys) {
      if (jamBuka[key]) {
        todaySchedule = jamBuka[key];
        break;
      }
    }

    if (todaySchedule) {
      return `Jam buka ${tempatName} hari ${today}: ${todaySchedule}`;
    }

    if (jamBuka.default || jamBuka.umum) {
      return `Jam buka ${tempatName}: ${jamBuka.default || jamBuka.umum}`;
    }

    const firstDay = Object.keys(jamBuka)[0];
    if (firstDay && jamBuka[firstDay]) {
      return `Jam buka ${tempatName} (contoh ${firstDay}): ${jamBuka[firstDay]}`;
    }
  }

  return null;
}

// ============================================
// FORMAT KENTONGAN MESSAGE
// ============================================
function formatKentonganMessage(kentongan) {
  if (!kentongan) return null;

  if (kentongan.expires_at && new Date(kentongan.expires_at) < new Date()) return null;
  if (kentongan.is_active === false) return null;

  const { title, content, image_url, is_urgent, is_pinned, created_at, is_global,
    target_desa, target_kecamatan, type, source, source_name, location, urgency } = kentongan;

  const isNewsMode = !!image_url;
  const isPeringatan = urgency === 'high' || is_urgent === true;

  let icon = "📢";
  let categoryLabel = "PENGUMUMAN";

  if (isPeringatan) {
    icon = "🚨";
    categoryLabel = "PERINGATAN PENTING";
  } else if (is_pinned) {
    icon = "📌";
    categoryLabel = "PENGUMUMAN PINNED";
  } else if (type === 'berita' || isNewsMode) {
    icon = "📰";
    categoryLabel = "KABAR SETEMPAT";
  }

  const locationInfo = is_global ? "Semua Wilayah" :
    (target_desa && target_kecamatan) ? `${target_desa}, ${target_kecamatan}` :
      (location || "Lokasi tidak ditentukan");
  const sourceInfo = source_name || source || (source === 'admin' ? 'Admin Desa' : 'Warga');
  const thumbnail = image_url ? `![gambar](${image_url})\n\n` : "";

  return `${icon} ${categoryLabel}
${thumbnail}
### ${title}

${content}

📍 **Lokasi:** ${locationInfo}
🕐 **Diterbitkan:** ${new Date(created_at).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}
👤 **Sumber:** ${sourceInfo}

---
💡 Tanya saya untuk detail lebih lanjut.`;
}

// ============================================
// SUPABASE DATA (DENGAN CACHE)
// ============================================
async function getDataFromSupabase(tempatId, kentonganId = null, modalType = null) {
  const cacheKey = `supabase_${tempatId || 'none'}_${kentonganId || 'none'}_${modalType || 'none'}`;
  const cached = cacheManager.get(cacheKey);
  if (cached) return cached;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Supabase credentials missing");
    return { success: false, data: null };
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const now = new Date().toISOString();

    // Build queries
    let feedViewQuery = null;
    if (tempatId) {
      feedViewQuery = supabase
        .from('feed_view')
        .select('*')
        .eq('id', tempatId)
        .single();
    }

    let recentQuery = supabase
      .from('laporan_warga')
      .select('id, user_name, tipe, deskripsi, content, estimated_people, estimated_wait_time, created_at, time_tag')
      .order('created_at', { ascending: false })
      .limit(8);

    let statsQuery = supabase
      .from('laporan_warga')
      .select('tipe, estimated_people, estimated_wait_time')
      .gte('created_at', today.toISOString())
      .limit(50);

    let tempatQuery = null;
    if (tempatId && !feedViewQuery) {
      tempatQuery = supabase
        .from('tempat')
        .select('jam_buka, name, cctv_url, kode_wilayah')
        .eq('id', tempatId)
        .single();
    }

    let kentonganQuery = null;
    if (kentonganId) {
      kentonganQuery = supabase
        .from('kentongan')
        .select('*')
        .eq('id', kentonganId)
        .single();
    } else if (modalType === 'kentongan') {
      kentonganQuery = supabase
        .from('kentongan')
        .select('*')
        .eq('is_active', true)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    }

    if (tempatId) {
      recentQuery = recentQuery.eq('tempat_id', tempatId);
      statsQuery = statsQuery.eq('tempat_id', tempatId);
    }

    // Parallel fetch
    const promises = [recentQuery, statsQuery];
    if (feedViewQuery) promises.push(feedViewQuery);
    if (tempatQuery) promises.push(tempatQuery);
    if (kentonganQuery) promises.push(kentonganQuery);

    const results = await Promise.all(promises);

    // Parse results
    const recentResult = results[0];
    const statsResult = results[1];
    let feedViewResult = null;
    let tempatResult = null;
    let kentonganResult = null;

    let idx = 2;
    if (feedViewQuery) feedViewResult = results[idx++];
    if (tempatQuery) tempatResult = results[idx++];
    if (kentonganQuery) kentonganResult = results[idx];

    const recentReports = recentResult.data || [];
    const todayReports = statsResult.data || [];

    // Calculate stats
    const stats = {
      total: todayReports.length,
      ramai: todayReports.filter(r => r.tipe === 'Ramai').length,
      sepi: todayReports.filter(r => r.tipe === 'Sepi').length,
      antri: todayReports.filter(r => r.tipe === 'Antri').length,
    };

    const withEstimasi = todayReports.filter(r => r.estimated_people);
    const avgEstimasi = withEstimasi.length
      ? Math.round(withEstimasi.reduce((s, r) => s + (r.estimated_people || 0), 0) / withEstimasi.length)
      : null;

    let trending = 'normal';
    if (stats.total > 0) {
      const max = Math.max(stats.ramai, stats.sepi, stats.antri);
      if (max === stats.ramai) trending = 'ramai';
      else if (max === stats.antri) trending = 'antri';
      else if (max === stats.sepi) trending = 'sepi';
    }

    const latest = recentReports.find(r => new Date(r.created_at) >= twoHoursAgo) || recentReports[0];

    // Extract data
    let jamBuka = null;
    let cctvUrl = null;
    let tempatName = null;
    let kodeWilayah = null;
    let daftarProduk = null;
    let personilSekitar = null;
    let infoPemilik = null;

    if (feedViewResult?.data) {
      jamBuka = feedViewResult.data.jam_buka;
      cctvUrl = feedViewResult.data.cctv_url;
      tempatName = feedViewResult.data.name;
      kodeWilayah = feedViewResult.data.kode_wilayah;
      daftarProduk = feedViewResult.data.daftar_produk;
      personilSekitar = feedViewResult.data.personil_sekitar;
      infoPemilik = feedViewResult.data.info_pemilik;
    } else if (tempatResult?.data) {
      jamBuka = tempatResult.data.jam_buka;
      cctvUrl = tempatResult.data.cctv_url;
      tempatName = tempatResult.data.name;
      kodeWilayah = tempatResult.data.kode_wilayah;
    }

    const kentongan = kentonganResult?.data || null;
    const kentonganMessage = kentongan ? formatKentonganMessage(kentongan) : null;

    const result = {
      success: true,
      data: {
        recentReports: recentReports.slice(0, 5),
        latest: latest || null,
        todayStats: stats,
        avgEstimasi,
        trending,
        hasLaporan: stats.total > 0,
        jamBuka: jamBuka,
        cctvUrl: cctvUrl,
        tempatName: tempatName,
        kodeWilayah: kodeWilayah,
        kentongan: kentongan,
        kentonganMessage: kentonganMessage,
        daftarProduk: daftarProduk || [],
        personilSekitar: personilSekitar || [],
        infoPemilik: infoPemilik || null
      }
    };

    // Cache result
    cacheManager.set(cacheKey, result);
    return result;

  } catch (error) {
    console.error('[Supabase] Error:', error.message);
    return { success: false, data: null };
  }
}

// ============================================
// EKSTRAK INFORMASI DARI DESKRIPSI
// ============================================
function extractInfoFromDeskripsi(deskripsi) {
  if (!deskripsi) return {};

  const info = {};

  const kepalaDesaMatch = deskripsi.match(/kepala desa[:\s]+([^,\n.]+)/i) ||
    deskripsi.match(/lurah[:\s]+([^,\n.]+)/i);
  if (kepalaDesaMatch) info.kepalaDesa = kepalaDesaMatch[1].trim();

  const kontakMatch = deskripsi.match(/(kontak|telp|wa|whatsapp)[:\s]+([0-9\s\-+]+)/i);
  if (kontakMatch) info.kontak = kontakMatch[2].trim();

  const websiteMatch = deskripsi.match(/(website|web)[:\s]+(https?:\/\/[^\s]+)/i);
  if (websiteMatch) info.website = websiteMatch[2].trim();

  const alamatMatch = deskripsi.match(/alamat[:\s]+([^,\n.]+)/i);
  if (alamatMatch) info.alamat = alamatMatch[1].trim();

  return info;
}

// ============================================
// QUICK RESPONSE DENGAN INTENT DETECTION CERDAS
// ============================================
class IntentDetector {
  constructor() {
    this.intents = {
      kepala_desa: {
        keywords: ['kepala desa', 'lurah', 'kepala kelurahan', 'pak lurah', 'bu lurah'],
        priority: 10
      },
      website: {
        keywords: ['website', 'web', 'situs'],
        priority: 9
      },
      surat: {
        keywords: ['surat', 'ktp', 'pengantar', 'kk', 'akta', 'domisili', 'skck'],
        priority: 8
      },
      program: {
        keywords: ['program', 'bantuan', 'bansos', 'bantuan sosial', 'pkh', 'kip', 'blt', 'bpnt'],
        priority: 8
      },
      kontak: {
        keywords: ['kontak', 'wa', 'whatsapp', 'nomor', 'telepon', 'telp', 'hp'],
        priority: 7
      },
      acara: {
        keywords: ['acara', 'kegiatan', 'event', 'aktivitas', 'festival', 'lomba'],
        priority: 7
      },
      menu: {
        keywords: ['menu', 'produk', 'jualan', 'makanan', 'minuman', 'catering'],
        priority: 6
      },
      driver: {
        keywords: ['driver', 'rewang', 'ojek', 'kurir', 'bantuan orang', 'prt', 'babysitter'],
        priority: 6
      },
      pemilik: {
        keywords: ['pemilik', 'owner', 'boss', 'bos'],
        priority: 6
      },
      jam_buka: {
        keywords: ['jam buka', 'buka jam', 'jam operasional', 'buka', 'tutup'],
        priority: 5
      },
      cctv: {
        keywords: ['cctv', 'live', 'pantau', 'kamera'],
        priority: 5
      },
      cuaca: {
        keywords: ['cuaca', 'hujan', 'panas', 'cerah', 'mendung', 'angin', 'gerimis'],
        priority: 4
      },
      antrian: {
        keywords: ['antri', 'ngantre', 'queue', 'antrian', 'mengantri'],
        priority: 4
      },
      kondisi: {
        keywords: ['ramai', 'rame', 'sepi', 'kondisi', 'suasana', 'gimana', 'keadaan'],
        priority: 3
      }
    };

    // Cache untuk hasil deteksi
    this.detectionCache = new Map();
  }

  detect(message) {
    const lowerMsg = message.toLowerCase();
    const cacheKey = lowerMsg.slice(0, 50); // Limit cache key length
    const cached = this.detectionCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 60000) {
      return cached.result;
    }

    let matchedIntents = [];

    for (const [intent, config] of Object.entries(this.intents)) {
      let score = 0;
      let matchCount = 0;

      for (const keyword of config.keywords) {
        if (lowerMsg.includes(keyword)) {
          score += 1;
          matchCount++;
        }
      }

      // Bonus jika keyword di awal kalimat
      for (const keyword of config.keywords) {
        if (lowerMsg.startsWith(keyword)) {
          score += 0.5;
        }
      }

      if (score > 0) {
        const confidence = Math.min(1, score / config.keywords.length * 1.5);
        matchedIntents.push({
          intent,
          confidence,
          score,
          priority: config.priority,
          matchCount
        });
      }
    }

    // Sort by confidence and priority
    matchedIntents.sort((a, b) => {
      if (a.confidence !== b.confidence) return b.confidence - a.confidence;
      return b.priority - a.priority;
    });

    const result = matchedIntents.length > 0 ? matchedIntents[0] : null;
    this.detectionCache.set(cacheKey, { result, timestamp: Date.now() });
    return result;
  }

  getStats() {
    return {
      cacheSize: this.detectionCache.size,
      intentsCount: Object.keys(this.intents).length
    };
  }
}

const intentDetector = new IntentDetector();

// ============================================
// QUICK RESPONSE GENERATOR
// ============================================
function getQuickResponseForTempat(message, weatherData, supabaseData, richContext, tempatName) {
  const lowerMsg = message.toLowerCase();
  const intent = intentDetector.detect(message);
  const extractedInfo = richContext?.metadata?.deskripsi ?
    extractInfoFromDeskripsi(richContext.metadata.deskripsi) : {};

  // Jika confidence rendah, gunakan default greeting
  if (!intent || intent.confidence < CONFIG.QUICK_RESPONSE.MIN_CONFIDENCE) {
    const hour = new Date().getHours();
    const greeting = hour < 11 ? "Pagi" : hour < 15 ? "Siang" : hour < 18 ? "Sore" : "Malam";
    return `${greeting}, Lur! 👋 Ada yang bisa dibantu tentang ${tempatName}?\n\n💡 Saya bisa kasih info:\n• Menu & harga 🍽️\n• Driver/Rewang 🚗\n• Kondisi terkini 📊\n• Jam buka ⏰\n• Cuaca 🌤️\n• Kepala desa 👨‍💼\n• Kegiatan/acara 📅\n\nCoba tanya aja!`;
  }

  // Handle berdasarkan intent
  switch (intent.intent) {
    case 'kepala_desa':
      return handleKepalaDesa(extractedInfo, supabaseData, tempatName);

    case 'website':
      return handleWebsite(extractedInfo, tempatName);

    case 'surat':
      return handleSurat(tempatName);

    case 'program':
      return handleProgram();

    case 'kontak':
      return handleKontak(extractedInfo, supabaseData, tempatName);

    case 'acara':
      return handleAcara(richContext, tempatName);

    case 'menu':
      return handleMenu(supabaseData, tempatName);

    case 'driver':
      return handleDriver(supabaseData, tempatName);

    case 'pemilik':
      return handlePemilik(supabaseData, tempatName);

    case 'jam_buka':
      return handleJamBuka(supabaseData, tempatName);

    case 'cctv':
      return handleCCTV(supabaseData, tempatName);

    case 'cuaca':
      return handleCuaca(weatherData);

    case 'antrian':
      return handleAntrian(supabaseData, tempatName);

    case 'kondisi':
      return handleKondisi(supabaseData, tempatName);

    default:
      return `Maaf, saya belum bisa jawab pertanyaan "${message}". Coba tanyakan hal lain ya! 🙏`;
  }
}

// Handler functions untuk masing-masing intent
function handleKepalaDesa(extractedInfo, supabaseData, tempatName) {
  if (extractedInfo.kepalaDesa) {
    return `👨‍💼 *Kepala Desa/Lurah*: ${extractedInfo.kepalaDesa}\n\nKalau ada keperluan, bisa datang ke kantor desa ya, Lur! 📋`;
  }
  if (supabaseData?.infoPemilik?.deskripsi?.toLowerCase().includes('kepala')) {
    return `👨‍💼 Informasi: ${supabaseData.infoPemilik.deskripsi.substring(0, 150)}`;
  }
  return `Maaf, belum ada info kepala desa untuk ${tempatName}. Coba tanya langsung ke kantor desa ya, Lur! 📍`;
}

function handleWebsite(extractedInfo, tempatName) {
  if (extractedInfo.website) {
    return `🌐 *Website ${tempatName}*: ${extractedInfo.website}`;
  }
  return `Maaf, belum ada info website untuk ${tempatName}.`;
}

function handleSurat(tempatName) {
  const isKantor = ['kantor', 'balai', 'desa', 'kelurahan'].some(k =>
    tempatName.toLowerCase().includes(k)
  );

  if (isKantor) {
    return `📝 *Cara membuat surat pengantar KTP di ${tempatName}:*

1️⃣ Datang ke kantor desa/kelurahan
2️⃣ Bawa KTP asli dan Kartu Keluarga (KK)
3️⃣ Isi formulir permohonan
4️⃣ Tunggu proses sekitar 15-30 menit

⏰ *Waktu terbaik:* Pagi jam 08.00-10.00

Ada yang mau ditanyakan lagi, Lur?`;
  }
  return `📝 Untuk pengurusan surat, silakan datang ke kantor desa/kelurahan terdekat. Jangan lupa bawa KTP & KK ya, Lur!`;
}

function handleProgram() {
  return `📋 *Program Bantuan yang tersedia:*

• 🍚 *PKH* - Bantuan keluarga harapan
• 📚 *KIP* - Kartu Indonesia Pintar  
• 🏡 *BLT/BPNT* - Bantuan pangan non tunai
• 💊 *BPJS Gratis* - Untuk warga kurang mampu

💡 Cara daftar: Datang ke kantor desa bawa KTP & KK.`;
}

function handleKontak(extractedInfo, supabaseData, tempatName) {
  if (extractedInfo.kontak) {
    return `📱 *Kontak ${tempatName}:* ${extractedInfo.kontak}\n\n💡 Bisa chat WA untuk info lebih lanjut, Lur!`;
  }
  if (supabaseData?.infoPemilik?.kontak) {
    return `📱 *Kontak ${tempatName}:* ${supabaseData.infoPemilik.kontak}`;
  }
  return `📱 Maaf, belum ada nomor kontak untuk ${tempatName}. Coba cek Google Maps atau datang langsung ya, Lur!`;
}

function handleAcara(richContext, tempatName) {
  const aktivitas = richContext?.aktivitasWarga || [];
  const aktivitasBerkala = richContext?.aktivitasBerkala || [];

  if (aktivitas.length > 0 || aktivitasBerkala.length > 0) {
    let response = `📅 *Kegiatan di sekitar ${tempatName}:*\n\n`;
    if (aktivitas.length > 0) {
      response += `🎯 *Kegiatan Terjadwal:*\n`;
      aktivitas.slice(0, 3).forEach(a => {
        response += `• ${a.judul_aktivitas} - ${new Date(a.tanggal_mulai).toLocaleDateString('id-ID')}\n`;
      });
      response += `\n`;
    }
    if (aktivitasBerkala.length > 0) {
      response += `🔄 *Kegiatan Rutin:*\n`;
      aktivitasBerkala.slice(0, 3).forEach(a => {
        response += `• ${a.nama_aktivitas} (${a.hari}, ${a.jam_mulai?.slice(0, 5)} - ${a.jam_selesai?.slice(0, 5)})\n`;
      });
    }
    return response;
  }
  return `Belum ada info kegiatan di ${tempatName} saat ini. Pantau terus ya, Lur! 📅`;
}

function handleMenu(supabaseData, tempatName) {
  const daftarProduk = supabaseData?.daftarProduk || [];
  if (daftarProduk.length > 0) {
    const produkList = daftarProduk.slice(0, 5).map(p =>
      `🍽️ ${p.nama_barang} - ${p.harga ? `Rp${p.harga.toLocaleString()}` : 'Hubungi'} ${p.satuan ? `/${p.satuan}` : ''}`
    ).join('\n');
    return `📋 *Menu di ${tempatName}:*\n${produkList}\n\nTanya saya untuk detail lebih lanjut! 🍜`;
  }
  return `Maaf, belum ada info menu untuk ${tempatName}. Coba tanya langsung ke tempatnya ya! 📍`;
}

function handleDriver(supabaseData, tempatName) {
  const personilSekitar = supabaseData?.personilSekitar || [];
  if (personilSekitar.length > 0) {
    const driverList = personilSekitar.filter(p => p.is_driver).slice(0, 3);
    const rewangList = personilSekitar.filter(p => p.is_rewang).slice(0, 3);

    let response = `🚗 *Personil Aktif di Sekitar ${tempatName}:*\n\n`;
    if (driverList.length > 0) {
      response += `*Driver:*\n${driverList.map(d => `  • ${d.nama_panggilan} ${d.driver_status === 'online' ? '✅ Online' : '⏸️'}`).join('\n')}\n`;
    }
    if (rewangList.length > 0) {
      response += `\n*Rewang (PRT/Babysitter):*\n${rewangList.map(r => `  • ${r.nama_panggilan} ⭐ ${r.rating_rewang || 'Baru'}`).join('\n')}\n`;
    }
    response += `\nKetik "order driver" untuk pesan! 🛵`;
    return response;
  }
  return `Belum ada driver/rewang yang online di sekitar ${tempatName} nih. Coba lagi nanti ya! 🙏`;
}

function handlePemilik(supabaseData, tempatName) {
  const infoPemilik = supabaseData?.infoPemilik;
  if (infoPemilik) {
    return `🏪 *Info Pemilik ${tempatName}:*\nNama: ${infoPemilik.nama}\nKontak: ${infoPemilik.kontak || 'Tidak tersedia'}\n${infoPemilik.is_verified ? '✅ Terverifikasi' : '⏳ Belum diverifikasi'}`;
  }
  return `Maaf, belum ada info kontak pemilik ${tempatName}.`;
}

function handleJamBuka(supabaseData, tempatName) {
  const jamBukaText = formatJamBuka(supabaseData?.jamBuka, tempatName);
  if (jamBukaText) return jamBukaText;
  return `Maaf, belum ada info jam buka untuk ${tempatName}. 📍`;
}

function handleCCTV(supabaseData, tempatName) {
  const cctvUrl = supabaseData?.cctvUrl;
  if (cctvUrl) return `🎥 Pantau langsung ${tempatName}: ${cctvUrl}`;
  return `Maaf, belum ada tautan CCTV untuk ${tempatName}. 📸`;
}

function handleCuaca(weatherData) {
  if (weatherData) {
    return `🌤️ Cuaca: ${weatherData.weather_desc}, ${weatherData.t}°C ${weatherData.t > 30 ? '🔥 Panas nih!' : '🌡️ Sejuk'}`;
  }
  return "Cuaca cerah 🌤️ enak buat jalan!";
}

function handleAntrian(supabaseData, tempatName) {
  const latest = supabaseData?.latest;
  if (latest?.tipe === 'Antri') {
    return `⏰ Antrian ${latest.estimated_wait_time ? `${latest.estimated_wait_time} menit` : 'ada'} di ${tempatName}. ${latest.deskripsi ? `Detail: ${latest.deskripsi.substring(0, 100)}` : ''}`;
  }
  return `✅ Nggak ada laporan antrian di ${tempatName}. Tenang aja!`;
}

function handleKondisi(supabaseData, tempatName) {
  const { hasLaporan, trending, todayStats } = supabaseData || {};
  if (!hasLaporan) {
    return `📝 Belum ada laporan untuk ${tempatName}. Kamu bisa jadi yang pertama dengan klik "Lapor"! 📸`;
  }
  if (trending === 'ramai') {
    return `🔥 Lagi RAMAI banget di ${tempatName}! ${todayStats.ramai} laporan, siap-siap antri ya!`;
  }
  if (trending === 'sepi') {
    return `🍃 Suasana SEPI & adem di ${tempatName}. Waktunya santai!`;
  }
  if (trending === 'antri') {
    return `🚶‍♂️ Ada ANTRIAN panjang di ${tempatName}!`;
  }
  return `😊 Kondisi normal di ${tempatName}. Nyaman buat dikunjungi!`;
}

function getQuickResponseForKentongan(message, supabaseData) {
  const lowerMsg = message.toLowerCase();
  const { kentongan, kentonganMessage } = supabaseData || {};

  if (!kentongan) {
    return "Belum ada pengumuman resmi nih. Pantau terus ya! 📢";
  }

  if (lowerMsg.includes('kapan') || lowerMsg.includes('jam berapa') || lowerMsg.includes('tanggal') || lowerMsg.includes('waktu')) {
    const createdAt = new Date(kentongan.created_at);
    const formattedDate = createdAt.toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const formattedTime = createdAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    return `📅 Diterbitkan: ${formattedDate} pukul ${formattedTime}. ${kentongan.is_urgent ? '⚠️ Info PENTING!' : 'Semoga bermanfaat! 😊'}`;
  }

  if (lowerMsg.includes('detail') || lowerMsg.includes('isi') || lowerMsg.includes('ceritakan') || lowerMsg.includes('jelaskan')) {
    return `📋 *${kentongan.title}*\n\n${kentongan.content.substring(0, 400)}${kentongan.content.length > 400 ? '...' : ''}\n\nAda yang mau ditanyakan lagi?`;
  }

  if (lowerMsg.includes('dimana') || lowerMsg.includes('lokasi') || lowerMsg.includes('tempat')) {
    if (kentongan.is_global) {
      return `🌍 Berlaku untuk SEMUA wilayah.`;
    }
    const lokasi = kentongan.target_desa || kentongan.location || 'tidak disebutkan';
    return `📍 Lokasi: ${lokasi}${kentongan.target_kecamatan ? `, Kec. ${kentongan.target_kecamatan}` : ''}.`;
  }

  if (lowerMsg.includes('siapa') || lowerMsg.includes('sumber') || lowerMsg.includes('pembuat')) {
    const sumber = kentongan.source_name || kentongan.source || 'Admin Desa';
    return `👤 Sumber: ${sumber}.`;
  }

  return kentonganMessage || `📢 ${kentongan.title}\n\n${kentongan.content.substring(0, 200)}${kentongan.content.length > 200 ? '...' : ''}`;
}

// ============================================
// AI PROMPT BUILDER (OPTIMIZED)
// ============================================
function buildAIPrompt(message, supabaseData, weatherData, richContext, tempatName, modalType) {
  const {
    todayStats, trending, latest, avgEstimasi, hasLaporan, jamBuka,
    daftarProduk, personilSekitar, infoPemilik, kentongan
  } = supabaseData || {};

  // Token budget: ~300 tokens
  let prompt = "";

  if (modalType === 'kentongan' && kentongan) {
    prompt = `Asisten untuk PENGUMUMAN RESMI.

DATA:
Judul: ${kentongan.title.slice(0, 100)}
Isi: ${kentongan.content.slice(0, 200)}
${kentongan.is_urgent ? '🚨 PENTING' : ''}
Lokasi: ${kentongan.is_global ? 'SEMUA' : (kentongan.target_desa || 'Tidak disebut')}

Tanya: "${message}"

JAWAB:`;
  } else {
    // Build compressed prompt
    let contextParts = [];

    if (hasLaporan) {
      contextParts.push(`Kondisi: ${trending} (R:${todayStats.ramai} S:${todayStats.sepi} A:${todayStats.antri})`);
      if (avgEstimasi) contextParts.push(`Pengunjung: ~${avgEstimasi}`);
    }

    if (latest) {
      contextParts.push(`Laporan terbaru: ${latest.tipe} - ${latest.deskripsi?.slice(0, 80) || ''}`);
    }

    if (weatherData) {
      contextParts.push(`Cuaca: ${weatherData.weather_desc}, ${weatherData.t}°C`);
    }

    if (jamBuka) {
      const jamStr = typeof jamBuka === 'string' ? jamBuka :
        (jamBuka[new Date().getDay()] || jamBuka.default || '');
      contextParts.push(`Jam: ${jamStr}`);
    }

    if (daftarProduk?.length > 0) {
      contextParts.push(`Menu: ${daftarProduk.slice(0, 3).map(p => p.nama_barang).join(', ')}`);
    }

    if (personilSekitar?.length > 0) {
      const drivers = personilSekitar.filter(p => p.is_driver).length;
      const rewang = personilSekitar.filter(p => p.is_rewang).length;
      contextParts.push(`Driver: ${drivers}, Rewang: ${rewang}`);
    }

    if (richContext?.metadata?.deskripsi) {
      const desc = richContext.metadata.deskripsi.slice(0, 150);
      contextParts.push(`Deskripsi: ${desc}`);
    }

    if (richContext?.aktivitasWarga?.length > 0) {
      const aktivitas = richContext.aktivitasWarga.slice(0, 2)
        .map(a => a.judul_aktivitas).join(', ');
      contextParts.push(`Acara: ${aktivitas}`);
    }

    const contextStr = contextParts.join(' | ');

    prompt = `Info ${tempatName}: ${contextStr}

Tanya: "${message}"

Jawab SINGKAT (max 3 kalimat), PAKAI EMOJI, dari DATA di atas:`;
  }

  return prompt;
}

// ============================================
// MAIN HANDLER
// ============================================
export async function POST(req) {
  const startTime = Date.now();
  let ip = 'unknown';
  let tempatName = 'unknown';
  let isQuickIntent = false;

  try {
    // Get IP
    ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';

    // Parse request
    const { message, tempat, kentonganId, modalType, richContext, userId } = await req.json();

    // Validasi input
    if (!message?.trim()) {
      return NextResponse.json(
        { error: 'Pesan kosong' },
        { status: 400 }
      );
    }

    const safeMsg = message.trim().slice(0, 200);
    tempatName = tempat?.name || 'sini';

    // 🔥 RATE LIMITING CERDAS
    const rateResult = rateLimiter.check(ip, userId);
    if (!rateResult.allowed) {
      const messages = {
        minute: `Pelan-pelan, Lur! 😅 Coba lagi ${rateResult.retryAfter} detik lagi.`,
        hour: `Udah banyak banget nih, istirahat dulu ${Math.ceil(rateResult.retryAfter / 60)} menit ya! 😊`,
        day: `Kuota hari ini habis, besok lagi ya! 🙏`
      };

      return NextResponse.json(
        {
          text: messages[rateResult.reason] || 'Coba lagi nanti ya!',
          rateLimit: {
            limit: CONFIG.RATE_LIMIT[rateResult.reason.toUpperCase()],
            remaining: 0,
            resetAt: rateResult.resetAt
          }
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(CONFIG.RATE_LIMIT[rateResult.reason.toUpperCase()] || 0),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(rateResult.resetAt).toISOString(),
            'Retry-After': String(rateResult.retryAfter)
          }
        }
      );
    }

    // Get location code
    const kodeWilayah = tempat?.kode_wilayah ||
      richContext?.userLocation?.kode_wilayah ||
      null;

    const detectedModalType = modalType || (kentonganId ? 'kentongan' : 'tempat');

    // Fetch data with caching
    const [weatherData, supabaseResult] = await Promise.all([
      getWeatherFromAPI(kodeWilayah),
      getDataFromSupabase(tempat?.id, kentonganId, detectedModalType).catch(err => {
        console.error('[Supabase] Fetch error:', err.message);
        return { success: false, data: null };
      })
    ]);

    const supabaseData = supabaseResult?.success ? supabaseResult.data : null;

    // 🔥 QUICK RESPONSE dengan intent detection
    const quickResponse = getQuickResponseForTempat(
      safeMsg,
      weatherData,
      supabaseData,
      richContext,
      tempatName
    );

    // Check if quick response is sufficient
    const intent = intentDetector.detect(safeMsg);
    isQuickIntent = intent && intent.confidence >= CONFIG.QUICK_RESPONSE.MIN_CONFIDENCE;

    // Log cache stats (periodically)
    if (Math.random() < 0.01) { // 1% sampling
      console.log('[Cache] Stats:', cacheManager.getStats());
    }

    if (isQuickIntent) {
      return NextResponse.json({
        text: quickResponse,
        meta: {
          type: 'quick',
          intent: intent.intent,
          confidence: intent.confidence,
          tokensSaved: CONFIG.QUICK_RESPONSE.MAX_TOKENS_SAVED
        }
      });
    }

    // 🔥 AI CALL (dengan fallback)
    const prompt = buildAIPrompt(
      safeMsg,
      supabaseData,
      weatherData,
      richContext,
      tempatName,
      detectedModalType
    );

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.AI.TIMEOUT);

    try {
      // Try primary model
      let aiResponse = await callAIModel(CONFIG.AI.MODEL, prompt, controller.signal);
      clearTimeout(timeout);

      if (!aiResponse.ok) {
        // Fallback to secondary model
        console.log('[AI] Primary model failed, trying fallback...');
        aiResponse = await callAIModel(CONFIG.AI.FALLBACK_MODEL, prompt, controller.signal);

        if (!aiResponse.ok) {
          throw new Error('All AI models failed');
        }
      }

      const data = await aiResponse.json();
      let aiText = data.choices?.[0]?.message?.content?.trim();

      if (!aiText || aiText.length < 5) {
        return NextResponse.json({ text: quickResponse });
      }

      // Log successful AI call
      const responseTime = Date.now() - startTime;
      console.log(`[AI] Success: ${responseTime}ms, Model: ${CONFIG.AI.MODEL}`);

      return NextResponse.json({
        text: aiText,
        meta: {
          type: 'ai',
          model: CONFIG.AI.MODEL,
          responseTime
        }
      });

    } catch (aiError) {
      clearTimeout(timeout);
      console.error('[AI] Error:', aiError.message);

      // Record failure for rate limiting
      rateLimiter.recordFailure(ip);

      return NextResponse.json({
        text: quickResponse || 'Maaf, ada gangguan. Coba lagi ya! 🙏'
      });
    }

  } catch (error) {
    console.error('[Chat API] Error:', error.message);

    // Log error with context
    console.log(`[Chat API] Error Context:`, {
      ip,
      tempatName,
      isQuickIntent,
      duration: Date.now() - startTime
    });

    return NextResponse.json(
      { text: 'Maaf, ada gangguan. Coba lagi ya! 🙏' },
      { status: 500 }
    );
  }
}

// ============================================
// HELPER: Call AI Model
// ============================================
async function callAIModel(model, prompt, signal) {
  return fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model,
      max_tokens: CONFIG.AI.MAX_TOKENS,
      temperature: CONFIG.AI.TEMPERATURE,
      messages: [
        {
          role: 'system',
          content: 'Asisten CERDAS & RAMAH untuk info tempat. Jawab SINGKAT, gunakan DATA yang tersedia, penuh EMOJI.'
        },
        { role: 'user', content: prompt },
      ],
    }),
    signal,
  });
}

// ============================================
// OPTIONAL: Health Check Endpoint
// ============================================
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    version: '2.0.0',
    rateLimiter: {
      storeSize: rateLimiter.store.size,
      whitelistSize: rateLimiter.whitelist.size
    },
    cache: cacheManager.getStats(),
    intentDetector: intentDetector.getStats(),
    config: {
      models: [CONFIG.AI.MODEL, CONFIG.AI.FALLBACK_MODEL],
      rateLimits: CONFIG.RATE_LIMIT,
      cacheTTL: CONFIG.CACHE.TTL
    }
  });
}