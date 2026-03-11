"use client";

import { useState, useMemo, useEffect } from "react";
import PhotoSlider from "./PhotoSlider";
import { processFeedItem } from "../../../lib/feedEngine";
import LiveInsight from "./LiveInsight";
import { supabase } from "@/lib/supabaseClient";
import { useClock } from "@/hooks/useClock";

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
  const { currentTime, timeLabel } = useClock();

  // --- LOGIKA ASLI (DIREKAM & DIPERTAHANKAN) ---
  const feed = useMemo(() => {
    if (!item) return {};
    return processFeedItem({ item, comments, locationReady, location });
  }, [item, comments, locationReady, location?.latitude, location?.longitude]);

  const isHujan = useMemo(() => {
    const rainKeywords = ["hujan", "gerimis", "deras", "mendung", "basah", "mantol", "neduh"];
    return feed?.allSignals?.some((sig) =>
      rainKeywords.some((keyword) => sig.text?.toLowerCase().includes(keyword))
    ) ?? false;
  }, [feed?.allSignals]);

  useEffect(() => {
    if (feed?.validationCount) setLocalValidationCount(feed.validationCount);
  }, [feed?.validationCount]);

  useEffect(() => {
    if (typeof window !== "undefined" && item?.id) {
      const hasConfirmed = localStorage.getItem(`sesuai_${item.id}`);
      if (hasConfirmed) setIsSesuai(true);
    }
  }, [item?.id]);

  const commentCount = useMemo(() => {
    const realCount = comments[item?.id]?.length || 0;
    return realCount === 0 ? (item?.id === 1 ? 12 : item?.id === 2 ? 5 : 0) : realCount;
  }, [comments, item?.id]);

  const latestCitizenVoice = useMemo(() => {
    const itemComments = comments[item?.id] || [];
    return itemComments.length > 0 ? itemComments[0] : null;
  }, [comments, item?.id]);

  const handleSesuai = async () => {
    if (isSesuai || !item?.id) return;
    setIsSesuai(true);
    setLocalValidationCount((prev) => prev + 1);
    if (typeof window !== "undefined") localStorage.setItem(`sesuai_${item.id}`, "true");
    try {
      await supabase.from("minat").insert([{ tempat_id: item.id }]);
      setLocalToast({ show: true, message: "Kesaksian dicatat! ✨" });
    } catch (error) { console.error(error); }
    setTimeout(() => setLocalToast({ show: false, message: "" }), 2500);
  };

  const handleShare = async () => {
    if (onShare && item) {
      await onShare(item);
      setLocalToast({ show: true, message: "Link disalin!" });
      setTimeout(() => setLocalToast({ show: false, message: "" }), 2500);
    }
  };

  const theme = useMemo(() => {
    if (isHujan) return { bg: "bg-slate-900", accent: "text-blue-400", border: "border-blue-500/20", gradient: "from-blue-600/40 to-slate-900" };
    if (feed?.isViral) return { bg: "bg-indigo-950", accent: "text-indigo-400", border: "border-indigo-500/20", gradient: "from-indigo-600/40 to-indigo-950" };
    if (feed?.isRamai) return { bg: "bg-orange-950", accent: "text-orange-400", border: "border-orange-500/20", gradient: "from-orange-600/40 to-orange-950" };
    return { bg: "bg-zinc-900", accent: "text-emerald-400", border: "border-emerald-500/20", gradient: "from-emerald-600/40 to-zinc-900" };
  }, [isHujan, feed]);

  const photos = item.photos?.length > 0 ? item.photos : [item.image_url || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500"];
  const fullAddress = item.alamat ? item.alamat.split(",").slice(0, 2).join(", ") : "Lokasi tidak tertera";

  return (
    <div className={`group relative mx-3 mb-6 overflow-hidden rounded-[40px] ${theme.bg} border ${theme.border} shadow-2xl transition-all duration-500`}>
      
      {/* 1. PHOTO SECTION (Bisa di-slide) */}
      <div className="relative aspect-[16/11] w-full overflow-hidden">
        <PhotoSlider
          photos={photos}
          itemId={item.id}
          selectedPhotoIndex={selectedPhotoIndex?.[item.id] || 0}
          setSelectedPhotoIndex={setSelectedPhotoIndex}
          isRamai={feed?.isRamai}
          isViral={feed?.isViral}
        />

        {/* Overlay Konten (Dibuat pointer-events-none agar Slider di bawahnya bisa di-slide) */}
        <div className="absolute inset-0 pointer-events-none">
          <div className={`absolute inset-0 bg-gradient-to-t ${theme.gradient} via-transparent to-black/40`} />
          
          {/* Header Jarak & Jam */}
          <div className="absolute inset-x-5 top-5 flex justify-between items-start">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute h-full w-full rounded-full bg-rose-500 opacity-75"></span>
                  <span className="relative rounded-full h-1.5 w-1.5 bg-rose-500"></span>
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest text-white">{timeLabel}</span>
              </div>
              {locationReady && feed?.distance !== null && (
                <span className="text-[10px] font-bold text-white/90 drop-shadow-md px-1">
                  📍 {feed.distance < 1 ? `${(feed.distance * 1000).toFixed(0)}m` : `${feed.distance.toFixed(1)}km`} dari anda
                </span>
              )}
            </div>
            <span className="bg-white/10 backdrop-blur-md text-white/60 text-[8px] font-black px-2 py-1 rounded-lg border border-white/5 uppercase tracking-tighter">
              {item.category || item.kategori}
            </span>
          </div>

          {/* Headline Narasi & Alamat */}
          <div className="absolute inset-x-6 bottom-6">
            <div className="flex items-center gap-4">
              <div className="text-4xl drop-shadow-2xl">
                {isHujan ? "⛈️" : feed?.headline?.icon || "📍"}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-[20px] font-black italic leading-tight text-white drop-shadow-lg">
                  {isHujan ? "Lagi Basah, Sedia Mantel." : `"${feed?.narasiCerita}"`}
                </h2>
                <div className="mt-1 flex flex-col">
                  <p className="text-[11px] font-black uppercase tracking-widest text-white/80">{item.name}</p>
                  <p className="truncate text-[9px] font-medium italic text-white/60">🗺️ {fullAddress}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. DATA SECTION (Pulse Monitor & Suara Warga) */}
      <div className="px-5 py-5 space-y-6">
        
        {/* Pulse Monitor (DIKEMBALIKAN) */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-white/10" />
            <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${theme.accent}`}>Pulse Monitor</span>
            <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-white/10" />
          </div>
          <div className="rounded-2xl bg-white/[0.03] p-1 border border-white/[0.05]">
            <LiveInsight signals={feed?.allSignals || []} />
          </div>
        </div>

        {/* Laporan Warga */}
        <div className="rounded-2xl bg-white/[0.02] border border-white/[0.05] p-4 transition-all hover:bg-white/[0.04]">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Laporan Lapangan</span>
            {latestCitizenVoice?.source && (
              <span className="text-[8px] font-bold text-zinc-600 italic uppercase">via {latestCitizenVoice.source}</span>
            )}
          </div>
          {latestCitizenVoice ? (
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[10px] border border-white/10">👤</div>
              <p className="text-[12px] leading-relaxed text-zinc-300">
                <span className="font-bold text-white">{latestCitizenVoice.user}</span>: "{latestCitizenVoice.text}"
              </p>
            </div>
          ) : (
            <p className="text-[11px] italic text-zinc-600">Belum ada laporan langsung dari lapangan.</p>
          )}
        </div>
      </div>

      {/* 3. ACTION BAR (Fitur Berbagi DIKEMBALIKAN) */}
      <div className="flex items-center gap-2 border-t border-white/[0.05] bg-black/20 p-5">
        <button
          onClick={() => openAIModal?.(item)}
          className="flex-[2.5] flex items-center justify-center gap-2 rounded-2xl bg-white py-4 text-black shadow-xl active:scale-95 transition-all"
        >
          <span className="text-[11px] font-black uppercase tracking-widest">✨ Tanya AI</span>
        </button>

        <button
          onClick={handleSesuai}
          disabled={isSesuai}
          className={`flex-1 flex flex-col items-center justify-center rounded-2xl border py-2 transition-all ${
            isSesuai ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400" : "border-white/10 bg-white/5 text-zinc-500 active:bg-white/10"
          }`}
        >
          <span className="text-xl">{isSesuai ? "🛡️" : "💛"}</span>
          <span className="text-[8px] font-black uppercase tracking-tighter">
            {localValidationCount >= 5 ? "Valid" : "Sesuai"}
          </span>
        </button>

        <button
          onClick={() => openKomentarModal?.(item)}
          className="relative flex-1 flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5 py-2 text-zinc-500 active:bg-white/10"
        >
          {commentCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[8px] font-black text-white ring-2 ring-zinc-900">
              {commentCount}
            </span>
          )}
          <span className="text-xl">💬</span>
          <span className="text-[8px] font-black uppercase tracking-tighter">Warga</span>
        </button>

        {/* Tombol Berbagi (DIKEMBALIKAN) */}
        <button
          onClick={handleShare}
          className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-zinc-500 transition-colors active:scale-90"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92c0-1.61-1.31-2.92-2.92-2.92z" /></svg>
        </button>
      </div>
    </div>
  );
}