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

  // Cek apakah masih live (kurang dari 30 menit)
  const isStillLive = () => {
    if (!laporanTerbaru?.created_at) return false;
    const diffMins = Math.floor((Date.now() - new Date(laporanTerbaru.created_at)) / 60000);
    return diffMins < 30;
  };

  const live = isStillLive();

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
              background: "conic-gradient(from 0deg, #22d3ee, #d946ef, #f59e0b, #22d3ee)",
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
              // Kirim semua story, mulai dari index 0
              openStoryModal(tempatId, laporanDenganFoto, 0);
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
                onError={(e) => {
                  e.target.style.display = 'none';
                  const parent = e.target.parentElement;
                  if (parent) {
                    parent.innerHTML = `
                      <div class="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-zinc-800 to-zinc-950">
                        <span class="text-[14px] font-bold text-zinc-400 tracking-tighter">${inisial}</span>
                        <span class="text-[5px] text-cyan-500/60 font-black mt-0.5 tracking-[0.2em] uppercase">SETEMPAT</span>
                      </div>
                    `;
                  }
                }}
              />
              {/* LIVE Badge - hanya tampil jika masih live */}
              {live && (
                <div className="absolute inset-x-0 bottom-1 flex justify-center">
                  <div className="bg-rose-600 px-1.5 py-[1px] rounded-[4px] flex items-center gap-1 shadow-lg">
                    <motion.div
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      className="w-1 h-1 rounded-full bg-white"
                    />
                    <span className="text-[6px] font-black text-white tracking-tighter">LIVE</span>
                  </div>
                </div>
              )}
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
          className="absolute -bottom-1 -right-1 z-30"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-6 h-6 flex items-center justify-center rounded-full bg-gradient-to-tr from-cyan-500 to-fuchsia-600 shadow-lg">
            <Uploader
              tempatId={tempatId}
              namaTempat={namaTempat}
              tempatKategori={tempatKategori}
              renderTrigger={() => (
                <div className="w-full h-full flex items-center justify-center text-white font-bold text-base bg-zinc-950 rounded-full border border-white/20">
                  +
                </div>
              )}
            />
          </div>
        </motion.div>
      </div>

      {/* ── NAMA LOKASI + JUMLAH STORY ── */}
      <div className="text-center">
        <span className="text-[10px] font-medium text-zinc-400 truncate w-20 block group-hover:text-white transition-colors">
          {namaTempat?.length > 12 ? namaTempat.substring(0, 10) + '...' : namaTempat}
        </span>
        {jumlahStory > 1 && (
          <span className="text-[7px] font-bold text-cyan-400/70">
            {jumlahStory} story
          </span>
        )}
      </div>

    </div>
  );
}