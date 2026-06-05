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
  useEffect(() => {
    return () => {
      // Hentikan semua video saat komponen di-unmount
      videoElementsRef.current.forEach((video, id) => {
        video.pause();
        video.src = ''; // Bebaskan memory
        video.load(); // Force cleanup
        videoElementsRef.current.delete(id);
      });
      videoElementsRef.current.clear();
    };
  }, []);

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
// ========== VIEW TRACKER HOOK (VERSION WITH DEBUG) ==========
const useStoryViewTracker = (userId, onViewRecorded) => {
  const recordedViewsRef = useRef(new Set());
  const viewRateLimiter = useRef(new Map());
  const timeoutRef = useRef(null);

  const recordView = useCallback(async (laporanId) => {
    console.group('📊 [VIEW TRACKER] Recording View');
    console.log('Step 1 - Check inputs:', {
      laporanId,
      userId,
      typeOfLaporanId: typeof laporanId,
      typeOfUserId: typeof userId,
      stringifiedLaporanId: String(laporanId)
    });

    if (!userId) {
      console.error('❌ FAILED: userId is', userId);
      console.groupEnd();
      return;
    }

    if (!laporanId) {
      console.error('❌ FAILED: laporanId is', laporanId);
      console.groupEnd();
      return;
    }

    // Konversi laporanId ke number (karena table pakai bigint)
    const numericLaporanId = Number(laporanId);
    console.log('Step 2 - Convert ID:', {
      original: laporanId,
      converted: numericLaporanId,
      isValidNumber: !isNaN(numericLaporanId)
    });

    if (isNaN(numericLaporanId)) {
      console.error('❌ FAILED: Cannot convert laporanId to number');
      console.groupEnd();
      return;
    }

    // Rate limiting check
    const lastTime = viewRateLimiter.current.get(laporanId);
    const now = Date.now();
    if (lastTime && now - lastTime < 5000) {
      console.log('⏭️ SKIPPED: Rate limited', {
        lastView: new Date(lastTime).toISOString(),
        now: new Date(now).toISOString(),
        diff: now - lastTime,
        limit: 5000
      });
      console.groupEnd();
      return;
    }

    if (recordedViewsRef.current.has(laporanId)) {
      console.log('⏭️ SKIPPED: Already recorded this session');
      console.groupEnd();
      return;
    }

    console.log('Step 3 - Proceeding to database...');
    recordedViewsRef.current.add(laporanId);
    viewRateLimiter.current.set(laporanId, now);

    try {
      // Cek apakah sudah ada view sebelumnya
      console.log('Step 4 - Checking existing view...');
      const { data: existing, error: checkError } = await supabase
        .from("story_views")
        .select("id, viewed_at")
        .eq("laporan_id", numericLaporanId)
        .eq("user_id", userId)
        .maybeSingle();

      if (checkError) {
        console.error('❌ DB ERROR (check):', checkError);
        console.error('Error details:', {
          code: checkError.code,
          message: checkError.message,
          details: checkError.details
        });
        recordedViewsRef.current.delete(laporanId);
        console.groupEnd();
        return;
      }

      if (existing) {
        console.log('ℹ️ View already exists in database:', {
          viewId: existing.id,
          viewedAt: existing.viewed_at
        });
        console.groupEnd();
        return;
      }

      // Insert view baru
      console.log('Step 5 - Inserting new view...');
      const viewData = {
        laporan_id: numericLaporanId,
        user_id: userId,
        viewed_at: new Date().toISOString()
      };
      console.log('Insert data:', viewData);

      const { data: insertData, error: insertError } = await supabase
        .from("story_views")
        .insert(viewData)
        .select();

      if (insertError) {
        console.error('❌ DB ERROR (insert):', insertError);
        console.error('Error details:', {
          code: insertError.code,
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint
        });
        recordedViewsRef.current.delete(laporanId);
      } else {
        console.log('✅ SUCCESS: View recorded successfully!', {
          insertedData: insertData,
          laporanId: numericLaporanId,
          userId: userId,
          timestamp: viewData.viewed_at
        });
        onViewRecorded?.(laporanId);
      }
    } catch (err) {
      console.error('❌ UNEXPECTED ERROR:', err);
      console.error('Error stack:', err.stack);
      recordedViewsRef.current.delete(laporanId);
    }

    console.groupEnd();
  }, [userId, onViewRecorded]);

  const scheduleRecordView = useCallback((laporanId) => {
    console.log('📝 [VIEW TRACKER] Scheduling view recording for:', laporanId);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => recordView(laporanId), 300);
  }, [recordView]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Log ketika hook diinisialisasi
  useEffect(() => {
    console.log('🔧 [VIEW TRACKER] Hook initialized with userId:', userId);
  }, [userId]);

  return { scheduleRecordView };
};

// ========== SCROLL HOOK ==========
const useStoryScroll = (totalItems, onIndexChange) => {
  const containerRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(null);
  const isAutoScrolling = useRef(false);
  const timeoutRef = useRef(null);
  const slidePositionsRef = useRef([]); // ✅ Cache posisi slide

  // ✅ Update posisi slide setiap kali ada perubahan
  const updateSlidePositions = useCallback(() => {
    if (!containerRef.current) return;

    const slides = Array.from(containerRef.current.children);
    let accumulatedHeight = 0;

    slidePositionsRef.current = slides.map((slide) => {
      const height = slide.clientHeight;
      const position = accumulatedHeight;
      accumulatedHeight += height;
      return { top: position, bottom: position + height, height };
    });
  }, []);

  // ✅ Handle scroll dengan akurat
  const handleScroll = useCallback((e) => {
    if (isAutoScrolling.current) return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      const { scrollTop } = e.target;



      // Cari slide mana yang sedang aktif berdasarkan scroll position
      let activeIndex = -1;
      for (let i = 0; i < slidePositionsRef.current.length; i++) {
        const { top, bottom } = slidePositionsRef.current[i];
        // Gunakan titik tengah viewport untuk menentukan slide aktif
        const viewportCenter = scrollTop + (e.target.clientHeight / 2);

        if (viewportCenter >= top && viewportCenter <= bottom) {
          activeIndex = i;
          break;
        }
      }

      // Fallback: cari slide terdekat
      if (activeIndex === -1 && slidePositionsRef.current.length > 0) {
        let minDistance = Infinity;
        for (let i = 0; i < slidePositionsRef.current.length; i++) {
          const { top, bottom } = slidePositionsRef.current[i];
          const distance = Math.min(
            Math.abs(scrollTop - top),
            Math.abs(scrollTop - bottom)
          );
          if (distance < minDistance) {
            minDistance = distance;
            activeIndex = i;
          }
        }
      }

      if (activeIndex !== -1 && activeIndex !== currentIndex && activeIndex < totalItems) {
        setCurrentIndex(activeIndex);
        onIndexChange?.(activeIndex);
      }
    }, 50);
  }, [currentIndex, totalItems, onIndexChange]);

  // ✅ Scroll ke index tertentu dengan akurat
  const scrollToIndex = useCallback((index, behavior = 'smooth') => {
    if (!containerRef.current) return;

    isAutoScrolling.current = true;

    // Update posisi slide dulu
    updateSlidePositions();

    const targetPosition = slidePositionsRef.current[index]?.top;
    if (targetPosition === undefined) return;

    const container = containerRef.current;

    if (behavior === 'auto') {
      container.style.scrollSnapType = 'none';
      container.style.scrollBehavior = 'auto';
      container.scrollTop = targetPosition;

      setTimeout(() => {
        container.style.scrollSnapType = 'y mandatory';
        container.style.scrollBehavior = '';
        isAutoScrolling.current = false;
      }, 50);
    } else {
      container.scrollTo({
        top: targetPosition,
        behavior: 'smooth'
      });
      setTimeout(() => {
        isAutoScrolling.current = false;
      }, 300);
    }
  }, [updateSlidePositions]);

  // ✅ Update posisi saat window resize atau konten berubah
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      updateSlidePositions();
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [updateSlidePositions]);

  // ✅ Update posisi saat totalItems berubah
  useEffect(() => {
    updateSlidePositions();
  }, [totalItems, updateSlidePositions]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return {
    containerRef,
    currentIndex,
    setCurrentIndex,
    handleScroll,
    scrollToIndex
  };
};

// ========== SUB-COMPONENTS ==========
const StoryMediaBackground = ({ report, isActive, onVideoReady, onVideoElement }) => {
  const mediaUrl = report.video_url || report.photo_url;
  const videoRef = useRef(null);
  const retryHandlerRef = useRef(null); // ✅ Simpan handler

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      const playTimeout = setTimeout(() => {
        video.play().catch(err => {
          console.warn("Auto-play failed:", err);

          // ✅ Hapus handler lama jika ada
          if (retryHandlerRef.current) {
            document.removeEventListener('click', retryHandlerRef.current);
            document.removeEventListener('touchstart', retryHandlerRef.current);
          }

          retryHandlerRef.current = () => {
            video.play().catch(() => { });
            document.removeEventListener('click', retryHandlerRef.current);
            document.removeEventListener('touchstart', retryHandlerRef.current);
          };

          document.addEventListener('click', retryHandlerRef.current);
          document.addEventListener('touchstart', retryHandlerRef.current);
        });
      }, 100);
      return () => {
        clearTimeout(playTimeout);
        // ✅ Cleanup handler
        if (retryHandlerRef.current) {
          document.removeEventListener('click', retryHandlerRef.current);
          document.removeEventListener('touchstart', retryHandlerRef.current);
        }
      };
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

const StorySlide = ({ report, isActive, viewCount, likedLaporan, laporanLikeCounts, onLike, onShare, onOpenAIChat, onOpenKomentar, onNavigateToDetail, theme, onVideoReady, onRegisterVideo, onUnregisterVideo, refreshTrigger }) => {
  const hasMedia = useMemo(() => !!(report.photo_url || report.video_url), [report]);
  const isGeneralLocation = report.report_type === 'general_location' || !report.tempat_id;
  const slideId = useMemo(() => `story-${report.id}`, [report.id]);

  const handleVideoElement = useCallback((videoElement) => {
    if (videoElement && onRegisterVideo) {
      onRegisterVideo(slideId, videoElement);
    }
  }, [slideId, onRegisterVideo]);

  useEffect(() => {
    return () => {
      if (onUnregisterVideo) {
        onUnregisterVideo(slideId);
      }
    };
  }, [slideId, onUnregisterVideo]);

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
            item={{ id: report.id, name: report.display_location_name }}
            openAIModal={() => onOpenAIChat?.(report)}
            openKomentarModal={() => onOpenKomentar?.(report)}
            onShare={() => onShare?.(report)}
            variant="floating-sidebar"
            theme={theme}
            isLaporanLike={true}
            isLaporanLiked={likedLaporan?.has(report.id)}
            laporanLikeCount={laporanLikeCounts?.[report.id] || 0}
            onLaporanLike={() => onLike?.(report)}
            refreshTrigger={refreshTrigger}
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

// ========== MAIN COMPONENT (AMANDED FOR SAFE NAVIGATION UNMOUNT) ==========
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
  onLoadMore,
  hasMore,
  isLoadingMore,
  isPaused = false,
}) {
  const [showSearchView, setShowSearchView] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(initialIndex);
  const { registerVideo, unregisterVideo, playActiveVideo, pauseAllVideos, resumeCurrentVideo } = useVideoManager();

  const [storyRefreshTrigger, setStoryRefreshTrigger] = useState(0);

  const { containerRef, currentIndex, setCurrentIndex, handleScroll, scrollToIndex } = useStoryScroll(
    reports?.length || 0,
    (newIndex) => setCurrentVideoIndex(newIndex)
  );
  const { scheduleRecordView } = useStoryViewTracker(userId, onViewRecorded);

  // ========== 1. LISTENER UPDATE KOMENTAR ==========
  useEffect(() => {
    if (!isOpen) return;

    const handleCommentChange = (event) => {
      const laporanId = event.detail?.laporanId;
      if (laporanId) {
        setStoryRefreshTrigger(prev => prev + 1);
      }
    };

    window.addEventListener('laporan-comment-changed', handleCommentChange);
    return () => {
      window.removeEventListener('laporan-comment-changed', handleCommentChange);
    };
  }, [isOpen]);

  // Handle video play saat index berubah
  useEffect(() => {
    if (currentVideoIndex !== null && reports[currentVideoIndex]?.video_url) {
      const timer = setTimeout(() => {
        const videoId = `story-${reports[currentVideoIndex]?.id}`;
        playActiveVideo(videoId);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [currentVideoIndex, reports, playActiveVideo]);

  // Pause dari LaporPanel
  useEffect(() => {
    if (!isOpen) return;

    if (isPaused) {
      pauseAllVideos();
    } else {
      const timer = setTimeout(() => {
        if (currentVideoIndex !== null && reports[currentVideoIndex]?.video_url) {
          const videoId = `story-${reports[currentVideoIndex]?.id}`;
          playActiveVideo(videoId);
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isPaused, isOpen, pauseAllVideos, playActiveVideo, currentVideoIndex, reports]);

  // Modal animation & Murni Cleanup Total saat Unmount mendadak
  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      setTimeout(() => resumeCurrentVideo(), 200);
    } else {
      pauseAllVideos();
      const timer = setTimeout(() => setIsRendered(false), 150);
      return () => clearTimeout(timer);
    }

    // ✅ FORCE CLEANUP: Jika user pindah halaman via Bottom Nav, fungsi ini menjamin video mati seketika
    return () => {
      pauseAllVideos();
    };
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

  // Infinite Scroll Trigger
  useEffect(() => {
    if (!reports.length) return;
    const remainingSlides = reports.length - (currentIndex || 0);
    if (remainingSlides <= 3 && hasMore && onLoadMore && !isLoadingMore) {
      onLoadMore();
    }
  }, [currentIndex, reports.length, hasMore, onLoadMore, isLoadingMore]);

  // ✅ FIX POPSTATE: Amankan State History Browser saat Berpindah Halaman Luar
  useEffect(() => {
    if (!isOpen) return;

    const handlePopState = (e) => {
      e.preventDefault();
      if (currentIndex > 0) {
        const newIdx = currentIndex - 1;
        setCurrentIndex(newIdx);
        setCurrentVideoIndex(newIdx);
        scrollToIndex(newIdx, 'smooth');
        window.history.pushState(null, '', window.location.href); // Kembalikan trap pushState
      } else {
        onClose();
      }
    };

    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      // ✅ JIKA UNMOUNT mendadak (pindah page), pastikan trap pushState dihapus dengan memicu back virtual halus
      if (typeof window !== "undefined" && window.history.state === null) {
        window.history.back();
      }
    };
  }, [isOpen, currentIndex, setCurrentIndex, scrollToIndex, onClose]);

  // ✅ FIX OVERFLOW: Kunci Body Scroll & Reset Mutlak Saat Komponen Hilang
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    // ✅ Jaminan 100% jika dilempar router push dari bottom nav, scroll utama akan kembali hidup
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
              onUnregisterVideo={unregisterVideo}
              refreshTrigger={storyRefreshTrigger}
            />
          ))}
        </div>
      </div>
    </div>
  );
}