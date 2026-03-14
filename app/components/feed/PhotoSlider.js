"use client";
import { useState } from "react";

export default function PhotoSlider({
  photos = [],
  selectedPhotoIndex = 0,
  setSelectedPhotoIndex,
  isHujan,
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
      if (photosLength <= 1) return;

      let newIndex = selectedPhotoIndex;
      if (isLeftSwipe) {
        newIndex = (selectedPhotoIndex + 1) % photosLength;
      } else if (isRightSwipe) {
        newIndex = (selectedPhotoIndex - 1 + photosLength) % photosLength;
      }
      setSelectedPhotoIndex(newIndex);
    }
  };

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-zinc-800 group isolate z-0"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* 1. FOTO CONTAINER - Ditambahkan w-full dan flex-shrink-0 untuk presisi */}
      <div 
        className="flex h-full transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]"
        style={{ transform: `translate3d(-${selectedPhotoIndex * 100}%, 0, 0)` }}
      >
        {photos.map((photo, idx) => (
          <div key={idx} className="w-full h-full flex-shrink-0 relative">
            <img
              src={typeof photo === 'string' ? photo : photo?.url}
              alt={`Slide ${idx + 1}`}
              className={`object-cover w-full h-full transition-transform duration-[5s] group-hover:scale-105 ${isHujan ? 'brightness-75' : ''}`}
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-transparent opacity-40 pointer-events-none" />
          </div>
        ))}
      </div>
      
      {/* 2. DOTS INDICATOR */}
      {photos.length > 1 && (
        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 z-10 pointer-events-none">
          {photos.map((_, idx) => (
            <div
              key={idx}
              className={`h-1 rounded-full transition-all duration-300 ${
                idx === selectedPhotoIndex ? "w-6 bg-white" : "w-1.5 bg-white/40"
              }`}
            />
          ))}
        </div>
      )}

      {/* 3. HINT SWIPE */}
      {photos.length > 1 && selectedPhotoIndex === 0 && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 animate-pulse p-2 pointer-events-none opacity-30 z-10">
          <svg width="24" height="24" fill="white" viewBox="0 0 256 256">
            <path d="M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z"></path>
          </svg>
        </div>
      )}
    </div>
  );
}