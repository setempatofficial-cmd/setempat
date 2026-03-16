"use client";

import { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import PhotoSlider from "./PhotoSlider";
import { processFeedItem } from "../../../lib/feedEngine";
import LiveInsight from "./LiveInsight";
import { useClock } from "../../../hooks/useClock";
import { supabase } from "@/lib/supabaseClient";
import FeedActions from "./FeedActions";
import StatusIsland from "./StatusIsland";
import { FEED_THEMES } from "./FeedThemes";

// Animasi di luar komponen agar ringan
const ANIM = {
  ping: { animate: { opacity: [0.5, 1, 0.5] }, transition: { repeat: Infinity, duration: 2 } },
  blink: { animate: { opacity: [1, 0, 1] }, transition: { repeat: Infinity, duration: 1, ease: "linear" } },
  shimmer: { animate: { x: ['-100%', '200%'] }, transition: { repeat: Infinity, duration: 3, ease: "linear" } }
};

export default function FeedCard({
  item,
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
  const { currentTime, timeLabel: clockLabel } = useClock();
  const [isExpanded, setIsExpanded] = useState(false);

  const timeTheme = useMemo(() => FEED_THEMES[clockLabel] || FEED_THEMES.Malam, [clockLabel]);

  // Total saksi = existing + local
  const totalSaksi = useMemo(() => {
    return localValidationCount + (item.vibe_count || 0);
  }, [localValidationCount, item.vibe_count]);

  // --- LOGIKA LOKASI TERVALIDASI ---
  const validatedLocationName = useMemo(() => {
    if (!locationReady || !location) return displayLocation || "Pasuruan";
    
    if (tempat && tempat.length > 0) {
      const nearestPlace = tempat[0];
      const parts = (nearestPlace.alamat || "").split(",").map((p) => p.trim());
      const district = parts.find((p) => p.includes("Kec.") || p.includes("Kecamatan"));
      if (district) return district.replace(/Kec\.|Kecamatan/g, "").trim();
      return parts[1] || parts[0] || displayLocation;
    }

    const parts = (item.alamat || "").split(",").map((p) => p.trim());
    return parts[1] || parts[0] || displayLocation || "Area Aktif";
  }, [locationReady, location, item.alamat, tempat, displayLocation]);

  const feed = useMemo(() => {
    if (!item) return { allSignals: [], narasiCerita: "", distance: null };
    return processFeedItem({ item, comments, locationReady, location });
  }, [item, comments, locationReady, location?.latitude, location?.longitude]);

  const photoUrls = useMemo(() => {
    if (!item?.photos) return [];
    const currentTag = clockLabel?.toLowerCase() || "pagi";
    const filtered = item.photos.filter(p => p.time_tag?.toLowerCase() === currentTag);
    return (filtered.length ? filtered : item.photos).map(p => typeof p === 'string' ? p : p.url);
  }, [item?.photos, clockLabel]);

  const handleSesuai = useCallback(async () => {
    if (isSesuai || !item?.id) return;
    setIsSesuai(true);
    setLocalValidationCount(v => v + 1);
    try {
      await supabase.from("minat").insert([{ tempat_id: item.id }]);
    } catch (e) { console.error(e); }
  }, [isSesuai, item?.id]);

  if (!item) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      // HAPUS mx-auto dan batasan width - serahkan ke container
      className={`relative mb-6 w-full transition-all duration-700 ${timeTheme.glow}`}
    >
      <div className={`relative overflow-hidden rounded-[40px] ${timeTheme.bgCard} border ${timeTheme.border} shadow-2xl flex flex-col`}>
        
        {/* --- 1. HEADER --- */}
        <div className="flex justify-between items-start px-6 pt-7 pb-4 gap-2">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2 shrink-0">
                <motion.span {...ANIM.ping} className="absolute inset-0 rounded-full bg-emerald-400" />
                <span className="relative rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className={`text-[10px] font-black tracking-tight ${timeTheme.accent} italic uppercase whitespace-nowrap`}>
                {feed.distance ? `${feed.distance.toFixed(1)} Km dari Anda` : "LIVE"}
              </span>
            </div>
            <span className="text-[7px] font-mono opacity-30 text-white tracking-[0.3em]">V_3.5</span>
          </div>

          <div className="flex flex-col items-end gap-1.5 shrink-0 max-w-[65%]">
            <span className={`text-[9px] font-black ${timeTheme.textWhite} opacity-60 uppercase tracking-widest`}>
              {item.category || "GENERAL"}
            </span>
            
            {/* BADGE LOKASI & WAKTU */}
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 shadow-sm">
              <span className="text-[9px] font-black text-emerald-400 tracking-tighter uppercase truncate max-w-[80px]">
                {validatedLocationName}
              </span>
              <span className={`text-[7px] font-black tracking-[0.1em] uppercase opacity-40 ${timeTheme.textWhite || 'text-white'}`}>SUASANA</span>

              <div className="flex items-center gap-1">
                <span className={`text-[8px] font-bold ${timeTheme.textMuted} uppercase tracking-tighter`}>{timeTheme.name}</span>
                <div className="flex items-center bg-black/40 px-1.5 py-0.5 rounded border border-white/5 font-mono text-[9px] text-white">
                  <span>{currentTime.split(':')[0]}</span>
                  <motion.span {...ANIM.blink} className="mx-0.5">:</motion.span>
                  <span>{currentTime.split(':')[1]}</span>
                  <span className="ml-1">WIB</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* --- 2. HEADLINE --- */}
        <div className="px-7 pb-5">
          <h2 className={`text-[26px] font-[1000] italic leading-[0.95] tracking-tight uppercase ${timeTheme.textWhite} break-words`}>
            {feed.headline?.text || feed.narasiCerita?.split('.')[0] || "SUASANA SEKITAR"}
          </h2>
        </div>

        {/* --- 3. STATUS ISLAND --- */}
        <div className="px-5 mb-4 relative">
          <div className="text-sm">
            <StatusIsland 
              item={item} theme={timeTheme} isExpanded={isExpanded} setIsExpanded={setIsExpanded}
              jumlahWarga={totalSaksi}
            />
          </div>
        </div>

        {/* --- 4. LIVE INSIGHT & AI ACTION --- */}
        <div className="px-5 mb-5">
          <div className="bg-black/30 backdrop-blur-xl rounded-[32px] p-4 border border-white/5">
             <div className="flex justify-between items-center mb-4 px-1">
                <span className={`text-[9px] font-black ${timeTheme.accent} uppercase tracking-[0.2em] flex items-center gap-2`}>
                   <span className="w-1 h-3 bg-current rounded-full animate-pulse" />
                   Live_Insight
                </span>
                
                <button onClick={() => openAIModal(item)} className="relative group flex items-center gap-2 px-4 py-1.5 rounded-full overflow-hidden transition-transform active:scale-95 shadow-lg bg-indigo-600">
                  <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-indigo-600" />
                  <motion.div {...ANIM.shimmer} className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12" />
                  <div className="relative flex items-center gap-2 text-white">
                    <span className="text-[10px] animate-bounce">✨</span>
                    <div className="flex flex-col items-start leading-none">
                      <span className="text-[11px] font-black uppercase tracking-tighter">AI Setempat</span>
                      <span className="text-[10px] font-bold opacity-70 uppercase tracking-widest text-white/80">Lapor/Tanya</span>
                    </div>
                  </div>
                </button>
             </div>
             <LiveInsight signals={feed.allSignals || []} theme={timeTheme} />
          </div>
        </div>

        {/* --- 5. PHOTO CONTEXT --- */}
        <div className="relative px-5 mb-6">
          <div className="absolute -right-1 top-0 z-10">
            <FeedActions item={item} comments={comments} openKomentarModal={openKomentarModal} onShare={onShare} variant="floating-sidebar" />
          </div>
          <div className="relative aspect-video rounded-[30px] overflow-hidden border border-white/10 shadow-2xl">
            <PhotoSlider photos={photoUrls} selectedPhotoIndex={selectedPhotoIndex?.[item.id] || 0} setSelectedPhotoIndex={setSelectedPhotoIndex} />
            <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
               <p className="text-[9px] font-bold text-white/40 italic tracking-widest uppercase">Visual_Context_Archive</p>
            </div>
          </div>
        </div>

        {/* --- 6. FOOTER - URUTAN YANG LEBIH BAIK --- */}
        <div className="px-6 pb-8 space-y-5 mt-auto">
          {/* INFO TEMPAT DULU */}
          <div className="flex flex-col gap-1 border-b border-white/5 pb-4">
            <div className="flex justify-between items-end">
              <h3 className={`text-base font-black ${timeTheme.textWhite} tracking-tighter uppercase truncate max-w-[80%]`}>{item.name}</h3>
              <span className="text-[8px] font-mono opacity-20 mb-1">ID_{String(item.id).slice(-4)}</span>
            </div>
            <p className={`text-[10px] font-bold ${timeTheme.textMuted} uppercase tracking-widest opacity-60 truncate`}>📍 {item.alamat || "AREA_SETEMPAT"}</p>
          </div>

          {/* TOMBOL VIBE DI PALING BAWAH */}
          <button 
            onClick={handleSesuai}
            disabled={isSesuai}
            className={`w-full flex items-center justify-center px-4 py-3 rounded-[20px] border backdrop-blur-md transition-all duration-500 active:scale-[0.98] shadow-xl ${
              isSesuai 
                ? "bg-emerald-500 border-emerald-300 text-white shadow-emerald-500/20" 
                : "bg-black/60 border-white/10 text-white/90 hover:bg-black/70 hover:border-white/20"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{isSesuai ? '✅' : '👌'}</span>
              <div className="flex flex-col items-center leading-none">
                <span className="text-[11px] font-black uppercase tracking-tighter">
                  {isSesuai ? "TERVALIDASI" : "VIBE SESUAI"}
                </span>
                <span className="text-[8px] font-bold text-white/60 uppercase mt-1">
                  {totalSaksi} Warga Sepakat
                </span>
              </div>
            </div>
            
            {!isSesuai && (
              <span className="text-white/40 text-[10px] font-mono opacity-60 group-hover:opacity-100 transition-opacity">
                ↻
              </span>
            )}
          </button>
        </div>

      </div>
    </motion.div>
  );
}