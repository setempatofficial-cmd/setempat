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
  tempatId = null 
}) {
  
  const { getAIContext } = useDataContext();
  
  const realtimeData = useMemo(() => {
    const targetId = item?.id || tempatId;
    if (!targetId) return null;
    return getAIContext(targetId);
  }, [item?.id, tempatId, getAIContext]);
  
  const latestReport = useMemo(() => {
    if (realtimeData?.recentReports?.length > 0) {
      return realtimeData.recentReports[0];
    }
    if (item?.laporan_terbaru?.[0]) {
      return item.laporan_terbaru[0];
    }
    if (item?.laporan_warga?.[0]) {
      return item.laporan_warga[0];
    }
    return null;
  }, [realtimeData, item]);
  
  const kondisi = latestReport?.tipe || item?.latest_condition || "Normal";
  const deskripsi = latestReport?.deskripsi || latestReport?.content;
  const trafficCondition = latestReport?.traffic_condition;
  const userName = latestReport?.user_name;
  const waktuUpdate = getWaktuRelative(latestReport?.created_at) || "Terkini";
  const isRecent = latestReport?.created_at && 
    (new Date() - new Date(latestReport.created_at)) < (2 * 60 * 60 * 1000);
  const totalLaporanHariIni = realtimeData?.todayStats?.total || 0;
  
  const getDisplay = () => {
    if (trafficCondition) {
      if (trafficCondition === "Macet") {
        return { icon: "🚦", text: "Lalu lintas padat sekarang", desc: "Waspada, kendaraan tersendat", color: "text-rose-500" };
      }
      if (trafficCondition === "Ramai") {
        return { icon: "🚗", text: "Lalu lintas mulai ramai", desc: "Volume kendaraan meningkat", color: "text-amber-500" };
      }
      if (trafficCondition === "Lancar") {
        return { icon: "🛵", text: "Jalanan masih lancar", desc: "Belum terlihat kepadatan", color: "text-emerald-500" };
      }
    }
    
    if (kondisi === "Sepi") {
      return { icon: "🍃", text: "Lagi sepi sekarang", desc: "Belum banyak aktivitas terlihat", color: "text-emerald-500" };
    }
    if (kondisi === "Ramai") {
      return { icon: "🏃", text: "Ramai sekarang", desc: "Banyak warga lagi kumpul di sini", color: "text-amber-500" };
    }
    if (kondisi === "Antri") {
      return { icon: "⏳", text: "Antrian terlihat", desc: "Beberapa warga sudah menunggu", color: "text-rose-500" };
    }
    return { icon: "📍", text: "Suasana normal", desc: "Belum ada perubahan signifikan", color: "text-gray-500" };
  };
  
  const display = getDisplay();
  
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
  
  const showLiveBadge = isRecent && latestReport?.user_id;

  // Variabel bantu untuk warna background indikator
  const bgColorIndicator = display.color.replace('text', 'bg');
  
  return (
    <div 
      onClick={() => setIsExpanded(!isExpanded)}
      className={`relative overflow-hidden transition-all duration-500 cursor-pointer
        ${theme.statusBg || theme?.card || 'bg-white'} border ${theme.softBorder || theme.border || 'border-gray-100'} rounded-[28px]
        ${isExpanded ? 'p-6 shadow-xl' : 'h-14 px-5 flex items-center shadow-sm'}
      `}
    >
      {/* Glow Effect Tersembunyi (Hanya muncul saat Malam) */}
      {theme.isMalam && (
        <div className={`absolute -right-4 -top-4 w-20 h-20 blur-3xl opacity-20 ${bgColorIndicator} pointer-events-none`} />
      )}

      <div className="w-full relative z-10">
        <div className={`flex items-center justify-between ${isExpanded ? 'mb-4 border-b border-white/5 pb-3' : ''}`}>
          
          <div className="flex items-center gap-3 overflow-hidden flex-1">
            {/* Indikator: Tetap pakai logika replace text ke bg kamu */}
            <div className="relative shrink-0">
              <div className={`h-2.5 w-2.5 rounded-full ${bgColorIndicator} shadow-sm`} />
              <div className={`absolute inset-0 h-2.5 w-2.5 rounded-full ${bgColorIndicator} animate-ping opacity-60`} />
            </div>
            
            <p className={`text-[15px] font-[1000] uppercase tracking-wider truncate ${display.color}`}>
              {display.icon} {display.text}
            </p>
            
            {showLiveBadge && (
              <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-cyan-500 text-white animate-pulse">
                🔴 LIVE
              </span>
            )}
            
            {totalLaporanHariIni > 0 && !isExpanded && (
              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${theme?.isMalam ? 'bg-white/10 text-white/60' : 'bg-gray-100 text-gray-500'}`}>
                👥 {totalLaporanHariIni}
              </span>
            )}
          </div>
          
          <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl shrink-0 ${theme.isMalam ? 'bg-white/5' : 'bg-black/5'}`}>
            <span className={`text-[8px] font-black uppercase opacity-60 ${theme.statusText || 'text-gray-500'}`}>
              {isExpanded ? 'Hide' : 'Lihat'}
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
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[7px] font-black px-1.5 py-0.5 rounded border border-cyan-500/50 text-cyan-500">
                    {latestReport?.user_id ? "LAPORAN WARGA" : (latestReport?.source_platform === "news" ? "BERITA" : "SISTEM")}
                  </span>
                  {showLiveBadge && (
                    <span className="text-[7px] font-black px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-500 animate-pulse">
                      ● BARU SAJA
                    </span>
                  )}
                </div>
                
                {userName && (
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold uppercase opacity-60">👤 Dilaporkan oleh</span>
                    <span className={`text-[11px] font-bold ${display.color}`}>@{userName}</span>
                  </div>
                )}
                
                {deskripsi && (
                  <div className={`p-3 rounded-2xl ${theme.isMalam ? 'bg-white/5' : 'bg-gray-50'}`}>
                    <p className="text-[9px] font-black uppercase opacity-40 mb-1">Cerita dari lokasi</p>
                    <p className={`text-[13px] leading-relaxed font-bold italic opacity-90 ${theme.statusText || 'text-gray-700'}`}>
                      "{deskripsi}"
                    </p>
                  </div>
                )}
                
                <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
                  <p className={`text-[9px] font-bold opacity-40 uppercase ${theme.statusText || 'text-gray-500'}`}>
                    🕒 {waktuUpdate}
                  </p>
                  <span className={`text-[9px] font-black opacity-60 uppercase ${display.color}`}>
                    {display.icon} {display.desc}
                  </span>
                </div>
                
                {totalLaporanHariIni > 1 && (
                  <div className={`mt-3 pt-2 border-t ${theme.isMalam ? 'border-white/10' : 'border-gray-100'}`}>
                    <p className="text-[8px] font-bold uppercase opacity-50 mb-1">
                      👥 {totalLaporanHariIni} warga melaporkan hari ini
                    </p>
                    <div className="flex gap-2 text-[9px] flex-wrap">
                      {realtimeData?.todayStats?.ramai > 0 && <span className="text-amber-500">🏃 {realtimeData.todayStats.ramai}</span>}
                      {realtimeData?.todayStats?.antri > 0 && <span className="text-rose-500">⏳ {realtimeData.todayStats.antri}</span>}
                      {realtimeData?.todayStats?.tenang > 0 && <span className="text-emerald-500">🍃 {realtimeData.todayStats.tenang}</span>}
                    </div>
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