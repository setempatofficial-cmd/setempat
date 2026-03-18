"use client";

import { useState, useEffect } from 'react';
import { supabase } from "@/lib/supabaseClient";

export function useSearch(locationReady, villageLocation) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Daftar rekomendasi kalimat untuk memancing user
  const rekomendasiKalimat = [
    `Suasana ngopi santai di ${villageLocation || 'Pasuruan'}`,
    "Tempat kerja dengan Wi-Fi kencang",
    "Kuliner legendaris yang tersembunyi",
    "Spot foto estetik buat akhir pekan",
    "Bengkel 24 jam terdekat",
    "Toko kelontong yang buka sampai malam"
  ];

  useEffect(() => {
    const searchQuery = query.trim();

    // Jangan munculkan hasil jika kurang dari 2 karakter
    if (searchQuery.length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();

    const fetchResults = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('feed_view')
          .select('*')
          .or(`name.ilike.%${searchQuery}%,category.ilike.%${searchQuery}%,alamat.ilike.%${searchQuery}%`)
          .limit(8)
          .abortSignal(controller.signal);

        if (error) throw error;
        setResults(data || []);
      } catch (err) {
        if (err.name !== 'AbortError') setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchResults, 400);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [query]);

  const selectRekomendasi = (kalimat) => {
    setQuery(kalimat);
    setIsFocused(false);
  };

  const handleFocus = () => setIsFocused(true);
  const handleBlur = () => {
    setTimeout(() => setIsFocused(false), 200);
  };

  return {
    query,
    setQuery,
    results,
    isLoading,
    isFocused,
    rekomendasiKalimat,
    handleFocus,
    handleBlur,
    selectRekomendasi,
    showDropdown: isFocused && (query.length > 0 || rekomendasiKalimat.length > 0)
  };
}