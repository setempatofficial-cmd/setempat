import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const fetchWithTimeout = async (url: string, options: any, timeoutMs = 5000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const RAPIDAPI_KEY = Deno.env.get('RAPIDAPI_KEY');

  try {
    // HANYA AMBIL 3 TEMPAT DULU UNTUK TESTING
    const { data: places, error: placesError } = await supabase
      .from('tempat')
      .select('id, name, instagram_handle, news_keywords')
      .limit(1); // BATASI JUMLAH

    if (placesError) throw placesError;

    let totalSaved = 0;

    for (const place of places) {
      const signals = [];

      // Instagram
      if (place.instagram_handle && RAPIDAPI_KEY) {
        try {
          const res = await fetchWithTimeout(
            `https://instagram-looper.p.rapidapi.com/user_posts?username=${place.instagram_handle}`,
            {
              headers: {
                'X-RapidAPI-Key': RAPIDAPI_KEY,
                'X-RapidAPI-Host': 'instagram-scraper-stable-api.p.rapidapi.com'
              }
            },
            5000
          );
          
          const data = await res.json();
          const items = data.items?.slice(0, 1) || []; // AMBIL 1 SAJA

          items.forEach((item: any) => {
            signals.push({
              tempat_id: place.id,
              platform: 'instagram',
              username: place.instagram_handle,
              content: item.caption?.text || '',
              media_url: item.image_versions2?.candidates?.[0]?.url,
              post_url: `https://instagram.com/p/${item.code}`,
              likes_count: item.like_count || 0,
              posted_at: new Date(item.taken_at * 1000).toISOString()
            });
          });
        } catch (e) { console.error(`IG Error [${place.name}]:`, e); }
      }

      // News
      if (place.news_keywords) {
        try {
          const query = encodeURIComponent(place.news_keywords);
          const newsRes = await fetchWithTimeout(
            `https://news.google.com/rss/search?q=${query}&hl=id&gl=ID&ceid=ID:id`,
            {},
            3000
          );
          
          const xml = await newsRes.text();
          const title = xml.match(/<title>(.*?)<\/title>/g)?.[1]?.replace(/<\/?title>/g, '');
          const link = xml.match(/<link>(.*?)<\/link>/g)?.[1]?.replace(/<\/?link>/g, '');

          if (title && !title.includes("Google News")) {
            signals.push({
              tempat_id: place.id,
              platform: 'news',
              content: title,
              post_url: link,
              posted_at: new Date().toISOString()
            });
          }
        } catch (e) { console.error(`News Error [${place.name}]:`, e); }
      }

      // Simpan
      if (signals.length > 0) {
        const { error: upsertError } = await supabase
          .from('medsos_post')
          .upsert(signals, { onConflict: 'post_url' });
        
        if (!upsertError) totalSaved += signals.length;
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Berhasil mengumpulkan ${totalSaved} konten baru.` 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
})