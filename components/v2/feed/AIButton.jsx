"use client";

import { motion, useScroll, useTransform, useSpring, AnimatePresence } from "framer-motion";
import { useRef, useMemo } from "react";
import { Sparkles, Camera, MessageSquare, ArrowRight, ShoppingBag, Coffee, Zap, ShieldAlert } from "lucide-react";

export default function AIButton({ theme, handleOpenAIModal, kondisi, item }) {
  const buttonRef = useRef(null);
  const isMalam = theme?.isMalam;

  // --- ENGINE KONTEKSTUAL V2.1 (Taktis Detail) ---
  const config = useMemo(() => {
    const key = kondisi?.toUpperCase();
    const hasLaporan = (item?.laporan_terbaru?.length > 0) || (item?.laporan_warga?.length > 0);
    
    if (key === "MACET" || key === "RAMAI") {
      return {
        text: "Butuh Terobosan?",
        subText: "Ojek & Jalur Tikus Aktif",
        label: "SOLUSI",
        mode: "URGENT",
        color: "text-amber-500",
        bgIcon: "bg-amber-500/20",
        border: "border-amber-500/40",
        icon: <Zap size={22} className="text-amber-500 fill-amber-500/20" />,
        query: `Kondisi di ${item?.name} sedang ${key}. Berikan saya rekomendasi ojek terdekat atau jalur alternatif warga.`
      };
    }

    if (key === "DARURAT" || key === "KECELAKAAN") {
      return {
        text: "Butuh Bantuan Cepat?",
        subText: "Rewang & Medis Terdekat",
        label: "BANTU",
        mode: "ALERT",
        color: "text-rose-500",
        bgIcon: "bg-rose-500/20",
        border: "border-rose-500/40",
        icon: <ShieldAlert size={22} className="text-rose-500" />,
        query: `Ada kondisi darurat di ${item?.name}. Berikan kontak bantuan warga atau fasilitas kesehatan paling dekat.`
      };
    }

    if (hasLaporan) {
      return {
        text: "Ada Apa Saja di Sini?",
        subText: "Eksplorasi Produk Warga",
        label: "CEK",
        mode: "DISCOVERY",
        color: "text-cyan-500",
        bgIcon: "bg-cyan-500/20",
        border: "border-cyan-500/40",
        icon: <ShoppingBag size={22} className="text-cyan-500" />,
        query: `Tampilkan produk unggulan dan jajanan yang dijual warga di sekitar ${item?.name}.`
      };
    }

    return {
      text: "Tanya Akamsi AI",
      subText: "Local Intelligence Ready",
      label: "ASK",
      mode: "DEFAULT",
      color: isMalam ? "text-white" : "text-black",
      bgIcon: isMalam ? "bg-white/10" : "bg-black/5",
      border: "border-white/10",
      icon: <MessageSquare size={22} className={isMalam ? "text-white/60" : "text-black/60"} />,
      query: `Ceritakan keunikan tempat ${item?.name} yang jarang diketahui orang luar.`
    };
  }, [kondisi, item, isMalam]);

  const handleClick = () => {
    console.log("AIButton diklik!"); 
    
    // Pastikan kita tidak memicu AI jika data item belum load
    if (!item) {
      console.error("Data item belum siap!");
      return;
    }

    if (handleOpenAIModal) {
      // Kirim query dari config yang sudah dihitung useMemo
      handleOpenAIModal(config.query);
    } else {
      console.error("Fungsi handleOpenAIModal tidak terdeteksi!");
    }
  };

  // --- ANIMASI PARALLAX SCROLL ---
  const { scrollYProgress } = useScroll({ target: buttonRef, offset: ["start end", "end start"] });
  const scale = useTransform(scrollYProgress, [0.4, 0.5, 0.6], [0.9, 1, 0.9]);
  const rotateX = useTransform(scrollYProgress, [0.4, 0.5, 0.6], [10, 0, -10]);

  return (
    <div className="py-4 perspective-1000">
      <motion.button // ✅ GANTI motion.div menjadi motion.button
        ref={buttonRef}
        style={{ scale, rotateX }}
        whileHover={{ y: -5 }}
        whileTap={{ scale: 0.96 }}
        onClick={handleClick}
        className={`group relative w-full h-20 flex items-center rounded-[32px] border-2 transition-all duration-500 overflow-hidden
          ${isMalam ? 'bg-zinc-950/80' : 'bg-white/80'} ${config.border} backdrop-blur-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)]`}
      >
        {/* 1. ANIMATED ROTATING BORDER GLOW (Premium Effect) */}
        <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700`}>
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] bg-[conic-gradient(from_0deg,transparent,transparent,${config.mode === 'URGENT' ? '#f59e0b' : '#06b6d4'})] opacity-20`}
          />
        </div>

        {/* 2. ICON AREA DENGAN "NEON" EFFECT */}
        <div className="pl-6 pr-4 relative z-10">
          <div className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-all duration-500 
            ${config.bgIcon} ${config.mode !== 'DEFAULT' ? 'shadow-[0_0_20px_rgba(245,158,11,0.2)] scale-110' : ''}`}>
            {config.icon}
          </div>
        </div>

        {/* 3. TEXT AREA (Hirarki Lebih Tegas) */}
        <div className="flex-1 relative z-10">
          <h4 className={`text-base font-black tracking-tight leading-none mb-1 transition-colors
            ${config.mode !== 'DEFAULT' ? config.color : (isMalam ? 'text-white' : 'text-neutral-900')}`}>
            {config.text}
          </h4>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.mode === 'DEFAULT' ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${config.mode === 'DEFAULT' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
            </span>
            <p className="text-[10px] font-black uppercase tracking-[0.15em] opacity-40">
              {config.subText}
            </p>
          </div>
        </div>

        {/* 4. FLOATING CTA BUTTON */}
        <div className="pr-4 relative z-10">
          <div className={`flex items-center justify-center h-12 w-12 rounded-2xl transition-all duration-500
            ${config.mode === 'URGENT' ? 'bg-amber-500 shadow-amber-500/40' : 
              config.mode === 'ALERT' ? 'bg-rose-600 shadow-rose-600/40' :
              isMalam ? 'bg-white text-black' : 'bg-black text-white'} shadow-lg group-hover:rotate-[-10deg]`}>
            <ArrowRight size={20} strokeWidth={3} />
          </div>
        </div>

        {/* 5. OVERLAY MESH GRADIENT (Background Subtle) */}
        <div className={`absolute inset-0 opacity-10 pointer-events-none ${isMalam ? 'bg-[url("https://grainy-gradients.vercel.app/noise.svg")]' : ''}`} />
      </motion.button>

      {/* 6. SYSTEM BADGE FOOTER */}
      <div className="flex items-center justify-between px-6 mt-3">
        <div className="flex items-center gap-1.5 opacity-30 group">
          <Zap size={10} className="group-hover:text-amber-500 transition-colors" />
          <span className="text-[8px] font-black tracking-[0.3em] uppercase">Intelligence Engine v2.1</span>
        </div>
        <div className={`text-[8px] font-black tracking-widest uppercase px-2 py-0.5 rounded border transition-colors
          ${config.mode !== 'DEFAULT' ? 'border-amber-500/40 text-amber-500' : 'border-white/10 opacity-30'}`}>
          {config.mode === 'DEFAULT' ? 'Idle Mode' : 'Priority Mode'}
        </div>
      </div>
    </div>
  );
}