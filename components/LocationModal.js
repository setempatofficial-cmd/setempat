"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function LocationModal({ isOpen, onClose, onSelectManual, onActivateGPS, locationReady }) {
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
 const formatLocationData = (res) => {
  const addr = res.address;
  
  // 1. Cari Identitas Desa (Cek berbagai kemungkinan label dari satelit)
  const desa = addr.village || addr.town || addr.suburb || addr.hamlet || addr.municipality || res.display_name.split(",")[0];
  
  // 2. Cari Identitas Kecamatan (Cek label district)
  // Catatan: Jika district tidak ada, kita gunakan kota sebagai fallback sementara
  const kecamatan = addr.city_district || addr.district || addr.county || addr.city || "Pasuruan";

  return {
    desa: desa.replace("Kelurahan ", "").replace("Desa ", ""), // Bersihkan kata "Kelurahan/Desa" agar ringkas
    kecamatan: kecamatan.replace("Kecamatan ", "") // Bersihkan kata "Kecamatan"
  };
};
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div 
            initial={{ y: "100%", opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="relative w-full max-w-[420px] bg-white rounded-t-[40px] sm:rounded-[40px] shadow-2xl overflow-hidden border border-slate-100"
          >
            {/* Handle Bar untuk Mobile agar terasa natural */}
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-4 mb-2 sm:hidden" />

            <div className="p-8 pt-4 sm:pt-8">
              {/* Header: Fokus pada kenyamanan & rasa ingin tahu */}
              <div className="mb-6">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">
                  Lagi di <span className="text-[#E3655B]">Mana</span> Sekarang?
                </h2>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.1em] mt-2">
                  Biar kami tampilkan suasana di sekitarmu
                </p>
              </div>

              <div className="space-y-4">
                {/* 1. TOMBOL UTAMA: Fokus pada Kemudahan (Otomatis) */}
                <button 
                  onClick={() => { onActivateGPS(); onClose(); }}
                  className={`w-full group relative overflow-hidden flex flex-col items-center justify-center gap-1 p-6 rounded-[28px] transition-all active:scale-95 shadow-xl ${
                    locationReady 
                    ? "bg-green-50 border-2 border-green-500/20" 
                    : "bg-slate-900 shadow-slate-200 hover:bg-[#E3655B]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{locationReady ? "✨" : "📍"}</span>
                    <span className={`text-xs font-black uppercase tracking-[0.2em] ${locationReady ? 'text-green-700' : 'text-white'}`}>
                      {locationReady ? "Sudah Terhubung Otomatis" : "Cari Lokasi Otomatis"}
                    </span>
                  </div>
                  <p className={`text-[9px] font-bold uppercase tracking-tighter opacity-70 ${locationReady ? 'text-green-600' : 'text-white/70'}`}>
                    Langsung temukan desa & kecamatanmu
                  </p>
                </button>

                <div className="relative flex items-center py-2">
                  <div className="flex-grow border-t border-slate-100"></div>
                  <span className="flex-shrink mx-4 text-[9px] font-black text-slate-300 uppercase tracking-widest">Atau Ketik Manual</span>
                  <div className="flex-grow border-t border-slate-100"></div>
                </div>

                {/* 2. SEARCH BOX: Fokus pada Keakraban */}
                <div className="relative">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input 
                    type="text"
                    placeholder="Contoh: Desa/Kelurahan, Kecamatan..."
                    className="w-full bg-slate-50 border-2 border-slate-100 focus:border-[#E3655B]/30 focus:bg-white rounded-[22px] py-4 pl-12 pr-6 text-sm font-bold text-slate-900 placeholder:text-slate-400 outline-none transition-all shadow-inner"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {isSearching && (
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-[#E3655B] border-t-transparent rounded-full animate-spin" />
                  )}
                </div>

                {/* HASIL SEARCH */}
                <div className="space-y-2 max-h-[160px] overflow-y-auto no-scrollbar">
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
                      className="w-full p-4 rounded-[18px] hover:bg-slate-50 text-left border border-transparent hover:border-slate-100 group transition-all"
                    >
                      <h4 className="font-black text-slate-800 text-xs uppercase tracking-tight group-hover:text-[#E3655B]">
                        {res.display_name.split(",")[0]}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-bold truncate mt-0.5">
                        {res.display_name.split(",").slice(1, 3).join(", ")}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. SAFETY BOX: Membuat user merasa aman & nyaman */}
              <div className="mt-8 pt-6 border-t border-slate-50 flex flex-col gap-4">
                <div className="flex items-start gap-4 bg-orange-50/50 p-4 rounded-2xl">
                  <div className="bg-orange-100 p-2 rounded-lg">
                    <span className="text-sm">🛡️</span>
                  </div>
                  <div>
                    <h5 className="text-[10px] font-black text-orange-800 uppercase tracking-tight mb-1">Privasimu Aman</h5>
                    <p className="text-[9px] text-orange-700/80 font-bold leading-relaxed tracking-tight">
                      Data lokasimu hanya digunakan untuk menyaring postingan di sekitar. Kami tidak menyimpan atau membagikan riwayat perjalananmu ke siapapun.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between px-2">
                  <button 
                    onClick={onClose}
                    className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900"
                  >
                    Nanti Saja
                  </button>

                  {locationReady && (
                    <button 
                      onClick={() => { onSelectManual(null); onClose(); }}
                      className="text-[10px] font-black text-[#E3655B] uppercase tracking-widest px-4 py-2 bg-red-50 rounded-full"
                    >
                      Matikan Lokasi
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