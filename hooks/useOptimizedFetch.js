// hooks/useOptimizedFetch.js
'use client';

import { useSessionStorageCache } from './useSessionStorageCache';
import { supabase } from '@/lib/supabaseClient';

export function useLaporanWarga(options = {}) {
  const { limit = 50, cacheDuration = 5 * 60 * 1000 } = options;

  const fetchLaporan = async () => {
    // 🔥 PAKAI VIEW yang sudah Anda buat
    const { data, error } = await supabase
      .from("laporan_with_location")  // Ganti dari "laporan_warga" ke view Anda
      .select("*")
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