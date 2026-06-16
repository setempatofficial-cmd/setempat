"use client";

import * as React from "react";
import { useEffect, useState, useCallback, useRef, useMemo, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Head from "next/head";
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
    ToastMessage,
    FeedCardError
} from "@/app/components/feed/FeedStatusComponents";

// Optimized FeedCard with memo
const MemoizedFeedCard = React.memo(FeedCard);

// Lazy load heavy modals
const AIModal = React.lazy(() => import("../ai/AIModal"));
const KomentarModal = React.lazy(() => import("./KomentarModal"));
const SearchModal = React.lazy(() => import("./SearchModal"));

// ========== SIMPLE ERROR BOUNDARY (Tanpa react-error-boundary) ==========
class SimpleErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("FeedCard Error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <FeedCardError
                    item={this.props.item}
                    onRetry={() => {
                        this.setState({ hasError: false, error: null });
                        if (this.props.onRetry) this.props.onRetry();
                    }}
                />
            );
        }
        return this.props.children;
    }
}

// ========== CUSTOM HOOKS ==========

const useViewportHeight = () => {
    const [viewportHeight, setViewportHeight] = useState('100dvh');
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        const updateHeight = () => {
            if (typeof window !== 'undefined') {
                if (CSS.supports('height', '100dvh')) {
                    setViewportHeight('100dvh');
                } else {
                    const height = window.innerHeight - 1;
                    setViewportHeight(`${height}px`);
                }
            }
            setIsReady(true);
        };

        updateHeight();
        window.addEventListener('resize', updateHeight);
        window.addEventListener('orientationchange', updateHeight);

        return () => {
            window.removeEventListener('resize', updateHeight);
            window.removeEventListener('orientationchange', updateHeight);
        };
    }, []);

    return { viewportHeight, isReady };
};

const useNetworkInfo = () => {
    const [networkInfo, setNetworkInfo] = useState({
        effectiveType: '4g',
        saveData: false,
        isSlowConnection: false
    });

    useEffect(() => {
        if (typeof navigator === 'undefined' || !navigator.connection) return;

        const updateNetworkInfo = () => {
            const conn = navigator.connection;
            const effectiveType = conn?.effectiveType || '4g';
            const saveData = conn?.saveData || false;
            const isSlowConnection = saveData || effectiveType === 'slow-2g' || effectiveType === '2g';

            setNetworkInfo({ effectiveType, saveData, isSlowConnection });
        };

        updateNetworkInfo();
        navigator.connection.addEventListener('change', updateNetworkInfo);
        return () => navigator.connection.removeEventListener('change', updateNetworkInfo);
    }, []);

    return networkInfo;
};

const useOnlineStatus = () => {
    const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return isOnline;
};

// ========== SNAP SCROLL HOOK (FIXED) ==========
const useSnapScroll = (totalItems, onIndexChange, viewportHeight) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const containerRef = useRef(null);
    const scrollTimeoutRef = useRef(null);
    const isMountedRef = useRef(true);

    useEffect(() => {
        return () => {
            isMountedRef.current = false;
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
        };
    }, []);

    const handleScroll = useCallback(() => {
        if (!containerRef.current || !isMountedRef.current) return;

        const container = containerRef.current;
        const children = container.querySelectorAll('.snap-item');
        const containerCenter = container.getBoundingClientRect().top + (container.clientHeight / 2);

        let closestIndex = 0;
        let minDistance = Infinity;

        children.forEach((child, index) => {
            const box = child.getBoundingClientRect();
            const childCenter = box.top + (box.height / 2);
            const distance = Math.abs(containerCenter - childCenter);

            if (distance < minDistance) {
                minDistance = distance;
                closestIndex = index;
            }
        });

        if (activeIndex !== closestIndex && isMountedRef.current) {
            setActiveIndex(closestIndex);
            if (onIndexChange) onIndexChange(closestIndex);
        }
    }, [activeIndex, onIndexChange]);

    const handleScrollEnd = useCallback(() => {
        if (!isMountedRef.current) return;

        if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
        }

        scrollTimeoutRef.current = setTimeout(() => {
            if (!containerRef.current || !isMountedRef.current) return;

            const container = containerRef.current;
            const children = container.querySelectorAll('.snap-item');
            if (children.length === 0) return;

            const containerCenter = container.getBoundingClientRect().top + (container.clientHeight / 2);
            let targetIndex = activeIndex;
            let minDistance = Infinity;

            children.forEach((child, index) => {
                const box = child.getBoundingClientRect();
                const childCenter = box.top + (box.height / 2);
                const distance = Math.abs(containerCenter - childCenter);

                if (distance < minDistance) {
                    minDistance = distance;
                    targetIndex = index;
                }
            });

            const targetChild = children[targetIndex];
            if (targetChild && isMountedRef.current) {
                const containerScrollTop = container.scrollTop;
                const containerTop = container.getBoundingClientRect().top;
                const childTop = targetChild.getBoundingClientRect().top;

                const targetScrollTop = containerScrollTop + childTop - containerTop - (container.clientHeight - targetChild.clientHeight) / 2;

                if (Math.abs(container.scrollTop - targetScrollTop) > 5) {
                    container.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
                }
            }
        }, 150);
    }, [activeIndex]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        container.addEventListener('scroll', handleScroll, { passive: true });
        container.addEventListener('scrollend', handleScrollEnd);

        return () => {
            container.removeEventListener('scroll', handleScroll);
            container.removeEventListener('scrollend', handleScrollEnd);
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
        };
    }, [handleScroll, handleScrollEnd]);

    const snapToIndex = useCallback((index, behavior = 'smooth') => {
        const container = containerRef.current;
        if (!container || !isMountedRef.current) return;

        const children = container.querySelectorAll('.snap-item');
        const targetChild = children[index];

        if (targetChild) {
            const containerScrollTop = container.scrollTop;
            const containerTop = container.getBoundingClientRect().top;
            const childTop = targetChild.getBoundingClientRect().top;
            const targetScrollTop = containerScrollTop + childTop - containerTop - (container.clientHeight - targetChild.clientHeight) / 2;

            container.scrollTo({ top: targetScrollTop, behavior });
            setActiveIndex(index);
            if (onIndexChange) onIndexChange(index);
        }
    }, [onIndexChange]);

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

    // ========== HOOKS ==========
    const { viewportHeight, isReady: viewportReady } = useViewportHeight();
    const networkInfo = useNetworkInfo();
    const isOnline = useOnlineStatus();

    // ========== DYNAMIC LIMIT ==========
    const [dynamicLimit, setDynamicLimitState] = useState(FEED_CONFIG.DEFAULT_LIMIT);

    useEffect(() => {
        setDynamicLimitState(getDynamicLimit());
    }, [networkInfo.isSlowConnection]);

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
    const [toast, setToast] = useState({ show: false, message: "" });
    const [refreshing, setRefreshing] = useState(false);
    const [isTransitioningLocation, setIsTransitioningLocation] = useState(false);

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
    const cacheLoadedRef = useRef(false);
    const isMountedRef = useRef(true);

    // ========== CACHE ==========
    const cacheManager = useFeedCache(networkInfo.isSlowConnection);

    useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // ========== SNAP SCROLL ==========
    const { containerRef, activeIndex, snapToIndex } = useSnapScroll(
        orderedIds.length,
        (index) => {
            // Preload next card when index changes
            const nextIndex = index + 1;
            if (nextIndex < orderedIds.length) {
                const nextItem = itemsMap.get(orderedIds[nextIndex]);
                if (nextItem?.photos?.[0]) {
                    if ('requestIdleCallback' in window) {
                        requestIdleCallback(() => {
                            const img = new Image();
                            img.src = nextItem.photos[0];
                        });
                    } else {
                        const img = new Image();
                        img.src = nextItem.photos[0];
                    }
                }
            }
        },
        viewportHeight
    );

    // ========== PWA DETECTION ==========
    useEffect(() => {
        const isStandaloneMode = window.matchMedia("(display-mode: standalone)").matches ||
            window.navigator.standalone === true;
        setIsStandalone(isStandaloneMode);

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
    const locationReady = useMemo(() =>
        status === "granted" && !!location?.latitude && !!location?.longitude,
        [status, location]
    );

    const { villageLocation, districtLocation } = useMemo(() => {
        if (!placeName) {
            return { villageLocation: "Pilih Lokasi", districtLocation: "" };
        }
        const parts = placeName.split(",").map(p => p.trim());
        return { villageLocation: parts[0] || "Lokasi", districtLocation: parts[1] || "" };
    }, [placeName]);

    const tempat = useMemo(() =>
        orderedIds.map(id => itemsMap.get(id)).filter(Boolean),
        [orderedIds, itemsMap]
    );

    const shouldShowEmptyState = useMemo(() =>
        !loading && !error && tempat.length === 0 && !refreshing && !initialLoad,
        [loading, error, tempat.length, refreshing, initialLoad]
    );

    // ========== GET CACHE KEY ==========
    const getCacheKey = useCallback(() => {
        if (!locationReady || !location) return 'feed_default';
        const lat = Math.round(location.latitude * 10) / 10;
        const lng = Math.round(location.longitude * 10) / 10;
        return `feed_v2_${lat}_${lng}_${searchRadius}`;
    }, [locationReady, location, searchRadius]);

    // ========== PRELOAD GAMBAR ==========
    const preloadImages = useCallback((items) => {
        if (!items || items.length === 0) return;

        const firstThreeIds = items.slice(0, 3);
        const preloadFn = () => {
            firstThreeIds.forEach(id => {
                const item = itemsMap.get(id);
                if (item?.photos?.[0]) {
                    const img = new Image();
                    img.src = item.photos[0];
                }
            });
        };

        if ('requestIdleCallback' in window) {
            requestIdleCallback(preloadFn);
        } else {
            setTimeout(preloadFn, 100);
        }
    }, [itemsMap]);

    // ========== LOAD CACHE ==========
    useEffect(() => {
        if (typeof window !== 'undefined' && !cacheLoadedRef.current && !initialLoadDoneRef.current) {
            const cacheKey = getCacheKey();
            const cached = cacheManager.get(cacheKey);
            if (cached && cached.orderedIds && cached.orderedIds.length > 0) {
                setItemsMap(cached.itemsMap);
                setOrderedIds(cached.orderedIds);
                setInitialLoad(false);
                cacheLoadedRef.current = true;
                if (cached.orderedIds.length > 0) {
                    lastLoadedIdRef.current = cached.orderedIds[cached.orderedIds.length - 1];
                }
                preloadImages(cached.orderedIds);
            }
        }
    }, [getCacheKey, cacheManager, preloadImages]);

    // ========== LOCATION CHANGE DETECTION ==========
    useEffect(() => {
        const locationChanged = sessionStorage.getItem('location_changed');
        if (locationChanged === 'true') {
            sessionStorage.removeItem('location_changed');
            cacheLoadedRef.current = false;
            initialLoadDoneRef.current = false;
            setInitialLoad(true);
        }
    }, []);

    // ========== SHOW TOAST HELPER ==========
    const showToast = useCallback((message) => {
        setToast({ show: true, message });
        setTimeout(() => setToast({ show: false, message: "" }), FEED_CONFIG.TOAST_DURATION);
    }, []);

    // ========== LOAD PLACES (CORE LOGIC - FIXED) ==========
    const loadPlaces = useCallback(async (reset = false, isLocationChange = false) => {
        if (!isMountedRef.current) return;
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
                    if (!isMountedRef.current) return;
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

            // Check if component is still mounted and fetch is still valid
            if (!isMountedRef.current || currentFetchId !== fetchIdRef.current) {
                isFetchingRef.current = false;
                return;
            }

            if (fetchError) throw fetchError;

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

            if (!isMountedRef.current || currentFetchId !== fetchIdRef.current) {
                isFetchingRef.current = false;
                return;
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

                if (isLocationChange && isMountedRef.current) {
                    setIsTransitioningLocation(false);
                }

                if (locationReady && isMountedRef.current) {
                    const connectionText = networkInfo.isSlowConnection ? " (mode hemat data)" : "";
                    showToast(`📍 ${processedItems.length} tempat dalam radius ${searchRadius}km${connectionText}`);
                }

                setInitialLoad(false);
            }
        } catch (err) {
            console.error("Error loading places:", err);

            if (!isMountedRef.current) return;

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
        } finally {
            if (currentFetchId === fetchIdRef.current && isMountedRef.current) {
                setLoading(false);
                setInitialLoad(false);
                isFetchingRef.current = false;
            }
        }
    }, [locationReady, location, searchRadius, dynamicLimit, networkInfo.isSlowConnection,
        getCacheKey, cacheManager, preloadImages, showToast]);

    // ========== LOAD DATA AFTER MOUNTED ==========
    useEffect(() => {
        if (mounted && !showSplash && !initialLoadDoneRef.current && !cacheLoadedRef.current) {
            initialLoadDoneRef.current = true;
            loadPlaces(true, false);
        }
    }, [mounted, showSplash, loadPlaces]);

    // ========== INFINITE SCROLL FOR SNAP SCROLL ==========
    useEffect(() => {
        if (activeIndex >= orderedIds.length - 3 && hasMore && !loading && !initialLoad && isOnline) {
            loadPlaces(false);
        }
    }, [activeIndex, orderedIds.length, hasMore, loading, initialLoad, loadPlaces, isOnline]);

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

    // ========== LISTENER REFRESH FEED ==========
    useEffect(() => {
        const handleRefreshFeed = async () => {
            cacheManager.invalidate();
            await loadPlaces(true);
            snapToIndex(0, 'smooth');
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

    // ========== HANDLERS ==========
    const handleSearchWithQuery = useCallback((q, item = null) => {
        setInitialQuery(q);
        setSelectedTempat(item);
        setSelectedUploadSuccess(null);
        setAiContext("search");
        setShowAIModal(true);
    }, []);

    const handleLocationChanged = useCallback(async () => {
        sessionStorage.setItem('location_changed', 'true');
        setIsTransitioningLocation(true);

        cacheManager.invalidate();
        sessionStorage.removeItem('feed_backup');
        sessionStorage.removeItem('last_location_key');

        const keysToRemove = [];
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key && key.startsWith('feed_v2_')) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => sessionStorage.removeItem(key));

        setComments({});
        if (containerRef.current) {
            containerRef.current.scrollTop = 0;
        }

        window.location.reload();
    }, [cacheManager, containerRef]);

    const handleManualLocationSelect = useCallback(async (selectedLocation) => {
        setManualLocation(selectedLocation);
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
        if (containerRef.current) {
            containerRef.current.scrollTop = 0;
        }
        snapToIndex(0, 'auto');
        loadPlaces(true);
        showToast(`🔍 Radius ${newRadius}km`);
    }, [cacheManager, loadPlaces, showToast, snapToIndex, containerRef]);

    const handleSearchSelect = useCallback((item) => {
        if (!item) return;
        setShowSearchModal(false);

        if (containerRef.current) {
            containerRef.current.scrollTop = 0;
        }

        setItemsMap(prev => {
            const newMap = new Map(prev);
            newMap.set(item.id, item);
            return newMap;
        });

        setOrderedIds(prev => [item.id, ...prev.filter(id => id !== item.id)]);
        setSelectedTempat(item);

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

    // ========== RENDER ==========
    if (!mounted || !viewportReady) {
        return null;
    }

    if (showSplash && !isStandalone) {
        return <SplashScreen onComplete={handleSplashComplete} />;
    }

    if (initialLoad) {
        return <SkeletonLoader />;
    }

    if (error) {
        return (
            <ErrorState
                error={error}
                onRetry={retryLoad}
                onExpandRadius={handleExpandRadius}
                isOnline={isOnline}
            />
        );
    }

    return (
        <>
            <Head>
                <title>Feed - Temukan tempat terbaru di sekitarmu</title>
                <meta name="description" content="Temukan dan bagikan pengalaman di tempat-tempat terbaru di sekitarmu" />
                <meta property="og:title" content="Feed - Lokalita" />
                <meta property="og:description" content="Temukan tempat terbaru di sekitarmu" />
            </Head>

            <main
                className="relative bg-black mx-auto w-full max-w-[420px] overflow-hidden"
                suppressHydrationWarning
                style={{ height: viewportHeight }}
            >
                {/* Header */}
                <div className="fixed top-0 left-0 right-0 z-50 w-full max-w-[420px] mx-auto">
                    <Header
                        className="bg-black/80 backdrop-blur-lg border-b border-white/10"
                        user={user}
                        isAdmin={isAdmin}
                        onOpenAuthModal={() => setIsAuthModalOpen(true)}
                        locationReady={locationReady}
                        villageLocation={villageLocation}
                        districtLocation={districtLocation}
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
                </div>

                {/* Snap Scroll Container */}
                <div
                    ref={containerRef}
                    className="snap-container w-full overflow-y-scroll flex flex-col scrollbar-none pt-[70px] pb-[90px]"
                    style={{
                        scrollSnapType: 'y mandatory',
                        WebkitOverflowScrolling: 'touch',
                        height: viewportReady ? viewportHeight : '100dvh',
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none'
                    }}
                >
                    <AnimatePresence initial={false} mode="popLayout">
                        {shouldShowEmptyState ? (
                            <div className="w-full h-full flex items-center justify-center flex-shrink-0">
                                <EmptyState
                                    onRefresh={() => loadPlaces(true)}
                                    onExpandRadius={handleExpandRadius}
                                    isOnline={isOnline}
                                />
                            </div>
                        ) : (
                            tempat.map((item, index) => {
                                const isActive = activeIndex === index;

                                return (
                                    <div
                                        key={item.id}
                                        className="snap-item relative w-full flex-shrink-0 px-4 flex items-center justify-center"
                                        style={{
                                            scrollSnapAlign: 'center',
                                            scrollSnapStop: 'always',
                                            height: viewportReady ? `calc(${viewportHeight} * 0.75)` : '75dvh'
                                        }}
                                    >
                                        <div className="w-full max-w-[420px] mx-auto">
                                            <FeedCardWrapper isActive={isActive}>
                                                <SimpleErrorBoundary
                                                    item={item}
                                                    onRetry={() => loadPlaces(true)}
                                                >
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
                                                </SimpleErrorBoundary>
                                            </FeedCardWrapper>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </AnimatePresence>

                    {/* Loading indicator */}
                    {loading && !initialLoad && !error && (
                        <div className="w-full py-6 flex items-center justify-center flex-shrink-0">
                            <InvisibleLoading />
                        </div>
                    )}

                    {/* End of feed */}
                    {!hasMore && tempat.length > 0 && !loading && (
                        <div className="w-full py-6 flex-shrink-0">
                            <EndOfFeed />
                        </div>
                    )}
                </div>

                {/* Modals */}
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

                {/* Loading overlay */}
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
                    {showSearchModal && (
                        <SearchModal
                            isOpen={showSearchModal}
                            onClose={() => setShowSearchModal(false)}
                            onSelectTempat={handleSearchSelect}
                            onOpenAIModal={handleSearchWithQuery}
                            allData={tempat}
                            theme={theme}
                            villageLocation={villageLocation}
                        />
                    )}
                </Suspense>

                <Suspense fallback={null}>
                    {showAIModal && (
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
                    )}
                </Suspense>

                <Suspense fallback={null}>
                    {showKomentarModal && (
                        <KomentarModal
                            isOpen={showKomentarModal}
                            onClose={closeModals}
                            tempat={selectedTempat}
                            isAdmin={isAdmin}
                        />
                    )}
                </Suspense>

                {/* Bottom Nav */}
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

                {!isPWAInstalled && <PWAInstaller />}
            </main>
        </>
    );
}