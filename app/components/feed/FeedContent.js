"use client";

import * as React from "react";
import { useEffect, useState, useCallback, useRef, useMemo, lazy, Suspense, memo } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import AuthModal from "@/app/components/auth/AuthModal";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/app/hooks/useTheme";
import { supabase } from "../../../lib/supabaseClient";
import { getGreeting } from "../../../lib/greeting";
import { processFeedItem } from "../../../lib/feedEngine";
import { calculateScore } from "../../../lib/ranking";
import { useLocation } from "@/components/LocationProvider";

import FeedCard from "./FeedCard";
import Header from "@/components/Header";
import LocationModal from "@/components/LocationModal";
import LaporanWarga from "../layout/LaporanWarga";
import FormLaporanAktif from "@/app/components/modals/FormLaporanAktif";
import FeedCardWrapper from "@/components/FeedCardWrapper";

// Lazy load heavy modals
const AIModal = React.lazy(() => import("./AIModal"));
const KomentarModal = React.lazy(() => import("./KomentarModal"));
const SearchModal = React.lazy(() => import("./SearchModal"));

// Dynamic LIMIT based on network
const getDynamicLimit = () => {
  if (typeof navigator === 'undefined') return 8;
  const connection = navigator.connection;
  if (!connection) return 8;
  
  switch(connection.effectiveType) {
    case '4g': return 12;
    case '3g': return 6;
    case '2g':
    case 'slow-2g': return 3;
    default: return 8;
  }
};

const CACHE_DURATION = 5 * 60 * 1000;
const DEFAULT_RADIUS = 10;
const LOCATION_TRANSITION_DELAY = 300;
const RANKING_WEIGHT = 0.7;
const DISTANCE_WEIGHT = 0.3;

// ── HAVERSINE FORMULA ──
const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const getDistanceScore = (distance) => {
  if (distance === null || distance === undefined) return 20;
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
      userLocation.latitude,
      userLocation.longitude,
      item.latitude,
      item.longitude
    );
  }
  
  const distanceScore = getDistanceScore(distance);
  const hybridScore = (rankingScore * RANKING_WEIGHT) + (distanceScore * DISTANCE_WEIGHT);
  
  return {
    hybridScore,
    rankingScore,
    distanceScore,
    distance
  };
};

// ── MEMOIZED COMPONENTS ──
const SkeletonLoader = memo(() => (
  <div className="space-y-6 px-4">
    {[1, 2, 3].map(i => (
      <div key={i} className="h-[400px] w-full rounded-[40px] animate-pulse bg-white/5 border border-white/5" />
    ))}
  </div>
));

const ErrorState = memo(({ error, onRetry }) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-12 px-4">
    <div className="text-6xl mb-4">⚠️</div>
    <h3 className="text-white/80 text-lg font-semibold mb-2">Gagal memuat data</h3>
    <p className="text-white/40 text-sm mb-4">{error}</p>
    <button onClick={onRetry} className="px-6 py-2 bg-white/10 rounded-xl text-white/80 hover:bg-white/20 transition-colors">Coba Lagi</button>
  </motion.div>
));

const EmptyState = memo(({ radius, locationName, onExpandRadius }) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-12 px-4">
    <div className="text-6xl mb-4">📍</div>
    <h3 className="text-white/80 text-lg font-semibold mb-2">Tidak ada tempat di sekitar</h3>
    <p className="text-white/40 text-sm">Tidak ditemukan tempat dalam radius {radius}km dari {locationName}</p>
    <button onClick={onExpandRadius} className="mt-4 px-6 py-2 bg-white/10 rounded-xl text-white/80 hover:bg-white/20 transition-colors text-sm">Perluas radius ke {radius + 5}km</button>
  </motion.div>
));

const LoadingMore = memo(() => (
  <div className="flex justify-center py-8">
    <div className="flex flex-col items-center gap-2">
      <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      <p className="text-white/40 text-xs">Memuat lebih banyak...</p>
    </div>
  </div>
));

const EndOfFeed = memo(() => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8">
    <p className="text-white/40 text-xs">✨ Semua konten di sekitar telah dimuat ✨</p>
  </motion.div>
));

const PullToRefreshIndicator = memo(({ refreshing }) => (
  <AnimatePresence>
    {refreshing && (
      <motion.div initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -60, opacity: 0 }} className="fixed top-0 left-0 right-0 bg-gradient-to-r from-emerald-600/95 to-teal-600/95 backdrop-blur-md py-3 text-center text-white text-sm z-50 shadow-lg">
        <div className="flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <span>Memperbarui feed...</span>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
));

const ToastMessage = memo(({ show, message }) => (
  <AnimatePresence>
    {show && (
      <motion.div initial={{ y: 50, x: "-50%", opacity: 0 }} animate={{ y: 0, x: "-50%", opacity: 1 }} exit={{ y: 50, x: "-50%", opacity: 0 }} className="fixed bottom-10 left-1/2 z-[100]">
        <div className="bg-black/80 backdrop-blur-lg text-white px-5 py-2.5 rounded-full shadow-2xl text-sm font-medium border border-white/20">{message}</div>
      </motion.div>
    )}
  </AnimatePresence>
));

// ── MAIN COMPONENT ──
export default function FeedContent() {
  const { location, status, placeName, requestLocation, setManualLocation } = useLocation();
  const { user, isAdmin } = useAuth();
  const theme = useTheme();

  // --- NETWORK DETECTION & OPTIMIZATION ---
  const [networkInfo, setNetworkInfo] = useState({
    effectiveType: '4g',
    saveData: false,
    isSlowConnection: false
  });
  
  const [dynamicLimit, setDynamicLimit] = useState(() => getDynamicLimit());
  const [useRealtime, setUseRealtime] = useState(true);
  const [pollingInterval, setPollingInterval] = useState(null);

  // Monitor network changes
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.connection) return;
    
    const updateNetworkInfo = () => {
      const conn = navigator.connection;
      const effectiveType = conn?.effectiveType || '4g';
      const saveData = conn?.saveData || false;
      const isSlowConnection = saveData || effectiveType === 'slow-2g' || effectiveType === '2g';
      
      setNetworkInfo({ effectiveType, saveData, isSlowConnection });
      setDynamicLimit(getDynamicLimit());
      
      // Matikan realtime untuk koneksi lambat atau saveData mode
      setUseRealtime(!isSlowConnection && !saveData);
    };
    
    updateNetworkInfo();
    navigator.connection.addEventListener('change', updateNetworkInfo);
    
    return () => {
      navigator.connection.removeEventListener('change', updateNetworkInfo);
    };
  }, []);

  // --- STABIL DATA STRUCTURE ---
  const [itemsMap, setItemsMap] = useState(new Map());
  const [orderedIds, setOrderedIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [comments, setComments] = useState({});
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState({});
  const [initialLoad, setInitialLoad] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState({ show: false, message: "" });
  const [forceRefresh, setForceRefresh] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchRadius, setSearchRadius] = useState(DEFAULT_RADIUS);
  const [isTransitioningLocation, setIsTransitioningLocation] = useState(false);
  const [feedOpacity, setFeedOpacity] = useState(1);

  // Modal states
  const [selectedTempat, setSelectedTempat] = useState(null);
  const [selectedLaporanWarga, setSelectedLaporanWarga] = useState([]);
  const [selectedUploadSuccess, setSelectedUploadSuccess] = useState(null);
  const [aiContext, setAiContext] = useState("general");
  const [showAIModal, setShowAIModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [initialQuery, setInitialQuery] = useState("");
  const [showKomentarModal, setShowKomentarModal] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [forceShowLaporan, setForceShowLaporan] = useState(false);
  const [showFormLaporan, setShowFormLaporan] = useState(false);
  
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    
    window.addEventListener('scroll', handleScroll);
    handleScroll();
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Memoized values
  const locationReady = useMemo(() => status === "granted" && !!location?.latitude && !!location?.longitude, [status, location]);
  const { villageLocation, districtLocation } = useMemo(() => {
    if (!placeName) return { villageLocation: "Pilih Lokasi", districtLocation: "" };
    const parts = placeName.split(",").map(p => p.trim());
    return { villageLocation: parts[0] || "Lokasi", districtLocation: parts[1] || "" };
  }, [placeName]);
  const isMalam = useMemo(() => getGreeting().text === "Malam", []);

  // Refs
  const fetchIdRef = useRef(0);
  const initialLoadDoneRef = useRef(false);
  const lastCardRef = useRef(null);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const errorRef = useRef(null);
  const commentsRef = useRef(comments);
  const locationReadyRef = useRef(locationReady);
  const locationRef = useRef(location);
  const lastLocationRef = useRef(null);
  const abortControllerRef = useRef(null);
  const lastLoadedIdRef = useRef(null);
  const existingIdsRef = useRef(new Set());

  // Update refs
  useEffect(() => { commentsRef.current = comments; }, [comments]);
  useEffect(() => { loadingRef.current = loading; }, [loading]);
  useEffect(() => { hasMoreRef.current = hasMore; }, [hasMore]);
  useEffect(() => { errorRef.current = error; }, [error]);
  useEffect(() => { locationReadyRef.current = locationReady; }, [locationReady]);
  useEffect(() => { locationRef.current = location; }, [location]);

  // Derived values
  const tempat = useMemo(() => orderedIds.map(id => itemsMap.get(id)).filter(Boolean), [orderedIds, itemsMap]);

  const resetFeed = useCallback(async () => {
    setOrderedIds([]);
    setItemsMap(new Map());
    setHasMore(true);
    setInitialLoad(true);
    setError(null);
    lastLoadedIdRef.current = null;
    existingIdsRef.current.clear();
  }, []);

  // --- OPTIMIZED CACHE MANAGER (hanya simpan data penting) ---
  const cacheManager = useMemo(() => ({
    getKey: () => {
      if (!locationReadyRef.current || !locationRef.current) return 'feed_default';
      const lat = Math.round(locationRef.current.latitude * 100) / 100;
      const lng = Math.round(locationRef.current.longitude * 100) / 100;
      return `feed_hybrid_${lat}_${lng}_${searchRadius}_${networkInfo.effectiveType}`;
    },
    get: (key) => {
      try {
        const cached = localStorage.getItem(key);
        if (!cached) return null;
        const parsed = JSON.parse(cached);
        if (!parsed || !parsed.ids) return null;
        // Cache lebih lama untuk koneksi lambat
        const cacheDuration = networkInfo.isSlowConnection ? CACHE_DURATION * 2 : CACHE_DURATION;
        if (Date.now() - parsed.timestamp > cacheDuration) return null;
        return { itemsMap: new Map(parsed.items), orderedIds: parsed.ids };
      } catch { return null; }
    },
    set: (key, itemsMap, orderedIds) => {
      try {
        if (!orderedIds || orderedIds.length === 0) return;
        // Untuk koneksi lambat, hanya cache 30 item pertama
        const itemsToCache = networkInfo.isSlowConnection 
          ? Array.from(itemsMap.entries()).slice(0, 30)
          : Array.from(itemsMap.entries());
        
        localStorage.setItem(key, JSON.stringify({
          items: itemsToCache,
          ids: orderedIds.slice(0, networkInfo.isSlowConnection ? 30 : undefined),
          timestamp: Date.now()
        }));
      } catch (e) { console.warn('Cache save failed:', e); }
    },
    invalidate: () => {
      const keys = Object.keys(localStorage);
      keys.forEach(key => { if (key.startsWith('feed_')) localStorage.removeItem(key); });
    }
  }), [searchRadius, networkInfo.isSlowConnection, networkInfo.effectiveType]);

  // --- LOAD PLACES WITH NETWORK AWARENESS ---
  const loadPlaces = useCallback(async (reset = false, isLocationChange = false) => {
    const currentFetchId = ++fetchIdRef.current;
    if (loadingRef.current && !reset) return;

    const currentLimit = dynamicLimit;
    
    if (reset) {
      setInitialLoad(true);
      setHasMore(true);
      setError(null);
      setOrderedIds([]);
      setItemsMap(new Map());
      lastLoadedIdRef.current = null;
      existingIdsRef.current.clear();

      if (isLocationChange) {
        setIsTransitioningLocation(true);
        setFeedOpacity(0.5);
        await new Promise(resolve => setTimeout(resolve, LOCATION_TRANSITION_DELAY / 2));
      }
    }

    setLoading(true);

    try {
      if (reset && !forceRefresh && !isLocationChange) {
        const cacheKey = cacheManager.getKey();
        const cached = cacheManager.get(cacheKey);
        if (cached && cached.orderedIds && cached.orderedIds.length > 0) {
          setItemsMap(cached.itemsMap || new Map());
          setOrderedIds(cached.orderedIds);
          setInitialLoad(false);
          setLoading(false);
          if (cached.orderedIds.length > 0) {
            lastLoadedIdRef.current = cached.orderedIds[cached.orderedIds.length - 1];
          }
          return;
        }
      }

      let query = supabase
        .from("feed_view")
        .select("*")
        .order("created_at", { ascending: false });

      if (locationReadyRef.current && locationRef.current) {
        const lat = locationRef.current.latitude;
        const lng = locationRef.current.longitude;
        const bufferRadius = searchRadius * (networkInfo.isSlowConnection ? 1.5 : 1.2);
        const latDelta = bufferRadius / 111;
        const lngDelta = bufferRadius / (111 * Math.cos(lat * Math.PI / 180));

        query = query
          .gte('latitude', lat - latDelta)
          .lte('latitude', lat + latDelta)
          .gte('longitude', lng - lngDelta)
          .lte('longitude', lng + lngDelta);
      }

      if (!reset && lastLoadedIdRef.current) {
        query = query.lt('id', lastLoadedIdRef.current);
      }

      // Gunakan limit yang lebih kecil untuk koneksi lambat
      const { data, error: fetchError } = await query.limit(currentLimit * (networkInfo.isSlowConnection ? 1 : 2));
      if (fetchError) throw fetchError;
      if (currentFetchId !== fetchIdRef.current) return;

      let items = data || [];

      const processedItems = [];
      const userLocation = locationReadyRef.current && locationRef.current ? {
        latitude: locationRef.current.latitude,
        longitude: locationRef.current.longitude
      } : null;

      for (const item of items) {
        let distance = null;
        if (userLocation && item.latitude && item.longitude) {
          distance = haversineDistance(
            userLocation.latitude,
            userLocation.longitude,
            item.latitude,
            item.longitude
          );
        }
        
        if (distance !== null && distance > searchRadius) continue;
        
        const processedItem = processFeedItem({ 
          item, 
          locationReady: !!userLocation, 
          location: userLocation,
          comments: commentsRef.current 
        });
        
        const hybridScoreData = calculateHybridScore(processedItem, userLocation);
        
        const finalItem = {
          ...processedItem,
          _distance: distance,
          _distanceScore: hybridScoreData.distanceScore,
          _rankingScore: hybridScoreData.rankingScore,
          _hybridScore: hybridScoreData.hybridScore
        };
        
        processedItems.push(finalItem);
      }

      if (processedItems.length === 0) {
        setHasMore(false);
        setLoading(false);
        setInitialLoad(false);
        return;
      }

      processedItems.sort((a, b) => b._hybridScore - a._hybridScore);

      const newItemsMap = new Map(reset ? [] : itemsMap.entries());
      const newOrderedIds = reset ? [] : [...orderedIds];
      const newComments = { ...comments };

      for (const item of processedItems) {
        if (!newItemsMap.has(item.id)) {
          newItemsMap.set(item.id, item);
          newOrderedIds.push(item.id);
          newComments[item.id] = item.testimonial_terbaru || [];
          existingIdsRef.current.add(item.id);
        }
      }

      if (processedItems.length > 0) {
        lastLoadedIdRef.current = processedItems[processedItems.length - 1].id;
      }

      setItemsMap(newItemsMap);
      setOrderedIds(newOrderedIds);
      setComments(newComments);
      setHasMore(processedItems.length === currentLimit * (networkInfo.isSlowConnection ? 1 : 2));

      if (reset && newOrderedIds.length > 0) {
        const cacheKey = cacheManager.getKey();
        cacheManager.set(cacheKey, newItemsMap, newOrderedIds);

        if (isLocationChange) {
          setFeedOpacity(1);
          setIsTransitioningLocation(false);
        }

        if (locationReadyRef.current) {
          const connectionText = networkInfo.isSlowConnection ? " (mode hemat data)" : "";
          setToast({ 
            show: true, 
            message: `📍 ${newOrderedIds.length} tempat dalam radius ${searchRadius}km${connectionText}` 
          });
          setTimeout(() => setToast({ show: false, message: "" }), 2000);
        }
      }
    } catch (err) {
      console.error("Error loading places:", err);
      setError(err.message || "Gagal memuat data");
      setIsTransitioningLocation(false);
      setFeedOpacity(1);
    } finally {
      if (currentFetchId === fetchIdRef.current) {
        setLoading(false);
        setInitialLoad(false);
      }
    }
  }, [forceRefresh, cacheManager, searchRadius, itemsMap, orderedIds, comments, dynamicLimit, networkInfo.isSlowConnection]);

  // ── POLLING INSTEAD OF REALTIME FOR SLOW CONNECTIONS ──
  const pollForUpdates = useCallback(() => {
    if (!locationReadyRef.current || !hasMoreRef.current) return;
    
    const checkNewContent = async () => {
      try {
        const lastItemId = orderedIds[0];
        if (!lastItemId) return;
        
        const { data, error } = await supabase
          .from("feed_view")
          .select("id")
          .gt('id', lastItemId)
          .limit(1);
          
        if (error) throw error;
        
        if (data && data.length > 0) {
          // Ada konten baru, refresh feed
          loadPlaces(true);
          setToast({ show: true, message: "📢 Ada konten baru! Feed diperbarui." });
          setTimeout(() => setToast({ show: false, message: "" }), 2000);
        }
      } catch (err) {
        console.warn("Polling error:", err);
      }
    };
    
    const interval = setInterval(checkNewContent, networkInfo.isSlowConnection ? 60000 : 30000);
    return interval;
  }, [orderedIds, loadPlaces, networkInfo.isSlowConnection]);

  // ── REAL-TIME SUBSCRIPTION (hanya untuk koneksi cepat) ──
  useEffect(() => {
    if (!useRealtime) {
      // Gunakan polling untuk koneksi lambat
      const interval = pollForUpdates();
      setPollingInterval(interval);
      return () => {
        if (interval) clearInterval(interval);
      };
    }
    
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    const channel = supabase
      .channel('feed_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'feed_view' }, (payload) => {
        const newItem = payload.new;
        if (!newItem) return;

        const userLocation = locationReadyRef.current && locationRef.current ? {
          latitude: locationRef.current.latitude,
          longitude: locationRef.current.longitude
        } : null;

        let inRadius = false;
        let distance = null;
        
        if (userLocation && newItem.latitude && newItem.longitude) {
          distance = haversineDistance(
            userLocation.latitude,
            userLocation.longitude,
            newItem.latitude,
            newItem.longitude
          );
          inRadius = distance <= searchRadius;
        }

        if (inRadius && !itemsMap.has(newItem.id)) {
          const processedItem = processFeedItem({ 
            item: newItem, 
            locationReady: !!userLocation, 
            location: userLocation,
            comments: commentsRef.current 
          });
          
          const hybridScoreData = calculateHybridScore(processedItem, userLocation);
          
          const finalItem = {
            ...processedItem,
            _distance: distance,
            _distanceScore: hybridScoreData.distanceScore,
            _rankingScore: hybridScoreData.rankingScore,
            _hybridScore: hybridScoreData.hybridScore
          };
          
          setItemsMap(prev => new Map(prev).set(finalItem.id, finalItem));
          
          setOrderedIds(prev => {
            const newIds = [...prev, finalItem.id];
            newIds.sort((a, b) => {
              const scoreA = itemsMap.get(a)?._hybridScore || 0;
              const scoreB = itemsMap.get(b)?._hybridScore || 0;
              return scoreB - scoreA;
            });
            return newIds;
          });
          
          setComments(prev => ({ ...prev, [finalItem.id]: finalItem.testimonial_terbaru || [] }));
          setToast({ show: true, message: `📢 ${finalItem.name} menambahkan update baru!` });
          setTimeout(() => setToast({ show: false, message: "" }), 2000);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [searchRadius, itemsMap, useRealtime, pollForUpdates]);

  // ── HANDLE MANUAL LOCATION CHANGE ──
  const handleManualLocationSelect = useCallback(async (selectedLocation) => {
    console.log("📍 User pilih lokasi baru:", selectedLocation);
    setManualLocation(selectedLocation);
    cacheManager.invalidate();
    await resetFeed();
    setIsTransitioningLocation(true);
    setFeedOpacity(0.5);
    await new Promise(resolve => setTimeout(resolve, 200));
    await loadPlaces(true, true);
    const locationName = selectedLocation?.address || selectedLocation?.name || "lokasi baru";
    setToast({ show: true, message: `📍 Feed diperbarui untuk ${locationName}` });
    setTimeout(() => setToast({ show: false, message: "" }), 3000);
  }, [cacheManager, loadPlaces, setManualLocation, resetFeed]);

  // ── HANDLE GPS LOCATION ──
  const handleGPSActivation = useCallback(async () => {
    console.log("📍 Aktifkan GPS location...");
    await requestLocation();
    await new Promise(resolve => setTimeout(resolve, 800));
    cacheManager.invalidate();
    await resetFeed();
    setIsTransitioningLocation(true);
    setFeedOpacity(0.5);
    await loadPlaces(true, true);
    setToast({ show: true, message: `📍 Feed diperbarui untuk lokasi GPS: ${villageLocation}` });
    setTimeout(() => setToast({ show: false, message: "" }), 3000);
  }, [requestLocation, cacheManager, loadPlaces, villageLocation, resetFeed]);

  // ── INFINITE SCROLL ──
  useEffect(() => {
    if (!lastCardRef.current || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadPlaces(false);
        }
      },
      { threshold: 0.1, rootMargin: "200px" }
    );

    observer.observe(lastCardRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, loadPlaces, tempat.length]);

  // ── PULL TO REFRESH ──
  useEffect(() => {
    let startY = 0;
    let isPulling = false;

    const handleTouchStart = (e) => {
      if (window.scrollY === 0 && !loading && !refreshing) {
        startY = e.touches[0].pageY;
        isPulling = true;
      }
    };

    const handleTouchMove = (e) => {
      if (!isPulling || window.scrollY > 0) return;
      const pullDistance = e.touches[0].pageY - startY;
      if (pullDistance > 60 && !refreshing) {
        setRefreshing(true);
      }
    };

    const handleTouchEnd = () => {
      if (refreshing && !loading) {
        cacheManager.invalidate();
        setForceRefresh(true);
        loadPlaces(true);
        setTimeout(() => {
          setRefreshing(false);
          setForceRefresh(false);
        }, 1000);
      }
      isPulling = false;
    };

    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [refreshing, loading, cacheManager, loadPlaces]);

  // ── INITIAL LOAD ──
  useEffect(() => {
    if (!initialLoadDoneRef.current) {
      initialLoadDoneRef.current = true;
      loadPlaces(true, false);
    }
  }, [loadPlaces]);

  // ── LOCATION CHANGE HANDLER ──
  useEffect(() => {
    if (!initialLoadDoneRef.current) return;
    if (!locationReady) return;

    const currentKey = location ? `${location.latitude.toFixed(3)},${location.longitude.toFixed(3)}` : '';
    if (lastLocationRef.current === currentKey) return;

    console.log(`📍 Lokasi berubah: ${lastLocationRef.current} -> ${currentKey}`);
    lastLocationRef.current = currentKey;
    
    cacheManager.invalidate();
    loadPlaces(true, true);

    setToast({ show: true, message: `📍 Feed diperbarui untuk lokasi: ${villageLocation}` });
    setTimeout(() => setToast({ show: false, message: "" }), 3000);
  }, [location?.latitude, location?.longitude, locationReady, cacheManager, loadPlaces, villageLocation]);

  // ── HANDLERS ──
  const handleRadiusChange = useCallback((newRadius) => {
    setSearchRadius(newRadius);
    cacheManager.invalidate();
    loadPlaces(true);
    setToast({ show: true, message: `🔍 Radius ${newRadius}km` });
    setTimeout(() => setToast({ show: false, message: "" }), 2000);
  }, [cacheManager, loadPlaces]);

  const handleSearchSelect = useCallback((item) => {
    if (!item) return;
    setShowSearchModal(false);
    setItemsMap(prev => {
      const newMap = new Map(prev);
      newMap.set(item.id, item);
      return newMap;
    });
    
    setOrderedIds(prev => {
      const filtered = prev.filter(id => id !== item.id);
      return [item.id, ...filtered];
    });
    setSelectedTempat(item);
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    setToast({ show: true, message: `📍 Menampilkan ${item.name}` });
    setTimeout(() => setToast({ show: false, message: "" }), 2000);
  }, []);

  const openAICardModal = useCallback((item, onUploadSuccess, initialQuery = "") => {
    setSelectedTempat(item);
    setSelectedLaporanWarga(item?.laporan_terbaru || []);
    setSelectedUploadSuccess(() => onUploadSuccess);
    setInitialQuery(initialQuery);
    setAiContext("card");
    setShowAIModal(true);
  }, []);

  const handleSearchWithQuery = useCallback((q, item = null) => {
    setInitialQuery(q);
    setSelectedTempat(item || null);
    setSelectedUploadSuccess(null);
    setAiContext("search");
    setShowAIModal(true);
  }, []);

  const openKomentarModal = useCallback((item) => {
    setSelectedTempat(item);
    setShowKomentarModal(true);
  }, []);

  const closeModals = useCallback(() => {
    setShowAIModal(false);
    setShowKomentarModal(false);
    setSelectedTempat(null);
    setSelectedLaporanWarga([]);
    setInitialQuery("");
  }, []);

  const handleShare = useCallback(async (item) => {
    const shareUrl = `${window.location.origin}/?tempat=${item.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: item.name, text: `📍 Cek kondisi terkini di ${item.name}!`, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setToast({ show: true, message: "✅ Link disalin!" });
        setTimeout(() => setToast({ show: false, message: "" }), 3000);
      }
    } catch (_) { }
  }, []);

  const retryLoad = useCallback(() => {
    setError(null);
    cacheManager.invalidate();
    loadPlaces(true);
  }, [loadPlaces, cacheManager]);

  const handleExpandRadius = useCallback(() => {
    handleRadiusChange(searchRadius + 5);
  }, [handleRadiusChange, searchRadius]);

  return (
    <main className="relative min-h-screen mx-auto w-[92%] max-w-[400px] bg-transparent">
      <PullToRefreshIndicator refreshing={refreshing} />

      <Header
        user={user}
        isAdmin={isAdmin}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        locationReady={locationReady}
        villageLocation={villageLocation}
        districtLocation={districtLocation}
        isScrolled={isScrolled}
        onOpenLocationModal={() => setIsLocationModalOpen(true)}
        onOpenSearchModal={() => setShowSearchModal(true)}
        onShowStatistik={() => { setForceShowLaporan(true); setTimeout(() => setForceShowLaporan(false), 100); }}
        onOpenLaporanForm={() => setShowFormLaporan(true)}
        onSearchWithQuery={handleSearchWithQuery}
        tempat={tempat}
        location={location}
        displayLocation={villageLocation}
        searchRadius={searchRadius}
        onRadiusChange={handleRadiusChange}
      />

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      <LaporanWarga tempat={tempat} locationReady={locationReady} displayLocation={villageLocation} location={location} forceShow={forceShowLaporan} onHide={() => setForceShowLaporan(false)} />
      <FormLaporanAktif isOpen={showFormLaporan} onClose={() => setShowFormLaporan(false)} villageLocation={villageLocation} theme={theme} user={user} />
      
      <LocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        locationReady={locationReady}
        isMalam={isMalam}
        onActivateGPS={handleGPSActivation}
        onSelectManual={handleManualLocationSelect}
      />

      <motion.div className="mt-4 space-y-2 min-h-[60vh] relative" animate={{ opacity: feedOpacity }} transition={{ duration: LOCATION_TRANSITION_DELAY / 1000 }}>
        {initialLoad ? (
          <SkeletonLoader />
        ) : error ? (
          <ErrorState error={error} onRetry={retryLoad} />
        ) : tempat.length === 0 ? (
          <EmptyState radius={searchRadius} locationName={villageLocation} onExpandRadius={handleExpandRadius} />
        ) : (
          <React.Suspense fallback={<SkeletonLoader />}>
            <LayoutGroup>
              <motion.div layout className="space-y-2">
                <AnimatePresence mode="popLayout" initial={false}>
  {tempat.map((item, index) => {
    const isLast = index === tempat.length - 1;
    const isPriority = index < 3; 
    return (
      <motion.div
        key={item.id}
        layout
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
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
            openAIModal={openAICardModal}
            openKomentarModal={openKomentarModal}
            onShare={handleShare}
            priority={isPriority} 
          />
        </FeedCardWrapper>
      </motion.div>
    );
  })}
</AnimatePresence>
              </motion.div>
            </LayoutGroup>
          </React.Suspense>
        )}

        {loading && !initialLoad && !error && <LoadingMore />}
        {!hasMore && tempat.length > 0 && !error && <EndOfFeed />}

        {isTransitioningLocation && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm rounded-2xl z-40">
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <p className="text-white/60 text-xs font-medium">Memperbarui feed untuk lokasi baru...</p>
            </div>
          </motion.div>
        )}
      </motion.div>

      <React.Suspense fallback={null}>
        <SearchModal
          isOpen={showSearchModal}
          onClose={() => setShowSearchModal(false)}
          onSelectTempat={handleSearchSelect}
          onOpenAIModal={handleSearchWithQuery}
          allData={tempat}
          theme={theme}
          villageLocation={villageLocation}
        />
      </React.Suspense>
      <React.Suspense fallback={null}>
        <AIModal isOpen={showAIModal} onClose={closeModals} tempat={selectedTempat} context={aiContext} onOpenAuthModal={() => setIsAuthModalOpen(true)} onUploadSuccess={selectedUploadSuccess} initialQuery={initialQuery} item={selectedTempat} laporanWarga={selectedLaporanWarga} />
      </React.Suspense>
      <React.Suspense fallback={null}>
        <KomentarModal isOpen={showKomentarModal} onClose={closeModals} tempat={selectedTempat} isAdmin={isAdmin} />
      </React.Suspense>
      
      <ToastMessage show={toast.show} message={toast.message} />
    </main>
  );
}