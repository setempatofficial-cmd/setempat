"use client";

import * as React from "react";
import { useEffect, useState, useCallback, useRef, useMemo, lazy, Suspense, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import AuthModal from "@/app/components/auth/AuthModal";
import { useAuth } from "@/app/context/AuthContext";
import { useTheme } from "@/app/hooks/useTheme";
import { supabase } from "../../../lib/supabaseClient";
import { getGreeting } from "../../../lib/greeting";
import { processFeedItem } from "../../../lib/feedEngine";
import { useLocation } from "@/components/LocationProvider";

import FeedCard from "./FeedCard";
import Header from "@/components/Header";
import LocationModal from "@/components/LocationModal";
import LaporanWarga from "../layout/LaporanWarga";
import FormLaporanAktif from "@/app/components/modals/FormLaporanAktif";
import FeedCardWrapper from "@/components/FeedCardWrapper";
import SmartBottomNav from "@/app/components/layout/SmartBottomNav";
import UploadModal from "@/components/UploadModal";
import BreakCard from "@/components/BreakCard";
import { getKentonganForFeed } from "@/lib/kentongan";

const AIModal = React.lazy(() => import("../ai/AIModal"));
const KomentarModal = React.lazy(() => import("./KomentarModal"));
const SearchModal = React.lazy(() => import("./SearchModal"));

const CACHE_DURATION = 2 * 60 * 1000;
const RANKING_WEIGHT = 0.3;
const DISTANCE_WEIGHT = 0.7;
const SESSION_CACHE_KEY = 'feed_backup';

const getDynamicLimit = () => {
  if (typeof navigator === 'undefined') return 8;
  const connection = navigator.connection;
  if (!connection) return 8;
  switch (connection.effectiveType) {
    case '4g': return 8;
    case '3g': return 6;
    case '2g': case 'slow-2g': return 3;
    default: return 8;
  }
};

const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
      userLocation.latitude, userLocation.longitude,
      item.latitude, item.longitude
    );
  }
  const distanceScore = getDistanceScore(distance);
  return (rankingScore * RANKING_WEIGHT) + (distanceScore * DISTANCE_WEIGHT);
};

if (typeof window !== 'undefined' && !window.__feedItemCache) {
  window.__feedItemCache = new Map();
  window.__feedItemCacheMaxSize = 75;
}

const cachedProcessFeedItem = (item, locationReady, location) => {
  if (typeof window === 'undefined') return processFeedItem({ item, locationReady, location, comments: {} });
  const cacheKey = `${item.id}_${locationReady}_${location?.latitude || 0}_${location?.longitude || 0}`;
  if (window.__feedItemCache.has(cacheKey)) return window.__feedItemCache.get(cacheKey);
  const result = processFeedItem({ item, locationReady, location, comments: {} });
  if (window.__feedItemCache.size > window.__feedItemCacheMaxSize) {
    const firstKey = window.__feedItemCache.keys().next().value;
    window.__feedItemCache.delete(firstKey);
  }
  window.__feedItemCache.set(cacheKey, result);
  return result;
};

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
          <div className="flex gap-2 mt-2">
            <div className="h-8 w-16 bg-white/10 rounded-full animate-pulse" />
            <div className="h-8 w-16 bg-white/10 rounded-full animate-pulse" />
          </div>
        </div>
      </div>
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

const InvisibleLoading = memo(() => <div className="h-20 w-full opacity-0 pointer-events-none" />);
const EndOfFeed = memo(() => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8">
    <p className="text-white/40 text-xs">✨ Semua konten di sekitar telah dimuat ✨</p>
  </motion.div>
));

const PullToRefreshIndicator = memo(({ refreshing }) => (
  <AnimatePresence>
    {refreshing && (
      <motion.div
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -60, opacity: 0 }}
        className="fixed top-0 left-0 right-0 bg-black/80 backdrop-blur-md py-3 text-center text-white/70 text-sm z-50 shadow-lg"
      >
        <div className="flex items-center justify-center gap-3">
          <div className="relative flex items-center justify-center">
            <div className="absolute animate-ping h-8 w-8 rounded-full bg-[#E3655B] opacity-20"></div>
            <div className="absolute animate-ping h-8 w-8 rounded-full bg-[#25F4EE] opacity-20 [animation-delay:0.5s]"></div>
            <div className="relative h-6 w-6 border-[3px] border-t-[#E3655B] border-r-transparent border-b-[#25F4EE] border-l-transparent rounded-full animate-spin"></div>
          </div>
          <span>Memperbarui...</span>
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

export default function FeedContent() {
  const router = useRouter();
  const { location, status, placeName, requestLocation, setManualLocation, activeMode } = useLocation();
  const { user, isAdmin, profile } = useAuth();
  const theme = useTheme();

  const [networkInfo, setNetworkInfo] = useState({ isSlowConnection: false });
  const [dynamicLimit, setDynamicLimit] = useState(20);
  const [itemsMap, setItemsMap] = useState(new Map());
  const [orderedIds, setOrderedIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [comments, setComments] = useState({});
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState({});
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "" });
  const [refreshing, setRefreshing] = useState(false);
  const [isTransitioningLocation, setIsTransitioningLocation] = useState(false);
  const [feedOpacity, setFeedOpacity] = useState(1);
  const [kentonganForFeed, setKentonganForFeed] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [userId, setUserId] = useState(null);
  const [userRole, setUserRole] = useState(null);
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
  const [selectedKentongan, setSelectedKentongan] = useState(null);

  const fetchIdRef = useRef(0);
  const lastCardRef = useRef(null);
  const lastLocationCacheKeyRef = useRef(typeof window !== 'undefined' ? sessionStorage.getItem('last_location_key') : null);
  const isFetchingRef = useRef(false);
  const existingIdsRef = useRef(new Set());

  const searchRadius = activeMode === 'general' ? 40 : 10;
  const locationReady = useMemo(() => status === "granted" && !!location?.latitude && !!location?.longitude, [status, location]);
  const { villageLocation, districtLocation } = useMemo(() => {
    if (!placeName) return { villageLocation: "Pilih Lokasi", districtLocation: "" };
    const parts = placeName.split(",").map(p => p.trim());
    return { villageLocation: parts[0] || "Lokasi", districtLocation: parts[1] || "" };
  }, [placeName]);
  const tempat = useMemo(() => orderedIds.map(id => itemsMap.get(id)).filter(Boolean), [orderedIds, itemsMap]);

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const authUser = session?.user;
      if (authUser) {
        setUserId(authUser.id);
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', authUser.id).maybeSingle();
        setUserRole(profile?.role || 'warga');
      }
    };
    getUser();
  }, []);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setIsScrolled(window.scrollY > 50);
          lastScrollY = window.scrollY;
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.connection) return;
    const updateNetworkInfo = () => {
      const conn = navigator.connection;
      const isSlowConnection = conn?.saveData || conn?.effectiveType === 'slow-2g' || conn?.effectiveType === '2g';
      setNetworkInfo({ isSlowConnection });
      setDynamicLimit(getDynamicLimit());
    };
    updateNetworkInfo();
    navigator.connection.addEventListener('change', updateNetworkInfo);
    return () => navigator.connection.removeEventListener('change', updateNetworkInfo);
  }, []);

  const getCacheKey = useCallback(() => {
    if (!locationReady || !location) return 'feed_default';
    const lat = Math.round(location.latitude * 10) / 10;
    const lng = Math.round(location.longitude * 10) / 10;
    return `feed_v2_${lat}_${lng}_${searchRadius}`;
  }, [locationReady, location, searchRadius]);

  const cacheManager = useMemo(() => ({
    get: (key) => {
      try {
        const cached = localStorage.getItem(key);
        if (!cached) return null;
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp > CACHE_DURATION) return null;
        return { itemsMap: new Map(parsed.items), orderedIds: parsed.ids };
      } catch { return null; }
    },
    set: (key, itemsMap, orderedIds) => {
      try {
        if (!orderedIds?.length) return;
        localStorage.setItem(key, JSON.stringify({
          items: Array.from(itemsMap.entries()),
          ids: orderedIds,
          timestamp: Date.now()
        }));
      } catch { }
    },
    invalidate: () => {
      Object.keys(localStorage).forEach(key => { if (key.startsWith('feed_v2_')) localStorage.removeItem(key); });
    }
  }), []);

  const preloadImages = useCallback((items) => {
    items.slice(0, 3).forEach(id => {
      const imgSrc = itemsMap.get(id)?.photos?.[0];
      if (imgSrc) new Image().src = imgSrc;
    });
  }, [itemsMap]);

  const loadPlaces = useCallback(async (reset = false, isLocationChange = false) => {
    if (isFetchingRef.current && !reset) return;
    const currentFetchId = ++fetchIdRef.current;
    isFetchingRef.current = true;

    if (reset) {
      setInitialLoad(true);
      setHasMore(true);
      setError(null);
      setOrderedIds([]);
      setItemsMap(new Map());
      existingIdsRef.current.clear();
      if (isLocationChange) setIsTransitioningLocation(true);
    }

    setLoading(true);

    try {
      const cacheKey = getCacheKey();
      if (reset && !isLocationChange) {
        const cached = cacheManager.get(cacheKey);
        if (cached?.orderedIds?.length) {
          setItemsMap(cached.itemsMap);
          setOrderedIds(cached.orderedIds);
          setInitialLoad(false);
          preloadImages(cached.orderedIds);
          setLoading(false);
          isFetchingRef.current = false;
          return;
        }
      }

      let query = supabase.from("feed_view").select("id, name, latitude, longitude, created_at, photos, laporan_terbaru, alamat, category, vibe_count, latest_condition, latest_estimated_people, latest_estimated_wait_time").order("created_at", { ascending: false });

      if (locationReady && location) {
        const lat = location.latitude;
        const lng = location.longitude;
        const bufferRadius = searchRadius * 1.2;
        const latDelta = bufferRadius / 111;
        const lngDelta = bufferRadius / (111 * Math.cos(lat * Math.PI / 180));
        query = query.gte('latitude', lat - latDelta).lte('latitude', lat + latDelta).gte('longitude', lng - lngDelta).lte('longitude', lng + lngDelta);
      }

      const { data, error: fetchError } = await query.limit(dynamicLimit * 2);
      if (fetchError) throw fetchError;
      if (currentFetchId !== fetchIdRef.current) return;

      const userLocation = locationReady && location ? { latitude: location.latitude, longitude: location.longitude } : null;
      const processedItems = [];

      for (const item of (data || [])) {
        let distance = null;
        if (userLocation && item.latitude && item.longitude) {
          distance = haversineDistance(userLocation.latitude, userLocation.longitude, item.latitude, item.longitude);
        }
        if (distance !== null && distance > searchRadius) continue;

        const processedItem = cachedProcessFeedItem(item, !!userLocation, userLocation);
        const hybridScore = calculateHybridScore(processedItem, userLocation);
        processedItems.push({ ...processedItem, _distance: distance, _hybridScore: hybridScore });
      }

      if (!processedItems.length && !reset) {
        setHasMore(false);
        setLoading(false);
        setInitialLoad(false);
        isFetchingRef.current = false;
        return;
      }

      processedItems.sort((a, b) => b._hybridScore - a._hybridScore);

      setItemsMap(prevMap => {
        const newMap = new Map(reset ? [] : prevMap.entries());
        processedItems.forEach(item => { if (!newMap.has(item.id)) newMap.set(item.id, item); });
        return newMap;
      });

      setOrderedIds(prevIds => {
        let newIds = reset ? [] : [...prevIds];
        processedItems.forEach(item => { if (!newIds.includes(item.id)) newIds.push(item.id); });
        newIds.sort((a, b) => (processedItems.find(i => i.id === b)?._hybridScore || 0) - (processedItems.find(i => i.id === a)?._hybridScore || 0));
        return newIds;
      });

      setHasMore(processedItems.length === dynamicLimit * 2);

      if (reset && processedItems.length) {
        const finalMap = new Map(processedItems.map(item => [item.id, item]));
        const finalIds = processedItems.map(item => item.id);
        cacheManager.set(cacheKey, finalMap, finalIds);
        sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify({
          itemsMap: finalIds.slice(0, 20).map(id => [id, finalMap.get(id)]),
          orderedIds: finalIds.slice(0, 20),
          timestamp: Date.now()
        }));
        preloadImages(finalIds);
        if (isLocationChange) {
          setFeedOpacity(1);
          setIsTransitioningLocation(false);
        }
        if (locationReady) {
          setToast({ show: true, message: `📍 ${processedItems.length} tempat dalam radius ${searchRadius}km` });
          setTimeout(() => setToast({ show: false, message: "" }), 2000);
        }
      }
    } catch (err) {
      setError(err.message || "Gagal memuat data");
      setIsTransitioningLocation(false);
      setFeedOpacity(1);
    } finally {
      if (currentFetchId === fetchIdRef.current) {
        setLoading(false);
        setInitialLoad(false);
        isFetchingRef.current = false;
      }
    }
  }, [locationReady, location, searchRadius, dynamicLimit, getCacheKey, cacheManager, preloadImages]);

  const fetchKentonganForFeed = useCallback(async () => {
    if (!user?.id) return;
    const data = await getKentonganForFeed(user.id);
    setKentonganForFeed(data);
  }, [user?.id]);

  const openAIModalWithKentongan = useCallback((kentongan) => {
    setSelectedTempat(null);
    setSelectedKentongan(kentongan);
    setAiContext("kentongan");
    setShowAIModal(true);
  }, []);

  const generateBreakCard = useCallback((scrollIndex, displayedPlaces) => {
    const urgentKentongan = kentonganForFeed.filter(k => k.is_urgent);
    if (urgentKentongan.length && scrollIndex >= 1) {
      const k = urgentKentongan[0];
      return { type: "kentongan", data: { title: k.title, text: `🚨 ${k.title}` }, onClick: () => openAIModalWithKentongan(k) };
    }
    const normalKentongan = kentonganForFeed.filter(k => !k.is_urgent);
    if (normalKentongan.length && scrollIndex >= 2) {
      const k = normalKentongan[Math.floor(scrollIndex / 5) % normalKentongan.length];
      return { type: "kentongan", data: { title: k.title, text: k.title }, onClick: () => openAIModalWithKentongan(k) };
    }
    if (scrollIndex >= 8) {
      return { type: "heatmap-text", data: { text: "📍 Kamu sudah melihat beberapa lokasi, cek area lain?" } };
    }
    const totalLaporanHariIni = displayedPlaces.reduce((acc, p) => acc + (p.laporan_terbaru || []).filter(l => new Date(l.created_at).toDateString() === new Date().toDateString()).length, 0);
    return { type: "statistic", data: { text: `📊 ${displayedPlaces.length} lokasi aktif · ${totalLaporanHariIni} laporan hari ini` } };
  }, [kentonganForFeed, openAIModalWithKentongan]);

  const feedItemsWithBreaks = useMemo(() => {
    if (!tempat.length) return [];
    const itemsToProcess = tempat.slice(0, 10);
    const remainingItems = tempat.slice(10);
    const result = [];
    let cardsSinceLastBreak = 0;
    for (let i = 0; i < itemsToProcess.length; i++) {
      result.push(itemsToProcess[i]);
      cardsSinceLastBreak++;
      if ((cardsSinceLastBreak >= 4 || (cardsSinceLastBreak >= 2 && i !== itemsToProcess.length - 1)) && cardsSinceLastBreak >= 2) {
        const breakCard = generateBreakCard(i + 1, itemsToProcess.slice(0, i + 1));
        if (breakCard) {
          result.push({ _isBreak: true, id: `break-${i}`, type: breakCard.type, data: breakCard.data, onClick: breakCard.onClick });
        }
        cardsSinceLastBreak = 0;
      }
    }
    return [...result, ...remainingItems];
  }, [tempat, generateBreakCard]);

  useEffect(() => {
    if (!lastCardRef.current || !hasMore || loading) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loading) loadPlaces(false);
    }, { threshold: 0.1, rootMargin: "400px" });
    observer.observe(lastCardRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, loadPlaces, feedItemsWithBreaks.length]);

  useEffect(() => {
    let startY = 0;
    const handleTouchStart = (e) => { if (window.scrollY === 0 && !loading && !refreshing) startY = e.touches[0].pageY; };
    const handleTouchMove = (e) => { if (e.touches[0].pageY - startY > 60 && !refreshing) setRefreshing(true); };
    const handleTouchEnd = () => { if (refreshing && !loading) { cacheManager.invalidate(); loadPlaces(true); setTimeout(() => setRefreshing(false), 1000); } };
    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [refreshing, loading, cacheManager, loadPlaces]);

  useEffect(() => {
    if (initialLoad && !orderedIds.length) loadPlaces(true, false);
    else if (orderedIds.length) preloadImages(orderedIds);
  }, []);

  useEffect(() => {
    if (!locationReady) return;
    const currentCacheKey = getCacheKey();
    if (lastLocationCacheKeyRef.current === currentCacheKey) return;
    lastLocationCacheKeyRef.current = currentCacheKey;
    sessionStorage.setItem('last_location_key', currentCacheKey);
    cacheManager.invalidate();
    sessionStorage.removeItem(SESSION_CACHE_KEY);
    loadPlaces(true, true);
    setToast({ show: true, message: `📍 Feed diperbarui untuk lokasi: ${villageLocation}` });
    setTimeout(() => setToast({ show: false, message: "" }), 3000);
  }, [getCacheKey, locationReady, cacheManager, villageLocation, loadPlaces]);

  useEffect(() => { fetchKentonganForFeed(); }, [fetchKentonganForFeed]);

  const handleLocationChanged = useCallback(async () => {
    setIsTransitioningLocation(true);
    setFeedOpacity(0.7);
    cacheManager.invalidate();
    sessionStorage.removeItem(SESSION_CACHE_KEY);
    sessionStorage.removeItem('last_location_key');
    await loadPlaces(true, true);
    setIsTransitioningLocation(false);
    setFeedOpacity(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [cacheManager, loadPlaces]);

  const handleManualLocationSelect = useCallback(async (selectedLocation) => {
    setManualLocation(selectedLocation);
    await handleLocationChanged();
    const locationName = selectedLocation?.address || selectedLocation?.name || "lokasi baru";
    setToast({ show: true, message: `📍 Feed diperbarui untuk ${locationName}` });
    setTimeout(() => setToast({ show: false, message: "" }), 2000);
  }, [setManualLocation, handleLocationChanged]);

  const handleGPSActivation = useCallback(async (mode = 'gps') => {
    await requestLocation(mode);
    await handleLocationChanged();
    setToast({ show: true, message: `📍 Feed diperbarui untuk lokasi GPS: ${villageLocation}` });
    setTimeout(() => setToast({ show: false, message: "" }), 2000);
  }, [requestLocation, handleLocationChanged, villageLocation]);

  const handleRadiusChange = useCallback((newRadius) => {
    cacheManager.invalidate();
    loadPlaces(true);
    setToast({ show: true, message: `🔍 Radius ${newRadius}km` });
    setTimeout(() => setToast({ show: false, message: "" }), 2000);
  }, [cacheManager, loadPlaces]);

  const handleSearchSelect = useCallback((item) => {
    if (!item) return;
    setShowSearchModal(false);
    setItemsMap(prev => new Map(prev).set(item.id, item));
    setOrderedIds(prev => [item.id, ...prev.filter(id => id !== item.id)]);
    setSelectedTempat(item);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setToast({ show: true, message: `📍 Menampilkan ${item.name}` });
    setTimeout(() => setToast({ show: false, message: "" }), 2000);
  }, []);

  const openAICardModal = useCallback((item, onUploadSuccess, query = "") => {
    setSelectedTempat(item);
    setSelectedLaporanWarga(item?.laporan_terbaru || []);
    setSelectedUploadSuccess(() => onUploadSuccess);
    setInitialQuery(query);
    setAiContext("card");
    setShowAIModal(true);
  }, []);

  const handleSearchWithQuery = useCallback((q, item = null) => {
    setInitialQuery(q);
    setSelectedTempat(item);
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
    setSelectedKentongan(null);
    setSelectedLaporanWarga([]);
    setInitialQuery("");
  }, []);

  const handleShare = useCallback(async (item) => {
    const shareUrl = `${window.location.origin}/post/${item.id}`;
    try {
      if (navigator.share) await navigator.share({ title: item.name, text: `📍 Cek kondisi terkini di ${item.name}!`, url: shareUrl });
      else await navigator.clipboard.writeText(shareUrl);
      setToast({ show: true, message: navigator.share ? "" : "✅ Link disalin!" });
      setTimeout(() => setToast({ show: false, message: "" }), 3000);
    } catch { }
  }, []);

  const retryLoad = useCallback(() => {
    setError(null);
    cacheManager.invalidate();
    loadPlaces(true);
  }, [loadPlaces, cacheManager]);

  const handleExpandRadius = useCallback(() => handleRadiusChange(searchRadius + 5), [handleRadiusChange, searchRadius]);

  return (
    <main className="relative min-h-screen mx-auto w-[92%] max-w-[400px] bg-transparent">
      <PullToRefreshIndicator refreshing={refreshing} />

      <Header
        user={user} isAdmin={isAdmin} onOpenAuthModal={() => setIsAuthModalOpen(true)}
        locationReady={locationReady} villageLocation={villageLocation} districtLocation={districtLocation}
        isScrolled={isScrolled} onOpenLocationModal={() => setIsLocationModalOpen(true)}
        onOpenSearchModal={() => setShowSearchModal(true)} onShowStatistik={() => { setForceShowLaporan(true); setTimeout(() => setForceShowLaporan(false), 100); }}
        onOpenLaporanForm={() => setShowFormLaporan(true)} onSearchWithQuery={handleSearchWithQuery}
        tempat={tempat} location={location} displayLocation={villageLocation}
        searchRadius={searchRadius} onRadiusChange={handleRadiusChange}
      />

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      <LaporanWarga tempat={tempat} locationReady={locationReady} displayLocation={villageLocation} location={location} forceShow={forceShowLaporan} onHide={() => setForceShowLaporan(false)} />
      <FormLaporanAktif isOpen={showFormLaporan} onClose={() => setShowFormLaporan(false)} villageLocation={villageLocation} theme={theme} user={user} />

      <LocationModal isOpen={isLocationModalOpen} onClose={() => setIsLocationModalOpen(false)} onActivateGPS={handleGPSActivation} onSelectManual={handleManualLocationSelect} onLocationChanged={handleLocationChanged} customLocationName={placeName} />

      <motion.div className="pt-[72px] space-y-2 min-h-[60vh] relative" animate={{ opacity: feedOpacity }} transition={{ duration: 0.3 }}>
        {initialLoad ? <SkeletonLoader /> : error ? <ErrorState error={error} onRetry={retryLoad} /> : !feedItemsWithBreaks.length ? <EmptyState radius={searchRadius} locationName={villageLocation} onExpandRadius={handleExpandRadius} /> : (
          <Suspense fallback={<SkeletonLoader />}>
            <motion.div layout className="space-y-2">
              <AnimatePresence initial={false}>
                {feedItemsWithBreaks.map((item, index) => {
                  if (item._isBreak) return <BreakCard key={item.id} type={item.type} data={item.data} theme={theme} onClick={item.onClick} />;
                  const isLast = index === feedItemsWithBreaks.length - 1;
                  return (
                    <motion.div key={item.id} layout initial={false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} ref={isLast ? lastCardRef : null} className="mb-6">
                      <FeedCardWrapper theme={theme}>
                        <FeedCard
                          item={item} locationReady={locationReady} location={location} comments={comments}
                          selectedPhotoIndex={selectedPhotoIndex} setSelectedPhotoIndex={setSelectedPhotoIndex}
                          openAIModal={openAICardModal} openKomentarModal={openKomentarModal} onShare={handleShare}
                          priority={index < 3} userId={user?.id} userProfile={profile} userAvatar={profile?.avatar_url} showLiveInsight={false}
                        />
                      </FeedCardWrapper>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          </Suspense>
        )}
        {loading && !initialLoad && !error && <InvisibleLoading />}
        {!hasMore && feedItemsWithBreaks.length > 0 && !error && <EndOfFeed />}
        {isTransitioningLocation && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-50">
            <div className="flex flex-col items-center gap-3">
              <div className="relative h-8 w-8 border-2 border-white/20 border-t-[#E3655B] border-b-[#25F4EE] rounded-full animate-spin" style={{ animationDuration: '0.35s' }}></div>
              <p className="text-white/70 text-xs font-medium">Mengupdate lokasi...</p>
            </div>
          </motion.div>
        )}
      </motion.div>

      <Suspense fallback={null}>
        <SearchModal isOpen={showSearchModal} onClose={() => setShowSearchModal(false)} onSelectTempat={handleSearchSelect} onOpenAIModal={handleSearchWithQuery} allData={tempat} theme={theme} villageLocation={villageLocation} />
      </Suspense>

      <Suspense fallback={null}>
        <AIModal isOpen={showAIModal} onClose={closeModals} tempat={selectedTempat} kentongan={selectedKentongan} context={aiContext} onOpenAuthModal={() => setIsAuthModalOpen(true)} onUploadSuccess={selectedUploadSuccess} initialQuery={initialQuery} item={selectedTempat} laporanWarga={selectedLaporanWarga} />
      </Suspense>

      <Suspense fallback={null}>
        <KomentarModal isOpen={showKomentarModal} onClose={closeModals} tempat={selectedTempat} isAdmin={isAdmin} />
      </Suspense>

      <SmartBottomNav onOpenUpload={() => setShowUploadModal(true)} onOpenLaporanForm={() => setShowFormLaporan(true)} onOpenNotification={() => router.push("/woro")} onOpenProfile={() => router.push("/rewang")} />
      <UploadModal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} userId={userId} userRole={userRole} />
      <ToastMessage show={toast.show} message={toast.message} />
    </main>
  );
}