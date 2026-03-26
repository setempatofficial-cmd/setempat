"use client";

import { useState, useEffect, useMemo } from "react";
import { formatRelativeTime } from "@/lib/feedEngine";

export default function LiveInsight({ signals, theme, locationName = "Sekitar", currentUser = null }) {
  const [index, setIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const isDark = theme?.isMalam || theme?.name === "MALAM";

  const insights = useMemo(() => {
    // 1. Logic Format Waktu Relatif
    const formatTime = (timeValue) => {
      if (!timeValue) return "baru saja";
      const raw = String(timeValue).trim().toLowerCase();
      if (raw === "live" || raw === "baru saja") return "baru saja";
      if (/^(0m|0 menit|<1m|<1 menit)/.test(raw)) return "baru saja";
      if (/^(1m|1 menit)/.test(raw)) return "baru saja";
      if (/^\d+\s*m(.*)$/.test(raw)) return raw.replace(/^(\d+)m(.*)$/, "$1 menit lalu");
      if (/^\d+\s*j(.*)$/.test(raw)) return raw.replace(/^(\d+)j(.*)$/, "$1 jam lalu");
      return raw;
    };

    // 2. Normalisasi Author & Platform
    const normalizeAuthor = (item) => {
      const rawFromData = String(item.user_name || item.username || item.author || "").trim();
      const platform = (item.source_platform || item.source || item.platform || "").toLowerCase();
      const isVerified = item.verified === true || item.verified_account === true;

      let name = rawFromData;

      // Jika ini post sendiri, prioritaskan nama profile user aktif
      if (currentUser && item.user_id && item.user_id === currentUser.id) {
        name = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || currentUser.email?.split("@")[0] || rawFromData || "Warga";
      }

      // Jika data masih placeholder seperti Warga atau Warga Lokal, gunakan nama dari user_name jika tersedia
      if (/^\s*(warga( lokal)?|anonim|guest)\s*$/i.test(name) && rawFromData && rawFromData.toLowerCase() !== "warga") {
        name = rawFromData;
      }

      if (!name || /(sistem|system|setempat|rt|ai|admin)/.test(name.toLowerCase())) {
      }

      if (platform === 'instagram') return { name: `IG: ${name}`, isVerified };
      if (platform === 'tiktok') return { name: `TT: ${name}`, isVerified };
      return { name, isVerified };
    };

    // 3. Filter Ketat 24 Jam
    const timeFilter = (item) => {
      const dateValue = item.created_at || item.timestamp || item.date || item.fetched_at;
      if (!dateValue) return false;
      const parsed = new Date(dateValue);
      if (Number.isNaN(parsed.getTime())) return false;
      return (Date.now() - parsed.getTime()) <= 24 * 60 * 60 * 1000;
    };

    // LOGIC DYNAMIC NAME: Ambil nama dari props atau signal pertama jika ada
    const activePlace = locationName || "Sekitar";

    if (!signals || !Array.isArray(signals) || signals.length === 0) {
      return [{
        text: `Monitor Kondisi di ${activePlace}. Ada info baru?`,
        author: "RT Setempat",
        time: "Live",
        isAi: true
      }];
    }

    const recentSignals = signals
      .filter(timeFilter)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5);

    if (!recentSignals.length) {
      return [{
        text: `Belum ada laporan baru di ${activePlace}. Jadilah yang pertama lapor!`,
        author: "RT Setempat",
        time: "Live",
        isAi: true
      }];
    }

    // 4. Mapping Final
    return recentSignals.map((s) => {
      const timeSource = s.timeAgo || s.time_tag || s.jam || s.created_at || s.fetched_at;
      const resolvedTime = formatTime(timeSource || formatRelativeTime(s.created_at));
      const authorData = normalizeAuthor(s);
      const isUrgent = /(macet|kecelakaan|banjir|kebakaran|ramai|padat)/.test((s.content || s.text || "").toLowerCase());

      return {
        text: s.content || s.deskripsi_ai || s.deskripsi || s.text || "Update tersedia",
        author: authorData.name,
        isVerified: authorData.isVerified,
        time: resolvedTime,
        isAi: !!s.deskripsi_ai || s.is_ai === true,
        isUrgent: isUrgent
      };
    });
  }, [signals, locationName]);

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

  return (
    <div className={`rounded-[28px] p-5 border transition-all duration-500 relative overflow-hidden shadow-2xl backdrop-blur-md ${isDark ? "bg-slate-900/40 border-white/10" : "bg-white/80 border-slate-200"
      }`}>

      <div className={`absolute -right-6 -top-6 w-24 h-24 blur-[45px] rounded-full opacity-20 transition-all duration-1000 ${current.isAi ? "bg-emerald-400" : current.isUrgent ? "bg-rose-500" : "bg-blue-400"
        }`} />

      <div className="flex items-start gap-4 relative z-10">
        <div className="flex-shrink-0 mt-1.5">
          <div className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${current.isUrgent ? 'bg-rose-500' : isDark ? 'bg-emerald-400' : 'bg-emerald-600'
              }`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${current.isUrgent ? 'bg-rose-500' : isDark ? 'bg-emerald-400' : 'bg-emerald-600'
              }`}></span>
          </div>
        </div>

        <div className="flex-1 text-left min-w-0">
          <div className={`flex items-center gap-2 mb-1.5 transition-all duration-500 ${isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"
            }`}>
            <div className="flex items-center gap-1.5 truncate max-w-[160px]">
              <span className={`text-[10px] font-[900] uppercase tracking-[0.15em] ${current.isAi ? "text-emerald-400" : isDark ? "text-slate-300" : "text-slate-600"
                }`}>
                {current.isAi ? "✨ AI SUMMARY" : current.author}
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

          <p className={`text-[16px] font-extrabold leading-[1.35] tracking-tight transition-all duration-700 ease-in-out min-h-[44px] ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
            } ${isDark ? "text-white" : "text-slate-900"}`}>
            "{current.text}"
          </p>

          <div className="mt-4 flex items-center gap-2">
            <span className={`text-[8px] font-black uppercase tracking-[0.3em] ${isDark ? "text-emerald-400/40" : "text-emerald-600/40"
              }`}>
              Live Insight
            </span>
            <div className={`h-[1.5px] flex-1 rounded-full overflow-hidden ${isDark ? "bg-white/5" : "bg-slate-100"}`}>
              <div
                key={index}
                className={`h-full transition-all duration-[5000ms] ease-linear ${current.isUrgent ? "bg-rose-500" : isDark ? "bg-emerald-500/60" : "bg-emerald-600/60"
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