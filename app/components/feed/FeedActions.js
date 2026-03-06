"use client";

import { useState } from "react";

export default function FeedActions({
  item,
  comments = {},
  openAIModal,
  openKomentarModal,
  onShare
}) {

  const [isHere, setIsHere] = useState(false);

  const jumlahKomentar = comments[item.id]?.length || 0;

  const handleCheckin = () => {
    setIsHere(!isHere);
    console.log("Check-in:", item.id);
  };

  return (
    <div className="flex items-center px-4 py-3 mt-3 border-t border-gray-100">

      {/* LEFT ACTIONS */}
      <div className="flex items-center gap-3">

        {/* Tanya AI */}
        <button
          onClick={() => openAIModal(item)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-50 hover:bg-gray-100 text-xs text-gray-700 transition shadow-sm"
        >
          <span className="text-base">🤖</span>
          <span className="font-medium">Tanya AI</span>
        </button>

        {/* Komentar */}
        <button
          onClick={() => openKomentarModal(item)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-50 hover:bg-gray-100 text-xs text-gray-700 transition shadow-sm"
        >
          <span className="text-base">💬</span>
          <span className="font-medium">{jumlahKomentar}</span>
        </button>

        {/* Check-in */}
        <button
          onClick={handleCheckin}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition shadow-sm
            ${isHere
              ? "bg-green-100 text-green-700"
              : "bg-gray-50 hover:bg-gray-100 text-gray-700"
            }`}
        >
          <span className="text-base">📍</span>
          <span className="font-medium">
            {isHere ? "Lagi di Sini" : "Aku di Sini"}
          </span>
        </button>

      </div>

      {/* SHARE BUTTON */}
      <button
        onClick={() => onShare(item)}
        className="ml-auto flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition text-xl text-gray-600"
        aria-label="Bagikan"
      >
        ↗
      </button>

    </div>
  );
}