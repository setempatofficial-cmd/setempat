"use client";

import { useState, memo } from "react";

// Memoized untuk mencegah re-render jika props tidak berubah
const DynamicHero = memo(({ 
  tempat, 
  onSwipe, 
  onRefresh,
  refreshing 
}) => {
  const [touchStart, setTouchStart] = useState(null);

  if (!tempat) return <div className="mb-6 h-64 bg-zinc-800/30 animate-pulse rounded-3xl" />;

  const kondisi = tempat.latest_condition || (tempat.isRamai ? "RAMAI" : "LANCAR");
  const waktuLalu = tempat.laporan_terbaru?.[0]?.created_at 
    ? formatTimeAgo(new Date(tempat.laporan_terbaru[0].created_at)) 
    : "Baru saja";

  // Gunakan filter CSS sederhana daripada animasi Framer Motion yang kompleks
  const statusColors = {
    "LANCAR": "bg-green-500/20 text-green-400 border-green-500/30",
    "RAMAI": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    "MACET": "bg-red-500/20 text-red-400 border-red-500/30",
  };

  return (
    <div 
      className="relative mb-8 transition-transform duration-300 active:scale-[0.98]"
      onTouchStart={e => setTouchStart(e.touches[0].clientX)}
      onTouchEnd={e => {
        if (!touchStart) return;
        const diff = touchStart - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 70) onSwipe?.(diff > 0 ? 'left' : 'right');
      }}
    >
      <div className="relative h-[320px] w-full overflow-hidden rounded-[2rem] shadow-xl border border-white/5 bg-zinc-900">
        {/* Gambar dengan Will-Change untuk optimasi GPU */}
        <img 
          src={tempat.image || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800"} 
          className="absolute inset-0 w-full h-full object-cover opacity-60 transition-transform duration-[2s] hover:scale-110"
          style={{ willChange: 'transform' }}
          alt=""
          loading="eager" // Hero image harus diprioritaskan
        />
        
        {/* Gradient Scrim yang lebih kontras untuk teks */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

        {/* Content */}
        <div className="absolute inset-0 p-6 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="bg-black/20 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
              <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-tighter">Live Area</span>
            </div>
            
            <button onClick={onRefresh} className="p-2 bg-white/10 backdrop-blur-lg rounded-full active:rotate-180 transition-transform">
              <svg className={`w-5 h-5 text-white ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          <div>
            <h1 className="text-3xl font-black text-white drop-shadow-md mb-1 leading-none">{tempat.name}</h1>
            <p className="text-sm text-white/60 mb-4 truncate">{tempat.alamat}</p>
            
            <div className="flex items-center justify-between pt-4 border-t border-white/10">
              <div className={`px-4 py-1.5 rounded-xl border font-black text-xs ${statusColors[kondisi] || statusColors.LANCAR}`}>
                {kondisi}
              </div>
              
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('open-detail', { detail: { tempatId: tempat.id } }))}
                className="px-6 py-2 bg-white text-black font-black text-xs rounded-xl shadow-lg active:scale-90 transition-transform"
              >
                DETAIL →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default DynamicHero;