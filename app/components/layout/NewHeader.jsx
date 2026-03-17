"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearch } from "../../hooks/useSearch";
import { useLocation } from "../LocationProvider"; 
import UserMenu from "./UserMenu"; // Import komponen baru

export default function Header({
  user,
  isAdmin,
  locationReady,
  villageLocation,
  isScrolled,
  onOpenLocationModal,
  onOpenAIModal, 
  onSearchResults,
  onSearchLoading,
  onQueryChange,
  onOpenAuthModal,
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
    <header className={`sticky top-0 z-[1000] transition-all duration-300 ${
      isScrolled ? theme.bgGlass : theme.bg
    } ${!isScrolled ? `border-b ${theme.border}` : "border-none"}`}> 
      
      <div className="px-4 py-3">
        {/* BARIS ATAS */}
        <div className="flex items-center gap-2 h-16">
          
          {/* LOGO & PIN (tetap sama) */}
          <button 
            onClick={onOpenLocationModal}
            className={`flex items-center gap-2 flex-shrink-0 transition-all duration-300 rounded-xl active:scale-95 ${
              isScrolled ? (theme.isMalam ? "bg-white/5 p-1 pr-2 border border-white/10" : "bg-white p-1 pr-2 border border-slate-100 shadow-sm") : ""
            }`}
          >
            <div className={`transition-all duration-300 ease-out flex-shrink-0 bg-[#E3655B] rounded-lg flex items-center justify-center shadow-md ${
              isScrolled ? "w-8 h-8" : "w-10 h-10"
            }`}>
              <svg className={`${isScrolled ? "w-5 h-5" : "w-6 h-6"} text-white`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            {isScrolled && (
              <div className="flex items-center gap-1 animate-in fade-in slide-in-from-left-2 duration-300">
                 <span className={`w-1.5 h-1.5 rounded-full ${locationReady ? theme.dot : "bg-red-400"}`} />
                 <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                 </svg>
              </div>
            )}
          </button>

          {/* BRANDING & COMPACT SEARCH (tetap sama) */}
          <div className="relative flex-1 h-10 flex items-center min-w-0">
            <button 
              onClick={onOpenLocationModal}
              className={`absolute inset-0 flex flex-col items-start transition-all duration-300 ease-out origin-left overflow-hidden ${
                isScrolled ? "opacity-0 -translate-y-4 pointer-events-none" : "opacity-100 translate-y-0"
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

            <div className={`w-full transition-all duration-300 ease-out ${
              isScrolled ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-8 scale-95 pointer-events-none"
            }`}>
              <div className="relative group">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={locationReady && villageLocation ? `Cari di ${villageLocation}...` : "Aktifkan Lokasi.."}
                  className={`w-full border rounded-xl py-2 pl-9 pr-14 text-[13px] font-semibold focus:outline-none transition-colors duration-200 ${theme.input} ${theme.inputFocus}`}
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <button onClick={onOpenAIModal} className={`absolute right-1 top-1/2 -translate-y-1/2 px-2 py-1 rounded-lg active:scale-95 transition-all duration-200 flex items-center gap-1 border shadow-sm ${theme.isMalam ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400" : "bg-[#E3655B]/10 border-[#E3655B]/20 text-[#E3655B]"}`}>
                  <div className="flex flex-col items-center leading-none">
                    <span className="text-[6px] font-black uppercase tracking-tighter">Tanya</span>
                    <span className="text-[9px] font-black italic">AI PRO</span>
                  </div>
                  <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="flex items-center justify-center">
                    <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 24 24"><path d="M9 5l.733 2.267L12 8l-2.267.733L9 11l-.733-2.267L6 8l2.267-.733L9 5zm7 7l.55 1.7L18 14.25l-1.45.55L16 16.5l-.55-1.7L14 14.25l1.45-.55L16 12z" /></svg>
                  </motion.span>
                </button>
              </div>
            </div>
          </div>

          {/* USER MENU - GANTI DENGAN KOMPONEN BARU */}
          <UserMenu 
            user={user}
            isAdmin={isAdmin}
            isScrolled={isScrolled}
            onOpenAuthModal={onOpenAuthModal}
            theme={theme}
          />
        </div>

        {/* SEARCH BAWAH (tetap sama) */}
        <div className={`transition-all duration-500 ${isScrolled ? "max-h-0 opacity-0 overflow-hidden" : "max-h-[100px] opacity-100"}`}>
          {/* ... kode search bawah tetap sama ... */}
        </div>
      </div>
    </header>
  );
}