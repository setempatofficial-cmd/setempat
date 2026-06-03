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
 * Menghitung poin setempat (reward currency)
 * @param {Array} laporan - Array laporan
 * @param {number} totalLikes - Total likes dari semua laporan
 * @param {number} totalViews - Total views dari semua laporan
 * @param {number} featuredCount - Jumlah laporan featured
 * @returns {number} Total poin setempat
 */
export const calculatePoinSetempat = (laporan, totalLikes, totalViews, featuredCount) => {
  let poin = 0;

  // Poin dari laporan
  for (const lap of laporan) {
    let poinLaporan = 1; // teks saja
    if (lap.photo_url || lap.image_url) poinLaporan = 2; // + foto
    if (lap.video_url) poinLaporan = 4; // + video
    poin += poinLaporan;
  }

  // Poin dari like (setiap 10 like = +5)
  poin += Math.floor(totalLikes / 10) * 5;

  // Poin dari views (setiap 50 views = +5)
  poin += Math.floor(totalViews / 50) * 5;

  // Poin dari sorotan
  poin += featuredCount * 25;

  return poin;
};