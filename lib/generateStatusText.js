// lib/generateStatusText.js

const pick = (arr) => {
  if (!arr || !Array.isArray(arr) || arr.length === 0) {
    console.warn("[generateStatusText] pick() received invalid array:", arr);
    return "Normal";
  }
  return arr[Math.floor(Math.random() * arr.length)];
};

// PICK DETERMINISTIC DENGAN DISTRIBUSI MERATA
const pickDeterministic = (arr, seed) => {
  if (!arr || !Array.isArray(arr) || arr.length === 0) return "Normal";
  
  let hash = 0;
  const str = String(seed);
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  
  const hour = new Date().getHours();
  const combinedSeed = Math.abs(hash + hour);
  
  return arr[combinedSeed % arr.length];
};

const getTimeContext = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return "pagi";
  if (hour >= 11 && hour < 15) return "siang";
  if (hour >= 15 && hour < 19) return "sore";
  return "malam";
};

// ============================================
// KAMUS FRASA - VERSI STATUS ISLAND (SUPER PENDEK)
// ============================================
const FRASA = {
  jalan: {
    macet: [
      "🚦 Macet panjang", "🚗 Stop & go", "🚧 Merayap pelan", 
      "🐢 Jalan kaki menang", "🐌 Kebut 5 km/jam", "🚦 Lampu merah 3x",
      "🚗 Merayap 10km/jam", "🛵 Selip-selip", "⏳ 30 menit 100m"
    ],
    ramai: [
      "🚗 Padat merayap", "🛵 Volume padat", "🚦 Mulai tersendat",
      "🚗 Saling susul", "🛵 Arus dua arah", "🚦 Antre di simpang"
    ],
    lancar: [
      "🛵 Gas pol aman", "✨ Longgar banget", "🚀 Lancar mulus", 
      "💨 Tanpa hambatan", "🛵 Jalan lowong", "✨ Sepi kendaraan", "🚗 60 km/jam"
    ]
  },
  kuliner: {
    ramai: [
      "🔥 Dapur ngebul", "👥 Meja penuh", "🍜 Antrean panjang", 
      "🔥 Lagi hits", "🍳 Pesanan numpuk", "👥 Waiting list", "🔥 Sold out"
    ],
    sepi: [
      "🍃 Meja kosong", "😴 Sepi pengunjung", "🍽️ Langsung duduk", 
      "🍃 Adem ayem", "😴 Pelayan ngantuk", "🍽️ Bisa pilih meja", "🍃 Suasana santai"
    ]
  },
  wisata: {
    ramai: [
      "🎡 Penuh wisatawan", "🎉 Antre foto", "🏃 Ramai keluarga", 
      "🔥 Tiket habis", "📸 Spot foto antre", "🚗 Parkir penuh", "👥 Weekend crowd"
    ],
    sepi: [
      "🍃 Sepi total", "😴 Lengang banget", "🌿 Hening tenang", 
      "✨ Sunyi sendiri", "🍃 Angin semilir", "😴 Tak ada orang", "🌿 Suara alam"
    ]
  },
  ibadah: {
    ramai: [
      "🕌 Saf penuh", "🤲 Jamaah padat", "🕋 Parkir penuh",
      "🕌 Jumatan ramai", "🤲 Saf sampai luar", "🕋 Terpal digelar"
    ],
    sepi: [
      "🕌 Sepi jamaah", "🤲 Luar waktu", "🍃 Teduh tenang",
      "🕌 Hanya marbot", "🤲 Suasana khusyuk", "🍃 Adzan berkumandang"
    ]
  },
  kesehatan: {
    ramai: [
      "🏥 Kursi penuh", "👨‍⚕️ Antre panjang", "🩺 Banyak pasien",
      "🏥 Nomor antrean", "👨‍⚕️ Dokter sibuk", "💊 Resep menumpuk"
    ],
    sepi: [
      "🏥 Langsung masuk", "💊 Tanpa antre", "🍃 Sepi pasien",
      "🏥 Hanya kontrol", "💊 Apotek sepi", "🍃 Perawat santai"
    ]
  },
  pendidikan: {
    ramai: [
      "📚 Koridor penuh", "👨‍🎓 Kantin ramai", "🏫 Jam sibuk",
      "📚 Bel masuk", "👨‍🎓 Upacara", "🏫 Pulang sekolah"
    ],
    sepi: [
      "🍃 Libur sekolah", "😴 Kelas kosong", "📖 Sepi kegiatan",
      "🍃 Gerbang tutup", "😴 Hanya satpam", "📖 Minggu tenang"
    ]
  },
  cuaca: {
    hujan: [
      "🌧️ Hujan deras", "⛈️ Petir menyambar", "☔ Payung wajib", 
      "🌊 Mulai banjir", "🌧️ Gerimis terus", "⛈️ Angin kencang",
      "☔ Jas hujan laris", "💧 Jalan licin"
    ],
    panas: [
      "☀️ Panas terik", "🔥 Gerah banget", "🍦 Butuh es",
      "☀️ 34 derajat", "🔥 AC menyala", "🧊 Es batu habis", "💦 Keringetan"
    ]
  }
};

// ============================================
// KAMUS DEFAULT BERDASARKAN KATEGORI + WAKTU
// ============================================
const DEFAULT_BY_CATEGORY_TIME = {
  // KULINER
  kuliner: {
    pagi: [
      "☕ Buka pagi", "🍳 Sarapan ready", "🥖 Roti baru matang",
      "🍜 Bubur masih panas", "☕ Kopi fresh brew", "🥐 Pastry baru keluar",
      "🍵 Teh anget", "🍚 Nasi uduk siap", "☕ Kedai mulai buka"
    ],
    siang: [
      "🍜 Makan siang", "🍱 Pesanan numpuk", "🔥 Dapur sibuk",
      "🍹 Es laris", "🍛 Nasi rames ready", "🥤 Minuman dingin",
      "🍲 Sop masih panas", "🔥 Wajan berdenting", "👥 Mulai antre"
    ],
    sore: [
      "☕ Ngopi sore", "🍰 Snack time", "🌅 Coffee break",
      "🍵 Teh sore", "🥐 Pastry diskon", "☕ Tempat nongkrong",
      "🍰 Kue baru jadi", "🌆 Ngabuburit", "🍜 Cari takjil"
    ],
    malam: [
      "🍜 Makan malam", "🌙 Supper time", "☕ Kopi malam",
      "🍲 Hidangan hangat", "🕯️ Dinner romantis", "🍜 Mie rebus",
      "🔥 Grill malam", "🍢 Sate ready", "🍻 Tempat santai"
    ]
  },
  
  // IBADAH
  ibadah: {
    pagi: [
      "🕌 Subuh tenang", "🤲 Dhuha sunyi", "🕋 Jamaah pagi",
      "🌅 Adzan subuh", "🤲 Doa pagi", "🕌 Saf masih longgar",
      "🍃 Suasana khusyuk", "🕯️ Lilin pagi", "🤲 Munajat sunyi"
    ],
    siang: [
      "🕌 Dzuhur tenang", "🤲 Jamaah siang", "🕋 Sholat tepat waktu",
      "☀️ Panas di luar", "🕌 Adzan dzuhur", "🤲 Istirahat ibadah",
      "🍃 Teduh dalam masjid", "🕋 Makmum mulai datang"
    ],
    sore: [
      "🕌 Ashar tenang", "🌆 Menjelang maghrib", "🤲 Menanti adzan",
      "🕌 Bersih-bersih", "🤲 Tadarus sore", "🕋 Persiapan buka",
      "🌙 Takjil disiapkan", "🕌 Menunggu maghrib"
    ],
    malam: [
      "🕌 Isya berjamaah", "🌙 Tarawih ramai", "🤲 Tahajud sunyi",
      "🕯️ I'tikaf malam", "🕌 Tadarus Al-Quran", "🤲 Doa malam",
      "🌌 Suasana hening", "🕌 Qiyamul lail"
    ]
  },
  
  // KESEHATAN
  kesehatan: {
    pagi: [
      "🏥 Buka pagi", "👨‍⚕️ Dokter datang", "🩺 Cek tekanan darah",
      "💊 Apotek buka", "🏥 Poli umum siap", "👨‍⚕️ Perawat standby",
      "🩺 Pendaftaran buka", "💉 Vaksinasi pagi"
    ],
    siang: [
      "🏥 Poli penuh", "👨‍⚕️ Praktek siang", "🩺 Antrean panjang",
      "💊 Tebus obat", "🏥 IGD standby", "👨‍⚕️ Dokter spesialis",
      "🩺 Cek lab", "💉 Suntik siang"
    ],
    sore: [
      "🏥 Poli sore", "👨‍⚕️ Praktek sore", "🩺 Kunjungan sore",
      "💊 Apotek tutup", "🏥 IGD malam", "👨‍⚕️ Jaga malam",
      "🩺 Cek kesehatan", "💉 Imunisasi sore"
    ],
    malam: [
      "🏥 IGD buka", "👨‍⚕️ Dokter jaga", "🩺 Emergensi",
      "💊 Farmasi 24 jam", "🏥 UGD standby", "👨‍⚕️ Perawat malam",
      "🩺 Pasien malam", "🌙 Rawat inap"
    ]
  },
  
  // PENDIDIKAN
  pendidikan: {
    pagi: [
      "📚 Bel masuk", "👨‍🎓 Upacara", "🏫 Mulai belajar",
      "📖 Perpustakaan buka", "👨‍🎓 Siswa datang", "🏫 Gerbang buka",
      "📚 Buku dibuka", "✏️ Mulai menulis", "🔔 Bel pertama"
    ],
    siang: [
      "📚 Jam istirahat", "👨‍🎓 Kantin ramai", "🏫 Pelajaran lanjut",
      "📖 Baca buku", "👨‍🎓 Diskusi kelompok", "🏫 Kelas siang",
      "📚 Tugas dikumpul", "✏️ Ujian siang"
    ],
    sore: [
      "📚 Pulang sekolah", "👨‍🎓 Ekskul mulai", "🏫 Kelas sore",
      "📖 Belajar mandiri", "👨‍🎓 Bimbel", "🏫 Gerbang tutup",
      "📚 PR dikerjakan", "✏️ Les privat"
    ],
    malam: [
      "📚 Belajar malam", "👨‍🎓 Kuliah malam", "🏫 Kampus sepi",
      "📖 Perpus tutup", "👨‍🎓 Tugas numpuk", "🌙 Ujian besok",
      "📚 Buku dibaca", "✏️ Ngerjain skripsi"
    ]
  },
  
  // WISATA
  wisata: {
    pagi: [
      "🎡 Buka pagi", "🏃 Jogging pagi", "🌅 Sunrise view",
      "📸 Foto pagi", "🎡 Wahana siap", "🏃 Olahraga pagi",
      "🌅 Pemandangan pagi", "🍃 Udara segar"
    ],
    siang: [
      "🎡 Ramai siang", "🏃 Pengunjung datang", "🌞 Panas terik",
      "📸 Spot foto antre", "🎡 Antre wahana", "🏃 Capai panas",
      "🍦 Es krim laris", "☀️ Butuh topi"
    ],
    sore: [
      "🎡 Sore santai", "🏃 Mulai sepi", "🌇 Sunset view",
      "📸 Golden hour", "🎡 Wahana tutup", "🏃 Pulang sore",
      "🌅 Foto senja", "🍃 Angin sepoi"
    ],
    malam: [
      "🎡 Tutup malam", "🏃 Sepi total", "🌙 Night view",
      "📸 Lampu malam", "✨ Suasana romantis", "🌌 Bintang terlihat",
      "🕯️ Lampu temaram", "😴 Lengang"
    ]
  },
  
  // JALAN (GENERAL TRAFFIC)
  jalan: {
    pagi: [
      "🚗 Berangkat kerja", "🛵 Macet pagi", "🚦 Arus padat",
      "🚌 Angkot penuh", "🚗 Antar sekolah", "🛵 Ojol narik",
      "🚦 Lampu merah", "🚗 Stop & go"
    ],
    siang: [
      "🚗 Arus normal", "🛵 Lumayan rame", "🚦 Lancar terkendali",
      "🚌 Sepi penumpang", "🚗 Jalan lowong", "🛵 Gas pol",
      "🚦 Hijau terus", "🚗 40 km/jam"
    ],
    sore: [
      "🚗 Pulang kerja", "🛵 Macet sore", "🚦 Arus balik",
      "🚌 Angkot penuh", "🚗 Bawa pulang", "🛵 Ojol rame",
      "🚦 Macet panjang", "🚗 Merayap"
    ],
    malam: [
      "🚗 Lengang malam", "🛵 Sepi kendaraan", "🚦 Lampu kuning",
      "🚌 Jarang lewat", "🚗 Jalan sepi", "🛵 Ngebut dikit",
      "🌙 Suasana malam", "🚦 Hati-hati"
    ]
  },
  
  // GENERAL (FALLBACK)
  general: {
    pagi: [
      "🌅 Mulai ramai", "🌄 Udara sejuk", "☕ Aktivitas pagi",
      "🌤️ Cerah pagi", "🌾 Embun pagi", "🚶 Orang berangkat",
      "🏃 Persiapan pagi", "🥖 Roti baru matang", "🚪 Mulai buka",
      "🍳 Sarapan pagi", "🚌 Angkot operasi", "🐓 Ayam berkokok",
      "🕊️ Burung berkicau", "🧹 Bersih-bersih", "🔔 Bel sekolah",
      "🚗 Mesin dipanaskan", "💨 Udara dingin", "🛵 Ojol mulai narik"
    ],
    siang: [
      "☀️ Panas terik", "🍜 Jam makan", "🕛 Siang sibuk",
      "🌡️ 32 derajat", "😎 Silau matahari", "💨 Angin panas",
      "🍱 Istirahat siang", "🚗 Jalanan padat", "🏢 Kantor sibuk",
      "🛒 Pasar ramai", "🍹 Es kelapa laris", "📞 Telepon berdering",
      "🔊 Klakson rame", "🎵 Musik toko", "💰 Koin berdenting",
      "🍳 Wajan panas", "☀️ Tepat di atas", "😓 Gerah pol",
      "🚦 Macet siang", "🍜 Warung penuh"
    ],
    sore: [
      "🌆 Sore pulang", "🏠 Mulai padat", "🌙 Menjelang malam",
      "🌇 Senja tiba", "☁️ Awan kemerahan", "🍂 Angin sore",
      "🚶 Pulang kerja", "🏃 Anak main", "🛵 Ojol standby",
      "🛍️ Belanja sore", "☕ Ngopi sore", "📺 TV dinyalakan",
      "🎭 Azan maghrib", "🔔 Bel pulang", "🚪 Pintu gerbang",
      "👋 Sapa tetangga", "🌆 Lampu mulai nyala", "🚗 Macet sore",
      "🍜 Cari makan malam", "😴 Capek kerja"
    ],
    malam: [
      "🌙 Suasana malam", "✨ Lengang tenang", "🦗 Malam sepi",
      "🌌 Bintang terlihat", "🕯️ Lampu temaram", "😴 Suasana tidur",
      "🍜 Makan malam", "🛵 Ojol malam", "🛒 Indomaret 24 jam",
      "☕ Kopi malam", "📱 Scroll HP", "🎮 Main game",
      "🦗 Jangkrik nyaring", "🐕 Anjing menggonggong", "🛵 Motor lewat",
      "🌬️ Angin malam", "🌙 Remang-remang",
      "🔦 Satpam ronda", "😴 Kota tertidur"
    ]
  }
};

function detectCategory(category, name) {
  const target = `${category} ${name}`.toLowerCase();
  
  if (target.match(/warung|kafe|resto|kuliner|kopi|makan|food|ngopi|kedai|rumah makan|restoran|cafe/)) return "kuliner";
  if (target.match(/masjid|mushola|gereja|ibadah|pura|vihara|klenteng|langgar|surau/)) return "ibadah";
  if (target.match(/rs|rumah sakit|klinik|puskesmas|dokter|apotek|poliklinik|ugd|igd/)) return "kesehatan";
  if (target.match(/taman|wisata|pantai|gunung|air terjun|danau|rekreasi|wahana|museum/)) return "wisata";
  if (target.match(/jalan|simpang|tol|perempatan|lampu merah|flyover|underpass|jembatan/)) return "jalan";
  if (target.match(/sekolah|pendidikan|kampus|universitas|sd|smp|sma|smk|madrasah|pesantren/)) return "pendidikan";
  
  return "general";
}

function detectKondisi(params) {
  const { kondisi, trafficCondition, deskripsi } = params;
  const desc = (deskripsi || "").toLowerCase();
  
  if (desc.match(/kecelakaan|tabrakan|laka|jatuh|tumburan/)) return "kecelakaan";
  if (desc.match(/hujan|deras|banjir|genangan|badai/)) return "hujan";
  
  if (trafficCondition === "Macet") return "macet";
  if (trafficCondition === "Ramai") return "ramaiTraffic";
  if (trafficCondition === "Lancar") return "lancar";
  
  const kondisiLower = (kondisi || "").toLowerCase();
  if (kondisiLower === "ramai") return "ramai";
  if (kondisiLower === "sepi") return "sepi";
  if (kondisiLower === "antri") return "antri";
  
  return "normal";
}

function getIconByCategory(category, isRamai = true, isSepi = false) {
  const icons = {
    kuliner: { ramai: "🍜", sepi: "🍃", default: "🍽️" },
    wisata: { ramai: "🎡", sepi: "🌿", default: "📍" },
    ibadah: { ramai: "🕌", sepi: "🕋", default: "🕌" },
    kesehatan: { ramai: "🏥", sepi: "💊", default: "🏥" },
    pendidikan: { ramai: "📚", sepi: "📖", default: "🏫" },
    jalan: { default: "🚗" }
  };
  
  const catIcons = icons[category];
  if (!catIcons) return "📍";
  if (isSepi && catIcons.sepi) return catIcons.sepi;
  if (isRamai && catIcons.ramai) return catIcons.ramai;
  return catIcons.default || "📍";
}

// Fungsi untuk mendapatkan default text dengan seed + kategori
export function getDefaultTextByTime(seed = null, category = "general") {
  const timeContext = getTimeContext();
  
  // Ambil kamus berdasarkan kategori, fallback ke general
  const categoryDict = DEFAULT_BY_CATEGORY_TIME[category] || DEFAULT_BY_CATEGORY_TIME.general;
  const options = categoryDict[timeContext] || categoryDict.siang || ["📍 Normal"];
  
  if (seed) {
    return pickDeterministic(options, seed);
  }
  return pick(options);
}

export function generateStatusText({ 
  kondisi, 
  trafficCondition, 
  total = 0, 
  isRecent = false, 
  category = "general", 
  name = "", 
  deskripsi = "", 
  jarak = "",
  seed = null
}) {
  const timeContext = getTimeContext();
  const detCat = detectCategory(category, name);
  const detKon = detectKondisi({ kondisi, trafficCondition, deskripsi });

  // Helper pick dengan seed
  const smartPick = (arr) => {
    if (!arr || arr.length === 0) return "Normal";
    if (seed) return pickDeterministic(arr, seed);
    return pick(arr);
  };

  // Fungsi helper untuk default pendek dengan kategori
  const getDefaultByCategoryAndTime = () => {
    const categoryDict = DEFAULT_BY_CATEGORY_TIME[detCat] || DEFAULT_BY_CATEGORY_TIME.general;
    const options = categoryDict[timeContext] || categoryDict.siang || ["📍 Normal"];
    if (seed) {
      return pickDeterministic(options, seed);
    }
    return pick(options);
  };

  if (!kondisi && !trafficCondition && !deskripsi && total === 0) {
    return {
      text: getDefaultByCategoryAndTime(),
      color: "text-gray-500",
      bgColor: "bg-gray-500",
      icon: "📍",
      badge: "NORMAL",
      vibe: "Pantau terus",
      level: 1
    };
  }

  if (detKon === "kecelakaan") {
    return { 
      text: "🚨 Kecelakaan!", 
      color: "text-red-600", 
      bgColor: "bg-red-600",
      icon: "🚨", 
      badge: "DARURAT", 
      vibe: "Cari jalur lain",
      level: 3 
    };
  }

  if (detKon === "hujan") {
    return { 
      text: smartPick(FRASA.cuaca.hujan), 
      color: "text-blue-600", 
      bgColor: "bg-blue-600",
      icon: "🌧️", 
      badge: "HUJAN", 
      vibe: jarak && parseFloat(jarak) < 2 ? "Hujan dekat sini" : "Jalanan licin",
      level: 2 
    };
  }

  if (detCat === "jalan") {
    if (detKon === "macet") {
      return { 
        text: smartPick(FRASA.jalan.macet), 
        color: "text-rose-600", 
        bgColor: "bg-rose-600",
        icon: "🚗", 
        badge: "MACET", 
        vibe: "Sabar ya",
        level: 3 
      };
    }
    if (detKon === "ramaiTraffic") {
      return { 
        text: smartPick(FRASA.jalan.ramai), 
        color: "text-amber-600", 
        bgColor: "bg-amber-600",
        icon: "🚗", 
        badge: "PADAT", 
        vibe: "Volume meningkat",
        level: 2 
      };
    }
    return { 
      text: smartPick(FRASA.jalan.lancar), 
      color: "text-emerald-600", 
      bgColor: "bg-emerald-600",
      icon: "🛵", 
      badge: "LANCAR", 
      vibe: "Gas terus",
      level: 1 
    };
  }

  const lifestyleData = FRASA[detCat];
  if (lifestyleData) {
    const isRamai = detKon === "ramai" || detKon === "antri" || detKon === "ramaiTraffic";
    const isSepi = detKon === "sepi";
    const icon = getIconByCategory(detCat, isRamai, isSepi);
    
    if (isRamai && total > 0) {
      if (total > 10 || isRecent) {
        return { 
          text: smartPick(lifestyleData.ramai), 
          color: "text-rose-600", 
          bgColor: "bg-rose-600",
          icon: icon, 
          badge: "RAMAI BANGET", 
          vibe: `${total} laporan baru`,
          level: 3 
        };
      }
      return { 
        text: smartPick(lifestyleData.ramai), 
        color: "text-amber-600", 
        bgColor: "bg-amber-600",
        icon: icon, 
        badge: "RAMAI", 
        vibe: `${total} laporan`,
        level: 2 
      };
    }
    
    if (isSepi && lifestyleData.sepi) {
      return { 
        text: smartPick(lifestyleData.sepi), 
        color: "text-emerald-600", 
        bgColor: "bg-emerald-600",
        icon: icon, 
        badge: "SEPI", 
        vibe: "Pas buat mampir",
        level: 1 
      };
    }
  }

  if (detKon === "antri" && total > 0) {
    return { 
      text: "⏳ Antrean ada", 
      color: "text-rose-600", 
      bgColor: "bg-rose-600",
      icon: "⏳", 
      badge: "ANTRI", 
      vibe: `Gerak pelan`,
      level: 2 
    };
  }

  return {
    text: getDefaultByCategoryAndTime(),
    color: "text-gray-500",
    bgColor: "bg-gray-500",
    icon: "📍",
    badge: "NORMAL",
    vibe: "Aman terkendali",
    level: 1
  };
}