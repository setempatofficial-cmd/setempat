"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Zap, ChevronLeft, ChevronRight } from "lucide-react";
import Uploader from "@/components/Uploader";
import UploaderAdmin from "@/components/UploaderAdmin";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabaseClient";
import { useClock } from "@/hooks/useClock";

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

// Helper untuk mendapatkan timeKey berdasarkan label waktu
const getTimeKeyFromLabel = (timeLabel) => {
  const label = timeLabel?.toLowerCase();
  if (label === 'pagi') return 'pagi';
  if (label === 'siang') return 'siang';
  if (label === 'sore') return 'sore';
  if (label === 'malam') return 'malam';
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return 'pagi';
  if (hour >= 11 && hour < 15) return 'siang';
  if (hour >= 15 && hour < 18) return 'sore';
  return 'malam';
};

// Fungsi untuk menormalisasi foto official (mendukung array dan objek)
const normalizeOfficialPhotos = (photos) => {
  if (!photos) return { pagi: [], siang: [], sore: [], malam: [] };
  
  const result = { pagi: [], siang: [], sore: [], malam: [] };
  const timeKeys = ['pagi', 'siang', 'sore', 'malam'];
  
  timeKeys.forEach(key => {
    const data = photos[key];
    if (data) {
      if (Array.isArray(data)) {
        result[key] = data;
      } else if (typeof data === 'object' && data.url) {
        result[key] = [data];
      }
    }
  });
  
  return result;
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
  const { timeLabel: currentTimeLabel } = useClock();
  const [officialPhotos, setOfficialPhotos] = useState({ pagi: [], siang: [], sore: [], malam: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  
  // 🔥 Dapatkan timeKey dari label waktu
  const currentTimeKey = useMemo(() => {
    return getTimeKeyFromLabel(currentTimeLabel);
  }, [currentTimeLabel]);
  
  // Reset index saat waktu berubah
  useEffect(() => {
    setCurrentPhotoIndex(0);
  }, [currentTimeKey]);

  // CEK AKSES ADMIN
  const hasControl = useMemo(() => {
    const emailTarget = "setempatofficial@gmail.com";
    return user?.email?.toLowerCase().trim() === emailTarget;
  }, [user]);

  // FETCH DATA OFFICIAL PHOTOS
  const fetchOfficialPhotos = useCallback(async () => {
    if (!tempatId) return;
    try {
      const { data, error } = await supabase
        .from("tempat")
        .select("photos")
        .eq("id", tempatId)
        .single();
      if (!error && data?.photos) {
        const normalized = normalizeOfficialPhotos(data.photos);
        setOfficialPhotos(normalized);
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [tempatId]);

  useEffect(() => {
    setIsLoading(true);
    fetchOfficialPhotos();
  }, [fetchOfficialPhotos, refreshKey]);

  // 🔥 REAL-TIME: Subscribe ke perubahan tabel tempat
  useEffect(() => {
    if (!tempatId) return;
    
    const channel = supabase
      .channel(`tempat_${tempatId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tempat',
          filter: `id=eq.${tempatId}`
        },
        (payload) => {
          // Refresh foto saat ada update
          if (payload.new?.photos) {
            const normalized = normalizeOfficialPhotos(payload.new.photos);
            setOfficialPhotos(normalized);
          }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tempatId]);

  // 🔥 Handler untuk refresh setelah upload
  const handleUploadSuccess = useCallback((newPhoto) => {
    // Trigger refresh official photos
    setRefreshKey(prev => prev + 1);
    // Panggil callback parent jika ada
    onUploadSuccess?.(newPhoto);
  }, [onUploadSuccess]);

  // 🔥 Dapatkan daftar foto berdasarkan waktu saat ini (TANPA FALLBACK)
  const currentPhotos = useMemo(() => {
    // PRIORITAS 1: Foto warga (story) fresh < 24 jam
    if (photos.length > 0) {
      const freshWargaPhotos = photos.filter(p => {
        const createdAt = p.created_at || p.timestamp;
        if (!createdAt) return true;
        return (Date.now() - new Date(createdAt)) < 24 * 60 * 60 * 1000;
      });
      if (freshWargaPhotos.length > 0) {
        // Urutkan dari terbaru
        const sorted = [...freshWargaPhotos].sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at) : 0;
          const dateB = b.created_at ? new Date(b.created_at) : 0;
          return dateB - dateA;
        });
        return sorted.map(p => ({ 
          url: p.url || p.photo_url, 
          type: 'warga', 
          caption: p.caption,
          created_at: p.created_at
        }));
      }
    }
    
    // PRIORITAS 2: Foto official sesuai waktu saat ini
    const timePhotos = officialPhotos[currentTimeKey];
    if (timePhotos && Array.isArray(timePhotos) && timePhotos.length > 0) {
      // Urutkan dari terbaru (jika ada created_at)
      const sorted = [...timePhotos].sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at) : 0;
        const dateB = b.created_at ? new Date(b.created_at) : 0;
        return dateB - dateA;
      });
      return sorted.map(p => ({ 
        url: p.url || p, 
        type: 'official', 
        caption: p.caption,
        created_at: p.created_at
      }));
    }
    
    // 🔥 TIDAK ADA FALLBACK KE official
    // Kembalikan array kosong -> tampilkan placeholder
    return [];
  }, [photos, officialPhotos, currentTimeKey]);

  // 🔥 Handler slider
  const nextPhoto = useCallback(() => {
    if (currentPhotos.length <= 1) return;
    setCurrentPhotoIndex((prev) => (prev + 1) % currentPhotos.length);
  }, [currentPhotos.length]);
  
  const prevPhoto = useCallback(() => {
    if (currentPhotos.length <= 1) return;
    setCurrentPhotoIndex((prev) => (prev - 1 + currentPhotos.length) % currentPhotos.length);
  }, [currentPhotos.length]);

  const currentPhoto = currentPhotos[currentPhotoIndex];
  const hasMultiplePhotos = currentPhotos.length > 1;

  if (isLoading) return (
    <div className="relative h-full w-full rounded-[30px] bg-zinc-900 animate-pulse flex items-center justify-center">
      <Zap className="text-zinc-700" size={18} />
    </div>
  );

  return (
    <div className="relative h-full w-full overflow-hidden bg-zinc-950 rounded-[30px] shadow-2xl border border-white/5">
      
      {/* BACKGROUND / SLIDER */}
      <div className="absolute inset-0 z-0">
        {currentPhoto?.url ? (
          <>
            <OptimizedImage src={currentPhoto.url} className="w-full h-full" alt={namaTempat} />
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-transparent opacity-60" />
            
            {/* CAPTION jika ada */}
            {currentPhoto.caption && (
              <div className="absolute bottom-4 left-4 right-4 z-10">
                <p className="text-white/80 text-xs font-medium bg-black/40 backdrop-blur-sm px-2 py-1 rounded-lg inline-block">
                  {currentPhoto.caption}
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900/50 backdrop-blur-sm">
            <MapPin className="text-zinc-700 mb-2" size={24} />
            <p className="text-[9px] uppercase tracking-[0.3em] text-zinc-500 font-bold italic">
              Belum Ada Pantauan
            </p>
          </div>
        )}
      </div>

      {/* 🔥 SLIDER NAVIGATION */}
      {hasMultiplePhotos && currentPhoto?.url && (
        <>
          <button
            onClick={prevPhoto}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/70 transition-all"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={nextPhoto}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/70 transition-all"
          >
            <ChevronRight size={16} />
          </button>
          
          {/* Indikator titik */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
            {currentPhotos.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentPhotoIndex(idx)}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  idx === currentPhotoIndex ? 'bg-white w-3' : 'bg-white/50'
                }`}
              />
            ))}
          </div>
        </>
      )}

      {/* TOMBOL UPLOAD WARGA (KIRI ATAS) */}
      {!hasControl && (
        <div className="absolute top-4 left-4 z-20">
          <Uploader 
            tempatId={tempatId} 
            namaTempat={namaTempat} 
            onUploadSuccess={handleUploadSuccess} 
          />
        </div>
      )}

      {/* TOMBOL ADMIN DI TENGAH */}
      {hasControl && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-1">
            <UploaderAdmin 
              tempatId={tempatId} 
              timeLabel={timeLabel} 
              onRefreshNeeded={() => {
                setRefreshKey(prev => prev + 1);
                router.refresh();
              }} 
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