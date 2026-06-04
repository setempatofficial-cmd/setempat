"use client";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { MapPin, ChevronLeft, ChevronRight, Activity } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getIndonesianTimeLabel } from "@/utils/timeUtils";
import OptimizedMedia from "@/components/OptimizedMedia";

// Tetap gunakan logic normalisasi dan cache darimu agar performa terjaga
const normalizeOfficialPhotos = (photos) => {
  if (!photos) return { pagi: [], siang: [], sore: [], malam: [] };
  const result = { pagi: [], siang: [], sore: [], malam: [] };
  const timeKeys = ['pagi', 'siang', 'sore', 'malam'];
  timeKeys.forEach(key => {
    const data = photos[key];
    if (data) {
      if (Array.isArray(data)) result[key] = data;
      else if (typeof data === 'object' && data.url) result[key] = [data];
    }
  });
  return result;
};

const officialPhotosCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

export default function HeroCard({
  tempatId,
  namaTempat,
  status = "LANCAR", // Default status jika tidak ada
  photos = [],
  priority = true
}) {
  const [timeKey, setTimeKey] = useState(() => getIndonesianTimeLabel().toLowerCase());
  const [officialPhotos, setOfficialPhotos] = useState({ pagi: [], siang: [], sore: [], malam: [] });
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const channelRef = useRef(null);

  // Ambil data official photos (Logic tetap sama agar sinkron)
  useEffect(() => {
    async function fetchPhotos() {
      const cached = officialPhotosCache.get(tempatId);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        setOfficialPhotos(cached.data);
        return;
      }
      setIsLoading(true);
      const { data } = await supabase.from('tempat').select('photos').eq('id', tempatId).single();
      if (data?.photos) {
        const normalized = normalizeOfficialPhotos(data.photos);
        setOfficialPhotos(normalized);
        officialPhotosCache.set(tempatId, { data: normalized, timestamp: Date.now() });
      }
      setIsLoading(false);
    }
    if (tempatId) fetchPhotos();
  }, [tempatId]);

  // Gabungkan foto warga & official (Logic useMemo darimu)
  const currentPhotos = useMemo(() => {
    let result = [];
    if (photos.length > 0) {
      result = photos.map(p => ({ url: p.url || p.photo_url, type: 'warga' }));
    } else {
      const timePhotos = officialPhotos[timeKey] || [];
      result = timePhotos.map(p => ({ url: p.url || p, type: 'official' }));
    }
    return result;
  }, [photos, officialPhotos, timeKey]);

  const nextPhoto = (e) => {
    e.stopPropagation();
    setCurrentPhotoIndex((prev) => (prev + 1) % currentPhotos.length);
  };

  if (isLoading && currentPhotos.length === 0) {
    return <div className="w-full aspect-[16/10] bg-zinc-900 animate-pulse rounded-[32px]" />;
  }

  return (
    <div className="relative w-full aspect-[16/10] overflow-hidden rounded-[32px] bg-zinc-950 border border-white/5 shadow-2xl group">
      {/* Media Utama */}
      {currentPhotos.length > 0 ? (
        <OptimizedMedia
          src={currentPhotos[currentPhotoIndex]?.url}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          alt={namaTempat}
          priority={priority}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-zinc-900">
          <MapPin className="text-zinc-700" size={32} />
        </div>
      )}

      {/* Overlay Gelap (Lebih halus agar tidak sumpek) */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

      {/* Konten Informasi (Fokus pada Nama & Status) */}
      <div className="absolute inset-x-0 bottom-0 p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold text-white tracking-tight leading-none">
            {namaTempat}
          </h2>

          <div className="flex items-center gap-2 mt-1">
            {/* Status Indicator */}
            <div className={`px-2.5 py-0.5 rounded-full flex items-center gap-1.5 border ${status === 'LANCAR' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
              'bg-orange-500/10 border-orange-500/20 text-orange-400'
              }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${status === 'LANCAR' ? 'bg-emerald-500' : 'bg-orange-500'} animate-pulse`} />
              <span className="text-[10px] font-bold tracking-widest uppercase">{status}</span>
            </div>
            <span className="text-white/40 text-[10px] font-medium tracking-wide">• Terakhir update 15m lalu</span>
          </div>
        </div>

        {/* Info Ringkas AI (Hanya 1 baris, tidak makan tempat) */}
        <div className="mt-4 flex items-start gap-2 text-white/70 max-w-[85%]">
          <Activity size={14} className="mt-0.5 text-cyan-400 shrink-0" />
          <p className="text-xs leading-relaxed line-clamp-1 italic font-light">
            Lalu lintas lancar di {namaTempat}, aktivitas warga terpantau normal.
          </p>
        </div>
      </div>

      {/* Tombol Detail (Sesuai usulan desain baru) */}
      <button className="absolute bottom-6 right-6 px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 rounded-xl text-white text-xs font-semibold transition-all active:scale-95">
        Lihat Detail →
      </button>

      {/* Navigasi Foto (Lebih kecil) */}
      {currentPhotos.length > 1 && (
        <div className="absolute top-6 inset-x-6 flex justify-between items-center">
          <div className="flex gap-1">
            {currentPhotos.map((_, i) => (
              <div key={i} className={`h-1 rounded-full transition-all duration-300 ${i === currentPhotoIndex ? 'w-6 bg-white' : 'w-2 bg-white/30'}`} />
            ))}
          </div>
          <div className="bg-red-600 px-2 py-0.5 rounded-md text-[9px] font-black text-white tracking-tighter">LIVE</div>
        </div>
      )}
    </div>
  );
}