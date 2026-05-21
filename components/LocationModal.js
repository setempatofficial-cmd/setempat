"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function LocationModal({
  isOpen,
  onClose,
  onSelectManual,
  onActivateGPS,
  isUsingCustomLocation,
  customLocationName
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [panel, setPanel] = useState("menu");
  const [processInfo, setProcessInfo] = useState({ icon: "📍", title: "", desc: "" });

  const debounceTimer = useRef(null);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setResults([]);
      setIsSearching(false);
      setHasSearched(false);
      setPanel("menu");
    }
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [isOpen]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setQuery(value);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (value.trim().length < 3) {
      setResults([]);
      setIsSearching(false);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    debounceTimer.current = setTimeout(async () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();

      try {
        const res = await fetch(`/api/wilayah/search?q=${encodeURIComponent(value.trim())}`, {
          signal: abortControllerRef.current.signal
        });
        const json = await res.json();
        if (json.success) setResults(json.data || []);
      } catch (err) {
        if (err.name !== 'AbortError') setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 400);
  };

  const handleSelection = async (mode, data = null) => {
    setPanel("loading");

    if (mode === 'gps') {
      setProcessInfo({ icon: "📡", title: "Mencari Satelit GPS", desc: "Menghitung koordinat presisi perangkat Anda..." });
    } else if (mode === 'manual') {
      setProcessInfo({ icon: "📍", title: "Mengunci Wilayah", desc: `Menyiapkan konten untuk ${data.display_name.split(",")[0]}...` });
    } else if (mode === 'general') {
      setProcessInfo({ icon: "🏙️", title: "Area Umum", desc: "Mengembalikan cakupan ke area default..." });
    } else if (mode === 'off') {
      setProcessInfo({ icon: "🔒", title: "Menyembunyikan Radius", desc: "Menampilkan semua konten dari seluruh Indonesia..." });
    }

    try {
      if (mode === 'gps' || mode === 'general') {
        await onActivateGPS(mode);
      } else if (mode === 'off') {
        await onSelectManual(null);
      } else if (mode === 'manual') {
        await onSelectManual({
          latitude: data.lat,
          longitude: data.lon,
          name: data.display_name.split(",")[0],
          display_name: data.display_name
        });
      }

      setPanel("success");
      setProcessInfo(prev => ({ ...prev, icon: "✨", title: "Lokasi Diterapkan!" }));

      setTimeout(() => {
        onClose();
        window.location.reload();
      }, 800);

    } catch (err) {
      console.error(err);
      setPanel("menu");
      alert("Gagal memperbarui lokasi, silakan coba lagi.");
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={panel === "loading" ? null : onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-[3px]"
        />

        <motion.div
          initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 26, stiffness: 260 }}
          className="relative w-full max-w-sm bg-white rounded-t-[32px] sm:rounded-[32px] p-6 pb-8 shadow-2xl overflow-hidden text-slate-800 min-h-[420px] max-h-[90vh] flex flex-col justify-between"
        >
          {panel === "menu" && (
            <div className="flex flex-col h-full justify-between flex-1">
              <div>
                <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-6" />

                <div className="mb-5">
                  <h2 className="text-xl font-black tracking-tight text-slate-900">Atur <span className="text-orange-500">Jangkauan</span></h2>
                  <p className="text-xs text-slate-400 mt-0.5">Tentukan konten sekitar lokasi Anda.</p>
                </div>

                <div className="space-y-2">
                  <button onClick={() => handleSelection('off')} className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 font-bold text-sm text-slate-700 hover:border-slate-200 transition-all text-left">
                    <span>🔒 Sembunyikan Radius</span>
                    <span className="text-slate-300">→</span>
                  </button>
                  <button onClick={() => handleSelection('general')} className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 font-bold text-sm text-slate-700 hover:border-slate-200 transition-all text-left">
                    <span>🏙️ Tampilkan Area Umum</span>
                    <span className="text-slate-300">→</span>
                  </button>
                  <button onClick={() => handleSelection('gps')} className="w-full flex items-center justify-between p-3.5 rounded-xl border border-orange-100 bg-orange-50/30 font-black text-sm text-orange-600 hover:bg-orange-50 transition-all text-left">
                    <span>⚡ Gunakan Lokasi GPS Saya</span>
                    <span>🛰️</span>
                  </button>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Cari Alamat Manual</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Ketik desa atau kecamatan..."
                      className="w-full p-3 pr-10 rounded-xl bg-slate-50 border border-slate-200 focus:border-orange-400 transition-all text-sm font-bold outline-none text-slate-800"
                      value={query}
                      onChange={handleSearchChange}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {isSearching ? (
                        <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span className="text-slate-400 text-sm">🔍</span>
                      )}
                    </div>
                  </div>

                  {hasSearched && (
                    <div className="mt-2 max-h-40 overflow-y-auto bg-slate-50 rounded-xl border border-slate-200 p-1 shadow-inner">
                      {isSearching ? (
                        <div className="p-3 text-center text-xs font-bold text-slate-400 animate-pulse">Mencari...</div>
                      ) : results.length > 0 ? (
                        results.map((res, i) => (
                          <button
                            key={i}
                            onClick={() => handleSelection('manual', res)}
                            className="w-full text-left p-2.5 hover:bg-white hover:shadow-sm rounded-lg transition-all flex items-center justify-between font-bold text-xs text-slate-700"
                          >
                            <span className="truncate pr-2">{res.display_name}</span>
                            <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 flex-shrink-0">Pilih</span>
                          </button>
                        ))
                      ) : (
                        <div className="p-3 text-center text-xs font-bold text-slate-400">Lokasi tidak ditemukan</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <button onClick={onClose} className="w-full mt-5 text-slate-400 text-[11px] font-black uppercase tracking-wider text-center">Tutup</button>
            </div>
          )}

          {(panel === "loading" || panel === "success") && (
            <div className="absolute inset-0 z-50 bg-white flex flex-col items-center justify-center p-6 text-center">
              {panel === "loading" ? (
                <div className="animate-fadeIn flex flex-col items-center">
                  <div className="relative mb-5 flex items-center justify-center">
                    <div className="w-16 h-16 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin absolute" />
                    <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center text-2xl">
                      {processInfo.icon}
                    </div>
                  </div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight mb-1">{processInfo.title}</h3>
                  <p className="text-xs text-slate-400 max-w-[80%] mx-auto leading-relaxed animate-pulse">{processInfo.desc}</p>
                </div>
              ) : (
                <div className="animate-scaleIn flex flex-col items-center">
                  <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center text-3xl mb-4 shadow-lg shadow-emerald-500/20 animate-bounce">
                    ✓
                  </div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight mb-1">{processInfo.title}</h3>
                  <p className="text-xs text-emerald-600 font-bold tracking-wide uppercase">Sinkronisasi Halaman...</p>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}