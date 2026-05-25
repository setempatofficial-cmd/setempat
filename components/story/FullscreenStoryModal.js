'use client';

import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from "react";
import { MapPin, Eye, Search } from "lucide-react";
import MediaRenderer from "@/components/media/MediaRenderer";
import { formatTimeAgo } from "@/utils/timeUtils";
import DOMPurify from 'dompurify';
import { supabase } from "@/lib/supabaseClient";

// ========== LAZY LOAD COMPONENTS ==========
const FeedActions = lazy(() => import("@/app/components/feed/FeedActions"));
const ExploreSearchView = lazy(() => import("@/components/explore/ExploreSearchView"));

// ========== UTILITY FUNCTIONS ==========
const sanitizeText = (text) => {
  if (!text) return '';
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
};

const getSafeAvatarUrl = (report) => {
  if (report?.user_avatar?.startsWith('https://')) return report.user_avatar;
  const name = report?.user_name || "Warga";
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D8ABC&color=fff&length=2`;
};

const TipeBadge = ({ tipe }) => {
  if (!tipe) return null;
  const config = {
    Ramai: { bg: "bg-yellow-500/20 border-yellow-500/30 text-yellow-300", icon: "🏃" },
    Antri: { bg: "bg-rose-500/20 border-rose-500/30 text-rose-300", icon: "⏳" },
    Default: { bg: "bg-emerald-500/20 border-emerald-500/30 text-emerald-300", icon: "🍃" }
  };
  const current = config[tipe] || config.Default;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${current.bg}`}>
      {current.icon} {tipe}
    </span>
  );
};

// ========== VIDEO MANAGER HOOK (SOLUSI MASALAH VIDEO) ==========
const useVideoManager = () => {
  const videoElementsRef = useRef(new Map());
  const activeVideoIdRef = useRef(null);

  const registerVideo = useCallback((id, videoElement) => {
    if (videoElement) {
      videoElementsRef.current.set(id, videoElement);
    }
  }, []);

  const unregisterVideo = useCallback((id) => {
    const video = videoElementsRef.current.get(id);
    if (video) {
      video.pause();
      video.currentTime = 0;
      videoElementsRef.current.delete(id);
    }
  }, []);

  const playActiveVideo = useCallback((id) => {
    // Pause semua video dulu
    for (const [videoId, video] of videoElementsRef.current.entries()) {
      if (videoId !== id) {
        video.pause();
      }
    }

    // Play video yang aktif
    const activeVideo = videoElementsRef.current.get(id);
    if (activeVideo && activeVideo.paused) {
      activeVideo.play().catch(err => {
        console.warn("Video play failed:", err);
        // Retry play setelah interaksi user
        const retryPlay = () => {
          activeVideo.play().catch(() => { });
          document.removeEventListener('click', retryPlay);
        };
        document.addEventListener('click', retryPlay, { once: true });
      });
    }
    activeVideoIdRef.current = id;
  }, []);

  const pauseAllVideos = useCallback(() => {
    for (const [_, video] of videoElementsRef.current.entries()) {
      video.pause();
    }
  }, []);

  const resumeCurrentVideo = useCallback(() => {
    if (activeVideoIdRef.current) {
      const video = videoElementsRef.current.get(activeVideoIdRef.current);
      if (video && video.paused) {
        video.play().catch(() => { });
      }
    }
  }, []);

  return { registerVideo, unregisterVideo, playActiveVideo, pauseAllVideos, resumeCurrentVideo };
};

// ========== VIEW TRACKER HOOK ==========
const useStoryViewTracker = (userId, onViewRecorded) => {
  const recordedViewsRef = useRef(new Set());
  const viewRateLimiter = useRef(new Map());
  const timeoutRef = useRef(null);

  const recordView = useCallback(async (laporanId) => {
    if (!userId || !laporanId) return;

    const lastTime = viewRateLimiter.current.get(laporanId);
    if (lastTime && Date.now() - lastTime < 5000) return;
    if (recordedViewsRef.current.has(laporanId)) return;

    recordedViewsRef.current.add(laporanId);
    viewRateLimiter.current.set(laporanId, Date.now());

    try {
      const { data: existing } = await supabase
        .from("story_views")
        .select("id")
        .eq("laporan_id", laporanId)
        .eq("user_id", userId)
        .maybeSingle();

      if (!existing) {
        await supabase.from("story_views").insert({
          laporan_id: laporanId,
          user_id: userId,
          viewed_at: new Date().toISOString()
        });
        onViewRecorded?.(laporanId);
      }
    } catch (err) {
      console.error("Error recording view:", err);
      recordedViewsRef.current.delete(laporanId);
    }
  }, [userId, onViewRecorded]);

  const scheduleRecordView = useCallback((laporanId) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => recordView(laporanId), 300);
  }, [recordView]);

  useEffect(() => () => timeoutRef.current && clearTimeout(timeoutRef.current), []);

  return { scheduleRecordView };
};

// ========== SCROLL HOOK ==========
const useStoryScroll = (totalItems, onIndexChange) => {
  const containerRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(null);
  const isAutoScrolling = useRef(false);
  const timeoutRef = useRef(null);

  const handleScroll = useCallback((e) => {
    if (isAutoScrolling.current) return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      const { scrollTop, clientHeight } = e.target;
      if (clientHeight === 0) return;
      const newIndex = Math.round(scrollTop / clientHeight);
      if (newIndex !== currentIndex && newIndex >= 0 && newIndex < totalItems) {
        setCurrentIndex(newIndex);
        onIndexChange?.(newIndex);
      }
    }, 50);
  }, [currentIndex, totalItems, onIndexChange]);

  const scrollToIndex = useCallback((index, behavior = 'smooth') => {
    if (!containerRef.current) return;

    isAutoScrolling.current = true;
    const container = containerRef.current;
    const target = container.children[index];

    if (behavior === 'auto') {
      container.style.scrollSnapType = 'none';
      container.style.scrollBehavior = 'auto';

      if (target) {
        container.scrollTop = target.offsetTop;
      }

      setTimeout(() => {
        container.style.scrollSnapType = 'y mandatory';
        container.style.scrollBehavior = '';
        isAutoScrolling.current = false;
      }, 50);
    } else {
      target?.scrollIntoView({ behavior, block: 'start' });
      setTimeout(() => { isAutoScrolling.current = false; }, 300);
    }
  }, []);

  useEffect(() => () => timeoutRef.current && clearTimeout(timeoutRef.current), []);

  return { containerRef, currentIndex, setCurrentIndex, handleScroll, scrollToIndex };
};

// ========== SUB-COMPONENTS ==========
const StoryMediaBackground = ({ report, isActive, onVideoReady, onVideoElement }) => {
  const mediaUrl = report.video_url || report.photo_url;
  const videoRef = useRef(null);

  if (!mediaUrl) return null;

  // Effect untuk handle video play/pause berdasarkan isActive
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      // Kasih delay sedikit untuk memastikan DOM siap
      const playTimeout = setTimeout(() => {
        video.play().catch(err => {
          console.warn("Auto-play failed:", err);
          // Simpan intent untuk play nanti
          const playOnInteraction = () => {
            video.play().catch(() => { });
            document.removeEventListener('click', playOnInteraction);
            document.removeEventListener('touchstart', playOnInteraction);
          };
          document.addEventListener('click', playOnInteraction);
          document.addEventListener('touchstart', playOnInteraction);
        });
      }, 100);
      return () => clearTimeout(playTimeout);
    } else {
      video.pause();
    }
  }, [isActive]);

  // Register video element ke parent manager
  useEffect(() => {
    if (videoRef.current && onVideoElement) {
      onVideoElement(videoRef.current);
    }
  }, [onVideoElement]);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-black flex items-center justify-center">
      {report.video_url ? (
        <video
          ref={videoRef}
          src={report.video_url}
          className="w-full h-full object-cover"
          muted={!isActive}
          loop
          playsInline
          preload={isActive ? "auto" : "metadata"}
          onCanPlay={() => onVideoReady?.(true)}
          poster={report.photo_url || undefined}
        />
      ) : (
        <img
          src={report.photo_url}
          className="w-full h-full object-cover"
          alt=""
        />
      )}
      {!report.video_url && <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80" />}
    </div>
  );
};

const StoryTextOnlyBackground = ({ report, viewCount }) => {
  const safeTipe = sanitizeText(report.tipe || "");
  const safeDeskripsi = sanitizeText(report.deskripsi || "Tidak ada deskripsi");
  const safeLocation = sanitizeText(report.display_location_name || "Pasuruan");
  const safeUserName = sanitizeText(report.user_name || "warga");
  const avatarUrl = getSafeAvatarUrl(report);

  return (
    <div className="relative h-full w-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-900 to-black px-6 text-center">
      <div className="max-w-xs mx-auto flex flex-col items-center">
        <div className="text-6xl mb-4 opacity-80 animate-bounce">
          {safeTipe === "Ramai" ? "🏃‍♂️" : safeTipe === "Antri" ? "⏰" : "📢"}
        </div>

        <div className="mb-4">
          <TipeBadge tipe={safeTipe} />
        </div>

        <p className="text-white font-bold text-xl leading-relaxed mb-6 break-words max-w-full">
          "{safeDeskripsi}"
        </p>

        <div className="flex items-center gap-1 text-white/60 text-xs mb-6">
          <MapPin size={12} className="text-rose-500" />
          <span className="truncate max-w-[200px]">{safeLocation}</span>
        </div>

        <div className="flex items-center gap-2 pt-4 border-t border-white/10 w-full justify-center">
          <img src={avatarUrl} className="w-7 h-7 rounded-full object-cover border border-white/20" alt="" />
          <span className="text-white/80 text-xs font-medium truncate max-w-[100px]">
            @{safeUserName.replace(/\s/g, '').toLowerCase()}
          </span>
          <span className="text-white/40 text-[11px]">• {formatTimeAgo(report.created_at)}</span>
        </div>

        <div className="mt-4 flex items-center gap-1 text-white/40 text-[11px]">
          <Eye size={12} />
          <span>{viewCount?.toLocaleString("id-ID") || 0} tayangan</span>
        </div>
      </div>
    </div>
  );
};

const StoryContentOverlay = ({ report }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const safeTipe = sanitizeText(report.tipe || "");
  const safeDeskripsi = sanitizeText(report.deskripsi || "");
  const safeUserName = sanitizeText(report.user_name || "warga");
  const safeTempatName = sanitizeText(report.tempat?.name || report.display_location_name || "Lokasi");
  const avatarUrl = getSafeAvatarUrl(report);
  const isTextLong = safeDeskripsi.length > 90;

  return (
    <>
      <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none z-10 transition-all duration-300 ${isExpanded ? 'via-black/70' : ''}`} />

      <div className="absolute bottom-0 left-0 right-16 p-4 pb-24 z-20 flex flex-col gap-2 pointer-events-none select-none">
        {safeTipe && (
          <div className="dynamic-shadow">
            <TipeBadge tipe={safeTipe} />
          </div>
        )}

        <div className="flex items-center gap-1.5 dynamic-shadow">
          <MapPin size={14} className="text-rose-500 shrink-0" />
          <h2 className="text-white font-black text-base tracking-tight truncate drop-shadow-md">
            {safeTempatName}
          </h2>
        </div>

        {safeDeskripsi && (
          <div className="pointer-events-auto max-w-full">
            <p className={`text-white/95 text-xs sm:text-sm leading-snug font-normal drop-shadow-sm transition-all duration-300 ${isExpanded ? 'max-h-[200px] overflow-y-auto' : 'line-clamp-2'}`}>
              {safeDeskripsi}
            </p>

            {isTextLong && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="text-white/60 text-[11px] font-bold mt-1 hover:text-white/90 active:scale-95 transition-all"
              >
                {isExpanded ? "Sembunyikan" : "...selengkapnya"}
              </button>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1 opacity-80">
          <img src={avatarUrl} className="w-4 h-4 rounded-full border border-white/20 object-cover shrink-0" alt="" />
          <span className="text-white/70 text-[10px] truncate max-w-[110px]">
            @{safeUserName.replace(/\s/g, '').toLowerCase()}
          </span>
          <span className="text-white/40 text-[9px] shrink-0">{formatTimeAgo(report.created_at)}</span>
        </div>
      </div>
    </>
  );
};

const StorySlide = ({ report, isActive, viewCount, likedLaporan, laporanLikeCounts, onLike, onShare, onOpenAIChat, onOpenKomentar, onNavigateToDetail, theme, onVideoReady, onRegisterVideo }) => {
  const hasMedia = useMemo(() => !!(report.photo_url || report.video_url), [report]);
  const isGeneralLocation = report.report_type === 'general_location' || !report.tempat_id;
  const slideId = useMemo(() => `story-${report.id}`, [report.id]);

  const handleVideoElement = useCallback((videoElement) => {
    if (videoElement && onRegisterVideo) {
      onRegisterVideo(slideId, videoElement);
    }
  }, [slideId, onRegisterVideo]);

  return (
    <div className="h-[100dvh] w-full snap-start snap-always relative flex flex-col bg-zinc-950 overflow-hidden select-none">
      <div
        onClick={() => !isGeneralLocation && onNavigateToDetail?.(report.id)}
        className={`absolute inset-0 z-10 ${isGeneralLocation ? 'cursor-default' : 'cursor-pointer'}`}
      />

      {hasMedia ? (
        <StoryMediaBackground
          report={report}
          isActive={isActive}
          onVideoReady={onVideoReady}
          onVideoElement={handleVideoElement}
        />
      ) : (
        <StoryTextOnlyBackground report={report} viewCount={viewCount} />
      )}

      <div className="absolute right-2 bottom-24 z-50 flex flex-col items-center gap-4">
        <Suspense fallback={<div className="w-8 h-8 rounded-full bg-white/20 animate-pulse" />}>
          <FeedActions
            item={{ id: report.tempat_id, name: report.display_location_name }}
            openAIModal={() => onOpenAIChat?.(report)}
            openKomentarModal={() => onOpenKomentar?.(report)}
            onShare={() => onShare?.(report)}
            variant="floating-sidebar"
            theme={theme}
            isLaporanLike={true}
            isLaporanLiked={likedLaporan?.has(report.id)}
            laporanLikeCount={laporanLikeCounts?.[report.id] || 0}
            onLaporanLike={() => onLike?.(report)}
          />
        </Suspense>

        {hasMedia && (
          <div className="flex flex-col items-center gap-0.5 mt-1 bg-black/20 p-1.5 rounded-full backdrop-blur-sm min-w-[40px]">
            <Eye size={16} className="text-white/80 drop-shadow" />
            <span className="text-[10px] font-bold text-white/90 drop-shadow">
              {viewCount >= 1000 ? `${(viewCount / 1000).toFixed(1)}k` : viewCount || 0}
            </span>
          </div>
        )}
      </div>

      {hasMedia && <StoryContentOverlay report={report} />}
    </div>
  );
};

// ========== MAIN COMPONENT ==========
export default function FullscreenStoryModal({
  isOpen,
  reports = [],
  initialIndex = 0,
  viewCounts,
  likedLaporan,
  laporanLikeCounts,
  onClose,
  onLike,
  onShare,
  onOpenAIChat,
  onOpenKomentar,
  onNavigateToDetail,
  onViewRecorded,
  userId,
  theme,
}) {
  const [showSearchView, setShowSearchView] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(initialIndex);
  const { registerVideo, unregisterVideo, playActiveVideo, pauseAllVideos, resumeCurrentVideo } = useVideoManager();

  const { containerRef, currentIndex, setCurrentIndex, handleScroll, scrollToIndex } = useStoryScroll(
    reports?.length || 0,
    (newIndex) => setCurrentVideoIndex(newIndex)
  );
  const { scheduleRecordView } = useStoryViewTracker(userId, onViewRecorded);

  // Handle video play saat index berubah
  useEffect(() => {
    if (currentVideoIndex !== null && reports[currentVideoIndex]?.video_url) {
      // Kasih delay untuk memastikan video element sudah terdaftar
      const timer = setTimeout(() => {
        const videoId = `story-${reports[currentVideoIndex]?.id}`;
        playActiveVideo(videoId);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [currentVideoIndex, reports, playActiveVideo]);

  // Modal animation
  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      // Resume video setelah modal terbuka
      setTimeout(() => resumeCurrentVideo(), 200);
    } else {
      pauseAllVideos();
      const timer = setTimeout(() => setIsRendered(false), 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen, pauseAllVideos, resumeCurrentVideo]);

  // Handle search view
  useEffect(() => {
    if (showSearchView) {
      pauseAllVideos();
    } else {
      resumeCurrentVideo();
    }
  }, [showSearchView, pauseAllVideos, resumeCurrentVideo]);

  // Record view
  useEffect(() => {
    if (currentIndex !== null && reports?.[currentIndex]?.id) {
      scheduleRecordView(reports[currentIndex].id);
    }
  }, [currentIndex, reports, scheduleRecordView]);

  // Set initial index
  useEffect(() => {
    if (isOpen && reports?.[initialIndex]) {
      setCurrentIndex(initialIndex);
      setCurrentVideoIndex(initialIndex);
      setTimeout(() => scrollToIndex(initialIndex, 'auto'), 50);
    }
  }, [isOpen, initialIndex, reports, scrollToIndex, setCurrentIndex]);

  // Handle back button
  useEffect(() => {
    if (!isOpen) return;
    const handlePopState = (e) => {
      e.preventDefault();
      if (currentIndex > 0) {
        const newIdx = currentIndex - 1;
        setCurrentIndex(newIdx);
        setCurrentVideoIndex(newIdx);
        scrollToIndex(newIdx, 'smooth');
      } else {
        onClose();
      }
      window.history.pushState(null, '', window.location.href);
    };
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isOpen, currentIndex, setCurrentIndex, scrollToIndex, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isRendered || !reports.length) return null;

  return (
    <div className={`fixed inset-0 z-[99999] flex items-center justify-center bg-black transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
      <div className={`w-full max-w-[420px] h-[100dvh] relative overflow-hidden md:rounded-xl shadow-2xl ${theme?.isMalam ? 'bg-black' : 'bg-zinc-950'}`}>

        <button
          onClick={() => setShowSearchView(true)}
          className="absolute top-4 right-4 z-[110] w-9 h-9 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white/95 border border-white/10 active:scale-95 transition-transform"
          title="Cari Lokasi"
        >
          <Search size={16} className="text-white" />
        </button>

        {showSearchView && (
          <Suspense fallback={<div className="absolute inset-0 bg-black/95 z-[200] flex items-center justify-center"><div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>}>
            <ExploreSearchView
              reports={reports}
              onSelectReport={(originalIndex) => {
                setCurrentIndex(originalIndex);
                setCurrentVideoIndex(originalIndex);
                scrollToIndex(originalIndex, 'auto');
                setShowSearchView(false);
              }}
              onBack={() => setShowSearchView(false)}
              theme={theme}
            />
          </Suspense>
        )}

        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="h-full overflow-y-scroll snap-y snap-mandatory no-scrollbar touch-pan-y"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {reports.map((report, idx) => (
            <StorySlide
              key={report.id}
              report={report}
              isActive={idx === currentIndex}
              viewCount={viewCounts?.[report.id]}
              likedLaporan={likedLaporan}
              laporanLikeCounts={laporanLikeCounts}
              onLike={onLike}
              onShare={onShare}
              onOpenAIChat={onOpenAIChat}
              onOpenKomentar={onOpenKomentar}
              onNavigateToDetail={onNavigateToDetail}
              theme={theme}
              onRegisterVideo={registerVideo}
            />
          ))}
        </div>
      </div>
    </div>
  );
}