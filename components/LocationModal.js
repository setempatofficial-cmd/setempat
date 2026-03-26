"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "@/components/LocationProvider";

export default function LocationModal({ 
  isOpen, onClose, onSelectManual, onActivateGPS, 
  isUsingCustomLocation, customLocationName 
}) {
  const { sapaan } = useLocation();
  const [search, setSearch] = useState({ query: "", results: [], loading: false });
  const [status, setStatus] = useState({ loading: false, success: false, msg: "" });

  const isMalam = sapaan === "Malam";

  // Reset state saat modal dibuka
  useEffect(() => {
    if (isOpen) {
      setSearch({ query: "", results: [], loading: false });
      setStatus({ loading: false, success: false, msg: "" });
    }
  }, [isOpen]);

  // Debounce Search Logic
  useEffect(() => {
    if (search.query.length < 3) return;
    const timer = setTimeout(async () => {
      setSearch(prev => ({ ...prev, loading: true }));
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${search.query}&countrycodes=id&limit=4`);
        const data = await res.json();
        setSearch(prev => ({ ...prev, results: data, loading: false }));
      } catch { setSearch(prev => ({ ...prev, loading: false })); }
    }, 500);
    return () => clearTimeout(timer);
  }, [search.query]);

  const handleAction = async (type, data = null) => {
    setStatus({ loading: true, success: false, msg: "Memproses..." });
    try {
      if (type === 'gps') {
        await onActivateGPS();
        setStatus({ loading: false, success: true, msg: "GPS Terhubung!" });
      } else if (type === 'manual') {
        await onSelectManual(data);
        setStatus({ loading: false, success: true, msg: `Lokasi: ${data.name}` });
      } else {
        await onSelectManual(null);
        setStatus({ loading: false, success: true, msg: "Radius Dimatikan" });
      }
      setTimeout(onClose, 1200);
    } catch {
      setStatus({ loading: false, success: false, msg: "Gagal, coba lagi." });
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
        {/* Overlay */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-950/40 backdrop-blur-md" />

        <motion.div 
          initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
          className={`relative w-full max-w-sm rounded-t-[40px] sm:rounded-[40px] p-8 overflow-hidden shadow-2xl ${isMalam ? "bg-slate-900 text-white" : "bg-white text-slate-900"}`}
        >
          {/* Green Success Shield */}
          <AnimatePresence>
            {status.success && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-emerald-500 text-white">
                <span className="text-5xl mb-3">✨</span>
                <p className="font-black uppercase tracking-tighter text-xl">{status.msg}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="w-12 h-1.5 bg-slate-500/20 rounded-full mx-auto mb-8" />

          {/* Header & Status Aktif */}
          <div className="mb-8">
            <h2 className="text-[28px] font-black tracking-tighter leading-none mb-3">Radius <span className="text-orange-500">Aktif</span></h2>
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border ${isMalam ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-100"}`}>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <p className="text-[11px] font-black uppercase tracking-widest opacity-70">
                {isUsingCustomLocation ? customLocationName : "Sesuai GPS Anda"}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-4">
            <button onClick={() => handleAction('gps')} className="w-full py-5 bg-slate-950 text-white dark:bg-white dark:text-slate-950 rounded-[24px] font-black text-sm uppercase tracking-widest shadow-xl active:scale-95 transition-all">
              📍 Update via GPS
            </button>

            <div className="relative group">
              <input 
                type="text" placeholder="Ganti Lokasi Manual..."
                className={`w-full p-5 rounded-[24px] text-sm font-bold border-2 transition-all outline-none ${isMalam ? "bg-slate-800 border-slate-700 focus:border-orange-500" : "bg-slate-50 border-slate-100 focus:border-orange-500"}`}
                value={search.query} onChange={(e) => setSearch({ ...search, query: e.target.value })}
              />
              {search.loading && <div className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />}
              
              {/* Search Results Dropdown */}
              <AnimatePresence>
                {search.results.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`absolute left-0 right-0 mt-2 p-2 rounded-3xl border shadow-2xl z-10 ${isMalam ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100"}`}>
                    {search.results.map((res, i) => (
                      <button key={i} onClick={() => handleAction('manual', { latitude: parseFloat(res.lat), longitude: parseFloat(res.lon), name: res.display_name.split(",")[0] })} className="w-full text-left p-4 hover:bg-orange-500/10 rounded-2xl transition-colors">
                        <p className="text-sm font-bold truncate">{res.display_name.split(",")[0]}</p>
                        <p className="text-[10px] opacity-40 truncate">{res.display_name}</p>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Privacy Tooltip */}
          <div className={`mt-8 p-4 rounded-3xl flex items-start gap-3 ${isMalam ? "bg-slate-800/50" : "bg-orange-50/50"}`}>
            <span className="text-lg">🛡️</span>
            <p className="text-[10px] font-bold leading-relaxed opacity-60">
              <span className="block text-slate-900 dark:text-white mb-0.5 uppercase tracking-tighter">Privasi Aman</span>
              Lokasi hanya digunakan untuk menyaring suasana di sekitar Anda. Data tidak disimpan permanen di server kami.
            </p>
          </div>

          {/* Footer Actions */}
          <div className="mt-8 flex items-center justify-between px-2">
            <button onClick={onClose} className="text-[11px] font-black uppercase tracking-widest opacity-30 hover:opacity-100 transition-opacity">Nanti Saja</button>
            <button 
              onClick={() => handleAction('reset')}
              className="px-5 py-2.5 bg-red-500/10 text-red-500 rounded-full text-[11px] font-black uppercase tracking-tight hover:bg-red-500/20 transition-all"
            >
              Nonaktifkan Lokasi
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}