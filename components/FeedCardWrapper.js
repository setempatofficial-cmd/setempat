"use client";

import { motion } from "framer-motion";
import { memo } from "react";

function FeedCardWrapper({ children, isActive }) {
  return (
    <motion.div
      initial={false}
      animate={{
        // Jika aktif: terang & jernih. Jika tidak: meredup & blur tipis
        opacity: isActive ? 1 : 0.4,
        filter: isActive ? "blur(0px)" : "blur(1.5px)",
        scale: isActive ? 1 : 0.98,
      }}
      transition={{
        duration: 0.4,
        ease: [0.25, 1, 0.5, 1], // Menggunakan cubic-bezier agar transisinya premium/smooth
      }}
      className="relative w-full rounded-2xl overflow-hidden"
      style={{
        willChange: "transform, opacity, filter",
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
      }}
    >
      {/* Kunci interaksi tombol jika card sedang tidak aktif/fokus */}
      <div className={isActive ? "pointer-events-auto" : "pointer-events-none"}>
        {children}
      </div>
    </motion.div>
  );
}

export default memo(FeedCardWrapper);