"use client";

import { useState, useMemo, useCallback, useEffect, useRef, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

import PhotoSlider from "./PhotoSlider";
import LiveInsight from "./LiveInsight";
import FeedActions from "./FeedActions";
import StatusIsland from "./StatusIsland";
import StoryCircle from "@/app/components/feed/StoryCircle";
import StoryModal from "@/app/components/feed/StoryModal";
import AIButton from "@/components/AIButton";
import { processFeedItem } from "../../../lib/feedEngine";
import { useClock } from "../../../hooks/useClock";
import { useTheme } from "@/app/hooks/useTheme";
import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { useExternalSignals } from '@/hooks/useExternalSignals';

// ==================== ANIMATION CONSTANTS ====================
const PING_ANIM = {
  animate: { opacity: [0.5, 1, 0.5] },
  transition: { repeat: Infinity, duration: 2 },
};

const DEFAULT_ITEM = {
  id: 0,
  name: "",
  alamat: "",
  category: "",
  vibe_count: 0,
  photos: [],
  laporan_terbaru: [],
  status: "",
  isViral: false,
  isRamai: false,
};

// ==================== HOOKS ====================
const useWindowSize = () => {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 375,
    height: typeof window !== 'undefined' ? window.innerHeight : 667,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return windowSize;
};

// ==================== MAIN COMPONENT ====================
function FeedCard({
  item = DEFAULT_ITEM,
  locationReady,
  location,
  displayLocation,
  tempat = [],
  comments = {},
  selectedPhotoIndex = {},
  setSelectedPhotoIndex,
  openAIModal,
  openKomentarModal,
  onShare,
  onRefreshNeeded,
  priority = false,
}) {
  const router = useRouter();
  const { width: windowWidth } = useWindowSize();
  const isNarrow = windowWidth < 380;
  const isMedium = windowWidth >= 380 && windowWidth < 640;
  
  // --- State ---
  const [isSesuai, setIsSesuai] = useState(false);
  const [localValidationCount, setLocalValidationCount] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isStoryModalOpen, setIsStoryModalOpen] = useState(false);
  const [activeStories, setActiveStories] = useState([]);
  const [isVisible, setIsVisible] = useState(false);
  const [localLaporanWarga, setLocalLaporanWarga] = useState(
    () => item?.laporan_terbaru || []
  );
  const laporanTerbaru = localLaporanWarga[0];
  const kondisi = laporanTerbaru?.tipe || item?.latest_condition || "Normal";

  // --- Hooks ---
  const { user } = useAuth();
  const { currentTime, timeLabel: clockLabel } = useClock();
  const theme = useTheme();

  // --- Refs ---
  const cardRef = useRef(null);
  const observerRef = useRef(null);
  const channelRef = useRef(null);
  const prevLaporanRef = useRef(item?.laporan_terbaru);
  const isMounted = useRef(true);
  const timeoutRef = useRef(null);

  const safeItem = item || DEFAULT_ITEM;
  const tempatId = safeItem.id;

  const { externalSignals } = useExternalSignals(tempatId, {
    limit: 10,
    verifiedOnly: false
  });

  const handleLocalRefresh = useCallback(() => {
    if (onRefreshNeeded) onRefreshNeeded();
    router.refresh();
  }, [onRefreshNeeded, router]);

  // --- Core Lifecycle ---
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, []);

  useEffect(() => {
    const currentCard = cardRef.current;
    if (!currentCard) return;
    const initObserver = () => {
      observerRef.current = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && isMounted.current) {
            setIsVisible(true);
            observerRef.current?.disconnect();
          }
        },
        { threshold: 0.05, rootMargin: "200px" }
      );
      observerRef.current.observe(currentCard);
    };
    timeoutRef.current = setTimeout(initObserver, 0);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, []);

  useEffect(() => {
    if (prevLaporanRef.current !== safeItem.laporan_terbaru) {
      prevLaporanRef.current = safeItem.laporan_terbaru;
      setLocalLaporanWarga(safeItem.laporan_terbaru || []);
    }
  }, [safeItem.laporan_terbaru]);

  useEffect(() => {
    if (!tempatId || !isVisible || !isMounted.current) return;
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    channelRef.current = supabase
      .channel(`lw_${tempatId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "laporan_warga", filter: `tempat_id=eq.${tempatId}` },
        ({ new: n }) => {
          if (!n || !isMounted.current) return;
          setLocalLaporanWarga((prev) => prev.some((l) => l.id === n.id) ? prev : [n, ...prev].slice(0, 50));
        }
      ).subscribe();
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, [tempatId, isVisible]);

  // --- Memoized Values ---
  const totalSaksi = useMemo(() => localValidationCount + (safeItem.vibe_count || 0), [localValidationCount, safeItem.vibe_count]);

  const feed = useMemo(() => processFeedItem({ item: safeItem, comments, locationReady, location }),
    [safeItem.id, safeItem.vibe_count, safeItem.status, safeItem.isViral, safeItem.isRamai, comments, locationReady, location?.latitude, location?.longitude]
  );

  const photoUrls = useMemo(() => {
    const photos = Array.isArray(safeItem.photos) ? safeItem.photos : [];
    return photos.filter((p) => p && typeof p === "string" && p.startsWith("http"))
      .map((p) => ({ url: p, isOfficial: true, badge: "⭐ Official" }));
  }, [safeItem.photos]);

  const allSignals = useMemo(() => {
    const combined = [...(localLaporanWarga || []), ...(externalSignals || [])];
    return combined.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [localLaporanWarga, externalSignals]);

  // --- Callbacks ---
  const handleSesuai = useCallback(async () => {
    if (isSesuai || !safeItem.id) return;
    setIsSesuai(true);
    setLocalValidationCount((v) => v + 1);
    try { await supabase.from("minat").insert([{ tempat_id: safeItem.id }]); } catch (e) { console.error(e); }
  }, [isSesuai, safeItem.id]);

  const handleOpenStoryModal = useCallback((id, stories) => {
    setActiveStories((stories || []).map((s) => ({ ...s, url: s.url || s.photo_url || s.image_url })));
    setIsStoryModalOpen(true);
  }, []);

  const handleUploadSuccess = useCallback((newLaporan) => {
    setLocalLaporanWarga((prev) => prev.some((l) => l.id === newLaporan.id) ? prev : [newLaporan, ...prev].slice(0, 50));
    requestAnimationFrame(() => {
      setActiveStories((prev) => [newLaporan, ...prev].map((s) => ({ ...s, url: s.url || s.photo_url || s.image_url })));
      setIsStoryModalOpen(true);
    });
    handleLocalRefresh();
  }, [handleLocalRefresh]);

  const handleOpenAIModal = useCallback((query) => openAIModal?.(safeItem, handleUploadSuccess, query), [openAIModal, safeItem, handleUploadSuccess]);
  const handleCloseStoryModal = useCallback(() => setIsStoryModalOpen(false), []);

  if (!item?.id) return null;

  const [currentHour, currentMinute] = currentTime.split(":");
  const currentPhotoIndex = selectedPhotoIndex?.[safeItem.id] || 0;
  const headline = feed?.headline?.text || feed?.narasiCerita?.split(".")[0] || "UPDATE SEKITAR";
  const distanceText = feed?.distance ? `${feed.distance.toFixed(1)} KM` : "LIVE";
  const alamatText = safeItem.alamat || "AREA SETEMPAT";
  const itemStatusClass = safeItem.isViral ? "viral" : safeItem.isRamai ? "ramai" : "biasa";

  const statusDisplay = useMemo(() => {
    const statusMap = {
      viral: { text: "VIRAL", bg: "bg-red-500/20", border: "border-red-500/30", dot: "bg-red-50" },
      ramai: { text: "RAME", bg: "bg-yellow-500/20", border: "border-yellow-500/30", dot: "bg-yellow-500" },
      biasa: { text: "NORMAL", bg: "bg-emerald-500/20", border: "border-emerald-500/30", dot: "bg-emerald-500" },
    };
    return statusMap[itemStatusClass] || statusMap.biasa;
  }, [itemStatusClass]);

  const cardBorderClass = useMemo(() => {
    if (safeItem.isViral) return "border-b-4 border-red-500/50";
    if (safeItem.isRamai) return "border-b-4 border-yellow-500/50";
    return theme.isMalam ? 'border-b border-white/5' : 'border-b border-black/5';
  }, [safeItem.isViral, safeItem.isRamai, theme.isMalam]);

  // Responsive spacing classes
  const paddingX = `px-4 ${!isNarrow ? 'sm:px-5' : ''}`;
  const paddingY = `py-3 ${isNarrow ? 'py-2' : 'sm:py-4'}`;
  const gapSize = isNarrow ? 'gap-1' : 'gap-2';
  const textSize = isNarrow ? 'text-[8px]' : 'text-[9px] sm:text-[10px]';

  return (
    <div
      ref={cardRef}
      id={`feed-card-${safeItem.id}`}
      className="relative mb-3 sm:mb-4 w-full will-change-transform feed-card"
      style={{ isolation: "isolate" }}
    >
      <motion.div
        layout
        layoutId={`card-container-${safeItem.id}`}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className={`relative overflow-visible ${theme.card} ${cardBorderClass} flex flex-col transition-all duration-300`}
      >
        {/* Header - Responsive Padding */}
        <div className={`${paddingX} pt-4 sm:pt-6 pb-2 sm:pb-3`}>
          <div className={`flex items-center justify-between mb-2 sm:mb-4 ${gapSize}`}>
            <div className="flex flex-col gap-0.5 sm:gap-1">
              <div className="flex items-center gap-1 sm:gap-2">
                <span className={`${textSize} font-black uppercase tracking-widest ${theme.text} opacity-40`}>
                  {safeItem.category || 'Update Terkini'}
                </span>
                {safeItem.isViral && (
                   <motion.span {...PING_ANIM} className="bg-red-500 text-white text-[7px] sm:text-[8px] px-1.5 sm:px-2 py-0.5 rounded-full font-black">VIRAL</motion.span>
                )}
              </div>
              <h3 className={`text-[13px] sm:text-[15px] font-[1000] uppercase tracking-tight leading-tight ${theme.text}`}>
                {safeItem.name}
              </h3>
            </div>

            <div className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl ${theme.isMalam ? "bg-white/5" : "bg-black/5"}`}>
              <p className={`${textSize} font-black ${theme.text} opacity-60 whitespace-nowrap`}>
                📍 {distanceText}
              </p>
            </div>
          </div>

          <StatusIsland
            item={safeItem}
            theme={theme}
            allReports={allSignals} 
            isExpanded={isExpanded}
            setIsExpanded={setIsExpanded}
            jumlahWarga={totalSaksi}
          />
        </div> 

        {/* Headline - Responsive */}
        <div className={`${paddingX} pb-3 sm:pb-4`}>
          <div className={`flex items-start gap-2 sm:gap-3 p-3 sm:p-4 rounded-2xl ${theme.isMalam ? 'bg-white/[0.03]' : 'bg-black/[0.03]'} border ${theme.isMalam ? 'border-white/5' : 'border-black/5'}`}>
            <div className={`w-1 self-stretch rounded-full ${safeItem.isViral ? 'bg-red-500' : theme.accentBg || 'bg-cyan-500'} opacity-60`} />
            <h2 className={`text-[11px] sm:text-[13px] font-bold italic tracking-tight leading-relaxed ${theme.text} flex-1`}>
              "{headline}"
            </h2>
            <span className={`font-mono ${textSize} font-bold ${theme.text} opacity-30 pt-0.5 sm:pt-1`}>
              {currentHour}:{currentMinute}
            </span>
          </div>
        </div>

        {/* Media Section - IMPROVED ASPECT RATIO */}
        <div className="px-2 sm:px-3 mb-2 sm:mb-3">
          <div 
            className="relative w-full rounded-[20px] sm:rounded-[24px] overflow-hidden border shadow-lg"
            style={{ 
              minHeight: '200px',
              maxHeight: '45vh',
              aspectRatio: '16/9',
              backgroundColor: theme.isMalam ? '#1a1a1a' : '#f5f5f5'
            }}
          >
            <PhotoSlider
              photos={photoUrls}
              timeLabel={clockLabel}
              tempatId={safeItem.id}
              namaTempat={safeItem.name}
              isHujan={safeItem.status === "hujan"}
              itemStatus={itemStatusClass}
              theme={theme}
              selectedPhotoIndex={currentPhotoIndex}
              priority={priority} 
              setSelectedPhotoIndex={setSelectedPhotoIndex}
              onUploadSuccess={handleUploadSuccess}
              onRefreshNeeded={handleLocalRefresh}
            />

            {/* Validation Stamp - Responsive Positioning */}
            <div className={`absolute ${isNarrow ? 'bottom-2 left-2' : 'bottom-3 sm:bottom-4 left-3 sm:left-4'} z-50`}>
              <AnimatePresence mode="wait">
                {!isSesuai ? (
                  <motion.button
                    key="stamp-btn"
                    onClick={handleSesuai}
                    whileTap={{ scale: 0.9 }}
                    className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl bg-black/60 backdrop-blur-md border border-white/20 text-white shadow-xl"
                    style={{ minHeight: '44px' }}
                  >
                    <span className="text-xs sm:text-sm">✔️</span>
                    <div className="flex flex-col text-left">
                      <span className={`${isNarrow ? 'text-[7px]' : 'text-[8px] sm:text-[9px]'} font-black tracking-tighter`}>SESUAI?</span>
                      <span className={`${isNarrow ? 'text-[6px]' : 'text-[6px] sm:text-[7px]'} opacity-60`}>{totalSaksi} Laporan</span>
                    </div>
                  </motion.button>
                ) : (
                  <motion.div
                    key="sah"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-violet-600/90 text-white px-2 sm:px-4 py-1 sm:py-1.5 rounded-full text-[8px] sm:text-[10px] font-black tracking-widest border border-white/30 shadow-lg -rotate-3"
                  >
                    TERVERIFIKASI
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Story Circle - Responsive */}
            <div className={`absolute ${isNarrow ? 'top-2 left-1.5' : 'top-3 sm:top-4 left-2 sm:left-3'} z-50`}>
              <StoryCircle
                laporanWarga={localLaporanWarga}
                tempatId={safeItem.id}
                namaTempat={safeItem.name}
                theme={theme}
                openStoryModal={handleOpenStoryModal}
                onRefreshNeeded={handleLocalRefresh}
              />
            </div>

            {/* Feed Actions - Responsive */}
            <div className={`absolute ${isNarrow ? 'right-1.5 top-2' : 'right-2 sm:right-3 top-3 sm:top-4'} z-50`}>
              <FeedActions
                item={{ ...safeItem, activePhoto: photoUrls[currentPhotoIndex] }}
                comments={comments}
                openKomentarModal={openKomentarModal}
                onShare={onShare}
                variant="floating-sidebar"
                theme={theme}
              />
            </div>
          </div>
        </div>

        {/* Metadata - Responsive & Tight (Mirip Caption Style) */}
<div className={`
  ${paddingX} 
  pb-4 pt-1 
  flex items-center justify-between 
  opacity-40 
  -mt-2
`}>
  <div className="flex items-center gap-1.5 truncate flex-1">
    <div className={`
      p-1 rounded-md 
      ${theme.isMalam ? 'bg-white/5' : 'bg-black/5'} 
      text-[7px] font-black tracking-tighter
    `}>
      📍
    </div>
    <p className={`
      ${isNarrow ? 'text-[8px]' : 'text-[9px] sm:text-[10px]'} 
      font-bold ${theme.text} truncate tracking-tight
    `}>
      {alamatText}
    </p>
  </div>
  
  <div className="flex items-center gap-2 ml-4">
    <div className={`w-1 h-1 rounded-full ${theme.isMalam ? 'bg-white/20' : 'bg-black/20'}`} />
    <span className={`
      ${isNarrow ? 'text-[7px]' : 'text-[8px] sm:text-[9px]'} 
      font-mono font-black tracking-tighter
    `}>
      #{String(safeItem.id).padStart(4, '0')}
    </span>
  </div>
</div>

        {/* Insight & Action - Responsive */}
        <div className={`${paddingX} pb-4 sm:pb-6 space-y-3 sm:space-y-4`}>
          <div className={`${theme.statusBg} rounded-xl sm:rounded-2xl p-2.5 sm:p-3 border ${theme.border} shadow-inner`}>
            <LiveInsight
              signals={allSignals}
              theme={theme}
              isCompact={isNarrow}
              currentUser={user}
            />
          </div>

          <AIButton
            item={safeItem}
            kondisi={kondisi} 
            display={statusDisplay}
            theme={theme}
            handleOpenAIModal={handleOpenAIModal}
          />
        </div>

        <StoryModal
          isOpen={isStoryModalOpen}
          onClose={handleCloseStoryModal}
          stories={activeStories}
          theme={theme}
          namaTempat={safeItem.name}
        />
      </motion.div>
    </div>
  );
}

const areEqual = (p, n) => {
  return p.item?.id === n.item?.id && 
         p.item?.vibe_count === n.item?.vibe_count &&
         p.selectedPhotoIndex?.[p.item?.id] === n.selectedPhotoIndex?.[n.item?.id];
};

export default memo(FeedCard, areEqual);