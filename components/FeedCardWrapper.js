"use client";

import { motion } from "framer-motion";

export default function FeedCardWrapper({ children, isActive }) {
  return (
    <motion.div
      initial={false}
      animate={{
        // Gunakan transform 3D untuk memaksa Hardware Acceleration (GPU)
        transform: isActive ? "scale(1) translateZ(0)" : "scale(0.98) translateZ(0)",
        opacity: isActive ? 1 : 0.6,
      }}
      transition={{
        duration: 0.25,
        ease: [0.2, 0.9, 0.4, 1.1] // Efek spring elastis tipis khas Plexity
      }}
      className="relative w-full h-full overflow-visible rounded-2xl flex items-center justify-center"
      style={{
        // Solusi anti-blur berat: Gunakan backdrop-blur opsional atau lupakan blur mentah-mentah di mobile viewport
        willChange: "transform, opacity",
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden"
      }}
    >
      {children}
    </motion.div>
  );
}