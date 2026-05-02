'use client';

import { Store, Truck, UserPlus, Heart, AlertCircle } from 'lucide-react';

export default function UploadOptions({ 
  onClose,
  onSambat,
  onDaftarRewang,     // ← rename biar jelas
  onPanyangan,
  onDaftarOjek,
  onDonasi,
  onDaftarBakul,      // ← tambahkan ini
  isSeller,
  isDriver,
  isRewang
}) {
  
  const options = [];
  
  // 1. DAFTAR BAKUL (hanya jika BELUM jadi seller)
  if (!isSeller) {
    options.push({ 
      label: 'Daftar Jadi Bakul', 
      sub: 'Mulai jualan di Panyangan', 
      icon: Store, 
      color: 'text-orange-500', 
      bg: 'bg-orange-100', 
      border: 'border-orange-200', 
      onClick: onDaftarBakul
    });
  }
  
  // 2. GELAR DAGANGAN (hanya jika SUDAH jadi seller)
  if (isSeller) {
    options.push({ 
      label: 'Gelar Dagangan', 
      sub: 'Panyangan Rojo Koyo', 
      icon: Store, 
      color: 'text-orange-500', 
      bg: 'bg-orange-50', 
      border: 'border-orange-100', 
      onClick: onPanyangan 
    });
  }
  
  // 3. DAFTAR OJEK (hanya jika BELUM jadi driver)
  if (!isDriver) {
    options.push({ 
      label: 'Daftar Ojek', 
      sub: 'Jadi rider antar jemput', 
      icon: Truck, 
      color: 'text-emerald-600', 
      bg: 'bg-emerald-50', 
      border: 'border-emerald-100', 
      onClick: onDaftarOjek 
    });
  }
  
  // 4. DAFTAR REWANG (hanya jika BELUM jadi rewang)
  if (!isRewang) {
    options.push({ 
      label: 'Daftar Rewang', 
      sub: 'Menawarkan jasa warga', 
      icon: UserPlus, 
      color: 'text-purple-600', 
      bg: 'bg-purple-50', 
      border: 'border-purple-100', 
      onClick: onDaftarRewang 
    });
  }
  
  // 5. BERBAGI / DONASI (SEMUA USER - selalu tampil)
  options.push({ 
    label: 'Berbagi / Donasi', 
    sub: 'Sedekah barang & bantuan', 
    icon: Heart, 
    color: 'text-rose-600', 
    bg: 'bg-rose-50', 
    border: 'border-rose-100', 
    onClick: onDonasi 
  });
  
  // 6. SAMBAT BANTUAN (SEMUA USER - selalu tampil)
  options.push({ 
    label: 'Sambat Bantuan', 
    sub: 'Butuh bantuan segera', 
    icon: AlertCircle, 
    color: 'text-red-600', 
    bg: 'bg-red-50', 
    border: 'border-red-100', 
    onClick: onSambat 
  });

  return (
    <div className="fixed inset-0 z-[250] flex items-end justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-[40px] w-full max-w-sm z-10 p-8 animate-in slide-in-from-bottom-10 shadow-2xl overflow-hidden">
        <div className="w-12 h-1.5 bg-slate-100 rounded-full mx-auto mb-6" />
        <h3 className="text-xl font-black text-slate-900 mb-6 uppercase tracking-tighter italic">Mau Posting Apa?</h3>
        <div className="grid gap-3 max-h-[60vh] overflow-y-auto no-scrollbar pr-1">
          {options.map((opt, i) => (
            <button key={i} onClick={() => { onClose(); setTimeout(() => opt.onClick(), 200); }} className={`w-full flex items-center p-4 ${opt.bg} rounded-[28px] border ${opt.border} active:scale-95 transition-all group`}>
              <div className={`p-3 bg-white rounded-2xl mr-4 ${opt.color} shadow-sm border border-white group-hover:scale-110 transition-transform`}>
                <opt.icon size={20} strokeWidth={2.5} />
              </div>
              <div className="text-left">
                <h4 className="font-black text-xs uppercase tracking-tight text-slate-800 leading-none">{opt.label}</h4>
                <p className="text-[9px] opacity-70 font-bold mt-1 uppercase tracking-tighter text-slate-500">{opt.sub}</p>
              </div>
            </button>
          ))}
        </div>
        <button onClick={onClose} className="w-full mt-6 py-2 text-slate-400 font-black text-[10px] uppercase tracking-[0.2em]">Batal</button>
      </div>
    </div>
  );
}