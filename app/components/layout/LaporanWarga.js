"use client";

import { useMemo, useState, useEffect } from "react";
import { getGreeting } from "@/lib/greeting";

export default function LaporanWarga({
  compact = false,
  tempat = [],
  locationReady,
  displayLocation,
  location,
  onSearchAction,
}) {
  const [time, setTime] = useState(new Date());
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = () => {
    const hh = time.getHours().toString().padStart(2, "0");
    const mm = time.getMinutes().toString().padStart(2, "0");
    return `${hh}:${mm}`;
  };

  const validatedLocation = useMemo(() => {
    if (!locationReady || !tempat.length || !location)
      return displayLocation || "Pasuruan";
    const nearestPlace = tempat[0];
    const parts = (nearestPlace.alamat || "").split(",").map((p) => p.trim());
    const district = parts.find(
      (p) => p.includes("Kec.") || p.includes("Kecamatan")
    );
    return district
      ? district.replace(/Kec\.|Kecamatan/g, "").trim()
      : parts[1] || parts[0] || displayLocation;
  }, [locationReady, tempat, location, displayLocation]);

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

  const dynamicMessage = useMemo(() => {
    if (!stats.topPlace) return { pre: "", post: "", short: "", status: "", statusColor: "" };
    
    const place = stats.topPlace;
    const n = parseInt(place.estimasi_orang) || 0;
    
    const variasi = {
      high: [
        { pre: "Gokil! ", post: " lagi pecah banget, warga tumplek blek!", short: "Lagi pecah!" },
        { pre: "Wah, ", post: " lagi jadi pusat perhatian. Rame parah!", short: "Rame parah!" },
        { pre: "Lagi viral! ", post: " penuh warga, suasananya seru abis.", short: "Lagi viral!" }
      ],
      medium: [
        { pre: "Lagi banyak warga kumpul di ", post: ". Suasananya asyik buat gabung!", short: "Lagi asyik" },
        { pre: "", post: " terpantau meriah. Cocok buat cari suasana baru.", short: "Lagi meriah" },
        { pre: "Geser ke ", post: " yuk, lagi banyak warga nongkrong.", short: "Rame seru" }
      ],
      low: [
        { pre: "Lagi pada nyantai di ", post: ". Kondisinya tenang dan lega.", short: "Lagi tenang" },
        { pre: "", post: " suasananya lagi kalem, pas buat healing.", short: "Lagi kalem" },
        { pre: "Cek ", post: " deh, areanya masih longgar dan nyaman.", short: "Suasana Lagi longgar" }
      ]
    };

    let kategori = n > 50 ? "high" : n > 15 ? "medium" : "low";
    const list = variasi[kategori];
    const charSum = place.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const index = charSum % list.length;
    
    return { ...list[index], name: place.name };
  }, [stats.topPlace]);

  const vibeInfo = useMemo(() => {
    const n = stats.titikRamai;
    if (n > 15) return { icon: "📣", text: "Viral & Padat", impact: "Akses Tersendat", desc: "Lalu Lintas Padat, Area Terbatas", color: "text-red-600", bg: "bg-red-50", border: "border-red-100", label: "HIGH ACTIVITY" };
    if (n > 8) return { icon: "🙌", text: "Ramai Lancar", impact: "Akses Nyaman", desc: "Lalu Lintas Normal, Ramai Lalu Lalang", color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-100", label: "TRENDING" };
    return { icon: "🍃", text: "Suasana Santai", impact: "Akses Lancar", desc: "Lalu Lintas Lancar, Area Longgar", color: "text-green-600", bg: "bg-green-50", border: "border-green-100", label: "CALM VIBE" };
  }, [stats.titikRamai]);

  const timeTheme = useMemo(() => {
    const sapaan = getGreeting().text;
    const themes = {
      Pagi: { bg: "bg-amber-50", border: "border-amber-100", text: "text-amber-900", sub: "text-amber-500", dot: "bg-amber-400" },
      Siang: { bg: "bg-blue-50", border: "border-blue-100", text: "text-blue-900", sub: "text-blue-400", dot: "bg-blue-500" },
      Sore: { bg: "bg-orange-50", border: "border-orange-100", text: "text-orange-900", sub: "text-orange-500", dot: "bg-orange-500" },
      Malam: { bg: "bg-slate-900", border: "border-slate-800", text: "text-white", sub: "text-slate-400", dot: "bg-indigo-400" }
    };
    return themes[sapaan] || { bg: "bg-white", border: "border-slate-100", text: "text-slate-900", sub: "text-slate-400", dot: "bg-red-500" };
  }, [time]);

  if (!locationReady) return null;

  return (
    /* PERBAIKAN: Wrapper Anchor untuk mencegah layout jumping */
    <div className={`w-full transition-all duration-500 ${compact ? "h-[48px]" : "h-[175px]"}`}>
      <div className={`relative w-full border-b transition-all duration-500 ${timeTheme.bg} ${timeTheme.border} ${compact ? "fixed top-0 z-[999] shadow-md max-w-md mx-auto" : ""}`}>
        <div className={`relative transition-all duration-300 ${compact ? "h-[48px]" : "h-[175px]"}`}>
          
          {/* --- TAMPILAN FULL --- */}
          <div className={`absolute inset-0 px-4 py-3 transition-all duration-300 ${compact ? "opacity-0 -translate-y-2 pointer-events-none" : "opacity-100 translate-y-0"}`}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="relative flex h-2 w-2">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${timeTheme.dot}`}></span>
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${timeTheme.dot}`}></span>
                  </div>
                  <p className={`text-[10px] font-black uppercase tracking-[0.2em] leading-none ${timeTheme.sub}`}>{getGreeting().text} Ini di Sekitar</p>
                </div>
                <h2 className={`text-xl font-black leading-none tracking-tighter italic ${timeTheme.text}`}>{validatedLocation}</h2>
              </div>
              <div className={`${timeTheme.text === "text-white" ? "bg-white/10" : "bg-black/5"} px-2 py-1 rounded text-[10px] font-mono font-bold ${timeTheme.text}`}>{formatTime()}</div>
            </div>

            <div className="flex gap-2 mb-3">
              <div className={`flex-[1.3] ${vibeInfo.bg} ${vibeInfo.border} px-3 py-2.5 rounded-2xl border`}>
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{vibeInfo.label}</p>
                <p className={`text-[15px] font-black ${vibeInfo.color} leading-none flex items-center gap-2 mb-1`}>{vibeInfo.icon} {vibeInfo.text}</p>
                <p className="text-[9px] font-bold text-slate-500 leading-none uppercase italic">{vibeInfo.desc}</p>
              </div>
              {stats.titikRamai > 0 && (
                <div className="flex-1 bg-white/50 backdrop-blur-sm px-3 py-2.5 rounded-2xl border border-white/20 shadow-sm">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-1">TITIK AKTIF</p>
                  <p className={`text-[15px] font-black leading-none ${timeTheme.text === "text-white" ? "text-white" : "text-slate-900"}`}>{stats.titikRamai} <span className="text-[9px] opacity-50 font-bold ml-0.5">LOKASI</span></p>
                </div>
              )}
            </div>

            {stats.topPlace && (
              <button onClick={() => window.location.href = `/?id=${stats.topPlace.id}`} className="w-full active:scale-[0.98] transition-transform text-left bg-slate-900 rounded-xl p-2.5 flex items-center justify-between shadow-lg">
                <p className="text-[11px] font-bold text-white truncate px-1 min-w-0">
                  <span className="text-orange-400 font-black uppercase tracking-tighter">Trending:</span> {stats.topPlace.name} <span className={`font-black italic ml-1 ${dynamicMessage.color}`}>— {dynamicMessage.short}</span>
                </p>
                <span className="text-[10px] font-black text-white/30 uppercase ml-2 whitespace-nowrap">Cek →</span>
              </button>
            )}
          </div>

          {/* --- TAMPILAN COMPACT --- */}
          <div className={`absolute inset-0 h-[48px] px-4 flex items-center justify-between transition-all duration-300 ${compact ? "opacity-100 translate-y-0" : "opacity-0 pointer-events-none translate-y-2"}`}>
            <div className="flex items-center gap-3 flex-1 min-w-0" onClick={() => setIsExpanded(!isExpanded)}>
              <div className="relative">
                <span className="text-base">{vibeInfo.icon}</span>
                {stats.viralCount > 0 && <span className="absolute -top-1 -right-1 flex h-2 w-2 rounded-full bg-red-500 border border-white"></span>}
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5 text-[11px] font-black uppercase leading-none">
                  <span className={vibeInfo.color}>{vibeInfo.text}</span>
                  <span className="text-slate-300">•</span>
                  <span className={timeTheme.text === "text-white" ? "text-white" : "text-slate-900"}>{stats.titikRamai} TITIK</span>
                  <span className="text-slate-300">•</span>
                  <span className={vibeInfo.color}>{vibeInfo.impact}</span>
                </div>
                <p className="text-[9px] font-bold truncate text-slate-400">Update warga @ {validatedLocation}</p>
              </div>
            </div>
            <button onClick={() => setIsExpanded(!isExpanded)} className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${isExpanded ? "bg-white text-slate-900" : "bg-black/10 text-slate-500"}`}>
              <svg className={`transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* --- DROPDOWN DETAIL --- */}
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded && compact ? "max-h-[350px] opacity-100 border-t border-black/5" : "max-h-0 opacity-0"}`}>
          <div className="p-4 bg-black/5">
            <div className="flex gap-2 mb-4">
              <div className="flex-1 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm text-center">
                <p className="text-sm font-black text-slate-900 leading-none">{stats.titikDekat}</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Aktivitas Terdekat</p>
              </div>
              <div className="flex-1 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm text-center">
                <p className="text-sm font-black text-slate-900 leading-none">{stats.viralCount}</p>
                <p className="text-[8px] font-bold text-red-500 uppercase mt-1">Lagi Viral</p>
              </div>
            </div>

            {stats.topPlace && (
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm border-b-4 border-b-slate-900">
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                  <span className="text-slate-900 text-[9px] font-black uppercase tracking-[0.2em]">Update Suasana</span>
                </div>
                
                <h4 className="text-slate-900 font-black text-[15px] leading-tight mb-3 italic">
                  {dynamicMessage.pre}
                  <span className="text-red-600 not-italic">"{dynamicMessage.name}"</span>
                  {dynamicMessage.post}
                </h4>

                <button onClick={() => window.location.href = `/?id=${stats.topPlace.id}`} className="w-full py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2">
                  ⚡ Cek Suasana Sekarang
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}