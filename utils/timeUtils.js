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
  if (hour >= 4 && hour < 10) return 'Pagi';     // 04:00 - 09:59
  if (hour >= 10 && hour < 15) return 'Siang';  // 10:00 - 14:59
  if (hour >= 15 && hour < 18) return 'Sore';   // 15:00 - 17:59
  return 'Malam'; // 18:00 - 03:59
}

/**
 * Menentukan waktu berdasarkan jam (LOWERCASE version untuk kompatibilitas)
 * @param {Date|number} date - Date object atau timestamp
 * @returns {string} 'pagi' | 'siang' | 'sore' | 'malam'
 */
export function getIndonesianTimeLabelLower(date = new Date()) {
  return getIndonesianTimeLabel(date).toLowerCase();
}

/**
 * Mendapatkan threshold untuk setiap waktu
 */
export const TIME_THRESHOLDS = {
  Pagi: { start: 4, end: 10, label: 'pagi', icon: '🌅', gradient: 'from-orange-400 to-yellow-300' },
  Siang: { start: 10, end: 15, label: 'siang', icon: '☀️', gradient: 'from-amber-500 to-orange-400' },
  Sore: { start: 15, end: 18, label: 'sore', icon: '🌆', gradient: 'from-orange-500 to-rose-400' },
  Malam: { start: 18, end: 4, label: 'malam', icon: '🌙', gradient: 'from-slate-800 to-slate-900' }
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
    labelLower: timeLabel.toLowerCase(),
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
    { hour: 15, label: 'Sore' },  // FIX: 15, bukan 14!
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

// ========== PERFORMANCE: CACHE SYSTEM ==========
const timeAgoCache = new Map();
const CACHE_DURATION = 60000; // 1 menit

/**
 * Format waktu relatif DENGAN CACHE (untuk performa maksimal)
 * Gunakan ini di komponen yang merender banyak timestamp
 */
export function formatTimeAgoCached(dateString) {
  if (!dateString) return 'baru saja';
  
  const cacheKey = typeof dateString === 'string' ? dateString : dateString.toISOString?.() || String(dateString);
  const cached = timeAgoCache.get(cacheKey);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    return cached.value;
  }
  
  const result = formatTimeAgo(dateString);
  
  // Limit cache size
  if (timeAgoCache.size > 300) {
    const firstKey = timeAgoCache.keys().next().value;
    timeAgoCache.delete(firstKey);
  }
  
  timeAgoCache.set(cacheKey, { value: result, timestamp: now });
  return result;
}

/**
 * Batch format untuk array of dates (paling efisien)
 */
export function batchFormatTimeAgo(dateStrings) {
  const now = Date.now();
  const results = {};
  const uncached = [];
  
  for (const date of dateStrings) {
    if (!date) {
      results[date] = 'baru saja';
      continue;
    }
    
    const cacheKey = typeof date === 'string' ? date : String(date);
    const cached = timeAgoCache.get(cacheKey);
    
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      results[date] = cached.value;
    } else {
      uncached.push(date);
    }
  }
  
  // Process uncached in batch
  for (const date of uncached) {
    const result = formatTimeAgo(date);
    const cacheKey = typeof date === 'string' ? date : String(date);
    results[date] = result;
    timeAgoCache.set(cacheKey, { value: result, timestamp: now });
  }
  
  return results;
}

// ========== PERFORMANCE: HOOK DENGAN UPDATE MINIMAL ==========
import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook untuk mendapatkan waktu saat ini dengan update minimal
 * Hanya update setiap MENIT, bukan setiap DETIK
 */
export function useOptimizedClock() {
  const [timeInfo, setTimeInfo] = useState(() => getTimeInfo());
  const intervalRef = useRef(null);
  
  useEffect(() => {
    // Update setiap menit (bukan setiap detik)
    intervalRef.current = setInterval(() => {
      setTimeInfo(getTimeInfo());
    }, 60000); // 1 menit
    
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);
  
  return timeInfo;
}

/**
 * Hook untuk format waktu dengan cache
 */
export function useFormattedTimeAgo(dateString, options = { debounceMs: 0 }) {
  const [formatted, setFormatted] = useState(() => formatTimeAgoCached(dateString));
  const dateRef = useRef(dateString);
  
  useEffect(() => {
    if (dateRef.current === dateString) return;
    dateRef.current = dateString;
    
    const update = () => setFormatted(formatTimeAgoCached(dateString));
    
    if (options.debounceMs > 0) {
      const timer = setTimeout(update, options.debounceMs);
      return () => clearTimeout(timer);
    }
    
    update();
  }, [dateString, options.debounceMs]);
  
  return formatted;
}