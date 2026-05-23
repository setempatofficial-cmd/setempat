"use client";
import { motion } from "framer-motion";
import { RefreshCcw, ScanLine } from "lucide-react";

export default function StoryStrip({ laporanWarga = [], onSelectStory, activeStoryId }) {
  const stories = laporanWarga.filter(l => l?.photo_url || l?.image_url);

  // Mencari index. Jika tidak ditemukan, default ke 0
  const currentIndex = activeStoryId ? stories.findIndex(s => s.id === activeStoryId) : 0;
  const safeIndex = currentIndex === -1 ? 0 : currentIndex;

  // Logika next: siklus dari 0 ke N
  const nextIndex = (safeIndex + 1) % stories.length;
  const nextStory = stories[nextIndex];

  if (stories.length === 0) return null;

  return (
    <div className="relative -mt-16 mb-6 px-4 z-30 flex justify-center">
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={() => onSelectStory?.(nextStory, nextIndex)}
        className="relative group flex items-center gap-4 px-5 py-3 rounded-2xl bg-zinc-900/80 border border-white/10 backdrop-blur-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] overflow-hidden"
      >
        <div className="relative w-10 h-10 rounded-xl bg-black flex items-center justify-center border border-white/5">
          <ScanLine className="text-cyan-400 animate-pulse" size={18} />
        </div>

        <div className="text-left">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[8px] font-black tracking-widest text-cyan-400 uppercase">Jendela Warga</span>
            <div className="flex gap-0.5">
              {stories.map((_, i) => (
                <div key={i} className={`h-1 w-1 rounded-full ${i === safeIndex ? 'bg-cyan-400' : 'bg-white/20'}`} />
              ))}
            </div>
          </div>
          <p className="text-[11px] font-bold text-white tracking-tight">
            Lihat Sekitar {safeIndex + 1} / {stories.length}
          </p>
        </div>

        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors">
          <RefreshCcw size={14} className="text-white group-hover:text-cyan-300 transition-colors" />
        </div>
      </motion.button>
    </div>
  );
}