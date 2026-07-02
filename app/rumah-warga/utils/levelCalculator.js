// ============ LEVEL & REPUTASI AKAMSI (VERSI BARU) ============

/**
 * ============================================================
 * 🔥 UPDATED: Menentukan level berdasarkan skor reputasi
 * ============================================================
 * Penyesuaian berdasarkan model bisnis:
 * - Level 1-3: Mudah dicapai (insentif awal)
 * - Level 4-5: Butuh konsistensi (user loyal)
 * - Level 6-7: Eksklusif (kontributor top)
 * ============================================================
 * 
 * @param {number} skor - Total skor reputasi
 * @returns {object} Level info (level, title, color, bg, nextLevelSkor, progress)
 */
const getLevelFromSkor = (skor) => {
  // Level 7: Legenda Setempat (2000+)
  if (skor >= 2000) {
    return {
      level: 7,
      title: "👑 Legenda Setempat",
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      nextLevelSkor: null,
      progress: 100,
      bonusPoin: 80, // bonus poin/minggu
      diskonVoucher: 30 // diskon %
    };
  }
  // Level 6: Mata Setempat (1000 - 1999)
  if (skor >= 1000) {
    return {
      level: 6,
      title: "🛰 Mata Setempat",
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      nextLevelSkor: 2000,
      progress: ((skor - 1000) / 1000) * 100,
      bonusPoin: 40,
      diskonVoucher: 25
    };
  }
  // Level 5: Akamsi Andal (500 - 999)
  if (skor >= 500) {
    return {
      level: 5,
      title: "🌳 Akamsi Andal",
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      nextLevelSkor: 1000,
      progress: ((skor - 500) / 500) * 100,
      bonusPoin: 20,
      diskonVoucher: 20
    };
  }
  // Level 4: Akamsi Siaga (200 - 499)
  if (skor >= 200) {
    return {
      level: 4,
      title: "🚦 Akamsi Siaga",
      color: "text-yellow-400",
      bg: "bg-yellow-500/10",
      nextLevelSkor: 500,
      progress: ((skor - 200) / 300) * 100,
      bonusPoin: 10,
      diskonVoucher: 15
    };
  }
  // Level 3: Akamsi Muda (80 - 199)
  if (skor >= 80) {
    return {
      level: 3,
      title: "🚶 Akamsi Muda",
      color: "text-sky-400",
      bg: "bg-sky-500/10",
      nextLevelSkor: 200,
      progress: ((skor - 80) / 120) * 100,
      bonusPoin: 5,
      diskonVoucher: 10
    };
  }
  // Level 2: Warlok Aktif (30 - 79)
  if (skor >= 30) {
    return {
      level: 2,
      title: "📍 Warlok Aktif",
      color: "text-orange-400",
      bg: "bg-orange-500/10",
      nextLevelSkor: 80,
      progress: ((skor - 30) / 50) * 100,
      bonusPoin: 2,
      diskonVoucher: 5
    };
  }
  // Level 1: Warga Baru (0 - 29)
  return {
    level: 1,
    title: "🌱 Warga Baru",
    color: "text-green-400",
    bg: "bg-green-500/10",
    nextLevelSkor: 30,
    progress: (skor / 30) * 100,
    bonusPoin: 0,
    diskonVoucher: 0
  };
};

/**
 * ============================================================
 * 🔥 UPDATED: Menghitung skor reputasi dan level berdasarkan statistik
 * ============================================================
 * Perubahan:
 * - Aktivitas: lebih proporsional (laporan + foto + video)
 * - Konsistensi: hari aktif (maks 30/hari)
 * - Dampak: like (per 10 = +1), view (per 100 = +1), featured (per 1 = +15)
 * - Skor lebih realistis untuk mencapai level
 * ============================================================
 * 
 * @param {object} statistik - Data statistik user
 * @param {object} options - Opsi tambahan (badges, lencana)
 * @returns {object} Reputasi (skor, levelInfo, badges)
 */
export const calculateReputasi = (statistik, options = {}) => {
  // ============================================================
  // 1. AKTIVITAS (DIPROPORSIONAL)
  // ============================================================
  // Sebelumnya: laporan + foto + video
  // Sekarang: laporan + (foto × 0.5) + (video × 1)
  // ============================================================
  const aktivitas = (statistik.totalLaporan || 0) +
    Math.floor((statistik.totalFoto || 0) / 2) +
    (statistik.totalVideo || 0);

  // ============================================================
  // 2. KONSISTENSI (DIPERKECIL)
  // ============================================================
  // Sebelumnya: hari aktif (tanpa batas)
  // Sekarang: hari aktif (maks 30/hari) + streak bonus
  // ============================================================
  const hariAktif = Math.min(statistik.hariAktif || 0, 30);
  const konsistensi = hariAktif + (options.streakDays || 0);

  // ============================================================
  // 3. DAMPAK (DIPERKECIL & DIPROPORSIONAL)
  // ============================================================
  // Sebelumnya: like/10 + view/200 + featured × 20
  // Sekarang:   like/10 + view/100 + featured × 15
  // ============================================================
  const dampak = Math.floor((statistik.totalLikes || 0) / 10) +
    Math.floor((statistik.totalViews || 0) / 100) +
    ((statistik.featuredCount || 0) * 15);

  // ============================================================
  // 4. BONUS LENCANA (BARU)
  // ============================================================
  // Setiap lencana = +5 skor
  // ============================================================
  const bonusLencana = (options.badges || []).length * 5;

  // ============================================================
  // 5. TOTAL SKOR
  // ============================================================
  const skor = aktivitas + konsistensi + dampak + bonusLencana;

  // ============================================================
  // 6. LEVEL
  // ============================================================
  const levelInfo = getLevelFromSkor(skor);

  // ============================================================
  // 7. RETURN
  // ============================================================
  return {
    skor: skor,
    level: levelInfo.level,
    gelar: levelInfo.title,
    color: levelInfo.color,
    bg: levelInfo.bg,
    progress: levelInfo.progress,
    nextLevelSkor: levelInfo.nextLevelSkor,
    bonusPoin: levelInfo.bonusPoin,
    diskonVoucher: levelInfo.diskonVoucher,
    // Detail breakdown (untuk debugging)
    breakdown: {
      aktivitas,
      konsistensi,
      dampak,
      bonusLencana
    }
  };
};

/**
 * ============================================================
 * 🔥 BARU: Hitung skor yang dibutuhkan ke level berikutnya
 * ============================================================
 */
export const getSkorToNextLevel = (currentSkor, currentLevel) => {
  const levelThresholds = {
    1: 30,
    2: 80,
    3: 200,
    4: 500,
    5: 1000,
    6: 2000,
    7: null // max level
  };

  const nextThreshold = levelThresholds[currentLevel + 1];
  if (!nextThreshold) return null;

  return nextThreshold - currentSkor;
};

/**
 * ============================================================
 * 🔥 BARU: Prediksi waktu untuk naik level
 * ============================================================
 */
export const predictLevelUpTime = (currentSkor, targetSkor, avgDailySkor) => {
  if (avgDailySkor <= 0) return null;
  const daysNeeded = Math.ceil((targetSkor - currentSkor) / avgDailySkor);
  return daysNeeded;
};

/**
 * ============================================================
 * 🔥 BARU: Hitung diskon voucher berdasarkan level
 * ============================================================
 */
export const calculateVoucherDiscount = (level, originalPoints) => {
  const discounts = {
    1: 0,
    2: 5,
    3: 10,
    4: 15,
    5: 20,
    6: 25,
    7: 30
  };

  const discountPercent = discounts[level] || 0;
  const discountedPoints = Math.floor(originalPoints * (1 - discountPercent / 100));

  return {
    originalPoints,
    discountedPoints,
    discountPercent,
    saving: originalPoints - discountedPoints
  };
};