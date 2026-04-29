// styles/categoryStyles.js
// HAPUS deteksi isMobile di sini! Biarkan komponen yang menentukan

// Base styles untuk siang & malam
export const CATEGORY_BASE_STYLES = {
  "wisata": {
    bgSiang: "bg-emerald-100",
    bgMalam: "bg-emerald-900/80",  // ← solid di malam
    borderSiang: "border-emerald-300",
    borderMalam: "border-emerald-700",
    textSiang: "text-emerald-800",
    textMalam: "text-emerald-200",
    accent: "bg-emerald-600",
    icon: "🍃"
  },
  "kuliner": {
    bgSiang: "bg-amber-100",
    bgMalam: "bg-amber-900/80",
    borderSiang: "border-amber-300",
    borderMalam: "border-amber-700",
    textSiang: "text-amber-800",
    textMalam: "text-amber-200",
    accent: "bg-amber-600",
    icon: "🥣"
  },
  "layanan": {
    bgSiang: "bg-indigo-100",
    bgMalam: "bg-indigo-900/80",
    borderSiang: "border-indigo-300",
    borderMalam: "border-indigo-700",
    textSiang: "text-indigo-800",
    textMalam: "text-indigo-200",
    accent: "bg-indigo-600",
    icon: "🏛️"
  },
  "transportasi": {
    bgSiang: "bg-slate-200",
    bgMalam: "bg-slate-800",
    borderSiang: "border-slate-400",
    borderMalam: "border-slate-700",
    textSiang: "text-slate-800",
    textMalam: "text-slate-300",
    accent: "bg-slate-700",
    icon: "🛣️"
  },
  "kesehatan": {
    bgSiang: "bg-rose-100",
    bgMalam: "bg-rose-900/80",
    borderSiang: "border-rose-300",
    borderMalam: "border-rose-700",
    textSiang: "text-rose-800",
    textMalam: "text-rose-200",
    accent: "bg-rose-600",
    icon: "🩺"
  },
  "budaya": {
    bgSiang: "bg-violet-100",
    bgMalam: "bg-violet-900/80",
    borderSiang: "border-violet-300",
    borderMalam: "border-violet-700",
    textSiang: "text-violet-800",
    textMalam: "text-violet-200",
    accent: "bg-violet-600",
    icon: "🕌"
  },
  "default": {
    bgSiang: "bg-gray-100",
    bgMalam: "bg-gray-800",
    borderSiang: "border-gray-300",
    borderMalam: "border-gray-700",
    textSiang: "text-gray-700",
    textMalam: "text-gray-300",
    accent: "bg-cyan-600",
    icon: "📍"
  }
};

// Fungsi yang menerima parameter isMalam
export const getCategoryStyle = (categoryName, isMalam = false) => {
  if (!categoryName) {
    const def = CATEGORY_BASE_STYLES.default;
    return {
      bg: isMalam ? def.bgMalam : def.bgSiang,
      border: isMalam ? def.borderMalam : def.borderSiang,
      text: isMalam ? def.textMalam : def.textSiang,
      accent: def.accent,
      icon: def.icon,
    };
  }
  
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
  const style = found ? CATEGORY_BASE_STYLES[found.key] : CATEGORY_BASE_STYLES.default;
  
  return {
    bg: isMalam ? style.bgMalam : style.bgSiang,
    border: isMalam ? style.borderMalam : style.borderSiang,
    text: isMalam ? style.textMalam : style.textSiang,
    accent: style.accent,
    icon: style.icon,
  };
};