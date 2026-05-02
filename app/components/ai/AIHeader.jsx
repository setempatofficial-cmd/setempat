"use client";
import { memo } from "react";
import { X, BrainCircuit, MapPin } from "lucide-react";

const AIHeader = memo(({ locationName, onClose, isSearching }) => {
  return (
    <div className="flex-shrink-0 px-5 py-4 border-b border-indigo-100/30 bg-slate-50/90 backdrop-blur-2xl sticky top-0 z-50">
      <div className="flex items-center justify-between">
        
        <div className="flex items-center gap-3.5">
          {/* AI Intel Icon - Ciri Khas Akamsi */}
          <div className="relative">
            <div className={`
              absolute inset-0 rounded-full blur-lg transition-all duration-1000
              ${isSearching ? 'bg-indigo-400 opacity-40 animate-pulse' : 'bg-slate-300 opacity-20'}
            `} />
            
            <div className={`
              relative w-10 h-10 rounded-[14px] flex items-center justify-center 
              bg-slate-900 border border-white/10 shadow-md transition-all duration-500
              ${isSearching ? 'rotate-[15deg] scale-110' : 'rotate-0'}
            `}>
              <BrainCircuit size={20} className={isSearching ? "text-indigo-400" : "text-white"} />
            </div>
          </div>

          {/* Labeling - Intelligence & Location */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h2 className="text-[16px] font-bold tracking-tight text-slate-900 leading-none">
                AKAMSI <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">AI</span>
              </h2>
              
              {/* Status Pill - Minimalist */}
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white border border-slate-200 shadow-sm">
                <span className={`w-1 h-1 rounded-full ${isSearching ? 'bg-indigo-500 animate-ping' : 'bg-emerald-500'}`} />
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">
                  {isSearching ? 'Thinking' : 'Live'}
                </span>
              </div>
            </div>
            
            {/* Local Context - Bikin User Merasa Dekat */}
            <div className="flex items-center gap-1 mt-1">
              <MapPin size={10} className="text-indigo-500" />
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-tight">
                {isSearching 
                  ? "Menyisir data setempat..." 
                  : `Kabar ${locationName || "Pasuruan"}`
                }
              </p>
            </div>
          </div>
        </div>

        {/* Action: Close */}
        <button 
          onClick={onClose} 
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white hover:shadow-sm text-slate-400 hover:text-slate-900 transition-all active:scale-90"
        >
          <X size={18} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
});

AIHeader.displayName = "AIHeader";
export default AIHeader;