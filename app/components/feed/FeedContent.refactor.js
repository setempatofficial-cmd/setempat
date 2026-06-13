"use client";

import React, { useEffect, useState, useCallback, useRef, useMemo, lazy, Suspense, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

// Hooks & Context
import { useAuth } from "@/app/context/AuthContext";
import { useLocation } from "@/components/LocationProvider";
import { useTheme } from "@/app/hooks/useTheme";

// Components
import FeedCard from "./FeedCard";
import Header from "@/components/Header";
import LocationModal from "@/components/LocationModal";
import FormLaporanAktif from "@/app/components/modals/FormLaporanAktif";
import FeedCardWrapper from "@/components/FeedCardWrapper";
import SmartBottomNav from "@/app/components/layout/SmartBottomNav";
import UploadModal from "@/components/UploadModal";
import AuthModal from "@/app/components/auth/AuthModal";

// Libs
import { supabase } from "../../../lib/supabaseClient";
import { processFeedItem } from "../../../lib/feedEngine";

// Lazy load heavy modals
const AIModal = React.lazy(() => import("../ai/AIModal"));
const KomentarModal = React.lazy(() => import("./KomentarModal"));
const SearchModal = React.lazy(() => import("./SearchModal"));

// ========== CONSTANTS ==========
const CACHE_DURATION = 10 * 60 * 1000; // 10 menit
const MAX_CACHE_ITEMS = 15;
const MAX_MEMORY_ITEMS = 25;
const PAGE_SIZE = 8;
const PREFETCH_THRESHOLD = 3;

// ========== HELPER FUNCTIONS ==========
const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const getDistanceScore = (distance) => {
  if (!distance) return 20;
  if (distance <= 0.5) return 100;
  if (distance <= 1) return 90;
  if (distance <= 2) return 80;
  if (distance <= 3) return 70;
  if (distance <= 5) return 50;
  if (distance <= 10) return 30;
  return 10;
};

// ========== CACHE MANAGER ==========
class CacheManager {
  static instance = null;
  cleanupInterval = null;

  constructor() {
    if (CacheManager.instance) {
      return CacheManager.instance;
    }
    CacheManager.instance = this;
    this.startAutoCleanup();
  }

  static getInstance() {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  startAutoCleanup() {
    if (typeof window === 'undefined') return;

    this.cleanupInterval = setInterval(() => {
      this.cleanupOldCache();
    }, 30 * 60 * 1000);
  }

  cleanupOldCache() {
    const now = Date.now();
    const keys = Object.keys(localStorage);
    let cleaned = 0;

    keys.forEach(key => {
      if (key.startsWith('feed_v4_')) {
        try {
          const cached = localStorage.getItem(key);
          if (cached) {
            const data = JSON.parse(cached);
            if (now - data.timestamp > CACHE_DURATION) {
              localStorage.removeItem(key);
              cleaned++;
            }
          }
        } catch (e) { }
      }
    });

    if (cleaned > 0) {
      console.log(`🧹 Cleaned ${cleaned} old cache entries`);
    }
  }

  getCacheKey(location, radius) {
    if (!location?.latitude) return 'feed_default';
    const lat = Math.round(location.latitude * 10) / 10;
    const lng = Math.round(location.longitude * 10) / 10;
    return `feed_v4_${lat}_${lng}_${radius}`;
  }

  save(key, itemsMap, ids) {
    try {
      if (!ids || !ids.length) return;

      const toSave = {
        items: Array.from(itemsMap.entries()).slice(0, MAX_CACHE_ITEMS),
        ids: ids.slice(0, MAX_CACHE_ITEMS),
        timestamp: Date.now()
      };

      localStorage.setItem(key, JSON.stringify(toSave));
    } catch (e) {
      console.warn('Cache save failed:', e);
      if (e.name === 'QuotaExceededError') {
        this.clearAll();
      }
    }
  }

  load(key) {
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp > CACHE_DURATION) return null;
      if (!parsed.ids || !parsed.ids.length) return null;

      return {
        itemsMap: new Map(parsed.items),
        orderedIds: parsed.ids
      };
    } catch {
      return null;
    }
  }

  clearAll() {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('feed_v4_')) localStorage.removeItem(key);
    });
    sessionStorage.removeItem('feed_backup');
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// ========== SKELETON LOADER ==========
const SkeletonLoader = memo(() => (
  <div className="space-y-6 px-4">
    {[1, 2, 3].map(i => (
      <div key={i} className="bg-white/5 rounded-[40px] border border-white/5 overflow-hidden">
        <div className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse" />
          <div className="flex-1">
            <div className="h-4 w-32 bg-white/10 rounded animate-pulse mb-2" />
            <div className="h-3 w-24 bg-white/10 rounded animate-pulse" />
          </div>
        </div>
        <div className="aspect-video bg-white/10 animate-pulse" />
        <div className="p-4 space-y-3">
          <div className="h-4 w-full bg-white/10 rounded animate-pulse" />
          <div className="h-4 w-3/4 bg-white/10 rounded animate-pulse" />
        </div>
      </div>
    ))}
  </div>
));

SkeletonLoader.displayName = 'SkeletonLoader';

// ========== TOAST COMPONENT ==========
const ToastMessage = memo(({ show, message }) => (
  <AnimatePresence>
    {show && (
      <motion.div
        initial={{ y: 50, x: "-50%", opacity: 0 }}
        animate={{ y: 0, x: "-50%", opacity: 1 }}
        exit={{ y: 50, x: "-50%", opacity: 0 }}
        className="fixed bottom-10 left-1/2 z-[100]"
      >
        <div className="bg-black/80 backdrop-blur-lg text-white px-5 py-2.5 rounded-full shadow-2xl text-sm font-medium border border-white/20">
          {message}
        </div>
      </motion.div>
    )}
  </AnimatePresence>
));

ToastMessage.displayName = 'ToastMessage';

// ========== BACKGROUND UPDATE INDICATOR ==========
const BackgroundUpdateIndicator = memo(({ isUpdating }) => (
  <AnimatePresence>
    {isUpdating && (
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="fixed top-16 right-4 z-50"
      >
        <div className="bg-black/50 backdrop-blur-md rounded-full px-3 py-1.5 flex items-center gap-2 border border-white/10">
          <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-white/60 text-xs">Update...</span>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
));

BackgroundUpdateIndicator.displayName = 'BackgroundUpdateIndicator';

// ========== MAIN COMPONENT ==========
export default function FeedContent() {
  const router = useRouter();
  const { location, status, placeName, requestLocation, setManualLocation, activeMode } = useLocation();
  const { user, isAdmin, profile } = useAuth();
  const theme = useTheme();
  const cacheManager = useMemo(() => CacheManager.getInstance(), []);

  // ========== STATE ==========
  const [feedState, setFeedState] = useState({
    itemsMap: new Map(),
    orderedIds: [],
    loading: true,
    hasMore: true,
    initialLoad: true,
    error: null
  });

  const [comments, setComments] = useState({});
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState({});
  const [toast, setToast] = useState({ show: false, message: "" });
  const [refreshing, setRefreshing] = useState(false);
  const [isBackgroundUpdating, setIsBackgroundUpdating] = useState(false);

  // Modal states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showKomentarModal, setShowKomentarModal] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [showFormLaporan, setShowFormLaporan] = useState(false);
  const [selectedTempat, setSelectedTempat] = useState(null);

  // Refs
  const lastLoadedIdRef = useRef(null);
  const isFetchingRef = useRef(false);
  const initialLoadDoneRef = useRef(false);
  const lastCardRef = useRef(null);
  const abortControllerRef = useRef(null);
  const backgroundFetchTimeoutRef = useRef(null);
  const previousLocationKeyRef = useRef(null);
  const locationChangeTimeoutRef = useRef(null);

  // Computed values
  const locationReady = status === "granted" && !!location?.latitude;
  const searchRadius = activeMode === 'general' ? 40 : 10;
  const { itemsMap, orderedIds, loading, hasMore, initialLoad, error } = feedState;

  const tempat = useMemo(() =>
    orderedIds.map(id => itemsMap.get(id)).filter(Boolean),
    [orderedIds, itemsMap]
  );

  // ========== LIMIT MEMORY FUNCTION ==========
  const limitMemorySize = useCallback(() => {
    setFeedState(prev => {
      if (prev.orderedIds.length <= MAX_MEMORY_ITEMS) return prev;

      const limitedIds = prev.orderedIds.slice(0, MAX_MEMORY_ITEMS);
      const limitedMap = new Map();
      limitedIds.forEach(id => {
        const item = prev.itemsMap.get(id);
        if (item) limitedMap.set(id, item);
      });

      return {
        ...prev,
        itemsMap: limitedMap,
        orderedIds: limitedIds
      };
    });
  }, []);

  // ========== SHOW TOAST ==========
  const showToast = useCallback((message) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: "" }), 3000);
  }, []);

  // ========== FETCH PLACES ==========
  const fetchPlaces = useCallback(async (reset = false, isBackground = false) => {
    if (isFetchingRef.current && !reset) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    isFetchingRef.current = true;

    if (!isBackground) {
      if (reset) {
        setFeedState(prev => ({
          ...prev,
          loading: true,
          hasMore: true,
          initialLoad: true,
          error: null
        }));
        lastLoadedIdRef.current = null;
      } else {
        setFeedState(prev => ({ ...prev, loading: true }));
      }
    }

    try {
      let query = supabase
        .from("feed_view")
        .select("id, name, latitude, longitude, created_at, photos, laporan_terbaru, alamat, category, vibe_count, latest_condition, latest_estimated_people, latest_estimated_wait_time")
        .order("created_at", { ascending: false });

      if (locationReady && location) {
        const bufferRadius = searchRadius * 1.2;
        const latDelta = bufferRadius / 111;
        const lngDelta = bufferRadius / (111 * Math.cos(location.latitude * Math.PI / 180));
        query = query
          .gte('latitude', location.latitude - latDelta)
          .lte('latitude', location.latitude + latDelta)
          .gte('longitude', location.longitude - lngDelta)
          .lte('longitude', location.longitude + lngDelta);
      }

      if (!reset && lastLoadedIdRef.current) {
        query = query.lt('id', lastLoadedIdRef.current);
      }

      const { data, error: fetchError } = await query.limit(PAGE_SIZE);

      if (fetchError) throw fetchError;
      if (abortControllerRef.current.signal.aborted) return;

      const items = data || [];
      const userLocation = locationReady && location ? {
        latitude: location.latitude,
        longitude: location.longitude
      } : null;

      // Process items
      const processedItems = [];
      for (const item of items) {
        let distance = null;
        if (userLocation && item.latitude) {
          distance = haversineDistance(
            userLocation.latitude, userLocation.longitude,
            item.latitude, item.longitude
          );
        }

        if (distance !== null && distance > searchRadius) continue;

        const processed = processFeedItem({
          item,
          locationReady: !!userLocation,
          location: userLocation,
          comments: {}
        });

        const rankingScore = processed.vibe_count || 50;
        const distanceScore = getDistanceScore(distance);
        processed._hybridScore = (rankingScore * 0.3) + (distanceScore * 0.7);
        processedItems.push(processed);
      }

      processedItems.sort((a, b) => {
        const distA = a._distance !== null && a._distance !== undefined ? a._distance : 999999;
        const distB = b._distance !== null && b._distance !== undefined ? b._distance : 999999;
        return distA - distB;
      });

      // 2. Pisahkan konten viral dan non-viral
      const nonViral = processedItems.filter(item => !item.isViral);
      const viral = processedItems.filter(item => item.isViral);

      // 3. Bangun ulang urutan: 
      //    - Posisi 1-2: terdekat (non-viral)
      //    - Posisi 3: viral terbaik
      //    - Posisi 4-5: terdekat berikutnya
      //    - Posisi 6: viral kedua
      //    - Sisa: sesuai jarak
      const finalOrder = [];

      // Ambil 2 terdekat non-viral
      for (let i = 0; i < Math.min(2, nonViral.length); i++) {
        finalOrder.push(nonViral[i]);
      }

      // Ambil 1 viral terbaik (yang jaraknya paling dekat)
      if (viral.length > 0) {
        viral.sort((a, b) => (a._distance || 999) - (b._distance || 999));
        finalOrder.push(viral[0]);
      }

      // Ambil sisa non-viral (mulai dari urutan 3 dan seterusnya)
      for (let i = 2; i < nonViral.length; i++) {
        finalOrder.push(nonViral[i]);
      }

      // Ambil sisa viral (kecuali yang sudah dipakai)
      for (let i = 1; i < viral.length; i++) {
        finalOrder.push(viral[i]);
      }

      processedItems = finalOrder;

      console.log('📊 URUTAN FINAL:', processedItems.map((item, idx) => ({
        peringkat: idx + 1,
        nama: item.name,
        jarak: item._distance?.toFixed(2) + 'km',
        viral: item.isViral ? '🔥' : ''
      })));

      // Update state
      if (reset) {
        const newMap = new Map();
        const newIds = [];
        for (const item of processedItems) {
          newMap.set(item.id, item);
          newIds.push(item.id);
        }

        setFeedState({
          itemsMap: newMap,
          orderedIds: newIds,
          loading: false,
          hasMore: items.length === PAGE_SIZE,
          initialLoad: false,
          error: null
        });

        if (newIds.length > 0) {
          lastLoadedIdRef.current = newIds[newIds.length - 1];
          const cacheKey = cacheManager.getCacheKey(location, searchRadius);
          cacheManager.save(cacheKey, newMap, newIds);
        }

        // Preload images for first 3 items
        processedItems.slice(0, 3).forEach(item => {
          if (item.photos?.[0]) {
            const img = new Image();
            img.src = item.photos[0];
          }
        });
      } else {
        setFeedState(prev => {
          const newMap = new Map(prev.itemsMap);
          const newIds = [...prev.orderedIds];

          for (const item of processedItems) {
            if (!newMap.has(item.id)) {
              newMap.set(item.id, item);
              newIds.push(item.id);
            }
          }

          return {
            ...prev,
            itemsMap: newMap,
            orderedIds: newIds,
            loading: false,
            hasMore: items.length === PAGE_SIZE
          };
        });

        if (processedItems.length > 0) {
          lastLoadedIdRef.current = processedItems[processedItems.length - 1].id;
        }
      }

      // Limit memory after update
      setTimeout(() => limitMemorySize(), 100);

    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error("Fetch error:", err);
      if (!isBackground) {
        setFeedState(prev => ({
          ...prev,
          error: err.message,
          loading: false,
          initialLoad: false
        }));
      }
    } finally {
      isFetchingRef.current = false;
    }
  }, [locationReady, location, searchRadius, cacheManager, limitMemorySize]);

  // ========== BACKGROUND FETCH FOR UPDATE ==========
  const backgroundFetch = useCallback(async () => {
    if (isFetchingRef.current) return;

    setIsBackgroundUpdating(true);
    console.log('🔄 Background fetch started...');

    try {
      const currentIds = new Set(orderedIds);

      let query = supabase
        .from("feed_view")
        .select("id, name, latitude, longitude, created_at, photos, laporan_terbaru, alamat, category, vibe_count, latest_condition, latest_estimated_people, latest_estimated_wait_time")
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (locationReady && location) {
        const bufferRadius = searchRadius * 1.2;
        const latDelta = bufferRadius / 111;
        const lngDelta = bufferRadius / (111 * Math.cos(location.latitude * Math.PI / 180));
        query = query
          .gte('latitude', location.latitude - latDelta)
          .lte('latitude', location.latitude + latDelta)
          .gte('longitude', location.longitude - lngDelta)
          .lte('longitude', location.longitude + lngDelta);
      }

      const { data, error } = await query;
      if (error) throw error;

      const items = data || [];

      let hasNewData = false;
      for (const item of items) {
        if (!currentIds.has(item.id)) {
          hasNewData = true;
          break;
        }
      }

      if (hasNewData) {
        console.log('🆕 New data detected, updating feed...');
        await fetchPlaces(true);
        showToast('📱 Feed telah diperbarui');
      } else {
        console.log('✅ No new data, cache masih fresh');
      }

    } catch (err) {
      console.warn('Background fetch failed:', err);
    } finally {
      setIsBackgroundUpdating(false);
    }
  }, [orderedIds, locationReady, location, searchRadius, fetchPlaces, showToast]);

  // ========== DETEKSI PERUBAHAN LOKASI ==========
  useEffect(() => {
    if (!locationReady || !location) return;

    const currentLocationKey = `${Math.round(location.latitude * 10) / 10}_${Math.round(location.longitude * 10) / 10}`;
    const previousLocationKey = previousLocationKeyRef.current;

    if (previousLocationKey && previousLocationKey !== currentLocationKey) {
      if (locationChangeTimeoutRef.current) {
        clearTimeout(locationChangeTimeoutRef.current);
      }

      locationChangeTimeoutRef.current = setTimeout(() => {
        fetchPlaces(true);
        showToast(`📍 Lokasi berubah, feed diperbarui`);
      }, 500);
    }

    previousLocationKeyRef.current = currentLocationKey;

    return () => {
      if (locationChangeTimeoutRef.current) {
        clearTimeout(locationChangeTimeoutRef.current);
      }
    };
  }, [locationReady, location, fetchPlaces, showToast]);

  // ========== RESTORE FROM CACHE + BACKGROUND FETCH ==========
  useEffect(() => {
    if (initialLoadDoneRef.current) return;
    initialLoadDoneRef.current = true;

    const cacheKey = cacheManager.getCacheKey(location, searchRadius);
    const cached = cacheManager.load(cacheKey);

    if (cached?.orderedIds?.length) {
      console.log(`📦 Cache ditemukan: ${cached.orderedIds.length} items, langsung tampilkan`);

      setFeedState({
        itemsMap: cached.itemsMap,
        orderedIds: cached.orderedIds,
        loading: false,
        hasMore: true,
        initialLoad: false,
        error: null
      });

      lastLoadedIdRef.current = cached.orderedIds[cached.orderedIds.length - 1];

      const firstItems = cached.orderedIds.slice(0, 3);
      firstItems.forEach(id => {
        const item = cached.itemsMap.get(id);
        if (item?.photos?.[0]) {
          const img = new Image();
          img.src = item.photos[0];
        }
      });

      if (backgroundFetchTimeoutRef.current) {
        clearTimeout(backgroundFetchTimeoutRef.current);
      }
      backgroundFetchTimeoutRef.current = setTimeout(() => {
        backgroundFetch();
      }, 500);

    } else {
      console.log('📭 Tidak ada cache, fetch data baru...');
      fetchPlaces(true);
    }

    return () => {
      cacheManager.destroy();
      if (backgroundFetchTimeoutRef.current) {
        clearTimeout(backgroundFetchTimeoutRef.current);
      }
    };
  }, [cacheManager, fetchPlaces, location, searchRadius, backgroundFetch]);

  // ========== INFINITE SCROLL ==========
  useEffect(() => {
    if (!lastCardRef.current || !hasMore || loading || tempat.length < PREFETCH_THRESHOLD) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !isFetchingRef.current) {
          fetchPlaces(false);
        }
      },
      { threshold: 0.1, rootMargin: "300px" }
    );

    observer.observe(lastCardRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, fetchPlaces, tempat.length]);

  // ========== PULL TO REFRESH ==========
  useEffect(() => {
    let startY = 0;

    const handleTouchStart = (e) => {
      if (window.scrollY === 0 && !loading && !refreshing) {
        startY = e.touches[0].pageY;
      }
    };

    const handleTouchMove = (e) => {
      if (startY === 0) return;
      const pullDistance = e.touches[0].pageY - startY;
      if (pullDistance > 60 && !refreshing) {
        setRefreshing(true);
      }
    };

    const handleTouchEnd = () => {
      if (refreshing && !loading) {
        cacheManager.clearAll();
        fetchPlaces(true).finally(() => setRefreshing(false));
      }
      startY = 0;
    };

    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [loading, refreshing, cacheManager, fetchPlaces]);

  // ========== HANDLERS ==========
  const handleGPSActivation = useCallback(async () => {
    await requestLocation('gps');
    cacheManager.clearAll();
    await fetchPlaces(true);
    showToast(`📍 Lokasi diperbarui: ${placeName?.split(",")[0] || "GPS"}`);
  }, [requestLocation, cacheManager, fetchPlaces, placeName, showToast]);

  const handleManualLocationSelect = useCallback(async (selectedLocation) => {
    setManualLocation(selectedLocation);
    cacheManager.clearAll();
    await fetchPlaces(true);
    const name = selectedLocation?.address || selectedLocation?.name || "lokasi baru";
    showToast(`📍 Feed diperbarui untuk ${name}`);
  }, [setManualLocation, cacheManager, fetchPlaces, showToast]);

  const handleSearchSelect = useCallback((item) => {
    if (!item) return;
    setShowSearchModal(false);
    setSelectedTempat(item);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const closeModals = useCallback(() => {
    setShowAIModal(false);
    setShowKomentarModal(false);
    setSelectedTempat(null);
  }, []);

  const retryLoad = useCallback(() => {
    cacheManager.clearAll();
    fetchPlaces(true);
  }, [cacheManager, fetchPlaces]);

  // ========== RENDER ==========
  return (
    <main className="relative min-h-screen mx-auto w-[92%] max-w-[400px] bg-transparent">
      <BackgroundUpdateIndicator isUpdating={isBackgroundUpdating} />

      <AnimatePresence>
        {refreshing && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            className="fixed top-0 left-0 right-0 bg-black/80 backdrop-blur-md py-3 text-center text-white/70 text-sm z-50"
          >
            <div className="flex items-center justify-center gap-3">
              <div className="h-6 w-6 border-2 border-t-[#E3655B] border-r-transparent border-b-[#25F4EE] border-l-transparent rounded-full animate-spin" />
              <span>Memperbarui...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Header
        user={user}
        isAdmin={isAdmin}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        locationReady={locationReady}
        villageLocation={placeName?.split(",")[0] || "Pilih Lokasi"}
        districtLocation={placeName?.split(",")[1] || ""}
        isScrolled={false}
        onOpenLocationModal={() => setIsLocationModalOpen(true)}
        onOpenSearchModal={() => setShowSearchModal(true)}
        onShowStatistik={() => { }}
        onOpenLaporanForm={() => setShowFormLaporan(true)}
        onSearchWithQuery={() => { }}
        tempat={tempat}
        location={location}
        displayLocation={placeName?.split(",")[0] || "Lokasi"}
        searchRadius={searchRadius}
        onRadiusChange={() => { }}
      />

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      <LocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        locationReady={locationReady}
        isMalam={false}
        onActivateGPS={handleGPSActivation}
        onSelectManual={handleManualLocationSelect}
        currentActiveMode={activeMode}
        customLocationName={placeName}
      />
      <FormLaporanAktif
        isOpen={showFormLaporan}
        onClose={() => setShowFormLaporan(false)}
        villageLocation={placeName?.split(",")[0] || ""}
        theme={theme}
        user={user}
      />

      <div className="pt-[72px] space-y-2 min-h-[60vh]">
        {initialLoad ? (
          <SkeletonLoader />
        ) : error ? (
          <div className="text-center py-12 px-4">
            <div className="text-6xl mb-4">⚠️</div>
            <h3 className="text-white/80 text-lg font-semibold mb-2">Gagal memuat data</h3>
            <p className="text-white/40 text-sm mb-4">{error}</p>
            <button
              onClick={retryLoad}
              className="px-6 py-2 bg-white/10 rounded-xl text-white/80 hover:bg-white/20 transition-colors"
            >
              Coba Lagi
            </button>
          </div>
        ) : tempat.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="text-6xl mb-4">📍</div>
            <h3 className="text-white/80 text-lg font-semibold mb-2">Tidak ada tempat di sekitar</h3>
            <p className="text-white/40 text-sm mb-4">Tidak ditemukan tempat dalam radius {searchRadius}km</p>
            <button
              onClick={handleGPSActivation}
              className="px-6 py-2 bg-white/10 rounded-xl text-white/80 hover:bg-white/20 transition-colors"
            >
              Aktifkan GPS
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {tempat.map((item, index) => {
                const isLast = index === tempat.length - 1;
                return (
                  <motion.div
                    key={item.id}
                    ref={isLast ? lastCardRef : null}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.5) }}
                    className="mb-6 mx-auto w-full max-w-[420px]"
                  >
                    <FeedCardWrapper theme={theme}>
                      <FeedCard
                        item={item}
                        locationReady={locationReady}
                        location={location}
                        comments={comments}
                        selectedPhotoIndex={selectedPhotoIndex}
                        setSelectedPhotoIndex={setSelectedPhotoIndex}
                        openAIModal={() => setShowAIModal(true)}
                        openKomentarModal={() => setShowKomentarModal(true)}
                        onShare={() => { }}
                        priority={index < 3}
                        userId={user?.id}
                        userProfile={profile}
                        userAvatar={profile?.avatar_url}
                        showLiveInsight={false}
                      />
                    </FeedCardWrapper>
                  </motion.div>
                );
              })}
            </div>

            {loading && !initialLoad && <div className="h-10 opacity-0" />}

            {!hasMore && tempat.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-8"
              >
                <p className="text-white/40 text-xs">✨ Semua konten telah dimuat ✨</p>
              </motion.div>
            )}
          </>
        )}
      </div>

      <SmartBottomNav
        onOpenUpload={() => setShowUploadModal(true)}
        onOpenLaporanForm={() => setShowFormLaporan(true)}
        onOpenNotification={() => router.push("/woro")}
        onOpenProfile={() => router.push("/rewang")}
      />

      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        userId={user?.id}
        userRole={profile?.role}
      />

      <Suspense fallback={null}>
        <AIModal
          isOpen={showAIModal}
          onClose={closeModals}
          tempat={selectedTempat}
          kentongan={null}
          context="general"
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
        />
      </Suspense>

      <Suspense fallback={null}>
        <KomentarModal
          isOpen={showKomentarModal}
          onClose={closeModals}
          tempat={selectedTempat}
          isAdmin={isAdmin}
        />
      </Suspense>

      <Suspense fallback={null}>
        <SearchModal
          isOpen={showSearchModal}
          onClose={() => setShowSearchModal(false)}
          onSelectTempat={handleSearchSelect}
          onOpenAIModal={() => { }}
          allData={tempat}
          theme={theme}
          villageLocation={placeName?.split(",")[0] || ""}
        />
      </Suspense>

      <ToastMessage show={toast.show} message={toast.message} />
    </main>
  );
}