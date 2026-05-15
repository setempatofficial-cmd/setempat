// lib/savers/external-signal.js
import { createClient } from '@supabase/supabase-js';
import { extractSignalFromText } from '@/lib/signal-extractor';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Simpan ke external_signals (dengan ekstraksi signal otomatis)
 * @param {Object} article - { title, content, url, image_url, source, source_platform }
 * @param {Object} matchResult - { tempat, score }
 */
export async function saveToExternalSignal(article, matchResult) {
  if (!article.title || article.title.length < 10) {
    console.log('⚠️ Skipping: title too short');
    return false;
  }
  
  // ============================================
  // 1. EKSTRAK SIGNAL DARI TEKS
  // ============================================
  const fullText = (article.title + ' ' + (article.content || '')).trim();
  const extractedSignal = extractSignalFromText(article.title, article.content);
  
  let finalContent = article.title;
  let finalOriginalText = article.content || article.title;
  let confidence = matchResult ? matchResult.score / 100 : 0.7;
  let sourceTier = article.source === 'Pemkab Pasuruan' ? 1 : 3;
  let isSignal = false;
  
  // ============================================
  // 2. JIKA TERDETEKSI SIGNAL → GUNAKAN SIGNAL PENDEK
  // ============================================
  if (extractedSignal) {
    // ✅ Ini signal real-time (macet, kecelakaan, event, dll)
    finalContent = extractedSignal.signalText;  // "⚠️ Bangil: kecelakaan"
    finalOriginalText = article.title;          // Simpan judul asli di original_text
    confidence = extractedSignal.confidence;
    sourceTier = extractedSignal.isUrgent ? 1 : 2;
    isSignal = true;
    
    console.log(`📡 SIGNAL detected: "${finalContent}" (${extractedSignal.signalType})`);
  } 
  // ============================================
  // 3. JIKA BUKAN SIGNAL → BUAT RINGKASAN PENDEK
  // ============================================
  else {
    // Buat ringkasan pendek dari judul (max 100 karakter)
    finalContent = article.title.length > 100 
      ? article.title.substring(0, 97) + '...' 
      : article.title;
    
    console.log(`📰 News (non-signal): "${finalContent}"`);
  }
  
  // ============================================
  // 4. CEK DUPLIKAT (berdasarkan post_url)
  // ============================================
  if (article.url) {
    const { data: existing } = await supabaseAdmin
      .from('external_signals')
      .select('id')
      .eq('post_url', article.url)
      .maybeSingle();
    
    if (existing) {
      console.log(`⏭️ Skip duplicate: ${article.url}`);
      return false;
    }
  }
  
  // ============================================
  // 5. SAVE KE DATABASE
  // ============================================
  const signalData = {
    tempat_id: matchResult?.tempat?.id || null,
    matched_entity_id: matchResult?.tempat?.id || null,
    matching_confidence: matchResult ? matchResult.score / 100 : null,
    source: article.source,
    source_platform: article.source_platform || 'Website',
    content: finalContent,                        // ← SIGNAL PENDEK atau RINGKASAN
    original_text: finalOriginalText,             // ← TEKS ASLI (judul)
    post_url: article.url,
    media_url: article.image_url || null,
    confidence: confidence,
    source_tier: sourceTier,                      // 1=urgent, 2=signal biasa, 3=berita
    verification_level: article.source === 'Pemkab Pasuruan' ? 'high' : (isSignal ? 'medium' : 'low'),
    verified: article.source === 'Pemkab Pasuruan',
    has_image: !!article.image_url,
    fetched_at: new Date().toISOString(),
    created_at: new Date().toISOString()
  };
  
  const { error } = await supabaseAdmin
    .from('external_signals')
    .insert(signalData);
  
  if (error) {
    console.error('❌ Save error:', error.message);
    return false;
  }
  
  console.log(`✅ Saved: "${finalContent}"`);
  return true;
}

/**
 * Simpan multiple signals sekaligus
 */
export async function saveMultipleExternalSignals(articles, matchResults) {
  let saved = 0;
  let skipped = 0;
  
  for (let i = 0; i < articles.length; i++) {
    const match = matchResults?.find(m => m.article === articles[i]) || null;
    const result = await saveToExternalSignal(articles[i], match);
    if (result) saved++;
    else skipped++;
    
    // Delay untuk menghindari rate limit
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`📊 Batch save: ${saved} saved, ${skipped} skipped`);
  return { saved, skipped };
}