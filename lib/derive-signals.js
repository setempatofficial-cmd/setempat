// lib/derive-signals.js

/**
 * Derive secondary signals from main event
 * @param {Object} signal - Hasil dari extractSignalFromText
 * @param {string} location - Lokasi kejadian (Prigen, Bangil, dll)
 * @returns {Array} Array of derived signals
 */
export function deriveSecondarySignals(signal, location) {
  const derivedSignals = [];
  
  if (!signal || !location) return derivedSignals;
  
  // ========== KECELAKAAN ==========
  if (signal.signalType === 'kecelakaan') {
    // 1. Macet
    derivedSignals.push({
      title: `🚗 Macet di ${location}`,
      content: `Kecelakaan menyebabkan kemacetan di sekitar ${location}. Waspada dan cari jalur alternatif.`,
      signalType: 'macet',
      isUrgent: true,
      confidence: 0.85
    });
    
    // 2. Ramai / Padat
    derivedSignals.push({
      title: `👥 Lalu lintas padat di ${location}`,
      content: `Akibat kecelakaan, arus lalu lintas di ${location} menjadi padat merayap.`,
      signalType: 'ramai',
      isUrgent: false,
      confidence: 0.75
    });
    
    // 3. Antrian (jika di jalan utama)
    derivedSignals.push({
      title: `⏳ Antrean panjang di ${location}`,
      content: `Kendaraan mengantre panjang akibat kecelakaan di ${location}.`,
      signalType: 'antri',
      isUrgent: false,
      confidence: 0.7
    });
  }
  
  // ========== BANJIR ==========
  if (signal.signalType === 'banjir') {
    derivedSignals.push({
      title: `🌊 Genangan air di ${location}`,
      content: `Banjir menyebabkan genangan air di beberapa titik di ${location}. Hati-hati melintas.`,
      signalType: 'banjir',
      isUrgent: true,
      confidence: 0.9
    });
    
    derivedSignals.push({
      title: `🚗 Macet di ${location}`,
      content: `Banjir mengakibatkan kemacetan di sekitar ${location}.`,
      signalType: 'macet',
      isUrgent: false,
      confidence: 0.8
    });
  }
  
  // ========== MACET (langsung) ==========
  if (signal.signalType === 'macet') {
    derivedSignals.push({
      title: `⏳ Antrean panjang di ${location}`,
      content: `Kemacetan parah di ${location}, kendaraan mengantre panjang.`,
      signalType: 'antri',
      isUrgent: false,
      confidence: 0.8
    });
  }
  
  // ========== LONGSOR ==========
  if (signal.signalType === 'longsor') {
    derivedSignals.push({
      title: `🚧 Akses tertutup di ${location}`,
      content: `Longsor menutup akses jalan di ${location}. Cari jalur alternatif.`,
      signalType: 'macet',
      isUrgent: true,
      confidence: 0.9
    });
  }
  
  return derivedSignals;
}

/**
 * Simpan derived signals ke external_signals
 * @param {Array} derivedSignals - Hasil dari deriveSecondarySignals
 * @param {Object} matchResult - Hasil matching lokasi
 * @param {string} originalUrl - URL sumber berita
 */
export async function saveDerivedSignals(derivedSignals, matchResult, originalUrl, supabaseAdmin) {
  let saved = 0;
  
  for (const sig of derivedSignals) {
    // Cek duplikat (dalam 24 jam, berdasarkan title)
    const { data: existing } = await supabaseAdmin
      .from('external_signals')
      .select('id')
      .eq('title', sig.title)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .maybeSingle();
    
    if (existing) {
      console.log(`⏭️ Skip derived duplicate: ${sig.title}`);
      continue;
    }
    
    const signalData = {
      tempat_id: matchResult?.tempat?.id || null,
      source: 'Derived',
      source_platform: 'WartaBromo',
      content: sig.content,
      original_text: sig.title,
      post_url: originalUrl,
      confidence: sig.confidence || 0.7,
      source_tier: 2,
      verification_level: 'medium',
      created_at: new Date().toISOString(),
      fetched_at: new Date().toISOString()
    };
    
    const { error } = await supabaseAdmin
      .from('external_signals')
      .insert(signalData);
    
    if (error) {
      console.error(`❌ Failed to save derived signal: ${sig.title}`, error.message);
    } else {
      console.log(`📡 Derived signal saved: "${sig.title}"`);
      saved++;
    }
  }
  
  return saved;
}