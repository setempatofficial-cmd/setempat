"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin, Clock, ChevronLeft, ChevronRight } from "lucide-react";

export default function ImmersiveLightbox({
  items = [],
  initialIndex = 0,
  isOpen = false,
  onClose,
  headline = "",
  currentHour = "00",
  currentMinute = "00",
  isViral = false,
  catStyle = { accent: "bg-emerald-500" },
  lokasi = "",
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [mounted, setMounted] = useState(false);
  const touchXRef = useRef(0);

  useEffect(() => {
    setMounted(true);
    if (isOpen) {
      setCurrentIndex(initialIndex);
      document.body.style.overflow = "hidden";
    }
    return () => { setMounted(false); document.body.style.overflow = ""; };
  }, [isOpen, initialIndex]);

  const next = useCallback(() => setCurrentIndex((prev) => (prev + 1) % items.length), [items.length]);
  const prev = useCallback(() => setCurrentIndex((prev) => (prev - 1 + items.length) % items.length), [items.length]);

  if (!isOpen || !mounted || items.length === 0) return null;

  const currentItem = items[currentIndex];
  const isVideo = currentItem?.url?.match(/\.(mp4|webm|mov|ogg)$/i) || currentItem?.type === 'video';

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 w-full h-full z-[999999] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 overflow-hidden touch-none"
        onClick={onClose}
      >
        {/* CONTAINER UTAMA: Ukurannya mengikuti Media */}
        <div 
          className="relative max-w-full max-h-full flex flex-col items-center"
          onClick={(e) => e.stopPropagation()} // Supaya klik di area foto gak nutup modal
        >
          
          {/* 1. TOP INFO (Nempel di atas foto) */}
          <div className="w-full flex justify-between items-center mb-2 px-1">
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10">
              <Clock size={12} className="text-white/70" />
              <span className="text-white font-mono text-[11px] font-bold">{currentHour}:{currentMinute}</span>
              <span className="text-white/40 text-[9px] font-black">{currentIndex + 1}/{items.length}</span>
            </div>
            
            <button 
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-black shadow-lg"
            >
              <X size={18} />
            </button>
          </div>

          {/* 2. MEDIA BOX */}
          <div 
            className="relative rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/5"
            onTouchStart={(e) => touchXRef.current = e.touches[0].clientX}
            onTouchEnd={(e) => {
                const diff = e.changedTouches[0].clientX - touchXRef.current;
                if (Math.abs(diff) > 50) diff > 0 ? prev() : next();
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {isVideo ? (
                  <video src={currentItem.url} autoPlay loop playsInline className="max-w-[90vw] max-h-[60vh] object-contain rounded-2xl" />
                ) : (
                  <img src={currentItem.url} alt="content" className="max-w-[90vw] max-h-[60vh] object-contain rounded-2xl" />
                )}
              </motion.div>
            </AnimatePresence>

            {/* Desktop Navigation Arrows (Inside Media Box) */}
            <div className="hidden md:block">
                <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/20 hover:bg-black/50 text-white rounded-full transition-all"><ChevronLeft size={24} /></button>
                <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/20 hover:bg-black/50 text-white rounded-full transition-all"><ChevronRight size={24} /></button>
            </div>
          </div>

          {/* 3. BOTTOM INFO (Nempel di bawah foto) */}
          <div className="w-full mt-3 px-1">
             <div className="flex items-center gap-2 mb-1.5">
                {isViral && (
                  <span className="bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded italic">VIRAL</span>
                )}
                {lokasi && (
                  <div className="flex items-center gap-1 text-emerald-400 font-bold text-[10px] uppercase">
                    <MapPin size={10} /> {lokasi}
                  </div>
                )}
             </div>

             <div className="flex gap-2.5 items-start bg-gradient-to-r from-white/5 to-transparent p-2 rounded-r-xl border-l-2 border-emerald-500">
                <h2 className="text-white text-[14px] sm:text-[16px] font-bold leading-tight italic drop-shadow-md">
                  "{headline || "Deskripsi konten"}"
                </h2>
             </div>

             {/* Hint Swipe Mobile */}
             <div className="mt-4 flex flex-col items-center opacity-20 md:hidden">
                <div className="w-8 h-[2px] bg-white rounded-full animate-pulse" />
                <span className="text-[8px] text-white mt-1">swipe to next</span>
             </div>
          </div>

        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}