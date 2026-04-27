// lib/narasiEngine.js
// Narasi Engine - Mengubah laporan mentah menjadi "Cerita Warga" tidak langsung yang hidup dan natural

/**
 * Membersihkan teks laporan dari sapaan berlebih, kutipan, dan noise
 */
const cleanText = (text) => {
  if (!text || typeof text !== 'string') return "";
  
  return text
    .replace(/^(lur|min|bro|sis|halo|assalamualaikum|permisi|info|hai|hey)\s*,?\s*/gi, "")
    .replace(/["'“”‘’]/g, "")           // hapus semua jenis kutipan
    .replace(/\s+/g, " ")               // normalisasi spasi
    .trim();
};

/**
 * Template narasi dengan gaya "Cerita Warga" (lebih hidup, natural, dan konsisten)
 */
const NARASI_TEMPLATES = {
  Antri: {
    templates: [
      (userName, text) => `Tadi ${userName} sempat bercerita kalau antrean di sini mulai mengular panjang dan warga diminta bersabar.`,
      (userName, text) => `Menurut ${userName}, antrean terlihat cukup panjang. ${text ? `Katanya ${cleanText(text)}` : 'Mungkin karena sedang jam sibuk.'}`,
      (userName, text) => `${userName} mengabarkan bahwa pengunjung harus mengantre lebih lama dari biasanya di lokasi ini.`,
      (userName, text) => `Kabar dari ${userName} menyebutkan antrean cukup padat, sehingga butuh kesabaran ekstra.`,
    ]
  },

  Ramai: {
    templates: [
      (userName, text) => `Barusan ${userName} mengabarkan kalau suasana di sini lagi ramai-ramainya dipenuhi warga.`,
      (userName, text) => `${userName} melihat sendiri betapa ramainya tempat ini. ${text ? `Katanya ${cleanText(text)}` : 'Hampir semua sudut penuh pengunjung.'}`,
      (userName, text) => `Ada cerita dari ${userName} bahwa lokasi ini sedang padat meriah.`,
      (userName, text) => `Menurut penuturan ${userName}, suasana sangat hidup dan banyak warga yang berkumpul.`,
    ]
  },

  Sepi: {
    templates: [
      (userName, text) => `${userName} berbagi cerita kalau suasana di sini masih sangat tenang dan belum banyak pengunjung.`,
      (userName, text) => `Menurut ${userName}, situasinya lagi adem dan lengang. ${text ? `Katanya ${cleanText(text)}` : 'Cocok buat yang ingin santai tanpa keramaian.'}`,
      (userName, text) => `Kabar dari ${userName} menyebutkan tempat ini masih sepi dan terasa nyaman.`,
      (userName, text) => `${userName} merasa suasana saat ini cukup lengang dan tenang.`,
    ]
  },

  Macet: {
    templates: [
      (userName, text) => `${userName} mengingatkan kalau lalu lintas di sekitar sini lagi tersendat parah.`,
      (userName, text) => `Menurut ${userName}, kendaraan mengular panjang dan merayap pelan. ${text ? `Katanya ${cleanText(text)}` : 'Waspada bagi yang akan lewat.'}`,
      (userName, text) => `Ada info dari ${userName} soal kepadatan lalu lintas yang cukup tinggi di jalur ini.`,
      (userName, text) => `Kabar dari ${userName} menyebutkan arus kendaraan sedang macet dan butuh waktu lebih lama.`,
    ]
  },

  default: {
    templates: [
      (userName, text) => `${userName} bercerita kalau ${text ? `${cleanText(text)}` : 'suasana di lokasi terpantau normal dan stabil'}.`,
      (userName, text) => `Menurut penuturan ${userName}, situasi saat ini berjalan seperti biasanya.`,
      (userName, text) => `Kabar dari ${userName} menyebutkan kondisi di lokasi masih cukup kondusif.`,
      (userName, text) => `${userName} melaporkan bahwa tidak ada hal yang terlalu mencolok di lokasi tersebut.`,
    ]
  }
};

// Cache untuk hasil AI
const aiCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 jam

// Rate limiting
let aiRequestCount = 0;
let aiRequestResetTime = Date.now() + 10 * 60 * 1000;

function canCallAI() {
  const now = Date.now();
  if (now > aiRequestResetTime) {
    aiRequestCount = 0;
    aiRequestResetTime = now + 10 * 60 * 1000;
  }
  return aiRequestCount < 30;
}

function incrementAICall() {
  aiRequestCount++;
}

/**
 * Generate narasi menggunakan Groq AI (fallback jika rule-based kurang pas)
 */
async function generateWithGroqAI(originalText, userName, category) {
  const cacheKey = `${userName}_${category}_${originalText.substring(0, 120)}`;
  
  const cached = aiCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.narasi;
  }

  if (!canCallAI()) return null;

  try {
    const response = await fetch('/api/groq-narasi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: `Ubah laporan berikut menjadi cerita warga dalam gaya tidak langsung yang hidup, natural, dan enak dibaca. Maksimal 120 karakter.

Laporan asli: "${originalText}"
Pelapor: ${userName}
Kategori: ${category}

Gunakan gaya seperti:
- "Tadi Budi sempat bercerita kalau antrean di sana mulai mengular panjang."
- "Menurut Ani, suasana lagi ramai banget dipenuhi warga."
- "Kabar dari Citra menyebutkan lalu lintas tersendat parah."

Tulis hanya satu kalimat narasi yang mengalir, tanpa kutipan berlebihan, dan akhiri dengan titik.`
      })
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (data.narasi) {
      incrementAICall();
      let narasi = data.narasi.trim();
      
      // Bersihkan kutipan ganda
      narasi = narasi.replace(/""/g, '"').replace(/"{2,}/g, '"');
      
      // Pastikan diawali huruf kapital dan diakhiri titik
      narasi = narasi.charAt(0).toUpperCase() + narasi.slice(1);
      if (!narasi.endsWith('.')) narasi += '.';

      aiCache.set(cacheKey, { narasi, timestamp: Date.now() });
      return narasi;
    }
    return null;
  } catch (error) {
    console.warn('Groq AI narasi failed:', error);
    return null;
  }
}

/**
 * Generate narasi async (bisa pakai AI jika diperlukan)
 */
export async function generateNarasi(report) {
  if (!report) return null;

  const tipe = report.tipe || 'default';
  const traffic = report.traffic_condition;
  const userName = report.user_name || "Seorang warga";
  const originalText = report.deskripsi || report.content || "";

  // Tentukan kategori
  let category = "default";
  if (traffic === "Macet") category = "Macet";
  else if (tipe === "Antri") category = "Antri";
  else if (tipe === "Ramai" || traffic === "Ramai") category = "Ramai";
  else if (tipe === "Sepi") category = "Sepi";

  const shouldUseAI = 
    originalText.length > 85 ||
    (tipe === "Antri" && originalText.length > 55) ||
    (tipe === "Macet" && (originalText.includes("kecelakaan") || originalText.includes("tabrakan"))) ||
    (tipe === "Ramai" && originalText.includes("viral"));

  // Coba pakai AI dulu jika kondisi terpenuhi
  if (shouldUseAI) {
    const aiNarasi = await generateWithGroqAI(originalText, userName, category);
    if (aiNarasi) return aiNarasi;
  }

  // Fallback ke rule-based
  return generateNarasiSync(report);
}

/**
 * Generate narasi sinkron (hanya rule-based) — cocok untuk useMemo / rendering banyak item
 */
export function generateNarasiSync(report) {
  if (!report) return null;

  const tipe = report.tipe || 'default';
  const traffic = report.traffic_condition;
  const userName = report.user_name || "Seorang warga";
  const originalText = report.deskripsi || report.content || "";

  let category = "default";
  if (traffic === "Macet") category = "Macet";
  else if (tipe === "Antri") category = "Antri";
  else if (tipe === "Ramai" || traffic === "Ramai") category = "Ramai";
  else if (tipe === "Sepi") category = "Sepi";

  const templates = NARASI_TEMPLATES[category] || NARASI_TEMPLATES.default;
  const randomIndex = Math.floor(Math.random() * templates.templates.length);

  let narasi = templates.templates[randomIndex](userName, originalText);

  // Pastikan format yang rapi
  narasi = narasi.charAt(0).toUpperCase() + narasi.slice(1);
  if (!narasi.endsWith('.')) narasi += '.';

  return narasi;
}

export const narasiEngine = {
  generate: generateNarasi,
  generateSync: generateNarasiSync
};

export default narasiEngine;