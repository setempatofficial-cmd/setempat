// components/media/MediaRenderer.jsx
'use client';

import { isVideoUrl } from '@/utils/mediaUtils';
import VideoPlayer from './VideoPlayer';

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

  // Untuk video
  if (isVideo) {
    return (
      <VideoPlayer
        src={url}
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

  // Untuk gambar
  return (
    <img
      src={url}
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