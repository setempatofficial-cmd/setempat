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
import { useTheme } from "@/hooks/useTheme";

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
  
  // PAKAI THEME DARI HOOK
  const theme = useTheme();

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
      className="relative mb-6 w-full transition-all duration-700"
    >
      <div className={`relative overflow-hidden rounded-[40px] ${theme.card} border ${theme.border} shadow-2xl flex flex-col`}>
        
        {/* --- 1. HEADER --- */}
        <div className="flex justify-between items-start px-6 pt-7 pb-4 gap-2">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2 shrink-0">
                <motion.span {...ANIM.ping} className={`absolute inset-0 rounded-full ${theme.isMalam ? 'bg-emerald-400' : 'bg-emerald-500'}`} />
                <span className={`relative rounded-full h-2 w-2 ${theme.isMalam ? 'bg-emerald-500' : 'bg-emerald-600'}`} />
              </span>
              <span className={`text-[10px] font-black tracking-tight ${theme.accent} italic uppercase whitespace-nowrap`}>
                {feed.distance ? `${feed.distance.toFixed(1)} Km dari Anda` : "LIVE"}
              </span>
            </div>
            <span className="text-[7px] font-mono opacity-30 text-white tracking-[0.3em]">V_3.5</span>
          </div>

          <div className="flex flex-col items-end gap-1.5 shrink-0 max-w-[65%]">
            <span className={`text-[9px] font-black ${theme.text} opacity-60 uppercase tracking-widest`}>
              {item.category || "GENERAL"}
            </span>
            
            {/* BADGE LOKASI & WAKTU */}
            <div className={`flex items-center gap-2 px-2.5 py-1 rounded-lg ${theme.isMalam ? 'bg-white/5' : 'bg-black/5'} border ${theme.border} shadow-sm`}>
              <span className={`text-[9px] font-black ${theme.accent} tracking-tighter uppercase truncate max-w-[80px]`}>
                {validatedLocationName}
              </span>
              <span className={`text-[7px] font-black tracking-[0.1em] uppercase opacity-40 ${theme.text}`}>SUASANA</span>

              <div className="flex items-center gap-1">
                <span className={`text-[8px] font-bold ${theme.textMuted} uppercase tracking-tighter`}>{theme.sapaan}</span>
                <div className={`flex items-center ${theme.isMalam ? 'bg-black/40' : 'bg-white/40'} px-1.5 py-0.5 rounded border border-white/5 font-mono text-[9px] ${theme.text}`}>
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
          <h2 className={`text-[26px] font-[1000] italic leading-[0.95] tracking-tight uppercase ${theme.text} break-words`}>
            {feed.headline?.text || feed.narasiCerita?.split('.')[0] || "SUASANA SEKITAR"}
          </h2>
        </div>

        {/* --- 3. STATUS ISLAND --- */}
        <div className="px-5 mb-4 relative">
          <div className="text-sm">
            <StatusIsland 
              item={item} 
              theme={theme} 
              isExpanded={isExpanded} 
              setIsExpanded={setIsExpanded}
              jumlahWarga={totalSaksi}
            />
          </div>
        </div>

        {/* --- 4. LIVE INSIGHT & AI ACTION --- */}
        <div className="px-5 mb-5">
          <div className={`${theme.isMalam ? 'bg-black/30' : 'bg-white/30'} backdrop-blur-xl rounded-[32px] p-4 border ${theme.border}`}>
            <div className="flex justify-between items-center mb-4 px-1">
              <span className={`text-[9px] font-black ${theme.accent} uppercase tracking-[0.2em] flex items-center gap-2`}>
                <span className="w-1 h-3 bg-current rounded-full animate-pulse" />
                Live_Insight
              </span>
              
              <button 
                onClick={() => openAIModal(item)} 
                className={`relative group flex items-center gap-2 px-4 py-1.5 rounded-full overflow-hidden transition-transform active:scale-95 shadow-lg ${
                  theme.isMalam ? 'bg-cyan-600' : 'bg-[#E3655B]'
                }`}
              >
                <div className={`absolute inset-0 bg-gradient-to-r ${
                  theme.isMalam ? 'from-cyan-600 to-indigo-600' : 'from-[#E3655B] to-rose-600'
                }`} />
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
            <LiveInsight signals={feed.allSignals || []} theme={theme} />
          </div>
        </div>

        {/* --- 5. PHOTO CONTEXT --- */}
        <div className="relative px-5 mb-6">
          <div className="absolute -right-1 top-0 z-10">
            <FeedActions 
              item={item} 
              comments={comments} 
              openKomentarModal={openKomentarModal} 
              onShare={onShare} 
              variant="floating-sidebar" 
              theme={theme}
            />
          </div>
          <div className={`relative aspect-video rounded-[30px] overflow-hidden border ${theme.border} shadow-2xl`}>
            <PhotoSlider 
              photos={photoUrls} 
              selectedPhotoIndex={selectedPhotoIndex?.[item.id] || 0} 
              setSelectedPhotoIndex={setSelectedPhotoIndex} 
            />
            <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
              <p className="text-[9px] font-bold text-white/40 italic tracking-widest uppercase">Visual_Context_Archive</p>
            </div>
          </div>
        </div>

        {/* --- 6. FOOTER - URUTAN YANG LEBIH BAIK --- */}
        <div className="px-6 pb-8 space-y-5 mt-auto">
          {/* INFO TEMPAT DULU */}
          <div className={`flex flex-col gap-1 border-b ${theme.border} pb-4`}>
            <div className="flex justify-between items-end">
              <h3 className={`text-base font-black ${theme.text} tracking-tighter uppercase truncate max-w-[80%]`}>{item.name}</h3>
              <span className="text-[8px] font-mono opacity-20 mb-1">ID_{String(item.id).slice(-4)}</span>
            </div>
            <p className={`text-[10px] font-bold ${theme.textMuted} uppercase tracking-widest opacity-60 truncate`}>📍 {item.alamat || "AREA_SETEMPAT"}</p>
          </div>

          {/* TOMBOL VIBE - Versi Warna Elegan */}
          <button 
            onClick={handleSesuai}
            disabled={isSesuai}
            className={`group relative w-full flex items-center justify-between px-6 py-4 rounded-[24px] border transition-all duration-500 active:scale-[0.96] overflow-hidden
              ${isSesuai 
                ? "bg-[#1e3a3a] border-[#2d5a5a] text-emerald-400 shadow-lg" // Hijau Deep Forest yang kalem
                : theme.isMalam 
                  ? "bg-white/[0.03] border-white/10 text-white hover:bg-white/[0.08]" 
                  : "bg-black/[0.02] border-black/5 text-slate-900 hover:bg-black/[0.05]"
              }`}
          >
            <div className="flex items-center gap-4 relative z-10">
              {/* Lingkaran Ikon yang lebih soft */}
              <div className={`flex items-center justify-center w-10 h-10 rounded-full transition-all duration-500 
                ${isSesuai ? 'bg-emerald-500/20 text-emerald-400' : 'bg-current/10'}`}>
                <span className="text-xl">{isSesuai ? '✅' : '👌'}</span>
              </div>

              <div className="flex flex-col items-start leading-tight">
                <span className={`text-[13px] font-black uppercase tracking-widest ${isSesuai ? 'text-emerald-400' : ''}`}>
                  {isSesuai ? "TERVALIDASI" : "VIBE SESUAI"}
                </span>
                <span className={`text-[10px] font-medium ${isSesuai ? 'text-emerald-400/60' : 'opacity-60'}`}>
                  {totalSaksi.toLocaleString()} Warga Sepakat
                </span>
              </div>
            </div>

            {/* AVATAR STACK - Vector Edition */}
            <div className="flex items-center relative z-10">
              <div className="flex -space-x-3 transition-all duration-500 group-hover:-space-x-2">
                {['felix', 'leila', 'max'].map((name, i) => (
                  <div 
                    key={i}
                    className={`w-7 h-7 rounded-full border-2 shadow-sm ${
                      isSesuai 
                        ? theme.isMalam ? 'border-[#2d5a5a]' : 'border-emerald-100' 
                        : theme.isMalam ? 'border-slate-800' : 'border-white'
                    } bg-slate-100 overflow-hidden transition-all duration-500 group-hover:rotate-6 group-hover:scale-110`}
                    style={{ zIndex: 3 - i }}
                  >
                    <img 
                      src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${name}&backgroundColor=b6e3f4,c0aede,d1d4f9`} 
                      alt="vibe-avatar"
                      className={`w-full h-full object-cover transition-all duration-700 ${
                        isSesuai ? 'grayscale-0 scale-110' : 'grayscale-[80%] opacity-70'
                      }`}
                    />
                  </div>
                ))}
                
                {/* Indikator "+1" yang muncul saat klik */}
                {isSesuai && (
                  <div className="w-7 h-7 rounded-full border-2 border-emerald-400 bg-emerald-500 flex items-center justify-center animate-[bounce_0.4s_ease-in-out] z-10 shadow-lg">
                    <span className="text-[8px] font-black text-white">+1</span>
                  </div>
                )}
              </div>
            </div>
          </button>
        </div>
      </div>
    </motion.div>
  );
}