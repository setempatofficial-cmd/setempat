// components/media/VideoPlayer.jsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

export default function VideoPlayer({ 
  src, 
  className = "w-full h-full object-cover",
  autoPlay = false,
  loop = true,
  muted = true,
  playsInline = true,
  showControls = false,
  onLoad,
  onError
}) {
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(muted);
  const [isLoaded, setIsLoaded] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && autoPlay) {
      videoRef.current.play().catch(e => console.log("Auto-play prevented:", e));
    }
  }, [autoPlay]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleLoadedData = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  return (
    <div className="relative w-full h-full group">
      <video
        ref={videoRef}
        src={src}
        className={className}
        autoPlay={autoPlay}
        loop={loop}
        muted={muted}
        playsInline={playsInline}
        onLoadedData={handleLoadedData}
        onError={onError}
      />
      
      {/* Controls overlay - muncul saat hover atau jika showControls true */}
      {showControls && (
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-3">
            <button 
              onClick={togglePlay}
              className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition"
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <button 
              onClick={toggleMute}
              className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition"
            >
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
          </div>
        </div>
      )}
      
      {/* Loading indicator */}
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}