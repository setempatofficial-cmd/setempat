// ============ LEVEL & REPUTASI AKAMSI (VERSI LEBIH BERAT) ============

/**
 * Menentukan level berdasarkan skor reputasi
 * @param {number} skor - Total skor reputasi
 * @returns {object} Level info (level, title, color, bg, nextLevelSkor, progress)
 */
const getLevelFromSkor = (skor) => {
  // Level 7: Legenda Setempat (1600+)
  if (skor >= 1600) {
    return {
      level: 7,
      title: "👑 Legenda Setempat",
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      nextLevelSkor: null,
      progress: 100
    };
  }
  // Level 6: Mata Setempat (800 - 1599)
  if (skor >= 800) {
    return {
      level: 6,
      title: "🛰 Mata Setempat",
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      nextLevelSkor: 1600,
      progress: ((skor - 800) / 800) * 100
    };
  }
  // Level 5: Akamsi Andal (400 - 799)
  if (skor >= 400) {
    return {
      level: 5,
      title: "🌳 Akamsi Andal",
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      nextLevelSkor: 800,
      progress: ((skor - 400) / 400) * 100
    };
  }
  // Level 4: Akamsi Siaga (200 - 399)
  if (skor >= 200) {
    return {
      level: 4,
      title: "🚦 Akamsi Siaga",
      color: "text-yellow-400",
      bg: "bg-yellow-500/10",
      nextLevelSkor: 400,
      progress: ((skor - 200) / 200) * 100
    };
  }
  // Level 3: Akamsi Muda (100 - 199)
  if (skor >= 100) {
    return {
      level: 3,
      title: "🚶 Akamsi Muda",
      color: "text-sky-400",
      bg: "bg-sky-500/10",
      nextLevelSkor: 200,
      progress: ((skor - 100) / 100) * 100
    };
  }
  // Level 2: Warlok Aktif (50 - 99)
  if (skor >= 50) {
    return {
      level: 2,
      title: "📍 Warlok Aktif",
      color: "text-orange-400",
      bg: "bg-orange-500/10",
      nextLevelSkor: 100,
      progress: ((skor - 50) / 50) * 100
    };
  }
  // Level 1: Warga Baru (0 - 49)
  return {
    level: 1,
    title: "🌱 Warga Baru",
    color: "text-green-400",
    bg: "bg-green-500/10",
    nextLevelSkor: 50,
    progress: (skor / 50) * 100
  };
};

/**
 * Menghitung skor reputasi dan level berdasarkan statistik
 * @param {object} statistik - Data statistik user
 * @returns {object} Reputasi (skor, levelInfo)
 */
export const calculateReputasi = (statistik) => {
  // Aktivitas: laporan + foto + video
  const aktivitas = (statistik.totalLaporan || 0) + (statistik.totalFoto || 0) + (statistik.totalVideo || 0);

  // Konsistensi: hari aktif
  const konsistensi = statistik.hariAktif || 0;

  // Dampak: like (per 10 = +1), view (per 200 = +1), featured (per 1 = +20)
  // Dibuat lebih berat dari sebelumnya
  const dampak = Math.floor((statistik.totalLikes || 0) / 10) +
    Math.floor((statistik.totalViews || 0) / 200) +
    ((statistik.featuredCount || 0) * 20);

  // Total skor reputasi
  const skor = aktivitas + konsistensi + dampak;

  // Level berdasarkan skor
  const levelInfo = getLevelFromSkor(skor);

  return {
    skor: skor,
    level: levelInfo.level,
    gelar: levelInfo.title,
    color: levelInfo.color,
    bg: levelInfo.bg,
    progress: levelInfo.progress,
    nextLevelSkor: levelInfo.nextLevelSkor
  };
};