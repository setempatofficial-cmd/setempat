import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Cache untuk pencarian wilayah
const searchCache = new Map();
const CACHE_DURATION = 60 * 60 * 1000; // 1 jam

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    // Kita sesuaikan parameternya menggunakan 'q' agar singkron dengan modal
    const queryStr = searchParams.get('q') || searchParams.get('nama'); 
    
    console.log("🔍 Mencari wilayah:", queryStr);
    
    if (!queryStr || queryStr.length < 3) {
      return NextResponse.json({ success: true, data: [] });
    }
    
    // 1. CEK CACHE TERLEBIH DAHULU
    const cacheKey = `search_${queryStr.toLowerCase()}`;
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log("📦 Menggunakan cache untuk:", queryStr);
      return NextResponse.json({ success: true, data: cached.data, cached: true });
    }
    
    // 2. QUERY KE DATABASE SUPABASE (LOKAL)
    let finalRows = [];
    
    // Strategi A: Cari berdasarkan nama wilayah/desa
    const { data: nameData } = await supabase
      .from('wilayah')
      .select('nama, kecamatan, kabupaten, provinsi, lat, lon, level')
      .ilike('nama', `%${queryStr}%`)
      .order('level', { ascending: true })
      .limit(5);

    if (nameData && nameData.length > 0) {
      finalRows = nameData;
    } else {
      // Strategi B: Jika nama desa kosong, cari berdasarkan nama kecamatan
      console.log("Coba cari di kolom kecamatan...");
      const { data: kecData } = await supabase
        .from('wilayah')
        .select('nama, kecamatan, kabupaten, provinsi, lat, lon, level')
        .ilike('kecamatan', `%${queryStr}%`)
        .limit(5);
        
      if (kecData && kecData.length > 0) finalRows = kecData;
    }

    // 3. PROSES & SERAGAMKAN DATA JIKA DI DATABASE LOKAL ADA
    if (finalRows.length > 0) {
      const formattedData = finalRows.map(row => ({
        source: 'local',
        lat: row.lat,
        lon: row.lon,
        display_name: row.level === 'kecamatan'
          ? `Kec. ${row.nama}, ${row.kabupaten}, ${row.provinsi}`
          : `${row.nama}, Kec. ${row.kecamatan}, ${row.kabupaten}`
      }));

      // Simpan hasil array ke cache
      searchCache.set(cacheKey, { data: formattedData, timestamp: Date.now() });
      
      return NextResponse.json({ success: true, data: formattedData });
    }

    // 4. FALLBACK: JIKA DI DATABASE KOSONG, PANGGIL NOMINATIM OPENSTREETMAP
    console.log("⚠️ Tidak ada di database lokal, melempar pencarian ke Nominatim...");
    const nominatimResponse = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryStr)}&countrycodes=id&limit=4`,
      { headers: { 'User-Agent': 'SetempatID_App' } }
    );
    
    if (nominatimResponse.ok) {
      const nominatimData = await nominatimResponse.json();
      const formattedNominatim = nominatimData.map(item => ({
        source: 'nominatim',
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        display_name: item.display_name
      }));

      // Simpan hasil Nominatim ke cache agar hemat bandwidth
      searchCache.set(cacheKey, { data: formattedNominatim, timestamp: Date.now() });

      return NextResponse.json({ success: true, data: formattedNominatim });
    }

    // Jika semua jalan buntu, kembalikan array kosong (Aman, tidak bikin modal crash)
    return NextResponse.json({ success: true, data: [] });
    
  } catch (error) {
    console.error("❌ Error di API search wilayah:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}