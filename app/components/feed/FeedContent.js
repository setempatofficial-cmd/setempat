"use client";

import { useEffect, useState, useCallback, useRef, useDeferredValue, useMemo } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import AuthModal from "@/app/components/auth/AuthModal";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "../../../lib/supabaseClient";
import { calculateDistance } from "../../../lib/distance";
import { getGreeting } from "../../../lib/greeting";
import { processFeedItem } from "../../../lib/feedEngine";
import { useLocation } from "../LocationProvider";
import { useTheme } from "@/hooks/useTheme";

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
  const theme = useTheme();
  
  const [tempat, setTempat] = useState([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [comments, setComments] = useState({});
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState({});
  const [initialLoad, setInitialLoad] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  
  const [selectedTempat, setSelectedTempat] = useState(null);
  const [aiContext, setAiContext] = useState("general");
  const [showAIModal, setShowAIModal] = useState(false);
  const [showAISearchModal, setShowAISearchModal] = useState(false);
  const [showKomentarModal, setShowKomentarModal] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const { user, isAdmin } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const [error, setError] = useState(null);
  const [toast, setToast] = useState({ show: false, message: "" });
  
  const [filteredPlaces, setFilteredPlaces] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [queryText, setQueryText] = useState("");

  // STATE UNTUK SEARCH FLOW
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchRekomendasi, setSearchRekomendasi] = useState([]);

  const deferredQuery = useDeferredValue(queryText);

  // Logika Malam
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

  // REKOMENDASI KALIMAT
  const rekomendasiKalimat = useMemo(() => [
    `Suasana ngopi santai di ${villageLocation || 'Pasuruan'}`,
    "Tempat kerja dengan Wi-Fi kencang",
    "Kuliner legendaris yang tersembunyi",
    "Spot foto estetik buat akhir pekan",
    "Bengkel 24 jam terdekat",
    "Toko kelontong yang buka sampai malam"
  ], [villageLocation]);

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

        // PROSES SETIAP ITEM DENGAN feedEngine.js
        const commentsMap = {};
        const processedItems = [];

        for (const item of items) {
          const processed = processFeedItem({
            item,
            locationReady,
            location,
            comments
          });

          processedItems.push(processed);
          commentsMap[item.id] = item.testimonial_terbaru || [];
        }

        // SORTING
        processedItems.sort((a, b) => {
          const now = new Date();
          const oneHourAgo = now - (60 * 60 * 1000);

          const aRecent = a.lastActivityAt && new Date(a.lastActivityAt).getTime() > oneHourAgo;
          const bRecent = b.lastActivityAt && new Date(b.lastActivityAt).getTime() > oneHourAgo;

          if (aRecent && !bRecent) return -1;
          if (!aRecent && bRecent) return 1;

          const aHasLocation = locationReady && a.distance !== null && a.distance !== Infinity;
          const bHasLocation = locationReady && b.distance !== null && b.distance !== Infinity;

          if (aHasLocation && !bHasLocation) return -1;
          if (!aHasLocation && bHasLocation) return 1;

          if (a.sortScore && b.sortScore) {
            return b.sortScore - a.sortScore;
          }

          if (a.hasOfficialExternal && !b.hasOfficialExternal) return -1;
          if (!a.hasOfficialExternal && b.hasOfficialExternal) return 1;

          if (a.lastActivityAt && b.lastActivityAt) {
            return new Date(b.lastActivityAt) - new Date(a.lastActivityAt);
          }

          if (a.distance && b.distance) {
            return a.distance - b.distance;
          }

          return 0;
        });

        setComments((prev) => ({ ...prev, ...commentsMap }));
        setTempat((prev) => (reset ? processedItems : [...prev, ...processedItems]));
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

  useEffect(() => {
    loadPlaces(true);
  }, [location, locationReady]);

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

  // HANDLER SEARCH
  const handleSearchFocus = (active) => {
    setIsSearchActive(active);
    if (!active && queryText.length === 0) {
      setHasSearched(false);
    }
  };

  const handleSearchSubmit = () => {
    if (queryText.length >= 2) {
      setHasSearched(true);
      setSearchResults(filteredPlaces);
    }
  };

  const handleQueryChange = (text) => {
    setQueryText(text);
    if (text.length === 0) {
      setHasSearched(false);
    }
  };

  const handleSelectRekomendasi = (kalimat) => {
    setQueryText(kalimat);
    handleSearchSubmit();
  };

  const openAICardModal = (item) => {
    setSelectedTempat(item);
    setAiContext("general");
    setShowAIModal(true);
  };

  const openAISearchModal = () => {
    setShowAISearchModal(true);
  };

  const openKomentarModal = (item) => {
    setSelectedTempat(item);
    setShowKomentarModal(true);
  };

  const closeModals = () => {
    setShowAIModal(false);
    setShowAISearchModal(false);
    setShowKomentarModal(false);
    setSelectedTempat(null);
  };

  const handleShare = async (item) => {
    const shareUrl = `${window.location.origin}?id=${item.id}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: item.name,
          text: `📍 Cek kondisi di ${item.name}!`,
          url: shareUrl
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setToast({ show: true, message: "✅ Link disalin!" });
        setTimeout(() => setToast({ show: false, message: "" }), 3000);
      }
    } catch (err) {
      console.log("Share failed");
    }
  };

  const displayData = useMemo(() => {
    return deferredQuery.length >= 2 ? filteredPlaces : tempat;
  }, [deferredQuery, filteredPlaces, tempat]);

  return (
    <main className="relative min-h-screen mx-auto w-[92%] max-w-[400px] bg-transparent">
      
      {/* HEADER */}
      <div className={`sticky top-0 z-50 transition-all duration-300 ${isScrolled ? 'backdrop-blur-xl bg-black/20 border-b border-white/5' : 'bg-transparent'}`}>
        <Header
          user={user}
          isAdmin={isAdmin}
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
          locationReady={locationReady}
          villageLocation={villageLocation}
          districtLocation={districtLocation}
          isScrolled={isScrolled}
          onOpenLocationModal={() => setIsLocationModalOpen(true)}
          onOpenAIModal={openAISearchModal}
          onSearchResults={setFilteredPlaces}
          onSearchLoading={setIsSearching}
          onQueryChange={handleQueryChange}
          onSearchFocusChange={handleSearchFocus}
          onSearchSubmit={handleSearchSubmit}
          tempat={tempat}
          location={location}
        />
      </div>

      {/* Modal Login */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {/* LAPORAN WARGA - HILANG SAAT SEARCH ACTIVE */}
      {!isSearchActive && (
        <div
          className="sticky z-20 w-full"
          style={{
            top: isScrolled ? "85px" : "0px",
            transition: "all 0.4s cubic-bezier(0.22, 1, 0.36, 1)"
          }}
        >
          <div className="overflow-hidden transition-all duration-300">
            <LaporanWarga
              compact={isScrolled}
              tempat={tempat}
              locationReady={locationReady}
              displayLocation={villageLocation}
              districtLocation={districtLocation}
              location={location}
              maxRadius={10}
            />
          </div>
        </div>
      )}

      <LocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        locationReady={locationReady}
        isMalam={isMalam}
        onActivateGPS={async () => {
          try {
            await requestLocation();
          } catch (err) {
            console.error(err);
          }
        }}
        onSelectManual={(coords) => {
          setManualLocation(coords);
          setIsLocationModalOpen(false);
        }}
      />

      <div className="px-0 mt-6">
        {/* KONTEN PENCARIAN - MUNCUL SAAT SEARCH ACTIVE */}
        {isSearchActive && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="px-6 py-8 mx-4 mb-4 bg-white/[0.03] rounded-[32px] border border-white/5"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className={`flex h-1.5 w-1.5 rounded-full animate-pulse ${
                theme?.isMalam ? 'bg-red-500 shadow-[0_0_10px_red]' : 'bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]'
              }`}></span>
              <h3 className={`text-[9px] font-black uppercase tracking-[0.4em] ${
                theme?.isMalam ? 'text-slate-400' : 'text-slate-500'
              }`}>
                {hasSearched ? 'HASIL PENCARIAN' : 'EKSPLORASI SUASANA'}
              </h3>
            </div>

            {hasSearched ? (
              <div className="space-y-4">
                {/* HASIL PENCARIAN (CARD) */}
                <h2 className={`text-2xl font-bold tracking-tight leading-tight mb-4 ${
                  theme?.isMalam ? 'text-white' : 'text-slate-900'
                }`}>
                  Menampilkan hasil untuk "{queryText}"
                </h2>
                
                {filteredPlaces.length > 0 ? (
                  filteredPlaces.map((item) => (
                    <FeedCard
                      key={item.id}
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
                  ))
                ) : (
                  <p className={`text-center py-8 ${theme?.isMalam ? 'text-slate-400' : 'text-slate-500'}`}>
                    Tidak ditemukan hasil untuk "{queryText}"
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {/* REKOMENDASI KEYWORD */}
                <h2 className={`text-2xl font-bold tracking-tight leading-tight mb-4 ${
                  theme?.isMalam ? 'text-white' : 'text-slate-900'
                }`}>
                  {queryText ? `Mencari "${queryText}"` : 'Cari suasana di sekitarmu'}
                </h2>
                
                <div className="mt-4 space-y-2">
                  {rekomendasiKalimat.map((kalimat, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => handleSelectRekomendasi(kalimat)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all
                        ${theme?.isMalam 
                          ? 'border-slate-700 hover:bg-white/5' 
                          : 'border-slate-200 hover:bg-slate-50'}`}
                    >
                      <p className={`text-[14px] font-medium ${
                        theme?.isMalam ? 'text-white' : 'text-slate-900'
                      }`}>
                        {kalimat}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* FEED NORMAL - MUNCUL SAAT TIDAK SEARCH ATAU SUDAH SELESAI SEARCH */}
        {(!isSearchActive || (hasSearched && filteredPlaces.length === 0)) && (
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
        )}
      </div>

      {/* MODALS */}
      <AISearchModal
        isOpen={showAISearchModal}
        onClose={closeModals}
        query={queryText}
        villageLocation={villageLocation}
        locationReady={locationReady}
      />
      <AIModal
        isOpen={showAIModal}
        onClose={closeModals}
        tempat={selectedTempat}
        context={aiContext}
      />
      <KomentarModal
        isOpen={showKomentarModal}
        onClose={closeModals}
        tempat={selectedTempat}
        initialComments={selectedTempat ? comments[selectedTempat.id] || [] : []}
      />

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