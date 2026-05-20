"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Users, Building2, Video } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getIndonesianTimeLabel } from "@/utils/timeUtils";
import OptimizedMedia from "@/components/OptimizedMedia";
import { useRouter } from "next/navigation";

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

export default function PhotoSlider({
  photos = [],
  officialPhotosData = null,
  tempatId,
  deskripsiTempat = "",
  namaTempat = "",
  isHujan = false,
  priority = false,
  setSelectedPhotoIndex,
  selectedPhotoIndex,
  onPhotoClick,
  isDetail = false,
}) {

  const router = useRouter();
  const currentTimeKey = useTimeKey();

  const [officialPhotosState, setOfficialPhotosState] = useState({ pagi: [], siang: [], sore: [], malam: [] });
  const [cctvUrlState, setCctvUrlState] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const sliderRef = useRef(null);
  const channelRef = useRef(null);

  const themeClasses = useMemo(() => {
    if (isHujan) return "bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-indigo-200";
    switch (currentTimeKey) {
      case "pagi": return "bg-gradient-to-br from-amber-950/40 via-orange-900/20 to-zinc-950 text-amber-200/70";
      case "siang": return "bg-gradient-to-br from-sky-950/30 via-zinc-900 to-zinc-950 text-sky-200/70";
      case "sore": return "bg-gradient-to-br from-orange-950/40 via-red-950/20 to-zinc-950 text-orange-200/70";
      default: return "bg-gradient-to-br from-zinc-950 via-purple-950/10 to-black text-purple-200/50";
    }
  }, [currentTimeKey, isHujan]);

  // FIX: Reset index foto hanya saat user berganti lokasi (tempatId berubah)
  useEffect(() => {
    if (setSelectedPhotoIndex) {
      setSelectedPhotoIndex(0);
    }
  }, [tempatId, setSelectedPhotoIndex]);

  // Ambil data dari Supabase
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
        console.error('Error fetching data:', error.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [tempatId]);

  // Realtime subscription
  useEffect(() => {
    if (!tempatId || !supabase) return;

    const channel = supabase
      .channel(`realtime_photos_${tempatId}`)
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

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [tempatId]);

  // Logic filter media
  const currentPhoto = useMemo(() => {
    // CCTV
    if (cctvUrlState && typeof cctvUrlState === 'string' && cctvUrlState.trim() !== "") {
      const isEmbed = cctvUrlState.includes('pasuruankota.go.id') ||
        cctvUrlState.includes('cam') ||
        cctvUrlState.includes('cctv');

      if (isEmbed) {
        return {
          url: cctvUrlState.trim(),
          type: 'official',
          isVideo: false,
          caption: 'Live Streaming',
          created_at: null,
          isCctv: true,
          isEmbed: true
        };
      }
    }

    // Foto Warga
    if (photos && photos.length > 0) {
      const matchedWargaPhotos = photos.filter(p => {
        const createdAt = p.created_at || p.timestamp;
        if (!createdAt) return false;
        return getIndonesianTimeLabel(new Date(createdAt)).toLowerCase() === currentTimeKey;
      });

      if (matchedWargaPhotos.length > 0) {
        const latest = [...matchedWargaPhotos].sort((a, b) =>
          new Date(b.created_at || b.timestamp) - new Date(a.created_at || a.timestamp)
        )[0];

        const videoUrl = latest.video_url || latest.url;
        const photoUrl = latest.photo_url || latest.url;
        const isVideo = latest.is_video || isVideoUrl(videoUrl);

        return {
          url: isVideo ? videoUrl : photoUrl,
          type: 'warga',
          isVideo: isVideo,
          caption: latest.deskripsi || latest.caption,
          created_at: latest.created_at || latest.timestamp,
          user_name: latest.user_name || latest.nama_warga || 'Warga',
        };
      }
    }

    // Foto Official dari props
    if (officialPhotosData) {
      const timePhotos = officialPhotosData[currentTimeKey];
      if (timePhotos && timePhotos.length > 0) {
        const singlePhoto = timePhotos[0];
        const targetUrl = singlePhoto?.url || singlePhoto;
        if (targetUrl) {
          return { url: targetUrl, type: 'official', isVideo: isVideoUrl(targetUrl), caption: singlePhoto?.caption || 'Suasana', created_at: null, isCctv: false, isEmbed: false };
        }
      }
    }

    // Foto Official dari database
    const timePhotosFromDb = officialPhotosState[currentTimeKey];
    if (timePhotosFromDb && timePhotosFromDb.length > 0) {
      const singlePhoto = timePhotosFromDb[0];
      const targetUrl = singlePhoto?.url || singlePhoto;
      if (targetUrl) {
        return { url: targetUrl, type: 'official', isVideo: isVideoUrl(targetUrl), caption: timePhotosFromDb[0].caption || 'Suasana', created_at: null, isCctv: false, isEmbed: false };
      }
    }

    return null;
  }, [cctvUrlState, photos, officialPhotosData, officialPhotosState, currentTimeKey]);

  const handlePhotoClick = useCallback(() => {
    if (onPhotoClick && currentPhoto) {
      onPhotoClick([currentPhoto], 0);
    }
  }, [onPhotoClick, currentPhoto]);

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
  }, []);

  return (
    <div
      ref={sliderRef}
      onContextMenu={handleContextMenu}
      className="relative h-full w-full overflow-hidden bg-zinc-950 rounded-t-[30px] rounded-b-none shadow-2xl border border-white/5 group select-none transform-gpu"
    >
      {currentPhoto?.url ? (
        <>
          <div
            className="absolute inset-0 z-0 cursor-pointer"
            onClick={handlePhotoClick}
          >

            {currentPhoto.isEmbed ? (
              <div className="absolute inset-0 z-0 w-full h-full overflow-hidden rounded-t-[30px] bg-zinc-950">
                {/* PERBAIKAN: Singkirkan pembungkus berlebih, biarkan iframe langsung mengisi container 4:3 */}
                <iframe
                  src={currentPhoto.url}
                  scrolling="no"
                  className="w-full h-full border-0 absolute inset-0"
                  style={{
                    objectFit: 'contain',
                    aspectRatio: 'auto'
                  }}
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                />

                {/* Lapisan transparan agar klik tembus untuk memicu pop-up Lightbox */}
                <div className="absolute inset-0 bg-transparent cursor-pointer" />
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
              </div>
            ) : (
              <OptimizedMedia
                src={currentPhoto.url}
                className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105 pointer-events-none"
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

            <div className="absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-black/60 via-black/20 to-transparent pointer-events-none rounded-t-[30px]" />
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none rounded-b-none" />
          </div>

          <div className="absolute bottom-4 right-4 z-10 max-w-[60%] text-[10px] tracking-wide text-white transform-gpu pointer-events-none">
            {currentPhoto.type === 'warga' ? (
              <div className="flex items-center gap-2 bg-black/40 backdrop-blur-sm border border-white/10 px-3 py-1 rounded-full">
                <Users size={11} className="opacity-80" />
                <span className="font-medium">{currentPhoto.user_name}</span>
                <span className="opacity-60 font-light text-[9px]">{formatUploadTime(currentPhoto.created_at)}</span>
              </div>
            ) : currentPhoto.isCctv ? (
              <div className="flex items-center gap-2 bg-red-600/90 backdrop-blur-sm border border-red-500/20 px-3 py-1 rounded-full shadow-lg">
                <Video size={11} className="animate-pulse text-white" />
                <span className="font-semibold tracking-wider text-white uppercase text-[9px]">Live CCTV</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-black/40 backdrop-blur-sm border border-white/10 px-3 py-1 rounded-full">
                <Building2 size={11} className="opacity-80" />
                <span className="font-medium opacity-90">Suasana • {currentTimeKey}</span>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className={`absolute inset-0 flex items-center justify-center p-6 text-center overflow-hidden ${themeClasses}`}>
          <div className="absolute inset-0 opacity-[0.02] pointer-events-none rounded-t-[30px]"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
              backgroundSize: '16px 16px',
            }}
          />
          <div className="relative flex flex-col items-center max-w-[80%] p-4 bg-white/5 backdrop-blur-md border border-white/10 rounded-xl shadow-xl">
            <div className="flex items-center gap-1.5 mb-2.5 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              <span className="text-[8px] uppercase tracking-[0.2em] font-bold text-cyan-400 font-mono">
                Kondisi Terkini
              </span>
            </div>

            <p className="text-[11px] text-white/80 text-center font-mono leading-relaxed tracking-wide max-w-[90%]">
              {deskripsiTempat || "Menampilkan rekaman visual dan pembaruan aktivitas area sekitar secara real-time."}
              <span className="inline-block w-1 h-3 bg-cyan-400 ml-1 animate-pulse" />
            </p>

            {!isDetail && (
              <button
                onClick={() => {
                  if (tempatId) {
                    router.push(`/post/${tempatId}`);
                  }
                }}
                className="mt-3 px-4 py-1 bg-cyan-500 text-black font-extrabold text-[9px] uppercase tracking-widest rounded shadow-md hover:bg-cyan-400 active:scale-95 transition-all"
              >
                Lihat Foto & Video
              </button>
            )}

            <div className="w-full h-[1px] bg-white/10 my-2.5" />

            <span className="text-[9px] opacity-40 font-mono lowercase tracking-wide">
              {namaTempat ? `${namaTempat} • ` : ""}{currentTimeKey}
            </span>
          </div>
        </div>
      )}

      {isHujan && <div className="absolute inset-0 pointer-events-none z-[5] bg-indigo-500/5 mix-blend-overlay rounded-t-[30px] rounded-b-none" />}
    </div>
  );
}