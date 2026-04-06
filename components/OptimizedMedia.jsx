"use client";
import { useState, useMemo, useRef, useEffect } from "react";

// Deteksi tipe media dari URL
const getMediaType = (url) => {
  if (!url) return 'unknown';
  
  const urlLower = url.toLowerCase();
  
  // CCTV / HLS Stream
  if (urlLower.includes('.m3u8') || urlLower.includes('cctv') || urlLower.includes('stream')) {
    return 'cctv';
  }
  
  // YouTube
  if (urlLower.includes('youtube.com/watch') || urlLower.includes('youtu.be/')) {
    return 'youtube';
  }
  
  // YouTube Shorts
  if (urlLower.includes('youtube.com/shorts/')) {
    return 'youtube_shorts';
  }
  
  // Vimeo
  if (urlLower.includes('vimeo.com/')) {
    return 'vimeo';
  }
  
  // File video langsung
  const videoExtensions = ['.mp4', '.webm', '.mov', '.ogg', '.m3u8', '.mkv'];
  if (videoExtensions.some(ext => urlLower.includes(ext))) {
    return 'video_file';
  }
  
  // Gambar
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];
  if (imageExtensions.some(ext => urlLower.includes(ext))) {
    return 'image';
  }
  
  return 'image';
};

// Extract YouTube ID
const getYouTubeId = (url) => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([^&?#]+)/,
    /youtube\.com\/embed\/([^/?]+)/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

export default function OptimizedMedia({ 
  src, 
  alt = "", 
  className = "",
  autoPlay = true,
  muted = true,
  loop = true,
  controls = false,
  onLoad,
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isCCTVConnected, setIsCCTVConnected] = useState(true);
  const videoRef = useRef(null);
  
  const mediaInfo = useMemo(() => {
    const type = getMediaType(src);
    const youtubeId = getYouTubeId(src);
    return { type, youtubeId };
  }, [src]);
  
  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };
  
  // CCTV Error handler
  const handleCCTVError = () => {
    setIsCCTVConnected(false);
    setIsError(true);
  };
  
  // Jika error atau tidak ada src
  if (!src || isError) {
    return (
      <div className={`${className} bg-zinc-900 flex items-center justify-center`}>
        <div className="text-center">
          <svg className="w-8 h-8 text-zinc-700 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-[9px] text-zinc-500">Media tidak tersedia</p>
        </div>
      </div>
    );
  }
  
  // ──────────────────── CCTV / HLS STREAM ────────────────────
  if (mediaInfo.type === 'cctv') {
    return (
      <div className="relative w-full h-full overflow-hidden bg-black">
        {!isLoaded && (
          <div className="absolute inset-0 bg-zinc-800 animate-pulse flex items-center justify-center z-10">
            <div className="text-center">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-[9px] text-zinc-400">Menghubungkan CCTV...</p>
            </div>
          </div>
        )}
        
        {/* LIVE Badge */}
        {isCCTVConnected && isLoaded && (
          <div className="absolute top-3 left-3 z-20 bg-black/60 backdrop-blur-sm rounded-full px-2 py-1">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[9px] text-white font-medium">LIVE CCTV</span>
            </div>
          </div>
        )}
        
        <video
          ref={videoRef}
          src={src}
          className={`w-full h-full ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-500`}
          autoPlay={autoPlay}
          muted={muted}
          loop={loop}
          playsInline
          onLoadedData={() => {
            setIsLoaded(true);
            setIsCCTVConnected(true);
            handleLoad();
          }}
          onError={handleCCTVError}
          style={{ objectFit: 'cover' }}
        />
      </div>
    );
  }
  
  // ──────────────────── YOUTUBE ────────────────────
  if (mediaInfo.type === 'youtube' || mediaInfo.type === 'youtube_shorts') {
    const videoId = mediaInfo.youtubeId;
    if (!videoId) return <div className={className} />;
    
    const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=${autoPlay ? 1 : 0}&mute=${muted ? 1 : 0}&loop=${loop ? 1 : 0}&controls=${controls ? 1 : 0}&playlist=${videoId}&modestbranding=1&rel=0`;
    
    return (
      <div className="relative w-full h-full overflow-hidden">
        {!isLoaded && <div className="absolute inset-0 bg-zinc-800 animate-pulse" />}
        <iframe
          src={embedUrl}
          className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-500`}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          frameBorder="0"
          onLoad={handleLoad}
          title={alt}
        />
      </div>
    );
  }
  
  // ──────────────────── VIDEO FILE ────────────────────
  if (mediaInfo.type === 'video_file') {
    return (
      <div className="relative w-full h-full overflow-hidden">
        {!isLoaded && <div className="absolute inset-0 bg-zinc-800 animate-pulse" />}
        <video
          src={src}
          className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-500`}
          autoPlay={autoPlay}
          muted={muted}
          loop={loop}
          controls={controls}
          playsInline
          onLoadedData={handleLoad}
          onError={() => setIsError(true)}
          style={{ objectFit: 'cover' }}
        />
      </div>
    );
  }
  
  // ──────────────────── IMAGE ────────────────────
  return (
    <div className="relative w-full h-full overflow-hidden">
      {!isLoaded && <div className="absolute inset-0 bg-zinc-800 animate-pulse" />}
      <img
        src={src}
        alt={alt}
        className={`${className} ${isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'} transition-all duration-700 ease-out`}
        style={{ objectFit: 'cover' }}
        loading="lazy"
        onLoad={handleLoad}
        onError={() => setIsError(true)}
      />
    </div>
  );
}