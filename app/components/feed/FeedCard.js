"use client";

import { useState, useMemo, useEffect } from "react";
import PhotoSlider from "./PhotoSlider";
import { processFeedItem } from "../../../lib/feedEngine";
import LiveInsight from "./LiveInsight";
import { supabase } from "@/lib/supabaseClient"; 

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
  
  const feed = useMemo(() => {
    return processFeedItem({ item, comments, locationReady, location });
  }, [item, comments, locationReady, location]);

  const [localValidationCount, setLocalValidationCount] = useState(feed.validationCount || 0);

  useEffect(() => {
    const hasConfirmed = localStorage.getItem(`sesuai_${item.id}`);
    if (hasConfirmed) setIsSesuai(true);
  }, [item.id]);

  const handleSesuai = async () => {
    if (isSesuai) return;
    setIsSesuai(true);
    setLocalValidationCount(prev => prev + 1);
    localStorage.setItem(`sesuai_${item.id}`, "true");
    await supabase.from('minat').insert([{ tempat_id: item.id }]);
    setLocalToast({ show: true, message: "Kesaksianmu tersimpan! ✨" });
    setTimeout(() => setLocalToast({ show: false, message: "" }), 2500);
  };

  const handleShare = async () => {
    if (onShare) {
      await onShare(item);
      setLocalToast({ show: true, message: "Link disalin!" });
      setTimeout(() => setLocalToast({ show: false, message: "" }), 2500);
    }
  };

  const headerTheme = useMemo(() => {
    if (feed.isViral) return "from-indigo-600 to-violet-700 shadow-indigo-200";
    if (feed.isRamai) return "from-amber-500 to-orange-600 shadow-orange-200";
    return "from-emerald-500 to-teal-600 shadow-emerald-200";
  }, [feed.isViral, feed.isRamai]);

  if (!item) return null;

  const photos = item.photos?.length > 0 ? item.photos : 
                 (item.image_url ? [item.image_url] : ["https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500"]);

  const commentCount = comments[item.id]?.length || 0;

  const fullAddress = useMemo(() => {
    if (!item.alamat) return "Lokasi tidak tertera";
    const parts = item.alamat.split(',').map(p => p.trim());
    return parts.slice(0, 2).join(', ');
  }, [item.alamat]);

  return (
    <div className="group bg-white rounded-[32px] overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-500 mb-10 mx-2 relative">
      
      {/* 1. TOP BAR (Live + Jarak) */}
      <div className="px-6 pt-5 pb-3 flex justify-between items-start">
        <div className="flex flex-col gap-0.5 text-left">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${feed.isRamai ? 'bg-orange-400' : 'bg-emerald-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${feed.isRamai ? 'bg-orange-500' : 'bg-emerald-500'}`}></span>
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400 leading-none">Live Setempat</span>
          </div>
          
          {locationReady && feed.distance && (
            <span className="text-[11px] font-black text-indigo-600 tracking-tighter italic animate-in fade-in slide-in-from-left-2 duration-700">
              📍 {
                parseFloat(feed.distance) < 1 
                  ? `${(parseFloat(feed.distance) * 1000).toFixed(0)}m` 
                  : `${parseFloat(feed.distance).toFixed(1)}km`
              } dari Lokasimu
            </span>
          )}
        </div>

        {(item.category || item.kategori) && (
          <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">
            {item.category || item.kategori}
          </span>
        )}
      </div>

      {/* 2. HEADLINE & NARASI */}
      <div className="px-4 mb-4 text-left">
        <div className={`relative overflow-hidden bg-gradient-to-br ${headerTheme} rounded-2xl p-5 shadow-md`}>
          <div className="relative flex items-center gap-4">
            <div className="text-3xl bg-white/20 backdrop-blur-md w-14 h-14 flex items-center justify-center rounded-xl border border-white/20 text-white shadow-inner shrink-0">
              {feed.headline?.icon || "📍"}
            </div>
            <div className="flex-1">
              <h2 className="text-white text-[17px] font-bold leading-tight tracking-tight italic">
                {feed.headline?.text || "Kabar Terkini"}
              </h2>
              <span className="text-[10px] font-medium text-white/90 italic mt-1 block tracking-tight">
                {feed.narasiCerita}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. PHOTOS */}
      <div className="px-4">
        <div className="rounded-2xl overflow-hidden shadow-lg group-hover:scale-[1.01] transition-transform duration-700">
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

      {/* 4. INFO UTAMA & AKTIVITAS WARGA */}
      <div className="px-6 mt-5 text-left">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1 pr-2">
            <h4 className="text-xl font-black text-gray-900 tracking-tighter leading-tight italic">
              {item.name}
            </h4>
            <div className="mt-1.5 flex flex-col gap-1">
              <p className="text-[11px] text-gray-500 font-bold italic leading-tight">
                🗺️ {fullAddress}
              </p>
              <div className="inline-flex items-center gap-1.5 bg-indigo-50 w-fit px-2 py-1 rounded-md border border-indigo-100/50">
                <span className="text-[9px] font-black text-indigo-600 uppercase tracking-tighter">
                  🔥 {feed.viewingCount} Aktivitas Warga Terbaru
                </span>
              </div>
            </div>
          </div>
          
          <div className={`px-3 py-1.5 rounded-xl border font-black text-[10px] uppercase tracking-tighter shadow-sm shrink-0 mt-1 ${feed.badgeColor}`}>
              {feed.badgeStatus}
          </div>
        </div>
        
        <LiveInsight signals={feed.allSignals} />
        <div className="h-6"></div>

        {/* HORIZONTAL SIGNALS (Medsos + AI + Internal) */}
        <div className="relative -mx-6 overflow-hidden">
          <div className="flex overflow-x-auto pb-6 px-6 gap-3 snap-x no-scrollbar">
            {feed.allSignals?.map((msg, i) => (
              <div key={i} className="flex-shrink-0 w-[240px] snap-center bg-gray-50 rounded-2xl p-4 border border-gray-100 flex flex-col justify-between relative overflow-hidden">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <img src={msg.avatar} className="w-8 h-8 rounded-lg bg-white border border-gray-100 object-cover" alt="user" />
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5 text-left text-gray-900">
                        <span className="text-[11px] font-black leading-none">@{msg.username}</span>
                        {msg.isLive && (
                           <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute h-full w-full rounded-full bg-rose-400 opacity-75"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500"></span></span>
                        )}
                      </div>
                      <span className="text-[9px] text-indigo-500 font-bold uppercase mt-1 tracking-tighter italic">{msg.platformLabel}</span>
                    </div>
                  </div>
                  <p className="text-[13px] text-gray-600 font-medium leading-relaxed italic line-clamp-3 text-left">“{msg.text}”</p>
                </div>
                <div className="mt-3 text-[9px] font-black text-gray-400 uppercase tracking-widest border-t border-gray-200/50 pt-2 flex justify-between items-center">
                  <span>{msg.timeAgo}</span>
                  <span className="opacity-40 text-xs">📱</span>
                </div>
              </div>
            ))}

            <div onClick={() => openAIModal(item)} className="flex-shrink-0 w-[240px] snap-center bg-indigo-600 rounded-2xl p-5 shadow-lg cursor-pointer active:scale-95 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-3 text-white">
                  <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center text-lg">✨</div>
                  <span className="text-[8px] font-black uppercase tracking-widest">AI Check</span>
                </div>
                <p className="text-white/90 text-[12px] font-medium italic leading-snug text-left">"Tanya AI Setempat untuk suasana & antrian..."</p>
              </div>
              <div className="mt-4 flex justify-end">
                <span className="text-[9px] font-black text-indigo-600 bg-white px-3 py-1.5 rounded-lg uppercase shadow-sm">Mulai Tanya</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. INTERACTION BAR */}
      <div className="px-6 py-5 bg-gray-50/50 flex flex-col gap-4 border-t border-gray-100">
        <div className="flex items-center justify-between gap-2">
          
          <button 
            onClick={() => openKomentarModal(item)} 
            className="relative flex items-center gap-3 px-5 py-3 bg-white rounded-xl shadow-sm border border-gray-100 active:scale-95 transition-all group/btn"
          >
            {commentCount > 0 && (
              <div className="absolute -top-2 -right-2 bg-rose-600 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white shadow-sm animate-pulse">
                {commentCount}
              </div>
            )}
            <span className="text-xl group-hover/btn:rotate-12 transition-transform">💬</span>
            <div className="text-left">
              <p className="text-[10px] font-black text-gray-900 leading-none uppercase tracking-tighter">Kata Warga</p>
              <p className="text-[8px] text-gray-400 font-bold tracking-tighter mt-1 uppercase leading-none">Obrolan</p>
            </div>
          </button>

          <div className="flex gap-2">
            <button 
              onClick={handleSesuai} 
              disabled={isSesuai} 
              className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-sm border transition-all duration-300 ${isSesuai ? "bg-indigo-50 border-indigo-100 text-indigo-600 cursor-default" : "bg-white border-gray-100 text-gray-400 active:scale-95 hover:border-indigo-100"}`}
            >
              <span className="text-xl">{isSesuai ? "🛡️" : "✨"}</span>
              <div className="flex flex-col items-start leading-none text-left">
                <span className="text-[11px] font-black uppercase tracking-tighter">{isSesuai ? "Terverifikasi" : "Sesuai?"}</span>
                <p className="text-[8px] font-bold mt-1 opacity-50 uppercase tracking-tighter">Kesaksian</p>
              </div>
            </button>

            <button onClick={handleShare} className="p-3 bg-white rounded-xl border border-gray-100 shadow-sm active:scale-90 text-gray-400 hover:text-indigo-600 transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92c0-1.61-1.31-2.92-2.92-2.92z" /></svg>
            </button>
          </div>
        </div>

        {/* 6. FOOTER: VALIDASI SOSIAL (Adaptif & Sembunyi jika 0) */}
        {localValidationCount > 0 && (
          <div className="flex items-center gap-2 px-1 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex -space-x-1.5">
              {/* Logika Avatar: Maksimal 6 berderet, jika > 6 tetap 6 (tumpuk) */}
              {Array.from({ length: Math.min(localValidationCount, 6) }).map((_, i) => (
                <div key={i} className="w-5 h-5 rounded-full border-2 border-white bg-gray-100 overflow-hidden ring-1 ring-gray-100 shadow-sm shrink-0 transition-transform">
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${item.id + i}`} alt="avatar" />
                </div>
              ))}
            </div>
            <p className="text-[10px] font-medium text-gray-500 tracking-tight leading-none text-left">
              <span className="font-black text-indigo-600">{localValidationCount} Warga Setempat</span> nyatakan sesuai kondisi            </p>
          </div>
        )}
      </div>

      {/* 7. TOAST */}
      <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] transition-all duration-500 transform ${localToast.show ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0 pointer-events-none"}`}>
        <div className="bg-gray-900/90 backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/10">
          <div className="w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center text-[8px]">✓</div>
          <span className="text-[10px] font-bold uppercase tracking-widest">{localToast.message}</span>
        </div>
      </div>
    </div>
  );
}