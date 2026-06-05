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

// FIX AKURASI WAKTU: Menghindari bug NaN / timezone offset mismatch
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
  onStoryIndexChange
}, ref) => {
  const [timeKey] = useState(() => getIndonesianTimeLabel().toLowerCase());
  const [officialPhotos, setOfficialPhotos] = useState({ pagi: [], siang: [], sore: [], malam: [] });
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [localIndex, setLocalIndex] = useState(storySlideshowIndex);

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
        return `📜 Era Tahun ${currentActiveStory.tahun || 'Tempo Dulu'}`;
      }
      if (currentActiveStory.type === 'official' || currentActiveStory.is_official) {
        return `🏛️ Informasi Resmi`;
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
    "LANCAR": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    "RAMAI": "bg-amber-500/20 text-amber-400 border-amber-500/30",
    "MACET": "bg-red-500/20 text-red-400 border-red-500/30",
  };

  if (isLoading && !mediaSource.url) {
    return <div className="w-full aspect-[1/1] bg-zinc-800/20 animate-pulse rounded-2xl mb-4" />;
  }

  return (
    <div ref={ref} className="relative w-full flex flex-col items-center">
      <div className="relative aspect-[1/1] w-full overflow-hidden rounded-3xl bg-black/50 border border-white/10 group shadow-xl">

        {/* Media Port Player Utama */}
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
            className="w-full h-full object-cover"
            alt={namaTempat}
            priority={priority}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
            <MapPin className="text-white/20" size={48} />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none" />

        {/* Top Badges */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-10">
          <div className="bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${status === 'LANCAR' ? 'bg-emerald-400' : status === 'RAMAI' ? 'bg-amber-400' : 'bg-red-400'} animate-pulse`} />
            <span className="text-[10px] font-black text-white uppercase tracking-wider">
              {mediaSource.isVideo ? 'VIDEO' : currentActiveStory ? `${currentActiveStory.type}` : 'LIVE'}
            </span>
          </div>

          <div className="flex gap-2">
            {currentActiveStory && onBackToOriginal && (
              <button onClick={onBackToOriginal} className="p-2 bg-red-500/80 backdrop-blur-md rounded-full border border-white/10 active:scale-95 transition-all text-white">
                <X size={14} />
              </button>
            )}
            <button onClick={onRefresh} className="p-2 bg-black/50 backdrop-blur-md rounded-full border border-white/10 active:scale-95 transition-all">
              <RefreshCw className={`w-4 h-4 text-white/90 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Bottom Panel Text Info */}
        <div className="absolute inset-x-0 bottom-0 p-5 z-10 bg-gradient-to-t from-black/95 via-black/50 to-transparent pt-24 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            {!currentActiveStory && (
              <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border ${statusColors[status] || statusColors.LANCAR}`}>
                {status}
              </span>
            )}
            <span className="text-[10px] text-white/60 font-medium flex items-center gap-1">
              <span className="text-cyan-400">●</span> {waktuLalu}
            </span>
          </div>

          <h3 className="text-lg font-extrabold text-white uppercase tracking-normal leading-none drop-shadow-md">
            {displayName}
          </h3>

          <div className="flex items-start gap-2 text-white/90 flex-wrap">
            <Activity size={14} className="mt-0.5 text-cyan-400 shrink-0" />
            <p className="text-xs italic font-light leading-relaxed opacity-90">
              "{displayDescription}"
              {displaySubLabel && (
                <span className="inline-block ml-2">
                  <span className="text-[10px] text-cyan-300 font-bold not-italic">— {displaySubLabel}</span>
                </span>
              )}
            </p>
          </div>

          {/* BUTTON MEMANGGIL STORY STRIP */}
          {totalLaporanFoto > 0 && onOpenStoryTrip && (
            <button
              onClick={(e) => { e.stopPropagation(); onOpenStoryTrip(); }}
              className="mt-1 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 text-white text-[10px] font-black uppercase tracking-wider border border-white/20 active:scale-98 transition-transform pointer-events-auto"
            >
              <span>📸 Lihat Pantauan Warga ({totalLaporanFoto})</span>
              <ChevronDown size={12} className="opacity-70" />
            </button>
          )}


        </div>

      </div>
    </div>
  );
});

HeroCard.displayName = "HeroCard";
export default HeroCard;