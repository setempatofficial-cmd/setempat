// lib/savers/kabar-bakul.js
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function saveToKabarBakul(article, matchResult) {
  const kabarData = {
    jenis_kabar: 'ekonomi',
    sumber: article.source,
    judul: article.title.substring(0, 150),
    konten: (article.summary || article.title).substring(0, 300),
    gambar_url: article.image_url,
    is_global: !matchResult,
    target_lokasi: matchResult?.tempat.name || null,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  const { error } = await supabaseAdmin.from('kabar_bakul').insert([kabarData]);
  if (error) {
    console.error('Save to kabar_bakul error:', error);
    return false;
  }
  console.log(`✅ Saved to kabar_bakul: ${article.title.substring(0, 50)}...`);
  return true;
}