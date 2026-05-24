'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin, Search, ShieldCheck, Plus } from "lucide-react";
import SmartBottomNavWarga from "@/app/components/layout/SmartBottomNavWarga";
import LaporPanel from "@/app/components/ai/LaporPanel";
import { formatTimeAgo } from "@/utils/timeUtils";
import { useTheme } from "@/app/hooks/useTheme";
import { useLaporanWarga } from "@/hooks/useOptimizedFetch";
import UserMenu from "@/app/components/layout/UserMenu";
import AuthModal from "@/app/components/auth/AuthModal";
import { useAuth } from "@/app/context/AuthContext";
import AIModalTempat from "@/app/components/ai/AIModalTempat";
import FeedActions from "@/app/components/feed/FeedActions";
import KomentarModal from "@/app/components/feed/KomentarModal";
import MediaRenderer from "@/components/media/MediaRenderer";
import DOMPurify from 'dompurify';

// ========== UTILITY FUNCTIONS ==========

// Sanitasi teks untuk mencegah XSS
const sanitizeText = (text) => {
  if (!text) return '';
  return DOMPurify.sanitize(text, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|geo|spotify|youtube|skype):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
  });
};

// Validasi dan sanitasi URL avatar
const getSafeAvatarUrl = (report) => {
  try {
    if (report?.user_avatar && report.user_avatar.startsWith('https://')) {
      return report.user_avatar;
    }

    const name = report?.user_name || "Warga";
    const sanitizedName = sanitizeText(name).substring(0, 50);
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(sanitizedName)}&background=0D8ABC&color=fff&length=2`;
  } catch (error) {
    return 'https://ui-avatars.com/api/?name=Warga&background=0D8ABC&color=fff';
  }
};

// Rate limiting untuk views
const viewRateLimiter = new Map();

// Batch get view counts dengan timeout
const getBatchStoryViews = async (laporanIds) => {
  if (!laporanIds.length) return {};

  try {
    const { data, error } = await supabase
      .from("story_views")
      .select("laporan_id")
      .in("laporan_id", laporanIds);

    if (error) throw error;

    const counts = {};
    data?.forEach(view => {
      counts[view.laporan_id] = (counts[view.laporan_id] || 0) + 1;
    });
    return counts;
  } catch (err) {
    console.error("Error batch getting views:", err);
    return {};
  }
};

// ========== MAIN COMPONENT ==========

export default function CitizenHub({ userId, userRole }) {
  const { isMalam } = useTheme();
  const router = useRouter();
  const { user, isAdmin } = useAuth();

  const { data: reports, loading, refresh, updateCache } = useLaporanWarga({ limit: 50 });

  // State declarations
  const [currentIndex, setCurrentIndex] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showLaporPanel, setShowLaporPanel] = useState(false);
  const [selectedTempat, setSelectedTempat] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [sessionUserId, setSessionUserId] = useState(null);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isKomentarModalOpen, setIsKomentarModalOpen] = useState(false);
  const [selectedItemForComment, setSelectedItemForComment] = useState(null);
  const [selectedAITempat, setSelectedAITempat] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [cachedReports, setCachedReports] = useState(null);
  const [viewCounts, setViewCounts] = useState({});
  const [activeFilter, setActiveFilter] = useState("semua");

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Refs
  const modalScrollRef = useRef(null);
  const lastScrollYRef = useRef(0);
  const scrollTimeoutRef = useRef(null);
  const isAutoScrollingRef = useRef(false);
  const recordedViewsRef = useRef(new Set());
  const viewsLoadedRef = useRef(false);
  const recordViewTimeoutRef = useRef(null);
  const scrollIntoViewTimeoutRef = useRef(null);

  // Computed values
  const activeUserId = userId || sessionUserId;

  const displayReports = useMemo(() =>
    cachedReports || reports || [],
    [cachedReports, reports]
  );

  const isActuallyLoading = loading && !cachedReports;

  // ========== EFFECTS ==========

  // Load dari cache dengan validasi
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem('citizenhub_reports');
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Array.isArray(data) && data.length && (Date.now() - timestamp) < 5 * 60 * 1000) {
          setCachedReports(data);
        }
      }
    } catch (e) {
      console.error('Cache read error:', e);
      sessionStorage.removeItem('citizenhub_reports');
    }
  }, []);

  // Batch load view counts
  useEffect(() => {
    if (!displayReports.length || viewsLoadedRef.current) return;

    const loadViewCountsBatch = async () => {
      const reportIds = displayReports.map(r => r.id).filter(Boolean);
      if (!reportIds.length) return;

      const counts = await getBatchStoryViews(reportIds);
      setViewCounts(counts);
      viewsLoadedRef.current = true;
    };

    loadViewCountsBatch();
  }, [displayReports]);

  // Theme configuration
  const theme = useMemo(() => ({
    isMalam: isMalam,
    text: isMalam ? 'text-white' : 'text-gray-900',
    bg: isMalam ? 'bg-zinc-900' : 'bg-white',
    border: isMalam ? 'border-white/10' : 'border-gray-100',
  }), [isMalam]);

  // Filter reports dengan sanitasi
  const filteredReports = useMemo(() => {
    let result = displayReports;

    if (searchQuery) {
      const searchLower = sanitizeText(searchQuery).toLowerCase();
      result = result.filter(r =>
        r.display_location_name?.toLowerCase().includes(searchLower) ||
        r.deskripsi?.toLowerCase().includes(searchLower)
      );
    }

    if (activeFilter !== "semua") {
      result = result.filter(r => r.tipe?.toLowerCase() === activeFilter);
    }

    return result;
  }, [displayReports, searchQuery, activeFilter]);

  // Record view dengan rate limiting dan debounce
  const recordStoryView = useCallback(async (laporanId) => {
    if (!activeUserId || !laporanId) return;

    // Rate limiting: cek cooldown
    const lastRecordTime = viewRateLimiter.get(laporanId);
    if (lastRecordTime && Date.now() - lastRecordTime < 5000) {
      return; // Skip jika kurang dari 5 detik
    }

    if (recordedViewsRef.current.has(laporanId)) return;

    recordedViewsRef.current.add(laporanId);
    viewRateLimiter.set(laporanId, Date.now());

    try {
      const { data: existingView, error: checkError } = await supabase
        .from("story_views")
        .select("id")
        .eq("laporan_id", laporanId)
        .eq("user_id", activeUserId)
        .maybeSingle();

      if (checkError) throw checkError;

      if (!existingView) {
        const { error: insertError } = await supabase
          .from("story_views")
          .insert({
            laporan_id: laporanId,
            user_id: activeUserId,
            viewed_at: new Date().toISOString()
          });

        if (insertError) throw insertError;

        setViewCounts(prev => ({
          ...prev,
          [laporanId]: (prev[laporanId] || 0) + 1
        }));
      }
    } catch (err) {
      console.error("Error recording view:", err);
      recordedViewsRef.current.delete(laporanId);
    }
  }, [activeUserId]);

  // Record view dengan debounce
  useEffect(() => {
    if (recordViewTimeoutRef.current) {
      clearTimeout(recordViewTimeoutRef.current);
    }

    recordViewTimeoutRef.current = setTimeout(() => {
      if (currentIndex !== null && filteredReports[currentIndex]?.id) {
        recordStoryView(filteredReports[currentIndex].id);
      }
    }, 300);

    return () => {
      if (recordViewTimeoutRef.current) {
        clearTimeout(recordViewTimeoutRef.current);
      }
    };
  }, [currentIndex, filteredReports, recordStoryView]);

  // Header visibility dengan cleanup
  useEffect(() => {
    const handleScroll = () => {
      if (currentIndex !== null) return;

      const currentScrollY = window.scrollY;
      if (Math.abs(currentScrollY - lastScrollYRef.current) < 30) return;

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      scrollTimeoutRef.current = setTimeout(() => {
        if (currentScrollY > lastScrollYRef.current && currentScrollY > 100) {
          setIsHeaderVisible(false);
        } else if (currentScrollY < lastScrollYRef.current || currentScrollY < 50) {
          setIsHeaderVisible(true);
        }
        lastScrollYRef.current = currentScrollY;
      }, 50);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [currentIndex]);

  // Back button handler dengan safe scroll
  useEffect(() => {
    if (currentIndex === null) return;

    const handlePopState = (event) => {
      event.preventDefault();

      if (currentIndex > 0) {
        const prevIndex = currentIndex - 1;
        setCurrentIndex(prevIndex);

        // Safe scroll into view
        if (scrollIntoViewTimeoutRef.current) {
          clearTimeout(scrollIntoViewTimeoutRef.current);
        }

        scrollIntoViewTimeoutRef.current = setTimeout(() => {
          const targetElement = modalScrollRef.current?.children[prevIndex];
          if (targetElement && typeof targetElement.scrollIntoView === 'function') {
            targetElement.scrollIntoView({
              behavior: 'smooth',
              block: 'start'
            });
          }
        }, 100);
      } else {
        closeModal();
      }

      window.history.pushState(null, '', window.location.href);
    };

    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (scrollIntoViewTimeoutRef.current) {
        clearTimeout(scrollIntoViewTimeoutRef.current);
      }
    };
  }, [currentIndex]);

  // Get session dengan cleanup
  useEffect(() => {
    let isMounted = true;

    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!error && isMounted && session?.user?.id) {
          setSessionUserId(session.user.id);
        }
      } catch (err) {
        console.error("Session error:", err);
      }
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (isMounted && session?.user?.id) {
        setSessionUserId(session.user.id);
      } else if (isMounted && event === 'SIGNED_OUT') {
        setSessionUserId(null);
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  // Get user data dengan validasi
  useEffect(() => {
    let isMounted = true;

    const getCurrentUser = async () => {
      if (!activeUserId) return;

      try {
        const cached = sessionStorage.getItem(`user_${activeUserId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed === 'object') {
            if (isMounted) setCurrentUser(parsed);
            return;
          }
        }
      } catch (e) {
        console.error('Cache parse error:', e);
      }

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("username, full_name, avatar_url")
          .eq("id", activeUserId)
          .maybeSingle();

        const userData = (!error && data) ? {
          username: sanitizeText(data.username),
          full_name: sanitizeText(data.full_name),
          avatar_url: data.avatar_url?.startsWith('https://') ? data.avatar_url : null
        } : {
          username: `user_${activeUserId?.slice(0, 8) || "unknown"}`,
          full_name: "Warga",
          avatar_url: null
        };

        if (isMounted) {
          setCurrentUser(userData);
          try {
            sessionStorage.setItem(`user_${activeUserId}`, JSON.stringify(userData));
          } catch (e) {
            console.error('Storage save error:', e);
          }
        }
      } catch (err) {
        console.error("User fetch error:", err);
        if (isMounted) {
          setCurrentUser({
            username: `user_${activeUserId?.slice(0, 8) || "unknown"}`,
            full_name: "Warga",
            avatar_url: null
          });
        }
      }
    };

    getCurrentUser();

    return () => {
      isMounted = false;
    };
  }, [activeUserId]);

  // ========== HANDLERS ==========

  // 🔥 1. REFRESH DATA (DEFINISIKAN PERTAMA)
  const refreshData = useCallback(async () => {
    try {
      await refresh();
      // Clear cache
      try {
        sessionStorage.removeItem('citizenhub_reports');
      } catch (e) { }
      viewsLoadedRef.current = false;
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      console.error("Refresh error:", err);
    }
  }, [refresh]);

  // 🔥 2. EVENT LISTENER (SETELAH refreshData)
  useEffect(() => {
    const handleUploadSuccess = () => {
      refreshData();
    };

    window.addEventListener('refresh-citizenhub', handleUploadSuccess);

    return () => {
      window.removeEventListener('refresh-citizenhub', handleUploadSuccess);
    };
  }, [refreshData]);

  useEffect(() => {
    sessionStorage.removeItem('citizenhub_reports');
    refreshData();
  }, []);

  // 🔥 3. HANDLER LAINNYA
  const handleModalScroll = useCallback((e) => {
    if (isAutoScrollingRef.current) return;

    const container = e.target;
    const { scrollTop, clientHeight } = container;
    const newIndex = Math.round(scrollTop / clientHeight);

    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < filteredReports.length) {
      setCurrentIndex(newIndex);
    }
  }, [currentIndex, filteredReports.length]);

  const openModal = useCallback(async (index) => {
    if (!filteredReports[index]) return;

    setCurrentIndex(index);
    setSelectedReport(filteredReports[index]);
    document.body.style.overflow = 'hidden';
    document.body.classList.add('modal-open');
    isAutoScrollingRef.current = true;

    requestAnimationFrame(() => {
      const targetElement = modalScrollRef.current?.children[index];
      if (targetElement && typeof targetElement.scrollIntoView === 'function') {
        targetElement.scrollIntoView({ behavior: 'instant', block: 'start' });
      }

      setTimeout(() => {
        isAutoScrollingRef.current = false;
      }, 150);
    });
  }, [filteredReports]);

  const closeModal = useCallback(() => {
    setCurrentIndex(null);
    setSelectedReport(null);
    document.body.style.overflow = 'visible';
    document.body.classList.remove('modal-open');
    isAutoScrollingRef.current = false;
  }, []);

  // Cleanup modal scroll on unmount
  useEffect(() => {
    return () => {
      document.body.style.overflow = 'visible';
      document.body.classList.remove('modal-open');
    };
  }, []);

  const handleLaporanSuccess = useCallback((newReport) => {
    // Optimistic update
    if (newReport && newReport.id) {
      const updated = [newReport, ...(displayReports || [])];
      updateCache(updated);
    }
    setShowLaporPanel(false);

    // Refresh data from server
    refreshData();

    // Optional: scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [displayReports, updateCache, refreshData]);

  const handleShare = useCallback(async (report) => {
    if (!report?.id) return;

    const shareUrl = `${window.location.origin}/post/${report.id}`;
    const sanitizedDeskripsi = sanitizeText(report.deskripsi || "Lihat update kondisi terkini!");

    if (navigator.share) {
      try {
        await navigator.share({
          title: sanitizeText(report.tempat?.name || "Ronda"),
          text: sanitizedDeskripsi,
          url: shareUrl,
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.log("Share error:", err);
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        alert("Link berhasil disalin!");
      } catch (err) {
        console.error('Clipboard error:', err);
        alert("Gagal menyalin link");
      }
    }
  }, []);

  const openAIChat = useCallback((report) => {
    if (report?.tempat) {
      closeModal();
      setTimeout(() => {
        setSelectedAITempat(report.tempat);
        setSelectedReport(report);
        setIsAIModalOpen(true);
      }, 150);
    } else {
      alert("Informasi tempat tidak tersedia");
    }
  }, [closeModal]);

  // ========== SUB-COMPONENTS ==========

  const ReportCard = useCallback(({ report, index }) => {
    const safeDeskripsi = sanitizeText(report.deskripsi || "Lihat detail...");
    const safeLocation = sanitizeText(report.display_location_name || "Lokasi");
    const safeUserName = sanitizeText(report.user_name || "Warga");
    const avatarUrl = getSafeAvatarUrl(report);

    return (
      <motion.div
        key={report.id}
        onClick={() => openModal(index)}
        className={`relative aspect-[3/4] bg-zinc-900 rounded-xl overflow-hidden border border-white/5 shadow-lg transition-all duration-200 cursor-pointer hover:scale-[1.02] active:opacity-90`}
        whileTap={{ scale: 0.98 }}
      >
        {report.photo_url || report.video_url ? (
          <>
            <MediaRenderer
              url={report.video_url || report.photo_url}
              className="w-full h-full object-cover"
              thumbnail={true}
              muted={true}
              loop={false}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
              <p className="text-white text-sm font-bold line-clamp-2 mb-1">
                {safeDeskripsi}
              </p>
              <div className="flex items-center gap-1 text-white/60 text-[10px]">
                <MapPin size={10} />
                <span className="truncate">{safeLocation}</span>
              </div>
            </div>
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900 flex flex-col items-center justify-center p-4 text-center">
            <div className="bg-white/5 p-4 rounded-2xl w-full">
              <p className="text-white text-base font-black leading-tight line-clamp-3 mb-2">
                {safeDeskripsi}
              </p>
              <div className="flex items-center justify-center gap-1 text-white/40 text-[10px] mt-2">
                <MapPin size={10} />
                <span className="truncate">{safeLocation}</span>
              </div>
            </div>
          </div>
        )}
        <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-full">
          <img
            src={avatarUrl}
            className="w-4 h-4 rounded-full border border-white/30"
            alt={`Avatar ${safeUserName}`}
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={(e) => {
              e.target.src = `https://ui-avatars.com/api/?name=Warga&background=0D8ABC&color=fff`;
            }}
          />
          <span className="text-[9px] text-white font-medium truncate max-w-[60px]">
            {safeUserName}
          </span>
        </div>
        {report.tipe && (
          <div className="absolute top-2 right-2">
            <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-full backdrop-blur-md ${report.tipe === "Ramai" ? "bg-yellow-500/40 text-white" : report.tipe === "Antri" ? "bg-rose-500/40 text-white" : "bg-emerald-500/40 text-white"}`}>
              {sanitizeText(report.tipe)}
            </span>
          </div>
        )}
      </motion.div>
    );
  }, [openModal]);

  const FilterTabs = useCallback(() => (
    <div className="flex gap-2 overflow-x-auto pb-4 mb-2 hide-scrollbar px-1">
      {[
        { id: "semua", label: "Semua", icon: "📋", color: "zinc-500" },
        { id: "ramai", label: "Ramai", icon: "🔥", color: "#E3655B" },
        { id: "sepi", label: "Sepi", icon: "🍃", color: "#10b981" },
        { id: "antri", label: "Antri", icon: "⏳", color: "#f43f5e" },
      ].map(tab => {
        const isActive = activeFilter === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id)}
            className="relative group flex items-center"
            aria-label={`Filter ${tab.label}`}
          >
            <div className={`
              relative z-10 px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all duration-300
              ${isActive
                ? "text-white"
                : isMalam ? "text-white/40 hover:text-white/70" : "text-gray-500 hover:text-gray-800"
              }
            `}>
              <span className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'grayscale'}`}>
                {tab.icon}
              </span>
              <span className="tracking-widest">{tab.label}</span>
            </div>

            {isActive && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 rounded-xl shadow-lg"
                style={{
                  backgroundColor: tab.id === 'semua' ? (isMalam ? '#3f3f46' : '#18181b') : tab.color,
                  boxShadow: `0 4px 15px -5px ${tab.id === 'semua' ? 'rgba(0,0,0,0.3)' : tab.color + '66'}`
                }}
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}

            {!isActive && isMalam && (
              <div className="absolute inset-0 border border-white/5 rounded-xl bg-white/[0.02]" />
            )}
          </button>
        );
      })}
    </div>
  ), [activeFilter, isMalam]);

  // ========== RENDER ==========

  return (
    <div className={`min-h-screen ${isMalam ? 'bg-black' : 'bg-gray-50'} flex justify-center font-sans`}>
      <div className={`w-full max-w-[400px] min-h-screen ${isMalam ? 'bg-zinc-900' : 'bg-white'} shadow-2xl overflow-hidden relative flex flex-col ${isMalam ? 'border-x border-white/5' : 'border-x border-gray-200'}`}>

        {/* Header */}
        <motion.header
          initial={{ y: 0 }}
          animate={{ y: isHeaderVisible ? 0 : -120, opacity: isHeaderVisible ? 1 : 0 }}
          transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
          className={`fixed top-0 w-full max-w-[400px] z-50 ${isMalam ? 'bg-zinc-900/80' : 'bg-white/80'} backdrop-blur-md border-b ${isMalam ? 'border-white/5' : 'border-gray-100'}`}
        >
          <div className="px-5 pt-6 pb-4 space-y-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-[900] tracking-tighter text-[#E3655B] leading-none italic drop-shadow-sm">RONDA</h1>
                <p className={`text-[9px] ${isMalam ? 'text-white/30' : 'text-gray-400'} font-bold tracking-[0.25em] uppercase mt-1.5 ml-0.5`}>
                  Cerita Warga Setempat
                </p>
              </div>
              <div className={`pl-2 border-l flex-shrink-0 ${isMalam ? "border-white/10" : "border-black/5"}`}>
                <UserMenu
                  user={currentUser}
                  isAdmin={userRole === 'admin'}
                  isScrolled={!isHeaderVisible}
                  onOpenAuthModal={() => setIsAuthModalOpen(true)}
                  theme={{ isMalam, text: isMalam ? 'text-white' : 'text-slate-900' }}
                />
              </div>
            </div>

            {/* Search Input */}
            <div className="relative group">
              <div className={`absolute left-3.5 top-1/2 -translate-y-1/2 p-1 rounded-lg ${isMalam ? 'bg-white/5' : 'bg-gray-200/50'}`}>
                <Search size={14} className={`${isMalam ? 'text-white/40' : 'text-gray-500'} group-focus-within:text-[#E3655B] transition-colors`} />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(sanitizeText(e.target.value))}
                placeholder="Cek Ceritane Lokasi Sekitar..."
                className={`w-full ${isMalam ? 'bg-white/5 border-white/5 text-white placeholder:text-white/20' : 'bg-gray-50 border-gray-100 text-gray-900 placeholder:text-gray-400'} border rounded-2xl py-3 pl-12 pr-4 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#E3655B]/20 focus:bg-transparent transition-all shadow-sm`}
                aria-label="Cari laporan"
              />
            </div>

            {/* Filter Tabs */}
            <FilterTabs />
          </div>
        </motion.header>

        {/* Main Content */}
        <main
          className={`flex-1 overflow-y-auto px-3 pb-32 pt-[210px] ${isMalam ? 'bg-zinc-950' : 'bg-gray-50'}`}
          style={{
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
          <style dangerouslySetInnerHTML={{
            __html: `
              main::-webkit-scrollbar { display: none; }
              .modal-open { overflow: hidden; overscroll-behavior-y: none; }
              .snap-y { scroll-snap-type: y mandatory; -webkit-overflow-scrolling: touch; }
              .snap-start { scroll-snap-align: start; scroll-snap-stop: always; height: 100dvh; }
              .no-scrollbar::-webkit-scrollbar { display: none; }
              .no-scrollbar { scrollbar-width: none; overscroll-behavior-y: contain; touch-action: pan-y; }
              .hide-scrollbar::-webkit-scrollbar { display: none; }
              .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `
          }} />

          {isActuallyLoading ? (
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="aspect-[3/4] bg-zinc-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {filteredReports.map((report, index) => (
                <ReportCard key={report.id} report={report} index={index} />
              ))}
            </div>
          )}
        </main>

        {/* Bottom Navigation */}
        <SmartBottomNavWarga
          onOpenLaporanForm={() => {
            setSelectedTempat(null);
            setShowLaporPanel(true);
          }}
          onOpenNotification={() => router.push("/woro")}
          onOpenProfile={() => router.push("/peken")}
        />

        {/* Lapor Panel Modal */}
        <AnimatePresence>
          {showLaporPanel && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ transform: 'translateZ(0)' }}>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-md"
                onClick={() => setShowLaporPanel(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="relative w-full max-w-md mx-4"
                style={{ maxHeight: "85vh", transform: 'translateZ(0)', willChange: 'transform' }}
              >
                <LaporPanel
                  tempat={selectedTempat}
                  onClose={() => setShowLaporPanel(false)}
                  onSuccess={handleLaporanSuccess}
                  mode="media"
                  theme={{ isMalam }}
                  initialMediaUrl={null}
                  initialMediaType={null}
                />
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Fullscreen Modal untuk Story View */}
        <AnimatePresence mode="wait">
          {currentIndex !== null && filteredReports[currentIndex] && (
            <motion.div
              key="modal-container"
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="fixed inset-0 z-[99999] flex items-center justify-center"
            >
              <div className={`w-full max-w-[400px] h-[100dvh] relative overflow-hidden ${isMalam ? 'bg-black' : 'bg-white'}`}>
                <div className="absolute inset-0 bg-black/90" onClick={closeModal} />
                <button
                  onClick={closeModal}
                  className="absolute top-6 right-4 z-[110] w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white border border-white/20 active:scale-95 transition-all"
                  aria-label="Tutup"
                >
                  <X size={24} />
                </button>

                <div
                  ref={modalScrollRef}
                  onScroll={handleModalScroll}
                  className="h-full overflow-y-scroll snap-y snap-mandatory no-scrollbar scroll-smooth touch-pan-y"
                  style={{ WebkitOverflowScrolling: 'touch', scrollSnapStop: 'always' }}
                >
                  {filteredReports.map((report, idx) => {
                    const hasMedia = report.photo_url || report.video_url;
                    const isActive = idx === currentIndex;
                    const postId = report.id;
                    const isGeneralLocation = report.report_type === 'general_location' || !report.tempat_id;
                    const safeDeskripsi = sanitizeText(report.deskripsi || "Tidak ada deskripsi kondisi terkini.");
                    const safeLocation = sanitizeText(report.display_location_name || "Pasuruan");
                    const safeUserName = sanitizeText(report.user_name || "warga");
                    const safeTipe = sanitizeText(report.tipe || "");
                    const avatarUrl = getSafeAvatarUrl(report);
                    const viewCount = viewCounts[report.id] || 0;

                    return (
                      <div key={report.id} className="h-[100dvh] w-full snap-start snap-always relative flex flex-col bg-zinc-950 overflow-hidden">
                        {/* Overlay utama */}
                        <div
                          onClick={() => {
                            if (!isGeneralLocation && postId) {
                              closeModal();
                              router.push(`/post/${report.id}`);
                            }
                          }}
                          className={`absolute inset-0 z-10 ${isGeneralLocation ? 'cursor-default' : 'cursor-pointer'}`}
                          aria-label={isGeneralLocation ? "Laporan umum" : "Lihat detail tempat"}
                        />

                        {/* Media Background */}
                        <div className="absolute inset-0 w-full h-full overflow-hidden">
                          {hasMedia ? (
                            <>
                              <MediaRenderer
                                url={report.video_url || report.photo_url}
                                className="w-full h-full object-cover"
                                autoPlay={isActive}
                                muted={!isActive}
                                loop={true}
                                playsInline={true}
                              />
                              {!report.video_url && (
                                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80" />
                              )}
                            </>
                          ) : (
                            <div className="relative h-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
                              <div className="text-center px-6 py-8 max-w-sm mx-auto">
                                <div className="text-7xl mb-6 opacity-60">
                                  {safeTipe === "Ramai" ? "🏃‍♂️" : safeTipe === "Antri" ? "⏰" : "📢"}
                                </div>
                                {safeTipe && (
                                  <div className="mb-4 flex justify-center">
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase ${safeTipe === "Ramai" ? "bg-yellow-500/20 text-yellow-300" :
                                      safeTipe === "Antri" ? "bg-rose-500/20 text-rose-300" :
                                        "bg-emerald-500/20 text-emerald-300"
                                      }`}>
                                      {safeTipe === "Ramai" ? "🏃" : safeTipe === "Antri" ? "⏳" : "🍃"}
                                      <span>{safeTipe}</span>
                                    </span>
                                  </div>
                                )}
                                <p className="text-white font-black text-2xl sm:text-3xl leading-relaxed tracking-tight italic mb-6">
                                  "{safeDeskripsi}"
                                </p>
                                <div className="flex items-center justify-center gap-2 text-white/60 text-sm mb-6">
                                  <MapPin size={14} className="text-[#E3655B]" />
                                  <span>{safeLocation}</span>
                                </div>
                                <div className="flex items-center justify-center gap-2 pt-4 border-t border-white/10">
                                  <img
                                    src={avatarUrl}
                                    className="w-8 h-8 rounded-full border border-white/30"
                                    alt={`Avatar ${safeUserName}`}
                                    onError={(e) => {
                                      e.target.src = `https://ui-avatars.com/api/?name=Warga&background=0D8ABC&color=fff`;
                                    }}
                                  />
                                  <span className="text-white/80 text-sm font-medium">
                                    @{safeUserName.replace(/\s+/g, '').toLowerCase()}
                                  </span>
                                  <span className="text-white/40 text-xs">•</span>
                                  <span className="text-white/40 text-xs">{formatTimeAgo(report.created_at)}</span>
                                </div>
                                <div className="mt-6 flex items-center justify-center gap-1.5">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                    <circle cx="12" cy="12" r="3" />
                                  </svg>
                                  <span className="text-[11px] font-bold text-white/35">
                                    {viewCount.toLocaleString("id-ID")}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Feed Actions */}
                        <div className="absolute right-3 bottom-28 z-50">
                          <FeedActions
                            item={{ id: report.tempat_id, name: safeLocation, activePhoto: report.photo_url }}
                            comments={{}}
                            openAIModal={() => openAIChat(report)}
                            openKomentarModal={() => {
                              setSelectedItemForComment(report);
                              setIsKomentarModalOpen(true);
                            }}
                            onShare={() => handleShare(report)}
                            variant="floating-sidebar"
                            theme={theme}
                            handleSesuai={() => console.log("Tombol SESUAI diklik")}
                            isSesuai={false}
                          />
                        </div>

                        {/* Content untuk yang memiliki media */}
                        {hasMedia && (
                          <div className="absolute inset-0 flex flex-col justify-end">
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />
                            <div className="relative p-4 pb-4 pr-16 sm:pb-6 sm:pr-20 w-full">
                              <div className="flex flex-col gap-2 mb-3">
                                <div className="flex items-center gap-2.5">
                                  <div className="relative shrink-0">
                                    <img
                                      src={avatarUrl}
                                      className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-white/30"
                                      alt={`Avatar ${safeUserName}`}
                                      onError={(e) => {
                                        e.target.src = `https://ui-avatars.com/api/?name=Warga&background=0D8ABC&color=fff`;
                                      }}
                                    />
                                    <div className="absolute -bottom-0.5 -right-0.5 bg-[#0095f6] rounded-full p-0.5 border border-black">
                                      <ShieldCheck size={8} className="text-white" />
                                    </div>
                                  </div>
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-[8px] text-white/50 uppercase font-black tracking-widest">Warga Setempat</span>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-sm font-bold text-white">
                                        @{safeUserName.replace(/\s+/g, '').toLowerCase()}
                                      </span>
                                      <span className="text-[10px] text-white/40">• {formatTimeAgo(report.created_at)}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {safeTipe && (
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border ${safeTipe === "Ramai" ? "bg-yellow-500/20 border-yellow-500/40 text-yellow-300" :
                                      safeTipe === "Antri" ? "bg-rose-500/20 border-rose-500/40 text-rose-300" :
                                        "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                                      }`}>
                                      <span>{safeTipe === "Ramai" ? "🏃" : safeTipe === "Antri" ? "⏳" : "🍃"}</span>
                                      <span>{safeTipe}</span>
                                    </span>
                                  )}
                                  <div className="flex items-center gap-1 bg-black/20 backdrop-blur-sm px-2 py-0.5 rounded-md text-white/60 text-[10px]">
                                    <MapPin size={10} className="text-[#E3655B]" />
                                    <span className="truncate max-w-[120px] font-medium">{safeLocation}</span>
                                  </div>
                                </div>
                              </div>
                              <p className="text-white font-medium text-base sm:text-lg leading-snug tracking-tight line-clamp-3 drop-shadow-md">
                                {safeDeskripsi}
                              </p>
                            </div>
                            <div className="relative pb-6 w-full">
                              <div className="text-center">
                                <div className="inline-flex items-center gap-1.5">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                    <circle cx="12" cy="12" r="3" />
                                  </svg>
                                  <span className="text-[11px] font-bold text-white/35">
                                    {viewCount.toLocaleString("id-ID")}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Komentar Modal */}
        <AnimatePresence>
          {isKomentarModalOpen && selectedItemForComment && (
            <KomentarModal
              isOpen={isKomentarModalOpen}
              onClose={() => {
                setIsKomentarModalOpen(false);
                setSelectedItemForComment(null);
              }}
              tempat={selectedItemForComment}
              tempatId={selectedItemForComment.id}
              tempatName={sanitizeText(selectedItemForComment.name || selectedItemForComment.display_location_name)}
              currentUser={currentUser}
              activeUserId={activeUserId}
              theme={theme}
              className="z-[100000]"
            />
          )}
        </AnimatePresence>

        {/* Auth Modal */}
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          theme={{ isMalam }}
        />

        {/* AI Modal */}
        <AIModalTempat
          isOpen={isAIModalOpen}
          onClose={() => {
            setIsAIModalOpen(false);
            setSelectedAITempat(null);
            setSelectedReport(null);
          }}
          tempat={selectedAITempat}
          activeReport={selectedReport}
          reports={filteredReports}
          stats={{
            total: filteredReports.length,
            ramai: filteredReports.filter(r => r.tipe === 'Ramai').length,
            sepi: filteredReports.filter(r => r.tipe === 'Sepi').length,
            antri: filteredReports.filter(r => r.tipe === 'Antri').length
          }}
          theme={{
            isMalam: isMalam,
            card: isMalam ? 'bg-slate-900' : 'bg-white',
            border: isMalam ? 'border-white/10' : 'border-gray-100',
            text: isMalam ? 'text-white' : 'text-gray-900'
          }}
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
          onUploadSuccess={() => { }}
        />
      </div>
    </div>
  );
}