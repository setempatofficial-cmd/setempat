// lib/surveyOptions.js
// Semua konstanta dan helper dalam satu file

export const QUEUE_CATEGORIES = ['kuliner', 'transportasi', 'pasar'];
export const TRAFFIC_CATEGORIES = ['jalan', 'jalan raya', 'simpang', 'tol', 'bypass', 'lingkar'];

// Helper untuk menentukan opsi yang tampil (optimized dengan memo)
export function getSurveyOptions(kategoriTempat, namaTempat) {
  const kategori = (kategoriTempat || "").toLowerCase();
  const nama = (namaTempat || "").toLowerCase();
  
  return {
    hasQueue: QUEUE_CATEGORIES.some(k => kategori.includes(k)),
    hasTraffic: TRAFFIC_CATEGORIES.some(k => kategori.includes(k) || nama.includes(k))
  };
}

// Data tombol (freeze agar tidak dimodifikasi)
export const BUTTONS = Object.freeze({
  base: [
    { emoji: "🍃", label: "Sepi", value: "Sepi", color: "emerald" },
    { emoji: "🏃", label: "Ramai", value: "Ramai", color: "yellow" }
  ],
  queue: { emoji: "⏳", label: "Antri", value: "Antri", color: "rose" },
  traffic: [
    { emoji: "🛵", label: "Lancar", value: "Lancar", color: "emerald", desc: "Jalanan lengang" },
    { emoji: "🚗", label: "Ramai", value: "Ramai", color: "yellow", desc: "Kendaraan mulai padat" },
    { emoji: "🚦", label: "Macet", value: "Macet", color: "rose", desc: "Antrean panjang" }
  ],
  waitTimes: [
    { value: 5, label: "< 5 menit", desc: "Pendek", icon: "⚡" },
    { value: 15, label: "5-15 menit", desc: "Sedang", icon: "⏱️" },
    { value: 20, label: "> 15 menit", desc: "Panjang", icon: "🐢" }
  ]
});

// Generate deskripsi otomatis (ringan, tanpa object besar)
export function getAutoDescription(condition, waitTime, traffic, tempatName) {
  'use memo';
  const name = tempatName || "sini";
  
  if (condition === "Sepi") return `Suasana tenang di ${name}.`;
  if (condition === "Ramai") return `Suasana ramai di ${name}.`;
  if (condition === "Antri") {
    const text = waitTime === 5 ? "pendek (<5 menit)" : waitTime === 15 ? "sedang (5-15 menit)" : "panjang (>15 menit)";
    return `Antrian ${text} di ${name}.`;
  }
  if (traffic) {
    const text = traffic === 'Lancar' ? 'lancar' : traffic === 'Ramai' ? 'ramai' : 'macet';
    return `Lalu lintas ${text} di ${name}.`;
  }
  return `Update dari ${name}.`;
}

// Estimasi orang (pure function)
export function getEstimatedPeople(condition, timeTag) {
  const defaults = {
    Sepi: { Pagi: 3, Siang: 5, Sore: 4, Malam: 2 },
    Ramai: { Pagi: 12, Siang: 25, Sore: 20, Malam: 15 },
    Antri: { Pagi: 8, Siang: 15, Sore: 12, Malam: 10 },
  };
  return defaults[condition]?.[timeTag] || (condition === "Sepi" ? 4 : condition === "Ramai" ? 20 : 12);
}