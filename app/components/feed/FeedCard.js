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

// --- ANIMATION CONSTANTS (dipindahkan ke luar komponen agar tidak re-created) ---
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
  transition: { repeat: Infinity, duration: 2.5, ease: "linear" } 
};

const DEFAULT_ITEM = { 
  id: 0, name: '', alamat: '', category: '', vibe_count: 0, 
  photos: [], laporan_terbaru: [], status: '', isViral: false, isRamai: false 
};

// --- MAIN COMPONENT ---
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
  // --- STATE (minimal dan terpisah) ---
  const [isSesuai, setIsSesuai] = useState(false);
  const [localValidationCount, setLocalValidationCount] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isStoryModalOpen, setIsStoryModalOpen] = useState(false);
  const [activeStories, setActiveStories] = useState([]);
  const [isVisible, setIsVisible] = useState(false);
  const [localLaporanWarga, setLocalLaporanWarga] = useState(() => item?.laporan_terbaru || []);
  
  // --- HOOKS ---
  const { user } = useAuth();
  const { currentTime, timeLabel: clockLabel } = useClock();
  const theme = useTheme();
  
  // --- REFS (untuk menghindari re-render) ---
  const cardRef = useRef(null);
  const observerRef = useRef(null);
  const channelRef = useRef(null);
  const prevLaporanRef = useRef(item?.laporan_terbaru);
  const isMounted = useRef(true);
  const timeoutRef = useRef(null);
  
  const safeItem = item || DEFAULT_ITEM;
  const tempatId = safeItem.id;
  
  // --- CLEANUP ON UNMOUNT ---
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, []);
  
  // --- INTERSECTION OBSERVER (hanya untuk card yang terlihat) ---
  useEffect(() => {
    const currentCard = cardRef.current;
    if (!currentCard) return;
    
    // Gunakan requestAnimationFrame untuk delay agar tidak blocking scroll
    const initObserver = () => {
      observerRef.current = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting && isMounted.current) {
          setIsVisible(true);
          if (observerRef.current) {
            observerRef.current.disconnect();
            observerRef.current = null;
          }
        }
      }, { threshold: 0.05, rootMargin: "200px" });
      
      observerRef.current.observe(currentCard);
    };
    
    timeoutRef.current = setTimeout(initObserver, 0);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, []);
  
  // --- UPDATE LOCAL LAPORAN (hanya jika props berubah) ---
  useEffect(() => {
    if (prevLaporanRef.current !== safeItem.laporan_terbaru) {
      prevLaporanRef.current = safeItem.laporan_terbaru;
      setLocalLaporanWarga(safeItem.laporan_terbaru || []);
    }
  }, [safeItem.laporan_terbaru]);
  
  // --- SUPABASE SUBSCRIPTION (hanya jika card visible) ---
  useEffect(() => {
    if (!tempatId || !isVisible || !isMounted.current) return;
    
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }
    
    channelRef.current = supabase.channel(`lw_${tempatId}`)
      .on(
        "postgres_changes", 
        { event: "INSERT", schema: "public", table: "laporan_warga", filter: `tempat_id=eq.${tempatId}` }, 
        ({ new: n }) => {
          if (!n || !isMounted.current) return;
          setLocalLaporanWarga(prev => {
            if (prev.some(l => l.id === n.id)) return prev;
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
  
  // --- MEMOIZED COMPUTATIONS (dengan dependency minimal) ---
  const totalSaksi = useMemo(
    () => localValidationCount + (safeItem.vibe_count || 0), 
    [localValidationCount, safeItem.vibe_count]
  );
  
  const validatedLocationName = useMemo(() => {
    if (!locationReady || !location) return displayLocation || "Pasuruan";
    const sourceAlamat = (tempat?.length > 0 ? tempat[0]?.alamat : safeItem.alamat) || "";
    const parts = sourceAlamat.split(",").map(p => p.trim());
    const district = parts.find(p => p.includes("Kec.") || p.includes("Kecamatan"));
    return district 
      ? district.replace(/Kec\.|Kecamatan/g, "").trim() 
      : (parts[1] || parts[0] || displayLocation || "Area Aktif");
  }, [locationReady, location?.latitude, location?.longitude, tempat, safeItem.alamat, displayLocation]);
  
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
    return photos
      .filter(p => p && typeof p === "string" && p.startsWith("http"))
      .map(p => ({ url: p, isOfficial: true, badge: "⭐ Official" }));
  }, [safeItem.photos]);
  
  // --- CALLBACKS (stabil dengan useCallback) ---
  const handleSesuai = useCallback(async () => {
    if (isSesuai || !safeItem.id) return;
    setIsSesuai(true);
    setLocalValidationCount(v => v + 1);
    try {
      await supabase.from("minat").insert([{ tempat_id: safeItem.id }]);
    } catch (e) {
      console.error(e);
    }
  }, [isSesuai, safeItem.id]);
  
  const handleOpenStoryModal = useCallback((id, stories) => {
    setActiveStories((stories || []).map(s => ({ 
      ...s, 
      url: s.url || s.photo_url || s.image_url 
    })));
    setIsStoryModalOpen(true);
  }, []);
  
  const handleUploadSuccess = useCallback((newLaporan) => {
    setLocalLaporanWarga(prev => {
      if (prev.some(l => l.id === newLaporan.id)) return prev;
      return [newLaporan, ...prev].slice(0, 50);
    });
    requestAnimationFrame(() => {
      setActiveStories(prev => [newLaporan, ...prev].map(s => ({ 
        ...s, 
        url: s.url || s.photo_url || s.image_url 
      })));
      setIsStoryModalOpen(true);
    });
  }, []);
  
  const handleOpenAIModal = useCallback(() => {
    if (openAIModal) openAIModal(safeItem, handleUploadSuccess);
  }, [openAIModal, safeItem, handleUploadSuccess]);
  
  const handleCloseStoryModal = useCallback(() => setIsStoryModalOpen(false), []);
  
  // --- EARLY RETURN (jika tidak ada item) ---
  if (!item?.id) return null;
  
  // --- RENDER OPTIMIZATION (gunakan variabel lokal untuk menghindari re-compute) ---
  const [currentHour, currentMinute] = currentTime.split(':');
  const currentPhotoIndex = selectedPhotoIndex?.[safeItem.id] || 0;
  const activePhoto = photoUrls[currentPhotoIndex];
  const headline = feed?.headline?.text || feed?.narasiCerita?.split('.')[0] || "UPDATE SEKITAR";
  const distanceText = feed?.distance ? `${feed.distance.toFixed(1)} KM DARI ANDA` : "LIVE SEKITAR";
  const categoryText = safeItem.category || "GENERAL";
  const alamatText = safeItem.alamat || "AREA SETEMPAT";
  const itemStatusClass = safeItem.isViral ? "viral" : safeItem.isRamai ? "ramai" : "biasa";
  
  return (
    <div 
      ref={cardRef} 
      id={`feed-card-${safeItem.id}`} 
      className="relative mb-6 w-full will-change-transform" 
      style={{ isolation: "isolate" }}
    >
      <motion.div
        layoutId={`card-container-${safeItem.id}`}
        layout="position" 
        initial={false} 
        animate={{ opacity: 1 }} 
        className={`relative overflow-visible rounded-[32px] ${theme.card} border ${theme.border} shadow-xl flex flex-col`}
      >
        {/* Title */}
        <div className="px-6 pt-5 pb-1">
          <h2 className={`text-[17px] font-[1000] italic leading-tight tracking-tight uppercase ${theme.text} line-clamp-2`}>
            {headline}
          </h2>
        </div>

        {/* Header */}
        <div className="flex justify-between items-center px-6 pb-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              <motion.span 
                {...PING_ANIM} 
                className={`absolute inset-0 rounded-full ${theme.isMalam ? 'bg-emerald-400' : 'bg-emerald-500'}`} 
              />
              <span className={`relative rounded-full h-1.5 w-1.5 ${theme.isMalam ? 'bg-emerald-500' : 'bg-emerald-600'}`} />
            </span>
            <span className={`text-[9px] font-black tracking-[0.05em] ${theme.accent} italic uppercase`}>
              {distanceText}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md ${theme.isMalam ? 'bg-white/10' : 'bg-black/5'} ${theme.text} opacity-50 tracking-tighter uppercase`}>
              {categoryText}
            </span>
            <div className={`flex items-center font-mono text-[9px] font-bold ${theme.text} opacity-70`}>
              <span>{currentHour}</span>
              <motion.span {...BLINK_ANIM} className="mx-0.5">:</motion.span>
              <span>{currentMinute}</span>
            </div>
          </div>
        </div>

        {/* Status Island */}
        <div className="px-5 mb-3 space-y-1.5">
          <StatusIsland 
            item={safeItem} 
            theme={theme} 
            isExpanded={isExpanded} 
            setIsExpanded={setIsExpanded} 
            jumlahWarga={totalSaksi} 
          />
          <div className={`${theme.statusBg} rounded-[20px] p-1.5 pl-3 border ${theme.border} flex items-center justify-between gap-3 shadow-inner`}>
            <div className="flex-1 min-w-0 overflow-hidden scale-95 origin-left">
              <LiveInsight 
                signals={feed?.allSignals || []} 
                theme={theme} 
                isCompact={true} 
                currentUser={user} 
              />
            </div>
          </div>
        </div>

        {/* Media Section */}
        <div className="relative px-3.5 mb-3.5">
          <div className="relative aspect-[16/10.5] rounded-[26px] overflow-hidden border ${theme.border} shadow-lg" style={{ zIndex: 1 }}>
            <PhotoSlider
              photos={photoUrls}
              timeLabel={clockLabel}
              tempatId={safeItem.id}
              namaTempat={safeItem.name}
              isHujan={safeItem.status === 'hujan'}
              itemStatus={itemStatusClass}
              theme={theme}
              selectedPhotoIndex={currentPhotoIndex}
              setSelectedPhotoIndex={setSelectedPhotoIndex}
              onUploadSuccess={handleUploadSuccess}
            />
          </div>
          
          {/* Overlays */}
          <div className="absolute top-4 left-1 z-50 scale-90">
            <StoryCircle 
              laporanWarga={localLaporanWarga} 
              tempatId={safeItem.id} 
              namaTempat={safeItem.name} 
              tempatKategori={safeItem.category}  
              theme={theme} 
              openStoryModal={handleOpenStoryModal} 
            />
          </div>
          <div className="absolute -right-1 top-2.5 z-50 scale-90">
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

        {/* Footer */}
        <div className="px-6 pb-6 space-y-3.5">
          <div className="flex justify-between items-end px-0.5">
            <div className="min-w-0">
              <h3 className={`text-[13px] font-[1000] ${theme.text} uppercase truncate tracking-tight`}>
                {safeItem.name}
              </h3>
              <p className={`text-[8px] font-bold ${theme.textMuted} uppercase tracking-wider opacity-40 truncate mt-0.5`}>
                📍 {alamatText}
              </p>
            </div>
            <span className={`text-[7px] font-mono font-bold ${theme.textMuted} opacity-20 shrink-0`}>
              ID_{String(safeItem.id).slice(-4)}
            </span>
          </div>

          {/* AI Button */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            whileHover={{ y: -1 }}
            onClick={handleOpenAIModal}
            className={`group relative w-full flex items-center justify-between px-4 py-3 rounded-[22px] border transition-all duration-300 shadow-md hover:shadow-xl overflow-hidden ${theme.accentBg} border-white/20 text-white`}
          >
            <motion.div 
              {...SHIMMER_ANIM} 
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent skew-x-12 pointer-events-none" 
            />
            
            <div className="flex items-center gap-3 relative z-10">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-base bg-white/20 backdrop-blur-md shadow-inner">
                ✨
              </div>
              <div className="flex flex-col items-start leading-tight">
                <span className="text-[11px] font-[900] uppercase tracking-wider">TANYA AKAMSI AI</span>
                <span className="text-[7.5px] font-bold opacity-70 uppercase tracking-tight">Ringkasan & Analisis Lokasi</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 relative z-10 bg-black/20 px-2.5 py-1.5 rounded-xl border border-white/10 group-hover:bg-black/30 transition-colors">
              <span className="text-[9px] font-black italic tracking-tighter uppercase">ASK</span>
              <motion.div 
                animate={{ opacity: [0.4, 1, 0.4] }} 
                transition={{ repeat: Infinity, duration: 1.5 }} 
                className="w-1 h-1 rounded-full bg-emerald-400" 
              />
            </div>
          </motion.button>
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

// --- MEMO COMPARISON (optimasi render) ---
const areEqual = (prevProps, nextProps) => {
  // Bandingkan hanya props yang penting untuk re-render
  return (
    prevProps.item?.id === nextProps.item?.id &&
    prevProps.item?.vibe_count === nextProps.item?.vibe_count &&
    prevProps.item?.photos?.length === nextProps.item?.photos?.length &&
    prevProps.item?.laporan_terbaru?.length === nextProps.item?.laporan_terbaru?.length &&
    prevProps.comments === nextProps.comments &&
    prevProps.locationReady === nextProps.locationReady &&
    prevProps.location?.latitude === nextProps.location?.latitude &&
    prevProps.location?.longitude === nextProps.location?.longitude &&
    prevProps.selectedPhotoIndex?.[prevProps.item?.id] === nextProps.selectedPhotoIndex?.[nextProps.item?.id]
  );
};

export default memo(FeedCard, areEqual);