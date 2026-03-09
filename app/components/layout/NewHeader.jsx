"use client";

import { useEffect } from "react";
import { useSearch } from "../../hooks/useSearch";
import { useRouter } from 'next/navigation';

export default function Header({
  locationReady,
  villageLocation,
  districtLocation,
  isScrolled,
  onOpenLocationModal,
  onSearchResults,
  onSearchLoading,
  onQueryChange
}) {
  const { query, setQuery, results, isLoading } = useSearch(locationReady, villageLocation);

  useEffect(() => {
    if (onSearchResults) onSearchResults(results);
    if (onSearchLoading) onSearchLoading(isLoading);
    if (onQueryChange) onQueryChange(query);
  }, [results, isLoading, query, onSearchResults, onSearchLoading, onQueryChange]);

  return (
    <header className={`sticky top-0 z-30 transition-all duration-500 ${
      isScrolled ? "bg-white/95 backdrop-blur-xl shadow-sm" : "bg-white/80 backdrop-blur-md"
    } border-b border-slate-100/50`}>
      
      <div className="flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-3">
          {/* Logo Setempat.id */}
          <div className="w-10 h-10 bg-[#E3655B] rounded-2xl flex items-center justify-center shadow-sm">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>

          {/* Area Lokasi */}
          <button 
            onClick={onOpenLocationModal}
            className="flex flex-col items-start active:scale-[0.98] transition-all text-left outline-none group"
          >
            <h1 className="text-[15px] font-bold text-slate-900 tracking-tight leading-none">
              Setempat<span className="text-[#E3655B]">ID</span>
            </h1>

            <div className="flex items-center gap-2 mt-1.5">
              {/* Indikator Status Kecil */}
              <span className={`w-1.5 h-1.5 rounded-full transition-colors duration-500 ${
                locationReady ? "bg-green-500 shadow-[0_0_3px_#22c55e]" : "bg-red-400"
              }`} />
              
              <p className="text-[11px] font-medium flex items-center gap-1 leading-none tracking-tight">
                {locationReady && villageLocation ? (
                  <span className="flex items-center gap-1">
                    <span className="text-slate-700">Aktif di {villageLocation}</span>
                    <span className="text-slate-300">|</span>
                    <span className="text-slate-400">{districtLocation}</span>
                  </span>
                ) : (
                  <span className="text-slate-400">Pilih lokasimu</span>
                )}
                
                {/* Panah Bawah: Gerak Lembut (Bounce-Slow) */}
                <svg 
                  className="w-2.5 h-2.5 ml-0.5 text-slate-300 animate-bounce group-hover:text-[#E3655B] transition-colors" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                  style={{ animationDuration: '2s' }} // Dibuat lebih lambat agar tidak norak
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                </svg>
              </p>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Toggle Modern */}
          <button
            onClick={onOpenLocationModal}
            className={`relative w-11 h-6 rounded-full transition-all duration-500 ${
              locationReady ? "bg-[#E3655B]" : "bg-slate-200"
            }`}
          >
            <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-500 ${
              locationReady ? "translate-x-5" : "translate-x-0"
            }`} />
          </button>

          {/* Notifikasi Bell */}
          <button className="relative w-10 h-10 flex items-center justify-center bg-slate-50/50 rounded-xl border border-slate-100">
            <span className="text-lg opacity-60">🔔</span>
            {locationReady && (
              <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-[#E3655B] rounded-full border border-white"></span>
            )}
          </button>
        </div>
      </div>

      {/* SEARCH BAR */}
      <div className="px-5 pb-4">
        <div className="relative group">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              locationReady && villageLocation
                ? `Cari Aktivitas terbaru di ${villageLocation}...`
                : "Aktifkan lokasi dan cari suasana di sekitarmu..."
            }
            className="w-full bg-slate-50 border border-slate-100 focus:border-[#E3655B]/10 rounded-xl py-3 pl-11 pr-4 text-[13px] font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:bg-white transition-all shadow-sm"
          />
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#E3655B] transition-colors">
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-[#E3655B] border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}