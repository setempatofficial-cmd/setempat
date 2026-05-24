"use client";
import { motion, AnimatePresence } from "framer-motion";
import Uploader from "@/components/Uploader";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function StoryCircle({
  laporanWarga = [],
  tempatId,
  namaTempat,
  tempatKategori,
  openStoryModal
}) {
  const [stories, setStories] = useState(laporanWarga);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Filter stories dengan foto/video
  const laporanDenganFoto = stories.filter(l => l?.photo_url || l?.image_url || l?.video_url);
  const laporanTerbaru = laporanDenganFoto[0];
  const jumlahStory = laporanDenganFoto.length;

  const inisial = namaTempat
    ? namaTempat.split(" ").map(word => word[0]).join("").substring(0, 2).toUpperCase()
    : "??";

  // 🔥 Fungsi untuk refresh stories dari database
  const refreshStories = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("laporan_warga")
        .select("*")
        .eq("tempat_id", tempatId)
        .eq("status", "approved")
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (data) {
        setStories(data);
      }
    } catch (err) {
      console.error("Error refreshing stories:", err);
    }
  }, [tempatId]);

  // 🔥 Listen untuk upload event dari Uploader
  useEffect(() => {
    const handleUploadStart = () => {
      setIsUploading(true);
      setUploadSuccess(false);
    };

    const handleUploadSuccess = async (event) => {
      setIsUploading(false);
      setUploadSuccess(true);

      // Refresh stories dari database
      await refreshStories();

      // Animasi success (3 detik)
      setTimeout(() => setUploadSuccess(false), 3000);
    };

    const handleUploadFailed = () => {
      setIsUploading(false);
      setUploadSuccess(false);
    };

    // Listen untuk custom events
    window.addEventListener('story-upload-start', handleUploadStart);
    window.addEventListener('story-upload-success', handleUploadSuccess);
    window.addEventListener('story-upload-failed', handleUploadFailed);

    return () => {
      window.removeEventListener('story-upload-start', handleUploadStart);
      window.removeEventListener('story-upload-success', handleUploadSuccess);
      window.removeEventListener('story-upload-failed', handleUploadFailed);
    };
  }, [refreshStories]);

  // 🔥 Auto-refresh setiap 30 detik (optional)
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshStories();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [refreshStories]);

  return (
    <div className="relative flex items-center justify-center w-20 h-20 group isolate select-none [-webkit-tap-highlight-color:transparent]">

      {/* ── RING ANIMASI RADIANT ── */}
      {(jumlahStory > 0 || isUploading) && (
        <>
          {/* Efek Glow di belakang ring */}
          <div className={`absolute inset-[-4px] rounded-full blur-md animate-pulse z-0 
            ${isUploading ? 'bg-yellow-500/40' : 'bg-cyan-500/20'}`}
          />

          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="absolute inset-[-3px] rounded-full z-0"
            style={{
              background: isUploading
                ? "conic-gradient(from 0deg, #f59e0b, #fbbf24, #f59e0b, #f59e0b)"
                : "conic-gradient(from 0deg, #22d3ee, #d946ef, #f59e0b, #22d3ee)",
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
          shadow-[0_8px_20px_rgba(0,0,0,0.8)] transition-all duration-500
          ${uploadSuccess ? 'ring-2 ring-green-500 ring-offset-2 ring-offset-black' : ''}`}
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

        {/* Uploading Overlay */}
        {isUploading && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Success Checkmark */}
        {uploadSuccess && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute inset-0 bg-green-500/80 backdrop-blur-sm flex items-center justify-center"
          >
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </motion.div>
        )}
      </motion.div>

      {/* ── TOMBOL UPLOAD (FLOATING) DENGAN AREA SENTUH YANG DIPERBESAR ── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.2, rotate: 90 }}
        whileTap={{ scale: 0.9 }}
        className="absolute -bottom-1 -right-1 z-30"
        style={{
          touchAction: "manipulation",
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
        }}
        onTouchEnd={(e) => {
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {/* Area sentuh yang diperbesar */}
        <div className="relative">
          <div className="absolute -inset-3 rounded-full bg-transparent touch-manipulation" />

          {/* Tombol utama */}
          <div className="relative w-8 h-8 flex items-center justify-center rounded-full bg-gradient-to-tr from-cyan-500 to-fuchsia-600 p-[2px] shadow-[0_4px_12px_rgba(0,0,0,0.5)] touch-manipulation active:scale-95 transition-transform duration-100">
            <div className="w-full h-full rounded-full bg-zinc-950 flex items-center justify-center overflow-hidden 
              [&_button]:!w-full [&_button]:!h-full [&_button]:!text-[16px] [&_button]:!bg-transparent 
              [&_button]:!border-none [&_button]:!flex [&_button]:!items-center [&_button]:!justify-center
              [&_button]:touch-manipulation [&_button]:active:scale-95">
              <Uploader
                tempatId={tempatId}
                namaTempat={namaTempat}
                tempatKategori={tempatKategori}
                onUploadSuccess={() => {
                  // Trigger refresh dari sini juga
                  refreshStories();
                }}
                onRefreshNeeded={refreshStories}
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* JUMLAH STORY BADGE (Counter) */}
      {jumlahStory > 1 && (
        <div className="absolute -top-1 -right-1 z-30 bg-fuchsia-600 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-black shadow-lg pointer-events-none">
          {jumlahStory}
        </div>
      )}
    </div>
  );
}