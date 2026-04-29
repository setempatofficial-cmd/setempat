"use client";
import { memo } from "react";
import { X, Sparkles } from "lucide-react";

const AIHeader = memo(({ locationName, onClose }) => {
  return (
    <div className="flex-shrink-0 px-5 py-4 border-b border-emerald-50/50 bg-white/90 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          
          {/* Avatar AI: Pakai Hijau Mint yang Segar */}
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center shadow-sm">
            <Sparkles size={18} className="text-emerald-500 fill-emerald-100" />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <h2 className="text-[13px] font-black tracking-tight text-zinc-800 uppercase">
                Akamsi AI
              </h2>
              {/* Badge Status yang Terang */}
              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 rounded-md">
                <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-tighter">Live</span>
              </span>
            </div>
            
            <p className="text-[10px] font-bold text-emerald-600/60 mt-0.5 tracking-wide">
              LAPORAN {locationName?.toUpperCase() || "Pasuruan"}
            </p>
          </div>
        </div>

        {/* Close Button: Simpel & Clean */}
        <button 
          onClick={onClose} 
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all active:scale-90"
        >
          <X size={18} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
});

AIHeader.displayName = "AIHeader";
export default AIHeader;