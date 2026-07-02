// lib/passiveSignals.js

import { supabase } from "@/lib/supabaseClient";
import { generateStatusText } from "./generateStatusText";
import { generateRingkasanMultiUser } from "./generateRingkasanMultiUser";

/**
 * Bobot setiap jenis aktivitas user
 */
const ACTIVITY_WEIGHTS = {
  view_detail: 3,
  like: 1,
  story_view: 0.5,
};

// 🔥 PERBAIKAN: peta langsung dari `content` (nilai bersih, persis action.tipe
// yang dikirim SmartCitizenButton, misal "Ramai", "Padat", "MacetTotal") ke
// tipe internal yang dipahami generateStatusText. Ini menghindari bug lama
// yang men-scan `original_text` (mis. "Ramai: Nyaris Penuh") sehingga kata
// "penuh" di deskripsi ikut ke-detect dan menimpa tipe aslinya.
const DIRECT_TIPE_MAP = {
  sepi: "sepi",
  ramai: "ramai",
  antri: "antri",
  penuh: "penuh",
  padat: "padat",
  tutup: "tutup",
  lancar: "lancar",
  macet: "macet",
  macettotal: "macet_total",
  hujan: "hujan",
  kosong: "kosong",
  tersedia: "tersedia",
  hampirpenuh: "hampir_penuh",
  kecelakaan: "kecelakaan",
};

function resolveTipeFromCitizenReport(latestCitizen) {
  // PRIORITAS 1: field `content`, yang diisi persis dengan action.tipe
  // saat tombol SmartCitizenButton ditekan (mis. "Ramai", "Padat", "Tutup")
  const rawTipe = String(latestCitizen?.content || "").toLowerCase().replace(/[^a-z]/g, "");
  if (DIRECT_TIPE_MAP[rawTipe]) return DIRECT_TIPE_MAP[rawTipe];

  // PRIORITAS 2 (fallback): scan teks bebas untuk laporan lama / manual
  // yang tidak melalui tombol (mis. diketik langsung ke original_text)
  const lowerContent = String(latestCitizen?.original_text || latestCitizen?.content || "").toLowerCase();

  if (lowerContent.includes('kecelakaan') || lowerContent.includes('tabrakan')) return 'kecelakaan';
  if (lowerContent.includes('macet total') || lowerContent.includes('stuck total')) return 'macet_total';
  if (lowerContent.includes('macet') || lowerContent.includes('merayap')) return 'macet';
  if (lowerContent.includes('hujan') || lowerContent.includes('gerimis') || lowerContent.includes('deras')) return 'hujan';
  if (lowerContent.includes('tutup')) return 'tutup';
  if (lowerContent.includes('penuh') || lowerContent.includes('sesak')) return 'penuh';
  if (lowerContent.includes('padat')) return 'padat';
  if (lowerContent.includes('antri') || lowerContent.includes('ngantri')) return 'antri';
  if (lowerContent.includes('ramai') || lowerContent.includes('rame')) return 'ramai';
  if (lowerContent.includes('sepi') || lowerContent.includes('kosong') || lowerContent.includes('lengang')) return 'sepi';

  return 'normal';
}

/**
 * 🔥 GET PASSIVE SIGNALS - Versi Lengkap dengan Filter
 */
export async function getPassiveSignals(tempatId, hours = 4) {
  if (!tempatId) return null;

  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - hours);
  const isoTime = cutoffTime.toISOString();

  try {
    // 🔥 QUERY 1: Citizen Click (source = 'citizen_click')
    const { data: citizenData, error: citizenDataError } = await supabase
      .from("external_signals")
      .select("content, original_text, username, created_at, source_id")
      .eq("tempat_id", tempatId)
      .eq("source", "citizen_click")
      .gte("created_at", isoTime)
      .order("created_at", { ascending: false })
      .limit(5);

    if (citizenDataError) console.warn("Citizen data error:", citizenDataError);

    // 🔥 QUERY 2: View Detail
    const { count: viewCount, error: viewError } = await supabase
      .from("external_signals")
      .select("*", { count: "exact", head: true })
      .eq("tempat_id", tempatId)
      .eq("source", "user_activity")
      .eq("content", "view_detail")
      .gte("created_at", isoTime);

    if (viewError) console.warn("View detail error:", viewError);

    // 🔥 QUERY 3: Unique Viewers
    const { data: viewDetailData, error: viewDetailDataError } = await supabase
      .from("external_signals")
      .select("source_id")
      .eq("tempat_id", tempatId)
      .eq("source", "user_activity")
      .eq("content", "view_detail")
      .gte("created_at", isoTime)
      .limit(50);

    if (viewDetailDataError) console.warn("View detail data error:", viewDetailDataError);

    // 🔥 QUERY 4: VALIDASI (dari table minat)
    const { count: minatCount, error: minatError } = await supabase
      .from("minat")
      .select("*", { count: "exact", head: true })
      .eq("tempat_id", tempatId)
      .gte("created_at", isoTime);

    if (minatError) console.warn("Minat count error:", minatError);

    const { data: minatData, error: minatDataError } = await supabase
      .from("minat")
      .select("username, created_at, user_id, laporan_id")
      .eq("tempat_id", tempatId)
      .gte("created_at", isoTime)
      .order("created_at", { ascending: false })
      .limit(10);

    if (minatDataError) console.warn("Minat data error:", minatDataError);

    const uniqueMinat = minatData ? new Set(minatData.map(m => m.user_id).filter(Boolean)).size : 0;

    // 🔥 QUERY 5: Like
    const { count: likeCount, error: likeError } = await supabase
      .from("likes")
      .select("*", { count: "exact", head: true })
      .eq("tempat_id", tempatId)
      .gte("created_at", isoTime);

    if (likeError) console.warn("Like error:", likeError);

    // 🔥 QUERY 6: Story View
    const { count: storyCount, error: storyError } = await supabase
      .from("story_views")
      .select("*", { count: "exact", head: true })
      .eq("laporan_id", tempatId)
      .gte("viewed_at", isoTime);

    if (storyError) console.warn("Story view error:", storyError);

    // 🔥 Ambil info tempat
    const { data: tempatData, error: tempatError } = await supabase
      .from("tempat")
      .select("name, category")
      .eq("id", tempatId)
      .single();

    if (tempatError) console.warn("Tempat data error:", tempatError);

    const citizenReports = citizenData || [];
    const citizenReportTexts = citizenReports.map(r => r.original_text || r.content).filter(Boolean);
    const latestCitizen = citizenReports[0] || null;
    const uniqueViewers = viewDetailData ? new Set(viewDetailData.map(v => v.source_id)).size : 0;


    // 🔥 Generate status text
    let generatedStatus = null;
    if (latestCitizen) {
      // 🔥 PERBAIKAN: deteksi tipe dari `content` (bersih) via peta langsung,
      // BUKAN dari substring-search di `original_text` yang sudah dicampur
      // dengan teks deskripsi (mis. "Ramai: Nyaris Penuh").
      const tipe = resolveTipeFromCitizenReport(latestCitizen);

      // Teks tampilan tetap pakai original_text/content, hanya dibersihkan prefix
      let content = latestCitizen.original_text || latestCitizen.content || '';
      content = content.replace(/^Warga melaporkan:\s*/, '');
      const parts = content.split(':');
      if (parts.length === 2 && parts[0].trim() === parts[1].trim()) {
        content = parts[0].trim();
      }

      // 🔥 Paksa category untuk tipe-tipe yang lintas kategori tapi tetap
      // butuh kamus frasa yang tepat (jalan / cuaca / parkir)
      let categoryForStatus = tempatData?.category || 'general';
      if (tipe === 'macet' || tipe === 'macet_total' || tipe === 'lancar') {
        categoryForStatus = 'jalan';
      } else if (tipe === 'hujan') {
        categoryForStatus = 'cuaca';
      } else if (['kosong', 'tersedia', 'hampir_penuh'].includes(tipe) || (tipe === 'penuh' && (tempatData?.category || '').toLowerCase().includes('parkir'))) {
        categoryForStatus = 'parkir';
      }

      console.log('🔍 categoryForStatus:', categoryForStatus, 'tipe:', tipe); // Debug

      generatedStatus = generateStatusText({
        kondisi: tipe, // 🔥 kondisi eksplisit, prioritas utama di generateStatusText
        trafficCondition: null,
        total: citizenReports.length,
        isRecent: true,
        category: categoryForStatus,
        name: tempatData?.name || '',
        deskripsi: content,
        jarak: null,
        seed: `${tempatId}_${Date.now()}`
      });
    }

    const rawData = {
      viewDetail: viewCount || 0,
      uniqueViewers: uniqueViewers || 0,
      validasiCount: minatCount || 0,
      uniqueValidasi: uniqueMinat || 0,
      validasiData: minatData || [],
      like: likeCount || 0,
      storyView: storyCount || 0,
      citizenCount: citizenReports.length || 0,
      citizenReports: citizenReportTexts,
      latestCitizen: latestCitizen,
      generatedStatus: generatedStatus,
      tempatData: tempatData,
    };

    const totalRaw = rawData.viewDetail + rawData.like + rawData.storyView + rawData.citizenCount + rawData.validasiCount;
    const weightedScore =
      rawData.viewDetail * ACTIVITY_WEIGHTS.view_detail +
      rawData.like * ACTIVITY_WEIGHTS.like +
      rawData.storyView * ACTIVITY_WEIGHTS.story_view +
      rawData.citizenCount * 1.5 +
      rawData.validasiCount * 2.0;

    let level = "normal";
    let isCrowded = false;

    if (weightedScore > 30 || rawData.viewDetail > 10 || rawData.citizenCount > 3 || rawData.validasiCount > 5) {
      level = "ramai";
      isCrowded = true;
    } else if (weightedScore > 10 || rawData.viewDetail > 3 || rawData.citizenCount > 0 || rawData.validasiCount > 0) {
      level = "minat";
      isCrowded = false;
    }

    let ringkasan = null;
    if (citizenReports.length > 0 || rawData.validasiCount > 0) {
      ringkasan = generateRingkasanMultiUser(
        [],
        tempatData?.category || 'general',
        {
          citizenCount: citizenReports.length,
          citizenReports: citizenReportTexts,
          uniqueViewers: uniqueViewers,
          uniqueValidasi: uniqueMinat,
          validasiCount: minatCount,
          validasiData: minatData || [],
          hours: hours,
          total: totalRaw,
          like: likeCount || 0,
          storyView: storyCount || 0,
          isCrowded: isCrowded,
        },
        { name: tempatData?.name || '' },
        null
      );
    }

    return {
      level,
      isCrowded,
      weightedScore,
      total: totalRaw,
      ...rawData,
      hours,
      ringkasan,
    };

  } catch (err) {
    console.error("Error fetching passive signals:", err);
    return null;
  }
}

/**
 * 🔥 GET WEATHER SIGNAL
 */
export function getWeatherSignal(weatherData) {
  if (!weatherData || !weatherData.condition) return null;

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
      ? '⚠️ Cuaca ekstrem!'
      : isWarning
        ? '🌧️ Waspada cuaca'
        : isHujan
          ? '☔ Bawa payung'
          : '☀️ Cuaca cerah',
    color: isExtreme ? 'text-red-600' : isWarning ? 'text-amber-600' : isHujan ? 'text-blue-600' : 'text-emerald-600',
    bgColor: isExtreme ? 'bg-red-50' : isWarning ? 'bg-amber-50' : isHujan ? 'bg-blue-50' : 'bg-emerald-50',
    borderColor: isExtreme ? 'border-red-200' : isWarning ? 'border-amber-200' : isHujan ? 'border-blue-200' : 'border-emerald-200'
  };
}

/**
 * 🔥 GET COMBINED SIGNALS
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
 * 🔥 GET PASSIVE STATUS TEXT - 1 BARIS PENDEK
 */
export function getPassiveStatusText(passiveSignal) {
  if (!passiveSignal) return null;

  // 🔥 PRIORITAS 1: Citizen Report
  if (passiveSignal.latestCitizen && passiveSignal.citizenCount > 0) {
    if (passiveSignal.generatedStatus) {
      const status = passiveSignal.generatedStatus;

      let mainText = status.text;
      if (mainText.length > 30) {
        mainText = mainText.substring(0, 30) + '...';
      }
      mainText = mainText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

      return {
        text: mainText,
        color: status.color || "text-emerald-600 dark:text-emerald-400",
        bgColor: status.bgColor || "bg-emerald-500",
        icon: status.icon || '👤',
        badge: `${status.badge || 'UPDATE'} · ${passiveSignal.citizenCount}`,
        vibe: `${passiveSignal.citizenCount} warga melapor`,
        level: status.level || 2,
        isCitizen: true,
      };
    }

    // Fallback — pakai deteksi tipe yang sama dengan resolveTipeFromCitizenReport
    // supaya konsisten dengan generatedStatus di atas
    const tipe = resolveTipeFromCitizenReport(passiveSignal.latestCitizen);

    let content = passiveSignal.latestCitizen.original_text ||
      passiveSignal.latestCitizen.content ||
      'Update warga';

    content = content
      .replace(/^Warga melaporkan:\s*/, '')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const parts = content.split(':');
    if (parts.length === 2 && parts[0].trim() === parts[1].trim()) {
      content = parts[0].trim();
    }

    if (content.length > 35) {
      content = content.substring(0, 35) + '...';
    }

    const TIPE_DISPLAY = {
      kecelakaan: { emoji: '🚨', badgeText: '🚨 DARURAT', vibeText: 'Kecelakaan! Hati-hati!' },
      macet: { emoji: '🚗', badgeText: '🚗 MACET', vibeText: 'Macet, cari alternatif' },
      macet_total: { emoji: '🚫', badgeText: '🚫 MACET TOTAL', vibeText: 'Cari jalur lain sekarang' },
      hujan: { emoji: '🌧️', badgeText: '🌧️ HUJAN', vibeText: 'Hujan, bawa payung' },
      antri: { emoji: '🚶‍♂️', badgeText: '🚶 ANTRI', vibeText: 'Antrean panjang' },
      penuh: { emoji: '🚫', badgeText: '🚫 PENUH', vibeText: 'Sudah penuh!' },
      padat: { emoji: '👥', badgeText: '👥 PADAT', vibeText: 'Sangat ramai' },
      tutup: { emoji: '🔒', badgeText: '🔒 TUTUP', vibeText: 'Sedang tidak beroperasi' },
      ramai: { emoji: '👥', badgeText: '🔥 RAMAI', vibeText: 'Mulai ramai' },
      sepi: { emoji: '😌', badgeText: '🏝️ SEPI', vibeText: 'Suasana tenang' },
      lancar: { emoji: '🛵', badgeText: '✅ LANCAR', vibeText: 'Gas terus' },
      kosong: { emoji: '🟢', badgeText: '🟢 KOSONG', vibeText: 'Bebas pilih slot' },
      tersedia: { emoji: '🟡', badgeText: '🟡 TERSEDIA', vibeText: 'Buruan sebelum penuh' },
      hampir_penuh: { emoji: '🟠', badgeText: '🟠 HAMPIR PENUH', vibeText: 'Cari celah cepat' },
    };

    const display = TIPE_DISPLAY[tipe] || {
      emoji: '👤',
      badgeText: `${passiveSignal.citizenCount} WARGA`,
      vibeText: `${passiveSignal.citizenCount} warga melapor`,
    };

    return {
      text: `${display.emoji} ${content}`,
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-500",
      icon: display.emoji,
      badge: display.badgeText,
      vibe: display.vibeText,
      level: 2,
      isCitizen: true,
    };
  }

  // 🔥 PRIORITAS 2: VALIDASI
  if (passiveSignal.validasiCount > 0) {
    const validasiText = passiveSignal.uniqueValidasi > 0
      ? `${passiveSignal.uniqueValidasi} warga membenarkan`
      : `${passiveSignal.validasiCount} validasi`;

    return {
      text: `✅ ${validasiText}`,
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-500",
      icon: "✅",
      badge: `✅ ${passiveSignal.validasiCount} VALIDASI`,
      vibe: `${passiveSignal.uniqueValidasi || passiveSignal.validasiCount} warga membenarkan kondisi ini`,
      level: 2,
      isValidasi: true,
    };
  }

  // 🔥 PRIORITAS 3: Cuaca Ekstrem
  if (passiveSignal.weather?.isExtreme) {
    const text = passiveSignal.weather.statusText.replace(/\n/g, ' ').trim();
    return {
      text: text,
      color: passiveSignal.weather.color,
      bgColor: passiveSignal.weather.bgColor,
      icon: passiveSignal.weather.icon,
      badge: "⚠️ EKSTREM",
      vibe: "Cuaca ekstrem!",
      level: 5,
      isWeather: true,
    };
  }

  // 🔥 PRIORITAS 4: Peringatan Cuaca
  if (passiveSignal.weather?.isWarning) {
    let text = passiveSignal.weather.statusText.replace(/\n/g, ' ').trim();
    if (text.length > 30) {
      text = text.substring(0, 30) + '...';
    }

    return {
      text: text,
      color: passiveSignal.weather.color,
      bgColor: passiveSignal.weather.bgColor,
      icon: passiveSignal.weather.icon,
      badge: passiveSignal.weather.isHujan ? "🌧️ HUJAN" : "⚠️ WASPADA",
      vibe: passiveSignal.weather.isHujan ? "Bawa payung" : "Waspada",
      level: 3,
      isWeather: true,
    };
  }

  // PRIORITAS 5: Aktivitas Ramai
  if (passiveSignal.level === "ramai") {
    let text = `🔥 RAMAI`;
    let details = [];

    if (passiveSignal.uniqueViewers > 0) {
      details.push(`${passiveSignal.uniqueViewers} lihat`);
    }
    if (passiveSignal.like > 0) {
      details.push(`❤️${passiveSignal.like}`);
    }
    if (passiveSignal.storyView > 0) {
      details.push(`📖${passiveSignal.storyView}`);
    }

    if (details.length > 0) {
      text += ` (${details.join(' · ')})`;
    }

    return {
      text: text,
      color: "text-red-500",
      bgColor: "bg-red-500",
      icon: "🔥",
      badge: "RAMAI",
      vibe: `${passiveSignal.viewDetail} interaksi`,
      level: 4,
    };
  }

  // PRIORITAS 6: Aktivitas Minat
  if (passiveSignal.level === "minat") {
    let text = `👀 MINAT`;
    if (passiveSignal.uniqueViewers > 0) {
      text += ` (${passiveSignal.uniqueViewers} lihat)`;
    }
    return {
      text: text,
      color: "text-yellow-500",
      bgColor: "bg-yellow-500",
      icon: "👀",
      badge: "MINAT",
      vibe: `${passiveSignal.viewDetail} orang lihat`,
      level: 2,
    };
  }

  // PRIORITAS 7: Cuaca Normal
  if (passiveSignal.weather) {
    let text = passiveSignal.weather.statusText.replace(/\n/g, ' ').trim();
    if (text.length > 30) {
      text = text.substring(0, 30) + '...';
    }

    return {
      text: text,
      color: passiveSignal.weather.color,
      bgColor: passiveSignal.weather.bgColor,
      icon: passiveSignal.weather.icon,
      badge: "NORMAL",
      vibe: `${passiveSignal.weather.temp}°C`,
      level: 1,
      isWeather: true,
    };
  }

  return null;
}

/**
 * 🔥 GET PASSIVE RINGKASAN - Versi Lengkap
 */
export function getPassiveRingkasan(passiveSignal, placeName = "tempat ini") {
  if (!passiveSignal) return null;

  const {
    viewDetail,
    uniqueViewers,
    validasiCount,
    uniqueValidasi,
    validasiData,
    like,
    storyView,
    hours,
    weather,
    citizenCount,
    citizenReports,
    generatedStatus
  } = passiveSignal;

  let ringkasan = "";

  // 🔥 Citizen Reports
  if (citizenCount > 0 && citizenReports && citizenReports.length > 0) {
    const timePrefix = hours <= 2 ? 'Baru saja' : `${hours} jam terakhir`;
    ringkasan = `📢 Laporan Warga (${timePrefix}):\n\n`;

    if (generatedStatus) {
      ringkasan += `${generatedStatus.icon || '📍'} ${generatedStatus.text}\n`;
      ringkasan += `📌 ${generatedStatus.vibe || 'Update dari warga'}\n\n`;
    }

    citizenReports.slice(0, 3).forEach((report, idx) => {
      let cleanReport = report
        .replace(/^Warga melaporkan:\s*/, '')
        .trim();

      const lower = cleanReport.toLowerCase();
      let emoji = '📍';
      if (lower.includes('sepi') || lower.includes('kosong')) emoji = '😌';
      else if (lower.includes('ramai')) emoji = '👥';
      else if (lower.includes('antri')) emoji = '🚶';
      else if (lower.includes('penuh')) emoji = '🚫';
      else if (lower.includes('macet')) emoji = '🚗';
      else if (lower.includes('hujan')) emoji = '🌧️';

      ringkasan += `${emoji} ${cleanReport}\n`;
    });

    if (citizenCount > 3) {
      ringkasan += `\n...dan ${citizenCount - 3} laporan lainnya.`;
    }

    if (uniqueViewers > 0) {
      ringkasan += `\n\n👀 ${uniqueViewers} orang melihat detail ${placeName} dalam ${hours} jam terakhir.`;
    }

    if (weather && !weather.isExtreme) {
      ringkasan += `\n☀️ Cuaca: ${weather.short} ${weather.temp}°C`;
    }

    if (generatedStatus) {
      const text = generatedStatus.text.toLowerCase();
      if (text.includes('sepi') || text.includes('kosong') || text.includes('lengang')) {
        ringkasan += '\n\n💡 Tips: Waktu yang tepat untuk berkunjung!';
      } else if (text.includes('ramai') || text.includes('antri')) {
        ringkasan += '\n\n💡 Tips: Siapkan waktu ekstra atau cari alternatif.';
      } else if (text.includes('macet')) {
        ringkasan += '\n\n💡 Tips: Cari jalur alternatif.';
      } else if (text.includes('hujan')) {
        ringkasan += '\n\n💡 Tips: Bawa perlengkapan hujan!';
      }
    }

    return ringkasan;
  }

  // 🔥 Aktivitas Ramai
  if (viewDetail > 0 || like > 0 || storyView > 0) {
    const details = [];
    if (uniqueViewers > 0) details.push(`${uniqueViewers} orang melihat`);
    if (like > 0) details.push(`❤️ ${like} menyukai`);
    if (storyView > 0) details.push(`📖 ${storyView} melihat story`);

    if (details.length > 0) {
      ringkasan = `📊 Aktivitas dalam ${hours} jam terakhir:\n\n`;
      ringkasan += details.join('\n');

      if (weather && !weather.isExtreme) {
        ringkasan += `\n\n☀️ Cuaca: ${weather.short} ${weather.temp}°C`;
      }

      return ringkasan;
    }
  }

  // 🔥 Cuaca
  if (weather) {
    if (weather.isExtreme) {
      ringkasan = `⚠️ PERINGATAN CUACA EKSTREM!\n\n`;
      ringkasan += `🌡️ ${weather.temp}°C · 💧 ${weather.humidity}%`;
    } else if (weather.isWarning) {
      ringkasan = `🌧️ ${weather.statusText}\n\n`;
      ringkasan += `🌡️ ${weather.temp}°C · 💧 ${weather.humidity}%`;
    } else {
      ringkasan = `${weather.icon} ${weather.statusText}\n\n`;
      ringkasan += `🌡️ ${weather.temp}°C · 💧 ${weather.humidity}%`;
    }
    return ringkasan;
  }

  return `Belum ada aktivitas dalam ${hours} jam terakhir.`;
}

/**
 * 🔥 GET WEATHER PRIORITY
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