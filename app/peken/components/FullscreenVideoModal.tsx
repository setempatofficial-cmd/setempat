// app/peken/components/FullscreenVideoModal.tsx
'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { X, Eye, Heart, Share2, ShoppingBag, MessageCircle, MapPin, ExternalLink } from "lucide-react";
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

  const toggleLike = useCallback(async (video) => {
    if (!userId) return;

    const isLiked = likedVideos.has(video.id);

    try {
      if (isLiked) {
        const { error } = await supabase
          .from('video_peken_likes')
          .delete()
          .eq('video_id', video.id)
          .eq('user_id', userId);

        if (!error) {
          setLikedVideos(prev => {
            const newSet = new Set(prev);
            newSet.delete(video.id);
            return newSet;
          });
          setLikeCounts(prev => ({
            ...prev,
            [video.id]: Math.max((prev[video.id] || 0) - 1, 0)
          }));
          await supabase.rpc('decrement_video_likes', { video_id: video.id });
        }
      } else {
        const { error } = await supabase
          .from('video_peken_likes')
          .insert({
            video_id: video.id,
            user_id: userId,
            created_at: new Date().toISOString()
          });

        if (!error) {
          setLikedVideos(prev => new Set([...prev, video.id]));
          setLikeCounts(prev => ({
            ...prev,
            [video.id]: (prev[video.id] || 0) + 1
          }));
          await supabase.rpc('increment_video_likes', { video_id: video.id });
        }
      }
    } catch (err) {
      console.error("Error toggling like:", err);
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
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase border ${current.bg}`}>
      {current.icon} {current.label}
    </span>
  );
};

// ========== VIDEO SLIDE COMPONENT ==========
const VideoSlide = ({
  video,
  isActive,
  viewCount,
  isLiked,
  likeCount,
  onLike,
  onShare,
  onBuy,
  onChat,
  onProductClick,
  onRegisterVideo,
  onUnregisterVideo
}) => {
  const slideId = useMemo(() => `video-${video.id}`, [video.id]);
  const videoContainerRef = useRef<HTMLDivElement>(null);

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

  const profileName = video.profiles?.username || video.profiles?.name || video.profiles?.full_name || 'Warga Setempat';
  const avatarUrl = video.profiles?.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(profileName)}&background=0D8ABC&color=fff&length=2`;

  const videoClass = video.video_orientation === 'portrait'
    ? 'w-full h-full object-contain'
    : 'w-full h-full object-cover';

  // Generate share URL (ke halaman Peken, bukan ke Cloudinary)
  const shareUrl = `${window.location.origin}/peken?video=${video.id}`;

  return (
    <div className="h-[100dvh] w-full snap-start snap-always relative flex flex-col bg-black overflow-hidden">
      {/* Video Background */}
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
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60 pointer-events-none" />
      </div>

      {/* Close Button */}
      <button
        onClick={() => window.dispatchEvent(new CustomEvent('close-video-modal'))}
        className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white border border-white/10 active:scale-95 transition-transform"
      >
        <X size={18} />
      </button>

      {/* Bottom Overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-4 pb-8 z-20">


        {/* User Info - Dengan foto profil yang benar */}
        <div className="flex items-center gap-2 mb-2">
          <div className="relative">
            <img
              src={video.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profileName)}&background=0D8ABC&color=fff&length=2&bold=true&size=32`}
              className="w-8 h-8 rounded-full object-cover border-2 border-white/30"
              alt={profileName}
              onError={(e) => {
                // Jika gambar gagal load, fallback ke UI Avatars
                e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(profileName)}&background=0D8ABC&color=fff&length=2&bold=true&size=32`;
              }}
            />
            {/* Indicator online (opsional) */}
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-white text-sm font-bold">
                {profileName}
              </span>
              <RoleBadge roleType={video.role_type} />
            </div>
            <div className="flex items-center gap-1 text-white/50 text-[10px]">
              <MapPin size={10} />
              <span>{video.profiles?.desa || video.profiles?.kecamatan || 'Pasuruan'}</span>
              <span className="w-1 h-1 rounded-full bg-white/30" />
              <span>{formatTimeAgo(video.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Caption */}
        <div className="mb-2">
          <p className="text-white text-sm font-medium leading-tight">
            {video.judul}
          </p>
          {video.deskripsi && (
            <p className="text-white/70 text-xs mt-1 line-clamp-2">
              {video.deskripsi}
            </p>
          )}
        </div>


        {/* Action Buttons - SIMPLE TAPI DINAMIS */}
        <button
          onClick={() => {
            if (video.product_link) {
              onProductClick?.(video.product_link);
            } else {
              onBuy?.(video);
            }
          }}
          className="w-full py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 active:scale-95 rounded-full text-white text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
        >
          <ShoppingBag size={14} className="transition-transform duration-200 group-hover:scale-110" />
          <span>{video.product_link ? "Lihat Produk" : "Beli / Pesan"}</span>
          {video.product_link && (
            <span className="text-white/80 text-[10px]">→</span>
          )}
        </button>
      </div>

      {/* Right Side Actions */}
      <div className="absolute right-3 bottom-28 z-20 flex flex-col items-center gap-4">
        {/* Like Button */}
        <button
          onClick={() => onLike?.(video)}
          className="flex flex-col items-center gap-0.5"
        >
          <div className={`w-11 h-11 rounded-full backdrop-blur-md flex items-center justify-center border transition-all active:scale-95 ${isLiked ? 'bg-red-500/80 border-red-500/50' : 'bg-black/40 border-white/20'
            }`}>
            <Heart size={20} className={isLiked ? 'text-white fill-white' : 'text-white'} />
          </div>
          <span className="text-[10px] font-bold text-white/80">
            {(likeCount || 0) >= 1000 ? `${(likeCount / 1000).toFixed(1)}k` : (likeCount || 0)}
          </span>
        </button>

        {/* Share Button - PAKAI SHARE URL KE HALAMAN PEKEN */}
        <button
          onClick={() => {
            if (navigator.share) {
              navigator.share({
                title: video.judul,
                text: video.deskripsi || 'Video menarik di Peken!',
                url: shareUrl,
              }).catch(() => {
                navigator.clipboard.writeText(shareUrl);
                alert('Link video telah disalin!');
              });
            } else {
              navigator.clipboard.writeText(shareUrl);
              alert('Link video telah disalin!');
            }
          }}
          className="flex flex-col items-center gap-0.5"
        >
          <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/20 active:scale-95 transition-all">
            <Share2 size={18} className="text-white" />
          </div>
          <span className="text-[9px] text-white/70">Bagikan</span>
        </button>

        {/* View Count */}
        <div className="flex flex-col items-center gap-0.5">
          <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center">
            <Eye size={18} className="text-white/80" />
          </div>
          <span className="text-[10px] font-bold text-white/80">
            {(viewCount || 0) >= 1000 ? `${(viewCount / 1000).toFixed(1)}k` : (viewCount || 0)}
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
  onClose,
  onBuy,
  onChat,
  onShare,
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

    // Extract product ID
    const productId = productLink.split('product=')[1];

    // Tutup modal video
    onClose();

    // Gunakan event untuk komunikasi antar komponen
    setTimeout(() => {
      // Dispatch event yang akan didengarkan oleh PanyanganSection
      window.dispatchEvent(new CustomEvent('open-product-detail', {
        detail: { productId }
      }));

      // Pindah ke tab Panyangan
      window.dispatchEvent(new CustomEvent('set-active-tab', {
        detail: { tab: 'panyangan' }
      }));
    }, 300);
  }, [onClose]);

  useEffect(() => {
    if (currentVideoIndex !== null && videos[currentVideoIndex]?.video_url) {
      const timer = setTimeout(() => {
        const videoId = `video-${videos[currentVideoIndex]?.id}`;
        playActiveVideo(videoId);
      }, 150);
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
          {videos.map((video, idx) => (
            <VideoSlide
              key={video.id}
              video={video}
              isActive={idx === currentIndex}
              viewCount={viewCounts?.[video.id] || video.views || 0}
              isLiked={likedVideos.has(video.id)}
              likeCount={likeCounts[video.id] || video.likes || 0}
              onLike={toggleLike}
              onShare={onShare}
              onBuy={onBuy}
              onChat={onChat}
              onProductClick={handleProductClick}
              onRegisterVideo={registerVideo}
              onUnregisterVideo={unregisterVideo}
            />
          ))}
        </div>
      </div>
    </div>
  );
}