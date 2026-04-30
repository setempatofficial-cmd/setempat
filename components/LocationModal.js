"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function LocationModal({ 
  isOpen, onClose, onSelectManual, onActivateGPS, 
  isUsingCustomLocation, customLocationName 
}) {
  const [search, setSearch] = useState({ query: "", results: [], loading: false });
  const [status, setStatus] = useState({ loading: false, success: false, msg: "" });
  const [currentMode, setCurrentMode] = useState("");

  useEffect(() => {
    if (isOpen) {
      setSearch({ query: "", results: [], loading: false });
      setStatus({ loading: false, success: false, msg: "" });
      setCurrentMode("");
    }
  }, [isOpen]);

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

  const handleSelection = async (mode, data = null) => {
    setCurrentMode(mode);
    setStatus({ loading: true, success: false, msg: "Menyimpan..." });
    
    try {
      if (mode === 'gps' || mode === 'general') {
        await onActivateGPS(mode); // ✅ PERBAIKAN: pakai onActivateGPS
        setStatus({ loading: false, success: true, msg: mode === 'gps' ? "Radius 10Km Aktif" : "Area Umum Aktif" });
      } else if (mode === 'manual') {
        await onSelectManual(data);
        setStatus({ loading: false, success: true, msg: data.name });
      } else {
        await onSelectManual(null);
        setStatus({ loading: false, success: true, msg: "Radius Dimatikan" });
      }
      setTimeout(onClose, 1000);
    } catch {
      setStatus({ loading: false, success: false, msg: "Gagal memproses" });
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
          onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        />

        <motion.div 
          initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
          className="relative w-full max-w-sm bg-white rounded-t-[40px] sm:rounded-[40px] p-8 shadow-2xl overflow-hidden text-slate-800"
        >
          <AnimatePresence>
            {status.success && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-emerald-500 text-white text-center p-6">
                <div className="text-6xl mb-4">✅</div>
                <p className="font-black text-2xl tracking-tighter leading-none">{status.msg}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-8" />
          
          <h2 className="text-2xl font-black tracking-tighter mb-8 text-slate-900">Pilih <span className="text-orange-500">Radius Sekitar</span></h2>

          <div className="space-y-4 mb-10">
            <OptionItem title="Sembunyikan Radius" active={currentMode === 'off'} onClick={() => handleSelection('off')} />
            <OptionItem title="Tampilkan Area Umum" active={currentMode === 'general'} onClick={() => handleSelection('general')} />
            <OptionItem title="Aktifkan Radius Jarak" desc="Menampilkan Tempat di radius 10Km dari anda" active={currentMode === 'gps'} onClick={() => handleSelection('gps')} />
          </div>

          <div className="pt-6 border-t border-slate-100">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 block">Cari Manual</label>
            <div className="relative">
              <input 
                type="text" 
                placeholder="Ketik nama desa/kecamatan..."
                className={`w-full p-4 rounded-2xl bg-slate-50 border-2 transition-all text-sm font-bold outline-none ${currentMode === 'manual' ? 'border-orange-500 bg-white' : 'border-transparent focus:border-orange-500'}`}
                value={search.query} 
                onChange={(e) => setSearch({ ...search, query: e.target.value })}
              />
              {search.loading && <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />}
            </div>

            {search.results.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto space-y-1 bg-white rounded-2xl border border-slate-100 p-2 shadow-lg">
                {search.results.map((res, i) => (
                  <button 
                    key={i} 
                    onClick={() => handleSelection('manual', { latitude: parseFloat(res.lat), longitude: parseFloat(res.lon), name: res.display_name.split(",")[0] })} 
                    className="w-full text-left p-3 hover:bg-orange-50 rounded-xl transition-colors"
                  >
                    <p className="text-xs font-bold text-slate-700 truncate">{res.display_name}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <button onClick={onClose} className="w-full mt-8 text-slate-400 text-[10px] font-bold uppercase tracking-widest">Tutup</button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function OptionItem({ title, desc, active, onClick }) {
  return (
    <div onClick={onClick} className={`flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all border-2 ${active ? "border-orange-500 bg-orange-50" : "border-slate-50 bg-slate-50 hover:border-slate-200"}`}>
      <div className="flex-1">
        <p className={`text-sm font-black tracking-tight ${active ? "text-orange-600" : "text-slate-700"}`}>{title}</p>
        {desc && <p className="text-[10px] font-bold opacity-60 leading-tight mt-1">{desc}</p>}
      </div>
      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${active ? "border-orange-500 bg-white" : "border-slate-300"}`}>
        {active && <div className="w-3 h-3 rounded-full bg-orange-500 shadow-sm" />}
      </div>
    </div>
  );
}