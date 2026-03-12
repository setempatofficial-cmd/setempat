"use client";

import { useState, useEffect, useMemo } from "react";

export default function LiveInsight({ signals }) {
  const [index, setIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

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
    <div className="bg-white/[0.04] rounded-[24px] p-4 border border-white/[0.08] backdrop-blur-md relative overflow-hidden shadow-inner">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 mt-1.5">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
          </div>
        </div>
        <div className="flex-1 text-left">
          <p className={`text-[15px] text-zinc-100 font-bold leading-[1.4] tracking-tight transition-all duration-700 ease-in-out transform ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
          }`}>
            "{insights[index]}"
          </p>
          <div className="mt-2 flex items-center gap-2">
             <span className="text-[8px] font-black uppercase tracking-[0.2em] text-emerald-500 opacity-80 italic">Real-Time Monitor</span>
             <div className="h-[1px] w-8 bg-emerald-500/20"></div>
          </div>
        </div>
      </div>
    </div>
  );
}