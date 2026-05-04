"use client";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { MapPin, ChevronLeft, ChevronRight } from "lucide-react";
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

// Cache dengan TTL lebih panjang
const officialPhotosCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 menit

// Preload image helper
const preloadImage = (url) => {
  if (!url || typeof window === 'undefined') return;
  const img = new Image();
  img.src = url;
};

// ========== HOOK UNTUK TIME KEY ==========
const useTimeKey = () => {
  const [timeKey, setTimeKey] = useState(() => {
    const label = getIndonesianTimeLabel();
    return label.toLowerCase();
  });

  useEffect(() => {
    let timeoutId = null;
    
    const scheduleNextCheck = () => {
      const now = new Date();
      const hour = now.getHours();
      
      let nextChangeHour = 10;
      let nextChangeLabel = "Siang";
      
      if (hour < 10) {
        nextChangeHour = 10;
        nextChangeLabel = "Siang";
      } else if (hour < 15) {
        nextChangeHour = 15;
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
        scheduleNextCheck();
      }, delay);
    };
    
    scheduleNextCheck();
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);
  
  return timeKey;
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
  onPhotoClick,
}) {
  const currentTimeKey = useTimeKey();
  
  const [officialPhotos, setOfficialPhotos] = useState(() => {
    const cached = officialPhotosCache.get(tempatId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    return { pagi: [], siang: [], sore: [], malam: [] };
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(() => selectedPhotoIndex || 0);
  const [shouldLoad, setShouldLoad] = useState(priority);
  const sliderRef = useRef(null);
  const channelRef = useRef(null);
  const preloadedRef = useRef(new Set()); // Track sudah preload atau belum
  
  // Sync with parent
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

  // Intersection Observer
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

  // Fetch official photos
  const fetchOfficialPhotos = useCallback(async () => {
    if (!tempatId || !shouldLoad) return;
    
    const cached = officialPhotosCache.get(tempatId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setOfficialPhotos(cached.data);
      return;
    }
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('tempat')
        .select('photos')
        .eq('id', tempatId)
        .single();
      
      if (error) throw error;
      
      if (data?.photos) {
        const normalized = normalizeOfficialPhotos(data.photos);
        setOfficialPhotos(normalized);
        officialPhotosCache.set(tempatId, { 
          data: normalized, 
          timestamp: Date.now() 
        });
      }
    } catch (error) {
      console.error('Error fetching official photos:', error);
    } finally {
      setIsLoading(false);
    }
  }, [tempatId, shouldLoad]);

  useEffect(() => {
    if (!shouldLoad) return;
    fetchOfficialPhotos();
  }, [fetchOfficialPhotos, shouldLoad]);

  // Realtime subscription (tetap seperti yang sudah tepat)
  useEffect(() => {
    if (!tempatId || !shouldLoad) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channelName = `realtime_tempat_${tempatId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const channel = supabase.channel(channelName);
    channelRef.current = channel;

    channel
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tempat',
          filter: `id=eq.${tempatId}`,
        },
        (payload) => {
          if (payload.new?.photos) {
            const normalized = normalizeOfficialPhotos(payload.new.photos);
            setOfficialPhotos(normalized);
            officialPhotosCache.set(tempatId, { 
              data: normalized, 
              timestamp: Date.now() 
            });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to changes for tempat ${tempatId}`);
        }
      });

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [tempatId, shouldLoad]);

  // Process current photos
  const currentPhotos = useMemo(() => {
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
  }, [photos, officialPhotos, currentTimeKey]);

  // PRELOAD ADJACENT IMAGES - SOLUSI UTAMA UNTUK LOADING CEPAT
  useEffect(() => {
    if (!shouldLoad || currentPhotos.length === 0) return;
    
    // Preload next image
    const nextIndex = (currentPhotoIndex + 1) % currentPhotos.length;
    const nextPhoto = currentPhotos[nextIndex];
    if (nextPhoto?.url && !preloadedRef.current.has(nextPhoto.url)) {
      preloadImage(nextPhoto.url);
      preloadedRef.current.add(nextPhoto.url);
    }
    
    // Preload previous image
    const prevIndex = (currentPhotoIndex - 1 + currentPhotos.length) % currentPhotos.length;
    const prevPhoto = currentPhotos[prevIndex];
    if (prevPhoto?.url && !preloadedRef.current.has(prevPhoto.url)) {
      preloadImage(prevPhoto.url);
      preloadedRef.current.add(prevPhoto.url);
    }
  }, [currentPhotoIndex, currentPhotos, shouldLoad]);

  // Preload first image saat load pertama
  useEffect(() => {
    if (!shouldLoad || currentPhotos.length === 0) return;
    if (preloadedRef.current.has('initial_preload_done')) return;
    
    const firstPhoto = currentPhotos[0];
    if (firstPhoto?.url) {
      preloadImage(firstPhoto.url);
      preloadedRef.current.add(firstPhoto.url);
      preloadedRef.current.add('initial_preload_done');
    }
  }, [currentPhotos, shouldLoad]);

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

  const handlePhotoClick = useCallback(() => {
    if (onPhotoClick && currentPhotos.length > 0) {
      onPhotoClick(currentPhotos, currentPhotoIndex);
    }
  }, [onPhotoClick, currentPhotos, currentPhotoIndex]);

  // Main render with photos
  if (currentPhotos.length > 0) {
    return (
      <div ref={sliderRef} className="relative h-full w-full overflow-hidden bg-zinc-950 rounded-[30px] shadow-2xl border border-white/5">
        <div className="absolute inset-0 z-0" onClick={handlePhotoClick}>
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
        </div>

        {hasMultiplePhotos && (
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

        {isHujan && <div className="absolute inset-0 pointer-events-none z-[5] bg-blue-500/5" />}
        <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
      </div>
    );
  }

  // Loading state
  if (!shouldLoad || (isLoading && currentPhotos.length === 0)) {
    return (
      <div ref={sliderRef} className="relative h-full w-full rounded-[30px] bg-zinc-800/50 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-zinc-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Empty state
  return (
    <div ref={sliderRef} className="relative h-full w-full rounded-[30px] bg-zinc-900 flex items-center justify-center">
      <div className="flex flex-col items-center justify-center bg-zinc-900/50 backdrop-blur-sm">
        <MapPin className="text-zinc-700 mb-2" size={24} />
        <p className="text-[9px] uppercase tracking-[0.3em] text-zinc-500 font-bold italic">
          Hasil Pantauan AI Setempat
        </p>
      </div>
    </div>
  );
}