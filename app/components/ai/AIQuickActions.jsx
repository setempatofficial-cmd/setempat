"use client";
import { memo } from "react";
import { Camera, Zap, Info, Clock, MapPin } from "lucide-react";

const AIQuickActions = memo(({ actions = [], onActionClick, onLaporClick, isMalam }) => {
  
  return (
    <div className="relative group">
      {/* Container Scroll dengan Fade Effect di ujung */}
      <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar pb-3 px-4 scroll-smooth">
        
        {/* 1. TOMBOL KIRIM FOTO - High Emphasis */}
        <button
          onClick={onLaporClick}
          className={`
            flex items-center gap-2 px-5 py-2.5 rounded-2xl 
            bg-indigo-600 hover:bg-indigo-500 
            text-white text-[11px] font-black whitespace-nowrap 
            shadow-lg shadow-indigo-500/25 active:scale-90 transition-all
            ring-2 ring-indigo-400/20
          `}
        >
          <Camera size={14} strokeWidth={3} className="animate-pulse" />
          <span className="tracking-wider">KIRIM FOTO</span>
        </button>

        {/* 2. DYNAMIC ACTIONS */}
        {actions.map((tag, idx) => {
          const label = tag.label.toLowerCase();
          
          // Logic Icon & Color mapping
          let Icon = Info;
          let iconColor = "text-rose-500";
          
          if (label.includes('kondisi') || label.includes('rame')) {
            Icon = Zap;
            iconColor = "text-amber-500";
          } else if (label.includes('jam') || label.includes('buka')) {
            Icon = Clock;
            iconColor = "text-blue-500";
          } else if (label.includes('lokasi') || label.includes('rute') || label.includes('alamat')) {
            Icon = MapPin;
            iconColor = "text-emerald-500";
          }

          return (
            <button
              key={`${tag.label}-${idx}`}
              onClick={() => onActionClick(tag.query)}
              className={`
                flex items-center gap-2 px-4 py-2.5 rounded-2xl border 
                whitespace-nowrap transition-all active:scale-95
                text-[11px] font-bold tracking-tight uppercase
                ${isMalam 
                  ? 'bg-zinc-900/50 border-zinc-800 text-zinc-300 hover:bg-zinc-800' 
                  : 'bg-white/80 border-zinc-100 text-zinc-600 hover:border-zinc-300 shadow-sm'
                }
                backdrop-blur-md
              `}
            >
              <Icon size={14} className={`${iconColor}`} strokeWidth={2.5} />
              <span>{tag.label}</span>
            </button>
          );
        })}
      </div>

      {/* Shadow Overlay untuk indikasi scroll (Opsional) */}
      <div className={`absolute right-0 top-0 bottom-3 w-12 pointer-events-none bg-gradient-to-l ${isMalam ? 'from-zinc-950' : 'from-white'} to-transparent opacity-70`} />
    </div>
  );
});

AIQuickActions.displayName = "AIQuickActions";
export default AIQuickActions;