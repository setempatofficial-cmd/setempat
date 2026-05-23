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
  preload = "auto",        // ✅ TAMBAH: control preload
  isActive = true,         // ✅ TAMBAH: status aktif
  hideSpinner = false,     // ✅ TAMBAH: hide loading indicator
  onLoad,
  onError
}) {
  const [isPlaying, setIsPlaying] = useState(autoPlay && isActive);
  const [isMuted, setIsMuted] = useState(muted);
  const [isLoaded, setIsLoaded] = useState(false);
  const videoRef = useRef(null);

  // ✅ CLEANUP: Pause video saat tidak aktif
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!isActive) {
      // Pause video yang tidak aktif
      video.pause();
      setIsPlaying(false);

      // 🔥 OPTIONAL: Kosongkan source untuk free memory (kalo memory kritis)
      // Hanya aktifkan jika benar2 perlu, karena akan reload ulang nanti
      if (preload === "none" && !isActive) {
        // video.src = "";
        // video.load();
      }
    }
  }, [isActive, preload]);

  // ✅ Auto-play HANYA jika aktif
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (autoPlay && isActive && !isPlaying) {
      video.play()
        .then(() => setIsPlaying(true))
        .catch(e => console.log("Auto-play prevented:", e));
    } else if (!isActive && isPlaying) {
      video.pause();
      setIsPlaying(false);
    }
  }, [autoPlay, isActive, isPlaying]);

  // ✅ Reset loaded state saat src berubah
  useEffect(() => {
    setIsLoaded(false);
  }, [src]);

  const togglePlay = () => {
    if (!videoRef.current || !isActive) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
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

  // ✅ Tentukan preload value berdasarkan props
  const getPreloadValue = () => {
    if (preload !== "auto") return preload;
    return isActive ? "auto" : "none";
  };

  return (
    <div className="relative w-full h-full group">
      <video
        ref={videoRef}
        src={src}
        className={className}
        autoPlay={autoPlay && isActive}  // ✅ Hanya autoplay kalo aktif
        loop={loop}
        muted={muted}
        playsInline={playsInline}
        preload={getPreloadValue()}       // ✅ Dynamic preload
        onLoadedData={handleLoadedData}
        onError={onError}
      />

      {/* Controls overlay - muncul saat hover atau jika showControls true */}
      {showControls && isActive && (  // ✅ Hanya tampil kalo aktif
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

      {/* Loading indicator - bisa dihide via prop */}
      {!isLoaded && !hideSpinner && isActive && (  // ✅ Hanya tampil kalo aktif
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}