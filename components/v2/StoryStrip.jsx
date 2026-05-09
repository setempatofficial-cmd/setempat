"use client";

import { useRef } from "react";

export default function StoryStrip({ 
  places = [], 
  activePlace, 
  onSelectPlace, 
  theme 
}) {
  const scrollRef = useRef(null);
  
  if (!places || !Array.isArray(places) || places.length === 0) {
    return (
      <div className="mb-6">
        <h3 className="text-sm font-semibold mb-3">Cerita Terbaru</h3>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className="w-14 h-14 rounded-full bg-zinc-800 animate-pulse" />
              <div className="w-10 h-2 bg-zinc-800 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  const formatStoryTime = (place) => {
    const lastReport = place.laporan_terbaru?.[0];
    if (!lastReport) return "Baru saja";
    const diffMins = Math.floor((Date.now() - new Date(lastReport.created_at)) / 60000);
    if (diffMins < 60) return `${diffMins}m lalu`;
    return `${Math.floor(diffMins / 60)}j lalu`;
  };
  
  const isLive = (place) => {
    const lastReport = place.laporan_terbaru?.[0];
    if (!lastReport) return false;
    const diffMins = Math.floor((Date.now() - new Date(lastReport.created_at)) / 60000);
    return diffMins < 30;
  };
  
  // ✅ Fungsi untuk mendapatkan foto terbaik
  const getPhotoUrl = (place) => {
    // Coba dari photos array
    if (place.photos && Array.isArray(place.photos) && place.photos.length > 0) {
      return place.photos[0];
    }
    // Coba dari laporan terbaru
    const latestReport = place.laporan_terbaru?.[0];
    if (latestReport?.photo_url) return latestReport.photo_url;
    if (latestReport?.image_url) return latestReport.image_url;
    // Fallback ke icon
    return null;
  };
  
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Cerita Terbaru</h3>
        <span className="text-xs text-zinc-500">LIVE</span>
      </div>
      
      <div 
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {places.slice(0, 10).map((place) => {
          const isActive = activePlace?.id === place.id;
          const live = isLive(place);
          const timeText = formatStoryTime(place);
          const photoUrl = getPhotoUrl(place);
          
          return (
            <button
              key={place.id}
              onClick={() => onSelectPlace(place)}
              className="flex flex-col items-center gap-1 flex-shrink-0"
            >
              <div className={`relative w-14 h-14 rounded-full overflow-hidden bg-zinc-800 flex items-center justify-center
                ${isActive ? 'ring-2 ring-cyan-500' : ''}
                ${live ? 'ring-2 ring-red-500' : ''}
              `}>
                {photoUrl ? (
                  <img 
                    src={photoUrl} 
                    alt={place.name} 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.parentElement.innerHTML = '<span class="text-2xl">📍</span>';
                    }}
                  />
                ) : (
                  <span className="text-2xl">📍</span>
                )}
                
                {live && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-zinc-900" />
                )}
              </div>
              <span className="text-xs font-medium max-w-[60px] truncate">{place.name}</span>
              <span className="text-[10px] text-zinc-500">{timeText}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}