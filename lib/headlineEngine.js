// lib/headlineEngine.js

// Library template headline yang bervariasi dan engaging
const TEMPLATES = {
  // 🎉 EVENT - 24 jam
  event: [
    "🎉 Ada {event} di {nama}! Warga berbondong-bondong",
    "Hari ini {nama} ada {event}, suasana meriah!",
    "Warga memadati {nama} untuk {event}, rame banget!",
    "{event} seru di {nama}, sayang kalau dilewatkan",
    "Moment {event} di {nama}, warga antusias!"
  ],
  
  // 🔥 VIRAL - 24 jam
  viral: [
    "🔥 Viral! {nama} jadi perbincangan warga",
    "Hits banget! {nama} lagi naik daun di TikTok",
    "FYP terus! {nama} jadi primadona baru",
    "Warga berbondong ke {nama} setelah viral",
    "Rame banget! {nama} lagi viral di sosial media"
  ],
  
  // 📢 OFFICIAL - 24 jam
  official: [
    "📢 Info resmi: {update}",
    "Kabar dari pengelola {nama}: {update}",
    "Update resmi: {update}",
    "Dari pihak {nama}: {update}"
  ],
  
  // 🌧️ HUJAN - 6 jam
  hujan: [
    "🌧️ Hujan turun di {nama}, warga berteduh",
    "Neduh dulu lur, hujan di {nama}",
    "Suasana basah, hujan guyur {nama}",
    "Rintik hujan temani aktivitas di {nama}",
    "Hujan-hujan, {nama} jadi lebih adem"
  ],
  
  // ⏳ ANTRIAN - 2 jam (berubah cepat)
  antrian: [
    "⏳ Antrian panjang di {nama}, siap-siap sabar",
    "Warga mengantre di {nama}, lagi rame nih",
    "Ngantre dulu di {nama}, worth it ga ya?",
    "Antrean mengular, {nama} lagi jadi favorit",
    "Sabar ya, antrian di {nama} cukup panjang"
  ],
  
  antrian_dengan_waktu: [
    "⏳ Antrian {estimasi} menit di {nama}, siap-siap sabar",
    "Ngantri {estimasi} menit nih di {nama}, worth it?",
    "Antrean mengular {estimasi} menit, sabar ya lur!",
    "Warga ngantre {estimasi} menit, lagi rame nih"
  ],
  
  // 🏃‍♂️ RAMAI - 6 jam
  ramai: [
    "🏃‍♂️ Suasana meriah! {nama} dipenuhi warga",
    "Meriah! {nama} jadi tempat nongkrong favorit",
    "Warga tumplek blek, {nama} lagi ramai",
    "Vibes seru di {nama}, banyak yang nongkrong",
    "Hidup! {nama} dipadati pengunjung"
  ],
  
  mulai_ramai: [
    "👥 Mulai ramai nih di {nama}",
    "Warga mulai berdatangan ke {nama}",
    "Suasana hangat, {nama} mulai dipadati",
    "Pelan-pelan rame, {nama} jadi ramai"
  ],
  
  // 🍃 SEPI - 6 jam
  sepi: [
    "🍃 Lengang di {nama}, cocok buat santai",
    "Suasana tenang di {nama}, tempat masih longgar",
    "Sepi pengunjung, {nama} lagi adem",
    "Lapang dan longgar di {nama}, langsung gas aja",
    "Tenang banget, {nama} lagi sepi"
  ],
  
  // 🚗 MACET - 2 jam
  macet: [
    "🚗 Macet parah di {nama}, kendaraan mengular",
    "Kemacetan panjang, hati-hati di {nama}",
    "Padat merayap di {nama}, waspada ya!",
    "Lampu merah panjang, antrean kendaraan di {nama}"
  ],
  
  // 🌅 WAKTU - selalu relevan (fallback)
  pagi: [
    "🌅 Pagi cerah di {nama}, warga mulai berdatangan",
    "Semangat pagi dari {nama}, udara segar",
    "Sarapan dulu di {nama} sebelum beraktivitas",
    "Pagi-pagi udah rame di {nama}"
  ],
  
  siang: [
    "☀️ Siang terik, warga berteduh di {nama}",
    "Jam makan siang, {nama} mulai dipadati",
    "Cari yang seger di {nama} buat lawan panas",
    "Istirahat siang di {nama}, warga membludak"
  ],
  
  sore: [
    "🌆 Sore santai di {nama}, warga mulai nongkrong",
    "Menjelang maghrib di {nama}, suasana hangat",
    "Sore-sore gini enaknya di {nama}",
    "Pulang kerja mampir ke {nama} dulu"
  ],
  
  malam: [
    "🌙 Malam minggu di {nama}, muda-mudi berkumpul",
    "Lampu temaram temani malam di {nama}",
    "Malam syahdu di {nama}, cocok buat santai",
    "Ngopi malam di {nama}, diskusi hangat"
  ],
  
  // 🍽️ KULINER - khusus tempat makan
  kuliner: [
    "🍽️ Enak! {nama} jadi rekomendasi warga",
    "Kuliner hits di {nama}, wajib coba!",
    "Warga pada ngantre, katanya enak di {nama}",
    "Hidden gem! {nama} favorit warga sekitar"
  ],
  
  // 📍 UMUM - fallback terakhir
  umum: [
    "📍 Update dari {nama}: {cerita}",
    "Warga sekitar lapor: {cerita}",
    "Pantauan di {nama}: {cerita}"
  ]
};

// Helper: cek apakah data masih fresh berdasarkan durasi (jam)
function isFresh(data, maxHours) {
  if (!data) return false;
  const timestamp = data.latest_estimated_at || data.created_at || data.updated_at;
  if (!timestamp) return false;
  const cutoff = new Date(Date.now() - maxHours * 60 * 60 * 1000);
  return new Date(timestamp) > cutoff;
}

// Helper: cek fresh dari timestamp langsung
function isTimestampFresh(timestamp, maxHours) {
  if (!timestamp) return false;
  const cutoff = new Date(Date.now() - maxHours * 60 * 60 * 1000);
  return new Date(timestamp) > cutoff;
}

export function generateHeadline({ item, estimasiOrang, antrian, aktivitasUtama, suasana, externalSignals = [], allSignals = [] }) {
  
  const nama = item.name || item.nama || "tempat ini";
  const waktu = getWaktuSekarang();
  const kategori = item.category?.toLowerCase() || '';
  
  // ============================================
  // DATA DARI LAPORAN WARGA
  // ============================================
  const estimasiDariLaporan = estimasiOrang || item.latest_estimated_people || null;
  const estimasiTipe = item.latest_condition || item.tipe || null;
  const estimasiWaitTime = item.latest_estimated_wait_time || null;
  
  // ============================================
  // PRIORITAS 1: EVENT (24 jam)
  // ============================================
  const eventDetected = detectEvent(allSignals);
  if (eventDetected) {
    const template = getRandomTemplate(TEMPLATES.event);
    return {
      text: template.replace('{nama}', nama).replace('{event}', eventDetected),
      type: 'event',
      icon: '🎉'
    };
  }
  
  // ============================================
  // PRIORITAS 2: VIRAL (24 jam)
  // ============================================
  const hasViralSignal = externalSignals.some(s => 
    (s.likes_count && s.likes_count > 100) ||
    (s.comments_count && s.comments_count > 20)
  );
  
  if (hasViralSignal) {
    const template = getRandomTemplate(TEMPLATES.viral);
    return {
      text: template.replace('{nama}', nama),
      type: 'viral',
      icon: '🔥'
    };
  }
  
  // ============================================
  // PRIORITAS 3: OFFICIAL UPDATE (24 jam)
  // ============================================
  const officialSignal = externalSignals.find(s => s.source_tier <= 2 && s.content);
  if (officialSignal) {
    const template = getRandomTemplate(TEMPLATES.official);
    const update = officialSignal.content.substring(0, 45) + (officialSignal.content.length > 45 ? "..." : "");
    return {
      text: template.replace('{nama}', nama).replace('{update}', update),
      type: 'official',
      icon: '📢'
    };
  }
  
  // ============================================
  // PRIORITAS 4: HUJAN (6 jam)
  // ============================================
  const isHujan = allSignals.some(s => /hujan|gerimis|deras|basah|mantol|neduh/i.test(s.text));
  if (isHujan) {
    const template = getRandomTemplate(TEMPLATES.hujan);
    return {
      text: template.replace('{nama}', nama),
      type: 'hujan',
      icon: '🌧️'
    };
  }
  
  // ============================================
  // PRIORITAS 5: ANTRIAN (2 jam - berubah cepat)
  // ============================================
  const antrianFresh = antrian && isFresh(antrian, 2);
  
  if (antrianFresh && estimasiWaitTime) {
    // Antrian dengan waktu
    const template = getRandomTemplate(TEMPLATES.antrian_dengan_waktu);
    return {
      text: template.replace('{estimasi}', estimasiWaitTime).replace('{nama}', nama),
      type: 'antrian',
      icon: estimasiWaitTime > 15 ? '🐢' : '⏳'
    };
  }
  
  if (antrianFresh) {
    // Antrian tanpa waktu
    const template = getRandomTemplate(TEMPLATES.antrian);
    return {
      text: template.replace('{nama}', nama),
      type: 'antrian',
      icon: '⏳'
    };
  }
  
  // ============================================
  // PRIORITAS 6: MACET (2 jam - berubah cepat)
  // ============================================
  const isMacet = allSignals.some(s => /macet|padat|merayap|mengular/i.test(s.text));
  const isJalan = kategori.includes('jalan') || 
                   item.name?.toLowerCase().includes('jalan') ||
                   item.name?.toLowerCase().includes('simpang');
  
  if (isMacet && isJalan) {
    const template = getRandomTemplate(TEMPLATES.macet);
    return {
      text: template.replace('{nama}', nama),
      type: 'macet',
      icon: '🚗'
    };
  }
  
  // ============================================
  // PRIORITAS 7: RAMAI (6 jam)
  // ============================================
  const estimasiAngka = estimasiDariLaporan || 0;
  const isRamai = estimasiAngka > 15 || allSignals.some(s => /ramai|rame|padat|mbludak/i.test(s.text));
  const isMulaiRamai = estimasiAngka > 8 && estimasiAngka <= 15;
  
  if (isRamai) {
    // Untuk tempat kuliner
    if (kategori.includes('kuliner') || kategori.includes('cafe') || kategori.includes('restoran')) {
      const template = getRandomTemplate(TEMPLATES.kuliner);
      return {
        text: template.replace('{nama}', nama),
        type: 'ramai',
        icon: '🍽️'
      };
    }
    const template = getRandomTemplate(TEMPLATES.ramai);
    return {
      text: template.replace('{nama}', nama),
      type: 'ramai',
      icon: '🏃‍♂️'
    };
  }
  
  if (isMulaiRamai) {
    const template = getRandomTemplate(TEMPLATES.mulai_ramai);
    return {
      text: template.replace('{nama}', nama),
      type: 'mulai_ramai',
      icon: '👥'
    };
  }
  
  // ============================================
  // PRIORITAS 8: SEPI (6 jam)
  // ============================================
  const isSepi = estimasiAngka > 0 && estimasiAngka <= 8;
  if (isSepi) {
    const template = getRandomTemplate(TEMPLATES.sepi);
    return {
      text: template.replace('{nama}', nama),
      type: 'sepi',
      icon: '🍃'
    };
  }
  
  // ============================================
  // PRIORITAS 9: LAPORAN WARGA (6 jam)
  // ============================================
  const freshLaporan = allSignals.find(s => 
    s.tipe === 'laporan' && 
    s.deskripsi && 
    s.deskripsi.length > 5 &&
    isTimestampFresh(s.created_at, 6)
  );
  
  if (freshLaporan && freshLaporan.deskripsi) {
    let cerita = freshLaporan.deskripsi;
    if (cerita.length > 50) {
      cerita = cerita.substring(0, 47) + "...";
    }
    const template = getRandomTemplate(TEMPLATES.umum);
    return {
      text: template.replace('{nama}', nama).replace('{cerita}', cerita),
      type: 'laporan_warga',
      icon: '🗣️'
    };
  }
  
  // ============================================
  // PRIORITAS 10: BERDASARKAN WAKTU (fallback, selalu relevan)
  // ============================================
  const waktuTemplates = TEMPLATES[waktu.nama] || TEMPLATES.siang;
  const template = getRandomTemplate(waktuTemplates);
  
  return {
    text: template.replace('{nama}', nama),
    type: waktu.nama,
    icon: waktu.icon
  };
}

// Helper: ambil template random
function getRandomTemplate(templates) {
  return templates[Math.floor(Math.random() * templates.length)];
}

// Helper: deteksi event dari signals
function detectEvent(signals) {
  const eventKeywords = [
    { kata: 'car free day', event: 'Car Free Day' },
    { kata: 'cfd', event: 'Car Free Day' },
    { kata: 'pasar malam', event: 'Pasar Malam' },
    { kata: 'festival', event: 'Festival' },
    { kata: 'konser', event: 'Konser' },
    { kata: 'pengajian', event: 'Pengajian Akbar' },
    { kata: 'tabligh', event: 'Tabligh Akbar' },
    { kata: 'lomba', event: 'Lomba' },
    { kata: 'agustusan', event: 'HUT RI' },
    { kata: 'bazar', event: 'Bazar' },
    { kata: 'pentas seni', event: 'Pentas Seni' },
    { kata: 'wayangan', event: 'Wayangan' }
  ];
  
  for (const signal of signals) {
    const text = signal.text?.toLowerCase() || '';
    for (const kw of eventKeywords) {
      if (text.includes(kw.kata)) {
        return kw.event;
      }
    }
  }
  
  return null;
}

// Helper: dapatkan waktu sekarang
function getWaktuSekarang() {
  const hour = new Date().getHours();
  
  if (hour >= 5 && hour < 11) {
    return { nama: 'pagi', icon: '🌅' };
  } else if (hour >= 11 && hour < 15) {
    return { nama: 'siang', icon: '☀️' };
  } else if (hour >= 15 && hour < 19) {
    return { nama: 'sore', icon: '🌆' };
  } else {
    return { nama: 'malam', icon: '🌙' };
  }
}