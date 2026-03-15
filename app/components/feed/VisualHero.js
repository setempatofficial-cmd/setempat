"use client";
import PhotoSlider from "./PhotoSlider";

export default function VisualHero({ item, theme, selectedPhotoIndex, setSelectedPhotoIndex }) {
  const currentIdx = selectedPhotoIndex?.[item.id] || 0;
  const photos = item?.photos || [];

  return (
    <div className="relative group">
      {/* Aspect 21:9 untuk kesan Wide/Radar */}
      <div className="relative aspect-[21/9] w-full overflow-hidden rounded-[20px] bg-zinc-100 shadow-inner">
        <PhotoSlider 
          photos={photos}
          selectedPhotoIndex={currentIdx}
          setSelectedPhotoIndex={(idx) => setSelectedPhotoIndex?.((prev) => ({ ...prev, [item.id]: idx }))}
        />
        
        {/* Subtle Dark Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
        
        {/* Photo Counter */}
        {photos.length > 1 && (
          <div className="absolute bottom-2 right-3 flex gap-1">
            {photos.map((_, i) => (
              <div key={i} className={`h-1 rounded-full transition-all ${i === currentIdx ? 'w-3 bg-white' : 'w-1 bg-white/40'}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}