"use client";

import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { useRef } from "react";

export default function FeedCardWrapper({ children, theme }) {
  const cardRef = useRef(null);
  const isMalam = theme?.isMalam;

  const { scrollYProgress } = useScroll({
    target: cardRef,
    // Tetap pakai offset pixel agar sinkron dengan AI Button
    offset: ["start 150px", "end 60px"] 
  });

  const smoothProgress = useSpring(scrollYProgress, { 
    stiffness: 120, 
    damping: 35 
  });

  /**
   * PERBAIKAN ZONA TAJAM:
   * [0 ke 0.7]: Kartu 100% TAJAM & SKALA 1 (Zona Baca Aman).
   * [0.7 ke 1]: ZONA MELEDAK (Baru mulai menciut, blur, & menghilang).
   */
  const cardScale = useTransform(smoothProgress, [0, 0.7, 1], [1, 1, 0.88]); 
  const cardBlur = useTransform(smoothProgress, [0, 0.75, 1], ["blur(0px)", "blur(0px)", "blur(12px)"]);
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
      className={`relative overflow-hidden mb-10
        ${isMalam ? 'bg-[#1e293b]/50 border-white/5' : 'bg-white border-gray-100'} 
        rounded-[40px] border p-4 shadow-2xl`}
    >
      {children}
    </motion.div>
  );
}