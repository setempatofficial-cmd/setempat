// hooks/useWeather.js
import { useState, useEffect, useRef, useCallback } from 'react';

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

const FALLBACK_WEATHER = {
  temp: 28,
  condition: 'Cerah Berawan',
  humidity: 75,
  windSpeed: 12,
  icon: '⛅',
  short: 'Berawan'
};

const weatherCache = new Map();
const wilayahCache = new Map();

// 🔥 Daftar keyword yang tidak valid
const INVALID_LOCATIONS = ['', 'pilih lokasi', 'select location', 'null', 'undefined', 'none'];

// 🔥 Cek apakah lokasi valid
const isValidLocation = (location) => {
  if (!location || typeof location !== 'string') return false;
  const normalized = location.toLowerCase().trim();
  return !INVALID_LOCATIONS.includes(normalized) && normalized.length > 2;
};

export const getWeatherAsSignal = (weatherData) => {
  if (!weatherData) return null;

  // Mapping kondisi cuaca ke level signal (1-5)
  const getWeatherLevel = (condition) => {
    const levelMap = {
      'Cerah': 1,
      'Cerah Berawan': 1,
      'Berawan': 2,
      'Berawan Tebal': 2,
      'Kabut': 3,
      'Hujan Ringan': 3,
      'Hujan Sedang': 4,
      'Hujan Lebat': 4,
      'Hujan Petir': 5
    };
    return levelMap[condition] || 1;
  };

  // Mapping kondisi cuaca ke status text
  const getWeatherStatusText = (condition, temp) => {
    const statusMap = {
      'Cerah': `☀️ Cerah (${temp}°C)`,
      'Cerah Berawan': `⛅ Cerah Berawan (${temp}°C)`,
      'Berawan': `☁️ Berawan (${temp}°C)`,
      'Berawan Tebal': `☁️☁️ Mendung Tebal (${temp}°C)`,
      'Hujan Ringan': `🌧️ Hujan Ringan (${temp}°C)`,
      'Hujan Sedang': `🌧️🌧️ Hujan Sedang (${temp}°C)`,
      'Hujan Lebat': `⛈️ Hujan Lebat (${temp}°C)`,
      'Hujan Petir': `⚡🌧️ Hujan Petir (${temp}°C)`,
      'Kabut': `🌫️ Kabut (${temp}°C)`
    };
    return statusMap[condition] || `🌡️ ${temp}°C`;
  };

  const level = getWeatherLevel(weatherData.condition);
  const isExtreme = level >= 4;
  const isWarning = level >= 3;

  return {
    type: 'weather',
    condition: weatherData.condition,
    temp: weatherData.temp,
    humidity: weatherData.humidity,
    windSpeed: weatherData.windSpeed,
    icon: weatherData.icon,
    level: level,
    total: 1,
    isExtreme,
    isWarning,
    statusText: getWeatherStatusText(weatherData.condition, weatherData.temp),
    shortText: weatherData.short,
    vibe: isExtreme ? '⚠️ Cuaca ekstrem, hati-hati beraktivitas!' :
      isWarning ? '🌧️ Waspada perubahan cuaca' :
        '☀️ Cuaca mendukung aktivitas',
    color: isExtreme ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-blue-600',
    bgColor: isExtreme ? 'bg-red-50' : isWarning ? 'bg-amber-50' : 'bg-blue-50',
    borderColor: isExtreme ? 'border-red-200' : isWarning ? 'border-amber-200' : 'border-blue-200'
  };
};

export function useWeather(locationName) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [wilayahInfo, setWilayahInfo] = useState(null);

  const isMounted = useRef(true);
  const abortControllerRef = useRef(null);
  const timeoutIdRef = useRef(null);
  const intervalIdRef = useRef(null);

  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
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

  // 🔥 Fungsi getKodeWilayah dengan validasi
  const getKodeWilayah = useCallback(async (namaWilayah) => {
    // 🔥 VALIDASI: Cek apakah lokasi valid
    if (!isValidLocation(namaWilayah)) {
      console.log("⚠️ Location name invalid, skipping search:", namaWilayah);
      return null;
    }

    // Cek cache
    const cacheKey = `wilayah_${namaWilayah.toLowerCase()}`;
    const cached = wilayahCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 60 * 60 * 1000) {
      console.log("📦 Using cached wilayah:", cached.data.nama);
      return cached.data;
    }

    try {
      console.log("🔍 Searching wilayah:", namaWilayah);

      const response = await fetch(`/api/wilayah/search?nama=${encodeURIComponent(namaWilayah)}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.data) {
        wilayahCache.set(cacheKey, {
          data: data.data,
          timestamp: Date.now()
        });

        if (isMounted.current) {
          setWilayahInfo({
            kode: data.data.kode,
            nama: data.data.nama,
            kecamatan: data.data.kecamatan,
            kabupaten: data.data.kabupaten,
            provinsi: data.data.provinsi,
            lat: data.data.lat,
            lon: data.data.lon,
          });
        }

        console.log("✅ Wilayah found:", data.data.nama);
        return data.data;
      }

      return null;

    } catch (err) {
      console.error("❌ Error searching wilayah:", err.message);
      return null; // Return null, jangan throw error
    }
  }, []);

  // 🔥 Fetch weather langsung (tanpa perlu kode wilayah)
  const fetchWeatherDirect = useCallback(async () => {
    // 🔥 VALIDASI: Cek apakah lokasi valid
    if (!isValidLocation(locationName)) {
      console.log("⚠️ Skipping weather fetch - invalid location:", locationName);
      setWeather(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const cacheKey = `weather_${locationName.toLowerCase()}`;
      const cached = weatherCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
        console.log("📦 Using cached weather data");
        setWeather(cached.data);
        setLoading(false);
        return;
      }

      // 🔥 Setup timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      console.log("🌤️ Fetching weather for:", locationName);

      // 🔥 Panggil API weather dengan parameter location
      const response = await fetch(
        `/api/weather?location=${encodeURIComponent(locationName)}`,
        { signal: controller.signal }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.weather) {
        const weatherData = {
          temp: data.weather.t,
          condition: data.weather.weather_desc,
          humidity: data.weather.hu,
          windSpeed: data.weather.ws,
          icon: WEATHER_ICONS[data.weather.weather_desc] || '⛅',
          short: WEATHER_SHORT[data.weather.weather_desc] || 'Berawan',
          location_name: data.weather.location_name
        };

        weatherCache.set(cacheKey, {
          data: weatherData,
          timestamp: Date.now()
        });

        setWeather(weatherData);
        setError(null);
      } else {
        throw new Error('Invalid weather data format');
      }

    } catch (err) {
      if (err.name === 'AbortError') {
        console.warn('Weather request timeout');
        setError('Request timeout, menggunakan data default');
      } else {
        console.error("Weather fetch error:", err.message);
        setError(err.message);
      }

      // 🔥 Set fallback weather
      setWeather(FALLBACK_WEATHER);

    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [locationName]);

  // 🔥 Main effect
  useEffect(() => {
    if (!isValidLocation(locationName)) {
      console.log("⏸️ Waiting for valid location... Current:", locationName);
      setWeather(null);
      setLoading(false);
      return;
    }

    fetchWeatherDirect();

    // Refresh setiap 30 menit
    intervalIdRef.current = setInterval(fetchWeatherDirect, 30 * 60 * 1000);

    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
      }
    };
  }, [locationName, fetchWeatherDirect]);

  const refreshWeather = useCallback(() => {
    if (!isValidLocation(locationName)) return;
    weatherCache.delete(`weather_${locationName.toLowerCase()}`);
    fetchWeatherDirect();
  }, [locationName, fetchWeatherDirect]);

  return {
    weather,
    loading,
    error,
    wilayahInfo,
    refreshWeather,
    isValid: isValidLocation(locationName) // 🔥 Ekspos status validasi
  };
}