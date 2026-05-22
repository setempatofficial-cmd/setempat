// hooks/useSessionStorageCache.js
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getFromCache, saveToCache } from '@/lib/cacheUtils';

export function useSessionStorageCache(cacheKey, fetchFn, options = {}) {
  const {
    duration = 5 * 60 * 1000,
    autoFetch = true,
    dependencies = []
  } = options;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const hasFetchedRef = useRef(false);

  const loadData = useCallback(async (ignoreCache = false) => {
    setLoading(true);
    setError(null);

    if (!ignoreCache) {
      try {
        const cached = getFromCache(cacheKey);
        if (cached && cached.length !== undefined) {
          setData(cached);
          setLoading(false);
          hasFetchedRef.current = true;
          return;
        }
      } catch (cacheErr) {
        console.warn("Cache read error, will fetch fresh:", cacheErr);
        sessionStorage.removeItem(cacheKey);
      }
    }

    try {
      console.log(`🚀 Fetching ${cacheKey}...`);
      const freshData = await fetchFn();

      if (!freshData) {
        throw new Error("No data received from fetchFn");
      }

      setData(freshData);
      saveToCache(cacheKey, freshData, duration);

    } catch (err) {
      console.error(`❌ Fetch error for ${cacheKey}:`, err.message);
      setError(err.message || "Gagal mengambil data");

      // Jangan hapus data lama jika ada
      // Biarkan data sebelumnya tetap tampil

    } finally {
      setLoading(false);
      hasFetchedRef.current = true;
    }
  }, [cacheKey, fetchFn, duration]);

  useEffect(() => {
    if (autoFetch && !hasFetchedRef.current) {
      loadData();
    }
  }, [autoFetch, loadData, ...dependencies]);

  const refresh = useCallback(() => {
    // Hapus cache dulu
    sessionStorage.removeItem(cacheKey);
    return loadData(true);
  }, [loadData, cacheKey]);

  const updateCache = useCallback((newData) => {
    setData(newData);
    saveToCache(cacheKey, newData, duration);
  }, [cacheKey, duration]);

  return {
    data,
    loading,
    error,
    refresh,
    updateCache,
    hasData: data !== null && (Array.isArray(data) ? data.length > 0 : true)
  };
}