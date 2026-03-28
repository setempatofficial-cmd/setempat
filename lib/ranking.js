// lib/ranking.js
import { calculateDistance } from './distance';

export function calculateScore(item, location) {
  let score = 0;
  const now = Date.now();
  
  // ============================================
  // 1. FAKTOR JARAK (0–100 poin) - bobot 20%
  // DITURUNKAN karena estimasi orang lebih penting
  // ============================================
  if (location && item.latitude && item.longitude) {
    const distance = calculateDistance(
      location.latitude,
      location.longitude,
      item.latitude,
      item.longitude
    );
    
    let distanceScore = 0;
    if (distance <= 0.5) distanceScore = 100;
    else if (distance <= 1) distanceScore = 90;
    else if (distance <= 2) distanceScore = 80;
    else if (distance <= 3) distanceScore = 70;
    else if (distance <= 5) distanceScore = 50;
    else if (distance <= 10) distanceScore = 30;
    else distanceScore = 10;
    
    score += distanceScore * 0.20;
  } else {
    score += 50 * 0.20;
  }
  
  // ============================================
  // 2. ESTIMASI DARI LAPORAN WARGA (PRIORITAS UTAMA) - bobot 35%
  // Data dari laporan warga lebih dipercaya daripada external signals
  // ============================================
  let estimasiScore = 0;
  
  // Ambil estimasi dari laporan terbaru (prioritas)
  const estimasiOrang = parseInt(item.latest_estimated_people) || 
                        parseInt(item.estimasi_orang) || 0;
  const estimasiTipe = item.latest_condition || item.tipe || null;
  const estimasiWaitTime = parseInt(item.latest_estimated_wait_time) || null;
  const estimasiRecent = item.latest_estimated_at && 
    (now - new Date(item.latest_estimated_at).getTime()) < (2 * 60 * 60 * 1000);
  
  if (estimasiOrang > 0) {
    // SKOR BERDASARKAN JUMLAH ORANG
    if (estimasiOrang <= 5) {
      estimasiScore = 20; // Sepi
    } else if (estimasiOrang <= 10) {
      estimasiScore = 35; // Sepi agak ramai
    } else if (estimasiOrang <= 15) {
      estimasiScore = 50; // Mulai ramai
    } else if (estimasiOrang <= 25) {
      estimasiScore = 70; // Ramai
    } else if (estimasiOrang <= 40) {
      estimasiScore = 85; // Sangat ramai
    } else {
      estimasiScore = 100; // Luar biasa ramai
    }
    
    // BONUS: Estimasi recent (< 2 jam) - karena dari laporan warga
    if (estimasiRecent) {
      estimasiScore = Math.min(100, estimasiScore + 20);
    }
    
    // BONUS: Kondisi Antri (lebih urgent)
    if (estimasiTipe === 'Antri') {
      estimasiScore = Math.min(100, estimasiScore + 15);
      
      // BONUS TAMBAHAN: Antrian panjang (>15 menit)
      if (estimasiWaitTime && estimasiWaitTime > 15) {
        estimasiScore = Math.min(100, estimasiScore + 10);
      } else if (estimasiWaitTime && estimasiWaitTime <= 5) {
        estimasiScore = Math.min(100, estimasiScore + 5); // Antrian pendek
      }
    }
    
    // BONUS: Kondisi Ramai dengan estimasi yang akurat
    if (estimasiTipe === 'Ramai' && estimasiOrang >= 10) {
      estimasiScore = Math.min(100, estimasiScore + 10);
    }
  } else {
    // Tanpa estimasi, skor dasar
    estimasiScore = 10;
  }
  
  score += estimasiScore * 0.35;
  
  // ============================================
  // 3. AKTIVITAS INTERNAL (laporan, komentar) - bobot 25%
  // ============================================
  let activityScore = 0;
  
  const oneHourAgo = now - (60 * 60 * 1000);
  const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
  
  // Laporan terbaru (prioritas tinggi karena ini dari warga)
  const laporanList = item.laporan_terbaru || [];
  const laporanBaru = laporanList.filter(l => 
    new Date(l.created_at).getTime() > oneHourAgo
  ).length;
  const laporanHariIni = laporanList.filter(l => 
    new Date(l.created_at).getTime() > twentyFourHoursAgo
  ).length;
  
  // Laporan dengan estimasi orang (lebih berbobot)
  const laporanDenganEstimasi = laporanList.filter(l => 
    l.estimated_people !== null && l.estimated_people !== undefined
  ).length;
  
  activityScore += Math.min(35, laporanBaru * 15);
  activityScore += Math.min(15, laporanHariIni * 3);
  activityScore += Math.min(20, laporanDenganEstimasi * 10);
  
  // Komentar terbaru
  const komentarList = item.testimonial_terbaru || [];
  const komentarBaru = komentarList.filter(k => 
    new Date(k.created_at).getTime() > oneHourAgo
  ).length;
  const komentarHariIni = komentarList.filter(k => 
    new Date(k.created_at).getTime() > twentyFourHoursAgo
  ).length;
  
  activityScore += Math.min(20, komentarBaru * 8);
  activityScore += Math.min(10, komentarHariIni * 2);
  
  // Vibe count (popularitas historis)
  const vibeCount = parseInt(item.vibe_count) || 0;
  activityScore += Math.min(15, vibeCount * 0.3);
  
  // Check-in / aktivitas
  const aktivitasList = item.aktivitas_terkini || [];
  const aktivitasBaru = aktivitasList.filter(a => 
    new Date(a.created_at).getTime() > oneHourAgo
  ).length;
  activityScore += Math.min(15, aktivitasBaru * 5);
  
  activityScore = Math.min(100, activityScore);
  score += activityScore * 0.25;
  
  // ============================================
  // 4. EKSTERNAL SIGNAL - bobot 12% (DITURUNKAN karena kurang dipercaya)
  // ============================================
  let externalScore = 0;
  const externalSignals = item.external_signals_terbaru || [];
  
  const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
  const recentExternal = externalSignals.filter(s => 
    new Date(s.created_at) > oneDayAgo
  );
  
  if (recentExternal.length > 0) {
    const kategoriSumber = {
      tier1: recentExternal.filter(s => 
        s.source_tier === 1 || 
        ['dishub', 'bmkg', 'polsek', 'pemda', 'kelurahan', 'satlantas'].includes(s.source_type)
      ),
      tier2: recentExternal.filter(s => 
        s.source_tier === 2 ||
        s.is_official_place_account === true ||
        (s.source_platform === 'instagram' && s.verified_account === true) ||
        (s.source_platform === 'tiktok' && s.verified_account === true)
      ),
      tier3: recentExternal.filter(s => 
        s.source_tier === 3 ||
        ['radar_pasuruan', 'jawapos', 'antara', 'detik_jatim'].includes(s.source_name)
      ),
      tier4: recentExternal.filter(s => 
        s.source_tier === 4 ||
        (s.source_type === 'warga' && s.verification_level === 'high')
      ),
      tier5: recentExternal.filter(s => 
        !s.source_tier && !s.is_official_place_account
      )
    };
    
    let tierScore = 0;
    tierScore += Math.min(50, kategoriSumber.tier1.length * 25);
    tierScore += Math.min(40, kategoriSumber.tier2.length * 15);
    tierScore += Math.min(30, kategoriSumber.tier3.length * 10);
    tierScore += Math.min(20, kategoriSumber.tier4.length * 5);
    tierScore += Math.min(10, kategoriSumber.tier5.length * 2);
    
    const adaBukti = recentExternal.filter(s => 
      s.has_image || s.has_video || (s.media_urls && s.media_urls.length > 0)
    ).length;
    if (adaBukti > 0) tierScore += Math.min(15, adaBukti * 5);
    
    externalScore = Math.min(100, tierScore);
    
    // Validasi: Jika external tinggi tapi tidak ada konfirmasi internal, kurangi drastis
    const adaInternal = (item.laporan_terbaru || []).length > 0 || 
                        (item.testimonial_terbaru || []).length > 0;
    
    if (!adaInternal && externalScore > 30) {
      externalScore = externalScore * 0.5; // Kurangi 50%
    }
  }
  
  score += externalScore * 0.12;
  
  // ============================================
  // 5. FRESHNESS - bobot 5%
  // ============================================
  let freshnessScore = 0;
  
  const allTimestamps = [
    ...(item.laporan_terbaru || []).map(l => new Date(l.created_at).getTime()),
    ...(item.testimonial_terbaru || []).map(t => new Date(t.created_at).getTime()),
    ...(externalSignals || []).map(e => new Date(e.created_at).getTime()),
    item.latest_estimated_at ? new Date(item.latest_estimated_at).getTime() : null,
    new Date(item.updated_at || item.created_at || now).getTime()
  ].filter(Boolean);
  
  if (allTimestamps.length > 0) {
    const lastActivity = Math.max(...allTimestamps);
    const hoursAgo = (now - lastActivity) / (1000 * 60 * 60);
    
    if (hoursAgo < 1) freshnessScore = 100;
    else if (hoursAgo < 3) freshnessScore = 80;
    else if (hoursAgo < 6) freshnessScore = 60;
    else if (hoursAgo < 12) freshnessScore = 40;
    else if (hoursAgo < 24) freshnessScore = 25;
    else if (hoursAgo < 48) freshnessScore = 15;
    else freshnessScore = 5;
  } else {
    freshnessScore = 1;
  }
  
  score += freshnessScore * 0.05;
  
  // ============================================
  // 6. TRUST & VALIDITAS - bobot 3%
  // ============================================
  let trustScore = 20;
  
  // Laporan warga dengan estimasi (sangat terpercaya)
  const laporanDenganEstimasiCount = (item.laporan_terbaru || [])
    .filter(l => l.estimated_people !== null).length;
  if (laporanDenganEstimasiCount > 0) {
    trustScore += Math.min(40, laporanDenganEstimasiCount * 15);
  }
  
  // Estimasi recent menambah trust
  if (estimasiRecent && estimasiOrang > 0) {
    trustScore += 25;
  }
  
  // Matching confidence
  if (item.matching_confidence) {
    if (item.matching_confidence > 0.9) trustScore += 20;
    else if (item.matching_confidence > 0.7) trustScore += 15;
    else if (item.matching_confidence > 0.5) trustScore += 8;
  }
  
  // Internal signals lebih terpercaya
  const internalSignals = (item.laporan_terbaru || []).length + 
                          (item.testimonial_terbaru || []).length;
  if (internalSignals > 0) {
    trustScore += Math.min(25, internalSignals * 3);
  }
  
  // Popularitas (vibe count)
  if (vibeCount > 20) trustScore += 10;
  else if (vibeCount > 10) trustScore += 5;
  
  trustScore = Math.min(100, trustScore);
  score += trustScore * 0.03;
  
  // ============================================
  // FINAL: Bulatkan skor
  // ============================================
  return Math.round(score);
}