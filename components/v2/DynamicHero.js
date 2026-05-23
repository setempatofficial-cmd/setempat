"use client";

import { useState, memo, useEffect } from "react";
import { MapPin, Activity, RefreshCw } from "lucide-react";

const DynamicHero = memo(({
  tempat,
  onRefresh,
  refreshing,
  isStoryMode = false,
  onBackToOriginal,
}) => {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [photos, setPhotos] = useState([]);
  const [videoMedia, setVideoMedia] = useState(null);

  if (!tempat) return <div className="mb-4 aspect-[16/10] w-full bg-zinc-800/30 animate-pulse rounded-2xl" />;

  // Bangun daftar media (foto & video)
  useEffect(() => {
    const photoList = [];
    let videoItem = null;

    // Cek video dari laporan terbaru
    if (tempat.laporan_terbaru?.[0]?.video_url) {
      videoItem = { type: 'video', url: tempat.laporan_terbaru[0].video_url };
    }

    // Cek video dari photos array
    if (tempat.photos && Array.isArray(tempat.photos)) {
      for (let photo of tempat.photos) {
        const url = typeof photo === 'string' ? photo : photo?.url;
        if (url && (url.includes('.mp4') || url.includes('video') || url.includes('stream'))) {
          videoItem = { type: 'video', url };
          break;
        }
      }
    }

    // Kumpulkan foto
    if (tempat.photos && Array.isArray(tempat.photos)) {
      tempat.photos.forEach(photo => {
        const url = typeof photo === 'string' ? photo : photo?.url;
        if (url && !url.includes('.mp4') && !url.includes('video')) {
          photoList.push(url);
        }
      });
    }

    if (tempat.laporan_terbaru?.[0]?.photo_url) {
      photoList.push(tempat.laporan_terbaru[0].photo_url);
    }

    if (tempat.image && !photoList.includes(tempat.image)) {
      photoList.unshift(tempat.image);
    }

    if (photoList.length === 0 && !videoItem) {
      photoList.push("https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800");
    }

    setPhotos(photoList);
    setVideoMedia(videoItem);
  }, [tempat]);

  // Auto slide untuk foto
  useEffect(() => {
    if (photos.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentPhotoIndex((prev) => (prev + 1) % photos.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [photos.length]);

  const kondisi = tempat.latest_condition || (tempat.isRamai ? "RAMAI" : "LANCAR");

  const formatTimeAgo = (dateString) => {
    if (!dateString) return "Baru saja";
    const diffMins = Math.floor((Date.now() - new Date(dateString)) / 60000);
    if (diffMins < 1) return "Baru saja";
    if (diffMins < 60) return `${diffMins} menit lalu`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} jam lalu`;
    return `${Math.floor(diffMins / 1440)} hari lalu`;
  };

  const statusColors = {
    "LANCAR": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    "RAMAI": "bg-amber-500/20 text-amber-400 border-amber-500/30",
    "MACET": "bg-red-500/20 text-red-400 border-red-500/30",
  };

  const waktuLalu = formatTimeAgo(tempat.updated_at || tempat.created_at);
  const currentPhoto = photos[currentPhotoIndex];
  const hasMultiplePhotos = photos.length > 1;
  const hasVideo = !!videoMedia;

  const displayName = isStoryMode ? `📖 ${tempat.name}` : tempat.name;
  const displayDescription = isStoryMode
    ? (tempat.deskripsi || "Update dari warga")
    : (tempat.laporan_terbaru?.[0]?.deskripsi || `Lalu lintas ${kondisi.toLowerCase()} di ${tempat.name}`);

  return (
    <div className="relative w-full mb-4">
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl bg-black/50 border border-white/10 group shadow-2xl">

        {/* Media Content - Prioritaskan Video jika ada */}
        {hasVideo ? (
          <video
            src={videoMedia.url}
            className="absolute inset-0 w-full h-full object-cover"
            autoPlay
            loop
            muted
            playsInline
          />
        ) : (
          <img
            src={currentPhoto}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            alt={tempat.name}
            onError={(e) => {
              e.target.src = "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800";
            }}
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

        {/* Top Section */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-10">
          <div className="bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${kondisi === 'LANCAR' ? 'bg-emerald-400' :
              kondisi === 'RAMAI' ? 'bg-amber-400' : 'bg-red-400'
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

        {/* Bottom Section - Bersih, Tanpa Tombol Aksi */}
        <div className="absolute inset-x-0 bottom-0 p-6 z-10">
          <h1 className="text-3xl font-black text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] tracking-tight leading-tight">
            {displayName}
          </h1>

          {!isStoryMode && tempat.alamat && (
            <p className="text-[11px] text-white/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] mt-1.5 flex items-center gap-1.5">
              <MapPin size={12} className="text-cyan-400" /> {tempat.alamat}
            </p>
          )}

          <div className="flex items-center gap-3 mt-3">
            {!isStoryMode && (
              <div className={`px-3 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider ${statusColors[kondisi] || statusColors.LANCAR}`}>
                {kondisi}
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <span className="text-white/70 text-[10px] font-medium">🕐</span>
              <span className="text-white/70 text-[10px] font-medium">
                {isStoryMode ? formatTimeAgo(tempat.created_at) : waktuLalu}
              </span>
            </div>
            {hasVideo && (
              <div className="flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded-full">
                <span className="text-[7px] text-cyan-400">📹</span>
              </div>
            )}
          </div>

          <div className="mt-3 flex items-start gap-2 text-white/90 max-w-[90%]">
            <Activity size={14} className="mt-0.5 text-cyan-400 shrink-0" />
            <p className="text-[11px] line-clamp-2 italic font-light drop-shadow-sm">
              "{displayDescription}"
            </p>
          </div>
        </div>

        {/* Navigation Dots */}
        {!hasVideo && hasMultiplePhotos && (
          <div className="absolute bottom-24 left-0 right-0 flex justify-center gap-1.5 z-10">
            {photos.slice(0, 5).map((_, idx) => (
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
});

DynamicHero.displayName = 'DynamicHero';

export default DynamicHero;