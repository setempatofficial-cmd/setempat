// app/api/google-reviews/route.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const tempatId = searchParams.get('tempatId');
  const placeId = searchParams.get('placeId');
  
  if (!tempatId || !placeId) {
    return Response.json({ error: 'tempatId dan placeId required' }, { status: 400 });
  }
  
  try {
    // Panggil Google Places API
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews,rating&language=id&key=${process.env.GOOGLE_PLACES_API_KEY}`
    );
    
    const data = await response.json();
    const reviews = data.result?.reviews || [];
    
    let inserted = 0;
    
    for (const review of reviews) {
      // Cek apakah sudah ada (based on source_id)
      const { data: existing } = await supabase
        .from('external_signals')
        .select('id')
        .eq('source_id', `${placeId}_${review.time}`)
        .single();
      
      if (existing) continue; // Skip jika sudah ada
      
      // Insert ke external_signals
      const { error } = await supabase
        .from('external_signals')
        .insert({
          tempat_id: parseInt(tempatId),
          source: 'google_review',
          source_id: `${placeId}_${review.time}`,
          username: review.author_name,
          content: review.text,
          source_tier: 2,
          source_platform: 'google_maps',
          confidence: 0.8,
          verified: true,
          verification_level: 'high',
          has_image: review.relative_time_description ? false : false,
          created_at: new Date(review.time * 1000).toISOString(),
          fetched_at: new Date().toISOString()
        });
      
      if (error) {
        console.error('Error insert:', error);
      } else {
        inserted++;
        console.log(`✅ Review dari ${review.author_name} disimpan`);
      }
      
      // Delay biar tidak kena rate limit
      await new Promise(r => setTimeout(r, 100));
    }
    
    return Response.json({ 
      success: true, 
      inserted,
      total_reviews: reviews.length,
      message: `Berhasil menyimpan ${inserted} review Google`
    });
    
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}