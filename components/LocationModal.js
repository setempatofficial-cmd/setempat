"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

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

  const handleDisableLocation = () => {
    onSelectLocation(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/10 backdrop-blur-3xl"
        onClick={onClose}
      />

      {/* Modal Container */}
      <motion.div 
        initial={{ y: 100, opacity: 0, scale: 0.9 }} 
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 100, opacity: 0, scale: 0.9 }}
        className="relative w-full max-w-[400px] bg-white rounded-[40px] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.15)] border border-white overflow-hidden"
      >
        <div className="p-10">
          {/* Header Branding with Glow Effect */}
          <div className="mb-10 text-center relative">
            <motion.h2 
              animate={{ 
                color: locationReady ? "#000000" : "#94a3b8",
                textShadow: locationReady ? "0 0 20px rgba(99, 102, 241, 0.2)" : "none"
              }}
              className="text-3xl font-black tracking-tighter leading-none transition-all duration-700"
            >
              Radius
            </motion.h2>
            
            {/* Pulsing Dot Indicator */}
            <div className="flex justify-center items-center gap-2 mt-3">
              <AnimatePresence mode="wait">
                {locationReady ? (
                  <motion.div 
                    key="on"
                    initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                    className="flex items-center gap-1.5"
                  >
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    <span className="text-[9px] font-black text-green-600 uppercase tracking-[0.2em]">Active</span>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="off"
                    initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                    className="flex items-center gap-1.5"
                  >
                    <span className="h-2 w-2 rounded-full bg-slate-200"></span>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Inactive</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative mb-6">
            <input 
              type="text"
              autoFocus
              placeholder="Cari wilayah spesifik..."
              className="w-full bg-slate-50 border-none rounded-2xl py-5 px-8 text-sm font-bold placeholder:text-slate-300 focus:ring-2 focus:ring-indigo-500/10 transition-all outline-none shadow-inner"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {isSearching && (
              <div className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            )}
          </div>

          {/* Action: GPS */}
          <button 
            onClick={() => { onUseGPS(); onClose(); }}
            className="w-full flex items-center justify-between p-5 mb-4 bg-slate-900 rounded-2xl hover:bg-indigo-600 transition-all group shadow-xl shadow-slate-200 active:scale-[0.97]"
          >
            <span className="text-white text-[11px] font-black uppercase tracking-[0.2em]">
              {locationReady ? "Perbarui Posisi" : "Aktifkan Presisi"}
            </span>
            <span className="text-xl group-hover:rotate-12 transition-transform">🛰️</span>
          </button>

          {/* Action: Toggle Incognito/Disable */}
          <button 
            onClick={locationReady ? handleDisableLocation : onClose}
            className={`w-full py-5 rounded-2xl border transition-all mb-8 active:scale-[0.97] ${
              locationReady 
                ? "bg-red-50 border-red-100 text-red-500 hover:bg-red-100" 
                : "bg-slate-100 border-transparent text-slate-500 hover:bg-slate-200"
            }`}
          >
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">
              {locationReady ? "Nonaktifkan Jangkauan" : "Mode Penjelajah"}
            </span>
          </button>

          {/* Results Area */}
          <div className="space-y-1 min-h-[60px] max-h-[160px] overflow-y-auto no-scrollbar border-t border-slate-50 pt-6">
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
                  className="w-full p-4 rounded-xl hover:bg-slate-50 transition-all text-left flex items-center justify-between group"
                >
                  <div className="min-w-0">
                    <h4 className="font-bold text-slate-800 text-[13px] truncate group-hover:text-indigo-600 transition-colors">{res.display_name.split(",")[0]}</h4>
                    <p className="text-[9px] text-slate-400 truncate uppercase mt-0.5 tracking-tighter">
                      {res.display_name.split(",").slice(1, 2)}
                    </p>
                  </div>
                  <span className="opacity-0 group-hover:opacity-100 transition-all text-indigo-500">📍</span>
                </button>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-6 opacity-30">
                <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400">Search Engine Ready</p>
              </div>
            )}
          </div>

          {/* Dynamic Privacy Note */}
          <div className="mt-8 pt-8 border-t border-slate-50">
            <p className="text-[9px] text-slate-400 leading-relaxed font-medium italic text-center px-4">
              {locationReady 
                ? "Akses lokasi sedang aktif. Data diproses secara lokal untuk menghitung radius feed." 
                : "Akses lokasi dinonaktifkan. Menampilkan konten global berdasarkan popularitas."}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}