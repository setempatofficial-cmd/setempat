export function generateMoment(places = [], locationName = "") {
  if (!places.length) {
    return {
      title: "🌏 Belum ada aktivitas terdeteksi",
      subtitle: "Coba aktifkan lokasi atau jelajahi area lain",
    };
  }
  
  // Hitung kategori dominan
  const categoryCount = {};
  places.forEach((p) => {
    const cat = p.kategori || "tempat";
    categoryCount[cat] = (categoryCount[cat] || 0) + 1;
  });

  const dominantCategory = Object.keys(categoryCount).reduce((a, b) =>
    categoryCount[a] > categoryCount[b] ? a : b
  );

  const hour = new Date().getHours();
  const currentHour = hour !== null ? hour : new Date().getHours();
  /* ======================
     LOGIKA MOMENT
  ====================== */

  if (hour >= 4 && hour < 11) {
    return {
      text: `🌅 Pagi hari, banyak aktivitas ${dominantCategory} di ${locationName}`
    };
  }

  if (hour >= 11 && hour < 15) {
    return {
     text: `🍜 Siang hari, ${dominantCategory} di ${locationName} sedang ramai`
    };
  }

  if (hour >= 15 && hour < 18) {
    return {
      text: `🔥 Sore ini, warga mulai nongkrong di ${dominantCategory} ${locationName}`
    };
  }

  return {
    text: `🌙 Malam ini, ${dominantCategory} di ${locationName} jadi pilihan warga`
  };
}