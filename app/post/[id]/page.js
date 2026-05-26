"use client";

import { use, useEffect, useState, useCallback, useRef, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useTheme } from "@/app/hooks/useTheme";
import { useAuth } from "@/app/context/AuthContext";
import { useLocation } from "@/components/LocationProvider";
import { usePostDetail } from "@/hooks/usePostDetail";
import { supabase } from "@/lib/supabaseClient";
import SmartCitizenButton from "@/app/components/feed/SmartCitizenButton";
import AIInsight from "@/components/v2/AIInsight";
import { MessageCircle, Sparkles, X } from "lucide-react";

// Components
import RekomendasiFeed from "@/components/feed/RekomendasiFeed";
import Header from "@/components/Header";
import LocationModal from "@/components/LocationModal";
import AuthModal from "@/app/components/auth/AuthModal";
import AIModalDetail from "@/app/components/ai/AIModalDetail";
import KomentarModal from "@/app/components/feed/KomentarModal";
import SmartBottomNav from "@/app/components/layout/SmartBottomNav";
import HeroCard from "@/components/v2/HeroCard";
import StoryStrip from "@/components/v2/StoryStrip";

// V2 Components dengan Lazy Load
import dynamic from 'next/dynamic';

const MiniMapV2 = dynamic(
  () => import('@/components/v2/maps/MiniMapV2'),
  {
    ssr: false,
    loading: () => <div className="h-48 w-full rounded-[24px] animate-pulse bg-gray-200 dark:bg-gray-800" />
  }
);

const NearbyMicroSignals = dynamic(
  () => import('@/components/v2/feed/NearbyMicroSignals'),
  { ssr: false }
);

const SolutionRadar = dynamic(
  () => import('@/components/v2/feed/SolutionRadar'),
  { ssr: false }
);

// ============ MAIN CONTENT ============
function PostDetailContent({ id }) {
  const router = useRouter();
  const theme = useTheme();
  const { user, userLocation } = useAuth();
  const { location, status: locationStatus, placeName } = useLocation();

  const radarRef = useRef(null);
  const mainContentRef = useRef(null);
  const heroRef = useRef(null);

  const { data: postData, loading, error: fetchError } = usePostDetail(id, {
    cacheDuration: 5 * 60 * 1000
  });

  const item = postData?.item || null;
  const comments = postData?.comments || {};

  const tempatName = item?.name || "tempat ini";
  const kategori = item?.category || "umum";
  const adminPhone = item?.admin_phone || "628123456789";

  const distance = getDistanceFromLatLonInKm(
    location?.lat,
    location?.lng,
    item?.latitude,
    item?.longitude
  );
  const isInRadius = distance <= 0.5;

  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("profil");
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showKomentarModal, setShowKomentarModal] = useState(false);
  const [selectedTempat, setSelectedTempat] = useState(null);
  const [initialQuery, setInitialQuery] = useState("");
  const [toast, setToast] = useState({ show: false, message: "" });
  const [isExpanded, setIsExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedHeroStory, setSelectedHeroStory] = useState(null);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);

  const isMalam = theme.isMalam;
  const heroData = selectedHeroStory || item;

  // Optimasi scroll dengan IntersectionObserver
  useEffect(() => {
    setIsScrolled(window.scrollY > 30);

    const observer = new IntersectionObserver(
      ([entry]) => {
        setActiveSection(entry.isIntersecting ? "radar" : "profil");
      },
      { threshold: 0.2, rootMargin: "-100px 0px 0px 0px" }
    );

    if (radarRef.current) {
      observer.observe(radarRef.current);
    }

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 30);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const scrollToRadar = () => {
    radarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const handleOpenAIModal = useCallback((query = "") => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    if (!item) return;
    const finalQuery = query || `Analisis situasi terkini di ${item.name}. Kondisi saat ini: ${item.latest_condition || item.status || "Normal"}. Berikan rekomendasi dan solusi.`;
    setSelectedTempat(item);
    setInitialQuery(finalQuery);
    setShowAIModal(true);
  }, [user, item]);

  const openAI = useCallback((context = "info", query = "") => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    if (!item) return;
    setSelectedTempat(item);
    setInitialQuery(query);
    setShowAIModal(true);
  }, [user, item]);

  const handleSelectStory = useCallback((story, index) => {
    const formattedStory = {
      ...story,
      id: story.id,
      name: item?.name,
      parentName: item?.name,
      latest_condition: story.status,
      status: story.status,
      created_at: story.created_at,
      updated_at: story.created_at,
      photo_url: story.photo_url || story.image_url,
      deskripsi: story.deskripsi,
      laporan_terbaru: [story]
    };
    setSelectedHeroStory(formattedStory);
    setCurrentStoryIndex(index);
    setTimeout(() => {
      heroRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, [item]);

  const handleBackToOriginal = useCallback(() => {
    setSelectedHeroStory(null);
    setCurrentStoryIndex(0);
  }, []);

  // Optimasi log view dengan debounce
  useEffect(() => {
    if (!item?.id || !user?.id) return;

    const timer = setTimeout(() => {
      const logDetailView = async () => {
        try {
          await supabase
            .from('external_signals')
            .insert({
              tempat_id: item.id,
              source: 'user_activity',
              source_id: `${user.id}_${item.id}_${Date.now()}`,
              username: user.id,
              content: 'view_detail',
              source_platform: 'setempat_app',
              created_at: new Date().toISOString(),
              fetched_at: new Date().toISOString(),
              confidence: 1.0,
              verified: true,
              verification_level: 'high',
              source_tier: 1
            });
        } catch (err) {
          console.warn('Failed to log detail view:', err);
        }
      };
      logDetailView();
    }, 2000);

    return () => clearTimeout(timer);
  }, [item?.id, user?.id]);

  const handleShare = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setToast({ show: true, message: "✅ Link tersalin!" });
      setTimeout(() => setToast({ show: false, message: "" }), 2000);
    } catch (err) {
      console.error("Share failed:", err);
    }
  }, []);

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme.bg}`}>
        <div className="h-8 w-8 border-[3px] border-t-[#E3655B] border-r-[#E3655B] border-b-[#25F4EE] border-l-[#25F4EE] rounded-full animate-spin" />
      </div>
    );
  }

  if (fetchError || !item) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-10 ${theme.bg}`}>
        <p className="opacity-40 font-bold uppercase text-[10px] tracking-widest">Data Tidak Ditemukan</p>
        <button onClick={() => router.push('/')} className="mt-4 px-6 py-2 bg-white/5 rounded-full text-xs">Kembali</button>
      </div>
    );
  }

  return (
    <div className={`relative min-h-screen w-full ${theme.bg} ${theme.text} transition-colors duration-500`}>
      <div className="fixed inset-0 pointer-events-none z-0 flex justify-center">
        <div className={`w-full max-w-[420px] h-[60vh] opacity-20 blur-[120px] rounded-full ${isMalam ? 'bg-cyan-900' : 'bg-cyan-100'}`} />
      </div>

      <div className="relative z-10">
        <div className="fixed top-0 left-0 right-0 z-[100] flex justify-center pointer-events-none">
          <div className="w-full max-w-[420px] pointer-events-auto">
            <Header
              user={user}
              locationReady={locationStatus === "granted"}
              villageLocation={placeName?.split(",")[0] || "Lokasi"}
              isScrolled={isScrolled}
              onOpenLocationModal={() => setIsLocationModalOpen(true)}
            />
          </div>
        </div>

        <main ref={mainContentRef} className="mx-auto w-full max-w-[420px] px-2 pt-20 pb-36">
          {/* 1. HERO CARD & AI INSIGHT */}
          <div ref={heroRef} className="relative mb-2">
            <div>
              {/* Container Foto */}
              <div className="relative rounded-[32px] overflow-hidden">
                <HeroCard
                  tempatId={heroData?.id}
                  userName={item.user_name}
                  userAvatar={item.user_avatar}
                  namaTempat={heroData?.name}
                  status={heroData?.latest_condition || heroData?.status || "LANCAR"}
                  photos={heroData?.laporan_terbaru || heroData?.photos || []}
                  priority={true}
                  lastUpdate={heroData?.updated_at || heroData?.created_at}
                  description={heroData?.laporan_terbaru?.[0]?.deskripsi}
                  onRefresh={handleRefresh}
                  refreshing={refreshing}
                  isStoryMode={!!selectedHeroStory}
                  onBackToOriginal={handleBackToOriginal}
                />
              </div>

              {/* AI INSIGHT */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedHeroStory ? `flashback-${selectedHeroStory.id}` : "live"}
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-4 p-4 rounded-3xl border border-white/10 bg-zinc-900/50 backdrop-blur-xl shadow-lg"
                >
                  <div className="flex items-center gap-2 mb-3 opacity-60">
                    <Sparkles size={12} className={selectedHeroStory ? "text-cyan-400" : "text-amber-400"} />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                      {selectedHeroStory ? "Analisis Flashback" : "Kondisi Terkini"}
                    </span>
                  </div>
                  <AIInsight
                    activeTempat={heroData}
                    mode={selectedHeroStory ? "flashback" : "live"}
                    theme={theme}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* STORY STRIP */}
          {item.laporan_terbaru && item.laporan_terbaru.filter(l => l?.photo_url || l?.image_url).length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="mt-4"
            >
              <StoryStrip
                laporanWarga={item.laporan_terbaru}
                tempatId={item.id}
                namaTempat={item.name}
                onSelectStory={handleSelectStory}
                activeStoryId={selectedHeroStory?.id}
                theme={theme}
              />
            </motion.div>
          )}

          {/* SMART CITIZEN BUTTON */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-2 mx-2 relative z-20"
          >
            <SmartCitizenButton
              tempatId={item.id}
              tempatName={item.name}
              kategori={kategori}
              tempatLatitude={item.latitude}
              tempatLongitude={item.longitude}
              userLocation={userLocation}
              isInRadius={isInRadius}
              adminPhone={adminPhone}
              handleOpenAIModal={handleOpenAIModal}
              onUpdate={() => router.refresh()}
            />
          </motion.div>

          {/* Tab Navigation */}
          <div className="flex items-center justify-between mt-6 mb-4 px-2">
            <div className="flex flex-col">
              <h2 className="text-xl font-[1000] tracking-tighter italic">DETAIL INFO</h2>
              <p className="text-[9px] opacity-40 uppercase tracking-widest font-bold">Scanning Local Intelligence...</p>
            </div>
            <div className="flex items-center gap-3 bg-black/5 dark:bg-white/5 p-1.5 rounded-2xl border border-black/5 dark:border-white/5">
              <button
                onClick={scrollToTop}
                className={`px-4 py-1.5 rounded-xl transition-all duration-300 text-[9px] font-black uppercase ${activeSection === 'profil' ? 'bg-white dark:bg-zinc-800 shadow-md opacity-100' : 'opacity-30 hover:opacity-60'}`}
              >
                Profil
              </button>
              <button
                onClick={scrollToRadar}
                className={`px-4 py-1.5 rounded-xl transition-all duration-300 text-[9px] font-black uppercase ${activeSection === 'radar' ? 'bg-white dark:bg-zinc-800 shadow-md opacity-100' : 'opacity-30 hover:opacity-60'}`}
              >
                Radar
              </button>
            </div>
          </div>

          {/* Radar Section */}
          <motion.section
            ref={radarRef}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className={`p-6 rounded-[40px] border ${isMalam ? 'bg-zinc-950/50 border-white/10' : 'bg-white border-black/5'} backdrop-blur-3xl shadow-2xl relative overflow-hidden`}
          >
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/10 blur-[80px] rounded-full" />
            <div className="flex items-center justify-between mb-6 relative z-10">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500">Live Setempat</h3>
                </div>
                <p className="text-lg font-[1000] tracking-tighter">PANTAUAN WARGA</p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-2xl shadow-lg shadow-amber-500/20">
                🛰️
              </div>
            </div>

            {/* MiniMap dengan Lazy Load */}
            <div className="h-48 w-full rounded-[24px] overflow-hidden mb-6 border-2 border-black/5 dark:border-white/5 shadow-inner">
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

            {/* Nearby Micro Signals dengan Lazy Load */}
            <div className="mb-8">
              <NearbyMicroSignals tempatId={item.id} theme={theme} />
            </div>

            {/* Solution Radar dengan Lazy Load */}
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Solusi Sekitar</p>
                <span className="text-[9px] opacity-30 font-bold italic">Radius 1KM</span>
              </div>
              <SolutionRadar item={item} theme={theme} userLocation={location} />
            </div>
          </motion.section>

          {/* Rekomendasi */}
          <div className="mt-16 mb-6 px-2">
            <h3 className="text-sm font-black uppercase tracking-tighter italic">REKOMENDASI TEMPAT</h3>
          </div>
          <RekomendasiFeed
            currentItemId={parseInt(id)}
            userLocation={location}
            locationReady={locationStatus === "granted"}
            theme={theme}
            onOpenAIModal={(it) => openAI("info", `Ceritakan tentang ${it.name}.`)}
          />
        </main>
      </div>

      {/* Floating Button */}
      <div className="fixed bottom-24 right-6 z-[99] flex flex-col items-end gap-3.5 select-none">
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.85 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-3 mb-1"
            >
              <button
                onClick={() => {
                  handleOpenAIModal(`Halo! Tolong ringkas kondisi ${tempatName} untuk kategori ${kategori}`);
                  setIsExpanded(false);
                }}
                className="flex items-center gap-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white px-4 py-2.5 rounded-xl shadow-xl border border-white/10 active:scale-95 transition-all"
              >
                <div className="flex flex-col items-end">
                  <span className="text-xs font-black uppercase tracking-wider">Takon AI</span>
                  <span className="text-[8px] opacity-70 font-bold uppercase tracking-tight italic">Smart Info</span>
                </div>
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center backdrop-blur-sm">
                  <Sparkles size={16} className="text-amber-200 animate-pulse" />
                </div>
              </button>
              <button
                onClick={() => {
                  window.open(`https://wa.me/${adminPhone}?text=Halo Admin ${tempatName}...`);
                  setIsExpanded(false);
                }}
                className="flex items-center gap-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-2.5 rounded-xl shadow-xl border border-white/10 active:scale-95 transition-all"
              >
                <div className="flex flex-col items-end">
                  <span className="text-xs font-black uppercase tracking-wider">Chat Admin</span>
                  <span className="text-[8px] opacity-70 font-bold uppercase tracking-tight italic">Wong Pusat</span>
                </div>
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center backdrop-blur-sm">
                  <MessageCircle size={16} className="text-emerald-200" />
                </div>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <motion.button
          onClick={() => setIsExpanded(!isExpanded)}
          whileTap={{ scale: 0.92 }}
          className={`w-16 h-16 rounded-full flex items-center justify-center shadow-2xl border-2 transition-all duration-300 relative ${isExpanded ? 'bg-zinc-900 border-zinc-800' : 'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800'}`}
        >
          <div className="relative flex items-center justify-center w-full h-full">
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0, opacity: isExpanded ? 0 : 1, scale: isExpanded ? 0.6 : 1 }}
              transition={{ duration: 0.2 }}
              className="absolute"
            >
              <svg viewBox="0 0 24 24" className="w-9 h-9 fill-amber-600 dark:fill-amber-400">
                <path d="M6 14C6 17.3 8.7 20 12 20C15.3 20 18 17.3 18 14V13H6V14Z" />
                <path d="M5.5 12C5.5 8 8 5 12 5C16 5 18.5 8 18.5 12C16.5 11 14.5 10.5 12 10.5C9.5 10.5 7.5 11 5.5 12Z" className="fill-amber-700 dark:fill-amber-500" />
                <circle cx="12" cy="4.5" r="1.8" className="fill-amber-700 dark:fill-amber-500" />
                <path d="M6.5 9.5L12 11L17.5 9.5" stroke="currentColor" strokeWidth="1" fill="none" className="text-white/40" />
                <circle cx="9.5" cy="14.5" r="1" fill="currentColor" />
                <circle cx="14.5" cy="14.5" r="1" fill="currentColor" />
                <path d="M10 17C10 17 11 18.2 12 18.2C13 18.2 14 17 14 17" stroke="currentColor" strokeWidth="1.2" fill="none" />
              </svg>
            </motion.div>
            {!isExpanded && (
              <span className="absolute top-4 right-4 flex h-2.5 w-2.5">
                <span className="animate-ping absolute h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative rounded-full h-2.5 w-2.5 bg-amber-500" />
              </span>
            )}
          </div>
        </motion.button>
      </div>

      {/* Modals */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      <LocationModal isOpen={isLocationModalOpen} onClose={() => setIsLocationModalOpen(false)} />
      <AIModalDetail isOpen={showAIModal} onClose={() => setShowAIModal(false)} item={selectedTempat} userId={user?.id} initialQuery={initialQuery} />
      <KomentarModal isOpen={showKomentarModal} onClose={() => setShowKomentarModal(false)} tempat={selectedTempat} />

      <SmartBottomNav />

      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[150] px-6 py-3 rounded-full bg-zinc-900 border border-white/20 text-white text-[10px] font-bold"
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Helper function untuk hitung jarak
const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 999;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default function PostDetailPage({ params }) {
  const { id } = use(params);
  return <PostDetailContent id={id} />;
}