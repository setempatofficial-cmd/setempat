"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "@/app/components/LocationProvider"

export default function LocationModal({ isOpen, onClose, onSelectManual, onActivateGPS, locationReady }) {
  const { sapaan } = useLocation(); // Ambil status waktu pusat
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // LOGIKA TEMA MODAL
  const theme = useMemo(() => {
    const isMalam = sapaan === "Malam";
    return {
      isMalam,
      overlay: isMalam ? "bg-slate-950/80" : "bg-orange-950/20",
      card: isMalam ? "bg-[#0f172a] border-slate-800" : "bg-white border-slate-100",
      text: isMalam ? "text-white" : "text-slate-900",
      subText: isMalam ? "text-slate-400" : "text-slate-500",
      input: isMalam ? "bg-slate-900/50 border-slate-800 text-white" : "bg-slate-50 border-slate-100 text-slate-800",
      itemHover: isMalam ? "hover:bg-slate-900/50" : "hover:bg-slate-50",
      handle: isMalam ? "bg-slate-700" : "bg-slate-300",
      divider: isMalam ? "border-slate-800" : "border-slate-100"
    };
  }, [sapaan]);

  // 1. Logika Pencarian Manual (Debounce)
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.length > 2) {
        setIsSearching(true);
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${searchQuery}&countrycodes=id&limit=5`
          );
          const data = await res.json();
          setSearchResults(data);
        } catch (err) {
          console.error(err);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 600);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // 2. Logika GPS
  const handleGPSWithEffect = async () => {
    setIsLocating(true);
    try {
      await onActivateGPS(); 
      setTimeout(() => {
        setIsLocating(false);
        onClose();
      }, 800);
    } catch (err) {
      setIsLocating(false);
      console.error("Izin lokasi ditolak atau gagal:", err);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
          {/* OVERLAY */}
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className={`absolute inset-0 backdrop-blur-md ${theme.overlay}`}
            onClick={onClose}
          />

          {/* MODAL CARD */}
          <motion.div 
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.7}
            onDragEnd={(e, { offset, velocity }) => {
              if (offset.y > 100 || velocity.y > 500) onClose();
            }}
            initial={{ y: "100%", opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 220 }}
            className={`relative w-full max-w-[420px] rounded-t-[42px] sm:rounded-[42px] shadow-[0_-20px_50px_-15px_rgba(0,0,0,0.3)] border ${theme.card} touch-none overflow-hidden`}
          >
            {/* HANDLE BAR */}
            <div className="flex justify-center pt-5 pb-2">
              <div className={`w-14 h-1.5 rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] cursor-grab active:cursor-grabbing ${theme.handle}`} />
            </div>

            <div className="p-8 pt-2 sm:pt-4">
              {/* Header */}
              <div className="mb-8">
                <h2 className={`text-[26px] font-[900] tracking-tight leading-[1.1] ${theme.text}`}>
                  Atur <span className="text-[#E3655B] drop-shadow-sm">Radius</span> Suasana?
                </h2>
                <p className={`text-[10px] font-extrabold uppercase tracking-[0.15em] mt-3 flex items-center gap-2 ${theme.subText}`}>
                  <span className={`w-4 h-[2px] ${theme.divider}`}></span>
                  Lihat Info Sekitarmu Secara Otomatis
                </p>
              </div>

              <div className="space-y-5">
                {/* 1. TOMBOL GPS UTAMA */}
                <motion.button 
                  layout
                  onClick={handleGPSWithEffect}
                  animate={{
                    backgroundColor: (locationReady || isLocating) ? (theme.isMalam ? "#064e3b" : "#ecfdf5") : (theme.isMalam ? "#1e293b" : "#0f172a"),
                    borderColor: (locationReady || isLocating) ? "rgba(16, 185, 129, 0.2)" : "rgba(0,0,0,0)",
                  }}
                  whileTap={{ scale: 0.97 }}
                  className={`w-full group relative overflow-hidden flex flex-col items-center justify-center gap-1.5 p-6 rounded-[32px] border-2 transition-shadow shadow-lg ${
                    (locationReady || isLocating) ? "shadow-emerald-900/20" : "shadow-black/5"
                  }`}
                >
                  <div className="flex items-center gap-3 relative z-10">
                    <motion.span 
                      animate={{ 
                        scale: (locationReady || isLocating) ? [1, 1.3, 1] : 1,
                        rotate: isLocating ? [0, 10, -10, 0] : 0
                      }}
                      transition={{ duration: 0.5, repeat: isLocating ? Infinity : 0 }}
                      className="text-2xl drop-shadow-sm"
                    >
                      {(locationReady || isLocating) ? "✨" : "📍"}
                    </motion.span>
                    <span className={`text-[13px] font-black uppercase tracking-[0.12em] transition-colors duration-500 ${
                      (locationReady || isLocating) ? 'text-emerald-400' : 'text-white'
                    }`}>
                      {isLocating ? "Memindai Radius..." : locationReady ? "Radius Terhubung" : "Pakai Radius Otomatis"}
                    </span>
                  </div>
                  <p className={`text-[10px] font-bold uppercase tracking-tight relative z-10 transition-colors duration-500 ${
                    (locationReady || isLocating) ? 'text-emerald-500/80' : 'text-white/60'
                  }`}>
                    Akurasi suasana lokal terbaik
                  </p>
                </motion.button>

                <div className="relative flex items-center py-2 px-2">
                  <div className={`flex-grow border-t ${theme.divider}`}></div>
                  <span className={`flex-shrink mx-4 text-[10px] font-black uppercase tracking-[0.2em] ${theme.subText}`}>Atur Manual</span>
                  <div className={`flex-grow border-t ${theme.divider}`}></div>
                </div>

                {/* 2. SEARCH BOX */}
                <div className="relative group">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#E3655B] transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input 
                    type="text"
                    placeholder="Nama Desa atau Kecamatan..."
                    className={`w-full border-2 rounded-[24px] py-4.5 pl-14 pr-6 text-[15px] font-bold placeholder:text-slate-500 outline-none transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] ${theme.input} ${theme.isMalam ? 'focus:border-cyan-500/40' : 'focus:border-[#E3655B]/40'}`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {isSearching && (
                    <div className={`absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 border-[3px] border-t-transparent rounded-full animate-spin ${theme.isMalam ? 'border-cyan-400' : 'border-[#E3655B]'}`} />
                  )}
                </div>

                {/* HASIL SEARCH */}
                <div className="space-y-1.5 max-h-[160px] overflow-y-auto no-scrollbar px-1">
                  {searchResults.map((res) => (
                    <button
                      key={res.place_id}
                      onClick={() => {
                        onSelectManual({
                          latitude: parseFloat(res.lat),
                          longitude: parseFloat(res.lon),
                          name: res.display_name.split(",")[0]
                        });
                        onClose();
                      }}
                      className={`w-full p-4 rounded-[20px] text-left border border-transparent group transition-all duration-200 ${theme.itemHover}`}
                    >
                      <h4 className={`font-[800] text-sm tracking-tight transition-colors ${theme.text} ${theme.isMalam ? 'group-hover:text-cyan-400' : 'group-hover:text-[#E3655B]'}`}>
                        {res.display_name.split(",")[0]}
                      </h4>
                      <p className={`text-[11px] font-semibold truncate mt-0.5 ${theme.subText}`}>
                        {res.display_name.split(",").slice(1, 3).join(", ")}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. PRIVACY INFO BOX */}
              <div className={`mt-8 pt-6 border-t flex flex-col gap-6 ${theme.divider}`}>
                <div className={`flex items-start gap-4 p-5 rounded-[24px] border ${theme.isMalam ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50/80 border-slate-100/50'}`}>
                  <div className={`shadow-sm p-2 rounded-xl shrink-0 ${theme.isMalam ? 'bg-slate-800' : 'bg-white'}`}>
                    <span className="text-base">🛡️</span>
                  </div>
                  <div>
                    <h5 className={`text-[11px] font-[900] uppercase tracking-tight mb-1 ${theme.text}`}>Privasi Terjamin</h5>
                    <p className={`text-[10px] font-bold leading-relaxed tracking-tight ${theme.subText}`}>
                      Radius hanya digunakan untuk memfilter feed di sekitar Anda secara lokal.
                    </p>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-between px-2 mb-2">
                  <button 
                    onClick={onClose}
                    className={`text-[11px] font-black uppercase tracking-[0.2em] transition-colors ${theme.subText} ${theme.isMalam ? 'hover:text-white' : 'hover:text-slate-900'}`}
                  >
                    Nanti Saja
                  </button>

                  {locationReady && (
                    <button 
                      onClick={() => { onSelectManual(null); onClose(); }}
                      className={`text-[11px] font-[900] uppercase tracking-[0.1em] px-5 py-2.5 rounded-full transition-colors ${theme.isMalam ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-red-50 text-[#E3655B] hover:bg-red-100'}`}
                    >
                     Nonaktifkan Radius
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}