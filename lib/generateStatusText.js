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
  // 🔥 JALAN (Macet, Ramai, Lancar)
  jalan: {
    macet: [
      "🚦 Macet panjang", "🚗 Stop & go", "🚧 Merayap pelan",
      "🐢 Jalan kaki saja", "🐌 Ngebut 5 km/jam", "🚦 Lampu merah 3x",
      "🚗 Merayap 10km/jam", "🛵 Selip-selip", "⏳ 30 menit 100m"
    ],
    macet_total: [
      "🚫🚗 Macet total", "🛑 Tidak bergerak", "🚧 Terkunci total",
      "🚫 Stuck lama", "🛑 Berhenti total"
    ],
    ramai: [
      "🚗 Padat merayap", "🛵 Volume padat", "🚦 Mulai tersendat",
      "🚗 Saling susul", "🛵 Arus dua arah", "🚦 Antre di simpang"
    ],
    lancar: [
      "🛵 Gas pol aman", "✨ Longgar banget", "🚀 Lancar mulus",
      "💨 Tanpa hambatan", "🛵 Jalan lowong", "✨ Sepi kendaraan"
    ]
  },

  // 🔥 KULINER (Ramai, Sepi, Antri, Penuh)
  kuliner: {
    ramai: [
      "🔥 Dapur ngebul", "👥 Meja penuh", "🍜 Antrean panjang",
      "🔥 Lagi Hits", "🍳 Pesanan numpuk", "👥 Waiting list"
    ],
    sepi: [
      "🍃 Meja kosong", "😴 Sepi pengunjung", "🍽️ Langsung duduk",
      "🍃 Adem ayem", "😴 Pelayan ngantuk", "🍽️ Bisa pilih meja"
    ]
  },

  // 🔥 WISATA (Ramai, Sepi, Padat, Tutup)
  wisata: {
    ramai: [
      "🎡 Penuh pengunjung", "🎉 Antre foto", "🏃 Ramai keluarga",
      "🔥 Tiket habis", "📸 Spot foto antre", "🚗 Parkir penuh"
    ],
    sepi: [
      "🍃 Sepi total", "😴 Lengang banget", "🌿 Hening tenang",
      "✨ Sunyi sendiri", "🍃 Angin semilir", "😴 Tak ada orang"
    ]
  },

  // 🔥 CUACA (Hujan, Panas)
  cuaca: {
    hujan: [
      "🌧️ Hujan deras", "⛈️ Petir menyambar", "☔ Payung wajib dibawa",
      "🌊 Mulai banjir", "🌧️ Gerimis terus", "⛈️ Angin kencang"
    ],
    panas: [
      "☀️ Panas terik", "🔥 Gerah banget", "🍦 Butuh es",
      "☀️ 34 derajat", "🔥 AC menyala", "🧊 Es batu habis"
    ]
  },

  // 🔥 PARKIR (Kosong, Tersedia, Hampir Penuh, Penuh)
  parkir: {
    kosong: [
      "🟢 Lapang banget", "🅿️ Banyak slot", "✨ Bebas pilih",
      "🟢 Parkir kosong", "🅿️ Mudah parkir"
    ],
    tersedia: [
      "🟡 Masih ada", "🅿️ Sisa sedikit", "⚠️ Cepat penuh",
      "🟡 Beberapa slot"
    ],
    hampir_penuh: [
      "🟠 Tipis", "🅿️ Cari celah", "⚠️ Hampir penuh",
      "🟠 Satu-dua slot"
    ],
    penuh: [
      "🔴 Penuh!", "🅿️ Cari lain", "🚫 Tidak ada slot",
      "🔴 Parkir penuh"
    ]
  },

  // 🔥 GENERAL FALLBACK - dipakai untuk kategori apapun yang tidak
  // punya kamus ramai/sepi sendiri (ibadah, kesehatan, pendidikan, general, dll)
  general: {
    ramai: [
      "👥 Mulai ramai", "🔥 Aktivitas meningkat", "👥 Banyak orang datang",
      "📈 Pengunjung naik"
    ],
    sepi: [
      "😌 Suasana sepi", "🍃 Cukup tenang", "😴 Lengang",
      "🌿 Sunyi sejenak"
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
      "🍲 Sop masih panas", "🔥 Wajan Bunyi semua", "👥 Mulai antre"
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

  // PARKIR
  parkir: {
    pagi: ["🅿️ Slot masih lega", "🟢 Baru buka, lapang"],
    siang: ["🅿️ Mulai terisi", "🟡 Cek dulu sisa slot"],
    sore: ["🅿️ Padat jam pulang", "🟠 Cari celah cepat"],
    malam: ["🅿️ Lumayan lega malam", "🟢 Sepi kendaraan"]
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
      "🔦 Satpam ", "😴 Kota tertidur"
    ]
  }
};

function detectCategory(category, name) {
  const target = `${category} ${name}`.toLowerCase();

  // 🔥 Parkir dicek lebih dulu supaya tidak ketiban keyword "penuh"/"padat" dari kategori lain
  if (target.match(/parkir|parking/)) return "parkir";

  // 🔥 Tambahkan kata kunci macet/lalu lintas
  if (target.match(/jalan|simpang|tol|perempatan|lampu merah|flyover|underpass|jembatan|macet|lalu lintas|kendaraan|motor|mobil|lalin/)) return "jalan";

  if (target.match(/warung|kafe|resto|kuliner|kopi|makan|food|ngopi|kedai|rumah makan|restoran|cafe/)) return "kuliner";
  if (target.match(/masjid|mushola|gereja|ibadah|pura|vihara|klenteng|langgar|surau/)) return "ibadah";
  if (target.match(/rs|rumah sakit|klinik|puskesmas|dokter|apotek|poliklinik|ugd|igd/)) return "kesehatan";
  if (target.match(/taman|wisata|pantai|gunung|air terjun|danau|rekreasi|wahana|museum/)) return "wisata";
  if (target.match(/sekolah|pendidikan|kampus|universitas|sd|smp|sma|smk|madrasah|pesantren/)) return "pendidikan";

  return "general";
}

// 🔥 PERBAIKAN UTAMA: peta langsung dari nilai `content`/`kondisi` (yang bersih,
// persis nilai action.tipe dari SmartCitizenButton) ke tipe internal.
// Ini dicek LEBIH DULU sebelum fallback ke pencarian kata dalam deskripsi bebas,
// supaya "Ramai: Nyaris Penuh" atau "Padat: Sangat Ramai" tidak salah kedeteksi
// gara-gara kata "penuh"/"padat" ikut ke-scan.
const DIRECT_KONDISI_MAP = {
  sepi: "sepi",
  ramai: "ramai",
  antri: "antri",
  penuh: "penuh",
  padat: "padat",
  tutup: "tutup",
  lancar: "lancar",
  macet: "macet",
  macettotal: "macet_total",
  hujan: "hujan",
  kosong: "kosong",
  tersedia: "tersedia",
  hampirpenuh: "hampir_penuh",
  kecelakaan: "kecelakaan",
};

function detectKondisi(params) {
  const { kondisi, trafficCondition, deskripsi } = params;

  // 🔥 PRIORITAS 1: kondisi eksplisit (dari tombol SmartCitizenButton, field `content`)
  const kondisiKey = String(kondisi || "").toLowerCase().replace(/[^a-z]/g, "");
  if (DIRECT_KONDISI_MAP[kondisiKey]) return DIRECT_KONDISI_MAP[kondisiKey];

  // 🔥 PRIORITAS 2: dari deskripsi bebas (fallback untuk laporan manual/lama
  // yang tidak melalui tombol, misal ketik manual di form)
  const desc = (deskripsi || "").toLowerCase();

  if (desc.match(/kecelakaan|tabrakan|laka|jatuh|tumburan|benturan/)) return "kecelakaan";
  if (desc.match(/macet total|stuck total|tidak bergerak/)) return "macet_total";
  if (desc.match(/macet|merayap|stop and go|stuck/)) return "macet";
  if (desc.match(/hujan|deras|banjir|genangan|badai|gerimis/)) return "hujan";
  if (desc.match(/tutup|libur/)) return "tutup";
  if (desc.match(/penuh|sesak|no table|full/)) return "penuh";
  if (desc.match(/padat/)) return "padat";
  if (desc.match(/antri|ngantri/)) return "antri";
  if (desc.match(/ramai|rame/)) return "ramai";
  if (desc.match(/sepi|kosong|lengang/)) return "sepi";
  if (desc.match(/lancar/)) return "lancar";

  // 🔥 PRIORITAS 3: dari trafficCondition (data eksternal, bukan laporan warga)
  if (trafficCondition === "Macet") return "macet";
  if (trafficCondition === "Ramai") return "ramaiTraffic";
  if (trafficCondition === "Lancar") return "lancar";

  return "normal";
}

function getIconByCategory(category, isRamai = true, isSepi = false) {
  const icons = {
    kuliner: { ramai: "🍜", sepi: "🍃", default: "🍽️" },
    wisata: { ramai: "🎡", sepi: "🌿", default: "📍" },
    ibadah: { ramai: "🕌", sepi: "🕋", default: "🕌" },
    kesehatan: { ramai: "🏥", sepi: "💊", default: "🏥" },
    pendidikan: { ramai: "📚", sepi: "📖", default: "🏫" },
    jalan: { default: "🚗" },
    parkir: { default: "🅿️" },
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

  // 🔥 JALAN: macet / macet total / ramai traffic / lancar
  if (detCat === "jalan") {
    if (detKon === "macet_total") {
      return {
        text: smartPick(FRASA.jalan.macet_total),
        color: "text-red-700",
        bgColor: "bg-red-700",
        icon: "🚫",
        badge: "MACET TOTAL",
        vibe: "Cari jalur lain sekarang",
        level: 4
      };
    }
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

  // 🔥 PARKIR: kosong / tersedia / hampir penuh / penuh
  if (detCat === "parkir") {
    const parkirKey = ["kosong", "tersedia", "hampir_penuh", "penuh"].includes(detKon)
      ? detKon
      : "kosong";
    const parkirConfig = {
      kosong: { color: "text-emerald-600", bgColor: "bg-emerald-600", badge: "KOSONG", vibe: "Bebas pilih slot", level: 1 },
      tersedia: { color: "text-amber-600", bgColor: "bg-amber-600", badge: "TERSEDIA", vibe: "Buruan sebelum penuh", level: 2 },
      hampir_penuh: { color: "text-orange-600", bgColor: "bg-orange-600", badge: "HAMPIR PENUH", vibe: "Cari celah cepat", level: 3 },
      penuh: { color: "text-red-600", bgColor: "bg-red-600", badge: "PENUH", vibe: "Cari parkir lain", level: 4 },
    }[parkirKey];

    return {
      text: smartPick(FRASA.parkir[parkirKey]),
      icon: "🅿️",
      ...parkirConfig
    };
  }

  // 🔥 KATEGORI LIFESTYLE (kuliner, wisata, ibadah, kesehatan, pendidikan, general, ...)
  // Fallback ke FRASA.general kalau kategori tidak punya kamus ramai/sepi sendiri
  const lifestyleData = FRASA[detCat] || FRASA.general;
  const ramaiPool = lifestyleData.ramai || FRASA.general.ramai;
  const sepiPool = lifestyleData.sepi || FRASA.general.sepi;

  const isRamai = detKon === "ramai" || detKon === "antri" || detKon === "padat";
  const isSepi = detKon === "sepi";
  const icon = getIconByCategory(detCat, isRamai, isSepi);

  if (detKon === "tutup") {
    return {
      text: "🔒 Tutup",
      color: "text-slate-600",
      bgColor: "bg-slate-600",
      icon: "🔒",
      badge: "TUTUP",
      vibe: "Sedang tidak beroperasi",
      level: 2
    };
  }

  if (detKon === "penuh") {
    return {
      text: "🚫 Penuh, tidak ada tempat",
      color: "text-red-600",
      bgColor: "bg-red-600",
      icon: "🚫",
      badge: "PENUH",
      vibe: "Coba lokasi lain atau tunggu",
      level: 3
    };
  }

  if (detKon === "antri" && total > 0) {
    return {
      text: "⏳ Antrean ada",
      color: "text-rose-600",
      bgColor: "bg-rose-600",
      icon: "⏳",
      badge: "ANTRI",
      vibe: "Gerak pelan",
      level: 2
    };
  }

  if (isRamai && total > 0) {
    if (total > 10 || isRecent) {
      return {
        text: smartPick(ramaiPool),
        color: "text-rose-600",
        bgColor: "bg-rose-600",
        icon: icon,
        badge: "RAMAI BANGET",
        vibe: `${total} laporan baru`,
        level: 3
      };
    }
    return {
      text: smartPick(ramaiPool),
      color: "text-amber-600",
      bgColor: "bg-amber-600",
      icon: icon,
      badge: "RAMAI",
      vibe: `${total} laporan`,
      level: 2
    };
  }

  if (isSepi) {
    return {
      text: smartPick(sepiPool),
      color: "text-emerald-600",
      bgColor: "bg-emerald-600",
      icon: icon,
      badge: "SEPI",
      vibe: "Pas buat mampir",
      level: 1
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