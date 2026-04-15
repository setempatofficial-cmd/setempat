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

  const { externalSignals } = useExternalSignals(tempatId, {
    limit: 10,
    verifiedOnly: false
  });

  const handleLocalRefresh = useCallback(() => {
    if (onRefreshNeeded) onRefreshNeeded();
    router.refresh();
  }, [onRefreshNeeded, router]);

  // --- Core Lifecycle (Logic Unchanged) ---
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

  // Border logic untuk Full Width
  const cardBorderClass = useMemo(() => {
    if (safeItem.isViral) return "border-b-4 border-red-500/50";
    if (safeItem.isRamai) return "border-b-4 border-yellow-500/50";
    return theme.isMalam ? 'border-b border-white/5' : 'border-b border-black/5';
  }, [safeItem.isViral, safeItem.isRamai, theme.isMalam]);

  return (
    <div
      ref={cardRef}
      id={`feed-card-${safeItem.id}`}
      className="relative mb-4 w-full will-change-transform"
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
        {/* Header - Full Width Padding */}
        <div className="px-5 pt-6 pb-3">
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className={`text-[9px] font-black uppercase tracking-widest ${theme.text} opacity-40`}>
                  {safeItem.category || 'Update Terkini'}
                </span>
                {safeItem.isViral && (
                   <motion.span {...PING_ANIM} className="bg-red-500 text-white text-[8px] px-2 py-0.5 rounded-full font-black">VIRAL</motion.span>
                )}
              </div>
              <h3 className={`text-[15px] font-[1000] uppercase tracking-tight leading-none ${theme.text}`}>
                {safeItem.name}
              </h3>
            </div>

            <div className={`px-3 py-1.5 rounded-xl ${theme.isMalam ? "bg-white/5" : "bg-black/5"}`}>
              <p className={`text-[10px] font-black ${theme.text} opacity-60 whitespace-nowrap`}>
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

        {/* Headline - Dibuat lebih lebar dan nyaman dibaca */}
        <div className="px-5 pb-4">
          <div className={`flex items-start gap-3 p-4 rounded-2xl ${theme.isMalam ? 'bg-white/[0.03]' : 'bg-black/[0.03]'} border ${theme.isMalam ? 'border-white/5' : 'border-black/5'}`}>
            <div className={`w-1.5 self-stretch rounded-full ${safeItem.isViral ? 'bg-red-500' : theme.accentBg || 'bg-cyan-500'} opacity-60`} />
            <h2 className={`text-[13px] font-bold italic tracking-tight leading-relaxed ${theme.text} flex-1`}>
              "{headline}"
            </h2>
            <span className={`font-mono text-[10px] font-bold ${theme.text} opacity-30 pt-1`}>
              {currentHour}:{currentMinute}
            </span>
          </div>
        </div>

        {/* Media Section - Aspect Ratio disesuaikan agar tidak terlalu tinggi di layar lebar */}
        <div className="relative px-2 mb-2">
          <div className={`relative aspect-[16/9] rounded-[24px] overflow-hidden border ${theme.border} shadow-lg`} style={{ zIndex: 1 }}>
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

            {/* Validation Stamp */}
            <div className="absolute bottom-4 left-4 z-50">
              <AnimatePresence mode="wait">
                {!isSesuai ? (
                  <motion.button
                    key="stamp-btn"
                    onClick={handleSesuai}
                    whileTap={{ scale: 0.9 }}
                    className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-black/60 backdrop-blur-md border border-white/20 text-white shadow-xl"
                  >
                    <span className="text-sm">✔️</span>
                    <div className="flex flex-col text-left">
                      <span className="text-[9px] font-black tracking-tighter">SESUAI?</span>
                      <span className="text-[7px] opacity-60">{totalSaksi} Laporan</span>
                    </div>
                  </motion.button>
                ) : (
                  <motion.div
                    key="sah"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-violet-600/90 text-white px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest border border-white/30 shadow-lg -rotate-3"
                  >
                    TERVERIFIKASI
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Overlay Sidebar */}
            <div className="absolute top-4 left-3 z-50">
              <StoryCircle
                laporanWarga={localLaporanWarga}
                tempatId={safeItem.id}
                namaTempat={safeItem.name}
                theme={theme}
                openStoryModal={handleOpenStoryModal}
                onRefreshNeeded={handleLocalRefresh}
              />
            </div>

            <div className="absolute right-2 top-4 z-50">
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

        {/* Metadata & ID */}
        <div className="px-6 py-4 flex items-center justify-between opacity-50">
          <div className="flex items-center gap-2 truncate flex-1">
            <span className="text-xs">📍</span>
            <p className={`text-[10px] font-medium ${theme.text} truncate`}>{alamatText}</p>
          </div>
          <span className="text-[9px] font-mono tracking-widest ml-4">ID:{String(safeItem.id).slice(-4)}</span>
        </div>

        {/* Insight & Action */}
        <div className="px-5 pb-6 space-y-4">
          <div className={`${theme.statusBg} rounded-2xl p-3 border ${theme.border} shadow-inner`}>
            <LiveInsight
              signals={allSignals}
              theme={theme}
              isCompact={true}
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