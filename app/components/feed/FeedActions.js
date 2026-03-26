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
  variant = "bottom-panel",
  theme,
  handleSesuai,
  isSesuai,
}) {
  const { user } = useAuth();

  // ── LIKE — toggle, tersimpan ke Supabase ─────────────────────────────────
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [showHeart, setShowHeart] = useState(false);
  const likeLoadedRef = useRef(false);

  useEffect(() => {
    if (!item?.id) return;

    // Fetch total likes
    supabase
      .from("likes")
      .select("id", { count: "exact", head: true })
      .eq("tempat_id", item.id)
      .then(({ count }) => setLikeCount(count || 0));

    // Cek apakah user sudah like
    if (user?.id) {
      supabase
        .from("likes")
        .select("id")
        .eq("tempat_id", item.id)
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          setIsLiked(!!data);
          likeLoadedRef.current = true;
        });
    }
  }, [item?.id, user?.id]);

  const handleLikeClick = async () => {
    if (!user) return; // tidak bisa like tanpa login

    // Optimistic toggle
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikeCount(v => wasLiked ? Math.max(0, v - 1) : v + 1);

    if (!wasLiked) {
      // Animasi heart naik
      setShowHeart(true);
      setTimeout(() => setShowHeart(false), 800);
      // Insert like
      const { error } = await supabase.from("likes").insert([{
        tempat_id: item.id,
        user_id: user.id,
      }]);
      if (error) {
        // Rollback
        setIsLiked(wasLiked);
        setLikeCount(v => v - 1);
      }
    } else {
      // Delete like
      const { error } = await supabase.from("likes")
        .delete()
        .eq("tempat_id", item.id)
        .eq("user_id", user.id);
      if (error) {
        // Rollback
        setIsLiked(wasLiked);
        setLikeCount(v => v + 1);
      }
    }
  };

  // ── BOOKMARK (local only) ─────────────────────────────────────────────────
  const [isBookmarked, setIsBookmarked] = useState(false);

  // ── KOMENTAR — realtime count + unread badge ──────────────────────────────
  const [jumlahKomentar, setJumlahKomentar] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const seenCountRef = useRef(0);

  useEffect(() => {
    if (!item?.id) return;

    supabase
      .from("komentar")
      .select("id", { count: "exact", head: true })
      .eq("tempat_id", item.id)
      .then(({ count }) => {
        const total = count || 0;
        setJumlahKomentar(total);
        seenCountRef.current = total;
        setUnreadCount(0);
      });

    const channel = supabase
      .channel(`komentar_count_${item.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "komentar",
        filter: `tempat_id=eq.${item.id}`,
      }, () => {
        setJumlahKomentar(prev => {
          const next = prev + 1;
          setUnreadCount(next - seenCountRef.current);
          return next;
        });
      })
      .on("postgres_changes", {
        event: "DELETE", schema: "public", table: "komentar",
        filter: `tempat_id=eq.${item.id}`,
      }, () => {
        setJumlahKomentar(prev => Math.max(0, prev - 1));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [item?.id]);

  const handleOpenKomentar = () => {
    seenCountRef.current = jumlahKomentar;
    setUnreadCount(0);
    openKomentarModal?.(item);
  };

  // ── VIBE ──────────────────────────────────────────────────────────────────
  const [vibeStatus, setVibeStatus] = useState({
    isVoted: false,
    count: item?.activePhoto?.vibe_count || 0,
  });

  useEffect(() => {
    if (!item?.activePhoto?.id) return;
    setVibeStatus({ isVoted: false, count: item.activePhoto.vibe_count || 0 });
    const channel = supabase
      .channel(`vibe-updates-${item.activePhoto.id}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "laporan_warga",
        filter: `id=eq.${item.activePhoto.id}`,
      }, (payload) => {
        setVibeStatus(prev => ({ ...prev, count: payload.new.vibe_count }));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [item?.activePhoto?.id]);

  const handleVibeClick = async () => {
    if (vibeStatus.isVoted || !item?.activePhoto?.id) return;
    setVibeStatus(prev => ({ ...prev, isVoted: true }));
    const { error } = await supabase.rpc("increment_vibe", { row_id: item.activePhoto.id });
    if (error) {
      setVibeStatus(prev => ({ ...prev, isVoted: false }));
    }
  };

  // ── FLOATING SIDEBAR ──────────────────────────────────────────────────────
  if (variant === "floating-sidebar") {
    return (
      <div className="flex flex-col gap-3 items-center select-none py-1">

        {/* LIKE — toggle */}
        <div className="flex flex-col items-center relative">
          <button
            onClick={handleLikeClick}
            className={`w-10 h-10 rounded-full backdrop-blur-xl flex items-center justify-center transition-all border active:scale-90
              ${isLiked
                ? "bg-rose-500/80 border-rose-400/60 shadow-[0_0_12px_rgba(244,63,94,0.4)]"
                : "bg-black/40 border-white/10"
              } ${!user ? "opacity-50" : ""}`}
          >
            <span className="text-xl leading-none pointer-events-none">
              {isLiked ? "❤️" : "🤍"}
            </span>
          </button>

          {/* Floating heart */}
          <AnimatePresence>
            {showHeart && (
              <motion.span
                initial={{ opacity: 1, y: 0, scale: 1 }}
                animate={{ opacity: 0, y: -28, scale: 1.5 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className="absolute -top-1 text-lg pointer-events-none z-50"
                style={{ left: "50%", transform: "translateX(-50%)" }}
              >
                ❤️
              </motion.span>
            )}
          </AnimatePresence>

          <span className={`text-[10px] font-black mt-1 drop-shadow-md
            ${theme?.isMalam ? "text-white/80" : "text-slate-800"}`}>
            {likeCount > 0 ? likeCount : <span className="opacity-40">0</span>}
          </span>
        </div>

        {/* KOMENTAR */}
        <div className="flex flex-col items-center">
          <button
            onClick={handleOpenKomentar}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center text-xl active:scale-95 transition-transform relative"
          >
            💬
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-[#E3655B] rounded-full flex items-center justify-center text-[9px] font-black text-white shadow-sm"
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </motion.span>
            )}
          </button>
          <span className={`text-[10px] font-black mt-1 text-white drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)]
            ${theme?.isMalam ? 'opacity-80' : 'opacity-100'}`}>
            {jumlahKomentar > 50
              ? <span>🔥 {jumlahKomentar}</span>
              : jumlahKomentar > 0
              ? jumlahKomentar
              : <span className="opacity-40">0</span>}
          </span>
        </div>

        {/* BOOKMARK */}
        <button
          onClick={() => setIsBookmarked(!isBookmarked)}
          className={`w-10 h-10 rounded-full backdrop-blur-xl border flex items-center justify-center text-xl transition-all active:scale-95
            ${isBookmarked
              ? "bg-amber-400/80 border-amber-300/60"
              : "bg-black/40 border-white/10"}`}
        >
          {isBookmarked ? "🔖" : "📑"}
        </button>

        {/* SHARE */}
        <div className="flex flex-col items-center">
          <button
            onClick={() => onShare?.(item)}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center active:scale-95 transition-transform text-white"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
            </svg>
          </button>
          <span className={`text-[10px] font-black mt-1 drop-shadow-md
            ${theme?.isMalam ? "text-white/80" : "text-slate-800"}`}>
            Bagi
          </span>
        </div>

      </div>
    );
  }

  // ── PHOTO OVERLAY ─────────────────────────────────────────────────────────
  if (variant === "photo-overlay") {
    return (
      <div className="flex items-center justify-between gap-3 w-full select-none">
        <button
          onClick={handleVibeClick}
          disabled={vibeStatus.isVoted}
          className={`flex-[1.5] flex items-center justify-between px-3 py-2.5 rounded-2xl border backdrop-blur-md transition-all duration-500 active:scale-95
            ${vibeStatus.isVoted
              ? "bg-emerald-500 border-emerald-300 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]"
              : "bg-black/60 border-white/20 text-white/90"}`}
        >
          <div className="flex items-center gap-2 text-left">
            <span className="text-lg">{vibeStatus.isVoted ? "✅" : "👌"}</span>
            <div className="flex flex-col leading-none">
              <span className="text-[10px] font-black uppercase tracking-tighter">
                {vibeStatus.isVoted ? "TERVALIDASI" : "VIBE SESUAI"}
              </span>
              <span className="text-[7px] font-bold text-white/60 uppercase mt-1">
                {vibeStatus.count} Saksi Mata
              </span>
            </div>
          </div>
          <div className="flex -space-x-2 overflow-hidden">
            {[1, 2].map(i => (
              <div key={i} className="w-6 h-6 rounded-full border-2 border-zinc-900 bg-zinc-700 flex items-center justify-center text-[8px] font-black text-white">
                {String.fromCharCode(64 + i)}
              </div>
            ))}
            <AnimatePresence>
              {vibeStatus.isVoted && (
                <motion.div
                  initial={{ scale: 0, x: 8 }}
                  animate={{ scale: 1, x: 0 }}
                  className="w-6 h-6 rounded-full border-2 border-white bg-emerald-400 flex items-center justify-center text-[8px] font-black text-emerald-900 z-10"
                >
                  ME
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </button>

        <button
          onClick={() => openAIModal?.(item)}
          className="flex-1 relative overflow-hidden py-2.5 rounded-2xl bg-gradient-to-br from-fuchsia-600 to-violet-700 border border-white/30 shadow-xl active:scale-95 transition-all"
        >
          <div className="relative flex items-center justify-center gap-2">
            <span className="text-base">✨</span>
            <div className="flex flex-col items-start leading-none">
              <span className="text-[10px] font-black uppercase tracking-tighter text-white">KEPOIN AI</span>
              <span className="text-[7px] font-bold text-fuchsia-200 uppercase mt-1">Info Lokal</span>
            </div>
          </div>
        </button>
      </div>
    );
  }

  return null;
}
