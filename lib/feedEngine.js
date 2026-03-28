import { generateHeadline } from "./headlineEngine";
import { calculateScore } from "./ranking";

// 1. FUNGSI HELPER: AKURASI LOKASI (HAVERSINE)
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; // Radius Bumi dalam KM
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function formatRelativeTime(dateString) {
  if (!dateString) return "";
  const now = new Date();
  const past = new Date(dateString);
  const diffInMs = now - past;
  const diffInMin = Math.floor(diffInMs / 60000);

  if (diffInMin < 1) return "Baru saja";
  if (diffInMin < 60) return `${diffInMin}m lalu`;
  const diffInHours = Math.floor(diffInMin / 60);
  if (diffInHours < 24) return `${diffInHours}j lalu`;
  return past.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

// MAPPING SUB-KATEGORI
const SUB_KATEGORI_MAPPING = {
  // Kuliner
  'cafe': { utama: 'kuliner', vibe: 'santai', icon: '☕', kata: 'Cafe' },
  'warung': { utama: 'kuliner', vibe: 'sederhana', icon: '🍚', kata: 'Warung' },
  'restoran': { utama: 'kuliner', vibe: 'formal', icon: '🍽️', kata: 'Restoran' },
  'kopi': { utama: 'kuliner', vibe: 'ngopi', icon: '☕', kata: 'Kedai Kopi' },
  'bakso': { utama: 'kuliner', vibe: 'hangat', icon: '🍲', kata: 'Bakso' },
  'sate': { utama: 'kuliner', vibe: 'hangat', icon: '🍢', kata: 'Sate' },
  'pecel': { utama: 'kuliner', vibe: 'segar', icon: '🥗', kata: 'Pecel' },
  'ayam': { utama: 'kuliner', vibe: 'gurih', icon: '🍗', kata: 'Ayam' },
  'mie': { utama: 'kuliner', vibe: 'hangat', icon: '🍜', kata: 'Mie' },
  'seafood': { utama: 'kuliner', vibe: 'lezat', icon: '🦐', kata: 'Seafood' },
  'angkringan': { utama: 'kuliner', vibe: 'santai', icon: '🍢', kata: 'Angkringan' },

  // Jalan
  'simpang': { utama: 'jalan', vibe: 'padat', icon: '🚦', kata: 'Simpang' },
  'persimpangan': { utama: 'jalan', vibe: 'padat', icon: '🚦', kata: 'Persimpangan' },
  'tol': { utama: 'jalan', vibe: 'cepat', icon: '🛣️', kata: 'Jalan Tol' },
  'gang': { utama: 'jalan', vibe: 'sempit', icon: '🚶', kata: 'Gang' },
  'raya': { utama: 'jalan', vibe: 'ramai', icon: '🛣️', kata: 'Jalan Raya' },
  'bypass': { utama: 'jalan', vibe: 'cepat', icon: '🛣️', kata: 'Bypass' },
  'lingkar': { utama: 'jalan', vibe: 'lancar', icon: '🔄', kata: 'Jalan Lingkar' },

  // Publik
  'taman': { utama: 'publik', vibe: 'sejuk', icon: '🌳', kata: 'Taman' },
  'alun-alun': { utama: 'publik', vibe: 'ramai', icon: '🏞️', kata: 'Alun-Alun' },
  'alun alun': { utama: 'publik', vibe: 'ramai', icon: '🏞️', kata: 'Alun-Alun' },
  'pasar': { utama: 'publik', vibe: 'tradisional', icon: '🏪', kata: 'Pasar' },
  'stadion': { utama: 'publik', vibe: 'olahraga', icon: '🏟️', kata: 'Stadion' },
  'lapangan': { utama: 'publik', vibe: 'terbuka', icon: '🏞️', kata: 'Lapangan' },
  'terminal': { utama: 'publik', vibe: 'ramai', icon: '🚌', kata: 'Terminal' },
  'stasiun': { utama: 'publik', vibe: 'ramai', icon: '🚂', kata: 'Stasiun' },

  // Ibadah
  'masjid': { utama: 'ibadah', vibe: 'khusyuk', icon: '🕌', kata: 'Masjid' },
  'mushola': { utama: 'ibadah', vibe: 'khusyuk', icon: '🕌', kata: 'Mushola' },
  'gereja': { utama: 'ibadah', vibe: 'khusyuk', icon: '⛪', kata: 'Gereja' },
  'pura': { utama: 'ibadah', vibe: 'khusyuk', icon: '🛕', kata: 'Pura' },
  'vihara': { utama: 'ibadah', vibe: 'khusyuk', icon: '🏯', kata: 'Vihara' }
};

// NARASI BERDASARKAN SUB-KATEGORI
const NARASI_SPESIFIK = {
  // Cafe
  cafe: {
    ramai: "Meja-meja penuh, pengunjung asyik ngobrol sambil menikmati kopi.",
    sedang: "Suasana cozy, beberapa pengunjung bekerja dengan laptop.",
    sepi: "Cafe lengang, musik latar terdengar lebih jelas.",
    hujan: "Pengunjung berteduh sambil menikmati minuman hangat."
  },
  // Warung
  warung: {
    ramai: "Warung penuh, warga berebut dapat tempat duduk.",
    sedang: "Beberapa warga makan siang, suasana sederhana tapi hangat.",
    sepi: "Warung sepi, penjaga terlihat bersantai.",
    hujan: "Warga berteduh sambil memesan makanan hangat."
  },
  // Restoran
  restoran: {
    ramai: "Restoran penuh, ada waiting list untuk beberapa meja.",
    sedang: "Suasana restoran cukup ramai, pelayanan tetap cepat.",
    sepi: "Restoran lengang, beberapa pramusaji bersiap melayani.",
    hujan: "Pengunjung memilih makan di dalam, suasana lebih tenang."
  },
  // Simpang/Jalan
  simpang: {
    ramai: "Kendaraan mengular dari berbagai arah, macet total.",
    sedang: "Lampu merah ramai, kendaraan bergantian melaju.",
    sepi: "Simpang lengang, kendaraan leluasa melintas.",
    hujan: "Pengendara melambat, genangan air mulai terbentuk."
  },
  // Alun-Alun
  'alun-alun': {
    ramai: "Warga memadati area, anak-anak bermain, pedagang laris.",
    sedang: "Beberapa warga duduk santai menikmati sore.",
    sepi: "Alun-alun sepi, hanya beberapa warga melintas.",
    hujan: "Area sepi, warga berteduh di sekitar pepohonan."
  },
  // Masjid
  masjid: {
    ramai: "Jamaah memadati saf, sholat berjamaah penuh khidmat.",
    sedang: "Beberapa jamaah datang silih berganti.",
    sepi: "Masjid tenang, hanya terdengar suara orang mengaji.",
    hujan: "Suara hujan menambah kekhusyukan di dalam masjid."
  }
};

// NARASI BERDASARKAN ESTIMASI ORANG (BARU)
function generateNarasiFromEstimasi({ estimasiOrang, tipe, catGroup, subKategori, isHujan }) {
  if (isHujan) {
    if (catGroup === 'kuliner') {
      return `Hujan turun, estimasi ${estimasiOrang} orang berteduh sambil menikmati menu hangat.`;
    } else if (catGroup === 'jalan') {
      return `Hujan, ${estimasiOrang} kendaraan terpantau di jalan, kecepatan melambat.`;
    }
    return `Hujan, sekitar ${estimasiOrang} orang terlihat berteduh di area ini.`;
  }
  
  // Narasi berdasarkan tipe dan jumlah
  if (tipe === 'Sepi') {
    if (estimasiOrang <= 3) return `Sepi sekali, hanya ${estimasiOrang} orang terlihat.`;
    if (estimasiOrang <= 8) return `Tenang, sekitar ${estimasiOrang} orang sedang beraktivitas.`;
    return `Cukup tenang, estimasi ${estimasiOrang} orang di sekitar.`;
  } else if (tipe === 'Ramai') {
    if (estimasiOrang <= 15) return `Mulai ramai, sekitar ${estimasiOrang} orang terlihat.`;
    if (estimasiOrang <= 30) return `Ramai, sekitar ${estimasiOrang} orang memadati area.`;
    return `Sangat ramai! Estimasi ${estimasiOrang}+ orang, suasana meriah!`;
  } else if (tipe === 'Antri') {
    return `Antrian dengan estimasi ${estimasiOrang} orang mengantre.`;
  }
  
  return `Estimasi ${estimasiOrang} orang berada di sekitar sini.`;
}

// Fungsi untuk mendapatkan estimasi orang dari laporan terbaru
function getLatestEstimasiFromLaporan(laporan) {
  if (!laporan || laporan.length === 0) return null;
  
  // Ambil laporan dengan estimasi orang (dari uploader)
  const laporanDenganEstimasi = laporan.filter(l => 
    l.estimated_people !== null && l.estimated_people !== undefined
  );
  
  if (laporanDenganEstimasi.length === 0) return null;
  
  // Sort by created_at, ambil yang terbaru
  const terbaru = laporanDenganEstimasi.sort((a, b) => 
    new Date(b.created_at) - new Date(a.created_at)
  )[0];
  
  return {
    count: terbaru.estimated_people,
    tipe: terbaru.tipe,
    waitTime: terbaru.estimated_wait_time,
    created_at: terbaru.created_at,
    isRecent: (new Date() - new Date(terbaru.created_at)) < (2 * 60 * 60 * 1000) // < 2 jam
  };
}

export function processFeedItem({ item, locationReady, location, comments = {} }) {
  if (!item) return {};

  const now = new Date();
  const currentHour = now.getHours();

  // 1. KALKULASI JARAK
  let distance = null;
  const itemLat = parseFloat(item.latitude || item.lat);
  const itemLng = parseFloat(item.longitude || item.lng || item.long);
  const userLat = parseFloat(location?.coords?.latitude || location?.latitude);
  const userLng = parseFloat(location?.coords?.longitude || location?.longitude);

  if (locationReady && userLat && userLng && itemLat && itemLng) {
    distance = calculateDistance(userLat, userLng, itemLat, itemLng);
  }

  // 2. DATA DARI TABEL TEMPAT (latest dari trigger)
  const latestCondition = item.latest_condition || null;
  const latestEstimatedPeople = item.latest_estimated_people || null;
  const latestEstimatedWaitTime = item.latest_estimated_wait_time || null;
  const latestEstimatedAt = item.latest_estimated_at ? new Date(item.latest_estimated_at) : null;
  const avgEstimatedPeople = item.avg_estimated_people || null;
  
  // 3. DATA NORMALIZATION & SIGNAL PROCESSING
  const validationCount = parseInt(item.total_minat) || 0;
  const dbCheckins = parseInt(item.total_checkins) || 0;
  
  const internalComments = Array.isArray(comments[item.id]) ? comments[item.id] : [];
  const laporan = Array.isArray(item.laporan_terbaru) ? item.laporan_terbaru : [];
  const medsos = Array.isArray(item.medsos_terbaru) ? item.medsos_terbaru : [];
  const aktivitas = Array.isArray(item.aktivitas_terkini) ? item.aktivitas_terkini : [];
  const externalSignals = Array.isArray(item.external_signals_terbaru) ? item.external_signals_terbaru : [];

  // 4. AMBIL ESTIMASI DARI LAPORAN TERBARU (PRIORITAS UTAMA)
  const estimasiDariLaporan = getLatestEstimasiFromLaporan(laporan);
  
  // 5. TENTUKAN ESTIMASI ORANG (Prioritas: laporan terbaru > latest from tempat > rata-rata > fallback)
  let estimasiOrang = null;
  let estimasiTipe = null;
  let estimasiWaitTime = null;
  let estimasiRecent = false;
  
  if (estimasiDariLaporan && estimasiDariLaporan.isRecent) {
    // Prioritas 1: Laporan warga terbaru (< 2 jam)
    estimasiOrang = estimasiDariLaporan.count;
    estimasiTipe = estimasiDariLaporan.tipe;
    estimasiWaitTime = estimasiDariLaporan.waitTime;
    estimasiRecent = true;
  } else if (latestEstimatedPeople && latestEstimatedAt && (now - latestEstimatedAt) < (2 * 60 * 60 * 1000)) {
    // Prioritas 2: Data dari tabel tempat (trigger) yang masih recent
    estimasiOrang = latestEstimatedPeople;
    estimasiTipe = latestCondition;
    estimasiWaitTime = latestEstimatedWaitTime;
    estimasiRecent = true;
  } else if (latestEstimatedPeople) {
    // Prioritas 3: Data dari tabel tempat tapi tidak recent
    estimasiOrang = latestEstimatedPeople;
    estimasiTipe = latestCondition;
    estimasiWaitTime = latestEstimatedWaitTime;
    estimasiRecent = false;
  } else if (avgEstimatedPeople) {
    // Prioritas 4: Rata-rata dari laporan sebelumnya
    estimasiOrang = avgEstimatedPeople;
    estimasiRecent = false;
  }
  
  // 6. GABUNGKAN SEMUA SIGNAL
  const allSignals = [
    ...internalComments.map(c => ({ ...c, tipe: 'komentar_internal', source_type: 'internal', source_tier: 4 })),
    ...medsos.map(m => ({ ...m, tipe: 'medsos', source_type: 'internal_medsos', source_tier: 5 })),
    ...laporan.map(l => ({ 
      ...l, 
      tipe: 'laporan', 
      source_type: 'internal', 
      source_tier: 4,
      estimated_people: l.estimated_people,
      estimated_wait_time: l.estimated_wait_time
    })),
    ...aktivitas.map(a => ({ ...a, tipe: 'checkin', source_type: 'internal', source_tier: 4 })),
    ...externalSignals.map(e => ({
      ...e,
      tipe: 'eksternal',
      source_type: 'eksternal',
      source_tier: e.source_tier || 5,
      source_platform: e.source_platform || e.source || 'unknown',
      is_official: e.is_official_place_account || false,
      verified: e.verified || false,
      has_media: e.has_image || e.has_video || (e.media_urls && e.media_urls.length > 0)
    }))
  ]
    .slice(0, 8)
    .map((s, idx) => {
      let platform = "Update Warga";
      const textContent = s.konten || s.content || s.text || s.deskripsi || s.catatan || "";

      if (s.tipe === "laporan") {
        if (s.estimated_wait_time) {
          platform = `Antrian ±${s.estimated_wait_time}m`;
        } else if (s.estimasi_menit) {
          platform = `Antrian ±${s.estimasi_menit}m`;
        } else {
          platform = "Laporan Langsung";
        }
      } else if (s.tipe === "komentar_internal") {
        platform = "Kata Warga";
      } else if (s.tipe === "eksternal") {
        if (s.source_platform === 'instagram') platform = "📸 Instagram";
        else if (s.source_platform === 'tiktok') platform = "🎵 TikTok";
        else if (s.source_platform === 'facebook') platform = "📘 Facebook";
        else platform = "📱 Media Sosial";
      }

      return {
        ...s,
        username: s.username || "warga_lokal",
        avatar: `data:text/plain,${idx}`,
        text: textContent,
        platformLabel: platform,
        timeAgo: formatRelativeTime(s.created_at || s.timestamp || s.date || item.updated_at),
        isLive: (now - new Date(s.created_at || s.timestamp || s.date)) < 3600000,
        isOfficial: s.is_official_place_account || false,
        isVerified: s.verified || false,
        hasImage: s.has_image || (s.media_url && s.media_url !== ''),
        sourceTier: s.source_tier || 5,
        estimated_people: s.estimated_people,
        estimated_wait_time: s.estimated_wait_time
      };
    }).filter(s => s.text).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  // 7. DETEKSI HUJAN (dari teks)
  const isHujan = allSignals.some(s => /hujan|gerimis|deras|basah|mantol|neduh/i.test(s.text));
  
  // 8. TENTUKAN VIEWING COUNT (PRIORITAS ESTIMASI REAL)
  let finalViewingCount;
  if (estimasiOrang && estimasiRecent) {
    finalViewingCount = estimasiOrang;
    // Tambah sedikit dengan active viewers
    const activeViewers = Math.floor(Math.random() * 3) + 2;
    finalViewingCount = Math.max(estimasiOrang, activeViewers);
  } else {
    const activeViewers = Math.floor(Math.random() * 5) + 3;
    finalViewingCount = Math.ceil(activeViewers + dbCheckins);
  }
  
  // 9. DETEKSI KATEGORI & SUB-KATEGORI
  const category = (item.category || item.kategori || item.nama_kategori || 'umum').toLowerCase();

  let catGroup = 'publik';
  let subKategori = null;
  let subKategoriData = { utama: 'publik', vibe: 'normal', icon: '📍', kata: 'Tempat' };

  for (const [key, value] of Object.entries(SUB_KATEGORI_MAPPING)) {
    if (category.includes(key) || item.name?.toLowerCase().includes(key)) {
      subKategori = key;
      subKategoriData = value;
      catGroup = value.utama;
      break;
    }
  }

  if (!subKategori) {
    if (['cafe', 'resto', 'warung', 'kuliner', 'kopi', 'bakso', 'sate', 'ayam', 'mie'].some(k => category.includes(k) || item.name?.toLowerCase().includes(k))) {
      catGroup = 'kuliner';
      subKategoriData = { utama: 'kuliner', vibe: 'normal', icon: '🍽️', kata: 'Kuliner' };
    } else if (['jalan', 'lalu lintas', 'simpang', 'raya', 'tol', 'bypass'].some(k => category.includes(k) || item.name?.toLowerCase().includes(k))) {
      catGroup = 'jalan';
      subKategoriData = { utama: 'jalan', vibe: 'normal', icon: '🛣️', kata: 'Jalan' };
    } else if (['masjid', 'mushola', 'gereja', 'pura', 'vihara'].some(k => category.includes(k) || item.name?.toLowerCase().includes(k))) {
      catGroup = 'ibadah';
      subKategoriData = { utama: 'ibadah', vibe: 'khusyuk', icon: '🕌', kata: 'Tempat Ibadah' };
    }
  }

  // 10. TENTUKAN WAKTU
  let timeVibe = "malam";
  if (currentHour >= 5 && currentHour < 11) timeVibe = "pagi";
  else if (currentHour >= 11 && currentHour < 15) timeVibe = "siang";
  else if (currentHour >= 15 && currentHour < 19) timeVibe = "sore";

  // 11. GENERATE HEADLINE
  const antrian = laporan.find(l => l.tipe === "Antri" || l.estimasi_menit > 0 || l.estimated_wait_time) || null;
  const suasana = laporan.find(l => l.tipe === "keramaian" || l.tipe === "suasana") || null;
  const aktivitasUtama = aktivitas[0] || null;

  const generatedHeadline = generateHeadline({
    item,
    estimasiOrang: estimasiOrang,
    antrian,
    aktivitasUtama,
    suasana,
    externalSignals,
    allSignals
  });

  // 12. GENERATE NARASI (PRIORITAS ESTIMASI WARGA)
  let narasiCerita = "";
  
  // PRIORITAS 1: Ada estimasi real dari laporan warga yang recent
  if (estimasiOrang && estimasiRecent && estimasiTipe) {
    narasiCerita = generateNarasiFromEstimasi({
      estimasiOrang,
      tipe: estimasiTipe,
      catGroup,
      subKategori,
      isHujan
    });
  }
  // PRIORITAS 2: Ada laporan spesifik dari warga
  else {
    const laporanTerbaru = allSignals.find(s => s.tipe === 'laporan' && s.isLive);
    if (laporanTerbaru && laporanTerbaru.text) {
      narasiCerita = `"${laporanTerbaru.text.substring(0, 60)}..." - Warga`;
    }
    // PRIORITAS 3: Ada external signal dari sumber terpercaya
    else if (externalSignals.length > 0 && externalSignals[0].source_tier <= 2) {
      const source = externalSignals[0].source_platform === 'instagram' ? 'IG' : 'media';
      narasiCerita = `Update ${source}: ${externalSignals[0].content?.substring(0, 60)}...`;
    }
    // PRIORITAS 4: Gunakan narasi spesifik berdasarkan sub-kategori
    else {
      let levelKeramaian = 'sedang';
      if (finalViewingCount > 20) levelKeramaian = 'ramai';
      else if (finalViewingCount > 10) levelKeramaian = 'sedang';
      else levelKeramaian = 'sepi';
      
      if (isHujan) levelKeramaian = 'hujan';
      
      if (subKategori && NARASI_SPESIFIK[subKategori] && NARASI_SPESIFIK[subKategori][levelKeramaian]) {
        narasiCerita = NARASI_SPESIFIK[subKategori][levelKeramaian];
      } else {
        if (isHujan) {
          if (catGroup === 'kuliner') narasiCerita = "Hujan turun, pengunjung memilih menu hangat.";
          else if (catGroup === 'jalan') narasiCerita = "Hujan, jalanan licin, pengendara mengurangi kecepatan.";
          else narasiCerita = "Hujan turun, warga berteduh di berbagai tempat.";
        } else if (finalViewingCount > 20) {
          if (catGroup === 'kuliner') narasiCerita = "Pengunjung membludak, tempat penuh sesak.";
          else if (catGroup === 'jalan') narasiCerita = "Kepadatan parah, kendaraan tak bergerak.";
          else narasiCerita = "Warga tumplek blek, suasana meriah.";
        } else if (finalViewingCount > 10) {
          if (catGroup === 'kuliner') narasiCerita = "Meja-meja mulai terisi, suasana hangat.";
          else if (catGroup === 'jalan') narasiCerita = "Arus lalu lintas padat, merayap pelan.";
          else narasiCerita = "Warga mulai ramai beraktivitas.";
        } else {
          if (catGroup === 'kuliner') narasiCerita = "Suasana tenang, beberapa pengunjung terlihat.";
          else if (catGroup === 'jalan') narasiCerita = "Jalanan lancar, kendaraan leluasa melaju.";
          else narasiCerita = "Suasana tenang, hanya beberapa warga terlihat.";
        }
      }
    }
  }
  
  // 13. HITUNG SKOR
  const itemForScoring = {
    ...item,
    testimonial_terbaru: internalComments,
    laporan_terbaru: laporan,
    external_signals_terbaru: externalSignals,
    vibe_count: validationCount,
    total_checkins: dbCheckins,
    latest_estimated_people: estimasiOrang,
    latest_estimated_at: latestEstimatedAt,
    latest_condition: estimasiTipe
  };

  const realtimeScore = calculateScore(itemForScoring, location);
  
  // 14. TENTUKAN BADGE
  let badgeStatus = "Lancar";
  let badgeColor = "bg-slate-100 text-slate-700 border-slate-200";
  let vibeIcon = subKategoriData.icon || (timeVibe === "pagi" ? "🌅" : timeVibe === "siang" ? "☀️" : "🌙");
  
  const hasOfficialExternal = externalSignals.some(s =>
    s.source_tier === 1 || s.source_tier === 2 || s.is_official_place_account === true
  );
  
  const hasViralExternal = externalSignals.some(s =>
    (s.likes_count && s.likes_count > 100) ||
    (s.comments_count && s.comments_count > 20)
  );
  
  // Badge prioritas: Hujan > Antri (dengan estimasi waktu) > Estimasi dari warga > Ramai > Mulai Ramai > Lainnya
  if (isHujan) {
    badgeStatus = "☕ Cocok Neduh";
    badgeColor = "bg-blue-100 text-blue-700 border-blue-200";
  } else if (estimasiTipe === "Antri" && estimasiWaitTime) {
    const waitTime = estimasiWaitTime;
    if (waitTime <= 5) {
      badgeStatus = "⚡ Antri Pendek (<5 menit)";
    } else if (waitTime <= 15) {
      badgeStatus = "⏱️ Antri Sedang (5-15 menit)";
    } else {
      badgeStatus = "🐢 Antri Panjang (>15 menit)";
    }
    badgeColor = "bg-rose-100 text-rose-700 border-rose-200";
  } else if (estimasiOrang && estimasiRecent && estimasiTipe) {
    if (estimasiTipe === "Sepi") {
      badgeStatus = `🍃 Sepi · ~${estimasiOrang} org`;
      badgeColor = "bg-emerald-100 text-emerald-700 border-emerald-200";
    } else if (estimasiTipe === "Ramai") {
      badgeStatus = `👥 Ramai · ~${estimasiOrang} org`;
      badgeColor = "bg-amber-100 text-amber-700 border-amber-200";
    } else if (estimasiTipe === "Antri") {
      badgeStatus = `⏳ Antri · ~${estimasiOrang} org`;
      badgeColor = "bg-rose-100 text-rose-700 border-rose-200";
    }
  } else if (hasOfficialExternal && finalViewingCount > 10) {
    badgeStatus = "🏪 Official Update";
    badgeColor = "bg-purple-100 text-purple-700 border-purple-200";
  } else if (hasViralExternal || finalViewingCount > 25) {
    badgeStatus = "🔥 Lagi Viral";
    badgeColor = "bg-rose-100 text-rose-700 border-rose-200";
  } else if (finalViewingCount > 15) {
    badgeStatus = `👍 Ramai · ~${finalViewingCount} org`;
    badgeColor = "bg-amber-100 text-amber-700 border-amber-200";
  } else if (finalViewingCount > 8) {
    badgeStatus = `👌 Mulai Ramai · ~${finalViewingCount} org`;
    badgeColor = "bg-emerald-100 text-emerald-700 border-emerald-200";
  } else if (externalSignals.length > 0) {
    badgeStatus = "📱 Ada Update";
    badgeColor = "bg-indigo-100 text-indigo-700 border-indigo-200";
  }
  
  // 15. METRIK TAMBAHAN
  const externalCount = externalSignals.length;
  const externalHighTierCount = externalSignals.filter(s => s.source_tier <= 2).length;
  const lastExternalAt = externalSignals.length > 0
    ? new Date(Math.max(...externalSignals.map(e => new Date(e.created_at))))
    : null;
  
  // 16. KEMBALIKAN OBJECT LENGKAP
  return {
    ...item,
    allSignals,
    narasiCerita,
    badgeStatus,
    badgeColor,
    vibeIcon,
    viewingCount: finalViewingCount,
    validationCount: validationCount,
    isHujan,
    distance,
    isRamai: finalViewingCount > 12,
    isViral: finalViewingCount > 25 || validationCount > 20,
    headline: generatedHeadline,
    activityTime: formatRelativeTime(item.updated_at) || "Baru saja",
    
    // DATA KATEGORI
    catGroup,
    subKategori,
    subKategoriNama: subKategoriData.kata,
    subKategoriIcon: subKategoriData.icon,
    
    // DATA ESTIMASI DARI WARGA (BARU)
    estimasiOrang,
    estimasiTipe,
    estimasiWaitTime,
    estimasiRecent,
    isFromWarga: estimasiOrang && estimasiRecent,
    
    // DATA UNTUK SCORING & SORTING
    realtimeScore,
    externalCount,
    externalHighTierCount,
    lastExternalAt,
    hasOfficialExternal,
    
    // UNTUK SORTING DI FEEDCONTENT
    sortScore: realtimeScore,
    lastActivityAt: lastExternalAt || new Date(item.updated_at || item.created_at)
  };
}