"use client";

import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { useRef, useMemo } from "react";

export default function AIButton({ display, theme, handleOpenAIModal, kondisi, item }) {
  const buttonRef = useRef(null);
  const isMalam = theme?.isMalam;

  // LOGIKA CTA: TANYA atau AJAK LAPOR
  const { text: contextualText, isLaporMode } = useMemo(() => {
    // 1. Prioritaskan ajakan lapor jika belum ada laporan sama sekali
    const hasLaporan = (item?.laporan_terbaru?.length > 0) || (item?.laporan_warga?.length > 0);
    if (!hasLaporan) {
      return { text: "📢 Yuk, pertama lapor!", isLaporMode: true };
    }

    // 2. Ambil laporan terbaru untuk cek traffic
    const latestReport = item?.laporan_terbaru?.[0] || item?.laporan_warga?.[0];
    const traffic = latestReport?.traffic_condition;

    // 3. Mapping kondisi lalu lintas
    if (traffic === "Macet") return { text: "Carikan jalur alternatif?", isLaporMode: false };
    if (traffic === "Ramai") return { text: "Cek kenapa jalan ramai?", isLaporMode: false };
    if (traffic === "Lancar") return { text: "Yakin jalanan lancar?", isLaporMode: false };

    // 4. Fallback ke kondisi tempat (Sepi/Ramai/Antri/Normal)
    const qMap = {
      "Sepi": "Kapan mulai ramai?",
      "Ramai": "Cek ada acara apa?",
      "Antri": "Berapa lama antri?",
      "Normal": "Ada info menarik apa?"
    };
    const key = kondisi?.charAt(0).toUpperCase() + kondisi?.slice(1).toLowerCase();
    const question = qMap[key] || qMap["Normal"];
    
    // Jika kondisi Sepi, sekalian ajak lapor juga? Terserah, kita tetap pakai tanya dulu.
    // Tapi jika mau ubah jadi ajakan lapor untuk Sepi, bisa di sini.
    return { text: question, isLaporMode: false };
  }, [kondisi, item]);

  // 🔥 Fungsi klik: jika mode lapor, kirim "quick_lapor", selain itu kirim teks pertanyaan
  const handleClick = () => {
    if (handleOpenAIModal) {
      const query = isLaporMode ? "quick_lapor" : contextualText;
      handleOpenAIModal(query);
    }
  };

  // Framer Motion Logic (tetap sama)
  const { scrollYProgress } = useScroll({
    target: buttonRef,
    offset: ["start 150px", "end 60px"]
  });

  const smoothProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });
  const scale = useTransform(smoothProgress, [0, 0.7, 1], [1, 1, 0.7]);
  const blurEffect = useTransform(smoothProgress, [0, 0.7, 1], ["blur(0px)", "blur(0px)", "blur(20px)"]);
  const opacity = useTransform(smoothProgress, [0, 0.8, 1], [1, 1, 0]);
  const translateX = useTransform(smoothProgress, [0, 0.7, 1], [0, 0, -25]);

  return (
    <div className="px-6 pb-6 pt-2">
      <motion.button
        ref={buttonRef}
        style={{ filter: blurEffect, opacity, scale, x: translateX }}
        onClick={handleClick}
        className={`group relative w-full flex items-center justify-between px-4 py-3.5 rounded-[28px] border overflow-hidden transition-all active:scale-[0.98]
          ${isMalam 
            ? 'bg-gradient-to-br from-white/10 to-white/[0.02] backdrop-blur-2xl border-white/10 shadow-2xl' 
            : 'bg-gradient-to-br from-white to-gray-50/50 border-gray-100 shadow-xl shadow-black/5'
          }`}
      >
        {/* Glow Effect */}
        <div className={`absolute -right-4 -top-4 w-20 h-20 blur-3xl opacity-20 ${display?.dot || 'bg-cyan-500'} rounded-full`} />

        <div className="flex items-center gap-3 relative z-10">
          <div className="relative">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl border shadow-inner transition-transform group-hover:rotate-12
              ${isMalam ? 'bg-white/5 border-white/10' : 'bg-gray-100 border-gray-200'}`}>
              {isLaporMode ? "📸" : "✨"}
            </div>
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-500 rounded-full border-2 border-white dark:border-gray-900 animate-pulse" />
          </div>

          <div className="flex flex-col items-start leading-tight">
            <div className="flex items-center gap-2">
              <h4 className={`text-[11px] font-[1000] uppercase tracking-wider ${isMalam ? 'text-white' : 'text-gray-950'}`}>
                AKAMSI AI
              </h4>
              <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
                {isLaporMode ? "SAY" : "ASK"}
              </span>
            </div>
            <span className={`text-[10px] font-bold ${isMalam ? 'text-white/60' : 'text-gray-500'} italic mt-0.5 text-left`}>
              "{contextualText}"
            </span>
          </div>
        </div>

        <div className={`
          flex items-center gap-2 px-4 py-2 rounded-2xl font-black text-[10px] tracking-widest transition-all
          group-hover:translate-x-1
          ${isMalam ? 'bg-white text-black shadow-lg shadow-white/10' : 'bg-gray-900 text-white shadow-lg shadow-black/20'}
        `}>
          {isLaporMode ? "LAPOR" : "TANYA"} <span className="opacity-40">→</span>
        </div>

        {/* Shine Animation */}
        <motion.div
          animate={{ x: ['-100%', '200%'] }}
          transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12 pointer-events-none"
        />
      </motion.button>
    </div>
  );
}