"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";

// ── Konstanta & helpers — di luar component ──────────────────────────────────
const STORY_DURATION = 5000;

function relativeTime(dateStr) {
  if (!dateStr) return "Baru saja";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  if (diff < 60000) return "Baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  if (hours < 24) return `${hours} jam lalu`;
  return "Kemarin";
}

function filterAndSortStories(stories) {
  const cutoff = Date.now() - 24 * 3600000;
  return [...stories]
    .filter(s => !s?.created_at || new Date(s.created_at).getTime() > cutoff)
    .sort((a, b) => {
      const ta = a?.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b?.created_at ? new Date(b.created_at).getTime() : 0;
      return ta - tb; // terlama di depan
    });
}

// ── Komponen utama ────────────────────────────────────────────────────────────
export default function StoryModal({ isOpen, onClose, stories = [], theme, namaTempat }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [localStories, setLocalStories] = useState([]);
  const [viewCounts, setViewCounts] = useState({});
  const [dragY, setDragY] = useState(0);

  const shouldAdvanceRef = useRef(false);
  const holdTimerRef = useRef(null);
  const wasHoldingRef = useRef(false);
  const dragStartYRef = useRef(null);
  const closedByBackRef = useRef(false);

  // ── Setup ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    setLocalStories(filterAndSortStories(stories));
  }, [stories]);

  const storyCount = localStories.length;
  const currentStory = localStories[currentIndex];

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const uid = session?.user?.id || null;
      setCurrentUserId(uid);
      if (uid) {
        const { data } = await supabase.from("admins").select("id").eq("user_id", uid).maybeSingle();
        setIsAdmin(!!data);
      }
    });
  }, []);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // ── Back button Android ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    closedByBackRef.current = false;
    window.history.pushState({ storyModal: true }, "");
    const handlePopState = () => { closedByBackRef.current = true; onClose(); };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      if (!closedByBackRef.current && window.history.state?.storyModal) {
        window.history.go(-1);
      }
    };
  }, [isOpen]); // sengaja tidak include onClose

  // ── View count ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentStory?.id || !isOpen) return;
    const recordView = async () => {
      if (currentUserId) {
        await supabase.from("story_views").upsert(
          { laporan_id: currentStory.id, user_id: currentUserId },
          { onConflict: "laporan_id,user_id", ignoreDuplicates: true }
        );
      }
      const { count } = await supabase
        .from("story_views")
        .select("*", { count: "exact", head: true })
        .eq("laporan_id", currentStory.id);
      setViewCounts(prev => ({ ...prev, [currentStory.id]: count || 0 }));
    };
    recordView();
  }, [currentStory?.id, isOpen, currentUserId]);

  // ── Navigasi ──────────────────────────────────────────────────────────────
  const handleNextStory = useCallback(() => {
    if (currentIndex < storyCount - 1) {
      setCurrentIndex(v => v + 1); setProgress(0); setShowMenu(false);
    } else { onClose(); }
  }, [currentIndex, storyCount, onClose]);

  const handlePrevStory = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(v => v - 1); setProgress(0); setShowMenu(false);
    }
  }, [currentIndex]);

  const handleTapNavigation = (e) => {
    if (e.target.closest("button") || e.target.closest(".no-tap")) return;
    if (wasHoldingRef.current) { wasHoldingRef.current = false; return; }
    e.clientX < window.innerWidth / 3 ? handlePrevStory() : handleNextStory();
  };

  // ── Hold to pause + swipe down ────────────────────────────────────────────
  const handlePointerDown = (e) => {
    if (e.target.closest("button") || e.target.closest(".no-tap")) return;
    wasHoldingRef.current = false;
    dragStartYRef.current = e.clientY ?? null;
    holdTimerRef.current = setTimeout(() => {
      setIsPaused(true);
      wasHoldingRef.current = true;
    }, 250);
  };

  const handlePointerMove = (e) => {
    if (dragStartYRef.current === null) return;
    const delta = (e.clientY ?? dragStartYRef.current) - dragStartYRef.current;
    if (delta > 0) setDragY(delta);
  };

  const handlePointerUp = (e) => {
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
    const delta = (e?.clientY ?? dragStartYRef.current) - (dragStartYRef.current ?? e?.clientY ?? 0);
    dragStartYRef.current = null;
    setDragY(0);
    if (delta > 80) { onClose(); return; }
    setIsPaused(false);
  };

  // ── Reset saat buka ───────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0); setProgress(0);
      setShowMenu(false); setIsPaused(false);
      shouldAdvanceRef.current = false;
    }
  }, [isOpen]);

  // ── Progress bar ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || storyCount === 0 || showMenu || isPaused) return;
    const intervalTime = 40;
    const increment = (intervalTime / STORY_DURATION) * 100;
    const timer = setInterval(() => {
      setProgress(v => {
        const next = v + increment;
        if (next >= 100) { shouldAdvanceRef.current = true; return 100; }
        return next;
      });
    }, intervalTime);
    return () => clearInterval(timer);
  }, [isOpen, currentIndex, storyCount, showMenu, isPaused]);

  useEffect(() => {
    if (progress >= 100 && shouldAdvanceRef.current) {
      shouldAdvanceRef.current = false;
      handleNextStory();
    }
  }, [progress, handleNextStory]);

  // ── Hapus story ───────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!currentStory?.id || isDeleting) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from("laporan_warga").delete().eq("id", currentStory.id);
      if (error) throw error;
      setLocalStories(prev => {
        const updated = prev.filter(s => s.id !== currentStory.id);
        if (updated.length === 0) { onClose(); return []; }
        setCurrentIndex(i => Math.min(i, updated.length - 1));
        setProgress(0);
        return updated;
      });
      setShowMenu(false);
    } catch (err) {
      alert("Gagal menghapus: " + err.message);
    } finally { setIsDeleting(false); }
  };

  // ── Bagikan ───────────────────────────────────────────────────────────────
  const handleShare = async () => {
    const baseUrl = window.location.origin;
    const shareUrl = currentStory?.tempat_id
      ? `${baseUrl}/?tempat=${currentStory.tempat_id}`
      : baseUrl;
    const title = `${namaTempat || "Setempat"} — ${currentStory?.tipe || "Live Report"}`;
    const text = currentStory?.konten
      ? `📍 ${namaTempat || "Setempat"} — ${currentStory.konten}`
      : `📍 Cek kondisi terkini di ${namaTempat || "Setempat"}!`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(`${text}\n${shareUrl}`);
        alert("Link disalin!");
      }
    } catch (_) {}
    setShowMenu(false);
  };

  if (!mounted || !isOpen || storyCount === 0) return null;

  const fotoUrl = currentStory?.url || currentStory?.photo_url || currentStory?.image_url;
  const displayName = currentStory?.user_name || currentStory?.username || "Warga Anonim";
  const isOwner = currentUserId && currentStory?.user_id === currentUserId;
  const canDelete = isOwner || isAdmin;
  const viewCount = viewCounts[currentStory?.id] || 0;

  // Warna badge berdasarkan tipe
  const badgeColor = currentStory?.tipe === "Ramai"
    ? "bg-yellow-500/20 border-yellow-500/40 text-yellow-300"
    : currentStory?.tipe === "Antri"
    ? "bg-rose-500/20 border-rose-500/40 text-rose-300"
    : "bg-emerald-500/20 border-emerald-500/40 text-emerald-300";

  const tipeEmoji = currentStory?.tipe === "Ramai" ? "🏃" : currentStory?.tipe === "Antri" ? "⏳" : "🍃";

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-black flex items-center justify-center select-none"
        >
          {/* Overlay tap + hold + swipe */}
          <div
            className="absolute inset-0 z-10 cursor-pointer"
            onClick={handleTapNavigation}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />

          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{
              opacity: dragY > 0 ? Math.max(0.4, 1 - dragY / 200) : 1,
              scale: 1,
              y: dragY,
            }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={dragY > 0 ? { duration: 0 } : { type: "spring", damping: 25, stiffness: 120 }}
            className="relative h-[100dvh] w-full md:h-[90vh] md:w-[420px] bg-zinc-950 md:rounded-[32px] overflow-hidden shadow-2xl"
            style={{ borderRadius: dragY > 40 ? "24px" : undefined }}
          >
            {/* ── FOTO ── */}
            <div className="absolute inset-0">
              {fotoUrl ? (
                <img src={fotoUrl} className="w-full h-full object-cover" alt="story" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                  <span className="text-5xl opacity-20">📸</span>
                </div>
              )}
              <div className="absolute inset-x-0 top-0 h-52 bg-gradient-to-b from-black/85 via-black/40 to-transparent pointer-events-none" />
              <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />
            </div>

            {/* ── INDIKATOR PAUSE ── */}
            <AnimatePresence>
              {isPaused && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
                >
                  <div className="bg-black/40 backdrop-blur-sm rounded-full p-4">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                      <rect x="6" y="4" width="4" height="16" rx="1" />
                      <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── HEADER ── */}
            <div className="absolute top-0 left-0 right-0 z-30 pt-12 md:pt-6 px-4 pb-2">
              {/* Progress bars */}
              <div className="flex gap-1.5 mb-4">
                {localStories.map((_, idx) => (
                  <div key={idx} className="h-[3px] flex-1 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white rounded-full"
                      style={{
                        width: `${idx === currentIndex ? progress : idx < currentIndex ? 100 : 0}%`,
                        transition: idx === currentIndex && !isPaused ? "width 40ms linear" : "none",
                        boxShadow: idx === currentIndex ? "0 0 6px rgba(255,255,255,0.6)" : "none",
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Profil + titik tiga */}
              <div className="flex items-center justify-between no-tap">
                <div className="flex items-center gap-2.5">
                  <div className="p-[2px] rounded-full bg-gradient-to-tr from-yellow-400 via-fuchsia-500 to-cyan-400 shrink-0">
                    <img
                      src={currentStory?.user_avatar || `https://api.dicebear.com/7.x/notionists/svg?seed=${displayName}`}
                      className="w-9 h-9 rounded-full border-2 border-black object-cover"
                      alt="avatar"
                    />
                  </div>
                  <div className="flex flex-col leading-tight">
                    <span className="text-[13px] font-black text-white tracking-tight flex items-center gap-1.5 flex-wrap">
                      {displayName}
                      {isAdmin && currentStory?.user_id === currentUserId && (
                        <span className="text-[8px] bg-orange-500 px-1.5 py-0.5 rounded-full font-black">ADMIN</span>
                      )}
                      <span className="text-[9px] bg-rose-500 px-1.5 py-0.5 rounded-full font-black">LIVE</span>
                    </span>
                    <span className="text-[10px] text-white/55 font-medium flex items-center gap-1">
                      {currentStory?.time_tag && (
                        <><span className="text-cyan-400">{currentStory.time_tag}</span><span>·</span></>
                      )}
                      <span>{relativeTime(currentStory?.created_at)}</span>
                    </span>
                  </div>
                </div>

                {/* Titik tiga */}
                <button
                  onClick={(e) => { e.stopPropagation(); setShowMenu(v => !v); }}
                  className="no-tap w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md transition-all active:scale-90 z-50"
                >
                  <span className="flex flex-col gap-[3.5px] items-center justify-center">
                    {[0,1,2].map(i => <span key={i} className="w-[4px] h-[4px] rounded-full bg-white block" />)}
                  </span>
                </button>
              </div>
            </div>

            {/* ── DROPDOWN MENU ── */}
            <AnimatePresence>
              {showMenu && (
                <>
                  <div className="absolute inset-0 z-40" onClick={() => setShowMenu(false)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.88, y: -8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.88, y: -8 }}
                    transition={{ type: "spring", damping: 22, stiffness: 220 }}
                    className="absolute top-[7rem] md:top-24 right-4 z-50 no-tap bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl min-w-[170px]"
                  >
                    <button onClick={(e) => { e.stopPropagation(); handleShare(); }}
                      className="w-full flex items-center gap-3 px-4 py-4 hover:bg-white/5 transition-colors"
                    >
                      <span className="text-xl">🔗</span>
                      <span className="text-[14px] font-bold text-white">Bagikan</span>
                    </button>
                    {canDelete && (
                      <>
                        <div className="h-px bg-white/10 mx-3" />
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                          disabled={isDeleting}
                          className="w-full flex items-center gap-3 px-4 py-4 hover:bg-rose-500/10 transition-colors"
                        >
                          {isDeleting
                            ? <div className="w-5 h-5 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
                            : <span className="text-xl">🗑️</span>
                          }
                          <div className="flex flex-col items-start">
                            <span className="text-[14px] font-bold text-rose-400">
                              {isDeleting ? "Menghapus..." : "Hapus"}
                            </span>
                            {isAdmin && !isOwner && (
                              <span className="text-[9px] text-rose-400/60">sebagai admin</span>
                            )}
                          </div>
                        </button>
                      </>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {/* ── KETERANGAN BAWAH ── */}
            <div
              className="absolute bottom-0 left-0 right-0 z-20 px-5 pt-4 no-tap"
              style={{ paddingBottom: "max(1.75rem, env(safe-area-inset-bottom, 1.75rem))" }}
            >
              {/* Badge kondisi + nama tempat */}
              {currentStory?.tipe && (
                <div className="mb-3">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider border ${badgeColor}`}>
                    {/* Nama tempat */}
                    {namaTempat && (
                      <>
                        <span className="text-white/70 font-bold normal-case tracking-normal">
                          {namaTempat}
                        </span>
                        <span className="text-white/30 font-normal">|</span>
                      </>
                    )}
                    {/* Emoji + tipe */}
                    <span>{tipeEmoji}</span>
                    <span>{currentStory.tipe}</span>
                  </span>
                </div>
              )}

              {/* Caption */}
              {currentStory?.content && (
                <p className="text-white text-[15px] font-semibold leading-snug mb-3 drop-shadow-lg">
                  {currentStory.content}
                </p>
              )}

              {/* Footer: counter + viewer + waktu */}
              <div className="flex items-center justify-between mt-2">
                <p className="text-white/30 text-[11px] font-medium tracking-widest uppercase">
                  {currentIndex + 1} / {storyCount}
                </p>

                {/* Viewer count */}
                <div className="flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  <span className="text-[11px] font-bold text-white/35">
                    {viewCount > 0 ? viewCount.toLocaleString("id-ID") : "—"}
                  </span>
                </div>

                {/* Waktu */}
                {currentStory?.created_at && (
                  <p className="text-white/25 text-[10px] font-medium">
                    {new Date(currentStory.created_at).toLocaleTimeString("id-ID", {
                      hour: "2-digit", minute: "2-digit",
                    })} WIB
                  </p>
                )}
              </div>
            </div>

          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
