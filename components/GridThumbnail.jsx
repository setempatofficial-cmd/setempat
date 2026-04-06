"use client";
import { useState, useEffect } from "react";
import { Video, Wifi } from "lucide-react";

export default function GridThumbnail({ url, alt = "", className = "" }) {
  const [thumbnailUrl, setThumbnailUrl] = useState('/placeholder.jpg');
  const [mediaType, setMediaType] = useState('image');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!url) {
      setThumbnailUrl('/placeholder.jpg');
      setIsLoading(false);
      return;
    }

    const urlLower = url.toLowerCase();
    
    // Deteksi CCTV/HLS
    if (urlLower.includes('.m3u8') || urlLower.includes('cctv') || urlLower.includes('stream')) {
      setMediaType('cctv');
      setThumbnailUrl('/images/cctv-placeholder.jpg');
      setIsLoading(false);
    }
    // Deteksi Video File
    else if (urlLower.includes('.mp4') || urlLower.includes('.webm') || urlLower.includes('.mov')) {
      setMediaType('video');
      setThumbnailUrl('/images/video-placeholder.jpg');
      setIsLoading(false);
    }
    // Deteksi YouTube
    else if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
      setMediaType('youtube');
      const videoId = extractYouTubeId(url);
      if (videoId) {
        setThumbnailUrl(`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`);
      } else {
        setThumbnailUrl('/placeholder.jpg');
      }
      setIsLoading(false);
    }
    // Treat as image
    else {
      setMediaType('image');
      const img = new Image();
      img.onload = () => {
        setThumbnailUrl(url);
        setIsLoading(false);
      };
      img.onerror = () => {
        setThumbnailUrl('/placeholder.jpg');
        setIsLoading(false);
      };
      img.src = url;
    }
  }, [url]);

  if (isLoading) {
    return (
      <div className={`${className} bg-zinc-800 animate-pulse flex items-center justify-center`}>
        <div className="w-5 h-5 border-2 border-zinc-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className={`relative ${className} overflow-hidden bg-zinc-900`}>
      <img 
        src={thumbnailUrl} 
        alt={alt}
        className="w-full h-full object-cover"
      />
      
      {/* Badge untuk video/CCTV */}
      {mediaType === 'cctv' && (
        <div className="absolute top-2 left-2 bg-red-600/90 rounded-full px-1.5 py-0.5 flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
          <span className="text-[8px] text-white font-bold">LIVE</span>
        </div>
      )}
      
      {mediaType === 'video' && (
        <div className="absolute top-2 left-2 bg-blue-600/90 rounded-full px-1.5 py-0.5 flex items-center gap-1">
          <Video size={8} className="text-white" />
          <span className="text-[8px] text-white font-bold">VIDEO</span>
        </div>
      )}
      
      {mediaType === 'youtube' && (
        <div className="absolute top-2 left-2 bg-red-600/90 rounded-full px-1.5 py-0.5 flex items-center gap-1">
          <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="red">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.376.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.376-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/>
          </svg>
          <span className="text-[8px] text-white font-bold">YT</span>
        </div>
      )}
    </div>
  );
}

function extractYouTubeId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([^&?#]+)/,
    /youtube\.com\/embed\/([^/?]+)/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}