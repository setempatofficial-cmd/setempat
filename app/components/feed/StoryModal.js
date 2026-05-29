"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { X, MapPin, ShieldCheck, Eye, Trash2, Share2, MoreVertical, Compass, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { formatTimeAgo } from "@/utils/timeUtils";
import MediaRenderer from "@/components/media/MediaRenderer";

// ==================== HELPER FUNCTIONS ====================
const getAvatarUrl = (report) => {
  if (report?.user_avatar) return report.user_avatar;
  const name = report?.user_name || "Warga";
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=E3655B&color=fff`;
};

const formatViewCount = (count) => {
  if (!count) return "—";
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
};

// ==================== KOMPONEN DESKRIPSI YANG BISA DI-EXPAND ====================
const ExpandableDescription = ({ text }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [needsExpanding, setNeedsExpanding] = useState(false);
  const descriptionRef = useRef(null);

  useEffect(() => {
    if (descriptionRef.current) {
      const lineHeight = parseInt(getComputedStyle(descriptionRef.current).lineHeight);
      const maxHeight = lineHeight * 3;
      setNeedsExpanding(descriptionRef.current.scrollHeight > maxHeight);
    }
  }, [text]);

  if (!text) return null;

  return (
    <div className="mt-1">
      <p
        ref={descriptionRef}
        className={`text-white font-medium text-base sm:text-lg leading-relaxed tracking-tight drop-shadow-md transition-all duration-300 ${!isExpanded ? 'line-clamp-3' : ''
          }`}
      >
        {text}
      </p>

      {needsExpanding && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 mt-2 text-white/50 hover:text-white/80 transition-colors active:scale-95"
        >
          {isExpanded ? (
            <>
              <ChevronUp size={14} />
              <span className="text-[10px] font-medium">Sembunyikan</span>
            </>
          ) : (
            <>
              <ChevronDown size={14} />
              <span className="text-[10px] font-medium">Baca Selengkapnya</span>
            </>
          )}
        </button>
      )}
    </div>
  );
};

// ==================== MAIN COMPONENT ====================
export default function StoryModalFullscreen({
  isOpen,
  onClose,
  stories = [],
  namaTempat,
  currentUserId,
  isAdmin,
  onRefreshNeeded
}) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewCounts, setViewCounts] = useState({});
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [recordedViews, setRecordedViews] = useState(new Set());

  const modalScrollRef = useRef(null);
  const isAutoScrollingRef = useRef(false);
  const viewsLoadedRef = useRef(false);

  // Mencegah klik kanan pada area video/media
  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
  }, []);

  // ==================== TAMBAH CTA DI AKHIR ====================
  const storiesWithCTA = useMemo(() => {
    if (!stories.length) return [];

    const exploreCTA = {
      id: 'explore-cta',
      isExploreCTA: true,
      type: 'explore',
      title: 'Jelajahi Lebih Banyak',
      description: 'Lihat kondisi terkini lainnya di sekitar kamu',
      icon: '🔍'
    };

    const laporCTA = currentUserId ? {
      id: 'lapor-cta',
      isLaporCTA: true,
      type: 'lapor',
      title: 'Laporkan Kondisi Terkini',
      description: 'Bantu warga lain dengan berbagi informasi',
      icon: '📢'
    } : null;

    const ctas = [exploreCTA];
    if (laporCTA) ctas.push(laporCTA);

    return [...stories, ...ctas];
  }, [stories, currentUserId]);

  const storyCount = storiesWithCTA.length;
  const currentStory = storiesWithCTA[currentIndex];

  // ==================== BATCH LOAD VIEW COUNTS ====================
  useEffect(() => {
    if (!isOpen || !stories.length || viewsLoadedRef.current) return;

    const loadViewCounts = async () => {
      const storyIds = stories.map(s => s.id).filter(Boolean);
      if (!storyIds.length) return;

      try {
        const { data, error } = await supabase
          .from("story_views")
          .select("laporan_id")
          .in("laporan_id", storyIds);

        if (error) throw error;

        const counts = {};
        data?.forEach(view => {
          counts[view.laporan_id] = (counts[view.laporan_id] || 0) + 1;
        });
        setViewCounts(counts);
        viewsLoadedRef.current = true;
      } catch (err) {
        console.error("Error loading view counts:", err);
      }
    };

    loadViewCounts();
  }, [isOpen, stories]);

  // ==================== RECORD VIEW ====================
  const recordView = useCallback(async (storyId) => {
    if (!currentUserId || recordedViews.has(storyId) || storyId?.includes('cta')) return;

    setRecordedViews(prev => new Set(prev).add(storyId));

    try {
      const { data: existing } = await supabase
        .from("story_views")
        .select("id")
        .eq("laporan_id", storyId)
        .eq("user_id", currentUserId)
        .maybeSingle();

      if (!existing) {
        await supabase.from("story_views").insert({
          laporan_id: storyId,
          user_id: currentUserId,
          viewed_at: new Date().toISOString()
        });

        setViewCounts(prev => ({
          ...prev,
          [storyId]: (prev[storyId] || 0) + 1
        }));
      }
    } catch (err) {
      console.error("Error recording view:", err);
    }
  }, [currentUserId, recordedViews]);

  useEffect(() => {
    if (isOpen && currentStory?.id && !currentStory?.isExploreCTA && !currentStory?.isLaporCTA) {
      recordView(currentStory.id);
    }
  }, [isOpen, currentStory, recordView]);

  // ==================== SCROLL HANDLER ====================
  const handleScroll = useCallback((e) => {
    if (isAutoScrollingRef.current) return;

    const container = e.target;
    const { scrollTop, clientHeight } = container;
    const newIndex = Math.round(scrollTop / clientHeight);

    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < storyCount) {
      setCurrentIndex(newIndex);
      setShowMenu(false);
    }
  }, [currentIndex, storyCount]);

  const scrollToIndex = useCallback((index) => {
    if (!modalScrollRef.current) return;

    isAutoScrollingRef.current = true;
    const targetElement = modalScrollRef.current.children[index];
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setTimeout(() => {
      isAutoScrollingRef.current = false;
    }, 500);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
      setShowMenu(false);
      viewsLoadedRef.current = false;

      setTimeout(() => {
        if (modalScrollRef.current) {
          modalScrollRef.current.scrollTo({ top: 0, behavior: 'instant' });
        }
      }, 100);
    }
  }, [isOpen]);

  // ==================== BACK BUTTON HANDLER ====================
  useEffect(() => {
    if (!isOpen) return;

    const handlePopState = () => {
      onClose();
    };

    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isOpen, onClose]);

  // ==================== ACTIONS ====================
  const handleDelete = async () => {
    if (!currentStory?.id || isDeleting || currentStory?.isExploreCTA || currentStory?.isLaporCTA) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("laporan_warga")
        .delete()
        .eq("id", currentStory.id);

      if (error) throw error;

      const newStories = stories.filter(s => s.id !== currentStory.id);

      if (newStories.length === 0) {
        onClose();
      } else {
        const newIndex = Math.min(currentIndex, newStories.length - 1);
        setCurrentIndex(newIndex);
        setTimeout(() => scrollToIndex(newIndex), 100);
      }

      if (onRefreshNeeded) onRefreshNeeded();
      setShowMenu(false);
    } catch (err) {
      console.error("Error deleting story:", err);
      alert("Gagal menghapus cerita");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleShare = async () => {
    if (currentStory?.isExploreCTA || currentStory?.isLaporCTA) return;

    const shareUrl = `${window.location.origin}/post/${currentStory?.id}`;
    const title = `${namaTempat || "Setempat"} — ${currentStory?.tipe || "Live Report"}`;
    const text = currentStory?.deskripsi || "Cek kondisi terkini di sini!";

    try {
      if (navigator.share) {
        await navigator.share({ title, text, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(`${text}\n${shareUrl}`);
        alert("Link disalin!");
      }
    } catch (err) {
      console.log("Share cancelled:", err);
    }
    setShowMenu(false);
  };

  const handleGoToExplore = () => {
    onClose();
    router.push('/explore');
  };

  const handleGoToLapor = () => {
    onClose();
    window.dispatchEvent(new CustomEvent('open-lapor-panel'));
  };

  const canDelete = useMemo(() => {
    if (!currentStory || currentStory?.isExploreCTA || currentStory?.isLaporCTA) return false;
    const isOwner = currentUserId && currentStory.user_id === currentUserId;
    return isOwner || isAdmin;
  }, [currentStory, currentUserId, isAdmin]);

  // ==================== RENDER CTA EXPLORE ====================
  const renderExploreCTA = (story) => (
    <div className="h-[100dvh] w-full snap-start snap-always relative flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#E3655B] to-[#25F4EE]">
      <div className="absolute inset-0 bg-black/20 z-0" />
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <button
        onClick={handleGoToExplore}
        className="relative z-10 text-center px-6 py-8 max-w-sm mx-auto group cursor-pointer"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", duration: 0.6 }}
          className="mb-6 flex justify-center"
        >
          <Compass size={80} className="text-white drop-shadow-lg group-hover:scale-110 transition-transform duration-300" />
        </motion.div>

        <motion.h2
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-3xl font-black text-white mb-3 drop-shadow-lg"
        >
          {story.title}
        </motion.h2>

        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-white/90 text-sm mb-8 drop-shadow"
        >
          {story.description}
        </motion.p>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-6 py-3 rounded-full group-hover:bg-white/30 transition-all"
        >
          <span className="text-white font-bold text-sm">Mulai Explore</span>
          <motion.span
            animate={{ x: [0, 5, 0] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="text-white text-lg"
          >
            →
          </motion.span>
        </motion.div>
      </button>

      <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-2 z-10">
        {[0, 1, 2, 3, 4].map(i => (
          <div
            key={i}
            className={`w-1.5 h-1.5 rounded-full bg-white/40 transition-all duration-300 ${i === 2 ? 'w-3 bg-white/90' : ''}`}
          />
        ))}
      </div>
    </div>
  );

  // ==================== RENDER CTA LAPOR ====================
  const renderLaporCTA = (story) => (
    <div className="h-[100dvh] w-full snap-start snap-always relative flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900">
      <div className="absolute inset-0 bg-black/30 z-0" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none z-0" />

      <button
        onClick={handleGoToLapor}
        className="relative z-10 text-center px-6 py-8 max-w-sm mx-auto group cursor-pointer"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", duration: 0.6 }}
          className="mb-6 flex justify-center"
        >
          <Plus size={80} className="text-white drop-shadow-lg group-hover:scale-110 transition-transform duration-300" />
        </motion.div>

        <motion.h2
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-3xl font-black text-white mb-3 drop-shadow-lg"
        >
          {story.title}
        </motion.h2>

        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-white/80 text-sm mb-8"
        >
          {story.description}
        </motion.p>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-6 py-3 rounded-full group-hover:bg-white/20 transition-all"
        >
          <span className="text-white font-bold text-sm">Laporkan Sekarang</span>
          <motion.span
            animate={{ rotate: [0, 90, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="text-white text-lg"
          >
            +
          </motion.span>
        </motion.div>
      </button>
    </div>
  );

  // ==================== RENDER STORY ITEM ====================
  const renderStoryItem = (story, idx) => {
    if (story.isExploreCTA) return renderExploreCTA(story);
    if (story.isLaporCTA) return renderLaporCTA(story);

    const hasMedia = story.photo_url || story.video_url;
    const isActive = idx === currentIndex;
    const viewCount = viewCounts[story.id] || 0;

    return (
      <div
        className="h-[100dvh] w-full snap-start snap-always relative flex flex-col bg-zinc-950 overflow-hidden select-none"
        onContextMenu={handleContextMenu}
      >
        {/* Media Background */}
        <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
          {hasMedia ? (
            <>
              <MediaRenderer
                url={story.video_url || story.photo_url}
                className="w-full h-full object-cover"
                autoPlay={isActive}
                muted={!isActive}
                loop={isActive}
                playsInline
                preload={isActive ? "auto" : "none"}
                isActive={isActive}
              />
              {!story.video_url && (
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80" />
              )}
            </>
          ) : (
            <div className="relative h-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900 px-6 text-center">
              <div className="text-7xl mb-6 opacity-60">
                {story.tipe === "Ramai" ? "🏃‍♂️" : story.tipe === "Antri" ? "⏰" : "📢"}
              </div>
              {story.tipe && (
                <div className="mb-4 flex justify-center">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase ${story.tipe === "Ramai" ? "bg-yellow-500/20 text-yellow-300" :
                    story.tipe === "Antri" ? "bg-rose-500/20 text-rose-300" :
                      "bg-emerald-500/20 text-emerald-300"
                    }`}>
                    <span>{story.tipe === "Ramai" ? "🏃" : story.tipe === "Antri" ? "⏳" : "🍃"}</span>
                    <span>{story.tipe}</span>
                  </span>
                </div>
              )}
              <p className="text-white font-black text-2xl sm:text-3xl leading-relaxed tracking-tight italic mb-6 max-w-sm mx-auto">
                "{story.deskripsi || "Tidak ada deskripsi kondisi"}"
              </p>
              <div className="flex items-center justify-center gap-2 text-white/60 text-sm mb-6">
                <MapPin size={14} className="text-[#E3655B]" />
                <span>{story.tempat?.name || namaTempat || "Lokasi"}</span>
              </div>
              <div className="flex items-center justify-center gap-2 pt-4 border-t border-white/10 w-full max-w-xs mx-auto">
                <img
                  src={getAvatarUrl(story)}
                  className="w-8 h-8 rounded-full border border-white/30 object-cover"
                  alt="avatar"
                />
                <span className="text-white/80 text-sm font-medium">
                  @{story.user_name?.replace(/\s+/g, '').toLowerCase() || "warga"}
                </span>
                <span className="text-white/40 text-xs">•</span>
                <span className="text-white/40 text-xs">{formatTimeAgo(story.created_at)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Content Overlay (Untuk post bermedia) */}
        {hasMedia && (
          <div className="absolute inset-0 flex flex-col justify-end z-10 pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />

            <div className="relative p-5 pb-6 w-full pointer-events-auto">
              <div className="flex flex-col gap-2 mb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="relative shrink-0">
                      <img
                        src={getAvatarUrl(story)}
                        className="w-10 h-10 rounded-full object-cover border-2 border-white/30"
                        alt="avatar"
                      />
                      <div className="absolute -bottom-0.5 -right-0.5 bg-[#E3655B] rounded-full p-0.5 border border-black">
                        <ShieldCheck size={8} className="text-white" />
                      </div>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[8px] text-white/50 uppercase font-black tracking-widest">Warga Setempat</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-bold text-white">
                          @{story.user_name?.replace(/\s+/g, '').toLowerCase() || "warga"}
                        </span>
                        <span className="text-[10px] text-white/40">• {formatTimeAgo(story.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowMenu(prev => !prev)}
                    className="w-8 h-8 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center hover:bg-black/50 transition-all"
                  >
                    <MoreVertical size={18} className="text-white" />
                  </button>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {story.tipe && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border ${story.tipe === "Ramai" ? "bg-yellow-500/20 border-yellow-500/40 text-yellow-300" :
                      story.tipe === "Antri" ? "bg-rose-500/20 border-rose-500/40 text-rose-300" :
                        "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                      }`}>
                      <span>{story.tipe === "Ramai" ? "🏃" : story.tipe === "Antri" ? "⏳" : "🍃"}</span>
                      <span>{story.tipe}</span>
                    </span>
                  )}
                  <div className="flex items-center gap-1 bg-black/30 backdrop-blur-sm px-2 py-0.5 rounded-md text-white/70 text-[10px]">
                    <MapPin size={10} className="text-[#E3655B]" />
                    <span className="truncate max-w-[150px] font-medium">{story.tempat?.name || namaTempat || "Pasuruan"}</span>
                  </div>
                </div>
              </div>

              {/* DESKRIPSI YANG BISA DI-EXPAND */}
              <ExpandableDescription text={story.deskripsi || "Tidak ada deskripsi kondisi terkini."} />

              <div className="flex items-center gap-1.5 mt-3">
                <Eye size={12} className="text-white/40" />
                <span className="text-[10px] font-medium text-white/40">
                  {formatViewCount(viewCount)} Tayangan
                </span>
              </div>
            </div>
          </div>
        )}

        {/* View Count (Untuk post tanpa media) */}
        {!hasMedia && (
          <div className="absolute bottom-6 left-0 right-0 flex justify-center z-10 pointer-events-none">
            <div className="flex items-center gap-1.5 bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-full">
              <Eye size={12} className="text-white/50" />
              <span className="text-[10px] font-medium text-white/50">
                {formatViewCount(viewCount)} tayangan
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ==================== MAIN RENDER ====================
  if (!isOpen || storyCount === 0) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[99999] bg-black/95 backdrop-blur-sm flex items-center justify-center"
      >
        <div className="relative w-full max-w-[450px] h-[100dvh] bg-black overflow-hidden shadow-2xl">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-50 w-9 h-9 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white border border-white/10 hover:bg-black/60 active:scale-95 transition-all"
          >
            <X size={20} />
          </button>

          {/* Menu Dropdown */}
          <AnimatePresence>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setShowMenu(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  className="absolute top-16 right-4 z-50 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl min-w-[180px]"
                >
                  <button
                    onClick={handleShare}
                    className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 text-white active:bg-white/10 transition-colors"
                  >
                    <Share2 size={16} className="text-white/70" />
                    <span className="text-[13px] font-medium">Bagikan Cerita</span>
                  </button>

                  {canDelete && (
                    <>
                      <div className="h-px bg-white/10 mx-3" />
                      <button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-rose-500/10 text-rose-400 active:bg-rose-500/20 transition-colors disabled:opacity-50"
                      >
                        {isDeleting ? (
                          <div className="w-4 h-4 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                        <span className="text-[13px] font-medium">
                          {isDeleting ? "Menghapus..." : "Hapus Cerita"}
                        </span>
                      </button>
                    </>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Scrollable Stories Container */}
          <div
            ref={modalScrollRef}
            onScroll={handleScroll}
            className="h-full overflow-y-scroll snap-y snap-mandatory scroll-smooth touch-pan-y no-scrollbar relative z-0"
            style={{
              WebkitOverflowScrolling: 'touch',
              scrollSnapStop: 'always'
            }}
          >
            {storiesWithCTA.map((story, idx) => (
              <div key={story.id || `cta-${idx}`}>
                {renderStoryItem(story, idx)}
              </div>
            ))}
          </div>

          {/* Index Indicator */}
          {storyCount > 1 && (
            <div className="absolute bottom-4 right-4 z-30 pointer-events-none">
              <div className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/5">
                <span className="text-[10px] font-medium text-white/90">
                  {currentIndex + 1} / {storyCount}
                </span>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}