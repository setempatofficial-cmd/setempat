"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Users, Building2, Video, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getIndonesianTimeLabel } from "@/utils/timeUtils";
import OptimizedMedia from "@/components/OptimizedMedia";

const normalizeOfficialPhotos = (photos) => {
  if (!photos) return { pagi: [], siang: [], sore: [], malam: [] };
  const result = { pagi: [], siang: [], sore: [], malam: [] };

  for (const key of ['pagi', 'siang', 'sore', 'malam']) {
    const data = photos[key];
    if (data) {
      result[key] = Array.isArray(data) ? data : (data.url ? [data] : []);
    }
  }
  return result;
};

const formatUploadTime = (createdAt) => {
  if (!createdAt) return '';
  const date = new Date(createdAt);
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
};

const isVideoUrl = (url) => {
  if (!url) return false;
  return /\.(mp4|mov|avi|mkv|webm|m3u8|mpeg)$/i.test(url) || url.includes('video') || url.includes('stream');
};

const useTimeKey = () => {
  const [timeKey, setTimeKey] = useState(() => getIndonesianTimeLabel().toLowerCase());

  useEffect(() => {
    const checkTime = () => {
      const newLabel = getIndonesianTimeLabel().toLowerCase();
      setTimeKey(prev => prev !== newLabel ? newLabel : prev);
    };
    const intervalId = setInterval(checkTime, 60000);
    return () => clearInterval(intervalId);
  }, []);

  return timeKey;
};

export default function PhotoDetailHero({
  photos = [],
  tempatId,
  deskripsiTempat = "",
  namaTempat = "",
  isHujan = false,
  priority = true, // Default high priority untuk detail atas
}) {
  const currentTimeKey = useTimeKey();
  const [officialPhotosState, setOfficialPhotosState] = useState({ pagi: [], siang: [], sore: [], malam: [] });
  const [cctvUrlState, setCctvUrlState] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Ambil data resmi dari database
  useEffect(() => {
    if (!tempatId || isNaN(tempatId)) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('tempat')
          .select('photos, image_url')
          .eq('id', tempatId)
          .single();

        if (error) throw error;

        setOfficialPhotosState(normalizeOfficialPhotos(data?.photos));
        setCctvUrlState(data?.image_url || null);
      } catch (error) {
        console.error('Error fetching detail photos:', error.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [tempatId]);

  // Realtime subscription agar jika ada update foto dari admin/warga langsung sinkron
  useEffect(() => {
    if (!tempatId || !supabase) return;

    const channel = supabase
      .channel(`realtime_detail_photos_${tempatId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tempat',
        filter: `id=eq.${tempatId}`,
      }, (payload) => {
        setOfficialPhotosState(normalizeOfficialPhotos(payload.new?.photos));
        setCctvUrlState(payload.new?.image_url || null);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tempatId]);

  // Satukan semua media yang tersedia ke dalam satu array galeri (Urutan prioritas dipertahankan)
  const mediaGallery = useMemo(() => {
    const gallery = [];

    // 1. Prioritas Utama: CCTV Live
    if (cctvUrlState && typeof cctvUrlState === 'string' && cctvUrlState.trim() !== "") {
      const isEmbed = cctvUrlState.includes('pasuruankota.go.id') || cctvUrlState.includes('cam') || cctvUrlState.includes('cctv');
      if (isEmbed) {
        gallery.push({
          url: cctvUrlState.trim(),
          type: 'cctv',
          isVideo: false,
          caption: 'Live Streaming',
          created_at: null,
          isCctv: true,
          isEmbed: true
        });
      }
    }

    // 2. Prioritas Kedua: Semua Foto Kiriman Warga yang sesuai waktu saat ini
    if (photos && photos.length > 0) {
      const matchedWargaPhotos = photos.filter(p => {
        const createdAt = p.created_at || p.timestamp;
        if (!createdAt) return false;
        return getIndonesianTimeLabel(new Date(createdAt)).toLowerCase() === currentTimeKey;
      }).sort((a, b) => new Date(b.created_at || b.timestamp) - new Date(a.created_at || a.timestamp));

      matchedWargaPhotos.forEach(latest => {
        const videoUrl = latest.video_url || latest.url;
        const photoUrl = latest.photo_url || latest.url;
        const isVideo = latest.is_video || isVideoUrl(videoUrl);
        gallery.push({
          url: isVideo ? videoUrl : photoUrl,
          type: 'warga',
          isVideo: isVideo,
          caption: latest.deskripsi || latest.caption,
          created_at: latest.created_at || latest.timestamp,
          user_name: latest.user_name || latest.nama_warga || 'Warga',
        });
      });
    }

    // 3. Prioritas Ketiga: Semua Foto Official di waktu saat ini
    const timePhotosFromDb = officialPhotosState[currentTimeKey];
    if (timePhotosFromDb && timePhotosFromDb.length > 0) {
      timePhotosFromDb.forEach(singlePhoto => {
        const targetUrl = singlePhoto?.url || singlePhoto;
        if (targetUrl) {
          gallery.push({ 
            url: targetUrl, 
            type: 'official', 
            isVideo: isVideoUrl(targetUrl), 
            caption: singlePhoto?.caption || 'Suasana', 
            created_at: null, 
            isCctv: false, 
            isEmbed: false 
          });
        }
      });
    }

    return gallery;
  }, [cctvUrlState, photos, officialPhotosState, currentTimeKey]);

  // Ambil foto aktif berdasarkan index slider
  const currentPhoto = mediaGallery[activeIndex] || mediaGallery[0];

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % mediaGallery.length);
  };

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + mediaGallery.length) % mediaGallery.length);
  };

  const themeClasses = useMemo(() => {
    if (isHujan) return "bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-indigo-200";
    switch (currentTimeKey) {
      case "pagi": return "bg-gradient-to-br from-amber-950/40 via-orange-900/20 to-zinc-950 text-amber-200/70";
      case "siang": return "bg-gradient-to-br from-sky-950/30 via-zinc-900 to-zinc-950 text-sky-200/70";
      case "sore": return "bg-gradient-to-br from-orange-950/40 via-red-950/20 to-zinc-950 text-orange-200/70";
      default: return "bg-gradient-to-br from-zinc-950 via-purple-950/10 to-black text-purple-200/50";
    }
  }, [currentTimeKey, isHujan]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-zinc-950 select-none transform-gpu rounded-none border-none shadow-none">
      {currentPhoto?.url ? (
        <>
          <div className="absolute inset-0 z-0">
            {currentPhoto.isEmbed ? (
              <div className="absolute inset-0 z-0 w-full h-full overflow-hidden bg-zinc-950">
                <iframe
                  src={currentPhoto.url}
                  scrolling="no"
                  className="w-full h-full border-0 object-cover"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                />
              </div>
            ) : (
              <OptimizedMedia
                src={currentPhoto.url}
                className="w-full h-full object-cover transition-transform duration-500"
                alt={namaTempat}
                autoPlay={true}
                muted={true}
                loop={true}
                controls={false}
                playsInline={true}
                fetchPriority={priority ? "high" : "auto"}
                priority={priority}
              />
            )}

            {/* Gradasi Atas & Bawah - Menyatu Sempurna Tanpa Lengkungan Radius */}
            <div className="absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-black/80 via-black/20 to-transparent pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/95 via-black/40 to-transparent pointer-events-none" />
          </div>

          {/* Tombol Navigasi Kanan-Kiri jika foto lebih dari satu */}
          {mediaGallery.length > 1 && (
            <>
              <button 
                onClick={handlePrev}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/30 backdrop-blur-md text-white border border-white/10 active:scale-95 transition-all"
              >
                <ChevronLeft size={18} />
              </button>
              <button 
                onClick={handleNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/30 backdrop-blur-md text-white border border-white/10 active:scale-95 transition-all"
              >
                <ChevronRight size={18} />
              </button>

              {/* Indikator Titik Paginasi Kecil di Atas */}
              <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex gap-1.5 px-3 py-1 bg-black/20 backdrop-blur-sm rounded-full">
                {mediaGallery.map((_, idx) => (
                  <div 
                    key={idx} 
                    className={`h-1.5 rounded-full transition-all duration-300 ${idx === activeIndex ? "w-4 bg-cyan-400" : "w-1.5 bg-white/40"}`}
                  />
                ))}
              </div>
            </>
          )}

          {/* Bagian Status Info Pojok Kanan Bawah */}
          <div className="absolute bottom-4 right-4 z-10 max-w-[60%] text-[10px] tracking-wide text-white pointer-events-none">
            {currentPhoto.type === 'warga' ? (
              <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md border border-white/10 px-3 py-1 rounded-full">
                <Users size={11} className="opacity-80 text-cyan-400" />
                <span className="font-medium">{currentPhoto.user_name}</span>
                <span className="opacity-60 font-light text-[9px]">{formatUploadTime(currentPhoto.created_at)}</span>
              </div>
            ) : currentPhoto.type === 'cctv' ? (
              <div className="flex items-center gap-2 bg-red-600/90 backdrop-blur-md border border-red-500/20 px-3 py-1 rounded-full shadow-lg">
                <Video size={11} className="animate-pulse text-white" />
                <span className="font-semibold tracking-wider text-white uppercase text-[9px]">Live CCTV</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md border border-white/10 px-3 py-1 rounded-full">
                <Building2 size={11} className="opacity-80 text-amber-400" />
                <span className="font-medium opacity-90">Suasana • {currentTimeKey}</span>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Tampilan Fallback Kosong */
        <div className={`absolute inset-0 flex items-center justify-center p-6 text-center overflow-hidden ${themeClasses}`}>
          <div className="relative flex flex-col items-center max-w-[80%] p-5 bg-white/5 backdrop-blur-md border border-white/10 rounded-xl shadow-xl">
            <div className="flex items-center gap-1.5 mb-2.5 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              <span className="text-[8px] uppercase tracking-[0.2em] font-bold text-cyan-400 font-mono">Kondisi Terkini</span>
            </div>
            <p className="text-[11px] text-white/80 text-center font-mono leading-relaxed tracking-wide">
              {deskripsiTempat || "Menampilkan rekaman visual area sekitar secara real-time."}
              <span className="inline-block w-1 h-3 bg-cyan-400 ml-1 animate-pulse" />
            </p>
          </div>
        </div>
      )}

      {isHujan && <div className="absolute inset-0 pointer-events-none z-[5] bg-indigo-500/10 mix-blend-overlay" />}
    </div>
  );
}