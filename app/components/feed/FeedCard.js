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

  // 1. Logic Feed Engine - DIPERBAIKI: Memantau latitude & longitude secara spesifik
  const feed = useMemo(() => {
    if (!item) return {};
    return processFeedItem({ item, comments, locationReady, location });
  }, [
    item, 
    comments, 
    locationReady, 
    location?.latitude, // Trigger recalculate saat koordinat didapat
    location?.longitude 
  ]);

  // 2. Logic Cuaca
  const isHujan = useMemo(() => {
    const rainKeywords = ["hujan", "gerimis", "deras", "mendung", "basah", "mantol", "neduh"];
    return (
      feed?.allSignals?.some((sig) =>
        rainKeywords.some((keyword) => sig.text?.toLowerCase().includes(keyword))
      ) ?? false
    );
  }, [feed?.allSignals]);

  // 3. Sync Validation & LocalStorage
  useEffect(() => {
    if (feed?.validationCount) setLocalValidationCount(feed.validationCount);
  }, [feed?.validationCount]);

  useEffect(() => {
    if (typeof window !== "undefined" && item?.id) {
      const hasConfirmed = localStorage.getItem(`sesuai_${item.id}`);
      if (hasConfirmed) setIsSesuai(true);
    }
  }, [item?.id]);

  // 4. Logic Comment Count
  const commentCount = useMemo(() => {
    const realCount = comments[item?.id]?.length || 0;
    if (realCount === 0) {
      if (item?.id === 1) return 12;
      if (item?.id === 2) return 5;
      return 0;
    }
    return realCount;
  }, [comments, item?.id]);

  // 5. Handlers
  const handleSesuai = async () => {
    if (isSesuai || !item?.id) return;
    setIsSesuai(true);
    setLocalValidationCount((prev) => prev + 1);
    if (typeof window !== "undefined") {
      localStorage.setItem(`sesuai_${item.id}`, "true");
    }
    try {
      await supabase.from("minat").insert([{ tempat_id: item.id }]);
      setLocalToast({ show: true, message: "Kesaksianmu tersimpan! ✨" });
    } catch (error) {
      console.error("Error saving interest:", error);
    }
    setTimeout(() => setLocalToast({ show: false, message: "" }), 2500);
  };

  const handleShare = async () => {
    if (onShare && item) {
      await onShare(item);
      setLocalToast({ show: true, message: "Link disalin!" });
      setTimeout(() => setLocalToast({ show: false, message: "" }), 2500);
    }
  };

  // 6. Theme Config
  const headerTheme = useMemo(() => {
    if (isHujan) return "from-slate-700 to-blue-900 shadow-blue-200/50";
    if (feed?.isViral) return "from-indigo-600 to-violet-700 shadow-indigo-200";
    if (feed?.isRamai) return "from-amber-500 to-orange-600 shadow-orange-200";
    return "from-emerald-500 to-teal-600 shadow-emerald-200";
  }, [feed?.isViral, feed?.isRamai, isHujan]);

  const photos =
    item.photos?.length > 0
      ? item.photos
      : item.image_url
      ? [item.image_url]
      : ["https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500"];

  const fullAddress = item.alamat
    ? item.alamat.split(",").slice(0, 2).join(", ")
    : "Lokasi tidak tertera";

  return (
    <div className="group bg-white rounded-[32px] overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-500 mb-10 mx-2 relative">
      {/* 1. TOP BAR */}
      <div className="px-6 pt-5 pb-3 flex justify-between items-start">
        <div className="flex flex-col gap-1 text-left">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-rose-400"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
            </span>
            <span className="text-[12px] font-black uppercase tracking-[0.15em] leading-none text-rose-600">
              {isHujan ? "Kabar Cuaca" : "Live Setempat"}
            </span>
          </div>
          {/* DIPERBAIKI: Logika tampilan jarak agar lebih konsisten */}
          {locationReady && feed?.distance !== null && (
            <span className="text-[11px] font-bold tracking-tight text-slate-400 animate-in fade-in slide-in-from-left-2 duration-700">
              📍 {feed.distance < 1
                ? `${(feed.distance * 1000).toFixed(0)}m`
                : `${feed.distance.toFixed(1)}km`} dari sini
            </span>
          )}
        </div>
        {(item.category || item.kategori) && (
          <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">
            {item.category || item.kategori}
          </span>
        )}
      </div>

      {/* 2. HEADLINE */}
      <div className="px-4 mb-4 text-left">
        <div className={`relative overflow-hidden bg-gradient-to-br ${headerTheme} rounded-2xl p-5 shadow-md`}>
          <div className="relative flex items-center gap-4 z-10">
            <div className="text-3xl bg-white/20 backdrop-blur-md w-14 h-14 flex items-center justify-center rounded-xl border border-white/20 text-white shrink-0">
              {isHujan ? "⛈️" : feed?.headline?.icon || "📍"}
            </div>
            <div className="flex-1">
              <h2 className="text-white text-[13px] font-black uppercase tracking-widest opacity-80 leading-none">
                {isHujan ? "Gerimis Syahdu" : feed?.headline?.text || "Kabar Terkini"}
              </h2>
              <p className="text-white text-[17px] font-bold italic mt-1 leading-snug">
                {isHujan
                  ? "Pasuruan lagi basah, sedia mantel dulu lur."
                  : `"${feed?.narasiCerita || "Lagi tenang, pas buat mulai hari ini"}"`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. PHOTOS */}
      <div className="px-4">
        <div className="rounded-2xl overflow-hidden shadow-lg transition-transform duration-700 group-hover:scale-[1.01]">
          <PhotoSlider
            photos={photos}
            itemId={item.id}
            selectedPhotoIndex={selectedPhotoIndex?.[item.id] || 0}
            setSelectedPhotoIndex={setSelectedPhotoIndex}
            isRamai={feed?.isRamai}
            isViral={feed?.isViral}
          />
        </div>
      </div>

      {/* 4. INFO & INSIGHT */}
      <div className="px-6 mt-5 text-left">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1 pr-2">
            <h4 className="text-[12px] font-bold text-gray-500 leading-tight tracking-tight">
              {item.name}
            </h4>
            <p className="text-[10px] text-gray-400 font-medium italic mt-0.5">🗺️ {fullAddress}</p>
          </div>
          <div
            className={`px-3 py-1.5 rounded-xl border font-black text-[10px] uppercase tracking-tighter ${
              isHujan ? "bg-blue-50 text-blue-600 border-blue-200" : feed?.badgeColor || "bg-gray-50"
            }`}
          >
            {isHujan ? "☕ Cocok Neduh" : feed?.badgeStatus}
          </div>
        </div>

        <div className="relative mb-6">
          <div className="flex items-center gap-2 mb-2 ml-1">
            <span className="flex h-1.5 w-1.5 rounded-full bg-rose-600 animate-pulse"></span>
            <span className="text-[10px] font-black text-rose-600 uppercase tracking-[0.2em]">
              Kondisi {timeLabel} Ini
            </span>
          </div>
          <LiveInsight signals={feed?.allSignals || []} />
        </div>
      </div>

      {/* 5. INTERACTIVE ACTION BAR */}
      <div className="px-6 py-6 bg-gray-50/80 border-t border-gray-100 backdrop-blur-md">
        <div className="flex flex-col gap-4">
          <button
            onClick={() => openAIModal?.(item)}
            className="w-full flex items-center justify-between px-6 py-4 bg-gradient-to-r from-indigo-600 to-violet-700 text-white rounded-2xl shadow-lg active:scale-[0.98] transition-all group"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl group-hover:rotate-12 transition-transform">✨</span>
              <div className="text-left">
                <p className="text-[13px] font-black uppercase tracking-wider leading-none">Tanya AI Warga</p>
                <p className="text-[9px] opacity-70 font-bold uppercase mt-1 leading-none">
                  Cek kondisi real-time via AI
                </p>
              </div>
            </div>
            <div className="bg-white/20 p-2 rounded-lg">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
            </div>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSesuai}
              disabled={isSesuai}
              className={`flex-1 flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-2xl border transition-all ${
                isSesuai
                  ? "bg-emerald-50 border-emerald-100 text-emerald-600"
                  : "bg-white border-gray-200 text-gray-500 shadow-sm active:scale-95"
              }`}
            >
              <span className="text-xl">{isSesuai ? "🛡️" : "✨"}</span>
              <div className="flex flex-col items-start leading-none text-left">
                <span className="text-[11px] font-black uppercase tracking-tighter">
                  {isSesuai ? "Terverifikasi" : "Sesuai?"}
                </span>
                <p className="text-[8px] font-bold mt-1 opacity-60 uppercase tracking-tighter">Kesaksian</p>
              </div>
            </button>

            <button
              onClick={() => openKomentarModal?.(item)}
              className="relative flex-1 flex items-center justify-center gap-2.5 px-4 py-3.5 bg-white border border-gray-200 rounded-2xl shadow-sm active:scale-95 transition-all text-gray-500"
            >
              {commentCount > 0 && (
                <div className="absolute -top-3 -right-1 z-20">
                  <span className="absolute inset-0 rounded-full bg-rose-500 animate-ping opacity-40"></span>
                  <div className="relative bg-rose-600 text-white text-[10px] font-black min-w-[22px] h-[22px] px-1.5 flex items-center justify-center rounded-full border-2 border-white shadow-md animate-bounce">
                    {commentCount}
                  </div>
                </div>
              )}
              <span className="text-xl">💬</span>
              <div className="flex flex-col items-start leading-none text-left">
                <span className="text-[11px] font-black uppercase tracking-tighter">Obrolan</span>
                <p className="text-[8px] font-bold mt-1 opacity-60 uppercase tracking-tighter">
                  {commentCount > 0 ? `${commentCount} Warga` : "Belum Ada"}
                </p>
              </div>
            </button>

            <button
              onClick={handleShare}
              className="p-4 bg-white border border-gray-200 rounded-2xl shadow-sm text-gray-400 active:scale-90 hover:text-indigo-600"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92c0-1.61-1.31-2.92-2.92-2.92z" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* TOAST */}
      <div
        className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] transition-all duration-500 transform ${
          localToast.show ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0 pointer-events-none"
        }`}
      >
        <div className="bg-gray-900/90 backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/10">
          <div className="w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center text-[8px]">✓</div>
          <span className="text-[10px] font-bold uppercase tracking-widest">{localToast.message}</span>
        </div>
      </div>
    </div>
  );
}