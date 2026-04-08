// lib/generateRingkasanMultiUser.js

// Kata kunci untuk deteksi topik khusus
const TOPIC_KEYWORDS = {
  hujan: {
    keywords: ["hujan", "basah", "genangan", "banjir", "payung", "jas hujan"],
    template: "🌧️ Beberapa warga melaporkan hujan dan jalan basah."
  },
  macet: {
    keywords: ["macet", "padat", "merayap", "ngantri", "antre"],
    template: "🚗 Warga melaporkan kemacetan di sekitar sini."
  },
  kecelakaan: {
    keywords: ["kecelakaan", "tabrakan", "laka", "jatuh", "tertabrak"],
    template: "🚨 Ada laporan kecelakaan! Hati-hati melintas."
  },
  sampah: {
    keywords: ["sampah", "kotor", "bau", "tumpukan"],
    template: "🗑️ Warga mengeluhkan kebersihan di area ini."
  },
  lampu: {
    keywords: ["lampu merah", "lampu mati", "penerangan", "gelap"],
    template: "💡 Ada laporan tentang lampu/penerangan di sini."
  },
  bising: {
    keywords: ["bising", "kebisingan", "suara", "konstruksi", "bangunan"],
    template: "🔊 Warga melaporkan kebisingan di sekitar."
  },
  ramai: {
    keywords: ["ramai", "rame", "padat", "banyak orang"],
    template: "🏃 Beberapa warga melihat suasana ramai."
  },
  sepi: {
    keywords: ["sepi", "lengang", "kosong", "sunyi"],
    template: "🍃 Warga mengatakan suasana sepi dan tenang."
  }
};

// lib/generateRingkasanMultiUser.js
// Tambahkan di bagian atas, setelah TOPIC_KEYWORDS

const CATEGORY_VIBES = {
  industri: {
    ramai: "🏭 Aktivitas produksi berjalan normal",
    sepi: "🏭 Di luar jam operasional, area sepi",
    malam: "🏭 Shift malam beroperasi"
  },

   pendidikan: {
    ramai: "📚 Jam belajar, siswa dan guru aktif",
    sepi: "🍃 Di luar jam sekolah, suasana tenang",
    malam: "🌙 Malam hari, area sekolah sepi"
  },
  
  sekolah: {
    ramai: "📚 Siswa sedang belajar, suasana kondusif",
    sepi: "🍃 Libur sekolah, area sepi",
    malam: "🌙 Malam, area sekolah lengang"
  },
  
  universitas: {
    ramai: "🎓 Aktivitas kampus padat, banyak mahasiswa",
    sepi: "🍃 Di luar jam kuliah, suasana tenang",
    malam: "🌙 Malam, area kampus sepi"
  },

  jalan: {
    ramai: "🚗 Volume kendaraan tinggi",
    sepi: "🛵 Jalanan lengang",
    malam: "🌙 Waspada di malam hari"
  },
  kuliner: {
    ramai: "🍽️ Lagi rame, siap antre",
    sepi: "🍃 Waktu tepat makan tanpa antre",
    malam: "🌙 Makan malam enak nih"
  },
  wisata: {
    ramai: "🎡 Penuh wisatawan",
    sepi: "🌿 Waktu eksplorasi tanpa kerumunan",
    malam: "✨ Wisata malam lebih eksklusif"
  },
  ibadah: {
    ramai: "🕌 Waktu sholat berjamaah",
    sepi: "🕌 Di luar waktu sholat",
    malam: "🕌 Malam lebih khusyuk"
  },
  kesehatan: {
    ramai: "🏥 Pasien ramai, siap antre",
    sepi: "🏥 Langsung dilayani",
    malam: "🏥 Layanan darurat 24 jam"
  },
  general: {
    ramai: "🏃 Suasana ramai",
    sepi: "🍃 Suasana tenang",
    malam: "🌙 Malam, Istirahat"
  }
};

/**
 * Deteksi topik dari kumpulan laporan
 * @returns {Array} Topik yang terdeteksi
 */
function detectTopics(reports) {
  const topics = {};
  
  reports.forEach(report => {
    const text = (report.deskripsi || report.content || "").toLowerCase();
    
    for (const [topic, config] of Object.entries(TOPIC_KEYWORDS)) {
      const matched = config.keywords.some(kw => text.includes(kw));
      if (matched) {
        if (!topics[topic]) {
          topics[topic] = { count: 0, samples: [] };
        }
        topics[topic].count++;
        if (topics[topic].samples.length < 2) {
          topics[topic].samples.push(text.substring(0, 100));
        }
      }
    }
  });
  
  // Urutkan berdasarkan jumlah kemunculan terbanyak
  const sortedTopics = Object.entries(topics)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([topic, data]) => ({ topic, ...data }));
  
  return sortedTopics;
}

/**
 * Ekstrak kalimat menarik dari laporan (selain topik umum)
 */
function extractInterestingPhrases(reports) {
  const phrases = [];
  const commonWords = ["di", "ke", "dari", "yang", "dan", "itu", "ini", "sana", "sini", "karena", "jadi", "juga", "sudah", "belum", "akan", "telah"];
  
  reports.forEach(report => {
    const text = report.deskripsi || report.content || "";
    if (text.length < 15) return;
    
    // Cek apakah kalimat mengandung kata kunci topik
    const hasTopicKeyword = Object.values(TOPIC_KEYWORDS).some(config =>
      config.keywords.some(kw => text.toLowerCase().includes(kw))
    );
    
    // Jika sudah terdeteksi topik, jangan ambil lagi
    if (hasTopicKeyword) return;
    
    // Ambil kalimat pendek yang informatif
    const words = text.split(" ");
    if (words.length >= 3 && words.length <= 15) {
      phrases.push(text.substring(0, 80));
    } else if (words.length > 15) {
      // Ambil 10 kata pertama
      phrases.push(words.slice(0, 12).join(" ") + "...");
    }
  });
  
  return [...new Set(phrases)].slice(0, 2);
}

/**
 * Filter laporan berdasarkan waktu
 */
function filterReportsByTime(reports, hoursOnly = 12) {
  const now = new Date();
  const cutoffTime = new Date(now.getTime() - hoursOnly * 60 * 60 * 1000);
  return reports.filter(r => new Date(r.created_at) >= cutoffTime);
}

/**
 * Generate ringkasan multi-user
 * @param {Array} reports - Array laporan warga
 * @param {string} category - Kategori tempat (kuliner, wisata, jalan, dll)
 * @returns {string} Ringkasan teks
 */
export function generateRingkasanMultiUser(reports, category = "general") {
  if (!reports || reports.length === 0) {
    return "Belum ada laporan dari warga";
  }
  
  // Filter 12 jam terakhir
  const recentReports = filterReportsByTime(reports, 12);
  
  if (recentReports.length === 0) {
    return "Belum ada laporan dalam 12 jam terakhir";
  }
  
  if (recentReports.length === 1) {
    const r = recentReports[0];
    const text = r.deskripsi || r.content;
    if (text && text.length > 0) {
      return text.length > 100 ? text.substring(0, 100) + "..." : text;
    }
    return "Warga melaporkan: tidak ada keterangan detail";
  }
  
  // Deteksi topik dari laporan
  const detectedTopics = detectTopics(recentReports);
  const interestingPhrases = extractInterestingPhrases(recentReports);
  
  // Hitung tipe dominan
  const tipeCount = { Ramai: 0, Sepi: 0, Antri: 0 };
  recentReports.forEach(r => {
    if (r.tipe === 'Ramai') tipeCount.Ramai++;
    else if (r.tipe === 'Sepi') tipeCount.Sepi++;
    else if (r.tipe === 'Antri') tipeCount.Antri++;
  });
  
  const totalLaporan = recentReports.length;
  
  // 🔥 PRIORITAS 1: Topik khusus (kecelakaan, hujan, macet, dll)
  if (detectedTopics.length > 0) {
    const topTopic = detectedTopics[0];
    const topicConfig = TOPIC_KEYWORDS[topTopic.topic];
    const topicTemplate = topicConfig?.template || `📢 ${topTopic.count} warga melaporkan terkait ${topTopic.topic}.`;
    
    let ringkasan = topicTemplate;
    
    // Tambahkan kutipan menarik dari laporan
    if (topTopic.samples && topTopic.samples.length > 0) {
      ringkasan += `\n\n💬 "${topTopic.samples[0]}"`;
    }
    // Atau tambahkan frase menarik lainnya
    else if (interestingPhrases.length > 0) {
      ringkasan += `\n\n💬 "${interestingPhrases[0]}"`;
    }
    
    // Tambahkan info jumlah laporan jika ada laporan lain
    if (totalLaporan > topTopic.count) {
      ringkasan += `\n\n📊 +${totalLaporan - topTopic.count} laporan lainnya.`;
    }
    
    return ringkasan;
  }
  
  // 🔥 PRIORITAS 2: Berdasarkan tipe (Ramai/Sepi/Antri)
  let dominanTipe = 'Normal';
  let maxCount = 0;
  for (const [tipe, count] of Object.entries(tipeCount)) {
    if (count > maxCount) {
      maxCount = count;
      dominanTipe = tipe;
    }
  }
  
  let ringkasan = "";
  
  if (dominanTipe === 'Antri') {
    ringkasan = `⏳ ${totalLaporan} warga melaporkan adanya antrean.`;
  } 
  else if (dominanTipe === 'Ramai') {
    ringkasan = `🏃 ${totalLaporan} warga melihat suasana ramai di sini.`;
  } 
  else if (dominanTipe === 'Sepi') {
    ringkasan = `🍃 ${totalLaporan} warga mengatakan suasana sepi dan tenang.`;
  } 
  else {
    ringkasan = `${totalLaporan} warga memberikan laporan tentang kondisi di sini.`;
  }
  
  // Tambahkan frase menarik
  if (interestingPhrases.length > 0) {
    ringkasan += `\n\n💬 "${interestingPhrases[0]}"`;
  }
  
  return ringkasan;
}