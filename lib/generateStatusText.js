// lib/generateStatusText.js

const pick = (arr) => {
  if (!arr || !Array.isArray(arr) || arr.length === 0) {
    console.warn("[generateStatusText] pick() received invalid array:", arr);
    return "Kondisi Normal";
  }
  return arr[Math.floor(Math.random() * arr.length)];
};

const getTimeContext = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return { label: "pagi", sapaan: "Semangat Pagi" };
  if (hour >= 11 && hour < 15) return { label: "siang", sapaan: "Siang, Lur" };
  if (hour >= 15 && hour < 19) return { label: "sore", sapaan: "Sore Santuy" };
  return { label: "malam", sapaan: "Malam, Waspada" };
};

// KAMUS FRASA
const FRASA = {
  jalan: {
    macet: ["🚦 Lagi padat", "🚗 Macet pelan", "🚧 Tersendat", "🐢 Merayap", "🐌 Pelan banget"],
    ramai: ["🚗 Mulai ramai", "🛵 Volume naik", "🚦 Mulai merayap"],
    lancar: ["🛵 Lancar jaya", "✨ Aman dilewati", "🚀 Lancar poll", "💨 Ngalir terus"]
  },
  kuliner: {
    ramai: ["🔥 Lagi rame", "👥 Banyak nongkrong", "🍜 Antre panjang", "🔥 Hits banget"],
    sepi: ["🍃 Masih santai", "😴 Belum ramai", "🍽️ Langsung dapat meja", "🍃 Adem"]
  },
  wisata: {
    ramai: ["🎡 Penuh wisatawan", "🎉 Meriah banget", "🏃 Ramai pengunjung", "🔥 Viral banget"],
    sepi: ["🍃 Sepi pengunjung", "😴 Lengang", "🌿 Tenang", "✨ Sunyi"]
  },
  ibadah: {
    ramai: ["🕌 Jamaah padat", "🤲 Penuh jamaah", "🕋 Saf Penuh"],
    sepi: ["🕌 Sepi jamaah", "🤲 Di luar waktu", "🍃 Tenang beribadah"]
  },
  kesehatan: {
    ramai: ["🏥 Pasien ramai", "👨‍⚕️ Antre panjang", "🩺 Waiting list"],
    sepi: ["🏥 Sepi pasien", "💊 Langsung dilayani", "🍃 Tidak antre"]
  },
  pendidikan: {
    ramai: ["📚 Siswa padat", "👨‍🎓 Penuh kegiatan", "🏫 Jam belajar"],
    sepi: ["🍃 Liburan sekolah", "😴 Sepi aktivitas", "📖 Tenang belajar"]
  },
  cuaca: {
    hujan: ["🌧️ Lagi hujan", "⛈️ Deras banget", "☔ Sedia payung", "🌊 Genangan air"],
    panas: ["☀️ Terik pol", "🔥 Gerah banget", "🍦 Butuh yang dingin"]
  }
};

function detectCategory(category, name) {
  const target = `${category} ${name}`.toLowerCase();
  
  // Prioritaskan deteksi berdasarkan keyword
  if (target.match(/warung|kafe|resto|kuliner|kopi|makan|food|ngopi/)) return "kuliner";
  if (target.match(/masjid|mushola|gereja|ibadah|pura|vihara/)) return "ibadah";
  if (target.match(/rs|rumah sakit|klinik|puskesmas|dokter/)) return "kesehatan";
  if (target.match(/taman|wisata|pantai|gunung|air terjun|danau/)) return "wisata";
  if (target.match(/jalan|simpang|tol|perempatan|lampu merah|flyover/)) return "jalan";
  if (target.match(/sekolah|pendidikan|kampus|universitas|sd|smp|sma/)) return "pendidikan";
  
  return "general";
}

function detectKondisi(params) {
  const { kondisi, trafficCondition, deskripsi } = params;
  const desc = (deskripsi || "").toLowerCase();
  
  // Prioritas tertinggi: Darurat
  if (desc.match(/kecelakaan|tabrakan|laka|jatuh|tumburan/)) return "kecelakaan";
  
  // Prioritas kedua: Cuaca ekstrem
  if (desc.match(/hujan|deras|banjir|genangan|badai/)) return "hujan";
  
  // Prioritas ketiga: Lalu lintas
  if (trafficCondition === "Macet") return "macet";
  if (trafficCondition === "Ramai") return "ramaiTraffic";
  if (trafficCondition === "Lancar") return "lancar";
  
  // Prioritas keempat: Kondisi umum
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

export function generateStatusText({ 
  kondisi, 
  trafficCondition, 
  total = 0, 
  isRecent = false, 
  category = "general", 
  name = "", 
  deskripsi = "", 
  jarak = "" 
}) {
  // Validasi input minimal
  if (!kondisi && !trafficCondition && !deskripsi && total === 0) {
    const { sapaan } = getTimeContext();
    return {
      text: `${sapaan}!`,
      color: "text-gray-500",
      bgColor: "bg-gray-500",
      icon: "📍",
      badge: "NORMAL",
      vibe: "Belum ada laporan baru.",
      level: 1
    };
  }
  
  const { sapaan } = getTimeContext();
  const detCat = detectCategory(category, name);
  const detKon = detectKondisi({ kondisi, trafficCondition, deskripsi });

  // PRIORITAS 1: KECELAKAAN (DARURAT)
  if (detKon === "kecelakaan") {
    return { 
      text: "🚨 Ada Kecelakaan", 
      color: "text-red-600", 
      bgColor: "bg-red-600",
      icon: "🚨", 
      badge: "DARURAT", 
      vibe: "Hati-hati, Lur! Cari rute alternatif.", 
      level: 3 
    };
  }

  // PRIORITAS 2: HUJAN
  if (detKon === "hujan") {
    return { 
      text: pick(FRASA.cuaca.hujan), 
      color: "text-blue-600", 
      bgColor: "bg-blue-600",
      icon: "🌧️", 
      badge: "HUJAN", 
      vibe: jarak && parseFloat(jarak) < 2 ? "Hujan di dekat lokasi! Sedia mantul/payung." : "Sedia mantel/payung ya!",
      level: 2 
    };
  }

  // PRIORITAS 3: JALAN
  if (detCat === "jalan") {
    if (detKon === "macet") {
      return { 
        text: pick(FRASA.jalan.macet), 
        color: "text-rose-600", 
        bgColor: "bg-rose-600",
        icon: "🚗", 
        badge: "MACET", 
        vibe: "Sabar ya, tetap fokus dan jaga jarak!",
        level: 3 
      };
    }
    if (detKon === "ramaiTraffic") {
      return { 
        text: pick(FRASA.jalan.ramai), 
        color: "text-amber-600", 
        bgColor: "bg-amber-600",
        icon: "🚗", 
        badge: "PADAT", 
        vibe: "Volume kendaraan meningkat, waspadai perlambatan.",
        level: 2 
      };
    }
    return { 
      text: pick(FRASA.jalan.lancar), 
      color: "text-emerald-600", 
      bgColor: "bg-emerald-600",
      icon: "🛵", 
      badge: "LANCAR", 
      vibe: "Gas pol, tapi tetap safety dan patuhi rambu!",
      level: 1 
    };
  }

  // PRIORITAS 4: LIFESTYLE (Kuliner, Wisata, Ibadah, Kesehatan, Pendidikan)
  const lifestyleData = FRASA[detCat];
  if (lifestyleData) {
    const isRamai = detKon === "ramai" || detKon === "antri" || detKon === "ramaiTraffic";
    const isSepi = detKon === "sepi";
    const icon = getIconByCategory(detCat, isRamai, isSepi);
    
    if (isRamai && total > 0) {
      if (total > 10 || isRecent) {
        return { 
          text: pick(lifestyleData.ramai), 
          color: "text-rose-600", 
          bgColor: "bg-rose-600",
          icon: icon, 
          badge: "🔥 SUPER RAMAI", 
          vibe: `Lagi rame banget! ${total} laporan terbaru. Siap antre?`,
          level: 3 
        };
      }
      return { 
        text: pick(lifestyleData.ramai), 
        color: "text-amber-600", 
        bgColor: "bg-amber-600",
        icon: icon, 
        badge: "RAMAI", 
        vibe: `Lagi rame (${total} laporan), siap antre atau cari alternatif.`,
        level: 2 
      };
    }
    
    if (isSepi && lifestyleData.sepi) {
      return { 
        text: pick(lifestyleData.sepi), 
        color: "text-emerald-600", 
        bgColor: "bg-emerald-600",
        icon: icon, 
        badge: "SEPI", 
        vibe: "Waktunya mampir! Nikmati suasana.",
        level: 1 
      };
    }
  }

  // PRIORITAS 5: ANTRI (Hanya jika ada laporan dan total > 0)
  if (detKon === "antri" && total > 0) {
    return { 
      text: "⏳ Ada Antrian", 
      color: "text-rose-600", 
      bgColor: "bg-rose-600",
      icon: "⏳", 
      badge: "ANTRI", 
      vibe: `Antrean terdeteksi (${total} laporan). Sabar ya!`,
      level: 2 
    };
  }

  // DEFAULT: Kondisi normal
  return {
    text: `${sapaan}! Aman`,
    color: "text-gray-500",
    bgColor: "bg-gray-500",
    icon: "📍",
    badge: "NORMAL",
    vibe: "Belum ada laporan baru. Stay safe!",
    level: 1
  };
}