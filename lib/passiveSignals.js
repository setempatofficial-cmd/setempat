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
 * Mapping level cuaca ke bobot
 */
const WEATHER_LEVELS = {
  normal: 0,
  hujan_ringan: 2,
  kabut: 2,
  berawan: 1,
  hujan_sedang: 3,
  hujan_lebat: 4,
  hujan_petir: 5,
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

    // 3. Story View (dari tabel story_views)
    const { count: storyCount, error: storyError } = await supabase
      .from("story_views")
      .select("*", { count: "exact", head: true })
      .eq("laporan_id", tempatId)
      .gte("viewed_at", isoTime);

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
 * 🔥 Konversi data cuaca ke format signal
 * @param {Object} weatherData - Data cuaca dari API
 * @returns {Object|null} Weather signal
 */
export function getWeatherSignal(weatherData) {
  if (!weatherData || !weatherData.condition) return null;

  // Mapping kondisi cuaca ke level
  const getWeatherLevel = (condition) => {
    const levelMap = {
      'Cerah': 1,
      'Cerah Berawan': 1,
      'Berawan': 2,
      'Berawan Tebal': 2,
      'Kabut': 3,
      'Hujan Ringan': 3,
      'Hujan Sedang': 4,
      'Hujan Lebat': 4,
      'Hujan Petir': 5
    };
    return levelMap[condition] || 1;
  };

  // Mapping kondisi cuaca ke status text
  const getWeatherStatusText = (condition, temp) => {
    const statusMap = {
      'Cerah': `☀️ Cerah`,
      'Cerah Berawan': `⛅ Cerah Berawan`,
      'Berawan': `☁️ Berawan`,
      'Berawan Tebal': `☁️☁️ Mendung`,
      'Hujan Ringan': `🌧️ Hujan Ringan`,
      'Hujan Sedang': `🌧️🌧️ Hujan Sedang`,
      'Hujan Lebat': `⛈️ Hujan Lebat`,
      'Hujan Petir': `⚡🌧️ Hujan Petir`,
      'Kabut': `🌫️ Kabut`
    };
    return `${statusMap[condition] || condition} ${temp ? `(${temp}°C)` : ''}`;
  };

  const level = getWeatherLevel(weatherData.condition);
  const isExtreme = level >= 4;
  const isWarning = level >= 3;
  const isHujan = weatherData.condition.includes('Hujan');

  return {
    type: 'weather',
    condition: weatherData.condition,
    temp: weatherData.temp,
    humidity: weatherData.humidity,
    windSpeed: weatherData.windSpeed,
    icon: weatherData.icon,
    short: weatherData.short,
    level: level,
    isExtreme,
    isWarning,
    isHujan,
    statusText: getWeatherStatusText(weatherData.condition, weatherData.temp),
    vibe: isExtreme 
      ? '⚠️ Cuaca ekstrem, hindari aktivitas luar ruangan!' 
      : isWarning 
        ? '🌧️ Waspada perubahan cuaca, bawa perlengkapan hujan'
        : isHujan
          ? '☔ Hujan, waspada jalan licin'
          : '☀️ Cuaca cerah, mendukung aktivitas',
    color: isExtreme ? 'text-red-600' : isWarning ? 'text-amber-600' : isHujan ? 'text-blue-600' : 'text-emerald-600',
    bgColor: isExtreme ? 'bg-red-50' : isWarning ? 'bg-amber-50' : isHujan ? 'bg-blue-50' : 'bg-emerald-50',
    borderColor: isExtreme ? 'border-red-200' : isWarning ? 'border-amber-200' : isHujan ? 'border-blue-200' : 'border-emerald-200'
  };
}

/**
 * 🔥 Gabungkan passive signal dengan weather signal
 * @param {number} tempatId - ID tempat
 * @param {number} hours - Rentang waktu
 * @param {Object} weatherData - Data cuaca (opsional)
 * @returns {Promise<Object>} Combined signals
 */
export async function getCombinedSignals(tempatId, hours = 4, weatherData = null) {
  const passiveSignals = await getPassiveSignals(tempatId, hours);
  
  if (!passiveSignals) {
    if (weatherData) {
      return {
        weather: getWeatherSignal(weatherData),
        total: 1,
        hasWeatherAlert: getWeatherSignal(weatherData)?.isWarning || false,
        hasExtremeWeather: getWeatherSignal(weatherData)?.isExtreme || false,
      };
    }
    return null;
  }

  let result = { ...passiveSignals };
  
  if (weatherData) {
    const weatherSignal = getWeatherSignal(weatherData);
    if (weatherSignal) {
      result.weather = weatherSignal;
      result.hasWeatherAlert = weatherSignal.isWarning || weatherSignal.isExtreme;
      result.hasExtremeWeather = weatherSignal.isExtreme;
      result.total = passiveSignals.total + 1;
      
      // Override level jika cuaca ekstrem
      if (weatherSignal.isExtreme) {
        result.level = 'danger';
        result.isCrowded = true;
      } else if (weatherSignal.isWarning && passiveSignals.level !== 'ramai') {
        result.level = 'waspada';
      }
    }
  }
  
  return result;
}

/**
 * Generate text untuk header status dari passive signal (dengan weather priority)
 */
export function getPassiveStatusText(passiveSignal) {
  if (!passiveSignal) return null;

  // 🔥 PRIORITAS 1: Cuaca Ekstrem
  if (passiveSignal.weather?.isExtreme) {
    return {
      text: passiveSignal.weather.statusText,
      color: passiveSignal.weather.color,
      bgColor: passiveSignal.weather.bgColor,
      icon: passiveSignal.weather.icon,
      badge: "⚠️ CUACA EKSTREM",
      vibe: passiveSignal.weather.vibe,
      level: 5,
      isWeather: true,
    };
  }

  // 🔥 PRIORITAS 2: Peringatan Cuaca
  if (passiveSignal.weather?.isWarning) {
    return {
      text: passiveSignal.weather.statusText,
      color: passiveSignal.weather.color,
      bgColor: passiveSignal.weather.bgColor,
      icon: passiveSignal.weather.icon,
      badge: passiveSignal.weather.isHujan ? "🌧️ HUJAN" : "⚠️ PERUBAHAN CUACA",
      vibe: passiveSignal.weather.vibe,
      level: 3,
      isWeather: true,
    };
  }

  // PRIORITAS 3: Cuaca Normal (tampil jika tidak ada aktivitas)
  if (passiveSignal.weather && passiveSignal.total <= 1 && !passiveSignal.viewDetail) {
    return {
      text: passiveSignal.weather.statusText,
      color: passiveSignal.weather.color,
      bgColor: passiveSignal.weather.bgColor,
      icon: passiveSignal.weather.icon,
      badge: passiveSignal.weather.isHujan ? "☔ HUJAN" : "☀️ CERAH",
      vibe: passiveSignal.weather.vibe,
      level: 1,
      isWeather: true,
    };
  }

  // PRIORITAS 4: Aktivitas Ramai
  if (passiveSignal.level === "ramai") {
    return {
      text: `🔥 RAMAI (${passiveSignal.viewDetail} lihat)`,
      color: "text-red-500",
      bgColor: "bg-red-500",
      icon: "🔥",
      badge: "RAMAI",
      vibe: `${passiveSignal.viewDetail} orang melihat detail`,
      level: 4,
    };
  }

  // PRIORITAS 5: Aktivitas Minat
  if (passiveSignal.level === "minat") {
    return {
      text: `👀 MINAT (${passiveSignal.viewDetail} lihat)`,
      color: "text-yellow-500",
      bgColor: "bg-yellow-500",
      icon: "👀",
      badge: "MINAT",
      vibe: `${passiveSignal.viewDetail} orang melihat detail`,
      level: 2,
    };
  }

  // PRIORITAS 6: Cuaca Normal (tanpa aktivitas)
  if (passiveSignal.weather) {
    return {
      text: passiveSignal.weather.statusText,
      color: passiveSignal.weather.color,
      bgColor: passiveSignal.weather.bgColor,
      icon: passiveSignal.weather.icon,
      badge: "NORMAL",
      vibe: passiveSignal.weather.vibe,
      level: 1,
      isWeather: true,
    };
  }

  return null;
}

/**
 * Generate ringkasan untuk expand dari passive signal (dengan weather)
 */
export function getPassiveRingkasan(passiveSignal, placeName = "tempat ini") {
  if (!passiveSignal) return null;

  const { viewDetail, like, storyView, total, hours, weather } = passiveSignal;
  const hour = new Date().getHours();
  const isEvening = hour >= 18 || hour <= 4;

  let ringkasan = "";

  // 🔥 PRIORITAS 1: Cuaca Ekstrem
  if (weather?.isExtreme) {
    ringkasan = `⚠️ PERINGATAN CUACA EKSTREM! ${weather.statusText}. ${weather.vibe}\n\n`;
    ringkasan += `📊 Data Cuaca:\n`;
    ringkasan += `🌡️ Suhu: ${weather.temp}°C\n`;
    ringkasan += `💧 Kelembaban: ${weather.humidity}%\n`;
    ringkasan += `💨 Angin: ${weather.windSpeed} km/jam\n\n`;
    
    if (viewDetail > 0) {
      ringkasan += `👥 ${viewDetail} orang melihat detail ${placeName} dalam ${hours} jam terakhir.`;
    } else {
      ringkasan += `⚠️ Disarankan untuk menghindari aktivitas luar ruangan jika tidak mendesak.`;
    }
    
    return ringkasan;
  }

  // 🔥 PRIORITAS 2: Peringatan Cuaca
  if (weather?.isWarning) {
    ringkasan = `🌧️ INFO CUACA: ${weather.statusText}. ${weather.vibe}\n\n`;
    
    if (weather.temp) ringkasan += `🌡️ Suhu: ${weather.temp}°C | `;
    if (weather.humidity) ringkasan += `💧 Kelembaban: ${weather.humidity}%\n`;
    
    if (viewDetail > 0) {
      ringkasan += `\n👥 ${viewDetail} orang melihat detail ${placeName} dalam ${hours} jam terakhir.`;
    } else {
      ringkasan += `\n☔ Jangan lupa bawa perlengkapan hujan jika berpergian.`;
    }
    
    return ringkasan;
  }

  // PRIORITAS 3: Aktivitas Ramai + Cuaca
  if (passiveSignal.isCrowded) {
    if (isEvening) {
      ringkasan = `🌙 Malam ini, ${viewDetail} orang melihat detail ${placeName}. Suasana sedang ramai! 🔥`;
    } else {
      ringkasan = `🔥 ${viewDetail} orang melihat detail ${placeName} dalam ${hours} jam terakhir. Tempat ini sedang ramai diperhatikan! 👀`;
    }
    
    if (weather && !weather.isWarning && !weather.isExtreme && weather.isHujan) {
      ringkasan += `\n\n☔ Meskipun ${weather.short.toLowerCase()}, tetap ramai peminat!`;
    } else if (weather && !weather.isWarning) {
      ringkasan += `\n\n${weather.icon} Cuaca: ${weather.short} ${weather.temp}°C`;
    }
  } 
  // PRIORITAS 4: Aktivitas Minat + Cuaca
  else if (passiveSignal.level === "minat") {
    if (isEvening) {
      ringkasan = `🌙 ${viewDetail} orang melihat detail ${placeName} malam ini. Mulai menarik minat. ✨`;
    } else {
      ringkasan = `👀 ${viewDetail} orang melihat detail ${placeName} dalam ${hours} jam terakhir. Mulai menarik perhatian. 📍`;
    }
    
    if (weather && !weather.isWarning && !weather.isExtreme) {
      ringkasan += `\n\n${weather.icon} Cuaca ${weather.short} mendukung untuk berkunjung.`;
    }
  }
  // PRIORITAS 5: Hanya Cuaca
  else if (weather) {
    if (weather.isHujan) {
      ringkasan = `☔ Cuaca: ${weather.statusText}. ${weather.vibe}\n\n`;
      ringkasan += `🌡️ ${weather.temp}°C • 💧 ${weather.humidity}% • 💨 ${weather.windSpeed} km/jam`;
    } else {
      ringkasan = `${weather.icon} Cuaca: ${weather.statusText}. ${weather.vibe}\n\n`;
      ringkasan += `🌡️ ${weather.temp}°C • 💧 ${weather.humidity}%`;
    }
    
    if (viewDetail > 0) {
      ringkasan += `\n\n👥 ${viewDetail} orang melihat detail ${placeName} dalam ${hours} jam terakhir.`;
    }
  }
  // PRIORITAS 6: Tidak ada aktivitas & cuaca
  else {
    ringkasan = `Belum ada aktivitas signifikan dalam ${hours} jam terakhir.`;
  }

  // Tambahan detail like & story jika ada
  const details = [];
  if (like > 0) details.push(`❤️ ${like} menyukai`);
  if (storyView > 0) details.push(`📖 ${storyView} melihat story`);

  if (details.length > 0 && !weather?.isExtreme && !weather?.isWarning) {
    ringkasan += `\n\n${details.join(" • ")}`;
  }

  return ringkasan;
}

/**
 * 🔥 Get weather priority level untuk sorting/peringatan
 */
export function getWeatherPriority(weatherData) {
  if (!weatherData) return 0;
  
  const priorityMap = {
    'Hujan Petir': 100,
    'Hujan Lebat': 90,
    'Hujan Sedang': 70,
    'Hujan Ringan': 50,
    'Kabut': 40,
    'Berawan Tebal': 30,
    'Berawan': 20,
    'Cerah Berawan': 10,
    'Cerah': 5
  };
  
  return priorityMap[weatherData.condition] || 0;
}