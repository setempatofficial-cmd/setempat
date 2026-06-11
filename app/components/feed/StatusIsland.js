"use client";

import { useDataContext } from "@/contexts/DataContext";
import { useMemo, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion"; // Dioptimasi menggunakan framer-motion
import { generateStatusText, getDefaultTextByTime } from "@/lib/generateStatusText";
import { generateRingkasanMultiUser } from "@/lib/generateRingkasanMultiUser";
import { getPassiveSignals, getPassiveStatusText, getPassiveRingkasan } from "@/lib/passiveSignals";
import { useWeather, getWeatherAsSignal } from "@/hooks/useWeather";

// ==================== CONSTANTS ====================
const STATUS_CONFIG = {
  FRESH_REPORT_HOURS: 12,
  CACHE_TTL_MS: 60000,
  RECENT_REPORT_HOURS: 2,
  MAX_PASSIVE_SIGNALS: 4,
  MAX_DISPLAY_REPORTS: 4
};

const WEATHER_PRIORITY = {
  'Hujan Petir': 5,
  'Hujan Lebat': 5,
  'Hujan Sedang': 4,
  'Kabut': 3,
  'Hujan Ringan': 2
};

const DEFAULT_WEATHER_LEVEL = 1;

// ==================== HELPER FUNCTIONS ====================
const getWeatherLevel = (condition) => {
  if (!condition) return DEFAULT_WEATHER_LEVEL;
  return WEATHER_PRIORITY[condition] || DEFAULT_WEATHER_LEVEL;
};

const isWeatherCondition = (condition, type) => {
  const conditions = {
    lightRain: ['Hujan Ringan'],
    moderateRain: ['Hujan Sedang'],
    heavyRain: ['Hujan Lebat', 'Hujan Petir'],
    fog: ['Kabut']
  };
  return conditions[type]?.includes(condition) ?? false;
};

const getFreshReports = (reports, maxHours = STATUS_CONFIG.FRESH_REPORT_HOURS) => {
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

const getRelativeTime = (createdAt) => {
  if (!createdAt) return null;
  const diffMin = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (diffMin < 1) return "Baru saja";
  if (diffMin < 60) return `${diffMin}m lalu`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}j lalu`;
  return `${Math.floor(diffMin / 1440)}hari lalu`;
};

// ==================== SUB-COMPONENTS ====================
const WeatherBadge = ({ weather, hasFreshData }) => {
  if (!weather || hasFreshData) return null;

  const getBadgeConfig = () => {
    if (isWeatherCondition(weather.condition, 'heavyRain')) {
      return { icon: '⚠️', text: `${weather.icon} ${weather.temp}°`, className: 'text-red-600 bg-red-50/80 border-red-200 shadow-sm shadow-red-100 animate-pulse' };
    }
    if (isWeatherCondition(weather.condition, 'moderateRain')) {
      return { icon: '🌧️', text: `${weather.temp}°`, className: 'text-blue-600 bg-blue-50/80 border-blue-200 shadow-sm shadow-blue-100 animate-pulse' };
    }
    if (isWeatherCondition(weather.condition, 'lightRain')) {
      return { icon: weather.icon, text: `${weather.temp}°`, className: 'text-slate-700 bg-slate-100/80 border-slate-200/60 shadow-sm' };
    }
    if (isWeatherCondition(weather.condition, 'fog')) {
      return { icon: '🌫️', text: `${weather.temp}°`, className: 'text-amber-600 bg-amber-50/80 border-amber-200/60 shadow-sm' };
    }
    return { icon: '', text: `${weather.temp}°`, className: 'text-slate-400 bg-transparent border-transparent' };
  };

  const config = getBadgeConfig();
  return (
    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border backdrop-blur-xs transition-all duration-300 ${config.className}`}>
      {config.icon && `${config.icon} `}{config.text}
    </span>
  );
};

const WeatherDetail = ({ weather, hasFreshData }) => {
  if (!weather || hasFreshData) return null;

  const isHeavyRain = isWeatherCondition(weather.condition, 'heavyRain');
  const isModerateRain = isWeatherCondition(weather.condition, 'moderateRain');
  const isLightRain = isWeatherCondition(weather.condition, 'lightRain');
  const isFog = isWeatherCondition(weather.condition, 'fog');

  const getRecommendation = () => {
    if (isHeavyRain) return "⚠️ Hindari aktivitas di luar ruangan jika tidak mendesak.";
    if (isLightRain) return "☔ Bawa payung atau jas hujan. Jalanan mungkin sedikit licin, kurangi kecepatan.";
    if (isModerateRain) return "🌧️ Gunakan jas hujan, kurangi kecepatan, dan waspadai genangan air.";
    if (isFog) return "🌫️ Kurangi kecepatan, nyalakan lampu kendaraan, dan jaga jarak aman.";
    return null;
  };

  const getBgClass = () => {
    if (isHeavyRain) return 'bg-red-50/60 border-red-100/80';
    if (isModerateRain) return 'bg-blue-50/60 border-blue-100/80';
    if (isLightRain) return 'bg-slate-50/60 border-slate-200/60';
    if (isFog) return 'bg-amber-50/60 border-amber-200/60';
    return 'bg-blue-50/60 border-blue-100/80';
  };

  const getTitleClass = () => {
    if (isHeavyRain) return 'text-red-700';
    if (isModerateRain) return 'text-blue-700';
    if (isLightRain) return 'text-slate-700';
    if (isFog) return 'text-amber-700';
    return 'text-blue-700';
  };

  const recommendation = getRecommendation();

  return (
    <div className={`p-3 rounded-xl border backdrop-blur-xs shadow-inner/50 ${getBgClass()}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{weather.icon}</span>
        <span className={`text-[11px] font-extrabold uppercase tracking-wide ${getTitleClass()}`}>
          {isHeavyRain && '⚠️ Peringatan Cuaca Ekstrem'}
          {isModerateRain && '🌧️ Hujan Sedang'}
          {isLightRain && '☔ Informasi Hujan Ringan'}
          {isFog && '🌫️ Kabut'}
          {!isHeavyRain && !isModerateRain && !isLightRain && !isFog && '🌤️ Informasi Cuaca'}
        </span>
      </div>
      <p className="text-xs font-semibold text-slate-700 leading-relaxed">{weather.statusText}</p>

      <div className="grid grid-cols-3 gap-2 mt-2.5 pt-2.5 border-t border-slate-200/40">
        <div className="text-center">
          <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wider">Suhu</p>
          <p className="text-xs font-bold text-slate-700 mt-0.5">{weather.temp}°C</p>
        </div>
        <div className="text-center">
          <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wider">Kelembaban</p>
          <p className="text-xs font-bold text-slate-700 mt-0.5">{weather.humidity}%</p>
        </div>
        <div className="text-center">
          <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wider">Angin</p>
          <p className="text-xs font-bold text-slate-700 mt-0.5">{weather.windSpeed} km/h</p>
        </div>
      </div>

      {recommendation && (
        <div className={`mt-2.5 p-2 rounded-lg text-[10px] font-semibold leading-relaxed shadow-xs ${isHeavyRain ? 'bg-red-100/40 text-red-700' :
            isModerateRain ? 'bg-blue-100/40 text-blue-700' :
              isLightRain ? 'bg-slate-100/50 text-slate-600' :
                'bg-amber-100/40 text-amber-700'
          }`}>
          {recommendation}
        </div>
      )}
    </div>
  );
};

const AvatarGroup = ({ reports, count, type }) => {
  const displayReports = reports?.slice(0, STATUS_CONFIG.MAX_DISPLAY_REPORTS) || [];

  return (
    <div className="flex -space-x-1.5 overflow-hidden">
      {displayReports.map((report, idx) => (
        <div key={idx} className="w-5 h-5 rounded-full bg-amber-100 border border-white flex items-center justify-center text-[9px] font-extrabold text-amber-700 shrink-0 ring-1 ring-black/5">
          {report.user_avatar ? (
            <img
              src={report.user_avatar}
              className="h-full w-full object-cover rounded-full"
              alt=""
              loading="lazy"
              onError={(e) => e.target.style.display = 'none'}
            />
          ) : report.user_name?.charAt(0).toUpperCase() || (type === 'warga' ? 'W' : '👤')}
        </div>
      ))}
    </div>
  );
};

// ==================== MAIN COMPONENT ====================
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

  const { weather } = useWeather(locationName);

  const isExpanded = externalExpanded ?? internalExpanded;
  const setIsExpanded = externalSetIsExpanded || setInternalExpanded;
  const targetId = item?.id || tempatId;

  const realtimeData = useMemo(() => {
    if (!targetId) return null;
    return getAIContext(targetId);
  }, [targetId, getAIContext]);

  const allReportsRaw = allReports?.length ? allReports : (realtimeData?.recentReports || item?.laporan_terbaru || []);

  const reportStats = useMemo(() => {
    const fresh = getFreshReports(allReportsRaw);
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

  // Fetch passive signals
  useEffect(() => {
    if (!targetId || hasFreshData) {
      setPassiveSignal(null);
      return;
    }

    const cacheKey = `${targetId}_with_weather`;
    const cached = passiveCacheRef.current.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < STATUS_CONFIG.CACHE_TTL_MS) {
      setPassiveSignal(cached.data);
      return;
    }

    if (abortControllerRef.current) abortControllerRef.current.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    let isMounted = true;
    setIsLoadingPassive(true);

    const fetchSignals = async () => {
      try {
        const result = await getPassiveSignals(targetId, STATUS_CONFIG.MAX_PASSIVE_SIGNALS);
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
          passiveCacheRef.current.set(cacheKey, { data: finalResult, timestamp: Date.now() });
        }
      } catch (err) {
        if (isMounted && !abortController.signal.aborted && weather && !hasFreshData) {
          setPassiveSignal({ weather: getWeatherAsSignal(weather), total: 1, hasWeatherAlert: true });
        } else if (isMounted && !abortController.signal.aborted) {
          setPassiveSignal(null);
        }
      } finally {
        if (isMounted && !abortController.signal.aborted) setIsLoadingPassive(false);
      }
    };

    fetchSignals();
    return () => { isMounted = false; abortController.abort(); };
  }, [targetId, hasFreshData, weather]);

  const seed = targetId || "default";
  const defaultSuasana = useMemo(() => {
    const category = item?.category || "general";
    return getDefaultTextByTime(seed, category);
  }, [seed, item?.category]);

  const status = useMemo(() => {
    const weatherLevel = passiveSignal?.weather ? getWeatherLevel(passiveSignal.weather.condition) : 0;
    const isLightRain = isWeatherCondition(passiveSignal?.weather?.condition, 'lightRain');
    const isModerateRain = isWeatherCondition(passiveSignal?.weather?.condition, 'moderateRain');
    const isHeavyRain = isWeatherCondition(passiveSignal?.weather?.condition, 'heavyRain');
    const isFog = isWeatherCondition(passiveSignal?.weather?.condition, 'fog');

    if ((isHeavyRain || weatherLevel >= 4) && !hasFreshData) {
      return {
        text: passiveSignal.weather.statusText,
        color: "text-red-600 dark:text-red-400",
        bgColor: "bg-red-500",
        icon: passiveSignal.weather.icon,
        badge: weatherLevel === 5 ? "⚠️ HUJAN LEBAT" : "🌧️ HUJAN SEDANG",
        vibe: passiveSignal.weather.vibe,
        level: weatherLevel,
      };
    }

    if (isFog && !hasFreshData) {
      return {
        text: `🌫️ Kabut (${passiveSignal.weather.temp}°C)`,
        color: "text-amber-600 dark:text-amber-400",
        bgColor: "bg-amber-500",
        icon: "🌫️",
        badge: "KABUT",
        vibe: "Kabut mengurangi jarak pandang, hati-hati berkendara",
        level: 3,
      };
    }

    if (isModerateRain && !hasFreshData) {
      return {
        text: `🌧️ Hujan Sedang (${passiveSignal.weather.temp}°C)`,
        color: "text-blue-600 dark:text-blue-400",
        bgColor: "bg-blue-500",
        icon: "🌧️",
        badge: "HUJAN SEDANG",
        vibe: "Hujan sedang, jalanan licin, waspada",
        level: 4,
      };
    }

    if (isLightRain && !hasFreshData) {
      return {
        text: `🌧️ Hujan Ringan (${passiveSignal.weather.temp}°C)`,
        color: "text-slate-700 dark:text-slate-300",
        bgColor: "bg-slate-400",
        icon: "🌧️",
        badge: "HUJAN RINGAN",
        vibe: "Hujan ringan, jangan lupa payung",
        level: 2,
      };
    }

    if (hasFreshData && latestFreshReport) {
      const kondisi = latestFreshReport?.tipe || item?.latest_condition || "Normal";
      const trafficCondition = latestFreshReport?.traffic_condition;
      const isRecent = latestFreshReport?.created_at
        ? (Date.now() - new Date(latestFreshReport.created_at).getTime()) < (STATUS_CONFIG.RECENT_REPORT_HOURS * 60 * 60 * 1000)
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

    if (passiveSignal?.total > 0 && !hasFreshData && !passiveSignal?.weather) {
      const passiveStatus = getPassiveStatusText(passiveSignal);
      if (passiveStatus) return passiveStatus;
    }

    if (passiveSignal?.weather && !hasFreshData && weatherLevel === DEFAULT_WEATHER_LEVEL) {
      return {
        text: defaultSuasana,
        color: "text-slate-600 dark:text-slate-400",
        bgColor: "bg-slate-500",
        icon: "📍",
        badge: "NORMAL",
        vibe: "Cuaca cerah",
        level: 1,
      };
    }

    return {
      text: defaultSuasana,
      color: "text-slate-600 dark:text-slate-400",
      bgColor: "bg-slate-500",
      icon: "📍",
      badge: "NORMAL",
      vibe: hoursSinceLastReport ? `Belum ada laporan dalam ${hoursSinceLastReport} jam` : "Belum ada laporan",
      level: 1,
    };
  }, [hasFreshData, latestFreshReport, freshCount, item, hoursSinceLastReport, defaultSuasana, seed, passiveSignal]);

  const ringkasanMultiUser = useMemo(() => {
    if (hasFreshData && freshReports.length) {
      let ringkasan = generateRingkasanMultiUser(freshReports, item?.category || "general");
      if (weather && (isWeatherCondition(weather.condition, 'lightRain') ||
        isWeatherCondition(weather.condition, 'moderateRain') ||
        isWeatherCondition(weather.condition, 'heavyRain') ||
        isWeatherCondition(weather.condition, 'fog'))) {
        const isLightRain = isWeatherCondition(weather.condition, 'lightRain');
        ringkasan += ` ☁️ Cuaca ${weather.short} ${weather.temp}°C, ${isLightRain ? 'jangan lupa bawa payung.' : 'waspada saat bepergian.'}`;
      }
      return ringkasan;
    }

    if (passiveSignal?.weather) {
      const w = passiveSignal.weather;
      if (w.isExtreme) return `⚠️ PERINGATAN CUACA EKSTREM: ${w.statusText}. ${w.vibe} Hindari aktivitas luar ruangan jika tidak perlu.`;
      if (w.isWarning && !isWeatherCondition(w.condition, 'lightRain')) return `🌧️ INFO CUACA: ${w.statusText}. ${w.vibe} Bawa perlengkapan hujan jika berpergian.`;
      if (isWeatherCondition(w.condition, 'lightRain')) return `☔ HUJAN RINGAN: ${w.temp}°C, kelembaban ${w.humidity}%. Jangan lupa bawa payung, jalanan mungkin sedikit licin.`;
      if (isWeatherCondition(w.condition, 'fog')) return `🌫️ KABUT: ${w.temp}°C, jarak pandang terbatas. Kurangi kecepatan dan nyalakan lampu.`;
      return `☀️ Cuaca: ${w.statusText}. Kondisi mendukung aktivitas normal.`;
    }

    if (passiveSignal?.total > 0) return getPassiveRingkasan(passiveSignal, item?.name);
    return "Belum ada laporan terbaru dari warga sekitar.";
  }, [hasFreshData, freshReports, item?.category, item?.name, passiveSignal, weather]);

  const jarakFix = useMemo(() => {
    const dist = item?.distance;
    if (!dist) return null;
    const num = parseFloat(dist);
    return num < 1 ? `${Math.round(num * 1000)} m` : `${num.toFixed(1)} km`;
  }, [item?.distance]);

  const waktuUpdate = useMemo(() => getRelativeTime(latestFreshReport?.created_at), [latestFreshReport]);

  const canExpand = (status.level >= 2 && hasFreshData) ||
    passiveSignal?.weather?.isExtreme ||
    isWeatherCondition(passiveSignal?.weather?.condition, 'moderateRain') ||
    isWeatherCondition(passiveSignal?.weather?.condition, 'lightRain') ||
    isWeatherCondition(passiveSignal?.weather?.condition, 'fog') ||
    (passiveSignal?.total > 0);

  const getGlowStyle = () => {
    if (hasFreshData && status.level >= 2) return 'shadow-[0_8px_30px_-4px_rgba(245,158,11,0.12)] border-amber-500/20';
    if (passiveSignal?.weather?.isExtreme) return 'shadow-[0_8px_30px_-4px_rgba(220,38,38,0.18)] border-red-500/25';
    if (isWeatherCondition(passiveSignal?.weather?.condition, 'moderateRain')) return 'shadow-[0_8px_30px_-4px_rgba(59,130,246,0.12)] border-blue-500/20';
    if (isWeatherCondition(passiveSignal?.weather?.condition, 'lightRain')) return 'shadow-[0_6px_20px_-4px_rgba(100,116,139,0.1)] border-slate-300/30';
    if (isWeatherCondition(passiveSignal?.weather?.condition, 'fog')) return 'shadow-[0_8px_30px_-4px_rgba(245,158,11,0.12)] border-amber-500/20';
    if (passiveSignal?.total > 0) return 'shadow-[0_8px_30px_-4px_rgba(168,85,247,0.12)] border-purple-500/20';
    return 'border-slate-100/70 shadow-md shadow-slate-100/40';
  };

  return (
    <div className="mx-3 -mt-5 relative z-10 transition-all duration-300 select-none">
      {/* Container Utama menggunakan motion untuk feedback ketukan haptic-look */}
      <motion.div
        onClick={() => canExpand && setIsExpanded(!isExpanded)}
        whileTap={canExpand ? { scale: 0.98 } : {}}
        className={`backdrop-blur-lg bg-white/85 p-3.5 flex flex-col border transition-colors duration-300
          ${getGlowStyle()}
          ${canExpand ? 'cursor-pointer hover:bg-white/95' : ''}
          ${isExpanded ? 'rounded-t-2xl rounded-b-none pb-2' : 'rounded-2xl'}
        `}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <span className="text-base shrink-0 transition-transform duration-300">{status.icon}</span>
            <div className="flex flex-col min-w-0">
              <p className={`text-[11px] font-black tracking-wider uppercase truncate ${status.color}`}>
                {status.text}
              </p>
              {hasFreshData && <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight mt-0.5">Laporan Aktif Warga</span>}
              {!hasFreshData && isWeatherCondition(passiveSignal?.weather?.condition, 'lightRain') && (
                <span className="text-[9px] text-slate-500 font-medium animate-pulse mt-0.5">☔ Hujan ringan, bawa payung</span>
              )}
              {!hasFreshData && isWeatherCondition(passiveSignal?.weather?.condition, 'moderateRain') && (
                <span className="text-[9px] text-blue-500 font-medium animate-pulse mt-0.5">🌧️ Hujan sedang, waspada</span>
              )}
              {!hasFreshData && passiveSignal?.weather?.isExtreme && (
                <span className="text-[9px] text-red-500 font-medium animate-pulse mt-0.5">⚠️ Peringatan Cuaca Ekstrem!</span>
              )}
              {!hasFreshData && !passiveSignal?.weather && isLoadingPassive && (
                <span className="text-[9px] text-purple-400 font-semibold animate-pulse mt-0.5">🔍 Cek Situasi...</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <WeatherBadge weather={weather} hasFreshData={hasFreshData} />

            {passiveSignal && !hasFreshData && passiveSignal.total > 0 && !passiveSignal?.weather && (
              <span className="text-[10px] font-bold text-purple-600 bg-purple-50/80 px-2.5 py-1 rounded-full border border-purple-100 shadow-xs">
                ⚡ {passiveSignal.total} Aktivitas
              </span>
            )}

            {waktuUpdate ? (
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                {waktuUpdate}
              </span>
            ) : weather && !hasFreshData ? (
              <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </span>
            ) : (
              <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                🟢 Normal
              </span>
            )}

            {canExpand && (
              <div className={`p-1 rounded-lg transition-colors duration-200 ${isExpanded ? 'bg-slate-100 text-slate-700' : 'bg-slate-50 text-slate-400'}`}>
                <svg className={`w-3.5 h-3.5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Expandable Detail Section dengan Animasi Elastis & AnimatePresence */}
      <AnimatePresence>
        {isExpanded && canExpand && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
            className="bg-white/90 backdrop-blur-lg rounded-b-2xl border-x border-b border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden"
          >
            <div className="p-4 pt-1 space-y-4">
              <WeatherDetail weather={passiveSignal?.weather} hasFreshData={hasFreshData} />

              {/* Context Summary Box */}
              <div className={`p-3 rounded-xl border text-xs leading-relaxed shadow-xs
                ${hasFreshData ? 'bg-amber-50/30 border-amber-100/70 text-slate-700' :
                  passiveSignal?.weather?.isExtreme ? 'bg-red-50/30 border-red-100/70' :
                    isWeatherCondition(passiveSignal?.weather?.condition, 'lightRain') ? 'bg-slate-50/50 border-slate-200/60' :
                      'bg-purple-50/30 border-purple-100/70 text-slate-700'}
              `}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[9px] font-black uppercase tracking-widest ${hasFreshData ? 'text-amber-600' :
                    passiveSignal?.weather?.isExtreme ? 'text-red-600' :
                      isWeatherCondition(passiveSignal?.weather?.condition, 'lightRain') ? 'text-slate-500' :
                        'text-purple-600'
                    }`}>
                    {hasFreshData ? `💬 Ringkasan ${freshCount} Warga` :
                      passiveSignal?.weather?.isExtreme ? '⚠️ Peringatan Cuaca' :
                        isWeatherCondition(passiveSignal?.weather?.condition, 'lightRain') ? '☔ Info Cuaca' :
                          '👀 Analisis Situasi'}
                  </span>
                  {!hasFreshData && passiveSignal?.total > 0 && (
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">4 jam terakhir</span>
                  )}
                </div>

                <p className={`font-medium ${hasFreshData ? "italic text-slate-600" : "text-slate-600"}`}>
                  {ringkasanMultiUser}
                </p>

                {/* Avatar Pile */}
                <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-slate-200/30">
                  {hasFreshData ? (
                    <AvatarGroup reports={freshReports} count={freshCount} type="warga" />
                  ) : passiveSignal?.total > 0 && (
                    <AvatarGroup reports={Array(Math.min(passiveSignal.total, 4)).fill({})} count={passiveSignal.total} type="passive" />
                  )}
                  <span className="text-[10px] text-slate-400 font-bold">
                    {hasFreshData ? `${freshCount} warga ikut bersuara` :
                      passiveSignal?.weather?.isExtreme ? '⚠️ Tetap waspada' :
                        isWeatherCondition(passiveSignal?.weather?.condition, 'lightRain') ? '☔ Siapkan perlengkapan hujan' :
                          `${passiveSignal?.total || 0} interaksi lokal`}
                  </span>
                </div>
              </div>

              {/* Footer Mini Stats */}
              <div className="flex items-center justify-between px-0.5 text-[9px] font-black text-slate-400 uppercase tracking-wider">
                <div className="flex gap-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold text-[9px] text-slate-400/80">Saksi</span>
                    <span className="text-slate-700 font-extrabold text-[11px]">🗃️ {jumlahWarga || 0}</span>
                  </div>
                  <div className="border-l border-slate-200/60 pl-4 flex flex-col gap-0.5">
                    <span className="font-bold text-[9px] text-slate-400/80">{hasFreshData ? 'Laporan' : 'Interaksi'}</span>
                    <span className="text-slate-700 font-extrabold text-[11px]">
                      {hasFreshData ? `👥 ${freshCount}` : `👥 ${passiveSignal?.total || 0}`}
                    </span>
                  </div>
                  {weather && !hasFreshData && (
                    <div className="border-l border-slate-200/60 pl-4 flex flex-col gap-0.5">
                      <span className="font-bold text-[9px] text-slate-400/80">Cuaca</span>
                      <span className={`font-extrabold text-[11px] ${isWeatherCondition(weather.condition, 'heavyRain') ? 'text-red-600' :
                          isWeatherCondition(weather.condition, 'moderateRain') ? 'text-blue-600' :
                            isWeatherCondition(weather.condition, 'lightRain') ? 'text-slate-600' :
                              isWeatherCondition(weather.condition, 'fog') ? 'text-amber-600' :
                                'text-slate-500'
                        }`}>
                        {weather.icon} {weather.temp}°
                      </span>
                    </div>
                  )}
                </div>
                {jarakFix && (
                  <div className="flex flex-col gap-0.5 items-end">
                    <span className="font-bold text-[9px] text-slate-400/80">Jarak Anda</span>
                    <span className="text-indigo-600 font-black text-[10px] bg-indigo-50/80 border border-indigo-100/60 px-1.5 py-0.5 rounded-full shadow-xs">📍 {jarakFix}</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}