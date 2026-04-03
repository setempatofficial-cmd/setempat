"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";

export default function FeedActions({
  item,
  comments = {},
  openAIModal,
  openKomentarModal,
  onShare,
  variant = "floating-sidebar",
  theme,
  handleSesuai, // Fungsi utama dari parent
  isSesuai,     // State dari parent
}) {
  const { user, role, isAdmin, isSuperAdmin } = useAuth();

  // --- LIKE LOGIC ---
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [showHeart, setShowHeart] = useState(false);

  useEffect(() => {
    if (!item?.id) return;
    // Load likes count & user status
    const loadLikes = async () => {
      const { count } = await supabase.from("likes").select("id", { count: "exact", head: true }).eq("tempat_id", item.id);
      setLikeCount(count || 0);
      if (user?.id) {
        const { data } = await supabase.from("likes").select("id").eq("tempat_id", item.id).eq("user_id", user.id).maybeSingle();
        setIsLiked(!!data);
      }
    };
    loadLikes();
  }, [item?.id, user?.id]);

  const handleLikeClick = async () => {
    if (!user) return;
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikeCount(v => wasLiked ? Math.max(0, v - 1) : v + 1);
    if (!wasLiked) setShowHeart(true);

    const { error } = wasLiked 
      ? await supabase.from("likes").delete().eq("tempat_id", item.id).eq("user_id", user.id)
      : await supabase.from("likes").insert([{ tempat_id: item.id, user_id: user.id }]);
    
    if (error) { setIsLiked(wasLiked); setLikeCount(v => wasLiked ? v + 1 : v - 1); }
    if (!wasLiked) setTimeout(() => setShowHeart(false), 800);
  };

  // --- KOMENTAR LOGIC ---
  const [jumlahKomentar, setJumlahKomentar] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const seenCountRef = useRef(0);

  useEffect(() => {
    if (!item?.id) return;
    supabase.from("komentar").select("id", { count: "exact", head: true }).eq("tempat_id", item.id)
      .then(({ count }) => { setJumlahKomentar(count || 0); seenCountRef.current = count || 0; });

    const channel = supabase.channel(`komentar_${item.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "komentar", filter: `tempat_id=eq.${item.id}` }, 
      () => setJumlahKomentar(prev => { setUnreadCount((prev + 1) - seenCountRef.current); return prev + 1; }))
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [item?.id]);

  // --- VARIANT: FLOATING SIDEBAR (Interaksi Cepat) ---
  if (variant === "floating-sidebar") {
    return (
      <div className="flex flex-col gap-5 items-center select-none py-2">
        {/* LIKE */}
        <div className="flex flex-col items-center relative group">
          <button 
            onClick={handleLikeClick} 
            className="flex items-center justify-center transition-transform active:scale-125 duration-200"
          >
            <span className="text-3xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
              {isLiked ? "❤️" : "🤍"}
            </span>
          </button>
          
          <AnimatePresence>
            {showHeart && (
              <motion.span 
                initial={{ opacity: 1, y: 0, scale: 1 }} 
                animate={{ opacity: 0, y: -50, scale: 2.5 }} 
                className="absolute text-2xl pointer-events-none z-50"
              >
                ❤️
              </motion.span>
            )}
          </AnimatePresence>
          <span className="text-[11px] font-black mt-1 text-white drop-shadow-md">{likeCount}</span>
        </div>

        {/* KOMENTAR */}
        <div className="flex flex-col items-center">
          <button 
            onClick={() => { setUnreadCount(0); openKomentarModal?.(item); }}
            className="flex items-center justify-center text-3xl active:scale-110 transition-transform relative"
          >
            <span className="drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">💬</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-black">
                {unreadCount}
              </span>
            )}
          </button>
          <span className="text-[11px] font-black mt-1 text-white drop-shadow-md">{jumlahKomentar}</span>
        </div>

        {/* SHARE */}
        <button 
          onClick={() => onShare?.(item)} 
          className="flex items-center justify-center text-white active:scale-110 transition-transform"
        >
          <svg 
            width="26" 
            height="26" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2.5" 
            className="drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
          >
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
          </svg>
        </button>
      </div>
    );
  }

  // --- VARIANT: PHOTO OVERLAY (The "Vibe" & "AI" Section) ---
  if (variant === "photo-overlay") {
    // Penentuan warna tombol sesuai kasta
    const kastaColor = isSuperAdmin ? "bg-indigo-600 border-indigo-400" : isAdmin ? "bg-amber-500 border-amber-300" : "bg-emerald-500 border-emerald-300";
    const kastaLabel = isSuperAdmin ? "PETINGGI" : isAdmin ? "RT SETEMPAT" : "WARGA";

    return (
      <div className="flex items-center gap-2.5 w-full px-2 select-none">
        {/* TOMBOL SESUAI (VIBE VALIDATOR) */}
        <button
          onClick={handleSesuai}
          disabled={isSesuai}
          className={`flex-[1.4] flex items-center justify-between px-4 py-3 rounded-[24px] border backdrop-blur-xl transition-all duration-500 active:scale-95 overflow-hidden group
            ${isSesuai 
              ? `${kastaColor} text-white shadow-[0_0_25px_rgba(0,0,0,0.2)]` 
              : "bg-black/60 border-white/20 text-white/90 hover:bg-black/70"}`}
        >
          <div className="flex items-center gap-3 relative z-10 text-left">
            <span className="text-xl group-active:scale-125 transition-transform">
              {isSesuai ? (isSuperAdmin ? "👑" : isAdmin ? "🏠" : "✅") : "👌"}
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-[11px] font-[1000] uppercase tracking-tighter">
                {isSesuai ? `VALID: ${kastaLabel}` : "INFO SESUAI?"}
              </span>
              <span className="text-[8px] font-bold text-white/70 uppercase">
                {item.vibe_count || 0} Saksi Mata
              </span>
            </div>
          </div>
          
          {/* Animasi Sinyal (Denyut) hanya jika sudah divalidasi */}
          {isSesuai && (
            <motion.div 
              animate={{ opacity: [0, 1, 0], scale: [1, 1.5, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute right-4 w-2 h-2 rounded-full bg-white/50"
            />
          )}
        </button>

        {/* TOMBOL AI (KEPOIN AI) */}
        <button
          onClick={() => openAIModal?.(item)}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-[24px] bg-gradient-to-tr from-violet-600 to-fuchsia-600 border border-white/30 shadow-lg active:scale-95 transition-all group"
        >
          <span className="text-lg group-hover:rotate-12 transition-transform">✨</span>
          <div className="flex flex-col items-start leading-tight">
            <span className="text-[10px] font-black text-white uppercase tracking-tighter">KEPOIN AI</span>
            <span className="text-[7px] font-bold text-white/60 uppercase">Info Lokal</span>
          </div>
        </button>
      </div>
    );
  }

  return null;
}