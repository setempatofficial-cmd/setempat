"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Tambahkan prop 'locationReady' agar modal tahu status saat ini
export default function LocationModal({ isOpen, onClose, onSelectLocation, onUseGPS, locationReady }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

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

  if (!isOpen) return null;

  // Fungsi untuk mematikan lokasi 
  const handleDisableLocation = () => {
    onSelectLocation(null); // Mengirim null ke setManualLocation untuk reset
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/10 backdrop-blur-3xl"
        onClick={onClose}
      />

      <motion.div 
        initial={{ y: 100, opacity: 0 }} 
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="relative w-full max-w-[400px] bg-white rounded-[40px] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.15)] border border-white overflow-hidden"
      >
        <div className="p-10">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-black tracking-tighter text-slate-900 leading-none">Radius</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-3">
              {locationReady ? "Kelola Lokasi Aktif" : "Atur Jangkauan Linimasa"}
            </p>
          </div>

          <div className="relative mb-6">
            <input 
              type="text"
              autoFocus
              placeholder="Cari wilayah spesifik..."
              className="w-full bg-slate-50 border-none rounded-2xl py-5 px-8 text-sm font-bold placeholder:text-slate-300 focus:ring-2 focus:ring-[#E3655B]/20 transition-all outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <button 
            onClick={() => { onUseGPS(); onClose(); }}
            className="w-full flex items-center justify-between p-5 mb-4 bg-slate-900 rounded-2xl hover:bg-[#E3655B] transition-all group shadow-xl shadow-slate-200"
          >
            <span className="text-white text-[11px] font-black uppercase tracking-[0.2em]">Perbarui Titik Presisi</span>
            <span className="text-xl">🛰️</span>
          </button>

          {/* TOMBOL DINAMIS: Mode Penjelajah atau Nonaktifkan Lokasi */}
          <button 
            onClick={locationReady ? handleDisableLocation : onClose}
            className={`w-full py-5 rounded-2xl border transition-all mb-8 active:scale-95 ${
              locationReady 
                ? "bg-red-50 border-red-100 text-red-500" 
                : "bg-slate-100 border-transparent text-slate-500"
            }`}
          >
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">
              {locationReady ? "Nonaktifkan Lokasi (Off)" : "Masuk Mode Penjelajah"}
            </span>
          </button>

          <div className="space-y-1 min-h-[60px] max-h-[160px] overflow-y-auto no-scrollbar border-t border-slate-50 pt-6">
             {/* ... (logika search results sama seperti sebelumnya) */}
             {searchResults.length > 0 ? (
                searchResults.map((res) => (
                  <button
                    key={res.place_id}
                    onClick={() => {
                      onSelectLocation({
                        latitude: parseFloat(res.lat),
                        longitude: parseFloat(res.lon),
                        name: res.display_name.split(",")[0]
                      });
                      onClose();
                    }}
                    className="w-full p-3 rounded-xl hover:bg-slate-50 transition-all text-left"
                  >
                    <h4 className="font-bold text-slate-800 text-[13px] truncate">{res.display_name.split(",")[0]}</h4>
                  </button>
                ))
             ) : (
                <div className="text-center py-4 opacity-20">
                  <p className="text-[9px] font-black uppercase tracking-[0.3em]">Awaiting Position</p>
                </div>
             )}
          </div>

          <div className="mt-8 flex items-start gap-4 p-5 bg-slate-50/50 rounded-[30px] border border-white">
            <div className={`mt-1 w-2 h-2 rounded-full ${locationReady ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-[#E3655B] shadow-[0_0_8px_#E3655B]'}`} />
            <p className="text-[9px] text-slate-500 leading-relaxed font-bold italic">
              {locationReady 
                ? "Radius saat ini sedang aktif menyaring konten di radius sekitar Anda." 
                : "Aktifkan lokasi untuk memfilter konten real-time di titik terdekat."}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}