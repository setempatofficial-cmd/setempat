// lib/cacheUtils.js

const CACHE_DURATION = 5 * 60 * 1000; // 5 menit default

/**
 * Save data ke sessionStorage dengan timestamp
 * @param {string} key - Cache key
 * @param {any} data - Data yang akan disimpan
 * @param {number} duration - Cache duration in ms (optional)
 */
export const saveToCache = (key, data, duration = CACHE_DURATION) => {
  if (typeof window === 'undefined') return;
  try {
    const cacheData = {
      data,
      timestamp: Date.now(),
      duration
    };
    sessionStorage.setItem(key, JSON.stringify(cacheData));
  } catch (e) {
    console.warn('Failed to save cache:', e);
  }
};

/**
 * Get data dari sessionStorage
 * @param {string} key - Cache key
 * @returns {any|null} Data jika masih fresh, null jika expired atau tidak ada
 */
export const getFromCache = (key) => {
  if (typeof window === 'undefined') return null;
  try {
    const cached = sessionStorage.getItem(key);
    if (!cached) return null;
    
    const { data, timestamp, duration = CACHE_DURATION } = JSON.parse(cached);
    const isFresh = Date.now() - timestamp < duration;
    
    return isFresh ? data : null;
  } catch (e) {
    console.warn('Failed to get cache:', e);
    return null;
  }
};

/**
 * Hapus cache berdasarkan key
 * @param {string} key - Cache key (optional, jika tidak diisi hapus semua)
 */
export const clearCache = (key) => {
  if (typeof window === 'undefined') return;
  if (key) {
    sessionStorage.removeItem(key);
  } else {
    // Hapus semua cache dengan prefix tertentu
    const keys = Object.keys(sessionStorage);
    keys.forEach(k => {
      if (k.startsWith('cache_')) sessionStorage.removeItem(k);
    });
  }
};

/**
 * Generate cache key dari params
 * @param {string} prefix - Prefix key
 * @param {object} params - Parameters untuk generate key
 * @returns {string}
 */
export const generateCacheKey = (prefix, params = {}) => {
  const sortedParams = Object.keys(params).sort().map(k => `${k}_${params[k]}`).join('_');
  return `cache_${prefix}_${sortedParams}`;
};