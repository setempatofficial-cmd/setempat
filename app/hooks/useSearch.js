"use client";
import { useState, useEffect } from 'react';
import { supabase } from "@/lib/supabaseClient"; 

export function useSearch(locationReady, displayLocation) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Trim query untuk menghapus spasi di awal/akhir yang tidak sengaja
    const searchQuery = query.trim();

    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('feed_view')
          .select('*')
          // Menggunakan 'kategori' sesuai kolom di database kamu
          .or(`name.ilike.%${searchQuery}%,kategori.ilike.%${searchQuery}%,alamat.ilike.%${searchQuery}%`)
          .limit(10);

        if (error) throw error;
        setResults(data || []);
      } catch (error) {
        console.error("Search Error:", error.message);
      } finally {
        setIsLoading(false);
      }
    }, 400); 

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  return { query, setQuery, results, isLoading };
}