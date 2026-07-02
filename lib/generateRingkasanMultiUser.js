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

  return Object.entries(topics)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([topic, data]) => ({ topic, ...data }));
}

/**
 * Ekstrak kalimat menarik dari laporan
 */
function extractInterestingPhrases(reports) {
  const phrases = [];

  reports.forEach(report => {
    const text = report.deskripsi || report.content || "";
    if (text.length < 15) return;

    const hasTopicKeyword = Object.values(TOPIC_KEYWORDS).some(config =>
      config.keywords.some(kw => text.toLowerCase().includes(kw))
    );

    if (hasTopicKeyword) return;

    const words = text.split(" ");
    if (words.length >= 3 && words.length <= 15) {
      phrases.push(text.substring(0, 80));
    } else if (words.length > 15) {
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
 * 🔥 Generate ringkasan multi-user (DENGAN dukungan passive signal & weather)
 * @param {Array} reports - Array laporan warga
 * @param {string} category - Kategori tempat
 * @param {Object} passiveSignal - Data dari external_signals { total, isCrowded, weather, citizenCount }
 * @param {Object} item - Data tempat { name }
 * @param {Object} weather - Data cuaca { short, temp, condition }
 * @returns {string} Ringkasan teks
 */
export function generateRingkasanMultiUser(
  reports = [],
  category = "general",
  passiveSignal = null,
  item = null,
  weather = null
) {

  // 🔥 PRIORITAS 1: Ada citizen report (dari external_signals)
  if (passiveSignal?.citizenCount > 0 && passiveSignal?.citizenReports?.length > 0) {
    const totalWarga = passiveSignal.citizenCount;
    const timePrefix = passiveSignal.hours <= 2 ? 'Baru saja' : `${passiveSignal.hours} jam terakhir`;

    // Ambil laporan citizen terbaru
    const latestReports = passiveSignal.citizenReports.slice(0, 3);
    const firstReport = latestReports[0] || '';

    // Deteksi tipe dari konten
    const lowerFirst = firstReport.toLowerCase();
    let emoji = '📢';
    let vibe = `${totalWarga} warga melapor`;

    if (lowerFirst.includes('sepi') || lowerFirst.includes('kosong')) {
      emoji = '😌';
      vibe = 'Suasana tenang dan nyaman';
    } else if (lowerFirst.includes('ramai')) {
      emoji = '👥';
      vibe = 'Suasana mulai ramai';
    } else if (lowerFirst.includes('antri')) {
      emoji = '🚶';
      vibe = 'Antrean panjang, siap-siap sabar';
    } else if (lowerFirst.includes('penuh')) {
      emoji = '🚫';
      vibe = 'Sudah penuh! Cari alternatif';
    } else if (lowerFirst.includes('macet')) {
      emoji = '🚗';
      vibe = 'Macet, siapkan kesabaran';
    } else if (lowerFirst.includes('hujan')) {
      emoji = '🌧️';
      vibe = 'Hujan turun, bawa payung';
    }

    let ringkasan = `📢 Laporan Warga (${timePrefix}):\n\n`;
    ringkasan += `${emoji} ${firstReport}\n`;

    if (latestReports.length > 1) {
      ringkasan += `\n📌 +${latestReports.length - 1} laporan lainnya.`;
    }

    // Tambahkan statistik view
    if (passiveSignal.uniqueViewers > 0) {
      ringkasan += `\n\n👀 ${passiveSignal.uniqueViewers} orang melihat detail.`;
    }

    // Tambahkan cuaca
    if (weather && !weather.isExtreme) {
      ringkasan += `\n☀️ Cuaca: ${weather.short} ${weather.temp}°C`;
    } else if (weather?.isExtreme) {
      ringkasan += `\n⚠️ Cuaca ekstrem! Waspada!`;
    }

    // Tips
    if (lowerFirst.includes('sepi') || lowerFirst.includes('kosong')) {
      ringkasan += '\n\n💡 Tips: Waktu yang tepat untuk berkunjung!';
    } else if (lowerFirst.includes('ramai') || lowerFirst.includes('antri')) {
      ringkasan += '\n\n💡 Tips: Siapkan waktu ekstra.';
    } else if (lowerFirst.includes('macet')) {
      ringkasan += '\n\n💡 Tips: Cari jalur alternatif.';
    } else if (lowerFirst.includes('hujan')) {
      ringkasan += '\n\n💡 Tips: Bawa perlengkapan hujan!';
    }

    return ringkasan;
  }

  // 🔥 PRIORITAS 2: Ada laporan fresh dari database (laporan_warga)
  if (reports && reports.length > 0) {
    const recentReports = filterReportsByTime(reports, 12);

    if (recentReports.length === 0) {
      // Cek passive signal sebagai fallback
      if (passiveSignal?.total > 0) {
        return generateFromPassiveSignal(passiveSignal, item, weather);
      }
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

    const detectedTopics = detectTopics(recentReports);
    const interestingPhrases = extractInterestingPhrases(recentReports);

    const tipeCount = { Ramai: 0, Sepi: 0, Antri: 0 };
    recentReports.forEach(r => {
      if (r.tipe === 'Ramai') tipeCount.Ramai++;
      else if (r.tipe === 'Sepi') tipeCount.Sepi++;
      else if (r.tipe === 'Antri') tipeCount.Antri++;
    });

    const totalLaporan = recentReports.length;

    if (detectedTopics.length > 0) {
      const topTopic = detectedTopics[0];
      const topicConfig = TOPIC_KEYWORDS[topTopic.topic];
      const topicTemplate = topicConfig?.template || `📢 ${topTopic.count} warga melaporkan terkait ${topTopic.topic}.`;

      let ringkasan = topicTemplate;
      if (topTopic.samples && topTopic.samples.length > 0) {
        ringkasan += `\n\n💬 "${topTopic.samples[0]}"`;
      } else if (interestingPhrases.length > 0) {
        ringkasan += `\n\n💬 "${interestingPhrases[0]}"`;
      }
      if (totalLaporan > topTopic.count) {
        ringkasan += `\n\n📊 +${totalLaporan - topTopic.count} laporan lainnya.`;
      }

      // Tambahkan cuaca
      if (weather && !weather.isExtreme) {
        ringkasan += `\n☀️ Cuaca: ${weather.short} ${weather.temp}°C`;
      }

      return ringkasan;
    }

    let dominanTipe = 'Normal';
    let maxCount = 0;
    for (const [tipe, count] of Object.entries(tipeCount)) {
      if (count > maxCount) {
        maxCount = count;
        dominanTipe = tipe;
      }
    }

    let ringkasan = '';
    if (dominanTipe === 'Antri') {
      ringkasan = `⏳ ${totalLaporan} warga melaporkan adanya antrean.`;
    } else if (dominanTipe === 'Ramai') {
      ringkasan = `🏃 ${totalLaporan} warga melihat suasana ramai di sini.`;
    } else if (dominanTipe === 'Sepi') {
      ringkasan = `🍃 ${totalLaporan} warga mengatakan suasana sepi dan tenang.`;
    } else if (interestingPhrases.length > 0) {
      ringkasan = `${totalLaporan} warga melapor.\n\n💬 "${interestingPhrases[0]}"`;
    } else {
      ringkasan = `${totalLaporan} warga memberikan laporan tentang kondisi di sini.`;
    }

    // Tambahkan cuaca
    if (weather && !weather.isExtreme) {
      ringkasan += `\n☀️ Cuaca: ${weather.short} ${weather.temp}°C`;
    }

    return ringkasan;
  }

  // 🔥 PRIORITAS 3: Tidak ada laporan, tapi ada passive signal (view detail, like, story)
  if (passiveSignal && passiveSignal.total > 0) {
    return generateFromPassiveSignal(passiveSignal, item, weather);
  }

  // 🔥 PRIORITAS 4: Default
  if (weather) {
    if (weather.isExtreme) {
      return `⚠️ PERINGATAN CUACA EKSTREM! ${weather.statusText}`;
    } else if (weather.isWarning) {
      return `🌧️ ${weather.statusText}. Waspada!`;
    } else {
      return `${weather.icon} Cuaca: ${weather.short} ${weather.temp}°C`;
    }
  }

  return "Belum ada laporan terbaru dari warga sekitar.";
}

/**
 * 🔥 Generate ringkasan dari passive signal (tanpa citizen report)
 */
function generateFromPassiveSignal(passiveSignal, item = null, weather = null) {
  const total = passiveSignal.total;
  const placeName = item?.name || 'tempat ini';
  const hour = new Date().getHours();
  const isEvening = hour >= 18 || hour <= 4;

  let ringkasan = '';

  // Cek cuaca ekstrem
  if (weather?.isExtreme) {
    ringkasan = `⚠️ PERINGATAN CUACA EKSTREM! ${weather.statusText}\n\n`;
    ringkasan += `🌡️ ${weather.temp}°C · 💧 ${weather.humidity}%`;
    return ringkasan;
  }

  if (weather?.isWarning) {
    ringkasan = `🌧️ ${weather.statusText}\n\n`;
    ringkasan += `🌡️ ${weather.temp}°C · 💧 ${weather.humidity}%`;
    return ringkasan;
  }

  if (passiveSignal.isCrowded) {
    if (isEvening) {
      ringkasan = `🌙 Malam ini, ${total} orang melihat detail ${placeName}. Suasana sedang ramai! 🔥`;
    } else {
      ringkasan = `🔥 ${total} orang melihat detail ${placeName} dalam 4 jam terakhir. Tempat ini sedang ramai diperhatikan! 👀`;
    }
  } else {
    if (isEvening) {
      ringkasan = `🌙 ${total} orang melihat detail ${placeName} malam ini. Mulai menarik minat. ✨`;
    } else {
      ringkasan = `👀 ${total} orang melihat detail ${placeName} dalam 4 jam terakhir. Mulai menarik perhatian. 📍`;
    }
  }

  // Tambahkan detail like/story
  const details = [];
  if (passiveSignal.like > 0) details.push(`❤️ ${passiveSignal.like} menyukai`);
  if (passiveSignal.storyView > 0) details.push(`📖 ${passiveSignal.storyView} melihat story`);

  if (details.length > 0) {
    ringkasan += `\n\n${details.join(' • ')}`;
  }

  // Tambahkan cuaca
  if (weather && !weather.isExtreme) {
    ringkasan += `\n\n☀️ Cuaca: ${weather.short} ${weather.temp}°C`;
  }

  return ringkasan;
}