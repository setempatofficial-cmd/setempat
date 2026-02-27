"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import LocationProvider, { useLocation } from "./components/LocationProvider";
import { calculateDistance } from "./lib/distance";
import { getGreeting } from "./lib/greeting";
import { generateMoment } from "./lib/momentEngine";

const LIMIT = 10;

// Komponen PhotoSlider terpisah untuk menghindari hook di dalam render
function PhotoSlider({ photos, itemId, selectedPhotoIndex, setSelectedPhotoIndex }) {
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
      {/* FOTO UTAMA dengan SWIPE */}
      <div
        className="relative h-64 mb-2 overflow-hidden rounded-xl"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <img
          src={photos[selectedPhotoIndex]}
          alt={`Slide ${selectedPhotoIndex + 1}`}
          className="object-cover w-full h-full"
        />

        {/* DOTS INDICATOR */}
        {photos.length > 1 && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
            {photos.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all ${
                  idx === selectedPhotoIndex
                    ? "w-4 bg-[#E3655B]"
                    : "w-1.5 bg-white/70"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* THUMBNAIL KECIL */}
      {photos.length > 1 && (
        <div className="flex gap-2 pb-1 overflow-x-auto scrollbar-hide">
          {photos.map((photo, idx) => (
            <button
              key={idx}
              onClick={() =>
                setSelectedPhotoIndex((prev) => ({
                  ...prev,
                  [itemId]: idx,
                }))
              }
              className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                idx === selectedPhotoIndex
                  ? "border-[#E3655B] opacity-100"
                  : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              <img
                src={photo}
                alt={`Thumbnail ${idx + 1}`}
                className="object-cover w-full h-full"
              />
            </button>
          ))}
        </div>
      )}
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
              className={`flex items-start gap-2 ${
                msg.type === "user" ? "flex-row-reverse" : ""
              }`}
            >
              {msg.type === "ai" && (
                <div className="flex items-center justify-center w-8 h-8 bg-opacity-10 rounded-full bg-[#E3655B] flex-shrink-0">
                  <span className="text-[#E3655B]">🤖</span>
                </div>
              )}
              <div
                className={`max-w-[80%] ${
                  msg.type === "user"
                    ? "bg-[#E3655B] text-white"
                    : "bg-gray-100"
                } rounded-2xl p-3`}
              >
                <p className="text-sm">{msg.text}</p>
                <p
                  className={`text-xs mt-1 ${
                    msg.type === "user" ? "text-white/70" : "text-gray-400"
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
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                input.trim()
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
          time: c.time ||
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
            replies: [{ username: "ani", content: "Setuju!", time: "2 menit lalu" }],
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
            : c,
        ),
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
          : c,
      ),
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
            <button onClick={() => setReplyTo(null)} className="text-xs text-blue-600">
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
                        className={`flex items-center gap-1 text-xs transition-colors ${
                          likedComments[comment.id] ? "text-[#E3655B]" : "text-gray-400"
                        }`}
                      >
                        <span className="text-sm">
                          {likedComments[comment.id] ? "❤️" : "🤍"}
                        </span>
                        <span>{comment.likes}</span>
                      </button>
                      <button
                        onClick={() =>
                          setReplyTo({ commentId: comment.id, username: comment.username })
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
                            <span className="text-xs font-medium">@{reply.username}</span>
                            <span className="text-xs text-gray-400">{reply.time}</span>
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

function Feed() {
  const { location, status, placeName, requestLocation } = useLocation();
  const [tempat, setTempat] = useState([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [comments, setComments] = useState({});
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState({});
  const [initialLoad, setInitialLoad] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const [ramaiCategory, setRamaiCategory] = useState("kuliner");

  const [selectedTempat, setSelectedTempat] = useState(null);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showKomentarModal, setShowKomentarModal] = useState(false);

  const greeting = getGreeting();
  const locationReady = status === "granted" && location;
  const currentHour = new Date().getHours();
  const displayLocation = locationReady && placeName
    ? placeName.split(",")[0]
    : null;

  // Efek untuk mendapatkan kategori ramai
  useEffect(() => {
    if (tempat.length > 0) {
      const categoryCount = {};
      tempat.forEach((item) => {
        if (parseInt(item.estimasi_orang) > 20 && item.kategori) {
          categoryCount[item.kategori] = (categoryCount[item.kategori] || 0) + 1;
        }
      });

      let maxCount = 0;
      let maxCategory = "kuliner";
      Object.entries(categoryCount).forEach(([cat, count]) => {
        if (count > maxCount) {
          maxCount = count;
          maxCategory = cat;
        }
      });
      setRamaiCategory(maxCategory);
    }
  }, [tempat]);

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
    if (parts.length >= 2) {
      return `${parts[0]}, ${parts[1]}`;
    }
    return alamat;
  };

  const loadPlaces = useCallback(
    async (reset = false) => {
      if (loading) return;

      setLoading(true);

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

        if (locationReady && items.length > 0 && location) {
          items = items
            .map((item) => {
              if (item.latitude && item.longitude) {
                const distance = calculateDistance(
                  location.latitude,
                  location.longitude,
                  item.latitude,
                  item.longitude,
                );
                return { ...item, distance };
              }
              return { ...item, distance: Infinity };
            })
            .sort((a, b) => a.distance - b.distance);
        }

        const commentsMap = {};
        items.forEach((item) => {
          commentsMap[item.id] = item.testimonial_terbaru || [];
        });
        setComments((prev) => ({ ...prev, ...commentsMap }));

        setTempat((prev) => (reset ? items : [...prev, ...items]));
        setPage(currentPage + 1);
        setHasMore(items.length === LIMIT);
        setInitialLoad(false);
      } catch (error) {
        console.error("Error loading places:", error);
      } finally {
        setLoading(false);
      }
    },
    [location, locationReady, page, loading],
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

  // Fungsi untuk mendapatkan area user dari tempat terdekat (validasi lokasi)
  const getUserAreaFromNearestPlace = (places, userLocation) => {
    if (!places.length || !userLocation) return null;

    // Cari tempat terdekat (sudah diurutkan oleh loadPlaces)
    const nearestPlace = places[0];

    // Jika jarak ke tempat terdekat > 5km, jangan gunakan (terlalu jauh)
    if (nearestPlace.distance > 5) return null;

    // Ambil kecamatan/desa dari alamat tempat terdekat
    const parts = nearestPlace.alamat.split(",").map((p) => p.trim());

    // Cari bagian yang mengandung "Kec." atau bagian ke-2/ke-3
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].includes("Kec.") || parts[i].includes("Kecamatan")) {
        return parts[i].replace("Kec.", "").replace("Kecamatan", "").trim();
      }
    }

    // Fallback ke bagian ke-2 (biasanya desa) atau ke-1 (jalan)
    return parts[1] || parts[0];
  };

  return (
    <main className="relative min-h-screen max-w-md mx-auto pb-20 bg-[#F9F7F7]">
      {/* HEADER STICKY */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-gray-100">
        {/* BAGIAN ATAS - HILANG SAAT SCROLL DENGAN MAX-HEIGHT */}
        <div
          className={`transition-all duration-300 ease-in-out overflow-hidden ${
            isScrolled ? "max-h-0 opacity-0" : "max-h-[120px] opacity-100"
          }`}
        >
          <div className="px-4 pt-3 pb-1">
            {/* LOGO DI TENGAH */}
            <div className="flex justify-center mb-2">
              <span className="font-bold text-2xl text-[#E3655B] tracking-tight">
                Setempat.id
              </span>
            </div>

            {/* GREETING DINAMIS - DENGAN MOMENT LENGKAP */}
            <div className="text-center">
              {locationReady ? (
                <div className="space-y-1">
                  <p className="text-xl font-semibold text-gray-800">{greeting.text}</p>
                  <p className="text-base text-gray-600">
                    {generateMoment(
                      tempat,
                      getUserAreaFromNearestPlace(tempat, location) ||
                        displayLocation ||
                        "sekitar",
                      currentHour,
                    ).text}
                  </p>
                </div>
              ) : (
                <button
                  onClick={requestLocation}
                  className="text-base text-gray-600 hover:text-[#E3655B] transition-colors"
                >
                  Aktifkan lokasi Anda Untuk Lihat Suasana Sekitar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* SEARCH BAR - SELALU TAMPIL */}
        <div className="px-4 py-2">
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
                  ? `Cari di sekitar ${displayLocation}...`
                  : "Cari sesuatu di sekitar Anda..."
              }
              className="w-full bg-gray-100 rounded-full py-2.5 pl-12 pr-24 text-sm text-gray-600 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#E3655B] focus:ring-opacity-50 transition-all"
            />

            {/* INDIKATOR LOKASI ON/OFF */}
            <div className="absolute inset-y-0 right-0 flex items-center pr-2">
              {locationReady ? (
                <span className="flex items-center gap-1.5 bg-green-100 text-green-700 text-xs font-medium px-3 py-1 rounded-full">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  ON
                </span>
              ) : (
                <button
                  onClick={requestLocation}
                  className="flex items-center gap-1.5 bg-red-100 text-red-700 text-xs font-medium px-3 py-1 rounded-full hover:bg-red-200 transition-colors"
                >
                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                  OFF
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* INFO TAMBAHAN - HILANG SAAT SCROLL */}
      {!isScrolled && locationReady && displayLocation && (
        <div className="px-4 py-1 border-b border-gray-100 bg-white/50">
          <div className="flex items-center justify-center gap-2 text-xs">
            <span className="text-gray-500">
              {getUserAreaFromNearestPlace(tempat, location) || displayLocation}
            </span>
            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
            <span className="text-gray-500">{tempat.length} tempat aktif</span>
          </div>
        </div>
      )}

      {/* FEED */}
      <div className="px-4 space-y-4">
        {initialLoad && loading
          ? (
            // SKELETON LOADING
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="overflow-hidden bg-white border border-gray-100 rounded-2xl shadow-sm animate-pulse"
                >
                  <div className="h-48 bg-gray-200"></div>
                  <div className="p-4 space-y-3">
                    <div className="w-1/3 h-5 bg-gray-200 rounded"></div>
                    <div className="w-2/3 h-4 bg-gray-200 rounded"></div>
                    <div className="w-1/2 h-4 bg-gray-200 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          )
          : (
            tempat.map((item, index) => {
              const aktivitas = item.aktivitas_terkini || [];
              const medsos = item.medsos_terbaru || [];
              const laporan = item.laporan_terbaru || [];
              const testimonial = item.testimonial_terbaru || [];

              const aktivitasUtama = aktivitas.length > 0 ? aktivitas[0] : null;
              const suasana = laporan.find(
                (l) => l.tipe === "keramaian" || l.tipe === "suasana",
              );
              const antrian = laporan.find((l) => l.tipe === "antrian");
              const testimonialTerbaru = testimonial.length > 0 ? testimonial[0] : null;
              const medsosTerbaru = medsos.length > 0 ? medsos[0] : null;

              const alamatSingkat = getAlamatSingkat(item.alamat);
              const estimasiOrang = parseInt(item.estimasi_orang) || 0;

              // Tentukan KEJADIAN UTAMA
              let kejadianUtama = "";
              let kejadianIcon = "📍";

              if (aktivitasUtama) {
                kejadianUtama = aktivitasUtama.deskripsi;
                kejadianIcon = "⚡️";
              } else if (antrian) {
                kejadianUtama = `Antrian ${antrian.estimasi_menit} menit`;
                kejadianIcon = "🚶";
              } else if (testimonialTerbaru) {
                kejadianUtama = `"${testimonialTerbaru.content.substring(0, 40)}..."`;
                kejadianIcon = "💬";
              } else if (medsosTerbaru) {
                kejadianUtama = medsosTerbaru.content.substring(0, 40) + "...";
                kejadianIcon = "📱";
              } else if (estimasiOrang > 0) {
                kejadianUtama = `${estimasiOrang} orang di lokasi`;
                kejadianIcon = "👥";
              } else {
                kejadianUtama = "Lagi ramai dikunjungi";
                kejadianIcon = "🔥";
              }

              const photos = item.photos || (item.image_url
                ? [item.image_url]
                : [
                  "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=500",
                  "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=500",
                  "https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=500",
                ]);

              const currentPhotoIndex = selectedPhotoIndex[item.id] || 0;

              return (
                <div
                  key={`${item.id}-${index}`}
                  className="overflow-hidden bg-white border border-gray-100 rounded-2xl shadow-sm"
                >
                  {/* FOTO SLIDER dengan SWIPE - MENGGUNAKAN KOMPONEN PHOTOSLIDER */}
                  <div className="px-4 mt-3">
                    <PhotoSlider
                      photos={photos}
                      itemId={item.id}
                      selectedPhotoIndex={currentPhotoIndex}
                      setSelectedPhotoIndex={setSelectedPhotoIndex}
                    />
                  </div>

                  {/* KEJADIAN UTAMA - BESAR */}
                  <div className="px-4 pt-4">
                    <div className="flex items-start gap-2">
                      <span className="text-2xl">{kejadianIcon}</span>
                      <p className="flex-1 text-lg font-semibold text-[#2D2D2D]">
                        {kejadianUtama}
                      </p>
                    </div>

                    {/* TEMPAT SEBAGAI KONTEKS - KECIL */}
                    <div className="flex items-center gap-1 mt-1 ml-8">
                      <span className="text-sm font-medium text-[#E3655B]">
                        {item.name}
                      </span>
                      <span className="text-xs text-gray-400">• {alamatSingkat}</span>
                    </div>

                    {/* METADATA - JARAK & WAKTU */}
                    <div className="flex items-center gap-2 mt-3 ml-8">
                      {locationReady && item.distance && (
                        <span className="px-3 py-1 font-medium text-white rounded-full border shadow-sm bg-[#E3655B] border-[#E3655B]">
                          📍{" "}
                          {item.distance < 1
                            ? `${Math.round(item.distance * 1000)}m`
                            : `${item.distance.toFixed(1)}km`}{" "}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {formatTimeAgo(item.updated_at || item.created_at)}
                      </span>
                      {estimasiOrang > 0 && (
                        <span className="text-xs text-gray-500">
                          • 👥 {estimasiOrang} orang di lokasi
                        </span>
                      )}
                    </div>

                    {/* INFO TAMBAHAN (jika ada) */}
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
                      {suasana && (
                        <p className="text-xs text-gray-500">{suasana.deskripsi}</p>
                      )}
                    </div>
                  </div>

                  {/* BADGE */}
                  <div className="flex flex-wrap gap-1 px-4 mt-2">
                    {estimasiOrang > 20 && (
                      <span className="px-2 py-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
                        🔥 RAMAI
                      </span>
                    )}
                    {locationReady && item.distance && item.distance < 1 && (
                      <span className="px-2 py-1 text-[10px] font-bold text-white bg-blue-500 rounded-full">
                        📍 DEKAT
                      </span>
                    )}
                    {!locationReady && comments[item.id]?.length > 5 && (
                      <span className="px-2 py-1 text-[10px] font-bold text-white bg-purple-500 rounded-full">
                        ⚡ VIRAL
                      </span>
                    )}
                  </div>

                  {/* AKSI - Tanya AI & Kata Warga */}
                  <div className="flex items-center justify-between px-4 pt-3 pb-5 mt-2 border-t border-gray-100">
                    <button
                      onClick={() => openAIModal(item)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-full hover:bg-gray-200"
                    >
                      <span className="text-base">🤖</span>
                      Tanya AI Setempat
                    </button>

                    <button
                      onClick={() => openKomentarModal(item)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-full hover:bg-gray-200"
                    >
                      <span className="text-base">💬</span>
                      <span>{comments[item.id]?.length || 0}</span> Kata Warga
                    </button>
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

      {/* MODALS */}
      <AIModal
        isOpen={showAIModal}
        onClose={closeModals}
        tempat={selectedTempat}
      />

      <KomentarModal
        isOpen={showKomentarModal}
        onClose={closeModals}
        tempat={selectedTempat}
        initialComments={selectedTempat ? comments[selectedTempat.id] || [] : []}
      />
    </main>
  );
}

export default function Home() {
  return (
    <LocationProvider>
      <Feed />
    </LocationProvider>
  );
}