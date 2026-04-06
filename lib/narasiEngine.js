// lib/narasiEngine.js
// Narasi Engine - Mengubah laporan mentah menjadi cerita tidak langsung yang hidup

// Template narasi berdasarkan kategori (rule-based fallback)
const NARASI_TEMPLATES = {
  Antri: {
    templates: [
      (userName, originalText) => `${userName} melaporkan antrean mengular di sini. ${originalText ? `"${originalText.substring(0, 60)}${originalText.length > 60 ? '...' : ''}"` : 'Warga diminta bersabar karena antrean cukup panjang.'}`,
      (userName, originalText) => `Menurut ${userName}, pengunjung harus bersabar karena antrean cukup panjang. ${originalText ? originalText.substring(0, 80) : ''}`,
      (userName, originalText) => `"Antrean panjang nih," kata ${userName}. ${originalText ? originalText.substring(0, 60) : 'Warga lain juga mengonfirmasi hal serupa.'}`,
      (userName, originalText) => `${userName} melihat puluhan orang mengantre. ${originalText ? `"${originalText}"` : 'Suasana cukup padat.'}`
    ]
  },
  Ramai: {
    templates: [
      (userName, originalText) => `${userName} melihat suasana ramai dipenuhi warga. ${originalText ? `"${originalText.substring(0, 60)}${originalText.length > 60 ? '...' : ''}"` : 'Banyak pengunjung yang nongkrong.'}`,
      (userName, originalText) => `"Lagi rame banget," ujar ${userName}. ${originalText ? originalText.substring(0, 60) : 'Banyak warga yang berkumpul di sini.'}`,
      (userName, originalText) => `${userName} melaporkan tempat ini sedang ramai pengunjung. ${originalText ? originalText.substring(0, 80) : 'Suasana hangat dan meriah.'}`,
      (userName, originalText) => `Menurut ${userName}, tempat ini dipadati warga. ${originalText ? `"${originalText.substring(0, 50)}..."` : 'Waktu terbaik untuk datang mungkin lebih awal.'}`
    ]
  },
  Sepi: {
    templates: [
      (userName, originalText) => `${userName} mengatakan suasana masih sepi dan tenang. ${originalText ? `"${originalText.substring(0, 60)}${originalText.length > 60 ? '...' : ''}"` : 'Cocok untuk yang ingin santai tanpa keramaian.'}`,
      (userName, originalText) => `"Sepi pengunjung, cocok buat santai," kata ${userName}. ${originalText ? originalText.substring(0, 60) : 'Tempat masih lega dan nyaman.'}`,
      (userName, originalText) => `${userName} melaporkan belum banyak aktivitas terlihat. ${originalText ? originalText.substring(0, 80) : 'Suasana adem dan tenang.'}`,
      (userName, originalText) => `${userName} menikmati suasana lengang. ${originalText ? `"${originalText}"` : 'Waktu yang tepat untuk berkunjung.'}`
    ]
  },
  Macet: {
    templates: [
      (userName, originalText) => `${userName} melaporkan kemacetan di sekitar sini. ${originalText ? `"${originalText.substring(0, 60)}${originalText.length > 60 ? '...' : ''}"` : 'Waspada bagi yang melewati jalur ini.'}`,
      (userName, originalText) => `"Macet parah, waspada ya," ujar ${userName}. ${originalText ? originalText.substring(0, 60) : 'Arus kendaraan tersendat.'}`,
      (userName, originalText) => `${userName} melihat lalu lintas padat merayap. ${originalText ? originalText.substring(0, 80) : 'Butuh kesabaran ekstra melewati jalur ini.'}`,
      (userName, originalText) => `Menurut ${userName}, kendaraan mengular panjang. ${originalText ? `"${originalText.substring(0, 50)}..."` : 'Siapkan waktu lebih jika melewati sini.'}`
    ]
  },
  default: {
    templates: [
      (userName, originalText) => `${userName} berbagi pengalaman: "${originalText ? originalText.substring(0, 80) : 'Kondisi normal, tidak ada laporan khusus'}"`,
      (userName, originalText) => `Menurut ${userName}, ${originalText ? originalText.substring(0, 80) : 'suasana berjalan normal seperti biasa.'}`,
      (userName, originalText) => `${userName} melaporkan: ${originalText ? originalText.substring(0, 80) : 'Tidak ada kejadian signifikan.'}`
    ]
  }
};

// Cache untuk AI
const aiCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 jam

// Rate limiting: maksimal 30 request per 10 menit
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

async function generateWithGroqAI(originalText, userName, tipe) {
  const cacheKey = `${userName}_${tipe}_${originalText.substring(0, 100)}`;
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
        prompt: `Ubah laporan warga berikut menjadi cerita tidak langsung yang hidup dan natural, maksimal 100 karakter.
Laporan asli: "${originalText}"
Pelapor: ${userName}
Tipe: ${tipe}

Contoh gaya:
- "Budi melihat antrean mengular di sini. 'Antrean panjang nih,' katanya."
- "Menurut Ani, suasana masih sepi dan tenang. Cocok buat yang ingin santai."
- "Citra melaporkan tempat ini sedang ramai pengunjung. Banyak warga nongkrong."

Tulis narasinya (tanpa kutipan berlebihan):`
      })
    });
    
    if (!response.ok) return null;
    const data = await response.json();
    
    if (data.narasi) {
      incrementAICall();
      let narasi = data.narasi.trim();
      // Bersihkan kutipan berlebihan
      narasi = narasi.replace(/""/g, '"').replace(/"{2,}/g, '"');
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
 * Generate narasi tidak langsung dari laporan (dengan AI untuk kasus tertentu)
 * @param {Object} report - Laporan warga (tipe, deskripsi, user_name, created_at)
 * @returns {string} Narasi yang sudah diolah
 */
export async function generateNarasi(report) {
  if (!report) return null;
  
  const tipe = report.tipe || 'default';
  const traffic = report.traffic_condition;
  const userName = report.user_name || "Warga";
  const originalText = report.deskripsi || report.content || "";
  
  // Tentukan kategori narasi
  let category = tipe;
  if (traffic === "Macet") category = "Macet";
  else if (traffic === "Ramai" && !tipe) category = "Ramai";
  else if (!tipe && !traffic) category = "default";
  
  // Gunakan AI untuk laporan yang panjang atau kompleks
  const shouldUseAI = originalText.length > 80 || 
                      (tipe === "Antri" && originalText.length > 50) ||
                      (tipe === "Ramai" && originalText.includes("viral")) ||
                      (tipe === "Macet" && originalText.includes("kecelakaan"));
  
  if (shouldUseAI) {
    const aiNarasi = await generateWithGroqAI(originalText, userName, category);
    if (aiNarasi) return aiNarasi;
  }
  
  // Fallback ke rule-based
  const templates = NARASI_TEMPLATES[category] || NARASI_TEMPLATES.default;
  const randomIndex = Math.floor(Math.random() * templates.templates.length);
  let narasi = templates.templates[randomIndex](userName, originalText);
  
  narasi = narasi.replace(/""/g, '"').replace(/"{2,}/g, '"');
  
  return narasi;
}

/**
 * Generate narasi sinkron (tanpa async, untuk useMemo) - hanya rule-based
 */
export function generateNarasiSync(report) {
  if (!report) return null;
  
  const tipe = report.tipe || 'default';
  const traffic = report.traffic_condition;
  const userName = report.user_name || "Warga";
  const originalText = report.deskripsi || report.content || "";
  
  let category = tipe;
  if (traffic === "Macet") category = "Macet";
  else if (traffic === "Ramai" && !tipe) category = "Ramai";
  else if (!tipe && !traffic) category = "default";
  
  const templates = NARASI_TEMPLATES[category] || NARASI_TEMPLATES.default;
  const randomIndex = Math.floor(Math.random() * templates.templates.length);
  let narasi = templates.templates[randomIndex](userName, originalText);
  
  narasi = narasi.replace(/""/g, '"').replace(/"{2,}/g, '"');
  
  return narasi;
}

export const narasiEngine = {
  generate: generateNarasi,
  generateSync: generateNarasiSync
};

export default narasiEngine;