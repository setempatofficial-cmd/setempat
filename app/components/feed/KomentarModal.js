"use client";

import { useEffect, useState } from "react";

export default function KomentarModal({ isOpen, onClose, tempat, initialComments = [] }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [likedComments, setLikedComments] = useState({});
  const [replyTo, setReplyTo] = useState(null);

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
          replies: [],
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
              { username: "ani", content: "Setuju!", time: "2 menit lalu" },
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

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!newComment.trim()) return;

    if (replyTo) {
      setComments((prev) =>
        prev.map((c) =>
          c.id === replyTo.commentId
            ? {
              ...c,
              replies: [
                ...(c.replies || []),
                {
                  username: "kamu",
                  content: newComment,
                  time: "Baru saja",
                },
              ],
            }
            : c
        )
      );
      setReplyTo(null);
    } else {
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

    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? { ...c, likes: c.likes + (likedComments[commentId] ? -1 : 1) }
          : c
      )
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[80vh] overflow-hidden bg-white rounded-t-2xl animate-slide-up sm:rounded-2xl">
        <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
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
          <div className="flex items-center justify-between px-4 py-2 bg-blue-50">
            <p className="text-xs text-blue-600">Membalas @{replyTo.username}</p>
            <button
              onClick={() => setReplyTo(null)}
              className="text-xs text-blue-600"
            >
              Batal
            </button>
          </div>
        )}

        <div className="h-96 p-4 space-y-4 overflow-y-auto">
          {comments.length > 0 ? (
            comments.map((comment) => (
              <div key={comment.id} className="space-y-2">
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
                        className={`flex items-center gap-1 text-xs transition-colors ${likedComments[comment.id]
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

                {comment.replies?.length > 0 && (
                  <div className="mt-2 ml-8 space-y-3 pl-3 border-l-2 border-gray-100">
                    {comment.replies.map((reply, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <div className="flex items-center justify-center w-6 h-6 text-xs font-medium bg-gray-100 rounded-full flex-shrink-0">
                          {reply.username[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs font-medium">
                              @{reply.username}
                            </span>
                            <span className="text-xs text-gray-400">
                              {reply.time}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600">{reply.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${newComment.trim()
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