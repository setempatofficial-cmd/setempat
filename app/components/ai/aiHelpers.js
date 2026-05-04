// app/components/aiHelpers.js

// Fungsi untuk mendapatkan quick actions berdasarkan kategori tempat
export function getQuickActionsByCategory(category, hasLaporan = false) {
  // Base actions yang selalu ada
  const baseActions = [
    { 
      id: "menu", 
      emoji: "🍽️", 
      label: "Menu", 
      query: "Ada menu atau produk apa saja di sini?",
      category: "info"
    },
    { 
      id: "driver", 
      emoji: "🚗", 
      label: "Cek Driver", 
      query: "Ada driver atau ojek online di sekitar sini?",
      category: "service"
    },
    { 
      id: "rewang", 
      emoji: "🧹", 
      label: "Cek Rewang", 
      query: "Ada jasa rewang atau PRT di sekitar sini?",
      category: "service"
    },
    { 
      id: "contact", 
      emoji: "📞", 
      label: "Kontak Pemilik", 
      query: "Bisa minta nomor kontak pemiliknya?",
      category: "info"
    },
    { 
      id: "jam_buka", 
      emoji: "⏰", 
      label: "Jam Buka", 
      query: "Jam berapa buka dan tutupnya?",
      category: "info"
    },
    { 
      id: "cctv", 
      emoji: "🎥", 
      label: "Lihat CCTV", 
      query: "Ada CCTV live streaming?",
      category: "pantau"
    },
    { 
      id: "kondisi", 
      emoji: hasLaporan ? "📊" : "👀", 
      label: hasLaporan ? "Kondisi Terkini" : "Pantau Sekarang", 
      query: "Kondisi di sini sekarang gimana? Ramai atau sepi?",
      category: "pantau"
    },
    { 
      id: "cuaca", 
      emoji: "🌤️", 
      label: "Cuaca", 
      query: "Cuaca di sini bagaimana?",
      category: "info"
    },
    { 
      id: "antrian", 
      emoji: "⏳", 
      label: "Cek Antrian", 
      query: "Sekarang antri panjang nggak?",
      category: "pantau"
    }
  ];

  // Actions berdasarkan kategori tempat
  const categoryActions = {
    // Tempat makan/kuliner
    'makanan': [
      { id: "menu_makanan", emoji: "🍜", label: "Menu Makanan", query: "Menu makanan apa yang tersedia? Ada yang viral?", category: "kuliner" },
      { id: "minuman", emoji: "🥤", label: "Menu Minuman", query: "Ada minuman apa saja?", category: "kuliner" },
      { id: "promo", emoji: "🎉", label: "Promo", query: "Ada promo atau diskon hari ini?", category: "kuliner" }
    ],
    'wisata': [
      { id: "tiket", emoji: "🎟️", label: "Harga Tiket", query: "Harga tiket masuk berapa?", category: "wisata" },
      { id: "fasilitas", emoji: "🏊", label: "Fasilitas", query: "Fasilitas apa saja yang tersedia?", category: "wisata" },
      { id: "jam_operasional", emoji: "⏰", label: "Jam Operasional", query: "Jam operasional sampai jam berapa?", category: "wisata" }
    ],
    'kafe': [
      { id: "menu_kafe", emoji: "☕", label: "Menu Kopi", query: "Menu kopi apa yang enak?", category: "kuliner" },
      { id: "wifi", emoji: "📶", label: "Ada WiFi?", query: "Ada WiFi gratis nggak?", category: "fasilitas" },
      { id: "live_music", emoji: "🎸", label: "Live Music", query: "Ada live music atau acara?", category: "hiburan" }
    ],
    'pasar': [
      { id: "komoditas", emoji: "🥬", label: "Harga Komoditas", query: "Harga sayur dan bahan pokok naik turun?", category: "belanja" },
      { id: "pedagang", emoji: "👨‍🌾", label: "Pedagang", query: "Pedagang apa saja yang buka?", category: "info" }
    ]
  };

  // Gabungkan base actions + actions berdasarkan kategori
  let actions = [...baseActions];
  
  if (category && categoryActions[category]) {
    actions = [...actions, ...categoryActions[category]];
  }
  
  // Filter duplikat berdasarkan query
  const seen = new Set();
  actions = actions.filter(action => {
    if (seen.has(action.query)) return false;
    seen.add(action.query);
    return true;
  });
  
  // Batasi maksimal 8 actions agar tidak penuh
  return actions.slice(0, 8);
}

// Fungsi untuk mendapatkan sambutan AI yang dinamis
export function getDynamicGreeting(tempatName, userName, weather, activeReport, distance) {
  const hour = new Date().getHours();
  const greeting = hour < 11 ? "Pagi" : hour < 15 ? "Siang" : hour < 18 ? "Sore" : "Malam";
  
  const namaFormatted = userName ? `, ${userName}` : "";
  const jarakText = distance ? ` (${distance.toFixed(1)} km dari lokasi kamu)` : "";
  
  // Case 1: Ada laporan aktif
  if (activeReport?.tipe) {
    const emojis = { 'Ramai': '👥', 'Sepi': '🍃', 'Antri': '⏳', 'Macet': '🚗', 'Banjir': '🌊' };
    const emoji = emojis[activeReport.tipe] || '📝';
    
    return `### ${greeting}${namaFormatted}! 👋

Saya menemukan laporan **${activeReport.tipe}** di **${tempatName}**${jarakText}.

---

> ${emoji} **Info Terkini:**  
> "${activeReport.deskripsi || "Kondisi saat ini memerlukan perhatian lebih."}"

💡 **Coba tanya saya:**
• "Ada menu apa?" 🍽️
• "Cek driver online" 🚗
• "Kontak pemiliknya" 📞
• "Jam buka berapa?" ⏰

Atau klik tombol di bawah! 👇`;
  }
  
  // Case 2: Ada data cuaca
  if (weather?.weather_desc) {
    return `### ${greeting}${namaFormatted}! 👋

☀️ **Cuaca di ${tempatName}**${jarakText}
Saat ini **${weather.weather_desc}** dengan suhu **${weather.t}°C**.

---

💡 **Apa yang bisa saya bantu?**
• 🍽️ Lihat menu & harga
• 🚗 Cek driver/rewang terdekat
• 📊 Pantau kondisi terkini
• 📞 Kontak pemilik tempat

Tinggal tanya atau klik tombol di bawah! 😊`;
  }
  
  // Case 3: Default greeting
  return `### ${greeting}${namaFormatted}! 👋

Selamat datang di **${tempatName}**${jarakText}

---

💡 **Saya asisten virtual siap bantu 24 jam!**

🍽️ **Tanya menu** → "Ada menu apa?"
🚗 **Cari driver** → "Ada driver online?"
📊 **Pantau kondisi** → "Sekarang ramai nggak?"
⏰ **Jam operasional** → "Jam berapa buka?"
🌤️ **Info cuaca** → "Cuaca di sini gimana?"
📞 **Kontak pemilik** → "Nomor pemiliknya dong"

Klik tombol di bawah atau tulis pertanyaanmu! 👇`;
}