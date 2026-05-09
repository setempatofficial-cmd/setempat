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
    <div className="flex flex-col items-center gap-2 group select-none [-webkit-tap-highlight-color:transparent]">
      
      <div className="relative flex items-center justify-center w-[68px] h-[68px] isolate">
        
        {/* ── RING ANIMASI (GRADIENT NEON) ── */}
        {jumlahStory > 0 && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 rounded-full z-0 p-[2px]"
            style={{
              background: "conic-gradient(from 0deg, #22d3ee, #d946ef, #22d3ee)",
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
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.95 }}
          className={`relative w-[60px] h-[60px] rounded-full z-10 bg-zinc-950 cursor-pointer overflow-hidden
            border-[2px] ${jumlahStory > 0 ? "border-black" : "border-white/10"}
            shadow-xl transition-all duration-300`}
        >
          {laporanTerbaru?.photo_url || laporanTerbaru?.image_url ? (
            <>
              <img
                src={laporanTerbaru.photo_url || laporanTerbaru.image_url}
                className="w-full h-full object-cover brightness-90 group-hover:brightness-100 transition-all duration-500"
                alt={namaTempat}
              />
              {/* LIVE Badge Kecil */}
              <div className="absolute inset-x-0 bottom-1 flex justify-center">
                <div className="bg-rose-600 px-1.5 py-[1px] rounded-[4px] flex items-center gap-1 shadow-lg">
                   <div className="w-1 h-1 rounded-full bg-white animate-pulse" />
                   <span className="text-[6px] font-black text-white tracking-tighter">LIVE</span>
                </div>
              </div>
            </>
          ) : (
            /* PLACEHOLDER INISIAL (GLASS STYLE) */
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-zinc-800 to-zinc-950">
              <span className="text-[14px] font-bold text-zinc-400 tracking-tighter">{inisial}</span>
              <span className="text-[5px] text-cyan-500/60 font-black mt-0.5 tracking-[0.2em] uppercase">
                SETEMPAT
              </span>
            </div>
          )}
        </motion.div>

        {/* ── TOMBOL UPLOAD (PLUS ICON) ── */}
        <motion.div
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="absolute bottom-0 right-0 z-30"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-6 h-6 flex items-center justify-center rounded-full bg-zinc-900 border border-white/20 shadow-lg text-white">
             {/* Uploader dimasukkan ke sini, pastikan komponen Uploader-mu bisa custom icon/trigger */}
             <Uploader 
                tempatId={tempatId} 
                namaTempat={namaTempat} 
                tempatKategori={tempatKategori} 
                renderTrigger={() => (
                  <div className="text-lg font-light">+</div>
                )}
              />
          </div>
        </motion.div>
      </div>

      {/* ── NAMA LOKASI ── */}
      <span className="text-[10px] font-medium text-zinc-400 truncate w-20 text-center group-hover:text-white transition-colors">
        {namaTempat}
      </span>
      
    </div>
  );
}