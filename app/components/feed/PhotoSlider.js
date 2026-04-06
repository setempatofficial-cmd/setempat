"use client";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Zap, ChevronLeft, ChevronRight } from "lucide-react";
import Uploader from "@/components/Uploader";
import UploaderAdmin from "@/components/UploaderAdmin";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabaseClient";
import { useClock } from "@/hooks/useClock";
import OptimizedMedia from "@/components/OptimizedMedia";

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

// Fungsi untuk menormalisasi foto official
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
  priority = false, // 🔥 NEW: card pertama langsung load
}) {
  const { user } = useAuth();
  const router = useRouter();
  const { timeLabel: currentTimeLabel } = useClock();
  const [officialPhotos, setOfficialPhotos] = useState({ pagi: [], siang: [], sore: [], malam: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [shouldLoad, setShouldLoad] = useState(priority); // 🔥 NEW
  const sliderRef = useRef(null); // 🔥 NEW
  
  const currentTimeKey = useMemo(() => getTimeKeyFromLabel(currentTimeLabel), [currentTimeLabel]);
  
  useEffect(() => {
    setCurrentPhotoIndex(0);
  }, [currentTimeKey]);

  // 🔥 INTERSECTION OBSERVER
  useEffect(() => {
    if (priority) {
      setShouldLoad(true);
      return;
    }
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !shouldLoad) {
            setShouldLoad(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "300px" }
    );
    
    if (sliderRef.current) observer.observe(sliderRef.current);
    return () => {
      if (sliderRef.current) observer.unobserve(sliderRef.current);
    };
  }, [priority, shouldLoad]);

  const hasControl = useMemo(() => {
    const emailTarget = "setempatofficial@gmail.com";
    return user?.email?.toLowerCase().trim() === emailTarget;
  }, [user]);

  const fetchOfficialPhotos = useCallback(async () => {
    if (!tempatId || !shouldLoad) return;
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
  }, [tempatId, shouldLoad]);

  useEffect(() => {
    if (!shouldLoad) return;
    setIsLoading(true);
    fetchOfficialPhotos();
  }, [fetchOfficialPhotos, refreshKey, shouldLoad]);

  useEffect(() => {
    if (!tempatId || !shouldLoad) return;
    
    const channel = supabase
      .channel(`tempat_${tempatId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tempat',
        filter: `id=eq.${tempatId}`
      }, (payload) => {
        if (payload.new?.photos) {
          const normalized = normalizeOfficialPhotos(payload.new.photos);
          setOfficialPhotos(normalized);
        }
      })
      .subscribe();
    
    return () => supabase.removeChannel(channel);
  }, [tempatId, shouldLoad]);

  const handleUploadSuccess = useCallback((newPhoto) => {
    setRefreshKey(prev => prev + 1);
    onUploadSuccess?.(newPhoto);
  }, [onUploadSuccess]);

  const currentPhotos = useMemo(() => {
    if (!shouldLoad) return [];
    
    if (photos.length > 0) {
      const freshWargaPhotos = photos.filter(p => {
        const createdAt = p.created_at || p.timestamp;
        if (!createdAt) return true;
        return (Date.now() - new Date(createdAt)) < 24 * 60 * 60 * 1000;
      });
      if (freshWargaPhotos.length > 0) {
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
    
    const timePhotos = officialPhotos[currentTimeKey];
    if (timePhotos && Array.isArray(timePhotos) && timePhotos.length > 0) {
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
    
    return [];
  }, [photos, officialPhotos, currentTimeKey, shouldLoad]);

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

  // 🔥 SKELETON saat belum waktunya load
  if (!shouldLoad) {
    return (
      <div ref={sliderRef} className="relative h-full w-full rounded-[30px] bg-zinc-800/50 animate-pulse flex items-center justify-center">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-zinc-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-[8px] text-zinc-500">Mempersiapkan...</p>
        </div>
      </div>
    );
  }

  if (isLoading) return (
    <div ref={sliderRef} className="relative h-full w-full rounded-[30px] bg-zinc-900 animate-pulse flex items-center justify-center">
      <Zap className="text-zinc-700" size={18} />
    </div>
  );

  return (
    <div ref={sliderRef} className="relative h-full w-full overflow-hidden bg-zinc-950 rounded-[30px] shadow-2xl border border-white/5">
      <div className="absolute inset-0 z-0">
        {currentPhoto?.url ? (
          <>
            <OptimizedMedia 
              src={currentPhoto.url} 
              className="w-full h-full" 
              alt={namaTempat}
              autoPlay={true}
              muted={true}
              loop={true}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-transparent opacity-60" />
            {currentPhoto.caption && (
  <div className="absolute bottom-3 right-3 z-10 max-w-[80%]">
    <p className="
      text-white 
      text-[10px] 
      tracking-wide
      font-medium 
      bg-white/10 
      backdrop-blur-md 
      border border-white/20
      px-2.5 
      py-1 
      rounded-full 
      shadow-sm
      inline-block
    ">
      {currentPhoto.caption}
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900/50 backdrop-blur-sm">
            <MapPin className="text-zinc-700 mb-2" size={24} />
            <p className="text-[9px] uppercase tracking-[0.3em] text-zinc-500 font-bold italic">
              Hasil Pantuan AI Setempat
            </p>
          </div>
        )}
      </div>

      {hasMultiplePhotos && currentPhoto?.url && (
        <>
          <button onClick={prevPhoto} className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/70 transition-all">
            <ChevronLeft size={16} />
          </button>
          <button onClick={nextPhoto} className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/70 transition-all">
            <ChevronRight size={16} />
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
            {currentPhotos.map((_, idx) => (
              <button key={idx} onClick={() => setCurrentPhotoIndex(idx)} className={`w-1.5 h-1.5 rounded-full transition-all ${idx === currentPhotoIndex ? 'bg-white w-3' : 'bg-white/50'}`} />
            ))}
          </div>
        </>
      )}

      {!hasControl && (
        <div className="absolute top-4 left-4 z-20">
          <Uploader tempatId={tempatId} namaTempat={namaTempat} onUploadSuccess={handleUploadSuccess} />
        </div>
      )}

      {hasControl && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-1">
            <UploaderAdmin tempatId={tempatId} timeLabel={timeLabel} onRefreshNeeded={() => { setRefreshKey(prev => prev + 1); router.refresh(); }} />
          </div>
        </div>
      )}

      {isHujan && <div className="absolute inset-0 pointer-events-none z-[5] bg-blue-500/5 mix-blend-overlay animate-pulse" />}
      <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
    </div>
  );
}