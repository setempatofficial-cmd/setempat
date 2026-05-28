// hooks/useOptimizedFetch.js
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';

export function useLaporanWarga(options = {}) {
  const {
    limit = 10,           // Ganti jadi 10 (seperti TikTok)
    cacheDuration = 5 * 60 * 1000
  } = options;

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  const initialLoadDone = useRef(false);

  const fetchLaporan = async (pageNum = 1, append = false) => {
    if (!append && initialLoadDone.current) return;

    const start = (pageNum - 1) * limit;
    const end = start + limit - 1;

    console.log(`🔄 Fetching page ${pageNum}: rows ${start} to ${end}`);

    try {
      const { data: rawData, error, count } = await supabase
        .from("laporan_warga")
        .select(`
          *,
          tempat:tempat_id (
            id,
            name,
            alamat,
            category
          )
        `, { count: 'exact' })
        .eq("status", "approved")
        .eq("is_visible", true)
        .order("created_at", { ascending: false })
        .range(start, end);  // ← PAGINATION!

      if (error) throw new Error(error.message);

      // Mapping data
      const mappedData = rawData?.map(laporan => ({
        ...laporan,
        tempat_id: laporan.tempat_id ? Number(laporan.tempat_id) : null,
        display_location_name: laporan.tempat?.name || laporan.lokasi_name || laporan.lokasi_text || null,
        tempat_name: laporan.tempat?.name,
        tempat_category: laporan.tempat?.category,
      })) || [];

      if (append) {
        setData(prev => [...prev, ...mappedData]);
      } else {
        setData(mappedData);
      }

      setHasMore(mappedData.length === limit);
      if (count) setTotalCount(count);

      console.log(`✅ Fetched ${mappedData.length} reports (total: ${data.length + mappedData.length}/${count || '?'})`);

      return mappedData;

    } catch (err) {
      console.error("❌ Fetch failed:", err);
      throw err;
    }
  };

  // Load more function untuk infinite scroll
  const loadMore = useCallback(async () => {
    if (!hasMore || isFetchingMore) return;

    setIsFetchingMore(true);
    const nextPage = page + 1;
    await fetchLaporan(nextPage, true);
    setPage(nextPage);
    setIsFetchingMore(false);
  }, [hasMore, isFetchingMore, page]);

  // Refresh function
  const refresh = useCallback(async () => {
    setPage(1);
    setHasMore(true);
    setData([]);
    initialLoadDone.current = false;
    await fetchLaporan(1, false);
    initialLoadDone.current = true;
  }, []);

  // Initial load
  useEffect(() => {
    if (!initialLoadDone.current) {
      fetchLaporan(1, false).finally(() => {
        initialLoadDone.current = true;
        setLoading(false);
      });
    }
  }, []);

  return {
    data,
    loading,
    refresh,
    loadMore,      // ← untuk infinite scroll
    hasMore,       // ← apakah masih ada data
    totalCount,    // ← total semua laporan
    isFetchingMore // ← status loading lebih
  };
}