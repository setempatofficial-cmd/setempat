// components/ai/aiHelpers.js

export const getCurrentTimeTag = () => {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return "pagi";
  if (h >= 11 && h < 15) return "siang";
  if (h >= 15 && h < 18) return "sore";
  return "malam";
};

export const getGreeting = () => {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return "Selamat pagi";
  if (h >= 11 && h < 15) return "Selamat siang";
  if (h >= 15 && h < 18) return "Selamat sore";
  return "Selamat malam";
};

export const getRandomEmoji = () => {
  const emojis = ["😊", "👋", "🤗", "🏘️", "🌳", "🚶", "☕", "🍜", "📢", "👥"];
  return emojis[Math.floor(Math.random() * emojis.length)];
};

export const isLaporIntent = (text) => {
  const lower = text.toLowerCase();
  const keywords = ["lapor", "kirim", "upload", "foto", "report", "posting", "mau cerita", "ceritain"];
  return keywords.some(k => lower.includes(k));
};

export const generateRingkasanDariData = (reports, stats, tempatName, jarak) => {
  const hasLaporan = reports.length > 0;
  const waktuTag = getCurrentTimeTag();
  const greeting = getGreeting();
  const emoji = getRandomEmoji();
  
  if (!hasLaporan) {
    return `${greeting}, Lur! ${emoji}\n\nBelum ada laporan terbaru di **${tempatName}**${jarak ? ` (${jarak} dari sini)` : ''}.\n\n**📸 Yuk jadi yang pertama lapor!**`;
  }
  
  const latest = reports[0];
  const kondisi = latest.tipe === 'Sepi' ? 'sepi' : latest.tipe === 'Ramai' ? 'ramai' : latest.tipe === 'Antri' ? 'ada antrian' : 'normal';
  const estimasi = latest.estimated_people ? ` sekitar ${latest.estimated_people} orang` : '';
  const cerita = latest.deskripsi || latest.content;
  const userName = latest.user_name?.split(' ')[0] || 'Warga';
  
  let ringkasan = `${greeting}, Lur! ${emoji}\n\n`;
  ringkasan += `📍 **${tempatName}**${jarak ? ` (${jarak} dari sini)` : ''}\n`;
  ringkasan += `🕐 ${waktuTag} ini kondisi **${kondisi}**${estimasi}.\n\n`;
  
  if (cerita) {
    ringkasan += `🗣️ **Cerita terbaru dari @${userName}**:\n"${cerita.substring(0, 100)}${cerita.length > 100 ? '...' : ''}"\n\n`;
  }
  
  if (stats.total > 1) {
    ringkasan += `📊 **Hari ini**: ${stats.total} laporan (${stats.ramai} ramai, ${stats.sepi} sepi, ${stats.antri} antri)\n\n`;
  }
  
  ringkasan += `**📢 Ada yang mau kamu ceritakan tentang ${tempatName}?**`;
  
  return ringkasan;
};

export const getQuickActionsByCategory = (category, hasLaporan) => {
  const categoryLower = category?.toLowerCase() || '';
  
  const baseActions = [
    { label: "🍃 Kondisi", query: "Kondisi di sini gimana?" },
    { label: "🌧️ Cuaca", query: "Cuaca di sana gimana?" },
    { label: "🕐 Jam Buka", query: "Jam buka di sini jam berapa?" },
  ];
  
  let categoryActions = [];
  
  if (categoryLower.includes('kuliner') || categoryLower.includes('cafe')) {
    categoryActions = [
      { label: "🍽️ Rekomendasi", query: "Menu rekomendasi di sini apa?" },
      { label: "⏰ Jam Ramai", query: "Jam berapa biasanya ramai?" },
    ];
  } 
  else if (categoryLower.includes('wisata') || categoryLower.includes('taman')) {
    categoryActions = [
      { label: "🎟️ Tiket", query: "Berapa harga tiket masuk?" },
      { label: "⏰ Jam Buka", query: "Jam buka sampai jam berapa?" },
    ];
  }
  else if (categoryLower.includes('jalan') || categoryLower.includes('simpang')) {
    categoryActions = [
      { label: "🚗 Lalin", query: "Lalu lintas di sini gimana?" },
      { label: "🚦 Macet", query: "Sekitar sini macet?" },
    ];
  }
  else {
    categoryActions = [
      { label: "👥 Ramai?", query: "Sekitar sini ramai?" },
      { label: "⏳ Antrian?", query: "Ada antrian?" },
    ];
  }
  
  if (hasLaporan) {
    categoryActions.unshift({ label: "📢 Cerita Terbaru", query: "Apa cerita warga terbaru?" });
  }
  
  return [...baseActions, ...categoryActions].slice(0, 6);
};