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

  return score;
}