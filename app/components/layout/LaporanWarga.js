"use client";

import { useMemo, useEffect, useState } from "react";

export default function LaporanWarga({ tempat, locationReady, displayLocation, onStatClick }) {
  // Statistik state, agar update otomatis saat `tempat` berubah
  const [stats, setStats] = useState({
    titikRamai: 0,
    titikDekat: 0,
    titikViral: 0,
    topKategori: null,
    topRamai: 0,
    totalKategori: 0,
  });

  useEffect(() => {
    if (!tempat || tempat.length === 0 || !locationReady) {
      setStats((prev) => ({ ...prev, titikRamai: 0, titikDekat: 0, titikViral: 0 }));
      return;
    }

    const titikRamai = tempat.filter((t) => parseInt(t.estimasi_orang) > 20).length;
    const titikDekat = tempat.filter((t) => t.distance && t.distance < 1).length;
    const titikViral = tempat.filter((t) => (t.testimonial_terbaru?.length || 0) > 3).length;

    // Insight kategori
    const kategoriCount = {};
    const kategoriRamai = {};
    tempat.forEach((t) => {
      const cat = t.kategori || 'lainnya';
      kategoriCount[cat] = (kategoriCount[cat] || 0) + 1;
      if (parseInt(t.estimasi_orang) > 20) {
        kategoriRamai[cat] = (kategoriRamai[cat] || 0) + 1;
      }
    });

    let topKategori = null;
    let topRamai = 0;
    Object.keys(kategoriRamai).forEach((cat) => {
      if (kategoriRamai[cat] > topRamai) {
        topRamai = kategoriRamai[cat];
        topKategori = cat;
      }
    });

    setStats({ titikRamai, titikDekat, titikViral, topKategori, topRamai, totalKategori: topKategori ? kategoriCount[topKategori] : 0 });
  }, [tempat, locationReady]);

  if (!locationReady) return null;

  // Insight tambahan
  const trafficInfo = "Lalu Lintas Padat ke Arah Bangil";

  const statBoxes = [
    { label: "Lagi Ramai", value: stats.titikRamai, icon: "🔥", key: "titikRamai" },
    { label: "Aktivitas Terdekat", value: stats.titikDekat, icon: "⚡", key: "titikDekat" },
    { label: "Jadi Obrolan", value: stats.titikViral, icon: "💬", key: "titikViral" },
  ];

  return (
    <div className="px-4 py-5 border-b border-gray-100 bg-gradient-to-br from-[#E3655B]/5 to-white">
      {/* HEADER */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold text-gray-700">
          📍 {displayLocation} Sekarang
        </span>
        <div className="flex items-center gap-1">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E3655B] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#E3655B]"></span>
          </span>
          <span className="text-xs font-semibold text-[#E3655B] tracking-wider">LIVE</span>
        </div>
      </div>

      {/* GRID STATISTIK */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {statBoxes.map((box) => (
          <button
            key={box.key}
            className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex flex-col items-center"
            onClick={() => onStatClick && onStatClick(box.key)}
          >
            <div className="text-2xl mb-1">{box.icon}</div>
            <div className="text-lg font-bold text-gray-800">{box.value}</div>
            <div className="text-xs text-gray-500">{box.label}</div>
          </button>
        ))}
      </div>

      {/* INSIGHT KATEGORI */}
      {stats.topKategori && stats.topRamai > 0 && (
        <div className="flex items-center justify-between bg-[#E3655B]/10 rounded-xl p-3 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">{stats.topKategori === 'kuliner' ? '🍜' : '📍'}</span>
            <div>
              <p className="text-xs text-gray-600">
                {stats.topKategori === 'kuliner' ? 'Kuliner' : stats.topKategori}
              </p>
              <p className="text-sm font-semibold text-gray-800">
                {stats.topRamai} Lebih Aktif dari Biasa
              </p>
            </div>
          </div>
          <div className="text-xs bg-white px-2 py-1 rounded-full text-[#E3655B] font-medium">
            {Math.round((stats.topRamai / stats.totalKategori) * 100)}% dari total
          </div>
        </div>
      )}

      {/* TRAFFIC INFO */}
      <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
        <span className="text-base">🚗</span>
        <span>{trafficInfo}</span>
        <span className="ml-auto text-[#E3655B]">›</span>
      </div>
    </div>
  );
}