"use client";

import { useState, useEffect, useMemo, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Activity, RefreshCw, X, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getIndonesianTimeLabel } from "@/utils/timeUtils";
import OptimizedMedia from "@/components/OptimizedMedia";

const normalizeOfficialPhotos = (photos) => {
  if (!photos) return { pagi: [], siang: [], sore: [], malam: [] };
  const result = { pagi: [], siang: [], sore: [], malam: [] };
  const timeKeys = ['pagi', 'siang', 'sore', 'malam'];
  timeKeys.forEach(key => {
    const data = photos[key];
    if (data) {
      if (Array.isArray(data)) result[key] = data;
      else if (typeof data === 'object' && data.url) result[key] = [data];
    }
  });
  return result;
};

const officialPhotosCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

const formatTimeAgo = (dateString) => {
  if (!dateString) return "Baru saja";
  const parsedDate = Date.parse(dateString);
  if (isNaN(parsedDate)) return "Baru saja";

  const diffMs = Date.now() - parsedDate;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Baru saja";
  if (diffMins < 60) return `${diffMins} menit lalu`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} jam lalu`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} hari lalu`;
};

const isVideoUrl = (url) => {
  if (!url) return false;
  const urlString = typeof url === 'string' ? url : String(url);
  return /\.(mp4|mov|avi|mkv|webm|m3u8)$/i.test(urlString) ||
    urlString.includes('video') ||
    urlString.includes('stream') ||
    urlString.includes('youtube') ||
    urlString.includes('youtu.be');
};

const getMediaUrl = (item) => {
  if (!item) return null;
  if (typeof item === 'string') return item;
  if (item.video_url) return item.video_url;
  if (item.url) return item.url;
  if (item.photo_url) return item.photo_url;
  if (item.image_url) return item.image_url;
  return null;
};

const HeroCard = forwardRef(({
  tempatId,
  namaTempat,
  status = "LANCAR",
  photos = [],
  priority = true,
  lastUpdate,
  description,
  onRefresh,
  refreshing,
  isStoryMode = false,
  onBackToOriginal,
  userName,
  userAvatar,
  isStoryOpen = false,
  onOpenStoryTrip,
  totalLaporanFoto = 0,
  storySlideshowOpen = false,
  storySlideshowStories = [],
  storySlideshowIndex = 0,
  onCloseStorySlideshow,
  onStoryIndexChange,
  aspectRatio = "1/1",
  isDetail = false,
  removeBorderRadius = false,
  containerClassName = "",
}, ref) => {
  const [timeKey] = useState(() => getIndonesianTimeLabel().toLowerCase());
  const [officialPhotos, setOfficialPhotos] = useState({ pagi: [], siang: [], sore: [], malam: [] });
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [localIndex, setLocalIndex] = useState(storySlideshowIndex);

  const finalAspectRatio = isDetail ? "16/10" : aspectRatio;

  const aspectClass = {
    "1/1": "aspect-square",
    "4/3": "aspect-[4/3]",
    "16/10": "aspect-[16/10]",
    "16/9": "aspect-video"
  }[finalAspectRatio] || "aspect-square";

  const borderRadiusClass = removeBorderRadius ? "" : "rounded-2xl md:rounded-3xl";

  useEffect(() => {
    setLocalIndex(storySlideshowIndex);
  }, [storySlideshowIndex, storySlideshowStories]);

  useEffect(() => {
    async function fetchPhotos() {
      const cached = officialPhotosCache.get(tempatId);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        setOfficialPhotos(cached.data);
        return;
      }
      setIsLoading(true);
      const { data } = await supabase.from('tempat').select('photos').eq('id', tempatId).single();
      if (data?.photos) {
        const normalized = normalizeOfficialPhotos(data.photos);
        setOfficialPhotos(normalized);
        officialPhotosCache.set(tempatId, { data: normalized, timestamp: Date.now() });
      }
      setIsLoading(false);
    }
    if (tempatId) fetchPhotos();
  }, [tempatId]);

  const currentActiveStory = useMemo(() => {
    if (storySlideshowStories && storySlideshowStories.length > 0) {
      const safeIndex = localIndex >= storySlideshowStories.length ? 0 : localIndex;
      return storySlideshowStories[safeIndex];
    }
    return null;
  }, [storySlideshowStories, localIndex]);

  const mediaSource = useMemo(() => {
    if (currentActiveStory) {
      const url = currentActiveStory.video_url || currentActiveStory.photo_url || currentActiveStory.image_url || getMediaUrl(currentActiveStory);
      return { url: url, isVideo: isVideoUrl(url) };
    }

    if (photos && photos.length > 0) {
      const foundVideo = photos.find(item => isVideoUrl(getMediaUrl(item)));
      if (foundVideo) return { url: getMediaUrl(foundVideo), isVideo: true };

      const filteredPhotos = photos.filter(item => !isVideoUrl(getMediaUrl(item)));
      if (filteredPhotos.length > 0) return { url: getMediaUrl(filteredPhotos[currentPhotoIndex]), isVideo: false };
    }

    const timePhotos = officialPhotos[timeKey] || [];
    if (timePhotos.length > 0) {
      const p = timePhotos[0];
      const url = typeof p === 'string' ? p : p?.url || p;
      return { url: url, isVideo: isVideoUrl(url) };
    }

    return { url: null, isVideo: false };
  }, [currentActiveStory, photos, currentPhotoIndex, officialPhotos, timeKey]);

  const displayDescription = useMemo(() => {
    if (currentActiveStory) {
      return currentActiveStory.title || currentActiveStory.caption || currentActiveStory.description || "Menampilkan arsip momen.";
    }
    return description || `Lalu lintas ${status.toLowerCase()} di ${namaTempat}.`;
  }, [currentActiveStory, description, status, namaTempat]);

  const displaySubLabel = useMemo(() => {
    if (currentActiveStory) {
      if (currentActiveStory.type === 'sejarah' || currentActiveStory.tahun) {
        return `Era ${currentActiveStory.tahun || 'Tempo Dulu'}`;
      }
      if (currentActiveStory.type === 'official' || currentActiveStory.is_official) {
        return `Informasi Resmi`;
      }
      return `@${(currentActiveStory.user_name || userName || "Warga").replace(/\s+/g, '').toLowerCase()}`;
    }
    return userName ? `@${userName.replace(/\s+/g, '').toLowerCase()}` : null;
  }, [currentActiveStory, userName]);

  const handleNext = (e) => {
    e.stopPropagation();
    const newIndex = localIndex < storySlideshowStories.length - 1 ? localIndex + 1 : 0;
    setLocalIndex(newIndex);
    onStoryIndexChange?.(newIndex);
  };

  const handlePrev = (e) => {
    e.stopPropagation();
    const newIndex = localIndex > 0 ? localIndex - 1 : storySlideshowStories.length - 1;
    setLocalIndex(newIndex);
    onStoryIndexChange?.(newIndex);
  };

  const waktuLalu = formatTimeAgo(lastUpdate);
  const displayName = currentActiveStory ? `📖 ${namaTempat}` : namaTempat;

  const statusColors = {
    "LANCAR": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    "RAMAI": "bg-amber-500/10 text-amber-400 border-amber-500/20",
    "MACET": "bg-rose-500/10 text-rose-400 border-rose-500/20",
  };

  if (isLoading && !mediaSource.url) {
    return <div className={`w-full ${aspectClass} bg-zinc-900/50 animate-pulse ${borderRadiusClass} mb-4`} />;
  }

  return (
    <div ref={ref} className={`relative w-full flex flex-col items-center ${containerClassName}`}>
      <div className={`relative ${aspectClass} w-full overflow-hidden ${borderRadiusClass} bg-zinc-950 border border-white/[0.06] group shadow-2xl`}>

        {/* Navigation Buttons for Story */}
        {currentActiveStory && storySlideshowStories.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-black/60 transition-all opacity-0 group-hover:opacity-100 active:scale-90"
            >
              <ChevronLeft size={18} className="text-white" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-black/60 transition-all opacity-0 group-hover:opacity-100 active:scale-90"
            >
              <ChevronRight size={18} className="text-white" />
            </button>

            {/* Story Progress Indicators */}
            <div className="absolute top-3 left-0 right-0 z-20 flex justify-center gap-1 px-4">
              {storySlideshowStories.map((_, idx) => (
                <div
                  key={idx}
                  className="h-[3px] flex-1 rounded-full overflow-hidden bg-white/20"
                >
                  <div
                    className={`h-full bg-white transition-all duration-300 ${idx === localIndex ? 'w-full' : idx < localIndex ? 'w-full opacity-40' : 'w-0'
                      }`}
                  />
                </div>
              ))}
            </div>
          </>
        )}

        {/* Main Media Player */}
        {mediaSource.url && mediaSource.isVideo ? (
          <video
            key={mediaSource.url}
            src={mediaSource.url}
            className="absolute inset-0 w-full h-full object-cover"
            autoPlay loop muted playsInline
          />
        ) : mediaSource.url ? (
          <OptimizedMedia
            key={mediaSource.url}
            src={mediaSource.url}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            alt={namaTempat}
            priority={priority}
          />
        ) : (
          <div className="w-full h-full flex flex-col gap-2 items-center justify-center bg-zinc-900">
            <MapPin className="text-zinc-700 animate-bounce" size={40} />
            <span className="text-xs text-zinc-500 font-medium">Gagal memuat media</span>
          </div>
        )}

        {/* Ambient Dark Overlay Gradients */}
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

        {/* Top Floating Action Badges - MODIFIKASI */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-10">
          {/* Left side: Status badge + Nama Tempat */}
          <div className="flex flex-col items-start gap-2 max-w-[70%]">
            <div className="bg-black/30 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/[0.08] flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${status === 'LANCAR' ? 'bg-emerald-400' : status === 'RAMAI' ? 'bg-amber-400' : 'bg-rose-400'} animate-pulse`} />
              <span className="text-[11px] font-semibold text-zinc-200 uppercase tracking-widest">
                {mediaSource.isVideo ? 'VIDEO' : currentActiveStory ? `${currentActiveStory.type === 'sejarah' ? 'SEJARAH' : currentActiveStory.type?.toUpperCase() || 'STORY'}` : 'LIVE'}
              </span>
            </div>

            {/* 🆕 NAMA TEMPAT - Pindah ke sini (pojok kiri atas) */}
            <h3 className="text-base sm:text-lg font-[800] text-white uppercase tracking-tighter drop-shadow-2xl leading-tight"><span className="text-cyan-400 mr-2">●</span>
              {displayName}
            </h3>
          </div>

          {/* Right side: Action buttons (refresh & back) */}
          <div className="flex gap-2">
            {currentActiveStory && onBackToOriginal && (
              <button onClick={onBackToOriginal} className="w-8 h-8 flex items-center justify-center bg-rose-500/20 backdrop-blur-md rounded-full border border-rose-500/30 active:scale-95 transition-all text-rose-300 hover:bg-rose-500/40">
                <X size={14} />
              </button>
            )}
            <button onClick={onRefresh} className="w-8 h-8 flex items-center justify-center bg-black/30 backdrop-blur-md rounded-full border border-white/[0.08] active:scale-95 transition-all hover:bg-black/50">
              <RefreshCw className={`w-3.5 h-3.5 text-white/90 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Bottom Information Panel */}
        <div className="absolute inset-x-0 bottom-0 p-4 md:p-5 z-10 flex flex-col gap-2.5 pointer-events-none">

          {/* Status & Time row */}
          <div className="flex items-center gap-2">
            {!currentActiveStory && (
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${statusColors[status] || statusColors.LANCAR}`}>
                {status}
              </span>
            )}
            <span className="text-[11px] text-zinc-300 font-medium bg-black/20 backdrop-blur-sm px-2 py-0.5 rounded-md border border-white/[0.04]">
              {waktuLalu}
            </span>
          </div>

          {/* Description & Sublabel */}
          <div className="flex items-start gap-2 text-zinc-200">
            <Activity size={14} className="mt-1 text-cyan-400 shrink-0" />
            <p className="text-xs md:text-[13px] font-normal leading-relaxed text-zinc-200/90 drop-shadow">
              {displayDescription}
              {displaySubLabel && (
                <span className="inline-flex items-center ml-2 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 rounded">
                  {displaySubLabel}
                </span>
              )}
            </p>
          </div>

          {/* Call To Action Button */}
          {totalLaporanFoto > 0 && onOpenStoryTrip && (
            <button
              onClick={(e) => { e.stopPropagation(); onOpenStoryTrip(); }}
              className="mt-1 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white text-zinc-950 hover:bg-zinc-100 text-xs font-bold tracking-wide shadow-lg transition-all active:scale-[0.98] pointer-events-auto"
            >
              <span>Pantauan Warga ({totalLaporanFoto})</span>
              <ChevronDown size={14} className="text-zinc-600" />
            </button>
          )}

        </div>

      </div>
    </div >
  );
});

HeroCard.displayName = "HeroCard";
export default HeroCard;