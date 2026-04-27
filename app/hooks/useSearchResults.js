"use client";

import { useState, useEffect } from 'react';
import { supabase } from "@/lib/supabaseClient";

export function useSearchResults(searchQuery) {
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const query = searchQuery?.trim();
    
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    
    const fetchResults = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const { data, error } = await supabase
          .from('feed_view')
          .select('*')
          .or(`name.ilike.%${query}%,category.ilike.%${query}%,alamat.ilike.%${query}%`)
          .limit(20)
          .abortSignal(controller.signal);

        if (error) throw error;
        setResults(data || []);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message);
          setResults([]);
        }
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchResults, 500);
    
    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [searchQuery]);

  return { results, isLoading, error };
}