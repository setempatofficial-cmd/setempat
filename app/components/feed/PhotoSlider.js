"use client";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { MapPin, Zap, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getIndonesianTimeLabel } from "@/utils/timeUtils";
import OptimizedMedia from "@/components/OptimizedMedia";

// Normalisasi foto official
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

// ========== HOOK UNTUK TIME KEY (OPTIMIZED - UPDATE PER JAM) ==========
const useTimeKey = () => {
  const [timeKey, setTimeKey] = useState(() => {
    const label = getIndonesianTimeLabel();
    return label.toLowerCase();
  });

  useEffect(() => {
    // Update hanya ketika pergantian waktu (Pagi/Siang/Sore/Malam)
    let timeoutId = null;
    
    const scheduleNextCheck = () => {
      const now = new Date();
      const hour = now.getHours();
      
      // Tentukan kapan waktu berikutnya berganti
      let nextChangeHour = 10; // Siang
      let nextChangeLabel = "Siang";
      
      if (hour < 10) {
        nextChangeHour = 10;
        nextChangeLabel = "Siang";
      } else if (hour < 14) {
        nextChangeHour = 14;
        nextChangeLabel = "Sore";
      } else if (hour < 18) {
        nextChangeHour = 18;
        nextChangeLabel = "Malam";
      } else {
        nextChangeHour = 4;
        nextChangeLabel = "Pagi";
      }
      
      const nextChange = new Date(now);
      if (nextChangeHour < hour) {
        nextChange.setDate(nextChange.getDate() + 1);
      }
      nextChange.setHours(nextChangeHour, 0, 0, 0);
      
      const delay = nextChange.getTime() - now.getTime();
      
      timeoutId = setTimeout(() => {
        const newLabel = getIndonesianTimeLabel().toLowerCase();
        setTimeKey(prev => prev !== newLabel ? newLabel : prev);
        scheduleNextCheck(); // Schedule next change
      }, delay);
    };
    
    scheduleNextCheck();
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);
  
  return timeKey;
};

// ========== PRELOAD IMAGE (UNTUK LCP) ==========
const preloadImage = (url, priority = false) => {
  if (!url || !priority) return;
  if (typeof window === 'undefined') return;
  
  const existingLink = document.querySelector(`link[rel="preload"][as="image"][href="${url}"]`);
  if (!existingLink) {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = url;
    link.fetchPriority = 'high';
    document.head.appendChild(link);
  }
};

export default function PhotoSlider({
  photos = [],
  tempatId,
  namaTempat = "",
  isHujan = false,
  onUploadSuccess,
  priority = false,
  setSelectedPhotoIndex,
  selectedPhotoIndex,
}) {
  // OPTIMIZED: Gunakan useTimeKey instead of useClock
  const currentTimeKey = useTimeKey();
  
  const [officialPhotos, setOfficialPhotos] = useState({ pagi: [], siang: [], sore: [], malam: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(() => selectedPhotoIndex || 0);
  const [shouldLoad, setShouldLoad] = useState(priority);
  const [isPreloaded, setIsPreloaded] = useState(false);
  const sliderRef = useRef(null);
  const preloadDoneRef = useRef(false);
  
  // Sync with parent if needed
  useEffect(() => {
    if (selectedPhotoIndex !== undefined && selectedPhotoIndex !== currentPhotoIndex) {
      setCurrentPhotoIndex(selectedPhotoIndex);
    }
  }, [selectedPhotoIndex]);
  
  useEffect(() => {
    if (setSelectedPhotoIndex) {
      setSelectedPhotoIndex(currentPhotoIndex);
    }
  }, [currentPhotoIndex, setSelectedPhotoIndex]);
  
  useEffect(() => {
    setCurrentPhotoIndex(0);
  }, [currentTimeKey]);

  // INTERSECTION OBSERVER - Optimized
  useEffect(() => {
    if (priority) {
      setShouldLoad(true);
      return;
    }
    
    if (shouldLoad) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !shouldLoad) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { threshold: 0.05, rootMargin: "300px" }
    );
    
    const currentRef = sliderRef.current;
    if (currentRef) observer.observe(currentRef);
    
    return () => {
      if (currentRef) observer.unobserve(currentRef);
      observer.disconnect();
    };
  }, [priority, shouldLoad]);

  // PRELOAD IMAGE FOR LCP (KRITIS)
  useEffect(() => {
    if (!priority || preloadDoneRef.current || !shouldLoad) return;
    
    const preloadFirstImage = async () => {
      let firstImageUrl = null;
      
      // Cek foto warga terbaru
      if (photos.length > 0) {
        const freshWargaPhotos = photos.filter(p => {
          const createdAt = p.created_at || p.timestamp;
          if (!createdAt) return true;
          return (Date.now() - new Date(createdAt)) < 24 * 60 * 60 * 1000;
        });
        if (freshWargaPhotos.length > 0) {
          firstImageUrl = freshWargaPhotos[0]?.url || freshWargaPhotos[0]?.photo_url;
        }
      }
      
      // Jika tidak ada, coba fetch official photos
      if (!firstImageUrl && tempatId) {
        try {
          const { data } = await supabase
            .from("tempat")
            .select("photos")
            .eq("id", tempatId)
            .single();
          
          if (data?.photos) {
            const normalized = normalizeOfficialPhotos(data.photos);
            const timePhotos = normalized[currentTimeKey];
            if (timePhotos?.length > 0) {
              firstImageUrl = timePhotos[0]?.url || timePhotos[0];
            }
          }
        } catch (e) {
          // Silent fail
        }
      }
      
      if (firstImageUrl && typeof firstImageUrl === 'string' && firstImageUrl.startsWith('http')) {
        preloadImage(firstImageUrl, true);
        preloadDoneRef.current = true;
        setIsPreloaded(true);
      }
    };
    
    preloadFirstImage();
  }, [priority, shouldLoad, photos, tempatId, currentTimeKey]);

  // Fetch official photos
  const fetchOfficialPhotos = useCallback(async () => {
    if (!tempatId || !shouldLoad) return;
    
    try {
      const { data, error } = await supabase
        .from("tempat")
        .select("photos")
        .eq("id", tempatId)
        .single();
        
      if (!error && data?.photos) {
        setOfficialPhotos(normalizeOfficialPhotos(data.photos));
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
  }, [fetchOfficialPhotos, shouldLoad]);

  // Realtime subscription (hanya jika perlu)
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
          setOfficialPhotos(normalizeOfficialPhotos(payload.new.photos));
        }
      })
      .subscribe();
    
    return () => supabase.removeChannel(channel);
  }, [tempatId, shouldLoad]);

  // Process current photos - OPTIMIZED
  const currentPhotos = useMemo(() => {
    if (!shouldLoad) return [];
    
    // Prioritaskan foto warga (24 jam terakhir)
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
    
    // Foto official berdasarkan waktu
    const timePhotos = officialPhotos[currentTimeKey];
    if (timePhotos?.length > 0) {
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

  // Skeleton loading - TANPA animate-pulse (kurangi CSS blocking)
  if (!shouldLoad) {
    return (
      <div ref={sliderRef} className="relative h-full w-full rounded-[30px] bg-zinc-800/50 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-zinc-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isLoading && !currentPhoto?.url) {
    return (
      <div ref={sliderRef} className="relative h-full w-full rounded-[30px] bg-zinc-900 flex items-center justify-center">
        <Zap className="text-zinc-700" size={18} />
      </div>
    );
  }

  return (
    <div ref={sliderRef} className="relative h-full w-full overflow-hidden bg-zinc-950 rounded-[30px] shadow-2xl border border-white/5">
      <div className="absolute inset-0 z-0">
        {currentPhoto?.url ? (
          <>
            <OptimizedMedia 
              src={currentPhoto.url} 
              className="w-full h-full object-cover" 
              alt={namaTempat}
              autoPlay={true}
              muted={true}
              loop={true}
              fetchPriority={priority ? "high" : "auto"}
              loading={priority ? "eager" : "lazy"}
              priority={priority}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-transparent opacity-60" />
            
            {currentPhoto.caption && (
              <div className="absolute bottom-4 right-4 z-10 max-w-[45%]">
                <div className="flex items-center gap-1.5 bg-black/20 backdrop-blur-xl border border-white/10 px-2.5 py-1.5 rounded-xl shadow-sm">
                  <div className="w-1 h-1 rounded-full bg-white/40 shadow-[0_0_5px_white]" />
                  <p className="text-[8px] font-black uppercase tracking-tighter text-white/80 leading-none truncate">
                    {currentPhoto.caption}
                  </p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900/50 backdrop-blur-sm">
            <MapPin className="text-zinc-700 mb-2" size={24} />
            <p className="text-[9px] uppercase tracking-[0.3em] text-zinc-500 font-bold italic">
              Hasil Pantauan AI Setempat
            </p>
          </div>
        )}
      </div>

      {/* Navigasi - hanya render jika ada multiple photos */}
      {hasMultiplePhotos && currentPhoto?.url && (
        <>
          <button 
            onClick={prevPhoto} 
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/70 transition-all active:scale-95"
            aria-label="Previous photo"
          >
            <ChevronLeft size={16} />
          </button>
          <button 
            onClick={nextPhoto} 
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/70 transition-all active:scale-95"
            aria-label="Next photo"
          >
            <ChevronRight size={16} />
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
            {currentPhotos.map((_, idx) => (
              <button 
                key={idx} 
                onClick={() => setCurrentPhotoIndex(idx)} 
                className={`w-1.5 h-1.5 rounded-full transition-all ${idx === currentPhotoIndex ? 'bg-white w-3' : 'bg-white/50'}`}
                aria-label={`Go to photo ${idx + 1}`}
              />
            ))}
          </div>
        </>
      )}

      {/* Efek hujan - tanpa animate-pulse (kurangi CSS blocking) */}
      {isHujan && <div className="absolute inset-0 pointer-events-none z-[5] bg-blue-500/5" />}
      
      {/* Gradient bottom */}
      <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
    </div>
  );
}