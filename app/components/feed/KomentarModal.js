"use client";

import { useEffect, useState, useRef } from "react";

export default function KomentarModal({ isOpen, onClose, tempat, initialComments = [] }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [likedComments, setLikedComments] = useState({});
  const [replyTo, setReplyTo] = useState(null);
  const [expandedComments, setExpandedComments] = useState({});
  const [replyPages, setReplyPages] = useState({}); // Untuk pagination balasan
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  
  const modalContentRef = useRef(null);
  const contentRef = useRef(null);
  const inputRef = useRef(null);

  const INITIAL_REPLIES = 3; // Jumlah balasan awal yang ditampilkan
  const REPLIES_PER_PAGE = 4; // Jumlah balasan per halaman berikutnya

  useEffect(() => {
    if (isOpen && tempat) {
      if (initialComments.length > 0) {
        const formatted = initialComments.map((c, idx) => ({
          id: c.id || Date.now() + idx,
          username: c.username || "warga_" + (idx + 1),
          content: c.content,
          time: c.time || ["5 menit lalu", "10 menit lalu", "15 menit lalu", "30 menit lalu"][idx % 4],
          likes: c.likes || Math.floor(Math.random() * 15) + 5,
          isLiked: false,
          replies: c.replies || [],
          replyCount: c.replies?.length || 0,
        }));
        setComments(formatted);
      } else {
        // Data contoh dengan banyak balasan
        const sampleReplies = [];
        for (let i = 1; i <= 12; i++) {
          sampleReplies.push({
            id: 100 + i,
            username: `user_${i}`,
            content: `Ini adalah contoh balasan ke-${i} untuk demonstrasi fitur pagination`,
            time: `${i} menit lalu`,
            likes: Math.floor(Math.random() * 10),
            isLiked: false,
            replies: []
          });
        }

        setComments([
          {
            id: 1,
            username: "budi_utomo",
            content: "Wifi cepet banget! 50mbps, enak buat nugas dan meeting online 👍",
            time: "5 menit lalu",
            likes: 24,
            isLiked: false,
            replyCount: 12,
            replies: sampleReplies,
          },
          {
            id: 2,
            username: "citra_dewi",
            content: "Tempatnya nyaman banget, ada live music tiap malam minggu 🎵",
            time: "10 menit lalu",
            likes: 17,
            isLiked: false,
            replyCount: 5,
            replies: [
              {
                id: 201,
                username: "dian_permata",
                content: "Jam berapa mulai live music-nya kak?",
                time: "8 menit lalu",
                likes: 2,
                isLiked: false,
                replies: [
                  {
                    id: 2011,
                    username: "citra_dewi",
                    content: "Mulai jam 7 malam sampai selesai",
                    time: "7 menit lalu",
                    likes: 4,
                    isLiked: false,
                    replies: []
                  }
                ]
              }
            ],
          },
        ]);
      }
      
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [isOpen, tempat, initialComments]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
    } else {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
      setTranslateY(0);
    }

    return () => {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    };
  }, [isOpen]);

  // Handle touch untuk swipe down
  const handleTouchStart = (e) => {
    const modalContent = modalContentRef.current;
    if (!modalContent) return;

    if (modalContent.scrollTop <= 0) {
      setIsDragging(true);
      setStartY(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - startY;
    
    if (diff > 0) {
      e.preventDefault();
      setTranslateY(Math.min(diff, 150));
    }
  };

  const handleTouchEnd = () => {
    if (isDragging) {
      if (translateY > 80) {
        onClose();
      } else {
        setTranslateY(0);
      }
      setIsDragging(false);
    }
  };

  // Fungsi untuk toggle expand komentar
  const toggleExpandComment = (commentId) => {
    setExpandedComments(prev => ({
      ...prev,
      [commentId]: !prev[commentId]
    }));
    // Reset reply page ketika menutup
    if (expandedComments[commentId]) {
      setReplyPages(prev => ({
        ...prev,
        [commentId]: 1
      }));
    }
  };

  // Fungsi untuk load lebih banyak balasan
  const loadMoreReplies = (commentId) => {
    setReplyPages(prev => ({
      ...prev,
      [commentId]: (prev[commentId] || 1) + 1
    }));
  };

  // Fungsi untuk mendapatkan balasan yang ditampilkan berdasarkan halaman
  const getVisibleReplies = (replies, commentId) => {
    if (!replies) return [];
    
    const page = replyPages[commentId] || 1;
    const totalReplies = replies.length;
    
    if (page === 1) {
      // Halaman 1: tampilkan INITIAL_REPLIES
      return replies.slice(0, INITIAL_REPLIES);
    } else {
      // Halaman berikutnya: tampilkan lebih banyak
      const endIndex = INITIAL_REPLIES + (page - 1) * REPLIES_PER_PAGE;
      return replies.slice(0, endIndex);
    }
  };

  const addReplyToComment = (comments, targetId, newReply) => {
    return comments.map(comment => {
      if (comment.id === targetId) {
        const updatedReplies = [...(comment.replies || []), newReply];
        return {
          ...comment,
          replies: updatedReplies,
          replyCount: updatedReplies.length
        };
      }
      
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
      isLiked: false,
      replies: [],
    };

    if (replyTo) {
      setComments(prev => addReplyToComment(prev, replyTo.commentId, newReplyObj));
      
      // Auto expand dan load semua balasan setelah kirim
      setExpandedComments(prev => ({
        ...prev,
        [replyTo.commentId]: true
      }));
      
      // Load semua balasan dengan set page ke maksimum
      const comment = comments.find(c => c.id === replyTo.commentId);
      if (comment) {
        const maxPages = Math.ceil((comment.replies.length + 1 - INITIAL_REPLIES) / REPLIES_PER_PAGE) + 1;
        setReplyPages(prev => ({
          ...prev,
          [replyTo.commentId]: maxPages
        }));
      }
      
      setReplyTo(null);
    } else {
      const newCommentObj = {
        id: Date.now(),
        username: "kamu",
        content: newComment,
        time: "Baru saja",
        likes: 0,
        isLiked: false,
        replyCount: 0,
        replies: [],
      };
      setComments((prev) => [newCommentObj, ...prev]);
    }

    setNewComment("");
  };

  const handleLike = (commentId) => {
    const updateLikes = (comments) => {
      return comments.map(c => {
        if (c.id === commentId) {
          const newLikedState = !c.isLiked;
          return { 
            ...c, 
            isLiked: newLikedState,
            likes: c.likes + (newLikedState ? 1 : -1) 
          };
        }
        if (c.replies && c.replies.length > 0) {
          return { ...c, replies: updateLikes(c.replies) };
        }
        return c;
      });
    };

    setComments(prev => updateLikes(prev));
  };

  // Komponen ReplyItem
  const ReplyItem = ({ reply }) => {
    return (
      <div className="flex items-start gap-2">
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-gray-400 to-gray-500 text-white font-medium text-xs flex-shrink-0">
          {reply.username[0]?.toUpperCase()}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-800">
              @{reply.username}
            </span>
            <span className="text-[10px] text-gray-400">{reply.time}</span>
          </div>
          
          <p className="text-xs text-gray-700 leading-relaxed mt-0.5">
            {reply.content}
          </p>

          <div className="flex items-center gap-3 mt-1">
            <button
              onClick={() => handleLike(reply.id)}
              className={`flex items-center gap-1 text-xs transition-all ${
                reply.isLiked ? "text-[#E3655B]" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <span className="text-xs">{reply.isLiked ? "❤️" : "🤍"}</span>
              <span className="text-xs">{reply.likes}</span>
            </button>
            
            <button
              onClick={() =>
                setReplyTo({
                  commentId: reply.id,
                  username: reply.username,
                })
              }
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Balas
            </button>
          </div>

          {reply.replies && reply.replies.length > 0 && (
            <div className="mt-2 space-y-2">
              {reply.replies.map((nestedReply) => (
                <ReplyItem key={nestedReply.id} reply={nestedReply} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Komponen CommentItem
  const CommentItem = ({ comment }) => {
    const hasReplies = comment.replies?.length > 0;
    const isExpanded = expandedComments[comment.id];
    const visibleReplies = getVisibleReplies(comment.replies, comment.id);
    const currentPage = replyPages[comment.id] || 1;
    const totalReplies = comment.replies?.length || 0;
    const remainingReplies = totalReplies - visibleReplies.length;
    const hasMoreToShow = remainingReplies > 0;

    return (
      <div className="mb-6">
        {/* Komentar Utama */}
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-[#E3655B] to-[#c24b45] text-white font-medium text-sm flex-shrink-0">
            {comment.username[0]?.toUpperCase()}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-900">
                @{comment.username}
              </span>
              <span className="text-xs text-gray-500">{comment.time}</span>
            </div>
            
            <p className="mt-1 text-sm text-gray-800 leading-relaxed">
              {comment.content}
            </p>

            <div className="flex items-center gap-4 mt-2">
              <button
                onClick={() => handleLike(comment.id)}
                className={`flex items-center gap-1.5 text-sm transition-all ${
                  comment.isLiked
                    ? "text-[#E3655B]"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <span className="text-base">
                  {comment.isLiked ? "❤️" : "🤍"}
                </span>
                <span className="font-medium">{comment.likes}</span>
              </button>
              
              <button
                onClick={() =>
                  setReplyTo({
                    commentId: comment.id,
                    username: comment.username,
                  })
                }
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                <span className="text-base">💬</span>
                <span className="font-medium">Balas</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bagian Balasan */}
        {hasReplies && (
          <div className="mt-3 ml-4 pl-4 border-l-2 border-gray-200">
            {/* Tombol Lihat Balasan (hanya jika belum expand) */}
            {!isExpanded && (
              <button
                onClick={() => toggleExpandComment(comment.id)}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#E3655B] transition-colors mb-2"
              >
                <span className="text-base">▶️</span>
                <span>Lihat {totalReplies} balasan</span>
              </button>
            )}

            {/* Daftar Balasan (jika expand) */}
            {isExpanded && (
              <>
                <div className="space-y-3">
                  {visibleReplies.map((reply) => (
                    <ReplyItem key={reply.id} reply={reply} />
                  ))}
                </div>

                {/* Tombol Lihat Lebih Banyak (di tengah) */}
                {hasMoreToShow && (
                  <button
                    onClick={() => loadMoreReplies(comment.id)}
                    className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#E3655B] transition-colors mt-3"
                  >
                    <span className="text-base">🔽</span>
                    <span>Lihat {remainingReplies} balasan lainnya</span>
                  </button>
                )}

                {/* Tombol Sembunyikan Balasan (di bagian paling bawah) */}
                <button
                  onClick={() => toggleExpandComment(comment.id)}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#E3655B] transition-colors mt-3"
                >
                  <span className="text-base">🔼</span>
                  <span>Sembunyikan balasan</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div 
        className="absolute inset-0 bg-black/60 transition-opacity duration-300" 
        onClick={onClose} 
      />
      
      <div 
        ref={modalContentRef}
        className="relative w-full max-w-md h-full sm:h-[90vh] bg-white rounded-t-2xl sm:rounded-2xl shadow-xl transition-transform duration-200 ease-out"
        style={{
          transform: `translateY(${translateY}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag indicator */}
        <div className="sticky top-0 z-20 flex justify-center pt-2 pb-1 bg-white rounded-t-2xl">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="sticky top-[10px] z-10 bg-white px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#E3655B]/10 flex items-center justify-center">
                <span className="text-lg text-[#E3655B]">💬</span>
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  Kata Warga
                </h2>
                <p className="text-xs text-gray-600">
                  {tempat?.name || 'Tempat'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
            >
              <span className="text-xl text-gray-600">✕</span>
            </button>
          </div>
        </div>

        {/* Reply indicator */}
        {replyTo && (
          <div className="sticky top-[88px] z-10 flex items-center justify-between px-4 py-3 bg-blue-50 border-b border-blue-100">
            <div className="flex items-center gap-2">
              <span className="text-blue-500">↩️</span>
              <p className="text-sm text-blue-700">
                Membalas <span className="font-semibold">@{replyTo.username}</span>
              </p>
            </div>
            <button
              onClick={() => setReplyTo(null)}
              className="text-sm text-blue-600 font-medium hover:text-blue-800"
            >
              Batal
            </button>
          </div>
        )}

        {/* Comments container */}
        <div 
          ref={contentRef}
          className="overflow-y-auto"
          style={{ 
            height: replyTo 
              ? 'calc(100vh - 240px)' 
              : 'calc(100vh - 200px)'
          }}
        >
          <div className="p-4 space-y-4">
            {comments.length > 0 ? (
              comments.map((comment) => (
                <CommentItem key={comment.id} comment={comment} />
              ))
            ) : (
              <div className="py-12 text-center">
                <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                  <span className="text-3xl text-gray-400">💬</span>
                </div>
                <p className="text-gray-800 font-medium mb-1">
                  Belum ada komentar
                </p>
                <p className="text-sm text-gray-500">
                  Jadi yang pertama kasih pendapat!
                </p>
              </div>
            )}
            
            <div className="h-4" />
          </div>
        </div>

        {/* Input section */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 focus-within:ring-2 focus-within:ring-[#E3655B] focus-within:ring-opacity-50">
              <input
                ref={inputRef}
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={
                  replyTo ? `Balas @${replyTo.username}...` : "Tulis komentar..."
                }
                className="w-full bg-transparent text-sm text-gray-900 placeholder-gray-500 focus:outline-none"
                onKeyPress={(e) => e.key === "Enter" && handleSubmit()}
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={!newComment.trim()}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                newComment.trim()
                  ? "bg-[#E3655B] text-white shadow-sm hover:bg-[#c24b45]"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
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