"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import LocationProvider, { useLocation } from "./components/LocationProvider";
import { calculateDistance } from "./lib/distance";
import { getGreeting } from "./lib/greeting";
import { generateMoment } from "./lib/momentEngine";
import { calculateScore } from "../lib/ranking";
import { generateHeadline } from "../lib/headlineEngine";

const LIMIT = 10;

// Komponen PhotoSlider
function PhotoSlider({
  photos,
  itemId,
  selectedPhotoIndex,
  setSelectedPhotoIndex,
  estimasiOrang,
  itemDistance,
  commentCount,
  locationReady,
  isRamai,
  isViral,
  isHits,
  isDekat,
  isBaru,
}) {
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe || isRightSwipe) {
      const photosLength = photos.length;
      let newIndex = selectedPhotoIndex;

      if (isLeftSwipe) {
        newIndex = (selectedPhotoIndex + 1) % photosLength;
      } else if (isRightSwipe) {
        newIndex = (selectedPhotoIndex - 1 + photosLength) % photosLength;
      }

      setSelectedPhotoIndex((prev) => ({
        ...prev,
        [itemId]: newIndex,
      }));
    }
  };

  return (
    <>
      <div
        className="relative h-80 mb-2 overflow-hidden rounded-xl"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <img
          src={typeof photos[selectedPhotoIndex] === 'string'
            ? photos[selectedPhotoIndex]
            : photos[selectedPhotoIndex]?.url}
          alt={`Slide ${selectedPhotoIndex + 1}`}
          className="object-cover w-full h-full"
        />
        {/* BADGE DI DALAM FOTO - PRIORITAS MAKSIMAL 2 */}
        <div className="absolute top-2 left-0 flex flex-col gap-1 z-20 max-w-[90%]">
          {(() => {
            // Kumpulkan badge berdasarkan prioritas
            const badges = [];

            // Prioritas utama: Viral > Ramai > Hits
            if (isViral) badges.push({ label: '⚡ Sedang Viral Sejam lalu', color: 'bg-purple-500' });
            else if (isRamai) badges.push({ label: '🔥 Lagi Ramai Saat Ini', color: 'bg-red-500' });
            else if (isHits) badges.push({ label: '📱 Hits Jam Ini', color: 'bg-orange-500' });

            // Tambahkan Dekat jika masih ada slot (<2)
            if (isDekat && badges.length < 2) {
              badges.push({ label: '📍 Di Dekat Anda', color: 'bg-blue-500' });
            }

            // Tambahkan Baru jika masih ada slot (<2)
            if (isBaru && badges.length < 2) {
              badges.push({ label: '🟢 Baru Saja', color: 'bg-green-400' });
            }

            // Render badge
            return badges.map((badge, idx) => (
              <span key={idx} className={`pl-2 pr-3 py-1 text-[10px] font-bold text-white ${badge.color} rounded-r-full shadow-lg truncate`}>
                {badge.label}
              </span>
            ));
          })()}
        </div>

        {photos.length > 1 && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
            {photos.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all ${idx === selectedPhotoIndex
                  ? "w-4 bg-[#E3655B]"
                  : "w-1.5 bg-white/70"
                  }`}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// MODAL untuk Tanya AI Setempat
function AIModal({ isOpen, onClose, tempat }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    if (isOpen && tempat) {
      setMessages([
        {
          id: 1,
          type: "ai",
          text: `Halo! Saya AI Setempat. Mau tanya apa tentang ${tempat.name}?`,
          time: "Baru saja",
        },
      ]);
    }
  }, [isOpen, tempat]);

  if (!isOpen) return null;

  const handleSend = () => {
    if (!input.trim()) return;

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        type: "user",
        text: input,
        time: "Baru saja",
      },
    ]);

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          type: "ai",
          text: "Maaf, fitur AI masih dalam pengembangan. Nanti akan bisa jawab pertanyaan tentang jam buka, antrian, promo, dan lainnya!",
          time: "Baru saja",
        },
      ]);
    }, 1000);

    setInput("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[80vh] overflow-hidden bg-white rounded-t-2xl animate-slide-up sm:rounded-2xl">
        <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl text-[#E3655B]">🤖</span>
            <div>
              <span className="font-semibold">Tanya AI Setempat</span>
              <p className="text-xs text-gray-400">{tempat?.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-xl text-gray-400">
            ✕
          </button>
        </div>

        <div className="h-96 p-4 space-y-4 overflow-y-auto">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-2 ${msg.type === "user" ? "flex-row-reverse" : ""
                }`}
            >
              {msg.type === "ai" && (
                <div className="flex items-center justify-center w-8 h-8 bg-opacity-10 rounded-full bg-[#E3655B] flex-shrink-0">
                  <span className="text-[#E3655B]">🤖</span>
                </div>
              )}
              <div
                className={`max-w-[80%] ${msg.type === "user"
                  ? "bg-[#E3655B] text-white"
                  : "bg-gray-100"
                  } rounded-2xl p-3`}
              >
                <p className="text-sm">{msg.text}</p>
                <p
                  className={`text-xs mt-1 ${msg.type === "user" ? "text-white/70" : "text-gray-400"
                    }`}
                >
                  {msg.time}
                </p>
              </div>
            </div>
          ))}

          {messages.length === 1 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-gray-400">Pertanyaan cepat:</p>
              <div className="flex flex-wrap gap-2">
                {[
                  "Jam operasional?",
                  "Lagi antrian?",
                  "Info parkir",
                  "Live music?",
                ].map((q, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInput(q);
                      setTimeout(() => handleSend(), 100);
                    }}
                    className="px-3 py-2 text-xs bg-gray-100 rounded-full hover:bg-gray-200"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t p-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tanya sesuatu..."
              className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#E3655B] focus:ring-opacity-50"
              onKeyPress={(e) => e.key === "Enter" && handleSend()}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${input.trim()
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

// MODAL untuk Kata Warga
function KomentarModal({ isOpen, onClose, tempat, initialComments = [] }) {
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

// Konten Feed yang menggunakan useLocation
function FeedContent() {
  const { location, status, placeName, requestLocation } = useLocation();
  const [tempat, setTempat] = useState([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [comments, setComments] = useState({});
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState({});
  const [initialLoad, setInitialLoad] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const [selectedTempat, setSelectedTempat] = useState(null);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showKomentarModal, setShowKomentarModal] = useState(false);
  const [error, setError] = useState(null);
  const [manualLocationOff, setManualLocationOff] = useState(false);

  const greeting = getGreeting();
  const locationReady = (status === "granted" && location) && !manualLocationOff;
  const currentHour = new Date().getHours();
  const displayLocation =
    locationReady && placeName ? placeName.split(",")[0] : null;

  const handleRequestLocation = () => {
    setManualLocationOff(false);
    requestLocation();
  };

  const disableLocation = () => {
    setManualLocationOff(true);
  };

  // Deteksi scroll
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const getAlamatSingkat = (alamat) => {
    if (!alamat) return "";
    const parts = alamat.split(",").map((p) => p.trim());
    return parts.length >= 2 ? `${parts[0]}, ${parts[1]}` : alamat;
  };

  const loadPlaces = useCallback(
    async (reset = false) => {
      if (loading) return;

      setLoading(true);
      setError(null);

      try {
        const currentPage = reset ? 0 : page;
        const from = currentPage * LIMIT;
        const to = from + LIMIT - 1;

        const { data, error } = await supabase
          .from("feed_view")
          .select("*")
          .range(from, to);

        if (error) throw error;

        let items = data || [];

        // Hitung lastActivity
        const twoDaysAgo = new Date();
        twoDaysAgo.setHours(twoDaysAgo.getHours() - 48);

        items = items.map((item) => {
          const timestamps = [];

          if (item.testimonial_terbaru?.length) {
            timestamps.push(
              new Date(item.testimonial_terbaru[0].created_at).getTime()
            );
          }
          if (item.laporan_terbaru?.length) {
            timestamps.push(
              new Date(item.laporan_terbaru[0].created_at).getTime()
            );
          }
          if (item.medsos_terbaru?.length) {
            timestamps.push(
              new Date(item.medsos_terbaru[0].posted_at).getTime()
            );
          }

          if (timestamps.length === 0) {
            timestamps.push(new Date(item.created_at).getTime());
          }

          const lastActivity = new Date(Math.max(...timestamps));
          return { ...item, lastActivity };
        });

        // Filter aktivitas 48 jam terakhir
        let filteredItems = items.filter(
          (item) => item.lastActivity > twoDaysAgo
        );

        // Jika hasil filter kosong, gunakan semua item (tanpa filter waktu)
        items = filteredItems.length > 0 ? filteredItems : items;

        // Hitung score untuk setiap item
        items = items.map((item) => ({
          ...item,
          score: calculateScore(item, location),
        }));

        if (locationReady && items.length > 0 && location) {
          items = items
            .map((item) => {
              if (item.latitude && item.longitude) {
                const distance = calculateDistance(
                  location.latitude,
                  location.longitude,
                  item.latitude,
                  item.longitude
                );
                return { ...item, distance };
              }
              return { ...item, distance: Infinity };
            })
            .sort((a, b) => {
              // Kombinasi jarak (60%) dan score (40%)
              const scoreA =
                a.score * 0.4 + (1 / (a.distance || 10)) * 0.6;
              const scoreB =
                b.score * 0.4 + (1 / (b.distance || 10)) * 0.6;
              return scoreB - scoreA;
            });
        } else {
          items.sort((a, b) => b.score - a.score);
        }

        const commentsMap = {};
        items.forEach((item) => {
          commentsMap[item.id] = item.testimonial_terbaru || [];
        });
        setComments((prev) => ({ ...prev, ...commentsMap }));

        setTempat((prev) => (reset ? items : [...prev, ...items]));
        setPage(currentPage + 1);
        setHasMore(items.length === LIMIT);
      } catch (error) {
        console.error("Error loading places:", error);
        setError(error.message);
      } finally {
        setLoading(false);
        setInitialLoad(false);
      }
    },
    [location, locationReady, page, loading]
  );

  useEffect(() => {
    loadPlaces(true);
  }, [locationReady]);

  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >=
        document.body.offsetHeight - 500 &&
        !loading &&
        hasMore
      ) {
        loadPlaces();
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loading, hasMore, loadPlaces]);

  const openAIModal = (item) => {
    setSelectedTempat(item);
    setShowAIModal(true);
  };

  const openKomentarModal = (item) => {
    setSelectedTempat(item);
    setShowKomentarModal(true);
  };

  const closeModals = () => {
    setShowAIModal(false);
    setShowKomentarModal(false);
    setSelectedTempat(null);
  };

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return "Baru saja";
    const now = new Date();
    const past = new Date(timestamp);
    const diffMins = Math.floor((now - past) / 60000);
    if (diffMins < 1) return "Baru saja";
    if (diffMins < 60) return `${diffMins} menit lalu`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} jam lalu`;
    return `${Math.floor(diffMins / 1440)} hari lalu`;
  };

  // Fungsi untuk memilih foto berdasarkan waktu saat ini
  const getFotoByWaktu = (photos, currentHour) => {
    if (!photos || photos.length === 0) return null;

    // Tentukan kategori waktu
    let kategoriWaktu = 'siang'; // default
    if (currentHour >= 4 && currentHour < 11) kategoriWaktu = 'pagi';
    else if (currentHour >= 11 && currentHour < 15) kategoriWaktu = 'siang';
    else if (currentHour >= 15 && currentHour < 18) kategoriWaktu = 'sore';
    else kategoriWaktu = 'malam';

    // Cari foto dengan waktu yang sesuai
    const fotoSesuai = photos.find(foto => foto.waktu === kategoriWaktu);

    // Jika tidak ada, cari foto tanpa waktu (format lama) atau ambil pertama
    if (fotoSesuai) return fotoSesuai.url || fotoSesuai;

    // Handle format lama (array of strings)
    if (typeof photos[0] === 'string') return photos[0];

    // Fallback ke foto pertama
    return photos[0]?.url || photos[0];
  };

  const getUserAreaFromNearestPlace = (places, userLocation) => {
    if (!places.length || !userLocation) return null;
    const nearestPlace = places[0];
    if (nearestPlace.distance > 5) return null;
    const parts = nearestPlace.alamat.split(",").map((p) => p.trim());
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].includes("Kec.") || parts[i].includes("Kecamatan")) {
        return parts[i].replace("Kec.", "").replace("Kecamatan", "").trim();
      }
    }
    return parts[1] || parts[0];
  };

  // Fungsi hash sederhana
  const simpleHash = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  };

  // Fungsi untuk judul cadangan yang variatif
  const getFallbackTitle = (item, alamatSingkat, displayLocation) => {
    const kategori = item.kategori || 'tempat';
    const parts = alamatSingkat.split(',');
    const area = parts.length > 1 ? parts[1].trim() : (displayLocation || 'sekitar');

    // Tentukan waktu berdasarkan currentHour
    const hour = currentHour;
    const waktuStr =
      hour >= 18 || hour < 4
        ? "malam"
        : hour < 11
          ? "pagi"
          : hour < 15
            ? "siang"
            : "sore";

    const templates = [
      `🍵 Banyak Pengunjung sedang Menikmati ${waktuStr}`,
      `👥 ${waktuStr} Ramai Dipenuhi Warga`,
      `🌙 ${waktuStr} Ini Baru Mulai Rame`,
      `🍜 Warga Antre beli Takjil`,
      `📸 Saat ini Banyak yang Foto-foto di sini`,
      `🎵 Lagi Ada Hiburan musik Akustik`,
      `☕ Banyak Pengunjung Luar Kota ${waktuStr} Ini`,
      `🌅 Pemandangan ${waktuStr} Lagi Cerah`,
      `🚶 Banyak Pengunjung yang lalu lalang`,
      `💬 Lagi ada Acara Diskusi hangat`,
      `⚡ ${waktuStr} Ramai Pengunjung`,
      `🎉 Lokasi ${waktuStr} Sedang Tenang`,
    ];

    // Gunakan hash dari item.id untuk indeks tetap
    const hash = simpleHash(String(item.id));
    const index = hash % templates.length;
    return templates[index];
  };

  // Tampilkan error jika ada
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="text-center">
          <p className="text-red-500 mb-2">Error: {error}</p>
          <button
            onClick={() => loadPlaces(true)}
            className="px-4 py-2 bg-[#E3655B] text-white rounded-lg"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="relative min-h-screen max-w-md mx-auto pb-20 bg-[#F9F7F7]">
      {/* HEADER */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div
          className={`transition-all duration-300 ease-in-out overflow-hidden ${isScrolled ? "max-h-0 opacity-0" : "max-h-[140px] opacity-100"
            }`}
        >
          <div className="px-4 pt-3 pb-2">
            {/* Baris 1: Logo di tengah + lokasi/suhu (kanan) */}
            <div className="flex items-center justify-between">
              <div className="w-[60px]"></div>
              <div className="flex items-center justify-center gap-1">
                <svg
                  className="w-4 h-4 text-[#E3655B]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span className="text-sm font-semibold text-[#1C2C3C] tracking-tight">
                  Setempat.id
                </span>
              </div>
              {locationReady && displayLocation ? (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <span>
                    {new Date().getHours() >= 4 && new Date().getHours() < 18
                      ? "🌤️"
                      : "🌙"}
                  </span>
                  <span>
                    {getUserAreaFromNearestPlace(tempat, location) ||
                      displayLocation}{" "}
                    29°
                  </span>
                </div>
              ) : (
                <div className="w-[60px]"></div>
              )}
            </div>

            {/* Baris 2: Greeting */}
            <div className="mt-2 mb-4 text-center">
              {locationReady ? (
                <div className="space-y-1">
                  <p className="text-2xl font-semibold text-gray-800">
                    {greeting.text}
                  </p>
                  <p className="text-base text-gray-600">
                    {generateMoment(
                      tempat,
                      getUserAreaFromNearestPlace(tempat, location) ||
                      displayLocation ||
                      "sekitar",
                      currentHour
                    ).text}
                  </p>
                </div>
              ) : (
                <button
                  onClick={requestLocation}
                  className="text-base text-gray-500 hover:text-[#E3655B] transition-colors font-medium"
                >
                  Aktifkan Lokasi Untuk Lihat Sekitar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* SEARCH BAR */}
        <div className="px-4 pb-3 pt-1">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
              <svg
                className="w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              type="text"
              placeholder={
                locationReady && displayLocation
                  ? `Cari sesuatu di sekitar ${displayLocation}...`
                  : "Cari sesuatu di sekitar Anda..."
              }
              className="w-full bg-gray-100 rounded-full py-2.5 pl-12 pr-24 text-sm text-gray-600 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#E3655B] focus:ring-opacity-50 transition-all"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-2">
              {locationReady ? (
                <button
                  onClick={disableLocation}
                  className="px-3 py-1 text-xs font-medium text-white bg-green-500 rounded-full hover:bg-green-600 transition-colors"
                >
                  ON
                </button>
              ) : (
                <button
                  onClick={handleRequestLocation}
                  className="px-3 py-1 text-xs font-medium text-white bg-[#E3655B] rounded-full hover:bg-[#d54e44] transition-colors"
                >
                  OFF
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* INFO BAR - REKOMENDASI WARGA SETEMPAT */}
      {locationReady && (
        <div className="px-4 py-4 border-b border-gray-100 bg-gradient-to-r from-[#E3655B]/5 via-white to-[#E3655B]/5 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-3">
              <div className="w-6 h-px bg-gradient-to-r from-transparent to-gray-300"></div>
              <span className="text-xs font-medium tracking-[0.2em] text-gray-400">
                Laporan Warga {displayLocation} Saat Ini
              </span>
              <div className="w-6 h-px bg-gradient-to-l from-transparent to-gray-300"></div>
            </div>

            <div className="flex items-center justify-center gap-6">
              {tempat.filter((t) => parseInt(t.estimasi_orang) > 20).length >
                0 && (
                  <div className="flex flex-col items-center">
                    <span className="text-2xl filter drop-shadow-lg text-[#E3655B] animate-pulse">
                      🔥
                    </span>
                    <span className="text-xs font-semibold text-gray-700 mt-1">
                      {
                        tempat.filter((t) => parseInt(t.estimasi_orang) > 20)
                          .length
                      }{" "}
                      Sedang Ramai
                    </span>
                  </div>
                )}

              {locationReady &&
                tempat.filter((t) => t.distance && t.distance < 1).length >
                0 && (
                  <div className="flex flex-col items-center">
                    <span className="text-2xl filter drop-shadow-lg text-blue-400 animate-bounce">
                      ⚡
                    </span>
                    <span className="text-xs font-semibold text-gray-700 mt-1">
                      {
                        tempat.filter((t) => t.distance && t.distance < 1)
                          .length
                      }{" "}
                      Dekat Anda
                    </span>
                  </div>
                )}

              {tempat.filter(
                (t) => (t.testimonial_terbaru?.length || 0) > 3
              ).length > 0 && (
                  <div className="flex flex-col items-center">
                    <span className="text-2xl filter drop-shadow-lg text-purple-400 animate-pulse">
                      💬
                    </span>
                    <span className="text-xs font-semibold text-gray-700 mt-1">
                      {
                        tempat.filter(
                          (t) => (t.testimonial_terbaru?.length || 0) > 3
                        ).length
                      }{" "}
                      Lagi Viral
                    </span>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}

      {/* FEED */}
      <div className="px-4 space-y-4">
        {initialLoad && loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm animate-pulse"
              >
                <div className="h-48 bg-gray-200"></div>
                <div className="p-4 space-y-3">
                  <div className="h-5 bg-gray-200 rounded w-1/3"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : tempat.length === 0 && !loading ? (
          <div className="text-center py-8">
            <p className="text-gray-500">
              Tidak ada tempat dengan aktivitas terbaru
            </p>
          </div>
        ) : (
          tempat.map((item, index) => {
            const aktivitas = item.aktivitas_terkini || [];
            const medsos = item.medsos_terbaru || [];
            const laporan = item.laporan_terbaru || [];
            const testimonial = item.testimonial_terbaru || [];
            const externalSignals = item.external_signals_terbaru || [];
            const externalCount = externalSignals.length;

            const aktivitasUtama =
              aktivitas.length > 0 ? aktivitas[0] : null;
            const suasana = laporan.find(
              (l) => l.tipe === "keramaian" || l.tipe === "suasana"
            );
            const antrian = laporan.find((l) => l.tipe === "antrian");
            const testimonialTerbaru =
              testimonial.length > 0 ? testimonial[0] : null;
            const medsosTerbaru = medsos.length > 0 ? medsos[0] : null;

            const alamatSingkat = getAlamatSingkat(item.alamat);
            const estimasiOrang = parseInt(item.estimasi_orang) || 0;

            // Hitung agregat dari external signals
            let totalLikes = 0;
            let totalComments = 0;
            let totalConfidence = 0;

            externalSignals.forEach((s) => {
              totalLikes += s.likes_count || 0;
              totalComments += s.comments_count || 0;
              totalConfidence += s.confidence || 0;
            });

            const avgConfidence =
              externalCount > 0 ? totalConfidence / externalCount : 0;

            // Cari external signal dengan komentar terbanyak untuk kutipan
            const topExternalComment = externalSignals
              .filter((s) => s.content && s.content.length > 0)
              .sort(
                (a, b) => (b.comments_count || 0) - (a.comments_count || 0)
              )[0];

            // ===== LOGIKA BADGE GABUNGAN =====
            const isRamai = estimasiOrang > 20 || externalCount > 5;
            const isViral =
              (comments[item.id]?.length || 0) > 5 ||
              totalLikes > 100 ||
              totalComments > 20;
            const isHits = externalCount > 2 && avgConfidence > 0.9;
            const isDekat = locationReady && item.distance && item.distance < 1;
            const isBaru = (() => {
              const last = item.lastActivity ? new Date(item.lastActivity) : null;
              return last && Date.now() - last < 30 * 60 * 1000;
            })();

            const headline = generateHeadline({
              item,
              estimasiOrang,
              antrian,
              fallbackFn: (item) =>
                getFallbackTitle(item, alamatSingkat, displayLocation),
            });

            const photos = item.photos ||
              (item.image_url ? [item.image_url] : [
                "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=500",
                "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=500",
                "https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=500",
              ]);

            const currentPhotoIndex = selectedPhotoIndex[item.id] || 0;

            // Tentukan kategori waktu
            let kategoriWaktu = 'siang';
            if (currentHour >= 4 && currentHour < 11) kategoriWaktu = 'pagi';
            else if (currentHour >= 11 && currentHour < 15) kategoriWaktu = 'siang';
            else if (currentHour >= 15 && currentHour < 18) kategoriWaktu = 'sore';
            else kategoriWaktu = 'malam';

            // Urutkan foto agar yang sesuai waktu di awal
            const sortedPhotos = [...photos].sort((a, b) => {
              const waktuA = a.waktu || 'siang';
              const waktuB = b.waktu || 'siang';
              if (waktuA === kategoriWaktu) return -1;
              if (waktuB === kategoriWaktu) return 1;
              return 0;
            });

            return (
              <div
                key={`${item.id}-${index}`}
                className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm"
              >
                <div className="px-4 mt-3">
                  <PhotoSlider
                    photos={sortedPhotos}
                    itemId={item.id}
                    selectedPhotoIndex={currentPhotoIndex}
                    setSelectedPhotoIndex={setSelectedPhotoIndex}
                    estimasiOrang={estimasiOrang}
                    itemDistance={item.distance}
                    commentCount={comments[item.id]?.length || 0}
                    locationReady={locationReady}
                    isRamai={isRamai}
                    isViral={isViral}
                    isHits={isHits}
                    isDekat={isDekat}
                    isBaru={isBaru}
                  />
                </div>

                <div className="px-4 pt-4">
                  {/* Judul */}
                  <div className="flex items-start gap-2">
                    <span className="text-2xl">{headline.icon}</span>
                    <p className="flex-1 text-lg font-semibold text-[#2D2D2D]">
                      {headline.text}
                    </p>
                  </div>

                  {/* Nama tempat */}
                  <div className="flex items-center gap-1 mt-1 ml-8">
                    <span className="text-sm font-medium text-[#E3655B]">
                      {item.name}
                    </span>
                    <span className="text-xs text-gray-400">
                      • {alamatSingkat}
                    </span>
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center gap-1 mt-2 ml-8 text-xs text-gray-400">
                    {locationReady && item.distance && (
                      <span>
                        📍{" "}
                        {item.distance < 1
                          ? `${Math.round(item.distance * 1000)}m`
                          : `${item.distance.toFixed(1)}km`}
                      </span>
                    )}
                    <span>🕒 {formatTimeAgo(item.updated_at || item.created_at)}</span>
                    {estimasiOrang > 0 && (
                      <span>• 👥 {estimasiOrang} orang di Lokasi </span>
                    )}

                    {/* INDIKATOR HIDUP */}
                    {(() => {
                      const lastActivity = item.lastActivity
                        ? new Date(item.lastActivity)
                        : null;
                      if (
                        lastActivity &&
                        Date.now() - lastActivity < 30 * 60 * 1000
                      ) {
                        return (
                          <span className="ml-2 text-green-600 font-medium text-[10px]">
                            🟢 Lagi Ramai
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  {/* Testimoni / Info tambahan */}
                  <div className="mt-3 ml-8 space-y-2">
                    {testimonialTerbaru && !aktivitasUtama && (
                      <p className="text-sm text-gray-600 italic border-l-2 border-gray-200 pl-2">
                        "{testimonialTerbaru.content}"
                      </p>
                    )}
                    {medsosTerbaru && !aktivitasUtama && !testimonialTerbaru && (
                      <p className="text-sm text-gray-600 border-l-2 border-gray-200 pl-2">
                        📱 {medsosTerbaru.content}
                      </p>
                    )}
                    {/* External signal teratas */}
                    {topExternalComment && !aktivitasUtama && (
                      <div className="flex items-start gap-2">
                        <span className="text-purple-400 text-sm mt-0.5">
                          📱
                        </span>
                        <div className="flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs font-medium">
                              @{topExternalComment.username}
                            </span>
                            <span className="text-xs text-gray-400">
                              {formatTimeAgo(topExternalComment.created_at)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 italic">
                            "{topExternalComment.content}"
                          </p>
                        </div>
                      </div>
                    )}
                    {suasana && (
                      <p className="text-xs text-gray-500">{suasana.deskripsi}</p>
                    )}
                  </div>

                  {/* Tombol aksi */}
                  <div className="flex items-center justify-between px-4 pt-3 pb-5 mt-2 border-t border-gray-100">
                    <button
                      onClick={() => openAIModal(item)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-full hover:bg-gray-200"
                    >
                      <span className="text-base">🤖</span> Tanya AI Setempat
                    </button>
                    <button
                      onClick={() => openKomentarModal(item)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-full hover:bg-gray-200"
                    >
                      <span className="text-base">💬</span>{" "}
                      <span>{comments[item.id]?.length || 0}</span> Suara Warga
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {loading && !initialLoad && (
          <div className="py-4 text-center">
            <div className="inline-block w-6 h-6 border-2 border-gray-300 rounded-full animate-spin border-t-[#E3655B]"></div>
            <p className="mt-2 text-xs text-gray-400">Memuat...</p>
          </div>
        )}

        {!loading && !hasMore && tempat.length > 0 && (
          <p className="py-4 text-sm text-center text-gray-400">
            Tidak ada tempat lagi
          </p>
        )}
      </div>

      <AIModal
        isOpen={showAIModal}
        onClose={closeModals}
        tempat={selectedTempat}
      />
      <KomentarModal
        isOpen={showKomentarModal}
        onClose={closeModals}
        tempat={selectedTempat}
        initialComments={
          selectedTempat ? comments[selectedTempat.id] || [] : []
        }
      />
    </main>
  );
}

// Komponen utama yang diekspor
export default function Feed() {
  return (
    <LocationProvider>
      <FeedContent />
    </LocationProvider>
  );
}