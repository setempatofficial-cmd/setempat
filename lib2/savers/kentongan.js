// lib/savers/kentongan.js
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function saveToKentongan(article, matchResult) {
  const shortSummary = article.summary || article.title;
  const content = matchResult 
    ? `📍 *${matchResult.tempat.name}*\n\n${shortSummary}\n\n🔗 ${article.url}`
    : `📢 *Berita Terkini*\n\n${shortSummary}\n\n🔗 ${article.url}`;
  
  const kentonganData = {
    title: article.title.substring(0, 100),
    content: content.substring(0, 500),
    is_pinned: false,
    is_urgent: /(kecelakaan|bencana|darurat)/i.test(article.title),
    is_active: true,
    urgency: /(kecelakaan|bencana)/i.test(article.title) ? 'high' : 'medium',
    type: 'berita',
    source: 'wartabromo',
    source_name: 'WartaBromo',
    image_url: article.image_url,
    link: article.url,
    is_global: !matchResult,
    target_desa: matchResult?.tempat.name.split(' ')[0] || null,
    target_kecamatan: matchResult?.tempat.name.match(/kecamatan\s+(\w+)/i)?.[1] || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  const { error } = await supabaseAdmin.from('kentongan').insert([kentonganData]);
  if (error) {
    console.error('Save to kentongan error:', error);
    return false;
  }
  console.log(`✅ Saved to kentongan: ${article.title.substring(0, 50)}...`);
  return true;
}