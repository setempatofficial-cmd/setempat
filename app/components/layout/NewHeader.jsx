"use client";

import { useEffect } from "react";
import { useSearch } from "../../hooks/useSearch";
import { useRouter } from 'next/navigation';

export default function Header({
  locationReady,
  displayLocation,
  isScrolled,
  greeting,
  momentText,
  onToggleLocation,
  onRequestLocation,
  statsTitikRamai = 0,
  statsTitikDekat = 0,
  // Props baru untuk menghubungkan ke FeedContent
  onSearchResults,
  onSearchLoading,
  onQueryChange
}) {
  const { query, setQuery, results, isLoading } = useSearch(locationReady, displayLocation);
  const router = useRouter();

  // Sinkronisasi data pencarian ke FeedContent setiap kali ada perubahan
  useEffect(() => {
    if (onSearchResults) onSearchResults(results);
    if (onSearchLoading) onSearchLoading(isLoading);
    if (onQueryChange) onQueryChange(query);
  }, [results, isLoading, query, onSearchResults, onSearchLoading, onQueryChange]);

  return (
    <header className={`sticky top-0 z-30 transition-all duration-300 ${
      isScrolled ? "bg-white/90 backdrop-blur-xl shadow-sm" : "bg-white/80 backdrop-blur-md"
    } border-b border-gray-100/50`}>
      
      {/* Baris 1: Logo + Brand + Lokasi + Toggle */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          {/* LOGO */}
          <div className="w-9 h-9 bg-gradient-to-br from-[#E3655B] to-[#FF7A70] rounded-xl flex items-center justify-center shadow-sm">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>

          {/* BRAND + LOKASI */}
          <div>
            <h1 className="text-base font-bold text-gray-900 tracking-tight">
              Setempat<span className="text-[#E3655B]">ID</span>
            </h1>
            {locationReady && displayLocation ? (
              <p className="text-[10px] font-medium text-gray-500 flex items-center gap-1">
                <span className="text-[#E3655B]">●</span>
                <span>{displayLocation}</span>
                <span className="text-gray-300">|</span>
                <span>
                  {new Date().getHours() >= 4 && new Date().getHours() < 18 ? "🌤️" : "🌙"} 29°
                </span>
              </p>
            ) : (
              <p className="text-[10px] text-gray-400 font-medium tracking-tight">Aktifkan lokasi untuk info sekitar</p>
            )}
          </div>
        </div>

        {/* Toggle Lokasi & Notif */}
        <div className="flex items-center gap-2">
          <button
            onClick={locationReady ? onToggleLocation : onRequestLocation}
            className={`relative w-14 h-7 rounded-full transition-all duration-300 active:scale-95 overflow-hidden ${
              locationReady
                ? "bg-gradient-to-r from-[#E3655B] to-[#FF7A70] shadow-md"
                : "bg-gray-200 border border-gray-300"
            }`}
          >
            {locationReady && <span className="absolute inset-0 bg-white/20 opacity-30 blur-sm animate-pulse"></span>}
            <span className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 ${locationReady ? "translate-x-7" : "translate-x-0"}`} />
            <span className={`absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold transition-opacity duration-200 ${locationReady ? "opacity-100 text-white" : "opacity-0"}`}>ON</span>
            <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold transition-opacity duration-200 ${locationReady ? "opacity-0" : "opacity-100 text-gray-500"}`}>OFF</span>
          </button>

          <button className="relative w-9 h-9 flex items-center justify-center bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-lg">🔔</span>
            {locationReady && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#E3655B] border-2 border-white animate-pulse text-white text-[8px] font-black rounded-full flex items-center justify-center">3</span>
            )}
          </button>
        </div>
      </div>

      {/* Search Bar Section */}
      <div className="px-4 pb-4 relative">
        <div className="relative group">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              locationReady && displayLocation
                ? `Cari suasana di ${displayLocation}...`
                : "Cari suasana sejuk, kopi, atau ramai..."
            }
            className="w-full bg-gray-100/80 border border-transparent focus:border-[#E3655B]/30 rounded-2xl py-3.5 pl-12 pr-4 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-[#E3655B]/5 focus:bg-white transition-all shadow-inner"
          />
          <div className="absolute left-4 top-4 text-gray-400 group-focus-within:text-[#E3655B] transition-colors">
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-[#E3655B] border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}