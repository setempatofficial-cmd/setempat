// ============ LENCANA SPESIALISASI ============

export const generateBadges = (statistik) => {
  const badges = [];

  // 🚦 Pengamat Lalu Lintas - 50+ laporan lalu lintas & 500+ views
  if (statistik.laporanByTraffic >= 50 && statistik.totalViews >= 500) {
    badges.push({
      id: "pengamat_lalin",
      icon: "🚦",
      name: "Pengamat Lalu Lintas",
      desc: `${statistik.laporanByTraffic} laporan lalu lintas, ${statistik.totalViews} views`,
      perks: "✅ Ikut bounty laporan lalu lintas + Prioritas verifikasi",
      category: "spesialis",
      earnedAt: new Date()
    });
  }

  // 🌧 Pemantau Cuaca - 50+ laporan cuaca & 50+ likes
  if (statistik.laporanByWeather >= 50 && statistik.totalLikes >= 50) {
    badges.push({
      id: "pemantau_cuaca",
      icon: "🌧",
      name: "Pemantau Cuaca",
      desc: `${statistik.laporanByWeather} laporan cuaca, ${statistik.totalLikes} apresiasi`,
      perks: "✅ Ikut bounty laporan cuaca + Badge eksklusif",
      category: "spesialis",
      earnedAt: new Date()
    });
  }

  // 📸 Mata Kamera - 50+ foto & 1000+ views
  if (statistik.totalFoto >= 50 && statistik.totalViews >= 1000) {
    badges.push({
      id: "mata_kamera",
      icon: "📸",
      name: "Mata Kamera",
      desc: `${statistik.totalFoto} foto, ${statistik.totalViews} views`,
      perks: "✅ Jual foto ke marketplace konten + Royalti",
      category: "spesialis",
      earnedAt: new Date()
    });
  }

  // 🎥 Reporter Video - 50+ video & 1000+ views
  if (statistik.totalVideo >= 50 && statistik.totalViews >= 1000) {
    badges.push({
      id: "reporter_video",
      icon: "🎥",
      name: "Reporter Video",
      desc: `${statistik.totalVideo} video, ${statistik.totalViews} views`,
      perks: "✅ Jual video ke marketplace konten + Royalti",
      category: "spesialis",
      earnedAt: new Date()
    });
  }

  // ⭐ Kontributor Pilihan - 5+ laporan featured
  if (statistik.featuredCount >= 5) {
    badges.push({
      id: "kontributor_pilihan",
      icon: "⭐",
      name: "Kontributor Pilihan",
      desc: `${statistik.featuredCount} laporan menjadi sorotan setempat`,
      perks: "✅ Program Mitra Desa + Sertifikat eksklusif",
      category: "spesialis",
      earnedAt: new Date()
    });
  }

  return badges;
};