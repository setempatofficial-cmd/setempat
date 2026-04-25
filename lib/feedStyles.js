export const CATEGORY_STYLES = {
  // --- WISATA & ALAM (Emerald ke Teal) ---
  // Filosofi: Mewakili kesegaran alam Pasuruan, dari Bromo hingga pemandian alam. 
  // Memberikan kesan tenang dan rekreatif.
  "wisata": {
    bg: "bg-emerald-50/60 dark:bg-emerald-400/10", // Mode malam pakai warna terang tapi opasitas kecil
    border: "border-emerald-200/60 dark:border-emerald-400/20",
    text: "text-emerald-700 dark:text-emerald-400", // Teks malam lebih terang
    accent: "bg-emerald-500",
    icon: "🍃"
  },
  
  // --- KULINER & CAFE (Amber ke Orange) ---
  // Filosofi: Warna ini memicu nafsu makan (appetite) dan kehangatan. 
  // Cocok untuk kopi, makanan legendaris, dan tempat nongkrong.
  "kuliner": {
    bg: "bg-amber-50/60 dark:bg-amber-400/10",
    border: "border-amber-200/60 dark:border-amber-400/20",
    text: "text-amber-700 dark:text-amber-400",
    accent: "bg-amber-500",
    icon: "🥣"
  },

  // --- PUBLIK, DESA & PENDIDIKAN (Indigo ke Blue) ---
  // Filosofi: Biru melambangkan kepercayaan (trust), keteraturan, dan pelayanan. 
  // Memberikan kesan formal tapi membantu bagi warga.
  "layanan": {
    bg: "bg-indigo-50/50 dark:bg-indigo-950/20",
    border: "border-indigo-200/60 dark:border-indigo-500/30",
    text: "text-indigo-700 dark:text-indigo-300",
    accent: "bg-indigo-500",
    icon: "🏛️"
  },

  // --- INFRASTRUKTUR & JALAN (Slate ke Zinc) ---
  // Filosofi: Melambangkan fondasi, aspal, dan jalur transportasi. 
  // Netral dan kokoh, mencerminkan konektivitas antar wilayah.
  "transportasi": {
    bg: "bg-slate-100/60 dark:bg-slate-800/30",
    border: "border-slate-300/60 dark:border-slate-600/30",
    text: "text-slate-700 dark:text-slate-300",
    accent: "bg-slate-600",
    icon: "🛣️"
  },

  // --- KESEHATAN (Rose ke Crimson) ---
  // Filosofi: Melambangkan kemanusiaan, urgensi, dan perawatan (care). 
  // Warna yang hangat namun sigap.
  "kesehatan": {
    bg: "bg-rose-50/50 dark:bg-rose-950/20",
    border: "border-rose-200/60 dark:border-rose-500/30",
    text: "text-rose-700 dark:text-rose-300",
    accent: "bg-rose-500",
    icon: "🩺"
  },

  // --- IBADAH & BUDAYA (Violet ke Purple) ---
  // Filosofi: Melambangkan spiritualitas, kedalaman tradisi, dan kemuliaan.
  "budaya": {
    bg: "bg-violet-50/50 dark:bg-violet-950/20",
    border: "border-violet-200/60 dark:border-violet-500/30",
    text: "text-violet-700 dark:text-violet-300",
    accent: "bg-violet-500",
    icon: "🕌"
  },

  "default": {
    bg: "bg-gray-50/50 dark:bg-gray-900/20",
    border: "border-gray-200/60 dark:border-gray-500/20",
    text: "text-gray-600 dark:text-gray-400",
    accent: "bg-cyan-500",
    icon: "📍"
  }
};

// Logika Pemetaan Kategori Berdasarkan Keyword
export const getCategoryStyle = (categoryName) => {
  if (!categoryName) return CATEGORY_STYLES.default;
  const cat = categoryName.toLowerCase();

  if (cat.includes("wisata") || cat.includes("taman") || cat.includes("alam") || cat.includes("safari") || cat.includes("air terjun") || cat.includes("agrowisata") || cat.includes("botani")) {
    return CATEGORY_STYLES.wisata;
  }
  if (cat.includes("cafe") || cat.includes("resto") || cat.includes("kuliner") || cat.includes("makan") || cat.includes("kafe") || cat.includes("pasar kuliner") || cat.includes("restoran") || cat.includes("bistro")) {
    return CATEGORY_STYLES.kuliner;
  }
  if (cat.includes("kesehatan") || cat.includes("rumah sakit") || cat.includes("puskesmas") || cat.includes("klinik")) {
    return CATEGORY_STYLES.kesehatan;
  }
  if (cat.includes("ibadah") || cat.includes("religi") || cat.includes("budaya") || cat.includes("alun-alun")) {
    return CATEGORY_STYLES.budaya;
  }
  if (cat.includes("transportasi") || cat.includes("stasiun") || cat.includes("jalur") || cat.includes("jalan") || cat.includes("stasiun")) {
    return CATEGORY_STYLES.transportasi;
  }
  if (cat.includes("pelayanan") || cat.includes("desa") || cat.includes("pemerintah") || cat.includes("kantor") || cat.includes("pendidikan") || cat.includes("perbankan") || cat.includes("sekolah")) {
    return CATEGORY_STYLES.layanan;
  }

  return CATEGORY_STYLES.default;
};