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

  const { externalSignals, loading: externalLoading, count: externalCount } = useExternalSignals(tempatId, {
    limit: 10,
    verifiedOnly: false
  });

  const handleLocalRefresh = useCallback(() => {
    if (onRefreshNeeded) {
      onRefreshNeeded();
    }
    router.refresh();
  }, [onRefreshNeeded, router]);

  // --- Effects & Subscriptions (Logika Tetap Sama) ---
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
            observerRef.current = null;
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

  // --- UI Logic Helpers ---
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

  // 🔥 Visual Variation Logic
  const cardBorderColor = useMemo(() => {
    if (safeItem.isViral) return "border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.1)]";
    if (safeItem.isRamai) return "border-yellow-500/40 shadow-[0_0_15px_rgba(234,179,8,0.1)]";
    return theme.isMalam ? 'border-white/10' : 'border-black/5';
  }, [safeItem.isViral, safeItem.isRamai, theme.isMalam]);

  return (
    <div
      ref={cardRef}
      id={`feed-card-${safeItem.id}`}
      className="relative mb-8 w-full will-change-transform px-4"
      style={{ isolation: "isolate" }}
    >
      <motion.div
        layout
        layoutId={`card-container-${safeItem.id}`}
        initial={{ opacity: 0, scale: 0.95, y: 30 }}
        whileInView={{ opacity: 1, scale: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ type: "spring", damping: 20, stiffness: 100 }}
        className={`relative overflow-visible rounded-[38px] ${theme.card} border-2 ${cardBorderColor} shadow-xl flex flex-col transition-colors duration-500`}
      >
        {/* Header Section */}
        <div className="px-6 pt-7 pb-3">
          <div className="flex items-start justify-between mb-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className={`text-[8px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full ${theme.isMalam ? 'bg-white/10 text-white/50' : 'bg-black/5 text-black/40'}`}>
                  {safeItem.category || 'Terkini'}
                </span>
                {safeItem.isViral && (
                   <motion.span {...PING_ANIM} className="bg-red-500 text-white text-[7px] px-2 py-0.5 rounded-md font-black italic">HOT 🔥</motion.span>
                )}
              </div>
              
              <h3 className={`text-[13px] font-[1000] uppercase tracking-tight leading-none ${theme.text} flex items-center gap-2`}>
                {safeItem.name}
                {safeItem.isRamai && <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />}
              </h3>
            </div>

            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border ${theme.isMalam ? "bg-white/5 border-white/10" : "bg-black/5 border-black/5"}`}>
              <span className="text-[10px]">📍</span>
              <p className={`text-[9px] font-black tracking-tighter ${theme.text} opacity-70`}>
                {distanceText}
              </p>
            </div>
          </div>

          <div className="relative">
            <StatusIsland
              item={safeItem}
              theme={theme}
              allReports={allSignals} 
              isExpanded={isExpanded}
              setIsExpanded={setIsExpanded}
              jumlahWarga={totalSaksi}
            />
          </div>
        </div> 

        {/* Headline Section */}
        <div className="px-6 pb-4">
          <div className="flex items-start gap-3 p-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-transparent hover:border-current/10 transition-all">
            <div className={`w-1 h-4 mt-0.5 rounded-full ${safeItem.isViral ? 'bg-red-500' : theme.accentBg || 'bg-cyan-500'} shadow-sm`} />
            <h2 className={`text-[12px] font-bold italic tracking-tight leading-snug ${theme.text} flex-1`}>
              "{headline}"
            </h2>
            <div className={`font-mono text-[9px] font-bold ${theme.text} opacity-40 whitespace-nowrap`}>
              {currentHour}<span className="animate-pulse">:</span>{currentMinute}
            </div>
          </div>
        </div>

        {/* Media Section */}
        <div className="relative px-4 mb-2">
          <div className={`relative aspect-[16/10] rounded-[30px] overflow-hidden border ${theme.border} shadow-2xl`} style={{ zIndex: 1 }}>
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

            {/* Stamp Validator */}
            <div className="absolute bottom-4 left-5 z-50">
              <AnimatePresence mode="wait">
                {!isSesuai ? (
                  <motion.button
                    key="stamp-btn"
                    onClick={handleSesuai}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-black/70 border border-white/20 backdrop-blur-xl text-white shadow-2xl active:bg-black/90 transition-all"
                  >
                    <span className="text-sm">🛡️</span>
                    <div className="flex flex-col leading-none text-left">
                      <span className="text-[9px] font-black uppercase tracking-widest">KONFIRMASI?</span>
                      <span className="text-[7px] font-bold text-white/50">{totalSaksi} Laporan</span>
                    </div>
                  </motion.button>
                ) : (
                  <motion.div
                    key="sah-watermark"
                    initial={{ opacity: 0, scale: 2, rotate: -45 }}
                    animate={{ opacity: 1, scale: 1, rotate: -12 }}
                    className="relative w-16 h-16 flex items-center justify-center rounded-full border-4 border-violet-500/80 backdrop-blur-md shadow-2xl"
                  >
                    <div className="flex flex-col items-center text-center -rotate-[12deg]">
                      <span className="text-[16px] font-black text-violet-400">SAH!</span>
                      <span className="text-[6px] font-bold text-violet-300/80 uppercase tracking-tighter">SETEMPAT.ID</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Floatings */}
            <div className="absolute top-4 left-2 z-50 scale-90 origin-top-left">
              <StoryCircle
                laporanWarga={localLaporanWarga}
                tempatId={safeItem.id}
                namaTempat={safeItem.name}
                tempatKategori={safeItem.category}
                theme={theme}
                openStoryModal={handleOpenStoryModal}
                onRefreshNeeded={handleLocalRefresh}
              />
            </div>

            <div className="absolute -right-1 top-3 z-50 scale-90">
              <FeedActions
                item={{ ...safeItem, activePhoto: photoUrls[currentPhotoIndex] }}
                comments={comments}
                openKomentarModal={openKomentarModal}
                onShare={onShare}
                variant="floating-sidebar"
                theme={theme}
                handleSesuai={handleSesuai}
                isSesuai={isSesuai}
              />
            </div>
          </div>
        </div>

        {/* Location Info */}
        <div className="px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 opacity-60 overflow-hidden">
            <div className="p-1 rounded-md bg-current/5 italic font-black text-[9px] text-cyan-500">LOC</div>
            <p className={`text-[10px] font-bold ${theme.textMuted} truncate max-w-[200px]`}>
              {alamatText}
            </p>
          </div>
          <span className="text-[9px] font-mono font-black opacity-20 tracking-tighter">
            #{String(safeItem.id).padStart(4, '0')}
          </span>
        </div>

        {/* Live Insight Section */}
        <div className="px-6 pb-4">
          <div className={`${theme.statusBg} rounded-[24px] p-2 border ${theme.border} shadow-inner`}>
            <LiveInsight
              signals={allSignals}
              theme={theme}
              isCompact={true}
              currentUser={user}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 pb-8 space-y-4">
          <AIButton
            item={safeItem}
            kondisi={kondisi} 
            display={statusDisplay}
            theme={theme}
            handleOpenAIModal={handleOpenAIModal}
          />

          <StoryModal
            isOpen={isStoryModalOpen}
            onClose={handleCloseStoryModal}
            stories={activeStories}
            theme={theme}
            namaTempat={safeItem.name}
          />
        </div>
      </motion.div>
    </div>
  );
}

const areEqual = (prevProps, nextProps) => {
  return (
    prevProps.item?.id === nextProps.item?.id &&
    prevProps.item?.vibe_count === nextProps.item?.vibe_count &&
    prevProps.item?.isViral === nextProps.item?.isViral &&
    prevProps.item?.isRamai === nextProps.item?.isRamai &&
    prevProps.item?.photos?.length === nextProps.item?.photos?.length &&
    prevProps.item?.laporan_terbaru?.length === nextProps.item?.laporan_terbaru?.length &&
    prevProps.comments === nextProps.comments &&
    prevProps.locationReady === nextProps.locationReady &&
    prevProps.selectedPhotoIndex?.[prevProps.item?.id] === nextProps.selectedPhotoIndex?.[nextProps.item?.id]
  );
};

export default memo(FeedCard, areEqual);