"use client";

import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { useRef } from "react";

export default function AIButton({ display, theme, handleOpenAIModal }) {
  const buttonRef = useRef(null);
  const isMalam = theme?.isMalam;

  const { scrollYProgress } = useScroll({
    target: buttonRef,
    offset: ["start 150px", "end 60px"] // SAMA DENGAN WRAPPER
  });

  const smoothProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });

  /** * TIMING DISAMAKAN: 
   * Mulai bereaksi di 0.7 agar barengan dengan kartu utamanya
   */
  const scale = useTransform(smoothProgress, [0, 0.7, 1], [1, 1, 0.7]);
  const blurEffect = useTransform(smoothProgress, [0, 0.7, 1], ["blur(0px)", "blur(0px)", "blur(20px)"]);
  const opacity = useTransform(smoothProgress, [0, 0.8, 1], [1, 1, 0]);
  const translateX = useTransform(smoothProgress, [0, 0.7, 1], [0, 0, -25]);

  return (
    <motion.button
      ref={buttonRef}
      style={{ filter: blurEffect, opacity, scale, x: translateX }}
      onClick={handleOpenAIModal}
      // UI Tetap sama seperti versi premium kamu sebelumnya
      className={`group relative w-full flex items-center justify-between px-4 py-3 rounded-[26px] border overflow-hidden
        ${isMalam 
          ? 'bg-gradient-to-br from-white/15 to-transparent backdrop-blur-xl border-white/10 shadow-2xl' 
          : 'bg-gradient-to-br from-white to-gray-50 border-gray-100 shadow-xl'
        }`}
    >
      {/* ... (Konten Inner Button Kamu) ... */}
      <div className="flex items-center gap-3 relative z-10">
         <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xl border ${display.bg} ${display.border}`}>
           ✨
         </div>
         <div className="flex flex-col items-start leading-tight">
            <h4 className={`text-[12px] font-black uppercase ${isMalam ? 'text-white' : 'text-gray-950'}`}>AKAMSI AI</h4>
            <span className="text-[8px] font-bold opacity-70">Analisis {display.text.split(' ').slice(-1)} ⚡</span>
         </div>
      </div>
      <div className={`px-4 py-2 rounded-2xl border font-black text-[10px] ${isMalam ? 'bg-white text-black' : 'bg-gray-900 text-white'}`}>
        ASK
      </div>
    </motion.button>
  );
}