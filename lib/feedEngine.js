import { generateHeadline } from "./headlineEngine";

function formatRelativeTime(dateString) {
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

export function processFeedItem({ item, locationReady, location, comments = {} }) {
  if (!item) return {};

  const currentHour = new Date().getHours();
  
  // 0. DATA NORMALIZATION
  // Mengambil total_minat dari View (hasil filter 3 jam di SQL)
  const validationCount = parseInt(item.total_minat) || 0; 
  const dbCheckins = parseInt(item.total_checkins) || 0;
  const estimasiOrang = parseInt(item.estimasi_orang) || 0;
  
  // Ambil komentar internal dari app (jika ada)
  const internalComments = Array.isArray(comments[item.id]) ? comments[item.id] : [];

  // 1. RUMUS AKTIVITAS FISIK TERBARU
  const activeViewers = Math.floor(Math.random() * 5) + 3; 
  const physicalScore = activeViewers + dbCheckins;
  const finalViewingCount = Math.ceil(physicalScore);

  // 2. SIGNAL PROCESSING (Mendukung tabel laporan_warga & medsos)
  const laporan = Array.isArray(item.laporan_terbaru) ? item.laporan_terbaru : [];
  const medsos = Array.isArray(item.medsos_terbaru) ? item.medsos_terbaru : [];
  const aktivitas = Array.isArray(item.aktivitas_terkini) ? item.aktivitas_terkini : [];

  // GABUNGKAN SEMUA ke allSignals untuk Slider Horizontal
  const allSignals = [
    ...internalComments.map(c => ({ ...c, tipe: 'komentar_internal' })),
    ...medsos.map(m => ({ ...m, tipe: 'medsos' })), 
    ...laporan.map(l => ({ ...l, tipe: 'laporan' })), // Mendukung tabel laporan_warga
    ...aktivitas.map(a => ({ ...a, tipe: 'checkin' }))
  ].map((s, idx) => {
    let platform = "Update Warga";
    const sourceText = (s.source || s.platform || "").toLowerCase();
    const urlText = (s.url || "").toLowerCase();
    
    // Logika Label Platform yang lebih cerdas
    if (sourceText.includes('instagram') || urlText.includes('instagram')) platform = "Instagram";
    else if (sourceText.includes('tiktok') || urlText.includes('tiktok')) platform = "TikTok";
    else if (s.tipe === "laporan") {
      // Jika ada info estimasi_menit di laporan_warga, tambahkan ke label
      platform = s.estimasi_menit ? `Antrian ±${s.estimasi_menit}m` : "Laporan Langsung";
    }
    else if (s.tipe === "komentar_internal") platform = "Kata Warga";
    else if (s.tipe === "checkin") platform = "Warga di Lokasi";

    const timestamp = s.created_at || s.timestamp || s.date || item.updated_at;
    
    // Normalisasi konten (Mendukung field 'deskripsi' dari laporan_warga)
    const textContent = s.konten || s.content || s.text || s.deskripsi || s.catatan || "";

    return {
      ...s,
      username: s.username || s.user_name || "warga_lokal",
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${s.username || idx + item.id}`,
      text: textContent,
      platformLabel: platform,
      timeAgo: formatRelativeTime(timestamp),
      // Dianggap LIVE jika laporan masuk dalam 1 jam terakhir
      isLive: (new Date() - new Date(timestamp)) < 3600000 
    };
  })
  .filter(s => s.text && s.text.length > 0)
  .sort((a, b) => {
    // Pastikan yang terbaru selalu di depan slider
    const timeA = new Date(a.created_at || a.timestamp || a.date || 0).getTime();
    const timeB = new Date(b.created_at || b.timestamp || b.date || 0).getTime();
    return timeB - timeA;
  });

  // 3. VIBE DETECTOR (Berdasarkan Waktu & Keramaian)
  let vibeLabel = "Santai";
  let vibeIcon = "🍃";
  let prediction = "Kondisi cenderung stabil sejam ke depan.";

  if (currentHour >= 18 || currentHour <= 4) {
    vibeLabel = "Syahdu";
    vibeIcon = "🌙";
    prediction = "Makin malam biasanya makin tenang di sini.";
  } else if (finalViewingCount > 15) {
    vibeLabel = "Energik";
    vibeIcon = "⚡";
    prediction = "Arus warga terpantau kencang di lokasi.";
  }

  // 4. NARASI DINAMIS (Agar card tidak membosankan)
  let narasiCerita = "Kondisi terpantau normal";
  if (validationCount > 5) narasiCerita = `${validationCount} warga baru saja memverifikasi kondisi ini`;
  else if (finalViewingCount > 20) narasiCerita = "Cukup ramai warga yang beraktivitas di sini";
  else if (allSignals.some(s => s.isLive)) narasiCerita = "Ada update segar dari warga di lokasi";

  // 5. BADGE STATUS
  let badgeStatus = "Tenang";
  let badgeColor = "bg-emerald-50 text-emerald-600 border-emerald-100";
  
  if (finalViewingCount > 25 || dbCheckins > 10) {
    badgeStatus = "🔥 Sangat Ramai";
    badgeColor = "bg-rose-50 text-rose-600 border-rose-100";
  } else if (finalViewingCount > 12) {
    badgeStatus = "🏃 Mulai Ramai";
    badgeColor = "bg-orange-50 text-orange-600 border-orange-100";
  }

  // Identifikasi Sinyal Spesifik untuk Headline
  const antrian = laporan.find(l => l.tipe === "antrian" || l.estimasi_menit > 0) || null;
  const suasana = laporan.find(l => l.tipe === "keramaian" || l.tipe === "suasana") || null;
  const aktivitasUtama = aktivitas[0] || null;

  return {
    ...item,
    estimasiOrang,
    allSignals,
    narasiCerita,
    badgeStatus,
    badgeColor,
    vibeLabel,
    vibeIcon,
    prediction,
    viewingCount: finalViewingCount,
    validationCount: validationCount,
    category: item.category || item.kategori || "Umum",
    isRamai: finalViewingCount > 12,
    isViral: finalViewingCount > 25 || validationCount > 20,
    headline: generateHeadline({ item, estimasiOrang, antrian, aktivitasUtama, suasana }),
    activityTime: formatRelativeTime(item.updated_at) || "Baru saja"
  };
}