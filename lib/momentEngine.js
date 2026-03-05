export function generateMoment(places = [], locationName = "") {

  if (!places.length) {
    return {
      text: "🌏 Belum ada aktivitas terdeteksi di sekitar"
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

  let waktu = "";

  if (hour >= 4 && hour < 11) waktu = "Pagi";
  else if (hour >= 11 && hour < 15) waktu = "Siang";
  else if (hour >= 15 && hour < 18) waktu = "Sore";
  else waktu = "Malam";

  const lokasi = locationName ? ` di ${locationName}` : "";

  /* ======================
     MOMENT TEKS
  ====================== */

  const templates = {
    Pagi: [
      `🌅 Pagi ini aktivitas ${dominantCategory}${lokasi} mulai terasa`,
      `☕ Warga mulai beraktivitas di ${dominantCategory}${lokasi}`,
      `🚶 Pagi hari di ${dominantCategory}${lokasi} mulai hidup`,
    ],

    Siang: [
      `🍜 Siang ini ${dominantCategory}${lokasi} sedang ramai`,
      `🔥 Aktivitas ${dominantCategory}${lokasi} meningkat siang ini`,
      `👥 Banyak warga berkumpul di ${dominantCategory}${lokasi}`,
    ],

    Sore: [
      `🌇 Sore ini warga mulai nongkrong di ${dominantCategory}${lokasi}`,
      `🚶 Aktivitas sore hari di ${dominantCategory}${lokasi} mulai ramai`,
      `☕ Warga mulai berdatangan ke ${dominantCategory}${lokasi}`,
    ],

    Malam: [
      `🌙 Malam ini ${dominantCategory}${lokasi} jadi pilihan warga`,
      `🔥 Aktivitas malam di ${dominantCategory}${lokasi} masih hidup`,
      `🎶 Warga menikmati malam di ${dominantCategory}${lokasi}`,
    ]
  };

  const list = templates[waktu];

  const index = Math.floor(Math.random() * list.length);

  return {
    text: list[index]
  };

}