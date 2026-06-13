"use client";

import * as React from "react";
import { useEffect, useState, useCallback, useRef, useMemo, lazy, Suspense } from "react";
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
import SplashScreen from "@/app/components/ui/SplashScreen";
import PWAInstaller from "@/components/PWAInstaller";


// Import extracted modules
import {
    FEED_CONFIG,
    getDynamicLimit,
    haversineDistance,
    calculateHybridScore,
    cachedProcessFeedItem
} from "@/lib/feedUtils";
import { useFeedCache } from "@/hooks/useFeedCache";

import {
    SkeletonLoader,
    ErrorState,
    EmptyState,
    InvisibleLoading,
    EndOfFeed,
    PullToRefreshIndicator,
    ToastMessage
} from "@/app/components/feed/FeedStatusComponents";

// Optimized FeedCard with memo
const MemoizedFeedCard = React.memo(FeedCard);

// Lazy load heavy modals
const AIModal = React.lazy(() => import("../ai/AIModal"));
const KomentarModal = React.lazy(() => import("./KomentarModal"));
const SearchModal = React.lazy(() => import("./SearchModal"));

// ========== HOOK: VIEWPORT HEIGHT UNTUK HP ==========
const useViewportHeight = () => {
    const [viewportHeight, setViewportHeight] = useState('100dvh');
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        const updateHeight = () => {
            // Gunakan innerHeight untuk akurasi di mobile
            const height = window.innerHeight;
            setViewportHeight(`${height}px`);
            setIsReady(true);

            // Juga set CSS variable untuk fallback
            document.documentElement.style.setProperty('--vh', `${height * 0.01}px`);
        };

        updateHeight();

        // Update saat resize, orientation change, dan scroll (untuk address bar)
        window.addEventListener('resize', updateHeight);
        window.addEventListener('orientationchange', updateHeight);

        return () => {
            window.removeEventListener('resize', updateHeight);
            window.removeEventListener('orientationchange', updateHeight);
        };
    }, []);

    return { viewportHeight, isReady };
};

// ========== SNAP SCROLL HOOK ==========
const useSnapScroll = (totalItems, onIndexChange, viewportHeight) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const containerRef = useRef(null);
    const isScrollingRef = useRef(false);
    const scrollTimeoutRef = useRef(null);

    // Snap ke index tertentu
    const snapToIndex = useCallback((index, behavior = 'smooth') => {
        const container = containerRef.current;
        if (!container || !viewportHeight) return;

        const targetScrollTop = index * parseFloat(viewportHeight);
        container.scrollTo({ top: targetScrollTop, behavior });
        setActiveIndex(index);
        if (onIndexChange) onIndexChange(index);
    }, [viewportHeight, onIndexChange]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container || !viewportHeight) return;

        const handleScroll = () => {
            if (isScrollingRef.current) return;

            const scrollTop = container.scrollTop;
            const cardHeight = parseFloat(viewportHeight);
            const newIndex = Math.round(scrollTop / cardHeight);

            if (newIndex !== activeIndex && newIndex >= 0 && newIndex < totalItems) {
                setActiveIndex(newIndex);
                if (onIndexChange) onIndexChange(newIndex);
            }
        };

        const handleScrollEnd = () => {
            if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
            isScrollingRef.current = true;

            scrollTimeoutRef.current = setTimeout(() => {
                isScrollingRef.current = false;
                const scrollTop = container.scrollTop;
                const cardHeight = parseFloat(viewportHeight);
                const targetIndex = Math.round(scrollTop / cardHeight);
                const targetScrollTop = targetIndex * cardHeight;

                if (Math.abs(scrollTop - targetScrollTop) > 10) {
                    container.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
                    setActiveIndex(targetIndex);
                    if (onIndexChange) onIndexChange(targetIndex);
                }
            }, 150);
        };

        container.addEventListener('scroll', handleScroll, { passive: true });
        container.addEventListener('scrollend', handleScrollEnd);

        return () => {
            container.removeEventListener('scroll', handleScroll);
            container.removeEventListener('scrollend', handleScrollEnd);
            if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        };
    }, [totalItems, activeIndex, onIndexChange, viewportHeight]);

    return { containerRef, activeIndex, snapToIndex };
};

// ========== MAIN COMPONENT ==========
export default function FeedContent() {
    // ========== MOUNTED & SPLASH STATE ==========
    const [mounted, setMounted] = useState(false);
    const [showSplash, setShowSplash] = useState(true);

    const [isStandalone, setIsStandalone] = useState(false);

    const router = useRouter();
    const { location, status, placeName, requestLocation, setManualLocation, activeMode } = useLocation();
    const { user, isAdmin, profile } = useAuth();
    const theme = useTheme();

    // ========== VIEWPORT HEIGHT ==========
    const { viewportHeight, isReady: viewportReady } = useViewportHeight();

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
    const [initialLoad, setInitialLoad] = useState(() => {
        if (typeof window === 'undefined') return true;
        const hasCache = !!sessionStorage.getItem('feed_backup');
        return !hasCache;
    });
    const [error, setError] = useState(null);
    const searchRadius = activeMode === 'general' ? 40 : FEED_CONFIG.DEFAULT_RADIUS;

    // ========== UI STATE ==========
    const [isScrolled, setIsScrolled] = useState(false);
    const [toast, setToast] = useState({ show: false, message: "" });
    const [refreshing, setRefreshing] = useState(false);
    const [isTransitioningLocation, setIsTransitioningLocation] = useState(false);
    const [feedOpacity, setFeedOpacity] = useState(1);
    const [showHeader, setShowHeader] = useState(true);
    const headerHideTimeoutRef = useRef(null);

    // ========== MODAL STATES ==========
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [userId, setUserId] = useState(null);
    const [userRole, setUserRole] = useState(null);

    useEffect(() => {
        if (user) {
            setUserId(user.id);
            setUserRole(user.role);
        }
    }, [user]);

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
    const [isPWAInstalled, setIsPWAInstalled] = useState(false);
    // ========== REFS ==========
    const fetchIdRef = useRef(0);
    const lastLoadedIdRef = useRef(null);
    const existingIdsRef = useRef(new Set());
    const initialLoadDoneRef = useRef(false);
    const isFetchingRef = useRef(false);

    // ========== CACHE ==========
    const cacheManager = useFeedCache(networkInfo.isSlowConnection);

    // ========== SNAP SCROLL ==========
    const { containerRef, activeIndex, snapToIndex } = useSnapScroll(orderedIds.length, (index) => {
        // Preload next card when index changes
        const nextIndex = index + 1;
        if (nextIndex < orderedIds.length) {
            const nextItem = itemsMap.get(orderedIds[nextIndex]);
            if (nextItem?.photos?.[0]) {
                const img = new Image();
                img.src = nextItem.photos[0];
            }
        }

        // Auto-hide header after scrolling
        if (headerHideTimeoutRef.current) clearTimeout(headerHideTimeoutRef.current);
        setShowHeader(true);
        headerHideTimeoutRef.current = setTimeout(() => {
            if (index > 0) {
                setShowHeader(false);
            }
        }, 2000);
    }, viewportHeight);

    useEffect(() => {
        const isStandaloneMode = window.matchMedia("(display-mode: standalone)").matches
            || window.navigator.standalone === true;
        setIsStandalone(isStandaloneMode);

        // Jika sudah dalam mode standalone PWA, skip splash buatan
        if (isStandaloneMode) {
            setShowSplash(false);
            sessionStorage.setItem('splash_shown', 'true');
        }
    }, []);

    // ========== MOUNTED EFFECT ==========
    useEffect(() => {
        setMounted(true);
        const splashShown = sessionStorage.getItem('splash_shown');
        if (splashShown === 'true') {
            setShowSplash(false);
        }
    }, []);

    // ========== MEMOIZED VALUES ==========
    const locationReady = useMemo(() => status === "granted" && !!location?.latitude && !!location?.longitude, [status, location]);

    const { villageLocation, districtLocation } = useMemo(() => {
        if (!placeName) {
            return { villageLocation: "Pilih Lokasi", districtLocation: "" };
        }
        const parts = placeName.split(",").map(p => p.trim());
        return { villageLocation: parts[0] || "Lokasi", districtLocation: parts[1] || "" };
    }, [placeName]);

    const tempat = useMemo(() => orderedIds.map(id => itemsMap.get(id)).filter(Boolean), [orderedIds, itemsMap]);

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

                setInitialLoad(false);
            }
        } catch (err) {
            console.error("Error loading places:", err);

            if (err.message?.includes('JWT') || err.message?.includes('session')) {
                setError("Sesi berakhir, silakan login kembali");
            } else if (err.message?.includes('Failed to fetch') || err.message?.includes('Network')) {
                setError("Koneksi internet bermasalah, coba lagi nanti");
            } else if (err.code === 'PGRST116') {
                setError("Tidak ada tempat di sekitar lokasi Anda");
            } else if (err.message?.includes('timeout')) {
                setError("Koneksi timeout, periksa jaringan Anda");
            } else {
                setError("Gagal memuat data, coba lagi");
            }

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

    // ========== LOAD DATA AFTER MOUNTED ==========
    useEffect(() => {
        if (mounted && !showSplash && !initialLoadDoneRef.current) {
            initialLoadDoneRef.current = true;
            loadPlaces(true, false);
        }
    }, [mounted, showSplash, loadPlaces]);

    // ========== NETWORK INFO ==========
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

    // ========== INFINITE SCROLL FOR SNAP SCROLL ==========
    useEffect(() => {
        // Load more when reaching last 3 cards
        if (activeIndex >= orderedIds.length - 3 && hasMore && !loading && !initialLoad) {
            loadPlaces(false);
        }
    }, [activeIndex, orderedIds.length, hasMore, loading, initialLoad, loadPlaces]);

    // ========== SCROLL DETECTION ==========
    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // ========== PULL TO REFRESH ==========
    useEffect(() => {
        let touchStartY = 0;
        let isRefreshing = false;

        const handleTouchStart = (e) => {
            if (window.scrollY === 0) {
                touchStartY = e.touches[0].clientY;
            }
        };

        const handleTouchMove = (e) => {
            if (window.scrollY === 0 && !isRefreshing && !loading) {
                const deltaY = e.touches[0].clientY - touchStartY;
                if (deltaY > 60) {
                    isRefreshing = true;
                    setRefreshing(true);
                    loadPlaces(true).finally(() => {
                        setRefreshing(false);
                        setTimeout(() => {
                            isRefreshing = false;
                        }, 300);
                    });
                }
            }
        };

        const handleTouchEnd = () => {
            isRefreshing = false;
        };

        window.addEventListener('touchstart', handleTouchStart);
        window.addEventListener('touchmove', handleTouchMove);
        window.addEventListener('touchend', handleTouchEnd);

        return () => {
            window.removeEventListener('touchstart', handleTouchStart);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
        };
    }, [loadPlaces, loading]);

    // ========== LISTENER REFRESH FEED DARI BOTTOM NAV ==========
    useEffect(() => {
        const handleRefreshFeed = async () => {

            cacheManager.invalidate();
            await loadPlaces(true);
            snapToIndex(0, 'smooth');

            // ⬇️ TAMBAHKAN DELAY AGAR SPINNER KELIHATAN
            await new Promise(resolve => setTimeout(resolve, 200));
        };

        window.addEventListener('refresh-feed', handleRefreshFeed);

        return () => {
            window.removeEventListener('refresh-feed', handleRefreshFeed);
        };
    }, [cacheManager, loadPlaces, snapToIndex]);

    // ========== PWA INSTALLATION DETECTION ==========
    useEffect(() => {
        const checkPWAInstallation = () => {
            const isStandalone = window.matchMedia("(display-mode: standalone)").matches ||
                window.navigator.standalone === true;
            setIsPWAInstalled(isStandalone);
        };

        checkPWAInstallation();

        const mediaQuery = window.matchMedia("(display-mode: standalone)");
        mediaQuery.addEventListener("change", checkPWAInstallation);

        return () => mediaQuery.removeEventListener("change", checkPWAInstallation);
    }, []);

    // ========== SPLASH HANDLER ==========
    const handleSplashComplete = useCallback(() => {
        if (typeof window !== 'undefined') {
            sessionStorage.setItem('splash_shown', 'true');
        }
        setShowSplash(false);
    }, []);

    const handleSearchWithQuery = useCallback((q, item = null) => {
        setInitialQuery(q);
        setSelectedTempat(item);
        setSelectedUploadSuccess(null);
        setAiContext("search");
        setShowAIModal(true);
    }, []);

    // ========== UPDATE LOGIC: CLEAN & OPTIMIZED HANDLERS ==========

    const handleLocationChanged = useCallback(async () => {
        setIsTransitioningLocation(true);
        setFeedOpacity(0.7);

        // Invalidate cache secara menyeluruh
        cacheManager.invalidate();
        sessionStorage.removeItem('feed_backup');
        sessionStorage.removeItem('last_location_key');

        // Kosongkan state komentar agar tidak memory leak
        setComments({});

        // JIKA KAMU INGIN RELOAD HALAMAN:
        // Tidak perlu memanggil loadPlaces lagi secara async karena reload akan memicu siklus mount baru.
        window.scrollTo({ top: 0, behavior: 'auto' });

        setTimeout(() => {
            window.location.reload();
        }, 150);
    }, [cacheManager]);

    const handleManualLocationSelect = useCallback(async (selectedLocation) => {
        setManualLocation(selectedLocation);
        // Berikan jeda sedikit agar state context dari provider ter-update dengan aman
        setTimeout(async () => {
            await handleLocationChanged();
            const locationName = selectedLocation?.address || selectedLocation?.name || "lokasi baru";
            showToast(`📍 Feed diperbarui untuk ${locationName}`);
        }, 50);
    }, [setManualLocation, handleLocationChanged, showToast]);

    const handleGPSActivation = useCallback(async (mode = 'gps') => {
        await requestLocation(mode);
        setTimeout(async () => {
            await handleLocationChanged();
            showToast(`📍 Feed diperbarui untuk lokasi GPS`);
        }, 50);
    }, [requestLocation, handleLocationChanged, showToast]);

    const handleRadiusChange = useCallback((newRadius) => {
        cacheManager.invalidate();
        // Pastikan scroll kembali ke atas sebelum memuat data radius baru
        const container = containerRef.current;
        if (container) container.scrollTop = 0;

        snapToIndex(0, 'auto');
        loadPlaces(true);
        showToast(`🔍 Radius ${newRadius}km`);
    }, [cacheManager, loadPlaces, showToast, snapToIndex, containerRef]);

    const handleSearchSelect = useCallback((item) => {
        if (!item) return;
        setShowSearchModal(false);

        // Reset posisi scroll ke paling atas seketika sebelum memasukkan item baru
        const container = containerRef.current;
        if (container) {
            container.scrollTop = 0;
        }

        setItemsMap(prev => {
            const newMap = new Map(prev);
            newMap.set(item.id, item);
            return newMap;
        });

        setOrderedIds(prev => [item.id, ...prev.filter(id => id !== item.id)]);
        setSelectedTempat(item);

        // Jalankan snap secara smooth ke index 0
        setTimeout(() => {
            snapToIndex(0, 'smooth');
            showToast(`📍 Menampilkan ${item.name}`);
        }, 50);
    }, [showToast, snapToIndex, containerRef]);

    const openAICardModal = useCallback((item, onUploadSuccess, initialQueryText = "") => {
        setSelectedTempat(item);
        setSelectedLaporanWarga(item?.laporan_terbaru || []);
        setSelectedUploadSuccess(() => onUploadSuccess);
        setInitialQuery(initialQueryText);
        setAiContext("card");
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

    // ========== RENDER LOGIC ==========
    if (!mounted || !viewportReady) {
        return null;
    }

    if (showSplash && !isStandalone) {
        return <SplashScreen onComplete={handleSplashComplete} />;
    }

    if (initialLoad) {
        return <SkeletonLoader />;
    }

    return (
        <main
            className="relative h-screen overflow-hidden bg-black mx-auto w-full max-w-[420px]"
            suppressHydrationWarning
            style={{ height: viewportHeight }}
        >
            {/* Animated Header - Auto hide on scroll */}
            <motion.div
                initial={{ y: 0 }}
                animate={{ y: showHeader ? 0 : -100 }}
                transition={{ duration: 0.3 }}
                className="fixed top-0 left-0 right-0 z-50"
            >
                <Header
                    className="bg-black/80 backdrop-blur-lg border-b border-white/10"
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
            </motion.div>

            {/* Snap Scroll Container */}
            <div
                ref={containerRef}
                className="snap-container w-full overflow-y-scroll scroll-smooth"
                style={{
                    height: viewportHeight,
                    scrollSnapType: 'y mandatory',
                    WebkitOverflowScrolling: 'touch',
                }}
            >
                {/* Padding wrapper untuk card margin */}
                <div className="px-0">
                    <AnimatePresence initial={false}>
                        {tempat.map((item, index) => {
                            const isActive = activeIndex === index;

                            return (
                                <div
                                    key={item.id}
                                    className="snap-item"
                                    style={{
                                        scrollSnapAlign: 'start',
                                        scrollSnapStop: 'always',
                                        height: viewportHeight,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',  // ← tambah ini
                                    }}
                                >
                                    <motion.div
                                        initial={false}
                                        animate={{
                                            opacity: isActive ? 1 : 0.95,

                                        }}
                                        transition={{ duration: 0.2 }}
                                        className="w-full max-w-[420px] mx-auto"
                                    >
                                        <FeedCardWrapper theme={theme}>
                                            <MemoizedFeedCard
                                                item={item}
                                                locationReady={locationReady}
                                                location={location}
                                                comments={comments}
                                                selectedPhotoIndex={selectedPhotoIndex}
                                                setSelectedPhotoIndex={setSelectedPhotoIndex}
                                                openAIModal={openAICardModal}
                                                openKomentarModal={openKomentarModal}
                                                onShare={handleShare}
                                                priority={index < 3}
                                                userId={user?.id}
                                                userProfile={profile}
                                                userAvatar={profile?.avatar_url}
                                                showLiveInsight={false}
                                                hideActionButtons={true}
                                                isActive={isActive}
                                                shouldPlayVideo={isActive}
                                            />
                                        </FeedCardWrapper>
                                    </motion.div>
                                </div>
                            );
                        })}
                    </AnimatePresence>
                </div>

                {/* Loading & End indicators */}
                {loading && !initialLoad && !error && (
                    <div
                        className="snap-item w-full flex items-center justify-center"
                        style={{ height: viewportHeight }}
                    >
                        <InvisibleLoading />
                    </div>
                )}
            </div>


            {/* Modals - same as before */}
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
                onLocationChange={handleLocationChanged}
                customLocationName={placeName}
            />

            {/* Loading overlay for location transition */}
            {isTransitioningLocation && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50"
                    style={{ height: viewportHeight }}
                >
                    <div className="flex flex-col items-center gap-3">
                        <div className="relative h-8 w-8">
                            <div className="absolute inset-0 border-2 border-white/20 border-t-[#E3655B] border-b-[#25F4EE] rounded-full animate-spin" style={{ animationDuration: '0.35s' }}></div>
                        </div>
                        <p className="text-white/70 text-xs font-medium">Mengupdate lokasi...</p>
                    </div>
                </motion.div>
            )}

            {/* Lazy Modals */}
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
            {/* PWA Installer */}
            {!isPWAInstalled && <PWAInstaller />}
        </main>
    );
}