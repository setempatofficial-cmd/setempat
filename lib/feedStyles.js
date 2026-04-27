// styles/categoryStyles.js

export const CATEGORY_STYLES = {
  // --- WISATA & ALAM (Emerald ke Teal) ---
  "wisata": {
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    border: "border-emerald-200 dark:border-emerald-800/50",
    text: "text-emerald-700 dark:text-emerald-300",
    accent: "bg-emerald-500",
    icon: "🍃"
  },
  
  // --- KULINER & CAFE (Amber ke Orange) ---
  "kuliner": {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-800/50",
    text: "text-amber-700 dark:text-amber-300",
    accent: "bg-amber-500",
    icon: "🥣"
  },

  // --- PUBLIK, DESA & PENDIDIKAN (Indigo ke Blue) ---
  "layanan": {
    bg: "bg-indigo-50 dark:bg-indigo-950/30",
    border: "border-indigo-200 dark:border-indigo-800/50",
    text: "text-indigo-700 dark:text-indigo-300",
    accent: "bg-indigo-500",
    icon: "🏛️"
  },

  // --- INFRASTRUKTUR & JALAN (Slate ke Zinc) ---
  "transportasi": {
    bg: "bg-slate-100 dark:bg-slate-800/50",
    border: "border-slate-300 dark:border-slate-700/50",
    text: "text-slate-700 dark:text-slate-300",
    accent: "bg-slate-600",
    icon: "🛣️"
  },

  // --- KESEHATAN (Rose ke Crimson) ---
  "kesehatan": {
    bg: "bg-rose-50 dark:bg-rose-950/30",
    border: "border-rose-200 dark:border-rose-800/50",
    text: "text-rose-700 dark:text-rose-300",
    accent: "bg-rose-500",
    icon: "🩺"
  },

  // --- IBADAH & BUDAYA (Violet ke Purple) ---
  "budaya": {
    bg: "bg-violet-50 dark:bg-violet-950/30",
    border: "border-violet-200 dark:border-violet-800/50",
    text: "text-violet-700 dark:text-violet-300",
    accent: "bg-violet-500",
    icon: "🕌"
  },

  "default": {
    bg: "bg-gray-50 dark:bg-gray-900/50",
    border: "border-gray-200 dark:border-gray-700/50",
    text: "text-gray-600 dark:text-gray-300",
    accent: "bg-cyan-500",
    icon: "📍"
  }
};

// Logika Pemetaan Kategori Berdasarkan Keyword
export const getCategoryStyle = (categoryName) => {
  if (!categoryName) return CATEGORY_STYLES.default;
  
  const cat = categoryName.toLowerCase();

  if (cat.includes("wisata") || cat.includes("taman") || cat.includes("alam") || 
      cat.includes("safari") || cat.includes("air terjun") || cat.includes("agrowisata") || 
      cat.includes("botani")) {
    return CATEGORY_STYLES.wisata;
  }
  
  if (cat.includes("cafe") || cat.includes("resto") || cat.includes("kuliner") || 
      cat.includes("makan") || cat.includes("kafe") || cat.includes("pasar kuliner") || 
      cat.includes("restoran") || cat.includes("bistro")) {
    return CATEGORY_STYLES.kuliner;
  }
  
  if (cat.includes("kesehatan") || cat.includes("rumah sakit") || 
      cat.includes("puskesmas") || cat.includes("klinik")) {
    return CATEGORY_STYLES.kesehatan;
  }
  
  if (cat.includes("ibadah") || cat.includes("religi") || cat.includes("budaya") || 
      cat.includes("alun-alun")) {
    return CATEGORY_STYLES.budaya;
  }
  
  if (cat.includes("transportasi") || cat.includes("stasiun") || cat.includes("jalur") || 
      cat.includes("jalan")) {
    return CATEGORY_STYLES.transportasi;
  }
  
  if (cat.includes("pelayanan") || cat.includes("desa") || cat.includes("pemerintah") || 
      cat.includes("kantor") || cat.includes("pendidikan") || cat.includes("perbankan") || 
      cat.includes("sekolah")) {
    return CATEGORY_STYLES.layanan;
  }

  return CATEGORY_STYLES.default;
};