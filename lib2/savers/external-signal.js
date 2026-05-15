// lib/savers/external-signal.js
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function saveToExternalSignal(signal, matchResult) {
  const signalData = {
    tempat_id: matchResult?.tempat.id || null,
    source: 'Pemkab Pasuruan',
    source_platform: 'Official Website',
    content: signal.title,
    original_text: signal.title,
    post_url: signal.url,
    source_tier: 1,
    verification_level: 'high',
    verified: true,
    confidence: matchResult ? matchResult.score / 100 : 0.5,
    matching_confidence: matchResult ? matchResult.score / 100 : null,
    fetched_at: new Date().toISOString(),
    created_at: new Date().toISOString()
  };
  
  const { error } = await supabaseAdmin
    .from('external_signals')
    .upsert(signalData, { onConflict: 'post_url' });
  
  if (error) {
    console.error('Save to external_signals error:', error);
    return false;
  }
  console.log(`✅ Saved to external_signals: ${signal.title.substring(0, 50)}...`);
  return true;
}