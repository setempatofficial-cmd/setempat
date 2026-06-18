"use client";

import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { memo, useRef, useEffect, useState } from "react";

function FeedCardWrapper({ children, isActive, containerRef }) {
  const cardRef = useRef(null);
  const [elementTop, setElementTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  // 1. Mengikat useScroll ke kontainer penampung khusus
  const { scrollY } = useScroll({
    container: containerRef || undefined,
  });

  // 2. Konfigurasi Spring untuk melunakkan tarikan scroll jari
  const springConfig = {
    damping: 30,    // Mencegah efek goyang/memantul berlebih
    stiffness: 160, // Kecepatan respons mengejar ujung jari
    mass: 0.5       // Memberikan inersia bobot yang alami
  };

  // 3. Menghitung posisi koordinat kartu di dalam DOM secara presisi
  useEffect(() => {
    const calculatePositions = () => {
      if (cardRef.current) {
        setElementTop(cardRef.current.offsetTop);
      }
      if (containerRef?.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };

    calculatePositions();

    const timeoutId = setTimeout(calculatePositions, 100);
    const resizeObserver = new ResizeObserver(calculatePositions);

    if (containerRef && containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      clearTimeout(timeoutId);
      if (containerRef && containerRef.current) {
        resizeObserver.unobserve(containerRef.current);
      }
      resizeObserver.disconnect();
    };
  }, [containerRef]);

  /**
   * 4. SNAP RANGE KONTROL (Perplexity Discover Style)
   * Menggunakan pengali 0.35 agar efek transisi transparan -> buram -> terang
   * benar-benar terkunci ketat hanya saat kartu dekat dengan pusat viewport.
   */
  const currentContainerHeight = containerHeight || 800;
  const inputRange = [
    elementTop - currentContainerHeight * 0.35, // 1. Berada di antrean bawah (Kondisi mati)
    elementTop,                                 // 2. Tepat di tengah fokus (Kondisi puncak/aktif)
    elementTop + 40,                            // 3. Menahan kondisi aktif sebentar saat digeser naik
    elementTop + currentContainerHeight * 0.35  // 4. Didorong keluar ke atas (Kembali mati)
  ];

  // 5. Transformasi Nilai Linear Mentah (Raw Values)
  const rawOpacity = useTransform(scrollY, inputRange, [0.05, 1, 1, 0.05]);
  const rawScale = useTransform(scrollY, inputRange, [0.94, 1, 1, 0.94]);
  const rawY = useTransform(scrollY, inputRange, [25, 0, 0, -25]); // Paralaks halus

  const rawGrayscale = useTransform(scrollY, inputRange, [
    "grayscale(100%)",
    "grayscale(0%)",
    "grayscale(0%)",
    "grayscale(100%)",
  ]);

  // 🔥 PERBAIKAN DI SINI: Nilai disinkronkan agar terang 100% tepat di tengah (Indeks 1 & 2)
  const rawBrightness = useTransform(scrollY, inputRange, [
    "brightness(15%)",  // Di bawah: Sangat redup, menyatu dengan bg black
    "brightness(100%)", // Tepat di tengah: Menyala terang sempurna
    "brightness(100%)", // Digeser ke atas dikit: Tetap terang sempurna
    "brightness(15%)",  // Keluar ke atas: Redup kembali
  ]);

  // ✨ BONUS: Efek gradual blur yang ditarik halus (Ciri khas antarmuka premium modern)
  const rawBlur = useTransform(scrollY, inputRange, [
    "blur(10px)",
    "blur(0px)",
    "blur(0px)",
    "blur(10px)",
  ]);

  // 6. Hubungkan nilai transform ke useSpring agar jalannya animasi selembut sutra
  const dynamicOpacity = useSpring(rawOpacity, springConfig);
  const dynamicScale = useSpring(rawScale, springConfig);
  const dynamicY = useSpring(rawY, springConfig);

  return (
    <motion.div
      ref={cardRef}
      style={{
        opacity: dynamicOpacity,
        scale: dynamicScale,
        y: dynamicY,
        filter: `${rawGrayscale} ${rawBrightness} ${rawBlur}`,
        WebkitFilter: `${rawGrayscale} ${rawBrightness} ${rawBlur}`,
        willChange: "transform, opacity, filter",
        transform: "translateZ(0)",
        WebkitTransform: "translateZ(0)",
      }}
      className="relative w-full rounded-2xl overflow-hidden bg-black"
    >
      <div className={isActive ? "pointer-events-auto" : "pointer-events-none"}>
        {children}
      </div>
    </motion.div>
  );
}

export default memo(FeedCardWrapper);