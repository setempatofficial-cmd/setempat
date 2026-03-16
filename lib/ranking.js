// lib/ranking.js
import { calculateDistance } from './distance';

export function calculateScore(item, location) {
  let score = 0;
  const now = Date.now();
  
  // ============================================
  // 1. FAKTOR JARAK (0–100 poin) - bobot 30%
  // ============================================
  if (location && item.latitude && item.longitude) {
    const distance = calculateDistance(
      location.latitude,
      location.longitude,
      item.latitude,
      item.longitude
    );
    
    // Threshold-based lebih realistik untuk kota
    let distanceScore = 0;
    if (distance <= 0.5) distanceScore = 100;       // 0-500m: 100
    else if (distance <= 1) distanceScore = 90;      // 500m-1km: 90
    else if (distance <= 2) distanceScore = 80;      // 1-2km: 80
    else if (distance <= 3) distanceScore = 70;      // 2-3km: 70
    else if (distance <= 5) distanceScore = 50;      // 3-5km: 50
    else if (distance <= 10) distanceScore = 30;     // 5-10km: 30
    else distanceScore = 10;                          // >10km: 10
    
    score += distanceScore * 0.3;
  } else {
    // Tanpa lokasi, tetap dapat skor dasar
    score += 50 * 0.3;
  }
  
  // ============================================
  // 2. AKTIVITAS INTERNAL (0–100 poin) - bobot 40%
  // ============================================
  let activityScore = 0;
  
  const oneHourAgo = now - (60 * 60 * 1000);
  const threeHoursAgo = now - (3 * 60 * 60 * 1000);
  const sixHoursAgo = now - (6 * 60 * 60 * 1000);
  const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
  
  // 2a. Komentar terbaru (internal)
  const komentarBaru = (item.testimonial_terbaru || []).filter(k => 
    new Date(k.created_at).getTime() > oneHourAgo
  ).length;
  const komentarHariIni = (item.testimonial_terbaru || []).filter(k => 
    new Date(k.created_at).getTime() > twentyFourHoursAgo
  ).length;
  
  activityScore += Math.min(20, komentarBaru * 10);
  activityScore += Math.min(15, komentarHariIni * 2);
  
  // 2b. Laporan terbaru (internal)
  const laporanBaru = (item.laporan_terbaru || []).filter(l => 
    new Date(l.created_at).getTime() > oneHourAgo
  ).length;
  const laporanHariIni = (item.laporan_terbaru || []).filter(l => 
    new Date(l.created_at).getTime() > twentyFourHoursAgo
  ).length;
  
  activityScore += Math.min(30, laporanBaru * 15);
  activityScore += Math.min(15, laporanHariIni * 3);
  
  // 2c. Vibe count (popularitas historis)
  const vibeCount = parseInt(item.vibe_count) || 0;
  activityScore += Math.min(20, vibeCount * 0.5);
  
  // 2d. Estimasi orang (jika ada)
  const estimasiOrang = parseInt(item.estimasi_orang) || 0;
  activityScore += Math.min(20, estimasiOrang * 0.3);
  
  activityScore = Math.min(100, activityScore);
  score += activityScore * 0.4;
  
  // ============================================
  // 3. EKSTERNAL SIGNAL - "SEDIKIT TAPI BERBOBOT" (0–100 poin) - bobot 15%
  // ============================================
  let externalScore = 0;
  const externalSignals = item.external_signals_terbaru || [];
  
  // Hanya 24 jam terakhir (relevansi waktu)
  const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
  const recentExternal = externalSignals.filter(s => 
    new Date(s.created_at) > oneDayAgo
  );
  
  if (recentExternal.length > 0) {
    // Kategorikan berdasarkan KEPERCAYAAN sumber
    const kategoriSumber = {
      // TIER 1: Institusi resmi (Dishub, BMKG, Polsek, Pemda)
      tier1: recentExternal.filter(s => 
        s.source_tier === 1 || 
        ['dishub', 'bmkg', 'polsek', 'pemda', 'kelurahan', 'satlantas'].includes(s.source_type)
      ),
      
      // TIER 2: Akun resmi tempat/venue (IG/TikTok/FB resmi)
      tier2: recentExternal.filter(s => 
        s.source_tier === 2 ||
        s.is_official_place_account === true ||
        (s.source_platform === 'instagram' && s.verified_account === true) ||
        (s.source_platform === 'tiktok' && s.verified_account === true) ||
        (s.source_platform === 'facebook' && s.verified_account === true)
      ),
      
      // TIER 3: Media lokal terpercaya
      tier3: recentExternal.filter(s => 
        s.source_tier === 3 ||
        ['radar_pasuruan', 'jawapos', 'antara', 'detik_jatim'].includes(s.source_name)
      ),
      
      // TIER 4: Warga terverifikasi (punya history baik)
      tier4: recentExternal.filter(s => 
        s.source_tier === 4 ||
        (s.source_type === 'warga' && s.verification_level === 'high')
      ),
      
      // TIER 5: Lainnya (termasuk medsos random)
      tier5: recentExternal.filter(s => 
        !s.source_tier && 
        !s.is_official_place_account &&
        s.verification_level !== 'high'
      )
    };
    
    // Hitung skor dengan bobot per tier
    let tierScore = 0;
    
    // TIER 1: +30 per signal (maks 60)
    tierScore += Math.min(60, kategoriSumber.tier1.length * 30);
    
    // TIER 2: +20 per signal (maks 50)
    tierScore += Math.min(50, kategoriSumber.tier2.length * 20);
    
    // TIER 3: +12 per signal (maks 36)
    tierScore += Math.min(36, kategoriSumber.tier3.length * 12);
    
    // TIER 4: +6 per signal (maks 24)
    tierScore += Math.min(24, kategoriSumber.tier4.length * 6);
    
    // TIER 5: +2 per signal (maks 10, hanya sebagai pengisi)
    tierScore += Math.min(10, kategoriSumber.tier5.length * 2);
    
    // BONUS: Signal dengan bukti foto/video
    const adaBukti = recentExternal.filter(s => 
      s.has_image || s.has_video || (s.media_urls && s.media_urls.length > 0)
    ).length;
    
    if (adaBukti > 0) {
      tierScore += Math.min(20, adaBukti * 10);
    }
    
    // BONUS: Signal terverifikasi
    const terverifikasi = recentExternal.filter(s => s.verified === true).length;
    if (terverifikasi > 0) {
      tierScore += Math.min(15, terverifikasi * 8);
    }
    
    // BONUS: Signal dari platform prioritas (IG, TikTok, FB)
    const platformPrioritas = recentExternal.filter(s => 
      ['instagram', 'tiktok', 'facebook'].includes(s.source_platform)
    ).length;
    
    if (platformPrioritas > 0) {
      tierScore += Math.min(15, platformPrioritas * 3);
    }
    
    externalScore = Math.min(100, tierScore);
    
    // Validasi: Jika external tinggi tapi tidak ada konfirmasi internal, kurangi
    const adaInternal = (item.laporan_terbaru || []).length > 0 || 
                        (item.testimonial_terbaru || []).length > 0;
    
    if (!adaInternal && externalScore > 30) {
      externalScore = externalScore * 0.7; // Kurangi 30%
    }
  }
  
  score += externalScore * 0.15; // Bobot 15%
  
  // ============================================
  // 4. FRESHNESS (0–100 poin) - bobot 10%
  // ============================================
  let freshnessScore = 0;
  
  // Kumpulkan semua timestamp aktivitas
  const allTimestamps = [
    ...(item.testimonial_terbaru || []).map(t => new Date(t.created_at).getTime()),
    ...(item.laporan_terbaru || []).map(l => new Date(l.created_at).getTime()),
    ...(item.external_signals_terbaru || []).map(e => new Date(e.created_at).getTime()),
    new Date(item.updated_at || item.created_at || now).getTime()
  ].filter(Boolean);
  
  if (allTimestamps.length > 0) {
    const lastActivity = Math.max(...allTimestamps);
    const hoursAgo = (now - lastActivity) / (1000 * 60 * 60);
    
    if (hoursAgo < 1) {
      freshnessScore = 100;  // Baru saja
    } else if (hoursAgo < 3) {
      freshnessScore = 90 - (hoursAgo - 1) * 10;  // 90 → 70
    } else if (hoursAgo < 6) {
      freshnessScore = 70 - (hoursAgo - 3) * 10;  // 70 → 40
    } else if (hoursAgo < 12) {
      freshnessScore = 40 - (hoursAgo - 6) * 3;   // 40 → 22
    } else if (hoursAgo < 24) {
      freshnessScore = 22 - (hoursAgo - 12) * 1;  // 22 → 10
    } else if (hoursAgo < 48) {
      freshnessScore = 10 - (hoursAgo - 24) * 0.2; // 10 → 5
    } else {
      freshnessScore = 5;
    }
  } else {
    freshnessScore = 1;
  }
  
  score += Math.max(0, freshnessScore) * 0.1;
  
  // ============================================
  // 5. TRUST & VALIDITAS (0–100 poin) - bobot 5%
  // ============================================
  let trustScore = 20; // Default
  
  // Berdasarkan matching confidence (dari AI/scraping)
  if (item.matching_confidence) {
    if (item.matching_confidence > 0.9) {
      trustScore += 30;
    } else if (item.matching_confidence > 0.7) {
      trustScore += 20;
    } else if (item.matching_confidence > 0.5) {
      trustScore += 10;
    }
  }
  
  // External signals dengan confidence tinggi
  const highConfidenceExternal = (item.external_signals_terbaru || [])
    .filter(s => s.confidence > 0.8).length;
  trustScore += Math.min(20, highConfidenceExternal * 5);
  
  // Internal signals (lebih terpercaya)
  const internalSignals = (item.laporan_terbaru || []).length + 
                          (item.testimonial_terbaru || []).length;
  if (internalSignals > 0) {
    trustScore += Math.min(30, internalSignals * 2);
  }
  
  // Bonus untuk tempat dengan banyak vibe (trust by crowd)
  if (vibeCount > 20) {
    trustScore += 15;
  } else if (vibeCount > 10) {
    trustScore += 8;
  } else if (vibeCount > 5) {
    trustScore += 3;
  }
  
  trustScore = Math.min(100, trustScore);
  score += trustScore * 0.05; // Bobot 5%
  
  return Math.round(score);
}