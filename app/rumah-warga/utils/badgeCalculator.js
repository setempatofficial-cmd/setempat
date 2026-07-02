// ============ LENCANA SPESIALISASI (VERSI BARU) ============

/**
 * ============================================================
 * 🔥 UPDATED: Generate lencana spesialisasi berdasarkan statistik
 * ============================================================
 * Penyesuaian berdasarkan model bisnis:
 * - Syarat lebih realistis (turun dari 50 ke 30 untuk memulai)
 * - Ada level lencana (Bronze, Silver, Gold, Platinum)
 * - Bonus poin dan hak akses yang jelas
 * - Terintegrasi dengan level reputasi
 * ============================================================
 * 
 * @param {object} statistik - Data statistik user
 * @param {object} options - Opsi tambahan (level, poin)
 * @returns {Array} Array lencana yang diraih
 */
export const generateBadges = (statistik, options = {}) => {
  const badges = [];
  const userLevel = options.level || 1;

  // ============================================================
  // 1. 🚦 PENGAMAT LALU LINTAS
  // ============================================================
  // Bronze: 30 laporan lalin
  // Silver: 50 laporan lalin + 500 views
  // Gold: 100 laporan lalin + 1000 views + 50 likes
  // Platinum: 200 laporan lalin + 5000 views + 200 likes
  // ============================================================
  const lalin = statistik.laporanByTraffic || 0;
  const views = statistik.totalViews || 0;
  const likes = statistik.totalLikes || 0;

  if (lalin >= 200 && views >= 5000 && likes >= 200) {
    badges.push({
      id: "pengamat_lalin_platinum",
      icon: "🚦",
      name: "Pengamat Lalu Lintas Platinum",
      desc: `${lalin} laporan lalu lintas, ${views} views, ${likes} likes`,
      perks: "✅ Bounty prioritas + Royalti 5% + Sertifikat",
      category: "spesialis",
      level: "platinum",
      bonusPoin: 25,
      earnedAt: new Date()
    });
  } else if (lalin >= 100 && views >= 1000 && likes >= 50) {
    badges.push({
      id: "pengamat_lalin_gold",
      icon: "🚦",
      name: "Pengamat Lalu Lintas Gold",
      desc: `${lalin} laporan lalu lintas, ${views} views, ${likes} likes`,
      perks: "✅ Bounty prioritas + Royalti 3%",
      category: "spesialis",
      level: "gold",
      bonusPoin: 20,
      earnedAt: new Date()
    });
  } else if (lalin >= 50 && views >= 500) {
    badges.push({
      id: "pengamat_lalin_silver",
      icon: "🚦",
      name: "Pengamat Lalu Lintas Silver",
      desc: `${lalin} laporan lalu lintas, ${views} views`,
      perks: "✅ Ikut bounty laporan lalu lintas + Prioritas verifikasi",
      category: "spesialis",
      level: "silver",
      bonusPoin: 15,
      earnedAt: new Date()
    });
  } else if (lalin >= 30) {
    badges.push({
      id: "pengamat_lalin_bronze",
      icon: "🚦",
      name: "Pengamat Lalu Lintas Bronze",
      desc: `${lalin} laporan lalu lintas`,
      perks: "✅ Mulai ikut bounty laporan lalu lintas",
      category: "spesialis",
      level: "bronze",
      bonusPoin: 10,
      earnedAt: new Date()
    });
  }

  // ============================================================
  // 2. 🌧 PEMANTAU CUACA
  // ============================================================
  const cuaca = statistik.laporanByWeather || 0;

  if (cuaca >= 200 && likes >= 200 && views >= 5000) {
    badges.push({
      id: "pemantau_cuaca_platinum",
      icon: "🌧",
      name: "Pemantau Cuaca Platinum",
      desc: `${cuaca} laporan cuaca, ${likes} likes, ${views} views`,
      perks: "✅ Bounty prioritas + Data cuaca eksklusif + Sertifikat",
      category: "spesialis",
      level: "platinum",
      bonusPoin: 25,
      earnedAt: new Date()
    });
  } else if (cuaca >= 100 && likes >= 100 && views >= 1000) {
    badges.push({
      id: "pemantau_cuaca_gold",
      icon: "🌧",
      name: "Pemantau Cuaca Gold",
      desc: `${cuaca} laporan cuaca, ${likes} likes, ${views} views`,
      perks: "✅ Bounty prioritas + Data cuaca eksklusif",
      category: "spesialis",
      level: "gold",
      bonusPoin: 20,
      earnedAt: new Date()
    });
  } else if (cuaca >= 50 && likes >= 50) {
    badges.push({
      id: "pemantau_cuaca_silver",
      icon: "🌧",
      name: "Pemantau Cuaca Silver",
      desc: `${cuaca} laporan cuaca, ${likes} likes`,
      perks: "✅ Ikut bounty laporan cuaca + Badge eksklusif",
      category: "spesialis",
      level: "silver",
      bonusPoin: 15,
      earnedAt: new Date()
    });
  } else if (cuaca >= 30) {
    badges.push({
      id: "pemantau_cuaca_bronze",
      icon: "🌧",
      name: "Pemantau Cuaca Bronze",
      desc: `${cuaca} laporan cuaca`,
      perks: "✅ Mulai ikut bounty laporan cuaca",
      category: "spesialis",
      level: "bronze",
      bonusPoin: 10,
      earnedAt: new Date()
    });
  }

  // ============================================================
  // 3. 📸 MATA KAMERA
  // ============================================================
  const foto = statistik.totalFoto || 0;

  if (foto >= 200 && views >= 10000 && likes >= 200) {
    badges.push({
      id: "mata_kamera_platinum",
      icon: "📸",
      name: "Mata Kamera Platinum",
      desc: `${foto} foto, ${views} views, ${likes} likes`,
      perks: "✅ Jual foto ke marketplace + Royalti 10% + Sertifikat",
      category: "spesialis",
      level: "platinum",
      bonusPoin: 25,
      earnedAt: new Date()
    });
  } else if (foto >= 100 && views >= 5000 && likes >= 100) {
    badges.push({
      id: "mata_kamera_gold",
      icon: "📸",
      name: "Mata Kamera Gold",
      desc: `${foto} foto, ${views} views, ${likes} likes`,
      perks: "✅ Jual foto ke marketplace + Royalti 5%",
      category: "spesialis",
      level: "gold",
      bonusPoin: 20,
      earnedAt: new Date()
    });
  } else if (foto >= 50 && views >= 1000) {
    badges.push({
      id: "mata_kamera_silver",
      icon: "📸",
      name: "Mata Kamera Silver",
      desc: `${foto} foto, ${views} views`,
      perks: "✅ Jual foto ke marketplace konten + Royalti 3%",
      category: "spesialis",
      level: "silver",
      bonusPoin: 15,
      earnedAt: new Date()
    });
  } else if (foto >= 30) {
    badges.push({
      id: "mata_kamera_bronze",
      icon: "📸",
      name: "Mata Kamera Bronze",
      desc: `${foto} foto`,
      perks: "✅ Mulai jual foto ke marketplace",
      category: "spesialis",
      level: "bronze",
      bonusPoin: 10,
      earnedAt: new Date()
    });
  }

  // ============================================================
  // 4. 🎥 REPORTER VIDEO
  // ============================================================
  const video = statistik.totalVideo || 0;

  if (video >= 200 && views >= 10000 && likes >= 200) {
    badges.push({
      id: "reporter_video_platinum",
      icon: "🎥",
      name: "Reporter Video Platinum",
      desc: `${video} video, ${views} views, ${likes} likes`,
      perks: "✅ Jual video ke marketplace + Royalti 10% + Sertifikat",
      category: "spesialis",
      level: "platinum",
      bonusPoin: 25,
      earnedAt: new Date()
    });
  } else if (video >= 100 && views >= 5000 && likes >= 100) {
    badges.push({
      id: "reporter_video_gold",
      icon: "🎥",
      name: "Reporter Video Gold",
      desc: `${video} video, ${views} views, ${likes} likes`,
      perks: "✅ Jual video ke marketplace + Royalti 5%",
      category: "spesialis",
      level: "gold",
      bonusPoin: 20,
      earnedAt: new Date()
    });
  } else if (video >= 50 && views >= 1000) {
    badges.push({
      id: "reporter_video_silver",
      icon: "🎥",
      name: "Reporter Video Silver",
      desc: `${video} video, ${views} views`,
      perks: "✅ Jual video ke marketplace konten + Royalti 3%",
      category: "spesialis",
      level: "silver",
      bonusPoin: 15,
      earnedAt: new Date()
    });
  } else if (video >= 30) {
    badges.push({
      id: "reporter_video_bronze",
      icon: "🎥",
      name: "Reporter Video Bronze",
      desc: `${video} video`,
      perks: "✅ Mulai jual video ke marketplace",
      category: "spesialis",
      level: "bronze",
      bonusPoin: 10,
      earnedAt: new Date()
    });
  }

  // ============================================================
  // 5. ⭐ KONTRIBUTOR PILIHAN
  // ============================================================
  const featured = statistik.featuredCount || 0;

  if (featured >= 20) {
    badges.push({
      id: "kontributor_pilihan_platinum",
      icon: "⭐",
      name: "Kontributor Pilihan Platinum",
      desc: `${featured} laporan menjadi sorotan setempat`,
      perks: "✅ Program Mitra Desa + Sertifikat + Usul Voucher + Royalti 10%",
      category: "spesialis",
      level: "platinum",
      bonusPoin: 30,
      earnedAt: new Date()
    });
  } else if (featured >= 10) {
    badges.push({
      id: "kontributor_pilihan_gold",
      icon: "⭐",
      name: "Kontributor Pilihan Gold",
      desc: `${featured} laporan menjadi sorotan setempat`,
      perks: "✅ Program Mitra Desa + Sertifikat + Usul Voucher",
      category: "spesialis",
      level: "gold",
      bonusPoin: 25,
      earnedAt: new Date()
    });
  } else if (featured >= 5) {
    badges.push({
      id: "kontributor_pilihan_silver",
      icon: "⭐",
      name: "Kontributor Pilihan Silver",
      desc: `${featured} laporan menjadi sorotan setempat`,
      perks: "✅ Program Mitra Desa + Sertifikat eksklusif",
      category: "spesialis",
      level: "silver",
      bonusPoin: 20,
      earnedAt: new Date()
    });
  } else if (featured >= 2) {
    badges.push({
      id: "kontributor_pilihan_bronze",
      icon: "⭐",
      name: "Kontributor Pilihan Bronze",
      desc: `${featured} laporan menjadi sorotan setempat`,
      perks: "✅ Mulai Program Mitra Desa",
      category: "spesialis",
      level: "bronze",
      bonusPoin: 15,
      earnedAt: new Date()
    });
  }

  // ============================================================
  // 6. 📍 WARGA SETEMPAT (BARU)
  // ============================================================
  // Lencana dasar untuk semua user aktif
  // ============================================================
  if (statistik.totalLaporan >= 10) {
    badges.push({
      id: "warga_setempat",
      icon: "📍",
      name: "Warga Setempat",
      desc: `${statistik.totalLaporan} laporan dibuat`,
      perks: "✅ Dapat akses semua fitur Setempat",
      category: "dasar",
      level: "basic",
      bonusPoin: 5,
      earnedAt: new Date()
    });
  }

  // ============================================================
  // 7. 🔥 KONTRIBUTOR KONSISTEN (BARU)
  // ============================================================
  // Lencana untuk user dengan streak tinggi
  // ============================================================
  const streakDays = options.streakDays || 0;
  if (streakDays >= 30) {
    badges.push({
      id: "konsisten_30",
      icon: "🔥",
      name: "Konsisten 30 Hari",
      desc: `Aktif selama ${streakDays} hari berturut-turut`,
      perks: "✅ Bonus poin +10% selama 7 hari",
      category: "konsistensi",
      level: "gold",
      bonusPoin: 20,
      earnedAt: new Date()
    });
  } else if (streakDays >= 7) {
    badges.push({
      id: "konsisten_7",
      icon: "🔥",
      name: "Konsisten 7 Hari",
      desc: `Aktif selama ${streakDays} hari berturut-turut`,
      perks: "✅ Bonus poin +5% selama 3 hari",
      category: "konsistensi",
      level: "silver",
      bonusPoin: 10,
      earnedAt: new Date()
    });
  }

  return badges;
};

/**
 * ============================================================
 * 🔥 BARU: Hitung total bonus poin dari lencana
 * ============================================================
 */
export const calculateBadgeBonus = (badges) => {
  return badges.reduce((total, badge) => total + (badge.bonusPoin || 0), 0);
};

/**
 * ============================================================
 * 🔥 BARU: Get lencana berdasarkan level
 * ============================================================
 */
export const getBadgesByLevel = (badges, level) => {
  return badges.filter(b => b.level === level);
};

/**
 * ============================================================
 * 🔥 BARU: Get lencana berdasarkan kategori
 * ============================================================
 */
export const getBadgesByCategory = (badges, category) => {
  return badges.filter(b => b.category === category);
};

/**
 * ============================================================
 * 🔥 BARU: Check apakah user punya lencana tertentu
 * ============================================================
 */
export const hasBadge = (badges, badgeId) => {
  return badges.some(b => b.id === badgeId);
};

/**
 * ============================================================
 * 🔥 BARU: Get lencana terbaru
 * ============================================================
 */
export const getLatestBadge = (badges) => {
  if (badges.length === 0) return null;
  return badges.reduce((latest, current) => {
    return new Date(current.earnedAt) > new Date(latest.earnedAt) ? current : latest;
  });
};