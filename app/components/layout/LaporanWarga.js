"use client";

import { useMemo } from "react";

export default function LaporanWarga({ tempat, locationReady, displayLocation }) {
  // Hitung statistik hanya jika tempat tersedia
  const stats = useMemo(() => {
    if (!tempat.length) return null;

    const titikRamai = tempat.filter((t) => parseInt(t.estimasi_orang) > 20).length;
    const titikDekat = tempat.filter((t) => t.distance && t.distance < 1).length;
    const titikViral = tempat.filter((t) => (t.testimonial_terbaru?.length || 0) > 3).length;

    // Insight berdasarkan kategori (misal: kuliner)
    const kategoriCount = {};
    const kategoriRamai = {};
    tempat.forEach((t) => {
      const cat = t.kategori || 'lainnya';
      kategoriCount[cat] = (kategoriCount[cat] || 0) + 1;
      if (parseInt(t.estimasi_orang) > 20) {
        kategoriRamai[cat] = (kategoriRamai[cat] || 0) + 1;
      }
    });

    // Cari kategori dengan jumlah ramai terbanyak
    let topKategori = null;
    let topRamai = 0;
    Object.keys(kategoriRamai).forEach((cat) => {
      if (kategoriRamai[cat] > topRamai) {
        topRamai = kategoriRamai[cat];
        topKategori = cat;
      }
    });

    return {
      titikRamai,
      titikDekat,
      titikViral,
      topKategori,
      topRamai,
      totalKategori: topKategori ? kategoriCount[topKategori] : 0,
    };
  }, [tempat]);

  if (!locationReady || !stats) return null;

  // Contoh insight tambahan (nanti bisa diganti dengan data real)
  const trafficInfo = "Lalu Lintas Padat ke Arah Bangil"; // Placeholder

  return (
    <div className="px-4 py-5 border-b border-gray-100 bg-gradient-to-br from-[#E3655B]/5 to-white">
      {/* HEADER AREA - GABUNGAN KODE LAMA & BARU */}
      <div className="flex items-center gap-2 mb-3">
        {/* Judul Area - dari kode lama */}
        <span className="text-sm font-semibold text-gray-700">
          📍 {displayLocation} Sekarang
        </span>
        
        {/* Live Badge dengan animasi berkedip - dari kode baru */}
        <div className="flex items-center gap-1">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E3655B] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#E3655B]"></span>
          </span>
          <span className="text-xs font-semibold text-[#E3655B] tracking-wider">LIVE</span>
        </div>
      </div>

      {/* Statistik Utama - Grid 3 Kolom */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
          <div className="text-2xl mb-1">🔥</div>
          <div className="text-lg font-bold text-gray-800">{stats.titikRamai}</div>
          <div className="text-xs text-gray-500">Titik Ramai</div>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
          <div className="text-2xl mb-1">⚡</div>
          <div className="text-lg font-bold text-gray-800">{stats.titikDekat}</div>
          <div className="text-xs text-gray-500">Dekatmu</div>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
          <div className="text-2xl mb-1">💬</div>
          <div className="text-lg font-bold text-gray-800">{stats.titikViral}</div>
          <div className="text-xs text-gray-500">Viral</div>
        </div>
      </div>

      {/* Insight Kategori */}
      {stats.topKategori && stats.topRamai > 0 && (
        <div className="flex items-center justify-between bg-[#E3655B]/10 rounded-xl p-3 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">
              {stats.topKategori === 'kuliner' ? '🍜' : '📍'}
            </span>
            <div>
              <p className="text-xs text-gray-600">
                {stats.topKategori === 'kuliner' ? 'Kuliner' : stats.topKategori}
              </p>
              <p className="text-sm font-semibold text-gray-800">
                {stats.topRamai} tempat ramai
              </p>
            </div>
          </div>
          <div className="text-xs bg-white px-2 py-1 rounded-full text-[#E3655B] font-medium">
            {Math.round((stats.topRamai / stats.totalKategori) * 100)}% dari total
          </div>
        </div>
      )}

      {/* Info Lalu Lintas (Placeholder) */}
      <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
        <span className="text-base">🚗</span>
        <span>{trafficInfo}</span>
        <span className="ml-auto text-[#E3655B]">›</span>
      </div>
    </div>
  );
}