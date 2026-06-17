"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { memo, useRef, useEffect, useState } from "react";

function FeedCardWrapper({ children, isActive, containerRef }) {
  const cardRef = useRef(null);
  const [elementTop, setElementTop] = useState(0);
  const [elementHeight, setElementHeight] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  // 🔥 SOLUSI UTAMA: Ikat useScroll ke kontainer penampung snap-scroll Anda, bukan ke window!
  const { scrollY } = useScroll({
    container: containerRef
  });

  // Hitung posisi relatif kartu di dalam kontainer
  useEffect(() => {
    const calculatePositions = () => {
      if (cardRef.current) {
        // Menggunakan offsetTop karena posisi dihitung dari batas atas parent terdekat
        setElementTop(cardRef.current.offsetTop);
        setElementHeight(cardRef.current.offsetHeight);
      }
      if (containerRef?.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };

    // Jalankan saat awal render
    calculatePositions();

    // Antisipasi jika ada perubahan ukuran layar/orientasi hp
    window.addEventListener("resize", calculatePositions);
    return () => window.removeEventListener("resize", calculatePositions);
  }, [containerRef]);

  /**
   * KONTROL JARAK ANIMASI (Berdasarkan tinggi kontainer scroll):
   * index 0: Kartu berada di antrean bawah (Dipaksa Hitam/Gelap total)
   * index 1: Kartu pas masuk viewport aktif (Warna asli 100%)
   * index 2: Kartu bertahan sebelum didorong ke atas (Warna asli 100%)
   * index 3: Kartu tenggelam tersedot ke atas layar (Kembali Hitam/Gelap total)
   */
  const inputRange = [
    elementTop - containerHeight,
    elementTop - containerHeight * 0.15,
    elementTop + elementHeight - containerHeight * 0.45,
    elementTop + elementHeight
  ];

  // Ekstremisasi nilai output agar transisinya tegas dan mengunci fokus
  const dynamicOpacity = useTransform(scrollY, inputRange, [0.05, 1, 1, 0.05]);

  const dynamicGrayscale = useTransform(scrollY, inputRange, [
    "grayscale(100%)",
    "grayscale(0%)",
    "grayscale(0%)",
    "grayscale(100%)",
  ]);

  const dynamicBrightness = useTransform(scrollY, inputRange, [
    "brightness(15%)", // Sangat gelap, menyatu dengan latar belakang hitam
    "brightness(100%)",
    "brightness(100%)",
    "brightness(15%)",
  ]);

  const dynamicScale = useTransform(scrollY, inputRange, [0.92, 1, 1, 0.92]);
  const dynamicY = useTransform(scrollY, inputRange, [30, 0, 0, -30]);

  return (
    <motion.div
      ref={cardRef}
      style={{
        opacity: dynamicOpacity,
        scale: dynamicScale,
        y: dynamicY,
        filter: `${dynamicGrayscale} ${dynamicBrightness}`,
        WebkitFilter: `${dynamicGrayscale} ${dynamicBrightness}`,
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