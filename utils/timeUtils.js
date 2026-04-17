// utils/timeUtils.js

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