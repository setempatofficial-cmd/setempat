import { calculateDistance } from './distance';

export function calculateScore(item, location) {
  let score = 0;
  const now = Date.now();
  
  // 1. FAKTOR JARAK (0–100 poin) - bobot 30%
  if (location && item.latitude && item.longitude) {
    const distance = calculateDistance(
      location.latitude,
      location.longitude,
      item.latitude,
      item.longitude
    );
    // Skor jarak: 100 untuk jarak 0 km, 0 untuk jarak > 10 km
    score += Math.max(0, 100 - distance * 10) * 0.3;
  }
  
  // 2. AKTIVITAS INTERNAL (0–100 poin) - bobot 40%
  let activityScore = 0;
  
  // Komentar (testimonial)
  const komentarCount = item.testimonial_terbaru?.length || 0;
  activityScore += Math.min(30, komentarCount * 5); // Maks 30 poin
  
  // Laporan warga
  const laporanCount = item.laporan_terbaru?.length || 0;
  activityScore += Math.min(30, laporanCount * 10); // Maks 30 poin
  
  // Estimasi orang
  const estimasiOrang = parseInt(item.estimasi_orang) || 0;
  activityScore += Math.min(30, estimasiOrang * 0.5); // Maks 30 poin (60 orang)
  
  // Batasi maks 100 poin
  activityScore = Math.min(100, activityScore);
  score += activityScore * 0.4; // Bobot 40%
  
  // 3. EKSTERNAL SIGNAL (0–100 poin) - bobot 15%
  let externalScore = 0;
  
  // Ambil data external signals (dari feed_view)
  const externalSignals = item.external_signals_terbaru || [];
  
  // Hitung signal dalam 24 jam terakhir
  const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
  
  externalSignals.forEach(signal => {
    const signalTime = new Date(signal.created_at);
    if (signalTime > oneDayAgo) {
      // Bobot per source
      switch(signal.source) {
        case 'instagram':
          externalScore += 8;
          // Bonus untuk likes/comments (simulasi engagement)
          if (signal.likes_count) externalScore += Math.min(5, signal.likes_count / 10);
          if (signal.comments_count) externalScore += Math.min(3, signal.comments_count / 5);
          break;
        case 'tiktok':
          externalScore += 10;
          break;
        case 'berita':
          externalScore += 15;
          break;
        case 'wa':
          externalScore += 5;
          break;
        default:
          externalScore += 3;
      }
    }
  });
  
  externalScore = Math.min(100, externalScore);
  score += externalScore * 0.15; // Bobot 15%
  
  // 4. FRESHNESS (0–100 poin) - bobot 10%
  let freshnessScore = 0;
  if (item.lastActivity) {
    const lastActivity = new Date(item.lastActivity).getTime();
    const hoursAgo = (now - lastActivity) / (1000 * 60 * 60);
    
    // Formula: 100 untuk <1 jam, turun logaritmik
    if (hoursAgo < 1) {
      freshnessScore = 100;
    } else if (hoursAgo < 24) {
      freshnessScore = 80 - (hoursAgo - 1) * 2; // Linear turun
    } else if (hoursAgo < 72) {
      freshnessScore = 40 - (hoursAgo - 24) * 0.5;
    } else {
      freshnessScore = Math.max(0, 20 - (hoursAgo - 72) * 0.2);
    }
  }
  score += freshnessScore * 0.1; // Bobot 10%
  
  // 5. TRUST (0–50 poin) - bobot 5%
  let trustScore = 10; // Default
  
  // Nanti bisa ditambah: user terverifikasi, sumber terpercaya, dll
  // Misal: jika ada external signal dengan confidence tinggi
  if (externalSignals.some(s => s.confidence > 0.9)) {
    trustScore += 10;
  }
  
  score += trustScore * 0.05; // Bobot 5%
  
  return Math.round(score); // Bulatkan
}