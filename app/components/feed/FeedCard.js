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
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabaseClient";
import { useExternalSignals } from '@/hooks/useExternalSignals';

// ==================== ANIMATION CONSTANTS ====================
const PING_ANIM = {
  animate: { opacity: [0.5, 1, 0.5] },
  transition: { repeat: Infinity, duration: 2 },
};

const BLINK_ANIM = {
  animate: { opacity: [1, 0, 1] },
  transition: { repeat: Infinity, duration: 1, ease: "linear" },
};

const SHIMMER_ANIM = {
  animate: { x: ["-100%", "200%"] },
  transition: { repeat: Infinity, duration: 2.5, ease: "linear" },
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
  // 🔥 Fetch external signals dari tabel external_signals
  const { externalSignals, loading: externalLoading, count: externalCount } = useExternalSignals(tempatId, {
    limit: 10,
    verifiedOnly: false
  });
  // 🔥 Fungsi refresh lokal
  const handleLocalRefresh = useCallback(() => {
    console.log("🔄 FeedCard refresh triggered");
    if (onRefreshNeeded) {
      onRefreshNeeded();
    }
    router.refresh();
  }, [onRefreshNeeded, router]);

  // --- Cleanup ---
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, []);

  // --- Intersection Observer ---
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

  // --- Update local laporan ---
  useEffect(() => {
    if (prevLaporanRef.current !== safeItem.laporan_terbaru) {
      prevLaporanRef.current = safeItem.laporan_terbaru;
      setLocalLaporanWarga(safeItem.laporan_terbaru || []);
    }
  }, [safeItem.laporan_terbaru]);

  // --- Supabase Subscription ---
  useEffect(() => {
    if (!tempatId || !isVisible || !isMounted.current) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    channelRef.current = supabase
      .channel(`lw_${tempatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "laporan_warga",
          filter: `tempat_id=eq.${tempatId}`,
        },
        ({ new: n }) => {
          if (!n || !isMounted.current) return;

          setLocalLaporanWarga((prev) => {
            if (prev.some((l) => l.id === n.id)) return prev;
            return [n, ...prev].slice(0, 50);
          });
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [tempatId, isVisible]);

  // --- Memoized Values ---
  const totalSaksi = useMemo(
    () => localValidationCount + (safeItem.vibe_count || 0),
    [localValidationCount, safeItem.vibe_count]
  );

  const validatedLocationName = useMemo(() => {
    if (!locationReady || !location) return displayLocation || "Pasuruan";

    const sourceAlamat =
      (tempat?.length > 0 ? tempat[0]?.alamat : safeItem.alamat) || "";
    const parts = sourceAlamat.split(",").map((p) => p.trim());
    const district = parts.find(
      (p) => p.includes("Kec.") || p.includes("Kecamatan")
    );

    return district
      ? district.replace(/Kec\.|Kecamatan/g, "").trim()
      : (parts[1] || parts[0] || displayLocation || "Area Aktif");
  }, [locationReady, location, tempat, safeItem.alamat, displayLocation]);

  const feed = useMemo(
    () =>
      processFeedItem({
        item: safeItem,
        comments,
        locationReady,
        location,
      }),
    [
      safeItem.id,
      safeItem.vibe_count,
      safeItem.status,
      safeItem.isViral,
      safeItem.isRamai,
      comments,
      locationReady,
      location?.latitude,
      location?.longitude,
    ]
  );

  const photoUrls = useMemo(() => {
    const photos = Array.isArray(safeItem.photos) ? safeItem.photos : [];
    return photos
      .filter((p) => p && typeof p === "string" && p.startsWith("http"))
      .map((p) => ({ url: p, isOfficial: true, badge: "⭐ Official" }));
  }, [safeItem.photos]);

  // 🔥 Gabungkan laporan warga (internal) + external signals
  const allSignals = useMemo(() => {
    const internal = localLaporanWarga || [];
    const external = externalSignals || [];
    
    const combined = [...internal, ...external];
    return combined.sort((a, b) => 
      new Date(b.created_at) - new Date(a.created_at)
    );
  }, [localLaporanWarga, externalSignals]);

  // --- Callbacks ---
  const handleSesuai = useCallback(async () => {
    if (isSesuai || !safeItem.id) return;
    setIsSesuai(true);
    setLocalValidationCount((v) => v + 1);

    try {
      await supabase.from("minat").insert([{ tempat_id: safeItem.id }]);
    } catch (e) {
      console.error(e);
    }
  }, [isSesuai, safeItem.id]);

  const handleOpenStoryModal = useCallback((id, stories) => {
    setActiveStories(
      (stories || []).map((s) => ({
        ...s,
        url: s.url || s.photo_url || s.image_url,
      }))
    );
    setIsStoryModalOpen(true);
  }, []);

  const handleUploadSuccess = useCallback((newLaporan) => {
    setLocalLaporanWarga((prev) => {
      if (prev.some((l) => l.id === newLaporan.id)) return prev;
      return [newLaporan, ...prev].slice(0, 50);
    });

    requestAnimationFrame(() => {
      setActiveStories((prev) =>
        [newLaporan, ...prev].map((s) => ({
          ...s,
          url: s.url || s.photo_url || s.image_url,
        }))
      );
      setIsStoryModalOpen(true);
    });
    
    // 🔥 Trigger refresh setelah upload sukses
    handleLocalRefresh();
  }, [handleLocalRefresh]);

  const handleOpenAIModal = useCallback((query) => {
    openAIModal?.(safeItem, handleUploadSuccess, query);
  }, [openAIModal, safeItem, handleUploadSuccess]);

  const handleCloseStoryModal = useCallback(
    () => setIsStoryModalOpen(false),
    []
  );

  // --- Early Return ---
  if (!item?.id) return null;

  // --- Local Variables for Render ---
  const [currentHour, currentMinute] = currentTime.split(":");
  const currentPhotoIndex = selectedPhotoIndex?.[safeItem.id] || 0;
  const headline =
    feed?.headline?.text || feed?.narasiCerita?.split(".")[0] || "UPDATE SEKITAR";
  const distanceText = feed?.distance
    ? `${feed.distance.toFixed(1)} KM DARI ANDA`
    : "LIVE SEKITAR";
  const categoryText = safeItem.category || "GENERAL";
  const alamatText = safeItem.alamat || "AREA SETEMPAT";
  const itemStatusClass = safeItem.isViral
    ? "viral"
    : safeItem.isRamai
    ? "ramai"
    : "biasa";

  // 🔥 Definisi statusDisplay untuk AIButton berdasarkan itemStatusClass
  const statusDisplay = useMemo(() => {
    const statusMap = {
      viral: {
        text: "VIRAL",
        bg: "bg-red-500/20",
        border: "border-red-500/30",
        dot: "bg-red-500",
      },
      ramai: {
        text: "RAME",
        bg: "bg-yellow-500/20",
        border: "border-yellow-500/30",
        dot: "bg-yellow-500",
      },
      biasa: {
        text: "NORMAL",
        bg: "bg-emerald-500/20",
        border: "border-emerald-500/30",
        dot: "bg-emerald-500",
      },
    };
    return statusMap[itemStatusClass] || statusMap.biasa;
  }, [itemStatusClass]);

  return (
    <div
      ref={cardRef}
      id={`feed-card-${safeItem.id}`}
      className="relative mb-6 w-full will-change-transform"
      style={{ isolation: "isolate" }}
    >
      <motion.div
        layout
        layoutId={`card-container-${safeItem.id}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{
          type: "spring",
          damping: 25,
          stiffness: 200,
          layout: { duration: 0.5 },
        }}
        className={`relative overflow-visible rounded-[32px] ${theme.card} border ${theme.border} shadow-xl flex flex-col`}
      >
        {/* STATUS ISLAND - Paling Atas (sebagai Headline utama) */}
        <div className="px-5 pt-5">
          <StatusIsland
            item={safeItem}
            theme={theme}
            isExpanded={isExpanded}
            setIsExpanded={setIsExpanded}
            jumlahWarga={totalSaksi}
          />
        </div>

        {/* Title - The Passive Narrative (Light & Fast) */}
<div className="px-6 pt-1 pb-3">
  <div className="flex items-center gap-2">
    {/* Aksen Garis Pendek - Eyecatching tanpa gambar/icon berat */}
    <div className={`w-1 h-3 rounded-full ${theme.accentBg || 'bg-cyan-500'} opacity-60 shadow-[0_0_8px_rgba(6,182,212,0.3)]`} />
    
    <h2
      className={`
        text-[11.5px] 
        font-[1000] 
        italic 
        tracking-tighter 
        leading-tight
        ${theme.text} 
        opacity-70
        line-clamp-2
        select-none
      `}
      style={{ letterSpacing: '-0.03em' }}
    >
      {headline}
    </h2>
  </div>
</div>

        {/* Header */}
        <div className="flex justify-between items-center px-6 pb-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              <motion.span
                {...PING_ANIM}
                className={`absolute inset-0 rounded-full ${theme.isMalam ? "bg-emerald-400" : "bg-emerald-500"}`}
              />
              <span
                className={`relative rounded-full h-1.5 w-1.5 ${theme.isMalam ? "bg-emerald-500" : "bg-emerald-600"}`}
              />
            </span>
            <span
              className={`text-[9px] font-black tracking-[0.05em] ${theme.accent} italic uppercase`}
            >
              {distanceText}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`text-[8px] font-black px-1.5 py-0.5 rounded-md ${theme.isMalam ? "bg-white/10" : "bg-black/5"} ${theme.text} opacity-50 tracking-tighter uppercase`}
            >
              {categoryText}
            </span>
            <div
              className={`flex items-center font-mono text-[9px] font-bold ${theme.text} opacity-70`}
            >
              <span>{currentHour}</span>
              <motion.span {...BLINK_ANIM} className="mx-0.5" />
              <span>{currentMinute}</span>
            </div>
          </div>
        </div>

        {/* Live Insight - Dipisah di paling bawah */}
        <div className="px-5 pb-5">
          <div
            className={`${theme.statusBg} rounded-[20px] p-1.5 pl-3 border ${theme.border} flex items-center justify-between gap-3 shadow-inner`}
          >
            <div className="flex-1 min-w-0 overflow-hidden scale-95 origin-left">
              <LiveInsight
                signals={allSignals}
                theme={theme}
                isCompact={true}
                currentUser={user}
              />
            </div>
          </div>
        </div>

        {/* Media Section */}
        <div className="relative px-3.5 mb-3.5">
          <div
            className={`relative aspect-[16/10.5] rounded-[26px] overflow-hidden border ${theme.border} shadow-lg`}
            style={{ zIndex: 1 }}
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

            {/* Dynamic Stamp Validator */}
            <div className="absolute bottom-3 left-4 z-50 select-none">
              <AnimatePresence mode="wait">
                {!isSesuai ? (
                  <motion.button
                    key="stamp-btn"
                    onClick={handleSesuai}
                    whileTap={{ scale: 0.95, y: 2 }}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05, filter: "blur(4px)" }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 border border-white/10 backdrop-blur-md text-white shadow-lg active:bg-black/80 transition-all"
                  >
                    <div className="text-Lg">🗃️</div>
                    <div className="flex flex-col leading-none text-left">
                      <span className="text-[9px] font-[1000] uppercase tracking-[0.12em]">
                        KONDISI SESUAI?
                      </span>
                      <span className="text-[6.5px] font-bold text-white/50">
                        {totalSaksi} Saksi
                      </span>
                    </div>
                  </motion.button>
                ) : (
                  <motion.div
                    key="sah-watermark"
                    initial={{ opacity: 0, scale: 1.5, rotate: -25 }}
                    animate={{ opacity: 1, scale: 1, rotate: -12 }}
                    transition={{ type: "spring", stiffness: 350, damping: 20 }}
                    className="relative w-14 h-14 flex items-center justify-center rounded-full border-[2px] border-violet-500/60 backdrop-blur-md shadow-inner"
                  >
                    <motion.div
                      animate={{ opacity: [0.2, 0.4, 0.2] }}
                      transition={{ repeat: Infinity, duration: 2.2 }}
                      className="absolute inset-0 rounded-full bg-violet-600/5"
                    />
                    <div className="flex flex-col items-center text-center -rotate-[12deg] scale-90">
                      <span className="text-[14px] font-black uppercase tracking-wider text-violet-400 drop-shadow-sm">
                        SAH!
                      </span>
                      <div className="w-8 h-px bg-violet-500/30 my-0.5" />
                      <span className="text-[7px] font-bold text-violet-300/80 tracking-tighter">
                        SETEMPAT.ID
                      </span>
                      <span className="text-[6.5px] text-violet-500/70 -mt-0.5">INDONESIA</span>
                    </div>
                    <div className="absolute -bottom-0.5 text-[10px] opacity-60">💮</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Story Circle */}
            <div className="absolute top-4 left-1 z-50 scale-90">
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

            {/* Feed Actions */}
            <div className="absolute -right-1 top-2.5 z-50 scale-90">
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

        {/* Footer */}
        <div className="px-6 pb-6 space-y-3.5">
          <div className="flex justify-between items-end px-0.5">
            <div className="min-w-0">
              <h3
                className={`text-[13px] font-[1000] ${theme.text} uppercase truncate tracking-tight`}
              >
                {safeItem.name}
              </h3>
              <p
                className={`text-[8px] font-bold ${theme.textMuted} uppercase tracking-wider truncate opacity-40 mt-0.5`}
              >
                📍 {alamatText}
              </p>
            </div>
            <span
              className={`text-[7px] font-mono font-bold ${theme.textMuted} opacity-20 shrink-0`}
            >
              ID_{String(safeItem.id).slice(-4)}
            </span>
          </div>

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

// ==================== MEMO COMPARISON ====================
const areEqual = (prevProps, nextProps) => {
  return (
    prevProps.item?.id === nextProps.item?.id &&
    prevProps.item?.vibe_count === nextProps.item?.vibe_count &&
    prevProps.item?.photos?.length === nextProps.item?.photos?.length &&
    prevProps.item?.laporan_terbaru?.length ===
      nextProps.item?.laporan_terbaru?.length &&
    prevProps.comments === nextProps.comments &&
    prevProps.locationReady === nextProps.locationReady &&
    prevProps.location?.latitude === nextProps.location?.latitude &&
    prevProps.location?.longitude === nextProps.location?.longitude &&
    prevProps.selectedPhotoIndex?.[prevProps.item?.id] ===
      nextProps.selectedPhotoIndex?.[nextProps.item?.id]
  );
};

export default memo(FeedCard, areEqual);