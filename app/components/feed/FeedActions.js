"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/app/context/AuthContext";

export default function FeedActions({
  item,
  comments = {},
  openAIModal,
  openKomentarModal,
  onShare,
  variant = "floating-sidebar",
  theme,
  handleSesuai,
  isSesuai,
}) {
  const { user, role, isAdmin, isSuperAdmin } = useAuth();

  // --- LIKE LOGIC ---
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [showHeart, setShowHeart] = useState(false);

  useEffect(() => {
    if (!item?.id) return;
    
    let isMounted = true;
    
    const loadLikes = async () => {
      try {
        const { count } = await supabase.from("likes").select("id", { count: "exact", head: true }).eq("tempat_id", item.id);
        if (isMounted) setLikeCount(count || 0);
        
        if (user?.id) {
          const { data } = await supabase.from("likes").select("id").eq("tempat_id", item.id).eq("user_id", user.id).maybeSingle();
          if (isMounted) setIsLiked(!!data);
        }
      } catch (err) {
        console.error("Load likes error:", err);
      }
    };
    
    loadLikes();
    
    return () => { isMounted = false; };
  }, [item?.id, user?.id]);

  const handleLikeClick = async () => {
    if (!user) return;
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikeCount(v => wasLiked ? Math.max(0, v - 1) : v + 1);
    if (!wasLiked) setShowHeart(true);

    try {
      const { error } = wasLiked 
        ? await supabase.from("likes").delete().eq("tempat_id", item.id).eq("user_id", user.id)
        : await supabase.from("likes").insert([{ tempat_id: item.id, user_id: user.id }]);
      
      if (error) throw error;
    } catch (error) {
      setIsLiked(wasLiked);
      setLikeCount(v => wasLiked ? v + 1 : v - 1);
      console.error("Like error:", error);
    }
    
    if (!wasLiked) setTimeout(() => setShowHeart(false), 800);
  };

  // --- KOMENTAR LOGIC (TANPA POLLING) ---
const [jumlahKomentar, setJumlahKomentar] = useState(0);
const [unreadCount, setUnreadCount] = useState(0);
const seenCountRef = useRef(0);

useEffect(() => {
  if (!item?.id) return;
  
  let isMounted = true;
  
  const fetchCommentCount = async () => {
    try {
      const { count, error } = await supabase
        .from("komentar")
        .select("id", { count: "exact", head: true })
        .eq("tempat_id", item.id);
      
      if (!error && isMounted) {
        setJumlahKomentar(count || 0);
        seenCountRef.current = count || 0;
      }
    } catch (err) {
      // Silent fail - tidak perlu log error
      // set default 0
      if (isMounted) {
        setJumlahKomentar(0);
        seenCountRef.current = 0;
      }
    }
  };
  
  fetchCommentCount();
  
  return () => {
    isMounted = false;
  };
}, [item?.id]); 

  // Floating Sidebar Variant
  if (variant === "floating-sidebar") {
    return (
      <div className="flex flex-col gap-4 items-center select-none py-2 px-1">
        {/* LIKE */}
        <div className="flex flex-col items-center relative group">
          <button 
            onClick={handleLikeClick} 
            className="flex items-center justify-center transition-all active:scale-125 duration-200"
          >
            <span className="text-2xl drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] leading-none">
              {isLiked ? "❤️" : "🤍"}
            </span>
          </button>
          
          <AnimatePresence>
            {showHeart && (
              <motion.span 
                initial={{ opacity: 1, y: 0, scale: 0.5 }} 
                animate={{ opacity: 0, y: -40, scale: 2 }} 
                exit={{ opacity: 0 }}
                className="absolute text-xl pointer-events-none z-50"
              >
                ❤️
              </motion.span>
            )}
          </AnimatePresence>
          
          <span className="text-[9px] font-black mt-1 text-white drop-shadow-md tracking-tighter uppercase">
            {likeCount}
          </span>
        </div>

        {/* KOMENTAR */}
        <div className="flex flex-col items-center">
          <button 
            onClick={() => { setUnreadCount(0); openKomentarModal?.(item); }}
            className="flex items-center justify-center text-2xl active:scale-110 transition-transform relative"
          >
            <span className="drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] leading-none">💬</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1.5 bg-red-500 text-white text-[7px] font-black px-1 py-0.5 rounded-full border border-black animate-bounce">
                {unreadCount}
              </span>
            )}
          </button>
          <span className="text-[9px] font-black mt-1 text-white drop-shadow-md tracking-tighter uppercase">
            {jumlahKomentar}
          </span>
        </div>

        {/* SHARE */}
        <div className="flex flex-col items-center">
          <button 
            onClick={() => onShare?.(item)} 
            className="flex items-center justify-center text-white active:scale-110 transition-transform p-1"
          >
            <svg 
              width="22"
              height="22" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="3"
              className="drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
            >
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
            </svg>
          </button>
          <span className="text-[7px] font-black mt-0.5 text-white/60 uppercase tracking-widest">
            Share
          </span>
        </div>
      </div>
    );
  }

  // --- VARIANT: PHOTO OVERLAY ---
  if (variant === "photo-overlay") {
    const kastaColor = isSuperAdmin ? "bg-indigo-600 border-indigo-400" : isAdmin ? "bg-amber-500 border-amber-300" : "bg-emerald-500 border-emerald-300";
    const kastaLabel = isSuperAdmin ? "PETINGGI" : isAdmin ? "RT SETEMPAT" : "WARGA";

    return (
      <div className="flex items-center gap-2.5 w-full px-2 select-none">
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
          
          {isSesuai && (
            <motion.div 
              animate={{ opacity: [0, 1, 0], scale: [1, 1.5, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute right-4 w-2 h-2 rounded-full bg-white/50"
            />
          )}
        </button>

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