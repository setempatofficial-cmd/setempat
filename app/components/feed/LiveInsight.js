"use client";

import { useState, useEffect, useMemo } from "react";

export default function LiveInsight({ signals }) {
  const [index, setIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const insights = useMemo(() => {
    if (!signals || signals.length === 0) {
      return [
        "Kondisi terpantau normal", 
        "Suasana cukup kondusif", 
        "Belum ada laporan antrian"
      ];
    }
    return signals.slice(0, 5).map(s => s.text);
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
    // Mengatur padding lebih luas (p-4) agar teks besar tidak sesak
    <div className="mt-3 bg-indigo-50/60 rounded-2xl p-4 border border-indigo-200/50 backdrop-blur-sm relative overflow-hidden shadow-sm">
      <div className="flex items-start gap-4">
        {/* Indikator Live yang juga sedikit diperbesar */}
        <div className="flex-shrink-0 mt-1.5">
          <div className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
          </div>
        </div>
        
        <div className="flex-1 text-left">
          {/* FONT SIZE DIUBAH KE text-[15px] dan font-bold */}
          <p className={`text-[15px] text-indigo-950 font-bold leading-[1.4] tracking-tight transition-all duration-700 ease-in-out transform ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
          }`}>
            "{insights[index]}"
          </p>
          
          {/* Sub-label kecil untuk memperkuat kesan "Live" */}
          <div className="mt-1 opacity-40">
             <span className="text-[8px] font-black uppercase tracking-[0.2em] text-indigo-900">Real-time Insight</span>
          </div>
        </div>
      </div>
    </div>
  );
}