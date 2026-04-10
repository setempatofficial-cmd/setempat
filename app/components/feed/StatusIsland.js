"use client";

import { useDataContext } from "@/contexts/DataContext";
import { useMemo, useState } from "react";
import { generateStatusText, getDefaultTextByTime } from "@/lib/generateStatusText";
import { generateRingkasanMultiUser } from "@/lib/generateRingkasanMultiUser";

// Helper function untuk cek fresh report
const getFreshReports = (reports, maxHours = 12) => {
  const now = new Date();
  return reports.filter(report => {
    if (!report?.created_at) return false;
    const reportDate = new Date(report.created_at);
    const hoursDiff = (now - reportDate) / (1000 * 60 * 60);
    return hoursDiff <= maxHours;
  });
};

const getLatestFreshReport = (reports, maxHours = 12) => {
  const freshReports = getFreshReports(reports, maxHours);
  return freshReports[0] || null;
};

const getHoursSinceLastReport = (reports) => {
  if (!reports || reports.length === 0) return null;
  const latest = reports[0];
  if (!latest?.created_at) return null;
  const hoursDiff = (new Date() - new Date(latest.created_at)) / (1000 * 60 * 60);
  return Math.floor(hoursDiff);
};

export default function StatusIsland({ 
  item, 
  tempatId = null, 
  allReports = [],
  isExpanded: externalExpanded,
  setIsExpanded: externalSetIsExpanded,
  jumlahWarga 
}) {
  const { getAIContext } = useDataContext();
  const [internalExpanded, setInternalExpanded] = useState(false);
  
  const isExpanded = externalExpanded !== undefined ? externalExpanded : internalExpanded;
  const setIsExpanded = externalSetIsExpanded || setInternalExpanded;
  
  // ============================================
  // DATA FETCHING dengan FILTER FRESH
  // ============================================
  const realtimeData = useMemo(() => {
    const targetId = item?.id || tempatId;
    if (!targetId) return null;
    return getAIContext(targetId);
  }, [item?.id, tempatId, getAIContext]);
  
  // Ambil semua laporan (unfiltered)
  const allReportsRaw = useMemo(() => {
    if (allReports && allReports.length > 0) return allReports;
    return realtimeData?.recentReports || item?.laporan_terbaru || [];
  }, [allReports, realtimeData, item]);
  
  // FILTER: HANYA laporan dalam 12 jam terakhir
  const freshReports = useMemo(() => {
    return getFreshReports(allReportsRaw, 12);
  }, [allReportsRaw]);
  
  // Latest report dari data fresh
  const latestFreshReport = useMemo(() => {
    return getLatestFreshReport(allReportsRaw, 12);
  }, [allReportsRaw]);
  
  // Hitung jam sejak laporan terakhir (unfiltered, untuk info)
  const hoursSinceLastReport = useMemo(() => {
    return getHoursSinceLastReport(allReportsRaw);
  }, [allReportsRaw]);
  
  // Apakah ada data fresh?
  const hasFreshData = useMemo(() => {
    return freshReports.length > 0;
  }, [freshReports]);
  
  // ============================================
  // SEED untuk deterministic text (dari item.id)
  // ============================================
  const seed = useMemo(() => {
    return String(item?.id || tempatId || "default");
  }, [item?.id, tempatId]);
  
  // ============================================
  // DEFAULT TEXT YANG KONSISTEN (gunakan getDefaultTextByTime)
  // ============================================
const defaultSuasana = useMemo(() => {
  const category = item?.category || "general";
  return getDefaultTextByTime(seed, category);
}, [seed, item?.category]);
  
  // ============================================
  // GENERATE STATUS TEXT (berdasarkan ada/tidak data fresh)
  // ============================================
  const status = useMemo(() => {
    if (!hasFreshData) {
      return {
        text: defaultSuasana,
        color: "text-gray-500",
        bgColor: "bg-gray-500",
        icon: "📍",
        badge: "NORMAL",
        vibe: hoursSinceLastReport 
          ? `Belum ada laporan dalam ${hoursSinceLastReport} jam terakhir`
          : "Belum ada laporan",
        level: 1
      };
    }
    
    // Ada data fresh, generate status berdasarkan data fresh
    const kondisi = latestFreshReport?.tipe || item?.latest_condition || "Normal";
    const trafficCondition = latestFreshReport?.traffic_condition;
    const total = freshReports.length;
    const isRecent = latestFreshReport?.created_at 
      ? (new Date() - new Date(latestFreshReport.created_at)) < (2 * 60 * 60 * 1000)
      : false;
    
    return generateStatusText({
      kondisi,
      trafficCondition,
      total,
      isRecent,
      category: item?.category || "general",
      name: item?.name || "",
      deskripsi: latestFreshReport?.deskripsi || "",
      jarak: item?.distance,
      seed: seed // PASS SEED ke generateStatusText
    });
  }, [hasFreshData, freshReports, latestFreshReport, item, hoursSinceLastReport, defaultSuasana, seed]);
  
  // ============================================
  // RINGKASAN MULTI-USER (HANYA dari data fresh)
  // ============================================
  const ringkasanMultiUser = useMemo(() => {
    if (!hasFreshData) {
      return "Belum ada laporan terbaru dari warga sekitar.";
    }
    const category = item?.category || "general";
    return generateRingkasanMultiUser(freshReports, category);
  }, [freshReports, item?.category, hasFreshData]);
  
  // ============================================
  // JARAK (FORMATTED)
  // ============================================
  const jarakFix = useMemo(() => {
    const dist = item?.distance;
    if (!dist) return null;
    const num = parseFloat(dist);
    return num < 1 ? `${Math.round(num * 1000)} m` : `${num.toFixed(1)} km`;
  }, [item?.distance]);
  
  // ============================================
  // WAKTU UPDATE (dari laporan fresh terbaru)
  // ============================================
  const waktuUpdate = useMemo(() => {
    if (!latestFreshReport?.created_at) return null;
    const diffMin = Math.floor((new Date() - new Date(latestFreshReport.created_at)) / 60000);
    if (diffMin < 1) return "Baru saja";
    if (diffMin < 60) return `${diffMin} menit lalu`;
    if (diffMin < 1440) return `${Math.floor(diffMin / 60)} jam lalu`;
    return `${Math.floor(diffMin / 1440)} hari lalu`;
  }, [latestFreshReport]);
  
  // ============================================
  // LEVEL & EXPAND
  // ============================================
  const canExpand = status.level >= 2 && hasFreshData;
  
  // ============================================
  // RENDER: Kasus TIDAK ADA DATA FRESH
  // ============================================
  if (!hasFreshData) {
    return (
      <div className="h-14 px-5 flex items-center rounded-[28px] border bg-white border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 w-full">
          <div className="h-2 w-2 rounded-full shrink-0 bg-gray-400" />
          <p className="text-[14px] font-black uppercase tracking-tight truncate flex-1 text-gray-500">
            📍 {defaultSuasana}
          </p>
          {hoursSinceLastReport && (
            <span className="text-[9px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap">
              {hoursSinceLastReport} jam lalu
            </span>
          )}
        </div>
      </div>
    );
  }
  
  // ============================================
  // RENDER: ADA DATA FRESH tapi LEVEL 1 (tidak bisa expand)
  // ============================================
  if (status.level === 1 && !isExpanded) {
    return (
      <div className="h-14 px-5 flex items-center rounded-[28px] border bg-white border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 w-full">
          <div className={`h-2 w-2 rounded-full shrink-0 ${status.color?.replace('text', 'bg') || 'bg-emerald-500'}`} />
          <p className={`text-[14px] font-black uppercase tracking-tight truncate flex-1 ${status.color || 'text-emerald-600'}`}>
            {status.icon} {status.text}
          </p>
          {waktuUpdate && (
            <span className="text-[9px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap">
              {waktuUpdate}
            </span>
          )}
        </div>
      </div>
    );
  }
  
  // ============================================
  // RENDER: ADA DATA FRESH dengan LEVEL 2 & 3 (bisa expand)
  // ============================================
  return (
    <div className="relative">
      {/* HEADER - Selalu berwarna, bisa diklik */}
      <div 
        onClick={() => canExpand && setIsExpanded(!isExpanded)}
        className={`rounded-[28px] h-14 px-5 flex items-center shadow-sm cursor-pointer transition-all duration-200
          ${status.bgColor || 'bg-gradient-to-r from-emerald-500 to-teal-600'}
          ${isExpanded ? 'rounded-b-none' : ''}
        `}
      >
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3 overflow-hidden flex-1">
            <div className="h-2.5 w-2.5 rounded-full shrink-0 bg-white" />
            <p className="text-[14px] font-black uppercase tracking-tight truncate text-white">
              {status.icon} {status.text}
            </p>
          </div>
          
          {canExpand && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20">
              <span className="text-[9px] font-black uppercase text-white">
                {isExpanded ? 'Tutup' : 'Detail'}
              </span>
              <svg 
                className={`w-3 h-3 transition-transform duration-200 text-white ${isExpanded ? 'rotate-180' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* EXPANDED CONTENT - Muncul di bawah header */}
      {isExpanded && canExpand && (
        <div className="bg-white border border-t-0 border-gray-100 rounded-b-[28px] px-5 pb-5 pt-3 shadow-sm">
          <div className="space-y-3">
            {/* Ringkasan Multi-User */}
            <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-bold text-amber-600 uppercase tracking-wider">
                  Cerita Warga ({freshReports.length} laporan)
                </span>
                {waktuUpdate && (
                  <span className="text-[9px] text-amber-400">
                    {waktuUpdate}
                  </span>
                )}
              </div>
              
              <p className="text-[13px] leading-relaxed text-gray-700 italic">
                "{ringkasanMultiUser}"
              </p>

              {/* Avatar Group */}
              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-amber-200/50">
                <div className="flex -space-x-2">
                  {freshReports.slice(0, 5).map((report, idx) => (
                    <div 
                      key={idx} 
                      className="w-6 h-6 rounded-full bg-amber-200 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center"
                      title={report.user_name}
                    >
                      {report.user_avatar ? (
                        <img src={report.user_avatar} className="h-full w-full object-cover" alt={report.user_name} />
                      ) : (
                        <span className="text-[8px] font-bold text-amber-600">
                          {report.user_name?.charAt(0).toUpperCase() || "W"}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <span className="text-[9px] text-gray-500">
                  +{freshReports.length} warga melaporkan
                </span>
              </div>
            </div>

            {/* Footer Info */}
            <div className="flex items-center justify-between px-1">
              <div className="flex gap-3">
                <div>
                  <span className="text-[8px] font-bold text-gray-400 uppercase">Status</span>
                  <p className="text-[10px] font-bold text-gray-600">{status.badge || status.text}</p>
                </div>
                <div className="border-l border-gray-200 pl-3">
                  <span className="text-[8px] font-bold text-gray-400 uppercase">Saksi</span>
                  <p className="text-[10px] font-bold text-gray-600">🗃️ {jumlahWarga || 0}</p>
                </div>
                <div className="border-l border-gray-200 pl-3">
                  <span className="text-[8px] font-bold text-gray-400 uppercase">Laporan</span>
                  <p className="text-[10px] font-bold text-gray-600">👥 {freshReports.length}</p>
                </div>
              </div>
              {jarakFix && (
                <div className="text-right">
                  <span className="text-[8px] font-bold text-gray-400 uppercase">Jarak</span>
                  <p className="text-[10px] font-bold text-gray-500">{jarakFix}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}