// hooks/useSessionStorageCache.js
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getFromCache, saveToCache, generateCacheKey } from '@/lib/cacheUtils';

/**
 * Hook untuk data dengan cache sessionStorage
 * @param {string} cacheKey - Key untuk cache
 * @param {Function} fetchFn - Function untuk fetch data (jika cache expired)
 * @param {object} options - Options { duration, autoFetch, dependencies }
 */
export function useSessionStorageCache(cacheKey, fetchFn, options = {}) {
  const {
    duration = 5 * 60 * 1000, // 5 menit default
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

    // Cek cache dulu (kecuali ignoreCache)
    if (!ignoreCache) {
      const cached = getFromCache(cacheKey);
      if (cached) {
        setData(cached);
        setLoading(false);
        hasFetchedRef.current = true;
        return;
      }
    }

    // Fetch fresh data
    try {
      const freshData = await fetchFn();
      setData(freshData);
      saveToCache(cacheKey, freshData, duration);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
      hasFetchedRef.current = true;
    }
  }, [cacheKey, fetchFn, duration]);

  // Auto fetch on mount
  useEffect(() => {
    if (autoFetch && !hasFetchedRef.current) {
      loadData();
    }
  }, [autoFetch, loadData, ...dependencies]);

  // Manual refresh
  const refresh = useCallback(() => loadData(true), [loadData]);

  // Update cache after mutation (like add new report)
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