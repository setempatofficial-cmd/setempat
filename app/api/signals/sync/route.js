// app/api/signals/sync/route.js (FINAL - DENGAN KENTONGAN)
import { createClient } from '@supabase/supabase-js';
import { EntityAliasManager } from '@/lib/alias-manager';
import { TempatValidator } from '@/lib/tempat-validator';
import { extractWartaBromo } from '@/lib/extractors/wartabromo';
import { extractPemkabSignals } from '@/lib/extractors/pemkab';
import { extractPemkotSignals } from '@/lib/extractors/pemkot';
import { extractSiskaperbapo } from '@/lib/extractors/siskaperbapo';
import { saveToExternalSignal } from '@/lib/savers/external-signal';
import { saveToKabarBakul, createKabarBakulFromWartaBromo, createKabarBakulFromPrice, createKabarBakulSummary } from '@/lib/savers/kabar-bakul';
import { saveToKentongan } from '@/lib/savers/kentongan'; // ✅ IMPORT
import { extractSignalFromText } from '@/lib/signal-extractor'; // ✅ IMPORT
import { deriveSecondarySignals, saveDerivedSignals } from '@/lib/derive-signals';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ✅ FUNGSI CEK KELAYAKAN KENTONGAN
function shouldGoToKentongan(signal, title = '', content = '') {
  const urgentTypes = ['kecelakaan', 'banjir', 'longsor', 'kebakaran', 'macet'];
  if (urgentTypes.includes(signal?.signalType)) return true;
  
  const fullText = (title + ' ' + content).toLowerCase();
  const isOfficial = /(pemkab|pemkot|bupati|walikota|dinas|kantor|kecamatan|desa)/i.test(fullText);
  const isInfoPublik = /(jadwal|pelayanan|pengumuman|imbauan|info|bantuan|vaksinasi)/i.test(fullText);
  const isImportantEvent = /(festival|pameran|resepsi|upacara|perayaan|hari besar|karnaval)/i.test(fullText);
  
  return (isOfficial && isInfoPublik) || isImportantEvent;
}

// ✅ FUNGSI CEK BERITA BIASA (SKIP)
function isNewsOnly(title, content = '') {
  const fullText = (title + ' ' + content).toLowerCase();
  const skipKeywords = ['profil', 'sejarah', 'wawancara', 'opini', 'tips', 'lowongan kerja', 'olahraga', 'sepak bola'];
  return skipKeywords.some(kw => fullText.includes(kw));
}

export async function GET(req) {
  try {
    console.log('🚀 Starting scheduled sync:', new Date().toISOString());
    
    const aliasManager = new EntityAliasManager(supabaseAdmin);
    await aliasManager.loadAliases();
    
    const { data: daftarTempat } = await supabaseAdmin
      .from('tempat')
      .select('id, name');
    
    console.log(`📋 Loaded ${daftarTempat?.length || 0} places`);
    
    const validator = new TempatValidator(daftarTempat || [], aliasManager);
    
    const stats = {
      wartabromo: { incident: 0, economy: 0, matched: 0, skipped: 0 },
      pemkab: { signals: 0, matched: 0, skipped: 0 },
      pemkot: { signals: 0, matched: 0, skipped: 0 },
      siskaperbapo: { items: 0 },
      saved: { external_signals: 0, kabar_bakul: 0, kentongan: 0 }
    };
    
    // ========== SYNC WARTA BROMO ==========
    console.log('\n📰 Fetching WartaBromo...');
    const { incidents, economies } = await extractWartaBromo();
    console.log(`📊 Found ${incidents.length} incidents, ${economies.length} economy news`);
    
    for (const incident of incidents) {
      if (isNewsOnly(incident.title, incident.content)) {
        stats.wartabromo.skipped++;
        continue;
      }
      
      const signal = extractSignalFromText(incident.title, incident.content);
      if (!signal) {
        stats.wartabromo.skipped++;
        continue;
      }
      
      const match = validator.matchLocation(incident.title, incident.content);
      if (!match) {
        stats.wartabromo.skipped++;
        continue;
      }
      
      if (shouldGoToKentongan(signal, incident.title, incident.content)) {
  // 1. Save ke Kentongan
  const saved = await saveToKentongan(incident, match);
  if (saved) stats.saved.kentongan++;
  
  // 2. Generate derived signals (macet, ramai, antri)
  const derivedSignals = deriveSecondarySignals(signal, signal.location);
  if (derivedSignals && derivedSignals.length > 0) {
    const derivedSaved = await saveDerivedSignals(derivedSignals, match, incident.url, supabaseAdmin);
    stats.saved.external_signals += derivedSaved;
    console.log(`📡 Derived signals saved: ${derivedSaved} from "${signal.signalType}"`);
  }
  
} else {
  // 3. Save ke External Signal
  const saved = await saveToExternalSignal({
    title: incident.title, url: incident.url, content: incident.content,
    image_url: incident.image_url, source: 'WartaBromo', source_platform: 'News Portal'
  }, signal);
  if (saved) stats.saved.external_signals++;
}
      
      stats.wartabromo.incident++;
      stats.wartabromo.matched++;
      await new Promise(r => setTimeout(r, 100));
    }
    
    for (const economy of economies) {
      const match = validator.matchLocation(economy.title);
      const kabarItem = createKabarBakulFromWartaBromo(economy, match);
      const saved = await saveToKabarBakul(kabarItem, match);
      if (saved) {
        stats.saved.kabar_bakul++;
        stats.wartabromo.economy++;
      }
      await new Promise(r => setTimeout(r, 100));
    }
    
    // ========== SYNC SISKAPERBAPO ==========
    console.log('\n📊 Fetching SISKAPERBAPO...');
    const hargaData = await extractSiskaperbapo();
    
    if (hargaData.success && hargaData.commodities?.length > 0) {
      for (const commodity of hargaData.commodities.slice(0, 5)) {
        const kabarItem = createKabarBakulFromPrice(commodity, 'Pasuruan Raya');
        const saved = await saveToKabarBakul(kabarItem, null);
        if (saved) {
          stats.saved.kabar_bakul++;
          stats.siskaperbapo.items++;
        }
        await new Promise(r => setTimeout(r, 100));
      }
    }
    
    // ========== SYNC PEMKAB ==========
    console.log('\n📰 Fetching Pemkab Pasuruan...');
    const pemkabSignals = await extractPemkabSignals();
    
    for (const signal of pemkabSignals) {
      if (isNewsOnly(signal.title, signal.content)) {
        stats.pemkab.skipped++;
        continue;
      }
      
      const extractedSignal = extractSignalFromText(signal.title, signal.content);
      if (!extractedSignal) {
        stats.pemkab.skipped++;
        continue;
      }
      
      const match = validator.matchLocation(signal.title);
      if (!match) {
        stats.pemkab.skipped++;
        continue;
      }
      
      if (shouldGoToKentongan(extractedSignal, signal.title, signal.content)) {
        const saved = await saveToKentongan({...signal, source: 'Pemkab Pasuruan'}, match);
        if (saved) stats.saved.kentongan++;
      } else {
        const saved = await saveToExternalSignal({
          title: signal.title, url: signal.url, content: signal.content || signal.title,
          source: 'Pemkab Pasuruan', source_platform: 'Official Website'
        }, match);
        if (saved) stats.saved.external_signals++;
      }
      
      stats.pemkab.signals++;
      stats.pemkab.matched++;
      await new Promise(r => setTimeout(r, 100));
    }
    
    // ========== SYNC PEMKOT ==========
    console.log('\n📰 Fetching Pemkot Pasuruan...');
    const pemkotSignals = await extractPemkotSignals();
    
    for (const signal of pemkotSignals) {
      if (isNewsOnly(signal.title, signal.content)) {
        stats.pemkot.skipped++;
        continue;
      }
      
      const extractedSignal = extractSignalFromText(signal.title, signal.content);
      if (!extractedSignal) {
        stats.pemkot.skipped++;
        continue;
      }
      
      const match = validator.matchLocation(signal.title);
      if (!match) {
        stats.pemkot.skipped++;
        continue;
      }
      
      // Pemkot biasanya info layanan, masuk external_signals (bukan kentongan)
      const saved = await saveToExternalSignal({
        title: signal.title, url: signal.url, content: signal.content || signal.title,
        source: 'Pemkot Pasuruan', source_platform: 'Google News'
      }, match);
      
      if (saved) {
        stats.saved.external_signals++;
        stats.pemkot.signals++;
        stats.pemkot.matched++;
      }
      await new Promise(r => setTimeout(r, 100));
    }
    
    console.log('\n✅ Sync completed:', stats);
    
    return Response.json({
      success: true,
      timestamp: new Date().toISOString(),
      stats: {
        wartabromo: {
          incident_found: stats.wartabromo.incident,
          economy_found: stats.wartabromo.economy,
          matched_locations: stats.wartabromo.matched,
          skipped: stats.wartabromo.skipped
        },
        pemkab: {
          signals_found: stats.pemkab.signals,
          matched_locations: stats.pemkab.matched,
          skipped: stats.pemkab.skipped
        },
        pemkot: {
          signals_found: stats.pemkot.signals,
          matched_locations: stats.pemkot.matched,
          skipped: stats.pemkot.skipped
        },
        siskaperbapo: { items_added: stats.siskaperbapo.items },
        saved: {
          to_external_signals: stats.saved.external_signals,
          to_kabar_bakul: stats.saved.kabar_bakul,
          to_kentongan: stats.saved.kentongan
        }
      }
    });
    
  } catch (error) {
    console.error('Sync error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}