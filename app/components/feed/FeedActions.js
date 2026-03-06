"use client";

import { useState, useEffect } from "react";

export default function FeedActions({
  item,
  comments = {},
  openAIModal,
  openKomentarModal,
  onShare,
  locationReady,
}) {

  const [isHere, setIsHere] = useState(false);

  const jumlahKomentar = comments[item.id]?.length || 0;

  const distance = item.distance ?? null;

  const lokasiDekat = distance !== null && distance <= 0.3;

  const bolehCheckin = locationReady && lokasiDekat;

  useEffect(() => {
    // reset jika lokasi berubah
    if (!locationReady) {
      setIsHere(false);
    }
  }, [locationReady]);

  const handleCheckin = () => {
    if (!bolehCheckin) return;

    setIsHere(!isHere);
  };

  return (
    <div className="flex items-center px-4 py-3 mt-3 border-t border-gray-100">

      <div className="flex items-center gap-3">

        {/* Tanya AI */}
        <button
          onClick={() => openAIModal(item)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-50 hover:bg-gray-100 text-xs text-gray-700 transition shadow-sm"
        >
          🤖 <span className="font-medium">Tanya AI</span>
        </button>

        {/* Komentar */}
        <button
          onClick={() => openKomentarModal(item)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-50 hover:bg-gray-100 text-xs text-gray-700 transition shadow-sm"
        >
          💬 <span className="font-medium">{jumlahKomentar}</span>
        </button>

        {/* Checkin */}
        <button
          onClick={handleCheckin}
          disabled={!bolehCheckin}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition shadow-sm
          
          ${isHere
            ? "bg-green-100 text-green-700"
            : bolehCheckin
            ? "bg-gray-50 hover:bg-gray-100 text-gray-700"
            : "bg-gray-100 text-gray-400 cursor-not-allowed"}
          `}
        >
          📍
          <span className="font-medium">
            {!locationReady
              ? "Aktifkan Lokasi"
              : !lokasiDekat
              ? "Terlalu Jauh"
              : isHere
              ? "Lagi di Sini"
              : "Aku di Sini"}
          </span>
        </button>

      </div>

      {/* SHARE */}
      <button
        onClick={() => onShare(item)}
        className="ml-auto flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition text-xl text-gray-600"
      >
        ↗
      </button>

    </div>
  );
}