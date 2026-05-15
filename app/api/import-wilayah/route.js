// app/api/import-wilayah/route.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ==================== AMBIL DATA DARI API EKSTERNAL ====================
async function fetchProvinces() {
  const response = await fetch('https://emsifa.github.io/api-wilayah-indonesia/api/provinces.json');
  return response.json();
}

async function fetchRegencies(provinceId) {
  const response = await fetch(`https://emsifa.github.io/api-wilayah-indonesia/api/regencies/${provinceId}.json`);
  return response.json();
}

async function fetchDistricts(regencyId) {
  const response = await fetch(`https://emsifa.github.io/api-wilayah-indonesia/api/districts/${regencyId}.json`);
  return response.json();
}

async function fetchVillages(districtId) {
  const response = await fetch(`https://emsifa.github.io/api-wilayah-indonesia/api/villages/${districtId}.json`);
  return response.json();
}

// ==================== TARGET WILAYAH ====================
// Kode wilayah Pasuruan
const TARGET_REGENCIES = [
  { id: '3514', name: 'Kabupaten Pasuruan' },
  { id: '3575', name: 'Kota Pasuruan' }
];

// ==================== MAIN HANDLER ====================
export async function GET(request) {
  console.log("🚀 Memulai import data wilayah (Pasuruan Kabupaten & Kota)...");
  
  try {
    let totalInserted = 0;
    let errors = [];
    
    // 1. Ambil semua provinsi
    const provinces = await fetchProvinces();
    
    // 2. Cari provinsi Jawa Timur (kode: 35)
    const jatim = provinces.find(p => p.id === '35');
    
    if (!jatim) {
      throw new Error('Provinsi Jawa Timur tidak ditemukan');
    }
    
    console.log(`📍 Provinsi: ${jatim.name}`);
    
    // 3. Ambil semua kabupaten di Jawa Timur
    const allRegencies = await fetchRegencies(jatim.id);
    
    // 4. Filter hanya Pasuruan Kabupaten dan Kota
    const targetRegencies = allRegencies.filter(r => 
      r.id === '3514' || r.id === '3575'
    );
    
    console.log(`📍 Target kabupaten/kota: ${targetRegencies.map(r => r.name).join(', ')}`);
    
    for (const regency of targetRegencies) {
      console.log(`\n📌 Memproses: ${regency.name} (${regency.id})`);
      
      // 5. Ambil kecamatan per kabupaten
      const districts = await fetchDistricts(regency.id);
      console.log(`   📍 Ditemukan ${districts.length} kecamatan`);
      
      for (const district of districts) {
        console.log(`     📍 Kecamatan: ${district.name}`);
        
        // 6. Ambil desa per kecamatan
        const villages = await fetchVillages(district.id);
        console.log(`        📍 ${villages.length} desa/kelurahan`);
        
        for (const village of villages) {
          // Insert ke database
          const { error } = await supabase.from('wilayah').insert({
            kode: village.id,
            nama: village.name,
            kecamatan: district.name,
            kabupaten: regency.name,
            provinsi: jatim.name,
            level: 'desa'
          });
          
          if (error) {
            if (error.code !== '23505') { // Skip duplicate error
              errors.push({ kode: village.id, error: error.message });
            }
          } else {
            totalInserted++;
          }
          
          // Delay kecil untuk menghindari rate limit
          await new Promise(r => setTimeout(r, 5));
        }
        
        // Delay antar kecamatan
        await new Promise(r => setTimeout(r, 100));
      }
    }
    
    console.log(`\n✅ Import selesai!`);
    console.log(`📊 Total desa/kelurahan di Pasuruan: ${totalInserted}`);
    
    return Response.json({
      success: true,
      totalInserted,
      location: 'Kabupaten & Kota Pasuruan',
      errors: errors.slice(0, 10),
      message: `Berhasil mengimport ${totalInserted} data desa/kelurahan se-Pasuruan`
    });
    
  } catch (error) {
    console.error("❌ Import error:", error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}