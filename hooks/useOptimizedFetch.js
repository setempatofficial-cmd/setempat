// hooks/useOptimizedFetch.js
'use client';

import { useSessionStorageCache } from './useSessionStorageCache';
import { supabase } from '@/lib/supabaseClient';

export function useLaporanWarga(options = {}) {
  const { limit = 50, cacheDuration = 5 * 60 * 1000 } = options;

  const fetchLaporan = async () => {
    console.log("🔄 Fetching from laporan_warga with JOIN to tempat...");

    try {
      // ✅ Gunakan 'category' bukan 'kategori'
      const { data, error } = await supabase
        .from("laporan_warga")
        .select(`
          *,
          tempat:tempat_id (
            id,
            name,
            alamat,
            category
          )
        `)
        .eq("status", "approved")
        .eq("is_visible", true)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("❌ Supabase error:", error);
        throw new Error(error.message);
      }

      // Mapping data + handle tipe data bigint
      const mappedData = data?.map(laporan => {
        // Pastikan tempat_id dalam bentuk number
        const tempatId = laporan.tempat_id ? Number(laporan.tempat_id) : null;

        return {
          ...laporan,
          tempat_id: tempatId,
          display_location_name: laporan.tempat?.name || laporan.lokasi_name || laporan.lokasi_text || null,
          tempat_name: laporan.tempat?.name,
          tempat_category: laporan.tempat?.category,
        };
      }) || [];

      console.log(`✅ Fetched ${mappedData.length} reports`);

      if (mappedData.length > 0) {
        console.log("Sample data:", {
          id: mappedData[0].id,
          display_location_name: mappedData[0].display_location_name,
          tempat_name: mappedData[0].tempat_name,
          has_tempat: !!mappedData[0].tempat
        });
      }

      return mappedData;

    } catch (err) {
      console.error("❌ Fetch failed:", err);
      throw err;
    }
  };

  return useSessionStorageCache(
    'cache_laporan_warga',
    fetchLaporan,
    { duration: cacheDuration, autoFetch: true }
  );
}