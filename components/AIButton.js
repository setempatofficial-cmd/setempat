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
        className={`group relative w-full h-16 flex items-center cursor-pointer rounded-[24px] border transition-all duration-500
          ${isMalam 
            ? 'bg-[#121212] border-white/10 hover:border-white/20 shadow-xl' 
            : 'bg-[#F8F9FA] border-black/[0.05] hover:border-black/10 shadow-md'
          } backdrop-blur-2xl`}
      >
        {/* Glow Ambient - Dikurangi intensitasnya agar tidak "bocor" berlebihan */}
        <div className={`absolute inset-0 rounded-[24px] transition-opacity duration-500 opacity-5 group-hover:opacity-10 blur-lg -z-10
          ${isMalam ? 'bg-cyan-400' : 'bg-indigo-600'}`} 
        />

        {/* Icon Area - Warna lebih kalem (Muted) */}
        <div className="pl-5 pr-3 flex items-center justify-center">
          <div className={`p-2.5 rounded-2xl ${isMalam ? 'bg-white/5' : 'bg-black/5'}`}>
            {isLaporMode ? (
              <Camera size={20} className={isMalam ? "text-white/60" : "text-black/60"} />
            ) : (
              <MessageSquare size={20} className={isMalam ? "text-white/60" : "text-black/60"} />
            )}
          </div>
        </div>

        {/* Placeholder Text */}
        <div className="flex-1 overflow-hidden">
          <p className={`text-[14px] font-bold tracking-tight select-none line-clamp-1
            ${isMalam ? 'text-white/90' : 'text-neutral-800'}`}>
            {contextualText}
          </p>
          <div className="flex items-center gap-1.5">
             <div className={`w-1 h-1 rounded-full ${isMalam ? 'bg-cyan-500' : 'bg-indigo-600'}`} />
             <p className={`text-[9px] font-black uppercase tracking-widest opacity-40
               ${isMalam ? 'text-white' : 'text-black'}`}>
               {isLaporMode ? "Status Report" : "Ask Akamsi"}
             </p>
          </div>
        </div>

        {/* ACTION BUTTON (CTA) - Diubah dari Gradient tajam ke Solid Deep Color */}
        <div className="pr-3">
          <div className={`
            relative overflow-hidden flex items-center gap-2 py-2.5 px-5 rounded-2xl font-black text-[11px] uppercase tracking-tighter transition-all duration-300
            ${isMalam 
              ? 'bg-white text-black shadow-lg shadow-white/5' 
              : 'bg-neutral-900 text-white shadow-lg shadow-black/10'}
            group-hover:translate-x-0.5
          `}>
            <span>{isLaporMode ? "LAPOR" : "TANYA"}</span>
            <ArrowRight size={14} strokeWidth={3} />
          </div>
        </div>

        {/* Animasi Shimmer - Lebih subtle (0.05 opacity) */}
        <div className="absolute inset-0 overflow-hidden rounded-[24px] pointer-events-none">
          <motion.div 
            animate={{ x: ['-150%', '150%'] }}
            transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
            className="w-1/2 h-full bg-gradient-to-r from-transparent via-white/[0.05] to-transparent skew-x-[25deg]"
          />
        </div>
      </motion.div>

      {/* Footer Status - Dibuat lebih menyatu dengan background */}
      <div className="flex items-center justify-between px-3 mt-4 opacity-40">
        <div className="flex items-center gap-2">
           <Sparkles size={12} className={isMalam ? "text-white" : "text-black"} />
           <span className={`text-[9px] font-bold uppercase tracking-[0.2em] ${isMalam ? 'text-white' : 'text-black'}`}>
             AI Core Engine v2
           </span>
        </div>
        
        <div className="flex items-center gap-1.5 text-[8px] font-black tracking-widest uppercase">
          <div className="w-1 h-1 rounded-full bg-emerald-500" />
          Ready
        </div>
      </div>
    </div>
  );
}