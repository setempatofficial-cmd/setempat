export function generateHeadline({
  item,
  estimasiOrang = 0,
  antrian = null,
  aktivitasUtama = null,
  isHujan = false
}) {
  const jam = new Date().getHours();
  const category = (item?.category || item?.kategori || "umum").toLowerCase();

  // 1. PRIORITAS TERTINGGI (Kondisi Real-time)
  if (isHujan) return { text: "Lagi neduh berjamaah, lur", icon: "⛈️" };
  
  if (antrian && antrian.estimasi_menit > 0) {
    return { text: `Antrian terpantau ±${antrian.estimasi_menit}m`, icon: "⏳" };
  }

  if (aktivitasUtama) {
    const textAct = typeof aktivitasUtama === 'string' ? aktivitasUtama : (aktivitasUtama.deskripsi || aktivitasUtama.konten);
    if (textAct) return { text: textAct, icon: "📢" };
  }

  // 2. VARIASI POOL YANG LEBIH LUAS (Mencegah Pengulangan)
  const pools = {
    kuliner: {
      pagi: ["Warga mulai cari sarapan anget", "Dapur sudah ngebul pagi ini", "Lagi musim cari bubur & kopi"],
      siang: ["Lagi jam makan siang warga", "Banyak yang mampir maksi", "Aroma masakannya mulai mumbul"],
      sore: ["Camilan sore mulai ready", "Waktunya ngopi santai", "Banyak yang mampir sepulang kerja"],
      malam: ["Suasana makan malam syahdu", "Lagi asik buat makan bareng", "Kuliner malam mulai ramai"]
    },
    publik: {
      pagi: ["Udara segar, pas buat gerak", "Persiapan baru mulai buka", "Masih tenang, serasa milik sendiri"],
      siang: ["Lagi jadi titik kumpul warga", "Suasana cerah di lokasi", "Banyak komunitas lagi mampir"],
      sore: ["Vibes senjanya mulai berasa", "Asik buat nyore tipis-tipis", "Warga mulai datang buat santai"],
      malam: ["Suasana syahdu lampu kota", "Obrolan hangat warga lokal", "Vibes-nya lagi romantis"]
    }
  };

  // 3. LOGIKA PEMILIHAN (GROUPING)
  let group = "publik";
  if (['cafe', 'kopi', 'warung', 'kuliner', 'resto'].some(k => category.includes(k))) group = "kuliner";

  let timeKey = "siang";
  if (jam >= 5 && jam < 11) timeKey = "pagi";
  else if (jam >= 15 && jam < 19) timeKey = "sore";
  else if (jam >= 19 || jam < 5) timeKey = "malam";

  const currentPool = pools[group][timeKey];

  // 4. KUNCI ANTI-KEDIP DENGAN VARIASI TINGGI
  // Kita gunakan gabungan ID dan Panjang Nama Tempat agar index lebih acak antar card
  const nameLength = (item?.name || item?.nama || "").length;
  const safeId = String(item?.id || '0');
  const seed = safeId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + nameLength;
  
  const uniqueIndex = seed % currentPool.length;

  // Ikon juga dibuat lebih bervariasi
  const icons = ["✨", "📍", "🤙", "🍃", "🔥", "🙌", "✅"];
  
  return {
    text: currentPool[uniqueIndex],
    icon: icons[seed % icons.length]
  };
}