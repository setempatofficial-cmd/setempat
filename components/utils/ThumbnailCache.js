"use client";

/**
 * Thumbnail Cache Manager - Centralized cache untuk semua komponen
 */

class ThumbnailCache {
  constructor(limit = 200) {
    this.limit = limit;
    this.cache = new Map();
    this.hits = 0;
    this.misses = 0;
  }
  
  get(key) {
    const value = this.cache.get(key);
    if (value) {
      this.hits++;
      // Move to front (LRU)
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }
    this.misses++;
    return null;
  }
  
  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.limit) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }
  
  has(key) {
    return this.cache.has(key);
  }
  
  clear() {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }
  
  getStats() {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? (this.hits / total * 100).toFixed(2) + '%' : '0%'
    };
  }
}

// Singleton instance untuk digunakan di seluruh app
let thumbnailCacheInstance = null;

export const getThumbnailCache = () => {
  if (!thumbnailCacheInstance) {
    thumbnailCacheInstance = new ThumbnailCache(200);
  }
  return thumbnailCacheInstance;
};

export default ThumbnailCache;