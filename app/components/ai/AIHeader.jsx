"use client";
import { memo } from "react";
import { X, Sparkles } from "lucide-react"; // Menggunakan Lucide agar lebih clean

const AIHeader = memo(({ locationName, isMalam, onClose, theme }) => {
  return (
    <div className={`
      flex-shrink-0 px-5 py-4 
      border-b ${theme?.border || 'border-gray-100'} 
      bg-opacity-80 backdrop-blur-xl
    `}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          {/* Avatar AI dengan Efek Glow */}
          <div className="relative">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 transform -rotate-3">
              <Sparkles size={20} className="text-white animate-pulse" />
            </div>
            {/* Indikator Online (Status Nyawa) */}
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-zinc-900 rounded-full shadow-sm" />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <h2 className={`text-sm font-black tracking-tight ${theme?.text || 'text-gray-900'} leading-none`}>
                AKAMSI AI
              </h2>
              <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 text-[8px] font-black rounded-md tracking-tighter uppercase">
                Aktif
              </span>
            </div>
            <p className={`text-[10px] font-bold mt-1 uppercase tracking-widest opacity-40 ${theme?.text || 'text-gray-900'}`}>
              📍 {locationName || "Pasuruan"}
            </p>
          </div>
        </div>

        {/* Close Button yang Lebih Nyaman di Jempol */}
        <button 
          onClick={onClose} 
          className={`
            w-9 h-9 rounded-xl 
            flex items-center justify-center 
            transition-all active:scale-90
            ${isMalam ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'}
          `}
        >
          <X size={18} className={isMalam ? 'text-gray-400' : 'text-gray-500'} />
        </button>
      </div>
    </div>
  );
});

AIHeader.displayName = "AIHeader";
export default AIHeader;