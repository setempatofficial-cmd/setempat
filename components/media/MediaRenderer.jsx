// components/media/MediaRenderer.jsx
'use client';

import { isVideoUrl } from '@/utils/mediaUtils';
import VideoPlayer from './VideoPlayer';
import { optimizeVideoUrl, optimizeImageUrl } from '@/lib/cloudinary'; // ← TAMBAHKAN

export default function MediaRenderer({ 
  url, 
  className = "w-full h-full object-cover",
  autoPlay = false,
  muted = true,
  loop = true,
  playsInline = true,
  showVideoControls = false,
  thumbnail = false,
  onLoad,
  onError 
}) {
  if (!url) {
    return (
      <div className={`${className} bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center`}>
        <span className="text-white/30 text-sm">No media</span>
      </div>
    );
  }

  const isVideo = isVideoUrl(url);
  
  // 🔥 OPTIMASI VIDEO
  let finalUrl = url;
  if (isVideo && url.includes('cloudinary')) {
    finalUrl = optimizeVideoUrl(url);
  }
  
  // 🔥 TAMBAHKAN: OPTIMASI GAMBAR
  if (!isVideo && url.includes('cloudinary')) {
    // Untuk thumbnail, pakai ukuran lebih kecil
    const options = thumbnail ? { width: 320 } : { width: 720 };
    finalUrl = optimizeImageUrl(url, options);
  }

  // Untuk video
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
        onLoad={onLoad}
        onError={onError}
      />
    );
  }

  // 🔥 Untuk gambar (sudah dioptimasi)
  return (
    <img
      src={finalUrl}
      className={className}
      alt="Media"
      loading="lazy"
      onLoad={onLoad}
      onError={(e) => {
        e.target.src = "/placeholder-image.jpg";
        onError?.(e);
      }}
    />
  );
}