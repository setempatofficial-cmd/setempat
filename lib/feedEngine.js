import { generateHeadline } from "./headlineEngine";

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

// 2. LIBRARY NARASI LENGKAP
const narasiLibrary = {
  kuliner: {
    pagi: ["Aroma masakannya juara, pas banget buat isi tenaga pagi ini.", "Pas buat sarapan sebelum gas kerja lur.", "Sarapan di sini emang gak pernah salah, masih anget!"],
    siang: ["Lagi jam maksi, siap-siap antre dikit ya.", "Matahari semangat, cari yang seger di sini enak.", "Menu siangnya mantap, cocok buat yang lagi laper berat."],
    sore: ["Vibes sore sambil ngopi tipis-tipis enak nih.", "Lagi santai, pas buat mampir sepulang kerja.", "Cemilan sore di sini juara, coba deh!"],
    malam: ["Suasana syahdu buat makan malam santai.", "Lampu-lampunya bikin betah nongkrong lama.", "Malam-malam gini emang paling pas cari yang anget di sini."],
    hujan: ["Hujan-hujan gini emang pas cari yang kuah-kuah.", "Neduh sambil ngopi, nikmat mana yang kau dustakan?"]
  },
  publik: {
    pagi: ["Udara segar banget, cocok buat gerak tipis-tipis.", "Suasana tenang, enak buat nikmati pagi di Pasuruan.", "Warga mulai ramai, semangat paginya lur!"],
    siang: ["Ramai lancar, banyak warga lagi aktivitas.", "Cerah pol! Jangan lupa kacamata hitamnya.", "Lagi terik, tapi suasana tetap asyik buat dipantau."],
    sore: ["Vibes senja di sini nggak pernah gagal.", "Enak buat duduk santai sambil liat orang lewat.", "Banyak anak muda lagi nongkrong sore, asyik suasananya."],
    malam: ["Malam makin syahdu, enak buat cari angin.", "Suasana tenang, cocok buat santai sejenak.", "Lampu kota Pasuruan mulai nyala, cantik banget dari sini."],
    hujan: ["Lagi basah, tetep cantik suasananya buat dipandang.", "Neduh dulu lur, jangan dipaksa jalan."]
  },
  jalan: {
    pagi: ["Lalu lintas lancar jaya, berangkat kerja aman.", "Masih anteng, gas tipis-tipis.", "Waspada simpang jalan, warga mulai padat berangkat aktivitas."],
    siang: ["Padat merayap, tetap sabar dan waspada ya!", "Panas kentang-kentang, hati-hati di jalan."],
    sore: ["Jam pulang kerja lur, simpang-simpang mulai padat.", "Waspada jam sibuk sore, tetap sabar di aspal!"],
    malam: ["Jalanan mulai lengang, tetap waspada penerangan minim.", "Lancar jaya buat muter-muter Pasuruan malam ini."],
    hujan: ["Jalanan licin, kurangi kecepatan lur!", "Pandangan terbatas, waspada genangan air."]
  }
};

export function processFeedItem({ item, locationReady, location, comments = {} }) {
  if (!item) return {};

  const now = new Date();
  const currentHour = now.getHours();
  
  // 3. KALKULASI JARAK (FIX AKURASI TEJOWANGI)
  let distance = null;
  
  // Ambil koordinat item dari database
  const itemLat = parseFloat(item.latitude || item.lat);
  const itemLng = parseFloat(item.longitude || item.lng || item.long);

  // Ambil koordinat user (Mendukung struktur .coords dari navigator.geolocation)
  const userLat = parseFloat(location?.coords?.latitude || location?.latitude);
  const userLng = parseFloat(location?.coords?.longitude || location?.longitude);

  if (locationReady && userLat && userLng && itemLat && itemLng) {
    distance = calculateDistance(userLat, userLng, itemLat, itemLng);
  }
  
  // 4. DATA NORMALIZATION
  const validationCount = parseInt(item.total_minat) || 0; 
  const dbCheckins = parseInt(item.total_checkins) || 0;
  const activeViewers = Math.floor(Math.random() * 5) + 3; 
  const finalViewingCount = Math.ceil(activeViewers + dbCheckins);

  // 5. SIGNAL PROCESSING
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

  // 6. CONTEXTUAL DETECTION
  const isHujan = allSignals.some(s => /hujan|gerimis|deras|basah|mantol|neduh/i.test(s.text));
  const category = (item.category || item.kategori || 'umum').toLowerCase();
  
  let catGroup = 'publik';
  if (['cafe', 'resto', 'warung', 'kuliner', 'kopi'].some(k => category.includes(k))) catGroup = 'kuliner';
  if (['jalan', 'lalu lintas', 'simpang', 'raya'].some(k => category.includes(k))) catGroup = 'jalan';

  let timeVibe = "malam";
  if (currentHour >= 5 && currentHour < 11) timeVibe = "pagi";
  else if (currentHour >= 11 && currentHour < 15) timeVibe = "siang";
  else if (currentHour >= 15 && currentHour < 19) timeVibe = "sore";

  // 7. GENERATE HEADLINE
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

  // 8. INTELLIGENT & SAFE NARASI SELECTION
  let narasiCerita = "";
  const headlineText = generatedHeadline?.text?.toLowerCase() || "";
  const selectedLib = narasiLibrary[catGroup] || narasiLibrary.publik;

  if (isHujan && Array.isArray(selectedLib.hujan) && selectedLib.hujan.length > 0) {
    narasiCerita = selectedLib.hujan[Math.floor(Math.random() * selectedLib.hujan.length)];
  } 
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
    const options = selectedLib[timeVibe] || selectedLib.siang || selectedLib.pagi || [];
    if (Array.isArray(options) && options.length > 0) {
      narasiCerita = options[Math.floor(Math.random() * options.length)];
    } else {
      narasiCerita = "Lagi tenang, pas buat mulai hari ini."; 
    }
  }

  // 9. BADGE STATUS
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
    distance, // JARAK REAL-TIME UNTUK UI
    isRamai: finalViewingCount > 12,
    isViral: finalViewingCount > 25 || validationCount > 20,
    headline: generatedHeadline,
    activityTime: formatRelativeTime(item.updated_at) || "Baru saja"
  };
}