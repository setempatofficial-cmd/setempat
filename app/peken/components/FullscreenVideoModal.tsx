'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Eye, Heart, Share2, ShoppingBag, MessageSquareCode, MapPin, MessageCircle } from "lucide-react";
import { formatTimeAgo } from "@/utils/timeUtils";
import { supabase } from "@/lib/supabaseClient";
import VideoPlayer from "@/components/media/VideoPlayer";

// ========== VIDEO MANAGER HOOK ==========
const useVideoManager = () => {
  const videoElementsRef = useRef(new Map());

  useEffect(() => {
    return () => {
      videoElementsRef.current.forEach((video) => {
        video.pause();
        video.src = '';
        video.load();
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
    for (const [videoId, video] of videoElementsRef.current.entries()) {
      if (videoId !== id) {
        video.pause();
      }
    }

    const activeVideo = videoElementsRef.current.get(id);
    if (activeVideo && activeVideo.paused) {
      activeVideo.play().catch(err => console.warn("Video play failed:", err));
    }
    activeVideoIdRef.current = id;
  }, []);

  const pauseAllVideos = useCallback(() => {
    for (const [, video] of videoElementsRef.current.entries()) {
      video.pause();
    }
  }, []);

  return { registerVideo, unregisterVideo, playActiveVideo, pauseAllVideos };
};

// ========== VIEW TRACKER HOOK ==========
const useVideoViewTracker = (userId) => {
  const recordedViewsRef = useRef(new Set());
  const viewRateLimiter = useRef(new Map());
  const timeoutRef = useRef(null);

  const recordView = useCallback(async (videoId) => {
    if (!userId || !videoId) return;

    const lastTime = viewRateLimiter.current.get(videoId);
    const now = Date.now();
    if (lastTime && now - lastTime < 5000) return;
    if (recordedViewsRef.current.has(videoId)) return;

    recordedViewsRef.current.add(videoId);
    viewRateLimiter.current.set(videoId, now);

    try {
      const { error: insertError } = await supabase
        .from("video_peken_views")
        .insert({
          video_id: videoId,
          user_id: userId,
          viewed_at: new Date().toISOString()
        });

      if (!insertError) {
        await supabase.rpc('increment_video_views', { video_id: videoId });
      }
    } catch (err) {
      console.error("Error recording view:", err);
      recordedViewsRef.current.delete(videoId);
    }
  }, [userId]);

  const scheduleRecordView = useCallback((videoId) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => recordView(videoId), 1000);
  }, [recordView]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { scheduleRecordView };
};

// ========== LIKE HANDLER HOOK ==========
const useVideoLike = (userId) => {
  const [likedVideos, setLikedVideos] = useState(new Set());
  const [likeCounts, setLikeCounts] = useState({});

  useEffect(() => {
    if (!userId) return;
    const loadLikedVideos = async () => {
      const { data } = await supabase
        .from('video_peken_likes')
        .select('video_id')
        .eq('user_id', userId);
      if (data) setLikedVideos(new Set(data.map(item => item.video_id)));
    };
    loadLikedVideos();
  }, [userId]);

  const toggleLike = useCallback(async (video) => {
    if (!userId || !video?.id) return;

    const isCurrentlyLiked = likedVideos.has(video.id);

    setLikedVideos(prev => {
      const newSet = new Set(prev);
      if (isCurrentlyLiked) newSet.delete(video.id);
      else newSet.add(video.id);
      return newSet;
    });

    setLikeCounts(prev => ({
      ...prev,
      [video.id]: (prev[video.id] || video.likes || 0) + (isCurrentlyLiked ? -1 : 1)
    }));

    try {
      if (isCurrentlyLiked) {
        await supabase
          .from('video_peken_likes')
          .delete()
          .eq('video_id', video.id)
          .eq('user_id', userId);
      } else {
        await supabase
          .from('video_peken_likes')
          .insert({ video_id: video.id, user_id: userId });
      }
    } catch (err) {
      setLikedVideos(prev => {
        const newSet = new Set(prev);
        if (isCurrentlyLiked) newSet.add(video.id);
        else newSet.delete(video.id);
        return newSet;
      });
      setLikeCounts(prev => ({
        ...prev,
        [video.id]: (prev[video.id] || video.likes || 0) - (isCurrentlyLiked ? -1 : 1)
      }));
    }
  }, [userId, likedVideos]);

  return { likedVideos, likeCounts, toggleLike };
};

// ========== SCROLL HOOK ==========
const useVideoScroll = (totalItems, onIndexChange) => {
  const containerRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(null);
  const isAutoScrolling = useRef(false);
  const timeoutRef = useRef(null);
  const slidePositionsRef = useRef([]);

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

  const handleScroll = useCallback((e) => {
    if (isAutoScrolling.current) return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      const { scrollTop } = e.target;
      let activeIndex = -1;

      for (let i = 0; i < slidePositionsRef.current.length; i++) {
        const { top, bottom } = slidePositionsRef.current[i];
        const viewportCenter = scrollTop + (e.target.clientHeight / 2);

        if (viewportCenter >= top && viewportCenter <= bottom) {
          activeIndex = i;
          break;
        }
      }

      if (activeIndex !== -1 && activeIndex !== currentIndex && activeIndex < totalItems) {
        setCurrentIndex(activeIndex);
        onIndexChange?.(activeIndex);
      }
    }, 50);
  }, [currentIndex, totalItems, onIndexChange]);

  const scrollToIndex = useCallback((index, behavior = 'smooth') => {
    if (!containerRef.current) return;
    isAutoScrolling.current = true;
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
      container.scrollTo({ top: targetPosition, behavior: 'smooth' });
      setTimeout(() => { isAutoScrolling.current = false; }, 300);
    }
  }, [updateSlidePositions]);

  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver(() => { updateSlidePositions(); });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [updateSlidePositions]);

  useEffect(() => { updateSlidePositions(); }, [totalItems, updateSlidePositions]);

  return { containerRef, currentIndex, handleScroll, scrollToIndex };
};

// ========== ROLE BADGE ==========
const RoleBadge = ({ roleType }) => {
  const config = {
    bakul: { bg: "bg-orange-500/20 border-orange-500/30 text-orange-300", icon: "🛒", label: "Bakul" },
    driver: { bg: "bg-emerald-500/20 border-emerald-500/30 text-emerald-300", icon: "🛵", label: "Driver" },
    rewang: { bg: "bg-purple-500/20 border-purple-500/30 text-purple-300", icon: "🤝", label: "Rewang" }
  };
  const current = config[roleType] || config.bakul;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border tracking-wider backdrop-blur-sm ${current.bg}`}>
      {current.icon} {current.label}
    </span>
  );
};

// ========== VIDEO ACTIONS COMPONENT ==========
// HAPUS onCommentRefresh dari VideoActions karena tidak perlu
const VideoActions = ({
  videoId,
  isLiked,
  likeCount,
  commentCount,
  onLike,
  onComment,
  onShare,
  userId
}) => {
  const [localLikeCount, setLocalLikeCount] = useState(likeCount);
  const [localIsLiked, setLocalIsLiked] = useState(isLiked);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    setLocalLikeCount(likeCount);
    setLocalIsLiked(isLiked);
  }, [likeCount, isLiked]);

  const handleLike = async () => {
    if (isProcessing || !userId) return;
    setIsProcessing(true);

    const newIsLiked = !localIsLiked;
    setLocalIsLiked(newIsLiked);
    setLocalLikeCount(prev => newIsLiked ? prev + 1 : prev - 1);

    try {
      await onLike();
    } catch (error) {
      setLocalIsLiked(!newIsLiked);
      setLocalLikeCount(prev => !newIsLiked ? prev + 1 : prev - 1);
      console.error("Like error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  // HAPUS useEffect untuk video-comment-changed

  return (
    <div className="flex flex-col items-center gap-5">
      <button onClick={handleLike} className="group flex flex-col items-center gap-1">
        <div className={`w-12 h-12 rounded-full backdrop-blur-md flex items-center justify-center border transition-all duration-300 active:scale-75 ${localIsLiked
          ? 'bg-red-500 border-red-400 shadow-lg shadow-red-500/50'
          : 'bg-black/30 border-white/15 hover:border-white/30'
          }`}>
          <Heart size={22} className={`transition-transform duration-200 group-hover:scale-110 ${localIsLiked ? 'text-white fill-white' : 'text-white'
            }`} />
        </div>
        <span className="text-[11px] font-bold text-white drop-shadow-md">
          {localLikeCount >= 1000 ? `${(localLikeCount / 1000).toFixed(1)}k` : localLikeCount || 0}
        </span>
      </button>

      <button onClick={onComment} className="group flex flex-col items-center gap-1">
        <div className="w-12 h-12 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center border border-white/15 hover:border-white/30 active:scale-75 transition-all">
          <MessageCircle size={20} className="text-white group-hover:scale-110 transition-transform" />
        </div>
        <span className="text-[11px] font-bold text-white/90">
          {commentCount >= 1000 ? `${(commentCount / 1000).toFixed(1)}k` : commentCount || 0}
        </span>
      </button>

      <button onClick={onShare} className="group flex flex-col items-center gap-1">
        <div className="w-12 h-12 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center border border-white/15 hover:border-white/30 active:scale-75 transition-all">
          <Share2 size={20} className="text-white group-hover:rotate-12 transition-transform" />
        </div>
        <span className="text-[11px] font-medium text-white/90">Bagikan</span>
      </button>
    </div>
  );
};

// ========== VIDEO SLIDE COMPONENT ==========
// HAPUS refreshTrigger dan onCommentRefresh dari VideoSlide
const VideoSlide = ({
  video,
  isActive,
  viewCount,
  isLiked,
  likeCount,
  commentCount,
  onLike,
  onShare,
  onBuy,
  onChat,
  onComment,
  onProductClick,
  onRegisterVideo,
  onUnregisterVideo,
  userId,
}) => {
  const slideId = useMemo(() => `video-${video.id}`, [video.id]);
  const videoContainerRef = useRef(null);

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

  const profileName = video.profiles?.full_name || video.profiles?.username || 'Warga Setempat';
  const avatarUrl = video.profiles?.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(profileName)}&background=0D8ABC&color=fff&length=2`;

  const videoClass = video.video_orientation === 'portrait'
    ? 'w-full h-full object-contain'
    : 'w-full h-full object-cover';

  const shareUrl = `${window.location.origin}/peken?video=${video.id}`;

  // HAPUS useEffect untuk refreshTrigger

  return (
    <div className="h-[100dvh] w-full snap-start snap-always relative flex flex-col bg-black overflow-hidden select-none">
      <div ref={videoContainerRef} className="absolute inset-0 w-full h-full overflow-hidden bg-black">
        <VideoPlayer
          src={video.video_url}
          className={videoClass}
          autoPlay={isActive}
          muted={!isActive}
          loop={true}
          playsInline={true}
          preload={isActive ? "auto" : "metadata"}
          isActive={isActive}
          showControls={false}
          hideSpinner={false}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40 pointer-events-none" />
      </div>

      <button
        onClick={() => window.dispatchEvent(new CustomEvent('close-video-modal'))}
        className="absolute top-5 left-4 z-30 w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white border border-white/10 active:scale-90 transition-all duration-200"
        aria-label="Kembali"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <div className="absolute bottom-0 left-0 right-0 p-4 pb-10 z-20 flex flex-col justify-end pr-16 bg-gradient-to-t from-black/90 via-black/40 to-transparent pt-20">
        <div className="flex items-center gap-3 mb-3">
          <div className="relative">
            <div className="absolute -inset-0.5 bg-gradient-to-tr from-orange-500 to-yellow-400 rounded-full blur-sm opacity-70 animate-pulse" />
            <img
              src={avatarUrl}
              className="relative w-10 h-10 rounded-full object-cover border-2 border-white"
              alt={profileName}
              onError={(e) => {
                e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(profileName)}&background=0D8ABC&color=fff&length=2&bold=true&size=40`;
              }}
            />
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-black" />
          </div>

          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-white text-sm font-semibold tracking-wide drop-shadow-md">
                {profileName}
              </span>
              <RoleBadge roleType={video.role_type} />
            </div>
            <div className="flex items-center gap-1.5 text-white/70 text-[11px]">
              <MapPin size={11} className="text-orange-400" />
              <span className="font-medium">{video.profiles?.desa || video.profiles?.kecamatan || 'Pasuruan'}</span>
              <span className="w-1 h-1 rounded-full bg-white/40" />
              <span>{formatTimeAgo(video.created_at)}</span>
            </div>
          </div>
        </div>

        <div className="mb-4 max-h-[120px] overflow-y-auto no-scrollbar">
          <h3 className="text-white text-sm font-bold leading-snug tracking-wide mb-1 drop-shadow">
            {video.judul}
          </h3>
          {video.deskripsi && (
            <p className="text-white/80 text-xs font-normal leading-relaxed break-words">
              {video.deskripsi}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 w-full mt-1">
          <button
            onClick={() => onChat?.(video)}
            className="flex-none p-3 bg-white/10 hover:bg-white/20 border border-white/20 active:scale-95 rounded-xl text-white transition-all duration-200 flex items-center justify-center backdrop-blur-md"
            title="Tanya Warga / Hubungi"
          >
            <MessageSquareCode size={20} className="text-emerald-400" />
          </button>

          <button
            onClick={() => {
              if (video.product_link) {
                onProductClick?.(video.product_link);
              } else {
                onBuy?.(video);
              }
            }}
            className="flex-1 py-3 px-4 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:brightness-110 active:scale-[0.98] rounded-xl text-white text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-orange-600/30 font-sans tracking-wide"
          >
            <ShoppingBag size={15} className="animate-bounce" />
            <span className="uppercase tracking-wider">{video.product_link ? "Lihat Produk" : "Ambil / Pesan"}</span>
          </button>
        </div>
      </div>

      <div className="absolute right-2.5 bottom-24 z-20 flex flex-col items-center gap-4">
        <VideoActions
          videoId={video.id}
          isLiked={isLiked}
          likeCount={likeCount}
          commentCount={commentCount}
          onLike={() => onLike?.(video)}
          onComment={() => onComment?.(video)}
          onShare={onShare}
          userId={userId}
        />

        <div className="flex flex-col items-center gap-1 opacity-70 transition-opacity hover:opacity-100">
          <div className="w-11 h-11 rounded-full bg-black/25 backdrop-blur-md flex items-center justify-center border border-white/10 shadow-sm">
            <Eye size={18} className="text-white/90" />
          </div>
          <span className="text-[10px] font-bold text-white/90 drop-shadow-md tracking-wide">
            {(viewCount || 0) >= 1000 ? `${(viewCount / 1000).toFixed(1)}k` : viewCount || 0}
          </span>
        </div>
      </div>
    </div>
  );
};

// ========== MAIN FULLSCREEN VIDEO MODAL ==========
export default function FullscreenVideoModal({
  isOpen,
  videos = [],
  initialIndex = 0,
  viewCounts,
  commentCounts = {},
  onClose,
  onBuy,
  onChat,
  onShare,
  onComment,
  onCommentRefresh,
  userId,
}) {
  const [isRendered, setIsRendered] = useState(false);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(initialIndex);

  const { registerVideo, unregisterVideo, playActiveVideo, pauseAllVideos } = useVideoManager();
  const { containerRef, currentIndex, handleScroll, scrollToIndex } = useVideoScroll(
    videos?.length || 0,
    (newIndex) => setCurrentVideoIndex(newIndex)
  );
  const { scheduleRecordView } = useVideoViewTracker(userId);
  const { likedVideos, likeCounts, toggleLike } = useVideoLike(userId);

  const handleProductClick = useCallback((productLink) => {
    if (!productLink) return;
    const productId = productLink.split('product=')[1];

    // Langsung dispatch event, tanpa setTimeout
    window.dispatchEvent(new CustomEvent('open-product-detail', {
      detail: { productId }
    }));
    window.dispatchEvent(new CustomEvent('set-active-tab', {
      detail: { tab: 'panyangan' }
    }));

    // Tutup modal setelah event di-dispatch
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (currentVideoIndex !== null && videos[currentVideoIndex]?.video_url) {
      const timer = setTimeout(() => {
        const videoId = `video-${videos[currentVideoIndex]?.id}`;
        playActiveVideo(videoId);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [currentVideoIndex, videos, playActiveVideo]);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      document.body.style.overflow = 'hidden';
    } else {
      pauseAllVideos();
      document.body.style.overflow = '';
      const timer = setTimeout(() => setIsRendered(false), 150);
      return () => clearTimeout(timer);
    }
    return () => {
      pauseAllVideos();
      document.body.style.overflow = '';
    };
  }, [isOpen, pauseAllVideos]);

  useEffect(() => {
    if (currentIndex !== null && videos?.[currentIndex]?.id) {
      scheduleRecordView(videos[currentIndex].id);
    }
  }, [currentIndex, videos, scheduleRecordView]);

  useEffect(() => {
    if (isOpen && videos?.[initialIndex]) {
      setCurrentVideoIndex(initialIndex);
      setTimeout(() => scrollToIndex(initialIndex, 'auto'), 50);
    }
  }, [isOpen, initialIndex, videos, scrollToIndex]);

  useEffect(() => {
    const handleCloseEvent = () => onClose();
    window.addEventListener('close-video-modal', handleCloseEvent);
    return () => window.removeEventListener('close-video-modal', handleCloseEvent);
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePopState = (e) => {
      e.preventDefault();
      if (currentIndex > 0) {
        const newIdx = currentIndex - 1;
        setCurrentVideoIndex(newIdx);
        scrollToIndex(newIdx, 'smooth');
        window.history.pushState(null, '', window.location.href);
      } else {
        onClose();
      }
    };

    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isOpen, currentIndex, scrollToIndex, onClose]);

  // HAPUS useEffect untuk listener komentar yang menyebabkan infinite loop

  if (!isRendered || !videos.length) return null;

  return (
    <div className={`fixed inset-0 z-[99999] bg-black transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className="w-full max-w-[420px] h-[100dvh] relative overflow-hidden mx-auto bg-black">
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="h-full overflow-y-scroll snap-y snap-mandatory no-scrollbar touch-pan-y"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {videos.map((video, idx) => {
            const commentCount = commentCounts?.[video.id] || 0;

            return (
              <VideoSlide
                key={video.id}
                video={video}
                isActive={idx === currentIndex}
                viewCount={viewCounts?.[video.id] || video.views || 0}
                commentCount={commentCount}
                isLiked={likedVideos.has(video.id)}
                likeCount={likeCounts[video.id] || video.likes || 0}
                onLike={toggleLike}
                onShare={onShare}
                onBuy={onBuy}
                onChat={onChat}
                onComment={onComment}
                onProductClick={handleProductClick}
                onRegisterVideo={registerVideo}
                onUnregisterVideo={unregisterVideo}
                userId={userId}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}