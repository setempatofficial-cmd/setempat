"use client";

import { useEffect, useState, useRef } from "react";

export default function KomentarModal({ isOpen, onClose, tempat, initialComments = [] }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [likedComments, setLikedComments] = useState({});
  const [replyTo, setReplyTo] = useState(null);
  const modalContentRef = useRef(null);
  const startYRef = useRef(0);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (isOpen && tempat) {
      if (initialComments.length > 0) {
        const formatted = initialComments.map((c, idx) => ({
          id: c.id || idx,
          username: c.username || "warga_" + (idx + 1),
          content: c.content,
          time:
            c.time ||
            ["5 menit lalu", "10 menit lalu", "15 menit lalu", "30 menit lalu"][
            idx % 4
            ],
          likes: Math.floor(Math.random() * 15) + 5,
          replies: c.replies || [],
        }));
        setComments(formatted);
      } else {
        setComments([
          {
            id: 1,
            username: "budi",
            content: "Wifi cepet banget, enak buat nugas!",
            time: "5 menit lalu",
            likes: 12,
            replies: [
              { 
                id: 101,
                username: "ani", 
                content: "Setuju!", 
                time: "2 menit lalu",
                replies: []
              },
            ],
          },
          {
            id: 2,
            username: "citra",
            content: "Tempatnya nyaman, cocok buat kumpul",
            time: "10 menit lalu",
            likes: 8,
            replies: [],
          },
        ]);
      }
    }
  }, [isOpen, tempat, initialComments]);

  // Lock body scroll ketika modal terbuka
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
    } else {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    }

    return () => {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    };
  }, [isOpen]);

  // Handle touch start untuk deteksi swipe down
  const handleTouchStart = (e) => {
    const modalContent = modalContentRef.current;
    if (!modalContent) return;

    if (modalContent.scrollTop === 0) {
      startYRef.current = e.touches[0].clientY;
      isDraggingRef.current = true;
    }
  };

  // Handle touch move untuk swipe down
  const handleTouchMove = (e) => {
    if (!isDraggingRef.current) return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - startYRef.current;

    if (diff > 50) {
      isDraggingRef.current = false;
      onClose();
    }
  };

  // Handle touch end
  const handleTouchEnd = () => {
    isDraggingRef.current = false;
  };

  // Fungsi rekursif untuk menambah balasan
  const addReplyToComment = (comments, targetId, newReply) => {
    return comments.map(comment => {
      if (comment.id === targetId) {
        return {
          ...comment,
          replies: [...(comment.replies || []), newReply]
        };
      }
      
      // Cek di dalam replies
      if (comment.replies && comment.replies.length > 0) {
        return {
          ...comment,
          replies: addReplyToComment(comment.replies, targetId, newReply)
        };
      }
      
      return comment;
    });
  };

  const handleSubmit = () => {
    if (!newComment.trim()) return;

    const newReplyObj = {
      id: Date.now(),
      username: "kamu",
      content: newComment,
      time: "Baru saja",
      likes: 0,
      replies: [],
    };

    if (replyTo) {
      // Tambahkan balasan ke komentar atau balasan yang dituju
      setComments(prev => addReplyToComment(prev, replyTo.commentId, newReplyObj));
      setReplyTo(null);
    } else {
      // Tambahkan komentar baru
      const newCommentObj = {
        id: Date.now(),
        username: "kamu",
        content: newComment,
        time: "Baru saja",
        likes: 0,
        replies: [],
      };
      setComments((prev) => [newCommentObj, ...prev]);
    }

    setNewComment("");
  };

  const handleLike = (commentId) => {
    setLikedComments((prev) => ({
      ...prev,
      [commentId]: !prev[commentId],
    }));

    // Fungsi rekursif untuk update likes
    const updateLikes = (comments) => {
      return comments.map(c => {
        if (c.id === commentId) {
          return { ...c, likes: c.likes + (likedComments[commentId] ? -1 : 1) };
        }
        if (c.replies && c.replies.length > 0) {
          return { ...c, replies: updateLikes(c.replies) };
        }
        return c;
      });
    };

    setComments(prev => updateLikes(prev));
  };

  // Komponen untuk render komentar dan balasan secara rekursif
  const CommentItem = ({ comment, depth = 0 }) => {
    const maxDepth = 5; // Batasi kedalaman balasan
    const currentDepth = depth + 1;

    return (
      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <div className="flex items-center justify-center w-8 h-8 text-xs font-medium bg-gray-200 rounded-full flex-shrink-0">
            {comment.username[0]?.toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-medium">@{comment.username}</span>
              <span className="text-xs text-gray-400">{comment.time}</span>
            </div>
            <p className="mt-0.5 text-sm text-gray-700">{comment.content}</p>

            <div className="flex items-center gap-4 mt-2">
              <button
                onClick={() => handleLike(comment.id)}
                className={`flex items-center gap-1 text-xs transition-colors ${
                  likedComments[comment.id]
                    ? "text-[#E3655B]"
                    : "text-gray-400"
                }`}
              >
                <span className="text-sm">
                  {likedComments[comment.id] ? "❤️" : "🤍"}
                </span>
                <span>{comment.likes}</span>
              </button>
              <button
                onClick={() =>
                  setReplyTo({
                    commentId: comment.id,
                    username: comment.username,
                  })
                }
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
              >
                <span className="text-sm">💬</span>
                <span>Balas</span>
              </button>
            </div>
          </div>
        </div>

        {/* Render replies */}
        {comment.replies?.length > 0 && currentDepth <= maxDepth && (
          <div className={`mt-2 ml-8 space-y-3 pl-3 border-l-2 border-gray-100`}>
            {comment.replies.map((reply) => (
              <CommentItem key={reply.id} comment={reply} depth={currentDepth} />
            ))}
          </div>
        )}

        {/* Indikator jika terlalu dalam */}
        {comment.replies?.length > 0 && currentDepth > maxDepth && (
          <div className="ml-8 text-xs text-gray-400">
            ... balasan selengkapnya
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      <div 
        ref={modalContentRef}
        className="relative w-full max-w-md max-h-[80vh] overflow-y-auto bg-white rounded-t-2xl animate-slide-up sm:rounded-2xl"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <span className="text-lg text-[#E3655B]">💬</span>
            <div>
              <span className="font-semibold">Kata Warga</span>
              <p className="text-xs text-gray-400">{tempat?.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-xl text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {replyTo && (
          <div className="sticky top-[73px] flex items-center justify-between px-4 py-2 bg-blue-50 z-10">
            <p className="text-xs text-blue-600">
              Membalas @{replyTo.username}
            </p>
            <button
              onClick={() => setReplyTo(null)}
              className="text-xs text-blue-600 font-medium"
            >
              Batal
            </button>
          </div>
        )}

        <div className="p-4 space-y-4">
          {comments.length > 0 ? (
            comments.map((comment) => (
              <CommentItem key={comment.id} comment={comment} />
            ))
          ) : (
            <div className="py-8 text-center">
              <div className="flex items-center justify-center w-16 h-16 mx-auto mb-3 bg-gray-100 rounded-full">
                <span className="text-2xl text-gray-400">💬</span>
              </div>
              <p className="text-sm text-gray-500">Belum ada komentar</p>
              <p className="mt-1 text-xs text-gray-400">
                Jadi yang pertama kasih pendapat!
              </p>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t p-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={
                replyTo ? `Balas @${replyTo.username}...` : "Tulis komentar..."
              }
              className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#E3655B] focus:ring-opacity-50"
              onKeyPress={(e) => e.key === "Enter" && handleSubmit()}
            />
            <button
              onClick={handleSubmit}
              disabled={!newComment.trim()}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                newComment.trim()
                  ? "bg-[#E3655B] text-white shadow-sm"
                  : "bg-gray-200 text-gray-400"
              }`}
            >
              <span className="text-lg">➤</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}