"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/app/context/AuthContext";

// Constants
const VARIANTS = {
  FLOATING_SIDEBAR: "floating-sidebar",
  PHOTO_OVERLAY: "photo-overlay",
};

const ROLES = {
  SUPER_ADMIN: { label: "PETINGGI", color: "bg-indigo-600 border-indigo-400", icon: "👑" },
  ADMIN: { label: "RT SETEMPAT", color: "bg-amber-500 border-amber-300", icon: "🏠" },
  USER: { label: "WARGA", color: "bg-emerald-500 border-emerald-300", icon: "✅" },
};

const ANIMATION_DURATION = 800;

export default function FeedActions({
  item,
  openAIModal,
  openKomentarModal,
  onShare,
  variant = VARIANTS.FLOATING_SIDEBAR,
  handleSesuai,
  isSesuai = false,
  isLaporanLike = false,
  isLaporanLiked = false,
  laporanLikeCount = 0,
  onLaporanLike,
  refreshTrigger = 0,
}) {
  const { user, isAdmin, isSuperAdmin } = useAuth();

  // ========== LIKE STATE ==========
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [showHeart, setShowHeart] = useState(false);
  const [isLikeLoading, setIsLikeLoading] = useState(false);

  // ========== COMMENT STATE ==========
  const [commentCount, setCommentCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  // ========== SYNC STATE DARI PROPS ==========
  useEffect(() => {
    if (isLaporanLike) {
      setIsLiked(isLaporanLiked);
      setLikeCount(laporanLikeCount);
    }
  }, [isLaporanLike, isLaporanLiked, laporanLikeCount]);

  // ========== FETCH LIKE DARI DATABASE (UNTUK LAPORAN) ==========
  const fetchLaporanLike = useCallback(async () => {
    if (!item?.id || !isLaporanLike || !user?.id) return;

    try {
      // Ambil status like user
      const { data: likeData, error: likeError } = await supabase
        .from("likes_laporan")
        .select("id")
        .eq("laporan_id", item.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (likeError) throw likeError;

      // Ambil total like count
      const { count, error: countError } = await supabase
        .from("likes_laporan")
        .select("id", { count: "exact", head: true })
        .eq("laporan_id", item.id);

      if (countError) throw countError;

      setIsLiked(!!likeData);
      setLikeCount(count || 0);
    } catch (error) {
      console.error("Fetch laporan like error:", error);
    }
  }, [item?.id, isLaporanLike, user?.id]);

  // Fetch like dari database saat mount atau item berubah
  useEffect(() => {
    if (isLaporanLike && item?.id && user?.id) {
      fetchLaporanLike();
    }
  }, [isLaporanLike, item?.id, user?.id, fetchLaporanLike, refreshTrigger]);

  // ========== LIKE LOGIC (UNTUK TEMPAT) ==========
  useEffect(() => {
    if (!item?.id || isLaporanLike) return;

    let isMounted = true;

    const loadLikes = async () => {
      try {
        const { count, error: countError } = await supabase
          .from("likes")
          .select("id", { count: "exact", head: true })
          .eq("tempat_id", item.id);

        if (countError) throw countError;
        if (isMounted) setLikeCount(count || 0);

        if (user?.id) {
          const { data, error: likeError } = await supabase
            .from("likes")
            .select("id")
            .eq("tempat_id", item.id)
            .eq("user_id", user.id)
            .maybeSingle();

          if (likeError) throw likeError;
          if (isMounted) setIsLiked(!!data);
        }
      } catch (error) {
        console.error("Load likes error:", error);
      }
    };

    loadLikes();
    return () => { isMounted = false; };
  }, [item?.id, user?.id, isLaporanLike]);

  // ========== HANDLE LIKE UNTUK LAPORAN ==========
  const handleLaporanLikeClick = useCallback(async () => {
    if (!user || isLikeLoading) {
      // Redirect ke login jika perlu
      return;
    }

    setIsLikeLoading(true);
    const wasLiked = isLiked;

    // Optimistic update
    setIsLiked(!wasLiked);
    setLikeCount(prev => wasLiked ? prev - 1 : prev + 1);
    if (!wasLiked) setShowHeart(true);

    try {
      if (wasLiked) {
        // DELETE like
        const { error } = await supabase
          .from("likes_laporan")
          .delete()
          .eq("laporan_id", item.id)
          .eq("user_id", user.id);

        if (error) throw error;
      } else {
        // INSERT like
        const { error } = await supabase
          .from("likes_laporan")
          .insert({
            laporan_id: item.id,
            user_id: user.id,
            created_at: new Date().toISOString()
          });

        if (error) throw error;
      }

      // 🔥 Panggil callback parent untuk refresh data (opsional)
      if (onLaporanLike) {
        await onLaporanLike();
      }

      // 🔥 Refresh local state dari database untuk memastikan sync
      await fetchLaporanLike();

    } catch (error) {
      // Rollback on error
      setIsLiked(wasLiked);
      setLikeCount(prev => wasLiked ? prev + 1 : prev - 1);
      console.error("Like error:", error);
    } finally {
      setIsLikeLoading(false);
    }

    if (!wasLiked) {
      setTimeout(() => setShowHeart(false), ANIMATION_DURATION);
    }
  }, [user, isLiked, likeCount, isLikeLoading, item?.id, onLaporanLike, fetchLaporanLike]);

  // ========== HANDLE LIKE UNTUK TEMPAT ==========
  const handleTempatLikeClick = useCallback(async () => {
    if (!user || isLikeLoading) return;

    const wasLiked = isLiked;
    setIsLikeLoading(true);
    setIsLiked(!wasLiked);
    setLikeCount(prev => wasLiked ? prev - 1 : prev + 1);

    if (!wasLiked) setShowHeart(true);

    try {
      if (wasLiked) {
        const { error } = await supabase
          .from("likes")
          .delete()
          .eq("tempat_id", item.id)
          .eq("user_id", user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("likes")
          .insert([{
            tempat_id: item.id,
            user_id: user.id
          }]);

        if (error) throw error;
      }
    } catch (error) {
      setIsLiked(wasLiked);
      setLikeCount(prev => wasLiked ? prev + 1 : prev - 1);
      console.error("Like error:", error);
    } finally {
      setIsLikeLoading(false);
    }

    if (!wasLiked) {
      setTimeout(() => setShowHeart(false), ANIMATION_DURATION);
    }
  }, [user, isLiked, likeCount, isLikeLoading, item?.id]);

  // Pilih handler berdasarkan jenis
  const handleLikeClick = useCallback(() => {
    if (isLaporanLike) {
      handleLaporanLikeClick();
    } else {
      handleTempatLikeClick();
    }
  }, [isLaporanLike, handleLaporanLikeClick, handleTempatLikeClick]);

  // ========== FETCH COMMENT COUNT ==========
  const fetchCommentCount = useCallback(async () => {
    if (!item?.id) return;

    try {
      const tableName = isLaporanLike ? "komentar_laporan" : "komentar";
      const foreignKey = isLaporanLike ? "laporan_id" : "tempat_id";

      const { count, error } = await supabase
        .from(tableName)
        .select("id", { count: "exact", head: true })
        .eq(foreignKey, item.id);

      if (error) throw error;

      setCommentCount(count || 0);
    } catch (error) {
      console.error("Fetch comment error:", error);
    }
  }, [item?.id, isLaporanLike]);

  // Load initial comment count
  useEffect(() => {
    if (item?.id) {
      fetchCommentCount();
    }
  }, [item?.id, fetchCommentCount, refreshTrigger]);

  // ========== EVENT LISTENER UNTUK KOMENTAR ==========
  useEffect(() => {
    if (!item?.id || !isLaporanLike) return;

    const handleCommentChange = (event) => {
      if (event.detail?.laporanId === item?.id) {
        fetchCommentCount();
        setUnreadCount(prev => prev + 1);
        setTimeout(() => setUnreadCount(0), 3000);
      }
    };

    window.addEventListener('laporan-comment-changed', handleCommentChange);
    return () => {
      window.removeEventListener('laporan-comment-changed', handleCommentChange);
    };
  }, [item?.id, isLaporanLike, fetchCommentCount]);

  // ========== HANDLE OPEN COMMENTS ==========
  const handleOpenComments = useCallback(() => {
    setUnreadCount(0);
    openKomentarModal?.(item);
  }, [openKomentarModal, item]);

  // ========== HELPER FUNCTIONS ==========
  const getDisplayLikeIcon = () => isLiked ? "❤️" : "🤍";
  const getDisplayLikeCount = () => likeCount;

  const getRoleInfo = () => {
    if (isSuperAdmin) return ROLES.SUPER_ADMIN;
    if (isAdmin) return ROLES.ADMIN;
    return ROLES.USER;
  };

  // ========== FLOATING SIDEBAR VARIANT ==========
  if (variant === VARIANTS.FLOATING_SIDEBAR) {
    return (
      <div className="flex flex-col gap-4 items-center select-none py-2 px-1">
        {/* Like Button */}
        <div className="flex flex-col items-center relative group">
          <button
            onClick={handleLikeClick}
            disabled={!user || isLikeLoading}
            aria-label={isLiked ? "Unlike" : "Like"}
            aria-pressed={isLiked}
            className="flex items-center justify-center transition-all active:scale-125 duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="text-2xl drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] leading-none">
              {getDisplayLikeIcon()}
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
            {getDisplayLikeCount()}
          </span>
        </div>

        {/* Comment Button */}
        <div className="flex flex-col items-center">
          <button
            onClick={handleOpenComments}
            aria-label="Comments"
            className="flex items-center justify-center text-2xl active:scale-110 transition-transform relative"
          >
            <span className="drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] leading-none">
              💬
            </span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1.5 bg-red-500 text-white text-[7px] font-black px-1 py-0.5 rounded-full border border-black animate-bounce">
                {unreadCount}
              </span>
            )}
          </button>
          <span className="text-[9px] font-black mt-1 text-white drop-shadow-md tracking-tighter uppercase">
            {commentCount}
          </span>
        </div>

        {/* Share Button */}
        <div className="flex flex-col items-center">
          <button
            onClick={() => onShare?.(item)}
            aria-label="Share"
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
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
          <span className="text-[7px] font-black mt-0.5 text-white/60 uppercase tracking-widest">
            Share
          </span>
        </div>
      </div>
    );
  }

  // ========== PHOTO OVERLAY VARIANT ==========
  if (variant === VARIANTS.PHOTO_OVERLAY) {
    const roleInfo = getRoleInfo();

    return (
      <div className="flex items-center gap-2.5 w-full px-2 select-none">
        <button
          onClick={handleSesuai}
          disabled={isSesuai}
          aria-label={isSesuai ? "Already verified" : "Verify as accurate"}
          className={`flex-[1.4] flex items-center justify-between px-4 py-3 rounded-[24px] border backdrop-blur-xl transition-all duration-500 active:scale-95 overflow-hidden group ${isSesuai
            ? `${roleInfo.color} text-white shadow-[0_0_25px_rgba(0,0,0,0.2)]`
            : "bg-black/60 border-white/20 text-white/90 hover:bg-black/70"
            } ${isSesuai ? "cursor-not-allowed" : "cursor-pointer"}`}
        >
          <div className="flex items-center gap-3 relative z-10 text-left">
            <span className="text-xl group-active:scale-125 transition-transform">
              {isSesuai ? roleInfo.icon : "👌"}
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-[11px] font-[1000] uppercase tracking-tighter">
                {isSesuai ? `VALID: ${roleInfo.label}` : "INFO SESUAI?"}
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
          aria-label="Ask AI about this location"
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-[24px] bg-gradient-to-tr from-violet-600 to-fuchsia-600 border border-white/30 shadow-lg active:scale-95 transition-all group"
        >
          <span className="text-lg group-hover:rotate-12 transition-transform">
            ✨
          </span>
          <div className="flex flex-col items-start leading-tight">
            <span className="text-[10px] font-black text-white uppercase tracking-tighter">
              KEPOIN AI
            </span>
            <span className="text-[7px] font-bold text-white/60 uppercase">
              Info Lokal
            </span>
          </div>
        </button>
      </div>
    );
  }

  return null;
}