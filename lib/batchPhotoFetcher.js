import { supabase } from "./supabaseClient";

// Cache
const batchPhotoCache = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 menit
const pendingBatches = new Map();

const normalizeOfficialPhotos = (photos) => {
  if (!photos) return { pagi: [], siang: [], sore: [], malam: [] };
  const result = { pagi: [], siang: [], sore: [], malam: [] };
  const timeKeys = ['pagi', 'siang', 'sore', 'malam'];
  timeKeys.forEach(key => {
    const data = photos[key];
    if (data) {
      if (Array.isArray(data)) result[key] = data;
      else if (typeof data === 'object' && data.url) result[key] = [data];
    }
  });
  return result;
};

export const getOfficialPhotosBatch = async (tempatIds) => {
  if (!tempatIds || tempatIds.length === 0) return new Map();
  
  const uniqueIds = [...new Set(tempatIds)];
  
  // Check cache dulu
  const needFetch = uniqueIds.filter(id => {
    const cached = batchPhotoCache.get(id);
    return !cached || Date.now() - cached.timestamp > CACHE_TTL;
  });
  
  // Semua dari cache
  if (needFetch.length === 0) {
    const result = new Map();
    uniqueIds.forEach(id => {
      const cached = batchPhotoCache.get(id);
      if (cached) result.set(id, cached.data);
    });
    return result;
  }
  
  // Cek pending batch request
  const batchKey = needFetch.sort().join(',');
  if (pendingBatches.has(batchKey)) {
    return pendingBatches.get(batchKey);
  }
  
  const promise = (async () => {
    try {
      // 🔥 SATU QUERY untuk SEMUA tempat
      const { data, error } = await supabase
        .from('tempat')
        .select('id, photos')
        .in('id', needFetch);
      
      if (error) throw error;
      
      const resultMap = new Map();
      
      (data || []).forEach(item => {
        const normalized = normalizeOfficialPhotos(item.photos);
        batchPhotoCache.set(item.id, { data: normalized, timestamp: Date.now() });
        resultMap.set(item.id, normalized);
      });
      
      // Tempat yang tidak punya foto
      needFetch.forEach(id => {
        if (!resultMap.has(id)) {
          const empty = { pagi: [], siang: [], sore: [], malam: [] };
          batchPhotoCache.set(id, { data: empty, timestamp: Date.now() });
          resultMap.set(id, empty);
        }
      });
      
      return resultMap;
    } catch (error) {
      console.error('Batch fetch error:', error?.message);
      
      // Fallback ke cache
      const fallback = new Map();
      needFetch.forEach(id => {
        const cached = batchPhotoCache.get(id);
        fallback.set(id, cached?.data || { pagi: [], siang: [], sore: [], malam: [] });
      });
      return fallback;
    } finally {
      pendingBatches.delete(batchKey);
    }
  })();
  
  pendingBatches.set(batchKey, promise);
  return promise;
};

// Prefetch untuk card yang akan muncul
export const prefetchOfficialPhotos = (tempatIds) => {
  if (!tempatIds || tempatIds.length === 0) return;
  
  const needFetch = tempatIds.filter(id => {
    const cached = batchPhotoCache.get(id);
    return !cached || Date.now() - cached.timestamp > CACHE_TTL;
  });
  
  if (needFetch.length > 0) {
    // Fetch di background tanpa blocking
    setTimeout(() => {
      getOfficialPhotosBatch(needFetch).catch(console.error);
    }, 100);
  }
};