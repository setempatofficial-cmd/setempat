"use client";

import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { useRef } from "react";

export default function FeedCardWrapper({ children, theme }) {
  const cardRef = useRef(null);
  const isMalam = theme?.isMalam;

  const { scrollYProgress } = useScroll({
    target: cardRef,
    // Offset Pixel agar presisi di semua ukuran layar HP
    offset: ["start 150px", "end 60px"] 
  });

  const smoothProgress = useSpring(scrollYProgress, { 
    stiffness: 100, 
    damping: 30,
    mass: 0.8
  });

  /**
   * LOGIKA SINKRON:
   * [0 ke 0.7]: Zona Baca (Scale 1, Blur 0, Opacity 1)
   * [0.7 ke 1]: Zona Meledak (Menciut & Blur bareng AI Button)
   */
  const cardScale = useTransform(smoothProgress, [0, 0.7, 1], [1, 1, 0.90]); 
  const cardBlur = useTransform(smoothProgress, [0, 0.7, 1], ["blur(0px)", "blur(0px)", "blur(12px)"]);
  const cardOpacity = useTransform(smoothProgress, [0, 0.8, 1], [1, 1, 0]);

  return (
    <motion.div
      ref={cardRef}
      style={{ 
        scale: cardScale, 
        filter: cardBlur,
        opacity: cardOpacity,
        willChange: "transform, filter, opacity" 
      }}
      // PENTING: p-4 dihapus agar padding tidak dobel (sesuai request kamu)
      className={`relative overflow-hidden mb-8 transition-colors duration-500
        ${isMalam ? 'bg-[#1e293b]/50 border-white/5 shadow-2xl' : 'bg-white border-gray-100 shadow-xl'} 
        rounded-[40px] border`}
    >
      {children}
    </motion.div>
  );
}