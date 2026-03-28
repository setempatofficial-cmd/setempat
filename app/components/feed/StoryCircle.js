"use client";
import { motion } from "framer-motion";
import Uploader from "@/components/Uploader";

export default function StoryCircle({ 
  laporanWarga = [], 
  tempatId, 
  namaTempat, 
  tempatKategori,  // ← Tambahkan prop ini
  openStoryModal 
}) {
  // Filter: hanya laporan dengan foto (photo_url tidak boleh null)
  const laporanDenganFoto = laporanWarga.filter(l => l?.photo_url);
  const laporanTerbaru = laporanDenganFoto[0];
  const jumlahStory = laporanDenganFoto.length;

  return (
    <div className="relative flex items-center justify-center w-16 h-16 group isolate select-none [-webkit-tap-highlight-color:transparent]">

      {/* ── RING ANIMASI ── */}
      {jumlahStory > 0 && (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
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

      {/* ── LINGKARAN FOTO ── */}
      <motion.div
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (jumlahStory > 0 && typeof openStoryModal === "function") {
            openStoryModal(tempatId, laporanDenganFoto);
          }
        }}
        whileTap={{ scale: 0.93 }}
        className={`relative w-full h-full rounded-full z-10 bg-zinc-950 cursor-pointer overflow-hidden
          border-[2.5px] ${jumlahStory > 0 ? "border-black" : "border-white/10"}
          shadow-[0_2px_12px_rgba(0,0,0,0.5)]`}
      >
        {laporanTerbaru?.photo_url || laporanTerbaru?.image_url ? (
          <>
            <img
              src={laporanTerbaru.photo_url || laporanTerbaru.image_url}
              className="w-full h-full object-cover brightness-75 group-hover:brightness-90 transition-all duration-300 pointer-events-none"
              alt="latest-story"
            />
            {/* ── LIVE badge di tengah thumbnail ── */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <motion.div
                animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)] mb-0.5"
              />
              <span className="text-[7px] font-black text-white tracking-[0.15em] uppercase drop-shadow-lg">
                LIVE
              </span>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center pointer-events-none">
            <span className="text-xl opacity-60">📸</span>
          </div>
        )}
      </motion.div>

      {/* ── TOMBOL UPLOAD ── */}
      <div
        className="absolute -bottom-1 -right-1 z-30 pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-5 h-5 flex items-center justify-center rounded-full bg-black border border-white/20 shadow-md overflow-hidden [&_button]:!w-5 [&_button]:!h-5 [&_button]:!text-[11px]">
          <Uploader 
            tempatId={tempatId} 
            namaTempat={namaTempat} 
            tempatKategori={tempatKategori}  // ← Kirim kategori
          />
        </div>
      </div>

    </div>
  );
}