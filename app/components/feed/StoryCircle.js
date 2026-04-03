"use client";
import { motion } from "framer-motion";
import Uploader from "@/components/Uploader";

export default function StoryCircle({ 
  laporanWarga = [], 
  tempatId, 
  namaTempat, 
  tempatKategori, 
  openStoryModal 
}) {
  const laporanDenganFoto = laporanWarga.filter(l => l?.photo_url || l?.image_url);
  const laporanTerbaru = laporanDenganFoto[0];
  const jumlahStory = laporanDenganFoto.length;

  const inisial = namaTempat
    ? namaTempat.split(" ").map(word => word[0]).join("").substring(0, 2).toUpperCase()
    : "??";

  return (
    <div className="relative flex items-center justify-center w-16 h-16 group isolate select-none [-webkit-tap-highlight-color:transparent]">

      {/* ── RING ANIMASI ── */}
      {jumlahStory > 0 && (
        <motion.div
          animate={{ rotate: 360, scale: [1, 1.05, 1] }} // Ditambah sedikit pulsasi scale
          transition={{ 
            rotate: { duration: 4, repeat: Infinity, ease: "linear" },
            scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
          }}
          className="absolute inset-[-3px] rounded-full pointer-events-none z-0"
          style={{
            background: "conic-gradient(from 0deg, #22d3ee, #d946ef, #22d3ee)",
            borderRadius: "9999px",
            padding: "2px",
            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
          }}
        />
      )}

      {/* ── LINGKARAN UTAMA ── */}
      <motion.div
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (jumlahStory > 0 && typeof openStoryModal === "function") {
            openStoryModal(tempatId, laporanDenganFoto);
          }
        }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.93 }}
        className={`relative w-full h-full rounded-full z-10 bg-zinc-950 cursor-pointer overflow-hidden
          border-[2.5px] ${jumlahStory > 0 ? "border-black" : "border-white/10"}
          shadow-[0_2px_12px_rgba(0,0,0,0.5)] transition-all duration-300`}
      >
        {laporanTerbaru?.photo_url || laporanTerbaru?.image_url ? (
          <>
            <motion.img
              whileHover={{ scale: 1.1 }} // Zoom halus saat hover
              src={laporanTerbaru.photo_url || laporanTerbaru.image_url}
              className="w-full h-full object-cover brightness-75 group-hover:brightness-100 transition-all duration-500 pointer-events-none"
              alt="latest-story"
            />
            {/* LIVE Badge */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <motion.div
                animate={{ scale: [1, 1.4, 1], opacity: [1, 0.4, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,1)] mb-0.5"
              />
              <span className="text-[7px] font-black text-white tracking-[0.15em] uppercase drop-shadow-md">
                LIVE
              </span>
            </div>
          </>
        ) : (
          /* PLACEHOLDER DENGAN EFEK PULSE (JIKA KOSONG) */
          <div className="w-full h-full flex flex-col items-center justify-center relative bg-gradient-to-br from-zinc-800 via-zinc-900 to-black">
            {/* Efek Lingkaran Dalam yang Berkedip Halus */}
            <motion.div 
              animate={{ opacity: [0.1, 0.3, 0.1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute inset-0 bg-cyan-500/20" 
            />
            
            <span className="text-[13px] font-bold text-zinc-100 z-10">{inisial}</span>
            <div className="w-3 h-[1px] bg-cyan-500/50 my-1 z-10" />
            <span className="text-[6px] text-cyan-400/80 font-bold uppercase z-10 tracking-widest animate-pulse">
              ISI FOTO
            </span>
          </div>
        )}
      </motion.div>

      {/* ── TOMBOL UPLOAD ── */}
      <motion.div
        whileHover={{ scale: 1.2 }}
        className="absolute -bottom-1 -right-1 z-30 pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-6 h-6 flex items-center justify-center rounded-full bg-gradient-to-tr from-cyan-500 to-fuchsia-500 p-[1.5px] shadow-lg">
          <div className="w-full h-full rounded-full bg-black flex items-center justify-center overflow-hidden [&_button]:!w-full [&_button]:!h-full [&_button]:!text-[12px] [&_button]:!bg-transparent">
            <Uploader 
              tempatId={tempatId} 
              namaTempat={namaTempat} 
              tempatKategori={tempatKategori} 
            />
          </div>
        </div>
      </motion.div>

    </div>
  );
}