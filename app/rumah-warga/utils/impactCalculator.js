// ============ DAMPAK LAPORAN (RAMAI, BERDAMPAK, SOROTAN) ============

/**
 * Menghitung status dampak per laporan
 * @param {Array} laporan - Array laporan dengan data likes, views, is_featured
 * @returns {Array} Laporan dengan tambahan field impact
 */
export const calculateImpactStatus = (laporan) => {
  return laporan.map(lap => {
    const likes = lap.likes || 0;
    const views = lap.views || 0;
    let impact = null;
    let impactLevel = 0;

    // Level 3: Sorotan Setempat (tertinggi, kurasi manual)
    if (lap.is_featured) {
      impact = "sorotan";
      impactLevel = 3;
    }
    // Level 2: Berdampak (otomatis) - lebih berat
    else if (views >= 1000 || likes >= 100) {
      impact = "berdampak";
      impactLevel = 2;
    }
    // Level 1: Ramai Dibicarakan (otomatis) - lebih berat
    else if (views >= 200 || likes >= 20) {
      impact = "ramai";
      impactLevel = 1;
    }

    return { ...lap, impact, impactLevel };
  });
};

/**
 * Menghitung statistik agregat dari laporan
 * @param {Array} laporanWithImpact - Array laporan dengan data lengkap
 * @returns {object} Statistik agregat
 */
export const aggregateStats = (laporanWithImpact) => {
  const totalLaporan = laporanWithImpact.length;
  const totalLikes = laporanWithImpact.reduce((sum, l) => sum + (l.likes || 0), 0);
  const totalViews = laporanWithImpact.reduce((sum, l) => sum + (l.views || 0), 0);
  const totalFoto = laporanWithImpact.filter(l => l.photo_url || l.image_url).length;
  const totalVideo = laporanWithImpact.filter(l => l.video_url).length;

  const laporanRamai = laporanWithImpact.filter(l => l.impact === "ramai").length;
  const laporanBerdampak = laporanWithImpact.filter(l => l.impact === "berdampak").length;
  const featuredCount = laporanWithImpact.filter(l => l.is_featured === true).length;

  const bestLaporanLikes = laporanWithImpact.length > 0
    ? Math.max(...laporanWithImpact.map(l => l.likes || 0))
    : 0;
  const bestLaporanViews = laporanWithImpact.length > 0
    ? Math.max(...laporanWithImpact.map(l => l.views || 0))
    : 0;

  // Hitung hari aktif (unique dates)
  const uniqueDays = new Set();
  laporanWithImpact.forEach(lap => {
    if (lap.created_at) {
      const date = new Date(lap.created_at).toDateString();
      uniqueDays.add(date);
    }
  });
  const hariAktif = uniqueDays.size;

  return {
    totalLaporan,
    totalLikes,
    totalViews,
    totalFoto,
    totalVideo,
    laporanRamai,
    laporanBerdampak,
    featuredCount,
    bestLaporanLikes,
    bestLaporanViews,
    hariAktif
  };
};

/**
 * ============================================================
 * 🔥 UPDATED: Menghitung poin setempat (reward currency)
 * ============================================================
 * Penyesuaian berdasarkan model bisnis:
 * - 1 Poin = Rp 500 (nilai tukar)
 * - User rata-rata dapat ~150 poin/bulan
 * - Cukup untuk 3x kopi atau 1x live + 1x kopi
 * ============================================================
 * 
 * @param {Array} laporan - Array laporan
 * @param {number} totalLikes - Total likes dari semua laporan
 * @param {number} totalViews - Total views dari semua laporan
 * @param {number} featuredCount - Jumlah laporan featured
 * @param {object} options - Opsi tambahan (bonus level, lencana)
 * @returns {number} Total poin setempat
 */
export const calculatePoinSetempat = (
  laporan,
  totalLikes,
  totalViews,
  featuredCount,
  options = {}
) => {
  let poin = 0;

  // ============================================================
  // 1. POIN DARI LAPORAN (DIPERKECIL)
  // ============================================================
  // Sebelumnya: teks=1, foto=2, video=4
  // Sekarang:   teks=1, foto=1, video=2 (lebih realistis)
  // ============================================================
  for (const lap of laporan) {
    let poinLaporan = 1; // teks saja
    if (lap.photo_url || lap.image_url) poinLaporan = 1; // foto (tetap 1)
    if (lap.video_url) poinLaporan = 2; // video (turun dari 4 ke 2)
    poin += poinLaporan;
  }

  // ============================================================
  // 2. POIN DARI LIKE (DIPERKECIL)
  // ============================================================
  // Sebelumnya: 10 likes = 5 poin
  // Sekarang:   10 likes = 3 poin (lebih berat)
  // ============================================================
  poin += Math.floor(totalLikes / 10) * 3;

  // ============================================================
  // 3. POIN DARI VIEWS (DIPERKECIL)
  // ============================================================
  // Sebelumnya: 50 views = 5 poin
  // Sekarang:   50 views = 3 poin (lebih berat)
  // ============================================================
  poin += Math.floor(totalViews / 50) * 3;

  // ============================================================
  // 4. POIN DARI SOROTAN (DIPERKECIL)
  // ============================================================
  // Sebelumnya: 1 featured = 25 poin
  // Sekarang:   1 featured = 15 poin (lebih berat)
  // ============================================================
  poin += featuredCount * 15;

  // ============================================================
  // 5. BONUS LEVEL (BARU)
  // ============================================================
  // User dengan level tinggi dapat bonus tambahan
  // Level 1-2: 0-2 poin/minggu
  // Level 3-4: 5-10 poin/minggu
  // Level 5-6: 20-40 poin/minggu
  // Level 7: 80 poin/minggu
  // ============================================================
  if (options.level) {
    const levelBonus = {
      1: 0,
      2: 2,
      3: 5,
      4: 10,
      5: 20,
      6: 40,
      7: 80
    };
    const bonusPerMinggu = levelBonus[options.level] || 0;
    // Asumsi 4 minggu dalam sebulan
    poin += bonusPerMinggu * 4;
  }

  // ============================================================
  // 6. BONUS LENCANA (BARU)
  // ============================================================
  // Setiap lencana aktif memberi bonus 10-15 poin/bulan
  // ============================================================
  if (options.badges && options.badges.length > 0) {
    // Setiap lencana = +10 poin/bulan
    poin += options.badges.length * 10;
  }

  return poin;
};

/**
 * ============================================================
 * 🔥 BARU: Konversi Poin ke Rupiah (untuk perhitungan bisnis)
 * ============================================================
 */
export const convertPoinToRupiah = (poin) => {
  return poin * 500; // 1 Poin = Rp 500
};

/**
 * ============================================================
 * 🔥 BARU: Cek apakah poin cukup untuk voucher tertentu
 * ============================================================
 */
export const isPoinEnough = (poin, voucherPoints) => {
  return poin >= voucherPoints;
};

/**
 * ============================================================
 * 🔥 BARU: Hitung sisa poin setelah tukar voucher
 * ============================================================
 */
export const getRemainingPoin = (poin, voucherPoints) => {
  return poin - voucherPoints;
};

/**
 * ============================================================
 * 🔥 BARU: Rekomendasi voucher berdasarkan poin
 * ============================================================
 */
export const getVoucherRecommendations = (poin, vouchers) => {
  return vouchers
    .filter(v => v.points_required <= poin)
    .sort((a, b) => b.points_required - a.points_required);
};