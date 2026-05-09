"use client";
import { motion, AnimatePresence } from "framer-motion";
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
    <div className="relative flex items-center justify-center w-20 h-20 group isolate select-none [-webkit-tap-highlight-color:transparent]">
      
      {/* ── RING ANIMASI RADIANT ── */}
      {jumlahStory > 0 && (
        <>
          {/* Efek Glow di belakang ring */}
          <div className="absolute inset-[-4px] rounded-full bg-cyan-500/20 blur-md animate-pulse z-0" />
          
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="absolute inset-[-3px] rounded-full z-0"
            style={{
              background: "conic-gradient(from 0deg, #22d3ee, #d946ef, #f59e0b, #22d3ee)",
              padding: "2.5px",
              WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              WebkitMaskComposite: "xor",
              maskComposite: "exclude",
            }}
          />
        </>
      )}

      {/* ── LINGKARAN UTAMA (GLASSMORPHISM) ── */}
      <motion.div
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (jumlahStory > 0 && typeof openStoryModal === "function") {
            openStoryModal(tempatId, laporanDenganFoto);
          }
        }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        className={`relative w-full h-full rounded-full z-10 bg-zinc-950 cursor-pointer overflow-hidden
          border-[3px] ${jumlahStory > 0 ? "border-black" : "border-white/5"}
          shadow-[0_8px_20px_rgba(0,0,0,0.8)] transition-all duration-500`}
      >
        {laporanTerbaru?.photo_url || laporanTerbaru?.image_url ? (
          <>
            <motion.img
              initial={{ scale: 1.2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileHover={{ scale: 1.15 }}
              src={laporanTerbaru.photo_url || laporanTerbaru.image_url}
              className="w-full h-full object-cover brightness-[0.8] group-hover:brightness-110 transition-all duration-700 pointer-events-none"
              alt="latest-story"
            />
            
            {/* OVERLAY GRADIENT TEKSTUR */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

            {/* LIVE Badge Premium */}
            <div className="absolute bottom-2 inset-x-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10">
                <motion.div
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="w-1 h-1 rounded-full bg-rose-500 shadow-[0_0_5px_#f43f5e]"
                />
                <span className="text-[6px] font-black text-white tracking-[0.1em] uppercase">
                  LIVE
                </span>
              </div>
            </div>
          </>
        ) : (
          /* PLACEHOLDER DENGAN NEON TEXT */
          <div className="w-full h-full flex flex-col items-center justify-center relative bg-zinc-900">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-500/10 via-transparent to-transparent" />
            <span className="text-sm font-black text-white tracking-tighter z-10 group-hover:scale-110 transition-transform">
              {inisial}
            </span>
            <span className="text-[5px] text-cyan-400 font-black uppercase z-10 tracking-[0.2em] mt-1 opacity-60">
              Setempat
            </span>
          </div>
        )}
      </motion.div>

      {/* ── TOMBOL UPLOAD (FLOATING) ── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.2, rotate: 90 }}
        className="absolute -bottom-0 -right-0 z-30"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-7 h-7 flex items-center justify-center rounded-full bg-gradient-to-tr from-cyan-500 to-fuchsia-600 p-[2px] shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
          <div className="w-full h-full rounded-full bg-zinc-950 flex items-center justify-center overflow-hidden 
            [&_button]:!w-full [&_button]:!h-full [&_button]:!text-[14px] [&_button]:!bg-transparent 
            [&_button]:!border-none [&_button]:!flex [&_button]:!items-center [&_button]:!justify-center">
            <Uploader 
              tempatId={tempatId} 
              namaTempat={namaTempat} 
              tempatKategori={tempatKategori} 
            />
          </div>
        </div>
      </motion.div>

      {/* JUMLAH STORY BADGE (Counter) */}
      {jumlahStory > 1 && (
        <div className="absolute -top-1 -right-1 z-30 bg-fuchsia-600 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-black shadow-lg">
          {jumlahStory}
        </div>
      )}
    </div>
  );
}