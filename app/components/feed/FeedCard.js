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

  // 1. DATA PROCESSING (Tetap Sama)
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

  // 2. THEME LOGIC (Simplified for Elegance)
  const theme = useMemo(() => {
    const isDekat = locationReady && feed?.distance !== null && feed.distance < 1;
    if (isHujan) return { bg: "bg-[#0a1120]/80", accent: "text-blue-400", border: "border-blue-500/20", statusText: "Hujan", statusColor: "bg-blue-500" };
    if (feed?.isViral) return { bg: "bg-[#120c1d]/80", accent: "text-rose-400", border: "border-rose-500/20", statusText: "Viral", statusColor: "bg-rose-500" };
    if (isDekat) return { bg: "bg-[#061410]/80", accent: "text-emerald-400", border: "border-emerald-500/20", statusText: "Sangat Dekat", statusColor: "bg-emerald-400" };
    return { bg: "bg-zinc-900/40", accent: "text-zinc-400", border: "border-white/5", statusText: null, statusColor: "bg-zinc-500" };
  }, [feed, locationReady, isHujan]);

  // 3. EFFECTS & HANDLERS (Tetap Sama)
  useEffect(() => {
    if (typeof window !== "undefined" && item?.id) {
      const savedTime = localStorage.getItem(`sesuai_${item.id}`);
      if (savedTime) {
        const threeHours = 3 * 60 * 60 * 1000;
        const isExpired = new Date().getTime() - parseInt(savedTime) > threeHours;
        if (!isExpired) setIsSesuai(true);
        else localStorage.removeItem(`sesuai_${item.id}`);
      }
    }
  }, [item?.id]);

  const handleSesuai = async () => {
    if (isSesuai || !item?.id) return;
    const now = new Date().getTime();
    setIsSesuai(true);
    setLocalValidationCount(prev => prev + 1);
    localStorage.setItem(`sesuai_${item.id}`, now.toString());
    try {
      await supabase.from("minat").insert([{ tempat_id: item.id }]);
      setLocalToast({ show: true, message: "Laporan Terverifikasi 💮" });
    } catch (e) { console.error(e); }
    setTimeout(() => setLocalToast({ show: false, message: "" }), 2500);
  };

  const fullAddress = item?.alamat ? item.alamat.split(",").slice(0, 2).join(", ") : "Lokasi tidak tertera";

  return (
    <div className={`group relative mx-4 mb-8 overflow-hidden rounded-[32px] 
      ${theme.bg} backdrop-blur-2xl border ${theme.border} 
      shadow-[0_20px_50px_rgba(0,0,0,0.3)] transition-all duration-500`}>
      
      {/* PHOTO SECTION */}
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        <PhotoSlider
          photos={photoUrls}
          itemId={item?.id}
          selectedPhotoIndex={currentIndex}
          setSelectedPhotoIndex={setSelectedPhotoIndex}
        />

        {/* TOP OVERLAY BUBBLES */}
        <div className="absolute top-4 inset-x-4 flex justify-between items-start pointer-events-none">
          {theme.statusText && (
            <div className="flex items-center gap-2 bg-black/40 backdrop-blur-xl px-3 py-1.5 rounded-full border border-white/10">
              <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white">{theme.statusText}</span>
            </div>
          )}
          {photoUrls.length > 1 && (
            <div className="ml-auto bg-black/30 backdrop-blur-md text-[10px] font-bold px-3 py-1 rounded-full text-white/90 border border-white/5">
              {currentIndex + 1} / {photoUrls.length}
            </div>
          )}
        </div>

        {/* HEADLINE OVERLAY */}
        <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="bg-white/10 text-white/70 text-[8px] font-black px-1.5 py-0.5 rounded tracking-tighter uppercase">
                {item?.category || "Umum"}
              </span>
              <p className="text-[10px] font-bold text-white/50 tracking-widest uppercase truncate">{item?.name}</p>
            </div>
            {/* --- TAMBAHKAN ALAMAT DI SINI --- */}
    <p className="text-[10px] text-white/40 font-medium -mt-1 flex items-center gap-1">
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      {fullAddress}
    </p>
            <h2 className="text-2xl font-bold leading-tight text-white tracking-tight">
              {isHujan ? "⛈️ Sedia payung, sedang hujan." : (feed?.narasiCerita || item?.name)}
            </h2>
          </div>
        </div>
      </div>

      {/* DATA & INSIGHT SECTION */}
      <div className="p-6 space-y-6">
        
        {/* DISTANCE & TIME */}
        <div className="flex items-end justify-between border-b border-white/5 pb-4">
          <div className="space-y-1">
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500">Suasana Terkini</p>
            <p className="text-sm font-bold text-white uppercase tracking-tighter">{timeLabel} Ini</p>
          </div>
          {locationReady && feed?.distance !== null && (
            <div className="text-right">
              <p className={`text-lg font-black tracking-tighter ${theme.accent}`}>
                {feed.distance < 1 ? `${(feed.distance * 1000).toFixed(0)}m` : `${feed.distance.toFixed(1)}km`}
              </p>
              <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Dari Anda</p>
            </div>
          )}
        </div>

        {/* LIVE SIGNALS */}
        <div className="bg-white/[0.03] rounded-3xl p-2 border border-white/[0.05]">
          <LiveInsight signals={feed?.allSignals || []} />
        </div>

        {/* CITIZEN COMMENT (Minimalist Style) */}
        {feed?.allSignals?.[0] && (
          <div className="flex gap-4 items-start bg-white/[0.02] p-4 rounded-[24px] border border-white/5">
            <div className="w-10 h-10 rounded-2xl bg-zinc-800 flex items-center justify-center text-xs font-black border border-white/10 uppercase shrink-0">
              {feed.allSignals[0].username[0]}
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black text-zinc-500">@{feed.allSignals[0].username}</p>
              <p className="text-[13px] text-zinc-300 leading-snug">
                {feed.allSignals[0].text}
              </p>
            </div>
          </div>
        )}

        {/* ACTION BAR */}
        <div className="pt-2">
          <FeedActions
            item={item}
            comments={comments}
            openAIModal={openAIModal}
            openKomentarModal={openKomentarModal}
            onShare={onShare}
            handleSesuai={handleSesuai} 
            isSesuai={isSesuai}
          />
        </div>
      </div>

      {/* TOAST (Mewah) */}
      {localToast.show && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-white text-black px-6 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-2xl z-[100] animate-in fade-in slide-in-from-bottom-4">
          {localToast.message}
        </div>
      )}
    </div>
  );
}