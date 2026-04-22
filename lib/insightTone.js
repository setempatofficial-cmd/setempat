// lib/insightTone.js

import { supabase } from "@/lib/supabaseClient";

// ==================== CACHE SYSTEM ====================
const descriptionCache = new Map();

function getCacheKey(tempatData) {
  const placeName = getPlaceName(tempatData);
  return `${placeName}-${tempatData.category || 'unknown'}-${tempatData.latest_condition || 'normal'}-${tempatData.avg_estimated_people || 0}`;
}

function getCachedDescription(key) {
  const cached = descriptionCache.get(key);
  if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
    return cached.description;
  }
  return null;
}

function setCacheDescription(key, description) {
  descriptionCache.set(key, {
    description: description,
    timestamp: Date.now()
  });
}

// ==================== HELPER: AMBIL NAMA TEMPAT ====================
function getPlaceName(tempatData) {
  if (!tempatData) return "Lokasi ini";
  
  // Prioritas nama dari berbagai kemungkinan properti
  const name = tempatData.name || 
               tempatData.nama || 
               tempatData.title || 
               tempatData.display_name ||
               tempatData.place_name ||
               null;
  
  if (name && name !== "undefined" && name !== "null") {
    return name;
  }
  
  console.warn("⚠️ Nama tempat tidak ditemukan di:", Object.keys(tempatData));
  return "Lokasi ini";
}

// ==================== AMBIL DATA DARI SUPABASE ====================
async function fetchTempatDataFromDB(tempatId) {
  if (!tempatId) return null;
  
  try {
    const { data, error } = await supabase
      .from('tempat')
      .select(`
        id,
        name,
        category,
        description,
        latest_condition,
        avg_estimated_people,
        has_queue,
        news_keywords,
        alamat,
        vibe_count
      `)
      .eq('id', tempatId)
      .single();
    
    if (error) throw error;
    
    console.log("✅ Data dari Supabase:", data?.name || data?.id);
    return data;
    
  } catch (error) {
    console.error('❌ Gagal ambil data dari Supabase:', error);
    return null;
  }
}

// ==================== AMBIL LAPORAN TERBARU ====================
async function fetchLatestReports(tempatId, limit = 5) {
  if (!tempatId) return [];
  
  try {
    const { data, error } = await supabase
      .from('laporan_warga')
      .select('tipe, deskripsi, created_at, user_id')
      .eq('tempat_id', tempatId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
    
  } catch (error) {
    console.error('❌ Gagal ambil laporan:', error);
    return [];
  }
}

// ==================== HELPER: BUILD NATURAL TONE ====================
function buildNaturalInsight(tempatData) {
  const name = getPlaceName(tempatData);
  const category = tempatData?.category || "";
  const condition = tempatData?.latest_condition || "";
  const avgPeople = tempatData?.avg_estimated_people;
  const hasQueue = tempatData?.has_queue;
  const keywords = tempatData?.news_keywords || [];

  let tone = "";
  let emoji = "";
  let insight = "";

  const isCrowded = condition?.toLowerCase().includes("ramai") || avgPeople > 50;
  const isQuiet = condition?.toLowerCase().includes("sepi") || (avgPeople && avgPeople < 10);
  const isQueue = hasQueue || condition?.toLowerCase().includes("antri");
  const isPeakHour = new Date().getHours() >= 17 && new Date().getHours() <= 20;

  if (isCrowded) {
    tone = "lagi rame banget nih";
    emoji = "🔥";
    if (avgPeople > 100) {
      insight = `Wah, ${name} lagi padat merayap! ${avgPeople}+ orang lagi ngumpul disana.`;
    } else {
      insight = `${name} lagi seru-seruan, banyak pengunjung yang datang.`;
    }
  } 
  else if (isQueue) {
    tone = "antri panjang";
    emoji = "⏰";
    insight = `${name} lagi ada antrian panjang nih. Siap-siap sabar ya!`;
  }
  else if (isQuiet) {
    tone = "lagi adem ayem";
    emoji = "🍃";
    insight = `${name} lagi sepi, cocok buat yang mau tenang.`;
  }
  else if (condition && condition !== "normal" && condition !== "") {
    tone = condition.toLowerCase();
    emoji = getEmojiForCondition(condition);
    insight = `${name} ${condition.toLowerCase()}. ${getAdditionalHint(condition)}`;
  }
  else {
    tone = "beroperasi normal";
    emoji = "✅";
    
    if (isPeakHour) {
      insight = `${name} buka seperti biasa. ${getPeakHourMessage(name)}`;
    } else {
      insight = `${name} sedang berjalan normal. ${getRandomFriendlyMessage()}`;
    }
  }

  if (avgPeople && !isNaN(avgPeople) && avgPeople > 0 && !isCrowded) {
    insight += ` Saat ini sekitar ${avgPeople} orang di lokasi.`;
  }

  if (keywords && keywords.length > 0) {
    const topKeyword = keywords[0];
    if (topKeyword && !insight.includes(topKeyword)) {
      insight += ` ${getKeywordContext(topKeyword, name)}`;
    }
  }

  return { insight, emoji, tone };
}

function getEmojiForCondition(condition) {
  const lower = condition?.toLowerCase() || "";
  if (lower.includes("macet")) return "🚗";
  if (lower.includes("banjir")) return "🌊";
  if (lower.includes("hujan")) return "☔";
  if (lower.includes("panas")) return "☀️";
  if (lower.includes("sepi")) return "🍃";
  if (lower.includes("ramai")) return "🔥";
  return "📍";
}

function getAdditionalHint(condition) {
  const lower = condition?.toLowerCase() || "";
  if (lower.includes("macet")) return "Better siapin waktu ekstra.";
  if (lower.includes("banjir")) return "Hati-hati di jalan ya!";
  if (lower.includes("hujan")) return "Jangan lupa bawa payung.";
  if (lower.includes("panas")) return "Stay hydrated!";
  return "";
}

function getPeakHourMessage(name) {
  const hour = new Date().getHours();
  if (hour >= 18 && hour <= 20) {
    return `${name} mulai ramai jam segini, tapi masih aman kok.`;
  }
  return `Jam segini biasanya mulai rame, tapi masih nyaman.`;
}

function getRandomFriendlyMessage() {
  const messages = [
    "Tenang dan nyaman buat dikunjungi.",
    "Siap menyambut kedatangan kamu.",
    "Lagi asik-asiknya buat nongkrong.",
    "Kondisi mendukung buat bersantai."
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

function getKeywordContext(keyword, name) {
  const lower = keyword?.toLowerCase() || "";
  if (lower.includes("promo")) return `Ada promo menarik nih!`;
  if (lower.includes("event")) return `Lagi ada event seru!`;
  if (lower.includes("baru")) return `Ada yang baru, cobain yuk!`;
  return `${keyword} jadi perbincangan nih.`;
}

// ==================== AI CALL ====================
async function callGenerateAIDescription(tempatData) {
  try {
    const placeName = getPlaceName(tempatData);
    console.log("🤖 Memanggil API generate-description untuk:", placeName);
    
    const response = await fetch('/api/generate-description', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: placeName,
        category: tempatData?.category,
        vibe: tempatData?.latest_condition,
        avgPeople: tempatData?.avg_estimated_people,
        hasQueue: tempatData?.has_queue,
        keywords: tempatData?.news_keywords
      })
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log("✅ AI response:", data);
    return data.description;
    
  } catch (error) {
    console.error('AI generation failed:', error);
    return null;
  }
}

// ==================== MAIN FUNCTION (HANYA SATU) ====================
export async function generateDescriptionInsight(tempatData, locationName = "Sekitar") {
  console.log("🎯 generateDescriptionInsight dipanggil");
  
  // Validasi input
  if (!tempatData || typeof tempatData !== 'object') {
    return {
      text: `📍 ${locationName}`,
      author: locationName,
      icon: "📍",
      time: "Live",
      isAi: false,
      sourceLabel: "TEMPAT",
      sourceType: "system",
      tipe: "Info",
      isUrgent: false
    };
  }

  // 🔥 PERBAIKAN: Jika hanya ID, ambil dari database
  let enrichedData = { ...tempatData };
  
  if (tempatData.id && !getPlaceName(tempatData)) {
    console.log("🔍 Nama tempat kosong, mengambil dari database...");
    const dbData = await fetchTempatDataFromDB(tempatData.id);
    if (dbData) {
      enrichedData = { ...tempatData, ...dbData };
    }
  }

  // Pastikan nama tempat ada
  const placeName = getPlaceName(enrichedData) || locationName;
  console.log("📛 Nama tempat:", placeName);

  // Cek cache dengan nama yang benar
  const cacheKey = getCacheKey({ ...enrichedData, name: placeName });
  const cachedDescription = getCachedDescription(cacheKey);
  
  let description = null;
  let usedAI = false;
  let customEmoji = "📍";
  let customTone = "";

  // PRIORITAS 1: Pakai description dari database
  if (enrichedData.description && enrichedData.description.trim() !== "") {
    const natural = buildNaturalInsight({ ...enrichedData, name: placeName });
    description = natural.insight;
    customEmoji = natural.emoji;
    customTone = natural.tone;
    console.log(`✅ Using database description for: ${placeName}`);
  }
  
  // PRIORITAS 2: Gunakan cache
  if (!description && cachedDescription) {
    const natural = buildNaturalInsight({ ...enrichedData, name: placeName });
    description = natural.insight;
    customEmoji = natural.emoji;
    customTone = natural.tone;
    console.log(`✅ Using cached insight for: ${placeName}`);
  }

  // PRIORITAS 3: Generate dengan AI
  if (!description && placeName !== "Lokasi ini") {
    console.log(`🤖 Generating AI insight for: ${placeName}`);
    const aiDescription = await callGenerateAIDescription({ ...enrichedData, name: placeName });
    if (aiDescription) {
      description = aiDescription;
      usedAI = true;
      setCacheDescription(cacheKey, description);
    } else {
      const natural = buildNaturalInsight({ ...enrichedData, name: placeName });
      description = natural.insight;
      customEmoji = natural.emoji;
    }
  }

  // PRIORITAS 4: Ultimate fallback
  if (!description) {
    const natural = buildNaturalInsight({ ...enrichedData, name: placeName });
    description = natural.insight || `${placeName} ${natural.tone || "lagi biasa aja"}. Yuk mampir!`;
    customEmoji = natural.emoji;
  }

  // Potong jika kepanjangan
  let text = description;
  if (text.length > 120) {
    text = text.substring(0, 117) + "...";
  }

  // Pilih icon
  let icon = customEmoji;
  let label = "INFO TEMPAT";
  const category = (enrichedData.category || "").toLowerCase();
  
  if (!icon || icon === "📍") {
    if (category.includes("makan") || category.includes("kuliner")) {
      icon = "🍽️";
      label = "KULINER";
    } else if (category.includes("wisata") || category.includes("alam")) {
      icon = "🏞️";
      label = "WISATA";
    } else if (category.includes("belanja") || category.includes("mall")) {
      icon = "🛍️";
      label = "BELANJA";
    } else if (category.includes("ibadah")) {
      icon = "🕌";
      label = "IBADAH";
    }
  }

  const isUrgent = /(macet|banjir|kecelakaan|darurat|longsor|kebakaran)/i.test(text);

  return {
    text: text,
    author: placeName,
    icon: icon,
    time: "Live",
    isAi: usedAI,
    sourceLabel: usedAI ? "AI INSIGHT" : label,
    sourceType: usedAI ? "ai" : "database",
    tipe: isUrgent ? "Penting" : "Info",
    estimated_people: enrichedData.avg_estimated_people || null,
    isUrgent: isUrgent,
    isDescription: true
  };
}

// ==================== FALLBACK UNTUK SIGNAL ====================
export function generateFallbackInsight(locationName = "Sekitar") {
  const messages = [
    `📍 ${locationName} lagi tenang-tenangnya. Cocok buat santai.`,
    `✨ ${locationName} beroperasi normal. Yuk mampir!`,
    `🍃 Suasana ${locationName} lagi adem. Waktu yang tepat berkunjung.`,
    `📢 Belum ada laporan terbaru dari ${locationName}. Semua aman terkendali.`,
    `👍 ${locationName} dalam kondisi baik. Nikmati harimu!`
  ];
  
  const randomMsg = messages[Math.floor(Math.random() * messages.length)];
  
  return {
    text: randomMsg,
    author: locationName,
    icon: "📍",
    time: "Live",
    isAi: false,
    sourceLabel: "INFO",
    sourceType: "system",
    tipe: "Info",
    isUrgent: false
  };
}