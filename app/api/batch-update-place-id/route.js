// app/api/batch-update-place-id/route.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET() {
  console.log('🚀 Memulai batch update google_place_id...');
  
  // Ambil semua tempat yang belum punya google_place_id
  const { data: tempatList, error } = await supabase
    .from('tempat')
    .select('id, name, alamat, latitude, longitude')
    .is('google_place_id', null)
    .limit(50); // Batasi 50 dulu untuk testing
  
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  
  console.log(`📌 Ditemukan ${tempatList.length} tempat tanpa google_place_id`);
  
  let updated = 0;
  let failed = 0;
  
  for (const tempat of tempatList) {
    try {
      const searchQuery = `${tempat.name} ${tempat.alamat || ''}`;
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(searchQuery)}&inputtype=textquery&fields=place_id&key=${process.env.GOOGLE_PLACES_API_KEY}`
      );
      
      const data = await response.json();
      const placeId = data.candidates?.[0]?.place_id;
      
      if (placeId) {
        const { error: updateError } = await supabase
          .from('tempat')
          .update({ google_place_id: placeId })
          .eq('id', tempat.id);
        
        if (updateError) {
          console.error(`❌ Gagal update ${tempat.name}:`, updateError);
          failed++;
        } else {
          console.log(`✅ ${tempat.name} -> ${placeId}`);
          updated++;
        }
      } else {
        console.log(`⚠️ Tidak ditemukan: ${tempat.name}`);
        failed++;
      }
      
      // Delay 200ms biar tidak kena rate limit
      await new Promise(r => setTimeout(r, 200));
      
    } catch (err) {
      console.error(`❌ Error: ${tempat.name}`, err);
      failed++;
    }
  }
  
  console.log(`\n📊 Selesai! Updated: ${updated}, Failed: ${failed}`);
  
  return Response.json({
    success: true,
    updated,
    failed,
    total: tempatList.length
  });
}