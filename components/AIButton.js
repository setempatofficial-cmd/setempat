"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

export default function AIButton({ display, theme, handleOpenAIModal }) {
  const buttonRef = useRef(null);
  const isMalam = theme?.isMalam;

  // --- TIMING AGRESIF (EJECT LOGIC) ---
  const { scrollYProgress } = useScroll({
    target: buttonRef,
    // "start 40%" artinya efek mulai SANGAT AWAL (saat tombol masih di tengah layar)
    // "end 10%" artinya efek SELESAI sebelum tombol menyentuh garis atas
    offset: ["start 150px", "end 80px"] 
  });

  // 1. Penciutan Skala: Tombol seolah-olah "masuk" ke dalam background
  const scale = useTransform(scrollYProgress, [0, 0.2], [1, 0.7]);
  
  // 2. Blur Cepat: Dari tajam langsung jadi kaca buram dalam sekejap
  const blurEffect = useTransform(scrollYProgress, [0, 0.2], ["blur(0px)", "blur(20px)"]);
  
  // 3. Opacity Drop: Menghilang lebih cepat dari scroll-nya
  const opacity = useTransform(scrollYProgress, [0, 0.4], [1, 0]);

  // 4. Pergeseran Horizontal (Slight Tilt): Memberi kesan "menyingkir" ke samping sedikit
  const translateX = useTransform(scrollYProgress, [0, 0.2], [0, -20]);

  return (
    <motion.button
      ref={buttonRef}
      style={{ 
        filter: blurEffect, 
        opacity, 
        scale,
        x: translateX,
      }}
      whileTap={{ scale: 0.95 }}
      onClick={handleOpenAIModal}
      className={`group relative w-full flex items-center justify-between px-4 py-3 rounded-[26px] border transition-all duration-300 overflow-hidden
        ${isMalam 
          ? 'bg-gradient-to-br from-white/15 to-transparent backdrop-blur-xl border-white/10 shadow-2xl shadow-black/50' 
          : 'bg-gradient-to-br from-white to-gray-50 border-gray-100 shadow-xl shadow-gray-200/40'
        }`}
    >
      {/* SHIMMER CAHAYA INTENS: Agar tetap menonjol sebelum dia "Eject" */}
      <motion.div
        animate={{ x: ['-200%', '200%'] }}
        transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-[45deg] pointer-events-none"
      />

      <div className="flex items-center gap-3 relative z-10">
        {/* ICON BOX: Glow warna sesuai status */}
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xl border shadow-inner transition-all duration-500
          ${display.bg} ${display.border} relative overflow-hidden`}>
          <span className="z-10 drop-shadow-md">✨</span>
          {/* Pulse aura di dalam box icon */}
          <motion.div 
             animate={{ scale: [1, 1.5, 1], opacity: [0.1, 0.3, 0.1] }}
             transition={{ repeat: Infinity, duration: 2 }}
             className={`absolute inset-0 ${display.dot}`} 
          />
        </div>

        <div className="flex flex-col items-start leading-tight">
          <div className="flex items-center gap-2">
            <h4 className={`text-[12px] font-[1000] uppercase tracking-tighter ${isMalam ? 'text-white' : 'text-gray-950'}`}>
              AKAMSI AI
            </h4>
            <span className={`flex h-1.5 w-1.5 rounded-full ${display.dot} shadow-[0_0_8px] shadow-current`} />
          </div>
          <span className={`text-[8px] font-black uppercase tracking-tight opacity-70 ${isMalam ? 'text-blue-300' : 'text-blue-800'}`}>
             Analisis {display.text.split(' ').slice(-1)} ⚡
          </span>
        </div>
      </div>

      {/* ACTION CHIP: Dibuat sangat tegas (High Contrast) */}
      <div className={`flex items-center gap-2 relative z-10 px-4 py-2 rounded-2xl border shadow-lg transition-all
        ${isMalam ? 'bg-white text-black border-white' : 'bg-gray-900 text-white border-gray-900'}`}>
        <span className="text-[10px] font-black tracking-widest">ASK</span>
        <motion.div
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ repeat: Infinity, duration: 1 }}
          className={`w-1 h-1 rounded-full ${display.dot}`}
        />
      </div>

      {/* DYNAMIC GLOW: Sinyal warna kuat di background */}
      <div className={`absolute -right-6 -bottom-6 w-24 h-24 rounded-full blur-[30px] opacity-20 ${display.dot} transition-colors duration-700`} />
    </motion.button>
  );
}