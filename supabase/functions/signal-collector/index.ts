// supabase/functions/signal-collector/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2'

// CORS headers untuk izin akses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ============================================
// MOCK CONNECTOR - Instagram (sementara)
// ============================================
async function fetchInstagramMentions(tempat: any) {
  console.log(`🔍 [MOCK] Mencari mention Instagram untuk: ${tempat.name}`);
  
  // Data dummy untuk testing
  const mockSignals = [
    {
      source: 'instagram',
      source_id: `ig_${Date.now()}_1`,
      username: 'anakmuda_bangil',
      content: `Asik banget di ${tempat.name}! 🫶 #setempat #${tempat.name.replace(/\s+/g, '').toLowerCase()}`,
      media_url: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=500',
      post_url: 'https://instagram.com/p/example1',
      likes_count: Math.floor(Math.random() * 50) + 20,
      comments_count: Math.floor(Math.random() * 20) + 5,
      confidence: 0.95,
      created_at: new Date().toISOString(),
      fetched_at: new Date().toISOString()
    },
    {
      source: 'instagram',
      source_id: `ig_${Date.now()}_2`,
      username: 'kuliner_pasuruan',
      content: `Review ${tempat.name}: tempatnya cozy, cocok buat nongkrong! 👍`,
      media_url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=500',
      post_url: 'https://instagram.com/p/example2',
      likes_count: Math.floor(Math.random() * 80) + 30,
      comments_count: Math.floor(Math.random() * 30) + 8,
      confidence: 0.98,
      created_at: new Date().toISOString(),
      fetched_at: new Date().toISOString()
    }
  ];
  
  // Random: kadang return 1, kadang 2, kadang 0
  const random = Math.random();
  if (random < 0.3) {
    return [mockSignals[0]];
  } else if (random < 0.6) {
    return mockSignals;
  } else if (random < 0.8) {
    return [mockSignals[1]];
  } else {
    return [];
  }
}

async function fetchAllInstagramMentions(tempatList: any[]) {
  console.log(`🔍 [MOCK] Mencari mention Instagram untuk ${tempatList.length} tempat...`);
  
  let allSignals = [];
  for (const tempat of tempatList) {
    const signals = await fetchInstagramMentions(tempat);
    allSignals = [...allSignals, ...signals];
  }
  
  console.log(`✅ [MOCK] Ditemukan ${allSignals.length} mention Instagram`);
  return allSignals;
}
async function matchEntity(text: string, supabase: any) {
  // Panggil fungsi SQL yang sudah dibuat
  const { data, error } = await supabase
    .rpc('match_entity', { search_text: text });
    
  if (error || !data || data.length === 0) {
    return null;
  }
  
  return data[0];
}

// Di dalam fungsi fetchInstagramMentions, setelah dapat konten:
const match = await matchEntity(content, supabase);
let tempatId = null;
let confidence = 0;

if (match && match.confidence > 0.7) {
  tempatId = match.tempat_id;
  confidence = match.confidence;
} else {
  // Fallback ke pencarian biasa (jika ada)
}

// ============================================
// HANDLER UTAMA
// ============================================
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    // Buat Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    console.log('🔄 Mulai mengumpulkan signal eksternal...');

    // 1. Ambil semua tempat
    const { data: tempat, error: tempatError } = await supabase
      .from('tempat')
      .select('id, name, latitude, longitude');

    if (tempatError) throw tempatError;
    console.log(`✅ Mendapatkan ${tempat.length} tempat`);

    // 2. Kumpulkan signal dari Instagram
    console.log('🔍 Mencari mention Instagram...');
    const igSignals = await fetchAllInstagramMentions(tempat);
    console.log(`✅ Ditemukan ${igSignals.length} mention Instagram`);

    // 3. Simpan ke database (batch insert)
    if (igSignals.length > 0) {
      // Tambahkan tempat_id ke setiap signal
      const signalsToInsert = igSignals.map(signal => ({
        ...signal,
        tempat_id: signal.tempat_id || 1 // default ke ID 1 untuk testing
      }));

      const { error: insertError } = await supabase
        .from('external_signals')
        .insert(signalsToInsert);

      if (insertError) {
        console.error('❌ Gagal menyimpan ke database:', insertError);
        throw insertError;
      }
      console.log(`✅ Berhasil menyimpan ${igSignals.length} signal`);
    }

    // 4. (Nanti) Tambahkan TikTok, Berita, dll
    // const tiktokSignals = await fetchTikTokMentions(tempat);
    // ...

    const duration = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Signal collection completed. Added ${igSignals.length} Instagram signals.`,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});