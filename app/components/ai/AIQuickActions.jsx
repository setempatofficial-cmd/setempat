"use client";
import { memo } from "react";
import { Camera, Zap, Info, Clock } from "lucide-react";

const AIQuickActions = memo(({ actions, onActionClick, onLaporClick, isMalam }) => {
  // Susunan yang paling sering ditanyakan warga:
  // 1. Kondisi (Rame/Gak?)
  // 2. Jam Buka/Tutup
  // 3. Fasilitas (Parkir/Mushola)
  
  return (
    <div className="flex items-center gap-2 mb-4 overflow-x-auto no-scrollbar pb-1 px-1">
      {/* 1. TOMBOL LAPOR (Action Utama) - Ditaruh paling depan agar user terdorong berkontribusi */}
      <button
        onClick={onLaporClick}
        className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-500 text-white text-[11px] font-black whitespace-nowrap shadow-md shadow-emerald-500/20 active:scale-95 transition-all"
      >
        <Camera size={14} strokeWidth={3} />
        LAPOR
      </button>

      {/* 2. ACTIONS DARI PROPS (Pertanyaan Populer) */}
      {actions.map((tag, idx) => (
        <button
          key={idx}
          onClick={() => onActionClick(tag.query)}
          className={`
            flex items-center gap-1.5 px-4 py-2 rounded-full border whitespace-nowrap transition-all active:scale-95
            text-[11px] font-bold uppercase tracking-tight
            ${isMalam 
              ? 'bg-zinc-800 border-white/10 text-zinc-300 hover:bg-zinc-700' 
              : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50 shadow-sm'
            }
          `}
        >
          {/* Tambahkan Icon dinamis berdasarkan keyword agar lebih ramah */}
          {tag.label.toLowerCase().includes('kondisi') && <Zap size={12} className="text-amber-500" />}
          {tag.label.toLowerCase().includes('jam') && <Clock size={12} className="text-blue-500" />}
          {!tag.label.toLowerCase().includes('kondisi') && !tag.label.toLowerCase().includes('jam') && <Info size={12} className="text-emerald-500" />}
          
          {tag.label}
        </button>
      ))}
    </div>
  );
});

AIQuickActions.displayName = "AIQuickActions";
export default AIQuickActions;