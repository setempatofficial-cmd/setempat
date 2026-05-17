"use client";

import { useDataContext } from "@/contexts/DataContext";
import { useMemo, useState, useEffect } from "react";
import { generateStatusText, getDefaultTextByTime } from "@/lib/generateStatusText";
import { generateRingkasanMultiUser } from "@/lib/generateRingkasanMultiUser";
import { getPassiveSignals, getPassiveStatusText, getPassiveRingkasan } from "@/lib/passiveSignals";

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

  const seed = useMemo(() => String(item?.id || tempatId || "default"), [item?.id, tempatId]);

  const defaultSuasana = useMemo(() => {
    const category = item?.category || "general";
    return getDefaultTextByTime(seed, category);
  }, [seed, item?.category]);

  const status = useMemo(() => {
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

    if (passiveSignal && passiveSignal.total > 0) {
      const passiveStatus = getPassiveStatusText(passiveSignal);
      if (passiveStatus) return passiveStatus;
    }

    return {
      text: defaultSuasana,
      color: "text-slate-500",
      bgColor: "bg-slate-500",
      icon: "📍",
      badge: "NORMAL",
      vibe: hoursSinceLastReport
        ? `Belum ada laporan dalam ${hoursSinceLastReport} jam`
        : "Belum ada laporan",
      level: 1,
    };
  }, [hasFreshData, freshReports, latestFreshReport, item, hoursSinceLastReport, defaultSuasana, seed, passiveSignal]);

  const ringkasanMultiUser = useMemo(() => {
    if (hasFreshData) {
      return generateRingkasanMultiUser(freshReports, item?.category || "general");
    }
    if (passiveSignal && passiveSignal.total > 0) {
      return getPassiveRingkasan(passiveSignal, item?.name);
    }
    return "Belum ada laporan terbaru dari warga sekitar.";
  }, [hasFreshData, freshReports, item?.category, item?.name, passiveSignal]);

  const jarakFix = useMemo(() => {
    const dist = item?.distance;
    if (!dist) return null;
    const num = parseFloat(dist);
    return num < 1 ? `${Math.round(num * 1000)} m` : `${num.toFixed(1)} km`;
  }, [item?.distance]);

  const waktuUpdate = useMemo(() => {
    if (!latestFreshReport?.created_at) return null;
    const diffMin = Math.floor((new Date() - new Date(latestFreshReport.created_at)) / 60000);
    if (diffMin < 1) return "Baru saja";
    if (diffMin < 60) return `${diffMin}m lalu`;
    if (diffMin < 1440) return `${Math.floor(diffMin / 60)}j lalu`;
    return `${Math.floor(diffMin / 1440)}hari lalu`;
  }, [latestFreshReport]);

  const canExpand = (status.level >= 2 && hasFreshData) || (passiveSignal && passiveSignal.total > 0);

  // ============================================
  // RENDER DYNAMIC STYLE UTILITIES
  // ============================================
  const getGlowStyle = () => {
    if (hasFreshData && status.level >= 2) return 'shadow-[0_0_15px_-3px_rgba(245,158,11,0.15)] border-amber-500/20';
    if (passiveSignal && passiveSignal.total > 0) return 'shadow-[0_0_15px_-3px_rgba(168,85,247,0.15)] border-purple-500/20';
    return 'border-slate-100/80 shadow-sm';
  };

  if (!hasFreshData && isLoadingPassive && !passiveSignal) {
    return (
      <div className="mx-3 -mt-4 relative z-10 backdrop-blur-md bg-white/80 rounded-2xl border border-slate-100 p-3.5 flex items-center gap-3">
        <div className="h-2 w-2 rounded-full bg-slate-300 animate-ping" />
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 animate-pulse">Menyelidiki Suasana...</p>
      </div>
    );
  }

  return (
    <div className="mx-3 -mt-5 relative z-10 transition-all duration-300">
      {/* Main Island Card */}
      <div
        onClick={() => canExpand && setIsExpanded(!isExpanded)}
        className={`backdrop-blur-md bg-white/90 p-3.5 flex flex-col rounded-2xl border transition-all duration-300
          ${getGlowStyle()}
          ${canExpand ? 'cursor-pointer hover:bg-white active:scale-[0.99]' : ''}
          ${isExpanded ? 'rounded-b-none pb-2' : ''}
        `}
      >
        <div className="flex items-center justify-between gap-2">
          {/* Status Left Info */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <span className="text-base shrink-0">{status.icon}</span>
            <div className="flex flex-col min-w-0">
              <p className={`text-xs font-black tracking-wide uppercase truncate ${hasFreshData && status.level >= 2 ? 'text-amber-700' : 'text-slate-800'}`}>
                {status.text}
              </p>
              {hasFreshData && (
                <span className="text-[10px] text-slate-400 font-medium">Laporan Aktif Warga</span>
              )}
            </div>
          </div>

          {/* Badges Right Info */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Hanya munculkan badge ungu jika passiveSignal ADA dan totalnya DI ATAS 0 */}
            {passiveSignal && !hasFreshData && Number(passiveSignal.total) > 0 ? (
              <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-100 animate-pulse-subtle">
                ⚡ {passiveSignal.total} Aktivitas
              </span>
            ) : waktuUpdate ? (
              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                {waktuUpdate}
              </span>
            ) : (
              /* Fallback kalau benar-benar sepi/0 aktivitas agar layout tetep manis */
              <span className="text-[10px] font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                🟢 Aman
              </span>
            )}

            {canExpand && (
              <div className={`p-1 rounded-lg transition-colors ${isExpanded ? 'bg-slate-100 text-slate-700' : 'bg-slate-50 text-slate-400'}`}>
                <svg
                  className={`w-3.5 h-3.5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expandable Detail Section */}
      <div className={`grid transition-all duration-300 ease-in-out bg-white/95 backdrop-blur-md rounded-b-2xl border-x border-b border-slate-100/80 shadow-lg shadow-slate-100/50 overflow-hidden
        ${isExpanded && canExpand ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 border-none'}
      `}>
        <div className="overflow-hidden">
          <div className="p-4 pt-1 space-y-4">
            {/* Context Summary Box */}
            <div className={`p-3 rounded-xl border text-[13px] leading-relaxed shadow-inner
              ${hasFreshData
                ? 'bg-amber-50/40 border-amber-100 text-slate-700'
                : 'bg-purple-50/40 border-purple-100 text-slate-700'}
            `}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[9px] font-extrabold uppercase tracking-widest ${hasFreshData ? 'text-amber-600' : 'text-purple-600'}`}>
                  {hasFreshData ? `💬 Ringkasan ${freshReports.length} Warga` : '👀 Analisis Pantauan'}
                </span>
                {!hasFreshData && <span className="text-[9px] text-slate-400 font-medium">4 jam terakhir</span>}
              </div>

              <p className={hasFreshData ? "italic font-medium text-slate-600" : "font-medium text-slate-600"}>
                {hasFreshData ? `"${ringkasanMultiUser}"` : ringkasanMultiUser}
              </p>

              {/* Avatar Pile */}
              <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-slate-100">
                <div className="flex -space-x-1.5 overflow-hidden">
                  {hasFreshData ? (
                    freshReports.slice(0, 4).map((report, idx) => (
                      <div key={idx} className="w-5 h-5 rounded-full bg-amber-100 border border-white flex items-center justify-center text-[9px] font-bold text-amber-700 shrink-0">
                        {report.user_avatar ? (
                          <img src={report.user_avatar} className="h-full w-full object-cover rounded-full" alt="" />
                        ) : report.user_name?.charAt(0).toUpperCase() || "W"}
                      </div>
                    ))
                  ) : (
                    [...Array(Math.min(passiveSignal?.total || 0, 4))].map((_, idx) => (
                      <div key={idx} className="w-5 h-5 rounded-full bg-purple-100 border border-white flex items-center justify-center text-[9px] shrink-0">
                        👤
                      </div>
                    ))
                  )}
                </div>
                <span className="text-[10px] text-slate-400 font-medium">
                  {hasFreshData ? `${freshReports.length} warga ikut bersuara` : `${passiveSignal?.total || 0} interaksi lokal`}
                </span>
              </div>
            </div>

            {/* Footer Mini Stats */}
            <div className="flex items-center justify-between px-0.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <div className="flex gap-4">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-[9px] text-slate-400">Saksi</span>
                  <span className="text-slate-700 font-extrabold text-[11px]">🗃️ {jumlahWarga || 0}</span>
                </div>
                <div className="border-l border-slate-100 pl-4 flex flex-col gap-0.5">
                  <span className="font-medium text-[9px] text-slate-400">{hasFreshData ? 'Laporan' : 'Interaksi'}</span>
                  <span className="text-slate-700 font-extrabold text-[11px]">
                    {hasFreshData ? `👥 ${freshReports.length}` : `👥 ${passiveSignal?.total || 0}`}
                  </span>
                </div>
              </div>
              {jarakFix && (
                <div className="flex flex-col gap-0.5 items-end">
                  <span className="font-medium text-[9px] text-slate-400">Jarak Anda</span>
                  <span className="text-indigo-600 font-black text-[11px] bg-indigo-50 px-1.5 py-0.5 rounded">📍 {jarakFix}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}