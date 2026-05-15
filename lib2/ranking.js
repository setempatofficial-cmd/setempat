export function calculateScore(item, userLocation) {
  let score = 0;

  // PRIORITAS JARAK
  if (userLocation && item.latitude && item.longitude) {
    const dx = userLocation.latitude - item.latitude;
    const dy = userLocation.longitude - item.longitude;

    const distance = Math.sqrt(dx * dx + dy * dy);

    // makin dekat makin tinggi
    score += Math.max(0, 100 - distance * 1000);
  }

  // PRIORITAS WAKTU (konten baru naik)
  if (item.created_at) {
    const created = new Date(item.created_at).getTime();
    const now = Date.now();

    const hoursOld = (now - created) / (1000 * 60 * 60);

    score += Math.max(0, 50 - hoursOld);
  }
// Tambahkan bobot check-in
let checkInScore = 0;
const checkInCount = item.check_in_terbaru?.filter(c => c.status === 'di_sini').length || 0;
checkInScore = Math.min(30, checkInCount * 5); // Maks 30 poin
activityScore += checkInScore;

  return score;
}