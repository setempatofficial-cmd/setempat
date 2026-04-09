import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const results = {
    env: {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasGroqKey: !!process.env.GROQ_API_KEY,
      supabaseUrlPrefix: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 20),
    },
    supabaseTest: null,
    tempatTest: null
  };

  // Test koneksi Supabase dengan service role
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // Test query ke tabel tempat
    const { data, error } = await supabase
      .from('tempat')
      .select('id, name, jam_buka')
      .limit(3);
    
    results.supabaseTest = {
      success: !error,
      error: error?.message,
      dataCount: data?.length
    };
    
    // Cek salah satu tempat yang punya jam_buka
    const tempatWithJamBuka = data?.find(t => t.jam_buka);
    if (tempatWithJamBuka) {
      results.tempatTest = {
        id: tempatWithJamBuka.id,
        name: tempatWithJamBuka.name,
        jamBuka: tempatWithJamBuka.jam_buka,
        jamBukaType: typeof tempatWithJamBuka.jam_buka
      };
    }
  }

  return Response.json(results);
}