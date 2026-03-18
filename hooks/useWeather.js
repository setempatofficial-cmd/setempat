// hooks/useWeather.js
import { useState, useEffect } from 'react';

// Mapping kode wilayah ke lokasi (contoh)
const LOCATION_CODES = {
  'Pasuruan': '35.14.01.1001',
  'Alun-Alun Pasuruan': '35.14.01.1002',
  'Pasar Besar': '35.14.01.1003',
  'default': '35.14.01.1001' // Default Pasuruan Kota
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

// 🔥 DATA CADANGAN (FALLBACK) untuk demo/offline
const FALLBACK_WEATHER = {
  temp: 28,
  condition: 'Cerah Berawan',
  humidity: 75,
  windSpeed: 12,
  icon: '⛅',
  short: 'Berawan'
};

export function useWeather(locationName) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!locationName) return;

    const fetchWeather = async () => {
      setLoading(true);
      setError(null);

      try {
        // Dapatkan kode wilayah
        const kodeWilayah = LOCATION_CODES[locationName] || LOCATION_CODES.default;

        // 🔥 TAMBAH TIMEOUT - 5 detik
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`/api/weather?kode=${kodeWilayah}`, {
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        // 🔥 CEK RESPONSE OK
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // 🔥 CEK DATA ERROR DARI API
        if (data.error) {
          console.warn('Weather API error:', data.error);
          // Gunakan fallback
          setWeather(FALLBACK_WEATHER);
        } 
        // 🔥 CEK WEATHER ADA
        else if (data.weather) {
          setWeather({
            temp: data.weather.t || data.weather.temperature || 28,
            condition: data.weather.weather_desc || data.weather.condition || 'Cerah Berawan',
            humidity: data.weather.hu || data.weather.humidity || 75,
            windSpeed: data.weather.ws || data.weather.windSpeed || 12,
            icon: WEATHER_ICONS[data.weather.weather_desc] || '⛅',
            short: WEATHER_SHORT[data.weather.weather_desc] || 'Berawan',
          });
        } else {
          // 🔥 DATA TIDAK SESUAI FORMAT
          console.warn('Weather data format unexpected:', data);
          setWeather(FALLBACK_WEATHER);
        }
      } catch (err) {
        // 🔥 HANDLE ERROR LEBIH DETAIL
        console.error('Weather fetch error:', err.message);
        
        if (err.name === 'AbortError') {
          console.warn('Weather request timeout - using fallback');
        }
        
        // Gunakan fallback data
        setWeather(FALLBACK_WEATHER);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();

    // Refresh setiap 30 menit
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [locationName]);

  return { weather, loading, error };
}