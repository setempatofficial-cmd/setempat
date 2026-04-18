// utils/timeUtils.js


/**
 * Format waktu relatif (2 jam lalu, 1 hari lalu, dll)
 * @param {string|Date} dateString - Tanggal yang akan diformat
 * @returns {string} - Waktu relatif dalam bahasa Indonesia
 */
export function formatTimeAgo(dateString) {
  const now = new Date();
  const past = new Date(dateString);
  const diffInSeconds = Math.floor((now - past) / 1000);
  
  if (isNaN(diffInSeconds)) return 'baru saja';
  
  if (diffInSeconds < 60) {
    return `${diffInSeconds} detik lalu`;
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} menit lalu`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} jam lalu`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays} hari lalu`;
  }
  
  if (diffInDays < 30) {
    const weeks = Math.floor(diffInDays / 7);
    return `${weeks} minggu lalu`;
  }
  
  if (diffInDays < 365) {
    const months = Math.floor(diffInDays / 30);
    return `${months} bulan lalu`;
  }
  
  const years = Math.floor(diffInDays / 365);
  return `${years} tahun lalu`;
}

/**
 * Format waktu lengkap dengan jam (contoh: 2 jam lalu • 14:30)
 * @param {string|Date} dateString 
 * @returns {string}
 */
export function formatTimeAgoWithClock(dateString) {
  const date = new Date(dateString);
  const timeAgo = formatTimeAgo(dateString);
  const clock = date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  return `${timeAgo} • ${clock}`;
}


/**
 * Menentukan waktu berdasarkan jam (sesuai kondisi Indonesia)
 * @param {Date|number} date - Date object atau timestamp
 * @returns {string} 'Pagi' | 'Siang' | 'Sore' | 'Malam'
 */
export function getIndonesianTimeLabel(date = new Date()) {
  const hour = typeof date === 'number' ? new Date(date).getHours() : date.getHours();
  
  // Standar waktu Indonesia (tropis)
  if (hour >= 4 && hour < 10) return 'Pagi';     // 04:00 - 09:59 (Subuh - menjelang siang)
  if (hour >= 10 && hour < 14) return 'Siang';  // 10:00 - 13:59 (Puncak panas)
  if (hour >= 14 && hour < 18) return 'Sore';   // 14:00 - 17:59 (Menjelang maghrib)
  return 'Malam'; // 18:00 - 03:59 (Malam hingga dini hari)
}

/**
 * Mendapatkan threshold untuk setiap waktu
 */
export const TIME_THRESHOLDS = {
  Pagi: { start: 4, end: 10, icon: '🌅', gradient: 'from-orange-400 to-yellow-300' },
  Siang: { start: 10, end: 14, icon: '☀️', gradient: 'from-amber-500 to-orange-400' },
  Sore: { start: 14, end: 18, icon: '🌆', gradient: 'from-orange-500 to-rose-400' },
  Malam: { start: 18, end: 4, icon: '🌙', gradient: 'from-slate-800 to-slate-900' }
};

/**
 * Cek apakah suatu jam termasuk dalam rentang (handle wrap around midnight)
 */
function isHourInRange(hour, start, end) {
  if (start <= end) {
    return hour >= start && hour < end;
  }
  // Rentang yang melewati midnight (contoh: 22 - 05)
  return hour >= start || hour < end;
}

/**
 * Mendapatkan info lengkap tentang waktu
 */
export function getTimeInfo(date = new Date()) {
  const hour = date.getHours();
  const timeLabel = getIndonesianTimeLabel(date);
  const threshold = TIME_THRESHOLDS[timeLabel];
  
  return {
    label: timeLabel,
    hour,
    icon: threshold.icon,
    gradient: threshold.gradient,
    isMalam: timeLabel === 'Malam',
    isPagi: timeLabel === 'Pagi',
    isSiang: timeLabel === 'Siang',
    isSore: timeLabel === 'Sore',
    nextChange: getNextTimeChange(hour)
  };
}

/**
 * Kapan waktu berikutnya berganti?
 */
function getNextTimeChange(currentHour) {
  const changes = [
    { hour: 4, label: 'Pagi' },
    { hour: 10, label: 'Siang' },
    { hour: 14, label: 'Sore' },
    { hour: 18, label: 'Malam' }
  ];
  
  const next = changes.find(c => c.hour > currentHour);
  if (next) {
    const hoursLeft = next.hour - currentHour;
    return { label: next.label, hoursLeft, inHours: hoursLeft };
  }
  
  // Besok pagi
  return { label: 'Pagi', hoursLeft: 24 - currentHour + 4, inHours: 24 - currentHour + 4 };
}