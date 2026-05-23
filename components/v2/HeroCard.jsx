"use client";

import { useState, useEffect, useMemo } from "react";
import { MapPin, Activity, RefreshCw } from "lucide-react";
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
  const diffMins = Math.floor((Date.now() - new Date(dateString)) / 60000);
  if (diffMins < 1) return "Baru saja";
  if (diffMins < 60) return `${diffMins} menit lalu`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)} jam lalu`;
  return `${Math.floor(diffMins / 1440)} hari lalu`;
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

export default function HeroCard({
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
}) {
  const [timeKey] = useState(() => getIndonesianTimeLabel().toLowerCase());
  const [officialPhotos, setOfficialPhotos] = useState({ pagi: [], siang: [], sore: [], malam: [] });
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);

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

  useEffect(() => {
    if (!photos || !Array.isArray(photos)) return;
    for (let item of photos) {
      const url = getMediaUrl(item);
      if (url && isVideoUrl(url)) {
        setVideoUrl(url);
        break;
      }
    }
  }, [photos]);

  const currentPhotos = useMemo(() => {
    let result = [];
    if (photos && photos.length > 0) {
      result = photos
        .filter(item => {
          const url = getMediaUrl(item);
          return url && !isVideoUrl(url);
        })
        .map(item => ({ url: getMediaUrl(item) }));
    }
    if (result.length === 0) {
      const timePhotos = officialPhotos[timeKey] || [];
      result = timePhotos.map(p => ({ url: typeof p === 'string' ? p : p?.url || p }));
    }
    return result.filter(p => p.url);
  }, [photos, officialPhotos, timeKey]);

  const waktuLalu = formatTimeAgo(lastUpdate);
  const displayDescription = description || `Lalu lintas ${status.toLowerCase()} di ${namaTempat}.`;
  const hasMultiplePhotos = currentPhotos.length > 1;
  const hasVideo = !!videoUrl;
  const currentPhoto = currentPhotos[currentPhotoIndex];
  const displayName = isStoryMode ? `📖 ${namaTempat}` : namaTempat;

  const statusColors = {
    "LANCAR": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    "RAMAI": "bg-amber-500/20 text-amber-400 border-amber-500/30",
    "MACET": "bg-red-500/20 text-red-400 border-red-500/30",
  };

  const displayUsername = useMemo(() => {
    if (!userName) return null;
    const name = typeof userName === 'string' ? userName : userName.toString();
    return `@${name.replace(/\s+/g, '').toLowerCase()}`;
  }, [userName]);

  if (isLoading && currentPhotos.length === 0 && !videoUrl) {
    return <div className="w-full aspect-[1/1] bg-zinc-800/20 animate-pulse rounded-2xl" />;
  }

  return (
    <div className="relative w-full mb-4">
      <div className="relative aspect-[1/1] w-full overflow-hidden rounded-2xl bg-black/50 border border-white/10 group shadow-2xl">

        {hasVideo ? (
          <video
            key={videoUrl}
            src={videoUrl}
            className="absolute inset-0 w-full h-full object-cover"
            autoPlay
            loop
            muted
            playsInline
          />
        ) : currentPhoto?.url ? (
          <OptimizedMedia
            src={currentPhoto.url}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            alt={namaTempat}
            priority={priority}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
            <MapPin className="text-white/20" size={48} />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none" />

        {/* Top Section */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-10">
          <div className="bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${status === 'LANCAR' ? 'bg-emerald-400' :
              status === 'RAMAI' ? 'bg-amber-400' : 'bg-red-400'
              } animate-pulse`} />
            <span className="text-[10px] font-black text-white uppercase tracking-wider">
              {hasVideo ? 'VIDEO' : isStoryMode ? 'STORY' : 'LIVE'}
            </span>
          </div>

          <div className="flex gap-2">
            {isStoryMode && onBackToOriginal && (
              <button
                onClick={onBackToOriginal}
                className="p-2 bg-amber-500/50 backdrop-blur-md rounded-full active:scale-90 transition-all border border-white/10"
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            <button onClick={onRefresh} className="p-2 bg-black/50 backdrop-blur-md rounded-full active:scale-90 transition-transform border border-white/10">
              <RefreshCw className={`w-4 h-4 text-white/90 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="absolute inset-x-0 bottom-0 p-5 z-10 bg-gradient-to-t from-black/90 via-black/40 to-transparent pt-20">

          {/* Header Info - Status & Waktu */}
          <div className="flex items-center gap-2 mb-2">
            {!isStoryMode && (
              <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border ${statusColors[status] || statusColors.LANCAR}`}>
                {status}
              </span>
            )}
            <span className="text-[10px] text-white/60 font-medium flex items-center gap-1">
              <span className="text-cyan-400">●</span> {waktuLalu}
            </span>
          </div>

          {/* Main Title */}
          <h3 className="text-2xl font-[1000] text-white uppercase tracking-tighter leading-none mb-3 drop-shadow-md">
            {displayName}
          </h3>

          {/* Description DENGAN NAMA PENGIRIM DI SAMPINGNYA */}
          <div className="flex items-start gap-2 text-white/90 flex-wrap">
            <Activity size={14} className="mt-0.5 text-cyan-400 shrink-0" />
            <p className="text-xs italic font-light leading-relaxed opacity-90">
              "{displayDescription}"
              {displayUsername && (
                <span className="inline-block ml-2">
                  <span className="text-[9px] text-white/40 font-normal not-italic">
                    — {displayUsername}
                  </span>
                </span>
              )}
            </p>
          </div>

          {/* Avatar kecil di pojok (opsional, sangat kecil) */}
          {displayUsername && userAvatar && (
            <div className="absolute bottom-3 right-3 opacity-30">
              <img
                src={userAvatar}
                alt={userName}
                className="w-6 h-6 rounded-full object-cover border border-white/20"
              />
            </div>
          )}
        </div>

        {/* Navigation Dots */}
        {!hasVideo && hasMultiplePhotos && (
          <div className="absolute bottom-24 left-0 right-0 flex justify-center gap-1.5 z-10">
            {currentPhotos.slice(0, 5).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentPhotoIndex(idx)}
                className={`h-1 rounded-full transition-all duration-300 ${idx === currentPhotoIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/40'
                  }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}