// hooks/useWeather.js
import { useState, useEffect, useRef, useCallback } from 'react';

// Mapping kode wilayah ke lokasi (contoh)
const LOCATION_CODES = {
  'Pasuruan': '35.14.01.1001',
  'Alun-Alun Pasuruan': '35.14.01.1002',
  'Pasar Besar': '35.14.01.1003',
  'default': '35.14.01.1001'
};

// Mapping icon cuaca
const WEATHER_ICONS = {
  'Cerah': '☀️',
  'Cerah Berawan': '⛅',
  'Berawan': '☁️',
  'Berawan Tebal': '☁️☁️',
  'Hujan Ringan': '🌧️',
  'Hujan Sedang': '🌧️🌧️',
  'Hujan Lebat': '⛈️',
  'Hujan Petir': '⚡🌧️',
  'Kabut': '🌫️',
};

// Mapping deskripsi cuaca singkat
const WEATHER_SHORT = {
  'Cerah': 'Cerah',
  'Cerah Berawan': 'Berawan',
  'Berawan': 'Berawan',
  'Berawan Tebal': 'Mendung',
  'Hujan Ringan': 'Hujan',
  'Hujan Sedang': 'Hujan',
  'Hujan Lebat': 'Hujan Lebat',
  'Hujan Petir': 'Petir',
  'Kabut': 'Kabut',
};

// 🔥 Data fallback yang lebih variatif
const FALLBACK_WEATHER = {
  temp: 28,
  condition: 'Cerah Berawan',
  humidity: 75,
  windSpeed: 12,
  icon: '⛅',
  short: 'Berawan'
};

// 🔥 Cache untuk menghindari request berulang
const weatherCache = new Map();

export function useWeather(locationName) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // 🔥 Gunakan ref untuk tracking mounted state
  const isMounted = useRef(true);
  const abortControllerRef = useRef(null);
  const timeoutIdRef = useRef(null);
  const intervalIdRef = useRef(null);

  // 🔥 Bersihkan semua saat unmount
  useEffect(() => {
    isMounted.current = true;
    
    return () => {
      isMounted.current = false;
      // Bersihkan semua pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
      }
    };
  }, []);

  // 🔥 Fungsi fetch dengan cache dan retry logic
  const fetchWeather = useCallback(async () => {
    if (!locationName || !isMounted.current) return;

    setLoading(true);
    setError(null);

    // Cek cache dulu
    const cacheKey = `weather_${locationName}`;
    const cached = weatherCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      setWeather(cached.data);
      setLoading(false);
      return;
    }

    try {
      // Dapatkan kode wilayah
      const kodeWilayah = LOCATION_CODES[locationName] || LOCATION_CODES.default;

      // 🔥 Setup AbortController baru
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      // 🔥 Setup timeout
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
      timeoutIdRef.current = setTimeout(() => {
        if (abortControllerRef.current && isMounted.current) {
          abortControllerRef.current.abort();
          console.warn('Weather request timeout');
        }
      }, 5000);

      // 🔥 Fetch dengan retry logic
      let retryCount = 0;
      const maxRetries = 2;
      
      while (retryCount <= maxRetries) {
        try {
          const response = await fetch(`/api/weather?kode=${kodeWilayah}`, {
            signal: abortControllerRef.current.signal,
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          });

          clearTimeout(timeoutIdRef.current);

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const data = await response.json();

          if (!isMounted.current) return;

          // Proses data
          let weatherData;
          if (data.error) {
            console.warn('Weather API error:', data.error);
            weatherData = { ...FALLBACK_WEATHER };
          } else if (data.weather) {
            weatherData = {
              temp: data.weather.t || data.weather.temperature || 28,
              condition: data.weather.weather_desc || data.weather.condition || 'Cerah Berawan',
              humidity: data.weather.hu || data.weather.humidity || 75,
              windSpeed: data.weather.ws || data.weather.windSpeed || 12,
              icon: WEATHER_ICONS[data.weather.weather_desc] || '⛅',
              short: WEATHER_SHORT[data.weather.weather_desc] || 'Berawan',
            };
          } else {
            console.warn('Weather data format unexpected:', data);
            weatherData = { ...FALLBACK_WEATHER };
          }

          // Simpan ke cache
          weatherCache.set(cacheKey, {
            data: weatherData,
            timestamp: Date.now()
          });

          setWeather(weatherData);
          setError(null);
          return; // Success, keluar dari loop

        } catch (retryError) {
          retryCount++;
          if (retryCount > maxRetries) throw retryError;
          // Tunggu sebentar sebelum retry
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }
      
    } catch (err) {
      if (!isMounted.current) return;
      
      if (err.name === 'AbortError') {
        console.warn('Weather request cancelled');
        return;
      }
      
      console.error('Weather fetch error:', err.message);
      
      // 🔥 Gunakan cached data jika ada, baru fallback
      const cached = weatherCache.get(`weather_${locationName}`);
      if (cached) {
        setWeather(cached.data);
      } else {
        setWeather(FALLBACK_WEATHER);
      }
      setError(err.message);
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [locationName]);

  // 🔥 Effect utama
  useEffect(() => {
    if (!locationName) return;

    fetchWeather();

    // Refresh setiap 30 menit
    intervalIdRef.current = setInterval(fetchWeather, 30 * 60 * 1000);
    
    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
      }
    };
  }, [locationName, fetchWeather]);

  // 🔥 Fungsi manual refresh
  const refreshWeather = useCallback(() => {
    weatherCache.delete(`weather_${locationName}`);
    fetchWeather();
  }, [locationName, fetchWeather]);

  return { 
    weather, 
    loading, 
    error,
    refreshWeather  // 🔥 Ekspos fungsi refresh
  };
}