"use client";

import { useState, useMemo, useEffect } from "react";
import PhotoSlider from "./PhotoSlider";
import { processFeedItem } from "../../../lib/feedEngine";
import LiveInsight from "./LiveInsight";
import { supabase } from "@/lib/supabaseClient";
import { useClock } from "@/hooks/useClock";
import FeedActions from "./FeedActions";

export default function FeedCard({
  item,
  locationReady,
  location,
  comments = {},
  selectedPhotoIndex,
  setSelectedPhotoIndex,
  openAIModal,
  openKomentarModal,
  onShare,
}) {
  const [localToast, setLocalToast] = useState({ show: false, message: "" });
  const [isSesuai, setIsSesuai] = useState(false);
  const [localValidationCount, setLocalValidationCount] = useState(0);
  const { timeLabel } = useClock();

  // 1. DATA PROCESSING
  const feed = useMemo(() => {
    if (!item) return {};
    return processFeedItem({ item, comments, locationReady, location });
  }, [item, comments, locationReady, location?.latitude, location?.longitude]);

  const photoUrls = useMemo(() => {
    const allPhotos = Array.isArray(item?.photos) ? item.photos : [];
    const matching = allPhotos.filter(p => p.waktu?.toLowerCase() === timeLabel?.toLowerCase());
    if (matching.length > 0) return matching.map(p => p.url);
    return [item?.image_url || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500"];
  }, [item?.photos, item?.image_url, timeLabel]);

  const currentIndex = selectedPhotoIndex?.[item?.id] || 0;
  const isHujan = feed?.isHujan || false;

  // 2. THEME LOGIC (Clean Mode: statusText null untuk kondisi normal)
  const theme = useMemo(() => {
    const isDekat = locationReady && feed?.distance !== null && feed.distance < 1;
    if (isHujan) return { bg: "bg-slate-900", accent: "text-blue-400", border: "border-blue-500/20", gradient: "from-blue-600/40 to-slate-900", statusText: "Hujan", statusColor: "bg-blue-500" };
    if (feed?.isViral) return { bg: "bg-indigo-950", accent: "text-indigo-400", border: "border-indigo-500/20", gradient: "from-indigo-600/40 to-indigo-950", statusText: "Viral", statusColor: "bg-rose-500" };
    if (isDekat) return { bg: "bg-emerald-950", accent: "text-emerald-400", border: "border-emerald-500/20", gradient: "from-emerald-600/40 to-emerald-950", statusText: "Sangat Dekat", statusColor: "bg-emerald-400" };
    return { bg: "bg-zinc-900", accent: "text-zinc-400", border: "border-zinc-800/50", gradient: "from-zinc-800/40 to-zinc-900", statusText: null, statusColor: "bg-zinc-500" };
  }, [feed, locationReady, isHujan]);

  // 3. EFFECTS & HANDLERS

useEffect(() => {
  if (typeof window !== "undefined" && item?.id) {
    const savedTime = localStorage.getItem(`sesuai_${item.id}`);
    if (savedTime) {
      const threeHours = 3 * 60 * 60 * 1000; // 3 Jam dalam milidetik
      const isExpired = new Date().getTime() - parseInt(savedTime) > threeHours;

      if (!isExpired) {
        setIsSesuai(true);
      } else {
        localStorage.removeItem(`sesuai_${item.id}`);
        setIsSesuai(false);
      }
    }
  }
}, [item?.id]);

const handleSesuai = async () => {
  if (isSesuai || !item?.id) return;
  
  const now = new Date().getTime(); // Ambil waktu sekarang
  setIsSesuai(true);
  setLocalValidationCount(prev => prev + 1);
  localStorage.setItem(`sesuai_${item.id}`, now.toString()); // Simpan timestamp

  try { 
    await supabase.from("minat").insert([{ tempat_id: item.id }]);
    setLocalToast({ show: true, message: "Informasi Disahkan! 💮" }); 
  } catch (e) { console.error(e); }
  
  setTimeout(() => setLocalToast({ show: false, message: "" }), 2500);
};

  const handleShare = async () => {
    if (onShare && item) {
      await onShare(item);
      setLocalToast({ show: true, message: "Link disalin!" });
      setTimeout(() => setLocalToast({ show: false, message: "" }), 2500);
    }
  };

  const fullAddress = item?.alamat ? item.alamat.split(",").slice(0, 2).join(", ") : "Lokasi tidak tertera";

  return (
    <div className={`group relative mx-0 sm:mx-3 mb-6 overflow-hidden rounded-none sm:rounded-[40px] ${theme.bg} border-y sm:border ${theme.border} shadow-2xl transition-all duration-500`}>
      
      {/* PHOTO SECTION */}
      <div className="relative aspect-[16/11] w-full overflow-hidden">
        <PhotoSlider
          photos={photoUrls}
          itemId={item?.id}
          selectedPhotoIndex={currentIndex}
          setSelectedPhotoIndex={setSelectedPhotoIndex}
          isRamai={feed?.isRamai}
          isViral={feed?.isViral}
          isHujan={isHujan}
        />

        <div className="absolute inset-0 pointer-events-none">
          <div className={`absolute inset-0 bg-gradient-to-t ${theme.gradient} via-transparent to-black/40`} />
          
          {/* BADGE POJOK (Hanya muncul jika Urgent) */}
          <div className="absolute inset-x-5 top-5 flex justify-between items-start">
            {theme.statusText ? (
              <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 shadow-lg">
                <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute h-full w-full rounded-full ${theme.statusColor} opacity-75`}></span>
                  <span className={`relative rounded-full h-2 w-2 ${theme.statusColor}`}></span>
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider text-white">{theme.statusText}</span>
              </div>
            ) : <div />}

            {photoUrls.length > 1 && (
              <div className="bg-black/40 backdrop-blur-md text-white text-[10px] font-black px-3 py-1 rounded-full border border-white/10">
                {currentIndex + 1} / {photoUrls.length}
              </div>
            )}
          </div>

          {/* CAPTION OVERLAY */}
          <div className="absolute inset-x-6 bottom-6">
            {currentIndex === 0 ? (
              <div className="flex items-center gap-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="text-4xl drop-shadow-2xl">{isHujan ? "⛈️" : feed?.headline?.icon || "📍"}</div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[20px] font-black italic leading-tight text-white drop-shadow-lg">
                    {isHujan ? "Lagi Basah, Sedia Mantel." : `"${feed?.narasiCerita || item?.name}"`}
                  </h2>
                </div>
              </div>
            ) : (
              <p className="inline-block bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-xl text-[11px] leading-relaxed text-white border border-white/10 shadow-lg">
                💬 Slide {currentIndex + 1}
              </p>
            )}
            
            <div className="mt-2 flex flex-col">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="bg-white/20 backdrop-blur-md text-white text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-tighter border border-white/10">
                  {item?.category || "Umum"}
                </span>
                <p className="text-[11px] font-black uppercase tracking-widest text-white/90">{item?.name}</p>
              </div>
              <p className="truncate text-[9px] font-medium italic text-white/60 px-1">🗺️ {fullAddress}</p>
            </div>
          </div>
        </div>
      </div>

      {/* DATA SECTION */}
      <div className="px-5 py-5 space-y-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-white/10" />
            <div className="flex flex-col items-center">
              <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${theme.accent}`}>
                Pantauan {timeLabel} Ini
              </span>
              {locationReady && feed?.distance !== null && (
                <span className="text-[8px] font-medium text-zinc-500 tracking-widest uppercase mt-0.5">
                  Jarak {feed.distance < 1 ? `${(feed.distance * 1000).toFixed(0)}m` : `${feed.distance.toFixed(1)}km`} dari Anda
                </span>
              )}
            </div>
            <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-white/10" />
          </div>
          
          <div className="rounded-2xl bg-white/[0.03] p-1 border border-white/[0.05]">
            <LiveInsight signals={feed?.allSignals || []} />
          </div>
        </div>

        {/* CITIZEN VOICE */}
        <div className="rounded-2xl bg-white/[0.02] border border-white/[0.05] p-4">
          <div className="mb-3 flex items-center justify-between text-zinc-500 text-[9px] font-black uppercase tracking-widest">
            <span>Kata Warga Setempat</span>
          </div>
          {feed?.allSignals?.[0] ? (
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[10px] border border-white/10">👤</div>
              <p className="text-[12px] leading-relaxed text-zinc-300">
                <span className="font-bold text-white">{feed.allSignals[0].username}</span>: "{feed.allSignals[0].text}"
              </p>
            </div>
          ) : (
            <p className="text-[11px] italic text-zinc-600">Belum ada laporan langsung.</p>
          )}
        </div>
      </div>

      {/* ACTION BAR */}
      <div className="px-5 pb-5">
        <FeedActions
          item={item}
          comments={comments}
          openAIModal={openAIModal}
          openKomentarModal={openKomentarModal}
          onShare={handleShare}
          handleSesuai={handleSesuai} 
          isSesuai={isSesuai}
        />
      </div>


      {localToast.show && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-white text-black px-6 py-3 rounded-full font-bold shadow-2xl z-[100] animate-in fade-in slide-in-from-bottom-4">
          {localToast.message}
        </div>
      )}
    </div>
  );
}