"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearch } from "../../hooks/useSearch";
import { useLocation } from "../LocationProvider"; 

export default function Header({
  locationReady,
  villageLocation,
  isScrolled,
  onOpenLocationModal,
  onOpenAIModal, 
  onSearchResults,
  onSearchLoading,
  onQueryChange,
}) {
  const { sapaan } = useLocation(); 
  
  const { query, setQuery, results, isLoading } = useSearch(locationReady, villageLocation);
  const [isListening, setIsListening] = useState(false);
  const [isFocused, setIsFocused] = useState(false); 

  const theme = useMemo(() => {
    const isMalam = sapaan === "Malam";

    return {
      isMalam,
      bg: isMalam ? "bg-[#0f172a]" : "bg-[#F9F7F7]",
      bgGlass: isMalam ? "bg-[#0f172a]" : "bg-[#F9F7F7]", 
      border: isMalam ? "border-slate-800" : "border-slate-200/60",
      text: isMalam ? "text-white" : "text-slate-900",
      subText: isMalam ? "text-slate-400" : "text-slate-500",
      input: isMalam ? "bg-white/10 border-white/10 text-white" : "bg-white border-slate-200 text-slate-700",
      inputFocus: isMalam ? "focus:bg-white/15" : "focus:bg-white",
      accent: isMalam ? "text-cyan-400" : "text-[#E3655B]",
      dot: isMalam ? "bg-cyan-400 shadow-[0_0_8px_#22d3ee]" : "bg-green-500 shadow-[0_0_3px_#22c55e]"
    };
  }, [sapaan]);

  useEffect(() => {
    if (onSearchResults) onSearchResults(results);
    if (onSearchLoading) onSearchLoading(isLoading);
    if (onQueryChange) onQueryChange(query);
  }, [results, isLoading, query, onSearchResults, onSearchLoading, onQueryChange]);

  const handleVoiceSearch = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = 'id-ID';
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event) => setQuery(event.results[0][0].transcript);
    recognition.start();
  };

  return (
    <header className={`sticky top-0 z-[1000] transition-all duration-400 ${
      isScrolled ? theme.bgGlass : theme.bg
    } ${!isScrolled ? `border-b ${theme.border}` : "border-none"}`}> 
      
      <div className="flex items-center gap-2 px-4 py-3 h-16">
        {/* LOGO & PIN */}
        <button 
          onClick={onOpenLocationModal}
          className={`flex items-center gap-2 flex-shrink-0 transition-all duration-500 rounded-xl active:scale-95 ${
            isScrolled ? (theme.isMalam ? "bg-white/5 p-1 pr-2 border border-white/10" : "bg-white p-1 pr-2 border border-slate-100 shadow-sm") : ""
          }`}
        >
          <div className={`transition-all duration-500 ease-in-out flex-shrink-0 bg-[#E3655B] rounded-lg flex items-center justify-center shadow-md ${
            isScrolled ? "w-8 h-8" : "w-10 h-10"
          }`}>
            <svg className={`${isScrolled ? "w-5 h-5" : "w-6 h-6"} text-white`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>

          {isScrolled && (
            <div className="flex items-center gap-1 animate-in fade-in slide-in-from-left-2 duration-500">
               <span className={`w-1.5 h-1.5 rounded-full ${locationReady ? theme.dot : "bg-red-400"}`} />
               <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
               </svg>
            </div>
          )}
        </button>

        {/* BRANDING & COMPACT SEARCH */}
        <div className="relative flex-1 h-10 flex items-center min-w-0">
          <button 
            onClick={onOpenLocationModal}
            className={`absolute inset-0 flex flex-col items-start transition-all duration-300 ease-in-out origin-left overflow-hidden ${
              isScrolled ? "opacity-0 -translate-y-4 pointer-events-none w-0" : "opacity-100 translate-y-0 w-auto"
            }`}
          >
            <h1 className={`text-[16px] font-bold tracking-tight leading-tight whitespace-nowrap ${theme.text}`}>
              Setempat<span className="text-[#E3655B]">ID</span>
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5 w-full whitespace-nowrap">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${locationReady ? theme.dot : "bg-red-400"}`} />
              <p className={`text-[11px] font-medium truncate max-w-[110px] ${theme.subText}`}>
                {locationReady && villageLocation ? villageLocation : "Pilih lokasimu"}
              </p>
              <svg className="w-2.5 h-2.5 text-slate-400 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ animationDuration: '3s' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          <div className={`w-full transition-all duration-500 ease-out ${
            isScrolled ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-8 scale-95 pointer-events-none"
          }`}>
            <div className="relative group">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari..."
                className={`w-full border rounded-xl py-2 pl-9 pr-14 text-[13px] font-semibold focus:outline-none transition-all ${theme.input} ${theme.inputFocus}`}
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              
              {/* TOMBOL AI COMPACT (PENEGASAN KLIK) */}
              <button 
                onClick={onOpenAIModal} 
                className={`absolute right-1 top-1/2 -translate-y-1/2 px-2 py-1 rounded-lg active:scale-95 transition-all flex items-center gap-1 border shadow-sm ${
                  theme.isMalam 
                  ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400" 
                  : "bg-[#E3655B]/10 border-[#E3655B]/20 text-[#E3655B]"
                }`}
              >
                <div className="flex flex-col items-center leading-none">
                  <span className="text-[6px] font-black uppercase tracking-tighter">Tanya</span>
                  <span className="text-[9px] font-black italic">AI PRO</span>
                </div>
                <motion.span 
                  animate={{ scale: [1, 1.2, 1] }} 
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="flex items-center justify-center"
                >
                  <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 24 24"><path d="M9 5l.733 2.267L12 8l-2.267.733L9 11l-.733-2.267L6 8l2.267-.733L9 5zm7 7l.55 1.7L18 14.25l-1.45.55L16 16.5l-.55-1.7L14 14.25l1.45-.55L16 12z" /></svg>
                </motion.span>
              </button>
            </div>
          </div>
        </div>

        {/* NOTIF BELL */}
        <div className="flex-shrink-0 ml-1">
          <button className={`relative flex items-center justify-center transition-all duration-500 ${
            isScrolled ? "w-8 h-8 opacity-80" : `w-10 h-10 rounded-xl border ${theme.isMalam ? "bg-white/5 border-white/10" : "bg-white border-slate-200"}`
          }`}>
            <span className="text-lg opacity-60">🔔</span>
            {locationReady && (
              <span className={`absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full border border-slate-900 ${theme.isMalam ? "bg-cyan-400 shadow-[0_0_5px_#22d3ee]" : "bg-[#E3655B]"}`}></span>
            )}
          </button>
        </div>
      </div>

      {/* SEARCH BAWAH (Hanya muncul saat belum scroll) */}
      <div className={`transition-all duration-700 ${isScrolled ? "max-h-0 opacity-0 overflow-hidden" : "max-h-[100px] opacity-100 pb-5"}`}>
        <div className="px-5">
          <div className="relative group">
            <div className={`absolute inset-0 rounded-2xl transition-all duration-300 border ${
              isListening ? "bg-red-500/10 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]" : 
              isFocused ? "bg-white border-[#E3655B] shadow-lg" : `${theme.input} ${theme.inputFocus}`
            }`} />
            
            <input
              type="text"
              value={query}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={locationReady && villageLocation ? `Cari di ${villageLocation}...` : "Cari..."}
              className={`relative w-full bg-transparent py-4 pl-12 transition-all duration-300 ${isFocused ? 'pr-12' : 'pr-20'} text-[14px] font-bold focus:outline-none ${theme.text}`}
            />

            <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 text-slate-400 group-focus-within:text-[#E3655B]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>

            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 z-10">
              <AnimatePresence>
                {!isFocused && (
                  <motion.button 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    onClick={handleVoiceSearch} 
                    className={`p-2 rounded-xl transition-all ${isListening ? "text-red-500 animate-pulse bg-white shadow-sm scale-110" : `text-slate-400 hover:${theme.accent}`}`}
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
                  </motion.button>
                )}
              </AnimatePresence>

              {!isFocused && (
                <div className={`h-6 w-[1px] ${theme.isMalam ? "bg-white/10" : "bg-slate-200"}`} />
              )}

              {/* TOMBOL AI PRO DENGAN FIX SHIMMER */}
              <button 
                onClick={onOpenAIModal}
                className={`relative group flex flex-col items-center px-3 py-1.5 rounded-xl transition-all active:scale-95 overflow-hidden border shadow-sm ${
                  theme.isMalam 
                  ? "bg-slate-800 border-white/10 hover:border-cyan-400/50" 
                  : "bg-white border-slate-200 hover:border-[#E3655B]/50 hover:shadow-md"
                } ${isFocused ? 'mr-1' : ''}`}
              >
                {/* Layer Kilatan (Shimmer) */}
                <motion.div 
                  initial={{ x: "-150%" }}
                  animate={{ x: "150%" }}
                  transition={{ 
                    repeat: Infinity, 
                    duration: 2.5, 
                    ease: "easeInOut",
                    repeatDelay: 1 
                  }}
                  className="absolute inset-0 pointer-events-none z-0"
                  style={{
                    background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
                    width: '60%',
                    skewX: '-20deg'
                  }}
                />

                <span className={`relative z-10 text-[8px] font-black leading-none uppercase tracking-wider ${theme.accent}`}>Tanya</span>
                <div className="relative z-10 flex items-center gap-0.5">
                  <span className={`text-[10px] font-black leading-none ${theme.subText}`}>AI</span>
                  <span className={`text-[10px] font-black italic leading-none ${theme.accent}`}>PRO</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}