"use client";

import { useEffect } from "react";
import { useSearch } from "../../hooks/useSearch";

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

  const searchPlaceholder = locationReady && villageLocation
    ? `Cari di ${villageLocation}...`
    : "Pilih lokasi & cari suasana...";

  return (
    <header className={`sticky top-0 z-30 transition-all duration-500 ${
      isScrolled ? "bg-white/95 backdrop-blur-xl shadow-md" : "bg-white/80 backdrop-blur-md"
    } border-b border-slate-100/50`}>
      
      {/* BARIS UTAMA */}
      <div className="flex items-center gap-2 px-4 py-3 h-16">
        
        {/* LOGO & LOCATION TRIGGER */}
        <button 
          onClick={onOpenLocationModal}
          className={`flex items-center gap-2 flex-shrink-0 transition-all duration-500 rounded-xl active:scale-95 ${
            isScrolled ? "bg-slate-50 p-1 pr-2 border border-slate-100 shadow-sm" : ""
          }`}
        >
          <div className={`transition-all duration-500 ease-in-out flex-shrink-0 bg-[#E3655B] rounded-lg flex items-center justify-center shadow-md ${
            isScrolled ? "w-8 h-8" : "w-10 h-10"
          }`}>
            <svg className={`${isScrolled ? "w-5 h-5" : "w-6 h-6"} text-white transition-all duration-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>

          {isScrolled && (
            <div className="flex items-center gap-1 animate-in fade-in slide-in-from-left-2 duration-500">
               <span className={`w-1.5 h-1.5 rounded-full ${locationReady ? "bg-green-500 shadow-[0_0_3px_#22c55e]" : "bg-red-400"}`} />
               <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
               </svg>
            </div>
          )}
        </button>

        {/* CONTAINER DINAMIS */}
        <div className="relative flex-1 h-10 flex items-center min-w-0">
          {/* AREA BRANDING */}
          <button 
            onClick={onOpenLocationModal}
            className={`absolute inset-0 flex flex-col items-start transition-all duration-300 ease-in-out origin-left overflow-hidden ${
              isScrolled 
                ? "opacity-0 -translate-y-4 pointer-events-none w-0" 
                : "opacity-100 translate-y-0 w-auto"
            }`}
          >
            <h1 className="text-[16px] font-bold text-slate-900 tracking-tight leading-tight whitespace-nowrap">
              Setempat<span className="text-[#E3655B]">ID</span>
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5 w-full whitespace-nowrap">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${locationReady ? "bg-green-500 shadow-[0_0_3px_#22c55e]" : "bg-red-400"}`} />
              <p className="text-[11px] font-medium text-slate-500 truncate max-w-[110px]">
                {locationReady && villageLocation ? villageLocation : "Pilih lokasimu"}
              </p>
              <svg className="w-2.5 h-2.5 text-slate-400 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ animationDuration: '3s' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {/* SEARCH BAR (SCROLLED) */}
          <div className={`w-full transition-all duration-500 ease-out ${
            isScrolled 
              ? "opacity-100 translate-y-0 scale-100" 
              : "opacity-0 translate-y-8 scale-95 pointer-events-none"
          }`}>
            <div className="relative group">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2 pl-9 pr-4 text-[13px] font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:bg-white transition-all shadow-sm"
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#E3655B] transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* NOTIFIKASI BELL */}
        <div className="flex-shrink-0">
          <button className={`relative flex items-center justify-center transition-all duration-500 border border-slate-100 ${
            isScrolled ? "w-9 h-9 rounded-full bg-white shadow-sm" : "w-10 h-10 rounded-xl bg-slate-50/50"
          }`}>
            <span className={`${isScrolled ? "text-base" : "text-lg"} opacity-60`}>🔔</span>
            {locationReady && (
              <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-[#E3655B] rounded-full border border-white"></span>
            )}
          </button>
        </div>
      </div>

      {/* SEARCH BAR BAWAH: PERBAIKAN JITTER */}
      {/* Perubahan: Menggunakan max-height dan easing yang lebih smooth 
          agar tidak "memotong" konten secara kasar saat scroll.
      */}
      <div className={`px-5 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden ${
        isScrolled ? "max-h-0 opacity-0 pb-0" : "max-h-[80px] opacity-100 pb-4"
      }`}>
        <div className="relative group">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 pl-11 pr-4 text-[13px] font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:bg-white transition-all shadow-sm"
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