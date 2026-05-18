"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export default function SplashScreen({ onComplete }) {
  const [progress, setProgress] = useState(0);

  // Simulasi progress bar halus (60fps) untuk kenyamanan visual mata user
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => onComplete(), 400); // Beri jeda sedikit setelah 100% untuk efek transisi keluar
          return 100;
        }
        return prev + 2.5;
      });
    }, 40);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ 
        y: "-100%", // Efek slide-up mewah seperti native app iOS/Android saat selesai
        opacity: 0,
        transition: { duration: 0.6, ease: [0.23, 1, 0.32, 1] } 
      }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-between bg-[#0B0F19] px-6 py-16"
      style={{ maxWidth: "420px", margin: "0 auto", right: 0, left: 0 }} // Presisi ukuran HP sesuai container header
    >
      {/* Spacer Atas agar logo benar-benar berada di center optik mata */}
      <div className="h-10" />

      {/* CENTER: LOGO ICON & BRAND IDENTITY */}
      <div className="flex flex-col items-center gap-5 text-center">
        {/* Kontainer Ikon Bulat Kotak (Squircle) Terracotta */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative w-20 h-20 rounded-2xl flex items-center justify-center bg-gradient-to-br from-[#E3655B] to-[#ff7d72] shadow-xl shadow-[#E3655B]/20"
        >
          {/* Gabungan Pin Lokasi + Atap Rumah Minimalis */}
          <div className="relative w-10 h-10 flex items-center justify-center">
            {/* Outline Pin Lokasi */}
            <svg className="absolute inset-0 w-full h-full text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            {/* Isian Atap Rumah di Dalam Pin */}
            <div className="absolute top-[7px] w-4 h-4 flex items-center justify-center">
              <svg className="w-full h-full text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
              </svg>
            </div>
          </div>
        </motion.div>

        {/* Nama Brand Tanpa Kata Platform */}
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="flex flex-col items-center"
        >
          <h1 className="text-xl font-black tracking-[0.2em] text-white uppercase">
            SETEMPAT<span className="text-[#E3655B]">.id</span>
          </h1>
        </motion.div>
      </div>

      {/* BOTTOM: PRECISE MINIMALIST LOADER */}
      <div className="w-full max-w-[120px] flex flex-col items-center gap-3">
        <div className="w-full h-[3px] bg-white/10 rounded-full overflow-hidden relative">
          <motion.div 
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#E3655B] to-[#ff7d72] rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-[9px] font-bold tracking-widest text-white/30 uppercase">
          Memuat Lingkungan
        </span>
      </div>
    </motion.div>
  );
}