"use client";

import { useState, useCallback, useRef, useEffect } from 'react';

export function useSearch(locationReady, villageLocation) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const debounceTimerRef = useRef(null);

  // Effect untuk pencarian dengan debounce
  useEffect(() => {
    const searchQuery = typeof query === 'string' ? query.trim() : '';
    
    // Hanya search jika query >= 2 karakter
    if (searchQuery.length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    // Clear timer sebelumnya
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setIsLoading(true);

    // Simulasi pencarian
    debounceTimerRef.current = setTimeout(() => {
      setResults([]);
      setIsLoading(false);
    }, 400);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    setTimeout(() => {
      setIsFocused(false);
    }, 200);
  }, []);

  const resetSearch = useCallback(() => {
    setQuery('');
    setResults([]);
  }, []);

  return {
    query,
    setQuery,
    results,
    isLoading,
    isFocused,
    handleFocus,
    handleBlur,
    resetSearch,
  };
}