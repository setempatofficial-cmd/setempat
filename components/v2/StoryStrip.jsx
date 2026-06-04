"use client";
import { motion, AnimatePresence } from "framer-motion";
import { X, Eye, Image as ImageIcon, ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useState, useRef } from "react";

export default function StoryStrip({
  laporanWarga = [],
  onSelectStory,
  activeStoryId,
  isOpen,
  onClose,
  tempatId,
  namaTempat,
  theme = {}
}) {
  const [imageErrors, setImageErrors] = useState({});
  const scrollContainerRef = useRef(null);

  const stories = laporanWarga.filter(l => l?.photo_url || l?.image_url);

  if (stories.length === 0) return null;

  const handleImageError = (storyId) => {
    setImageErrors(prev => ({ ...prev, [storyId]: true }));
  };

  const handleScroll = (direction) => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === 'left' ? -200 : 200;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        // Gunakan wrapper div dengan class 'isolate' untuk mengunci susunan tumpukan CSS browser secara mutlak
        <div className="fixed inset-0 z-50 isolate">

          {/* Backdrop Overlay - Bersih Tanpa Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            // Menggunakan warna gelap solid transparan murni, dijamin tidak akan membocorkan efek kabur ke HeroCard
            className="fixed inset-0 bg-black/60 pointer-events-auto"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ y: "100vh" }}
            animate={{ y: 0 }}
            exit={{ y: "100vh" }}
            transition={{ type: "spring", damping: 32, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 pointer-events-none"
            style={{
              height: "50vh",
              WebkitFontSmoothing: "subpixel-antialiased",
              MozOsxFontSmoothing: "auto"
            }}
          >
            <div
              // KUNCI AMAN: Mengganti backdrop-blur-xl dengan bg-zinc-950/98 (hampir solid gelap pekat super mewah).
              // Ini menghentikan browser mobile dari mendistorsi pixel komponen HeroCard di background halaman.
              className="bg-gradient-to-t from-zinc-950 via-zinc-950 to-zinc-900/98 border-t border-white/10 rounded-t-[32px] pt-4 px-4 shadow-[0_-20px_50px_rgba(0,0,0,0.95)] flex flex-col h-full pointer-events-auto"
              style={{
                maxWidth: "420px",
                marginLeft: "auto",
                marginRight: "auto",
                width: "100%"
              }}
            >
              {/* Handle Bar */}
              <div className="w-12 h-1 bg-white/30 rounded-full mx-auto mb-4 cursor-pointer" onClick={onClose} />

              {/* Header */}
              <div className="flex items-center justify-between mb-5 shrink-0">
                <div>
                  <h4 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center">
                      <Eye size={14} className="text-cyan-400" />
                    </div>
                    Cerita Warga
                  </h4>
                  <p className="text-[10px] text-white/40 mt-0.5">
                    {stories.length} momen • ketuk untuk cerita lengkap
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
                >
                  <X size={16} className="text-white" />
                </button>
              </div>

              {/* Horizontal Scroll dengan tombol navigasi */}
              <div className="relative flex-1 min-h-0">
                {stories.length > 3 && (
                  <>
                    <button
                      onClick={() => handleScroll('left')}
                      className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-all"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      onClick={() => handleScroll('right')}
                      className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-all"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </>
                )}

                <div
                  ref={scrollContainerRef}
                  className="flex gap-5 overflow-x-auto pb-6 h-full items-start snap-x snap-mandatory scrollbar-hide"
                  style={{
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    WebkitOverflowScrolling: 'touch'
                  }}
                >
                  {stories.map((story, index) => {
                    const isActive = story.id === activeStoryId;
                    const photoUrl = story.photo_url || story.image_url;
                    const hasError = imageErrors[story.id];

                    return (
                      <motion.button
                        key={story.id || index}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => onSelectStory?.(story, index)}
                        // Kita lepas total class transform-gpu bawaan agar font rendering di text button tetap tajam murni
                        className="flex flex-col items-center gap-2 snap-start shrink-0 group"
                      >
                        <div className={`relative p-[3px] rounded-full transition-all duration-300 ${isActive
                          ? 'bg-gradient-to-br from-cyan-400 to-indigo-500'
                          : 'bg-zinc-700'
                          }`}>
                          <div className="relative w-20 h-20 rounded-full overflow-hidden bg-zinc-800 border-2 border-zinc-950">
                            {!hasError ? (
                              <Image
                                src={photoUrl}
                                alt={`Story by ${story.user_name || 'Warga'}`}
                                fill
                                sizes="80px"
                                className="object-cover group-hover:scale-105 transition-transform duration-300"
                                onError={() => handleImageError(story.id)}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ImageIcon size={24} className="text-white/30" />
                              </div>
                            )}
                          </div>
                        </div>
                        <span className={`text-[10px] font-medium max-w-[72px] truncate ${isActive ? 'text-cyan-400' : 'text-white/70'
                          }`}>
                          {story.user_name || `Warga`}
                        </span>
                        {isActive && (
                          <span className="text-[6px] text-cyan-400/70">● LIVE</span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Footer */}
              <div className="shrink-0 mt-3 pt-3 border-t border-white/10 text-center">
                <p className="text-[7px] text-white/30 tracking-wider">
                  Geser untuk lihat semua • {stories.length} cerita
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}