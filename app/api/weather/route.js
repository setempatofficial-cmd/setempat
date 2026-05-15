// app/api/weather/route.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Cache
const weatherCache = new Map();
const geocodeCache = new Map();
const CACHE_DURATION = 30 * 60 * 1000;

// ==================== CEK KOORDINAT DARI DATABASE WILAYAH ====================
async function getCoordinatesFromCode(kode) {
  const cacheKey = `geo_${kode}`;
  const cached = geocodeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 30 * 24 * 60 * 60 * 1000) {
    return cached.data;
  }
  
  try {
    const { data, error } = await supabase
      .from('wilayah')
      .select('lat, lon, nama, kecamatan, kabupaten')
      .eq('kode', kode)
      .single();
    
    if (!error && data && data.lat && data.lon) {
      console.log("✅ Koordinat dari database:", data.nama, data.lat, data.lon);
      
      const result = {
        lat: data.lat,
        lon: data.lon,
        name: data.nama,
        location_detail: `${data.kecamatan}, ${data.kabupaten}`
      };
      
      geocodeCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    }
    
    // Cari kecamatan
    if (kode.length >= 8) {
      const kodeKecamatan = kode.substring(0, 8);
      const { data: kecData } = await supabase
        .from('wilayah')
        .select('lat, lon, nama')
        .eq('kode', kodeKecamatan)
        .single();
      
      if (kecData?.lat && kecData?.lon) {
        console.log("📍 Pakai koordinat kecamatan:", kecData.nama);
        return { lat: kecData.lat, lon: kecData.lon, name: kecData.nama };
      }
    }
    
    // Cari kabupaten
    if (kode.length >= 5) {
      const kodeKabupaten = kode.substring(0, 5);
      const { data: kabData } = await supabase
        .from('wilayah')
        .select('lat, lon, nama')
        .eq('kode', kodeKabupaten)
        .single();
      
      if (kabData?.lat && kabData?.lon) {
        console.log("📍 Pakai koordinat kabupaten:", kabData.nama);
        return { lat: kabData.lat, lon: kabData.lon, name: kabData.nama };
      }
    }
    
    console.log("⚠️ Kode tidak ditemukan di database:", kode);
    return null;
    
  } catch (error) {
    console.error("Error getCoordinatesFromCode:", error);
    return null;
  }
}

// ==================== GEOCODING ====================
async function getCoordinatesFromLocation(locationName) {
  const cached = geocodeCache.get(locationName);
  if (cached && Date.now() - cached.timestamp < 7 * 24 * 60 * 60 * 1000) {
    return cached.data;
  }

  const apiKey = process.env.OPENWEATHER_API_KEY;
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
      
      geocodeCache.set(locationName, { data: result, timestamp: Date.now() });
      return result;
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

// ==================== FALLBACK KOORDINAT ====================
const FALLBACK_COORDINATES = {
  'Surabaya': { lat: -7.2575, lon: 112.7521 },
  'Malang': { lat: -7.9797, lon: 112.6304 },
  'Pasuruan': { lat: -7.6453, lon: 112.9075 },
  'Probolinggo': { lat: -7.7542, lon: 113.2159 },
  'Mojokerto': { lat: -7.4722, lon: 112.4338 },
  'Kediri': { lat: -7.8167, lon: 112.0167 },
  'Blitar': { lat: -8.0978, lon: 112.1650 },
  'Madiun': { lat: -7.6298, lon: 111.5239 },
  'Kabupaten Pasuruan': { lat: -7.7306, lon: 112.8500 },
  'Kabupaten Sidoarjo': { lat: -7.4533, lon: 112.7167 },
  'Kabupaten Malang': { lat: -8.0462, lon: 112.6208 },
};

function getFallbackCoordinates(locationName) {
  for (const [key, coord] of Object.entries(FALLBACK_COORDINATES)) {
    if (locationName.toLowerCase().includes(key.toLowerCase()) ||
        key.toLowerCase().includes(locationName.toLowerCase())) {
      return coord;
    }
  }
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

// ==================== SIMPAN WEATHER SIGNAL KE EXTERNAL SIGNALS ====================
async function saveWeatherSignal(tempatId, weatherData, locationName) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const sourceId = `weather_${tempatId}_${today}`;
    
    // Cek apakah sudah ada signal untuk hari ini
    const { data: existing } = await supabase
      .from('external_signals')
      .select('id')
      .eq('source_id', sourceId)
      .single();
    
    if (existing) {
      console.log('📡 Weather signal already exists for today');
      return;
    }
    
    // Tentukan level signal berdasarkan cuaca
    let signalTier = 2; // default tier 2
    let verificationLevel = 'high';
    let confidence = 0.9;
    let content = `${weatherData.weather_desc}, Suhu ${weatherData.t}°C, Kelembaban ${weatherData.hu}%, Angin ${weatherData.ws} km/jam`;
    
    // Cuaca ekstrem dapat tier lebih tinggi (tier 1)
    if (weatherData.weather_desc.includes('Hujan Deras') || 
        weatherData.weather_desc.includes('Hujan Lebat') ||
        weatherData.weather_desc.includes('Angin Kencang') ||
        weatherData.weather_desc.includes('Puting Beliung')) {
      signalTier = 1;
      confidence = 0.95;
      content = `⚠️ PERINGATAN: ${weatherData.weather_desc} di ${locationName}! Suhu ${weatherData.t}°C. Warga hati-hati beraktivitas.`;
    }
    
    // Hujan ringan/sedang
    if (weatherData.weather_desc.includes('Hujan Ringan') || 
        weatherData.weather_desc.includes('Hujan Sedang')) {
      signalTier = 2;
      content = `🌧️ ${weatherData.weather_desc} di ${locationName}. Suhu ${weatherData.t}°C. Jangan lupa bawa payung!`;
    }
    
    // Cuaca cerah
    if (weatherData.weather_desc.includes('Cerah')) {
      content = `☀️ Cuaca ${weatherData.weather_desc} di ${locationName}. Suhu ${weatherData.t}°C. Nyaman untuk beraktivitas.`;
    }
    
    // Panas ekstrem (>35°C)
    if (weatherData.t > 35) {
      signalTier = 1;
      content = `🔥 PERINGATAN PANAS EKSTREM! Suhu ${weatherData.t}°C di ${locationName}. Hindari aktivitas luar ruangan berlebihan.`;
    }
    
    // Angin kencang (>30 km/jam)
    if (weatherData.ws > 30) {
      signalTier = 1;
      content = `🌬️ PERINGATAN ANGIN KENCANG! Kecepatan angin ${weatherData.ws} km/jam di ${locationName}. Waspada pohon tumbang.`;
    }
    
    // Simpan ke external_signals
    const { error } = await supabase
      .from('external_signals')
      .insert({
        tempat_id: parseInt(tempatId),
        source: 'weather_api',
        source_id: sourceId,
        content: content,
        source_tier: signalTier,
        source_platform: 'openweathermap',
        confidence: confidence,
        verified: true,
        verification_level: verificationLevel,
        created_at: new Date().toISOString(),
        fetched_at: new Date().toISOString()
      });
    
    if (error) {
      console.error('❌ Gagal simpan weather signal:', error);
    } else {
      console.log('✅ Weather signal saved:', content.substring(0, 60));
    }
    
  } catch (err) {
    console.error('❌ Error saveWeatherSignal:', err);
  }
}

// ==================== MAIN API HANDLER ====================
export async function GET(request) {
  console.log("🌤️ API Weather dipanggil");
  
  try {
    const { searchParams } = new URL(request.url);
    const location = searchParams.get('location');
    const kode = searchParams.get('kode');
    const latParam = searchParams.get('lat');
    const lonParam = searchParams.get('lon');
    const tempatId = searchParams.get('tempatId'); // Tambahan: langsung kirim tempatId
    
    let lat, lon, usedLocation;

    // 🔥 PRIORITAS 1: Jika ada koordinat langsung
    if (latParam && lonParam) {
      console.log("📍 Pakai koordinat langsung:", latParam, lonParam);
      lat = parseFloat(latParam);
      lon = parseFloat(lonParam);
      usedLocation = `Koordinat: ${lat}, ${lon}`;
    }
    
    const locationName = location || (kode ? `code_${kode}` : null);
    
    if (!locationName && !latParam && !tempatId) {
      return Response.json({ error: 'Parameter location/lat/lon/tempatId diperlukan' }, { status: 400 });
    }

    const cacheKey = `weather_${locationName || `${latParam}_${lonParam}` || tempatId}`;
    const cached = weatherCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log("📦 Menggunakan data cache");
      return Response.json({ weather: cached.data, cached: true });
    }

    // 🔥 PRIORITAS 2: Jika parameter adalah kode wilayah
    if (kode && kode.includes('.')) {
      const coords = await getCoordinatesFromCode(kode);
      if (coords) {
        lat = coords.lat;
        lon = coords.lon;
        usedLocation = coords.name || `kode:${kode}`;
      } else {
        lat = -7.6453;
        lon = 112.9075;
        usedLocation = `Fallback: ${kode}`;
      }
    } 
    // 🔥 PRIORITAS 3: Gunakan geocoding untuk nama lokasi
    else if (location) {
      console.log("📍 Mencari koordinat untuk:", location);
      const coords = await getCoordinatesFromLocation(location);
      
      if (coords) {
        lat = coords.lat;
        lon = coords.lon;
        usedLocation = `${coords.name}, ${coords.state || coords.country}`;
      } else {
        const fallback = getFallbackCoordinates(location);
        lat = fallback.lat;
        lon = fallback.lon;
        usedLocation = `Fallback: ${location}`;
      }
    }

    // Jika masih belum ada koordinat, gunakan default
    if (!lat || !lon) {
      lat = -7.6453;
      lon = 112.9075;
      usedLocation = usedLocation || 'Default: Pasuruan';
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
      ws: Math.round(data.wind.speed * 3.6),
      location_name: data.name,
      country: data.sys.country,
      icon: data.weather[0].icon
    };

    // 🔥 SIMPAN WEATHER SIGNAL KE EXTERNAL SIGNALS
    // Jika ada tempatId langsung dari parameter
    if (tempatId && !isNaN(parseInt(tempatId))) {
      await saveWeatherSignal(parseInt(tempatId), weatherData, usedLocation);
    } 
    // Atau cari berdasarkan kode
    else if (kode && kode.includes('.')) {
      const { data: tempat } = await supabase
        .from('tempat')
        .select('id')
        .eq('google_place_id', kode)
        .single();
      
      if (tempat) {
        await saveWeatherSignal(tempat.id, weatherData, usedLocation);
      }
    }

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
    
    // ==================== FALLBACK CERDAS ====================
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