"use client";

import { useState, useEffect, useMemo } from "react";

export default function LiveInsight({ signals, theme }) {
  const [index, setIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  // Deteksi Mode Malam (pakai dari theme)
  const isDark = theme?.isMalam || theme?.name === "MALAM";

  const insights = useMemo(() => {
    if (!signals || !Array.isArray(signals) || signals.length === 0) {
      return ["Kondisi terpantau normal", "Suasana cukup kondusif", "Belum ada laporan antrian"];
    }
    return signals.slice(0, 5).map(s => s.text || "Info terkini tersedia");
  }, [signals]);

  useEffect(() => {
    if (insights.length <= 1) return;
    const interval = setInterval(() => {
      setIsVisible(false);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % insights.length);
        setIsVisible(true);
      }, 600);
    }, 4500);
    return () => clearInterval(interval);
  }, [insights]);

  return (
    <div className={`rounded-[24px] p-4 border transition-all duration-500 relative overflow-hidden shadow-inner ${
      isDark 
        ? "bg-[#1e293b] border-white/10" // SOLUSI: Background solid slate-800, bukan transparan
        : "bg-white border-slate-200"     // SOLUSI: Background putih solid, bukan transparan
    }`}>
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 mt-1.5">
          <div className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              isDark ? 'bg-rose-400' : 'bg-rose-600'
            }`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${
              isDark ? 'bg-rose-400' : 'bg-rose-600'
            }`}></span>
          </div>
        </div>
        <div className="flex-1 text-left">
          {/* TEKS UTAMA: Kontras tinggi di kedua mode */}
          <p className={`text-[15px] font-bold leading-[1.4] tracking-tight transition-all duration-700 ease-in-out transform ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
          } ${isDark ? "text-white" : "text-slate-900"}`}>
            "{insights[index]}"
          </p>
          <div className="mt-2 flex items-center gap-2">
             <span className={`text-[8px] font-black uppercase tracking-[0.2em] italic ${
               isDark ? "text-emerald-400" : "text-emerald-600"
             }`}>
               Real-Time Monitor
             </span>
             <div className={`h-[1px] w-8 ${isDark ? "bg-emerald-400/20" : "bg-emerald-600/20"}`}></div>
          </div>
        </div>
      </div>
    </div>
  );
}