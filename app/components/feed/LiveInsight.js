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
    <div className="mt-3 bg-indigo-50/40 rounded-2xl p-3 border border-indigo-100/30 backdrop-blur-sm relative overflow-hidden">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
          </div>
        </div>
        
        <div className="flex-1">
          <p className={`text-[12px] text-indigo-900 font-semibold leading-relaxed transition-all duration-700 ease-in-out transform ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
          }`}>
            "{insights[index]}"
          </p>
        </div>
      </div>
    </div>
  );
}