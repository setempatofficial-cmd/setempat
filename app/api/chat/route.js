// app/api/chat/route.js (FINAL - Support Feed View + AI Cerdas)
import { createClient } from '@supabase/supabase-js';

// ============================================
// RATE LIMITING
// ============================================
const rateLimitMap = new Map();
const LIMIT_PER_MINUTE = 10;
const LIMIT_PER_DAY = 30;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || {
    count: 0, resetAt: now + 60000,
    dailyCount: 0, dayResetAt: now + 86400000,
  };

  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + 60000;
  }
  if (now > entry.dayResetAt) {
    entry.dailyCount = 0;
    entry.dayResetAt = now + 86400000;
  }

  entry.count++;
  entry.dailyCount++;
  rateLimitMap.set(ip, entry);

  if (entry.count > LIMIT_PER_MINUTE) return "minute";
  if (entry.dailyCount > LIMIT_PER_DAY) return "day";
  return null;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now > entry.dayResetAt) rateLimitMap.delete(ip);
  }
}, 3600000);

// ============================================
// WEATHER API
// ============================================
async function getWeatherFromAPI(kodeWilayah) {
  if (!kodeWilayah) return null;
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/weather?kode=${kodeWilayah}`, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return null;
    const data = await response.json();
    return data.weather;
  } catch (error) {
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
  
  const { title, content, image_url, is_urgent, is_pinned, created_at, is_global, target_desa, target_kecamatan, type, source, source_name, location, urgency } = kentongan;
  
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
  
  const locationInfo = is_global ? "Semua Wilayah" : (target_desa && target_kecamatan) ? `${target_desa}, ${target_kecamatan}` : (location || "Lokasi tidak ditentukan");
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
// SUPABASE DATA (DENGAN FEED_VIEW)
// ============================================
async function getDataFromSupabase(tempatId, kentonganId = null, modalType = null) {
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

    // 🔥 QUERY FEED_VIEW (DATA LENGKAP)
    let feedViewQuery = null;
    if (tempatId) {
      feedViewQuery = supabase
        .from('feed_view')
        .select('*')
        .eq('id', tempatId)
        .single();
    }

    // Query laporan warga
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
    
    // Query tempat (fallback)
    let tempatQuery = null;
    if (tempatId && !feedViewQuery) {
      tempatQuery = supabase
        .from('tempat')
        .select('jam_buka, name, cctv_url, kode_wilayah')
        .eq('id', tempatId)
        .single();
    }
    
    // Query kentongan
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

    const promises = [recentQuery, statsQuery];
    if (feedViewQuery) promises.push(feedViewQuery);
    if (tempatQuery) promises.push(tempatQuery);
    if (kentonganQuery) promises.push(kentonganQuery);
    
    const results = await Promise.all(promises);
    
    const recentResult = results[0];
    const statsResult = results[1];
    let feedViewResult = null;
    let tempatResult = null;
    let kentonganResult = null;
    
    let idx = 2;
    if (feedViewQuery) {
      feedViewResult = results[idx++];
    }
    if (tempatQuery) {
      tempatResult = results[idx++];
    }
    if (kentonganQuery) {
      kentonganResult = results[idx];
    }

    const recentReports = recentResult.data || [];
    const todayReports = statsResult.data || [];

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
    
    // 🔥 PRIORITASKAN DATA DARI FEED_VIEW
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
    
    return {
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
        // DATA CERDAS DARI FEED_VIEW
        daftarProduk: daftarProduk || [],
        personilSekitar: personilSekitar || [],
        infoPemilik: infoPemilik || null
      }
    };
  } catch (error) {
    console.error('Supabase error:', error);
    return { success: false, data: null };
  }
}

// ============================================
// QUICK RESPONSE UNTUK TEMPAT (DENGAN PRODUK & PERSONIL)
// ============================================
function getQuickResponseForTempat(message, weatherData, supabaseData, tempatName) {
  const lowerMsg = message.toLowerCase();
  const { todayStats, latest, trending, avgEstimasi, hasLaporan, jamBuka, daftarProduk, personilSekitar, infoPemilik } = supabaseData || {};
  const latestReport = latest;
  
  // Menu/Produk
  if (lowerMsg.includes('menu') || lowerMsg.includes('produk') || lowerMsg.includes('jualan') || lowerMsg.includes('makanan') || lowerMsg.includes('minuman')) {
    if (daftarProduk && daftarProduk.length > 0) {
      const produkList = daftarProduk.slice(0, 5).map(p => 
        `🍽️ ${p.nama_barang} - ${p.harga ? `Rp${p.harga.toLocaleString()}` : 'Hubungi'} ${p.satuan ? `/${p.satuan}` : ''}`
      ).join('\n');
      return `📋 *Menu di ${tempatName}:*\n${produkList}\n\nTanya saya untuk detail lebih lanjut! 🍜`;
    }
    return `Maaf, belum ada info menu untuk ${tempatName}. Coba tanya langsung ke tempatnya ya! 📍`;
  }
  
  // Personil/Driver/Rewang
  if (lowerMsg.includes('driver') || lowerMsg.includes('rewang') || lowerMsg.includes('ojek') || lowerMsg.includes('kurir') || lowerMsg.includes('bantuan')) {
    if (personilSekitar && personilSekitar.length > 0) {
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
  
  // Pemilik/Kontak
  if (lowerMsg.includes('pemilik') || lowerMsg.includes('owner') || lowerMsg.includes('kontak') || lowerMsg.includes('wa') || lowerMsg.includes('whatsapp')) {
    if (infoPemilik) {
      return `🏪 *Info Pemilik ${tempatName}:*\nNama: ${infoPemilik.nama}\nKontak: ${infoPemilik.kontak || 'Tidak tersedia'}\n${infoPemilik.is_verified ? '✅ Terverifikasi' : '⏳ Belum diverifikasi'}`;
    }
    return `Maaf, belum ada info kontak pemilik ${tempatName}.`;
  }
  
  // Jam buka
  if (lowerMsg.includes('jam buka') || lowerMsg.includes('buka jam') || lowerMsg.includes('jam operasional')) {
    const jamBukaText = formatJamBuka(jamBuka, tempatName);
    if (jamBukaText) return jamBukaText;
    return `Maaf, belum ada info jam buka untuk ${tempatName}. 📍`;
  }
  
  // CCTV
  if (lowerMsg.includes('cctv') || lowerMsg.includes('live') || lowerMsg.includes('pantau')) {
    const cctvUrl = supabaseData?.cctvUrl;
    if (cctvUrl) return `🎥 Pantau langsung ${tempatName}: ${cctvUrl}`;
    return `Maaf, belum ada tautan CCTV untuk ${tempatName}. 📸`;
  }
  
  // Cuaca
  if (lowerMsg.includes('cuaca') || lowerMsg.includes('hujan') || lowerMsg.includes('panas')) {
    if (weatherData) {
      return `🌤️ Cuaca: ${weatherData.weather_desc}, ${weatherData.t}°C ${weatherData.t > 30 ? '🔥 Panas nih!' : '🌡️ Sejuk'}`;
    }
    return "Cuaca cerah 🌤️ enak buat jalan!";
  }
  
  // Antrian
  if (lowerMsg.includes('antri') || lowerMsg.includes('ngantre') || lowerMsg.includes('queue')) {
    if (latestReport?.tipe === 'Antri') {
      return `⏰ Antrian ${latestReport.estimated_wait_time ? `${latestReport.estimated_wait_time} menit` : 'ada'} di ${tempatName}. ${latestReport.deskripsi ? `Detail: ${latestReport.deskripsi.substring(0, 100)}` : ''}`;
    }
    return `✅ Nggak ada laporan antrian di ${tempatName}. Tenang aja!`;
  }
  
  // Kondisi/Suasana
  if (lowerMsg.includes('ramai') || lowerMsg.includes('sepi') || lowerMsg.includes('kondisi') || lowerMsg.includes('suasana')) {
    if (!hasLaporan) return `📝 Belum ada laporan untuk ${tempatName}. Kamu bisa jadi yang pertama dengan klik "Lapor"! 📸`;
    if (trending === 'ramai') return `🔥 Lagi RAMAI banget di ${tempatName}! ${todayStats.ramai} laporan, siap-siap antri ya!`;
    if (trending === 'sepi') return `🍃 Suasana SEPI & adem di ${tempatName}. Waktunya santai!`;
    if (trending === 'antri') return `🚶‍♂️ Ada ANTRIAN panjang di ${tempatName}!`;
    return `😊 Kondisi normal di ${tempatName}. Nyaman buat dikunjungi!`;
  }
  
  // Default
  const hour = new Date().getHours();
  const greeting = hour < 11 ? "Pagi" : hour < 15 ? "Siang" : hour < 18 ? "Sore" : "Malam";
  return `${greeting}, Lur! 👋 Ada yang bisa dibantu tentang ${tempatName}?\n\n💡 Saya bisa kasih info:\n• Menu & harga 🍽️\n• Driver/Rewang 🚗\n• Kondisi terkini 📊\n• Jam buka ⏰\n• Cuaca 🌤️\n\nCoba tanya aja!`;
}

// ============================================
// QUICK RESPONSE UNTUK KENTONGAN
// ============================================
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
// AI PROMPT BUILDER (SUPER CERDAS DENGAN FEED_VIEW)
// ============================================
function buildAIPrompt(message, supabaseData, weatherData, tempatName, modalType) {
  const { 
    todayStats, trending, latest, avgEstimasi, hasLaporan, jamBuka, 
    daftarProduk, personilSekitar, infoPemilik, kentongan 
  } = supabaseData || {};
  
  let prompt = "";
  
  if (modalType === 'kentongan' && kentongan) {
    prompt = `Kamu asisten untuk PENGUMUMAN RESMI (Kentongan Digital).

=== DATA PENGUMUMAN ===
Judul: ${kentongan.title}
Isi: ${kentongan.content}
Tanggal: ${new Date(kentongan.created_at).toLocaleString('id-ID')}
Urgent: ${kentongan.is_urgent ? 'YA (PENTING! 🚨)' : 'TIDAK'}
Lokasi: ${kentongan.is_global ? 'SEMUA WILAYAH' : (kentongan.target_desa || kentongan.location || 'Tidak disebutkan')}
Sumber: ${kentongan.source_name || kentongan.source || 'Admin Desa'}

Pertanyaan user: "${message}"

INSTRUKSI:
- Jawab RAMAH & SINGKAT (max 3 kalimat)
- Prioritaskan informasi dari pengumuman di atas
- Tambahkan emoji yang relevan (🚨⚠️📢📰)
- JANGAN mengada-ada atau membuat informasi fiktif`;
  } else {
    // PROMPT CERDAS UNTUK TEMPAT (dengan semua data feed_view)
    prompt = `Kamu asisten VIRTUAL untuk tempat: ${tempatName || 'Wisata/Kuliner'}

=== DATA TERKINI ===
`;

    if (hasLaporan) {
      prompt += `📊 LAPORAN PENGUNJUNG:
- Ramai: ${todayStats.ramai} laporan
- Sepi: ${todayStats.sepi} laporan  
- Antri: ${todayStats.antri} laporan
- Trending: ${trending === 'ramai' ? '🔥 RAMAI' : trending === 'antri' ? '🚶‍♂️ ANTRI' : trending === 'sepi' ? '🍃 SEPI' : 'NORMAL'}
${avgEstimasi ? `- Rata-rata pengunjung: ~${avgEstimasi} orang` : ''}
`;
    }
    
    if (latest) {
      prompt += `\n📝 LAPORAN TERBARU (${new Date(latest.created_at).toLocaleTimeString('id-ID')}):
Tipe: ${latest.tipe}
Deskripsi: "${latest.deskripsi?.substring(0, 150)}"
${latest.estimated_wait_time ? `Estimasi antri: ${latest.estimated_wait_time} menit` : ''}
`;
    }
    
    if (weatherData) {
      prompt += `\n🌤️ CUACA (REALTIME):
${weatherData.weather_desc}, ${weatherData.t}°C, Kelembaban: ${weatherData.humidity || 'N/A'}%
`;
    }
    
    if (jamBuka) {
      const formattedJam = typeof jamBuka === 'object' ? JSON.stringify(jamBuka) : jamBuka;
      prompt += `\n⏰ JAM OPERASIONAL:
${formattedJam}
`;
    }
    
    if (daftarProduk && daftarProduk.length > 0) {
      prompt += `\n🍽️ MENU/PRODUK (${daftarProduk.length} item):
${daftarProduk.slice(0, 5).map(p => `- ${p.nama_barang}: Rp${p.harga?.toLocaleString() || '?'} ${p.satuan || ''} (Stok: ${p.stok_ready ? '✅ Tersedia' : '❌ Habis'})`).join('\n')}
${daftarProduk.length > 5 ? `...dan ${daftarProduk.length - 5} menu lainnya` : ''}
`;
    }
    
    if (personilSekitar && personilSekitar.length > 0) {
      const drivers = personilSekitar.filter(p => p.is_driver);
      const rewang = personilSekitar.filter(p => p.is_rewang);
      prompt += `\n🚗 PERSONIL AKTIF DI SEKITAR:
${drivers.length > 0 ? `Driver: ${drivers.map(d => d.nama_panggilan).join(', ')}` : 'Tidak ada driver online'}
${rewang.length > 0 ? `Rewang: ${rewang.map(r => r.nama_panggilan).join(', ')}` : 'Tidak ada rewang tersedia'}
`;
    }
    
    if (infoPemilik) {
      prompt += `\n🏪 INFO PEMILIK:
Nama: ${infoPemilik.nama}
Kontak: ${infoPemilik.kontak || 'Tidak tersedia'}
Verifikasi: ${infoPemilik.is_verified ? '✅ Terverifikasi' : '⏳ Belum diverifikasi'}
`;
    }
    
    prompt += `
=== PERTANYAAN USER ===
"${message}"

=== INSTRUKSI ===
1. Jawab dengan RAMAH, SINGKAT (max 3 kalimat), dan PAKAI EMOJI
2. Jika ditanya menu/produk, sebutkan harga & ketersediaan
3. Jika ditanya driver/rewang, sebutkan siapa yang online
4. Jika ditanya kondisi, gunakan data laporan terkini
5. Jika ditanya kontak/pemilik, berikan info yang tersedia
6. JANGAN mengada-ada informasi yang tidak ada di data
7. Gunakan gaya bahasa santai kayak ngobrol sama teman`;
  }
  
  return prompt;
}

// ============================================
// MAIN HANDLER (SUPER CERDAS DENGAN FEED_VIEW)
// ============================================
export async function POST(req) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const limited = checkRateLimit(ip);
    if (limited === "minute") return Response.json({ text: "Pelan-pelan, Lur! 😅" });
    if (limited === "day") return Response.json({ text: "Kuota habis, besok lagi ya! 🙏" });

    const { message, tempat, kentonganId, modalType } = await req.json();
    if (!message?.trim()) return Response.json({ error: "Pesan kosong" }, { status: 400 });
    
    const safeMsg = message.trim().slice(0, 200);
    const tempatName = tempat?.name || 'sini';
    const kodeWilayah = tempat?.kode_wilayah || '35.14.01.1001';
    
    const detectedModalType = modalType || (kentonganId ? 'kentongan' : 'tempat');
    
    const [weatherData, supabaseResult] = await Promise.all([
      getWeatherFromAPI(kodeWilayah),
      getDataFromSupabase(tempat?.id, kentonganId, detectedModalType).catch(err => {
        console.error("Supabase fetch error:", err);
        return { success: false, data: null };
      })
    ]);
    
    const supabaseData = supabaseResult?.success ? supabaseResult.data : null;
    
    // Deteksi pertanyaan spesifik
    const isSpecificQuestion = safeMsg.toLowerCase().match(/^(kapan|jam berapa|tanggal|waktu|detail|isi|apa|siapa|dimana|bagaimana|kenapa|jelaskan|ceritakan|menu|produk|driver|rewang|pemilik|kontak)/);
    
    // MODAL KENTONGAN
    if (detectedModalType === 'kentongan' && supabaseData?.kentongan) {
      const kentonganResponse = getQuickResponseForKentongan(safeMsg, supabaseData);
      
      if (isSpecificQuestion && !kentonganResponse.includes('📢') && kentonganResponse.length < 200) {
        return Response.json({ text: kentonganResponse });
      }
      
      if (!isSpecificQuestion && kentonganResponse.length < 100) {
        return Response.json({ text: kentonganResponse });
      }
      
      const prompt = buildAIPrompt(safeMsg, supabaseData, weatherData, tempatName, 'kentongan');
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      
      try {
        const aiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama-3.1-8b-instant",
            max_tokens: 250,
            temperature: 0.6,
            messages: [
              { role: "system", content: "Asisten RAMAH untuk kentongan digital. Jawab SINGKAT, INFORMATIF, penuh EMOJI." },
              { role: "user", content: prompt },
            ],
          }),
          signal: controller.signal,
        });
        
        clearTimeout(timeout);
        
        if (!aiResponse.ok) {
          return Response.json({ text: kentonganResponse });
        }
        
        const data = await aiResponse.json();
        let aiText = data.choices?.[0]?.message?.content?.trim();
        
        if (!aiText || aiText.length < 5) {
          return Response.json({ text: kentonganResponse });
        }
        
        return Response.json({ text: aiText });
        
      } catch (aiError) {
        clearTimeout(timeout);
        console.error("AI error:", aiError.message);
        return Response.json({ text: kentonganResponse });
      }
    }
    
    // MODAL TEMPAT (dengan fitur cerdas)
    const quickResponse = getQuickResponseForTempat(safeMsg, weatherData, supabaseData, tempatName);
    
    const isQuickIntent = safeMsg.toLowerCase().match(/^(cuaca|hujan|panas|cerah|mendung|angin|antri|ngantre|queue|ramai|rame|sepi|kondisi|suasana|gimana|cerita|warga|laporan|jam buka|buka jam|jam operasional|cctv|live|pantau|menu|produk|jualan|makanan|minuman|driver|rewang|ojek|kurir|bantuan|pemilik|owner|kontak|wa|whatsapp)$/);
    
    if (isQuickIntent) {
      return Response.json({ text: quickResponse });
    }
    
    if (!supabaseData?.hasLaporan && !isSpecificQuestion) {
      return Response.json({ text: quickResponse });
    }
    
    // Panggil AI untuk pertanyaan kompleks
    const prompt = buildAIPrompt(safeMsg, supabaseData, weatherData, tempatName, 'tempat');
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    try {
      const aiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          max_tokens: 250,
          temperature: 0.7,
          messages: [
            { role: "system", content: "Asisten CERDAS & RAMAH untuk info tempat wisata/kuliner. Jawab SINGKAT, gunakan DATA yang tersedia, penuh EMOJI." },
            { role: "user", content: prompt },
          ],
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeout);
      
      if (!aiResponse.ok) {
        return Response.json({ text: quickResponse });
      }
      
      const data = await aiResponse.json();
      let aiText = data.choices?.[0]?.message?.content?.trim();
      
      if (!aiText || aiText.length < 5) {
        return Response.json({ text: quickResponse });
      }
      
      return Response.json({ text: aiText });
      
    } catch (aiError) {
      clearTimeout(timeout);
      console.error("AI error:", aiError.message);
      return Response.json({ text: quickResponse });
    }
    
  } catch (error) {
    console.error("Chat API Error:", error);
    return Response.json({ text: "Maaf, ada gangguan. Coba lagi ya! 🙏" });
  }
}