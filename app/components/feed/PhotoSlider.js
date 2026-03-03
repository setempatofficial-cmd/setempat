"use client";

import { useState } from "react";

export default function PhotoSlider({
  photos,
  itemId,
  selectedPhotoIndex,
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
    <div
      className="relative h-80 mb-2 overflow-hidden rounded-xl"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <img
        src={typeof photos[selectedPhotoIndex] === 'string'
          ? photos[selectedPhotoIndex]
          : photos[selectedPhotoIndex]?.url}
        alt={`Slide ${selectedPhotoIndex + 1}`}
        className="object-cover w-full h-full"
      />
      
      {/* BADGE */}
      <div className="absolute top-2 left-0 flex flex-col gap-1 z-20 max-w-[90%]">
        {(() => {
          const badges = [];
          if (isViral) badges.push({ label: '⚡ Sedang Viral', color: 'bg-purple-500' });
          else if (isRamai) badges.push({ label: '🔥 Lagi Ramai', color: 'bg-red-500' });
          else if (isHits) badges.push({ label: '📱 Hits Jam Ini', color: 'bg-orange-500' });

          if (isDekat && badges.length < 2) {
            badges.push({ label: '📍 Di Dekat Anda', color: 'bg-blue-500' });
          }

          if (isBaru && badges.length < 2) {
            badges.push({ label: '🟢 Baru Saja', color: 'bg-green-400' });
          }

          return badges.map((badge, idx) => (
            <span key={idx} className={`pl-2 pr-3 py-1 text-[10px] font-bold text-white ${badge.color} rounded-r-full shadow-lg truncate`}>
              {badge.label}
            </span>
          ));
        })()}
      </div>

      {/* DOTS */}
      {photos.length > 1 && (
        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
          {photos.map((_, idx) => (
            <div
              key={idx}
              className={`h-1.5 rounded-full transition-all ${idx === selectedPhotoIndex
                ? "w-4 bg-[#E3655B]"
                : "w-1.5 bg-white/70"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}