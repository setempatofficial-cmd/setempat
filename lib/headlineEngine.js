export function generateHeadline({
  item,
  estimasiOrang = 0,
  antrian = null,
  aktivitasUtama = null,
}) {
  const signals = [];
  const jam = new Date().getHours();

  // 1. DATA REAL-TIME (Pasti Diam/Tidak Kedip karena datanya statis dari DB)
  if (aktivitasUtama) {
    const textAct = typeof aktivitasUtama === 'string' ? aktivitasUtama : (aktivitasUtama.deskripsi || aktivitasUtama.konten);
    signals.push({ weight: 100, text: textAct, icon: "📢" });
  }

  // 2. FALLBACK BERBASIS ID (Mencegah Kedip)
  if (signals.length === 0) {
    const pools = {
      pagi: ["Persiapan baru mulai buka", "Warga mulai seliweran cari sarapan", "Lagi tenang, pas buat mulai hari"],
      siang: ["Dapur lagi sibuk masak siang", "Banyak komunitas mampir ngadem", "Lagi jadi titik kumpul warga"],
      sore: ["Vibes senjanya mulai berasa", "Warga mulai datang buat nyore", "Asik buat nongkrong lepas penat"],
      malam: ["Suasana syahdu lampu kota", "Lagi ada obrolan hangat warga", "Vibes-nya lagi romantis & tenang"]
    };

    let currentPool = pools.siang;
    if (jam >= 5 && jam < 11) currentPool = pools.pagi;
    else if (jam >= 15 && jam < 19) currentPool = pools.sore;
    else if (jam >= 19 || jam < 5) currentPool = pools.malam;

    // --- KUNCI ANTI-KEDIP ---
    // Menggunakan ID sebagai bibit (seed) acak yang permanen
    const safeId = String(item?.id || '0');
    const charSum = safeId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    // Index ini TIDAK AKAN BERUBAH selama ID-nya sama
    const uniqueIndex = charSum % currentPool.length;
    // ------------------------

    const icons = ["✨", "📍", "🤙", "🙌", "🍃"];
    
    return {
      text: currentPool[uniqueIndex],
      icon: icons[uniqueIndex % icons.length]
    };
  }

  signals.sort((a, b) => b.weight - a.weight);
  return signals[0];
}