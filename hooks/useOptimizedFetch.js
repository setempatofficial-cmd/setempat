// hooks/useOptimizedFetch.js
'use client';

import { useSessionStorageCache } from './useSessionStorageCache';
import { supabase } from '@/lib/supabaseClient';

/**
 * Hook khusus untuk fetch laporan_warga dengan cache
 * @param {object} options - Options { limit, cacheDuration }
 */
export function useLaporanWarga(options = {}) {
  const { limit = 50, cacheDuration = 5 * 60 * 1000 } = options;

  const fetchLaporan = async () => {
    const { data, error } = await supabase
      .from("laporan_warga")
      .select(`
        id,
        deskripsi,
        photo_url,
        video_url,
        user_name,
        user_avatar,
        tipe,
        created_at,
        tempat_id,
        tempat:tempat_id (name)
      `)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  };

  return useSessionStorageCache(
    'cache_laporan_warga',
    fetchLaporan,
    { duration: cacheDuration, dependencies: [limit] }
  );
}

// ========== HOOK UNTUK REKOMENDASI FEED ==========
export function useRekomendasiFeed(currentItemId, options = {}) {
  const { limit = 15, radius = 10 } = options;
  
  const fetchRekomendasi = useCallback(async () => {
    if (!currentItemId) return [];
    
    let query = supabase
      .from("feed_view")
      .select("*")
      .neq("id", currentItemId)
      .order("created_at", { ascending: false })
      .limit(limit);
    
    // Filter berdasarkan lokasi (opsional)
    if (options.userLocation?.latitude) {
      const lat = options.userLocation.latitude;
      const lng = options.userLocation.longitude;
      const latDelta = radius / 111;
      const lngDelta = radius / (111 * Math.cos((lat * Math.PI) / 180));
      
      query = query
        .gte("latitude", lat - latDelta)
        .lte("latitude", lat + latDelta)
        .gte("longitude", lng - lngDelta);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    
    return data || [];
  }, [currentItemId, limit, radius, options.userLocation]);
  
  const cacheKey = `rekomendasi_${currentItemId}`;
  
  return useSessionStorageCache(cacheKey, fetchRekomendasi, {
    duration: 5 * 60 * 1000,
    autoFetch: !!currentItemId,
    dependencies: [currentItemId]
  });
}