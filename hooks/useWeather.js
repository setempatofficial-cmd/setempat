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

// Fallback dengan indikasi data tidak valid
const FALLBACK_WEATHER = {
  temp: 28,
  condition: 'Cerah Berawan',
  humidity: 75,
  windSpeed: 12,
  icon: '⛅',
  short: 'Berawan',
  isFallback: true // 🔥 Tandai sebagai fallback
};

const weatherCache = new Map();
const wilayahCache = new Map();

// 🔥 Daftar keyword yang tidak valid
const INVALID_LOCATIONS = ['', 'pilih lokasi', 'select location', 'null', 'undefined', 'none', '0', 'all'];

// 🔥 Konfigurasi
const CONFIG = {
  WEATHER_CACHE_TTL: 5 * 60 * 1000,     // 5 menit
  WILAYAH_CACHE_TTL: 60 * 60 * 1000,    // 1 jam
  WEATHER_REFRESH_INTERVAL: 30 * 60 * 1000, // 30 menit
  FETCH_TIMEOUT: 8000,                  // 8 detik (ditingkatkan dari 5 detik)
  MAX_RETRIES: 2,                       // Maksimal retry
  RETRY_DELAY: 2000,                    // Delay retry 2 detik
};

// 🔥 Cek apakah lokasi valid
const isValidLocation = (location) => {
  if (!location || typeof location !== 'string') return false;
  const normalized = location.toLowerCase().trim();
  return !INVALID_LOCATIONS.includes(normalized) && normalized.length > 2;
};

// 🔥 Cek apakah data weather sudah outdated
const isWeatherOutdated = (weatherData, timestamp) => {
  if (!weatherData || !timestamp) return true;
  // Data dianggap outdated jika lebih dari 1 jam
  return Date.now() - timestamp > 60 * 60 * 1000;
};

export const getWeatherAsSignal = (weatherData, metadata = {}) => {
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

  // Mapping kondisi cuaca ke status text yang lebih informatif
  const getWeatherStatusText = (condition, temp, isOutdated = false) => {
    const baseText = {
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

    let text = baseText[condition] || `🌡️ ${temp}°C`;
    if (isOutdated) text += ' 🔄';
    return text;
  };

  const level = getWeatherLevel(weatherData.condition);
  const isExtreme = level >= 4;
  const isWarning = level >= 3;
  const isOutdated = metadata.isOutdated || weatherData.isFallback;

  // Vibe yang lebih kontekstual
  const getVibe = () => {
    if (isExtreme) return '⚠️ PERINGATAN DINI: Cuaca ekstrem, hindari aktivitas luar ruangan!';
    if (isWarning) {
      if (weatherData.condition.includes('Hujan')) return '🌧️ Hujan diperkirakan akan turun, siapkan perlengkapan hujan.';
      if (weatherData.condition === 'Kabut') return '🌫️ Kabut mengurangi jarak pandang, hati-hati berkendara.';
      return '🌧️ Waspada perubahan cuaca mendadak.';
    }
    if (weatherData.condition.includes('Cerah')) return '☀️ Cuaca cerah, cocok untuk aktivitas luar ruangan.';
    if (weatherData.condition.includes('Berawan')) return '⛅ Cuaca nyaman, tetap produktif!';
    return '🌡️ Kondisi cuaca normal, aktivitas berjalan lancar.';
  };

  // Rekomendasi berdasarkan cuaca
  const getRecommendation = () => {
    if (isExtreme) return 'Segera cari tempat berlindung, ikuti perkembangan cuaca.';
    if (isWarning) {
      if (weatherData.condition.includes('Hujan')) return 'Bawa payung/jas hujan, hindari genangan air.';
      if (weatherData.condition === 'Kabut') return 'Nyalakan lampu kendaraan, kurangi kecepatan.';
      return 'Pantau perkembangan cuaca, siapkan antisipasi.';
    }
    return 'Kondisi amang untuk beraktivitas.';
  };

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
    isOutdated,
    isFallback: weatherData.isFallback || false,
    statusText: getWeatherStatusText(weatherData.condition, weatherData.temp, isOutdated),
    shortText: weatherData.short,
    vibe: getVibe(),
    recommendation: getRecommendation(),
    color: isExtreme ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-blue-600',
    bgColor: isExtreme ? 'bg-red-50' : isWarning ? 'bg-amber-50' : 'bg-blue-50',
    borderColor: isExtreme ? 'border-red-200' : isWarning ? 'border-amber-200' : 'border-blue-200',
    lastUpdated: metadata.lastUpdated || null
  };
};

export function useWeather(locationName) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [wilayahInfo, setWilayahInfo] = useState(null);
  const [lastSuccessfulFetch, setLastSuccessfulFetch] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  const isMounted = useRef(true);
  const abortControllerRef = useRef(null);
  const timeoutIdRef = useRef(null);
  const intervalIdRef = useRef(null);
  const retryTimeoutRef = useRef(null);

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
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // 🔥 Fungsi getKodeWilayah dengan validasi (dipertahankan)
  const getKodeWilayah = useCallback(async (namaWilayah) => {
    if (!isValidLocation(namaWilayah)) {
      console.log("⚠️ Location name invalid, skipping search:", namaWilayah);
      return null;
    }

    const cacheKey = `wilayah_${namaWilayah.toLowerCase()}`;
    const cached = wilayahCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CONFIG.WILAYAH_CACHE_TTL) {
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
      return null;
    }
  }, []);

  // 🔥 Fetch dengan retry mechanism
  const fetchWithRetry = useCallback(async (fetchFn, retries = CONFIG.MAX_RETRIES) => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fetchFn();
      } catch (err) {
        if (attempt === retries) throw err;
        console.log(`Retry attempt ${attempt + 1}/${retries} after ${CONFIG.RETRY_DELAY}ms`);
        await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
      }
    }
  }, []);

  // 🔥 Fetch weather langsung dengan peningkatan
  const fetchWeatherDirect = useCallback(async (skipCache = false) => {
    if (!isValidLocation(locationName)) {
      console.log("⚠️ Skipping weather fetch - invalid location:", locationName);
      setWeather(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);

    // 🔥 Reset error jika ini bukan retry
    if (retryCount === 0) {
      setError(null);
    }

    try {
      const cacheKey = `weather_${locationName.toLowerCase()}`;
      const cached = weatherCache.get(cacheKey);

      // Gunakan cache jika masih fresh dan tidak dipaksa skip
      if (!skipCache && cached && Date.now() - cached.timestamp < CONFIG.WEATHER_CACHE_TTL) {
        console.log("📦 Using cached weather data");
        const isOutdated = isWeatherOutdated(cached.data, cached.timestamp);
        setWeather({
          ...cached.data,
          isOutdated
        });
        setLoading(false);
        setRetryCount(0);
        return;
      }

      // 🔥 Setup timeout dengan AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.FETCH_TIMEOUT);

      console.log("🌤️ Fetching weather for:", locationName);

      const response = await fetch(
        `/api/weather?location=${encodeURIComponent(locationName)}`,
        { signal: controller.signal }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.weather && data.weather.t && data.weather.weather_desc) {
        const weatherData = {
          temp: data.weather.t,
          condition: data.weather.weather_desc,
          humidity: data.weather.hu || 70,
          windSpeed: data.weather.ws || 10,
          icon: WEATHER_ICONS[data.weather.weather_desc] || '⛅',
          short: WEATHER_SHORT[data.weather.weather_desc] || 'Berawan',
          location_name: data.weather.location_name || locationName,
          isFallback: false
        };

        weatherCache.set(cacheKey, {
          data: weatherData,
          timestamp: Date.now()
        });

        if (isMounted.current) {
          setWeather(weatherData);
          setError(null);
          setLastSuccessfulFetch(Date.now());
          setRetryCount(0);
        }
      } else {
        throw new Error('Invalid weather data format from API');
      }

    } catch (err) {
      console.error("Weather fetch error:", err.message);

      let errorMessage = 'Gagal memuat data cuaca';
      if (err.name === 'AbortError') {
        errorMessage = 'Koneksi timeout, menggunakan data perkiraan';
      } else if (err.message.includes('HTTP 404')) {
        errorMessage = 'Lokasi tidak ditemukan';
      } else if (err.message.includes('network')) {
        errorMessage = 'Koneksi bermasalah, menggunakan data cache';
      }

      setError(errorMessage);

      // 🔥 Retry logic
      if (retryCount < CONFIG.MAX_RETRIES && !skipCache) {
        setRetryCount(prev => prev + 1);
        retryTimeoutRef.current = setTimeout(() => {
          if (isMounted.current) {
            fetchWeatherDirect(true);
          }
        }, CONFIG.RETRY_DELAY);
        return;
      }

      // 🔥 Fallback dengan data cache jika ada
      const cacheKey = `weather_${locationName.toLowerCase()}`;
      const cached = weatherCache.get(cacheKey);

      if (cached && cached.data) {
        console.log("📦 Using stale cache as fallback");
        if (isMounted.current) {
          setWeather({
            ...cached.data,
            isOutdated: true,
            isFallback: true
          });
        }
      } else {
        // Fallback terakhir ke data default
        if (isMounted.current) {
          setWeather({
            ...FALLBACK_WEATHER,
            isFallback: true
          });
        }
      }

    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [locationName, retryCount]);

  // 🔥 Manual refresh dengan force
  const refreshWeather = useCallback(() => {
    if (!isValidLocation(locationName)) return;
    const cacheKey = `weather_${locationName.toLowerCase()}`;
    weatherCache.delete(cacheKey);
    setRetryCount(0);
    fetchWeatherDirect(true);
  }, [locationName, fetchWeatherDirect]);

  // 🔥 Main effect dengan interval yang lebih cerdas
  useEffect(() => {
    if (!isValidLocation(locationName)) {
      console.log("⏸️ Waiting for valid location... Current:", locationName);
      setWeather(null);
      setLoading(false);
      setError(null);
      return;
    }

    fetchWeatherDirect();

    // Refresh interval dengan dynamic interval
    const startInterval = () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
      }
      intervalIdRef.current = setInterval(() => {
        // Hanya refresh jika tidak ada error yang critical
        if (isMounted.current && (!error || error.includes('timeout'))) {
          fetchWeatherDirect();
        }
      }, CONFIG.WEATHER_REFRESH_INTERVAL);
    };

    startInterval();

    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [locationName, fetchWeatherDirect, error]);

  // 🔥 Hitung umur data
  const dataAge = useCallback(() => {
    if (!lastSuccessfulFetch) return null;
    const ageInMinutes = Math.floor((Date.now() - lastSuccessfulFetch) / 60000);
    return {
      minutes: ageInMinutes,
      isFresh: ageInMinutes < 30,
      isStale: ageInMinutes >= 60
    };
  }, [lastSuccessfulFetch]);

  return {
    weather,
    loading,
    error,
    wilayahInfo,
    refreshWeather,
    isValid: isValidLocation(locationName),
    dataAge: dataAge(),
    lastUpdate: lastSuccessfulFetch,
    retryCount
  };
}