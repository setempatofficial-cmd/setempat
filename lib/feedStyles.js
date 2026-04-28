// styles/categoryStyles.js - HP OPTIMIZED VERSION (FIXED)

// Deteksi HP dengan safe guard untuk SSR
const getIsMobile = () => {
  if (typeof window === 'undefined') return false; // Server: anggap desktop
  return window.innerWidth < 768;
};

const isMobile = getIsMobile();

// ==================== VERSION UNTUK HP (Tanpa Opacity) ====================
const MOBILE_STYLES = {
  "wisata": {
    bg: "bg-emerald-100",
    border: "border-emerald-300",
    text: "text-emerald-800",
    accent: "bg-emerald-600",
    icon: "🍃"
  },
  "kuliner": {
    bg: "bg-amber-100",
    border: "border-amber-300",
    text: "text-amber-800",
    accent: "bg-amber-600",
    icon: "🥣"
  },
  "layanan": {
    bg: "bg-indigo-100",
    border: "border-indigo-300",
    text: "text-indigo-800",
    accent: "bg-indigo-600",
    icon: "🏛️"
  },
  "transportasi": {
    bg: "bg-slate-200",
    border: "border-slate-400",
    text: "text-slate-800",
    accent: "bg-slate-700",
    icon: "🛣️"
  },
  "kesehatan": {
    bg: "bg-rose-100",
    border: "border-rose-300",
    text: "text-rose-800",
    accent: "bg-rose-600",
    icon: "🩺"
  },
  "budaya": {
    bg: "bg-violet-100",
    border: "border-violet-300",
    text: "text-violet-800",
    accent: "bg-violet-600",
    icon: "🕌"
  },
  "default": {
    bg: "bg-gray-100",
    border: "border-gray-300",
    text: "text-gray-700",
    accent: "bg-cyan-600",
    icon: "📍"
  }
};

// ==================== VERSION UNTUK PC/LAPTOP (Dengan Dark Mode) ====================
const DESKTOP_STYLES = {
  "wisata": {
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    border: "border-emerald-200 dark:border-emerald-800/50",
    text: "text-emerald-700 dark:text-emerald-300",
    accent: "bg-emerald-500",
    icon: "🍃"
  },
  "kuliner": {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-800/50",
    text: "text-amber-700 dark:text-amber-300",
    accent: "bg-amber-500",
    icon: "🥣"
  },
  "layanan": {
    bg: "bg-indigo-50 dark:bg-indigo-950/30",
    border: "border-indigo-200 dark:border-indigo-800/50",
    text: "text-indigo-700 dark:text-indigo-300",
    accent: "bg-indigo-500",
    icon: "🏛️"
  },
  "transportasi": {
    bg: "bg-slate-100 dark:bg-slate-800/50",
    border: "border-slate-300 dark:border-slate-700/50",
    text: "text-slate-700 dark:text-slate-300",
    accent: "bg-slate-600",
    icon: "🛣️"
  },
  "kesehatan": {
    bg: "bg-rose-50 dark:bg-rose-950/30",
    border: "border-rose-200 dark:border-rose-800/50",
    text: "text-rose-700 dark:text-rose-300",
    accent: "bg-rose-500",
    icon: "🩺"
  },
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

// Pilih versi berdasarkan device
export const CATEGORY_STYLES = isMobile ? MOBILE_STYLES : DESKTOP_STYLES;

// Logika Pemetaan Kategori (Dioptimasi dengan regex)
export const getCategoryStyle = (categoryName) => {
  if (!categoryName) return CATEGORY_STYLES.default;
  
  const cat = categoryName.toLowerCase();

  const mapping = [
    { key: "wisata", regex: /wisata|taman|alam|safari|air terjun|agrowisata|botani/ },
    { key: "kuliner", regex: /cafe|resto|kuliner|makan|kafe|pasar kuliner|restoran|bistro/ },
    { key: "kesehatan", regex: /kesehatan|rumah sakit|puskesmas|klinik/ },
    { key: "budaya", regex: /ibadah|religi|budaya|alun-alun/ },
    { key: "transportasi", regex: /transportasi|stasiun|jalur|jalan/ },
    { key: "layanan", regex: /pelayanan|desa|pemerintah|kantor|pendidikan|perbankan|sekolah/ },
  ];

  const found = mapping.find(item => item.regex.test(cat));
  return found ? CATEGORY_STYLES[found.key] : CATEGORY_STYLES.default;
};