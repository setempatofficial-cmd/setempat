"use client";

import { motion } from "framer-motion";
import { memo } from "react";

function FeedCardWrapper({ children, isActive }) {
  return (
    <motion.div
      initial={false}
      animate={{
        opacity: isActive ? 1 : 0.85,
      }}
      transition={{
        duration: 0.2,
        ease: "easeOut"
      }}
      className="relative w-full rounded-2xl overflow-hidden"
      style={{
        willChange: "transform, opacity",
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        // ← HAPUS transform scale dari sini, pindahkan ke parent
      }}
    >
      {children}
    </motion.div>
  );
}

export default memo(FeedCardWrapper);