"use client";

import * as React from "react";
import { useEffect, useState, useCallback, useRef, useDeferredValue, useMemo, lazy, Suspense } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import AuthModal from "@/app/components/auth/AuthModal";
import { useAuth } from "@/hooks/useAuth";
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

// ─ Lazy load heavy modals
const AIModal = React.lazy(() => import("./AIModal"));
const KomentarModal = React.lazy(() => import("./KomentarModal"));
const SearchModal = React.lazy(() => import("./SearchModal"));

const LIMIT = 10;
const CACHE_DURATION = 5 * 60 * 1000; // 5 menit
const DEFAULT_RADIUS = 10; // Radius default 10km
const LOCATION_TRANSITION_DELAY = 400; // Delay smooth transition (ms)

export default function FeedContent() {
  const { location, status, placeName, requestLocation, setManualLocation } = useLocation();
  const { user, isAdmin } = useAuth();
  const theme = useTheme();

  const [tempat, setTempat] = useState([]);
  const [page, setPage] = useState(0);
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
  const [searchRadius, setSearchRadius] = useState(DEFAULT_RADIUS); // Radius pencarian
  const [isTransitioningLocation, setIsTransitioningLocation] = useState(false); // Track location change
  const [feedOpacity, setFeedOpacity] = useState(1); // Fade effect saat transition

  const [selectedTempat, setSelectedTempat] = useState(null);
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

  const fetchIdRef = useRef(0);
  const initialLoadDoneRef = useRef(false);
  const scrollTimeoutRef = useRef(null);
  const observerRef = useRef(null);
  const lastCardRef = useRef(null);
  const existingIdsRef = useRef(new Set());
  const lastLocationRef = useRef(null);
  const touchStartY = useRef(0);
  const pullDistanceRef = useRef(0);

  // Simpan comments di ref
  const commentsRef = useRef(comments);
  useEffect(() => { commentsRef.current = comments; }, [comments]);

  // Simpan state di ref
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const errorRef = useRef(null);

  useEffect(() => { loadingRef.current = loading; }, [loading]);
  useEffect(() => { hasMoreRef.current = hasMore; }, [hasMore]);
  useEffect(() => { errorRef.current = error; }, [error]);

  const isMalam = useMemo(() => getGreeting().text === "Malam", []);

  const locationReady = useMemo(() =>
    status === "granted" && !!location?.latitude && !!location?.longitude,
    [status, location]
  );

  const { villageLocation, districtLocation } = useMemo(() => {
    if (!placeName) return { villageLocation: "Pilih Lokasi", districtLocation: "" };
    const parts = placeName.split(",").map(p => p.trim());
    return { villageLocation: parts[0] || "Lokasi", districtLocation: parts[1] || "" };
  }, [placeName]);

  const locationReadyRef = useRef(locationReady);
  const locationRef = useRef(location);
  useEffect(() => { locationReadyRef.current = locationReady; }, [locationReady]);
  useEffect(() => { locationRef.current = location; }, [location]);

  // ── CACHE MANAGER dengan lokasi ──────────────────────────────────────────
  const cacheManager = useMemo(() => ({
    getKey: () => {
      if (status !== "granted" || !location?.latitude || !location?.longitude) {
        return 'feed_default';
      }
      // Cache per lokasi dengan radius
      const lat = Math.round(location.latitude * 100) / 100;
      const lng = Math.round(location.longitude * 100) / 100;
      return `feed_${lat}_${lng}_${searchRadius}`;
    },

    get: (key) => {
      try {
        const cached = localStorage.getItem(key);
        if (!cached) return null;
        const { data, timestamp, version } = JSON.parse(cached);
        const maxAge = status === "granted" ? CACHE_DURATION : CACHE_DURATION * 2;
        if (Date.now() - timestamp > maxAge) return null;
        if (version !== (window.FEED_VERSION || 1)) return null;
        return data;
      } catch {
        return null;
      }
    },

    set: (key, data) => {
      try {
        localStorage.setItem(key, JSON.stringify({
          data,
          timestamp: Date.now(),
          version: window.FEED_VERSION || 1
        }));
      } catch (e) {
        console.warn('Cache save failed:', e);
      }
    },

    invalidate: () => {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('feed_')) localStorage.removeItem(key);
      });
      window.FEED_VERSION = (window.FEED_VERSION || 1) + 1;
    }
  }), [location, status, searchRadius]);

  // ── FUNGSI LOAD PLACES DENGAN FILTER LOKASI ──────────────────────────────
  const loadPlaces = useCallback(async (reset = false, isLocationChange = false) => {
    const currentFetchId = ++fetchIdRef.current;

    if (loading && !reset) return;

    if (reset) {
      setPage(0);
      setInitialLoad(true);
      setHasMore(true);
      setError(null);
      existingIdsRef.current.clear();

      // Smooth transition saat location berubah - jangan langsung clear
      if (isLocationChange) {
        setIsTransitioningLocation(true);
        setFeedOpacity(0.5);
        // Fade out dulu sebelum clear
        await new Promise(resolve => setTimeout(resolve, LOCATION_TRANSITION_DELAY / 2));
      } else {
        // Reset normal (bukan location change) - clear langsung
        setTempat([]);
      }
    }

    setLoading(true);

    try {
      // Cek cache untuk initial load
      if (reset && !forceRefresh) {
        const cacheKey = cacheManager.getKey();
        const cachedData = cacheManager.get(cacheKey);
        if (cachedData && cachedData.length > 0) {
          setTempat(cachedData);
          setInitialLoad(false);
          setLoading(false);
          return;
        }
      }

      const currentPage = reset ? 0 : page;
      const from = currentPage * LIMIT;
      const to = from + LIMIT - 1;

      const params = new URLSearchParams(window.location.search);
      const priorityId = reset ? params.get("tempat") : null;

      // Filter 30 hari terakhir
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      let query = supabase
        .from("feed_view")
        .select("*")
        .gte("created_at", thirtyDaysAgo.toISOString())
        .range(from, to)
        .order("created_at", { ascending: false });

      // 🔥 KRUSIAL: FILTER BERDASARKAN LOKASI!
      if (locationReady && location?.latitude && location?.longitude) {
        // Gunakan PostGIS atau filter radius
        // Asumsi: tabel feed_view memiliki kolom latitude dan longitude
        // Atau menggunakan earthdistance untuk PostgreSQL

        // Metode 1: Filter menggunakan bounding box (lebih cepat)
        const lat = location.latitude;
        const lng = location.longitude;
        const latDelta = searchRadius / 111; // 1 derajat ≈ 111km
        const lngDelta = searchRadius / (111 * Math.cos(lat * Math.PI / 180));

        query = query
          .gte('latitude', lat - latDelta)
          .lte('latitude', lat + latDelta)
          .gte('longitude', lng - lngDelta)
          .lte('longitude', lng + lngDelta);

        console.log(`🔍 Mencari tempat dalam radius ${searchRadius}km dari (${lat}, ${lng})`);
      } else {
        console.log('📍 Lokasi tidak tersedia, menampilkan semua konten');
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      if (currentFetchId !== fetchIdRef.current) return;

      let items = data || [];
      console.log(`📦 Ditemukan ${items.length} tempat di radius ${searchRadius}km`);

      // Prioritaskan item dari URL parameter
      if (priorityId && reset) {
        const alreadyLoaded = items.some(i => String(i.id) === String(priorityId));
        if (!alreadyLoaded) {
          const { data: pd } = await supabase
            .from("feed_view")
            .select("*")
            .eq("id", parseInt(priorityId))
            .single();
          if (pd) items = [pd, ...items];
        }
      }

      // Filter duplicates
      const uniqueItems = [];
      const newIds = new Set();

      for (const item of items) {
        if (!existingIdsRef.current.has(item.id) && !newIds.has(item.id)) {
          newIds.add(item.id);
          uniqueItems.push(item);
        }
      }

      // Process items
      const commentsMap = {};
      const processedItems = [];

      for (const item of uniqueItems) {
        commentsMap[item.id] = item.testimonial_terbaru || [];
        const processed = processFeedItem({
          item,
          locationReady: locationReadyRef.current,
          location: locationRef.current,
          comments: commentsRef.current,
        });
        processedItems.push(processed);
        existingIdsRef.current.add(item.id);
      }

      // SORTING dengan prioritas jarak
      processedItems.sort((a, b) => {
        if (priorityId) {
          if (String(a.id) === String(priorityId)) return -1;
          if (String(b.id) === String(priorityId)) return 1;
        }

        const now = new Date();
        const oneHourAgo = now - (60 * 60 * 1000);

        const aRecent = a.lastActivityAt && new Date(a.lastActivityAt).getTime() > oneHourAgo;
        const bRecent = b.lastActivityAt && new Date(b.lastActivityAt).getTime() > oneHourAgo;

        if (aRecent && !bRecent) return -1;
        if (!aRecent && bRecent) return 1;

        // Prioritas tempat dengan jarak terdekat
        const aHasLocation = locationReadyRef.current && a.distance !== null && a.distance !== Infinity;
        const bHasLocation = locationReadyRef.current && b.distance !== null && b.distance !== Infinity;

        if (aHasLocation && !bHasLocation) return -1;
        if (!aHasLocation && bHasLocation) return 1;

        if (aHasLocation && bHasLocation) {
          return (a.distance || Infinity) - (b.distance || Infinity);
        }

        if (a.sortScore && b.sortScore) {
          return b.sortScore - a.sortScore;
        }

        if (a.hasOfficialExternal && !b.hasOfficialExternal) return -1;
        if (!a.hasOfficialExternal && b.hasOfficialExternal) return 1;

        if (a.lastActivityAt && b.lastActivityAt) {
          return new Date(b.lastActivityAt) - new Date(a.lastActivityAt);
        }

        return 0;
      });

      // Update state
      setComments(prev => ({ ...prev, ...commentsMap }));
      setTempat(processedItems);
      setPage(currentPage + 1);
      setHasMore(items.length === LIMIT);

      // Simpan ke cache
      if (reset) {
        const cacheKey = cacheManager.getKey();
        cacheManager.set(cacheKey, processedItems);

        // Smooth fade in saat location change
        if (isLocationChange) {
          setFeedOpacity(1);
          setIsTransitioningLocation(false);
          setTimeout(() => setFeedOpacity(1), LOCATION_TRANSITION_DELAY / 2);
        }

        // Tampilkan notifikasi radius
        if (locationReady) {
          setToast({
            show: true,
            message: `📍 Menampilkan tempat dalam radius ${searchRadius}km dari ${villageLocation}`
          });
          setTimeout(() => setToast({ show: false, message: "" }), 3000);
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
  }, [page, loading, forceRefresh, cacheManager, locationReady, location, searchRadius, villageLocation]);

  // ── HANDLE PERUBAHAN RADIUS ──────────────────────────────────────────────
  const handleRadiusChange = useCallback((newRadius) => {
    setSearchRadius(newRadius);
    cacheManager.invalidate();
    loadPlaces(true);
    setToast({
      show: true,
      message: `🔍 Radius pencarian diubah menjadi ${newRadius}km`
    });
    setTimeout(() => setToast({ show: false, message: "" }), 2000);
  }, [cacheManager, loadPlaces]);

  // ── INFINITE SCROLL ──────────────────────────────────────────────────────
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);

      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 900 &&
        !loadingRef.current && hasMoreRef.current && !errorRef.current) {
        loadPlaces(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loadPlaces]);

  // ── SUBSCRIBE REAL-TIME CHANGES ──────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('feed_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'feed_view' },
        () => {
          cacheManager.invalidate();
          loadPlaces(true);
          setToast({ show: true, message: "📢 Konten baru tersedia di area ini" });
          setTimeout(() => setToast({ show: false, message: "" }), 2000);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [cacheManager, loadPlaces]);

  // ── PULL TO REFRESH ──────────────────────────────────────────────────────
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

  // ── RELOAD KETIKA LOKASI BERUBAH ─────────────────────────────────────────
  useEffect(() => {
    if (!initialLoadDoneRef.current) {
      initialLoadDoneRef.current = true;
      loadPlaces(true, false);
      return;
    }

    if (!locationReady) return;

    const currentKey = location ? `${location.latitude.toFixed(3)},${location.longitude.toFixed(3)}` : '';
    if (lastLocationRef.current === currentKey) return;

    lastLocationRef.current = currentKey;
    console.log(`📍 Lokasi berubah ke: ${villageLocation}, memuat ulang feed...`);
    cacheManager.invalidate();
    loadPlaces(true, true); // Pass true = location change

    // Notifikasi perubahan lokasi
    setToast({
      show: true,
      message: `📍 Lokasi berubah ke ${villageLocation}. Menampilkan tempat terdekat.`
    });
    setTimeout(() => setToast({ show: false, message: "" }), 3000);
  }, [location?.latitude, location?.longitude, locationReady, cacheManager, loadPlaces, villageLocation]);

  // ── MODAL HANDLERS ────────────────────────────────────────────────────────
  const handleSearchSelect = useCallback((item) => {
    setSelectedTempat(item);
    setAiContext("search");
    setShowAIModal(true);
  }, []);

  const openAICardModal = useCallback((item, onUploadSuccess, initialQuery = "") => {
    setSelectedTempat(item);
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

  return (
    <main className="relative min-h-screen mx-auto w-[92%] max-w-[400px] bg-transparent">

      {/* Pull to refresh indicator */}
      <AnimatePresence>
        {refreshing && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            className="fixed top-0 left-0 right-0 bg-gradient-to-r from-primary/90 to-secondary/90 backdrop-blur-md py-3 text-center text-white text-sm z-50 shadow-lg"
          >
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Memperbarui feed...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
        onActivateGPS={requestLocation}
        onSelectManual={setManualLocation}
      />

      {/* ── FEED ── */}
      <motion.div
        className="mt-4 space-y-2 min-h-[60vh] relative"
        animate={{ opacity: feedOpacity }}
        transition={{ duration: LOCATION_TRANSITION_DELAY / 1000 }}
      >
        {initialLoad ? (
          <div className="space-y-6 px-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-[400px] w-full rounded-[40px] animate-pulse bg-white/5 border border-white/5" />
            ))}
          </div>
        ) : error ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12 px-4"
          >
            <div className="text-6xl mb-4">⚠️</div>
            <h3 className="text-white/80 text-lg font-semibold mb-2">Gagal memuat data</h3>
            <p className="text-white/40 text-sm mb-4">{error}</p>
            <button
              onClick={retryLoad}
              className="px-6 py-2 bg-white/10 rounded-xl text-white/80 hover:bg-white/20 transition-colors"
            >
              Coba Lagi
            </button>
          </motion.div>
        ) : tempat.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12 px-4"
          >
            <div className="text-6xl mb-4">📍</div>
            <h3 className="text-white/80 text-lg font-semibold mb-2">Tidak ada tempat di sekitar</h3>
            <p className="text-white/40 text-sm">
              Tidak ditemukan tempat dalam radius {searchRadius}km dari {villageLocation}
            </p>
            <button
              onClick={() => handleRadiusChange(searchRadius + 5)}
              className="mt-4 px-6 py-2 bg-white/10 rounded-xl text-white/80 hover:bg-white/20 transition-colors text-sm"
            >
              Perluas radius ke {searchRadius + 5}km
            </button>
          </motion.div>
        ) : (
          <React.Suspense fallback={null}>
            <LayoutGroup>
              <motion.div layout className="space-y-2">
                <AnimatePresence mode="popLayout" initial={false}>
                  {tempat.slice(0, 15).map((item, index) => (
                    <motion.div
                      key={`feed-${item.id}`}
                      layout
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.5,
                        ease: [0.22, 1, 0.36, 1],
                        delay: Math.min(index * 0.05, 0.2)
                      }}
                      ref={index === Math.min(tempat.length, 15) - 1 ? lastCardRef : null}
                    >
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
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            </LayoutGroup>
          </React.Suspense>
        )}

        {loading && !initialLoad && !error && (
          <div className="flex justify-center py-8">
            <div className="flex flex-col items-center gap-2">
              <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
              <p className="text-white/40 text-xs">Memuat lebih banyak...</p>
            </div>
          </div>
        )}

        {!hasMore && tempat.length > 0 && !error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-8"
          >
            <p className="text-white/40 text-xs">✨ Semua konten di sekitar telah dimuat ✨</p>
          </motion.div>
        )}

        {/* Location Transition Loading Overlay */}
        {isTransitioningLocation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm rounded-2xl z-40"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <p className="text-white/60 text-xs font-medium">Memperbarui lokasi...</p>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* ── MODALS ── */}
      <React.Suspense fallback={null}>
        <SearchModal
          isOpen={showSearchModal}
          onClose={() => setShowSearchModal(false)}
          onSelectTempat={handleSearchSelect}
        />
      </React.Suspense>

      <React.Suspense fallback={null}>
        <AIModal
          isOpen={showAIModal}
          onClose={closeModals}
          tempat={selectedTempat}
          context={aiContext}
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
          onUploadSuccess={selectedUploadSuccess}
          initialQuery={initialQuery}
        />
      </React.Suspense>

      <React.Suspense fallback={null}>
        <KomentarModal
          isOpen={showKomentarModal}
          onClose={closeModals}
          tempat={selectedTempat}
          isAdmin={isAdmin}
        />
      </React.Suspense>

      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ y: 50, x: "-50%", opacity: 0 }}
            animate={{ y: 0, x: "-50%", opacity: 1 }}
            exit={{ y: 50, x: "-50%", opacity: 0 }}
            className="fixed bottom-10 left-1/2 z-[100]"
          >
            <div className="bg-black/80 backdrop-blur-lg text-white px-5 py-2.5 rounded-full shadow-2xl text-sm font-medium border border-white/20">
              {toast.message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}