"use client";

import { useEffect, useState, useCallback, useRef, useDeferredValue, useMemo } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";

import { supabase } from "../../../lib/supabaseClient";
import { calculateDistance } from "../../../lib/distance";
import { getGreeting } from "../../../lib/greeting";
import { calculateScore } from "../../../lib/ranking";
import { useLocation } from "../LocationProvider";

import FeedCard from "./FeedCard";
import Header from "../layout/NewHeader";
import LaporanWarga from "../layout/LaporanWarga";
import AIModal from "./AIModal"; 
import AISearchModal from "./AISearchModal"; 
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
  const [showAISearchModal, setShowAISearchModal] = useState(false); 
  const [showKomentarModal, setShowKomentarModal] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  const [error, setError] = useState(null);
  const [toast, setToast] = useState({ show: false, message: "" });
  
  const [filteredPlaces, setFilteredPlaces] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [queryText, setQueryText] = useState("");

  const deferredQuery = useDeferredValue(queryText);

  // Logika Malam tetap ada tapi bg-color dipindah ke parent (page.js)
  const isMalam = useMemo(() => getGreeting().text === "Malam", []);

  const locationReady = useMemo(() => {
    return status === "granted" && !!location?.latitude && !!location?.longitude;
  }, [status, location]);

  const { villageLocation, districtLocation } = useMemo(() => {
    if (!placeName) return { villageLocation: "Pilih Lokasi", districtLocation: "" };
    const parts = placeName.split(",").map(p => p.trim());
    return { 
      villageLocation: parts[0] || "Lokasi", 
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
      setIsScrolled(window.scrollY > 20);
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 900 && !loading && hasMore && queryText.length < 2) {
        loadPlaces();
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loading, hasMore, loadPlaces, queryText]);

  const openAICardModal = (item) => { setSelectedTempat(item); setShowAIModal(true); };
  const openAISearchModal = () => { setShowAISearchModal(true); };
  const openKomentarModal = (item) => { setSelectedTempat(item); setShowKomentarModal(true); };
  const closeModals = () => { 
    setShowAIModal(false); 
    setShowAISearchModal(false); 
    setShowKomentarModal(false); 
    setSelectedTempat(null); 
  };

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
    // bg-transparent penting agar aura di page.js tidak tertutup
    <main className={`relative min-h-screen max-w-md mx-auto pb-24 transition-all duration-700 bg-transparent`}>
      
      {/* HEADER: Sekarang menggunakan backdrop-blur untuk efek mewah saat scroll */}
      <div className={`sticky top-0 z-50 transition-all duration-300 ${isScrolled ? 'backdrop-blur-xl bg-black/20 border-b border-white/5' : 'bg-transparent'}`}>
        <Header
          locationReady={locationReady}
          villageLocation={villageLocation}
          districtLocation={districtLocation}
          isScrolled={isScrolled}
          onOpenLocationModal={() => setIsLocationModalOpen(true)}
          onOpenAIModal={openAISearchModal}
          onSearchResults={setFilteredPlaces}
          onSearchLoading={setIsSearching}
          onQueryChange={setQueryText}
          tempat={tempat} 
          location={location}
        />
      </div>

      {/* WRAPPER STICKY LAPORAN WARGA */}
      <div 
        className="sticky z-20" 
        style={{ 
          top: isScrolled ? "70px" : "10px",
          padding: "0 16px",
          transition: "all 0.4s cubic-bezier(0.22, 1, 0.36, 1)"
        }}
      >
        <div className={`rounded-[28px] overflow-hidden transition-all duration-300 ${isScrolled ? 'shadow-2xl' : ''}`}>
          <LaporanWarga 
            compact={isScrolled}
            tempat={tempat}
            locationReady={locationReady}
            displayLocation={villageLocation}
            districtLocation={districtLocation}
            location={location}
          />
        </div>
      </div>

      <LocationModal 
        isOpen={isLocationModalOpen} 
        onClose={() => setIsLocationModalOpen(false)}
        locationReady={locationReady}
        isMalam={isMalam}
        onActivateGPS={async () => {
          try { await requestLocation(); } catch (err) { console.error(err); }
        }}
        onSelectManual={(coords) => {
          setManualLocation(coords);
          setIsLocationModalOpen(false);
        }}
      />

      <div className="px-0 mt-6">
        <AnimatePresence mode="wait">
          {deferredQuery.length >= 2 && (
            <motion.div 
              key="search-headline" 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0 }} 
              className="px-6 py-8 mx-4 mb-4 bg-white/[0.03] rounded-[32px] border border-white/5"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_red]"></span>
                <h3 className="text-[9px] font-black text-white/40 uppercase tracking-[0.4em]">Eksplorasi Suasana</h3>
              </div>
              <h2 className={`text-2xl font-bold tracking-tight text-white leading-tight`}>
                Mencari <span className="text-red-500 italic">"{deferredQuery}"</span>
              </h2>
            </motion.div>
          )}
        </AnimatePresence>

        <LayoutGroup>
          <motion.div layout className="space-y-2 min-h-[60vh]">
            <AnimatePresence mode="popLayout" initial={false}>
              {initialLoad ? (
                <motion.div key="skeleton-wrapper" exit={{ opacity: 0 }} className="space-y-6 px-4">
                  {[1, 2].map((i) => (
                    <div key={`skel-${i}`} className="h-[400px] w-full rounded-[40px] animate-pulse bg-white/5 border border-white/5" />
                  ))}
                </motion.div>
              ) : (
                displayData.map((item, index) => (
                  <motion.div
                    key={`feed-${item.id}`}    
                    layout    
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ 
                      duration: 0.5, 
                      ease: [0.22, 1, 0.36, 1],
                      delay: Math.min(index * 0.05, 0.2)
                    }}
                  >
                    <FeedCard
                      item={item}
                      locationReady={locationReady}
                      location={location}
                      comments={comments}
                      selectedPhotoIndex={selectedPhotoIndex}
                      setSelectedPhotoIndex={setSelectedPhotoIndex}
                      openAIModal={openAICardModal}
                      openKomentarModal={openKomentarModal}
                      onShare={handleShare}
                    />
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </motion.div>
        </LayoutGroup>
      </div>

      {/* MODALS */}
      <AISearchModal isOpen={showAISearchModal} onClose={closeModals} query={queryText} villageLocation={villageLocation} locationReady={locationReady} />
      <AIModal isOpen={showAIModal} onClose={closeModals} tempat={selectedTempat} />
      <KomentarModal isOpen={showKomentarModal} onClose={closeModals} tempat={selectedTempat} initialComments={selectedTempat ? comments[selectedTempat.id] || [] : []} />

      {/* TOAST NOTIFICATION */}
      <AnimatePresence>
        {toast.show && (
          <motion.div 
            initial={{ y: 50, x: "-50%", opacity: 0 }} 
            animate={{ y: 0, x: "-50%", opacity: 1 }} 
            exit={{ y: 50, x: "-50%", opacity: 0 }} 
            className="fixed bottom-10 left-1/2 z-[100]"
          >
            <div className="bg-white text-black px-6 py-3 rounded-2xl shadow-2xl font-bold text-[12px] tracking-tight uppercase">
              {toast.message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}