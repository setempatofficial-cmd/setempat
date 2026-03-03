export function generateHeadline({
  item,
  estimasiOrang = 0,
  antrian = null,
  aktivitasUtama = null,
  fallbackFn,
}) {
  const signals = [];

  // 1️⃣ Aktivitas utama realtime
  if (aktivitasUtama) {
    signals.push({
      weight: 100,
      text: `Sedang berlangsung ${item.liveEventNow}`,
      icon: "⚡️",
    });
  }

  // 2️⃣ Antrian realtime
  if (antrian?.estimasi_menit) {
    signals.push({
      weight: 80 + antrian.estimasi_menit,
      text: `Pengunjung antri ${antrian.estimasi_menit} menit per orang`,
      icon: "🚶",
    });
  }

  // 3️⃣ Keramaian realtime
  if (estimasiOrang > 0) {
    signals.push({
      weight: estimasiOrang,
      text: `${estimasiOrang} orang lagi di lokasi`,
      icon: "👥",
    });
  }

  // Jika tidak ada signal realtime
  if (signals.length === 0) {
    return {
      text: fallbackFn ? fallbackFn(item) : "Tempat ini sedang tenang",
      icon: "",
    };
  }

  signals.sort((a, b) => b.weight - a.weight);

  return signals[0];
}