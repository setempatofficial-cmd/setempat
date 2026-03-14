"use client";

import { useState, useMemo, useEffect } from "react";
import PhotoSlider from "./PhotoSlider";
import { processFeedItem } from "../../../lib/feedEngine";
import LiveInsight from "./LiveInsight";
import FeedInsight from "./FeedInsight";
import { useClock } from "../../../hooks/useClock";
import { supabase } from "@/lib/supabaseClient";
import FeedActions from "./FeedActions";

export default function FeedCard({
  item,
  locationReady,
  location,
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
  // 🌟 THEME ENGINE: Mengubah Vibe Berdasarkan Waktu
  const timeTheme = useMemo(() => {
    const themes = {
      Pagi: {
        name: "PAGI",
        bgCard: "bg-white",
        bgHeader: "bg-amber-50/50",
        border: "border-amber-100",
        accent: "text-orange-600",
        accentBg: "bg-orange-500",
        accentSoft: "bg-orange-50 border-orange-100",
        text: "text-slate-900",
        textMuted: "text-slate-500",
        textWhite: "text-slate-900", 
        dot: "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]",
        liveBadge: "bg-orange-600 text-white",
        statusBg: "bg-orange-50 border-orange-100",
        statusText: "text-orange-700",
        glow: "shadow-[0_15px_40px_rgba(249,115,22,0.1)]",
        overlay: "from-white/90 via-white/20 to-transparent",
      },
      Siang: {
        name: "SIANG",
        bgCard: "bg-white",
        bgHeader: "bg-sky-50/50",
        border: "border-slate-200",
        accent: "text-blue-600",
        accentBg: "bg-blue-600",
        accentSoft: "bg-blue-50 border-blue-100",
        text: "text-slate-900",
        textMuted: "text-slate-500",
        textWhite: "text-slate-900",
        dot: "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]",
        liveBadge: "bg-blue-600 text-white",
        statusBg: "bg-slate-50 border-slate-200",
        statusText: "text-slate-700",
        glow: "shadow-[0_15px_40px_rgba(15,23,42,0.08)]",
        overlay: "from-white/90 via-white/20 to-transparent",
      },
      Sore: {
        name: "SORE",
        bgCard: "bg-white",
        bgHeader: "bg-rose-50/50",
        border: "border-rose-100",
        accent: "text-rose-600",
        accentBg: "bg-rose-600",
        accentSoft: "bg-rose-50 border-rose-100",
        text: "text-slate-900",
        textMuted: "text-rose-900/40",
        textWhite: "text-slate-900",
        dot: "bg-rose-500 shadow-[0_0_8px_rgba(225,29,72,0.5)]",
        liveBadge: "bg-rose-600 text-white",
        statusBg: "bg-rose-50 border-rose-100",
        statusText: "text-rose-700",
        glow: "shadow-[0_15px_40px_rgba(225,29,72,0.12)]",
        overlay: "from-white/90 via-white/20 to-transparent",
      },
      Malam: {
        name: "MALAM",
        bgCard: "bg-[#09090b]",
        bgHeader: "bg-zinc-900/50",
        border: "border-white/5",
        accent: "text-cyan-400",
        accentBg: "bg-cyan-400",
        accentSoft: "bg-cyan-500/10 border-cyan-500/20",
        text: "text-white",
        textMuted: "text-zinc-500",
        textWhite: "text-white",
        dot: "bg-cyan-400 shadow-[0_0_12px_#22d3ee]",
        liveBadge: "bg-emerald-500 text-white",
        statusBg: "bg-blue-500/10 border-blue-500/20",
        statusText: "text-blue-400",
        glow: "shadow-[0_20px_50px_rgba(0,0,0,0.5)]",
        overlay: "from-black/90 via-black/40 to-transparent",
      }
    };
    return themes[clockLabel] || themes.Siang;
  }, [clockLabel]);

  // LOGIKA FEED ENGINE
  const feed = useMemo(() => {
    if (!item) return { allSignals: [], narasiCerita: "", distance: null };
    return processFeedItem({ item, comments, locationReady, location });
  }, [item, comments, locationReady, location?.latitude, location?.longitude]);

  // LOGIKA STATUS FADE
  const statusItems = useMemo(() => [
    item.current_status || "Area Terkendali • Akses Lancar",
    `Sumber: ${item.source_type || 'Warga'} • Verified Setempat`,
    `Update: ${currentTime || "Live"}`
  ], [item, currentTime]);

  const [statusIdx, setStatusIdx] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setStatusIdx(p => (p + 1) % statusItems.length), 4000);
    return () => clearInterval(timer);
  }, [statusItems]);

  // LOGIKA FOTO & FILTER WAKTU
  const filteredPhotoObjects = useMemo(() => {
    const currentTag = clockLabel ? clockLabel.toLowerCase() : "pagi";
    let filtered = (item?.photos || []).filter(p => p.time_tag?.toLowerCase() === currentTag);
    if (filtered.length === 0) filtered = item?.photos || [];
    return filtered;
  }, [item?.photos, clockLabel]);

  const photoUrls = useMemo(() => filteredPhotoObjects.map(p => typeof p === 'string' ? p : p.url), [filteredPhotoObjects]);
  const currentIdx = selectedPhotoIndex?.[item.id] || 0;

  const handleSesuai = async () => {
    if (isSesuai || !item?.id) return;
    setIsSesuai(true);
    setLocalValidationCount(prev => prev + 1);
    localStorage.setItem(`sesuai_${item.id}`, new Date().getTime().toString());
    try {
      await supabase.from("minat").insert([{ tempat_id: item.id, type: 'vibe_sesuai' }]);
    } catch (e) { console.error(e); }
  };

  if (!item) return null;

  return (
    <div className={`relative mx-auto my-6 p-[1px] max-w-[360px] z-0 transition-all duration-700 ${timeTheme.glow}`}>
      
      {/* SIDEBAR KANAN */}
      <div className="absolute -right-10 top-1/2 -translate-y-1/2 z-50 scale-90">
        <FeedActions
          item={item}
          comments={comments}
          openKomentarModal={openKomentarModal}
          onShare={onShare}
          variant="floating-sidebar"
        />
      </div>

      {/* CONTAINER UTAMA */}
      <div className={`relative overflow-hidden rounded-[32px] ${timeTheme.bgCard} border ${timeTheme.border} z-10 transition-colors duration-500`}>

        {/* HEADER */}
        <div className={`flex justify-between items-center px-5 py-3.5 ${timeTheme.bgHeader} border-b ${timeTheme.border}`}>
          <div className={`flex items-center gap-1.5 ${timeTheme.accentSoft} px-2.5 py-1 rounded-full border shadow-sm`}>
            <div className={`w-1.5 h-1.5 rounded-full ${timeTheme.dot}`} />
            <span className={`text-[10px] font-black ${timeTheme.accent} tracking-widest uppercase`}>
              {feed.distance ? `${feed.distance.toFixed(1)} KM dari Anda` : "LIVE"} 
            </span>
          </div>
          <span className={`text-[9px] font-black ${timeTheme.textMuted} uppercase tracking-[0.15em]`}>
            {item.category || "SEKITAR"} • {timeTheme.name}
          </span>
        </div>

        {/* VISUAL SECTION */}
        <div className="relative aspect-[4/3] w-full bg-slate-100 overflow-hidden">
          <PhotoSlider
            photos={photoUrls}
            selectedPhotoIndex={currentIdx}
            setSelectedPhotoIndex={(idx) => setSelectedPhotoIndex?.((prev) => ({ ...prev, [item.id]: idx }))}
          />
          
          {/* Overlay Konten di Foto */}
          <div className="absolute inset-x-0 top-0 pt-6 pb-12 px-5 bg-gradient-to-b from-black/60 via-black/20 to-transparent pointer-events-none z-20">
            {/* Nama Tempat */}
            <p className="text-lg font-black text-white uppercase tracking-tighter italic leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
              {item.name || "NAMA TEMPAT"}
            </p>

            {/* Caption */}
            <p className="text-[11px] font-bold text-white/80 leading-tight mt-1.5 max-w-[85%] line-clamp-1 drop-shadow-sm">
              {currentIdx === 0 
                ? (feed.narasiCerita?.split('.')[1] || `Pantauan ${timeTheme.name.toLowerCase()} ini.`) 
                : (filteredPhotoObjects[currentIdx]?.caption || `Visual lainnya.`)}
            </p>
          </div>

          {/* VIBE BADGE (Center) */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="text-center drop-shadow-[0_0_15px_rgba(0,0,0,0.5)]">
              <p className={`text-[8px] font-black tracking-[0.4em] mb-0.5 ${timeTheme.accent}`}>
                ✨ VIBE
              </p>
              <h3 className="text-3xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg">
                {item.vibe_status || "TENANG"}
              </h3>
            </div>
          </div>

          {/* Feed Actions di Bottom */}
          <div className="absolute bottom-4 left-4 right-4 z-30">
            <FeedActions
              item={item}
              openAIModal={openAIModal}
              handleSesuai={handleSesuai}
              isSesuai={isSesuai}
              jumlahSaksi={item.vibe_count || 0}
              variant="photo-overlay"
            />
          </div>
        </div>

        {/* BOTTOM CONTENT */}
        <div className="p-5 space-y-5">
          <h2 className={`text-xl font-black ${timeTheme.textWhite} leading-[0.95] tracking-tighter uppercase italic line-clamp-2`}>
            {feed.narasiCerita?.split('.')[0] || "SUASANA SEKITAR"}
          </h2>

          <FeedInsight 
            aktivitasUtama={feed.allSignals[0]}
            testimonialTerbaru={feed.testimonialTerbaru}
            suasana={feed.suasana}
            isHujan={feed.isHujan}
            isRamai={feed.isRamai}
            theme={timeTheme}
          />

{/* FADE STATUS SYSTEM - INTERACTIVE EXPAND */}
<div 
  className={`${timeTheme.statusBg} border ${timeTheme.border} rounded-[22px] transition-all duration-500 cursor-pointer shadow-sm relative overflow-hidden ${
    isExpanded ? 'h-auto p-5' : 'h-12 px-4 flex items-center'
  }`}
  onClick={() => setIsExpanded(!isExpanded)}
>
  <div className="w-full">
    {/* HEADER SECTION */}
    <div className={`flex items-center gap-3 ${isExpanded ? 'mb-4 pb-1' : ''}`}>
      <div className="relative flex h-2 w-2">
        <span className={`animate-ping absolute h-full w-full rounded-full ${timeTheme.dot} opacity-40`}></span>
        <span className={`relative rounded-full h-2 w-2 ${timeTheme.dot}`}></span>
      </div>
      
      <div className="flex-1 overflow-hidden" key={statusIdx}>
        <p className={`text-[13px] font-bold ${timeTheme.statusText} tracking-tight truncate`}>
          {statusItems[statusIdx]}
        </p>
      </div>

      <div className={`p-1 rounded-full transition-transform duration-300 ${isExpanded ? 'rotate-180 bg-slate-100' : ''}`}>
        <svg className={`w-3.5 h-3.5 ${timeTheme.statusText} opacity-40`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>

    {/* EXPANDED CONTENT */}
    {isExpanded && (
      <div className="animate-in fade-in slide-in-from-top-2 duration-400">
        {/* Social Proof Section */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex -space-x-2">
            {[1, 2, 3].map(i => (
              <div key={i} className={`w-5 h-5 rounded-full border-2 ${timeTheme.bgCard} bg-slate-200 flex items-center justify-center overflow-hidden`}>
                <div className={`w-full h-full ${timeTheme.accentBg} opacity-20`} />
              </div>
            ))}
          </div>
          <p className={`text-[10px] font-bold ${timeTheme.statusText} opacity-60 italic`}>
            {Math.floor(Math.random() * 10) + 5} warga baru saja melapor di sini
          </p>
        </div>

        {/* AI Summary Text */}
        <p className={`text-[12px] leading-relaxed font-medium ${timeTheme.statusText} mb-5`}>
           Analisis AI: Kondisi di <span className="font-black text-blue-600">@{item.name}</span> saat ini cenderung {statusItems[statusIdx].toLowerCase()}. Sebaiknya tetap pantau live update karena cuaca mulai berubah.
        </p>

        {/* CTA BUTTON - TANYA AI */}
        <button 
          onClick={(e) => {
            e.stopPropagation(); // Biar box-nya nggak nutup pas klik tombol
             openAIModal(item, "antrean"); // Fungsi untuk panggil Chat AI
          }}
          className={`w-full py-3 px-4 rounded-xl flex items-center justify-center gap-3 group relative overflow-hidden transition-all active:scale-95 shadow-md ${timeTheme.accentBg}`}
        >
          {/* Efek Shine pada Tombol */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
          
          <span className="text-white">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L14.5 9H22L16 14L18.5 21L12 17L5.5 21L8 14L2 9H9.5L12 2Z" />
            </svg>
          </span>
          <span className="text-[11px] font-black uppercase tracking-widest text-white">
            Tanya AI Detail
          </span>
        </button>
      </div>
    )}
  </div>
</div>

          {/* LIVE GRAPHIC */}
          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <p className={`text-[9px] font-black uppercase tracking-widest ${timeTheme.textMuted}`}>Data Lokasi</p>
              <span className={`text-[9px] ${timeTheme.accent} animate-pulse font-black italic`}>● LIVE</span>
            </div>
            <div className={`rounded-2xl p-2 border ${timeTheme.bgHeader} ${timeTheme.border}`}>
              <LiveInsight signals={feed.allSignals || []} theme={timeTheme} />          
            </div>
          </div>

          {/* FOOTER */}
          <div className={`pt-4 border-t ${timeTheme.border} flex items-center gap-2`}>
            <span className="grayscale opacity-50 text-sm">📍</span>
            <p className={`text-[10px] font-bold ${timeTheme.textMuted} uppercase tracking-wide line-clamp-1`}>
              {item.alamat || "AREA TERDETEKSI SISTEM"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}