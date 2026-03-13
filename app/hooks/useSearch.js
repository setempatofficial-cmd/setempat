"use client";

import { useState, useEffect } from 'react';
import { supabase } from "@/lib/supabaseClient"; 

export function useSearch(locationReady, displayLocation) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // 1. Validasi Query: Hanya cari jika minimal 2 karakter
    const searchQuery = query.trim();
    if (searchQuery.length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    // 2. Debounce: Menunggu user selesai mengetik (400ms) sebelum tembak database
    const delayDebounceFn = setTimeout(async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('feed_view')
          .select('*')
          // Mencari di kolom nama, kategori (sesuaikan jika kolomnya 'category'), dan alamat
          .or(`name.ilike.%${searchQuery}%,category.ilike.%${searchQuery}%,alamat.ilike.%${searchQuery}%`)
          .limit(15); // Naikkan limit sedikit untuk pilihan lebih banyak

        if (error) throw error;
        setResults(data || []);
      } catch (error) {
        console.error("Search Error:", error.message);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 400); 

    // Cleanup function untuk membatalkan timer jika query berubah lagi sebelum 400ms
    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  return { query, setQuery, results, isLoading };
}