"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, MessageSquare, Heart, Share2, MapPin, Search, Bell, ShieldCheck } from "lucide-react";
import SmartBottomNav from "@/app/components/layout/SmartBottomNav";
import LaporPanel from "@/app/components/ai/LaporPanel";
import { formatTimeAgo } from "@/utils/timeUtils";
import { useTheme } from "@/app/hooks/useTheme";

export default function CitizenHub({ userId, userRole }) {
  const { isMalam } = useTheme();
  const router = useRouter();
  const [reports, setReports] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showLaporPanel, setShowLaporPanel] = useState(false);
  const [selectedTempat, setSelectedTempat] = useState(null);
  const [commentTexts, setCommentTexts] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [sessionUserId, setSessionUserId] = useState(null);
  const [authError, setAuthError] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  
  const modalScrollRef = useRef(null);
  const lastScrollYRef = useRef(0);
  const scrollTimeoutRef = useRef(null);
  const isScrollingRef = useRef(false);

  // FUNGSI UNTUK MEMBUKA LAPOR PANEL
  const handleOpenUpload = () => {
    setSelectedTempat(null);
    setShowLaporPanel(true);
  };

  // HANDLE SUCCESS LAPORAN
  const handleLaporanSuccess = (newReport) => {
    setReports(prev => [newReport, ...prev]);
    setShowLaporPanel(false);
  };

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

  // Scroll ke index
  useEffect(() => {
    if (currentIndex !== null && modalScrollRef.current) {
      setTimeout(() => {
        const container = modalScrollRef.current;
        if (!container) return;
        
        const targetElement = container.children[currentIndex];
        if (targetElement) {
          targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      }, 100);
    }
  }, [currentIndex]);

  // Get session
  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 3;

    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Session error:", error);
          if (retryCount < maxRetries) {
            retryCount++;
            setTimeout(getSession, 1000 * retryCount);
          }
          return;
        }
        
        if (isMounted && session?.user?.id) {
          setSessionUserId(session.user.id);
          setAuthError(false);
        }
      } catch (err) {
        console.error("Unexpected error:", err);
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(getSession, 1000 * retryCount);
        }
      }
    };
    
    getSession();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (isMounted && session?.user?.id) {
        setSessionUserId(session.user.id);
        setAuthError(false);
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

  // Get user data
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

  // Get reports
  useEffect(() => {
    const getReports = async () => {
      try {
        const { data, error } = await supabase
          .from("laporan_warga")
          .select(`
            *,
            tempat:tempat_id (name)
          `)
          .order("created_at", { ascending: false });
        
        if (error) throw error;
        setReports(data || []);
      } catch (err) {
        console.error("Reports fetch error:", err);
        setReports([]);
      } finally {
        setLoading(false);
      }
    };
    
    getReports();
  }, []);

  // Filtered reports - DEFINISIKAN DISINI setelah reports state
  const filteredReports = reports.filter(r =>
    r.deskripsi?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.user_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Modal scroll handler - DIPINDAHKAN ke sini setelah filteredReports
  const handleModalScroll = (e) => {
    if (isScrollingRef.current || currentIndex === null) return;
    
    isScrollingRef.current = true;
    
    const { scrollTop, clientHeight } = e.target;
    const newIndex = Math.round(scrollTop / clientHeight);
    
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < filteredReports.length) {
      setCurrentIndex(newIndex);
    }
    
    setTimeout(() => {
      isScrollingRef.current = false;
    }, 100);
  };

  // ================== MODAL FULLSCREEN ==================
  const openModal = (index) => {
    setCurrentIndex(index);
    document.body.style.overflow = 'hidden';
  };

  const closeModal = () => {
    setCurrentIndex(null);
    document.body.style.overflow = 'visible';
  };

  // Cleanup saat unmount
  useEffect(() => {
    return () => {
      document.body.style.overflow = 'visible';
    };
  }, []);

  // Template untuk laporan tanpa foto - DIPERBAIKI
  const getMediaContent = (report) => {
    if (report.photo_url || report.video_url) {
      return (
        <img 
          src={report.photo_url || report.video_url} 
          className="w-full h-full object-cover" 
          alt={report.deskripsi}
          onError={(e) => { 
            e.target.src = "/placeholder-image.jpg"; 
          }}
        />
      );
    }
    
    return (
      <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900 flex flex-col items-center justify-center p-4">
        <MapPin size={60} className="text-white/20 mb-4" />
        <div className="text-center space-y-2">
          <p className="text-white/60 text-sm font-medium uppercase tracking-wider">
            {report.tempat?.name || "Lokasi"}
          </p>
          <p className="text-white/40 text-xs">
            {new Date(report.created_at).toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            })}
          </p>
        </div>  
      </div>
    );
  };

  // Handle send comment - DIPERBAIKI dengan commentTexts object
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
      
      const mentionRegex = /@([a-zA-Z0-9_]+)/g;
      const otherMentions = [];
      let match;
      while ((match = mentionRegex.exec(currentCommentText)) !== null) {
        const username = match[1];
        if (username !== ownerUsername) {
          otherMentions.push(username);
        }
      }
      
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

      const { data: commentResult, error: commentError } = await supabase
        .from("komentar")
        .insert([commentData])
        .select();
        
      if (commentError) throw commentError;
      
      const { data: tempatData } = await supabase
        .from("tempat")
        .select("name")
        .eq("id", report.tempat_id)
        .single();
      
      const ownerUserId = report.user_id;
      if (ownerUserId && ownerUserId !== activeUserId) {
        await supabase.from("warung_info").insert({
          user_id: ownerUserId,
          from_user_id: activeUserId,
          from_user_name: currentUser?.full_name || "Warga",
          from_username: currentUser?.username,
          from_avatar: currentUser?.avatar_url || null,
          type: "komentar",
          title: "💬 Komentar Baru",
          message: `${currentUser?.full_name || "Seseorang"} membalas postingan Anda`,
          content: finalComment,
          reference_id: commentResult?.[0]?.id,
          reference_type: "komentar",
          tempat_id: report.tempat_id,
          tempat_name: tempatData?.name || "Lokasi",
          is_read: false,
          created_at: new Date().toISOString()
        });
      }
      
      if (otherMentions.length > 0) {
        const { data: mentionedUsers } = await supabase
          .from("users")
          .select("id, username, full_name")
          .in("username", otherMentions);
        
        if (mentionedUsers && mentionedUsers.length > 0) {
          const notificationsToSend = mentionedUsers.filter(
            user => user.id !== activeUserId && user.id !== ownerUserId
          );
          
          if (notificationsToSend.length > 0) {
            const bulkNotifications = notificationsToSend.map(user => ({
              user_id: user.id,
              from_user_id: activeUserId,
              from_user_name: currentUser?.full_name || "Warga",
              from_username: currentUser?.username,
              from_avatar: currentUser?.avatar_url || null,
              type: "mention",
              title: "📌 Mention",
              message: `${currentUser?.full_name || "Seseorang"} menyebut @${user.username} dalam komentar`,
              content: finalComment,
              reference_id: commentResult?.[0]?.id,
              reference_type: "komentar",
              tempat_id: report.tempat_id,
              tempat_name: tempatData?.name || "Lokasi",
              is_read: false,
              created_at: new Date().toISOString()
            }));
            
            await supabase.from("warung_info").insert(bulkNotifications);
          }
        }
      }
      
      // Clear comment for this specific report
      setCommentTexts(prev => ({...prev, [report.id]: ""}));
      alert("Komentar berhasil dikirim!");
      
    } catch (error) {
      console.error("Error detail:", error);
      alert(`Gagal mengirim komentar: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Card component
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
        </>
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900 flex flex-col items-center justify-center p-4">
          <MapPin size={32} className="text-white/20 mb-2" />
          <p className="text-white/40 text-[10px] text-center font-medium">
            {report.tempat?.name || "Lokasi"}
          </p>
          <p className="text-white/30 text-[8px] text-center mt-1 line-clamp-2">
            {report.deskripsi || "Kondisi terkini"}
          </p>
        </div>
      )}
      
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5">
          <img 
            src={report.user_avatar || "/default-avatar.png"} 
            className="w-4 h-4 sm:w-5 sm:h-5 rounded-full border border-white/30" 
            alt="avatar"
            onError={(e) => {
              e.target.src = "/default-avatar.png";
            }}
          />
          <span className="text-[9px] sm:text-[10px] text-white font-medium truncate max-w-[60px] sm:max-w-[80px]">
            {report.user_name || "Warga"}
          </span>
        </div>
        {!report.photo_url && !report.video_url && (
          <span className="text-[8px] text-white/30 bg-black/30 px-1.5 py-0.5 rounded-full">
            No photo
          </span>
        )}
      </div>
    </motion.div>
  );

  return (
    <div className={`min-h-screen ${isMalam ? 'bg-black' : 'bg-gray-50'} flex justify-center font-sans`}>
      <div className={`w-full max-w-md min-h-screen ${isMalam ? 'bg-zinc-900' : 'bg-white'} shadow-2xl overflow-hidden relative flex flex-col ${isMalam ? 'border-x border-white/5' : 'border-x border-gray-200'}`}>
        
        {/* Header */}
        <motion.header 
          initial={{ y: 0 }}
          animate={{ 
            y: isHeaderVisible ? 0 : -120,
            opacity: isHeaderVisible ? 1 : 0
          }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className={`fixed top-0 w-full max-w-md z-50 ${isMalam ? 'bg-zinc-900/95' : 'bg-white/95'} backdrop-blur-xl border-b ${isMalam ? 'border-white/10' : 'border-gray-200'}`}
        >
          <div className="px-4 pt-5 pb-3 space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-lg sm:text-xl font-black tracking-tighter text-[#E3655B] leading-none">
                  CERITA RONDA
                </h1>
                <p className={`text-[8px] sm:text-[10px] ${isMalam ? 'text-white/40' : 'text-gray-500'} font-bold tracking-[0.2em] uppercase mt-1`}>
                  Warga Setempat
                </p>
              </div>
              <button
                onClick={() => router.push("/woro")}
                className={`p-2 ${isMalam ? 'text-white/70 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition-colors`}>
                <Bell size={18} className="sm:w-5 sm:h-5" />
              </button>
            </div>

            <div className="relative group">
              <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isMalam ? 'text-white/30' : 'text-gray-400'} group-focus-within:text-[#E3655B] transition-colors`} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari kejadian di sekitar..."
                className={`w-full ${isMalam ? 'bg-white/10 border-white/10 text-white placeholder:text-white/40' : 'bg-gray-100 border-gray-200 text-gray-900 placeholder:text-gray-400'} border rounded-xl py-2.5 pl-9 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-[#E3655B]/50 focus:bg-white/15 transition-all`} />
            </div>
          </div>
        </motion.header>

        <div className="h-[115px] sm:h-[125px]" />

        <main className={`flex-1 overflow-y-auto no-scrollbar px-3 pb-32 ${isMalam ? 'bg-zinc-950' : 'bg-gray-50'}`}>
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E3655B]"></div>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="flex flex-col justify-center items-center h-64">
              <MapPin size={48} className={`mb-3 opacity-30 ${isMalam ? 'text-white/40' : 'text-gray-400'}`} />
              <p className={`text-sm ${isMalam ? 'text-white/40' : 'text-gray-500'}`}>Belum ada laporan</p>
              <p className={`text-xs mt-1 ${isMalam ? 'text-white/30' : 'text-gray-400'}`}>Jadilah yang pertama melaporkan</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {filteredReports.map((report, index) => (
                <ReportCard key={report.id} report={report} index={index} />
              ))}
            </div>
          )}
        </main>

        {/* SmartBottomNav - untuk semua user */}
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

        {/* TOMBOL UPLOAD FLOATING - KHUSUS USER BIASA */}
        {!showLaporPanel && currentIndex === null && userRole !== 'admin' && (
          <div className="uploader-container-frame">
            <button onClick={handleOpenUpload}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
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
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="fixed inset-0 z-[99999] flex items-center justify-center"
            >
              <div className={`w-full max-w-md h-full relative ${isMalam ? 'bg-black' : 'bg-white'}`}>
                {/* Backdrop */}
                <div 
                  className="absolute inset-0 bg-black/90"
                  onClick={closeModal}
                />

                {/* Close Button */}
                <button
                  onClick={closeModal}
                  className="absolute top-4 right-4 z-[110] w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white border border-white/20 active:scale-95 transition-all"
                >
                  <X size={20} />
                </button>

                {/* Scrollable Content */}
                <div
                  ref={modalScrollRef}
                  onScroll={handleModalScroll}
                  className="relative z-10 h-full overflow-y-scroll snap-y snap-mandatory no-scrollbar scroll-smooth"
                >
                  {filteredReports.map((report, idx) => (
                    <div
                      key={report.id}
                      className="h-full w-full snap-start relative flex flex-col bg-zinc-950"
                    >
                      {/* Media + Overlay */}
                      <div className="absolute inset-0 w-full h-full overflow-hidden">
                        {getMediaContent(report)}
                        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80" />
                      </div>

                      <div className="relative h-full flex flex-col justify-end p-4 pb-28 sm:p-7 sm:pb-24">
                        <div className="flex justify-between items-end gap-3 sm:gap-5">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                              <div className="relative shrink-0">
                                <img
                                  src={report.user_avatar || "/default-avatar.png"}
                                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-white/30"
                                  alt="avatar"
                                  onError={(e) => { e.target.src = "/default-avatar.png"; }}
                                />
                                <div className="absolute -bottom-0.5 -right-0.5 bg-[#0095f6] rounded-full p-0.5 border border-black">
                                  <ShieldCheck size={8} className="text-white sm:w-[10px] sm:h-[10px]" />
                                </div>
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-[8px] sm:text-[10px] text-white/50 uppercase font-bold">
                                  Warga Setempat
                                </span>
                                <div className="flex items-center gap-1 flex-wrap">
                                  <span className="text-xs sm:text-sm font-bold text-white">
                                    @{report.user_name?.replace(/\s+/g, '').toLowerCase() || "warga"}
                                  </span>
                                  <span className="text-[10px] sm:text-[13px] text-white/30">
                                    • {formatTimeAgo(report.created_at)}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <h3 className="text-white font-black text-base sm:text-xl mb-1 sm:mb-2 flex items-center gap-1 sm:gap-2 tracking-tight uppercase">
                              <MapPin size={14} className="sm:w-[18px] sm:h-[18px] text-[#E3655B]" />
                              <span className="truncate">{report.tempat?.name || "Pasuruan"}</span>
                            </h3>
                            <p className="text-xs sm:text-sm text-white/90 leading-relaxed mb-4 line-clamp-4">
                              {report.deskripsi || "Tidak ada deskripsi"}
                            </p>

                            <div className="flex gap-2">
                              <input
                                value={commentTexts[report.id] || ""}
                                onChange={(e) => setCommentTexts(prev => ({...prev, [report.id]: e.target.value}))}
                                placeholder="Tulis komentar..."
                                className="flex-1 h-10 sm:h-12 bg-white/10 border border-white/5 rounded-xl px-3 text-xs text-white outline-none focus:border-[#E3655B]/50 transition-all"
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

                          <div className="flex flex-col gap-4 items-center">
                            <div className="flex flex-col items-center gap-1">
                              <button className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 transition-all">
                                <Heart size={20} />
                              </button>
                              <span className="text-[9px] font-bold text-white/60">Like</span>
                            </div>
                            <div className="flex flex-col items-center gap-1">
                              <button className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 transition-all">
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
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
        
        nav { 
          max-width: 28rem !important; 
          margin: 0 auto !important; 
          left: 0 !important; 
          right: 0 !important; 
        }
        
        html {
          scroll-behavior: smooth;
        }
        
        .snap-y {
          scroll-snap-type: y mandatory;
          scroll-snap-stop: always;
        }
        
        .snap-start {
          scroll-snap-align: start;
        }

        /* UPLOADER BUTTON */
        .uploader-container-frame button {
          position: fixed !important; 
          bottom: 100px !important;
          left: 50% !important;
          transform: translateX(140px) !important; 
          width: 62px !important;
          height: 62px !important;
          border-radius: 22px !important;
          background: linear-gradient(135deg, #E3655B 0%, #ff7d72 100%) !important;
          box-shadow: 
            0 10px 25px -5px rgba(0, 0, 0, 0.3),
            0 8px 20px -5px rgba(227, 101, 91, 0.5) !important;
          z-index: 100 !important; 
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          border: 2px solid rgba(255, 255, 255, 0.3) !important;
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
          cursor: pointer !important;
        }

        .uploader-container-frame button:active {
          transform: translateX(140px) scale(0.85) !important;
          filter: brightness(1.1);
          box-shadow: 0 5px 15px -3px rgba(227, 101, 91, 0.7) !important;
        }

        .uploader-container-frame button svg {
          width: 32px !important;
          height: 32px !important;
          color: white !important;
          stroke-width: 3px !important;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
        }
      `}</style>
    </div>
  );
}