"use client";

import { useDataContext } from "@/contexts/DataContext";
import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { generateStatusText, getDefaultTextByTime } from "@/lib/generateStatusText";
import { generateRingkasanMultiUser } from "@/lib/generateRingkasanMultiUser";
import { getPassiveSignals, getPassiveStatusText, getPassiveRingkasan } from "@/lib/passiveSignals";
import { useWeather, getWeatherAsSignal } from "@/hooks/useWeather";

export default function StatusIsland({
  item,
  tempatId = null,
  allReports = [],
  isExpanded: externalExpanded,
  setIsExpanded: externalSetIsExpanded,
  jumlahWarga,
  locationName
}) {
  const { getAIContext } = useDataContext();
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [passiveSignal, setPassiveSignal] = useState(null);
  const [isLoadingPassive, setIsLoadingPassive] = useState(false);
  const passiveCacheRef = useRef(new Map());
  const abortControllerRef = useRef(null);

  const { weather, loading: weatherLoading, error: weatherError, refreshWeather } = useWeather(locationName);

  const isExpanded = externalExpanded ?? internalExpanded;
  const setIsExpanded = externalSetIsExpanded || setInternalExpanded;
  const targetId = item?.id || tempatId;

  const realtimeData = useMemo(() => {
    if (!targetId) return null;
    return getAIContext(targetId);
  }, [targetId, getAIContext]);

  const allReportsRaw = allReports?.length ? allReports : (realtimeData?.recentReports || item?.laporan_terbaru || []);

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

  useEffect(() => {
    if (!targetId || hasFreshData) {
      setPassiveSignal(null);
      return;
    }

    const cacheKey = `${targetId}_with_weather`;
    const cached = passiveCacheRef.current.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < 60000) {
      setPassiveSignal(cached.data);
      return;
    }

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

        let finalResult = result;
        if (weather && !hasFreshData) {
          const weatherSignal = getWeatherAsSignal(weather);
          finalResult = {
            ...result,
            weather: weatherSignal,
            total: (result?.total || 0) + 1,
            hasWeatherAlert: weatherSignal.isWarning || weatherSignal.isExtreme,
            combinedStatus: weatherSignal.isExtreme
              ? `${weatherSignal.statusText} · ${result?.statusText || 'Waspada'}`
              : result?.statusText || weatherSignal.statusText
          };
        }

        if (isMounted && !abortController.signal.aborted) {
          setPassiveSignal(finalResult);
          passiveCacheRef.current.set(cacheKey, {
            data: finalResult,
            timestamp: Date.now()
          });
        }
      } catch (err) {
        if (isMounted && !abortController.signal.aborted) {
          if (weather && !hasFreshData) {
            const weatherOnly = {
              weather: getWeatherAsSignal(weather),
              total: 1,
              hasWeatherAlert: true
            };
            setPassiveSignal(weatherOnly);
          } else {
            setPassiveSignal(null);
          }
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
  }, [targetId, hasFreshData, weather]);

  const seed = targetId || "default";
  const defaultSuasana = useMemo(() => {
    const category = item?.category || "general";
    return getDefaultTextByTime(seed, category);
  }, [seed, item?.category]);

  // 🔥 Helper untuk menentukan level cuaca
  const getWeatherLevel = (condition) => {
    if (!condition) return 1;
    if (condition === 'Hujan Lebat' || condition === 'Hujan Petir') return 5;
    if (condition === 'Hujan Sedang') return 4;
    if (condition === 'Hujan Ringan') return 2;
    if (condition === 'Kabut') return 3;
    return 1;
  };

  // 🔥 Update status dengan gradasi cuaca yang lebih baik
  const status = useMemo(() => {
    const weatherLevel = passiveSignal?.weather ? getWeatherLevel(passiveSignal.weather.condition) : 0;
    const isLightRain = passiveSignal?.weather?.condition === 'Hujan Ringan';

    // PRIORITAS 1: Weather EXTREME (Hujan Lebat, Hujan Petir)
    if (weatherLevel >= 4 && !hasFreshData) {
      return {
        text: passiveSignal.weather.statusText,
        color: "text-red-600",
        bgColor: "bg-red-500",
        icon: passiveSignal.weather.icon,
        badge: weatherLevel === 5 ? "⚠️ HUJAN LEBAT" : "🌧️ HUJAN SEDANG",
        vibe: passiveSignal.weather.vibe,
        level: weatherLevel,
      };
    }

    // PRIORITAS 2: Kabut
    if (passiveSignal?.weather?.condition === 'Kabut' && !hasFreshData) {
      return {
        text: `🌫️ Kabut (${passiveSignal.weather.temp}°C)`,
        color: "text-amber-600",
        bgColor: "bg-amber-500",
        icon: "🌫️",
        badge: "KABUT",
        vibe: "Kabut mengurangi jarak pandang, hati-hati berkendara",
        level: 3,
      };
    }

    // PRIORITAS 3: Fresh data (laporan warga)
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

    // PRIORITAS 4: Passive signal (aktivitas ramai/minat) - lebih penting dari hujan ringan
    if (passiveSignal?.total > 0 && !hasFreshData && !isLightRain) {
      const passiveStatus = getPassiveStatusText(passiveSignal);
      if (passiveStatus) return passiveStatus;
    }

    // PRIORITAS 5: Hujan Ringan - TETAP DITAMPILKAN TAPI HALUS
    if (isLightRain && !hasFreshData) {
      return {
        text: `🌧️ Hujan Ringan (${passiveSignal.weather.temp}°C)`,
        color: "text-slate-500",
        bgColor: "bg-slate-400",
        icon: "🌧️",
        badge: "HUJAN",
        vibe: "Hujan ringan, jangan lupa payung",
        level: 2,
      };
    }

    // PRIORITAS 6: Cuaca Normal (Cerah/Berawan) - TIDAK DITAMPILKAN DI STATUS UTAMA
    if (passiveSignal?.weather && !hasFreshData && weatherLevel === 1) {
      return {
        text: defaultSuasana,
        color: "text-slate-500",
        bgColor: "bg-slate-500",
        icon: "📍",
        badge: "NORMAL",
        vibe: "Cuaca cerah",
        level: 1,
      };
    }

    // PRIORITAS 7: Default text
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
      let ringkasan = generateRingkasanMultiUser(freshReports, item?.category || "general");
      // Hanya tambah info cuaca jika signifikan (bukan hujan ringan)
      if (weather && (weather.condition === 'Hujan Sedang' || weather.condition === 'Hujan Lebat' || weather.condition === 'Hujan Petir' || weather.condition === 'Kabut')) {
        ringkasan += ` ☁️ Cuaca ${weather.short} ${weather.temp}°C, waspada saat bepergian.`;
      }
      return ringkasan;
    }

    if (passiveSignal?.weather) {
      const weatherInfo = passiveSignal.weather;
      if (weatherInfo.isExtreme) {
        return `⚠️ PERINGATAN CUACA EKSTREM: ${weatherInfo.statusText}. ${weatherInfo.vibe} Hindari aktivitas luar ruangan jika tidak perlu.`;
      }
      if (weatherInfo.isWarning && weatherInfo.condition !== 'Hujan Ringan') {
        return `🌧️ INFO CUACA: ${weatherInfo.statusText}. ${weatherInfo.vibe} Bawa perlengkapan hujan jika berpergian.`;
      }
      if (weatherInfo.condition === 'Hujan Ringan') {
        return `☔ Hujan Ringan: ${weatherInfo.temp}°C, kelembaban ${weatherInfo.humidity}%. Jangan lupa bawa payung.`;
      }
      return `☀️ Cuaca: ${weatherInfo.statusText}. Kondisi mendukung aktivitas normal.`;
    }

    if (passiveSignal?.total > 0) {
      return getPassiveRingkasan(passiveSignal, item?.name);
    }

    return "Belum ada laporan terbaru dari warga sekitar.";
  }, [hasFreshData, freshReports, item?.category, item?.name, passiveSignal, weather]);

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

  // 🔥 Hujan ringan TIDAK trigger expand (kecuali ada aktivitas)
  const canExpand =
    (status.level >= 3 && hasFreshData) || // Laporan warga atau cuaca signifikan
    (passiveSignal?.weather?.isExtreme) ||
    (passiveSignal?.weather?.condition === 'Hujan Sedang') ||
    (passiveSignal?.weather?.condition === 'Kabut') ||
    (passiveSignal?.total > 1); // Aktivitas > 1 orang

  // 🔥 Glow hanya untuk cuaca signifikan, bukan hujan ringan
  const glowStyle = (hasFreshData && status.level >= 2)
    ? 'shadow-[0_0_15px_-3px_rgba(245,158,11,0.15)] border-amber-500/20'
    : (passiveSignal?.weather?.isExtreme)
      ? 'shadow-[0_0_20px_-3px_rgba(220,38,38,0.2)] border-red-500/30 animate-pulse'
      : (passiveSignal?.weather?.condition === 'Hujan Sedang')
        ? 'shadow-[0_0_15px_-3px_rgba(59,130,246,0.15)] border-blue-500/20'
        : (passiveSignal?.weather?.condition === 'Kabut')
          ? 'shadow-[0_0_15px_-3px_rgba(245,158,11,0.15)] border-amber-500/20'
          : (passiveSignal?.total > 0)
            ? 'shadow-[0_0_15px_-3px_rgba(168,85,247,0.15)] border-purple-500/20'
            : 'border-slate-100/80 shadow-sm';

  return (
    <div className="mx-3 -mt-5 relative z-10 transition-all duration-300">
      <div
        onClick={() => canExpand && setIsExpanded(!isExpanded)}
        className={`backdrop-blur-md bg-white/90 p-3.5 flex flex-col rounded-2xl border transition-all duration-300
          ${glowStyle}
          ${canExpand ? 'cursor-pointer hover:bg-white active:scale-[0.99]' : ''}
          ${isExpanded ? 'rounded-b-none pb-2' : ''}
        `}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <span className="text-base shrink-0">{status.icon}</span>
            <div className="flex flex-col min-w-0">
              <p className={`text-xs font-black tracking-wide uppercase truncate ${status.color}`}>
                {status.text}
              </p>
              {hasFreshData && (
                <span className="text-[10px] text-slate-400 font-medium">Laporan Aktif Warga</span>
              )}
              {!hasFreshData && passiveSignal?.weather?.condition === 'Hujan Ringan' && (
                <span className="text-[10px] text-slate-400 font-medium">☔ Hujan ringan</span>
              )}
              {!hasFreshData && passiveSignal?.weather?.isExtreme && (
                <span className="text-[10px] text-red-500 font-medium animate-pulse">⚠️ Peringatan Cuaca!</span>
              )}
              {!hasFreshData && !passiveSignal?.weather && isLoadingPassive && (
                <span className="text-[10px] text-purple-400 font-medium animate-pulse">🔍 Cek Situasi...</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Weather badge dengan gradasi */}
            {weather && !hasFreshData && (
              <>
                {/* Hujan Lebat/Petir */}
                {(weather.condition === 'Hujan Lebat' || weather.condition === 'Hujan Petir') && (
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg border text-red-600 bg-red-50 border-red-200 animate-pulse">
                    ⚠️ {weather.icon} {weather.temp}°
                  </span>
                )}
                {/* Hujan Sedang */}
                {weather.condition === 'Hujan Sedang' && (
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg border text-blue-600 bg-blue-50 border-blue-200">
                    🌧️ {weather.temp}°
                  </span>
                )}
                {/* Hujan Ringan - subtle */}
                {weather.condition === 'Hujan Ringan' && (
                  <span className="text-[10px] px-2 py-1 rounded-lg text-slate-500 bg-slate-50 border border-slate-100">
                    {weather.icon} {weather.temp}°
                  </span>
                )}
                {/* Kabut */}
                {weather.condition === 'Kabut' && (
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg border text-amber-600 bg-amber-50 border-amber-200">
                    🌫️ {weather.temp}°
                  </span>
                )}
                {/* Cerah/Berawan - minimal */}
                {(weather.condition === 'Cerah' || weather.condition === 'Cerah Berawan' || weather.condition === 'Berawan') && (
                  <span className="text-[10px] text-slate-400 bg-transparent px-1">
                    {weather.temp}°
                  </span>
                )}
              </>
            )}

            {passiveSignal && !hasFreshData && passiveSignal.total > 0 && !passiveSignal?.weather && (
              <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-100">
                ⚡ {passiveSignal.total} Aktivitas
              </span>
            )}

            {waktuUpdate ? (
              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                {waktuUpdate}
              </span>
            ) : weather && !hasFreshData ? (
              <span className="text-[10px] font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </span>
            ) : (
              <span className="text-[10px] font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                🟢 Aman
              </span>
            )}

            {canExpand && (
              <div className={`p-1 rounded-lg transition-colors ${isExpanded ? 'bg-slate-100 text-slate-700' : 'bg-slate-50 text-slate-400'}`}>
                <svg className={`w-3.5 h-3.5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
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
            {/* Weather Alert Section - untuk SEMUA kondisi cuaca */}
            {passiveSignal?.weather && !hasFreshData && (
              <div className={`p-3 rounded-xl border ${passiveSignal.weather.isExtreme ? 'bg-red-50/80 border-red-200' :
                  passiveSignal.weather.condition === 'Hujan Sedang' ? 'bg-blue-50/80 border-blue-200' :
                    passiveSignal.weather.condition === 'Hujan Ringan' ? 'bg-slate-50/80 border-slate-200' :
                      passiveSignal.weather.condition === 'Kabut' ? 'bg-amber-50/80 border-amber-200' :
                        'bg-blue-50/80 border-blue-200'
                }`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{passiveSignal.weather.icon}</span>
                  <span className={`text-xs font-bold uppercase ${passiveSignal.weather.isExtreme ? 'text-red-700' :
                      passiveSignal.weather.condition === 'Hujan Sedang' ? 'text-blue-700' :
                        passiveSignal.weather.condition === 'Hujan Ringan' ? 'text-slate-600' :
                          passiveSignal.weather.condition === 'Kabut' ? 'text-amber-700' :
                            'text-blue-700'
                    }`}>
                    {passiveSignal.weather.isExtreme && '⚠️ Peringatan Cuaca Ekstrem'}
                    {passiveSignal.weather.condition === 'Hujan Sedang' && '🌧️ Hujan Sedang'}
                    {passiveSignal.weather.condition === 'Hujan Ringan' && '☔ Informasi Hujan'}
                    {passiveSignal.weather.condition === 'Kabut' && '🌫️ Kabut'}
                    {!passiveSignal.weather.isExtreme && !passiveSignal.weather.condition?.includes('Hujan') && passiveSignal.weather.condition !== 'Kabut' && '🌤️ Informasi Cuaca'}
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-700">
                  {passiveSignal.weather.statusText}
                </p>
                <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-200/50">
                  <div className="text-center">
                    <p className="text-[10px] text-slate-500">Suhu</p>
                    <p className="text-sm font-bold text-slate-700">{weather?.temp}°C</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-slate-500">Kelembaban</p>
                    <p className="text-sm font-bold text-slate-700">{weather?.humidity}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-slate-500">Angin</p>
                    <p className="text-sm font-bold text-slate-700">{weather?.windSpeed} km/h</p>
                  </div>
                </div>
                {passiveSignal.weather.isExtreme && (
                  <div className="mt-2 p-2 bg-red-100/50 rounded-lg text-[11px] text-red-700 font-medium">
                    ⚠️ {passiveSignal.weather.vibe} Hindari aktivitas di luar ruangan jika tidak mendesak.
                  </div>
                )}
                {passiveSignal.weather.condition === 'Hujan Ringan' && (
                  <div className="mt-2 text-[11px] text-slate-500">
                    ☔ Rekomendasi: Bawa payung, jalanan mungkin licin.
                  </div>
                )}
                {passiveSignal.weather.condition === 'Kabut' && (
                  <div className="mt-2 text-[11px] text-amber-600">
                    🌫️ Kurangi kecepatan dan nyalakan lampu kendaraan.
                  </div>
                )}
              </div>
            )}

            {/* Context Summary Box */}
            <div className={`p-3 rounded-xl border text-[13px] leading-relaxed shadow-inner
              ${hasFreshData
                ? 'bg-amber-50/40 border-amber-100 text-slate-700'
                : passiveSignal?.weather?.isExtreme
                  ? 'bg-red-50/40 border-red-100'
                  : 'bg-purple-50/40 border-purple-100 text-slate-700'}
            `}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[9px] font-extrabold uppercase tracking-widest ${hasFreshData ? 'text-amber-600' :
                    passiveSignal?.weather?.isExtreme ? 'text-red-600' : 'text-purple-600'
                  }`}>
                  {hasFreshData
                    ? `💬 Ringkasan ${freshCount} Warga`
                    : passiveSignal?.weather?.isExtreme
                      ? '⚠️ Peringatan Cuaca'
                      : '👀 Analisis Situasi'}
                </span>
                {!hasFreshData && passiveSignal?.total > 0 && (
                  <span className="text-[9px] text-slate-400 font-medium">4 jam terakhir</span>
                )}
              </div>

              <p className={`font-medium ${hasFreshData ? "italic text-slate-600" : "text-slate-600"}`}>
                {ringkasanMultiUser}
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
                  {hasFreshData
                    ? `${freshCount} warga ikut bersuara`
                    : passiveSignal?.weather?.isExtreme
                      ? '⚠️ Tetap waspada'
                      : `${passiveSignal?.total || 0} interaksi lokal`}
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
                {weather && !hasFreshData && (
                  <div className="border-l border-slate-100 pl-4 flex flex-col gap-0.5">
                    <span className="font-medium text-[9px] text-slate-400">Cuaca</span>
                    <span className={`font-extrabold text-[11px] ${weather.condition === 'Hujan Lebat' || weather.condition === 'Hujan Petir' ? 'text-red-600' :
                        weather.condition === 'Hujan Sedang' ? 'text-blue-600' :
                          weather.condition === 'Hujan Ringan' ? 'text-slate-500' :
                            weather.condition === 'Kabut' ? 'text-amber-600' :
                              'text-slate-500'
                      }`}>
                      {weather.icon} {weather.temp}°
                    </span>
                  </div>
                )}
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