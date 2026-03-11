"use client";

import { useEffect, useState, useCallback, useRef, useDeferredValue, useMemo } from "react";
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
import LocationModal from "@/components/LocationModal";

const LIMIT = 10;

export default function FeedContent() {
  const { location, status, placeName, requestLocation, setManualLocation } = useLocation();
  
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
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  const [error, setError] = useState(null);
  const [toast, setToast] = useState({ show: false, message: "" });
  
  const [filteredPlaces, setFilteredPlaces] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [queryText, setQueryText] = useState("");

  const deferredQuery = useDeferredValue(queryText);
  const greeting = getGreeting();
  const currentHour = new Date().getHours();

  // --- 1. STATUS KONEKSI LOKASI ---
  const locationReady = useMemo(() => {
    return status === "granted" && !!location?.latitude && !!location?.longitude;
  }, [status, location]);

  // --- 2. LOGIKA EKSTRAKSI LOKASI BERJENJANG (Desa | Kecamatan) ---
  const { villageLocation, districtLocation } = useMemo(() => {
    if (!placeName) {
      return { 
        villageLocation: "Pilih Lokasi", 
        districtLocation: "" 
      };
    }
    
    // Memisahkan string "Tejowangi, Purwosari" yang dikirim dari Provider
    const parts = placeName.split(",").map(p => p.trim());
    
    return { 
      // Elemen pertama: Desa atau Kota
      villageLocation: parts[0] || "Lokasi", 
      // Elemen kedua: Kecamatan (jika tersedia)
      districtLocation: parts[1] || "" 
    };
  }, [placeName]);

  const fetchIdRef = useRef(0);

  const loadPlaces = useCallback(
    async (reset = false) => {
      const currentFetchId = ++fetchIdRef.current;
      if (loading && !reset) return;

      if (reset) {
        setTempat([]);
        setPage(0);
        setInitialLoad(true);
        setHasMore(true);
      }

      setLoading(true);
      try {
        const currentPage = reset ? 0 : page;
        const from = currentPage * LIMIT;
        const to = from + LIMIT - 1;

        const { data, error: fetchError } = await supabase
          .from("feed_view")
          .select("*")
          .range(from, to);

        if (fetchError) throw fetchError;
        if (currentFetchId !== fetchIdRef.current) return;

        let items = data || [];
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

        // Sorting Logika: Jarak vs Ranking
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
        if (currentFetchId === fetchIdRef.current) setError(err.message);
      } finally {
        if (currentFetchId === fetchIdRef.current) {
          setLoading(false);
          setInitialLoad(false);
        }
      }
    },
    [location, locationReady, page, loading]
  );

  useEffect(() => { loadPlaces(true); }, [location, locationReady]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 900 && !loading && hasMore && queryText.length < 2) {
        loadPlaces();
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loading, hasMore, loadPlaces, queryText]);

  const openAIModal = (item) => { setSelectedTempat(item); setShowAIModal(true); };
  const openKomentarModal = (item) => { setSelectedTempat(item); setShowKomentarModal(true); };
  const closeModals = () => { setShowAIModal(false); setShowKomentarModal(false); setSelectedTempat(null); };

  const handleShare = async (item) => {
    const shareUrl = `${window.location.origin}?id=${item.id}`;
    try {
      if (navigator.share) await navigator.share({ title: item.name, text: `📍 Cek kondisi di ${item.name}!`, url: shareUrl });
      else {
        await navigator.clipboard.writeText(shareUrl);
        setToast({ show: true, message: "✅ Link disalin!" });
        setTimeout(() => setToast({ show: false, message: "" }), 3000);
      }
    } catch (err) { console.log("Share failed"); }
  };

  const displayData = useMemo(() => {
    return deferredQuery.length >= 2 ? filteredPlaces : tempat;
  }, [deferredQuery, filteredPlaces, tempat]);

  return (
    <main className="relative min-h-screen max-w-md mx-auto pb-20 bg-[#F9F7F7]">
      {/* HEADER DINAMIS DENGAN FORMAT DESA | KECAMATAN */}
      <Header
        locationReady={locationReady}
        villageLocation={villageLocation}
        districtLocation={districtLocation}
        isScrolled={isScrolled}
        onOpenLocationModal={() => setIsLocationModalOpen(true)}
        onSearchResults={setFilteredPlaces}
        onSearchLoading={setIsSearching}
        onQueryChange={setQueryText}
        tempat={tempat} 
        location={location}

      />

      <LocationModal 
        isOpen={isLocationModalOpen} 
        onClose={() => setIsLocationModalOpen(false)}
        locationReady={locationReady}
        onActivateGPS={async () => {
          try {
            await requestLocation();
          } catch (err) {
            console.error("Gagal aktivasi:", err);
          }
        }}
        onSelectManual={(coords) => {
          setManualLocation(coords);
          setIsLocationModalOpen(false);
        }}
      />

      <div className="px-4 mt-4">
        <AnimatePresence mode="wait">
          {deferredQuery.length >= 2 && (
            <motion.div key="search-headline" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="px-1 py-6 mb-2">
               <div className="flex items-center gap-2 mb-2">
                <span className="flex h-2 w-2 rounded-full bg-[#E3655B] animate-pulse shadow-[0_0_10px_#E3655B]"></span>
                <h3 className="text-[10px] font-black text-[#E3655B] uppercase tracking-[0.3em]">Eksplorasi Suasana</h3>
              </div>
              <h2 className="text-3xl font-black text-gray-900 tracking-tighter leading-[0.9] mb-3">
                Lagi nyari <span className="text-[#E3655B]">"{deferredQuery}"</span> ya?
              </h2>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-4 min-h-[60vh]">
          <AnimatePresence mode="sync" initial={false}>
            {initialLoad ? (
              <motion.div key="skeleton-wrapper" exit={{ opacity: 0 }} className="space-y-6">
                {[1, 2, 3].map((i) => (
                  <div key={`skel-${i}`} className="h-80 bg-gray-200/60 rounded-[32px] animate-pulse" />
                ))}
              </motion.div>
            ) : (
              displayData.map((item, index) => (
                <motion.div
                  key={`feed-${item.id}`} 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.2) }}
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
      <KomentarModal 
        isOpen={showKomentarModal} 
        onClose={closeModals} 
        tempat={selectedTempat} 
        initialComments={selectedTempat ? comments[selectedTempat.id] || [] : []} 
      />

      <AnimatePresence>
        {toast.show && (
          <motion.div initial={{ y: 20, opacity: 0, x: "-50%" }} animate={{ y: 0, opacity: 1, x: "-50%" }} exit={{ y: 20, opacity: 0, x: "-50%" }} className="fixed bottom-24 left-1/2 z-[100]">
            <div className="bg-gray-900 text-white px-6 py-3 rounded-2xl shadow-2xl font-black text-[11px] uppercase tracking-widest whitespace-nowrap">{toast.message}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}