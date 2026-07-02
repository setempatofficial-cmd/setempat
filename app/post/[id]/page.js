"use client";

// ============ 1. REACT & THIRD-PARTY IMPORTS ============
import { use, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { MessageCircle, Sparkles, X } from "lucide-react";

// ============ 2. HOOKS & CONTEXTS ============
import { useTheme } from "@/app/hooks/useTheme";
import { useAuth } from "@/app/context/AuthContext";
import { useLocation } from "@/components/LocationProvider";
import { usePostDetail } from "@/hooks/usePostDetail";
import { supabase } from "@/lib/supabaseClient";

// ============ 3. STATIC COMPONENTS ============
import SmartCitizenButton from "@/app/components/feed/SmartCitizenButton";
import AIInsight from "@/components/v2/AIInsight";
import RekomendasiFeed from "@/components/feed/RekomendasiFeed";
import Header from "@/components/Header";
import LocationModal from "@/components/LocationModal";
import AuthModal from "@/app/components/auth/AuthModal";
import AIModalDetail from "@/app/components/ai/AIModalDetail";
import KomentarModal from "@/app/components/feed/KomentarModal";
import SmartBottomNav from "@/app/components/layout/SmartBottomNav";
import HeroCard from "@/components/v2/HeroCard";
import StoryStrip from "@/components/v2/StoryStrip";

// ============ 4. DYNAMIC COMPONENTS (LAZY LOAD) ============
const MiniMapV2 = dynamic(
  () => import("@/components/v2/maps/MiniMapV2"),
  {
    ssr: false,
    loading: () => <div className="h-44 w-full rounded-[24px] bg-zinc-100 dark:bg-zinc-900/50 border border-black/5 dark:border-white/5 animate-pulse" />
  }
);

const NearbyMicroSignals = dynamic(
  () => import("@/components/v2/feed/NearbyMicroSignals"),
  { ssr: false }
);

const SolutionRadar = dynamic(
  () => import("@/components/v2/feed/SolutionRadar"),
  { ssr: false }
);

// ============ 5. UTILITY FUNCTIONS ============
const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 999;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// ============ MAIN CONTENT COMPONENT ============
function PostDetailContent({ id }) {
  // --- Routers & Contexts ---
  const router = useRouter();
  const theme = useTheme();
  const { user } = useAuth();
  const { location, status: locationStatus, placeName } = useLocation();

  // --- Refs untuk Memory Leak Protection ---
  const radarRef = useRef(null);
  const heroRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const storyTimerRef = useRef(null);

  // --- Data Fetching ---
  const { data: postData, loading, error: fetchError } = usePostDetail(id, {
    cacheDuration: 5 * 60 * 1000
  });

  const item = postData?.item || null;
  const tempatName = item?.name || "tempat ini";
  const kategori = item?.category || "umum"; // Aman, sudah fallback ke 'category' sesuai struktur DB
  const adminPhone = item?.admin_phone || "628123456789";

  // --- States ---
  const [distance, setDistance] = useState(999);
  const [isInRadius, setIsInRadius] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("profil");
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showKomentarModal, setShowKomentarModal] = useState(false);
  const [selectedTempat, setSelectedTempat] = useState(null);
  const [initialQuery, setInitialQuery] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // --- Story States ---
  const [isStoryOpen, setIsStoryOpen] = useState(false);
  const [selectedHeroStory, setSelectedHeroStory] = useState(null);

  // --- Derived Variables ---
  const isMalam = theme.isMalam;
  const heroData = selectedHeroStory || item;
  const isLocationActuallyReady = locationStatus === "granted" && !!location?.lat && !!location?.lng;

  // hitung jumlah laporan foto yang valid secara memoized agar tidak memicu re-render berat
  const totalLaporanFoto = useMemo(() => {
    if (!item?.laporan_terbaru) return 0;
    return item.laporan_terbaru.filter((l) => l?.photo_url || l?.image_url).length;
  }, [item?.laporan_terbaru]);

  // --- Clean Up Timers on Unmount ---
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      if (storyTimerRef.current) clearTimeout(storyTimerRef.current);
    };
  }, []);

  // --- Effects ---

  // 1. Kalkulasi Jarak & Lokasi
  useEffect(() => {
    if (location?.lat && location?.lng && item?.latitude && item?.longitude) {
      const calculatedDistance = getDistanceFromLatLonInKm(
        location.lat,
        location.lng,
        item.latitude,
        item.longitude
      );
      setDistance(calculatedDistance);
      setIsInRadius(calculatedDistance <= 0.5);
    }
  }, [location?.lat, location?.lng, item?.latitude, item?.longitude]);

  // 2. Observer Scroll & Sticky Nav (Dioptimalkan menggunakan passive listener & cleanup otomatis)
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        setActiveSection(entry.isIntersecting ? "radar" : "profil");
      },
      { threshold: 0.15, rootMargin: "-120px 0px 0px 0px" }
    );

    const currentRadarRef = radarRef.current;
    if (currentRadarRef) observer.observe(currentRadarRef);
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      if (currentRadarRef) observer.unobserve(currentRadarRef);
      observer.disconnect();
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // 3. Log View Detail (Debounced & Safe dari duplicate call ganda)
  useEffect(() => {
    if (!item?.id || !user?.id) return;

    const timer = setTimeout(() => {
      const logDetailView = async () => {
        try {
          await supabase.from("external_signals").insert({
            tempat_id: item.id,
            source: "user_activity",
            source_id: `view_${user.id}_${item.id}_${Math.floor(Date.now() / 60000)}`, // Mencegah spam duplikasi log per menit
            username: user.id,
            content: "view_detail",
            source_platform: "setempat_app",
            created_at: new Date().toISOString(),
            fetched_at: new Date().toISOString(),
            confidence: 1.0,
            verified: true,
            verification_level: "high",
            source_tier: 1
          });
        } catch (err) {
          console.warn("Failed to log detail view:", err);
        }
      };
      logDetailView();
    }, 2000);

    return () => clearTimeout(timer);
  }, [item?.id, user?.id]);

  // --- Handlers ---
  const scrollToRadar = useCallback(() => radarRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), []);
  const scrollToTop = useCallback(() => window.scrollTo({ top: 0, behavior: "smooth" }), []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    router.refresh();

    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => setRefreshing(false), 800);
  }, [router]);

  const handleOpenAIModal = useCallback(
    (query = "") => {
      if (!user) return setIsAuthModalOpen(true);
      if (!item) return;
      const finalQuery = query || `Analisis situasi terkini di ${item.name}. Kondisi saat ini: ${item.latest_condition || item.status || "Normal"}. Berikan rekomendasi dan solusi.`;
      setSelectedTempat(item);
      setInitialQuery(finalQuery);
      setShowAIModal(true);
    },
    [user, item]
  );

  const openAI = useCallback(
    (context = "info", query = "") => {
      if (!user) return setIsAuthModalOpen(true);
      if (!item) return;
      setSelectedTempat(item);
      setInitialQuery(query);
      setShowAIModal(true);
    },
    [user, item]
  );

  const handleSelectStory = useCallback((story, fullCategoryStories, categoryId, storyIndex) => {
    if (!story) return;

    const formattedStory = {
      ...story,
      id: story.id,
      name: item?.name,
      photo_url: story.photo_url,
      video_url: story.video_url || null, // Amankan jika ada tipe video
      title: story.title,
      user_name: story.user_name,
      deskripsi: story.title,
      status: story.type === "warga" ? "STORY" : "OFFICIAL",

      // FIX UTAMA: Inject full stories dari kategori aktif ke dalam object 
      // agar HeroCard bisa membaca total array barunya secara live
      laporan_terbaru: fullCategoryStories,
      currentCategoryId: categoryId,
      currentStoryIndex: storyIndex
    };

    setSelectedHeroStory(formattedStory);
  }, [item?.name]);

  const handleBackToOriginal = useCallback(() => {
    setSelectedHeroStory(null);
  }, []);

  // --- Render Loading & Error ---
  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme.bg}`}>
        <div className="h-8 w-8 border-[3px] border-t-cyan-500 border-r-cyan-500 border-b-indigo-500 border-l-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (fetchError || !item) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-10 ${theme.bg} ${theme.text}`}>
        <p className="opacity-40 font-bold uppercase text-[10px] tracking-widest">Waduh, Data Tidak Ditemukan</p>
        <button onClick={() => router.push("/")} className="mt-4 px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-xs transition-all">
          Kembali ke Beranda
        </button>
      </div>
    );
  }

  return (
    <div className={`relative min-h-screen w-full ${theme.bg} ${theme.text} transition-colors duration-500 pb-32 overflow-x-hidden`}>

      {/* Ambient Background Glow - Context Aware */}
      <div className="fixed inset-0 pointer-events-none z-0 flex justify-center overflow-hidden">
        <div className={`w-full max-w-[420px] h-[50vh] opacity-20 blur-[130px] rounded-full transition-colors duration-500 ${isMalam ? "bg-cyan-950" : "bg-cyan-200"}`} />
      </div>

      <div className="relative z-10 flex justify-center w-full">
        {/* Fixed Header Wrapper */}
        <div className="fixed top-0 z-[100] w-full max-w-[420px] px-1 pointer-events-none">
          <div className="pointer-events-auto">
            <Header
              user={user}
              locationReady={isLocationActuallyReady}
              villageLocation={placeName?.split(",")[0] || "Pasuruan"}
              isScrolled={isScrolled}
              onOpenLocationModal={() => setIsLocationModalOpen(true)}
            />
          </div>
        </div>

        {/* Main Workspace Layout Container */}
        <main className="w-full max-w-[420px] px-3 pt-[88px] flex flex-col space-y-5">

          {/* ============ STACK 1 & 2: HERO + LIVE STORY COLLAPSIBLE ============ */}
          <div ref={heroRef} className="flex flex-col w-full relative">
            <div className="w-full relative z-10 [will-change:transform]">
              <div className="rounded-[32px] overflow-hidden w-full shadow-xl bg-zinc-900/10 dark:bg-black/10">
                <HeroCard
                  tempatId={heroData?.id}
                  userName={item.user_name}
                  userAvatar={item.user_avatar}
                  namaTempat={heroData?.name}
                  status={heroData?.latest_condition || heroData?.status || "LANCAR"}
                  photos={item?.laporan_terbaru || item?.photos || []}
                  activeIndex={selectedHeroStory ? (item?.laporan_terbaru || []).findIndex(l => l.id === selectedHeroStory.id) : 0}
                  priority={true}
                  lastUpdate={item?.updated_at || item?.created_at}
                  description={selectedHeroStory?.deskripsi || heroData?.laporan_terbaru?.[0]?.deskripsi}
                  onRefresh={handleRefresh}
                  refreshing={refreshing}
                  isStoryMode={!!selectedHeroStory}
                  onBackToOriginal={handleBackToOriginal}
                  isStoryOpen={isStoryOpen}
                  onOpenStoryTrip={() => setIsStoryOpen(true)}
                  totalLaporanFoto={totalLaporanFoto}

                  // ================= FIX UTAMA DI SINI =================
                  storySlideshowStories={selectedHeroStory ? selectedHeroStory.laporan_terbaru : []}
                  storySlideshowIndex={selectedHeroStory ? selectedHeroStory.currentStoryIndex : 0}
                  onStoryIndexChange={(newIndex) => {
                    if (selectedHeroStory) {
                      setSelectedHeroStory({
                        ...selectedHeroStory,
                        currentStoryIndex: newIndex
                      });
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* ============ STACK 3: AI INSIGHT BLOCK ============ */}
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedHeroStory ? `flashback-${selectedHeroStory.id}` : "live"}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="w-full pt-2"
            >
              <div className="p-4 rounded-[28px] border border-black/5 dark:border-white/5 bg-zinc-100/80 dark:bg-zinc-950/40 backdrop-blur-xl shadow-xl">
                <div className="flex items-center gap-1.5 mb-3 opacity-60 px-1">
                  <Sparkles size={12} className={selectedHeroStory ? "text-cyan-500" : "text-amber-500"} />
                  <span className="text-[9px] font-black uppercase tracking-[0.2em]">
                    {selectedHeroStory ? "Analisis Flashback" : "Kondisi Terkini AI"}
                  </span>
                </div>
                <AIInsight activeTempat={heroData} mode={selectedHeroStory ? "flashback" : "live"} theme={theme} />
              </div>
            </motion.div>
          </AnimatePresence>

          {/* ============ STACK 4: SMART ACTION HUB ============ */}
          <div className="w-full">
            <SmartCitizenButton
              tempatId={item.id}
              tempatName={item.name}
              kategori={kategori}
              tempatLatitude={item.latitude}
              tempatLongitude={item.longitude}
              adminPhone={adminPhone}
              handleOpenAIModal={handleOpenAIModal}
              onUpdate={handleRefresh}
              // 🔥 PASTIKAN location dikirim dengan benar
              userLocation={{
                latitude: location?.latitude || location?.lat,
                longitude: location?.longitude || location?.lng
              }}
            />
          </div>

          {/* ============ STACK 5: SECTION TABS & HEADER ============ */}
          <div className="flex items-center justify-between pt-4 px-1">
            <div className="flex flex-col">
              <h2 className="text-lg font-[1000] tracking-tight italic">DETAIL INFO</h2>
              <p className="text-[9px] opacity-40 uppercase tracking-widest font-bold">Scanning Local Intelligence...</p>
            </div>
            <div className="flex items-center gap-2 bg-black/5 dark:bg-white/5 p-1 rounded-2xl border border-black/5 dark:border-white/5">
              <button
                onClick={scrollToTop}
                className={`px-4 py-1.5 rounded-xl transition-all duration-300 text-[9px] font-black uppercase ${activeSection === "profil" ? "bg-white dark:bg-zinc-800 shadow-sm opacity-100 text-black dark:text-white" : "opacity-40 hover:opacity-70"}`}
              >
                Profil
              </button>
              <button
                onClick={scrollToRadar}
                className={`px-4 py-1.5 rounded-xl transition-all duration-300 text-[9px] font-black uppercase ${activeSection === "radar" ? "bg-white dark:bg-zinc-800 shadow-sm opacity-100 text-black dark:text-white" : "opacity-40 hover:opacity-70"}`}
              >
                Radar
              </button>
            </div>
          </div>

          {/* ============ STACK 6: LIVE SETEMPAT RADAR ============ */}
          <motion.section
            ref={radarRef}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`p-5 rounded-[32px] border ${isMalam ? "bg-zinc-950/60 border-white/10" : "bg-white border-black/5"} backdrop-blur-3xl shadow-xl relative overflow-hidden transform-gpu`}
          >
            <div className="absolute -top-24 -right-24 w-44 h-44 bg-amber-500/5 blur-[70px] rounded-full pointer-events-none" />

            <div className="flex items-center justify-between mb-5 relative z-10">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-500">Live Setempat</h3>
                </div>
                <p className="text-base font-[1000] tracking-tighter">PANTAUAN WARGA</p>
              </div>
              <div className="h-11 w-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-xl shadow-md shadow-amber-500/10">
                🛰️
              </div>
            </div>

            <div className="h-44 w-full rounded-[24px] overflow-hidden mb-5 border border-black/5 dark:border-white/5 shadow-inner">
              <MiniMapV2
                lat={item.latitude}
                lng={item.longitude}
                theme={theme}
                radius={1}
                showRadius={true}
                isInteractive={false}
                tempatId={item.id}
                showSignals={true}
              />
            </div>

            <div className="space-y-6">
              <NearbyMicroSignals tempatId={item.id} theme={theme} />
              <div className="pt-2 border-t border-black/5 dark:border-white/5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Solusi Sekitar</p>
                  <span className="text-[9px] opacity-30 font-bold italic">Radius 1KM</span>
                </div>
                <SolutionRadar item={item} theme={theme} userLocation={isLocationActuallyReady ? location : null} />
              </div>
            </div>
          </motion.section>

          {/* ============ STACK 7: DEEP LOOK RECOMENDATION FEED ============ */}
          <div className="pt-4 flex flex-col space-y-3">
            <div className="px-1">
              <h3 className="text-xs font-black uppercase tracking-wider italic opacity-80">REKOMENDASI TEMPAT</h3>
            </div>
            <div>
              <RekomendasiFeed
                currentItemId={parseInt(id)}
                userLocation={location}
                locationReady={locationStatus === "granted"}
                theme={theme}
                onOpenAIModal={(it) => openAI("info", `Ceritakan tentang ${it.name}.`)}
              />
            </div>
          </div>

        </main>
      </div>

      {/* ============ GLOBAL MODAL STORY STRIP (BOTTOM SHEET) ============ */}
      <StoryStrip
        isOpen={isStoryOpen}
        onClose={() => setIsStoryOpen(false)}
        laporanWarga={item.laporan_terbaru || []}
        tempat={item}
        onSelectStory={handleSelectStory}
        activeStoryId={selectedHeroStory?.id}  // ← penting untuk tracking
      />

      {/* ============ FLOATING ACTION BUTTON (DOCK-STYLE) ============ */}
      <div className="fixed bottom-24 right-5 z-[99] flex flex-col items-end gap-3 select-none">
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.9 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col gap-2.5 mb-1"
            >
              <button
                onClick={() => {
                  handleOpenAIModal(`Halo! Tolong ringkas kondisi ${tempatName} untuk kategori ${kategori}`);
                  setIsExpanded(false);
                }}
                className="flex items-center gap-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white px-4 py-2.5 rounded-2xl shadow-xl border border-white/10 active:scale-95 transition-all"
              >
                <div className="flex flex-col items-end">
                  <span className="text-xs font-black uppercase tracking-wider">Takon AI</span>
                  <span className="text-[8px] opacity-75 font-bold uppercase tracking-tight italic">Smart Info</span>
                </div>
                <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-sm">
                  <Sparkles size={15} className="text-amber-200 animate-pulse" />
                </div>
              </button>

              <button
                onClick={() => {
                  window.open(`https://wa.me/${adminPhone}?text=Halo%20Admin%20${encodeURIComponent(tempatName)}...`);
                  setIsExpanded(false);
                }}
                className="flex items-center gap-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-2.5 rounded-2xl shadow-xl border border-white/10 active:scale-95 transition-all"
              >
                <div className="flex flex-col items-end">
                  <span className="text-xs font-black uppercase tracking-wider">Chat Admin</span>
                  <span className="text-[8px] opacity-75 font-bold uppercase tracking-tight italic">Wong Pusat</span>
                </div>
                <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-sm">
                  <MessageCircle size={15} className="text-emerald-200" />
                </div>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          onClick={() => setIsExpanded(!isExpanded)}
          whileTap={{ scale: 0.94 }}
          className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl border transition-all duration-300 relative ${isExpanded ? "bg-zinc-900 border-zinc-800" : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"}`}
        >
          <div className="relative flex items-center justify-center w-full h-full">
            <AnimatePresence mode="wait">
              {isExpanded ? (
                <motion.div
                  key="close-icon"
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <X size={20} className="text-white" />
                </motion.div>
              ) : (
                <motion.div
                  key="custom-dock-icon"
                  initial={{ rotate: 90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: -90, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="absolute"
                >
                  <svg viewBox="0 0 24 24" className="w-8 h-8 fill-amber-600 dark:fill-amber-400">
                    <path d="M6 14C6 17.3 8.7 20 12 20C15.3 20 18 17.3 18 14V13H6V14Z" />
                    <path d="M5.5 12C5.5 8 8 5 12 5C16 5 18.5 8 18.5 12C16.5 11 14.5 10.5 12 10.5C9.5 10.5 7.5 11 5.5 12Z" className="fill-amber-700 dark:fill-amber-500" />
                    <circle cx="12" cy="4.5" r="1.8" className="fill-amber-700 dark:fill-amber-500" />
                    <path d="M6.5 9.5L12 11L17.5 9.5" stroke="currentColor" strokeWidth="1" fill="none" className="text-white/40" />
                    <circle cx="9.5" cy="14.5" r="1" fill="currentColor" />
                    <circle cx="14.5" cy="14.5" r="1" fill="currentColor" />
                    <path d="M10 17C10 17 11 18.2 12 18.2C13 18.2 14 17 14 17" stroke="currentColor" strokeWidth="1.2" fill="none" />
                  </svg>
                </motion.div>
              )}
            </AnimatePresence>
            {!isExpanded && (
              <span className="absolute top-3.5 right-3.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative rounded-full h-2.5 w-2.5 bg-amber-500" />
              </span>
            )}
          </div>
        </motion.button>
      </div>

      {/* ============ MODALS & OVERLAYS ============ */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

      {/* BARIS YANG SUDAH DIPERBAIKI: */}
      <LocationModal isOpen={isLocationModalOpen} onClose={() => setIsLocationModalOpen(false)} />
      <AIModalDetail isOpen={showAIModal} onClose={() => setShowAIModal(false)} item={selectedTempat} userId={user?.id} initialQuery={initialQuery} />
      <KomentarModal isOpen={showKomentarModal} onClose={() => setShowKomentarModal(false)} tempat={selectedTempat} />
      <SmartBottomNav />
    </div>
  );
}

// ============ EXPORT PAGE ============
export default function PostDetailPage({ params }) {
  const { id } = use(params);
  return <PostDetailContent id={id} />;
}