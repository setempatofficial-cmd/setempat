'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin, Search, ShieldCheck, Plus } from "lucide-react";
import SmartBottomNav from "@/app/components/layout/SmartBottomNav";
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

// Batch get view counts
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

const getAvatarUrl = (report) => {
  if (report?.user_avatar) return report.user_avatar;
  const name = report?.user_name || "Warga";
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff`;
};

export default function CitizenHub({ userId, userRole }) {
  const { isMalam } = useTheme();
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  
  const { data: reports, loading, refresh, updateCache } = useLaporanWarga({ limit: 50 });
  
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
  
  const modalScrollRef = useRef(null);
  const lastScrollYRef = useRef(0);
  const scrollTimeoutRef = useRef(null);
  const isAutoScrollingRef = useRef(false);
  const recordedViewsRef = useRef(new Set());
  const viewsLoadedRef = useRef(false);

  // 🔥 FIX: Deklarasikan activeUserId di sini (paling atas setelah state)
  const activeUserId = userId || sessionUserId;

  // Load dari cache
  useEffect(() => {
    const cached = sessionStorage.getItem('citizenhub_reports');
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        if (data?.length && (Date.now() - timestamp) < 5 * 60 * 1000) {
          setCachedReports(data);
        }
      } catch(e) {}
    }
  }, []);

  const displayReports = cachedReports || reports || [];
  const isActuallyLoading = loading && !cachedReports;

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

  const theme = {
    isMalam: isMalam,
    text: isMalam ? 'text-white' : 'text-gray-900',
    bg: isMalam ? 'bg-zinc-900' : 'bg-white',
    border: isMalam ? 'border-white/10' : 'border-gray-100',
  };

  // Search filter
  const filteredReports = useMemo(() => {
    const reportsList = displayReports;
    const searchLower = searchQuery.toLowerCase().trim();
    if (!searchLower) return reportsList;
    return reportsList.filter(report => {
      const tempatName = (report.tempat?.name || "").toLowerCase();
      const deskripsi = (report.deskripsi || "").toLowerCase();
      return tempatName.includes(searchLower) || deskripsi.includes(searchLower);
    });
  }, [displayReports, searchQuery]);

  // 🔥 FIX: Record view dengan debounce - pindahkan setelah activeUserId didefinisikan
  const recordStoryView = useCallback(async (laporanId) => {
    if (!activeUserId) return;
    if (recordedViewsRef.current.has(laporanId)) return;
    
    recordedViewsRef.current.add(laporanId);
    
    setTimeout(async () => {
      try {
        const { data: existingView } = await supabase
          .from("story_views")
          .select("id")
          .eq("laporan_id", laporanId)
          .eq("user_id", activeUserId)
          .maybeSingle();
        
        if (!existingView) {
          await supabase
            .from("story_views")
            .insert({
              laporan_id: laporanId,
              user_id: activeUserId,
              viewed_at: new Date().toISOString()
            });
          
          setViewCounts(prev => ({
            ...prev,
            [laporanId]: (prev[laporanId] || 0) + 1
          }));
        }
      } catch (err) {
        console.error("Error recording view:", err);
      }
    }, 100);
  }, [activeUserId]);

  // Record view hanya saat modal terbuka
  useEffect(() => {
    if (currentIndex !== null && filteredReports[currentIndex]?.id) {
      recordStoryView(filteredReports[currentIndex].id);
    }
  }, [currentIndex, filteredReports, recordStoryView]);

  // Header visibility
  useEffect(() => {
    const handleScroll = () => {
      if (currentIndex !== null) return;
      const currentScrollY = window.scrollY;
      if (Math.abs(currentScrollY - lastScrollYRef.current) < 30) return;
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
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
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [currentIndex]);

  // Back button handler
  useEffect(() => {
    if (currentIndex === null) return;
    
    const handlePopState = (event) => {
      event.preventDefault();
      if (currentIndex > 0) {
        const prevIndex = currentIndex - 1;
        setCurrentIndex(prevIndex);
        if (modalScrollRef.current?.children[prevIndex]) {
          modalScrollRef.current.children[prevIndex].scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
          });
        }
      } else {
        closeModal();
      }
      window.history.pushState(null, '', window.location.href);
    };
    
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentIndex]);

  // Get session
  useEffect(() => {
    let isMounted = true;
    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!error && isMounted && session?.user?.id) setSessionUserId(session.user.id);
      } catch (err) { console.error("Session error:", err); }
    };
    getSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (isMounted && session?.user?.id) setSessionUserId(session.user.id);
      else if (isMounted && event === 'SIGNED_OUT') setSessionUserId(null);
    });
    return () => { isMounted = false; subscription?.unsubscribe(); };
  }, []);

  // Get user data (with caching)
  useEffect(() => {
    const getCurrentUser = async () => {
      if (!activeUserId) return;
      
      const cached = sessionStorage.getItem(`user_${activeUserId}`);
      if (cached) {
        try {
          setCurrentUser(JSON.parse(cached));
          return;
        } catch(e) {}
      }
      
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("username, full_name, avatar_url")
          .eq("id", activeUserId)
          .maybeSingle();
        
        const userData = (!error && data) ? data : {
          username: `user_${activeUserId?.slice(0, 8) || "unknown"}`,
          full_name: "Warga",
          avatar_url: null
        };
        
        sessionStorage.setItem(`user_${activeUserId}`, JSON.stringify(userData));
        setCurrentUser(userData);
      } catch (err) {
        console.error("User fetch error:", err);
        setCurrentUser({
          username: `user_${activeUserId?.slice(0, 8) || "unknown"}`,
          full_name: "Warga",
          avatar_url: null
        });
      }
    };
    getCurrentUser();
  }, [activeUserId]);

  const handleModalScroll = (e) => {
    if (isAutoScrollingRef.current) return;
    const container = e.target;
    const { scrollTop, clientHeight } = container;
    const newIndex = Math.round(scrollTop / clientHeight);
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < filteredReports.length) {
      setCurrentIndex(newIndex);
    }
  };

  const openModal = async (index) => {
    const report = filteredReports[index];
    setCurrentIndex(index);
    setSelectedReport(report);
    document.body.style.overflow = 'hidden';
    isAutoScrollingRef.current = true;
    
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (modalScrollRef.current?.children[index]) {
          modalScrollRef.current.children[index].scrollIntoView({ behavior: 'instant', block: 'start' });
        }
        setTimeout(() => { isAutoScrollingRef.current = false; }, 150);
      });
    });
  };

  const closeModal = () => {
    setCurrentIndex(null);
    document.body.style.overflow = 'visible';
    isAutoScrollingRef.current = false;
  };

  useEffect(() => {
    return () => { document.body.style.overflow = 'visible'; };
  }, []);

  const handleOpenUpload = () => {
    setSelectedTempat(null);
    setShowLaporPanel(true);
  };

  const handleLaporanSuccess = (newReport) => {
    const updated = [newReport, ...(displayReports || [])];
    updateCache(updated);
    setShowLaporPanel(false);
    sessionStorage.removeItem('citizenhub_reports');
  };

  const handleKomentarModal = (item) => {
    setSelectedItemForComment(item);
    setIsKomentarModalOpen(true);
  };

  const closeKomentarModal = () => {
    setIsKomentarModalOpen(false);
    setSelectedItemForComment(null);
  };

  const handleShare = async (report) => {
    const shareUrl = `${window.location.origin}/post/${report.id}`;
  
    if (navigator.share) {
      try {
        await navigator.share({
           title: report.tempat?.name || "Ronda",
           text: report.deskripsi || "Lihat update kondisi terkini!",
          url: shareUrl,
        });
      } catch (err) { console.log("Share cancelled:", err); }
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert("Link disalin!");
    }
  };

  const handleSesuai = () => {
    console.log("Tombol SESUAI diklik");
  };

  const openAIChat = (report) => {
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
  };

  // ReportCard component
  const ReportCard = ({ report, index }) => (
    <motion.div
      key={report.id}
      whileTap={{ scale: 0.98 }}
      onClick={() => openModal(index)}
      className="relative aspect-[3/4] bg-zinc-900 rounded-xl overflow-hidden cursor-pointer border border-white/5 shadow-lg active:opacity-90 transition-all hover:scale-[1.02] duration-200"    
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
              {report.deskripsi || "Lihat detail..."}
            </p>
            <div className="flex items-center gap-1 text-white/60 text-[10px]">
              <MapPin size={10} />
              <span className="truncate">{report.tempat?.name}</span>
            </div>
          </div>
        </>
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900 flex flex-col items-center justify-center p-4 text-center">
          <div className="bg-white/5 p-4 rounded-2xl w-full">
            <p className="text-white text-base font-black leading-tight line-clamp-3 mb-2">
              {report.deskripsi || "Tidak ada deskripsi kondisi"}
            </p>
            <div className="flex items-center justify-center gap-1 text-white/40 text-[10px] mt-2">
              <MapPin size={10} />
              <span className="truncate max-w-[80px]">{report.tempat?.name || "Lokasi"}</span>
            </div>
          </div>
        </div>
      )}
      <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-full">
        <img
          src={getAvatarUrl(report)}
          className="w-4 h-4 rounded-full border border-white/30"
          alt="avatar"
          referrerPolicy="no-referrer"
          onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(report.user_name || "Warga")}&background=0D8ABC&color=fff`; }}
        />
        <span className="text-[9px] text-white font-medium truncate max-w-[60px]">
          {report.user_name || "Warga"}
        </span>
      </div>
      {report.tipe && (
        <div className="absolute top-2 right-2">
          <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-full backdrop-blur-md ${report.tipe === "Ramai" ? "bg-yellow-500/40 text-white" : report.tipe === "Antri" ? "bg-rose-500/40 text-white" : "bg-emerald-500/40 text-white"}`}>
            {report.tipe}
          </span>
        </div>
      )}
    </motion.div>
  );

  // Render tetap sama seperti sebelumnya
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
                <UserMenu user={currentUser} isAdmin={userRole === 'admin'} isScrolled={!isHeaderVisible}
                  onOpenAuthModal={() => setIsAuthModalOpen(true)} theme={{ isMalam, text: isMalam ? 'text-white' : 'text-slate-900' }} />
              </div>
            </div>
            <div className="relative group">
              <div className={`absolute left-3.5 top-1/2 -translate-y-1/2 p-1 rounded-lg ${isMalam ? 'bg-white/5' : 'bg-gray-200/50'}`}>
                <Search size={14} className={`${isMalam ? 'text-white/40' : 'text-gray-500'} group-focus-within:text-[#E3655B] transition-colors`} />
              </div>
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cek Ceritane Lokasi Sekitar..."
                className={`w-full ${isMalam ? 'bg-white/5 border-white/5 text-white placeholder:text-white/20' : 'bg-gray-50 border-gray-100 text-gray-900 placeholder:text-gray-400'} border rounded-2xl py-3 pl-12 pr-4 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#E3655B]/20 focus:bg-transparent transition-all shadow-sm`} />
            </div>
          </div>
        </motion.header>

        <main 
          className={`flex-1 overflow-y-auto px-3 pb-32 pt-[150px] ${isMalam ? 'bg-zinc-950' : 'bg-gray-50'}`}
          style={{ 
            WebkitOverflowScrolling: 'touch', 
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
          <style dangerouslySetInnerHTML={{__html: `
            main::-webkit-scrollbar { display: none; }
          `}} />
          
          {isActuallyLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="relative flex items-center justify-center">
  <div className="relative flex items-center justify-center">
    <div className="absolute animate-ping h-12 w-12 rounded-full bg-[#E3655B] opacity-20"></div>
    <div className="absolute animate-ping h-12 w-12 rounded-full bg-[#25F4EE] opacity-20 [animation-delay:0.5s]"></div>
    
    <div className="relative h-10 w-10 border-4 border-t-[#E3655B] border-r-transparent border-b-[#25F4EE] border-l-transparent rounded-full animate-spin"></div>
  </div>
</div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {filteredReports.map((report, index) => (
                <ReportCard key={report.id} report={report} index={index} />
              ))}
            </div>
          )}
        </main>

        <SmartBottomNav
          onOpenUpload={() => { if (userRole === 'admin') { setSelectedTempat(null); setShowLaporPanel(true); } }}
          onOpenLaporanForm={() => { if (userRole === 'admin') { setSelectedTempat(null); setShowLaporPanel(true); } }}
          onOpenNotification={() => router.push("/woro")}
          onOpenProfile={() => router.push("/rewang")}
        />

        {/* Floating Upload Button */}
        {!showLaporPanel && currentIndex === null && userRole !== 'admin' && (
          <div className="fixed bottom-0 left-0 right-0 flex justify-center pointer-events-none z-[70]">
            <div className="w-full max-w-[400px] relative h-[150px]">
              <button onClick={handleOpenUpload} className="uploader-floating-btn pointer-events-auto">
                <Plus size={28} strokeWidth={3} />
              </button>
            </div>
          </div>
        )}

        {/* Lapor Panel */}
        {showLaporPanel && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ transform: 'translateZ(0)' }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowLaporPanel(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }} className="relative w-full max-w-md mx-4" style={{ maxHeight: "85vh", transform: 'translateZ(0)', willChange: 'transform' }}>
              <LaporPanel tempat={selectedTempat} onClose={() => setShowLaporPanel(false)} onSuccess={handleLaporanSuccess}
                mode="media" theme={{ isMalam }} initialMediaUrl={null} initialMediaType={null} />
            </motion.div>
          </div>
        )}

        {/* Fullscreen Modal */}
        <AnimatePresence mode="wait">
          {currentIndex !== null && (
            <motion.div key="modal-container" initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }} className="fixed inset-0 z-[99999] flex items-center justify-center">
              <div className={`w-full max-w-[400px] h-[100dvh] relative overflow-hidden ${isMalam ? 'bg-black' : 'bg-white'}`}>
                <div className="absolute inset-0 bg-black/90" onClick={closeModal} />
                <button onClick={closeModal}
                  className="absolute top-6 right-4 z-[110] w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white border border-white/20 active:scale-95 transition-all">
                  <X size={24} />
                </button>

                <div ref={modalScrollRef} onScroll={handleModalScroll}
                  className="h-full overflow-y-scroll snap-y snap-mandatory no-scrollbar scroll-smooth touch-pan-y"
                  style={{ WebkitOverflowScrolling: 'touch', scrollSnapStop: 'always' }}>
                  
                  {filteredReports.map((report, idx) => {
  const hasMedia = report.photo_url || report.video_url;
  const postId = report.id; 
  
  return (
    <div key={report.id} className="h-[100dvh] w-full snap-start snap-always relative flex flex-col bg-zinc-950 overflow-hidden">
      
      {/* OVERLAY UTAMA - Klik area mana saja (kecuali tombol) akan ke detail tempat */}
      <div 
        onClick={() => {
          if (postId) {
            closeModal();
            router.push(`/post/${report.id}`);
          }
        }}
        className="absolute inset-0 z-10 cursor-pointer"
      />
      {/* Media Background */}
      <div className="absolute inset-0 w-full h-full overflow-hidden">
        {hasMedia ? (
          <>
            <MediaRenderer
              url={report.video_url || report.photo_url}
              className="w-full h-full object-cover"
              autoPlay={idx === currentIndex}
              muted={true}
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
                {report.tipe === "Ramai" ? "🏃‍♂️" : report.tipe === "Antri" ? "⏰" : "📢"}
              </div>
              {report.tipe && (
                <div className="mb-4 flex justify-center">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase ${
                    report.tipe === "Ramai" ? "bg-yellow-500/20 text-yellow-300" : 
                    report.tipe === "Antri" ? "bg-rose-500/20 text-rose-300" : 
                    "bg-emerald-500/20 text-emerald-300"
                  }`}>
                    {report.tipe === "Ramai" ? "🏃" : report.tipe === "Antri" ? "⏳" : "🍃"}
                    <span>{report.tipe}</span>
                  </span>
                </div>
              )}
              <p className="text-white font-black text-2xl sm:text-3xl leading-relaxed tracking-tight italic mb-6">
                "{report.deskripsi || "Tidak ada deskripsi kondisi"}"
              </p>
              <div className="flex items-center justify-center gap-2 text-white/60 text-sm mb-6">
                <MapPin size={14} className="text-[#E3655B]" />
                <span>{report.tempat?.name || "Lokasi"}</span>
              </div>
              <div className="flex items-center justify-center gap-2 pt-4 border-t border-white/10">
                <img src={getAvatarUrl(report)} className="w-8 h-8 rounded-full border border-white/30" alt="avatar" />
                <span className="text-white/80 text-sm font-medium">
                  @{report.user_name?.replace(/\s+/g, '').toLowerCase() || "warga"}
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
                  {(viewCounts[report.id] || 0).toLocaleString("id-ID")}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FeedActions - SELALU ADA */}
      <div className="absolute right-3 bottom-28 z-50">
        <FeedActions
          item={{ id: report.tempat_id, name: report.tempat?.name, activePhoto: report.photo_url }}
          comments={{}}
          openAIModal={() => openAIChat(report)}
          openKomentarModal={handleKomentarModal}
          onShare={() => handleShare(report)}
          variant="floating-sidebar"
          theme={theme}
          handleSesuai={handleSesuai}
          isSesuai={false}
        />
      </div>

      {/* ✅ Content hanya untuk yang ADA FOTO */}
      {hasMedia && (
        <div className="absolute inset-0 flex flex-col justify-end">
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />
          <div className="relative p-4 pb-4 pr-16 sm:pb-6 sm:pr-20 w-full">
            <div className="flex flex-col gap-2 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="relative shrink-0">
                  <img 
                    src={getAvatarUrl(report)} 
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-white/30"
                    alt="avatar" 
                    referrerPolicy="no-referrer"
                    onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(report.user_name || "Warga")}&background=0D8ABC&color=fff`; }} 
                  />
                  <div className="absolute -bottom-0.5 -right-0.5 bg-[#0095f6] rounded-full p-0.5 border border-black">
                    <ShieldCheck size={8} className="text-white" />
                  </div>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[8px] text-white/50 uppercase font-black tracking-widest">Warga Setempat</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-white">
                      @{report.user_name?.replace(/\s+/g, '').toLowerCase() || "warga"}
                    </span>
                    <span className="text-[10px] text-white/40">• {formatTimeAgo(report.created_at)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {report.tipe && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border ${
                    report.tipe === "Ramai" ? "bg-yellow-500/20 border-yellow-500/40 text-yellow-300" : 
                    report.tipe === "Antri" ? "bg-rose-500/20 border-rose-500/40 text-rose-300" : 
                    "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                  }`}>
                    <span>{report.tipe === "Ramai" ? "🏃" : report.tipe === "Antri" ? "⏳" : "🍃"}</span>
                    <span>{report.tipe}</span>
                  </span>
                )}
                <div className="flex items-center gap-1 bg-black/20 backdrop-blur-sm px-2 py-0.5 rounded-md text-white/60 text-[10px]">
                  <MapPin size={10} className="text-[#E3655B]" />
                  <span className="truncate max-w-[120px] font-medium">{report.tempat?.name || "Pasuruan"}</span>
                </div>
              </div>
            </div>
            <p className="text-white font-medium text-base sm:text-lg leading-snug tracking-tight line-clamp-3 drop-shadow-md">
              {report.deskripsi || "Tidak ada deskripsi kondisi terkini."}
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
                  {(viewCounts[report.id] || 0).toLocaleString("id-ID")}
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
        {isKomentarModalOpen && selectedItemForComment && (
          <KomentarModal
            isOpen={isKomentarModalOpen}
            onClose={closeKomentarModal}
            tempat={selectedItemForComment}
            tempatId={selectedItemForComment.id}
            tempatName={selectedItemForComment.name}
            currentUser={currentUser}
            activeUserId={activeUserId}
            theme={theme}
            className="z-[100000]"
          />
        )}

        <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} theme={{ isMalam }} />
        
        <AIModalTempat isOpen={isAIModalOpen} onClose={() => { setIsAIModalOpen(false); setSelectedAITempat(null); setSelectedReport(null); }}
          tempat={selectedAITempat} activeReport={selectedReport} reports={filteredReports}
          stats={{ total: filteredReports.length, ramai: filteredReports.filter(r => r.tipe === 'Ramai').length,
            sepi: filteredReports.filter(r => r.tipe === 'Sepi').length, antri: filteredReports.filter(r => r.tipe === 'Antri').length }}
          theme={{ isMalam: isMalam, card: isMalam ? 'bg-slate-900' : 'bg-white', border: isMalam ? 'border-white/10' : 'border-gray-100', text: isMalam ? 'text-white' : 'text-gray-900' }}
          onOpenAuthModal={() => setIsAuthModalOpen(true)} onUploadSuccess={() => {}} />
      </div>

      <style jsx global>{`
        .uploader-floating-btn {
          position: absolute !important;
          bottom: 90px !important; 
          right: 16px !important;
          width: 56px !important;
          height: 56px !important;
          background: linear-gradient(to bottom right, #1e293b, #e3655b) !important;
          color: #ffffff !important;
          border-radius: 18px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          border: 4px solid ${isMalam ? "#0C0C0C" : "#ffffff"} !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2) !important;
          transition: all 0.2s ease !important;
        }
        .uploader-floating-btn:active { transform: scale(0.9) !important; opacity: 0.9 !important; }
        body.modal-open { overflow: hidden; overscroll-behavior-y: none; -ms-overflow-style: none; }
        .snap-y { scroll-snap-type: y mandatory; -webkit-overflow-scrolling: touch; }
        .snap-start { scroll-snap-align: start; scroll-snap-stop: always; height: 100dvh; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { scrollbar-width: none; overscroll-behavior-y: contain; touch-action: pan-y; }
      `}</style>
    </div>
  );
}