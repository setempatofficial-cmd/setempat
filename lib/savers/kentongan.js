// lib/savers/kentongan.js (FINAL - DIPERBAIKI)
import { createClient } from '@supabase/supabase-js';
import { extractSignalFromText } from '@/lib/signal-extractor';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ✅ Ekstrak lokasi dari teks (desa/kecamatan)
function extractLocationFromText(text) {
  const locations = [
    'Prigen', 'Pandaan', 'Bangil', 'Gempol', 'Purwodadi', 'Tutur',
    'Pasrepan', 'Winongan', 'Grati', 'Nguling', 'Lekok', 'Rejoso',
    'Purwosari', 'Rembang', 'Kraton', 'Beji', 'Wonorejo', 'Tosari', 'Lumbang'
  ];
  
  for (const loc of locations) {
    if (text.includes(loc)) return loc;
  }
  return null;
}

// ✅ Cek kelayakan masuk kentongan
function isEligibleForKentongan(signalType, title, content) {
  const fullText = (title + ' ' + content).toLowerCase();
  
  const emergencyKeywords = ['kecelakaan', 'korban', 'tewas', 'luka', 'tabrakan', 'banjir', 'longsor', 'kebakaran'];
  for (const kw of emergencyKeywords) {
    if (fullText.includes(kw)) {
      console.log(`✅ Eligible (emergency keyword): ${kw}`);
      return true;
    }
  }
  
  const urgentTypes = ['kecelakaan', 'banjir', 'longsor', 'kebakaran', 'macet'];
  if (urgentTypes.includes(signalType)) return true;
  
  return false;
}

export async function saveToKentongan(article, signal = null) {
  const extractedSignal = signal || extractSignalFromText(article.title, article.content || '');
  
  if (!extractedSignal || !isEligibleForKentongan(extractedSignal.signalType, article.title, article.content || '')) {
    console.log(`⏭️ Skip kentongan: ${article.title?.substring(0, 40)}...`);
    return false;
  }
  
  // CEK DUPLIKAT (berdasarkan title, dalam 24 jam)
  const { data: existing } = await supabaseAdmin
    .from('kentongan')
    .select('id')
    .ilike('title', `%${article.title.substring(0, 50)}%`)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .maybeSingle();

  if (existing) {
    console.log(`⏭️ Duplicate kentongan: ${article.title.substring(0, 50)}...`);
    return false;
  }
  
  // Ekstrak lokasi dari teks
  const locationName = extractLocationFromText(article.content || article.title) || null;
  
  // Format content
  let contentText = (article.content || article.title).substring(0, 500);
  contentText = contentText.replace(/https?:\/\/[^\s]+/g, '');
  
  // Tentukan urgency
  const isUrgent = extractedSignal.isUrgent || /(kecelakaan|bencana|darurat|korban|tewas)/i.test(article.title);
  
  // ✅ Icon dengan fallback
  const icon = extractedSignal?.icon || '📰';
  
  // ✅ Tentukan is_global: true jika tidak ada lokasi spesifik
  const hasLocation = locationName && locationName !== 'Pasuruan Raya';
  const isGlobal = !hasLocation;
  
  const kentonganData = {
    title: `${icon} ${article.title.substring(0, 120)}`,
    content: contentText,
    is_pinned: isUrgent,
    is_urgent: isUrgent,
    is_active: true,
    urgency: isUrgent ? 'high' : 'medium',
    type: extractedSignal.signalType === 'event' ? 'event' : 'info',
    source: article.source || 'System',
    source_name: article.source_name || article.source,
    image_url: article.image_url,
    link: article.url,
    is_global: isGlobal,
    target_desa: hasLocation ? locationName : null,
    target_kecamatan: null,  // Bisa diisi dari database desa nanti
    target_radius: hasLocation ? 5 : null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  const { error } = await supabaseAdmin
    .from('kentongan')
    .insert([kentonganData]);
  
  if (error) {
    console.error('❌ Kentongan error:', error.message);
    return false;
  }
  
  console.log(`🚨 Kentongan saved: ${article.title.substring(0, 50)}... (lokasi: ${locationName || 'Global'})`);
  return true;
}