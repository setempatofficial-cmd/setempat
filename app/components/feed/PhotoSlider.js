"use client";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { MapPin, CloudRain, Users, Building2 } from "lucide-react";
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

// Format waktu upload
const formatUploadTime = (createdAt) => {
  if (!createdAt) return '';
  const date = new Date(createdAt);
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
};

// Cache dengan TTL lebih panjang
const officialPhotosCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 menit

// Helper deteksi video
const isVideoUrl = (url) => {
  if (!url) return false;
  const videoExtensions = /\.(mp4|mov|avi|mkv|webm|m3u8|mpeg)$/i;
  return videoExtensions.test(url) || url.includes('video') || url.includes('stream');
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
  photos = [],              // STORY WARGA (foto/video dari laporan_warga)
  officialPhotosData = null, // FOTO OFFICIAL dari parent (fallback)
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

  const [officialPhotosState, setOfficialPhotosState] = useState(() => {
    const cached = officialPhotosCache.get(tempatId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    return { pagi: [], siang: [], sore: [], malam: [] };
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [shouldLoad, setShouldLoad] = useState(priority);
  const sliderRef = useRef(null);
  const channelRef = useRef(null);
  const fetchAttemptedRef = useRef(false);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  // Helper untuk menentukan warna tema dinamis
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
    if (setSelectedPhotoIndex && selectedPhotoIndex !== undefined) {
      setSelectedPhotoIndex(0);
    }
  }, [selectedPhotoIndex, setSelectedPhotoIndex]);

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

  // Fetch official photos dari database
  const fetchOfficialPhotos = useCallback(async () => {
    if (!tempatId || tempatId === 0 || tempatId === undefined || isNaN(tempatId)) return;
    if (!shouldLoad) return;

    const cached = officialPhotosCache.get(tempatId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setOfficialPhotosState(cached.data);
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
        setOfficialPhotosState(normalized);
        officialPhotosCache.set(tempatId, { data: normalized, timestamp: Date.now() });
      } else {
        setOfficialPhotosState({ pagi: [], siang: [], sore: [], malam: [] });
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
      if (cached) setOfficialPhotosState(cached.data);
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
            setOfficialPhotosState(normalized);
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

  // ========== MAIN LOGIC: HANYA 1 MEDIA TERBARU YANG SESUAI WAKTU ==========
  const currentPhoto = useMemo(() => {
    // PRIORITAS 1: Story warga terbaru yang sesuai waktu
    if (photos && photos.length > 0) {
      // Filter story berdasarkan waktu yang sama
      const matchedWargaPhotos = photos.filter(p => {
        const createdAt = p.created_at || p.timestamp;
        if (!createdAt) return false;
        const uploadTimeLabel = getIndonesianTimeLabel(new Date(createdAt)).toLowerCase();
        return uploadTimeLabel === currentTimeKey;
      });

      if (matchedWargaPhotos.length > 0) {
        // Urutkan dari terbaru, ambil yang PALING BARU (index 0)
        const latest = [...matchedWargaPhotos].sort((a, b) =>
          new Date(b.created_at || b.timestamp) - new Date(a.created_at || a.timestamp)
        )[0];

        const videoUrl = latest.video_url || latest.url;
        const photoUrl = latest.photo_url || latest.url;
        const isVideo = latest.is_video || isVideoUrl(videoUrl);
        const finalUrl = isVideo ? videoUrl : photoUrl;

        return {
          url: finalUrl,
          type: 'warga',
          isVideo: isVideo,
          caption: latest.deskripsi || latest.caption,
          created_at: latest.created_at || latest.timestamp,
          user_name: latest.user_name || latest.nama_warga || 'Warga',
        };
      }
    }

    // PRIORITAS 2: Official photos (ambil foto pertama saja)
    if (officialPhotosData) {
      const timePhotos = officialPhotosData[currentTimeKey];
      if (timePhotos && timePhotos.length > 0) {
        const firstPhoto = timePhotos[0];
        return {
          url: firstPhoto.url || firstPhoto,
          type: 'official',
          isVideo: false,
          caption: firstPhoto.caption,
          created_at: null,
        };
      }
    }

    // PRIORITAS 3: Official photos dari DATABASE
    const timePhotosFromDb = officialPhotosState[currentTimeKey];
    if (timePhotosFromDb && timePhotosFromDb.length > 0) {
      const firstPhoto = timePhotosFromDb[0];
      return {
        url: firstPhoto.url || firstPhoto,
        type: 'official',
        isVideo: false,
        caption: firstPhoto.caption,
        created_at: null,
      };
    }

    return null;
  }, [photos, officialPhotosData, officialPhotosState, currentTimeKey]);

  const handlePhotoClick = useCallback(() => {
    if (onPhotoClick && currentPhoto) {
      onPhotoClick([currentPhoto], 0);
    }
  }, [onPhotoClick, currentPhoto]);

  // MAIN RENDER (FOTO TERSEDIA)
  if (currentPhoto?.url) {
    return (
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
          <div className="absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-black/60 via-black/20 to-transparent pointer-events-none rounded-t-[30px]" />
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none rounded-b-none" />
        </div>

        {/* BADGE SUMBER FOTO - Pojok Kanan Bawah */}
        <div className="absolute bottom-4 right-4 z-10 max-w-[60%] animate-fade-in text-[10px] tracking-wide text-white">
          {currentPhoto.type === 'warga' ? (
            <div className="flex items-center gap-2 bg-black/40 backdrop-blur-sm border border-white/10 px-3 py-1 rounded-full">
              <Users size={11} className="opacity-80" />
              <span className="font-medium">
                {currentPhoto.user_name}
              </span>
              <span className="opacity-60 font-light text-[9px]">
                {formatUploadTime(currentPhoto.created_at)}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-black/40 backdrop-blur-sm border border-white/10 px-3 py-1 rounded-full">
              <Building2 size={11} className="opacity-80" />
              <span className="font-medium opacity-90">
                Suasana • {currentTimeKey}
              </span>
            </div>
          )}
        </div>

        {/* Efek Hujan */}
        {isHujan && (
          <div className="absolute inset-0 pointer-events-none z-[5] bg-indigo-500/5 mix-blend-overlay rounded-t-[30px] rounded-b-none">
            <div className="absolute inset-0 bg-[linear-gradient(0deg,transparent_80%,#6366f105_90%)] animate-pulse" />
          </div>
        )}
      </div>
    );
  }

  // LOADING STATE
  if (!shouldLoad || (isLoading && !currentPhoto)) {
    return (
      <div ref={sliderRef} className={`relative h-full w-full rounded-t-[30px] rounded-b-none flex items-center justify-center transition-all duration-500 ${themeClasses}`}>
        <div className="relative flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // EMPTY STATE
  return (
    <div ref={sliderRef} className={`relative h-full w-full rounded-t-[30px] rounded-b-none flex items-center justify-center p-6 text-center overflow-hidden transition-all duration-500 ${themeClasses}`}>
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:16px_16px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] rounded-t-[30px] rounded-b-none" />
      <div className="relative flex flex-col items-center max-w-[80%] animate-fade-in">
        <div className="p-3 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 mb-3 shadow-xl">
          {isHujan ? <CloudRain className="opacity-60 text-indigo-400" size={20} /> : <MapPin className="opacity-60" size={20} />}
        </div>
        <p className="text-[10px] uppercase tracking-[0.25em] font-semibold opacity-70">Hasil Pantauan AI Setempat</p>
        <span className="text-[9px] opacity-40 mt-1 font-mono lowercase">{namaTempat ? `${namaTempat} • ` : ""}{currentTimeKey} {isHujan ? "• hujan" : ""}</span>
      </div>
    </div>
  );
}