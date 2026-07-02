"use client";

import { useState, useEffect, useRef } from "react";
import { Search, MapPin, X, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

// Cache sederhana
const searchCache = new Map();

export default function PilihLokasi({
  onSelect,
  initialValue = "",
  placeholder = "Cari lokasi...",
  className = ""
}) {
  const [query, setQuery] = useState(initialValue);
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const wrapperRef = useRef(null);
  const abortControllerRef = useRef(null);
  const debounceRef = useRef(null);

  // Click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Search locations - OPTIMIZED
  useEffect(() => {
    // Clear debounce sebelumnya
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const searchLocation = async () => {
      const trimmedQuery = query.trim();

      if (trimmedQuery.length < 2) {
        setResults([]);
        setShowResults(false);
        setIsSearching(false);
        return;
      }

      // ✅ Cek CACHE dulu
      if (searchCache.has(trimmedQuery)) {
        setResults(searchCache.get(trimmedQuery));
        setShowResults(true);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      setShowResults(true);

      // ✅ Abort request sebelumnya
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      try {
        // 1. Cari di database Supabase (Cepat!)
        const { data: dbResults, error: dbError } = await supabase
          .from("tempat")
          .select("id, name, category, alamat, latitude, longitude")
          .ilike("name", `%${trimmedQuery}%`)
          .limit(5);

        let allResults = [];

        if (!dbError && dbResults && dbResults.length > 0) {
          allResults = dbResults.map(r => ({
            ...r,
            source: 'database',
            label: '📌 Terdaftar'
          }));
        }

        // ✅ HANYA panggil Nominatim jika:
        // 1. Hasil database KURANG dari 2
        // 2. Query panjang >= 3 karakter
        if (dbResults.length < 2 && trimmedQuery.length >= 3) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);

            const response = await fetch(
              `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(trimmedQuery)}&limit=3&addressdetails=1&countrycodes=id`,
              { signal: controller.signal }
            );

            clearTimeout(timeoutId);

            if (response.ok) {
              const nomData = await response.json();
              const formattedNom = nomData.map(item => ({
                id: `nominatim_${item.place_id}`,
                name: item.display_name.split(',')[0],
                fullName: item.display_name,
                alamat: item.display_name,
                latitude: parseFloat(item.lat),
                longitude: parseFloat(item.lon),
                source: 'nominatim',
                label: '🗺️ Dari Peta'
              }));

              const existingNames = new Set(allResults.map(r => r.name.toLowerCase()));
              const uniqueNom = formattedNom.filter(n => !existingNames.has(n.name.toLowerCase()));
              allResults = [...allResults, ...uniqueNom];
            }
          } catch (nomError) {
            if (nomError.name !== 'AbortError') {
              console.error("Nominatim error:", nomError);
            }
          }
        }

        // ✅ Simpan ke cache
        searchCache.set(trimmedQuery, allResults);
        setResults(allResults);
      } catch (error) {
        console.error("Search error:", error);
        setResults([]);
      }

      setIsSearching(false);
    };

    // ✅ Debounce 800ms (lebih lama biar ga terlalu sering)
    debounceRef.current = setTimeout(searchLocation, 800);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  const handleSelect = (location) => {
    setSelected(location);
    setQuery(location.name);
    setResults([]);
    setShowResults(false);

    onSelect({
      id: location.id,
      name: location.name,
      alamat: location.alamat || location.fullName || location.name,
      latitude: location.latitude,
      longitude: location.longitude,
      source: location.source || 'database',
      category: location.category || 'lokasi'
    });
  };

  const handleClear = () => {
    setQuery("");
    setSelected(null);
    setResults([]);
    setShowResults(false);
    onSelect(null);
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      {/* Input */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setShowResults(true)}
          placeholder={placeholder}
          className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        )}
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 size={14} className="animate-spin text-emerald-400" />
          </div>
        )}
      </div>

      {/* Results Dropdown */}
      {showResults && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl max-h-[220px] overflow-y-auto">
          {results.map((loc) => (
            <button
              key={loc.id}
              onClick={() => handleSelect(loc)}
              className="w-full p-3 text-left hover:bg-slate-700 transition-colors flex items-start gap-3 border-b border-slate-700/50 last:border-0"
            >
              <MapPin size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium truncate">{loc.name}</p>
                {loc.alamat && (
                  <p className="text-[10px] text-slate-400 truncate">{loc.alamat}</p>
                )}
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[8px] text-slate-500">{loc.label || '📍 Lokasi'}</span>
                  {loc.latitude && loc.longitude && (
                    <span className="text-[8px] text-slate-600">
                      {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Selected Location Display */}
      {selected && !showResults && (
        <div className="mt-2 p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <MapPin size={14} className="text-emerald-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm text-white font-medium truncate">{selected.name}</p>
              {selected.latitude && selected.longitude && (
                <p className="text-[8px] text-slate-400">
                  {selected.latitude.toFixed(4)}, {selected.longitude.toFixed(4)}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleClear}
            className="text-slate-400 hover:text-rose-400 transition-colors flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}