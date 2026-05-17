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
    const nama = searchParams.get('nama');
    
    console.log("🔍 Mencari wilayah:", nama);
    
    if (!nama) {
      return NextResponse.json({ 
        success: false, 
        error: 'Parameter nama diperlukan' 
      }, { status: 400 });
    }
    
    // Cek cache
    const cacheKey = `search_${nama.toLowerCase()}`;
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log("📦 Menggunakan cache untuk:", nama);
      return NextResponse.json({ 
        success: true, 
        data: cached.data,
        cached: true 
      });
    }
    
    // Query ke tabel wilayah dengan multiple matching strategy
    let query = supabase
      .from('wilayah')
      .select('kode, nama, kecamatan, kabupaten, provinsi, lat, lon, kode_pos, level');
    
    // Coba cari dengan exact match dulu
    let { data, error } = await query
      .ilike('nama', `%${nama}%`)
      .order('level', { ascending: true }) // desa > kelurahan > kecamatan > kabupaten
      .limit(5);
    
    // Jika tidak ditemukan, coba cari di kecamatan
    if (!data || data.length === 0) {
      console.log("Tidak ditemukan di nama, coba di kecamatan:", nama);
      const { data: kecData, error: kecError } = await supabase
        .from('wilayah')
        .select('kode, nama, kecamatan, kabupaten, provinsi, lat, lon, kode_pos, level')
        .ilike('kecamatan', `%${nama}%`)
        .limit(5);
      
      if (!kecError && kecData && kecData.length > 0) {
        data = kecData;
      }
    }
    
    // Jika masih tidak ditemukan, coba di kabupaten
    if (!data || data.length === 0) {
      console.log("Tidak ditemukan di kecamatan, coba di kabupaten:", nama);
      const { data: kabData, error: kabError } = await supabase
        .from('wilayah')
        .select('kode, nama, kecamatan, kabupaten, provinsi, lat, lon, kode_pos, level')
        .ilike('kabupaten', `%${nama}%`)
        .limit(5);
      
      if (!kabError && kabData && kabData.length > 0) {
        data = kabData;
      }
    }
    
    if (error) {
      console.error("Database error:", error);
      return NextResponse.json({ 
        success: false, 
        error: 'Database query error: ' + error.message 
      }, { status: 500 });
    }
    
    if (!data || data.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: `Wilayah "${nama}" tidak ditemukan di database` 
      }, { status: 404 });
    }
    
    // Ambil yang pertama (paling relevan)
    const result = data[0];
    
    // Validasi koordinat
    if (!result.lat || !result.lon) {
      console.warn(`⚠️ Wilayah ${result.nama} tidak memiliki koordinat`);
    }
    
    console.log("✅ Wilayah ditemukan:", result.nama, "| Kode:", result.kode);
    
    // Simpan ke cache
    searchCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });
    
    return NextResponse.json({ 
      success: true, 
      data: result 
    });
    
  } catch (error) {
    console.error("❌ Error di API search wilayah:", error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error: ' + error.message 
    }, { status: 500 });
  }
}