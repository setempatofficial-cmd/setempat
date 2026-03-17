"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useLocation } from "@/app/components/LocationProvider";
import { useTheme } from "@/hooks/useTheme";

export default function LaporanWarga({
  compact = false,
  tempat = [],
  locationReady,
  displayLocation,
  location,
}) {
  const { sapaan } = useLocation();
  const theme = useTheme();
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const fullContentRef = useRef(null);
  const compactContentRef = useRef(null);

  // FORMAT WAKTU
  const formatTime = () => {
    const now = new Date();
    const hh = now.getHours().toString().padStart(2, "0");
    const mm = now.getMinutes().toString().padStart(2, "0");
    return `${hh}:${mm}`;
  };

  // LOGIKA LOKASI TERVALIDASI
  const validatedLocation = useMemo(() => {
    if (locationReady && location) {
      if (typeof location === 'object' && location !== null) {
        if (location.nama) return location.nama;
        if (location.address) return location.address;
        if (location.kecamatan) return location.kecamatan;
        if (location.kota) return location.kota;
        if (location.daerah) return location.daerah;
        
        if (location.latitude && location.longitude) {
          return displayLocation || "Lokasi Anda";
        }
        
        return displayLocation || "Lokasi Tidak Dikenali";
      }
      
      return location;
    }
    
    if (displayLocation) {
      return displayLocation;
    }
    
    return "Lokasi Tidak Diketahui";
  }, [locationReady, location, displayLocation]);

  // STATISTIK SUASANA
  const stats = useMemo(() => {
    if (!tempat?.length)
      return { titikRamai: 0, titikDekat: 0, viralCount: 0, topPlace: null };
    const titikRamai = tempat.filter((t) => parseInt(t.estimasi_orang) > 20).length;
    const titikDekat = tempat.filter((t) => t.distance && t.distance < 1.5).length;
    const viralCount = tempat.filter((t) => t.is_viral || parseInt(t.estimasi_orang) > 50).length;
    const topPlace = [...tempat].sort(
      (a, b) => (parseInt(b.estimasi_orang) || 0) - (parseInt(a.estimasi_orang) || 0)
    )[0];
    return { titikRamai, titikDekat, viralCount, topPlace };
  }, [tempat]);

  // PESAN DINAMIS
  const dynamicMessage = useMemo(() => {
    if (!stats.topPlace) return { pre: "", post: "", short: "", color: "text-slate-400" };
    const place = stats.topPlace;
    const n = parseInt(place.estimasi_orang) || 0;
    const variasi = {
      high: [
        { pre: "Gokil! ", post: " lagi pecah banget!", short: "Lagi pecah!", color: "text-red-400" },
        { pre: "Wah, ", post: " lagi rame parah!", short: "Rame parah!", color: "text-red-400" }
      ],
      medium: [
        { pre: "Lagi asyik di ", post: ". Meriah banget!", short: "Lagi asyik", color: "text-orange-400" }
      ],
      low: [
        { pre: "Cek ", post: " deh, lagi kalem nih.", short: "Lagi kalem", color: "text-green-400" }
      ]
    };
    let kategori = n > 50 ? "high" : n > 15 ? "medium" : "low";
    const list = variasi[kategori];
    const index = place.name.length % list.length;
    return { ...list[index], name: place.name };
  }, [stats.topPlace]);

  // INFO VIBE
  const vibeInfo = useMemo(() => {
    const n = stats.titikRamai;
    if (n > 15) {
      const situasi = theme.getSituasi('viral');
      return { 
        icon: "📣", 
        text: "Viral & Padat", 
        impact: "Akses Tersendat", 
        desc: "LALU LINTAS PADAT", 
        color: situasi.text, 
        bg: situasi.bg, 
        border: situasi.border, 
        label: "HIGH ACTIVITY" 
      };
    }
    if (n > 8) {
      const situasi = theme.getSituasi('ramai');
      return { 
        icon: "🙌", 
        text: "Ramai Lancar", 
        impact: "Akses Nyaman", 
        desc: "NORMAL", 
        color: situasi.text, 
        bg: situasi.bg, 
        border: situasi.border, 
        label: "TRENDING" 
      };
    }
    const situasi = theme.getSituasi('sepi');
    return { 
      icon: "🍃", 
      text: "Suasana Santai", 
      impact: "Akses Lancar", 
      desc: "LANCAR JAYA", 
      color: situasi.text, 
      bg: situasi.bg, 
      border: situasi.border, 
      label: "CALM VIBE" 
    };
  }, [stats.titikRamai, theme]);

  // Fungsi untuk menutup komponen
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => setIsVisible(false), 500);
  };

  useEffect(() => {
    if (fullContentRef.current) {
      setContentHeight(fullContentRef.current.offsetHeight);
    }
  }, [stats, validatedLocation, sapaan, tempat]);

  if (!locationReady || !isVisible) return null;

  return (
    <div 
      className={`sticky top-[72px] z-[999] w-full transition-all duration-500 ease-in-out will-change-transform 
        ${isClosing ? "opacity-0 scale-95 translate-y-[-20px]" : "opacity-100"}`}
    >
      {/* 🔥 YANG DIUBAH: Conditional background - glass saat compact, solid saat full */}
      <div className={`relative w-full transition-all duration-500 
        ${compact ? theme.bgGlass : theme.bg}
        ${compact ? "border-none shadow-md shadow-black/5" : "border-b " + theme.border}`}
      >
        
        {/* Container Utama */}
        <div 
          className="relative overflow-hidden"
          style={{ 
            height: compact ? 48 : contentHeight || 'auto',
            transition: 'height 500ms cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          {/* TAMPILAN FULL */}
          <div 
            ref={fullContentRef}
            className={`absolute inset-x-0 top-0 transition-all duration-500 ease-out will-change-transform
              ${compact ? 'opacity-0 translate-y-[-8px] pointer-events-none' : 'opacity-100 translate-y-0'}`}
          >
            <div className="px-4 py-3">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="relative flex h-2 w-2">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${theme.dot}`}></span>
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${theme.dot} ${theme.dotGlow}`}></span>
                    </div>
                    <p className={`text-[10px] font-black uppercase tracking-[0.2em] leading-none ${theme.timeText}`}>
                      {sapaan} Ini di Sekitar
                    </p>
                  </div>
                  <h2 className={`text-xl font-black leading-none tracking-tighter italic ${theme.text}`}>{validatedLocation}</h2>
                </div>
                <div className={`${theme.isMalam ? "bg-white/10" : "bg-black/5"} px-2 py-1 rounded text-[10px] font-mono font-bold ${theme.text}`}>
                  {formatTime()}
                </div>
              </div>

              <div className="flex gap-2 mb-3">
                <div className={`flex-[1.3] ${vibeInfo.bg} ${vibeInfo.border} px-3 py-2.5 rounded-2xl border`}>
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{vibeInfo.label}</p>
                  <p className={`text-[15px] font-black ${vibeInfo.color} leading-none flex items-center gap-2 mb-1`}>
                    {vibeInfo.icon} {vibeInfo.text}
                  </p>
                  <p className="text-[9px] font-bold text-slate-500 leading-none uppercase italic">{vibeInfo.desc}</p>
                </div>
                {stats.titikRamai > 0 && (
                  <div className={`flex-1 ${theme.isMalam ? "bg-white/5" : "bg-white/50"} backdrop-blur-sm px-3 py-2.5 rounded-2xl border ${theme.border} shadow-sm`}>
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">TITIK AKTIF</p>
                    <p className={`text-[15px] font-black leading-none ${theme.text}`}>
                      {stats.titikRamai} <span className="text-[9px] opacity-50 font-bold ml-0.5">LOKASI</span>
                    </p>
                  </div>
                )}
              </div>

              {stats.topPlace && (
                <button 
                  onClick={() => window.location.href = `/?id=${stats.topPlace.id}`} 
                  className={`w-full active:scale-[0.98] transition-transform ${theme.isMalam ? "bg-slate-800" : "bg-slate-900"} rounded-xl p-2.5 flex items-center justify-between shadow-lg`}
                >
                  <p className="text-[11px] font-bold text-white truncate px-1 min-w-0">
                    <span className="text-orange-400 font-black uppercase tracking-tighter">Saat Ini:</span> {stats.topPlace.name} 
                    <span className={`font-black italic ml-1 ${dynamicMessage.color}`}>— {dynamicMessage.short}</span>
                  </p>
                  <span className="text-[10px] font-black text-white/30 uppercase ml-2 whitespace-nowrap">Cek →</span>
                </button>
              )}
            </div>
          </div>

          {/* TAMPILAN COMPACT */}
          <div 
            ref={compactContentRef}
            className={`absolute inset-x-0 bottom-0 transition-all duration-500 ease-out will-change-transform
              ${compact ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-[8px] pointer-events-none'}`}
          >
            <div className="h-[48px] px-4 flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="relative">
                  <span className="text-base">{vibeInfo.icon}</span>
                  {stats.viralCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-2 w-2 rounded-full bg-red-500 border border-white"></span>
                  )}
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5 text-[11px] font-black uppercase leading-none">
                    <span className={vibeInfo.color}>{vibeInfo.text}</span>
                    <span className="text-slate-300">•</span>
                    <span className={theme.text}>{stats.titikRamai} TITIK</span>
                    <span className="text-slate-300">•</span>
                    <span className={vibeInfo.color}>{vibeInfo.impact}</span>
                  </div>
                  <p className="text-[9px] font-bold truncate text-slate-400">Update Warga {validatedLocation}</p>
                </div>
              </div>

              {/* Tombol Expand/Close */}
              <button 
                onClick={() => isExpanded ? handleClose() : setIsExpanded(true)} 
                className={`w-8 h-8 flex items-center justify-center rounded-full transition-all duration-300 ${
                  isExpanded 
                    ? "bg-red-500 text-white shadow-lg rotate-0" 
                    : theme.isMalam ? "bg-white/10 text-slate-400" : "bg-black/10 text-slate-500"
                }`}
              >
                {isExpanded ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg className="transition-transform duration-300" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* DROPDOWN DETAIL (COMPACT) */}
        <div 
          className={`overflow-hidden transition-all duration-500 ease-out will-change-transform
            ${isExpanded && compact ? `max-h-[400px] opacity-100 border-t ${theme.border}` : 'max-h-0 opacity-0'}`}
        >
          <div className={`p-4 ${theme.isMalam ? 'bg-white/5' : 'bg-black/5'}`}>
            <div className="flex gap-2 mb-4">
              <div className={`flex-1 ${theme.card} p-3 rounded-2xl border ${theme.border} shadow-sm text-center`}>
                <p className={`text-sm font-black ${theme.text} leading-none`}>{stats.titikDekat}</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Terdekat</p>
              </div>
              <div className={`flex-1 ${theme.card} p-3 rounded-2xl border ${theme.border} shadow-sm text-center`}>
                <p className={`text-sm font-black ${theme.text} leading-none`}>{stats.viralCount}</p>
                <p className="text-[8px] font-bold text-rose-500 uppercase mt-1">Viral</p>
              </div>
            </div>

            {stats.topPlace && (
              <div className={`${theme.card} rounded-2xl p-4 border ${theme.border} shadow-sm border-b-4 border-b-slate-900`}>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${theme.dot} animate-pulse`}></span>
                  <span className={`${theme.textMuted} text-[9px] font-black uppercase tracking-[0.2em]`}>Update Suasana</span>
                </div>
                <h4 className={`${theme.text} font-black text-[15px] leading-tight mb-3 italic`}>
                  {dynamicMessage.pre}<span className="text-red-600 not-italic">"{dynamicMessage.name}"</span>{dynamicMessage.post}
                </h4>
                <button 
                  onClick={() => window.location.href = `/?id=${stats.topPlace.id}`} 
                  className={`w-full py-3 ${theme.isMalam ? 'bg-slate-800' : 'bg-slate-900'} text-white rounded-xl text-[10px] font-black uppercase active:scale-95 transition-transform`}
                >
                  ⚡ Cek Suasana Sekarang
                </button>
              </div>
            )}
            
            <p className="text-[8px] text-center text-slate-400 mt-3 font-bold uppercase tracking-wider">
              Klik icon merah di atas untuk tutup laporan
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}