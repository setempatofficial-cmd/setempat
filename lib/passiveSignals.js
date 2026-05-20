// lib/passiveSignals.js
import { supabase } from "@/lib/supabaseClient";

/**
 * Bobot setiap jenis aktivitas user
 * - view_detail: paling kuat (user sengaja buka halaman)
 * - like: cukup kuat
 * - story_view: paling lemah (bisa auto-play)
 */
const ACTIVITY_WEIGHTS = {
  view_detail: 3,
  like: 1,
  story_view: 0.5,
};

/**
 * Hitung semua passive signal untuk suatu tempat
 * @param {number} tempatId - ID tempat
 * @param {number} hours - Rentang waktu dalam jam (default 4)
 * @returns {Promise<Object>} Hasil agregasi passive signal
 */
export async function getPassiveSignals(tempatId, hours = 4) {
  if (!tempatId) return null;

  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - hours);
  const isoTime = cutoffTime.toISOString();

  try {
    // 1. View Detail (dari external_signals)
    const { count: viewCount, error: viewError } = await supabase
      .from("external_signals")
      .select("*", { count: "exact", head: true })
      .eq("tempat_id", tempatId)
      .eq("source", "user_activity")
      .eq("content", "view_detail")
      .gte("created_at", isoTime);

    if (viewError) console.warn("View detail error:", viewError);

    // 2. Like (dari tabel likes)
    const { count: likeCount, error: likeError } = await supabase
      .from("likes")
      .select("*", { count: "exact", head: true })
      .eq("tempat_id", tempatId)
      .gte("created_at", isoTime);

    if (likeError) console.warn("Like error:", likeError);

    // 3. Story View (dari tabel story_view)
    const { count: storyCount, error: storyError } = await supabase
      .from("story_views")  // ← SUDAH BENAR (jamak)
      .select("*", { count: "exact", head: true })
      .eq("laporan_id", tempatId)  // 
      .gte("viewed_at", isoTime);  // 

    if (storyError) console.warn("Story view error:", storyError);

    const rawData = {
      viewDetail: viewCount || 0,
      like: likeCount || 0,
      storyView: storyCount || 0,
    };

    const totalRaw = rawData.viewDetail + rawData.like + rawData.storyView;
    const weightedScore =
      rawData.viewDetail * ACTIVITY_WEIGHTS.view_detail +
      rawData.like * ACTIVITY_WEIGHTS.like +
      rawData.storyView * ACTIVITY_WEIGHTS.story_view;

    // Tentukan level berdasarkan weighted score
    let level = "normal";
    let isCrowded = false;

    if (weightedScore > 30 || rawData.viewDetail > 10) {
      level = "ramai";
      isCrowded = true;
    } else if (weightedScore > 10 || rawData.viewDetail > 3) {
      level = "minat";
      isCrowded = false;
    }

    return {
      level,
      isCrowded,
      weightedScore,
      total: totalRaw,
      ...rawData,
      hours,
    };
  } catch (err) {
    console.error("Error fetching passive signals:", err);
    return null;
  }
}

/**
 * Generate text untuk header status dari passive signal
 */
export function getPassiveStatusText(passiveSignal) {
  if (!passiveSignal || passiveSignal.total === 0) return null;

  if (passiveSignal.level === "ramai") {
    return {
      text: `🔥 RAMAI (${passiveSignal.viewDetail} melihat)`,
      color: "text-red-500",
      bgColor: "bg-red-500",
      icon: "🔥",
      badge: "RAMAI",
      vibe: `${passiveSignal.viewDetail} orang melihat detail`,
      level: 3,
    };
  }

  if (passiveSignal.level === "minat") {
    return {
      text: `👀 MINAT (${passiveSignal.viewDetail} melihat)`,
      color: "text-yellow-500",
      bgColor: "bg-yellow-500",
      icon: "👀",
      badge: "MINAT",
      vibe: `${passiveSignal.viewDetail} orang melihat detail`,
      level: 2,
    };
  }

  return null;
}

/**
 * Generate ringkasan untuk expand dari passive signal
 */
export function getPassiveRingkasan(passiveSignal, placeName = "tempat ini") {
  if (!passiveSignal || passiveSignal.total === 0) return null;

  const { viewDetail, like, storyView, total, hours } = passiveSignal;
  const hour = new Date().getHours();
  const isEvening = hour >= 18 || hour <= 4;

  let ringkasan = "";

  if (passiveSignal.isCrowded) {
    if (isEvening) {
      ringkasan = `🌙 Malam ini, ${viewDetail} orang melihat detail ${placeName}. Suasana sedang ramai! 🔥`;
    } else {
      ringkasan = `🔥 ${viewDetail} orang melihat detail ${placeName} dalam ${hours} jam terakhir. Tempat ini sedang ramai diperhatikan! 👀`;
    }
  } else {
    if (isEvening) {
      ringkasan = `🌙 ${viewDetail} orang melihat detail ${placeName} malam ini. Mulai menarik minat. ✨`;
    } else {
      ringkasan = `👀 ${viewDetail} orang melihat detail ${placeName} dalam ${hours} jam terakhir. Mulai menarik perhatian. 📍`;
    }
  }

  // Tambahan detail like & story jika ada
  const details = [];
  if (like > 0) details.push(`❤️ ${like} menyukai`);
  if (storyView > 0) details.push(`📖 ${storyView} melihat story`);

  if (details.length > 0) {
    ringkasan += `\n\n${details.join(" • ")}`;
  }

  return ringkasan;
}