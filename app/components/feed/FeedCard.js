"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { ChevronRight, Heart, Share2, MessageCircle } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import PhotoSlider from "./PhotoSlider";
import LiveInsight from "./LiveInsight";
import StatusIsland from "./StatusIsland";
import StoryCircle from "@/app/components/feed/StoryCircle";
import StoryModal from "@/app/components/feed/StoryModal";
import ImmersiveLightbox from "@/components/ImmersiveLightbox";
import { processFeedItem } from "../../../lib/feedEngine";
import { useTheme } from "@/app/hooks/useTheme";
import { supabase } from "@/lib/supabaseClient";
import { useExternalSignals } from '@/hooks/useExternalSignals';
import { getCategoryStyle } from "@/lib/feedStyles";

// ==================== ANIMATION CONSTANTS ====================
const CARD_ANIMATION = {
  initial: { opacity: 0, y: 20, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -20, scale: 0.98 },
  transition: { duration: 0.4, type: "spring", stiffness: 300, damping: 25 }
};

const HOVER_SCALE = { scale: 1.01 };
const HOVER_SHADOW = { boxShadow: "0 20px 40px -12px rgba(0,0,0,0.3)" };
const PULSE_ANIMATION = {
  animate: {
    scale: [1, 1.05, 1],
    opacity: [0.8, 1, 0.8]
  },
  transition: { repeat: Infinity, duration: 2 }
};

const GLOW_ANIMATION = {
  animate: {
    boxShadow: [
      "0 0 0px rgba(229, 62, 62, 0)",
      "0 0 20px rgba(229, 62, 62, 0.5)",
      "0 0 0px rgba(229, 62, 62, 0)"
    ]
  },
  transition: { repeat: Infinity, duration: 2, repeatDelay: 1 }
};

// ==================== HOOKS ====================
const useWindowSize = () => {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 375,
    height: typeof window !== 'undefined' ? window.innerHeight : 667,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let timeoutId;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setWindowSize({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  return windowSize;
};

const usePrefersReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReducedMotion;
};

// ==================== UTILITIES ====================
const safeArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object' && value !== null) {
    const possibleArray = Object.values(value);
    if (possibleArray.length > 0 && possibleArray.every(v => v !== undefined)) {
      return possibleArray;
    }
  }
  return [];
};

// ==================== TIME CONTEXT ====================
const TimeContext = React.createContext({ hour: '00', minute: '00' });

export const TimeProvider = ({ children }) => {
  const [currentTime, setCurrentTime] = useState(() => {
    const now = new Date();
    return {
      hour: now.getHours().toString().padStart(2, '0'),
      minute: now.getMinutes().toString().padStart(2, '0')
    };
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTime({
        hour: now.getHours().toString().padStart(2, '0'),
        minute: now.getMinutes().toString().padStart(2, '0')
      });
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <TimeContext.Provider value={currentTime}>
      {children}
    </TimeContext.Provider>
  );
};

// ==================== VIRAL BADGE ====================
const ViralBadge = memo(() => {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <motion.div
      {...(prefersReducedMotion ? {} : GLOW_ANIMATION)}
      className="bg-gradient-to-r from-red-600 to-orange-500 text-white text-[7px] sm:text-[8px] px-2 sm:px-3 py-1 rounded-full font-black flex items-center gap-1"
    >
      {!prefersReducedMotion && (
        <motion.span
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ repeat: Infinity, duration: 1.5, repeatDelay: 0.5 }}
        >
          🔥
        </motion.span>
      )}
      {prefersReducedMotion && <span>🔥</span>}
      VIRAL
    </motion.div>
  );
});

ViralBadge.displayName = 'ViralBadge';

// ==================== DISTANCE BADGE ====================
const DistanceBadge = memo(({ distance, theme }) => {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl backdrop-blur-md ${theme.isMalam ? "bg-black/50" : "bg-black/30"} border border-white/20`}
    >
      <p
        className={`text-[8px] sm:text-[9px] font-black text-white whitespace-nowrap flex items-center gap-1`}
        {...(!prefersReducedMotion && {
          animate: { x: [0, -2, 2, 0] },
          transition: { repeat: Infinity, duration: 3, repeatDelay: 2 }
        })}
      >
        📍 {distance}
      </p>
    </motion.div>
  );
});

DistanceBadge.displayName = 'DistanceBadge';

// ==================== PREMIUM ACTION BUTTON (SINKRON SIANG/MALAM) ====================
const PremiumActionButton = memo(({ onClick, icon: Icon, label, theme }) => {
  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleClick}
      className={`
        flex-1 py-2.5 px-3 rounded-xl font-bold text-sm transition-all duration-300
        flex items-center justify-center gap-1
        focus:outline-none focus:ring-2 focus:ring-emerald-500/50
        ${theme.isMalam
          ? 'bg-white/10 hover:bg-white/20 text-white' // Mode Malam: Transparan mbois, text putih
          : 'bg-black/5 hover:bg-black/10 text-gray-800 border border-black/10' // Mode Siang: Ada kotak border tipis & text tegas!
        }
      `}
      aria-label={label}
    >
      {/* Icon otomatis manut warna text pembungkusnya */}
      <Icon size={16} className="transition-colors duration-300" aria-hidden="true" />
      <span className="text-[11px] sm:text-sm tracking-wide whitespace-nowrap">{label}</span>
    </motion.button>
  );
});

PremiumActionButton.displayName = 'PremiumActionButton';

// ==================== COCOK LUR (VALIDATION) BUTTON ====================
// Berfungsi sebagai tombol kesepakatan warga jika info/kondisi tempat dirasa sesuai asli.
const ValidationButton = memo(({
  tempatId,
  validationCount,
  theme,
  onValidateChange,
  userId,
}) => {
  const [isValidated, setIsValidated] = useState(false);
  const [currentCount, setCurrentCount] = useState(validationCount);
  const [isLoading, setIsLoading] = useState(false);
  const isMounted = useRef(true);
  const processingRef = useRef(false); // Anti double-klik / spam

  // Sync dengan properti dari parent jika ada perubahan data eksternal
  useEffect(() => {
    setCurrentCount(validationCount);
  }, [validationCount]);

  // ========== FETCH INITIAL STATUS DATA ==========
  const fetchValidationStatus = useCallback(async () => {
    if (!tempatId || !userId) return;

    try {
      const { data: minatData, error: minatError } = await supabase
        .from("minat")
        .select("created_at")
        .eq("tempat_id", tempatId)
        .eq("user_id", userId)
        .maybeSingle();

      if (minatError) throw minatError;

      const { data: tempatData, error: tempatError } = await supabase
        .from("tempat")
        .select("vibe_count")
        .eq("id", tempatId)
        .single();

      if (tempatError) throw tempatError;

      if (isMounted.current) {
        setIsValidated(!!minatData);
        setCurrentCount(tempatData?.vibe_count || 0);
      }
    } catch (error) {
      console.error("Gagal sinkronisasi data setempat:", error);
    }
  }, [tempatId, userId]);

  useEffect(() => {
    isMounted.current = true;
    fetchValidationStatus();

    return () => {
      isMounted.current = false;
    };
  }, [fetchValidationStatus]);

  // ========== HANDLE TOGGLE KESEPAKATAN LOKAL ==========
  const handleValidation = useCallback(async () => {
    // Cegah aksi beruntun sebelum proses selesai
    if (processingRef.current || isLoading) return;

    if (!userId) {
      window.dispatchEvent(new CustomEvent('open-auth-modal'));
      return;
    }

    processingRef.current = true;
    setIsLoading(true);

    const wasValidated = isValidated;
    const newIsValidated = !wasValidated;

    // OPTIMISTIC UPDATE: Langsung kalkulasi angka, batasi minimal di angka 0
    const newCount = newIsValidated
      ? currentCount + 1
      : Math.max(0, currentCount - 1);

    // Pasang ke UI lokal secara instan
    setIsValidated(newIsValidated);
    setCurrentCount(newCount);

    if (onValidateChange) {
      onValidateChange(newIsValidated, newCount);
    }

    try {
      if (wasValidated) {
        // JIKA SEBELUMNYA SUDAH COCOK -> MAKA BATALKAN (DELETE & DECREMENT)
        const { error: deleteError } = await supabase
          .from("minat")
          .delete()
          .eq("tempat_id", tempatId)
          .eq("user_id", userId);

        if (deleteError) throw deleteError;

        const { error: decError } = await supabase
          .rpc('increment_vibe_count', {
            p_tempat_id: tempatId,
            p_increment: -1
          });

        if (decError) throw decError;
      } else {
        // JIKA BELUM COCOK -> DAFTARKAN (INSERT & INCREMENT)
        const { error: insertError } = await supabase
          .from("minat")
          .insert({
            tempat_id: tempatId,
            user_id: userId,
            created_at: new Date().toISOString()
          });

        if (insertError) throw insertError;

        const { error: incError } = await supabase
          .rpc('increment_vibe_count', {
            p_tempat_id: tempatId,
            p_increment: 1
          });

        if (incError) throw incError;
      }

      // Ambil data terbaru dari db untuk memastikan akurasi background data
      await fetchValidationStatus();

    } catch (error) {
      console.error("Gagal memproses kesepakatan warga:", error);

      // ROLLBACK STATE: Kembalikan ke angka semula jika jaringan/db error
      if (isMounted.current) {
        setIsValidated(wasValidated);
        setCurrentCount(currentCount);
        if (onValidateChange) {
          onValidateChange(wasValidated, currentCount);
        }

        // Munculkan notifikasi error tipis tanpa merusak UI
        window.dispatchEvent(new CustomEvent('show-toast', {
          detail: { message: 'Waduh, koneksi bermasalah. Coba maneh, Lur!', type: 'error' }
        }));
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
        // Beri jeda 300ms sebelum tombol bisa diklik kembali
        setTimeout(() => { processingRef.current = false; }, 300);
      }
    }
  }, [userId, tempatId, isValidated, currentCount, isLoading, onValidateChange, fetchValidationStatus]);

  return (
    <motion.button
      onClick={handleValidation}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`
  flex-1 py-2.5 px-3 rounded-xl font-bold text-sm
  flex items-center justify-center gap-1
  transition-all duration-300 focus:outline-none
  ${isValidated
          ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20'
          : theme.isMalam
            ? 'bg-white/10 hover:bg-white/20 text-white' // Mode Malam: Transparan putih, tulisan putih
            : 'bg-black/5 hover:bg-black/10 text-gray-800 border border-black/10' // Mode Terang/Siang: Transparan hitam, tulisan gelap
        }
  ${isLoading ? 'opacity-80 cursor-wait' : 'cursor-pointer'}
`}
      aria-label={isValidated ? 'Batal menyatakan cocok' : 'Nyatakan cocok dengan kondisi tempat'}
    >
      <motion.span
        animate={isValidated && !isLoading ? { scale: [1, 1.2, 1] } : {}}
        transition={{ duration: 0.3 }}
        className="text-base"
      >
        {isValidated ? "🤝" : "👌"}
      </motion.span>

      <span className="text-[11px] sm:text-sm tracking-wide whitespace-nowrap">
        {isValidated
          ? `Saksi Warga (${currentCount})`
          : `Bener ta? (${currentCount})`
        }
      </span>
    </motion.button>
  );
});

ValidationButton.displayName = 'ValidationButton';

// ==================== PREMIUM LIKE BUTTON (Tanpa useAuth) ====================
const PremiumLikeButton = memo(({
  tempatId,
  initialLikeCount,
  theme,
  onLikeChange,
  userId,
}) => {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(initialLikeCount || 0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const isMounted = useRef(true);
  const isSubmitting = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    const checkLikeStatus = async () => {
      if (!userId || !tempatId) return;

      try {
        const { data, error } = await supabase
          .from('likes')
          .select('id')
          .eq('tempat_id', tempatId)
          .eq('user_id', userId)
          .maybeSingle();

        if (!error && data && isMounted.current) {
          setIsLiked(true);
        }
      } catch (error) {
        console.error('Error checking like status:', error);
      }
    };

    checkLikeStatus();
  }, [userId, tempatId]);

  const handleLike = useCallback(async () => {
    if (!userId) {
      window.dispatchEvent(new CustomEvent('open-auth-modal'));
      return;
    }

    if (isLoading || isSubmitting.current) return;

    setError(null);
    setIsLoading(true);
    isSubmitting.current = true;

    const newIsLiked = !isLiked;
    const newCount = newIsLiked ? likeCount + 1 : likeCount - 1;

    // Optimistic update
    setIsLiked(newIsLiked);
    setLikeCount(newCount);
    if (onLikeChange) onLikeChange(newIsLiked, newCount);

    try {
      // Gunakan transaction atau RPC tunggal
      if (newIsLiked) {
        const { error } = await supabase.rpc('toggle_like', {
          p_tempat_id: tempatId,
          p_user_id: userId,
          p_action: 'add'
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc('toggle_like', {
          p_tempat_id: tempatId,
          p_user_id: userId,
          p_action: 'remove'
        });
        if (error) throw error;
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      setError('Gagal menyukai. Coba lagi nanti.');

      // Rollback
      setIsLiked(!newIsLiked);
      setLikeCount(likeCount);
      if (onLikeChange) onLikeChange(!newIsLiked, likeCount);
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
        isSubmitting.current = false;
        setTimeout(() => setError(null), 3000);
      }
    }
  }, [userId, tempatId, isLiked, likeCount, onLikeChange]);

  return (
    <div className="relative flex-1">
      <motion.button
        whileHover={{ scale: 1.05, y: -2 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleLike}
        disabled={isLoading}
        className={`
          w-full py-2.5 rounded-xl font-medium text-sm transition-all
          flex items-center justify-center gap-2
          focus:outline-none focus:ring-2 focus:ring-white/50
          ${isLiked
            ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-lg shadow-red-500/25'
            : 'bg-white/10 hover:bg-white/20'
          }
          ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        aria-label={isLiked ? 'Batal suka' : 'Suka'}
        aria-busy={isLoading}
      >
        <motion.div
          animate={isLiked && !isLoading ? { scale: [1, 1.3, 1], rotate: [0, 15, -15, 0] } : {}}
          transition={{ duration: 0.3 }}
        >
          <Heart
            size={16}
            className={isLiked ? "fill-white text-white" : theme.text}
            aria-hidden="true"
          />
        </motion.div>
        <span className={`text-[10px] sm:text-sm whitespace-nowrap ${isLiked ? 'text-white' : theme.text}`}>
          {`Suka (${likeCount})`}
        </span>
      </motion.button>
      {error && (
        <div className="absolute -bottom-6 left-0 right-0 text-center">
          <span className="text-xs text-red-500 bg-black/50 px-2 py-1 rounded">
            {error}
          </span>
        </div>
      )}
    </div>
  );
});

PremiumLikeButton.displayName = 'PremiumLikeButton';

// ==================== SKELETON ====================
const PhotoSliderSkeleton = memo(() => (
  <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 animate-pulse" />
));

PhotoSliderSkeleton.displayName = 'PhotoSliderSkeleton';

// ==================== DEFAULT ITEM ====================
const DEFAULT_ITEM = {
  id: 0,
  name: "",
  alamat: "",
  category: "",
  vibe_count: 0,
  photos: [],
  laporan_terbaru: [],
  status: "",
  isViral: false,
  isRamai: false,
};

// ==================== OPTIMIZED STATE HOOK ====================
const useOptimizedState = () => {
  const [uiState, setUiState] = useState({
    isHovered: false,
    isLightboxOpen: false,
    isExpanded: false,
    isStoryModalOpen: false,
    isVisible: false,
  });

  const [lightboxData, setLightboxData] = useState({
    items: [],
    index: 0,
  });

  const [localData, setLocalData] = useState({
    validationCount: 0,
    laporanWarga: [],
    activeStories: [],
  });

  const setUiStateOptimized = useCallback((updates) => {
    setUiState(prev => ({ ...prev, ...updates }));
  }, []);

  const setLightboxDataOptimized = useCallback((updates) => {
    setLightboxData(prev => ({ ...prev, ...updates }));
  }, []);

  const setLocalDataOptimized = useCallback((updates) => {
    setLocalData(prev => ({ ...prev, ...updates }));
  }, []);

  return {
    uiState,
    setUiState: setUiStateOptimized,
    lightboxData,
    setLightboxData: setLightboxDataOptimized,
    localData,
    setLocalData: setLocalDataOptimized,
  };
};

// ==================== MAIN FEED CARD COMPONENT ====================
function FeedCardV2Premium({
  item = DEFAULT_ITEM,
  isDetail = false,
  showAIButton = true,
  showStatusIsland = true,
  showLiveInsight = true,
  locationReady,
  location,
  displayLocation,
  tempat = [],
  comments = {},
  selectedPhotoIndex = {},
  setSelectedPhotoIndex,
  openAIModal,
  openKomentarModal,
  onShare,
  onRefreshNeeded,
  priority = false,
  cardIndex = 0,
  userProfile,
  userAvatar,
}) {

  const { user } = useAuth();
  const safeItem = useMemo(() => {
    if (!item || typeof item !== 'object') return DEFAULT_ITEM;
    return {
      ...DEFAULT_ITEM,
      ...item,
      photos: safeArray(item.photos)
    };
  }, [item]);

  const tempatId = safeItem.id;
  const userId = user?.id;
  const theme = useTheme();
  const catStyle = getCategoryStyle(safeItem.category, theme.isMalam);
  const router = useRouter();
  const prefersReducedMotion = usePrefersReducedMotion();
  const { width: windowWidth } = useWindowSize();
  const isNarrow = windowWidth < 380;
  const { hour: currentHour, minute: currentMinute } = React.useContext(TimeContext);

  const {
    uiState,
    setUiState,
    lightboxData,
    setLightboxData,
    localData,
    setLocalData,
  } = useOptimizedState();

  const {
    isHovered,
    isLightboxOpen,
    isExpanded,
    isStoryModalOpen,
    isVisible,
  } = uiState;

  const {
    items: lightboxItems,
    index: lightboxIndex,
  } = lightboxData;

  const {
    validationCount: localValidationCount,
    laporanWarga: localLaporanWarga,
    activeStories,
  } = localData;

  const cardRef = useRef(null);
  const observerRef = useRef(null);
  const channelRef = useRef(null);
  const isMounted = useRef(true);
  const timeoutRef = useRef(null);
  const hasFetchedData = useRef(false);

  const { externalSignals } = useExternalSignals(tempatId, {
    limit: 10,
    verifiedOnly: false
  });

  const handleLocalRefresh = useCallback(() => {
    if (onRefreshNeeded) onRefreshNeeded();
    router.refresh();
  }, [onRefreshNeeded, router]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, []);

  // Intersection Observer
  useEffect(() => {
    const currentCard = cardRef.current;
    if (!currentCard) return;

    const initObserver = () => {
      observerRef.current = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && isMounted.current) {
            setUiState({ isVisible: true });
            observerRef.current?.disconnect();
          }
        },
        { threshold: 0.05, rootMargin: "500px" }
      );
      observerRef.current.observe(currentCard);
    };

    timeoutRef.current = setTimeout(initObserver, 0);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [setUiState]);

  // Fetch laporan warga
  useEffect(() => {
    if (!tempatId || !isVisible || hasFetchedData.current) return;

    hasFetchedData.current = true;

    const fetchLaporanWarga = async () => {
      try {
        const { data, error } = await supabase
          .from('laporan_warga')
          .select('*, user_avatar, deskripsi, user_name, photo_url')
          .eq('tempat_id', tempatId)
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .limit(20);

        if (data && !error && isMounted.current) {
          setLocalData({ laporanWarga: data });
        }
      } catch (error) {
        console.error('Error fetching laporan warga:', error);
      }
    };

    fetchLaporanWarga();

    const uniqueId = `${tempatId}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const channelId = `feed_lw_${uniqueId}`;

    const channel = supabase
      .channel(channelId)
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'laporan_warga',
          filter: `tempat_id=eq.${tempatId}`
        },
        (payload) => {
          if (isMounted.current && payload.new) {
            setLocalData(prev => ({
              ...prev,
              laporanWarga: [payload.new, ...prev.laporanWarga].slice(0, 50)
            }));
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [tempatId, isVisible, setLocalData]);

  useEffect(() => {
    if (!tempatId) return;

    // Hanya subscribe ke field lain yang perlu realtime, BUKAN vibe_count
    const channel = supabase
      .channel(`tempat_status_${tempatId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tempat',
        filter: `id=eq.${tempatId}`
      }, (payload) => {
        // Update hanya untuk status, isViral, isRamai
        // JANGAN update validationCount
        console.log('🔄 Real-time: status updated to', payload.new?.status);
        // setLocalData prev => ({ ...prev, status: payload.new?.status }); // jika perlu
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tempatId]); // Hapus setLocalData dari dependencies

  const totalSaksi = useMemo(() => localValidationCount + (safeItem.vibe_count || 0), [localValidationCount, safeItem.vibe_count]);

  const feed = useMemo(() => {
    try {
      return processFeedItem({ item: safeItem, comments, locationReady, location });
    } catch (error) {
      console.error('Error processing feed item:', error);
      return null;
    }
  }, [safeItem.id, safeItem.vibe_count, safeItem.status, safeItem.isViral, safeItem.isRamai, comments, locationReady, location?.latitude, location?.longitude]);

  const allSignals = useMemo(() => {
    const combined = [...(localLaporanWarga || []), ...(externalSignals || [])];
    return combined.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [localLaporanWarga, externalSignals]);

  const handlePhotoClick = useCallback((photos, currentIndex) => {
    if (!photos || !Array.isArray(photos)) return;
    const items = photos.map(p => ({
      url: p.url || p,
      caption: p.caption,
      created_at: p.created_at,
    }));
    setLightboxData({ items, index: currentIndex });
    setUiState({ isLightboxOpen: true });
  }, [setLightboxData, setUiState]);

  const handleSesuai = useCallback(async () => {
    if (!safeItem.id) return;
    const previousCount = localValidationCount;
    setLocalData({ validationCount: localValidationCount + 1 });
    try {
      await supabase.from("minat").insert([{ tempat_id: safeItem.id }]);
    } catch (e) {
      setLocalData({ validationCount: previousCount });
      console.error(e);
    }
  }, [safeItem.id, localValidationCount, setLocalData]);

  const handleOpenStoryModal = useCallback((id, stories) => {
    const safeStories = (stories || []).map((s) => ({
      ...s,
      url: s.url || s.photo_url || s.image_url
    }));
    setLocalData({ activeStories: safeStories });
    setUiState({ isStoryModalOpen: true });
  }, [setLocalData, setUiState]);

  const handleUploadSuccess = useCallback((newLaporan) => {
    if (!newLaporan) return;
    setLocalData(prev => ({
      ...prev,
      laporanWarga: prev.laporanWarga.some((l) => l.id === newLaporan.id)
        ? prev.laporanWarga
        : [newLaporan, ...prev.laporanWarga].slice(0, 50)
    }));
    requestAnimationFrame(() => {
      setLocalData(prev => ({
        ...prev,
        activeStories: [newLaporan, ...prev.activeStories].map((s) => ({
          ...s,
          url: s.url || s.photo_url || s.image_url
        }))
      }));
      setUiState({ isStoryModalOpen: true });
    });
    handleLocalRefresh();
  }, [handleLocalRefresh, setLocalData, setUiState]);

  const handleOpenAIModal = useCallback(() => {
    if (openAIModal) {
      openAIModal(safeItem, handleUploadSuccess);
    }
  }, [openAIModal, safeItem, handleUploadSuccess]);

  const handleCloseStoryModal = useCallback(() => setUiState({ isStoryModalOpen: false }), [setUiState]);
  const handleCloseLightbox = useCallback(() => setUiState({ isLightboxOpen: false }), [setUiState]);
  const handleHoverStart = useCallback(() => setUiState({ isHovered: true }), [setUiState]);
  const handleHoverEnd = useCallback(() => setUiState({ isHovered: false }), [setUiState]);

  const handleGoToDetail = useCallback(() => {
    if (isDetail) return;
    const scrollY = window.scrollY;
    sessionStorage.setItem(`feed_scroll_${safeItem.id}`, scrollY.toString());
    sessionStorage.setItem(`feed_return_category`, safeItem.category || 'all');
    router.push(`/post/${safeItem.id}`);
  }, [router, safeItem.id, safeItem.category, isDetail]);

  const handleLikeChange = useCallback((isLiked, newCount) => { }, []);

  const handleValidationChange = useCallback((isValidated, newCount) => {
    console.log('✅ Validation changed:', { isValidated, newCount, tempatId: safeItem.id });

    // Update local state
    setLocalData(prev => ({
      ...prev,
      validationCount: newCount
    }));

    // Optional: Trigger refresh jika perlu
    if (onRefreshNeeded) {
      onRefreshNeeded();
    }
  }, [setLocalData, onRefreshNeeded, safeItem.id]);

  if (!item?.id && safeItem.id === 0) return null;

  const distanceText = feed?.distance ? `${feed.distance.toFixed(1)} KM` : "LIVE";
  const itemStatusClass = safeItem.isViral ? "viral" : safeItem.isRamai ? "ramai" : "biasa";

  const statusDisplay = useMemo(() => {
    const statusMap = {
      viral: { text: "VIRAL", bg: "bg-red-500/20", border: "border-red-500/30", dot: "bg-red-50" },
      ramai: { text: "RAME", bg: "bg-yellow-500/20", border: "border-yellow-500/30", dot: "bg-yellow-500" },
      biasa: { text: "NORMAL", bg: "bg-emerald-500/20", border: "border-emerald-500/30", dot: "bg-emerald-500" },
    };
    return statusMap[itemStatusClass] || statusMap.biasa;
  }, [itemStatusClass]);

  const paddingX = `px-4 ${!isNarrow ? 'sm:px-5' : ''}`;

  const cardAnimation = prefersReducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.2 } }
    : CARD_ANIMATION;

  const hoverAnimation = prefersReducedMotion ? {} : { whileHover: HOVER_SCALE };
  const hoverShadowAnimation = prefersReducedMotion ? {} : { whileHover: HOVER_SHADOW };
  const pulseAnimation = prefersReducedMotion ? {} : PULSE_ANIMATION;

  const getPinarakText = () => {
    const category = safeItem?.category?.toLowerCase() || '';
    const name = safeItem?.name || 'lokasi ini';

    if (category.includes('balai desa') || category.includes('kantor')) {
      return `Intip layanan & jeroane ${name}`;
    }
    if (category.includes('pasar') || category.includes('peken') || category.includes('toko')) {
      return `Cek rego & keramaian di ${name}`;
    }
    if (category.includes('kuliner') || category.includes('warung') || category.includes('kafe')) {
      return `Intip menu & suasana di ${name}`;
    }
    if (category.includes('wisata') || category.includes('taman')) {
      return `Delok pemandangan di ${name}`;
    }

    return `Monggo pinarak, pirsani kondisi terkini wonten ${name}`;
  };

  return (
    <motion.div
      ref={cardRef}
      id={`feed-card-${safeItem.id}`}
      layout={!prefersReducedMotion}
      {...cardAnimation}
      {...hoverAnimation}
      onHoverStart={handleHoverStart}
      onHoverEnd={handleHoverEnd}
      className="relative mb-4 sm:mb-5 w-full will-change-transform"
      style={{ isolation: "isolate" }}
    >
      <motion.div
        layout={!prefersReducedMotion}
        layoutId={`card-container-${safeItem.id}`}
        {...hoverShadowAnimation}
        className={`
          relative overflow-hidden
          rounded-2xl sm:rounded-3xl
          ${catStyle.border}
          ${catStyle.bg}
          flex flex-col 
          transition-all duration-300
          backdrop-blur-sm
          ${safeItem.isViral ? 'ring-2 ring-red-500/30' : ''}
          ${isHovered && !prefersReducedMotion ? 'shadow-2xl' : 'shadow-lg'}
        `}
      >
        <AnimatePresence>
          {isHovered && !prefersReducedMotion && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none z-0"
            />
          )}
        </AnimatePresence>

        {/* MEDIA SECTION - Otomatis dadi Hero sinematik lek nang halaman detail */}
        <div
          className="relative w-full overflow-hidden transition-all duration-500 ease-in-out"
          style={{
            aspectRatio: isDetail ? '16/10' : '1/1', // Lek detail dadi agak melebar kesamping, lek beranda tetep kotak mbois
            maxHeight: isDetail ? '45vh' : 'none'
          }}
        >
          {isVisible ? (
            <PhotoSlider
              photos={localLaporanWarga}
              officialPhotosData={safeItem.photos}
              tempatId={safeItem.id}
              namaTempat={safeItem.name}
              isHujan={safeItem.status === "hujan"}
              priority={priority}
              isDetail={isDetail} // Dioper rono gae ditekuk navigasine nang njero PhotoSlider
              className="w-full h-full object-cover"
              selectedPhotoIndex={selectedPhotoIndex?.[safeItem.id]}
              setSelectedPhotoIndex={(idx) => {
                if (setSelectedPhotoIndex) {
                  setSelectedPhotoIndex(prev => ({ ...prev, [safeItem.id]: idx }));
                }
              }}
              onUploadSuccess={handleUploadSuccess}
              onPhotoClick={handlePhotoClick}
            />
          ) : (
            <PhotoSliderSkeleton />
          )}

          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/40 pointer-events-none" />
          {/* FLOATING HEADER */}
          <div className="absolute top-0 left-0 right-0 p-5 z-20">
            <div className="flex justify-between items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-[10px] font-black text-white/90 uppercase tracking-[0.2em] drop-shadow-lg">
                    {catStyle.icon} {safeItem.category || 'Update Terkini'}
                  </span>
                  {safeItem.isViral && <ViralBadge />}
                </div>

                <h3 className="text-xl sm:text-2xl font-[1000] text-white uppercase tracking-tighter drop-shadow-2xl leading-tight">
                  <span className="text-cyan-400 mr-2">●</span>{safeItem.name}
                </h3>
              </div>

              <div className="flex-shrink-0">
                <DistanceBadge distance={distanceText} theme={{ ...theme, isMalam: true }} />
              </div>
            </div>
          </div>

          {/* STORY CIRCLE */}
          <motion.div
            className="absolute bottom-4 left-4 z-50"
            whileHover={!prefersReducedMotion ? { scale: 1.1 } : {}}
            {...(localLaporanWarga.length > 0 && !prefersReducedMotion ? pulseAnimation : {})}
          >
            <StoryCircle
              laporanWarga={localLaporanWarga}
              tempatId={safeItem.id}
              namaTempat={safeItem.name}
              theme={theme}
              openStoryModal={handleOpenStoryModal}
              onRefreshNeeded={handleLocalRefresh}
            />
          </motion.div>
        </div>

        {/* STATUS ISLAND */}
        {!isDetail && showStatusIsland && (
          <div className={`${paddingX} pt-4 pb-2`}>
            <StatusIsland
              item={safeItem}
              theme={theme}
              allReports={allSignals}
              isExpanded={isExpanded}
              setIsExpanded={(value) => setUiState({ isExpanded: value })}
              jumlahWarga={totalSaksi}
            />
          </div>
        )}

        {/* LIVE INSIGHT & ACTIONS */}
        <div className={`${paddingX} pb-4 sm:pb-6 space-y-3 sm:space-y-4`}>
          {!isDetail && showLiveInsight && isVisible && (
            <motion.div
              className={`${theme.statusBg} rounded-xl sm:rounded-2xl p-2.5 sm:p-3 border ${theme.border} shadow-inner`}
              whileHover={!prefersReducedMotion ? { y: -2 } : {}}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <LiveInsight
                signals={allSignals}
                theme={theme}
                isCompact={isNarrow}
                currentUser={userProfile}
                userProfile={userProfile}
                userAvatar={userAvatar}
                tempatCategory={safeItem?.category}
                tempatDescription={safeItem?.description || item?.description || null}
                tempatData={safeItem}
                tempatId={safeItem.id}
              />
            </motion.div>
          )}

          <div className="flex flex-col gap-3">
            {!isDetail && (
              <div className="flex gap-2">
                <ValidationButton
                  tempatId={safeItem.id}
                  validationCount={safeItem.vibe_count || 0}
                  theme={theme}
                  onValidateChange={handleValidationChange}
                  userId={userId}
                />
                <PremiumActionButton
                  onClick={() => openKomentarModal?.(safeItem)}
                  icon={MessageCircle}
                  label="Kata Warga"
                  theme={theme}
                />
                <PremiumActionButton
                  onClick={() => onShare?.(safeItem)}
                  icon={Share2}
                  label="Bagi"
                  theme={theme}
                />
              </div>
            )}

            {!isDetail && (
              <div className="flex flex-col gap-2">
                <p className={`text-[9px] font-medium italic opacity-50 px-1 ${theme.isMalam ? 'text-white' : 'text-black'}`}>
                  "{getPinarakText()}"
                </p>

                <motion.button
                  onClick={handleGoToDetail}
                  whileTap={{ scale: 0.97 }}
                  className={`
                    w-full py-4 rounded-xl
                    flex items-center justify-center gap-3
                    text-[10px] sm:text-[11px] font-black uppercase tracking-[0.25em]
                    transition-all duration-200
                    ${theme.isMalam
                      ? "bg-white text-black hover:bg-gray-100"
                      : "bg-black text-white hover:bg-zinc-800"
                    }
                  `}
                >
                  <span>PINARAK</span>
                  <motion.div
                    animate={{ x: [0, 3, 0] }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                  >
                    <ChevronRight size={16} strokeWidth={3} />
                  </motion.div>
                </motion.button>
              </div>
            )}
          </div>
        </div>

        <StoryModal
          isOpen={isStoryModalOpen}
          onClose={handleCloseStoryModal}
          stories={activeStories}
          theme={theme}
          namaTempat={safeItem.name}
        />
      </motion.div>

      <ImmersiveLightbox
        items={lightboxItems}
        initialIndex={lightboxIndex}
        isOpen={isLightboxOpen}
        onClose={handleCloseLightbox}
        tempatId={safeItem.id}
        namaTempat={safeItem.name}
        comments={comments}
        openKomentarModal={openKomentarModal}
        onShare={onShare}
        theme={theme}
        isSesuai={false}
        totalSaksi={totalSaksi}
        onSesuaiClick={handleSesuai}
        headline={feed?.headline?.text || ""}
        currentHour={currentHour}
        currentMinute={currentMinute}
        isViral={safeItem.isViral}
        catStyle={catStyle}
      />
    </motion.div>
  );
}

// ==================== MEMO COMPARISON ====================
const areEqual = (prevProps, nextProps) => {
  return (
    prevProps.item?.id === nextProps.item?.id &&
    prevProps.item?.vibe_count === nextProps.item?.vibe_count &&
    prevProps.item?.status === nextProps.item?.status &&
    prevProps.item?.photos?.length === nextProps.item?.photos?.length &&
    prevProps.selectedPhotoIndex?.[prevProps.item?.id] === nextProps.selectedPhotoIndex?.[nextProps.item?.id] &&
    prevProps.isDetail === nextProps.isDetail &&
    prevProps.showAIButton === nextProps.showAIButton &&
    JSON.stringify(prevProps.comments?.[prevProps.item?.id]) === JSON.stringify(nextProps.comments?.[nextProps.item?.id]) &&
    prevProps.location?.latitude === nextProps.location?.latitude &&
    prevProps.location?.longitude === nextProps.location?.longitude &&
    prevProps.userProfile?.id === nextProps.userProfile?.id
  );
};

export default memo(FeedCardV2Premium, areEqual);

// ==================== EXPORT TIME PROVIDER ====================
export { TimeProvider };