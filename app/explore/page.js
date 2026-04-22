'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import { X, MessageSquare, Heart, Share2, MapPin, Search, Bell, ShieldCheck, Plus } from "lucide-react";
import SmartBottomNav from "@/app/components/layout/SmartBottomNav";
import LaporPanel from "@/app/components/ai/LaporPanel";
import { formatTimeAgo } from "@/utils/timeUtils";
import { useTheme } from "@/app/hooks/useTheme";
import { useLaporanWarga } from "@/hooks/useOptimizedFetch";
import UserMenu from "@/app/components/layout/UserMenu";
import AuthModal from "@/app/components/auth/AuthModal";
import { useAuth } from "@/app/context/AuthContext";
import AIModalTempat from "@/app/components/ai/AIModalTempat";


const getAvatarUrl = (report) => {
  if (report?.user_avatar) return report.user_avatar;
  const name = report?.user_name || "Warga";
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff`;
};

export default function CitizenHub({ userId, userRole }) {
  const { isMalam } = useTheme();
  const router = useRouter();
  
  // ✅ Tambah limit jadi lebih besar agar semua data tercakup
  const { data: reports, loading, refresh, updateCache } = useLaporanWarga({ limit: 500 });
  
  const [currentIndex, setCurrentIndex] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showLaporPanel, setShowLaporPanel] = useState(false);
  const [selectedTempat, setSelectedTempat] = useState(null);
  const [commentTexts, setCommentTexts] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [sessionUserId, setSessionUserId] = useState(null);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false); //
  const { user, isAdmin } = useAuth();
  const modalScrollRef = useRef(null);
  const lastScrollYRef = useRef(0);
  const scrollTimeoutRef = useRef(null);
  const isScrollingRef = useRef(false);
  const isAutoScrollingRef = useRef(false);

  // ========== STATE ==========
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [selectedAITempat, setSelectedAITempat] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);


  const handleOpenUpload = () => {
    setSelectedTempat(null);
    setShowLaporPanel(true);
  };

  const handleLaporanSuccess = (newReport) => {
    const updated = [newReport, ...(reports || [])];
    updateCache(updated);
    setShowLaporPanel(false);
  };

  // CitizenHub.js - TAMBAHKAN DI ATAS (sebelum return)
const [cachedReports, setCachedReports] = useState(null);

useEffect(() => {
  // Load dari cache IMMEDIATELY
  const cached = sessionStorage.getItem('citizenhub_reports');
  if (cached) {
    try {
      const { data } = JSON.parse(cached);
      if (data?.length) {
        setCachedReports(data);
      }
    } catch(e) {}
  }
}, []);

// Gunakan cachedReports untuk render awal
const displayReports = cachedReports || reports || [];
const isActuallyLoading = loading && !cachedReports;

  // Header visibility
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

  // Get session
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

  const activeUserId = userId || sessionUserId;

  // Get user data - sudah ada di kode Anda
useEffect(() => {
  const getCurrentUser = async () => {
    if (!activeUserId) return;

    try {
      const { data, error } = await supabase
        .from("users")
        .select("username, full_name, avatar_url")
        .eq("id", activeUserId)
        .maybeSingle();

      if (!error && data) {
        setCurrentUser(data);
      } else {
        setCurrentUser({
          username: `user_${activeUserId?.slice(0, 8) || "unknown"}`,
          full_name: "Warga",
          avatar_url: null
        });
      }
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

  // ========== PENCARIAN CERDAS (FIXED) ==========
  const filteredReports = useMemo(() => {
    const reportsList = reports || [];
    const searchLower = searchQuery.toLowerCase().trim();
    
    if (!searchLower) return reportsList;
    
    // Ekstrak kata kunci dari query
    const searchWords = searchLower.split(/\s+/);
    
    // Daftar tempat populer di Pasuruan (bisa ditambah)
    const popularPlaces = [
      "alun-alun", "alun alun", "alun", "bangil", "pasar bangil", 
      "pura", "taman", "stasiun", "terminal", "masjid", "gereja"
    ];
    
    // Deteksi apakah query mengandung nama tempat
    const extractPlaceName = (query) => {
      for (const place of popularPlaces) {
        if (query.includes(place)) {
          return place;
        }
      }
      // Jika tidak ada di list, ambil kata terpanjang yang mungkin nama tempat
      const words = query.split(/\s+/);
      return words.length > 1 ? words[0] : null;
    };
    
    const targetPlace = extractPlaceName(searchLower);
    
    // Deteksi kondisi yang dicari
    const detectCondition = (query) => {
      if (query.includes("ramai") || query.includes("rame") || query.includes("padat") || query.includes("banyak")) {
        return "ramai";
      }
      if (query.includes("sepi") || query.includes("sunyi") || query.includes("lengang") || query.includes("kosong")) {
        return "sepi";
      }
      if (query.includes("antri") || query.includes("macet") || query.includes("ngantri") || query.includes("panjang")) {
        return "antri";
      }
      return null;
    };
    
    const targetCondition = detectCondition(searchLower);
    
    // Filter berdasarkan logika cerdas
    const filtered = reportsList.filter(report => {
      const tempatName = (report.tempat?.name || "").toLowerCase();
      const deskripsi = (report.deskripsi || "").toLowerCase();
      const userName = (report.user_name || "").toLowerCase();
      const tipe = (report.tipe || "").toLowerCase();
      
      // KASUS 1: Mencari kombinasi "tempat + kondisi" (ex: "alun-alun ramai")
      if (targetPlace && targetCondition) {
        const matchesPlace = tempatName.includes(targetPlace);
        const matchesCondition = tipe === targetCondition;
        return matchesPlace && matchesCondition;
      }
      
      // KASUS 2: Mencari hanya nama tempat (ex: "alun-alun", "bangil")
      if (targetPlace && !targetCondition) {
        return tempatName.includes(targetPlace);
      }
      
      // KASUS 3: Mencari hanya kondisi (ex: "suasana ramai", "tempat sepi")
      if (targetCondition && !targetPlace) {
        // Untuk pencarian kondisi, cek tipe ATAU deskripsi yang mengandung kata kondisi
        return tipe === targetCondition || deskripsi.includes(targetCondition);
      }
      
      // KASUS 4: Pencarian umum (default)
      // Cek apakah salah satu kata dalam query cocok dengan data
      return searchWords.some(word => 
        tempatName.includes(word) || 
        deskripsi.includes(word) || 
        userName.includes(word) ||
        (word.length > 2 && tipe.includes(word))
      );
    });
    
    // Urutkan berdasarkan relevansi
    return filtered.sort((a, b) => {
      const aTempat = (a.tempat?.name || "").toLowerCase();
      const bTempat = (b.tempat?.name || "").toLowerCase();
      const aTipe = (a.tipe || "").toLowerCase();
      const bTipe = (b.tipe || "").toLowerCase();
      
      // Prioritas: match tepat nama tempat > match kondisi > tanggal terbaru
      const aExactPlace = targetPlace && aTempat.includes(targetPlace);
      const bExactPlace = targetPlace && bTempat.includes(targetPlace);
      
      if (aExactPlace && !bExactPlace) return -1;
      if (!aExactPlace && bExactPlace) return 1;
      
      const aExactCondition = targetCondition && aTipe === targetCondition;
      const bExactCondition = targetCondition && bTipe === targetCondition;
      
      if (aExactCondition && !bExactCondition) return -1;
      if (!aExactCondition && bExactCondition) return 1;
      
      // Fallback ke tanggal terbaru
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }, [reports, searchQuery]);

  const handleModalScroll = (e) => {
    if (isAutoScrollingRef.current) return;
    
    const container = e.target;
    const { scrollTop, clientHeight } = container;
    const newIndex = Math.round(scrollTop / clientHeight);

    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < filteredReports.length) {
      setCurrentIndex(newIndex);
    }

    setTimeout(() => {
      isScrollingRef.current = false;
    }, 100);
  };

  const openModal = (index) => {
    setCurrentIndex(index);
    setSelectedReport(filteredReports[index]);
    document.body.style.overflow = 'hidden';
    isAutoScrollingRef.current = true;
    
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (modalScrollRef.current?.children[index]) {
          modalScrollRef.current.children[index].scrollIntoView({
            behavior: 'instant',
            block: 'start'
          });
        }
        
        setTimeout(() => {
          isAutoScrollingRef.current = false;
        }, 150);
      });
    });
  };

  const closeModal = () => {
    setCurrentIndex(null);
    document.body.style.overflow = 'visible';
    isAutoScrollingRef.current = false;
  };

  useEffect(() => {
    return () => {
      document.body.style.overflow = 'visible';
    };
  }, []);

  const handleSendComment = async (report) => {
    const currentCommentText = commentTexts[report.id] || "";
    if (!currentCommentText.trim() || isSubmitting) return;
    if (!activeUserId) {
      alert("Anda harus login terlebih dahulu!");
      return;
    }

    setIsSubmitting(true);

    try {
      const ownerUsername = report.username || report.user_name?.replace(/\s+/g, '').toLowerCase() || "warga";
      const invisibleMention = `@${ownerUsername}`;
      const finalComment = `${invisibleMention} ${currentCommentText.trim()}`;

      const commentData = {
        tempat_id: report.tempat_id,
        user_id: activeUserId,
        user_name: currentUser?.full_name || "Warga",
        username: currentUser?.username || `user_${activeUserId?.slice(0, 8)}`,
        user_avatar: currentUser?.avatar_url || null,
        content: finalComment,
        parent_id: null,
        likes: 0,
        created_at: new Date().toISOString()
      };

      const { error: commentError } = await supabase
        .from("komentar")
        .insert([commentData]);

      if (commentError) throw commentError;

      setCommentTexts(prev => ({ ...prev, [report.id]: "" }));
      alert("Komentar berhasil dikirim!");

    } catch (error) {
      console.error("Error detail:", error);
      alert(`Gagal mengirim komentar: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ========== FUNGSI ==========
const openAIChat = (report, e) => {
  e?.stopPropagation();
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

  // Report Card Component
  const ReportCard = ({ report, index }) => (
    <motion.div
      key={report.id}
      whileTap={{ scale: 0.98 }}
      onClick={() => openModal(index)}
      className="relative aspect-[3/4] bg-zinc-900 rounded-xl overflow-hidden cursor-pointer border border-white/5 shadow-lg active:opacity-90 transition-all hover:scale-[1.02] duration-200"    
    >
      {report.photo_url || report.video_url ? (
        <>
          <img
            src={report.photo_url || report.video_url}
            alt={report.deskripsi || "Laporan warga"}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              e.target.src = "/api/placeholder/400/500";
            }}
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
          onError={(e) => {
            e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(report.user_name || "Warga")}&background=0D8ABC&color=fff`;
          }}
        />
        <span className="text-[9px] text-white font-medium truncate max-w-[60px]">
          {report.user_name || "Warga"}
        </span>
      </div>

      {report.tipe && (
        <div className="absolute top-2 right-2">
          <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-full backdrop-blur-md ${report.tipe === "Ramai"
            ? "bg-yellow-500/40 text-white"
            : report.tipe === "Antri"
              ? "bg-rose-500/40 text-white"
              : "bg-emerald-500/40 text-white"
            }`}>
            {report.tipe}
          </span>
        </div>
      )}
    </motion.div>
  );

  return (
    <div className={`min-h-screen ${isMalam ? 'bg-black' : 'bg-gray-50'} flex justify-center font-sans`}>
      <div className={`w-full max-w-[400px] min-h-screen ${isMalam ? 'bg-zinc-900' : 'bg-white'} shadow-2xl overflow-hidden relative flex flex-col ${isMalam ? 'border-x border-white/5' : 'border-x border-gray-200'}`}>

        {/* Header */}
        <motion.header
          initial={{ y: 0 }}
          animate={{
            y: isHeaderVisible ? 0 : -120,
            opacity: isHeaderVisible ? 1 : 0
          }}
          transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
          className={`fixed top-0 w-full max-w-[400px] z-50 ${isMalam ? 'bg-zinc-900/80' : 'bg-white/80'} backdrop-blur-md border-b ${isMalam ? 'border-white/5' : 'border-gray-100'}`}
        >
          <div className="px-5 pt-6 pb-4 space-y-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-[900] tracking-tighter text-[#E3655B] leading-none italic drop-shadow-sm">
                  RONDA
                </h1>
                <p className={`text-[9px] ${isMalam ? 'text-white/30' : 'text-gray-400'} font-bold tracking-[0.25em] uppercase mt-1.5 ml-0.5`}>
                  Cerita Warga Setempat
                </p>
              </div>

              {/* Avatar User yang Sinkron dengan UserMenu Global */}
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

            {/* Search Bar */}
            <div className="relative group">
              <div className={`absolute left-3.5 top-1/2 -translate-y-1/2 p-1 rounded-lg ${isMalam ? 'bg-white/5' : 'bg-gray-200/50'}`}>
                <Search size={14} className={`${isMalam ? 'text-white/40' : 'text-gray-500'} group-focus-within:text-[#E3655B] transition-colors`} />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cek Ceritane Lokasi Sekitar..."
                className={`w-full ${
                  isMalam 
                  ? 'bg-white/5 border-white/5 text-white placeholder:text-white/20' 
                  : 'bg-gray-50 border-gray-100 text-gray-900 placeholder:text-gray-400'
                } border rounded-2xl py-3 pl-12 pr-4 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#E3655B]/20 focus:bg-transparent transition-all shadow-sm`} 
              />
            </div>
          </div>
        </motion.header>

        <main className={`flex-1 overflow-y-auto no-scrollbar px-3 pb-32 pt-[150px] ${isMalam ? 'bg-zinc-950' : 'bg-gray-50'}`}>
  
  {isActuallyLoading ? (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E3655B]"></div>
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
          onOpenUpload={() => {
            if (userRole === 'admin') {
              setSelectedTempat(null);
              setShowLaporPanel(true);
            }
          }}
          onOpenLaporanForm={() => {
            if (userRole === 'admin') {
              setSelectedTempat(null);
              setShowLaporPanel(true);
            }
          }}
          onOpenNotification={() => router.push("/woro")}
          onOpenProfile={() => router.push("/rewang")}
        />

        {/* TOMBOL UPLOAD FLOATING */}
        {!showLaporPanel && currentIndex === null && userRole !== 'admin' && (
          <div className="fixed bottom-0 left-0 right-0 flex justify-center pointer-events-none z-[70]">
            <div className="w-full max-w-[400px] relative h-[150px]">
              <button 
                onClick={handleOpenUpload}
                className="uploader-floating-btn pointer-events-auto"
              >
                <Plus size={28} strokeWidth={3} />
              </button>
            </div>
          </div>
        )}

        {/* LAPOR PANEL */}
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
              style={{
                maxHeight: "85vh",
                transform: 'translateZ(0)',
                willChange: 'transform'
              }}
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

                {/* MODAL FULLSCREEN */}
        <AnimatePresence mode="wait">
          {currentIndex !== null && (
            <motion.div
              key="modal-container"
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="fixed inset-0 z-[99999] flex items-center justify-center"
            >
              <div className={`w-full max-w-[400px] h-[100dvh] relative overflow-hidden ${isMalam ? 'bg-black' : 'bg-white'}`}>
                {/* Backdrop */}
                <div
                  className="absolute inset-0 bg-black/90"
                  onClick={closeModal}
                />

                {/* Close Button */}
                <button
                  onClick={closeModal}
                  className="absolute top-6 right-4 z-[110] w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white border border-white/20 active:scale-95 transition-all"
                >
                  <X size={24} />
                </button>

                {/* Scrollable Content */}
                <div
                  ref={modalScrollRef}
                  onScroll={handleModalScroll}
                   className="h-full overflow-y-scroll snap-y snap-mandatory no-scrollbar scroll-smooth touch-pan-y"
                  style={{
                     WebkitOverflowScrolling: 'touch',
                     scrollSnapStop: 'always'
                  }}
                >
                  {filteredReports.map((report, idx) => (
                    <div
                      key={report.id}
                      className="h-[100dvh] w-full snap-start snap-always relative flex flex-col bg-zinc-950 overflow-hidden"
                    >
                      {/* Media Background - Full Screen */}
                      <div className="absolute inset-0 w-full h-full overflow-hidden">
                        {report.photo_url || report.video_url ? (
                          <>
                            <img
                              src={report.photo_url || report.video_url}
                              className="w-full h-full object-cover"
                              alt={report.deskripsi}
                              onError={(e) => { e.target.src = "/placeholder-image.jpg"; }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80" />
                          </>
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900" />
                        )}
                      </div>

                      {/* KONTEN UTAMA - DIBEDAKAN BERDASARKAN ADA/TIDAK FOTO */}
                      {report.photo_url || report.video_url ? (
                        // ADA FOTO: Konten di bawah - LEBIH RAPAT
<div className="relative h-full flex flex-col justify-end p-3 pb-24 sm:p-4 sm:pb-28">
  <div className="flex justify-between items-end gap-2 sm:gap-4">
    <div className="flex-1 min-w-0">
      {/* Info User - Lebih Compact */}
      <div className="flex items-center gap-2 sm:gap-2.5 mb-2 sm:mb-3">
        <div className="relative shrink-0">
          <img
            src={getAvatarUrl(report)}
            className="w-7 h-7 sm:w-9 sm:h-9 rounded-full object-cover border-2 border-white/30"
            alt="avatar"
            referrerPolicy="no-referrer"
            onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(report.user_name || "Warga")}&background=0D8ABC&color=fff`;
  }}
          />
          <div className="absolute -bottom-0.5 -right-0.5 bg-[#0095f6] rounded-full p-0.5 border border-black">
            <ShieldCheck size={7} className="text-white sm:w-[9px] sm:h-[9px]" />
          </div>
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[7px] sm:text-[9px] text-white/50 uppercase font-bold tracking-wider">
            Warga Setempat
          </span>
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[11px] sm:text-sm font-bold text-white">
              @{report.user_name?.replace(/\s+/g, '').toLowerCase() || "warga"}
            </span>
            <span className="text-[9px] sm:text-[11px] text-white/40">
              • {formatTimeAgo(report.created_at)}
            </span>
          </div>
        </div>
      </div>

      {/* Badge Kondisi + Lokasi - Sejajar */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {report.tipe && (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
            report.tipe === "Ramai" 
              ? "bg-yellow-500/20 border-yellow-500/40 text-yellow-300"
              : report.tipe === "Antri"
              ? "bg-rose-500/20 border-rose-500/40 text-rose-300"
              : "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
          }`}>
            <span className="text-xs">{report.tipe === "Ramai" ? "🏃" : report.tipe === "Antri" ? "⏳" : "🍃"}</span>
            <span>{report.tipe}</span>
          </span>
        )}
        <div className="flex items-center gap-1 text-white/40 text-[9px]">
          <MapPin size={10} className="text-[#E3655B]/60" />
          <span className="truncate max-w-[120px]">{report.tempat?.name || "Pasuruan"}</span>
        </div>
      </div>

      {/* Deskripsi - Lebih Rapat */}
      <p className="text-white font-black text-base sm:text-lg leading-snug mb-2 tracking-tight line-clamp-3">
        {report.deskripsi || "Tidak ada deskripsi kondisi terkini."}
      </p>

      {/* Kolom Komentar - Lebih Compact */}
      <div className="flex gap-1.5">
        <input
          value={commentTexts[report.id] || ""}
          onChange={(e) => setCommentTexts(prev => ({ ...prev, [report.id]: e.target.value }))}
          placeholder="Tulis komentar..."
          className="flex-1 h-8 sm:h-10 bg-white/10 border border-white/5 rounded-lg px-3 text-[11px] text-white outline-none focus:border-[#E3655B]/50 transition-all placeholder:text-white/30"
        />
        <button
          onClick={() => handleSendComment(report)}
          disabled={isSubmitting || !(commentTexts[report.id] || "").trim()}
          className="px-3 bg-[#E3655B] text-white rounded-lg text-[11px] font-bold active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "..." : "Kirim"}
        </button>
      </div>
    </div>

    {/* Action Buttons - Lebih Rapat */}
    <div className="flex flex-col gap-3 items-center">
      <div className="flex flex-col items-center gap-0.5">
        <button className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 transition-all">
          <Heart size={18} />
        </button>
        <span className="text-[8px] font-medium text-white/50">Like</span>
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <button 
         onClick={(e) => openAIChat(report, e)}
         className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 transition-all">
          <MessageSquare size={18} />
        </button>
        <span className="text-[8px] font-medium text-white/50">Chat</span>
      </div>
      <button className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#E3655B] flex items-center justify-center text-white hover:bg-[#E3655B]/80 transition-all">
        <Share2 size={16} />
      </button>
    </div>
  </div>
</div>
                      ) : (
                        // TIDAK ADA FOTO: Konten di TENGAH
<div className="relative h-full flex flex-col justify-between">
  
  {/* KONTEN UTAMA (Teks & Info) - PUSHED TO TOP */}
  <div className="flex-1 flex flex-col items-center justify-center p-6 pt-12">
    <div className="bg-white/5 p-8 rounded-3xl backdrop-blur-sm border border-white/10 max-w-sm w-full text-center">
      
      {/* NAMA TEMPAT - PALING ATAS */}
      <div className="mb-3 flex justify-center">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/20">
          <MapPin size={12} className="text-[#E3655B]" />
          <span className="text-white/80 text-xs font-medium uppercase tracking-wider">
            {report.tempat?.name || "Lokasi"}
          </span>
        </span>
      </div>

      {/* Badge Kondisi (Ramai/Antri/Sepi) */}
      {report.tipe && (
        <div className="mb-4 flex justify-center">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border ${
            report.tipe === "Ramai" 
              ? "bg-yellow-500/20 border-yellow-500/40 text-yellow-300"
              : report.tipe === "Antri"
              ? "bg-rose-500/20 border-rose-500/40 text-rose-300"
              : "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
          }`}>
            <span className="text-base">
              {report.tipe === "Ramai" ? "🏃" : report.tipe === "Antri" ? "⏳" : "🍃"}
            </span>
            <span>{report.tipe}</span>
          </span>
        </div>
      )}

      {/* DESKRIPSI UTAMA */}
      <p className="text-white font-black text-xl sm:text-2xl md:text-3xl leading-relaxed tracking-tight italic">
        "{report.deskripsi || "Tidak ada deskripsi kondisi"}"
      </p>

      {/* Info User & Waktu */}
      <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-white/10">
        <img
          src={getAvatarUrl(report)}
          className="w-6 h-6 rounded-full border border-white/30"
          alt="avatar"
          referrerPolicy="no-referrer"
          onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(report.user_name || "Warga")}&background=0D8ABC&color=fff`; 
         }}
        />
        <span className="text-white/80 text-sm font-medium">
          @{report.user_name?.replace(/\s+/g, '').toLowerCase() || "warga"}
        </span>
        <span className="text-white/40 text-xs">•</span>
        <span className="text-white/40 text-xs">
          {formatTimeAgo(report.created_at)}
        </span>
      </div>
      
    </div>
  </div>

  {/* BAGIAN BAWAH: Kolom Komentar + Action Buttons - FIXED AT BOTTOM */}
  <div className="sticky bottom-0 w-full bg-gradient-to-t from-black/90 via-black/70 to-transparent pt-8 pb-6 px-4">
    <div className="flex justify-between items-end gap-3 sm:gap-5">
      <div className="flex-1 min-w-0">
        <div className="flex gap-2">
          <input
            value={commentTexts[report.id] || ""}
            onChange={(e) => setCommentTexts(prev => ({ ...prev, [report.id]: e.target.value }))}
            placeholder="Tulis komentar..."
            className="flex-1 h-10 sm:h-12 bg-white/20 border border-white/10 rounded-xl px-3 text-xs text-white outline-none focus:border-[#E3655B]/50 transition-all placeholder:text-white/40 backdrop-blur-sm"
          />
          <button
            onClick={() => handleSendComment(report)}
            disabled={isSubmitting || !(commentTexts[report.id] || "").trim()}
            className="px-4 bg-[#E3655B] text-white rounded-xl text-xs font-bold active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "..." : "Kirim"}
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-4 items-center">
        <div className="flex flex-col items-center gap-1">
          <button className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/30 transition-all">
            <Heart size={20} />
          </button>
          <span className="text-[9px] font-bold text-white/60">Like</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <button 
           onClick={(e) => openAIChat(report, e)}
           className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/30 transition-all">
            <MessageSquare size={20} />
          </button>
          <span className="text-[9px] font-bold text-white/60">Chat</span>
        </div>
        <button className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-[#E3655B] flex items-center justify-center text-white hover:bg-[#E3655B]/80 transition-all">
          <Share2 size={18} />
        </button>
      </div>
    </div>
  </div>
  
</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

     <AuthModal 
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          theme={{ isMalam }}
        />
{/* Pastikan mengirim props dengan benar */}
<AIModalTempat
  isOpen={isAIModalOpen}
  onClose={() => {
    setIsAIModalOpen(false);
    setSelectedAITempat(null);
    setSelectedReport(null);
  }}
  tempat={selectedAITempat}
  activeReport={selectedReport}  // 🔥 KIRIM LAPORAN YANG DIKLIK
  reports={filteredReports}       // 🔥 KIRIM SEMUA LAPORAN
  stats={{
    total: filteredReports.length,
    ramai: filteredReports.filter(r => r.tipe === 'Ramai').length,
    sepi: filteredReports.filter(r => r.tipe === 'Sepi').length,
    antri: filteredReports.filter(r => r.tipe === 'Antri').length,
  }}
  theme={{ 
    isMalam: isMalam,
    card: isMalam ? 'bg-slate-900' : 'bg-white',
    border: isMalam ? 'border-white/10' : 'border-gray-100',
    text: isMalam ? 'text-white' : 'text-gray-900'
  }}
  onOpenAuthModal={() => setIsAuthModalOpen(true)}
  onUploadSuccess={() => {}}
/>

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

  .uploader-floating-btn:active {
    transform: scale(0.9) !important;
    opacity: 0.9 !important;
  }

  /* Mencegah tarikan layar (pull-to-refresh) saat buka story */
  body.modal-open {
    overflow: hidden;
    overscroll-behavior-y: none;
    -ms-overflow-style: none;
  }

  /* Tambahkan ini agar transisi lebar smooth di desktop */
  .max-w-\[400px\] {
    transition: max-width 0.3s ease-in-out;
  }

  /* Memastikan Story Fullscreen benar-benar pas */
  .snap-y {
    scroll-snap-type: y mandatory;
    -webkit-overflow-scrolling: touch;
  }
  .snap-start {
    scroll-snap-align: start;
    scroll-snap-stop: always;
    height: 100dvh;
  }

  /* Animasi halus untuk gambar */
  .story-image {
    transition: transform 0.5s ease;
    will-change: transform;
  }
  .no-scrollbar::-webkit-scrollbar { display: none; }
  scrollbar-width: none;
  overscroll-behavior-y: contain;
  touch-action: pan-y;
`}</style>
    </div>
  );
}