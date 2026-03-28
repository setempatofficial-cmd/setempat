"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useDataContext } from "@/contexts/DataContext";
import { useMemo } from "react";

export default function StatusIsland({ 
  item, 
  theme, 
  isExpanded, 
  setIsExpanded, 
  jumlahWarga,
  tempatId = null // Tambahkan prop untuk filter
}) {
  
  const { getAIContext, feedData } = useDataContext();
  
  // 🔥 Ambil data real-time dari DataContext berdasarkan tempat
  const realtimeData = useMemo(() => {
    const targetId = item?.id || tempatId;
    if (!targetId) return null;
    
    const context = getAIContext(targetId);
    return context;
  }, [item?.id, tempatId, getAIContext]);
  
  // 🔥 Prioritaskan data dari realtimeData, fallback ke item
  const latestReport = useMemo(() => {
    // 1. Cek dari realtimeData (data terbaru dari feed)
    if (realtimeData?.recentReports?.length > 0) {
      return realtimeData.recentReports[0];
    }
    
    // 2. Fallback ke laporan_warga dari item prop
    if (item?.laporan_warga?.[0]) {
      return item.laporan_warga[0];
    }
    
    // 3. Fallback ke external_source
    if (item?.external_source) {
      return item.external_source;
    }
    
    return null;
  }, [realtimeData, item]);
  
  // 🔥 Ambil data estimasi dari laporan terbaru
  const estimasiOrang = latestReport?.estimated_people || item?.latest_estimated_people || null;
  const estimasiWaitTime = latestReport?.estimated_wait_time || item?.latest_estimated_wait_time || null;
  const estimasiTipe = latestReport?.tipe || item?.latest_condition || null;
  const estimasiRecent = latestReport?.created_at && 
    (new Date() - new Date(latestReport.created_at)) < (2 * 60 * 60 * 1000);
  
  // 🔥 Ambil data eksternal (misal dari kolom 'external_data' atau 'social_source')
  const dataEksternal = item?.external_source || item?.external_data;
  
  // 🔥 Statistik dari DataContext untuk insight tambahan
  const stats = realtimeData?.todayStats;
  const trending = realtimeData?.trendingCondition;
  
  // Tentukan Label Sumber (Buat kasih tau warga ini info dari mana)
  const sourceLabel = latestReport?.user_id 
    ? "LIVE WARGA" 
    : (dataEksternal ? "MEDSOS" : "SISTEM");
    
  // Tentukan apakah ini laporan internal (dari warga) atau eksternal
  const isInternal = !!latestReport?.user_id;
  const isFromWarga = isInternal && !!latestReport?.estimated_people;
  
  // Kondisi sekarang dengan prioritas dari estimasi
  const kondisiSekarang = estimasiTipe || latestReport?.tipe || latestReport?.status || "Normal";
  const waktuUpdate = latestReport?.time_tag || getWaktuRelative(latestReport?.created_at) || "Terkini";
  
  // Deskripsi final - prioritaskan dari laporan warga dengan estimasi
  let deskripsiFinal = latestReport?.deskripsi || latestReport?.content || latestReport?.caption || "Kondisi terpantau lancar di lokasi.";
  
  // Jika ada estimasi orang dan tidak ada deskripsi manual, buat deskripsi otomatis
  if (estimasiOrang && (!latestReport?.deskripsi || latestReport?.deskripsi === latestReport?.content)) {
    if (estimasiTipe === 'Antri' && estimasiWaitTime) {
      const waitText = estimasiWaitTime <= 5 ? "pendek" : estimasiWaitTime <= 15 ? "sedang" : "panjang";
      deskripsiFinal = `Antrian ${waitText} dengan estimasi ${estimasiOrang} orang mengantre. Estimasi waktu tunggu ${estimasiWaitTime} menit.`;
    } else if (estimasiTipe === 'Antri') {
      deskripsiFinal = `Ada antrian dengan estimasi ${estimasiOrang} orang. Siap-siap sabar ya!`;
    } else if (estimasiTipe === 'Ramai') {
      if (estimasiOrang <= 15) {
        deskripsiFinal = `Mulai ramai, sekitar ${estimasiOrang} orang terlihat di lokasi.`;
      } else if (estimasiOrang <= 30) {
        deskripsiFinal = `Ramai! Sekitar ${estimasiOrang} orang memadati area.`;
      } else {
        deskripsiFinal = `Sangat ramai! Estimasi ${estimasiOrang}+ orang, suasana meriah!`;
      }
    } else if (estimasiTipe === 'Sepi') {
      if (estimasiOrang <= 3) {
        deskripsiFinal = `Sepi sekali, hanya ${estimasiOrang} orang terlihat.`;
      } else {
        deskripsiFinal = `Suasana tenang, sekitar ${estimasiOrang} orang sedang beraktivitas.`;
      }
    }
  }
  
  const userName = latestReport?.user_name || (latestReport?.user_id ? "Warga" : null);
  
  // 🔥 Tambahkan informasi statistik jika ada
  const totalLaporanHariIni = stats?.total || 0;
  const trendingText = trending === 'ramai' ? '🔥 Lagi Ramai' : 
                       trending === 'antri' ? '⏳ Ada Antrian' : 
                       trending === 'tenang' ? '🍃 Suasana Tenang' : '';
  
  // Helper fungsi untuk format waktu relatif
  function getWaktuRelative(createdAt) {
    if (!createdAt) return null;
    const now = new Date();
    const then = new Date(createdAt);
    const diffMinutes = Math.floor((now - then) / (1000 * 60));
    
    if (diffMinutes < 1) return "baru saja";
    if (diffMinutes < 60) return `${diffMinutes} menit lalu`;
    if (diffMinutes < 120) return "1 jam lalu";
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} jam lalu`;
    return `${Math.floor(diffMinutes / 1440)} hari lalu`;
  }
  
  // Tentukan level aktivitas berdasarkan kondisi dan estimasi
  const getActivityLevel = () => {
    if (estimasiTipe === 'Antri') return "antri";
    if (estimasiOrang > 25) return "sangat ramai";
    if (estimasiOrang > 12) return "ramai";
    if (estimasiOrang > 0 && estimasiOrang <= 8) return "sepi";
    
    const k = kondisiSekarang.toLowerCase();
    if (k.includes("antri") || k.includes("macet")) return "antri";
    if (k.includes("ramai") || k.includes("padat")) return "ramai";
    if (k.includes("tenang") || k.includes("sepi")) return "sepi";
    return "normal";
  };
  
  // Tentukan ikon berdasarkan level aktivitas
  const getActivityIcon = () => {
    const level = getActivityLevel();
    if (level === "antri") return "⏳";
    if (level === "sangat ramai") return "🔥";
    if (level === "ramai") return "👥";
    if (level === "sepi") return "🍃";
    return "";
  };
  
  // Tentukan warna berdasarkan kondisi
  const getStatusColor = () => {
    const level = getActivityLevel();
    if (level === "antri") return "bg-rose-500";
    if (level === "sangat ramai") return "bg-red-500";
    if (level === "ramai") return "bg-yellow-500";
    if (level === "sepi") return "bg-emerald-500";
    return theme?.isMalam ? "bg-white/20" : "bg-gray-400";
  };
  
  const getTextColor = () => {
    const level = getActivityLevel();
    if (level === "antri") return "text-rose-500";
    if (level === "sangat ramai") return "text-red-500";
    if (level === "ramai") return "text-yellow-500";
    if (level === "sepi") return "text-emerald-500";
    return theme?.statusText || "text-gray-600";
  };
  
  // Format display status dengan estimasi orang
  let displayStatus = "";
  if (isExpanded) {
    displayStatus = `LAPORAN ${sourceLabel}`;
  } else {
    if (estimasiOrang && estimasiRecent) {
      if (estimasiTipe === 'Antri' && estimasiWaitTime) {
        const waitIcon = estimasiWaitTime <= 5 ? "⚡" : estimasiWaitTime <= 15 ? "⏱️" : "🐢";
        displayStatus = `${waitIcon} Antri ${estimasiWaitTime}m • ~${estimasiOrang} org`;
      } else if (estimasiTipe === 'Ramai') {
        displayStatus = `👥 Ramai • ~${estimasiOrang} org • ${waktuUpdate}`;
      } else if (estimasiTipe === 'Sepi') {
        displayStatus = `🍃 Sepi • ~${estimasiOrang} org • ${waktuUpdate}`;
      } else {
        displayStatus = `${getActivityIcon()} ${kondisiSekarang} • ~${estimasiOrang} org • ${waktuUpdate}`;
      }
    } else if (estimasiOrang) {
      displayStatus = `${getActivityIcon()} ${kondisiSekarang} • ~${estimasiOrang} org • ${waktuUpdate}`;
    } else {
      displayStatus = `${getActivityIcon()} ${kondisiSekarang} • ${waktuUpdate}`;
    }
  }
  
  // 🔥 Tampilkan badge statistik jika ada laporan hari ini
  const showStatsBadge = totalLaporanHariIni > 0 && !isExpanded;
  
  // Badge untuk estimasi recent (LIVE)
  const showLiveBadge = estimasiRecent && isFromWarga && !isExpanded;
  
  return (
    <div 
      onClick={() => setIsExpanded(!isExpanded)}
      className={`relative overflow-hidden transition-all duration-500 cursor-pointer
        ${theme.statusBg || theme?.card || 'bg-white'} border ${theme.softBorder || theme.border || 'border-gray-100'} rounded-[28px]
        ${isExpanded ? 'p-6 shadow-inner' : 'h-14 px-5 flex items-center shadow-sm'}
      `}
    >
      <div className="w-full">
        <div className={`flex items-center justify-between ${isExpanded ? 'mb-4 border-b border-white/5 pb-3' : ''}`}>
          <div className="flex items-center gap-3 overflow-hidden flex-1">
            {/* Indikator Warna sesuai sumber */}
            <div className="relative shrink-0">
              <div className={`h-2 w-2 rounded-full ${isInternal ? 'bg-cyan-400' : 'bg-pink-500'} ${getStatusColor()}`} />
              <div className={`absolute inset-0 h-2 w-2 rounded-full ${isInternal ? 'bg-cyan-400' : 'bg-pink-500'} ${getStatusColor()} animate-ping opacity-75`} />
            </div>
            
            <p className={`text-[11px] font-[1000] uppercase tracking-wider truncate ${getTextColor()}`}>
              {displayStatus}
            </p>
            
            {/* Badge LIVE untuk estimasi recent dari warga */}
            {showLiveBadge && (
              <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-cyan-500 text-white animate-pulse">
                LIVE
              </span>
            )}
            
            {/* Badge statistik */}
            {showStatsBadge && totalLaporanHariIni > 0 && (
              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${theme?.isMalam ? 'bg-white/10 text-white/60' : 'bg-gray-100 text-gray-500'}`}>
                {totalLaporanHariIni} laporan
              </span>
            )}
          </div>
          
          <div className={`flex items-center gap-2 px-2 py-1 rounded-lg shrink-0 ${theme.isMalam ? 'bg-white/5' : 'bg-black/5'}`}>
            <span className={`text-[8px] font-black uppercase opacity-60 ${theme.statusText || 'text-gray-500'}`}>
              {isExpanded ? 'Tutup' : 'Detail'}
            </span>
            <motion.span animate={{ rotate: isExpanded ? 180 : 0 }} className="text-[10px]">▼</motion.span>
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }} 
              animate={{ height: "auto", opacity: 1 }} 
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="space-y-3 py-1">
                {/* Badge sumber dan estimasi */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[7px] font-black px-1.5 py-0.5 rounded border 
                    ${isInternal ? 'border-cyan-500/50 text-cyan-500' : 'border-pink-500/50 text-pink-500'}`}>
                    {sourceLabel}
                  </span>
                  
                  {estimasiOrang && (
                    <span className={`text-[7px] font-black px-1.5 py-0.5 rounded-full bg-${getTextColor().replace('text-', '')}/10 ${getTextColor()}`}>
                      👥 Estimasi {estimasiOrang} orang
                    </span>
                  )}
                  
                  {estimasiWaitTime && (
                    <span className={`text-[7px] font-black px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-500`}>
                      ⏳ Antrian {estimasiWaitTime} menit
                    </span>
                  )}
                  
                  {estimasiRecent && (
                    <span className="text-[7px] font-black px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-500 animate-pulse">
                      ● LIVE
                    </span>
                  )}
                </div>
                
                {/* Nama pelapor jika ada */}
                {userName && (
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold uppercase tracking-wider opacity-60">Dari:</span>
                    <span className={`text-[11px] font-bold ${getTextColor()}`}>@{userName}</span>
                  </div>
                )}
                
                {/* Deskripsi laporan */}
                <p className={`text-[13px] leading-relaxed font-bold italic opacity-90 ${theme.statusText || 'text-gray-700'}`}>
                  "{deskripsiFinal}"
                </p>
                
                {/* Informasi tambahan */}
                <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <p className={`text-[9px] font-bold opacity-40 uppercase tracking-tighter ${theme.statusText || 'text-gray-500'}`}>
                      Update {waktuUpdate}
                    </p>
                  </div>
                  
                  {/* Badge trending jika ada */}
                  {trendingText && totalLaporanHariIni > 1 && (
                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${getTextColor()} bg-opacity-10 ${getTextColor().replace('text', 'bg')}/10`}>
                      {trendingText}
                    </span>
                  )}
                  
                  <span className={`text-[9px] font-black underline opacity-60 uppercase ${getTextColor()}`}>
                    {getActivityIcon()} {getActivityLevel()}
                  </span>
                </div>
                
                {/* Statistik tambahan jika ada banyak laporan */}
                {totalLaporanHariIni > 1 && (
                  <div className={`mt-3 pt-2 border-t ${theme.isMalam ? 'border-white/10' : 'border-gray-100'}`}>
                    <p className="text-[8px] font-bold uppercase tracking-wider opacity-50 mb-1">
                      📊 Statistik Hari Ini ({totalLaporanHariIni} laporan)
                    </p>
                    <div className="flex gap-2 text-[9px] flex-wrap">
                      {stats?.ramai > 0 && <span className="text-yellow-500">🏃 {stats.ramai} ramai</span>}
                      {stats?.antri > 0 && <span className="text-rose-500">⏳ {stats.antri} antri</span>}
                      {stats?.tenang > 0 && <span className="text-emerald-500">🍃 {stats.tenang} tenang</span>}
                      {stats?.hujan > 0 && <span className="text-blue-500">☔ {stats.hujan} hujan</span>}
                    </div>
                  </div>
                )}
                
                {/* Informasi estimasi tambahan */}
                {estimasiOrang && (
                  <div className={`mt-2 pt-2 border-t ${theme.isMalam ? 'border-white/5' : 'border-gray-50'}`}>
                    <p className="text-[7px] font-bold uppercase tracking-wider opacity-40">
                      {estimasiRecent ? '✅ Update dari warga' : '📋 Data dari laporan sebelumnya'}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}