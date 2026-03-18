// app/api/weather/route.js
import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const kodeWilayah = searchParams.get('kode');
  
  if (!kodeWilayah) {
    return NextResponse.json(
      { error: 'Kode wilayah diperlukan' },
      { status: 400 }
    );
  }

  try {
    // 🔥 TAMBAH TIMEOUT
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(
      `https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${kodeWilayah}`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'SetempatID/1.0'
        },
        signal: controller.signal,
        next: { revalidate: 1800 } // Cache 30 menit
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`BMKG API returned ${response.status}`);
      // 🔥 KALAU GAGAL, KEMBALIKAN DATA DUMMY UNTUK DEVELOPMENT
      if (process.env.NODE_ENV === 'development') {
        return NextResponse.json({
          weather: {
            t: 28,
            weather_desc: 'Cerah Berawan',
            hu: 75,
            ws: 12
          },
          source: 'BMKG (Development Mode)',
          timestamp: new Date().toISOString()
        });
      }
      
      return NextResponse.json(
        { error: 'Gagal mengambil data dari BMKG' },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // 🔥 CEK STRUKTUR DATA BMKG
    if (!data || !data.data || !data.data[0]) {
      console.warn('BMKG data format unexpected:', data);
      return NextResponse.json(
        { error: 'Format data BMKG tidak sesuai' },
        { status: 500 }
      );
    }
    
    // Ambil data terkini
    const currentWeather = data.data[0];
    
    return NextResponse.json({
      weather: currentWeather,
      source: 'BMKG',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Weather API Error:', error.message);
    
    // 🔥 DI DEVELOPMENT, KEMBALIKAN DATA DUMMY
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json({
        weather: {
          t: 28,
          weather_desc: 'Cerah Berawan',
          hu: 75,
          ws: 12
        },
        source: 'BMKG (Fallback)',
        timestamp: new Date().toISOString()
      });
    }
    
    return NextResponse.json(
      { error: 'Gagal mengambil data cuaca' },
      { status: 500 }
    );
  }
}