"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import LocationProvider, { useLocation } from "./components/LocationProvider";
import { calculateDistance } from "./lib/distance";
import { getGreeting } from "./lib/greeting";
import { generateMoment } from "./lib/momentEngine";
import { calculateScore } from "../lib/ranking";
import { generateHeadline } from "../lib/headlineEngine";
import PhotoSlider from "./components/feed/PhotoSlider";
import AIModal from "./components/feed/AIModal";
import KomentarModal from "./components/feed/KomentarModal";
import LaporanWarga from "./components/layout/LaporanWarga";
import Header from "./components/layout/Header";

const LIMIT = 10;

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


// Hitung statistik untuk header dan laporan warga
const titikRamai = tempat.filter((t) => parseInt(t.estimasi_orang) > 20).length;
const titikDekat = tempat.filter((t) => t.distance && t.distance < 1).length;
return (
  <main className="relative min-h-screen max-w-md mx-auto pb-20 bg-[#F9F7F7]">
    {/* HEADER BARU - DENGAN LOGO ASLI */}
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
    {/* LAPORAN WARGA */}
<LaporanWarga 
  tempat={tempat}
  locationReady={locationReady}
  displayLocation={displayLocation}
/>
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