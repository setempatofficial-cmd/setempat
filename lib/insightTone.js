// lib/insightTone.js
// Fallback netral – TIDAK mengarang fakta

export function generateFallbackInsight(locationName = "Sekitar") {
  const neutralMessages = [
    `📢 Belum ada laporan terbaru dari ${locationName}. Ayo jadi yang pertama berbagi info!`,
    `👀 Pantau kondisi di ${locationName}? Share update kamu lewat tombol + di pojok.`,
    `📍 ${locationName} belum terpantau. Bantu warga lain dengan melaporkan suasana terkini.`,
    `🔍 Tidak ada aktivitas terbaru. Kamu bisa menambahkan laporan atau foto.`,
    `💬 Belum ada cerita dari ${locationName}. Yuk, bagikan pengalamanmu!`
  ];
  const randomIndex = Math.floor(Math.random() * neutralMessages.length);
  return {
    text: neutralMessages[randomIndex],
    author: "AI SETEMPAT",
    icon: "📢",
    time: "Live",
    isAi: true,
    sourceLabel: "AJAKAN",
    sourceType: "system",
    tipe: "Normal",
    estimated_people: null,
    isUrgent: false
  };
}