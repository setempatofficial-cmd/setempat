// aiHelpers.js

/**
 * 1. Logika Sambutan Dinamis (Greeting)
 * Agar sapaan AI relevan dengan waktu, user, cuaca, dan laporan
 */
export const getDynamicGreeting = (tempatName, userName, weather, activeReport) => {
  const hour = new Date().getHours();
  const greeting = hour < 11 ? "Pagi" : hour < 15 ? "Siang" : hour < 18 ? "Sore" : "Malam";
  const namaUser = userName ? `, ${userName}` : "";

  // Prioritas 1: Laporan Aktif (Ramai/Macet/Banjir dll)
  if (activeReport?.tipe) {
    const emojis = { 'Ramai': '👥', 'Sepi': '🍃', 'Antri': '⏳', 'Macet': '🚗', 'Banjir': '🌊' };
    const emoji = emojis[activeReport.tipe] || '📝';
    return `### ${greeting}${namaUser}! 👋\nSaya menemukan laporan **${activeReport.tipe}** di wilayah **${tempatName}**.\n\n---\n\n> ${emoji} **Pantauan Lokasi:**\n> "${activeReport.deskripsi || "Kondisi saat ini memerlukan perhatian lebih."}"\n\n💬 Ada yang ingin ditanyakan?`;
  }

  // Prioritas 2: Info Cuaca
  if (weather && weather.weather_desc) {
    return `### ${greeting}${namaUser}! 👋\n**Info Cuaca Terkini** ☀️\nDi sekitaran **${tempatName}** terpantau **${weather.weather_desc}** dengan suhu **${weather.t}°C**.\n\n---\n\nAda yang bisa kami bantu pantau di sini?`;
  }

  // Fallback: Default
  return `### ${greeting}${namaUser}! 👋\n**Pantauan Wilayah** 🌤️\nSaat ini belum ada laporan di **${tempatName}**. Kondisi terpantau normal.\n\n---\n\nAda yang bisa saya bantu?`;
};

/**
 * 2. Filter Instruksi AI berdasarkan Kategori (Context)
 * Agar Balai Desa nggak jawab soal menu makanan
 */
export const getContextByCategory = (category, tempatName) => {
  const cat = category?.toLowerCase() || "";

  if (cat.includes("kantor") || cat.includes("desa") || cat.includes("layanan")) {
    return `Kamu adalah asisten digital Balai Desa/Kantor ${tempatName}. Fokus pada: jam operasional, syarat administrasi (KK/KTP), info bantuan sosial, dan laporan warga. JANGAN bahas menu makanan atau reservasi meja.`;
  }

  if (cat.includes("kuliner") || cat.includes("warung") || cat.includes("cafe")) {
    return `Kamu adalah asisten kuliner di ${tempatName}. Fokus pada: menu andalan, harga, ketersediaan tempat, dan jam buka. Gunakan gaya bahasa santai dan menggugah selera.`;
  }

  return `Kamu adalah asisten wilayah untuk ${tempatName}. Bantu warga memberikan informasi situasi terkini di lokasi tersebut.`;
};

/**
 * 3. Filter Tombol Cepat (Quick Actions)
 */
export const getQuickActionsByCategory = (category, hasReports = false) => {
  const cat = category?.toLowerCase() || "";
  
  if (cat.includes("kantor") || cat.includes("desa") || cat.includes("layanan")) {
    return [
      { label: "Jam Operasional", icon: "🕒", prompt: "Jam berapa pelayanan buka?" },
      { label: "Syarat Surat", icon: "📄", prompt: "Apa syarat urus surat keterangan di sini?" },
      { label: "Info Bansos", icon: "💰", prompt: "Ada info bantuan sosial terbaru?" },
      { label: "Lapor Kondisi", icon: "📢", isLapor: true }
    ];
  }

  if (cat.includes("kuliner") || cat.includes("warung") || cat.includes("cafe")) {
    return [
      { label: "Menu Andalan", icon: "🍜", prompt: "Apa menu paling enak di sini?" },
      { label: "Cek Harga", icon: "🏷️", prompt: "Berapa kisaran harga makan di sini?" },
      { label: "Status Parkir", icon: "🅿️", prompt: "Parkirannya luas nggak buat mobil?" },
      { label: "Lapor Antrian", icon: "⏳", isLapor: true }
    ];
  }

  return [
    { label: "Situasi Terkini", icon: "🧐", prompt: "Gimana kondisi di sini sekarang?" },
    { label: "Cek Cuaca", icon: "☁️", prompt: "Cuaca di sekitar sini gimana?" },
    { label: "Lapor Warga", icon: "📸", isLapor: true }
  ];
};