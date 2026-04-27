"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin, Clock, ChevronLeft, ChevronRight, Lock, Eye, EyeOff } from "lucide-react";

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
  const [showProtectedOverlay, setShowProtectedOverlay] = useState(false);
  const touchXRef = useRef(0);
  const videoRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    if (isOpen) {
      setCurrentIndex(initialIndex);
      document.body.style.overflow = "hidden";
      
      // Blokir semua event yang membuka di tab baru
      const blockKeyDown = (e) => {
        // Blokir Ctrl+S (save), Ctrl+P (print), Ctrl+U (view source)
        if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'p' || e.key === 'u' || e.key === 'S')) {
          e.preventDefault();
          return false;
        }
        // Blokir F12 (DevTools)
        if (e.key === 'F12') {
          e.preventDefault();
          return false;
        }
      };
      
      document.addEventListener('keydown', blockKeyDown);
      
      return () => {
        document.removeEventListener('keydown', blockKeyDown);
        document.body.style.overflow = "";
      };
    }
  }, [isOpen, initialIndex]);

  // Cegah context menu (right click)
  const preventContextMenu = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }, []);

  // Cegah drag
  const preventDrag = useCallback((e) => {
    e.preventDefault();
    return false;
  }, []);

  const next = useCallback(() => setCurrentIndex((prev) => (prev + 1) % items.length), [items.length]);
  const prev = useCallback(() => setCurrentIndex((prev) => (prev - 1 + items.length) % items.length), [items.length]);

  if (!isOpen || !mounted || items.length === 0) return null;

  const currentItem = items[currentIndex];
  const isVideo = currentItem?.url?.match(/\.(mp4|webm|mov|ogg|avi|mkv)$/i) || 
                  currentItem?.type === 'video' ||
                  currentItem?.url?.includes('cloudinary.com/video');

  // Komponen untuk gambar dengan proteksi
  const ProtectedImage = ({ src, alt }) => {
    const imgRef = useRef(null);
    
    return (
      <div className="relative group">
        <img 
          ref={imgRef}
          src={src} 
          alt={alt}
          className="max-w-[90vw] max-h-[60vh] object-contain rounded-2xl select-none"
          draggable={false}
          onContextMenu={preventContextMenu}
          onDragStart={preventDrag}
          style={{ userSelect: 'none', pointerEvents: 'auto' }}
        />
        
        {/* Overlay watermark transparan */}
        <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-40 transition-opacity pointer-events-none">
          <Lock size={16} className="text-white drop-shadow-lg" />
        </div>
        
        {/* Overlay transparan untuk blokir interaksi (kecuali klik normal) */}
        <div 
          className="absolute inset-0"
          onContextMenu={preventContextMenu}
          onDragStart={preventDrag}
        />
      </div>
    );
  };

  // Komponen untuk video dengan proteksi
  const ProtectedVideo = ({ src }) => {
    return (
      <div className="relative group rounded-2xl overflow-hidden">
        <video 
          ref={videoRef}
          src={src}
          autoPlay
          loop
          playsInline
          muted={false}
          controls
          controlsList="nodownload nofullscreen"
          disablePictureInPicture
          className="max-w-[90vw] max-h-[60vh] object-contain"
          onContextMenu={preventContextMenu}
          onDragStart={preventDrag}
          draggable={false}
        />
        
        {/* Overlay proteksi di atas video controls */}
        <div 
          className="absolute inset-0 pointer-events-none"
          onContextMenu={preventContextMenu}
        />
        
        {/* Watermark di video */}
        <div className="absolute bottom-2 right-2 opacity-30 pointer-events-none">
          <div className="bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded text-[8px] font-mono text-white">
            🔒 {window.location.hostname}
          </div>
        </div>
      </div>
    );
  };

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 w-full h-full z-[999999] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 overflow-hidden touch-none"
        onClick={onClose}
        onContextMenu={preventContextMenu}
      >
        {/* CONTAINER UTAMA */}
        <div 
          className="relative max-w-full max-h-full flex flex-col items-center"
          onClick={(e) => e.stopPropagation()}
        >
          
          {/* 1. TOP INFO */}
          <div className="w-full flex justify-between items-center mb-3 px-1">
            <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
              <Clock size={12} className="text-white/70" />
              <span className="text-white font-mono text-xs font-bold">
                {currentHour}:{currentMinute}
              </span>
              <div className="w-px h-3 bg-white/20" />
              <span className="text-white/60 text-[10px] font-black">
                {currentIndex + 1}/{items.length}
              </span>
            </div>
            
            <button 
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white shadow-lg transition-all backdrop-blur-sm"
            >
              <X size={18} />
            </button>
          </div>

          {/* 2. MEDIA BOX */}
          <div 
            className="relative rounded-2xl overflow-hidden shadow-2xl"
            onTouchStart={(e) => touchXRef.current = e.touches[0].clientX}
            onTouchEnd={(e) => {
                const diff = e.changedTouches[0].clientX - touchXRef.current;
                if (Math.abs(diff) > 50) diff > 0 ? prev() : next();
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                {isVideo ? (
                  <ProtectedVideo src={currentItem.url} />
                ) : (
                  <ProtectedImage src={currentItem.url} alt="content" />
                )}
              </motion.div>
            </AnimatePresence>

            {/* Navigation Arrows */}
            {items.length > 1 && (
              <>
                <button 
                  onClick={prev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/30 hover:bg-black/60 text-white rounded-full transition-all backdrop-blur-sm"
                  onContextMenu={preventContextMenu}
                >
                  <ChevronLeft size={24} />
                </button>
                <button 
                  onClick={next}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/30 hover:bg-black/60 text-white rounded-full transition-all backdrop-blur-sm"
                  onContextMenu={preventContextMenu}
                >
                  <ChevronRight size={24} />
                </button>
              </>
            )}
          </div>

          {/* 3. BOTTOM INFO */}
          <div className="w-full mt-4 px-2">
            <div className="flex items-center gap-2 mb-2">
              {isViral && (
                <span className="bg-red-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full animate-pulse">
                  🔴 VIRAL
                </span>
              )}
              {lokasi && (
                <div className="flex items-center gap-1 text-emerald-400 font-bold text-[10px] uppercase bg-black/30 backdrop-blur-sm px-2 py-0.5 rounded-full">
                  <MapPin size={10} /> {lokasi}
                </div>
              )}
            </div>

            <div className="bg-gradient-to-r from-white/10 to-transparent p-3 rounded-xl border-l-4 border-emerald-500">
              <h2 className="text-white text-sm sm:text-base font-bold leading-tight">
                "{headline || "Kontung Terkini"}"
              </h2>
            </div>

            {/* Info Proteksi */}
            <div className="mt-3 text-center">
              <p className="text-white/20 text-[8px] font-mono flex items-center justify-center gap-1">
                <Lock size={10} />
                Konten dilindungi | Copyright by SetempatID
              </p>
            </div>

            {/* Swipe Hint Mobile */}
            {items.length > 1 && (
              <div className="mt-3 flex flex-col items-center opacity-30 md:hidden">
                <div className="w-10 h-1 bg-white/50 rounded-full" />
                <span className="text-[7px] text-white/50 mt-1">geser untuk ganti foto/video</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}