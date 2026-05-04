"use client";
import { useMemo, memo, useCallback } from "react";

// ========== CACHE & UTILITIES ==========
class FastLRUCache {
  constructor(limit = 200) {
    this.limit = limit;
    this.cache = new Map();
  }
  
  get(key) {
    const value = this.cache.get(key);
    if (value) { 
      this.cache.delete(key); 
      this.cache.set(key, value); 
    }
    return value || null;
  }
  
  set(key, value) {
    if (this.cache.has(key)) this.cache.delete(key);
    else if (this.cache.size >= this.limit) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }
  
  clear() { this.cache.clear(); }
}

const thumbnailCache = new FastLRUCache(150);

// ========== HELPER FUNCTIONS ==========
const isVideoUrl = (url) => {
  if (!url) return false;
  return /\.(mp4|m3u8)|cctv|stream|youtube/.test(url.toLowerCase());
};

const extractYouTubeId = (url) => {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([^&?#]+)/);
  return match?.[1] || null;
};

const getThumbnail = (item) => {
  const cached = thumbnailCache.get(item.id);
  if (cached) return cached;
  
  let result = 'https://placehold.co/400x225/1a1a1a/666666?text=NO+IMAGE';
  
  // Cek photo_url
  if (item.laporan_terbaru?.[0]?.photo_url && !isVideoUrl(item.laporan_terbaru[0].photo_url)) {
    result = item.laporan_terbaru[0].photo_url;
  } 
  // Cek video_url
  else if (item.laporan_terbaru?.[0]?.video_url) {
    const youtubeId = extractYouTubeId(item.laporan_terbaru[0].video_url);
    if (youtubeId) {
      result = `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`;
    } else if (/\.(mp4|m3u8)/.test(item.laporan_terbaru[0].video_url.toLowerCase())) {
      result = 'https://placehold.co/400x225/1a1a1a/3b82f6?text=VIDEO';
    }
  }
  // Cek image_url
  else if (item.image_url && !isVideoUrl(item.image_url)) {
    result = item.image_url;
  }
  // Cek photos array
  else if (item.photos && Array.isArray(item.photos) && item.photos[0]) {
    const firstPhoto = item.photos[0];
    const photoUrl = typeof firstPhoto === 'string' ? firstPhoto : firstPhoto.url;
    if (photoUrl && !isVideoUrl(photoUrl)) result = photoUrl;
  }
  
  thumbnailCache.set(item.id, result);
  return result;
};

const getBadgeColor = (tipe) => {
  const colors = {
    ramai: 'bg-orange-500/20 text-orange-500',
    sepi: 'bg-blue-500/20 text-blue-500',
    macet: 'bg-red-500/20 text-red-500'
  };
  return colors[tipe?.toLowerCase()] || 'bg-gray-500/20 text-gray-400';
};

const isNewReport = (latestDate) => {
  if (!latestDate) return false;
  return (Date.now() - new Date(latestDate).getTime()) < 24 * 60 * 60 * 1000;
};

// ========== MAIN COMPONENT ==========
const StableGridCard = memo(({ 
  item, 
  onCardClick, 
  showDistance = false,
  className = "",
  showBadges = true 
}) => {
  const handleClick = useCallback(() => {
    onCardClick?.(item);
  }, [onCardClick, item]);
  
  const thumbnail = useMemo(() => getThumbnail(item), [item]);
  const isNew = useMemo(() => isNewReport(item.laporan_terbaru?.[0]?.created_at), [item.laporan_terbaru]);
  const latestReport = item.laporan_terbaru?.[0];
  const matchingKeyword = item.matchingKeyword;

  return (
    <button 
      onClick={handleClick} 
      className={`flex flex-col text-left rounded-2xl overflow-hidden border bg-white/5 border-white/10 w-full relative group transition-transform active:scale-95 ${className}`}
    >
      {/* Badges */}
      {showBadges && (
        <>
          {isNew && (
            <div className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-green-500/20 text-green-500 backdrop-blur-md">
              BARU
            </div>
          )}
          
          {latestReport?.tipe && (
            <div className={`absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${getBadgeColor(latestReport.tipe)} backdrop-blur-md`}>
              {latestReport.tipe}
            </div>
          )}
          
          {matchingKeyword && (
            <div className="absolute bottom-2 left-2 z-10 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-blue-500/80 text-white backdrop-blur-md">
              {matchingKeyword}
            </div>
          )}
        </>
      )}
      
      {/* Image */}
      <div className="aspect-video bg-zinc-800 overflow-hidden">
        <img 
          src={thumbnail} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
          loading="lazy" 
          alt={item.name || "Location thumbnail"} 
        />
      </div>
      
      {/* Content */}
      <div className="p-3">
        <h4 className="text-xs font-black uppercase truncate">{item.name}</h4>
        <p className="text-[10px] opacity-40 truncate">{item.category || "Tempat"}</p>
        
        {showDistance && item.distance !== undefined && (
          <p className="text-[10px] opacity-60 mt-1 font-mono">📍 {item.distance.toFixed(1)} km</p>
        )}
        
        {item.laporan_terbaru?.length > 0 && item.laporan_terbaru[0]?.content && (
          <p className="text-[10px] opacity-60 mt-1 truncate">
            {item.laporan_terbaru[0].content.substring(0, 40)}
            {item.laporan_terbaru[0].content.length > 40 ? '...' : ''}
          </p>
        )}
      </div>
    </button>
  );
});

StableGridCard.displayName = 'StableGridCard';

// Export utilities untuk penggunaan di komponen lain jika perlu
export { thumbnailCache, getThumbnail, getBadgeColor, isVideoUrl, extractYouTubeId };
export default StableGridCard;