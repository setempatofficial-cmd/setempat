// lib/feedEngine.js

import { generateHeadline } from "./headlineEngine";
import { calculateScore } from "./ranking";

// ==================== HELPER FUNCTIONS ====================
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function formatRelativeTime(dateString) {
  if (!dateString) return "";
  const now = new Date();
  const past = new Date(dateString);
  const diffInMs = now - past;
  const diffInMin = Math.floor(diffInMs / 60000);
  
  if (diffInMin < 1) return "Baru saja";
  if (diffInMin < 60) return `${diffInMin}m lalu`;
  const diffInHours = Math.floor(diffInMin / 60);
  if (diffInHours < 24) return `${diffInHours}j lalu`;
  return past.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

// ==================== MAPPING & NARASI ====================
const SUB_KATEGORI_MAPPING = { /* ... isi sesuai kode asli kamu ... */ };
const NARASI_SPESIFIK = { /* ... isi sesuai kode asli kamu ... */ };

function generateNarasiFromEstimasi({ estimasiOrang, tipe, catGroup, subKategori, isHujan }) {
  // ... (kode asli kamu tetap sama)
}

function getLatestEstimasiFromLaporan(laporan) {
  if (!laporan?.length) return null;

  const laporanDenganEstimasi = laporan.filter(l =>
    l.estimated_people !== null && l.estimated_people !== undefined
  );

  if (!laporanDenganEstimasi.length) return null;

  const terbaru = laporanDenganEstimasi.sort((a, b) =>
    new Date(b.created_at) - new Date(a.created_at)
  )[0];

  return {
    count: terbaru.estimated_people,
    tipe: terbaru.tipe,
    waitTime: terbaru.estimated_wait_time,
    created_at: terbaru.created_at,
    isRecent: (Date.now() - new Date(terbaru.created_at)) < (2 * 60 * 60 * 1000)
  };
}

// ==================== MAIN FUNCTION ====================
export function processFeedItem({ item, locationReady, location, comments = {} }) {
  if (!item) return {};

  const now = Date.now();
  const currentHour = new Date().getHours();

  // ==================== 1. JARAK ====================
  let distance = null;
  const itemLat = parseFloat(item.latitude || item.lat);
  const itemLng = parseFloat(item.longitude || item.lng || item.long);
  const userLat = parseFloat(location?.coords?.latitude || location?.latitude);
  const userLng = parseFloat(location?.coords?.longitude || location?.longitude);

  if (locationReady && userLat && userLng && itemLat && itemLng) {
    distance = calculateDistance(userLat, userLng, itemLat, itemLng);
  }

  // ==================== 2. DATA TABEL TEMPAT ====================
  const latestCondition = item.latest_condition || null;
  const latestEstimatedPeople = item.latest_estimated_people || null;
  const latestEstimatedWaitTime = item.latest_estimated_wait_time || null;
  const latestEstimatedAt = item.latest_estimated_at ? new Date(item.latest_estimated_at) : null;
  const avgEstimatedPeople = item.avg_estimated_people || null;

  // ==================== 3. SIGNAL PROCESSING ====================
  const validationCount = parseInt(item.total_minat) || 0;
  const dbCheckins = parseInt(item.total_checkins) || 0;

  const internalComments = Array.isArray(comments[item.id]) ? comments[item.id] : [];
  const laporan = Array.isArray(item.laporan_terbaru) ? item.laporan_terbaru : [];
  const medsos = Array.isArray(item.medsos_terbaru) ? item.medsos_terbaru : [];
  const aktivitas = Array.isArray(item.aktivitas_terkini) ? item.aktivitas_terkini : [];
  const externalSignals = Array.isArray(item.external_signals_terbaru) ? item.external_signals_terbaru : [];

  // ==================== 4. ESTIMASI DARI LAPORAN ====================
  const estimasiDariLaporan = getLatestEstimasiFromLaporan(laporan);

  // ==================== 5. BUILD ALL SIGNALS ====================
  const allSignals = [
    ...internalComments.map(c => ({ ...c, tipe: 'komentar_internal', source_type: 'internal', source_tier: 4 })),
    ...medsos.map(m => ({ ...m, tipe: 'medsos', source_type: 'internal_medsos', source_tier: 5 })),
    ...laporan.map(l => ({
      ...l,
      tipe: 'laporan',
      source_type: 'internal',
      source_tier: 4,
      estimated_people: l.estimated_people,
      estimated_wait_time: l.estimated_wait_time
    })),
    ...aktivitas.map(a => ({ ...a, tipe: 'checkin', source_type: 'internal', source_tier: 4 })),
    ...externalSignals.map(e => ({
      ...e,
      tipe: 'eksternal',
      source_type: 'eksternal',
      source_tier: e.source_tier || 5,
      source_platform: e.source_platform || e.source || 'unknown',
      is_official: e.is_official_place_account || false,
      verified: e.verified || false,
      has_media: e.has_image || e.has_video || (e.media_urls && e.media_urls.length > 0)
    }))
  ]
    .slice(0, 8)
    .map((s, idx) => {
      let platform = "Update Warga";
      const textContent = s.konten || s.content || s.text || s.deskripsi || s.catatan || "";

      if (s.tipe === "laporan") {
        if (s.estimated_wait_time) platform = `Antrian ±${s.estimated_wait_time}m`;
        else if (s.estimasi_menit) platform = `Antrian ±${s.estimasi_menit}m`;
        else platform = "Laporan Langsung";
      } else if (s.tipe === "komentar_internal") {
        platform = "Kata Warga";
      } else if (s.tipe === "eksternal") {
        if (s.source_platform === 'instagram') platform = "📸 Instagram";
        else if (s.source_platform === 'tiktok') platform = "🎵 TikTok";
        else if (s.source_platform === 'facebook') platform = "📘 Facebook";
        else platform = "📱 Media Sosial";
      }

      return {
        ...s,
        username: s.username || "warga_lokal",
        avatar: `data:text/plain,${idx}`,
        text: textContent,
        platformLabel: platform,
        timeAgo: formatRelativeTime(s.created_at || s.timestamp || s.date || item.updated_at),
        isLive: (now - new Date(s.created_at || s.timestamp || s.date)) < 3600000,
        isOfficial: s.is_official_place_account || false,
        isVerified: s.verified || false,
        hasImage: s.has_image || (s.media_url && s.media_url !== ''),
        sourceTier: s.source_tier || 5,
        estimated_people: s.estimated_people,
        estimated_wait_time: s.estimated_wait_time
      };
    })
    .filter(s => s.text)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  // ==================== 6. LAPORAN WARGA TERBARU ====================
  const recentWargaLaporan = allSignals
    .filter(s => s.tipe === 'laporan' && s.isLive)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

  // ==================== 7. TENTUKAN ESTIMASI ORANG ====================
  let estimasiOrang = null;
  let estimasiTipe = null;
  let estimasiWaitTime = null;
  let estimasiRecent = false;

  if (recentWargaLaporan && recentWargaLaporan.isLive) {
    // PRIORITAS 1: Laporan warga recent
    estimasiOrang = recentWargaLaporan.estimated_people;
    estimasiTipe = recentWargaLaporan.tipe;
    estimasiWaitTime = recentWargaLaporan.estimated_wait_time;
    estimasiRecent = true;
  } 
  else if (estimasiDariLaporan && estimasiDariLaporan.isRecent) {
    // PRIORITAS 2: Estimasi dari laporan
    estimasiOrang = estimasiDariLaporan.count;
    estimasiTipe = estimasiDariLaporan.tipe;
    estimasiWaitTime = estimasiDariLaporan.waitTime;
    estimasiRecent = true;
  } 
  else if (latestEstimatedPeople && latestEstimatedAt && (now - latestEstimatedAt) < (2 * 60 * 60 * 1000)) {
    // PRIORITAS 3: Data trigger recent
    estimasiOrang = latestEstimatedPeople;
    estimasiTipe = latestCondition;
    estimasiWaitTime = latestEstimatedWaitTime;
    estimasiRecent = true;
  } 
  else if (latestEstimatedPeople) {
    // PRIORITAS 4: Data trigger tidak recent
    estimasiOrang = latestEstimatedPeople;
    estimasiTipe = latestCondition;
    estimasiWaitTime = latestEstimatedWaitTime;
    estimasiRecent = false;
  } 
  else if (avgEstimatedPeople) {
    // PRIORITAS 5: Rata-rata laporan
    estimasiOrang = avgEstimatedPeople;
    estimasiRecent = false;
  }

  // ==================== 8. DETEKSI HUJAN ====================
  const isHujan = allSignals.some(s => /hujan|gerimis|deras|basah|mantol|neduh/i.test(s.text || s.deskripsi || ''));

  // ==================== 9. VIEWING COUNT ====================
  let finalViewingCount;
  if (estimasiOrang && estimasiRecent) {
    finalViewingCount = estimasiOrang;
    const activeViewers = Math.floor(Math.random() * 3) + 2;
    finalViewingCount = Math.max(estimasiOrang, activeViewers);
  } else {
    const activeViewers = Math.floor(Math.random() * 5) + 3;
    finalViewingCount = Math.ceil(activeViewers + dbCheckins);
  }

  // ==================== 10. KATEGORI & SUB-KATEGORI ====================
  const category = (item.category || item.kategori || item.nama_kategori || 'umum').toLowerCase();
  let catGroup = 'publik';
  let subKategori = null;
  let subKategoriData = { utama: 'publik', vibe: 'normal', icon: '📍', kata: 'Tempat' };

  for (const [key, value] of Object.entries(SUB_KATEGORI_MAPPING)) {
    if (category.includes(key) || item.name?.toLowerCase().includes(key)) {
      subKategori = key;
      subKategoriData = value;
      catGroup = value.utama;
      break;
    }
  }

  if (!subKategori) {
    if (['cafe', 'resto', 'warung', 'kuliner', 'kopi', 'bakso', 'sate', 'ayam', 'mie'].some(k => category.includes(k) || item.name?.toLowerCase().includes(k))) {
      catGroup = 'kuliner';
      subKategoriData = { utama: 'kuliner', vibe: 'normal', icon: '🍽️', kata: 'Kuliner' };
    } else if (['jalan', 'lalu lintas', 'simpang', 'raya', 'tol', 'bypass'].some(k => category.includes(k) || item.name?.toLowerCase().includes(k))) {
      catGroup = 'jalan';
      subKategoriData = { utama: 'jalan', vibe: 'normal', icon: '🛣️', kata: 'Jalan' };
    } else if (['masjid', 'mushola', 'gereja', 'pura', 'vihara'].some(k => category.includes(k) || item.name?.toLowerCase().includes(k))) {
      catGroup = 'ibadah';
      subKategoriData = { utama: 'ibadah', vibe: 'khusyuk', icon: '🕌', kata: 'Tempat Ibadah' };
    }
  }

  // ==================== 11. WAKTU ====================
  let timeVibe = "malam";
  if (currentHour >= 5 && currentHour < 11) timeVibe = "pagi";
  else if (currentHour >= 11 && currentHour < 15) timeVibe = "siang";
  else if (currentHour >= 15 && currentHour < 19) timeVibe = "sore";

  // ==================== 12. GENERATE HEADLINE ====================
  const antrian = laporan.find(l => l.tipe === "Antri" || l.estimasi_menit > 0 || l.estimated_wait_time) || null;
  const suasana = laporan.find(l => l.tipe === "keramaian" || l.tipe === "suasana") || null;
  const aktivitasUtama = aktivitas[0] || null;

  const generatedHeadline = generateHeadline({
    item,
    estimasiOrang,
    antrian,
    aktivitasUtama,
    suasana,
    externalSignals,
    allSignals
  });

  // ==================== 13. GENERATE NARASI ====================
  let narasiCerita = "";
  
  if (estimasiOrang && estimasiRecent && estimasiTipe) {
    narasiCerita = generateNarasiFromEstimasi({
      estimasiOrang,
      tipe: estimasiTipe,
      catGroup,
      subKategori,
      isHujan
    });
  } else {
    const laporanTerbaru = allSignals.find(s => s.tipe === 'laporan' && s.isLive);
    if (laporanTerbaru?.text) {
      narasiCerita = `"${laporanTerbaru.text.substring(0, 60)}..." - Warga`;
    } else if (externalSignals.length > 0 && externalSignals[0].source_tier <= 2) {
      const source = externalSignals[0].source_platform === 'instagram' ? 'IG' : 'media';
      narasiCerita = `Update ${source}: ${externalSignals[0].content?.substring(0, 60)}...`;
    } else {
      let levelKeramaian = 'sedang';
      if (finalViewingCount > 20) levelKeramaian = 'ramai';
      else if (finalViewingCount > 10) levelKeramaian = 'sedang';
      else levelKeramaian = 'sepi';
      if (isHujan) levelKeramaian = 'hujan';
      
      if (subKategori && NARASI_SPESIFIK[subKategori]?.[levelKeramaian]) {
        narasiCerita = NARASI_SPESIFIK[subKategori][levelKeramaian];
      } else {
        // Fallback narasi
        if (isHujan) {
          if (catGroup === 'kuliner') narasiCerita = "Hujan turun, pengunjung memilih menu hangat.";
          else if (catGroup === 'jalan') narasiCerita = "Hujan, jalanan licin, pengendara mengurangi kecepatan.";
          else narasiCerita = "Hujan turun, warga berteduh di berbagai tempat.";
        } else if (finalViewingCount > 20) {
          if (catGroup === 'kuliner') narasiCerita = "Pengunjung membludak, tempat penuh sesak.";
          else if (catGroup === 'jalan') narasiCerita = "Kepadatan parah, kendaraan tak bergerak.";
          else narasiCerita = "Warga tumplek blek, suasana meriah.";
        } else if (finalViewingCount > 10) {
          if (catGroup === 'kuliner') narasiCerita = "Meja-meja mulai terisi, suasana hangat.";
          else if (catGroup === 'jalan') narasiCerita = "Arus lalu lintas padat, merayap pelan.";
          else narasiCerita = "Warga mulai ramai beraktivitas.";
        } else {
          if (catGroup === 'kuliner') narasiCerita = "Suasana tenang, beberapa pengunjung terlihat.";
          else if (catGroup === 'jalan') narasiCerita = "Jalanan lancar, kendaraan leluasa melaju.";
          else narasiCerita = "Suasana tenang, hanya beberapa warga terlihat.";
        }
      }
    }
  }

  // ==================== 14. HITUNG SKOR ====================
  const itemForScoring = {
    ...item,
    testimonial_terbaru: internalComments,
    laporan_terbaru: laporan,
    external_signals_terbaru: externalSignals,
    vibe_count: validationCount,
    total_checkins: dbCheckins,
    latest_estimated_people: estimasiOrang,
    latest_estimated_at: latestEstimatedAt,
    latest_condition: estimasiTipe
  };

  const realtimeScore = calculateScore(itemForScoring, location);

  // ==================== 15. TENTUKAN BADGE ====================
  let badgeStatus = "Lancar";
  let badgeColor = "bg-slate-100 text-slate-700 border-slate-200";
  const vibeIcon = subKategoriData.icon || (timeVibe === "pagi" ? "🌅" : timeVibe === "siang" ? "☀️" : "🌙");
  
  const hasOfficialExternal = externalSignals.some(s =>
    s.source_tier === 1 || s.source_tier === 2 || s.is_official_place_account === true
  );
  
  const hasViralExternal = externalSignals.some(s =>
    (s.likes_count && s.likes_count > 100) || (s.comments_count && s.comments_count > 20)
  );
  
  if (isHujan) {
    badgeStatus = "☕ Cocok Neduh";
    badgeColor = "bg-blue-100 text-blue-700 border-blue-200";
  } else if (estimasiTipe === "Antri" && estimasiWaitTime) {
    if (estimasiWaitTime <= 5) badgeStatus = "⚡ Antri Pendek (<5 menit)";
    else if (estimasiWaitTime <= 15) badgeStatus = "⏱️ Antri Sedang (5-15 menit)";
    else badgeStatus = "🐢 Antri Panjang (>15 menit)";
    badgeColor = "bg-rose-100 text-rose-700 border-rose-200";
  } else if (estimasiOrang && estimasiRecent && estimasiTipe) {
    if (estimasiTipe === "Sepi") {
      badgeStatus = `🍃 Sepi · ~${estimasiOrang} org`;
      badgeColor = "bg-emerald-100 text-emerald-700 border-emerald-200";
    } else if (estimasiTipe === "Ramai") {
      badgeStatus = `👥 Ramai · ~${estimasiOrang} org`;
      badgeColor = "bg-amber-100 text-amber-700 border-amber-200";
    } else if (estimasiTipe === "Antri") {
      badgeStatus = `⏳ Antri · ~${estimasiOrang} org`;
      badgeColor = "bg-rose-100 text-rose-700 border-rose-200";
    }
  } else if (hasOfficialExternal && finalViewingCount > 10) {
    badgeStatus = "🏪 Official Update";
    badgeColor = "bg-purple-100 text-purple-700 border-purple-200";
  } else if (hasViralExternal || finalViewingCount > 25) {
    badgeStatus = "🔥 Lagi Viral";
    badgeColor = "bg-rose-100 text-rose-700 border-rose-200";
  } else if (finalViewingCount > 15) {
    badgeStatus = `👍 Ramai · ~${finalViewingCount} org`;
    badgeColor = "bg-amber-100 text-amber-700 border-amber-200";
  } else if (finalViewingCount > 8) {
    badgeStatus = `👌 Mulai Ramai · ~${finalViewingCount} org`;
    badgeColor = "bg-emerald-100 text-emerald-700 border-emerald-200";
  } else if (externalSignals.length > 0) {
    badgeStatus = "📱 Ada Update";
    badgeColor = "bg-indigo-100 text-indigo-700 border-indigo-200";
  }

  // ==================== 16. METRIK TAMBAHAN ====================
  const externalCount = externalSignals.length;
  const externalHighTierCount = externalSignals.filter(s => s.source_tier <= 2).length;
  const lastExternalAt = externalSignals.length > 0
    ? new Date(Math.max(...externalSignals.map(e => new Date(e.created_at))))
    : null;

  // ==================== 17. RETURN ====================
  return {
    ...item,
    allSignals,
    narasiCerita,
    badgeStatus,
    badgeColor,
    vibeIcon,
    viewingCount: finalViewingCount,
    validationCount,
    isHujan,
    distance,
    isRamai: finalViewingCount > 12,
    isViral: finalViewingCount > 25 || validationCount > 20,
    headline: generatedHeadline,
    activityTime: formatRelativeTime(item.updated_at) || "Baru saja",

    // Kategori
    catGroup,
    subKategori,
    subKategoriNama: subKategoriData.kata,
    subKategoriIcon: subKategoriData.icon,

    // Estimasi
    estimasiOrang,
    estimasiTipe,
    estimasiWaitTime,
    estimasiRecent,
    isFromWarga: estimasiOrang && estimasiRecent,

    // Laporan warga terbaru
    recentWargaLaporan,
    hasRecentWargaReport: !!recentWargaLaporan && recentWargaLaporan.isLive,

    // Scoring
    realtimeScore,
    externalCount,
    externalHighTierCount,
    lastExternalAt,
    hasOfficialExternal,

    // Sorting
    sortScore: realtimeScore,
    lastActivityAt: lastExternalAt || new Date(item.updated_at || item.created_at)
  };
}