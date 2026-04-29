// lib/distance.js
export function hitungJarak(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius bumi dalam km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Jarak dalam km
}

function deg2rad(deg) {
  return deg * (Math.PI/180);
}

// ✅ TAMBAHKAN FUNGSI INI
export function formatJarak(jarakKm) {
  if (jarakKm < 1) {
    return `${Math.round(jarakKm * 1000)} meter`;
  }
  return `${jarakKm.toFixed(1)} km`;
}

export const calculateDistance = hitungJarak;