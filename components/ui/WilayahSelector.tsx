"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Search, MapPin, Loader2, Check, ChevronDown } from "lucide-react";

interface Wilayah {
  kode: string;
  nama: string;
  kecamatan: string | null;
  kabupaten: string | null;
  provinsi: string | null;
  lat: number | null;
  lon: number | null;
  level: string;
}

interface WilayahSelectorProps {
  value: {
    provinsi?: string;
    kabupaten?: string;
    kecamatan?: string;
    desa?: string;
  };
  onChange: (value: any) => void;
  disabled?: boolean;
  showLevel?: ('provinsi' | 'kabupaten' | 'kecamatan' | 'desa')[];
}

export default function WilayahSelector({
  value,
  onChange,
  disabled = false,
  showLevel = ['provinsi', 'kabupaten', 'kecamatan', 'desa']
}: WilayahSelectorProps) {
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Wilayah[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedWilayah, setSelectedWilayah] = useState<Wilayah | null>(null);

  // 🔥 Cari wilayah dari database
  const searchWilayah = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("wilayah")
        .select("*")
        .or(`nama.ilike.%${query}%,kecamatan.ilike.%${query}%,kabupaten.ilike.%${query}%,provinsi.ilike.%${query}%`)
        .order("level", { ascending: true })
        .limit(20);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (err) {
      console.error("Error searching wilayah:", err);
      // Fallback ke Nominatim jika database gagal
      await searchNominatim(query);
    } finally {
      setLoading(false);
    }
  }, []);

  // 🔥 Fallback: Cari dari Nominatim (OpenStreetMap)
  const searchNominatim = useCallback(async (query: string) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&countrycodes=id&limit=10`
      );
      const data = await response.json();
      
      const mappedResults = data.map((item: any) => ({
        kode: item.osm_id,
        nama: item.display_name.split(',')[0],
        kecamatan: item.address?.suburb || item.address?.city_district || null,
        kabupaten: item.address?.city || item.address?.county || null,
        provinsi: item.address?.state || null,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        level: item.type === 'village' ? 'desa' : 
               item.type === 'city' ? 'kabupaten' : 'kecamatan'
      }));
      
      setSearchResults(mappedResults);
    } catch (err) {
      console.error("Nominatim error:", err);
      setSearchResults([]);
    }
  }, []);

  // 🔥 Pilih wilayah
  const handleSelect = (wilayah: Wilayah) => {
    setSelectedWilayah(wilayah);
    setSearchQuery(wilayah.nama);
    setShowDropdown(false);
    
    onChange({
      provinsi: wilayah.provinsi || undefined,
      kabupaten: wilayah.kabupaten || undefined,
      kecamatan: wilayah.kecamatan || undefined,
      desa: wilayah.nama || undefined,
      lat: wilayah.lat || undefined,
      lon: wilayah.lon || undefined,
      kode: wilayah.kode
    });
  };

  // 🔥 Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2) {
        searchWilayah(searchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchWilayah]);

  return (
    <div className="relative">
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2">
          <MapPin size={16} className="text-slate-400" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          placeholder="Cari provinsi, kabupaten, kecamatan, atau desa..."
          disabled={disabled}
          className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-10 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-purple-500"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 size={16} className="animate-spin text-purple-400" />
          </div>
        )}
        {searchQuery && !loading && (
          <button
            onClick={() => {
              setSearchQuery("");
              setSearchResults([]);
              setSelectedWilayah(null);
              onChange({});
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
          >
            ✕
          </button>
        )}
      </div>

      {/* Dropdown Results */}
      {showDropdown && searchQuery.length >= 2 && (
        <div className="absolute z-50 mt-1 w-full bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-slate-400 text-sm">
              <Loader2 size={16} className="animate-spin mx-auto mb-2" />
              Mencari...
            </div>
          ) : searchResults.length === 0 ? (
            <div className="p-4 text-center text-slate-400 text-sm">
              Tidak ditemukan. Coba kata kunci lain.
            </div>
          ) : (
            searchResults.map((wilayah) => (
              <button
                key={wilayah.kode}
                onClick={() => handleSelect(wilayah)}
                className="w-full p-3 text-left hover:bg-slate-800 transition-all border-b border-slate-800 last:border-0 flex items-start gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">
                    {wilayah.nama}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {wilayah.kecamatan && `${wilayah.kecamatan}, `}
                    {wilayah.kabupaten && `${wilayah.kabupaten}, `}
                    {wilayah.provinsi && wilayah.provinsi}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold
                    ${wilayah.level === 'desa' ? 'bg-emerald-500/20 text-emerald-400' :
                      wilayah.level === 'kecamatan' ? 'bg-blue-500/20 text-blue-400' :
                      wilayah.level === 'kabupaten' ? 'bg-purple-500/20 text-purple-400' :
                      'bg-amber-500/20 text-amber-400'}`}
                  >
                    {wilayah.level}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* Selected Wilayah Display */}
      {selectedWilayah && (
        <div className="mt-2 p-2 bg-purple-500/10 border border-purple-500/20 rounded-lg flex items-center gap-2">
          <Check size={14} className="text-purple-400" />
          <span className="text-sm text-white">
            {selectedWilayah.nama}
          </span>
          {selectedWilayah.kecamatan && (
            <span className="text-xs text-slate-400">
              • {selectedWilayah.kecamatan}
            </span>
          )}
          {selectedWilayah.kabupaten && (
            <span className="text-xs text-slate-400">
              • {selectedWilayah.kabupaten}
            </span>
          )}
        </div>
      )}
    </div>
  );
}