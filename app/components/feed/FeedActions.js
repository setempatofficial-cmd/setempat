"use client";

import { useState } from "react";

export default function FeedActions({
  item,
  comments = {},
  openAIModal,
  openKomentarModal,
  onShare,
  handleSesuai,
  isSesuai,
  variant = "bottom-panel",
  jumlahSaksi = 0,
  localValidationCount = 0,
}) {
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [animateLike, setAnimateLike] = useState(false);
  const jumlahKomentar = Object.keys(comments || {}).length;

  const handleLikeClick = () => {
    setIsLiked(!isLiked);
    setAnimateLike(true);
    setTimeout(() => setAnimateLike(false), 300);
  };

  // --- VARIANT 1: FLOATING SIDEBAR (Interaksi Sosial) ---
  if (variant === "floating-sidebar") {
    return (
      <div className="flex flex-col gap-5 items-center pr-2 select-none">
        {/* LIKE */}
        <div className="flex flex-col items-center">
          <button 
            onClick={handleLikeClick} 
            className={`w-12 h-12 rounded-full backdrop-blur-xl flex items-center justify-center text-2xl transition-all active:scale-125 border ${
              isLiked ? 'bg-rose-500 border-rose-400 shadow-lg shadow-rose-500/40' : 'bg-black/40 border-white/10 text-white'
            } ${animateLike ? 'animate-bounce' : ''}`}
          >
            {isLiked ? '❤️' : '🤍'}
          </button>
          <span className="text-[11px] font-black text-white mt-1 drop-shadow-md">
            {(item.likes_count || 0) + (isLiked ? 1 : 0)}
          </span>
        </div>

        {/* KOMENTAR */}
        <div className="flex flex-col items-center">
          <button 
            onClick={() => openKomentarModal(item)} 
            className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center text-2xl active:scale-110 transition-transform"
          >
            💬
          </button>
          <span className="text-[11px] font-black text-white mt-1 drop-shadow-md">{jumlahKomentar}</span>
        </div>

        {/* BOOKMARK */}
        <button 
          onClick={() => setIsBookmarked(!isBookmarked)}
          className={`w-12 h-12 rounded-full backdrop-blur-xl border flex items-center justify-center text-2xl transition-all active:scale-125 ${
            isBookmarked ? 'bg-amber-400 border-amber-300 text-black shadow-lg shadow-amber-500/40' : 'bg-black/40 border-white/10 text-white'
          }`}
        >
          {isBookmarked ? '🔖' : '📑'}
        </button>

        {/* SHARE */}
        <div className="flex flex-col items-center">
          <button 
            onClick={() => onShare(item)} 
            className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center text-xl active:rotate-12 transition-transform text-white"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
            </svg>
          </button>
          <span className="text-[11px] font-black text-white mt-1 drop-shadow-md">Bagi</span>
        </div>
      </div>
    );
  }

  // --- VARIANT 2: PHOTO OVERLAY (Dua Tombol Utama + Avatar Stacking) ---
  if (variant === "photo-overlay") {
    const totalSaksi = jumlahSaksi + localValidationCount;

    return (
      <div className="flex items-center justify-between gap-3 w-full select-none">
        
        {/* VALIDASI (Kiri) */}
        <button 
          onClick={handleSesuai}
          disabled={isSesuai}
          className={`flex-[1.5] flex items-center justify-between px-3 py-2.5 rounded-2xl border backdrop-blur-md transition-all duration-500 active:scale-95 ${
            isSesuai 
              ? "bg-emerald-500 border-emerald-300 text-white shadow-lg" 
              : "bg-black/60 border-white/20 text-white/90 hover:bg-black/70"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">{isSesuai ? '✅' : '👌'}</span>
            <div className="flex flex-col items-start leading-none">
              <span className="text-[10px] font-black uppercase tracking-tighter">
                {isSesuai ? "TERVALIDASI" : "VIBE SESUAI"}
              </span>
              <span className="text-[7px] font-bold text-white/60 uppercase mt-1">
                {totalSaksi} Saksi Mata
              </span>
            </div>
          </div>

          {/* AVATAR STACKING */}
          <div className="flex items-center">
            <div className="flex -space-x-2.5 overflow-hidden">
              {/* Dummy saksi lain */}
              {[1, 2].map((i) => (
                <div key={i} className="w-6 h-6 rounded-full border-2 border-emerald-600 bg-zinc-800 overflow-hidden shadow-sm">
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=Saksi${i}${item.id}`} alt="saksi" />
                </div>
              ))}
              {/* Avatar "ME" Slide-in */}
              {isSesuai && (
                <div className="w-6 h-6 rounded-full border-2 border-white bg-emerald-400 flex items-center justify-center text-[8px] font-black text-emerald-900 shadow-md animate-in slide-in-from-right-3 fade-in duration-500 z-10">
                  ME
                </div>
              )}
            </div>
            {totalSaksi > 3 && (
              <span className="text-[8px] font-bold ml-1 text-white/80">+{totalSaksi - 3}</span>
            )}
          </div>
        </button>

        {/* KEPOIN AI (Kanan) */}
        <button
          onClick={() => openAIModal(item)}
          className="flex-1 relative group overflow-hidden py-2.5 rounded-2xl bg-gradient-to-br from-fuchsia-600 to-violet-700 border border-white/30 shadow-xl active:scale-95 transition-all"
        >
          {/* Shimmer Effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite] pointer-events-none" />
          
          <div className="relative flex items-center justify-center gap-2">
            <span className="text-base animate-pulse">✨</span>
            <div className="flex flex-col items-start leading-none text-left">
              <span className="text-[10px] font-black uppercase tracking-tighter text-white">
                KEPOIN AI
              </span>
              <span className="text-[7px] font-bold text-fuchsia-200 uppercase mt-1">
                Info Lokal
              </span>
            </div>
          </div>
        </button>

      </div>
    );
  }

  return null;
}