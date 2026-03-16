// lib/contextual-summary.js
import { calculateScore } from './ranking';

export function generateContextualSummary(tempat, userLocation) {
  if (!tempat?.length) return null;

  // Hitung skor untuk semua tempat
  const tempatDenganSkor = tempat.map(t => ({
    ...t,
    skor: calculateScore(t, userLocation)
  }));

  // ============================================
  // 1. ANALISIS KULINER
  // ============================================
  const tempatKuliner = tempatDenganSkor.filter(t => 
    t.kategori === 'kuliner' || t.category === 'food' || t.type === 'restaurant'
  );
  
  const kulinerRataSkor = tempatKuliner.length > 0 
    ? tempatKuliner.reduce((acc, t) => acc + t.skor, 0) / tempatKuliner.length
    : 0;
  
  const kulinerNormalSkor = 50; // Baseline skor normal
  const kulinerKenaikan = ((kulinerRataSkor - kulinerNormalSkor) / kulinerNormalSkor * 100).toFixed(0);
  
  let kulinerSummary = null;
  if (tempatKuliner.length > 0) {
    if (kulinerKenaikan > 30) {
      kulinerSummary = `Kuliner lagi ramai banget (${kulinerKenaikan}% lebih ramai dari biasa)`;
    } else if (kulinerKenaikan > 15) {
      kulinerSummary = `Kuliner lagi rame (${kulinerKenaikan}% lebih ramai)`;
    } else if (kulinerKenaikan > 5) {
      kulinerSummary = `Kuliner sedikit meningkat (${kulinerKenaikan}%)`;
    } else if (kulinerKenaikan < -15) {
      kulinerSummary = `Kuliner lagi sepi (${Math.abs(kulinerKenaikan)}% sepi dari biasa)`;
    }
  }

  // ============================================
  // 2. ANALISIS JALANAN/MACET
  // ============================================
  const tempatJalan = tempatDenganSkor.filter(t => 
    t.kategori === 'jalan' || t.type === 'street' || t.is_road === true
  );
  
  const jalanMacet = tempatJalan
    .filter(t => t.skor > 70 || t.estimasi_orang > 30 || t.is_viral)
    .map(t => t.name);
  
  let jalanSummary = null;
  if (jalanMacet.length > 0) {
    if (jalanMacet.length === 1) {
      jalanSummary = `Jalanan macet di ${jalanMacet[0]}`;
    } else if (jalanMacet.length <= 3) {
      jalanSummary = `Jalanan macet di ${jalanMacet.join(', ')}`;
    } else {
      jalanSummary = `${jalanMacet.length} ruas jalan macet`;
    }
  }

  // ============================================
  // 3. AKTIVITAS TERDEKAT YANG RAMAI
  // ============================================
  const tempatDekat = tempatDenganSkor
    .filter(t => t.distance && t.distance < 2) // Dalam 2km
    .sort((a, b) => b.skor - a.skor);
  
  let aktivitasTerdekatSummary = null;
  if (tempatDekat.length > 0) {
    const topDekat = tempatDekat[0];
    const jarak = topDekat.distance.toFixed(1);
    
    if (topDekat.skor > 75) {
      aktivitasTerdekatSummary = `Ada ${topDekat.name} lagi viral (${jarak}km dari kamu)`;
    } else if (topDekat.skor > 60) {
      aktivitasTerdekatSummary = `${topDekat.name} lagi rame (${jarak}km dari kamu)`;
    } else {
      aktivitasTerdekatSummary = `${topDekat.name} lagi asyik dikunjungi (${jarak}km)`;
    }
  }

  // ============================================
  // 4. TOPIK VIRAL (JADI POKOK PEMBICARAAN)
  // ============================================
  const tempatViral = tempatDenganSkor
    .filter(t => t.is_viral || t.skor > 80)
    .sort((a, b) => b.skor - a.skor);
  
  // Kelompokkan berdasarkan kategori untuk topik viral
  const kategoriViral = {};
  tempatViral.forEach(t => {
    const kategori = t.kategori || t.category || 'tempat';
    if (!kategoriViral[kategori]) {
      kategoriViral[kategori] = [];
    }
    kategoriViral[kategori].push(t);
  });
  
  let viralSummary = null;
  if (tempatViral.length > 0) {
    const topViral = tempatViral[0];
    
    // Cek apakah ada topik yang dominan
    const kategoriEntries = Object.entries(kategoriViral);
    if (kategoriEntries.length === 1) {
      // Semua viral dari kategori yang sama
      const [kategori, items] = kategoriEntries[0];
      viralSummary = `${kategori.charAt(0).toUpperCase() + kategori.slice(1)} viral (${items.length} tempat) jadi pokok pembicaraan`;
    } else {
      // Ada beberapa topik
      viralSummary = `${topViral.name} viral, jadi pokok pembicaraan`;
    }
  }

  // ============================================
  // 5. TEMPAT DENGAN KENAIKAN SIGNIFIKAN
  // ============================================
  const tempatNaikTajam = tempatDenganSkor
    .filter(t => t.skor_increase_percent > 50 || t.trend === 'rising')
    .slice(0, 2);
  
  let trenSummary = null;
  if (tempatNaikTajam.length > 0) {
    if (tempatNaikTajam.length === 1) {
      trenSummary = `${tempatNaikTajam[0].name} lagi naik daun`;
    } else {
      trenSummary = `${tempatNaikTajam[0].name} dan ${tempatNaikTajam[1].name} lagi tren`;
    }
  }

  // ============================================
  // 6. RANGKUMAN LENGKAP
  // ============================================
  const ringkasan = [
    kulinerSummary,
    jalanSummary,
    aktivitasTerdekatSummary,
    viralSummary,
    trenSummary
  ].filter(Boolean); // Buang yang null

  // Statistik umum
  const totalAktif = tempatDenganSkor.filter(t => t.skor > 50).length;
  const totalViral = tempatViral.length;
  const rataSkorUmum = tempatDenganSkor.reduce((acc, t) => acc + t.skor, 0) / tempatDenganSkor.length;

  return {
    ringkasan,           // Array of summary strings
    stats: {
      totalAktif,
      totalViral,
      rataSkorUmum,
      kuliner: kulinerSummary ? {
        persenKenaikan: kulinerKenaikan,
        jumlahTempat: tempatKuliner.length
      } : null
    },
    topViral: tempatViral[0],
    topDekat: tempatDekat[0],
    // Untuk debugging/analisis
    raw: {
      kulinerRataSkor,
      tempatViral: tempatViral.length,
      jalanMacet: jalanMacet.length
    }
  };
}