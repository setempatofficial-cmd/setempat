"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { supabase } from "../../../lib/supabaseClient";
import { calculateDistance } from "../../../lib/distance";
import { getGreeting } from "../../../lib/greeting";
import { generateMoment } from "../../../lib/momentEngine";
import { calculateScore } from "../../../lib/ranking";
import { useLocation } from "../LocationProvider";

import FeedCard from "./FeedCard";
import Header from "../layout/NewHeader";
import LaporanWarga from "../layout/LaporanWarga";
import AIModal from "./AIModal";
import KomentarModal from "./KomentarModal";

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
  
  const [filteredPlaces, setFilteredPlaces] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [queryText, setQueryText] = useState("");

  const greeting = getGreeting();
  const locationReady = (status === "granted" && location) && !manualLocationOff;
  const currentHour = new Date().getHours();
  const displayLocation = locationReady && placeName ? placeName.split(",")[0] : null;

  // Ref untuk mengontrol race condition saat fetch async
  const fetchIdRef = useRef(0);

  const loadPlaces = useCallback(
    async (reset = false) => {
      const currentFetchId = ++fetchIdRef.current;
      
      if (loading && !reset) return;

      // Reset state untuk keamanan key dan animasi
      if (reset) {
        setTempat([]);
        setPage(0);
        setInitialLoad(true);
        setHasMore(true);
      }

      setLoading(true);
      setError(null);

      try {
        const currentPage = reset ? 0 : page;
        const from = currentPage * LIMIT;
        const to = from + LIMIT - 1;

        const { data, error: fetchError } = await supabase
          .from("feed_view")
          .select("*")
          .range(from, to);

        if (fetchError) throw fetchError;

        // Validasi: Abaikan jika sudah ada request baru yang masuk
        if (currentFetchId !== fetchIdRef.current) return;

        let items = data || [];

        // Integrasi Jarak & Skor Ranking
        items = items.map((item) => {
          const distance = (locationReady && location && item.latitude && item.longitude)
            ? calculateDistance(location.latitude, location.longitude, item.latitude, item.longitude)
            : Infinity;

          return {
            ...item,
            distance,
            score: calculateScore(item, location),
          };
        });

        // Sorting Logic
        items.sort((a, b) => {
          if (locationReady && a.distance !== Infinity) {
            const scoreA = a.score * 0.4 + (1 / (a.distance || 0.1)) * 0.6;
            const scoreB = b.score * 0.4 + (1 / (b.distance || 0.1)) * 0.6;
            return scoreB - scoreA;
          }
          return b.score - a.score;
        });

        const commentsMap = {};
        items.forEach((item) => {
          commentsMap[item.id] = item.testimonial_terbaru || [];
        });

        setComments((prev) => ({ ...prev, ...commentsMap }));
        setTempat((prev) => (reset ? items : [...prev, ...items]));
        setPage(currentPage + 1);
        setHasMore(items.length === LIMIT);
      } catch (err) {
        if (currentFetchId === fetchIdRef.current) {
          console.error("Error loading places:", err);
          setError(err.message);
        }
      } finally {
        if (currentFetchId === fetchIdRef.current) {
          setLoading(false);
          setInitialLoad(false);
        }
      }
    },
    [location, locationReady, page, loading]
  );

  useEffect(() => {
    loadPlaces(true);
  }, [locationReady]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
      if (
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 900 &&
        !loading && hasMore && queryText.length < 2
      ) {
        loadPlaces();
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loading, hasMore, loadPlaces, queryText]);

  // Handlers
  const handleRequestLocation = () => { setManualLocationOff(false); requestLocation(); };
  const disableLocation = () => { setManualLocationOff(true); };
  const openAIModal = (item) => { setSelectedTempat(item); setShowAIModal(true); };
  const openKomentarModal = (item) => { setSelectedTempat(item); setShowKomentarModal(true); };
  const closeModals = () => { setShowAIModal(false); setShowKomentarModal(false); setSelectedTempat(null); };

  const handleShare = async (item) => {
    const shareUrl = `${window.location.origin}?id=${item.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: item.name, text: `📍 Cek kondisi di ${item.name}!`, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setToast({ show: true, message: "✅ Link disalin!" });
        setTimeout(() => setToast({ show: false, message: "" }), 3000);
      }
    } catch (err) { console.log("Share failed"); }
  };

  const displayData = queryText.length >= 2 ? filteredPlaces : tempat;
  const titikRamai = tempat.filter((t) => (parseInt(t.estimasi_orang) || 0) > 20).length;
  const titikDekat = tempat.filter((t) => t.distance && t.distance < 1).length;

  return (
    <main className="relative min-h-screen max-w-md mx-auto pb-20 bg-[#F9F7F7]">
      <Header
        locationReady={locationReady}
        displayLocation={displayLocation}
        isScrolled={isScrolled}
        greeting={greeting.text}
        momentText={generateMoment(tempat, displayLocation || "Pasuruan", currentHour).text}
        onToggleLocation={disableLocation}
        onRequestLocation={handleRequestLocation}
        statsTitikRamai={titikRamai}
        statsTitikDekat={titikDekat}
        onSearchResults={setFilteredPlaces}
        onSearchLoading={setIsSearching}
        onQueryChange={setQueryText}
      />

      <LaporanWarga tempat={tempat} locationReady={locationReady} displayLocation={displayLocation} />

      <div className="px-4 mt-4">
        {/* HEADER PENCARIAN ESTETIK */}
        <AnimatePresence mode="wait">
          {queryText.length >= 2 && (
            <motion.div 
              key="search-headline-premium"
              initial={{ opacity: 0, y: -20, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -20, filter: "blur(10px)" }}
              className="px-1 py-6 mb-2"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="flex h-2 w-2 rounded-full bg-[#E3655B] animate-pulse shadow-[0_0_10px_#E3655B]"></span>
                <h3 className="text-[10px] font-black text-[#E3655B] uppercase tracking-[0.3em]">Eksplorasi Suasana</h3>
              </div>
              
              <h2 className="text-3xl font-black text-gray-900 tracking-tighter leading-[0.9] mb-3">
                Lagi nyari <br/>
                <span className="text-[#E3655B] relative inline-block">
                  "{queryText}"
                  <svg className="absolute -bottom-1 left-0 w-full h-2 text-[#E3655B]/20" viewBox="0 0 100 10" preserveAspectRatio="none">
                    <path d="M0 5 Q 25 0 50 5 T 100 5" fill="none" stroke="currentColor" strokeWidth="4" />
                  </svg>
                </span> ya?
              </h2>
              
              <div className="flex items-center gap-2 mt-4 bg-white/50 backdrop-blur-sm border border-white p-2 rounded-2xl w-fit">
                <span className="text-[11px] text-gray-500 font-bold italic px-2">
                  Ditemukan {displayData.length} lokasi di sekitar Pasuruan
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-4 min-h-[60vh]">
          <AnimatePresence mode="popLayout" initial={false}>
            {initialLoad ? (
              <motion.div key="skeleton-wrapper" exit={{ opacity: 0 }} className="space-y-6">
                {[1, 2, 3].map((i) => (
                  <div key={`skel-${i}`} className="h-80 bg-gray-200/60 rounded-[32px] animate-pulse" />
                ))}
              </motion.div>
            ) : displayData.length === 0 && !isSearching ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20 opacity-30">
                <p className="font-black italic">Tidak ada data di Pasuruan saat ini.</p>
              </motion.div>
            ) : (
              displayData.map((item, index) => (
                <motion.div
                  // UNIQUE KEY: Gabungan mode lokasi & ID mencegah tabrakan saat transisi
                  key={`feed-${locationReady ? 'near' : 'all'}-${item.id}`}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, filter: "blur(5px)" }}
                  transition={{ 
                    type: "spring", 
                    stiffness: 100, 
                    damping: 20, 
                    delay: Math.min(index * 0.08, 0.5) 
                  }}
                  layout
                >
                  <FeedCard
                    item={item}
                    locationReady={locationReady}
                    location={location}
                    comments={comments}
                    selectedPhotoIndex={selectedPhotoIndex}
                    setSelectedPhotoIndex={setSelectedPhotoIndex}
                    openAIModal={openAIModal}
                    openKomentarModal={openKomentarModal}
                    onShare={handleShare}
                  />
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>

      <AIModal isOpen={showAIModal} onClose={closeModals} tempat={selectedTempat} />
      <KomentarModal isOpen={showKomentarModal} onClose={closeModals} tempat={selectedTempat} initialComments={selectedTempat ? comments[selectedTempat.id] || [] : []} />

      <AnimatePresence>
        {toast.show && (
          <motion.div 
            initial={{ y: 50, opacity: 0, x: "-50%" }}
            animate={{ y: 0, opacity: 1, x: "-50%" }}
            exit={{ y: 20, opacity: 0, x: "-50%" }}
            className="fixed bottom-24 left-1/2 z-[100]"
          >
            <div className="bg-gray-900 text-white px-6 py-3 rounded-2xl shadow-2xl font-black text-[11px] uppercase tracking-widest whitespace-nowrap">
              {toast.message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}