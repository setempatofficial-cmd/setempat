"use client";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { MapPin, ChevronLeft, ChevronRight, CloudRain } from "lucide-react";
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

      if (hour < 10) nextChangeHour = 10;
      else if (hour < 15) nextChangeHour = 15;
      else if (hour < 18) nextChangeHour = 18;
      else nextChangeHour = 4;

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
  const [error, setError] = useState(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(() => selectedPhotoIndex || 0);
  const [shouldLoad, setShouldLoad] = useState(priority);
  const sliderRef = useRef(null);
  const channelRef = useRef(null);
  const preloadedRef = useRef(new Set());
  const fetchAttemptedRef = useRef(false);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  // Helper untuk menentukan warna tema dinamis agar background selaras dengan waktu
  const themeClasses = useMemo(() => {
    if (isHujan) return "bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-indigo-200";
    switch (currentTimeKey) {
      case "pagi": return "bg-gradient-to-br from-amber-950/40 via-orange-900/20 to-zinc-950 text-amber-200/70";
      case "siang": return "bg-gradient-to-br from-sky-950/30 via-zinc-900 to-zinc-950 text-sky-200/70";
      case "sore": return "bg-gradient-to-br from-orange-950/40 via-red-950/20 to-zinc-950 text-orange-200/70";
      case "malam":
      default: return "bg-gradient-to-br from-zinc-950 via-purple-950/10 to-black text-purple-200/50";
    }
  }, [currentTimeKey, isHujan]);

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
    if (!tempatId || tempatId === 0 || tempatId === undefined || isNaN(tempatId)) return;
    if (!shouldLoad) return;

    const cached = officialPhotosCache.get(tempatId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setOfficialPhotos(cached.data);
      setError(null);
      return;
    }

    if (fetchAttemptedRef.current) return;

    fetchAttemptedRef.current = true;
    setIsLoading(true);
    setError(null);

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
        officialPhotosCache.set(tempatId, { data: normalized, timestamp: Date.now() });
      } else {
        setOfficialPhotos({ pagi: [], siang: [], sore: [], malam: [] });
      }
      retryCountRef.current = 0;
    } catch (error) {
      console.error('Error fetching official photos:', error);
      setError(error.message);
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        setTimeout(() => {
          if (shouldLoad && !fetchAttemptedRef.current) fetchOfficialPhotos();
        }, 2000 * retryCountRef.current);
      }
      if (cached) setOfficialPhotos(cached.data);
    } finally {
      setIsLoading(false);
      fetchAttemptedRef.current = false;
    }
  }, [tempatId, shouldLoad]);

  useEffect(() => {
    if (!shouldLoad) return;
    fetchOfficialPhotos();
  }, [fetchOfficialPhotos, shouldLoad]);

  // Realtime subscription
  useEffect(() => {
    if (!tempatId || !shouldLoad) return;

    const cleanup = async () => {
      if (channelRef.current) {
        try { await supabase.removeChannel(channelRef.current); } catch (err) { console.warn(err); }
        channelRef.current = null;
      }
    };

    const setupChannel = async () => {
      await cleanup();
      try {
        if (!supabase || !supabase.channel) return;

        const channelName = `tempat_photos_${tempatId}_${Date.now()}`;
        const channel = supabase.channel(channelName);

        channel.on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'tempat', filter: `id=eq.${tempatId}`,
        }, (payload) => {
          if (payload.new?.photos) {
            const normalized = normalizeOfficialPhotos(payload.new.photos);
            setOfficialPhotos(normalized);
            officialPhotosCache.set(tempatId, { data: normalized, timestamp: Date.now() });
          }
        });

        channel.subscribe();
        channelRef.current = channel;
      } catch (err) { console.error(err); }
    };

    setupChannel();
    return () => { cleanup(); };
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
        return [...freshWargaPhotos].sort((a, b) =>
          new Date(b.created_at || b.timestamp) - new Date(a.created_at || a.timestamp)
        ).map(p => ({
          url: p.url || p.photo_url, type: 'warga', caption: p.caption
        }));
      }
    }

    const timePhotos = officialPhotos[currentTimeKey];
    if (timePhotos?.length > 0) {
      return [...timePhotos].map(p => ({
        url: p.url || p, type: 'official', caption: p.caption
      }));
    }
    return [];
  }, [photos, officialPhotos, currentTimeKey]);

  // Preload adjacent images
  useEffect(() => {
    if (!shouldLoad || currentPhotos.length === 0) return;

    const nextIndex = (currentPhotoIndex + 1) % currentPhotos.length;
    if (currentPhotos[nextIndex]?.url && !preloadedRef.current.has(currentPhotos[nextIndex].url)) {
      preloadImage(currentPhotos[nextIndex].url);
      preloadedRef.current.add(currentPhotos[nextIndex].url);
    }

    const prevIndex = (currentPhotoIndex - 1 + currentPhotos.length) % currentPhotos.length;
    if (currentPhotos[prevIndex]?.url && !preloadedRef.current.has(currentPhotos[prevIndex].url)) {
      preloadImage(currentPhotos[prevIndex].url);
      preloadedRef.current.add(currentPhotos[prevIndex].url);
    }
  }, [currentPhotoIndex, currentPhotos, shouldLoad]);

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

  // MAIN RENDER (FOTO TERSEDIA)
  if (currentPhotos.length > 0) {
    return (
      /* PERUBAHAN DI SINI: rounded-t-[30px] rounded-b-none agar bagian bawah lurus */
      <div ref={sliderRef} className="relative h-full w-full overflow-hidden bg-zinc-950 rounded-t-[30px] rounded-b-none shadow-2xl border border-white/5 group select-none">
        <div className="absolute inset-0 z-0 cursor-pointer" onClick={handlePhotoClick}>
          <OptimizedMedia
            src={currentPhoto.url}
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            alt={namaTempat}
            autoPlay={true}
            muted={true}
            loop={true}
            fetchPriority={priority ? "high" : "auto"}
            loading={priority ? "eager" : "lazy"}
            priority={priority}
          />
          {/* Overlay gradasi ganda (atas untuk proteksi status bar/teks, bawah untuk dots/caption) */}
          {/* PERUBAHAN DI SINI: Gradasi bawah disesuaikan agar terlihat bagus dengan sudut lurus */}
          <div className="absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-black/40 via-black/10 to-transparent pointer-events-none rounded-t-[30px]" />
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 via-black/30 to-transparent pointer-events-none rounded-b-none" />
        </div>

        {/* Caption - Glassmorphic di pojok kanan bawah */}
        {currentPhoto.caption && (
          <div className="absolute bottom-4 right-4 z-10 max-w-[50%] animate-fade-in">
            <div className="flex items-center gap-1.5 bg-zinc-900/60 backdrop-blur-md border border-white/10 px-2.5 py-1.5 rounded-xl shadow-lg">
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
              <p className="text-[9px] font-medium tracking-tight text-white/90 leading-none truncate">
                {currentPhoto.caption}
              </p>
            </div>
          </div>
        )}

        {hasMultiplePhotos && (
          <>
            {/* Tombol Navigasi Kiri & Kanan (Tampil tipis, membesar halus saat hover di desktop/tap mobile) */}
            <button
              onClick={prevPhoto}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/5 backdrop-blur-md border border-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all active:scale-90 shadow-md"
              aria-label="Previous photo"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={nextPhoto}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/5 backdrop-blur-md border border-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all active:scale-90 shadow-md"
              aria-label="Next photo"
            >
              <ChevronRight size={16} />
            </button>

            {/* Indikator Titik (Dots) */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-1.5 px-2 py-1.5 rounded-full bg-black/20 backdrop-blur-sm border border-white/5">
              {currentPhotos.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentPhotoIndex(idx)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentPhotoIndex ? 'bg-white w-3.5 shadow-sm' : 'bg-white/40 w-1.5 hover:bg-white/60'}`}
                  aria-label={`Go to photo ${idx + 1}`}
                />
              ))}
            </div>
          </>
        )}

        {/* Efek Atmosfer Cuaca Hujan */}
        {isHujan && (
          /* PERUBAHAN DI SINI: rounded-t-[30px] rounded-b-none */
          <div className="absolute inset-0 pointer-events-none z-[5] bg-indigo-500/ mix-blend-color-burn animate-pulse rounded-t-[30px] rounded-b-none" />
        )}
      </div>
    );
  }

  // LOADING STATE (Sesuai tema waktu & cuaca)
  if (!shouldLoad || (isLoading && currentPhotos.length === 0)) {
    return (
      /* PERUBAHAN DI SINI: rounded-t-[30px] rounded-b-none */
      <div ref={sliderRef} className={`relative h-full w-full rounded-t-[30px] rounded-b-none flex items-center justify-center transition-all duration-500 ${themeClasses}`}>
        <div className="relative flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // EMPTY STATE (Tampilan minimalis futuristik modern dengan branding rapi)
  return (
    /* PERUBAHAN DI SINI: rounded-t-[30px] rounded-b-none */
    <div ref={sliderRef} className={`relative h-full w-full rounded-t-[30px] rounded-b-none flex items-center justify-center p-6 text-center overflow-hidden transition-all duration-500 ${themeClasses}`}>
      {/* Dekorasi Grid Halus di Background untuk kesan Tech/AI */}
      {/* PERUBAHAN DI SINI: rounded-t-[30px] rounded-b-none */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:16px_16px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] rounded-t-[30px] rounded-b-none" />

      <div className="relative flex flex-col items-center max-w-[80%] animate-fade-in">
        <div className="p-3 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 mb-3 shadow-xl">
          {isHujan ? (
            <CloudRain className="opacity-60 text-indigo-400" size={20} />
          ) : (
            <MapPin className="opacity-60" size={20} />
          )}
        </div>
        <p className="text-[10px] uppercase tracking-[0.25em] font-semibold opacity-70">
          Hasil Pantauan AI Setempat
        </p>
        <span className="text-[9px] opacity-40 mt-1 font-mono lowercase">
          {namaTempat ? `${namaTempat} • ` : ""}{currentTimeKey} {isHujan ? "• hujan" : ""}
        </span>
      </div>
    </div>
  );
}