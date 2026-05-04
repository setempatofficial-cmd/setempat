"use client";

import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { useRef, useMemo } from "react";
import { Sparkles, Camera, MessageSquare, ArrowRight, ShoppingBag, Coffee } from "lucide-react";

export default function AIButton({ theme, handleOpenAIModal, kondisi, item }) {
  const buttonRef = useRef(null);
  const isMalam = theme?.isMalam;

  // --- ENGINE KONTEKSTUAL INTERAKTIF ---
  const config = useMemo(() => {
    const key = kondisi?.toLowerCase();
    const hasLaporan = (item?.laporan_terbaru?.length > 0) || (item?.laporan_warga?.length > 0);
    
    // 1. LOGIKA KEBUTUHAN (Barang/Jasa/Ojek) - Mengarahkan ke interaksi AI
    if (key === "ramai" || key === "antri") {
      return {
        text: "Macet & Rame? Takon Akamsi solusine",
        subText: "Cek Ojek & Jasa Rewang",
        label: "TANYA",
        mode: "DISCOVERY",
        color: "text-orange-500",
        dotColor: "bg-orange-500",
        icon: <ShoppingBag size={20} className="text-orange-500" />,
        query: "Di sini sedang ramai dan antri, apa ada jasa ojek atau bantuan warga yang tersedia di sekitar?"
      };
    }

    if (key === "panas" || key === "normal" && hasLaporan) {
      return {
        text: "Laper/Ngorong? Takon onok opo wae...",
        subText: "Cari Produk & Jajan Warga",
        label: "TANYA",
        mode: "DISCOVERY",
        color: "text-amber-500",
        dotColor: "bg-amber-500",
        icon: <Coffee size={20} className="text-amber-500" />,
        query: "Saya sedang di lokasi, apakah ada warga yang jualan makanan atau minuman segar di dekat sini?"
      };
    }

    // 2. MODE LAPOR (Data Kosong)
    if (!hasLaporan) {
      return {
        text: "Durung onok info. Takon Akamsi?",
        subText: "Update Kondisi Lokasi",
        label: "CEK",
        mode: "LAPOR",
        color: isMalam ? "text-cyan-400" : "text-indigo-600",
        dotColor: isMalam ? "bg-cyan-500" : "bg-indigo-600",
        icon: <Camera size={20} className={isMalam ? "text-white/60" : "text-black/60"} />,
        query: "Bagaimana kondisi terkini di lokasi ini? Saya ingin tahu info terbaru."
      };
    }

    // 3. MODE DEFAULT (AI Chat)
    return {
      text: "Tanya Akamsi AI tentang tempat ini",
      subText: "Local Intelligence",
      label: "TANYA",
      mode: "TANYA",
      color: isMalam ? "text-white/90" : "text-neutral-800",
      dotColor: "bg-emerald-500",
      icon: <MessageSquare size={20} className={isMalam ? "text-white/60" : "text-black/60"} />,
      query: "Berikan saya ringkasan menarik tentang tempat ini."
    };
  }, [kondisi, item, isMalam]);

  const handleClick = () => {
    if (handleOpenAIModal) {
      handleOpenAIModal(config.query);
    }
  };

  // --- ANIMASI RINGAN ---
  const { scrollYProgress } = useScroll({ target: buttonRef, offset: ["start 160px", "end 60px"] });
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });
  const scale = useTransform(smoothProgress, [0, 0.8, 1], [1, 1, 0.95]);
  const opacity = useTransform(smoothProgress, [0, 0.8, 1], [1, 1, 0]);

  return (
    <div className="px-4 pb-7 pt-2">
      <motion.div
        ref={buttonRef}
        style={{ scale, opacity }}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleClick}
        className={`group relative w-full h-16 flex items-center cursor-pointer rounded-[24px] border transition-all duration-500
          ${isMalam 
            ? 'bg-[#121212] border-white/10 hover:border-white/20 shadow-xl' 
            : 'bg-[#F8F9FA] border-black/[0.05] hover:border-black/10 shadow-md'
          } backdrop-blur-2xl`}
      >
        {/* Glow Ambient Dinamis - Fokus ke warna discovery */}
        <div className={`absolute inset-0 rounded-[24px] transition-opacity duration-500 opacity-5 group-hover:opacity-10 blur-lg -z-10
          ${config.mode === 'DISCOVERY' ? 'bg-amber-500' : (isMalam ? 'bg-cyan-400' : 'bg-indigo-600')}`} 
        />

        {/* Icon Area */}
        <div className="pl-5 pr-3 flex items-center justify-center">
          <div className={`p-2.5 rounded-2xl transition-all duration-300 ${isMalam ? 'bg-white/5' : 'bg-black/5'} 
            ${config.mode === 'DISCOVERY' ? 'scale-110' : ''}`}>
            {config.icon}
          </div>
        </div>

        {/* Placeholder Text */}
        <div className="flex-1 overflow-hidden">
          <p className={`text-[14px] font-[1000] tracking-tight select-none line-clamp-1 transition-colors duration-300
            ${config.mode === 'DISCOVERY' ? config.color : (isMalam ? 'text-white/90' : 'text-neutral-800')}`}>
            {config.text}
          </p>
          <div className="flex items-center gap-1.5">
             <motion.div 
               animate={config.mode === 'DISCOVERY' ? { scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] } : {}}
               transition={{ repeat: Infinity, duration: 1.5 }}
               className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} 
             />
             <p className={`text-[9px] font-[1000] uppercase tracking-widest opacity-40
               ${isMalam ? 'text-white' : 'text-black'}`}>
               {config.subText}
             </p>
          </div>
        </div>

        {/* ACTION BUTTON (CTA) - Konsisten dengan TANYA/CEK */}
        <div className="pr-3">
          <div className={`
            relative overflow-hidden flex items-center gap-2 py-2.5 px-5 rounded-2xl font-[1000] text-[11px] uppercase tracking-tighter transition-all duration-300
            ${config.mode === 'DISCOVERY' 
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/20' 
              : isMalam ? 'bg-white text-black' : 'bg-neutral-900 text-white'}
            group-hover:translate-x-0.5
          `}>
            <span>{config.label}</span>
            <ArrowRight size={14} strokeWidth={3} />
          </div>
        </div>

        {/* Shimmer Effect */}
        <div className="absolute inset-0 overflow-hidden rounded-[24px] pointer-events-none">
          <motion.div 
            animate={{ x: ['-150%', '150%'] }}
            transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
            className="w-1/2 h-full bg-gradient-to-r from-transparent via-white/[0.05] to-transparent skew-x-[25deg]"
          />
        </div>
      </motion.div>

      {/* Footer Status */}
      <div className="flex items-center justify-between px-3 mt-4 opacity-30">
        <div className="flex items-center gap-2">
            <Sparkles size={12} className={isMalam ? "text-white" : "text-black"} />
            <span className={`text-[9px] font-[1000] uppercase tracking-[0.2em] ${isMalam ? 'text-white' : 'text-black'}`}>
              AKAMSI ENGINE v2
            </span>
        </div>
        
        <div className="flex items-center gap-1.5 text-[8px] font-black tracking-widest uppercase">
          <div className={`w-1 h-1 rounded-full ${config.mode === 'DISCOVERY' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
          {config.mode === 'DISCOVERY' ? 'Service Discovery' : 'System Ready'}
        </div>
      </div>
    </div>
  );
}