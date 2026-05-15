// app/api/wilayah/sync-geografis/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import geografis from 'geografis';

export async function POST(req) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // Ambil semua kode yang ada di database (Pasuruan)
    const { data: existingCodes, error: fetchError } = await supabase
      .from('wilayah')
      .select('kode');
    
    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }
    
    const existingKodeSet = new Set(existingCodes.map(c => c.kode));
    
    const allData = geografis.dump();
    
    let updated = 0;
    let notFound = 0;
    let matched = 0;
    
    for (const data of allData) {
      // Filter hanya Pasuruan
      if (!data.code.startsWith('35.14') && !data.code.startsWith('35.75')) {
        continue;
      }
      
      const kodeTanpaTitik = data.code.replace(/\./g, '');
      
      if (existingKodeSet.has(kodeTanpaTitik)) {
        matched++;
        
        const { error } = await supabase
          .from('wilayah')
          .update({ lat: data.latitude, lon: data.longitude })
          .eq('kode', kodeTanpaTitik);
        
        if (error) {
          notFound++;
        } else {
          updated++;
        }
      }
    }
    
    return NextResponse.json({ 
      success: true,
      message: 'Sinkronisasi koordinat selesai',
      total_di_database: existingKodeSet.size,
      matched: matched,
      updated: updated,
      notFound: notFound
    });
    
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}