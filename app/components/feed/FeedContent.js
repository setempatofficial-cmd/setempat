"use client";

import { useEffect, useState, useCallback } from "react";

import { supabase } from "../../../lib/supabaseClient";
import { calculateDistance } from "../../../lib/distance";
import { getGreeting } from "../../../lib/greeting";
import { generateMoment } from "../../../lib/momentEngine";
import { calculateScore } from "../../../lib/ranking";
import { generateHeadline } from "../../../lib/headlineEngine";
import { useLocation } from "../LocationProvider";

import PhotoSlider from "./PhotoSlider";
import AIModal from "./AIModal";
import KomentarModal from "./KomentarModal";
import FeedCard from "./FeedCard";
import Header from "../layout/Header";
import LaporanWarga from "../layout/LaporanWarga";

const LIMIT = 10;

export default function FeedContent() {
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
  const [toast, setToast] = useState({ show: false, message: "" });
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

// Update fungsi handleShare kamu
const handleShare = async (item) => {
  const shareUrl = `${window.location.origin}?id=${item.id}`;
  const shareData = {
    title: item.name,
    text: `📍 Cek kondisi di ${item.name} sekarang!`,
    url: shareUrl,
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      await navigator.clipboard.writeText(shareUrl);
      // Tampilkan Toast buatan sendiri
      setToast({ show: true, message: "✅ Link berhasil disalin!" });
      setTimeout(() => setToast({ show: false, message: "" }), 3000);
    }
  } catch (err) {
    console.log("Share cancelled or failed");
  }
};

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
    const parts = alamatSingkat.split(',');
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
      `📸 Saat ini Banyak yang Foto-foto di sini`,
      `🎵 Lagi Ada Hiburan musik Akustik`,
      `💬 Lagi ada Acara Diskusi hangat`,
      `⚡ ${waktuStr} Ramai Pengunjung`,
    ];

    const hash = simpleHash(String(item.id));
    const index = hash % templates.length;
    return templates[index];
  };

  // Hitung statistik untuk header
  const titikRamai = tempat.filter((t) => parseInt(t.estimasi_orang) > 20).length;
  const titikDekat = tempat.filter((t) => t.distance && t.distance < 1).length;

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
      <Header
        locationReady={locationReady}
        displayLocation={displayLocation}
        isScrolled={isScrolled}
        greeting={greeting.text}
        momentText={generateMoment(
          tempat,
          getUserAreaFromNearestPlace(tempat, location) || displayLocation || "sekitar",
          currentHour
        ).text}
        onToggleLocation={disableLocation}
        onRequestLocation={handleRequestLocation}
        statsTitikRamai={titikRamai}
        statsTitikDekat={titikDekat}
      />

      <LaporanWarga 
        tempat={tempat}
        locationReady={locationReady}
        displayLocation={displayLocation}
      />

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
            <p className="text-gray-500">Tidak ada tempat dengan aktivitas terbaru</p>
          </div>
        ) : (
          tempat.map((item, index) => (
    <FeedCard
      key={`${item.id}-${index}`}
      item={item}
      locationReady={locationReady}
      location={location}
      comments={comments}
      selectedPhotoIndex={selectedPhotoIndex}
      setSelectedPhotoIndex={setSelectedPhotoIndex}
      openAIModal={openAIModal}
      openKomentarModal={openKomentarModal}
      formatTimeAgo={formatTimeAgo}
      displayLocation={displayLocation}
      currentHour={currentHour}
      onShare={handleShare}
    />
  ))
 )}
        {loading && !initialLoad && (
          <div className="py-4 text-center">
            <div className="inline-block w-6 h-6 border-2 border-gray-300 rounded-full animate-spin border-t-[#E3655B]"></div>
            <p className="mt-2 text-xs text-gray-400">Memuat...</p>
          </div>
        )}

        {!loading && !hasMore && tempat.length > 0 && (
          <p className="py-4 text-sm text-center text-gray-400">Tidak ada tempat lagi</p>
        )}
      </div>

      <AIModal isOpen={showAIModal} onClose={closeModals} tempat={selectedTempat} />
      <KomentarModal
        isOpen={showKomentarModal}
        onClose={closeModals}
        tempat={selectedTempat}
        initialComments={selectedTempat ? comments[selectedTempat.id] || [] : []}
      />
	  {/* TOAST NOTIFICATION */}
      <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 transform ${
        toast.show ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0 pointer-events-none"
      }`}>
        <div className="bg-gray-900/90 backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-white/10">
          <span className="text-sm font-semibold tracking-wide">{toast.message}</span>
        </div>
      </div>
    </main>
  );
}