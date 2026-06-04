"use client";

import * as React from "react";
import { useEffect, useState, useCallback, useRef, useMemo, lazy, Suspense, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import AuthModal from "@/app/components/auth/AuthModal";
import { useAuth } from "@/app/context/AuthContext";
import { useTheme } from "@/app/hooks/useTheme";
import { supabase } from "../../../lib/supabaseClient";
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

// Import extracted modules
import {
  FEED_CONFIG,
  getDynamicLimit,
  haversineDistance,
  getDistanceScore,
  calculateHybridScore,
  cachedProcessFeedItem
} from "@/lib/feedUtils";
import { useFeedCache } from "@/hooks/useFeedCache";
import { useBreakCardGenerator } from "@/hooks/useBreakCardGenerator";
import {
  SkeletonLoader,
  ErrorState,
  EmptyState,
  InvisibleLoading,
  EndOfFeed,
  PullToRefreshIndicator,
  ToastMessage
} from "@/app/components/feed/FeedStatusComponents";

// Lazy load heavy modals
const AIModal = React.lazy(() => import("../ai/AIModal"));
const KomentarModal = React.lazy(() => import("./KomentarModal"));
const SearchModal = React.lazy(() => import("./SearchModal"));

// ========== MAIN COMPONENT ==========
export default function FeedContent() {
  const router = useRouter();
  const { location, status, placeName, requestLocation, setManualLocation, activeMode } = useLocation();
  const { user, isAdmin, profile } = useAuth();
  const theme = useTheme();

  // ========== NETWORK STATE ==========
  const [networkInfo, setNetworkInfo] = useState({
    effectiveType: '4g',
    saveData: false,
    isSlowConnection: false
  });
  const [dynamicLimit, setDynamicLimitState] = useState(FEED_CONFIG.DEFAULT_LIMIT);

  // ========== FEED DATA STATE ==========
  const [itemsMap, setItemsMap] = useState(new Map());
  const [orderedIds, setOrderedIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [comments, setComments] = useState({});
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState({});
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState(null);
  const searchRadius = activeMode === 'general' ? 40 : FEED_CONFIG.DEFAULT_RADIUS;

  // ========== UI STATE ==========
  const [isScrolled, setIsScrolled] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "" });
  const [refreshing, setRefreshing] = useState(false);
  const [isTransitioningLocation, setIsTransitioningLocation] = useState(false);
  const [feedOpacity, setFeedOpacity] = useState(1);

  // ========== MODAL STATES ==========
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

  // ========== REFS ==========
  const fetchIdRef = useRef(0);
  const lastCardRef = useRef(null);
  const lastLocationCacheKeyRef = useRef(
    typeof window !== 'undefined' ? sessionStorage.getItem('last_location_key') : null
  );
  const abortControllerRef = useRef(null);
  const lastLoadedIdRef = useRef(null);
  const existingIdsRef = useRef(new Set());
  const initialLoadDoneRef = useRef(false);
  const isFetchingRef = useRef(false);
  const hasInitializedRef = useRef(false);

  // ========== CACHE ==========
  const cacheManager = useFeedCache(networkInfo.isSlowConnection);

  // ========== KENTONGAN STATE ==========
  const [kentonganForFeed, setKentonganForFeed] = useState([]);
  const [selectedKentongan, setSelectedKentongan] = useState(null);

  // ========== MEMOIZED VALUES ==========
  const locationReady = useMemo(() => status === "granted" && !!location?.latitude && !!location?.longitude, [status, location]);

  const { villageLocation, districtLocation } = useMemo(() => {
    if (!placeName) return { villageLocation: "Pilih Lokasi", districtLocation: "" };
    const parts = placeName.split(",").map(p => p.trim());
    return { villageLocation: parts[0] || "Lokasi", districtLocation: parts[1] || "" };
  }, [placeName]);

  const tempat = useMemo(() => orderedIds.map(id => itemsMap.get(id)).filter(Boolean), [orderedIds, itemsMap]);

  // ========== BREAK CARDS ==========
  const { generateBreakCard, openAIModalWithKentongan } = useBreakCardGenerator({
    kentonganForFeed,
    onOpenAIModal: (kentongan) => {
      setSelectedTempat(null);
      setSelectedKentongan(kentongan);
      setAiContext("kentongan");
      setShowAIModal(true);
    },
    onOpenLaporanForm: () => setShowFormLaporan(true)
  });

  // ========== GABUNGKAN FEED CARD DAN BREAK CARD ==========
  const feedItemsWithBreaks = useMemo(() => {
    if (!tempat.length) return [];

    const itemsToProcess = tempat.slice(0, FEED_CONFIG.LIMIT_VISIBLE);
    const remainingItems = tempat.slice(FEED_CONFIG.LIMIT_VISIBLE);
    const result = [];
    let cardsSinceLastBreak = 0;

    for (let i = 0; i < itemsToProcess.length; i++) {
      result.push(itemsToProcess[i]);
      cardsSinceLastBreak++;

      const shouldAddBreak = (() => {
        if (cardsSinceLastBreak < FEED_CONFIG.MIN_CARDS_BEFORE_BREAK) return false;
        if (cardsSinceLastBreak >= FEED_CONFIG.MAX_CARDS_BEFORE_BREAK) return true;

        const recentPlaces = itemsToProcess.slice(Math.max(0, i - 2), i + 1);
        const hasViral = recentPlaces.some(p => p.isViral === true);
        const hasManyReports = recentPlaces.some(p => (p.laporan_terbaru?.length || 0) > 3);

        let hasStatusChange = false;
        if (recentPlaces.length >= 2) {
          const statuses = recentPlaces.map(p => p.isRamai ? "ramai" : (p.isViral ? "viral" : "normal"));
          hasStatusChange = statuses[0] !== statuses[statuses.length - 1];
        }

        return (hasViral || hasManyReports || hasStatusChange) || cardsSinceLastBreak >= 4;
      })();

      if (shouldAddBreak && i !== itemsToProcess.length - 1) {
        const breakCard = generateBreakCard(i + 1, itemsToProcess.slice(0, i + 1), itemsToProcess);
        if (breakCard) {
          result.push({
            _isBreak: true,
            id: `break-${i}-${Date.now()}`,
            type: breakCard.type,
            level: breakCard.level,
            data: breakCard.data,
            onClick: breakCard.onClick,
          });
        }
        cardsSinceLastBreak = 0;
      }
    }

    return [...result, ...remainingItems];
  }, [tempat, generateBreakCard]);

  // ========== GET CACHE KEY ==========
  const getCacheKey = useCallback(() => {
    if (!locationReady || !location) return 'feed_default';
    const lat = Math.round(location.latitude * 10) / 10;
    const lng = Math.round(location.longitude * 10) / 10;
    return `feed_v2_${lat}_${lng}_${searchRadius}`;
  }, [locationReady, location, searchRadius]);

  // ========== PRELOAD GAMBAR ==========
  const preloadImages = useCallback((items) => {
    const firstThreeIds = items.slice(0, 3);
    firstThreeIds.forEach(id => {
      const item = itemsMap.get(id);
      if (item?.photos?.[0]) {
        const img = new Image();
        img.src = item.photos[0];
      }
    });
  }, [itemsMap]);

  // ========== SHOW TOAST HELPER ==========
  const showToast = useCallback((message) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: "" }), FEED_CONFIG.TOAST_DURATION);
  }, []);

  // ========== LOAD PLACES (CORE LOGIC) ==========
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
      lastLoadedIdRef.current = null;
      existingIdsRef.current.clear();

      if (isLocationChange) {
        setIsTransitioningLocation(true);
      }
    }

    setLoading(true);

    try {
      const cacheKey = getCacheKey();

      if (reset && !isLocationChange) {
        const cached = cacheManager.get(cacheKey);
        if (cached && cached.orderedIds && cached.orderedIds.length > 0) {
          setItemsMap(cached.itemsMap);
          setOrderedIds(cached.orderedIds);
          setInitialLoad(false);
          setLoading(false);
          if (cached.orderedIds.length > 0) {
            lastLoadedIdRef.current = cached.orderedIds[cached.orderedIds.length - 1];
          }
          preloadImages(cached.orderedIds);
          isFetchingRef.current = false;
          return;
        }
      }

      let query = supabase
        .from("feed_view")
        .select("id, name, latitude, longitude, created_at, photos, laporan_terbaru, alamat, category, vibe_count, latest_condition, latest_estimated_people, latest_estimated_wait_time")
        .order("created_at", { ascending: false });

      if (locationReady && location) {
        const lat = location.latitude;
        const lng = location.longitude;
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

      const { data, error: fetchError } = await query.limit(dynamicLimit * (networkInfo.isSlowConnection ? 1 : 2));
      if (fetchError) throw fetchError;
      if (currentFetchId !== fetchIdRef.current) return;

      let items = data || [];

      const processedItems = [];
      const userLocation = locationReady && location ? {
        latitude: location.latitude,
        longitude: location.longitude
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

        const processedItem = cachedProcessFeedItem(item, !!userLocation, userLocation);
        const hybridScoreData = calculateHybridScore(processedItem, userLocation);

        processedItems.push({
          ...processedItem,
          _distance: distance,
          _distanceScore: hybridScoreData.distanceScore,
          _rankingScore: hybridScoreData.rankingScore,
          _hybridScore: hybridScoreData.hybridScore
        });
      }

      if (processedItems.length === 0 && !reset) {
        setHasMore(false);
        setLoading(false);
        setInitialLoad(false);
        isFetchingRef.current = false;
        return;
      }

      processedItems.sort((a, b) => b._hybridScore - a._hybridScore);

      setItemsMap(prevMap => {
        const newMap = new Map(reset ? [] : prevMap.entries());
        for (const item of processedItems) {
          if (!newMap.has(item.id)) {
            newMap.set(item.id, item);
            existingIdsRef.current.add(item.id);
          }
        }
        return newMap;
      });

      setOrderedIds(prevIds => {
        let newIds = reset ? [] : [...prevIds];
        for (const item of processedItems) {
          if (!newIds.includes(item.id)) {
            newIds.push(item.id);
          }
        }
        newIds.sort((a, b) => {
          const scoreA = processedItems.find(i => i.id === a)?._hybridScore || 0;
          const scoreB = processedItems.find(i => i.id === b)?._hybridScore || 0;
          return scoreB - scoreA;
        });
        return newIds;
      });

      setComments(prevComments => {
        const newComments = { ...prevComments };
        for (const item of processedItems) {
          if (!newComments[item.id]) {
            newComments[item.id] = item.testimonial_terbaru || [];
          }
        }
        return newComments;
      });

      if (processedItems.length > 0) {
        lastLoadedIdRef.current = processedItems[processedItems.length - 1].id;
      }

      setHasMore(processedItems.length === dynamicLimit * (networkInfo.isSlowConnection ? 1 : 2));

      if (reset && processedItems.length > 0) {
        const finalMap = new Map();
        const finalIds = [];
        for (const item of processedItems) {
          finalMap.set(item.id, item);
          finalIds.push(item.id);
        }
        cacheManager.set(cacheKey, finalMap, finalIds);
        preloadImages(finalIds);

        if (isLocationChange) {
          setFeedOpacity(1);
          setIsTransitioningLocation(false);
        }

        if (locationReady) {
          const connectionText = networkInfo.isSlowConnection ? " (mode hemat data)" : "";
          showToast(`📍 ${processedItems.length} tempat dalam radius ${searchRadius}km${connectionText}`);
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
        isFetchingRef.current = false;
      }
    }
  }, [locationReady, location, searchRadius, dynamicLimit, networkInfo.isSlowConnection, getCacheKey, cacheManager, preloadImages, showToast]);

  // ========== PREFETCH NEXT PAGE ==========
  const prefetchNextPage = useCallback(async () => {
    if (!hasMore || loading || !lastLoadedIdRef.current) return;
    try {
      await supabase
        .from("feed_view")
        .select("id")
        .lt('id', lastLoadedIdRef.current)
        .limit(dynamicLimit);
    } catch (err) {
      // Silent ignore
    }
  }, [hasMore, loading, dynamicLimit]);

  // ========== RESET FEED ==========
  const resetFeed = useCallback((soft = false) => {
    if (soft) {
      setHasMore(true);
      setInitialLoad(false);
      setError(null);
    } else {
      setOrderedIds([]);
      setItemsMap(new Map());
      setHasMore(true);
      setInitialLoad(true);
      setError(null);
      lastLoadedIdRef.current = null;
      existingIdsRef.current.clear();
    }
  }, []);

  // ========== NETWORK INFO EFFECT ==========
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.connection) return;

    const updateNetworkInfo = () => {
      const conn = navigator.connection;
      const effectiveType = conn?.effectiveType || '4g';
      const saveData = conn?.saveData || false;
      const isSlowConnection = saveData || effectiveType === 'slow-2g' || effectiveType === '2g';

      setNetworkInfo({ effectiveType, saveData, isSlowConnection });
      setDynamicLimitState(getDynamicLimit());
    };

    updateNetworkInfo();
    navigator.connection.addEventListener('change', updateNetworkInfo);
    return () => navigator.connection.removeEventListener('change', updateNetworkInfo);
  }, []);

  // ========== POLLING FOR NEW CONTENT ==========
  useEffect(() => {
    let pollInterval = null;
    let lastKnownFirstId = orderedIds[0];

    const checkForNewContent = async () => {
      if (!locationReady || !hasMore || loading || !lastKnownFirstId) return;

      try {
        const { data } = await supabase
          .from("feed_view")
          .select("id")
          .gt('id', lastKnownFirstId)
          .limit(1)
          .single();

        if (data) {
          loadPlaces(true, false);
        }

        if (orderedIds[0] && orderedIds[0] !== lastKnownFirstId) {
          lastKnownFirstId = orderedIds[0];
        }
      } catch (err) {
        // Silent ignore
      }
    };

    pollInterval = setInterval(checkForNewContent, FEED_CONFIG.POLLING_INTERVAL_MS);
    return () => { if (pollInterval) clearInterval(pollInterval); };
  }, [locationReady, hasMore, loading, loadPlaces, orderedIds[0]]);

  // ========== INFINITE SCROLL OBSERVER ==========
  useEffect(() => {
    if (!lastCardRef.current || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          setTimeout(() => {
            loadPlaces(false);
            setTimeout(() => prefetchNextPage(), 100);
          }, 100);
        }
      },
      { threshold: FEED_CONFIG.INTERSECTION_THRESHOLD, rootMargin: FEED_CONFIG.INTERSECTION_ROOT_MARGIN }
    );

    observer.observe(lastCardRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, loadPlaces, feedItemsWithBreaks.length, prefetchNextPage]);

  // ========== PULL TO REFRESH ==========
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
      if (pullDistance > 60 && !refreshing) setRefreshing(true);
    };

    const handleTouchEnd = () => {
      if (refreshing && !loading) {
        cacheManager.invalidate();
        loadPlaces(true);
        setTimeout(() => setRefreshing(false), FEED_CONFIG.REFRESH_RESET_DELAY);
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

  // ========== RESTORE FROM SESSION STORAGE ==========
  useEffect(() => {
    if (hasInitializedRef.current) return;

    const backup = sessionStorage.getItem('feed_backup');
    if (backup && !initialLoadDoneRef.current) {
      try {
        const data = JSON.parse(backup);
        const isFresh = (Date.now() - data.timestamp) < FEED_CONFIG.SESSION_CACHE_DURATION;

        if (data.orderedIds?.length > 0 && isFresh && data.version === '2.0') {
          const maxRestore = Math.min(data.orderedIds.length, FEED_CONFIG.SESSION_CACHE_MAX_ITEMS);
          const limitedIds = data.orderedIds.slice(0, maxRestore);
          const limitedMap = new Map(data.itemsMap.slice(0, maxRestore));

          setItemsMap(limitedMap);
          setOrderedIds(limitedIds);
          setInitialLoad(false);
          setLoading(false);
          initialLoadDoneRef.current = true;
          hasInitializedRef.current = true;
          preloadImages(limitedIds);
          return;
        } else if (data.version !== '2.0') {
          sessionStorage.removeItem('feed_backup');
        }
      } catch (e) {
        sessionStorage.removeItem('feed_backup');
      }
    }

    if (!initialLoadDoneRef.current) {
      initialLoadDoneRef.current = true;
      hasInitializedRef.current = true;
      loadPlaces(true, false);
    }
  }, [preloadImages, loadPlaces]);

  // ========== LOCATION CHANGE EFFECT ==========
  useEffect(() => {
    if (!initialLoadDoneRef.current) return;
    if (!locationReady) return;

    const currentCacheKey = getCacheKey();
    if (lastLocationCacheKeyRef.current === currentCacheKey) return;

    lastLocationCacheKeyRef.current = currentCacheKey;
    sessionStorage.setItem('last_location_key', currentCacheKey);

    cacheManager.invalidate();
    sessionStorage.removeItem('feed_backup');
    loadPlaces(true, true);
    showToast(`📍 Feed diperbarui untuk lokasi: ${villageLocation}`);
  }, [getCacheKey, locationReady, cacheManager, villageLocation, loadPlaces, showToast]);

  // ========== FETCH KENTONGAN ==========
  useEffect(() => {
    const fetchKentongan = async () => {
      if (!user?.id) return;
      const { getKentonganForFeed } = await import("@/lib/kentongan");
      const data = await getKentonganForFeed(user.id);
      setKentonganForFeed(data);
    };
    fetchKentongan();
  }, [user?.id]);

  // ========== HANDLERS ==========
  const handleLocationChanged = useCallback(async () => {
    setIsTransitioningLocation(true);
    setFeedOpacity(0.7);
    cacheManager.invalidate();
    sessionStorage.removeItem('feed_backup');
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
    showToast(`📍 Feed diperbarui untuk ${locationName}`);
  }, [setManualLocation, handleLocationChanged, showToast]);

  const handleGPSActivation = useCallback(async (mode = 'gps') => {
    await requestLocation(mode);
    await handleLocationChanged();
    showToast(`📍 Feed diperbarui untuk lokasi GPS: ${villageLocation}`);
  }, [requestLocation, handleLocationChanged, villageLocation, showToast]);

  const handleRadiusChange = useCallback((newRadius) => {
    cacheManager.invalidate();
    loadPlaces(true);
    showToast(`🔍 Radius ${newRadius}km`);
  }, [cacheManager, loadPlaces, showToast]);

  const handleSearchSelect = useCallback((item) => {
    if (!item) return;
    setShowSearchModal(false);
    setItemsMap(prev => {
      const newMap = new Map(prev);
      newMap.set(item.id, item);
      return newMap;
    });
    setOrderedIds(prev => [item.id, ...prev.filter(id => id !== item.id)]);
    setSelectedTempat(item);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast(`📍 Menampilkan ${item.name}`);
  }, [showToast]);

  const openAICardModal = useCallback((item, onUploadSuccess, initialQueryText = "") => {
    setSelectedTempat(item);
    setSelectedLaporanWarga(item?.laporan_terbaru || []);
    setSelectedUploadSuccess(() => onUploadSuccess);
    setInitialQuery(initialQueryText);
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
      if (navigator.share) {
        await navigator.share({ title: item.name, text: `📍 Cek kondisi terkini di ${item.name}!`, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        showToast("✅ Link disalin!");
      }
    } catch (_) { }
  }, [showToast]);

  const retryLoad = useCallback(() => {
    setError(null);
    cacheManager.invalidate();
    loadPlaces(true);
  }, [loadPlaces, cacheManager]);

  const handleExpandRadius = useCallback(() => {
    handleRadiusChange(searchRadius + 5);
  }, [handleRadiusChange, searchRadius]);

  // ========== GET USER AUTH ==========
  useEffect(() => {
    let isMounted = true;
    const getUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const authUser = session?.user;
        if (authUser && isMounted) {
          setUserId(authUser.id);
          const { data: profileData } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', authUser.id)
            .maybeSingle();
          setUserRole(profileData?.role || 'warga');
        }
      } catch (err) {
        console.warn("Auth error:", err.message);
      }
    };
    getUser();
    return () => { isMounted = false; };
  }, []);

  // ========== RENDER ==========
  return (
    <main className="relative min-h-screen mx-auto w-full max-w-[420px] bg-transparent">
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

      <LaporanWarga
        tempat={tempat}
        locationReady={locationReady}
        displayLocation={villageLocation}
        location={location}
        forceShow={forceShowLaporan}
        onHide={() => setForceShowLaporan(false)}
      />

      <FormLaporanAktif
        isOpen={showFormLaporan}
        onClose={() => setShowFormLaporan(false)}
        villageLocation={villageLocation}
        theme={theme}
        user={user}
      />

      <LocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        onActivateGPS={handleGPSActivation}
        onSelectManual={handleManualLocationSelect}
        onLocationChanged={handleLocationChanged}
        customLocationName={placeName}
      />

      <motion.div
        className="pt-[72px] space-y-2 min-h-[60vh] relative"
        animate={{ opacity: feedOpacity }}
        transition={{ duration: FEED_CONFIG.LOCATION_TRANSITION_DELAY / 1000 }}
      >
        {initialLoad ? (
          <SkeletonLoader />
        ) : error ? (
          <ErrorState error={error} onRetry={retryLoad} />
        ) : feedItemsWithBreaks.length === 0 ? (
          <EmptyState radius={searchRadius} locationName={villageLocation} onExpandRadius={handleExpandRadius} />
        ) : (
          <Suspense fallback={<SkeletonLoader />}>
            <motion.div layout className="space-y-2">
              <AnimatePresence initial={false}>
                {feedItemsWithBreaks.map((item, index) => {
                  if (item._isBreak) {
                    return (
                      <BreakCard
                        key={item.id}
                        type={item.type}
                        data={item.data}
                        theme={theme}
                        level={item.level}
                        onClick={item.onClick}
                      />
                    );
                  }

                  const isLast = index === feedItemsWithBreaks.length - 1;
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
                          userId={user?.id}
                          userProfile={profile}
                          userAvatar={profile?.avatar_url}
                          showLiveInsight={false}
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-50"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="relative h-8 w-8 border-2 border-white/20 border-t-[#E3655B] border-b-[#25F4EE] rounded-full animate-spin" style={{ animationDuration: '0.35s' }}></div>
              <p className="text-white/70 text-xs font-medium">Mengupdate lokasi...</p>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* MODALS */}
      <Suspense fallback={null}>
        <SearchModal
          isOpen={showSearchModal}
          onClose={() => setShowSearchModal(false)}
          onSelectTempat={handleSearchSelect}
          onOpenAIModal={handleSearchWithQuery}
          allData={tempat}
          theme={theme}
          villageLocation={villageLocation}
        />
      </Suspense>

      <Suspense fallback={null}>
        <AIModal
          isOpen={showAIModal}
          onClose={closeModals}
          tempat={selectedTempat}
          kentongan={selectedKentongan}
          context={aiContext}
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
          onUploadSuccess={selectedUploadSuccess}
          initialQuery={initialQuery}
          item={selectedTempat}
          laporanWarga={selectedLaporanWarga}
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

      <SmartBottomNav
        onOpenUpload={() => setShowUploadModal(true)}
        onOpenLaporanForm={() => setShowFormLaporan(true)}
        onOpenNotification={() => router.push("/woro")}
        onOpenProfile={() => router.push("/rewang")}
      />

      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        userId={userId}
        userRole={userRole}
      />

      <ToastMessage show={toast.show} message={toast.message} />
    </main>
  );
}