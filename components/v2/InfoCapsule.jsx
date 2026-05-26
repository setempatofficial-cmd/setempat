"use client";

import { CalendarDays, ShieldCheck, Landmark } from "lucide-react";

export default function InfoCapsule({ richContext, tempatCategory }) {
  if (!richContext) return null;

  const items = [];
  
  // 1. Aktivitas berkala (Rutin)
  if (richContext.aktivitasBerkala?.length) {
    items.push({
      icon: <CalendarDays className="text-cyan-400 shrink-0" size={12} />,
      title: 'Aktivitas',
      content: richContext.aktivitasBerkala
        .slice(0, 2)
        .map(a => `${a.nama_aktivitas} (${a.hari} ${a.jam_mulai?.slice(0, 5)})`)
        .join(' • ')
    });
  }
  
  // 2. Layanan / Fasilitas Tersedia
  if (richContext.layananTersedia?.length) {
    items.push({
      icon: <ShieldCheck className="text-emerald-400 shrink-0" size={12} />,
      title: 'Fasilitas',
      content: richContext.layananTersedia
        .slice(0, 3)
        .map(l => l.sub_layanan)
        .join(' • ')
    });
  }
  
  // 3. Karakter / Metadata Tempat
  if (richContext.metadata) {
    items.push({
      icon: <Landmark className="text-amber-400 shrink-0" size={12} />,
      title: 'Karakter',
      content: `${richContext.metadata.tipe_utama} (Kap. ${richContext.metadata.kapasitas_normal || '?'} org)`
    });
  }
  
  if (items.length === 0) return null;
  
  return (
    <div className="px-4 mb-4 flex flex-wrap gap-2 items-center justify-start">
      {items.map((item, idx) => (
        <div 
          key={idx} 
          className="flex items-center gap-1.5 bg-zinc-900/40 backdrop-blur-md rounded-full px-3 py-1 border border-white/5 shadow-sm max-w-full"
        >
          {/* Wrapper Ikon */}
          <div className="flex items-center justify-center">
            {item.icon}
          </div>

          {/* Konten Teks */}
          <div className="flex items-center gap-1 overflow-hidden text-ellipsis whitespace-nowrap">
            <span className="text-[10px] font-black uppercase tracking-wider text-white/50 shrink-0">
              {item.title}:
            </span>
            <span className="text-[10px] font-medium text-white/90 tracking-tight truncate">
              {item.content}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}