// hooks/usePostDetail.js
'use client';

import { useSessionStorageCache } from './useSessionStorageCache';
import { supabase } from '@/lib/supabaseClient';

/**
 * Hook untuk mengambil detail post (tempat + laporan + komentar)
 * @param {number|string} postId - ID post yang akan diambil
 * @param {object} options - Options { cacheDuration, autoFetch }
 */
export function usePostDetail(postId, options = {}) {
  const { cacheDuration = 5 * 60 * 1000, autoFetch = true } = options;

  const fetchPost = async () => {
    if (!postId) return null;
    
    const idNum = typeof postId === 'string' ? parseInt(postId) : postId;
    
    // Validasi ID
    if (isNaN(idNum)) {
      throw new Error('ID konten tidak valid');
    }
    
    try {
      // 1. Cari di tabel tempat
      const { data: tempat, error: tempatError } = await supabase
        .from("tempat")
        .select("*")
        .eq("id", idNum)
        .maybeSingle();

      if (tempat && !tempatError) {
        // Fetch laporan dan komentar PARALLEL (lebih cepat)
        const [laporanResult, komentarResult] = await Promise.all([
          supabase
            .from("laporan_warga")
            .select("*")
            .eq("tempat_id", idNum)
            .order("created_at", { ascending: false }),
          supabase
            .from("komentar")
            .select("*")
            .eq("tempat_id", idNum)
            .order("created_at", { ascending: false })
        ]);

        return {
          item: {
            ...tempat,
            laporan_terbaru: laporanResult.data || []
          },
          comments: { [idNum]: komentarResult.data || [] }
        };
      }

      // 2. Cari di tabel laporan_warga
      const { data: laporan, error: laporanError } = await supabase
        .from("laporan_warga")
        .select("*, tempat:tempat_id(*)")
        .eq("id", idNum)
        .maybeSingle();

      if (laporan && laporan.tempat && !laporanError) {
        const { data: komentarData } = await supabase
          .from("komentar")
          .select("*")
          .eq("tempat_id", laporan.tempat_id)
          .order("created_at", { ascending: false });

        return {
          item: {
            ...laporan.tempat,
            laporan_terbaru: [laporan]
          },
          comments: { [laporan.tempat_id]: komentarData || [] }
        };
      }

      // 3. Tidak ditemukan
      throw new Error('Konten tidak ditemukan');
      
    } catch (err) {
      console.error("usePostDetail error:", err);
      throw err;
    }
  };

  const cacheKey = `post_detail_${postId}`;

  return useSessionStorageCache(cacheKey, fetchPost, {
    duration: cacheDuration,
    autoFetch: autoFetch && !!postId,
    dependencies: [postId]
  });
}