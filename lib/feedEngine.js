import { generateHeadline } from "./headlineEngine";

function formatRelativeTime(dateString) {
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

const narasiLibrary = {
  kuliner: {
    pagi: ["Aroma masakannya juara, pas banget buat isi tenaga pagi ini.", "Pas buat sarapan sebelum gas kerja lur."],
    siang: ["Lagi jam maksi, siap-siap antre dikit ya.", "Matahari semangat, cari yang seger di sini enak."],
    malam: ["Suasana syahdu buat makan malam santai.", "Lampu-lampunya bikin betah nongkrong lama."],
    hujan: ["Hujan-hujan gini emang pas cari yang kuah-kuah.", "Neduh sambil ngopi, nikmat mana yang kau dustakan?"]
  },
  publik: {
    pagi: ["Udara segar banget, cocok buat gerak tipis-tipis.", "Suasana tenang, enak buat nikmati pagi di Pasuruan."],
    siang: ["Ramai lancar, banyak warga lagi aktivitas.", "Cerah pol! Jangan lupa kacamata hitamnya."],
    sore: ["Vibes senja di sini nggak pernah gagal.", "Enak buat duduk santai sambil liat orang lewat."],
    hujan: ["Lagi basah, tetep cantik suasananya buat dipandang.", "Neduh dulu lur, jangan dipaksa jalan."]
  },
  jalan: {
    pagi: ["Lalu lintas lancar jaya, berangkat kerja aman.", "Masih anteng, gas tipis-tipis."],
    siang: ["Padat merayap, tetap sabar dan waspada ya!", "Panas kentang-kentang, hati-hati di jalan."],
    hujan: ["Jalanan licin, kurangi kecepatan lur!", "Pandangan terbatas, waspada genangan air."]
  }
};

export function processFeedItem({ item, locationReady, location, comments = {} }) {
  if (!item) return {};

  const now = new Date();
  const currentHour = now.getHours();
  
  // 1. DATA NORMALIZATION
  const validationCount = parseInt(item.total_minat) || 0; 
  const dbCheckins = parseInt(item.total_checkins) || 0;
  const activeViewers = Math.floor(Math.random() * 5) + 3; 
  const finalViewingCount = Math.ceil(activeViewers + dbCheckins);

  // 2. SIGNAL PROCESSING
  const internalComments = Array.isArray(comments[item.id]) ? comments[item.id] : [];
  const laporan = Array.isArray(item.laporan_terbaru) ? item.laporan_terbaru : [];
  const medsos = Array.isArray(item.medsos_terbaru) ? item.medsos_terbaru : [];
  const aktivitas = Array.isArray(item.aktivitas_terkini) ? item.aktivitas_terkini : [];

  const allSignals = [
    ...internalComments.map(c => ({ ...c, tipe: 'komentar_internal' })),
    ...medsos.map(m => ({ ...m, tipe: 'medsos' })), 
    ...laporan.map(l => ({ ...l, tipe: 'laporan' })),
    ...aktivitas.map(a => ({ ...a, tipe: 'checkin' }))
  ].map((s, idx) => {
    let platform = "Update Warga";
    const textContent = s.konten || s.content || s.text || s.deskripsi || s.catatan || "";
    if (s.tipe === "laporan") platform = s.estimasi_menit ? `Antrian ±${s.estimasi_menit}m` : "Laporan Langsung";
    else if (s.tipe === "komentar_internal") platform = "Kata Warga";
    
    return {
      ...s,
      username: s.username || "warga_lokal",
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${s.username || idx + item.id}`,
      text: textContent,
      platformLabel: platform,
      timeAgo: formatRelativeTime(s.created_at || s.timestamp || s.date || item.updated_at),
      isLive: (now - new Date(s.created_at || s.timestamp || s.date)) < 3600000 
    };
  }).filter(s => s.text).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  // 3. CONTEXTUAL DETECTION
  const isHujan = allSignals.some(s => /hujan|gerimis|deras|basah|mantol|neduh/i.test(s.text));
  const category = (item.category || item.kategori || 'umum').toLowerCase();
  
  let catGroup = 'publik';
  if (['cafe', 'resto', 'warung', 'kuliner', 'kopi'].some(k => category.includes(k))) catGroup = 'kuliner';
  if (['jalan', 'lalu lintas', 'simpang', 'raya'].some(k => category.includes(k))) catGroup = 'jalan';

  let timeVibe = "malam";
  if (currentHour >= 5 && currentHour < 11) timeVibe = "pagi";
  else if (currentHour >= 11 && currentHour < 15) timeVibe = "siang";
  else if (currentHour >= 15 && currentHour < 19) timeVibe = "sore";

  // 4. GENERATE HEADLINE DULU (UNTUK BASIS NARASI)
  const antrian = laporan.find(l => l.tipe === "antrian" || l.estimasi_menit > 0) || null;
  const suasana = laporan.find(l => l.tipe === "keramaian" || l.tipe === "suasana") || null;
  const aktivitasUtama = aktivitas[0] || null;

  const generatedHeadline = generateHeadline({ 
    item, 
    estimasiOrang: item.estimasi_orang, 
    antrian, 
    aktivitasUtama, 
    suasana 
  });

  // 5. INTELLIGENT & SYNCED NARASI SELECTION
  let narasiCerita = "";
  const headlineText = generatedHeadline.text.toLowerCase();

  if (isHujan) {
    narasiCerita = narasiLibrary[catGroup].hujan[Math.floor(Math.random() * 2)];
  } 
  // Jika headline deteksi sarapan/aktivitas, pastikan narasi mendukung
  else if (headlineText.includes("sarapan") || headlineText.includes("seliweran")) {
    narasiCerita = catGroup === 'kuliner' 
      ? "Lagi anget-angetnya, pas buat modal energi hari ini." 
      : "Warga mulai gerak produktif, suasana pagi yang asyik.";
  }
  else if (finalViewingCount > 25) {
    narasiCerita = catGroup === 'kuliner' ? "Lagi rame pol, antrean mulai mumbul lur!" : "Warga lagi tumplek blek di sini, energi Pasuruan!";
  } else if (validationCount > 5) {
    narasiCerita = `Valid! ${validationCount} warga baru saja memverifikasi kondisi ini.`;
  } else {
    const options = narasiLibrary[catGroup][timeVibe];
    narasiCerita = options[Math.floor(Math.random() * options.length)];
  }

  // 6. BADGE STATUS
  let badgeStatus = "Tenang";
  let badgeColor = "bg-emerald-50 text-emerald-600 border-emerald-100";
  let vibeIcon = timeVibe === "pagi" ? "🌅" : timeVibe === "siang" ? "☀️" : "🌙";

  if (isHujan) {
    badgeStatus = "☕ Cocok Neduh";
    badgeColor = "bg-blue-50 text-blue-600 border-blue-100";
    vibeIcon = "⛈️";
  } else if (finalViewingCount > 25) {
    badgeStatus = "🔥 Rame Pol";
    badgeColor = "bg-rose-50 text-rose-600 border-rose-100";
    vibeIcon = "⚡";
  }

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
    isRamai: finalViewingCount > 12,
    isViral: finalViewingCount > 25 || validationCount > 20,
    headline: generatedHeadline,
    activityTime: formatRelativeTime(item.updated_at) || "Baru saja"
  };
}