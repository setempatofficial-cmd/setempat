// config/citizenSignals.js

export const CATEGORY_CONFIG = {
  // 1. KELOMPOK KULINER (Cafe, Restoran, Pasar Kuliner, Warung, dll)
  kuliner: {
    icon: '☕',
    label: 'Kuliner',
    actions: [
      { id: 'sepi', icon: '😌', label: 'SEPI', tipe: 'Sepi', desc: 'Bebas Pilih Meja' },
      { id: 'ramai', icon: '👥', label: 'RAMAI', tipe: 'Ramai', desc: 'Nyaris Penuh' },
      { id: 'antri', icon: '🚶‍♂️', label: 'ANTRI', tipe: 'Antri', desc: 'Mengular' },
      { id: 'penuh', icon: '🚫', label: 'PENUH', tipe: 'Penuh', desc: 'Sabar, No Table' },
    ]
  },

  // 2. KELOMPOK WISATA & RUANG TERBUKA (Air Terjun, Wisata Edukasi, Taman, Alun-alun, Stadion)
  wisata: {
    icon: '🏞️',
    label: 'Wisata & Publik',
    actions: [
      { id: 'sepi', icon: '😌', label: 'LEANG', tipe: 'Sepi', desc: 'Suasana Syahdu / Leluasa' },
      { id: 'ramai', icon: '👥', label: 'RAMAI', tipe: 'Ramai', desc: 'Cukup Banyak Warga' },
      { id: 'padat', icon: '🚶‍♂️🚶‍♀️', label: 'PADAT', tipe: 'Padat', desc: 'Sangat Ramai Pol' },
      { id: 'tutup', icon: '🔒', label: 'TUTUP', tipe: 'Tutup', desc: 'Gerbang / Loket Tutup' },
    ]
  },

  // 3. KELOMPOK LAYANAN PUBLIK & KESEHATAN (Puskesmas, Rumah Sakit, Kantor Desa, Bank)
  layanan: {
    icon: '🏢',
    label: 'Pelayanan',
    actions: [
      { id: 'lancar', icon: '🟢', label: 'LANCAR', tipe: 'Lancar', desc: 'Tanpa Antrean' },
      { id: 'antri', icon: '🟡', label: 'ANTRE', tipe: 'Antre', desc: 'Sedang Mengantre' },
      { id: 'antri_parah', icon: '🔴', label: 'PADAT', tipe: 'AntreParah', desc: 'Antrean Panjang' },
      { id: 'petugas_istirahat', icon: '⏳', label: 'BREAK', tipe: 'Istirahat', desc: 'Jam Istirahat' },
    ]
  },

  // 4. KELOMPOK INFRASTRUKTUR & TRANSPORTASI (Stasiun Kereta Api, Jalur Pantura, Jalan Raya)
  transportasi: {
    icon: '🛣️',
    label: 'Lalu Lintas',
    actions: [
      { id: 'lancar', icon: '✅', label: 'LANCAR', tipe: 'Lancar', desc: 'Lalin Lancar Jaya' },
      { id: 'macet', icon: '🚗', label: 'MERAYAP', tipe: 'Macet', desc: 'Mulai Merayap' },
      { id: 'macet_total', icon: '🚫', label: 'STUCK', tipe: 'MacetTotal', desc: 'Macet Total / Stuck' },
      { id: 'hujan', icon: '🌧️', label: 'HUJAN', tipe: 'Hujan', desc: 'Kondisi Hujan Deras' },
    ]
  },

  // 5. BACKUP DEFAULT (Jika ada kategori baru di DB yang belum terdaftar)
  default: {
    icon: '📍',
    label: 'Kondisi',
    actions: [
      { id: 'sepi', icon: '😌', label: 'SEPI', tipe: 'Sepi', desc: 'Kondisi Lengang' },
      { id: 'ramai', icon: '👥', label: 'RAMAI', tipe: 'Ramai', desc: 'Kondisi Ramai' },
      { id: 'antri', icon: '⏳', label: 'ANTRE', tipe: 'Antre', desc: 'Kondisi Antre' },
      { id: 'tutup', icon: '🔒', label: 'TUTUP', tipe: 'Tutup', desc: 'Kondisi Tutup' },
    ]
  }
};

export const getButtonStyle = (id) => {
  const base = "border-b-4 backdrop-blur-md ";
  const styles = {
    sepi: base + 'bg-blue-500/10 text-blue-400 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]',
    lancar: base + 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]',
    ramai: base + 'bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)]',
    padat: base + 'bg-orange-500/10 text-orange-400 border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.1)]',
    antri: base + 'bg-orange-500/10 text-orange-400 border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.1)]',
    antri_parah: base + 'bg-red-500/10 text-red-400 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.1)]',
    macet: base + 'bg-rose-500/10 text-rose-400 border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.1)]',
    penuh: base + 'bg-red-600/10 text-red-500 border-red-600/30 shadow-[0_0_15px_rgba(220,38,38,0.1)]',
    tutup: base + 'bg-zinc-600/20 text-zinc-400 border-zinc-600/40 shadow-[0_0_15px_rgba(113,113,122,0.1)]',
    petugas_istirahat: base + 'bg-amber-600/10 text-amber-500 border-amber-600/30 shadow-[0_0_15px_rgba(217,119,6,0.1)]',
    macet_total: base + 'bg-red-700/20 text-red-400 border-red-700/50 shadow-[0_0_15px_rgba(185,28,28,0.2)]',
    hujan: base + 'bg-sky-500/10 text-sky-400 border-sky-500/30 shadow-[0_0_15px_rgba(14,165,233,0.1)]',
  };
  return styles[id] || base + 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30';
};