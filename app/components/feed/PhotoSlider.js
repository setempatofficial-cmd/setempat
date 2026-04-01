"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Zap } from "lucide-react";
import Uploader from "@/components/Uploader";
import UploaderAdmin from "@/components/UploaderAdmin";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabaseClient";

// ── KOMPONEN GAMBAR OPTIMAL ──
const OptimizedImage = ({ src, alt, className }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  if (!src) return <div className={`${className} bg-zinc-900`} />;
  
  return (
    <div className="relative w-full h-full overflow-hidden">
      {!isLoaded && <div className="absolute inset-0 bg-zinc-800 animate-pulse" />}
      <img
        src={src}
        alt={alt}
        className={`${className} ${isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'} transition-all duration-700 ease-out`}
        style={{ objectFit: 'cover' }}
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
      />
    </div>
  );
};

export default function PhotoSlider({
  photos = [],
  timeLabel = "Waktu",
  tempatId,
  namaTempat = "",
  isHujan = false,
  onUploadSuccess,
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [officialPhotos, setOfficialPhotos] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  // CEK AKSES ADMIN
  const hasControl = useMemo(() => {
    const emailTarget = "setempatofficial@gmail.com";
    return user?.email?.toLowerCase().trim() === emailTarget;
  }, [user]);

  // FETCH DATA OFFICIAL PHOTOS
  useEffect(() => {
    if (!tempatId) return;
    let isMounted = true;
    const fetchPhotos = async () => {
      try {
        const { data, error } = await supabase.from("tempat").select("photos").eq("id", tempatId).single();
        if (!error && isMounted && data?.photos) setOfficialPhotos(data.photos);
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchPhotos();
    return () => { isMounted = false; };
  }, [tempatId]);

  // LOGIKA FOTO AKTIF
  const displayPhoto = useMemo(() => {
    if (photos.length > 0) return photos[0].url;
    const jam = new Date().getHours();
    const timeKey = (jam >= 5 && jam < 11) ? "pagi" : (jam >= 11 && jam < 15) ? "siang" : (jam >= 15 && jam < 18) ? "sore" : "malam";
    const photoData = officialPhotos[timeKey];
    return (typeof photoData === 'object' ? photoData?.url : photoData) || officialPhotos.official || null;
  }, [photos, officialPhotos]);

  if (isLoading) return (
    <div className="relative h-full w-full rounded-[30px] bg-zinc-900 animate-pulse flex items-center justify-center">
      <Zap className="text-zinc-700" size={18} />
    </div>
  );

  return (
    <div className="relative h-full w-full overflow-hidden bg-zinc-950 rounded-[30px] shadow-2xl border border-white/5">
      
      {/* BACKGROUND */}
      <div className="absolute inset-0 z-0">
        {displayPhoto ? (
          <>
            <OptimizedImage src={displayPhoto} className="w-full h-full" alt={namaTempat} />
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-transparent opacity-60" />
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900/50 backdrop-blur-sm">
            <MapPin className="text-zinc-700 mb-2" size={24} />
            <p className="text-[9px] uppercase tracking-[0.3em] text-zinc-500 font-bold italic">Belum Ada Pantauan</p>
          </div>
        )}
      </div>

      {/* TOMBOL UPLOAD WARGA (KIRI ATAS) */}
      {!hasControl && (
        <div className="absolute top-4 left-4 z-20">
          <Uploader 
            tempatId={tempatId} 
            namaTempat={namaTempat} 
            onUploadSuccess={onUploadSuccess} 
          />
        </div>
      )}

      {/* 🔥 TOMBOL SUPERADMIN DI TENGAH - LANGSUNG RENDER UPLOADERADMIN */}
      {hasControl && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-1">
            <UploaderAdmin 
              tempatId={tempatId} 
              timeLabel={timeLabel} 
              onRefreshNeeded={() => router.refresh()} 
            />
          </div>
        </div>
      )}

      {/* HUJAN EFFECT */}
      {isHujan && (
        <div className="absolute inset-0 pointer-events-none z-[5] bg-blue-500/5 mix-blend-overlay animate-pulse" />
      )}
      
      {/* Shadow bawah */}
      <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />

    </div>
  );
}