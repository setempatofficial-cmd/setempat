"use client";

import { useState, useEffect, useMemo } from "react";
import { formatRelativeTime } from "@/lib/feedEngine";
import { useDataContext } from "@/contexts/DataContext";

export default function LiveInsight({ 
  signals, 
  theme, 
  locationName = "Sekitar", 
  currentUser = null,
  tempatId = null
}) {
  const [index, setIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const { feedData, getAIContext } = useDataContext();

  const isDark = theme?.isMalam || theme?.name === "MALAM";

  const effectiveSignals = useMemo(() => {
    if (signals && signals.length > 0) return signals;
    if (tempatId) {
      const context = getAIContext(tempatId);
      return context.recentReports;
    }
    return feedData;
  }, [signals, tempatId, getAIContext, feedData]);

  const insights = useMemo(() => {
    const formatTime = (timeValue) => {
      if (!timeValue) return "baru saja";
      const raw = String(timeValue).trim().toLowerCase();
      if (raw === "live" || raw === "baru saja") return "baru saja";
      if (/^(0m|0 menit|<1m|<1 menit)/.test(raw)) return "baru saja";
      if (/^\d+\s*m(.*)$/.test(raw)) return raw.replace(/^(\d+)m(.*)$/, "$1 menit lalu");
      if (/^\d+\s*j(.*)$/.test(raw)) return raw.replace(/^(\d+)j(.*)$/, "$1 jam lalu");
      return raw;
    };

    const normalizeAuthor = (item) => {
      const rawFromData = String(item.user_name || item.username || item.author || "").trim();
      const platform = (item.source_platform || item.source || item.platform || "").toLowerCase();
      const isVerified = item.verified === true || item.verified_account === true;

      let name = rawFromData;

      if (currentUser && item.user_id && item.user_id === currentUser.id) {
        name = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || currentUser.email?.split("@")[0] || rawFromData || "Warga";
      }

      if (/^\s*(warga( lokal)?|anonim|guest)\s*$/i.test(name) && rawFromData && rawFromData.toLowerCase() !== "warga") {
        name = rawFromData;
      }

      if (platform === 'instagram') return { name: `IG: ${name}`, isVerified };
      if (platform === 'tiktok') return { name: `TT: ${name}`, isVerified };
      return { name, isVerified };
    };

    const timeFilter = (item) => {
      const dateValue = item.created_at || item.timestamp || item.date || item.fetched_at;
      if (!dateValue) return false;
      const parsed = new Date(dateValue);
      if (Number.isNaN(parsed.getTime())) return false;
      return (Date.now() - parsed.getTime()) <= 24 * 60 * 60 * 1000;
    };

    const activePlace = locationName || "Sekitar";

    if (!effectiveSignals || !Array.isArray(effectiveSignals) || effectiveSignals.length === 0) {
      return [{
        text: `Monitor Kondisi di ${activePlace}. Ada info baru?`,
        author: "RT AI Setempat",
        time: "Live",
        isAi: true
      }];
    }

    const recentSignals = effectiveSignals
      .filter(timeFilter)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5);

    if (!recentSignals.length) {
      return [{
        text: `Belum ada laporan baru di ${activePlace}. Jadilah yang pertama lapor!`,
        author: "RT AI Setempat",
        time: "Live",
        isAi: true
      }];
    }

    return recentSignals.map((s) => {
      const timeSource = s.timeAgo || s.time_tag || s.jam || s.created_at || s.fetched_at;
      const resolvedTime = formatTime(timeSource || formatRelativeTime(s.created_at));
      const authorData = normalizeAuthor(s);
      
      const isUrgent = /(macet|kecelakaan|banjir|kebakaran|ramai|padat|antri)/.test(
        (s.tipe || s.content || s.deskripsi || "").toLowerCase()
      );
      
      const conditionEmoji = s.tipe === 'Ramai' ? '🏃' : s.tipe === 'Antri' ? '⏳' : s.tipe === 'Sepi' ? '🍃' : '';
      
      // 🔥 TAMBAHKAN ESTIMASI ORANG DAN WAKTU ANTRI KE DALAM TEKS
      const estimasiText = s.estimated_people ? ` (estimasi ${s.estimated_people} orang)` : '';
      const waitTimeText = s.estimated_wait_time ? `, antri ${s.estimated_wait_time} menit` : '';
      
      const baseText = s.deskripsi || s.content || s.text || "Update tersedia";
      const textContent = baseText + estimasiText + waitTimeText;
      
      const finalText = conditionEmoji && !textContent.includes(conditionEmoji) 
        ? `${conditionEmoji} ${textContent}` 
        : textContent;

      return {
        text: finalText,
        author: authorData.name,
        isVerified: authorData.isVerified,
        time: resolvedTime,
        isAi: !!s.deskripsi_ai || s.is_ai === true,
        isUrgent: isUrgent,
        tipe: s.tipe,
        photo_url: s.photo_url,
        user_name: s.user_name,
        estimated_people: s.estimated_people,
        estimated_wait_time: s.estimated_wait_time
      };
    });
  }, [effectiveSignals, locationName, currentUser]);

  useEffect(() => {
    if (insights.length <= 1) return;
    const interval = setInterval(() => {
      setIsVisible(false);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % insights.length);
        setIsVisible(true);
      }, 600);
    }, 5000);
    return () => clearInterval(interval);
  }, [insights]);

  const current = insights[index] || insights[0] || {};

  const getAccentColor = () => {
    if (current.tipe === 'Ramai') return 'bg-yellow-500';
    if (current.tipe === 'Antri') return 'bg-rose-500';
    if (current.tipe === 'Sepi') return 'bg-emerald-500';
    if (current.isUrgent) return 'bg-rose-500';
    if (current.isAi) return 'bg-emerald-400';
    return isDark ? 'bg-emerald-400' : 'bg-emerald-600';
  };

  const getGlowColor = () => {
    if (current.tipe === 'Ramai') return 'bg-yellow-400';
    if (current.tipe === 'Antri') return 'bg-rose-500';
    if (current.tipe === 'Sepi') return 'bg-emerald-500';
    if (current.isUrgent) return 'bg-rose-500';
    return 'bg-emerald-400';
  };

  return (
    <div className={`rounded-[28px] p-5 border transition-all duration-500 relative overflow-hidden shadow-2xl backdrop-blur-md ${
      isDark ? "bg-slate-900/40 border-white/10" : "bg-white/80 border-slate-200"
    }`}>
      <div className={`absolute -right-6 -top-6 w-24 h-24 blur-[45px] rounded-full opacity-20 transition-all duration-1000 ${getGlowColor()}`} />

      <div className="flex items-start gap-4 relative z-10">
        <div className="flex-shrink-0 mt-1.5">
          <div className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${getAccentColor()}`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${getAccentColor()}`} />
          </div>
        </div>

        <div className="flex-1 text-left min-w-0">
          <div className={`flex items-center gap-2 mb-1.5 transition-all duration-500 ${
            isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"
          }`}>
            <div className="flex items-center gap-1.5 truncate max-w-[160px]">
              <span className={`text-[10px] font-[900] uppercase tracking-[0.15em] ${
                current.isAi 
                  ? "text-emerald-400" 
                  : current.tipe === 'Ramai' 
                    ? "text-yellow-500" 
                    : current.tipe === 'Antri' 
                      ? "text-rose-500" 
                      : isDark 
                        ? "text-slate-300" 
                        : "text-slate-600"
              }`}>
                {current.isAi ? "✨ AI SETEMPAT" : (current.user_name ? `👤 ${current.user_name}` : current.author || "Warga")}
              </span>
              {current.isVerified && (
                <svg className="w-3 h-3 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
                </svg>
              )}
            </div>
            <span className="text-[10px] opacity-20">/</span>
            <span className={`text-[9px] font-bold italic opacity-40 ${isDark ? "text-white" : "text-slate-900"}`}>
              {current.time}
            </span>
          </div>

          <p className={`text-[16px] font-extrabold leading-[1.35] tracking-tight transition-all duration-700 ease-in-out min-h-[44px] ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
          } ${isDark ? "text-white" : "text-slate-900"}`}>
            "{current.text}"
          </p>

          <div className="mt-4 flex items-center gap-2">
            <span className={`text-[8px] font-black uppercase tracking-[0.3em] ${
              current.tipe === 'Ramai' 
                ? "text-yellow-500/60" 
                : current.tipe === 'Antri' 
                  ? "text-rose-500/60" 
                  : isDark 
                    ? "text-emerald-400/40" 
                    : "text-emerald-600/40"
            }`}>
              {current.estimated_people ? `👥 ${current.estimated_people} ORG` : (current.tipe ? `LIVE ${current.tipe.toUpperCase()}` : "Live Insight")}
            </span>
            <div className={`h-[1.5px] flex-1 rounded-full overflow-hidden ${
              isDark ? "bg-white/5" : "bg-slate-100"
            }`}>
              <div
                key={index}
                className={`h-full transition-all duration-[5000ms] ease-linear ${
                  current.tipe === 'Ramai' 
                    ? "bg-yellow-500" 
                    : current.tipe === 'Antri' 
                      ? "bg-rose-500" 
                      : current.isUrgent 
                        ? "bg-rose-500" 
                        : isDark 
                          ? "bg-emerald-500/60" 
                          : "bg-emerald-600/60"
                }`}
                style={{ width: isVisible ? '100%' : '0%' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}