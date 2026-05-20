"use client";

import { useDataContext } from "@/contexts/DataContext";
import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { generateStatusText, getDefaultTextByTime } from "@/lib/generateStatusText";
import { generateRingkasanMultiUser } from "@/lib/generateRingkasanMultiUser";
import { getPassiveSignals, getPassiveStatusText, getPassiveRingkasan } from "@/lib/passiveSignals";

// Helper functions
const getFreshReports = (reports, maxHours = 12) => {
  if (!reports?.length) return [];
  const now = Date.now();
  return reports.filter(report => {
    if (!report?.created_at) return false;
    const hoursDiff = (now - new Date(report.created_at).getTime()) / (1000 * 60 * 60);
    return hoursDiff <= maxHours;
  });
};

const getHoursSinceLastReport = (reports) => {
  if (!reports?.length) return null;
  const latest = reports[0];
  if (!latest?.created_at) return null;
  const hoursDiff = (Date.now() - new Date(latest.created_at).getTime()) / (1000 * 60 * 60);
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
  const passiveCacheRef = useRef(new Map());
  const abortControllerRef = useRef(null);

  const isExpanded = externalExpanded ?? internalExpanded;
  const setIsExpanded = externalSetIsExpanded || setInternalExpanded;

  const targetId = item?.id || tempatId;

  const realtimeData = useMemo(() => {
    if (!targetId) return null;
    return getAIContext(targetId);
  }, [targetId, getAIContext]);

  const allReportsRaw = allReports?.length ? allReports : (realtimeData?.recentReports || item?.laporan_terbaru || []);

  // Hitung semua statistik sekaligus
  const reportStats = useMemo(() => {
    const fresh = getFreshReports(allReportsRaw, 12);
    const hoursSince = getHoursSinceLastReport(allReportsRaw);
    return {
      freshReports: fresh,
      latestFreshReport: fresh[0] || null,
      hoursSinceLastReport: hoursSince,
      hasFreshData: fresh.length > 0,
      freshCount: fresh.length
    };
  }, [allReportsRaw]);

  const { freshReports, latestFreshReport, hoursSinceLastReport, hasFreshData, freshCount } = reportStats;

  // Optimasi useEffect - fetch langsung, dengan cache, tanpa debounce
  useEffect(() => {
    if (!targetId || hasFreshData) {
      setPassiveSignal(null);
      return;
    }

    // Cek cache dulu
    const cacheKey = targetId;
    const cached = passiveCacheRef.current.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < 60000) { // Cache 1 menit
      setPassiveSignal(cached.data);
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    let isMounted = true;
    setIsLoadingPassive(true);

    const fetchSignals = async () => {
      try {
        const result = await getPassiveSignals(targetId, 4);
        if (isMounted && !abortController.signal.aborted) {
          setPassiveSignal(result);
          // Simpan ke cache
          passiveCacheRef.current.set(cacheKey, {
            data: result,
            timestamp: Date.now()
          });
        }
      } catch (err) {
        if (isMounted && !abortController.signal.aborted) {
          setPassiveSignal(null);
        }
      } finally {
        if (isMounted && !abortController.signal.aborted) {
          setIsLoadingPassive(false);
        }
      }
    };

    fetchSignals();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [targetId, hasFreshData]);

  const seed = targetId || "default";
  const defaultSuasana = useMemo(() => {
    const category = item?.category || "general";
    return getDefaultTextByTime(seed, category);
  }, [seed, item?.category]);

  // Generate status - dengan fallback instant
  const status = useMemo(() => {
    // Prioritas 1: Fresh data (laporan warga)
    if (hasFreshData && latestFreshReport) {
      const kondisi = latestFreshReport?.tipe || item?.latest_condition || "Normal";
      const trafficCondition = latestFreshReport?.traffic_condition;
      const isRecent = latestFreshReport?.created_at
        ? (Date.now() - new Date(latestFreshReport.created_at).getTime()) < (2 * 60 * 60 * 1000)
        : false;

      return generateStatusText({
        kondisi,
        trafficCondition,
        total: freshCount,
        isRecent,
        category: item?.category || "general",
        name: item?.name || "",
        deskripsi: latestFreshReport?.deskripsi || "",
        jarak: item?.distance,
        seed,
      });
    }

    // Prioritas 2: Passive signal (sudah jadi atau sedang loading? tetap tampilkan default dulu)
    if (passiveSignal?.total > 0) {
      const passiveStatus = getPassiveStatusText(passiveSignal);
      if (passiveStatus) return passiveStatus;
    }

    // Prioritas 3: Default text (langsung tampil, tidak nunggu loading)
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
  }, [hasFreshData, latestFreshReport, freshCount, item, hoursSinceLastReport, defaultSuasana, seed, passiveSignal]);

  const ringkasanMultiUser = useMemo(() => {
    if (hasFreshData && freshReports.length) {
      return generateRingkasanMultiUser(freshReports, item?.category || "general");
    }
    if (passiveSignal?.total > 0) {
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
    const diffMin = Math.floor((Date.now() - new Date(latestFreshReport.created_at).getTime()) / 60000);
    if (diffMin < 1) return "Baru saja";
    if (diffMin < 60) return `${diffMin}m lalu`;
    if (diffMin < 1440) return `${Math.floor(diffMin / 60)}j lalu`;
    return `${Math.floor(diffMin / 1440)}hari lalu`;
  }, [latestFreshReport]);

  const canExpand = (status.level >= 2 && hasFreshData) || (passiveSignal?.total > 0);

  const glowStyle = (hasFreshData && status.level >= 2)
    ? 'shadow-[0_0_15px_-3px_rgba(245,158,11,0.15)] border-amber-500/20'
    : (passiveSignal?.total > 0)
      ? 'shadow-[0_0_15px_-3px_rgba(168,85,247,0.15)] border-purple-500/20'
      : 'border-slate-100/80 shadow-sm';

  // 🚀 TIDAK ADA LAGI LOADING STATE YANG MENGANGGO!
  // Langsung tampilkan card dengan default text, fetch berjalan di background
  return (
    <div className="mx-3 -mt-5 relative z-10 transition-all duration-300">
      {/* Main Island Card */}
      <div
        onClick={() => canExpand && setIsExpanded(!isExpanded)}
        className={`backdrop-blur-md bg-white/90 p-3.5 flex flex-col rounded-2xl border transition-all duration-300
          ${glowStyle}
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
              {!hasFreshData && isLoadingPassive && (
                <span className="text-[10px] text-purple-400 font-medium animate-pulse">🔍 Cek Situasi...</span>
              )}
            </div>
          </div>

          {/* Badges Right Info */}
          <div className="flex items-center gap-2 shrink-0">
            {passiveSignal && !hasFreshData && passiveSignal.total > 0 ? (
              <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-100">
                ⚡ {passiveSignal.total} Aktivitas
              </span>
            ) : waktuUpdate ? (
              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                {waktuUpdate}
              </span>
            ) : (
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
      {isExpanded && canExpand && (
        <div className="bg-white/95 backdrop-blur-md rounded-b-2xl border-x border-b border-slate-100/80 shadow-lg shadow-slate-100/50 overflow-hidden animate-in slide-in-from-top-1 duration-200">
          <div className="p-4 pt-1 space-y-4">
            {/* Context Summary Box */}
            <div className={`p-3 rounded-xl border text-[13px] leading-relaxed shadow-inner
              ${hasFreshData
                ? 'bg-amber-50/40 border-amber-100 text-slate-700'
                : 'bg-purple-50/40 border-purple-100 text-slate-700'}
            `}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[9px] font-extrabold uppercase tracking-widest ${hasFreshData ? 'text-amber-600' : 'text-purple-600'}`}>
                  {hasFreshData ? `💬 Ringkasan ${freshCount} Warga` : '👀 Analisis Pantauan'}
                </span>
                {!hasFreshData && passiveSignal?.total > 0 && (
                  <span className="text-[9px] text-slate-400 font-medium">4 jam terakhir</span>
                )}
              </div>

              <p className={hasFreshData ? "italic font-medium text-slate-600" : "font-medium text-slate-600"}>
                {hasFreshData ? `"${ringkasanMultiUser}"` : ringkasanMultiUser}
              </p>

              {/* Avatar Pile */}
              <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-slate-100">
                <div className="flex -space-x-1.5 overflow-hidden">
                  {hasFreshData
                    ? freshReports.slice(0, 4).map((report, idx) => (
                      <div key={idx} className="w-5 h-5 rounded-full bg-amber-100 border border-white flex items-center justify-center text-[9px] font-bold text-amber-700 shrink-0">
                        {report.user_avatar ? (
                          <img src={report.user_avatar} className="h-full w-full object-cover rounded-full" alt="" loading="lazy" />
                        ) : report.user_name?.charAt(0).toUpperCase() || "W"}
                      </div>
                    ))
                    : passiveSignal?.total > 0 && Array(Math.min(passiveSignal.total, 4)).fill().map((_, idx) => (
                      <div key={idx} className="w-5 h-5 rounded-full bg-purple-100 border border-white flex items-center justify-center text-[9px] shrink-0">
                        👤
                      </div>
                    ))
                  }
                </div>
                <span className="text-[10px] text-slate-400 font-medium">
                  {hasFreshData ? `${freshCount} warga ikut bersuara` : `${passiveSignal?.total || 0} interaksi lokal`}
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
                    {hasFreshData ? `👥 ${freshCount}` : `👥 ${passiveSignal?.total || 0}`}
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
      )}
    </div>
  );
}