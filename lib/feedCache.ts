// ===========================================
// FILE: lib/feedCache.js
// LOKASI: C:\Users\yogia\setempat\lib\feedCache.js
// ===========================================

/**
 * FeedCache - Simple cache untuk feed data
 */
class FeedCache {
  constructor(maxSize = 100) {
    this.cache = new Map();
    this.timers = new Map();
    this.maxSize = maxSize;
  }

  set(key, data, ttl = 300000) {
    // Hapus item terlama jika cache penuh
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.delete(firstKey);
      }
    }

    // Hapus timer lama jika ada
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    // Simpan data
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });

    // Set timer untuk auto-expire
    const timer = setTimeout(() => {
      this.delete(key);
    }, ttl);

    this.timers.set(key, timer);
  }

  get(key) {
    const item = this.cache.get(key);
    
    if (!item) return null;

    // Cek apakah sudah expired
    const age = Date.now() - item.timestamp;
    if (age > item.ttl) {
      this.delete(key);
      return null;
    }

    return item.data;
  }

  delete(key) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
      
      if (this.timers.has(key)) {
        clearTimeout(this.timers.get(key));
        this.timers.delete(key);
      }
    }
  }

  clear() {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }
}

// Buat instance singleton
const feedCache = new FeedCache();

// Cache keys helper
export const CACHE_KEYS = {
  FEED_PROCESSED: (itemId) => `feed:processed:${itemId}`,
  PHOTO_URLS: (itemId, timeTag) => `photos:${itemId}:${timeTag}`,
  VALIDATION_COUNT: (itemId) => `validation:${itemId}`,
  COMMENTS: (itemId) => `comments:${itemId}`,
};

// Export instance
export { feedCache };

// Export class juga jika diperlukan
export default feedCache;