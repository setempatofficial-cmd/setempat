// lib/headlineEngine.js

// Library template headline yang bervariasi
const TEMPLATES = {
  antrian: [
    "Ngantri {estimasi} menit nih di {nama}",
    "Ada antrian {estimasi} menit, siap-siap sabar",
    "Antrean mengular {estimasi} menit di {nama}",
    "Warga ngantre {estimasi} menit, lagi rame nih",
    "Giliran {estimasi} menit untuk dapat tempat"
  ],
  
  ramai: [
    "Rame banget! {jumlah} orang terpantau di {nama}",
    "Warga tumplek blek, sekitar {jumlah} orang",
    "{nama} lagi penuh, {jumlah} orang memadati",
    "Suasana rame, {jumlah} warga beraktivitas",
    "Padat merayap, {jumlah} orang terlihat"
  ],
  
  hujan: [
    "Hujan turun di {nama}, warga berteduh",
    "Suasana basah, hujan guyur {nama}",
    "Neduh dulu lur, hujan di {nama}",
    "Rintik hujan temani aktivitas di {nama}",
    "Hujan-hujan, {nama} lebih sepi dari biasanya"
  ],
  
  macet: [
    "Macet parah di {nama}, kendaraan mengular",
    "Kemacetan panjang di {nama}, butuh kesabaran",
    "Merayap pelan di {nama}, volume kendaraan tinggi",
    "Padat merayap, waspada di {nama}",
    "Lampu merah padat, antrean kendaraan panjang"
  ],
  
  sepi: [
    "Lengang di {nama}, hanya beberapa warga",
    "Suasana tenang di {nama}, cocok santai",
    "{nama} lagi sepi, tempat masih longgar",
    "Sepi pengunjung di {nama}, langsung gas aja",
    "Lapang dan longgar di {nama} hari ini"
  ],
  
  pagi: [
    "Pagi cerah di {nama}, warga mulai berdatangan",
    "Semangat pagi dari {nama}, udara segar",
    "Gerak pagi di {nama}, warga mulai ramai",
    "Sarapan dulu di {nama} sebelum beraktivitas",
    "Pagi-pagi udah rame di {nama}"
  ],
  
  siang: [
    "Siang terik di {nama}, warga berteduh",
    "Jam makan siang, {nama} mulai dipadati",
    "Cari yang seger di {nama} buat lawan panas",
    "Siang bolong, {nama} tetap rame",
    "Istirahat siang di {nama}, warga membludak"
  ],
  
  sore: [
    "Sore santai di {nama}, warga mulai nongkrong",
    "Menjelang maghrib di {nama}, suasana hangat",
    "Sore-sore gini enaknya di {nama}",
    "Pulang kerja mampir ke {nama} dulu",
    "Golden hour di {nama}, sayang dilewatkan"
  ],
  
  malam: [
    "Malam minggu di {nama}, muda-mudi berkumpul",
    "Lampu temaram temani malam di {nama}",
    "Malam syahdu di {nama}, cocok buat santai",
    "Ngopi malam di {nama}, diskusi hangat",
    "Malam hari, {nama} tetap hidup dengan lampu"
  ],
  
  event: [
    "Ada {event} di {nama}! Warga berdatangan",
    "Hari ini {nama} ada {event}, jangan dilewatkan",
    "Warga memadati {nama} untuk {event}",
    "{event} meriah di {nama}, sayang kalau nggak dateng",
    "Suasana berbeda di {nama}, ada {event} nih"
  ],
  
  viral: [
    "Viral di sosmed! {nama} lagi ramai diperbincangkan",
    "Warga berbondong ke {nama} setelah viral",
    "Hits banget! {nama} jadi pusat perhatian",
    "FYP terus! {nama} lagi naik daun",
    "Rame banget setelah postingan {sumber} viral"
  ],
  
  official: [
    "Update resmi dari {nama}: {update}",
    "Kabar terbaru dari {nama}: {update}",
    "{nama} official update: {update}",
    "Info resmi: {update} di {nama}",
    "Dari pengelola {nama}: {update}"
  ]
};

// Kata-kata sifat biar makin variatif
const ADJEKTIVA = [
  "super", "makin", "mulai", "lagi", "udah", "masih", "terus", "kian"
];

export function generateHeadline({ item, estimasiOrang, antrian, aktivitasUtama, suasana, externalSignals = [], allSignals = [] }) {
  
  const nama = item.name || item.nama || "tempat ini";
  const waktu = getWaktuSekarang();
  const randomAdj = ADJEKTIVA[Math.floor(Math.random() * ADJEKTIVA.length)];
  
  // PRIORITAS 1: Ada external signal dari sumber resmi?
  const officialSignal = externalSignals.find(s => s.source_tier <= 2 && s.content);
  if (officialSignal) {
    const templates = TEMPLATES.official;
    const template = templates[Math.floor(Math.random() * templates.length)];
    const update = officialSignal.content.substring(0, 30) + (officialSignal.content.length > 30 ? "..." : "");
    
    return {
      text: template.replace('{nama}', nama).replace('{update}', update),
      type: 'official',
      icon: '📢',
      source: officialSignal.source_platform
    };
  }
  
  // PRIORITAS 2: Deteksi event dari hashtag atau konten
  const eventDetected = detectEvent(allSignals);
  if (eventDetected) {
    const templates = TEMPLATES.event;
    const template = templates[Math.floor(Math.random() * templates.length)];
    
    return {
      text: template.replace('{nama}', nama).replace('{event}', eventDetected),
      type: 'event',
      icon: '🎉'
    };
  }
  
  // PRIORITAS 3: Ada antrian
  if (antrian) {
    const templates = TEMPLATES.antrian;
    const template = templates[Math.floor(Math.random() * templates.length)];
    const estimasi = antrian.estimasi_menit || Math.floor(Math.random() * 15) + 5;
    
    return {
      text: template.replace('{estimasi}', estimasi).replace('{nama}', nama),
      type: 'antrian',
      icon: '⏳'
    };
  }
  
  // PRIORITAS 4: Ramai (estimasi orang besar)
  if (estimasiOrang > 20) {
    const templates = TEMPLATES.ramai;
    const template = templates[Math.floor(Math.random() * templates.length)];
    const jumlah = estimasiOrang || Math.floor(Math.random() * 30) + 20;
    
    return {
      text: template.replace('{jumlah}', jumlah).replace('{nama}', nama),
      type: 'ramai',
      icon: '👥'
    };
  }
  
  // PRIORITAS 5: Ada laporan hujan
  if (allSignals.some(s => /hujan|gerimis|deras|basah|mantol|neduh/i.test(s.text))) {
    const templates = TEMPLATES.hujan;
    const template = templates[Math.floor(Math.random() * templates.length)];
    
    return {
      text: template.replace('{nama}', nama),
      type: 'hujan',
      icon: '🌧️'
    };
  }
  
  // PRIORITAS 6: Sepi (estimasi orang kecil)
  if (estimasiOrang < 5) {
    const templates = TEMPLATES.sepi;
    const template = templates[Math.floor(Math.random() * templates.length)];
    
    return {
      text: template.replace('{nama}', nama),
      type: 'sepi',
      icon: '🍃'
    };
  }
  
  // PRIORITAS 7: Berdasarkan waktu
  const waktuTemplates = TEMPLATES[waktu.nama] || TEMPLATES.siang;
  const template = waktuTemplates[Math.floor(Math.random() * waktuTemplates.length)];
  
  return {
    text: template.replace('{nama}', nama),
    type: waktu.nama,
    icon: waktu.icon
  };
}

// Helper: deteksi event dari signals
function detectEvent(signals) {
  const eventKeywords = [
    { kata: 'car free day', event: 'CFD' },
    { kata: 'cfd', event: 'CFD' },
    { kata: 'pasar malam', event: 'Pasar Malam' },
    { kata: 'festival', event: 'Festival' },
    { kata: 'konser', event: 'Konser' },
    { kata: 'pengajian', event: 'Pengajian Akbar' },
    { kata: 'tabligh', event: 'Tabligh Akbar' },
    { kata: 'lomba', event: 'Lomba 17an' },
    { kata: 'agustusan', event: 'Perayaan HUT RI' }
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