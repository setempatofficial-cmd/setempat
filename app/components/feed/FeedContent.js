"use client";

import * as React from "react";
import { useEffect, useState, useCallback, useRef, useMemo, lazy, Suspense, memo } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
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


// Lazy load heavy modals
const AIModal = React.lazy(() => import("../ai/AIModal"));
const KomentarModal = React.lazy(() => import("./KomentarModal"));
const SearchModal = React.lazy(() => import("./SearchModal"));

// Constants
const CACHE_DURATION = 30 * 60 * 1000;
const DEFAULT_RADIUS = 10;
const LOCATION_TRANSITION_DELAY = 300;
const RANKING_WEIGHT = 0.7;
const DISTANCE_WEIGHT = 0.3;
const SESSION_CACHE_KEY = 'feed_backup';  // TAMBAHKAN INI
const SESSION_CACHE_DURATION = 30 * 60 * 1000; 

// Helper Functions
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
  
  return { hybridScore, rankingScore, distanceScore, distance };
};

// Global cache untuk processFeedItem
if (typeof window !== 'undefined' && !window.__feedItemCache) {
  window.__feedItemCache = new Map();
  window.__feedItemCacheMaxSize = 150;
}

const cachedProcessFeedItem = (item, locationReady, location) => {
  if (typeof window === 'undefined') return processFeedItem({ item, locationReady, location, comments: {} });
  
  const cacheKey = `${item.id}_${locationReady}_${location?.latitude || 0}_${location?.longitude || 0}`;
  
  if (window.__feedItemCache.has(cacheKey)) {
    return window.__feedItemCache.get(cacheKey);
  }
  
  const result = processFeedItem({ item, locationReady, location, comments: {} });
  
  if (window.__feedItemCache.size > window.__feedItemCacheMaxSize) {
    const firstKey = window.__feedItemCache.keys().next().value;
    window.__feedItemCache.delete(firstKey);
  }
  
  window.__feedItemCache.set(cacheKey, result);
  return result;
};

// Memoized Components - OPTIMIZED (tanpa animate-pulse)
const SkeletonLoader = memo(() => (
  <div className="space-y-6 px-4">
    {[1, 2, 3].map(i => (
      <div key={i} className="h-[400px] w-full rounded-[40px] bg-white/5 border border-white/5" />
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
      <motion.div 
        initial={{ y: -60, opacity: 0 }} 
        animate={{ y: 0, opacity: 1 }} 
        exit={{ y: -60, opacity: 0 }} 
        className="fixed top-0 left-0 right-0 bg-black/80 backdrop-blur-md py-3 text-center text-white/70 text-sm z-50 shadow-lg"
      >
        <div className="flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <span>Refresh Kondisi Setempat ...</span>
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

// Main Component
export default function FeedContent() {
  const router = useRouter();
  const { location, status, placeName, requestLocation, setManualLocation } = useLocation();
  const { user, isAdmin } = useAuth();
  const theme = useTheme();

  // ========== NETWORK STATE ==========
  const [networkInfo, setNetworkInfo] = useState({
    effectiveType: '4g',
    saveData: false,
    isSlowConnection: false
  });
  const [dynamicLimit, setDynamicLimit] = useState(() => getDynamicLimit());
  const [useRealtime, setUseRealtime] = useState(true);

  // ========== FEED DATA STATE ==========
  const [itemsMap, setItemsMap] = useState(new Map());
  const [orderedIds, setOrderedIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [comments, setComments] = useState({});
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState({});
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState(null);
  const [searchRadius, setSearchRadius] = useState(DEFAULT_RADIUS);
  
  // ========== UI STATE ==========
  const [isScrolled, setIsScrolled] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "" });
  const [refreshing, setRefreshing] = useState(false);
  const [isTransitioningLocation, setIsTransitioningLocation] = useState(false);
  const [feedOpacity, setFeedOpacity] = useState(1);
  const [isActivatingLocation, setIsActivatingLocation] = useState(false);

  // ========== DETEKSI ARAH SCROLL ==========
 const [scrollDirection, setScrollDirection] = useState('down');  

  // ========== BREAK CARD STATE ==========
  const previousConditionsRef = useRef({});
  const lastBreakTimeRef = useRef(Date.now());
  const [kentonganForFeed, setKentonganForFeed] = useState([]);

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

  // ========== MEMOIZED VALUES ==========
  const locationReady = useMemo(() => status === "granted" && !!location?.latitude && !!location?.longitude, [status, location]);
  const { villageLocation, districtLocation } = useMemo(() => {
    if (!placeName) return { villageLocation: "Pilih Lokasi", districtLocation: "" };
    const parts = placeName.split(",").map(p => p.trim());
    return { villageLocation: parts[0] || "Lokasi", districtLocation: parts[1] || "" };
  }, [placeName]);
  const isMalam = useMemo(() => getGreeting().text === "Malam", []);
  const tempat = useMemo(() => orderedIds.map(id => itemsMap.get(id)).filter(Boolean), [orderedIds, itemsMap]);

  // ========== STATE UNTUK KENTONGAN DI AI MODAL ==========
  const [selectedKentongan, setSelectedKentongan] = useState(null);

    // ========== SESSION STORAGE BACKUP (AGAR TIDAK LOAD ULANG SAAT BACK) ==========
  // SAVE ke sessionStorage setiap kali data feed berubah
  useEffect(() => {
    if (orderedIds.length > 0 && itemsMap.size > 0 && !initialLoad) {
      try {
        const itemsArray = Array.from(itemsMap.entries());
        const backupData = {
          itemsMap: itemsArray,
          orderedIds: orderedIds,
          searchRadius: searchRadius,
          timestamp: Date.now(),
          version: '1.0'
        };
        sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(backupData));
        console.log(`💾 Feed backup saved: ${orderedIds.length} items`);
      } catch (e) {
        console.warn('Failed to save feed backup:', e);
      }
    }
  }, [itemsMap, orderedIds, searchRadius, initialLoad]);

  // ========== FUNGSI UNTUK BUKA AI MODAL DENGAN KENTONGAN ==========
  const openAIModalWithKentongan = useCallback((kentongan) => {
    setSelectedTempat(null);
    setSelectedKentongan(kentongan);
    setAiContext("kentongan");
    setShowAIModal(true);
  }, []);

  // ========== FETCH KENTONGAN UNTUK FEED ==========
  const fetchKentonganForFeed = useCallback(async () => {
    if (!user?.id) return;
    const data = await getKentonganForFeed(user.id);
    setKentonganForFeed(data);
  }, [user?.id]);


  // ========== BREAK CARD GENERATOR ==========
  const generateBreakCard = useCallback((scrollIndex, displayedPlaces, allPlaces) => {
    const urgentKentongan = kentonganForFeed.filter(k => k.is_urgent === true);
    if (urgentKentongan.length > 0 && scrollIndex >= 1) {
      const k = urgentKentongan[0];
      return {
        type: "kentongan",
        level: "A",
        data: {
          text: `🚨 ${k.title}`,
          is_urgent: true,
          target_desa: k.target_desa,
          is_global: k.is_global,
          content: k.content,
        },
        onClick: () => openAIModalWithKentongan(k),
      };
    }
    
    if (kentonganForFeed.length > 0 && scrollIndex >= 2) {
      const k = kentonganForFeed[0];
      return {
        type: "kentongan",
        level: "B",
        data: {
          text: k.title,
          is_urgent: false,
          target_desa: k.target_desa,
          is_global: k.is_global,
          content: k.content,
        },
        onClick: () => openAIModalWithKentongan(k),
      };
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentReports = allPlaces.reduce((acc, p) => {
      const reports = (p.laporan_terbaru || []).filter(l => new Date(l.created_at) > oneHourAgo);
      return acc + reports.length;
    }, 0);
    
    if (recentReports > 5) {
      return {
        type: "statistic",
        level: "B",
        data: { text: `👥 Banyak laporan masuk dalam 1 jam terakhir (${recentReports} laporan)` },
      };
    }

    let hasSignificantChange = false;
    let changeText = "";
    for (const place of displayedPlaces) {
      const prev = previousConditionsRef.current[place.id];
      const curr = place.isRamai ? "ramai" : (place.isViral ? "viral" : "normal");
      if (prev === "sepi" && curr === "ramai") {
        hasSignificantChange = true;
        changeText = `🔥 Aktivitas mulai meningkat di ${place.name}`;
        break;
      }
      previousConditionsRef.current[place.id] = curr;
    }
    
    if (hasSignificantChange) {
      return {
        type: "area-summary",
        level: "B",
        data: { text: changeText },
      };
    }

    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const silentPlaces = displayedPlaces.filter(p => {
      const latest = p.laporan_terbaru?.[0];
      return !latest || new Date(latest.created_at) < threeHoursAgo;
    });
    
    if (silentPlaces.length > 2) {
      return {
        type: "trigger-action",
        level: "A",
        data: { text: "😶 Belum ada update terbaru di sekitar, kamu bisa jadi yang pertama" },
        onClick: () => setShowFormLaporan(true),
      };
    }

    if (scrollIndex >= 8) {
      return {
        type: "heatmap-text",
        level: "B",
        data: { text: "📍 Kamu sudah melihat beberapa lokasi, cek area lain?" },
      };
    }

    const now = Date.now();
    if (now - lastBreakTimeRef.current > 15 * 60 * 1000) {
      lastBreakTimeRef.current = now;
      const hours = new Date().getHours();
      const minutes = new Date().getMinutes();
      return {
        type: "time-divider",
        level: "C",
        data: { label: `Update ${hours}:${minutes.toString().padStart(2, '0')}` },
      };
    }

    const totalLaporanHariIni = allPlaces.reduce((acc, p) => {
      const todayReports = (p.laporan_terbaru || []).filter(l => {
        const lDate = new Date(l.created_at);
        return lDate.toDateString() === new Date().toDateString();
      }).length;
      return acc + todayReports;
    }, 0);
    
    return {
      type: "statistic",
      level: "B",
      data: { text: `📊 ${allPlaces.length} lokasi aktif · ${totalLaporanHariIni} laporan hari ini` },
    };
  }, [kentonganForFeed, openAIModalWithKentongan]); 

  // ========== GABUNGKAN FEED CARD DAN BREAK CARD (OPTIMIZED) ==========
const feedItemsWithBreaks = useMemo(() => {
  if (!tempat.length) return [];
  
  // 1. Batasi hanya 50 item pertama yang disisipi Break Card
  const limit = 50;
  const itemsToProcess = tempat.slice(0, limit);
  const remainingItems = tempat.slice(limit);
  
  const result = [];
  let cardsSinceLastBreak = 0;
  
  // 2. Loop hanya pada itemsToProcess
  for (let i = 0; i < itemsToProcess.length; i++) {
    result.push(itemsToProcess[i]);
    cardsSinceLastBreak++;
    
    const shouldAddBreak = (() => {
      if (cardsSinceLastBreak < 2) return false;
      if (cardsSinceLastBreak >= 5) return true;
      
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
  
  // 3. Gabungkan langsung sisanya tanpa proses logika tambahan
  return [...result, ...remainingItems];

}, [tempat, generateBreakCard]);

  // ========== CACHE MANAGER ==========
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
        if (!parsed || !parsed.ids) return null;
        const cacheDuration = networkInfo.isSlowConnection ? CACHE_DURATION * 2 : CACHE_DURATION;
        if (Date.now() - parsed.timestamp > cacheDuration) return null;
        const itemsMapRestored = new Map(parsed.items);
        return { itemsMap: itemsMapRestored, orderedIds: parsed.ids };
      } catch { return null; }
    },
    set: (key, itemsMap, orderedIds) => {
      try {
        if (!orderedIds || orderedIds.length === 0) return;
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
      keys.forEach(key => { if (key.startsWith('feed_v2_')) localStorage.removeItem(key); });
    }
  }), [networkInfo.isSlowConnection]);

  // ========== RESET FEED ==========
const resetFeed = useCallback((soft = false) => {
  if (soft) {
    // Soft reset: hanya clear flag, data tetap ada
    setHasMore(true);
    setInitialLoad(false);
    setError(null);
  } else {
    // Hard reset: bersihkan semua (hanya untuk ganti lokasi)
    setOrderedIds([]);
    setItemsMap(new Map());
    setHasMore(true);
    setInitialLoad(true);
    setError(null);
    lastLoadedIdRef.current = null;
    existingIdsRef.current.clear();
  }
}, []);

  // ========== LOAD PLACES ==========
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
        setFeedOpacity(0.5);
        await new Promise(resolve => setTimeout(resolve, LOCATION_TRANSITION_DELAY / 2));
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
		
		try {
          const itemsArray = Array.from(finalMap.entries());
          sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify({
            itemsMap: itemsArray,
            orderedIds: finalIds,
            searchRadius: searchRadius,
            timestamp: Date.now(),
            version: '1.0'
          }));
          console.log(`💾 Fresh feed saved to sessionStorage: ${finalIds.length} items`);
        } catch (e) {
          console.warn('Failed to save to sessionStorage:', e);
        }

        if (isLocationChange) {
          setFeedOpacity(1);
          setIsTransitioningLocation(false);
        }

        if (locationReady) {
          const connectionText = networkInfo.isSlowConnection ? " (mode hemat data)" : "";
          setToast({ 
            show: true, 
            message: `📍 ${processedItems.length} tempat dalam radius ${searchRadius}km${connectionText}` 
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
        isFetchingRef.current = false;
      }
    }
  }, [locationReady, location, searchRadius, dynamicLimit, networkInfo.isSlowConnection, getCacheKey, cacheManager]);

  // ========== EFFECTS ==========

useEffect(() => {
  let isMounted = true;
  
  const getUser = async () => {
    try {
      // Ganti dari getUser() ke getSession()
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.warn("Session error:", error.message);
        return;
      }
      
      const authUser = session?.user;
      
      if (authUser && isMounted) {
        setUserId(authUser.id);
        
        // Gunakan maybeSingle() biar tidak error jika profile tidak ada
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', authUser.id)
          .maybeSingle(); // ✅ Ganti .single() dengan .maybeSingle()
        
        if (!profileError && profile) {
          setUserRole(profile?.role || 'warga');
        } else {
          setUserRole('warga'); // Default role
        }
      }
    } catch (err) {
      console.warn("Auth error:", err.message);
    }
  };
  
  getUser();
  
  return () => {
    isMounted = false;
  };
}, []);


 useEffect(() => {
    let lastScrollY = window.scrollY;
    
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY) {
        setScrollDirection('down');
      } else if (currentScrollY < lastScrollY) {
        setScrollDirection('up');
      }
      lastScrollY = currentScrollY;
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // ========== DETEKSI LOKASI MATI/DINONAKTIFKAN ==========
useEffect(() => {
  const hadLocation = lastLocationCacheKeyRef.current !== null && 
                      lastLocationCacheKeyRef.current !== 'feed_default';
  
  if (hadLocation && !locationReady) {
    console.log('📍 Lokasi dinonaktifkan - membersihkan cache dan reset feed');
    
    setIsActivatingLocation(true);
    
    cacheManager.invalidate();
    sessionStorage.removeItem(SESSION_CACHE_KEY);
    sessionStorage.removeItem('last_location_key');
    
    setOrderedIds([]);
    setItemsMap(new Map());
    setSearchRadius(DEFAULT_RADIUS);
    setInitialLoad(true);
    setHasMore(true);
    setError(null);
    
    lastLoadedIdRef.current = null;
    existingIdsRef.current.clear();
    lastLocationCacheKeyRef.current = 'feed_default';
    
    loadPlaces(true, false).finally(() => {
      setIsActivatingLocation(false);
    });
    
    setToast({ 
      show: true, 
      message: "📍 Lokasi dinonaktifkan - menampilkan semua tempat" 
    });
    setTimeout(() => setToast({ show: false, message: "" }), 2000);
  }
  
}, [locationReady, cacheManager]); 

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.connection) return;
    
    const updateNetworkInfo = () => {
      const conn = navigator.connection;
      const effectiveType = conn?.effectiveType || '4g';
      const saveData = conn?.saveData || false;
      const isSlowConnection = saveData || effectiveType === 'slow-2g' || effectiveType === '2g';
      
      setNetworkInfo({ effectiveType, saveData, isSlowConnection });
      setDynamicLimit(getDynamicLimit());
      setUseRealtime(!isSlowConnection && !saveData);
    };
    
    updateNetworkInfo();
    navigator.connection.addEventListener('change', updateNetworkInfo);
    
    return () => navigator.connection.removeEventListener('change', updateNetworkInfo);
  }, []);

  // Polling for slow connections
  const pollForUpdates = useCallback(() => {
    if (!locationReady || !hasMore) return () => {};
    
    let interval = null;
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
          loadPlaces(true);
          setToast({ show: true, message: "📢 Ada konten baru! Feed diperbarui." });
          setTimeout(() => setToast({ show: false, message: "" }), 2000);
        }
      } catch (err) {
        console.warn("Polling error:", err);
      }
    };
    
    interval = setInterval(checkNewContent, networkInfo.isSlowConnection ? 60000 : 30000);
    return () => clearInterval(interval);
  }, [orderedIds, loadPlaces, networkInfo.isSlowConnection, locationReady, hasMore]);

  // Realtime subscription
  useEffect(() => {
    if (!useRealtime) {
      const cleanup = pollForUpdates();
      return cleanup;
    }
    
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    const channel = supabase
      .channel('feed_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'feed_view' }, (payload) => {
        const newItem = payload.new;
        if (!newItem) return;

        const userLocation = locationReady && location ? {
          latitude: location.latitude,
          longitude: location.longitude
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

        if (inRadius) {
          setItemsMap(prevMap => {
            if (prevMap.has(newItem.id)) return prevMap;
            const processedItem = cachedProcessFeedItem(newItem, !!userLocation, userLocation);
            const hybridScoreData = calculateHybridScore(processedItem, userLocation);
            const finalItem = {
              ...processedItem,
              _distance: distance,
              _distanceScore: hybridScoreData.distanceScore,
              _rankingScore: hybridScoreData.rankingScore,
              _hybridScore: hybridScoreData.hybridScore
            };
            const newMap = new Map(prevMap);
            newMap.set(finalItem.id, finalItem);
            return newMap;
          });
          
          setOrderedIds(prevIds => {
            if (prevIds.includes(newItem.id)) return prevIds;
            return [...prevIds, newItem.id];
          });
          
          setComments(prev => ({ ...prev, [newItem.id]: [] }));
          setToast({ show: true, message: `📢 ${newItem.name} menambahkan update baru!` });
          setTimeout(() => setToast({ show: false, message: "" }), 2000);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [searchRadius, useRealtime, locationReady, location, pollForUpdates]);

  // Infinite scroll observer
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
  }, [hasMore, loading, loadPlaces, feedItemsWithBreaks.length]);

  // Pull to refresh
  
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
        loadPlaces(true);
        setTimeout(() => setRefreshing(false), 1000);
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

    // ========== RESTORE FROM SESSION STORAGE (INITIAL LOAD) ==========
useEffect(() => {
  const backup = sessionStorage.getItem(SESSION_CACHE_KEY);
  
  if (backup && !initialLoadDoneRef.current) {
    try {
      const data = JSON.parse(backup);
      const isFresh = (Date.now() - data.timestamp) < 30 * 60 * 1000;
      
      if (data.orderedIds?.length > 0 && isFresh) {
        setItemsMap(new Map(data.itemsMap));
        setOrderedIds(data.orderedIds);
        setInitialLoad(false);
        initialLoadDoneRef.current = true;
        console.log(`✅ Restored ${data.orderedIds.length} items from cache`);
        return;
      }
    } catch(e) {
      console.warn('Failed to restore cache:', e);
    }
  }
  
  if (!initialLoadDoneRef.current) {
    initialLoadDoneRef.current = true;
    loadPlaces(true, false);
  }
}, []);

 // RESPON PERUBAHAN LOKASI (AKTIF)
useEffect(() => {
  if (!initialLoadDoneRef.current) return;
  if (!locationReady) return;

  const currentCacheKey = getCacheKey();
  
  // ✅ TAMBAHKAN INI: Jika lastLocationCacheKeyRef masih null (baru mount), skip
  if (lastLocationCacheKeyRef.current === null) {
    lastLocationCacheKeyRef.current = currentCacheKey;
    sessionStorage.setItem('last_location_key', currentCacheKey);
    return; // ✅ LANGSUNG RETURN, TIDAK FETCH
  }
  
  if (lastLocationCacheKeyRef.current === currentCacheKey) return;

  console.log(`📍 Lokasi aktif/berubah: ${lastLocationCacheKeyRef.current} -> ${currentCacheKey}`);
  
  setIsActivatingLocation(true);
  lastLocationCacheKeyRef.current = currentCacheKey;
  
  sessionStorage.setItem('last_location_key', currentCacheKey);
  
  cacheManager.invalidate();
  sessionStorage.removeItem(SESSION_CACHE_KEY);
  
  loadPlaces(true, true).finally(() => {
    setIsActivatingLocation(false);
  });

  setToast({ show: true, message: `📍 Feed diperbarui untuk lokasi: ${villageLocation}` });
  setTimeout(() => setToast({ show: false, message: "" }), 3000);
  
}, [getCacheKey, locationReady, cacheManager, villageLocation]);

  // Fetch kentongan
  useEffect(() => {
    fetchKentonganForFeed();
  }, [fetchKentonganForFeed]);
	
  // ========== LISTENER UNTUK REFRESH DARI BOTTOM NAV ==========
useEffect(() => {
  const handleRefreshFeed = async () => {
    console.log('♻️ Refresh feed triggered from bottom nav');
    setIsActivatingLocation(true); // Tampilkan loading overlay
    
    try {
      cacheManager.invalidate();
      sessionStorage.removeItem(SESSION_CACHE_KEY);
      await loadPlaces(true, false);
      setToast({ show: true, message: "♻️ Kondisi Update!" });
      setTimeout(() => setToast({ show: false, message: "" }), 1500);
    } finally {
      setIsActivatingLocation(false);
    }
  };
  
  window.addEventListener('refresh-feed', handleRefreshFeed);
  
  return () => {
    window.removeEventListener('refresh-feed', handleRefreshFeed);
  };
}, [cacheManager, loadPlaces]);
  
  // ========== HANDLERS ==========
  const handleManualLocationSelect = useCallback(async (selectedLocation) => {
    console.log("📍 User pilih lokasi baru:", selectedLocation);
    setManualLocation(selectedLocation);
    cacheManager.invalidate();
	sessionStorage.removeItem(SESSION_CACHE_KEY);
    await resetFeed();
    setIsTransitioningLocation(true);
    setFeedOpacity(0.5);
    await new Promise(resolve => setTimeout(resolve, 200));
    await loadPlaces(true, true);
    const locationName = selectedLocation?.address || selectedLocation?.name || "lokasi baru";
    setToast({ show: true, message: `📍 Feed diperbarui untuk ${locationName}` });
    setTimeout(() => setToast({ show: false, message: "" }), 3000);
  }, [cacheManager, loadPlaces, setManualLocation, resetFeed]);

  const handleGPSActivation = useCallback(async () => {
    console.log("📍 Aktifkan GPS location...");
    await requestLocation();
    await new Promise(resolve => setTimeout(resolve, 800));
    cacheManager.invalidate();
	sessionStorage.removeItem(SESSION_CACHE_KEY);
    await resetFeed();
    setIsTransitioningLocation(true);
    setFeedOpacity(0.5);
    await loadPlaces(true, true);
    setToast({ show: true, message: `📍 Feed diperbarui untuk lokasi GPS: ${villageLocation}` });
    setTimeout(() => setToast({ show: false, message: "" }), 3000);
  }, [requestLocation, cacheManager, loadPlaces, villageLocation, resetFeed]);

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

  // ========== RENDER ==========
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
        locationReady={locationReady}
        isMalam={isMalam}
        onActivateGPS={handleGPSActivation}
        onSelectManual={handleManualLocationSelect}
      />

            <motion.div 
        className="mt-4 space-y-2 min-h-[60vh] relative" 
        animate={{ opacity: feedOpacity }} 
        transition={{ duration: LOCATION_TRANSITION_DELAY / 1000 }}
      >
        {initialLoad ? (
          <SkeletonLoader />
        ) : error ? (
          <ErrorState error={error} onRetry={retryLoad} />
        ) : feedItemsWithBreaks.length === 0 ? (
          <EmptyState radius={searchRadius} locationName={villageLocation} onExpandRadius={handleExpandRadius} />
        ) : (
          <Suspense fallback={<SkeletonLoader />}>
            <LayoutGroup>
              <motion.div layout className="space-y-2">
                <AnimatePresence mode="popLayout" initial={false}>
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
					const isNearby = index < 10;
					const isNearViewport = index < 15;
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
			    preloadNext={isNearby}
			    shouldRender={isNearViewport}
                          />
                        </FeedCardWrapper>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            </LayoutGroup>
          </Suspense>
        )}

        {loading && !initialLoad && !error && <LoadingMore />}
        {!hasMore && feedItemsWithBreaks.length > 0 && !error && <EndOfFeed />}

        {isTransitioningLocation && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm rounded-2xl z-40"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <p className="text-white/60 text-xs font-medium">Setempat Memperbarui lokasi baru...</p>
            </div>
          </motion.div>
        )}
      </motion.div>


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