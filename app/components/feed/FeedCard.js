"use client";
import { useState, useMemo, useCallback, useEffect, useRef, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PhotoSlider from "./PhotoSlider";
import { processFeedItem } from "../../../lib/feedEngine";
import LiveInsight from "./LiveInsight";
import { useClock } from "../../../hooks/useClock";
import { supabase } from "@/lib/supabaseClient";
import FeedActions from "./FeedActions";
import StatusIsland from "./StatusIsland";
import { useTheme } from "@/app/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import StoryCircle from "@/app/components/feed/StoryCircle";
import StoryModal from "@/app/components/feed/StoryModal";

// Konstanta animasi di luar komponen — tidak dibuat ulang tiap render
const PING_ANIM = {
  animate: { opacity: [0.5, 1, 0.5] },
  transition: { repeat: Infinity, duration: 2 }
};
const BLINK_ANIM = {
  animate: { opacity: [1, 0, 1] },
  transition: { repeat: Infinity, duration: 1, ease: "linear" }
};
const SHIMMER_ANIM = {
  animate: { x: ['-100%', '200%'] },
  transition: { repeat: Infinity, duration: 3, ease: "linear" }
};

const DEFAULT_ITEM = {
  id: 0, name: '', alamat: '', category: '',
  vibe_count: 0, photos: [], laporan_terbaru: [],
  status: '', isViral: false, isRamai: false,
};

// Avatar dari inisial + warna hash — zero HTTP request, unik per item
const AVATAR_COLORS = [
  ["#E3655B", "#fff"], ["#06b6d4", "#fff"], ["#8b5cf6", "#fff"],
  ["#f59e0b", "#fff"], ["#10b981", "#fff"], ["#ec4899", "#fff"],
  ["#3b82f6", "#fff"], ["#f97316", "#fff"],
];

function getAvatarColor(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) & 0xffffffff;
  }
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

const InitialAvatar = memo(({ seed, border }) => {
  const letter = (seed || "W")[0].toUpperCase();
  const [bg, fg] = getAvatarColor(seed || "W");
  return (
    <div
      className={`w-6 h-6 rounded-full border-2 ${border} shadow-sm flex items-center justify-center text-[9px] font-black select-none`}
      style={{ backgroundColor: bg, color: fg }}
    >
      {letter}
    </div>
  );
});
InitialAvatar.displayName = "InitialAvatar";

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
}) {
  const [isSesuai, setIsSesuai] = useState(false);
  const [localValidationCount, setLocalValidationCount] = useState(0);
  const { user } = useAuth();
  const { currentTime, timeLabel: clockLabel } = useClock();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isStoryModalOpen, setIsStoryModalOpen] = useState(false);
  const [activeStories, setActiveStories] = useState([]);
  const [isVisible, setIsVisible] = useState(false);

  const theme = useTheme();
  const safeItem = item || DEFAULT_ITEM;
  const cardRef = useRef(null);
  const observerRef = useRef(null);
  const channelRef = useRef(null);

  // ── LAZY LOAD: SUBSCRIBE REALTIME HANYA SAAT CARD MASUK VIEWPORT ─────────
  useEffect(() => {
    const currentCard = cardRef.current;
    if (!currentCard) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          // Optional: disconnect setelah visible untuk menghemat resource
          if (observerRef.current) {
            observerRef.current.disconnect();
            observerRef.current = null;
          }
        }
      },
      { threshold: 0.1, rootMargin: "100px" }
    );

    observerRef.current.observe(currentCard);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, []);

  // ── LAPORAN WARGA ──
  const [localLaporanWarga, setLocalLaporanWarga] = useState(() => safeItem.laporan_terbaru || []);
  const prevLaporanRef = useRef(safeItem.laporan_terbaru);

  useEffect(() => {
    if (prevLaporanRef.current !== safeItem.laporan_terbaru) {
      prevLaporanRef.current = safeItem.laporan_terbaru;
      setLocalLaporanWarga(safeItem.laporan_terbaru || []);
    }
  }, [safeItem.laporan_terbaru]);

  // ── REALTIME — HANYA AKTIF SAAT CARD TERLIHAT ──
  const tempatId = safeItem.id;

  useEffect(() => {
    if (!tempatId || !isVisible) return;

    // Cleanup channel sebelumnya jika ada
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    channelRef.current = supabase
      .channel(`lw_${tempatId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "laporan_warga",
        filter: `tempat_id=eq.${tempatId}`,
      }, ({ new: n }) => {
        if (!n) return;
        setLocalLaporanWarga(prev => {
          if (prev.some(l => l.id === n.id)) return prev;
          return [n, ...prev].slice(0, 50); // Batasi maksimal 50 item
        });
      })
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [tempatId, isVisible]);

  // ── COMPUTED VALUES ──
  const totalSaksi = useMemo(() =>
    localValidationCount + (safeItem.vibe_count || 0),
    [localValidationCount, safeItem.vibe_count]
  );

  // Optimasi: pisahkan dependency untuk validatedLocationName
  const validatedLocationName = useMemo(() => {
    if (!locationReady || !location) return displayLocation || "Pasuruan";

    if (tempat?.length > 0) {
      const alamatTempat = tempat[0]?.alamat || "";
      const parts = alamatTempat.split(",").map(p => p.trim());
      const district = parts.find(p => p.includes("Kec.") || p.includes("Kecamatan"));
      if (district) {
        return district.replace(/Kec\.|Kecamatan/g, "").trim();
      }
      return parts[1] || parts[0] || "Area Aktif";
    }

    const alamatItem = safeItem.alamat || "";
    const parts = alamatItem.split(",").map(p => p.trim());
    return parts[1] || parts[0] || displayLocation || "Area Aktif";
  }, [locationReady, location?.latitude, location?.longitude, tempat, safeItem.alamat, displayLocation]);

  // Optimasi: stabilkan dependency feed
  const feed = useMemo(() => {
    return processFeedItem({
      item: safeItem,
      comments,
      locationReady,
      location
    });
  }, [
    safeItem.id,
    safeItem.vibe_count,
    safeItem.status,
    safeItem.isViral,
    safeItem.isRamai,
    comments,
    locationReady,
    location?.latitude,
    location?.longitude
  ]);

  const photoUrls = useMemo(() => {
    const photos = Array.isArray(safeItem.photos) ? safeItem.photos : [];
    const validPhotos = photos.filter(p => p && typeof p === "string" && p.startsWith("http"));
    // Hindari re-map jika konten sama
    if (validPhotos.length === 0) return [];
    return validPhotos.map(p => ({ url: p, isOfficial: true, badge: "⭐ Official" }));
  }, [safeItem.photos]);

  // ── HANDLERS DENGAN DEPENDENCY YANG STABIL ──
  const handleSesuai = useCallback(async () => {
    if (isSesuai || !safeItem.id) return;
    setIsSesuai(true);
    setLocalValidationCount(v => v + 1);

    // Non-blocking, tidak perlu await
    (async () => {
      try {
        await supabase.from("minat").insert([{ tempat_id: safeItem.id }]);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [isSesuai, safeItem.id]);

  const handleOpenStoryModal = useCallback((id, stories) => {
    const mappedStories = (stories || []).map(s => ({
      ...s,
      url: s.url || s.photo_url || s.image_url
    }));
    setActiveStories(mappedStories);
    setIsStoryModalOpen(true);
  }, []);

  const handleUploadSuccess = useCallback((newLaporan) => {
    setLocalLaporanWarga(prev => {
      if (prev.some(l => l.id === newLaporan.id)) return prev;
      return [newLaporan, ...prev].slice(0, 50);
    });

    // Gunakan requestAnimationFrame untuk delay yang lebih smooth
    requestAnimationFrame(() => {
      setActiveStories(prev => {
        const all = [newLaporan, ...prev];
        return all.map(s => ({ ...s, url: s.url || s.photo_url || s.image_url }));
      });
      setIsStoryModalOpen(true);
    });
  }, []);

  const handleOpenAIModal = useCallback(() => {
    if (openAIModal) {
      openAIModal(safeItem, handleUploadSuccess);
    }
  }, [openAIModal, safeItem, handleUploadSuccess]);

  const handleCloseStoryModal = useCallback(() => {
    setIsStoryModalOpen(false);
  }, []);

  // Early return
  if (!item?.id) return null;

  // Optimasi: ambil currentTime parts sekali render
  const timeParts = currentTime.split(':');
  const currentHour = timeParts[0];
  const currentMinute = timeParts[1];

  // Ambil selected index untuk PhotoSlider
  const currentPhotoIndex = selectedPhotoIndex?.[safeItem.id] || 0;
  const activePhoto = photoUrls[currentPhotoIndex];

  return (
    <div
      ref={cardRef}
      id={`feed-card-${safeItem.id}`}
      className="relative mb-5 w-full"
      style={{ isolation: "isolate" }}
    >
      <motion.div
        initial={false}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className={`relative overflow-visible rounded-[35px] ${theme.card} border ${theme.border} shadow-xl flex flex-col`}
      >
        {/* ── HEADER ── */}
        <div className="flex justify-between items-start px-6 pt-7 pb-4 gap-2">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2 shrink-0">
                <motion.span
                  {...PING_ANIM}
                  className={`absolute inset-0 rounded-full ${theme.isMalam ? 'bg-emerald-400' : 'bg-emerald-500'}`}
                />
                <span className={`relative rounded-full h-2 w-2 ${theme.isMalam ? 'bg-emerald-500' : 'bg-emerald-600'}`} />
              </span>
              <span className={`text-[10px] font-black tracking-tight ${theme.accent} italic uppercase whitespace-nowrap`}>
                {feed?.distance ? `${feed.distance.toFixed(1)} Km dari Anda` : "LIVE"}
              </span>
            </div>
            <span className="text-[7px] font-mono opacity-30 text-white tracking-[0.3em]">V_3.5</span>
          </div>

          <div className="flex flex-col items-end gap-1.5 shrink-0 max-w-[65%]">
            <span className={`text-[9px] font-black ${theme.text} opacity-60 uppercase tracking-widest`}>
              {safeItem.category || "GENERAL"}
            </span>
            <div className={`flex items-center gap-2 px-2.5 py-1 rounded-lg ${theme.isMalam ? 'bg-white/5' : 'bg-black/5'} border ${theme.border} shadow-sm`}>
              <span className={`text-[9px] font-black ${theme.accent} tracking-tighter uppercase truncate max-w-[80px]`}>
                {validatedLocationName}
              </span>
              <span className={`text-[7px] font-black tracking-[0.1em] uppercase opacity-40 ${theme.text}`}>SUASANA</span>
              <div className="flex items-center gap-1">
                <span className={`text-[8px] font-bold ${theme.textMuted} uppercase tracking-tighter`}>{theme.sapaan}</span>
                <div className={`flex items-center ${theme.isMalam ? 'bg-black/40' : 'bg-white/40'} px-1.5 py-0.5 rounded border border-white/5 font-mono text-[9px] ${theme.text}`}>
                  <span>{currentHour}</span>
                  <motion.span {...BLINK_ANIM} className="mx-0.5">:</motion.span>
                  <span>{currentMinute}</span>
                  <span className="ml-1">WIB</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── HEADLINE ── */}
        <div className="px-6 pb-3">
          <h2 className={`text-[21px] font-[1000] italic leading-[1.1] tracking-tight uppercase ${theme.text}`}>
            {feed?.headline?.text || feed?.narasiCerita?.split('.')[0] || "UPDATE SEKITAR"}
          </h2>
        </div>

        {/* ── STATUS & AI ── */}
        <div className="px-5 mb-4 space-y-2">
          <StatusIsland
            item={safeItem}
            theme={theme}
            isExpanded={isExpanded}
            setIsExpanded={setIsExpanded}
            jumlahWarga={totalSaksi}
          />
          <div className={`${theme.statusBg} rounded-[24px] p-3 border ${theme.border} flex items-center justify-between gap-3 shadow-inner`}>
            <div className="flex-1 min-w-0">
              <LiveInsight
                signals={feed?.allSignals || []}
                theme={theme}
                isCompact={true} currentUser={user} />
            </div>
            <button
              onClick={handleOpenAIModal}
              className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-full relative overflow-hidden shadow-lg active:scale-90 transition-transform ${theme.accentBg}`}
            >
              <motion.div {...SHIMMER_ANIM} className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12" />
              <div className="relative z-10 flex flex-col items-center leading-none">
                <span className="text-[11px] font-black text-white uppercase italic">AKAMSI</span>
                <span className="text-[7px] font-bold text-white/80 uppercase tracking-widest mt-0.5">AI Setempat</span>
              </div>
            </button>
          </div>
        </div>

        {/* ── PHOTO CONTEXT ── */}
        <div className="relative px-4 mb-4">
          <div className="relative" style={{ minHeight: '200px' }}>
            <div className={`relative aspect-[16/10] rounded-[28px] border ${theme.border} shadow-xl`} style={{ zIndex: 1 }}>
              <div className="absolute inset-0 rounded-[28px] overflow-hidden">
                <PhotoSlider
                  photos={photoUrls}
                  timeLabel={clockLabel}
                  tempatId={safeItem.id}
                  namaTempat={safeItem.name}
                  isHujan={safeItem.status === 'hujan'}
                  itemStatus={safeItem.isViral ? "viral" : safeItem.isRamai ? "ramai" : "biasa"}
                  theme={theme}
                  selectedPhotoIndex={currentPhotoIndex}
                  setSelectedPhotoIndex={setSelectedPhotoIndex}
                  onUploadSuccess={handleUploadSuccess}
                />
              </div>
            </div>
            <div className="absolute top-4 left-2 pointer-events-auto" style={{ zIndex: 50 }}>
              <StoryCircle
                laporanWarga={localLaporanWarga}
                tempatId={safeItem.id}
                namaTempat={safeItem.name}
                theme={theme}
                openStoryModal={handleOpenStoryModal}
              />
            </div>
            <div className="absolute -right-1 top-3 pointer-events-auto" style={{ zIndex: 50 }}>
              <FeedActions
                item={{ ...safeItem, activePhoto }}
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

        {/* ── FOOTER ── */}
        <div className="px-5 pb-6 space-y-3">
          <div className="flex justify-between items-end px-1">
            <div className="min-w-0">
              <h3 className={`text-[14px] font-black ${theme.text} uppercase truncate tracking-tighter leading-none`}>
                {safeItem.name}
              </h3>
              <p className={`text-[9px] font-bold ${theme.textMuted} uppercase tracking-widest opacity-70 truncate mt-1`}>
                📍 {safeItem.alamat || "AREA_SETEMPAT"}
              </p>
            </div>
            <span className={`text-[8px] font-mono ${theme.textMuted} opacity-30 shrink-0`}>
              ID_{String(safeItem.id).slice(-4)}
            </span>
          </div>

          <button
            onClick={handleSesuai}
            disabled={isSesuai}
            className={`group relative w-full flex items-center justify-between px-4 py-3 rounded-[22px] border transition-all duration-300 active:scale-[0.97]
              ${isSesuai
                ? "bg-[#1e3a3a] border-[#2d5a5a] text-emerald-400 shadow-lg"
                : `${theme.isMalam ? 'bg-white/5' : 'bg-black/5'} ${theme.border} ${theme.text}`}`}
          >
            <div className="flex items-center gap-3 relative z-10">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isSesuai ? 'bg-emerald-500/20' : 'bg-current/10'}`}>
                <span className="text-lg">{isSesuai ? '✅' : '👌'}</span>
              </div>
              <div className="flex flex-col items-start leading-tight">
                <span className={`text-[11px] font-[900] uppercase tracking-wider ${isSesuai ? 'text-emerald-400' : ''}`}>
                  {isSesuai ? "TERVALIDASI" : "VIBE SESUAI"}
                </span>
                <span className="text-[9px] font-medium opacity-60">{totalSaksi} Warga Sepakat</span>
              </div>
            </div>

            <div className="flex -space-x-2 items-center relative z-10">
              {["a", "b", "c"].map((s, i) => (
                <motion.div
                  key={i}
                  initial={false}
                  animate={isSesuai ? {
                    scale: [1, 1.4, 1],
                    y: [0, -6, 0],
                  } : { scale: 1, y: 0 }}
                  transition={{
                    delay: i * 0.08,
                    duration: 0.4,
                    ease: "easeOut",
                  }}
                >
                  <InitialAvatar seed={`${s}${safeItem.id}`} border={theme.border} />
                </motion.div>
              ))}
              <AnimatePresence>
                {isSesuai && (
                  <motion.div
                    initial={{ scale: 0, x: 10, opacity: 0 }}
                    animate={{ scale: 1, x: 0, opacity: 1 }}
                    transition={{ delay: 0.25, type: "spring", stiffness: 300, damping: 18 }}
                  >
                    <InitialAvatar seed={`you${safeItem.id}`} border={theme.border} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </button>
        </div>
      </motion.div>

      <StoryModal
        isOpen={isStoryModalOpen}
        onClose={handleCloseStoryModal}
        stories={activeStories}
        theme={theme}
        namaTempat={safeItem.name}
      />
    </div>
  );
}

// Custom comparison untuk memo
const areEqual = (prevProps, nextProps) => {
  // Hanya re-render jika props penting berubah
  return (
    prevProps.item?.id === nextProps.item?.id &&
    prevProps.item?.vibe_count === nextProps.item?.vibe_count &&
    prevProps.item?.photos === nextProps.item?.photos &&
    prevProps.item?.laporan_terbaru === nextProps.item?.laporan_terbaru &&
    prevProps.comments === nextProps.comments &&
    prevProps.locationReady === nextProps.locationReady &&
    prevProps.location?.latitude === nextProps.location?.latitude &&
    prevProps.location?.longitude === nextProps.location?.longitude &&
    prevProps.selectedPhotoIndex?.[prevProps.item?.id] === nextProps.selectedPhotoIndex?.[nextProps.item?.id]
  );
};

export default memo(FeedCard, areEqual);