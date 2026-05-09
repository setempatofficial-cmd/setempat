"use client";

import { use, useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { useRouter } from "next/navigation";
import { useTheme } from "@/app/hooks/useTheme";
import { useAuth } from "@/app/context/AuthContext";
import { useLocation } from "@/components/LocationProvider";
import { usePostDetail } from "@/hooks/usePostDetail";

// Components
import RekomendasiFeed from "@/components/feed/RekomendasiFeed";
import FeedCard from "@/app/components/feed/FeedCard";
import Header from "@/components/Header";
import LocationModal from "@/components/LocationModal";
import AuthModal from "@/app/components/auth/AuthModal";
import AIModalDetail from "@/app/components/ai/AIModalDetail";
import KomentarModal from "@/app/components/feed/KomentarModal";
import SmartBottomNav from "@/app/components/layout/SmartBottomNav";
import LaporPanel from "@/app/components/ai/LaporPanel";

// V2 Components
import MiniMapV2 from "@/components/v2/maps/MiniMapV2"; 
import NearbyMicroSignals from "@/components/v2/feed/NearbyMicroSignals";
import AIButton from "@/components/v2/feed/AIButton";
import SolutionRadar from "@/components/v2/feed/SolutionRadar";

function PostDetailContent({ id }) {
  const router = useRouter();
  const theme = useTheme();
  const { user } = useAuth();
  const { location, status: locationStatus, placeName } = useLocation();
  
  // Refs untuk Navigasi Internal
  const topRef = useRef(null);
  const radarRef = useRef(null);
  const mainContentRef = useRef(null);

  // Data Fetching
  const { data: postData, loading, error: fetchError } = usePostDetail(id, { 
    cacheDuration: 5 * 60 * 1000 
  });

  const item = postData?.item || null;
  const comments = postData?.comments || {};

  // UI States
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("profil");
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showKomentarModal, setShowKomentarModal] = useState(false);
  const [selectedTempat, setSelectedTempat] = useState(null);
  const [aiContext, setAiContext] = useState("info");
  const [initialQuery, setInitialQuery] = useState("");
  const [toast, setToast] = useState({ show: false, message: "" });

  const [showLaporPanel, setShowLaporPanel] = useState(false);

  const isMalam = theme.isMalam;

  // Scroll Monitoring
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 30);
      
      if (radarRef.current) {
        const radarPos = radarRef.current.offsetTop;
        if (window.scrollY + 100 > radarPos) {
          setActiveSection("radar");
        } else {
          setActiveSection("profil");
        }
      }
    };
    
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Handlers
  const scrollToRadar = () => {
    radarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ✅ AI Handler untuk AIButton v2
  const handleOpenAIModal = useCallback((query = "") => {
    console.log("handleOpenAIModal called:", { query, hasUser: !!user, item: item?.name });
    
    if (!user) { 
      setIsAuthModalOpen(true); 
      return; 
    }
    
    if (!item) {
      console.error("No item selected for AI modal");
      return;
    }
    
    const finalQuery = query || `Analisis situasi terkini di ${item.name}. Kondisi saat ini: ${item.latest_condition || item.status || "Normal"}. Berikan rekomendasi dan solusi.`;
    
    setSelectedTempat(item);
    setAiContext("solution");
    setInitialQuery(finalQuery);
    setShowAIModal(true);
  }, [user, item]);

  // ✅ Handler untuk laporan dari bottom nav (PINDAHKAN KE LUAR)
  const handleLaporanForm = useCallback(() => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    
    if (!item) return;
    
    // Buka AI Modal dengan query laporan
    handleOpenAIModal(
      `Saya ingin melaporkan kondisi terkini di ${item.name}.

Kondisi saat ini: ${item.latest_condition || 'Normal'}

Bagaimana caranya lapor kondisi terbaru.`
    );
  }, [user, item, handleOpenAIModal]);

  // ✅ Alternative handler for other contexts (untuk RekomendasiFeed)
  const openAI = useCallback((context = "info", query = "") => {
    console.log("openAI called:", { context, query, hasUser: !!user, item: item?.name });
    
    if (!user) { 
      setIsAuthModalOpen(true); 
      return; 
    }
    
    if (!item) {
      console.error("No item selected for AI modal");
      return;
    }
    
    setSelectedTempat(item);
    setAiContext(context);
    setInitialQuery(query);
    setShowAIModal(true);
  }, [user, item]);

  // Share Handler
  const handleShare = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setToast({ show: true, message: "✅ Link tersalin!" });
      setTimeout(() => setToast({ show: false, message: "" }), 2000);
    } catch (err) {
      console.error("Share failed:", err);
    }
  }, []);

  // Loading State
  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme.bg}`}>
        <div className="relative flex items-center justify-center">
          <div className="h-8 w-8 border-[3px] border-t-[#E3655B] border-r-[#E3655B] border-b-[#25F4EE] border-l-[#25F4EE] rounded-full animate-spin" style={{ animationDuration: '0.5s' }}></div>
        </div>
      </div>
    );
  }

  // Error State
  if (fetchError || !item) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-10 ${theme.bg}`}>
        <p className="opacity-40 font-bold uppercase text-[10px] tracking-widest">Data Tidak Ditemukan</p>
        <button 
          onClick={() => router.push('/')} 
          className="mt-4 px-6 py-2 bg-white/5 rounded-full text-xs hover:bg-white/10 transition-all"
        >
          Kembali
        </button>
      </div>
    );
  }

  return (
    <div className={`relative min-h-screen w-full ${theme.bg} ${theme.text} transition-colors duration-500`}>
      
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none z-0 flex justify-center">
        <div className={`w-full max-w-[420px] h-[60vh] opacity-20 blur-[120px] rounded-full ${isMalam ? 'bg-cyan-900' : 'bg-cyan-100'}`} />
      </div>

      <div className="relative z-10" ref={topRef}>
        {/* Header */}
        <div className="fixed top-0 left-0 right-0 z-[100] flex justify-center pointer-events-none">
          <div className="w-full max-w-[400px] pointer-events-auto">
            <Header
              user={user}
              locationReady={locationStatus === "granted"}
              villageLocation={placeName?.split(",")[0] || "Lokasi"}
              isScrolled={isScrolled}
              onOpenLocationModal={() => setIsLocationModalOpen(true)}
            />
          </div>
        </div>

        <main ref={mainContentRef} className="mx-auto w-full max-w-[420px] px-4 pt-20 pb-32">
          <LayoutGroup>
            
            {/* Feed Card */}
            <motion.div 
              layout 
              initial={{ opacity: 0, scale: 0.98 }} 
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <FeedCard
                item={item}
                isDetail={true} 
                showAIButton={false}
                location={location}
                locationReady={locationStatus === "granted"}
                comments={comments}
                openKomentarModal={() => { 
                  setSelectedTempat(item); 
                  setShowKomentarModal(true); 
                }}
                onShare={handleShare}
              />
            </motion.div>

            {/* Tab Navigator */}
            <div className="flex items-center justify-between mt-8 mb-4 px-2">
              <div className="flex flex-col">
                <h2 className="text-xl font-[1000] tracking-tighter italic">DETAIL INFO</h2>
                <p className="text-[9px] opacity-40 uppercase tracking-widest font-bold">
                  Scanning Local Intelligence...
                </p>
              </div>
              
              <div className="flex items-center gap-3 bg-black/5 dark:bg-white/5 p-1.5 rounded-2xl border border-black/5 dark:border-white/5">
                <button 
                  onClick={scrollToTop} 
                  className={`px-4 py-1.5 rounded-xl transition-all duration-500 text-[9px] font-black uppercase 
                    ${activeSection === 'profil' 
                      ? 'bg-white dark:bg-zinc-800 shadow-md opacity-100' 
                      : 'opacity-30 hover:opacity-60'
                    }`}
                >
                  Profil
                </button>
                <button 
                  onClick={scrollToRadar} 
                  className={`px-4 py-1.5 rounded-xl transition-all duration-500 text-[9px] font-black uppercase 
                    ${activeSection === 'radar' 
                      ? 'bg-white dark:bg-zinc-800 shadow-md opacity-100' 
                      : 'opacity-30 hover:opacity-60'
                    }`}
                >
                  Radar
                </button>
              </div>
            </div>

            {/* AI Command Center */}
            <div className="mb-6">
              <AIButton 
                theme={theme}
                item={item}
                kondisi={item.latest_condition || item.status || "Normal"}
                handleOpenAIModal={handleOpenAIModal}
              />
            </div>

            {/* Radar Bantuan Section */}
            <motion.section 
              ref={radarRef}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className={`p-6 rounded-[40px] border ${
                isMalam 
                  ? 'bg-zinc-950/50 border-white/10' 
                  : 'bg-white border-black/5'
              } backdrop-blur-3xl shadow-2xl relative overflow-hidden`}
            >
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/10 blur-[80px] rounded-full" />
              
              <div className="flex items-center justify-between mb-6 relative z-10">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500">
                      Live Setempat
                    </h3>
                  </div>
                  <p className="text-lg font-[1000] tracking-tighter">PANTAUAN WARGA</p>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-2xl shadow-lg shadow-amber-500/20">
                  🛰️
                </div>
              </div>

              {/* Mini Map */}
              <div className="h-48 w-full rounded-[24px] overflow-hidden mb-6 border-2 border-black/5 dark:border-white/5 shadow-inner">
                <MiniMapV2 
                  lat={item.latitude} 
                  lng={item.longitude} 
                  theme={theme} 
                  radius={1} 
                />
              </div>

              {/* Micro Signals */}
              <div className="mb-8">
                <NearbyMicroSignals 
                  tempatId={item.id} 
                  theme={theme} 
                />
              </div>

              {/* Solution Radar */}
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                    Solusi Sekitar
                  </p>
                  <span className="text-[9px] opacity-30 font-bold italic">Radius 1KM</span>
                </div>
                <SolutionRadar 
                  item={item} 
                  theme={theme} 
                  userLocation={location} 
                />
              </div>
            </motion.section>

            {/* Rekomendasi Feed */}
            <div className="mt-16 mb-6 px-2">
              <h3 className="text-sm font-black uppercase tracking-tighter italic">
              </h3>
            </div>
            
            <RekomendasiFeed
              currentItemId={parseInt(id)}
              userLocation={location}
              locationReady={locationStatus === "granted"}
              theme={theme}
              onOpenAIModal={(it) => openAI("info", `Ceritakan tentang ${it.name}.`)}
            />

          </LayoutGroup>
        </main>
      </div>

      {/* Modals */}
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
      />
      <LocationModal 
        isOpen={isLocationModalOpen} 
        onClose={() => setIsLocationModalOpen(false)} 
      />
      <AIModalDetail 
        isOpen={showAIModal} 
        onClose={() => setShowAIModal(false)} 
        item={selectedTempat} 
        context={aiContext} 
        initialQuery={initialQuery}
      />
      <KomentarModal 
        isOpen={showKomentarModal} 
        onClose={() => setShowKomentarModal(false)} 
        tempat={selectedTempat} 
      />
      
      <SmartBottomNav
      />

      {/* Toast Notification */}
      <AnimatePresence>
        {toast.show && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[150] px-6 py-3 rounded-full bg-zinc-900 border border-white/20 text-white text-[10px] font-bold uppercase tracking-widest shadow-2xl"
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function PostDetailPage({ params }) {
  const { id } = use(params);
  return <PostDetailContent id={id} />;
}