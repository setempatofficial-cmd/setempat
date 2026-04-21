"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

export default function FeedCardWrapper({ children }) {
  const cardRef = useRef(null);

  // Gunakan scroll progress langsung tanpa spring untuk responsivitas instan
  const { scrollYProgress } = useScroll({
    target: cardRef,
    // Start saat card mulai masuk area bawah, end saat hampir keluar atas
    offset: ["start end", "end start"]
  });

  /**
   * OPTIMASI PERFORMA:
   * 1. Hapus 'filter: blur' karena sangat berat untuk GPU saat scroll cepat.
   * 2. Fokus pada Scale dan Opacity (Transformations yang hardware-accelerated).
   * 3. Range 0.8 ke 1 memastikan efek hanya terjadi di ujung atas layar.
   */
  const scale = useTransform(scrollYProgress, [0.8, 1], [1, 0.92]);
  const opacity = useTransform(scrollYProgress, [0.8, 0.95], [1, 0]);

  return (
    <motion.div
      ref={cardRef}
      style={{ 
        scale, 
        opacity,
        // Hint bagi browser untuk mengoptimalkan layer ini
        willChange: "transform, opacity" 
      }}
      className="relative w-full mb-6 overflow-visible"
    >
      {children}
    </motion.div>
  );
}