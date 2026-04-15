"use client";

import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { useRef, useMemo } from "react";
import { Send, Sparkles, Camera, MessageSquare, ArrowRight } from "lucide-react";

export default function AIButton({ display, theme, handleOpenAIModal, kondisi, item }) {
  const buttonRef = useRef(null);
  const isMalam = theme?.isMalam;

  const { text: contextualText, isLaporMode } = useMemo(() => {
    const hasLaporan = (item?.laporan_terbaru?.length > 0) || (item?.laporan_warga?.length > 0);
    if (!hasLaporan) return { text: "Info Kejadian", isLaporMode: true };

    const qMap = {
      "Sepi": "Kenapa sepi ya?",
      "Ramai": "Lagi ramai nih!",
      "Antri": "Lama antri?",
      "Normal": "Tanya Akamsi AI"
    };
    const key = kondisi?.charAt(0).toUpperCase() + kondisi?.slice(1).toLowerCase();
    return { text: qMap[key] || qMap["Normal"], isLaporMode: false };
  }, [kondisi, item]);

  const handleClick = () => {
    if (handleOpenAIModal) {
      const query = isLaporMode ? "quick_lapor" : contextualText;
      handleOpenAIModal(query);
    }
  };

  const { scrollYProgress } = useScroll({ target: buttonRef, offset: ["start 160px", "end 60px"] });
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });
  const scale = useTransform(smoothProgress, [0, 0.8, 1], [1, 1, 0.95]);
  const opacity = useTransform(smoothProgress, [0, 0.8, 1], [1, 1, 0]);

  return (
    <div className="px-4 pb-7 pt-2">
      <motion.div
        ref={buttonRef}
        style={{ scale, opacity }}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleClick}
        className={`group relative w-full h-16 flex items-center cursor-pointer rounded-[24px] border-2 transition-all duration-500
          ${isMalam 
            ? 'bg-neutral-900/80 border-white/10 hover:border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.15)]' 
            : 'bg-white border-black/[0.08] hover:border-indigo-500/40 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)]'
          } backdrop-blur-2xl`}
      >
        {/* Glow Ambient di belakang bar (Floating effect) */}
        <div className={`absolute inset-0 rounded-[24px] transition-opacity duration-500 opacity-20 group-hover:opacity-40 blur-xl -z-10
          ${isMalam ? 'bg-cyan-500' : 'bg-indigo-500'}`} 
        />

        {/* Icon Area */}
        <div className="pl-5 pr-3 flex items-center justify-center">
          <motion.div 
            animate={isLaporMode ? { y: [0, -2, 0] } : {}}
            transition={{ repeat: Infinity, duration: 2 }}
            className={`p-2.5 rounded-2xl ${isMalam ? 'bg-cyan-500/10' : 'bg-indigo-500/10'}`}
          >
            {isLaporMode ? (
              <Camera size={22} className={isMalam ? "text-cyan-400" : "text-cyan-600"} />
            ) : (
              <MessageSquare size={22} className={isMalam ? "text-indigo-400" : "text-indigo-600"} />
            )}
          </motion.div>
        </div>

        {/* Placeholder Text */}
        <div className="flex-1 overflow-hidden">
          <p className={`text-[15px] font-semibold tracking-tight select-none line-clamp-1
            ${isMalam ? 'text-white/70' : 'text-neutral-700'}`}>
            {contextualText}
          </p>
          <p className={`text-[10px] font-medium opacity-50 uppercase tracking-tighter
            ${isMalam ? 'text-cyan-400' : 'text-indigo-600'}`}>
            {isLaporMode ? "Quick Report Active" : "Ask Intelligence"}
          </p>
        </div>

        {/* ACTION BUTTON (CTA) - Diperkuat dengan Gradient */}
        <div className="pr-2.5">
          <div className={`
            relative overflow-hidden flex items-center gap-2 py-2.5 px-5 rounded-[18px] font-bold text-[12px] uppercase tracking-wider transition-all duration-300
            ${isMalam 
              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_4px_12px_rgba(6,182,212,0.4)]' 
              : 'bg-gradient-to-r from-indigo-600 to-violet-700 text-white shadow-[0_4px_12px_rgba(79,70,229,0.3)]'}
            group-hover:scale-105 active:scale-95
          `}>
            <span>{isLaporMode ? "LAPOR" : "TANYA"}</span>
            <ArrowRight size={14} strokeWidth={3} className="group-hover:translate-x-1 transition-transform" />
            
            {/* Glossy Overlay untuk CTA */}
            <div className="absolute inset-0 bg-gradient-to-t from-white/20 to-transparent opacity-50" />
          </div>
        </div>

        {/* Animasi Shimmer */}
        <div className="absolute inset-0 overflow-hidden rounded-[24px] pointer-events-none">
          <motion.div 
            animate={{ x: ['-150%', '150%'] }}
            transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
            className="w-1/3 h-full bg-gradient-to-r from-transparent via-white/[0.1] to-transparent skew-x-[25deg]"
          />
        </div>
      </motion.div>

      {/* Floating Status */}
      <div className="flex items-center justify-between px-3 mt-4">
        <div className="flex items-center gap-2">
          <div className="relative">
             <Sparkles size={14} className="text-cyan-500" />
             <motion.div 
               animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
               transition={{ repeat: Infinity, duration: 2 }}
               className="absolute inset-0 bg-cyan-400 rounded-full blur-sm" 
             />
          </div>
          <span className={`text-[10px] font-black uppercase tracking-[0.15em] ${isMalam ? 'text-white/50' : 'text-black/60'}`}>
            Akamsi Intelligence <span className="text-cyan-500 ml-1">v2.0</span>
          </span>
        </div>
        
        <div className={`flex items-center gap-1.5 text-[9px] font-bold px-2.5 py-1 rounded-full ${
          isMalam ? 'bg-white/5 text-white/40' : 'bg-black/5 text-black/40'
        }`}>
          <div className={`w-1 h-1 rounded-full animate-pulse ${isMalam ? 'bg-green-400' : 'bg-green-500'}`} />
          SYSTEM READY
        </div>
      </div>
    </div>
  );
}