"use client";

import { useState, useMemo } from "react";
import PhotoSlider from "./PhotoSlider";
import { processFeedItem } from "../../../lib/feedEngine";

export default function FeedCard({
  item,
  locationReady,
  location,
  comments,
  selectedPhotoIndex,
  setSelectedPhotoIndex,
  openAIModal,
  openKomentarModal,
  onShare,
}) {
  const [localToast, setLocalToast] = useState({ show: false, message: "" });

  // Memproses data feed menggunakan Engine
  const feed = useMemo(() => {
    return processFeedItem({ item, comments, locationReady, location });
  }, [item, comments, locationReady, location]);

  // Tema warna headline berdasarkan status
  const headerTheme = useMemo(() => {
    if (feed.isViral) return "from-indigo-600 to-violet-700 shadow-indigo-200";
    if (feed.isRamai) return "from-amber-500 to-orange-600 shadow-orange-200";
    return "from-emerald-500 to-teal-600 shadow-emerald-200";
  }, [feed.isViral, feed.isRamai]);

  // Fungsi share yang memanggil parent + toast lokal
  const handleShare = async () => {
    if (onShare) {
      await onShare(item);
      setLocalToast({ show: true, message: "Link disalin!" });
      setTimeout(() => setLocalToast({ show: false, message: "" }), 2500);
    }
  };

  if (!item) return null;

  // Fallback foto jika data kosong
  const photos = item.photos?.length > 0 ? item.photos : 
                 (item.image_url ? [item.image_url] : ["https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500"]);

  return (
    <div className="group bg-white rounded-[32px] overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-500 mb-10 mx-2 relative">
      
      {/* 1. TOP BAR */}
      <div className="px-6 pt-5 pb-3 flex justify-between items-center">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${feed.isRamai ? 'bg-orange-400' : 'bg-emerald-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${feed.isRamai ? 'bg-orange-500' : 'bg-emerald-500'}`}></span>
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400">Live Setempat</span>
          </div>
          {locationReady && item?.distance && (
            <span className="text-[11px] text-indigo-500 font-bold tracking-tight">
               📍 {item.distance < 1 ? `${Math.round(item.distance * 1000)}m` : `${item.distance.toFixed(1)}km`} dari lokasimu
            </span>
          )}
        </div>
        {feed.kategori && (
          <div className="px-3 py-1 bg-gray-50 rounded-lg border border-gray-100">
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">{feed.kategori}</span>
          </div>
        )}
      </div>

      {/* 2. HEADLINE & NARASI */}
      <div className="px-4 mb-4">
        <div className={`relative overflow-hidden bg-gradient-to-br ${headerTheme} rounded-2xl p-5 shadow-md`}>
          <div className="relative flex items-center gap-4">
            <div className="text-3xl bg-white/20 backdrop-blur-md w-14 h-14 flex items-center justify-center rounded-xl border border-white/20 text-white shadow-inner">
              {feed.headline?.icon || "📍"}
            </div>
            <div className="flex-1">
              <h2 className="text-white text-[17px] font-bold leading-tight tracking-tight">
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

      {/* 4. INFO UTAMA & STATUS BADGE */}
      <div className="px-6 mt-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h4 className="text-xl font-black text-gray-900 tracking-tighter">{item.name}</h4>
            <p className="text-xs text-gray-400 font-medium italic opacity-70">📍 {item.alamat?.split(',')[0]}</p>
          </div>
          <div className={`px-3 py-2 rounded-xl border font-black text-[11px] uppercase tracking-tighter shadow-sm shrink-0 ${feed.badgeColor || "bg-gray-100 text-gray-500"}`}>
            {feed.badgeStatus || "Normal"}
          </div>
        </div>

        {/* HORIZONTAL SIGNALS */}
        <div className="relative -mx-6 overflow-hidden">
          <div className="flex overflow-x-auto pb-6 px-6 gap-3 snap-x no-scrollbar">
            {feed.allSignals?.map((msg, i) => (
              <div key={i} className="flex-shrink-0 w-[240px] snap-center bg-gray-50 rounded-2xl p-4 border border-gray-100 flex flex-col justify-between relative overflow-hidden">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <img src={msg.avatar} className="w-8 h-8 rounded-lg bg-white border border-gray-100 shadow-sm object-cover" alt="user" />
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-black text-gray-900 leading-none">@{msg.username}</span>
                        {msg.isLive && (
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500"></span>
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] text-indigo-500 font-bold uppercase mt-1 tracking-tighter italic">{msg.platformLabel}</span>
                    </div>
                  </div>
                  <p className="text-[13px] text-gray-600 font-medium leading-relaxed italic line-clamp-3">“{msg.text}”</p>
                </div>
                <div className="mt-3 text-[9px] font-black text-gray-400 uppercase tracking-widest border-t border-gray-200/50 pt-2 flex justify-between items-center">
                  <span>{msg.timeAgo}</span>
                  <span className="opacity-40">📱</span>
                </div>
              </div>
            ))}

            {/* AI CARD */}
            <div onClick={() => openAIModal(item)} className="flex-shrink-0 w-[240px] snap-center bg-indigo-600 rounded-2xl p-5 shadow-lg cursor-pointer active:scale-95 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center text-lg">✨</div>
                <span className="text-[8px] font-black text-white uppercase tracking-widest">AI Check</span>
              </div>
              <p className="text-white/90 text-[12px] font-medium italic leading-snug">"Tanya Gemini AI untuk suasana & antrian..."</p>
              <div className="mt-4 flex justify-end">
                <span className="text-[9px] font-black text-indigo-600 bg-white px-3 py-1.5 rounded-lg uppercase shadow-sm">Mulai AI</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. INTERACTION BAR */}
      <div className="px-6 py-5 bg-gray-50/50 flex items-center justify-end border-t border-gray-100 gap-2">
          <button onClick={() => openKomentarModal(item)} className="flex items-center gap-2 px-5 py-3 bg-white rounded-xl shadow-sm border border-gray-100 active:scale-95 transition-all hover:bg-gray-50">
            <span className="text-xl">💬</span>
            <div className="text-left">
              <p className="text-[11px] font-black text-gray-900 leading-none uppercase tracking-tighter">Obrolan Warga</p>
              <p className="text-[9px] text-gray-400 font-bold tracking-tighter mt-1">{(comments[item.id]?.length || 0)} Komentar</p>
            </div>
          </button>
          <button onClick={handleShare} className="p-3 bg-white rounded-xl border border-gray-100 shadow-sm active:scale-90 text-gray-500 hover:text-indigo-600 transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92c0-1.61-1.31-2.92-2.92-2.92z" />
            </svg>
          </button>
      </div>

      {/* TOAST LOKAL */}
      <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] transition-all duration-500 transform ${localToast.show ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0 pointer-events-none"}`}>
        <div className="bg-gray-900/90 backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/10">
          <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-[10px]">✓</div>
          <span className="text-[11px] font-bold uppercase tracking-widest">{localToast.message}</span>
        </div>
      </div>
    </div>
  );
}