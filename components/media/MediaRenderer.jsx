// components/media/MediaRenderer.jsx
'use client';

import { useRef, useEffect } from 'react';
import { isVideoUrl } from '@/utils/mediaUtils';
import VideoPlayer from './VideoPlayer';
import { optimizeVideoUrl, optimizeImageUrl } from '@/lib/cloudinary';

export default function MediaRenderer({
  url,
  className = "w-full h-full object-cover",
  hideSpinner,
  autoPlay = false,
  muted = true,
  loop = true,
  playsInline = true,
  showVideoControls = false,
  thumbnail = false,
  preload = "auto",  // ✅ TAMBAH: preload control
  isActive = true,   // ✅ TAMBAH: apakah media sedang aktif
  onLoad,
  onError
}) {
  const imgRef = useRef(null);
  const shouldLoad = preload === "auto" ? true : isActive;

  if (!url) {
    return (
      <div className={`${className} bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center`}>
        <span className="text-white/30 text-sm">No media</span>
      </div>
    );
  }

  const isVideo = isVideoUrl(url);

  let finalUrl = url;
  if (isVideo && url.includes('cloudinary')) {
    finalUrl = optimizeVideoUrl(url);
  }

  if (!isVideo && url.includes('cloudinary')) {
    const options = thumbnail ? { width: 320 } : { width: 720 };
    finalUrl = optimizeImageUrl(url, options);
  }

  // ✅ UNTUK VIDEO - Dengan preload & cleanup
  if (isVideo) {
    return (
      <VideoPlayer
        src={finalUrl}
        className={className}
        autoPlay={autoPlay}
        muted={thumbnail ? true : muted}
        loop={thumbnail ? false : loop}
        playsInline={playsInline}
        showControls={showVideoControls}
        hideSpinner={hideSpinner}
        preload={preload}        // ✅ TAMBAH: kirim preload
        isActive={isActive}      // ✅ TAMBAH: kirim status aktif
        onLoad={onLoad}
        onError={onError}
      />
    );
  }

  // ✅ UNTUK GAMBAR - Lazy load + webp support
  return (
    <picture>
      {/* WebP version kalo ada */}
      {finalUrl.includes('cloudinary') && (
        <source
          srcSet={finalUrl.replace('/upload/', '/upload/q_auto:low,f_auto/')}
          type="image/webp"
        />
      )}
      <img
        ref={imgRef}
        src={finalUrl}
        className={className}
        alt="Media"
        loading={shouldLoad ? "eager" : "lazy"}  // ✅ Hanya eager kalo aktif
        decoding="async"
        onLoad={onLoad}
        onError={(e) => {
          e.target.src = "/placeholder-image.jpg";
          onError?.(e);
        }}
      />
    </picture>
  );
}