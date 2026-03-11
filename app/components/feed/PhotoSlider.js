"use client";

import { useState } from "react";

export default function PhotoSlider({
  photos = [],
  itemId,
  selectedPhotoIndex = 0,
  setSelectedPhotoIndex,
  isRamai,
  isViral,
  isHits,
  isDekat,
  isBaru,
}) {
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe || isRightSwipe) {
      const photosLength = photos.length;
      let newIndex = selectedPhotoIndex;

      if (isLeftSwipe) {
        newIndex = (selectedPhotoIndex + 1) % photosLength;
      } else if (isRightSwipe) {
        newIndex = (selectedPhotoIndex - 1 + photosLength) % photosLength;
      }

      setSelectedPhotoIndex((prev) => ({
        ...prev,
        [itemId]: newIndex,
      }));
    }
  };

  return (
    /* KUNCI PERBAIKAN: isolate dan z-0 memastikan semua isi slider 
       terkunci di lapisan bawah dan tidak akan menembus LaporanWarga */
    <div
      className="relative h-80 overflow-hidden rounded-[24px] bg-gray-100 group isolate z-0"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* 1. META CAPTION & BADGES OVERLAY */}
      <div className="absolute top-3 left-0 right-3 z-10 flex justify-between items-start pointer-events-none">
        <div className="flex flex-col gap-1.5 items-start">
          {(() => {
            const badges = [];
            if (isViral) badges.push({ label: '⚡ Sedang Viral', color: 'bg-purple-600/90' });
            else if (isRamai) badges.push({ label: '🔥 Lagi Ramai', color: 'bg-red-600/90' });
            else if (isHits) badges.push({ label: '📱 Hits Jam Ini', color: 'bg-orange-600/90' });

            if (isDekat && badges.length < 2) {
              badges.push({ label: '📍 Dekat Anda', color: 'bg-blue-600/90' });
            }

            if (isBaru && badges.length < 2) {
              badges.push({ label: '🟢 Baru Saja', color: 'bg-emerald-500/90' });
            }

            return badges.map((badge, idx) => (
              <span 
                key={idx} 
                className={`pl-3 pr-4 py-1.5 text-[10px] font-black text-white ${badge.color} backdrop-blur-md rounded-r-full shadow-lg transition-transform duration-500 hover:translate-x-1 uppercase tracking-wider`}
              >
                {badge.label}
              </span>
            ));
          })()}
        </div>

        {/* 2. SLIDE COUNTER (ANGKA TETAP ADA DI SINI) */}
        {photos.length > 1 && (
          <div className="bg-black/30 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1.5 rounded-full border border-white/10">
            {selectedPhotoIndex + 1} / {photos.length}
          </div>
        )}
      </div>

      {/* 3. FOTO CONTAINER */}
      <div 
        className="flex h-full transition-transform duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]"
        style={{ transform: `translateX(-${selectedPhotoIndex * 100}%)` }}
      >
        {photos.map((photo, idx) => (
          <div key={idx} className="min-w-full h-full relative">
            <img
              src={typeof photo === 'string' ? photo : photo?.url}
              alt={`Slide ${idx + 1}`}
              className="object-cover w-full h-full transition-transform duration-[2s] group-hover:scale-110"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60 pointer-events-none" />
          </div>
        ))}
      </div>
      
      {/* 4. MODERN DOTS INDICATOR (TITIK-TITIK TETAP ADA) */}
      {photos.length > 1 && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-10">
          {photos.map((_, idx) => (
            <div
              key={idx}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === selectedPhotoIndex
                ? "w-6 bg-white" 
                : "w-1.5 bg-white/50"
              }`}
            />
          ))}
        </div>
      )}

      {/* 5. HINT VISUAL (PANAH PETUNJUK TETAP ADA) */}
      {photos.length > 1 && selectedPhotoIndex === 0 && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 animate-bounce-x p-2 pointer-events-none opacity-50 z-10">
          <svg width="20" height="20" fill="white" viewBox="0 0 256 256"><path d="M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z"></path></svg>
        </div>
      )}
    </div>
  );
}