'use client';

import { useEffect, useState, useRef, useCallback, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/app/context/AuthContext";
import VerifiedBadge from "@/app/components/ui/VerifiedBadge";

// ── Long press hook ───────────────────────────────────────────────────────────
function useLongPress(callback, ms = 600) {
  const timerRef = useRef(null);
  const isLongRef = useRef(false);

  const start = useCallback((e) => {
    isLongRef.current = false;
    timerRef.current = setTimeout(() => {
      isLongRef.current = true;
      callback(e);
    }, ms);
  }, [callback, ms]);

  const cancel = useCallback(() => {
    clearTimeout(timerRef.current);
  }, []);

  const handleClick = useCallback((e) => {
    if (isLongRef.current) e.preventDefault();
  }, []);

  return { onMouseDown: start, onTouchStart: start, onMouseUp: cancel, onMouseLeave: cancel, onTouchEnd: cancel, onClick: handleClick };
}

// ── Render teks dengan highlight mention ──────────────────────────────────────
function renderContentWithMentions(content) {
  if (!content) return null;
  const parts = content.split(/(@\w+)/g);
  return parts.map((part, index) => {
    if (part.startsWith("@")) {
      return (
        <span key={index} className="text-blue-500 font-medium">
          {part}
        </span>
      );
    }
    return part;
  });
}

// ── Fetch komentar video ──────────────────────────────────────────────
async function fetchVideoComments(videoId) {
  if (!videoId) return [];

  try {
    const { data: komentarData, error: komentarError } = await supabase
      .from("video_peken_comments")
      .select("id, video_id, parent_id, user_id, user_name, user_avatar, username, comment, likes, created_at")
      .eq("video_id", videoId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (komentarError) throw komentarError;
    if (!komentarData || komentarData.length === 0) return [];

    const userIds = [...new Set(komentarData.map(k => k.user_id).filter(Boolean))];

    let profilesMap = {};
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url, is_verified")
        .in("id", userIds);

      if (profilesData) {
        profilesMap = Object.fromEntries(profilesData.map(p => [p.id, p]));
      }
    }

    const mappedData = komentarData.map(item => ({
      id: item.id,
      video_id: item.video_id,
      parent_id: item.parent_id,
      user_id: item.user_id,
      user_name: profilesMap[item.user_id]?.full_name || item.user_name || "Warga",
      username: profilesMap[item.user_id]?.username || item.username,
      user_avatar: profilesMap[item.user_id]?.avatar_url || item.user_avatar,
      is_verified: profilesMap[item.user_id]?.is_verified || false,
      content: item.comment,
      likes: item.likes || 0,
      created_at: item.created_at,
      replies: []
    }));

    const map = {};
    const roots = [];

    mappedData.forEach(item => {
      map[item.id] = { ...item, replies: [] };
    });

    mappedData.forEach(item => {
      if (item.parent_id && map[item.parent_id]) {
        map[item.parent_id].replies.push(map[item.id]);
      } else if (!item.parent_id) {
        roots.push(map[item.id]);
      }
    });

    const sortReplies = (nodes) => {
      nodes.forEach(n => {
        if (n.replies?.length) {
          n.replies.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
          sortReplies(n.replies);
        }
      });
    };
    sortReplies(roots);

    return roots;
  } catch (err) {
    console.error("Fetch video comments error:", err);
    return [];
  }
}

// ── Format waktu relatif ──────────────────────────────────────────────
const timeAgo = (dateStr) => {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return "Baru saja";
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  return `${Math.floor(diff / 86400)} hari lalu`;
};

// ── Avatar ────────────────────────────────────────────────────────────
const COLORS = ["#E3655B", "#06b6d4", "#8b5cf6", "#f59e0b", "#10b981", "#ec4899", "#3b82f6"];

const avatarColor = (name = "") => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return COLORS[Math.abs(h) % COLORS.length];
};

const sizeMap = {
  7: "w-7 h-7",
  8: "w-8 h-8",
  9: "w-9 h-9"
};

const Avatar = ({ name, avatar, size = 8 }) => {
  const sizeClass = sizeMap[size] || `w-${size} h-${size}`;

  if (avatar) {
    return (
      <img
        src={avatar}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0`}
        alt={name}
        loading="lazy"
        onError={(e) => {
          e.target.style.display = 'none';
          e.target.parentElement?.querySelector('.avatar-fallback')?.classList.remove('hidden');
        }}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center text-white font-black flex-shrink-0 avatar-fallback`}
      style={{ backgroundColor: avatarColor(name), fontSize: size * 1.5 }}
    >
      {(name || "W")[0].toUpperCase()}
    </div>
  );
};
Avatar.displayName = 'Avatar';

// ── Item komentar ────────────────────────────────────────────────────
const KomentarItem = ({ item, depth = 0, onReply, onLike, onDelete, onReport, likedIds, canDelete }) => {
  const [showReplies, setShowReplies] = useState(depth < 1);
  const [showMore, setShowMore] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const LIMIT = 3;

  const longPressProps = useLongPress(() => setShowMenu(true), 600);

  const hasReplies = item.replies?.length > 0;
  const isLiked = likedIds.has(item.id);
  const visibleReplies = showMore ? item.replies : item.replies?.slice(0, LIMIT);
  const hiddenCount = (item.replies?.length || 0) - LIMIT;

  return (
    <>
      <div className={`${depth > 0 ? "ml-4 pl-3 border-l-2 border-slate-100" : ""}`}>
        <AnimatePresence>
          {showMenu && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-[3000]"
                onClick={() => setShowMenu(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 8 }}
                transition={{ type: "spring", damping: 20, stiffness: 300 }}
                className="fixed left-1/2 -translate-x-1/2 z-[3001] bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden w-64"
                style={{ top: "40%" }}
              >
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">Komentar</p>
                  <p className="text-[13px] text-slate-700 line-clamp-2">{item.content}</p>
                </div>
                <div className="py-1">
                  {canDelete && (
                    <button
                      onClick={() => { setShowMenu(false); onDelete(item.id); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-rose-50 transition-colors text-left"
                    >
                      <span className="text-lg">🗑️</span>
                      <div>
                        <p className="text-[13px] font-bold text-rose-600">Hapus Komentar</p>
                        <p className="text-[10px] text-slate-400">Komentar akan dihapus permanen</p>
                      </div>
                    </button>
                  )}
                  <button
                    onClick={() => { setShowMenu(false); onReport(item.id); }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-amber-50 transition-colors text-left"
                  >
                    <span className="text-lg">🚩</span>
                    <div>
                      <p className="text-[13px] font-bold text-amber-600">Laporkan</p>
                      <p className="text-[10px] text-slate-400">Tandai sebagai konten tidak pantas</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setShowMenu(false)}
                    className="w-full px-4 py-3 text-[13px] text-slate-400 font-bold hover:bg-slate-50 text-center"
                  >
                    Batal
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <div
          className={`flex items-start gap-2.5 mb-2 rounded-xl transition-colors select-none
            ${showMenu ? "bg-slate-100" : "active:bg-slate-50"}`}
          {...longPressProps}
        >
          <Avatar name={item.user_name} avatar={item.user_avatar} size={depth === 0 ? 9 : 7} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[13px] font-bold text-slate-900 truncate">
                {item.user_name || "Warga"}
              </span>
              {item.is_verified && <VerifiedBadge size="xs" />}
              {item._pending ? (
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <span className="w-2 h-2 border border-slate-300 border-t-transparent rounded-full animate-spin inline-block" />
                  mengirim...
                </span>
              ) : (
                <span className="text-[11px] text-slate-400">{timeAgo(item.created_at)}</span>
              )}
            </div>

            <p className="text-[13px] text-slate-800 leading-relaxed mt-0.5">
              {renderContentWithMentions(item.content)}
            </p>

            <div className="flex items-center gap-4 mt-1.5">
              <button
                onClick={() => onLike(item.id, isLiked)}
                className={`flex items-center gap-1 text-[12px] transition-colors
                  ${isLiked ? "text-rose-500" : "text-slate-400 hover:text-slate-600"}`}
              >
                <span>{isLiked ? "❤️" : "🤍"}</span>
                <span className="font-semibold">{item.likes || 0}</span>
              </button>
              <button
                onClick={() => onReply(item.id, item.user_name, item.username)}
                className="text-[12px] text-slate-400 hover:text-[#E3655B] transition-colors font-semibold"
              >
                Balas
              </button>
            </div>
          </div>
        </div>
      </div>

      {hasReplies && (
        <div className={`${depth === 0 ? "ml-11" : "ml-9"}`}>
          <button
            onClick={() => setShowReplies(v => !v)}
            className="text-[11px] text-slate-400 hover:text-[#E3655B] font-bold mb-2 transition-colors"
          >
            {showReplies ? "▲ Sembunyikan balasan" : `▼ Lihat ${item.replies.length} balasan`}
          </button>

          <AnimatePresence>
            {showReplies && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden space-y-3"
              >
                {visibleReplies.map(reply => (
                  <KomentarItem
                    key={reply.id}
                    item={reply}
                    depth={depth + 1}
                    onReply={onReply}
                    onLike={onLike}
                    onDelete={onDelete}
                    onReport={onReport}
                    likedIds={likedIds}
                    canDelete={canDelete}
                  />
                ))}
                {!showMore && hiddenCount > 0 && (
                  <button
                    onClick={() => setShowMore(true)}
                    className="text-[11px] text-[#E3655B] font-bold ml-3"
                  >
                    + {hiddenCount} balasan lainnya
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </>
  );
};
KomentarItem.displayName = 'KomentarItem';

// ── MAIN COMPONENT ────────────────────────────────────────────────────
export default function VideoCommentsModal({ isOpen, onClose, video }) {
  const { user } = useAuth();
  const [komentar, setKomentar] = useState([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [likedIds, setLikedIds] = useState(new Set());
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [startTranslateY, setStartTranslateY] = useState(0);
  const [mounted, setMounted] = useState(false);

  const inputRef = useRef(null);
  const modalRef = useRef(null);
  const isDraggingRef = useRef(false);
  const fetchCache = useRef(new Map());

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    return () => {
      const timer = setTimeout(() => fetchCache.current.clear(), 300000);
      return () => clearTimeout(timer);
    };
  }, []);

  // Fetch komentar dengan cache
  useEffect(() => {
    if (!isOpen || !video?.id) return;

    const cacheKey = `video_comments_${video.id}`;
    const cached = fetchCache.current.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < 30000) {
      setKomentar(cached.data);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchVideoComments(video.id)
      .then(data => {
        setKomentar(data);
        fetchCache.current.set(cacheKey, { data, timestamp: Date.now() });
      })
      .catch(err => {
        console.error("Fetch comments error:", err);
        setKomentar([]);
      })
      .finally(() => setLoading(false));
  }, [isOpen, video?.id]);

  // Handle body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      setTranslateY(0);
      setReplyTo(null);
      setInput("");
      setStartTranslateY(0);
      setIsDragging(false);
      isDraggingRef.current = false;
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Focus input when replying
  useEffect(() => {
    if (replyTo && inputRef.current) {
      setInput(`@${replyTo.username} `);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [replyTo]);

  // Touch handlers
  const handleTouchStart = useCallback((e) => {
    if (modalRef.current && modalRef.current.scrollTop <= 5) {
      e.preventDefault();
      e.stopPropagation();
      isDraggingRef.current = true;
      setIsDragging(true);
      setStartY(e.touches[0].clientY);
      setStartTranslateY(translateY);
    }
  }, [translateY]);

  const handleTouchMove = useCallback((e) => {
    if (!isDraggingRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const diff = e.touches[0].clientY - startY;
    if (diff > 0) {
      setTranslateY(Math.min(startTranslateY + diff, 200));
    }
  }, [startY, startTranslateY]);

  const handleTouchEnd = useCallback(() => {
    if (isDraggingRef.current) {
      if (translateY > 80) {
        onClose();
      } else {
        setTranslateY(0);
      }
      isDraggingRef.current = false;
      setIsDragging(false);
      setStartTranslateY(0);
    }
  }, [translateY, onClose]);

  const canDeleteItem = useCallback((item) => {
    return user?.id === item.user_id;
  }, [user?.id]);

  const handleDelete = useCallback(async (id) => {
    const removeFromTree = (nodes) =>
      nodes.filter(n => n.id !== id)
        .map(n => ({ ...n, replies: removeFromTree(n.replies || []) }));

    setKomentar(prev => removeFromTree(prev));

    const { error } = await supabase.from("video_peken_comments").delete().eq("id", id);
    if (error) {
      fetchVideoComments(video.id).then(setKomentar).catch(console.error);
      alert("Gagal hapus: " + error.message);
    } else {
      fetchCache.current.delete(`video_comments_${video.id}`);
      window.dispatchEvent(new CustomEvent('video-comment-changed', {
        detail: { videoId: video.id }
      }));
    }
  }, [video?.id]);

  const handleReport = useCallback(() => {
    alert("Laporan dikirim. Tim kami akan meninjau komentar ini. Terima kasih!");
  }, []);

  // Tree manipulation helpers
  const insertReply = useCallback((nodes, parentId, newItem) =>
    nodes.map(n => {
      if (n.id === parentId) return { ...n, replies: [...(n.replies || []), newItem] };
      if (n.replies?.length) return { ...n, replies: insertReply(n.replies, parentId, newItem) };
      return n;
    }), []);

  const replaceItem = useCallback((nodes, oldId, newItem) =>
    nodes.map(n => {
      if (n.id === oldId) return newItem;
      if (n.replies?.length) return { ...n, replies: replaceItem(n.replies, oldId, newItem) };
      return n;
    }), []);

  const removeItem = useCallback((nodes, id) =>
    nodes.filter(n => n.id !== id).map(n =>
      n.replies?.length ? { ...n, replies: removeItem(n.replies, id) } : n
    ), []);

  const handleSubmit = useCallback(async () => {
    const text = input.trim();
    if (!text || submitting) return;
    if (!user) {
      alert("Login dulu ya!");
      return;
    }

    const { data: userProfile } = await supabase
      .from("profiles")
      .select("username, full_name, avatar_url, is_verified")
      .eq("id", user.id)
      .single();

    const userName = userProfile?.full_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "Warga";
    const userUsername = userProfile?.username || user.user_metadata?.username || user.email?.split("@")[0];
    const userAvatar = userProfile?.avatar_url || user.user_metadata?.avatar_url || null;
    const isUserVerified = userProfile?.is_verified || false;
    const parentId = replyTo?.id || null;

    const tempId = `temp_${Date.now()}`;
    const optimisticItem = {
      id: tempId,
      video_id: video.id,
      parent_id: parentId,
      user_id: user.id,
      user_name: userName,
      username: userUsername,
      user_avatar: userAvatar,
      is_verified: isUserVerified,
      content: text,
      likes: 0,
      created_at: new Date().toISOString(),
      replies: [],
      _pending: true,
    };

    if (parentId) {
      setKomentar(prev => insertReply(prev, parentId, optimisticItem));
    } else {
      setKomentar(prev => [optimisticItem, ...prev]);
    }

    setInput("");
    setReplyTo(null);
    setSubmitting(true);

    try {
      const { data, error } = await supabase.from("video_peken_comments").insert({
        video_id: video.id,
        parent_id: parentId,
        user_id: user.id,
        user_name: userName,
        username: userUsername,
        user_avatar: userAvatar,
        comment: text,
        likes: 0,
      }).select().single();

      if (error) throw error;

      const newItem = { ...data, replies: [], is_verified: isUserVerified, content: data.comment };

      if (parentId) {
        setKomentar(prev => replaceItem(prev, tempId, newItem));
      } else {
        setKomentar(prev => prev.map(k => k.id === tempId ? newItem : k));
      }

      fetchCache.current.delete(`video_comments_${video.id}`);

      window.dispatchEvent(new CustomEvent('video-comment-changed', {
        detail: { videoId: video.id }
      }));

    } catch (err) {
      if (parentId) {
        setKomentar(prev => removeItem(prev, tempId));
      } else {
        setKomentar(prev => prev.filter(k => k.id !== tempId));
      }
      alert("Gagal kirim: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }, [input, submitting, user, video?.id, replyTo, insertReply, replaceItem, removeItem]);

  const handleLike = useCallback(async (id, isLiked) => {
    setLikedIds(prev => {
      const next = new Set(prev);
      if (isLiked) next.delete(id); else next.add(id);
      return next;
    });

    setKomentar(prev => {
      const update = (nodes) => nodes.map(n => ({
        ...n,
        likes: n.id === id ? Math.max(0, n.likes + (isLiked ? -1 : 1)) : n.likes,
        replies: update(n.replies || []),
      }));
      return update(prev);
    });

    try {
      await supabase.rpc(isLiked ? "decrement_video_comment_likes" : "increment_video_comment_likes", {
        comment_id: id,
      });
    } catch (err) {
      // Rollback on error
      setLikedIds(prev => {
        const next = new Set(prev);
        if (isLiked) next.add(id); else next.delete(id);
        return next;
      });
      console.error("Like error:", err);
    }
  }, []);

  if (!mounted || !isOpen) return null;

  const totalComments = komentar.reduce((total, item) => {
    const countReplies = (reply) => 1 + (reply.replies?.reduce((acc, r) => acc + countReplies(r), 0) || 0);
    return total + countReplies(item);
  }, 0);

  const modal = (
    <div className="fixed inset-0 z-[100000] flex items-end justify-center">
      <div
        className="absolute inset-0 bg-black/60"
        style={{ opacity: Math.max(0, 0.6 - translateY / 400) }}
        onClick={onClose}
      />

      <div
        ref={modalRef}
        className="relative w-full max-w-md bg-white rounded-t-3xl shadow-2xl flex flex-col"
        style={{
          height: "80dvh",
          transform: `translateY(${translateY}px)`,
          transition: isDragging ? "none" : "transform 0.3s ease-out",
          touchAction: isDragging ? "none" : "auto",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">💬</span>
            <div>
              <h2 className="text-[14px] font-bold text-slate-900">Komentar Video</h2>
              <p className="text-[11px] text-slate-400 line-clamp-1">{video?.judul?.slice(0, 50)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-bold text-slate-400">
              {totalComments} komentar
            </span>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 active:scale-95 transition-all"
            >
              ✕
            </button>
          </div>
        </div>

        <AnimatePresence>
          {replyTo && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex items-center justify-between px-4 py-2 bg-blue-50 border-b border-blue-100 flex-shrink-0 overflow-hidden"
            >
              <p className="text-[12px] text-blue-700">
                ↩️ Membalas <span className="font-bold">@{replyTo.username}</span>
              </p>
              <button
                onClick={() => { setReplyTo(null); setInput(""); }}
                className="text-[11px] text-blue-500 font-bold active:scale-95 transition-all"
              >
                Batal
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-[#E3655B] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : komentar.length === 0 ? (
            <div className="flex flex-col items-center py-12 gap-2">
              <span className="text-4xl">💬</span>
              <p className="text-[14px] font-bold text-slate-700">Belum ada komentar</p>
              <p className="text-[12px] text-slate-400">Jadi yang pertama diskusi!</p>
            </div>
          ) : (
            komentar.map(item => (
              <KomentarItem
                key={item.id}
                item={item}
                depth={0}
                onReply={(id, name, username) => setReplyTo({ id, name, username })}
                onLike={handleLike}
                onDelete={handleDelete}
                onReport={handleReport}
                likedIds={likedIds}
                canDelete={canDeleteItem(item)}
              />
            ))
          )}
          <div className="h-2" />
        </div>

        <div className="flex-shrink-0 border-t border-slate-100 px-3 py-3 bg-white">
          {!user ? (
            <div className="flex items-center gap-3 py-1 px-1">
              <div className="flex-1 bg-slate-100 rounded-full px-4 py-2.5">
                <span className="text-[13px] text-slate-400">Login untuk komentar...</span>
              </div>
              <button
                onClick={() => {
                  onClose();
                  setTimeout(() => document.dispatchEvent(new CustomEvent("open-auth-modal")), 300);
                }}
                className="flex-shrink-0 px-4 py-2.5 bg-[#E3655B] text-white rounded-full text-[12px] font-black active:scale-95 transition-all shadow-sm"
              >
                Login
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Avatar name={user.user_metadata?.full_name || user.email} avatar={user.user_metadata?.avatar_url} size={8} />
              <div className="flex-1 bg-slate-100 rounded-full px-4 py-2 focus-within:ring-2 focus-within:ring-[#E3655B]/30">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={replyTo ? `Balas @${replyTo.username}...` : "Tulis komentar..."}
                  className="w-full bg-transparent text-[14px] text-slate-900 focus:outline-none resize-none py-1 max-h-32"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                />
              </div>
              <button
                onClick={handleSubmit}
                disabled={!input.trim() || submitting}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95
                  ${input.trim() && !submitting
                    ? "bg-[#E3655B] text-white shadow-md"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"}`}
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
                  </svg>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}