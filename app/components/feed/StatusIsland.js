"use client";

import { useDataContext } from "@/contexts/DataContext";
import { useMemo, useState, useEffect } from "react";
import { generateStatusText, getDefaultTextByTime } from "@/lib/generateStatusText";
import { generateRingkasanMultiUser } from "@/lib/generateRingkasanMultiUser";
import { getPassiveSignals, getPassiveStatusText, getPassiveRingkasan } from "@/lib/passiveSignals";

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
  const [passiveSignal, setPassiveSignal] = useState(null);
  const [isLoadingPassive, setIsLoadingPassive] = useState(false);
  
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
  
  const allReportsRaw = useMemo(() => {
    if (allReports && allReports.length > 0) return allReports;
    return realtimeData?.recentReports || item?.laporan_terbaru || [];
  }, [allReports, realtimeData, item]);
  
  const freshReports = useMemo(() => getFreshReports(allReportsRaw, 12), [allReportsRaw]);
  const latestFreshReport = useMemo(() => getLatestFreshReport(allReportsRaw, 12), [allReportsRaw]);
  const hoursSinceLastReport = useMemo(() => getHoursSinceLastReport(allReportsRaw), [allReportsRaw]);
  const hasFreshData = useMemo(() => freshReports.length > 0, [freshReports]);
  
  // ============================================
  // FETCH PASSIVE SIGNAL (hanya jika tidak ada laporan fresh)
  // ============================================
  useEffect(() => {
    const targetId = item?.id || tempatId;
    if (!targetId) return;
    
    if (hasFreshData) {
      setPassiveSignal(null);
      return;
    }
    
    const fetchSignals = async () => {
      setIsLoadingPassive(true);
      try {
        const result = await getPassiveSignals(targetId, 4);
        setPassiveSignal(result);
      } catch (err) {
        console.error("Error fetching passive signals:", err);
        setPassiveSignal(null);
      } finally {
        setIsLoadingPassive(false);
      }
    };
    
    fetchSignals();
  }, [item?.id, tempatId, hasFreshData]);
  
  // ============================================
  // SEED & DEFAULT TEXT
  // ============================================
  const seed = useMemo(() => String(item?.id || tempatId || "default"), [item?.id, tempatId]);
  
  const defaultSuasana = useMemo(() => {
    const category = item?.category || "general";
    return getDefaultTextByTime(seed, category);
  }, [seed, item?.category]);
  
  // ============================================
  // GENERATE STATUS TEXT
  // ============================================
  const status = useMemo(() => {
    // PRIORITAS 1: Ada laporan fresh dari warga
    if (hasFreshData) {
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
        seed,
      });
    }
    
    // PRIORITAS 2: Tidak ada laporan, tapi ada passive signal
    if (passiveSignal && passiveSignal.total > 0) {
      const passiveStatus = getPassiveStatusText(passiveSignal);
      if (passiveStatus) return passiveStatus;
    }
    
    // PRIORITAS 3: Default
    return {
      text: defaultSuasana,
      color: "text-gray-500",
      bgColor: "bg-gray-500",
      icon: "📍",
      badge: "NORMAL",
      vibe: hoursSinceLastReport 
        ? `Belum ada laporan dalam ${hoursSinceLastReport} jam`
        : "Belum ada laporan",
      level: 1,
    };
  }, [hasFreshData, freshReports, latestFreshReport, item, hoursSinceLastReport, defaultSuasana, seed, passiveSignal]);
  
  // ============================================
  // RINGKASAN MULTI-USER (EXPAND)
  // ============================================
  const ringkasanMultiUser = useMemo(() => {
    if (hasFreshData) {
      return generateRingkasanMultiUser(freshReports, item?.category || "general");
    }
    if (passiveSignal && passiveSignal.total > 0) {
      return getPassiveRingkasan(passiveSignal, item?.name);
    }
    return "Belum ada laporan terbaru dari warga sekitar.";
  }, [hasFreshData, freshReports, item?.category, item?.name, passiveSignal]);
  
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
  // WAKTU UPDATE
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
  const canExpand = (status.level >= 2 && hasFreshData) || (passiveSignal && passiveSignal.total > 0);
  
  // ============================================
  // RENDER: TIDAK ADA DATA FRESH
  // ============================================
  if (!hasFreshData) {
    if (isLoadingPassive && !passiveSignal) {
      return (
        <div className="h-14 px-5 flex items-center rounded-[28px] border bg-white border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 w-full">
            <div className="h-2 w-2 rounded-full shrink-0 bg-gray-300 animate-pulse" />
            <p className="text-[14px] font-black uppercase tracking-tight truncate flex-1 text-gray-400">
              Memuat...
            </p>
          </div>
        </div>
      );
    }
    
    return (
      <div className="relative">
        <div 
          onClick={() => canExpand && setIsExpanded(!isExpanded)}
          className={`h-14 px-5 flex items-center rounded-[28px] border bg-white border-gray-100 shadow-sm transition-all duration-200
            ${canExpand ? 'cursor-pointer hover:bg-gray-50' : ''}
            ${isExpanded ? 'rounded-b-none' : ''}
          `}
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3 w-full">
              <div className={`h-2 w-2 rounded-full shrink-0 ${status.color?.replace('text', 'bg') || 'bg-gray-400'}`} />
              <p className={`text-[14px] font-black uppercase tracking-tight truncate flex-1 ${status.color || 'text-gray-500'}`}>
                {status.icon} {status.text}
              </p>
              {passiveSignal ? (
                <span className="text-[9px] text-purple-500 bg-purple-50 px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap">
                  📊 {passiveSignal.total} interaksi
                </span>
              ) : hoursSinceLastReport && (
                <span className="text-[9px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap">
                  {hoursSinceLastReport} jam lalu
                </span>
              )}
            </div>
            
            {canExpand && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 ml-2">
                <span className="text-[9px] font-black uppercase text-gray-500">
                  {isExpanded ? 'Tutup' : 'Detail'}
                </span>
                <svg 
                  className={`w-3 h-3 transition-transform duration-200 text-gray-500 ${isExpanded ? 'rotate-180' : ''}`}
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

        {isExpanded && canExpand && (
          <div className="bg-white border border-t-0 border-gray-100 rounded-b-[28px] px-5 pb-5 pt-3 shadow-sm">
            <div className="space-y-3">
              <div className={`p-3 rounded-xl ${passiveSignal?.isCrowded ? 'bg-orange-50/80 border border-orange-100' : 'bg-purple-50/80 border border-purple-100'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[9px] font-bold uppercase tracking-wider ${passiveSignal?.isCrowded ? 'text-orange-600' : 'text-purple-600'}`}>
                    {passiveSignal?.isCrowded ? '📊 AKTIVITAS PENGGUNA' : '👀 MINAT PENGGUNA'}
                  </span>
                  <span className="text-[9px] text-gray-400">4 jam terakhir</span>
                </div>
                
                <p className="text-[13px] leading-relaxed text-gray-700 whitespace-pre-line">
                  {ringkasanMultiUser}
                </p>

                <div className="flex items-center gap-2 mt-3 pt-2 border-t border-purple-200/50">
                  <div className="flex -space-x-2">
                    {[...Array(Math.min(passiveSignal?.total || 0, 5))].map((_, idx) => (
                      <div key={idx} className="w-6 h-6 rounded-full bg-purple-200 border-2 border-white shadow-sm flex items-center justify-center">
                        <span className="text-[8px] font-bold text-purple-600">👤</span>
                      </div>
                    ))}
                  </div>
                  <span className="text-[9px] text-gray-500">
                    {passiveSignal?.total || 0} interaksi dalam 4 jam
                  </span>
                </div>
              </div>

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
                    <span className="text-[8px] font-bold text-gray-400 uppercase">Interaksi</span>
                    <p className="text-[10px] font-bold text-gray-600">👥 {passiveSignal?.total || 0}</p>
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
  
  // ============================================
  // RENDER: ADA DATA FRESH LEVEL 1
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
  // RENDER: ADA DATA FRESH LEVEL 2 & 3
  // ============================================
  return (
    <div className="relative">
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

      {isExpanded && canExpand && (
        <div className="bg-white border border-t-0 border-gray-100 rounded-b-[28px] px-5 pb-5 pt-3 shadow-sm">
          <div className="space-y-3">
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
              
              <p className="text-[13px] leading-relaxed text-gray-700 italic whitespace-pre-line">
                "{ringkasanMultiUser}"
              </p>

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