"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function LocationModal({
  isOpen,
  onClose,
  onSelectManual,
  onActivateGPS,
  onSelectGeneral,
  onSelectUnlimited,
  isUsingCustomLocation,
  customLocationName,
  currentLocationName = "Seluruh Indonesia",
  onLocationChange
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [panel, setPanel] = useState("menu");
  const [processInfo, setProcessInfo] = useState({ icon: "📍", title: "", desc: "" });
  const [showGPSOption, setShowGPSOption] = useState(false);

  const debounceTimer = useRef(null);
  const abortControllerRef = useRef(null);
  const inputRef = useRef(null); // ✅ REF untuk input pencarian

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setResults([]);
      setIsSearching(false);
      setHasSearched(false);
      setPanel("menu");
      setShowGPSOption(false);

      // ✅ FOKUS LANGSUNG KE INPUT setelah modal terbuka
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100); // Delay kecil untuk memastikan modal sudah ter-render
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

    let resultData = null;

    if (mode === 'gps') {
      setProcessInfo({
        icon: "📍",
        title: "Mendeteksi Lokasi",
        desc: "Mencari tempat terdekat dari posisi Anda..."
      });
    } else if (mode === 'manual') {
      setProcessInfo({
        icon: "🏠",
        title: data.display_name.split(",")[0],
        desc: `Menampilkan tempat terdekat dari ${data.display_name.split(",")[0]}...`
      });
    } else if (mode === 'general') {
      setProcessInfo({
        icon: "🏘️",
        title: "Area Sekitar",
        desc: "Menampilkan semua tempat di sekitar wilayah Anda..."
      });
    } else if (mode === 'unlimited') {
      setProcessInfo({
        icon: "🌏",
        title: "Semua Tempat",
        desc: "Menampilkan seluruh tempat tanpa batasan jarak..."
      });
    }

    try {
      if (mode === 'gps') {
        resultData = await onActivateGPS();
      } else if (mode === 'general') {
        if (onSelectGeneral) {
          resultData = await onSelectGeneral();
        } else {
          resultData = await onActivateGPS();
        }
      } else if (mode === 'unlimited') {
        if (onSelectUnlimited) {
          resultData = await onSelectUnlimited();
        } else {
          resultData = await onSelectManual(null);
        }
      } else if (mode === 'manual') {
        resultData = await onSelectManual({
          latitude: data.lat,
          longitude: data.lon,
          name: data.display_name.split(",")[0],
          display_name: data.display_name
        });
      }

      setPanel("success");
      setProcessInfo(prev => ({ ...prev, icon: "✅", title: "Berhasil!", desc: "Feed akan diperbarui..." }));

      setTimeout(() => {
        onClose();

        if (onLocationChange) {
          onLocationChange(resultData);
        }

        window.dispatchEvent(new CustomEvent('locationChanged', {
          detail: { location: resultData, mode }
        }));
      }, 800);

    } catch (err) {
      console.error(err);
      setPanel("menu");
      alert("Gagal memperbarui lokasi, silakan coba lagi.");
    }
  };

  // ✅ CEK APAKAH MODAL TERBUKA dan BUKAN LOADING
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

                {/* Indikator lokasi saat ini */}
                <div className="mb-4 p-3 bg-orange-50 rounded-xl">
                  <p className="text-[10px] font-black uppercase tracking-wider text-orange-600 mb-1">
                    LOKASI SAAT INI
                  </p>
                  <p className="font-bold text-slate-800 text-sm">
                    {isUsingCustomLocation && customLocationName
                      ? customLocationName
                      : currentLocationName}
                  </p>
                </div>

                <div className="mb-5">
                  <h2 className="text-xl font-black tracking-tight text-slate-900">
                    Pilih <span className="text-orange-500">Lokasi</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Temukan tempat terdekat dari lokasi pilihan Anda
                  </p>
                </div>

                {/* PRIORITAS 1: MANUAL SEARCH - dengan auto focus */}
                <div className="mb-4">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2 block">
                    🔍 Cari Desa / Kecamatan
                  </label>
                  <div className="relative">
                    <input
                      ref={inputRef} // ✅ REF untuk auto-focus
                      type="text"
                      placeholder="Ketik nama desa atau kecamatan..."
                      className="w-full p-3 pr-10 rounded-xl bg-white border-2 border-slate-200 focus:border-orange-400 focus:bg-orange-50/10 transition-all text-sm font-medium outline-none text-slate-800"
                      value={query}
                      onChange={handleSearchChange}
                      autoFocus // ✅ AUTO-FOCUS bawaan React
                      onBlur={(e) => {
                        // ✅ CEK: Jangan hilang fokus jika klik di area hasil pencarian
                        const relatedTarget = e.relatedTarget;
                        if (relatedTarget && relatedTarget.closest('.search-results-container')) {
                          e.preventDefault();
                          inputRef.current?.focus();
                        }
                      }}
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
                    <div className="search-results-container mt-2 max-h-48 overflow-y-auto bg-slate-50 rounded-xl border border-slate-200 p-1">
                      {isSearching ? (
                        <div className="p-3 text-center text-xs font-medium text-slate-400 animate-pulse">
                          Mencari...
                        </div>
                      ) : results.length > 0 ? (
                        results.map((res, i) => (
                          <button
                            key={i}
                            onClick={() => handleSelection('manual', res)}
                            className="w-full text-left p-2.5 hover:bg-white hover:shadow-sm rounded-lg transition-all flex items-center justify-between text-sm text-slate-700"
                            onMouseDown={(e) => {
                              // ✅ CEK: Prevent blur saat klik button hasil pencarian
                              e.preventDefault();
                            }}
                          >
                            <span className="truncate pr-2">{res.display_name}</span>
                            <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-orange-100 text-orange-600 flex-shrink-0">
                              Pilih
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="p-3 text-center text-xs font-medium text-slate-400">
                          Lokasi tidak ditemukan
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* PRIORITAS 2: OPSI CEPAT TANPA IZIN */}
                <div className="space-y-2 mb-3">
                  <button
                    onClick={() => handleSelection('general')}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50 font-medium text-sm text-slate-700 hover:bg-slate-100 transition-all text-left"
                  >
                    <span>🏘️ Area Sekitar Saya</span>
                    <span className="text-slate-400 text-xs">→</span>
                  </button>

                  <button
                    onClick={() => handleSelection('unlimited')}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50 font-medium text-sm text-slate-700 hover:bg-slate-100 transition-all text-left"
                  >
                    <span>🌏 Semua Tempat</span>
                    <span className="text-slate-400 text-xs">→</span>
                  </button>
                </div>

                {/* PRIORITAS 3: GPS - DISEMBUNYIKAN */}
                <div className="border-t border-slate-100 pt-3">
                  <button
                    onClick={() => setShowGPSOption(!showGPSOption)}
                    className="w-full text-center text-xs text-slate-400 py-1 hover:text-slate-600 transition-colors"
                  >
                    {showGPSOption ? "▲ Sembunyikan" : "▼ Opsi deteksi otomatis (butuh izin)"}
                  </button>

                  {showGPSOption && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-2"
                    >
                      <button
                        onClick={() => handleSelection('gps')}
                        className="w-full flex items-center justify-between p-3 rounded-xl border border-orange-200 bg-orange-50/50 font-medium text-sm text-orange-700 hover:bg-orange-50 transition-all text-left"
                      >
                        <span>📍 Gunakan Lokasi Perangkat Saya</span>
                        <span className="text-orange-400 text-xs">GPS</span>
                      </button>
                      <p className="text-[10px] text-slate-400 mt-2 text-center">
                        ⚠️ Memerlukan izin akses lokasi browser
                      </p>
                    </motion.div>
                  )}
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-full mt-4 text-slate-400 text-[11px] font-medium uppercase tracking-wider text-center hover:text-slate-600 transition-colors"
              >
                Tutup
              </button>
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
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight mb-1">
                    {processInfo.title}
                  </h3>
                  <p className="text-xs text-slate-400 max-w-[80%] mx-auto leading-relaxed">
                    {processInfo.desc}
                  </p>
                </div>
              ) : (
                <div className="animate-scaleIn flex flex-col items-center">
                  <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center text-3xl mb-4 shadow-lg shadow-emerald-500/20">
                    ✓
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight mb-1">
                    {processInfo.title}
                  </h3>
                  <p className="text-xs text-emerald-600 font-medium">
                    Memperbarui feed...
                  </p>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}