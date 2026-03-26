"use client";
import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import Uploader from "@/components/Uploader";
import StoryModal from "@/app/components/feed/StoryModal";

// ── Portal wrapper agar modal lepas dari overflow-hidden ──────────────────────
const ModalPortal = ({ children }) => {
  if (typeof window === "undefined") return null;
  return createPortal(children, document.body);
};

// ── Empty State ───────────────────────────────────────────────────────────────
const LiveAmbience = ({ theme, timeLabel, tempatId, namaTempat, onUploadSuccess, isHujan }) => {
  const isMalam = theme?.isMalam;
  const dynamicBg = isHujan
    ? (isMalam ? "from-slate-900 via-sky-950 to-black" : "from-blue-50 via-sky-100 to-white")
    : (isMalam ? "from-zinc-950 via-zinc-900 to-black" : "from-slate-50 via-white to-slate-100");

  return (
    <div className={`relative h-full w-full flex flex-col items-center justify-center bg-gradient-to-b ${dynamicBg} rounded-[30px] overflow-hidden`}>
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 pointer-events-none" />
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="z-30 flex flex-col items-center gap-4">
        <div className="relative p-4 rounded-full bg-white/5 border border-white/10 backdrop-blur-md shadow-2xl">
          <Uploader tempatId={tempatId} namaTempat={namaTempat} onUploadSuccess={onUploadSuccess} />
          <span className="absolute inset-0 rounded-full bg-cyan-400/20 animate-ping -z-10" />
        </div>
        <div className="text-center space-y-1">
          <h4 className={`text-[11px] font-black uppercase tracking-[0.3em] ${isMalam ? 'text-white' : 'text-slate-900'}`}>
            Kirim Pantauan
          </h4>
          <p className={`text-[9px] font-medium uppercase tracking-widest ${isMalam ? 'text-white/40' : 'text-slate-400'}`}>
            Situasi {timeLabel} di <span className="font-bold text-cyan-500">{namaTempat || 'Lokasi'}</span>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

// ── Normalizer: pastikan semua foto punya field `url` ─────────────────────────
const normalizePhoto = (p) => ({
  ...p,
  url: p?.url || p?.photo_url || p?.image_url || null,
});

// ─ Image with lazy loading & retry logic
const OptimizedImage = ({ src, alt, className, objectFit = "cover" }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <>
      {!isLoaded && !error && (
        <div className={`${className} bg-zinc-800 animate-pulse absolute inset-0`} />
      )}
      <img
        src={src}
        alt={alt}
        className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
        style={{ objectFit }}
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
        onError={() => setError(true)}
      />
      {error && (
        <div className={`${className} bg-zinc-900 flex items-center justify-center`}>
          <span className="text-xs text-white/40">❌</span>
        </div>
      )}
    </>
  );
};

// ── Komponen Utama ────────────────────────────────────────────────────────────
export default function PhotoSlider({
  photos = [],
  selectedPhotoIndex = 0,
  setSelectedPhotoIndex,
  isHujan,
  timeLabel,
  theme,
  tempatId,
  namaTempat,
  onUploadSuccess,
}) {
  const [isStoryOpen, setIsStoryOpen] = useState(false);
  const [touchStart, setTouchStart] = useState(0);

  // Normalize dan memoize foto kategorisasi
  const { adminPhotos, wargaPhotos } = useMemo(() => {
    const normalizedPhotos = photos.map(normalizePhoto);
    return {
      adminPhotos: normalizedPhotos.filter(p => p.isOfficial && p.url),
      wargaPhotos: normalizedPhotos.filter(p => !p.isOfficial && p.url),
    };
  }, [photos]);

  const handleNewUpload = (newPhoto) => {
    if (onUploadSuccess) onUploadSuccess(newPhoto);
    setTimeout(() => setIsStoryOpen(true), 600);
  };

  const handleTouchEnd = (e) => {
    const touchEnd = e.changedTouches[0].clientX;
    const distance = touchStart - touchEnd;
    if (adminPhotos.length <= 1) return;
    if (distance > 50) setSelectedPhotoIndex((selectedPhotoIndex + 1) % adminPhotos.length);
    if (distance < -50) setSelectedPhotoIndex((selectedPhotoIndex - 1 + adminPhotos.length) % adminPhotos.length);
  };

  // ── Empty State ─────────────────────────────────────────────────────────────
  if (adminPhotos.length === 0 && wargaPhotos.length === 0) {
    return (
      <div className="h-full w-full rounded-[30px] border border-white/5 shadow-2xl overflow-hidden">
        <LiveAmbience
          isHujan={isHujan}
          theme={theme}
          timeLabel={timeLabel}
          tempatId={tempatId}
          namaTempat={namaTempat}
          onUploadSuccess={handleNewUpload}
        />
      </div>
    );
  }

  return (
    <>
      {/*
        CONTAINER UTAMA — overflow-hidden hanya untuk clip foto.
        StoryModal TIDAK boleh ada di dalam div ini.
      */}
      <div className="relative h-full w-full overflow-hidden bg-zinc-950 rounded-[30px] shadow-2xl">

        {/* ── SLIDER FOTO OFFICIAL ──────────────────────────────────────── */}
        <div
          className="flex h-full transition-transform duration-700"
          style={{
            transform: `translateX(-${selectedPhotoIndex * 100}%)`,
            transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          onTouchStart={(e) => setTouchStart(e.touches[0].clientX)}
          onTouchEnd={handleTouchEnd}
        >
          {adminPhotos.length > 0 ? (
            adminPhotos.map((photo, idx) => (
              <div key={photo.id || idx} className="w-full h-full flex-shrink-0 relative">
                <OptimizedImage
                  src={photo.url}
                  alt={`Official foto ${idx + 1}`}
                  className="w-full h-full"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />
              </div>
            ))
          ) : (
            // Ada foto warga tapi tidak ada official — tampilkan foto warga pertama sebagai bg
            <div className="w-full h-full flex-shrink-0 relative">
              <OptimizedImage
                src={wargaPhotos[0].url}
                alt="bg warga"
                className="w-full h-full opacity-40 blur-sm"
              />
              <div className="absolute inset-0 bg-zinc-950/60 pointer-events-none" />
            </div>
          )}
        </div>

        {/* ── STORY CIRCLE + UPLOADER (pojok kiri atas) ────────────────── */}
        <div className="absolute top-4 left-4 z-[50] flex flex-col items-center gap-4">

          {wargaPhotos.length > 0 && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsStoryOpen(true)}
              className="group relative cursor-pointer select-none"
            >
              {/* Ring animasi */}
              <div className="absolute -inset-1 bg-gradient-to-tr from-cyan-400 via-fuchsia-500 to-amber-400 rounded-full animate-spin-slow opacity-75 blur-[2px] pointer-events-none" />

              {/* Foto preview */}
              <div className="relative w-12 h-12 rounded-full border-[3px] border-black overflow-hidden bg-zinc-800 shadow-xl">
                <OptimizedImage
                  src={wargaPhotos[0].url}
                  alt="Story warga"
                  className="w-full h-full transform group-hover:scale-110 transition-transform duration-500"
                />
              </div>

              {/* Badge LIVE */}
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-rose-600 text-[8px] font-black text-white px-2 py-0.5 rounded-full border border-black shadow-lg uppercase tracking-tighter pointer-events-none whitespace-nowrap">
                LIVE
              </div>

              {/* Badge jumlah */}
              {wargaPhotos.length > 1 && (
                <div className="absolute -top-1 -right-1 bg-cyan-500 text-[8px] font-black text-white w-4 h-4 rounded-full border border-black flex items-center justify-center pointer-events-none">
                  {wargaPhotos.length > 9 ? '9+' : wargaPhotos.length}
                </div>
              )}
            </motion.div>
          )}

          {/* Tombol Upload */}
          <div className="relative">
            <Uploader tempatId={tempatId} namaTempat={namaTempat} onUploadSuccess={handleNewUpload} />
            <div className="absolute inset-0 bg-cyan-500/20 blur-xl -z-10 rounded-full pointer-events-none" />
          </div>
        </div>

        {/* ── INDIKATOR TITIK (bawah) ────────────────────────────────────── */}
        {adminPhotos.length > 1 && (
          <div className="absolute bottom-5 left-0 right-0 flex justify-center gap-1.5 z-10 pointer-events-none">
            {adminPhotos.map((_, idx) => (
              <div
                key={idx}
                className={`h-1 rounded-full transition-all duration-300 ${idx === selectedPhotoIndex ? "w-6 bg-white" : "w-1.5 bg-white/20"
                  }`}
              />
            ))}
          </div>
        )}
      </div>
      {/* END CONTAINER UTAMA */}

      {/*
        STORY MODAL via PORTAL — di-render ke document.body.
        Ini memastikan modal tidak terpotong oleh overflow-hidden manapun.
      */}
      <ModalPortal>
        <AnimatePresence>
          {isStoryOpen && (
            <StoryModal
              isOpen={isStoryOpen}
              onClose={() => setIsStoryOpen(false)}
              stories={wargaPhotos}
              theme={theme}
            />
          )}
        </AnimatePresence>
      </ModalPortal>

      <style jsx global>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 4s linear infinite;
        }
      `}</style>
    </>
  );
}
