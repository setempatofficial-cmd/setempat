// components/media/MediaRenderer.jsx
'use client';

import { isVideoUrl } from '@/utils/mediaUtils';
import VideoPlayer from './VideoPlayer';
import { optimizeVideoUrl, optimizeImageUrl } from '@/lib/cloudinary';

export default function MediaRenderer({
  url,
  className = "w-full h-full object-cover",
  hideSpinner,  // ✅ Sudah ada
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

  let finalUrl = url;
  if (isVideo && url.includes('cloudinary')) {
    finalUrl = optimizeVideoUrl(url);
  }

  if (!isVideo && url.includes('cloudinary')) {
    const options = thumbnail ? { width: 320 } : { width: 720 };
    finalUrl = optimizeImageUrl(url, options);
  }

  // ✅ Untuk video - Teruskan hideSpinner
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
        hideSpinner={hideSpinner}  // ✅ TAMBAHKAN INI
        onLoad={onLoad}
        onError={onError}
      />
    );
  }

  // Untuk gambar
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