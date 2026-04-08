// app/api/chat/route.js
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
// FORMAT JAM BUKA DARI JSONB
// ============================================
// app/api/chat/route.js - Perbaiki fungsi formatJamBuka

function formatJamBuka(jamBuka, tempatName) {
  if (!jamBuka) return null;
  
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const today = days[new Date().getDay()];
  
  // 🔥 Buat array kemungkinan format nama hari (capitalized, lowercase, dll)
  const possibleDayKeys = [today, today.toLowerCase(), today.toUpperCase()];
  
  // Jika jam_buka adalah string langsung
  if (typeof jamBuka === 'string') {
    return `Jam buka ${tempatName}: ${jamBuka}`;
  }
  
  // Jika jam_buka adalah object JSONB
  if (typeof jamBuka === 'object') {
    // 🔥 Cek dengan berbagai format nama hari
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
    
    // Cek jadwal default/umum
    if (jamBuka.default || jamBuka.umum) {
      return `Jam buka ${tempatName}: ${jamBuka.default || jamBuka.umum}`;
    }
    
    // Jika tidak ada, coba ambil jadwal pertama yang tersedia
    const firstDay = Object.keys(jamBuka)[0];
    if (firstDay && jamBuka[firstDay]) {
      return `Jam buka ${tempatName} (contoh ${firstDay}): ${jamBuka[firstDay]}`;
    }
  }
  
  return null;
}
// ============================================
// SUPABASE DATA (dengan jam_buka)
// ============================================
async function getDataFromSupabase(tempatId) {
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
    
    // 🔥 Query untuk ambil jam_buka dari tabel tempat
    let tempatQuery = supabase
      .from('tempat')
      .select('jam_buka, name, cctv_url')
      .eq('id', tempatId)
      .single();
    
    if (tempatId) {
      recentQuery = recentQuery.eq('tempat_id', tempatId);
      statsQuery = statsQuery.eq('tempat_id', tempatId);
    }

    const [recentResult, statsResult, tempatResult] = await Promise.all([recentQuery, statsQuery, tempatQuery]);

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
    
    // 🔥 Ambil data jam_buka
    const jamBuka = tempatResult.data?.jam_buka || null;
    const cctvUrl = tempatResult.data?.cctv_url || null;
    const tempatName = tempatResult.data?.name || null;
    
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
        tempatName: tempatName
      }
    };
  } catch (error) {
    console.error('Supabase error:', error);
    return { success: false, data: null };
  }
}

// ============================================
// QUICK RESPONSE (LENGKAP DENGAN JAM BUKA)
// ============================================
function getQuickResponse(message, weatherData, supabaseData, tempatName) {
  const lowerMsg = message.toLowerCase();
  const { todayStats, latest, trending, avgEstimasi, hasLaporan, jamBuka } = supabaseData || {};
  const latestReport = latest;
  
  // === JAM BUKA ===
  if (lowerMsg.includes('jam buka') || lowerMsg.includes('buka jam') || lowerMsg.includes('jam operasional') || 
      lowerMsg.includes('sampai jam') || lowerMsg.includes('buka sampai') || lowerMsg.includes('jam berapa')) {
    
    const jamBukaText = formatJamBuka(jamBuka, tempatName);
    if (jamBukaText) {
      return jamBukaText;
    }
    return `Maaf, belum ada info jam buka untuk ${tempatName}. Coba cek langsung atau tanya warga sekitar ya! 📍`;
  }
  
  // === CCTV / LIVE STREAM ===
  if (lowerMsg.includes('cctv') || lowerMsg.includes('live') || lowerMsg.includes('pantau') || lowerMsg.includes('lihat langsung')) {
    const cctvUrl = supabaseData?.cctvUrl;
    if (cctvUrl) {
      return `🎥 Anda bisa memantau langsung ${tempatName} melalui tautan ini: ${cctvUrl}`;
    }
    return `Maaf, belum ada tautan CCTV untuk ${tempatName}. Coba pantau lewat laporan warga ya! 📸`;
  }
  
  // === CUACA ===
  if (lowerMsg.includes('cuaca') || lowerMsg.includes('hujan') || lowerMsg.includes('panas') || 
      lowerMsg.includes('cerah') || lowerMsg.includes('mendung') || lowerMsg.includes('angin')) {
    if (weatherData) {
      const { t, weather_desc } = weatherData;
      const descLower = weather_desc.toLowerCase();
      
      let emoji = '🌤️';
      let responseText = '';
      
      if (descLower.includes('hujan')) {
        emoji = '🌧️';
        if (descLower.includes('deras') || descLower.includes('heavy') || descLower.includes('lebat')) {
          responseText = `Hujan deras ${emoji} ${t}°C. Hati-hati di jalan, bawa payung! 🌂`;
        } else if (descLower.includes('ringan') || descLower.includes('light')) {
          responseText = `Hujan gerimis ${emoji} ${t}°C. Bawa payung atau jas hujan ya!`;
        } else {
          responseText = `Hujan ${emoji} ${t}°C. Jangan lupa payung!`;
        }
      } 
      else if (descLower.includes('mendung') || descLower.includes('cloud') || descLower.includes('overcast')) {
        emoji = '☁️';
        responseText = `Mendung ${emoji} ${t}°C. Segar-segar, enak buat jalan.`;
      }
      else if (descLower.includes('cerah') || descLower.includes('clear')) {
        emoji = '☀️';
        if (t > 30) {
          responseText = `Cerah ${emoji} ${t}°C 🔥 panas banget, siapin topi!`;
        } else {
          responseText = `Cerah ${emoji} ${t}°C, enak buat jalan-jalan!`;
        }
      }
      else if (descLower.includes('berawan') || descLower.includes('few clouds')) {
        emoji = '⛅';
        responseText = `Cerah berawan ${emoji} ${t}°C, segar buat aktivitas!`;
      }
      else {
        responseText = `${weather_desc} ${emoji} ${t}°C`;
        if (t > 30) responseText += ' 🔥 panas banget!';
        else responseText += ' 👍 enak buat jalan.';
      }
      
      return responseText;
    }
    
    const hour = new Date().getHours();
    if (hour < 11) return "Pagi cerah 🌤️ segar buat jalan!";
    if (hour < 15) return "Siang panas ☀️ siapin topi ya!";
    if (hour < 18) return "Sore teduh 🌥️ enak santai.";
    return "Malam sejuk 🌙 hati-hati keluar.";
  }
  
  // === ANTRIAN ===
  if (lowerMsg.includes('antri') || lowerMsg.includes('ngantre') || lowerMsg.includes('queue')) {
    if (latestReport?.tipe === 'Antri') {
      const wait = latestReport.estimated_wait_time;
      const people = latestReport.estimated_people;
      if (wait > 15) return `Antrian panjang ⏳ estimasi ${wait} menit, ${people || 'banyak'} orang ngantre. Sabar ya!`;
      if (wait > 5) return `Antrian sedang ⏱️ sekitar ${wait} menit. Nggak terlalu lama kok!`;
      return `Ada antrian pendek ⚡ sekitar ${people || ''} orang. Cepet kok!`;
    }
    if (todayStats?.antri > 0) return `Hari ini ada ${todayStats.antri} laporan antrian. ${latestReport?.deskripsi || ''}`;
    return `Nggak ada laporan antrian nih. Kondisi ${trending === 'ramai' ? 'ramai' : 'normal'}.`;
  }
  
  // === RAMAI/SEPI/KONDISI ===
  if (lowerMsg.includes('ramai') || lowerMsg.includes('rame') || lowerMsg.includes('sepi') || 
      lowerMsg.includes('kondisi') || lowerMsg.includes('suasana') || lowerMsg.includes('gimana')) {
    if (!hasLaporan) return `Belum ada laporan hari ini. Kamu bisa jadi yang pertama cerita! 📸`;
    
    if (trending === 'ramai') {
      return `Lagi RAMAI! ${todayStats.ramai} laporan dari warga. ${avgEstimasi ? `Rata-rata ~${avgEstimasi} orang.` : ''} ${latestReport?.deskripsi || ''}`;
    }
    if (trending === 'antri') {
      return `Ada ANTRIAN! ${todayStats.antri} laporan. ${latestReport?.estimated_wait_time ? `Antri ${latestReport.estimated_wait_time} menit.` : ''}`;
    }
    if (trending === 'sepi') {
      return `Suasana SEPI 🍃 ${todayStats.sepi} laporan bilang tenang. Cocok buat jalan santai!`;
    }
    return `Ada ${todayStats.total} laporan hari ini: ${todayStats.ramai} ramai, ${todayStats.sepi} sepi, ${todayStats.antri} antri.`;
  }
  
  // === CERITA WARGA ===
  if (lowerMsg.includes('cerita') || lowerMsg.includes('warga') || lowerMsg.includes('laporan')) {
    if (!latestReport) return "Belum ada cerita warga nih. Kamu bisa jadi yang pertama! 📸";
    const nama = latestReport.user_name?.split(' ')[0] || 'Warga';
    const cerita = latestReport.deskripsi || latestReport.content;
    const estimasi = latestReport.estimated_people ? ` (~${latestReport.estimated_people} org)` : '';
    const waktu = latestReport.time_tag ? ` (${latestReport.time_tag})` : '';
    return `Dari @${nama}: "${cerita?.substring(0, 80)}"${estimasi}${waktu}. Mau cerita juga? 📸`;
  }
  
  // === DEFAULT ===
  const hour = new Date().getHours();
  const greeting = hour < 11 ? "Pagi" : hour < 15 ? "Siang" : hour < 18 ? "Sore" : "Malam";
  
  if (hasLaporan && latestReport) {
    const ceritaSingkat = latestReport.deskripsi?.substring(0, 60) || 'Ada update baru nih!';
    return `${greeting}, Lur! 👋 ${ceritaSingkat} Mau tanya lebih detail?`;
  }
  
  return `${greeting}, Lur! 👋 Ada yang bisa dibantu? Tanya cuaca, kondisi, jam buka, atau cerita warga!`;
}

// ============================================
// AI PROMPT
// ============================================
function buildAIPrompt(message, supabaseData, weatherData, tempatName) {
  const { todayStats, trending, latest, avgEstimasi, hasLaporan, jamBuka } = supabaseData || {};
  
  let prompt = `Lokasi: ${tempatName || 'sini'}\n`;
  
  if (hasLaporan) {
    prompt += `Statistik: ${todayStats.ramai} ramai, ${todayStats.sepi} sepi, ${todayStats.antri} antri. Trending: ${trending}`;
    if (avgEstimasi) prompt += `, estimasi ~${avgEstimasi} org`;
    prompt += `\n`;
  } else {
    prompt += `Belum ada laporan\n`;
  }
  
  if (latest) {
    prompt += `Laporan terbaru: ${latest.tipe} - "${latest.deskripsi?.substring(0, 100)}"`;
    if (latest.estimated_people) prompt += ` (${latest.estimated_people} org)`;
    if (latest.estimated_wait_time) prompt += ` (antri ${latest.estimated_wait_time} menit)`;
    prompt += `\n`;
  }
  
  if (weatherData) {
    prompt += `Cuaca: ${weatherData.weather_desc}, ${weatherData.t}°C\n`;
  }
  
  if (jamBuka) {
    prompt += `Jam buka: ${JSON.stringify(jamBuka)}\n`;
  }
  
  prompt += `\nPertanyaan: "${message}"\n`;
  prompt += `Jawab singkat maksimal 2 kalimat, bahasa santai, pakai emoji.`;
  
  return prompt;
}

// ============================================
// MAIN HANDLER
// ============================================
export async function POST(req) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const limited = checkRateLimit(ip);
    if (limited === "minute") return Response.json({ text: "Pelan-pelan, Lur! 😅" });
    if (limited === "day") return Response.json({ text: "Kuota habis, besok lagi ya! 🙏" });

    const { message, tempat, userFeedData } = await req.json();
    if (!message?.trim()) return Response.json({ error: "Pesan kosong" }, { status: 400 });
    
    const safeMsg = message.trim().slice(0, 200);
    const tempatName = tempat?.name || 'sini';
    
    const [weatherData, supabaseResult] = await Promise.all([
      getWeatherFromAPI(tempat?.kode_wilayah || '35.14.01.1001'),
      getDataFromSupabase(tempat?.id).catch(err => {
        console.error("Supabase fetch error:", err);
        return { success: false, data: null };
      })
    ]);
    
    const supabaseData = supabaseResult?.success ? supabaseResult.data : null;
    
    const quickResponse = getQuickResponse(safeMsg, weatherData, supabaseData, tempatName);
    
    // Quick intent: cuaca, antrian, ramai, sepi, cerita, jam buka, cctv
    const isQuickIntent = safeMsg.toLowerCase().match(/^(cuaca|hujan|panas|cerah|mendung|angin|antri|ngantre|queue|ramai|rame|sepi|kondisi|suasana|gimana|cerita|warga|laporan|jam buka|buka jam|jam operasional|cctv|live|pantau)/);
    
    // Gunakan quick response jika:
    // 1. Ini quick intent, ATAU
    // 2. Tidak ada laporan (hasLaporan false)
    if (isQuickIntent || !supabaseData?.hasLaporan) {
      return Response.json({ text: quickResponse });
    }
    
    // Untuk pertanyaan kompleks, coba AI
    const prompt = buildAIPrompt(safeMsg, supabaseData, weatherData, tempatName);
    
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
          max_tokens: 120,
          temperature: 0.6,
          messages: [
            { role: "system", content: "Asisten ramah. Jawab singkat, max 2 kalimat, pakai emoji." },
            { role: "user", content: prompt },
          ],
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeout);
      
      if (!aiResponse.ok) {
        console.error("Groq error:", aiResponse.status);
        return Response.json({ text: quickResponse });
      }
      
      const data = await aiResponse.json();
      let aiText = data.choices?.[0]?.message?.content?.trim();
      
      if (!aiText || aiText.length < 5) {
        return Response.json({ text: quickResponse });
      }
      
      if (!aiText.match(/[😊👋🤗👍🌧️☀️🌙🍃⏳👥🔥⚡🌂☁️⛅]/)) {
        aiText += ` 😊`;
      }
      
      return Response.json({ text: aiText });
      
    } catch (aiError) {
      clearTimeout(timeout);
      console.error("AI timeout/error:", aiError.message);
      return Response.json({ text: quickResponse });
    }
    
  } catch (error) {
    console.error("Chat API Error:", error);
    return Response.json({ text: "Maaf, ada gangguan. Coba lagi ya! 🙏" });
  }
}