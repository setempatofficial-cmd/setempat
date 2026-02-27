// Menghitung skor popularitas berdasarkan beberapa faktor
export function calculateScore(item, location) {
  let score = 0;
  
  // Faktor jarak (semakin dekat semakin tinggi skornya)
  if (location && item.latitude && item.longitude) {
    const distance = calculateDistance(
      location.latitude,
      location.longitude,
      item.latitude,
      item.longitude
    );
    // Skor jarak: 100 untuk jarak 0 km, 0 untuk jarak > 10 km
    score += Math.max(0, 100 - distance * 10);
  }
  
  // Faktor rating (jika ada)
  if (item.rating) {
    score += item.rating * 20; // Rating 5 = 100 poin
  }
  
  // Faktor jumlah ulasan (jika ada)
  if (item.review_count) {
    score += Math.min(50, item.review_count); // Maks 50 poin
  }
  
  return score;
}

// Re-export calculateDistance agar bisa digunakan di ranking.js
import { calculateDistance } from './distance';