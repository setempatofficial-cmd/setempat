import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

// Cache untuk session (sementara)
const sessionCache = new Map();
const SESSION_CACHE_KEY = 'location_cache';
const CACHE_EXPIRY = 30 * 60 * 1000; // 30 menit

// Cache di localStorage (persistent)
const STORAGE_KEY = 'user_location_cache';
const MAX_CACHE_ITEMS = 20; // Maksimal 20 lokasi tersimpan

export function useLocationCache(userId) {
  const [cachedLocations, setCachedLocations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load cache dari localStorage
  useEffect(() => {
    if (!userId) return;
    loadCacheFromStorage();
  }, [userId]);

  const loadCacheFromStorage = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        // Filter berdasarkan userId dan hapus yang expired
        const userCache = data[userId] || [];
        const validCache = userCache.filter(item => 
          Date.now() - item.timestamp < CACHE_EXPIRY
        );
        setCachedLocations(validCache);
      }
    } catch (error) {
      console.error('Error loading cache:', error);
    }
  };

  // Simpan ke cache
  const saveToCache = useCallback(async (location) => {
    if (!userId || !location?.name) return;

    try {
      // Format data untuk cache
      const cacheItem = {
        id: location.id,
        name: location.name,
        category: location.category,
        alamat: location.alamat || location.fullName,
        latitude: location.lat || location.latitude,
        longitude: location.lng || location.longitude,
        source: location.source || 'database',
        timestamp: Date.now(),
        useCount: 1
      };

      // Update session cache
      sessionCache.set(`${userId}_${location.id}`, cacheItem);

      // Update localStorage
      const stored = localStorage.getItem(STORAGE_KEY);
      const data = stored ? JSON.parse(stored) : {};
      const userCache = data[userId] || [];

      // Cek apakah sudah ada
      const existingIndex = userCache.findIndex(item => 
        item.id === location.id || item.name === location.name
      );

      if (existingIndex !== -1) {
        // Update existing
        userCache[existingIndex] = {
          ...userCache[existingIndex],
          ...cacheItem,
          useCount: (userCache[existingIndex].useCount || 0) + 1,
          timestamp: Date.now()
        };
      } else {
        // Add new
        userCache.push(cacheItem);
      }

      // Sort by useCount (most used first)
      userCache.sort((a, b) => (b.useCount || 0) - (a.useCount || 0));

      // Limit cache size
      if (userCache.length > MAX_CACHE_ITEMS) {
        userCache.splice(MAX_CACHE_ITEMS);
      }

      data[userId] = userCache;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      
      setCachedLocations(userCache);
    } catch (error) {
      console.error('Error saving to cache:', error);
    }
  }, [userId]);

  // Ambil dari cache
  const getFromCache = useCallback((query) => {
    if (!query || query.length < 2) return [];

    const searchTerm = query.toLowerCase();
    const results = cachedLocations.filter(item => 
      item.name.toLowerCase().includes(searchTerm) ||
      (item.alamat && item.alamat.toLowerCase().includes(searchTerm))
    );

    // Sort by relevance and useCount
    return results.sort((a, b) => {
      const aScore = (a.useCount || 0) + (a.name.toLowerCase() === searchTerm ? 10 : 0);
      const bScore = (b.useCount || 0) + (b.name.toLowerCase() === searchTerm ? 10 : 0);
      return bScore - aScore;
    });
  }, [cachedLocations]);

  // Hapus dari cache
  const removeFromCache = useCallback((locationId) => {
    if (!userId) return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const data = stored ? JSON.parse(stored) : {};
      const userCache = data[userId] || [];
      
      data[userId] = userCache.filter(item => item.id !== locationId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      
      setCachedLocations(data[userId]);
      sessionCache.delete(`${userId}_${locationId}`);
    } catch (error) {
      console.error('Error removing from cache:', error);
    }
  }, [userId]);

  // Clear semua cache
  const clearCache = useCallback(() => {
    if (!userId) return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const data = stored ? JSON.parse(stored) : {};
      delete data[userId];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      
      setCachedLocations([]);
      
      // Clear session cache untuk user ini
      for (const key of sessionCache.keys()) {
        if (key.startsWith(`${userId}_`)) {
          sessionCache.delete(key);
        }
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }, [userId]);

  return {
    cachedLocations,
    isLoading,
    saveToCache,
    getFromCache,
    removeFromCache,
    clearCache
  };
}