"use client";

import * as React from "react";
import { useEffect, useState, useCallback, useRef, useMemo, lazy, Suspense, memo } from "react";
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
import LaporanWarga from "../layout/LaporanWarga";
import FormLaporanAktif from "@/app/components/modals/FormLaporanAktif";
import FeedCardWrapper from "@/components/FeedCardWrapper";
import SmartBottomNav from "@/app/components/layout/SmartBottomNav";
import UploadModal from "@/components/UploadModal";
import BreakCard from "@/components/BreakCard";
import AuthModal from "@/app/components/auth/AuthModal";

// Libs
import { supabase } from "../../../lib/supabaseClient";
import { getGreeting } from "../../../lib/greeting";
import { processFeedItem } from "../../../lib/feedEngine";
import { getKentonganForFeed } from "@/lib/kentongan";

// Lazy load
const AIModal = React.lazy(() => import("../ai/AIModal"));
const KomentarModal = React.lazy(() => import("./KomentarModal"));
const SearchModal = React.lazy(() => import("./SearchModal"));

// ========== CONSTANTS ==========
const CACHE_DURATION = 30 * 60 * 1000;
const SESSION_CACHE_KEY = 'feed_backup';
const RANKING_WEIGHT = 0.3;
const DISTANCE_WEIGHT = 0.7;

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

const calculateHybridScore = (item, userLocation) => {
  const rankingScore = item.realtimeScore || 50;
  let distance = null;
  
  if (userLocation && item.latitude && item.longitude) {
    distance = haversineDistance(
      userLocation.latitude, userLocation.longitude,
      item.latitude, item.longitude
    );
  }
  
  const distanceScore = getDistanceScore(distance);
  return (rankingScore * RANKING_WEIGHT) + (distanceScore * DISTANCE_WEIGHT);
};

// ========== SIMPLIFIED CACHE MANAGER ==========
const useCacheManager = () => {
  const getCacheKey = useCallback((location, radius) => {
    if (!location?.latitude) return 'feed_default';
    const lat = Math.round(location.latitude * 10) / 10;
    const lng = Math.round(location.longitude * 10) / 10;
    return `feed_v3_${lat}_${lng}_${radius}`;
  }, []);

  const save = useCallback((key, items, ids) => {
    try {
      if (!ids?.length) return;
      localStorage.setItem(key, JSON.stringify({
        items: Array.from(items.entries()).slice(0, 30),
        ids: ids.slice(0, 30),
        timestamp: Date.now()
      }));
    } catch (e) { console.warn('Cache save failed:', e); }
  }, []);

  const load = useCallback((key) => {
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp > CACHE_DURATION) return null;
      return {
        itemsMap: new Map(parsed.items),
        orderedIds: parsed.ids
      };
    } catch { return null; }
  }, []);

  const clear = useCallback(() => {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('feed_v3_')) localStorage.removeItem(key);
    });
    sessionStorage.removeItem(SESSION_CACHE_KEY);
  }, []);

  return { getCacheKey, save, load, clear };
};

// ========== SIMPLIFIED FEED REDUCER ==========
const feedReducer = (state, action) => {
  switch (action.type) {
    case 'SET_FEED':
      return {
        ...state,
        itemsMap: action.itemsMap,
        orderedIds: action.orderedIds,
        hasMore: action.hasMore,
        loading: false,
        initialLoad: false,
        error: null
      };
    case 'ADD_ITEMS':
      const newMap = new Map(state.itemsMap);
      const newIds = [...state.orderedIds];
      for (const item of action.items) {
        if (!newMap.has(item.id)) {
          newMap.set(item.id, item);
          newIds.push(item.id);
        }
      }
      return {
        ...state,
        itemsMap: newMap,
        orderedIds: newIds,
        hasMore: action.hasMore,
        loading: false
      };
    case 'INSERT_ITEM_TOP':
      if (state.itemsMap.has(action.item.id)) return state;
      return {
        ...state,
        itemsMap: new Map([[action.item.id, action.item], ...state.itemsMap]),
        orderedIds: [action.item.id, ...state.orderedIds]
      };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false, initialLoad: false };
    case 'RESET':
      return {
        itemsMap: new Map(),
        orderedIds: [],
        loading: true,
        hasMore: true,
        initialLoad: true,
        error: null
      };
    default:
      return state;
  }
};

// ========== SIMPLIFIED SKELETON ==========
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

// ========== MAIN COMPONENT ==========
export default function FeedContent() {
  const router = useRouter();
  const { location, status, placeName, requestLocation, setManualLocation, activeMode } = useLocation();
  const { user, isAdmin, profile } = useAuth();
  const theme = useTheme();
  const { getCacheKey, save, load, clear: clearCache } = useCacheManager();

  // Simplified state
  const [feedState, dispatch] = React.useReducer(feedReducer, {
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
  const [kentonganForFeed, setKentonganForFeed] = useState([]);
  
  // Modal states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showKomentarModal, setShowKomentarModal] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [showFormLaporan, setShowFormLaporan] = useState(false);
  const [selectedTempat, setSelectedTempat] = useState(null);
  const [selectedKentongan, setSelectedKentongan] = useState(null);
  
  // Refs
  const lastLoadedIdRef = useRef(null);
  const isFetchingRef = useRef(false);
  const initialLoadDoneRef = useRef(false);

  // Computed values
  const locationReady = status === "granted" && !!location?.latitude;
  const searchRadius = activeMode === 'general' ? 40 : 10;
  const { itemsMap, orderedIds, loading, hasMore, initialLoad, error } = feedState;
  const tempat = useMemo(() => orderedIds.map(id => itemsMap.get(id)).filter(Boolean), [orderedIds, itemsMap]);

  // ========== CORE FETCH FUNCTION (SIMPLIFIED) ==========
  const fetchPlaces = useCallback(async (reset = false) => {
    if (isFetchingRef.current && !reset) return;
    isFetchingRef.current = true;
    
    if (reset) {
      dispatch({ type: 'RESET' });
      lastLoadedIdRef.current = null;
    } else {
      dispatch({ type: 'SET_LOADING', payload: true });
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

      const { data, error: fetchError } = await query.limit(10);
      if (fetchError) throw fetchError;

      const items = data || [];
      const userLocation = locationReady && location ? {
        latitude: location.latitude,
        longitude: location.longitude
      } : null;

      // Process items with hybrid score
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
        
        const processed = processFeedItem({ item, locationReady: !!userLocation, location: userLocation, comments: {} });
        processed._hybridScore = calculateHybridScore(processed, userLocation);
        processedItems.push(processed);
      }

      processedItems.sort((a, b) => b._hybridScore - a._hybridScore);

      if (reset) {
        const newMap = new Map(processedItems.map(item => [item.id, item]));
        const newIds = processedItems.map(item => item.id);
        
        dispatch({
          type: 'SET_FEED',
          itemsMap: newMap,
          orderedIds: newIds,
          hasMore: items.length === 10
        });
        
        if (newIds.length > 0) {
          lastLoadedIdRef.current = newIds[newIds.length - 1];
          const cacheKey = getCacheKey(location, searchRadius);
          save(cacheKey, newMap, newIds);
        }
      } else {
        dispatch({
          type: 'ADD_ITEMS',
          items: processedItems,
          hasMore: items.length === 10
        });
        if (processedItems.length > 0) {
          lastLoadedIdRef.current = processedItems[processedItems.length - 1].id;
        }
      }
    } catch (err) {
      console.error("Fetch error:", err);
      dispatch({ type: 'SET_ERROR', payload: err.message });
    } finally {
      isFetchingRef.current = false;
    }
  }, [locationReady, location, searchRadius, getCacheKey, save]);

  // ========== RESTORE FROM CACHE ==========
  useEffect(() => {
    if (initialLoadDoneRef.current) return;
    initialLoadDoneRef.current = true;

    const cacheKey = getCacheKey(location, searchRadius);
    const cached = load(cacheKey);
    
    if (cached && cached.orderedIds?.length > 0) {
      dispatch({
        type: 'SET_FEED',
        itemsMap: cached.itemsMap,
        orderedIds: cached.orderedIds,
        hasMore: true,
        loading: false,
        initialLoad: false,
        error: null
      });
      lastLoadedIdRef.current = cached.orderedIds[cached.orderedIds.length - 1];
    } else {
      fetchPlaces(true);
    }
  }, [getCacheKey, load, fetchPlaces, location, searchRadius]);

  // ========== INFINITE SCROLL ==========
  const lastCardRef = useRef(null);
  useEffect(() => {
    if (!lastCardRef.current || !hasMore || loading) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          fetchPlaces(false);
        }
      },
      { threshold: 0.1, rootMargin: "400px" }
    );
    
    observer.observe(lastCardRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, fetchPlaces, tempat.length]);

  // ========== PULL TO REFRESH ==========
  useEffect(() => {
    let startY = 0;
    const handleTouchStart = (e) => {
      if (window.scrollY === 0 && !loading) startY = e.touches[0].pageY;
    };
    const handleTouchEnd = () => {
      if (window.scrollY === 0 && startY > 0 && !loading) {
        setRefreshing(true);
        clearCache();
        fetchPlaces(true).finally(() => setRefreshing(false));
      }
      startY = 0;
    };
    
    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [loading, clearCache, fetchPlaces]);

  // ========== FETCH KENTONGAN ==========
  useEffect(() => {
    const fetchKentongan = async () => {
      if (user?.id) {
        const data = await getKentonganForFeed(user.id);
        setKentonganForFeed(data);
      }
    };
    fetchKentongan();
  }, [user?.id]);

  // ========== HANDLERS ==========
  const handleGPSActivation = useCallback(async () => {
    await requestLocation('gps');
    clearCache();
    fetchPlaces(true);
    setToast({ show: true, message: `📍 Lokasi diperbarui: ${placeName}` });
    setTimeout(() => setToast({ show: false, message: "" }), 3000);
  }, [requestLocation, clearCache, fetchPlaces, placeName]);

  const handleManualLocationSelect = useCallback(async (selectedLocation) => {
    setManualLocation(selectedLocation);
    clearCache();
    fetchPlaces(true);
    const name = selectedLocation?.address || selectedLocation?.name || "lokasi baru";
    setToast({ show: true, message: `📍 Feed diperbarui untuk ${name}` });
    setTimeout(() => setToast({ show: false, message: "" }), 3000);
  }, [setManualLocation, clearCache, fetchPlaces]);

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
    setSelectedKentongan(null);
  }, []);

  // ========== RENDER ==========
  return (
    <main className="relative min-h-screen mx-auto w-[92%] max-w-[400px] bg-transparent">
      {/* Refresh indicator */}
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

      {/* Header */}
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
        onShowStatistik={() => {}}
        onOpenLaporanForm={() => setShowFormLaporan(true)}
        onSearchWithQuery={() => {}}
        tempat={tempat}
        location={location}
        displayLocation={placeName?.split(",")[0] || "Lokasi"}
        searchRadius={searchRadius}
        onRadiusChange={() => {}}
      />

      {/* Modals */}
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

      {/* Feed Content */}
      <div className="pt-[72px] space-y-2 min-h-[60vh]">
        {initialLoad ? (
          <SkeletonLoader />
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-white/60">{error}</p>
            <button onClick={() => fetchPlaces(true)} className="mt-4 px-6 py-2 bg-white/10 rounded-xl">
              Coba Lagi
            </button>
          </div>
        ) : tempat.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-white/60">Tidak ada tempat di sekitar</p>
            <button onClick={handleGPSActivation} className="mt-4 px-6 py-2 bg-white/10 rounded-xl">
              Aktifkan GPS
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {tempat.map((item, index) => {
              const isLast = index === tempat.length - 1;
              return (
                <motion.div
                  key={item.id}
                  ref={isLast ? lastCardRef : null}
                  className="mb-6"
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
                      onShare={() => {}}
                      priority={index < 3}
                      userProfile={profile}
                    />
                  </FeedCardWrapper>
                </motion.div>
              );
            })}
            
            {loading && !initialLoad && (
              <div className="h-20 opacity-0" />
            )}
            
            {!hasMore && tempat.length > 0 && (
              <div className="text-center py-8">
                <p className="text-white/40 text-xs">✨ Semua konten telah dimuat ✨</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
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

      {/* Lazy Modals */}
      <Suspense fallback={null}>
        <AIModal
          isOpen={showAIModal}
          onClose={closeModals}
          tempat={selectedTempat}
          kentongan={selectedKentongan}
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
          onOpenAIModal={() => {}}
          allData={tempat}
          theme={theme}
          villageLocation={placeName?.split(",")[0] || ""}
        />
      </Suspense>

      {/* Toast */}
      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ y: 50, x: "-50%", opacity: 0 }}
            animate={{ y: 0, x: "-50%", opacity: 1 }}
            exit={{ y: 50, x: "-50%", opacity: 0 }}
            className="fixed bottom-10 left-1/2 z-[100]"
          >
            <div className="bg-black/80 backdrop-blur-lg text-white px-5 py-2.5 rounded-full shadow-2xl text-sm">
              {toast.message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}