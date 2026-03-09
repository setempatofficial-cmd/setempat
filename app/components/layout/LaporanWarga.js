"use client";

import { useMemo, useState, useEffect } from "react";

export default function LaporanWargaInteractive({
  tempat = [],
  locationReady,
  districtLocation,
  displayLocation,  // akan menjadi fallback
  location,         // koordinat user untuk validasi
  onStatClick,
}) {
  // ===== FUNGSI VALIDASI LOKASI =====
  const getValidatedDistrict = (places, userLocation) => {
    if (!places?.length || !userLocation) return null;
    const nearestPlace = places[0];
    if (nearestPlace.distance > 5) return null;
    const parts = nearestPlace.alamat.split(",").map((p) => p.trim());
    
    // Cari bagian yang mengandung "Kec." atau ambil bagian ke-2/ke-3
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].includes("Kec.") || parts[i].includes("Kecamatan")) {
        return parts[i].replace("Kec.", "").replace("Kecamatan", "").trim();
      }
    }
    // Fallback ke bagian ke-2 (desa) atau ke-1
    return parts[1] || parts[0];
  };

  // Lokasi yang sudah divalidasi (prioritas: dari tempat terdekat)
  const validatedLocation = locationReady && tempat.length > 0 && location
    ? getValidatedDistrict(tempat, location) || displayLocation
    : displayLocation;
  // ===================================

  const stats = useMemo(() => {
    if (!tempat || tempat.length === 0) return null;

    const titikRamai = tempat.filter((t) => parseInt(t.estimasi_orang) > 20).length;
    const titikDekat = tempat.filter((t) => t.distance && t.distance < 1).length;
    const titikViral = tempat.filter((t) => (t.testimonial_terbaru?.length || 0) > 3).length;

    const kategoriCount = {};
    const kategoriRamai = {};

    tempat.forEach((t) => {
      const cat = t.kategori || "lainnya";
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

    return {
      titikRamai,
      titikDekat,
      titikViral,
      topKategori,
      topRamai,
      totalKategori: topKategori ? kategoriCount[topKategori] : 0,
    };
  }, [tempat]);

  const [animatedStats, setAnimatedStats] = useState({
    titikRamai: 0,
    titikDekat: 0,
    titikViral: 0,
  });

  useEffect(() => {
    if (!stats) return;

    const duration = 800;
    const step = 20;
    const intervals = [];

    const animateValue = (key) => {
      let start = 0;
      const end = stats[key] || 0;
      const increment = Math.max(1, Math.floor(end / step));

      const interval = setInterval(() => {
        start += increment;

        if (start >= end) {
          start = end;
          clearInterval(interval);
        }

        setAnimatedStats((prev) => ({
          ...prev,
          [key]: start,
        }));
      }, duration / step);

      intervals.push(interval);
    };

    animateValue("titikRamai");
    animateValue("titikDekat");
    animateValue("titikViral");

    return () => intervals.forEach(clearInterval);
  }, [stats]);

  if (!locationReady || !stats) return null;

  const hasPositiveStat =
    stats.titikRamai > 0 || stats.titikDekat > 0 || stats.titikViral > 0;

  const getTrafficInfo = () => {
    const { titikRamai } = stats;

    if (titikRamai > 15)
      return {
        icon: "🚨",
        text: "Rawan macet di jalur utama, hindari titik ramai!",
      };

    if (titikRamai > 8)
      return {
        icon: "🚗",
        text: `Lalu lintas padat di sekitar ${validatedLocation}`,
      };

    if (titikRamai > 3)
      return {
        icon: "🛵",
        text: "Kepadatan mulai meningkat, tetap hati-hati.",
      };

    return {
      icon: "🚦",
      text: "Lalu lintas lancar, selamat beraktivitas.",
    };
  };

  const trafficInfo = getTrafficInfo();

  const statData = [
    {
      key: "titikRamai",
      icon: "🔥",
      label: "Titik Sedang Ramai",
      bg: "bg-gradient-to-r from-red-100 to-red-50",
      tooltip: `${animatedStats.titikRamai} tempat ramai saat ini`,
    },
    {
      key: "titikDekat",
      icon: "⚡",
      label: "Aktivitas Terdekat",
      bg: "bg-gradient-to-r from-yellow-100 to-yellow-50",
      tooltip: `${animatedStats.titikDekat} tempat dekat denganmu`,
    },
    {
      key: "titikViral",
      icon: "💬",
      label: "Topik Obrolan",
      bg: "bg-gradient-to-r from-blue-100 to-blue-50",
      tooltip: `${animatedStats.titikViral} tempat viral / trending`,
    },
  ];

  return (
    <div className="px-4 py-5 border-b border-gray-100 bg-gradient-to-br from-[#FFEAEA]/20 to-white rounded-2xl">
      
      {/* HEADER - menggunakan validatedLocation */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold text-gray-700">
          📍 {validatedLocation} {districtLocation && `| ${districtLocation}`}Sekarang
        </span>

        <div className="flex items-center gap-1">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E3655B] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#E3655B]"></span>
          </span>

          <span className="text-xs font-semibold text-[#E3655B] tracking-wider">
            LIVE
          </span>
        </div>
      </div>

      {/* STAT GRID */}
      {hasPositiveStat && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {statData.map((s) => (
            <div
              key={s.key}
              onClick={() => onStatClick?.(s.key)}
              className={`flex-shrink-0 ${s.bg} p-3 rounded-2xl shadow-sm w-28 text-center cursor-pointer hover:scale-105 transition-transform relative group`}
            >
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className="text-lg font-bold text-gray-800">
                {animatedStats[s.key]}
              </div>
              <div className="text-xs text-gray-500">{s.label}</div>

              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap">
                {s.tooltip}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* INSIGHT KATEGORI */}
      {stats.topKategori && stats.topRamai > 0 && (
        <div className="flex items-center justify-between bg-[#E3655B]/10 rounded-xl p-3 mt-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">
              {stats.topKategori === "kuliner" ? "🍜" : "📍"}
            </span>

            <div>
              <p className="text-xs text-gray-600">{stats.topKategori}</p>
              <p className="text-sm font-semibold text-gray-800">
                {stats.topRamai} Ramai Sekitar
              </p>
            </div>
          </div>

          <div className="text-xs bg-white px-2 py-1 rounded-full text-[#E3655B] font-medium">
            {stats.totalKategori
              ? Math.round((stats.topRamai / stats.totalKategori) * 100)
              : 0}
            %
          </div>
        </div>
      )}

      {/* INFO LALU LINTAS - menggunakan validatedLocation */}
      <div className="flex items-center gap-3 text-sm text-gray-700 mt-3 bg-gray-50 px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors">
        <span className="text-xl">{trafficInfo.icon}</span>

        <span className="flex-1 leading-snug">
          {trafficInfo.text}
        </span>

        <span className="text-[#E3655B] text-lg">›</span>
      </div>

    </div>
  );
}