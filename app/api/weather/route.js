// app/api/weather/route.js
// 🔥 MENGGUNAKAN OPENWEATHERMAP API

// Mapping kode wilayah ke koordinat
const getCoordinates = (kodeWilayah) => {
  const mapping = {
    '35.14.01.1001': { lat: -7.645, lon: 112.907 }, // Pasuruan Kota
    '35.14.01.1002': { lat: -7.646, lon: 112.908 }, // Alun-Alun
    '35.14.01.1003': { lat: -7.647, lon: 112.909 }, // Pasar Besar
    // Tambah mapping lain sesuai kebutuhan
  };
  
  return mapping[kodeWilayah] || mapping['35.14.01.1001'];
};

// Translator cuaca Inggris -> Indonesia
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
    'heavy rain': 'Hujan Lebat',
    'thunderstorm': 'Hujan Petir',
    'mist': 'Kabut',
    'fog': 'Kabut'
  };
  return translations[desc] || desc;
};

// Cache sederhana
const cache = new Map();
const CACHE_DURATION = 30 * 60 * 1000; // 30 menit

export async function GET(request) {
  console.log("🌤️ API Weather OpenWeatherMap dipanggil");
  
  try {
    const { searchParams } = new URL(request.url);
    const kode = searchParams.get('kode');
    
    if (!kode) {
      return Response.json({ error: 'Kode wilayah diperlukan' }, { status: 400 });
    }

    // Cek cache
    const cached = cache.get(kode);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log("📦 Menggunakan data cache");
      return Response.json({ weather: cached.data });
    }

    // Dapatkan koordinat
    const coord = getCoordinates(kode);
    console.log("📍 Koordinat:", coord);

    // 🔥 PANGGIL OPENWEATHERMAP
    const apiKey = process.env.OPENWEATHER_API_KEY;
    
    if (!apiKey) {
      throw new Error('OPENWEATHER_API_KEY tidak ditemukan di .env.local');
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${coord.lat}&lon=${coord.lon}&units=metric&appid=${apiKey}`;
    
    console.log("🌐 Memanggil OpenWeatherMap");
    
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`OpenWeatherMap API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("✅ Data OpenWeatherMap diterima");

    // Transform ke format Anda
    const weatherData = {
      t: Math.round(data.main.temp),
      weather_desc: translateWeather(data.weather[0].description),
      hu: data.main.humidity,
      ws: Math.round(data.wind.speed * 3.6) // konversi m/s ke km/h
    };

    // Simpan ke cache
    cache.set(kode, {
      data: weatherData,
      timestamp: Date.now()
    });

    return Response.json({ weather: weatherData });

  } catch (error) {
    console.error("❌ Error di API weather:", error);
    
    // Fallback berdasarkan waktu
    const hour = new Date().getHours();
    let fallbackTemp = 28;
    let fallbackCondition = 'Cerah Berawan';
    
    if (hour < 10) {
      fallbackTemp = 24;
      fallbackCondition = 'Cerah';
    } else if (hour < 15) {
      fallbackTemp = 31;
      fallbackCondition = 'Cerah Berawan';
    } else if (hour < 18) {
      fallbackTemp = 29;
      fallbackCondition = 'Berawan';
    } else {
      fallbackTemp = 26;
      fallbackCondition = 'Cerah Malam';
    }
    
    return Response.json({ 
      weather: {
        t: fallbackTemp,
        weather_desc: fallbackCondition,
        hu: 75,
        ws: 10
      },
      note: 'Menggunakan data fallback'
    });
  }
}