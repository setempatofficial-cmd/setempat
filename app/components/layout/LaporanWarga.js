"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useLocation } from "@/app/components/LocationProvider";
import { useTheme } from "@/hooks/useTheme";
import { useWeather } from "@/hooks/useWeather";

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

  // --- LOGIKA DATA ---
  const validatedLocation = useMemo(() => {
    if (locationReady && location) {
      if (typeof location === 'object' && location !== null) {
        if (location.nama) return location.nama;
        if (location.address) return location.address;
        if (location.kecamatan) return location.kecamatan;
        if (location.kota) return location.kota;
        if (location.daerah) return location.daerah;
        if (location.latitude && location.longitude) return displayLocation || "Lokasi Anda";
        return displayLocation || "Lokasi Tidak Dikenali";
      }
      return location;
    }
    return displayLocation || "Mencari Lokasi...";
  }, [locationReady, location, displayLocation]);

  const { weather } = useWeather(validatedLocation);

  const formatTime = () => {
    const now = new Date();
    return now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  const getRandomUpdateText = () => {
    const updates = ["Warga lapor", "Pantauan terkini", "Info suasana", "Update terkini", "Baru saja", "Situasi saat ini"];
    return updates[Math.floor(Math.random() * updates.length)];
  };

  const stats = useMemo(() => {
    if (!tempat?.length) return { titikRamai: 0, titikDekat: 0, viralCount: 0, topPlace: null };
    const titikRamai = tempat.filter((t) => parseInt(t.estimasi_orang) > 20).length;
    const titikDekat = tempat.filter((t) => t.distance && t.distance < 1.5).length;
    const viralCount = tempat.filter((t) => t.is_viral || parseInt(t.estimasi_orang) > 50).length;
    const topPlace = [...tempat].sort((a, b) => (parseInt(b.estimasi_orang) || 0) - (parseInt(a.estimasi_orang) || 0))[0];
    return { titikRamai, titikDekat, viralCount, topPlace };
  }, [tempat]);

  // 🔥 FUNGSI UNTUK INFO ARUS LALU LINTAS
  const getTrafficInfo = useMemo(() => {
    const n = stats.titikRamai;
    
    // Logika arus lalu lintas berdasarkan keramaian
    if (stats.viralCount > 0 || n > 20) {
      return {
        icon: "🚦",
        text: "LALIN PADAT",
        color: "text-rose-500",
        bg: theme.isMalam ? "bg-rose-500/20" : "bg-rose-100",
        description: "Antrean panjang, cari jalur alternatif"
      };
    } else if (n > 10) {
      return {
        icon: "🚗",
        text: "LALIN RAMAI",
        color: "text-amber-500",
        bg: theme.isMalam ? "bg-amber-500/20" : "bg-amber-100",
        description: "Volume kendaraan tinggi"
      };
    } else if (n > 5) {
      return {
        icon: "🛵",
        text: "LALIN LANCAR",
        color: "text-emerald-500",
        bg: theme.isMalam ? "bg-emerald-500/20" : "bg-emerald-100",
        description: "Kondisi normal, tidak ada hambatan"
      };
    } else {
      return {
        icon: "🌿",
        text: "LALIN LANCAR",
        color: "text-emerald-500",
        bg: theme.isMalam ? "bg-emerald-500/20" : "bg-emerald-100",
        description: "Jalanan lengang, nyaman"
      };
    }
  }, [stats.titikRamai, stats.viralCount, theme.isMalam]);

  // --- LOGIKA STATUS DISPLAY (PRIORITAS & ANTI ANGKA 0) ---
  const getStatDisplay = useMemo(() => {
    // 1. Prioritas Utama: VIRAL (Ada Angka)
    if (stats.viralCount > 0) {
      return { 
        icon: "🔴", 
        text: `${stats.viralCount} VIRAL`, 
        color: "text-rose-500",
        glow: "shadow-[0_0_12px_rgba(244,63,94,0.4)]" 
      };
    }
    
    // 2. Prioritas Kedua: RAMAI (Ada Angka)
    if (stats.titikRamai > 0) {
      return { 
        icon: "👥", 
        text: `${stats.titikRamai} RAMAI`, 
        color: "text-amber-500",
        glow: ""
      };
    }
    
    // 3. Fallback: Kondisi Sepi/Nol (TEKSTUAL TANPA ANGKA)
    const statusOptions = [
      { icon: "🍃", text: "SEPI", color: "text-emerald-500" },
      { icon: "🌙", text: "TENANG", color: "text-emerald-500" },
      { icon: "😴", text: "LENGANG", color: "text-emerald-500" },
      { icon: "💤", text: "HENING", color: "text-emerald-500" },
      { icon: "✨", text: "NORMAL", color: "text-emerald-500" }
    ];

    // Jika Malam, gunakan aksen cyan agar masuk ke tema
    if (theme.isMalam) {
      return { icon: "🌙", text: "TENANG", color: "text-cyan-400", glow: "" };
    }

    // Ambil random dari list status sepi
    return statusOptions[Math.floor(Math.random() * statusOptions.length)];
  }, [stats.viralCount, stats.titikRamai, theme.isMalam]);

  const dynamicMessage = useMemo(() => {
    if (!stats.topPlace) return { pre: "Pantau ", post: " yuk!", short: "Cek Lokasi", color: "text-slate-400" };
    const n = parseInt(stats.topPlace.estimasi_orang) || 0;
    if (n > 50) return { pre: "Gokil! ", post: " lagi pecah banget!", short: "Rame parah!", color: "text-red-500" };
    if (n > 15) return { pre: "Lagi asyik di ", post: ". Meriah banget!", short: "Meriah", color: "text-orange-500" };
    return { pre: "Cek ", post: " yuk, lagi kalem.", short: "Kalem", color: "text-emerald-500" };
  }, [stats.topPlace]);

  const handleToggle = () => setIsExpanded(!isExpanded);

  useEffect(() => {
    if (fullContentRef.current) setContentHeight(fullContentRef.current.offsetHeight);
  }, [stats, validatedLocation, sapaan]);

  if (!locationReady || !isVisible) return null;

  return (
    <div className={`sticky top-[72px] z-[999] w-full transition-all duration-500 px-3 md:px-6 py-2
        ${isClosing ? "opacity-0 scale-95 -translate-y-5" : "opacity-100"}`}>
      
      <div className={`relative w-full rounded-3xl overflow-hidden transition-all duration-500 shadow-xl border shadow-black/5
        ${compact ? "backdrop-blur-xl" : ""} 
        ${theme.card} ${theme.border}`}>
        
        <div className="relative" style={{ height: compact ? 56 : contentHeight || 'auto', transition: 'height 500ms cubic-bezier(0.4, 0, 0.2, 1)' }}>
          
          {/* --- TAMPILAN FULL --- */}
          <div ref={fullContentRef} className={`absolute inset-x-0 top-0 p-4 transition-all duration-500 
              ${compact ? 'opacity-0 -translate-y-4 pointer-events-none' : 'opacity-100 translate-y-0'}`}>
            
            <div className="flex justify-between items-start mb-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`flex h-2 w-2 rounded-full animate-pulse ${theme.dot} ${theme.dotGlow}`} />
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${theme.textMuted}`}>
                    {sapaan} • {formatTime()}
                  </p>
                </div>
                <h2 className={`text-2xl font-black tracking-tight truncate ${theme.text}`}>
                  {validatedLocation}
                </h2>
              </div>

              {weather && (
                <div className="flex flex-col items-end shrink-0">
                   <div className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl border ${theme.softBg} ${theme.softBorder}`}>
                      <span className="text-lg">{weather.icon}</span>
                      <span className={`font-black text-sm ${theme.text}`}>{weather.temp}°</span>
                   </div>
                   <p className={`text-[9px] font-bold mt-1 uppercase italic ${theme.textMuted}`}>BMKG Terkini</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mb-4">
              <div className={`flex-[1.2] ${theme.softBg} ${theme.softBorder} border p-3 rounded-2xl`}>
                <p className={`text-[9px] font-black uppercase mb-1 ${theme.textMuted}`}>STATUS WILAYAH</p>
                <div className={`flex items-center gap-2 font-black ${getStatDisplay.color}`}>
                  <span className="text-lg">{getStatDisplay.icon}</span>
                  <span className="text-sm">{getStatDisplay.text}</span>
                </div>
              </div>
              <div className={`flex-1 border p-3 rounded-2xl ${theme.softBg} ${theme.softBorder}`}>
                <p className={`text-[9px] font-black uppercase mb-1 ${theme.textMuted}`}>Aktivitas</p>
                <p className={`text-sm font-black ${theme.text}`}>
                  {stats.titikRamai} <span className={`text-[10px] font-bold ml-0.5 ${theme.textMuted}`}>LOKASI</span>
                </p>
              </div>
            </div>

            {/* 🔥 INFO ARUS LALU LINTAS */}
            <div className={`mb-4 p-3 rounded-2xl border ${getTrafficInfo.bg} ${theme.border} flex items-center gap-3`}>
              <span className={`text-xl ${getTrafficInfo.color}`}>{getTrafficInfo.icon}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className={`text-[13px] font-black uppercase ${getTrafficInfo.color}`}>
                    {getTrafficInfo.text}
                  </span>
                  <span className={`text-[9px] font-bold ${theme.textMuted}`}>UPDATE LANGSUNG</span>
                </div>
                <p className={`text-[10px] font-medium ${theme.textMuted} mt-0.5`}>
                  {getTrafficInfo.description}
                </p>
              </div>
            </div>

            {stats.topPlace && (
              <button 
                onClick={() => window.location.href = `/?id=${stats.topPlace.id}`}
                className={`group relative w-full overflow-hidden p-4 rounded-2xl transition-all active:scale-[0.97] shadow-lg
                  ${theme.isMalam ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'}`}
              >
                <div className="relative z-10 flex justify-between items-center">
                  <p className="text-xs font-bold truncate pr-4 text-left">
                    <span className="opacity-60 uppercase text-[10px] block mb-0.5">Rekomendasi Pantauan</span>
                    {stats.topPlace.name} 
                    <span className={`ml-2 italic ${theme.isMalam ? 'text-cyan-600' : 'text-cyan-400'}`}>— {dynamicMessage.short}</span>
                  </p>
                  <span className={`p-2 rounded-xl ${theme.isMalam ? 'bg-slate-900/10' : 'bg-white/20'}`}>→</span>
                </div>
              </button>
            )}
          </div>

          {/* --- TAMPILAN COMPACT --- */}
          <div className={`absolute inset-x-0 bottom-0 h-[56px] px-4 flex items-center justify-between transition-all duration-500
              ${compact ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
            
            <div className="flex items-center gap-3 flex-1 min-w-0" onClick={handleToggle}>
              <div className={`w-10 h-10 flex items-center justify-center rounded-2xl text-xl shrink-0 ${theme.softBg} ${theme.softBorder} ${getStatDisplay.glow}`}>
                {getStatDisplay.icon}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                   {/* Status Dinamis (Tanpa Angka 0) */}
                   <span className={`text-[11px] font-black uppercase ${getStatDisplay.color}`}>
                    {getStatDisplay.text}
                   </span>
                   <span className={`w-1 h-1 rounded-full ${theme.isMalam ? 'bg-slate-700' : 'bg-slate-300'}`} />
                   {/* Info Vibe (Pagi/Malam dll) */}
                   <span className={`text-[11px] font-black uppercase ${theme.textMuted}`}>
                    {theme.vibeInfo.label}
                   </span>
                   <span className={`w-1 h-1 rounded-full ${theme.isMalam ? 'bg-slate-700' : 'bg-slate-300'}`} />
                   {/* 🔥 INFO LALIN DI COMPACT */}
                   <span className={`text-[11px] font-black uppercase ${getTrafficInfo.color}`}>
                    {getTrafficInfo.icon} {getTrafficInfo.text}
                   </span>
                </div>
                <p className={`text-[10px] font-bold truncate tracking-tight italic ${theme.textMuted}`}>
                  {getRandomUpdateText()} @ {validatedLocation}
                </p>
              </div>
            </div>

            <button onClick={handleToggle} 
              className={`ml-2 w-8 h-8 flex items-center justify-center rounded-xl transition-transform duration-300
              ${theme.isMalam ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'}`}>
              <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* --- DROPDOWN DETAIL --- */}
        <div className={`overflow-hidden transition-all duration-500 ease-in-out
            ${isExpanded && compact ? `max-h-[400px] opacity-100 border-t ${theme.border} ${theme.isMalam ? 'bg-white/5' : 'bg-slate-50'}` : 'max-h-0 opacity-0'}`}>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className={`${theme.card} p-3 rounded-2xl border ${theme.border} shadow-sm`}>
                <p className={`text-xl font-black leading-none ${theme.text}`}>{stats.titikDekat}</p>
                <p className={`text-[10px] font-bold uppercase mt-1 ${theme.textMuted}`}>Titik Terdekat</p>
              </div>
              <div className={`${theme.card} p-3 rounded-2xl border ${theme.border} shadow-sm`}>
                <p className="text-xl font-black text-rose-500 leading-none">{stats.viralCount}</p>
                <p className={`text-[10px] font-bold uppercase mt-1 ${theme.textMuted}`}>Lagi Viral</p>
              </div>
            </div>
            
            {/* 🔥 INFO LALIN DI DROPDOWN */}
            <div className={`${theme.card} p-3 rounded-2xl border ${theme.border} flex items-center gap-3`}>
              <span className={`text-2xl ${getTrafficInfo.color}`}>{getTrafficInfo.icon}</span>
              <div>
                <span className={`text-[13px] font-black uppercase ${getTrafficInfo.color}`}>{getTrafficInfo.text}</span>
                <p className={`text-[9px] ${theme.textMuted}`}>{getTrafficInfo.description}</p>
              </div>
            </div>
            
            {stats.topPlace && (
              <div className={`${theme.card} p-4 rounded-2xl border ${theme.border}`}>
                  <h4 className={`text-sm font-black mb-1 italic ${theme.text}`}>
                    {dynamicMessage.pre}<span className={getStatDisplay.color}>"{stats.topPlace.name}"</span>{dynamicMessage.post}
                  </h4>
                  <button 
                     onClick={() => window.location.href = `/?id=${stats.topPlace.id}`}
                     className={`w-full mt-3 py-3 rounded-xl text-[11px] font-black uppercase transition-all shadow-md
                     ${theme.isMalam ? 'bg-cyan-500 text-[#0f172a]' : 'bg-[#E3655B] text-white'}`}
                  >
                    ⚡ Pantau Sekarang
                  </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}