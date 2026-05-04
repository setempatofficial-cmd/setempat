// app/api/weather/route.js
// 🔥 MENGGUNAKAN OPENWEATHERMAP API DENGAN GEOCODING

// Cache untuk menyimpan data cuaca dan geocoding
const weatherCache = new Map();
const geocodeCache = new Map();
const CACHE_DURATION = 30 * 60 * 1000; // 30 menit

// ==================== FUNGSI GEOCODING (Cari koordinat dari nama lokasi) ====================
async function getCoordinatesFromLocation(locationName) {
  // Cek cache geocoding
  const cached = geocodeCache.get(locationName);
  if (cached && Date.now() - cached.timestamp < 7 * 24 * 60 * 60 * 1000) { // Cache 7 hari
    return cached.data;
  }

  const apiKey = process.env.OPENWEATHER_API_KEY;
  
  // 🔥 Gunakan OpenWeatherMap Geocoding API
  const geoUrl = `http://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(locationName)}&limit=1&appid=${apiKey}`;
  
  try {
    const response = await fetch(geoUrl);
    const data = await response.json();
    
    if (data && data.length > 0) {
      const result = {
        lat: data[0].lat,
        lon: data[0].lon,
        name: data[0].name,
        country: data[0].country,
        state: data[0].state
      };
      
      // Simpan ke cache
      geocodeCache.set(locationName, {
        data: result,
        timestamp: Date.now()
      });
      
      return result;
    }
    
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

// ==================== FALLBACK KOORDINAT UNTUK JAWA TIMUR ====================
// Hanya untuk fallback jika geocoding gagal
const FALLBACK_COORDINATES = {
  // Kota
  'Surabaya': { lat: -7.2575, lon: 112.7521 },
  'Malang': { lat: -7.9797, lon: 112.6304 },
  'Pasuruan': { lat: -7.6453, lon: 112.9075 },
  'Probolinggo': { lat: -7.7542, lon: 113.2159 },
  'Mojokerto': { lat: -7.4722, lon: 112.4338 },
  'Kediri': { lat: -7.8167, lon: 112.0167 },
  'Blitar': { lat: -8.0978, lon: 112.1650 },
  'Madiun': { lat: -7.6298, lon: 111.5239 },
  
  // Kabupaten
  'Kabupaten Pasuruan': { lat: -7.7306, lon: 112.8500 },
  'Kabupaten Sidoarjo': { lat: -7.4533, lon: 112.7167 },
  'Kabupaten Malang': { lat: -8.0462, lon: 112.6208 },
};

function getFallbackCoordinates(locationName) {
  // Coba match dengan key
  for (const [key, coord] of Object.entries(FALLBACK_COORDINATES)) {
    if (locationName.toLowerCase().includes(key.toLowerCase()) ||
        key.toLowerCase().includes(locationName.toLowerCase())) {
      return coord;
    }
  }
  
  // Default ke Pasuruan
  return { lat: -7.6453, lon: 112.9075 };
}

// ==================== TRANSLATOR CUACA ====================
const translateWeather = (desc) => {
  const translations = {
    'clear sky': 'Cerah',
    'few clouds': 'Cerah Berawan',
    'scattered clouds': 'Berawan',
    'broken clouds': 'Berawan Tebal',
    'overcast clouds': 'Mendung',
    'light rain': 'Hujan Ringan',
    'moderate rain': 'Hujan Sedang',
    'heavy intensity rain': 'Hujan Deras',
    'very heavy rain': 'Hujan Lebat',
    'extreme rain': 'Hujan Ekstrem',
    'thunderstorm': 'Hujan Petir',
    'thunderstorm with light rain': 'Hujan Petir',
    'thunderstorm with heavy rain': 'Hujan Petir Lebat',
    'mist': 'Kabut',
    'fog': 'Kabut',
    'haze': 'Kabut',
    'smoke': 'Asap',
    'dust': 'Debu',
    'sand': 'Pasir',
    'ash': 'Abu',
    'squall': 'Angin Kencang',
    'tornado': 'Puting Beliung'
  };
  
  const lowerDesc = desc.toLowerCase();
  return translations[lowerDesc] || desc;
};

// ==================== MAIN API HANDLER ====================
export async function GET(request) {
  console.log("🌤️ API Weather dipanggil");
  
  try {
    const { searchParams } = new URL(request.url);
    const location = searchParams.get('location'); // 🔥 Ubah dari 'kode' ke 'location'
    const kode = searchParams.get('kode'); // Support old parameter
    
    // Support kedua parameter (location untuk nama, kode untuk backward compatibility)
    const locationName = location || (kode ? `code_${kode}` : null);
    
    if (!locationName) {
      return Response.json({ error: 'Parameter location diperlukan' }, { status: 400 });
    }

    // 🔥 Gunakan cache berdasarkan nama lokasi
    const cacheKey = `weather_${locationName}`;
    const cached = weatherCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log("📦 Menggunakan data cache untuk:", locationName);
      return Response.json({ weather: cached.data, cached: true });
    }

    let lat, lon, usedLocation;

    // 🔥 Jika parameter adalah kode wilayah (format khusus), gunakan mapping sederhana
    if (kode && kode.includes('.')) {
      const coords = getCoordinatesFromCode(kode);
      lat = coords.lat;
      lon = coords.lon;
      usedLocation = `kode:${kode}`;
    } 
    // 🔥 Gunakan geocoding untuk nama lokasi
    else {
      console.log("📍 Mencari koordinat untuk:", locationName);
      const coords = await getCoordinatesFromLocation(locationName);
      
      if (coords) {
        lat = coords.lat;
        lon = coords.lon;
        usedLocation = `${coords.name}, ${coords.state || coords.country}`;
        console.log("✅ Koordinat ditemukan:", usedLocation);
      } else {
        // Fallback ke koordinat default
        console.log("⚠️ Lokasi tidak ditemukan, menggunakan fallback");
        const fallback = getFallbackCoordinates(locationName);
        lat = fallback.lat;
        lon = fallback.lon;
        usedLocation = `Fallback: ${locationName}`;
      }
    }

    // 🔥 PANGGIL OPENWEATHERMAP
    const apiKey = process.env.OPENWEATHER_API_KEY;
    
    if (!apiKey) {
      throw new Error('OPENWEATHER_API_KEY tidak ditemukan di .env.local');
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;
    
    console.log("🌐 Memanggil OpenWeatherMap untuk:", usedLocation);
    
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`OpenWeatherMap API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("✅ Data OpenWeatherMap diterima");

    // Transform ke format yang diinginkan
    const weatherData = {
      t: Math.round(data.main.temp),
      weather_desc: translateWeather(data.weather[0].description),
      hu: data.main.humidity,
      ws: Math.round(data.wind.speed * 3.6), // m/s ke km/h
      location_name: data.name,
      country: data.sys.country,
      icon: data.weather[0].icon
    };

    // Simpan ke cache
    weatherCache.set(cacheKey, {
      data: weatherData,
      timestamp: Date.now()
    });

    return Response.json({ 
      weather: weatherData,
      location_used: usedLocation
    });

  } catch (error) {
    console.error("❌ Error di API weather:", error);
    
    // ==================== FALLBACK Cerdas ====================
    const hour = new Date().getHours();
    let fallbackTemp = 28;
    let fallbackCondition = 'Cerah Berawan';
    
    if (hour < 10) {
      fallbackTemp = 25;
      fallbackCondition = 'Cerah';
    } else if (hour < 15) {
      fallbackTemp = 32;
      fallbackCondition = 'Cerah Berawan';
    } else if (hour < 18) {
      fallbackTemp = 30;
      fallbackCondition = 'Berawan';
    } else if (hour < 22) {
      fallbackTemp = 27;
      fallbackCondition = 'Cerah Malam';
    } else {
      fallbackTemp = 25;
      fallbackCondition = 'Cerah Malam';
    }
    
    return Response.json({ 
      weather: {
        t: fallbackTemp,
        weather_desc: fallbackCondition,
        hu: 75,
        ws: 10
      },
      note: 'Fallback data (offline mode)',
      error: error.message
    });
  }
}

// Helper untuk kode ke koordinat (minimal, hanya untuk kompatibilitas)
function getCoordinatesFromCode(kode) {
  // Parse kode wilayah (format: 35.14.01.1001)
  const parts = kode.split('.');
  if (parts.length >= 2) {
    // Generate koordinat berdasarkan kode (sederhana)
    const baseLat = -7.6 - (parseInt(parts[2] || 0) * 0.01);
    const baseLon = 112.9 + (parseInt(parts[3] || 0) * 0.01);
    return { lat: baseLat, lon: baseLon };
  }
  return { lat: -7.6453, lon: 112.9075 }; // Default Pasuruan
}