"use client";

import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { useRef, useMemo } from "react";
import { Send, Sparkles, Camera, MessageSquare } from "lucide-react";

export default function AIButton({ display, theme, handleOpenAIModal, kondisi, item }) {
  const buttonRef = useRef(null);
  const isMalam = theme?.isMalam;

  const { text: contextualText, isLaporMode } = useMemo(() => {
    const hasLaporan = (item?.laporan_terbaru?.length > 0) || (item?.laporan_warga?.length > 0);
    if (!hasLaporan) return { text: "Ada kejadian apa di sini? Lapor yuk...", isLaporMode: true };

    const qMap = {
      "Sepi": "Kenapa sepi ya?",
      "Ramai": "Lagi ramai nih!",
      "Antri": "Lama antri?",
      "Normal": "Tanya Akamsi AI Soal lokasi ini"
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

  // Scroll Animation - Tetap dipertahankan untuk kesan dinamis
  const { scrollYProgress } = useScroll({ target: buttonRef, offset: ["start 160px", "end 60px"] });
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });
  const scale = useTransform(smoothProgress, [0, 0.8, 1], [1, 1, 0.9]);
  const opacity = useTransform(smoothProgress, [0, 0.8, 1], [1, 1, 0]);

  return (
    <div className="px-4 pb-7 pt-2">
      <motion.div
        ref={buttonRef}
        style={{ scale, opacity }}
        onClick={handleClick}
        className={`group relative w-full h-14 flex items-center cursor-text rounded-[22px] border-2 transition-all duration-500
          ${isMalam 
            ? 'bg-white/[0.03] border-white/10 hover:border-white/30 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]' 
            : 'bg-black/[0.02] border-black/[0.06] hover:border-black/20 shadow-[0_8px_32px_0_rgba(0,0,0,0.05)]'
          } backdrop-blur-xl`}
      >
        {/* Glow Ambient di belakang bar (Floating effect) */}
        <div className={`absolute inset-0 rounded-[22px] transition-opacity duration-500 opacity-0 group-hover:opacity-100 blur-md -z-10
          ${isMalam ? 'bg-cyan-500/10' : 'bg-cyan-500/5'}`} 
        />

        {/* Icon Area - Dibuat lebih bold */}
        <div className="pl-5 pr-3 flex items-center justify-center">
          <div className={`p-2 rounded-xl ${isMalam ? 'bg-white/5' : 'bg-black/5'}`}>
            {isLaporMode ? (
              <Camera size={20} className={isMalam ? "text-cyan-400" : "text-cyan-600"} />
            ) : (
              <MessageSquare size={20} className={isMalam ? "text-indigo-400" : "text-indigo-600"} />
            )}
          </div>
        </div>

        {/* Placeholder - Font diperbesar sedikit (text-base) */}
        <div className="flex-1 overflow-hidden">
          <span className={`text-[15px] font-medium tracking-tight select-none italic
            ${isMalam ? 'text-white/30' : 'text-gray-400'}`}>
            {contextualText}
          </span>
        </div>

        {/* Action Button - Dibuat seperti tombol 'Post' atau 'Send' yang elegan */}
        <div className="pr-2">
          <div className={`
            flex items-center gap-2 py-2 px-4 rounded-[16px] font-bold text-[11px] uppercase tracking-widest transition-all duration-300
            ${isMalam 
              ? 'bg-white text-black hover:bg-cyan-400' 
              : 'bg-black text-white hover:bg-cyan-600'}
          `}>
            {isLaporMode ? "LAPOR" : "TANYA"}
            <Send size={12} strokeWidth={3} />
          </div>
        </div>

        {/* Animasi Shimmer (Cahaya lewat) supaya tetap eye-catching meskipun transparan */}
        <div className="absolute inset-0 overflow-hidden rounded-[22px] pointer-events-none">
          <motion.div 
            animate={{ x: ['-150%', '150%'] }}
            transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
            className="w-1/2 h-full bg-gradient-to-r from-transparent via-white/[0.05] dark:via-white/[0.08] to-transparent skew-x-[25deg]"
          />
        </div>
      </motion.div>

      {/* Floating Status di bawah Bar */}
      <div className="flex items-center justify-between px-2 mt-3">
        <div className="flex items-center gap-2">
          <Sparkles size={12} className="text-cyan-500 animate-pulse" />
          <span className={`text-[10px] font-bold uppercase tracking-widest ${isMalam ? 'text-white/40' : 'text-black/40'}`}>
            Akamsi Intelligence
          </span>
        </div>
        <span className={`text-[9px] font-medium px-2 py-0.5 rounded-full border ${
          isMalam ? 'border-white/10 text-white/30' : 'border-black/5 text-black/30'
        }`}>
          v2.0
        </span>
      </div>
    </div>
  );
}