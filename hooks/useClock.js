// hooks/useTheme.js
'use client'

import { useMemo } from "react";
import { useClock } from "@/utils/timeUtils";

export function useTheme() {
  const { timeLabel: sapaan, timeInfo } = useClock();
  const isMalam = timeInfo?.isMalam || false;

  return useMemo(() => {
    // Base styles
    const base = isMalam ? {
      bg: "bg-slate-900 md:bg-[#0f172a]",
      card: "bg-slate-800 md:bg-slate-900/40 md:backdrop-blur-md",
      border: "border-slate-700 md:border-slate-800/50",
      text: "text-white",
      textMuted: "text-slate-400 md:text-slate-300",
      accent: "text-cyan-400",
      accentBg: "bg-cyan-400",
      accentSoft: "bg-cyan-900/50 md:bg-cyan-500/10",
      accentBorder: "border-cyan-700 md:border-cyan-500/20",
      cardHover: "hover:bg-slate-700 md:hover:bg-[#1a2538]",
      statusBg: "bg-slate-700 md:bg-white/10",
      statusText: "text-white",
      timeText: "text-cyan-400",
      bgGlass: "bg-slate-900 md:bg-[#0f172a]/80 md:backdrop-blur-sm",
    } : {
      bg: "bg-gray-100 md:bg-[#F9F7F7]",
      card: "bg-white md:bg-white",
      border: "border-gray-300 md:border-slate-200",
      text: "text-slate-900",
      textMuted: "text-slate-500 md:text-slate-600",
      accent: "text-[#E3655B]",
      accentBg: "bg-[#E3655B]",
      accentSoft: "bg-rose-100 md:bg-rose-50",
      accentBorder: "border-rose-300 md:border-rose-200",
      cardHover: "hover:bg-gray-50 md:hover:bg-gray-50",
      statusBg: "bg-gray-200 md:bg-black/5",
      statusText: "text-slate-800",
      timeText: "text-[#E3655B]",
      bgGlass: "bg-white md:bg-white/80 md:backdrop-blur-sm",
    };

    // Time vibes - simplified
    const timeVibes = {
      Pagi: {
        dot: "bg-orange-500",
        dotGlow: "md:shadow-[0_0_8px_rgba(249,115,22,0.5)]",
        softBg: isMalam ? "bg-orange-900/50 md:bg-orange-500/10" : "bg-orange-100 md:bg-orange-50",
        softBorder: isMalam ? "border-orange-700 md:border-orange-500/20" : "border-orange-300 md:border-orange-200",
        timeIcon: "🌅",
      },
      Siang: {
        dot: "bg-[#E3655B]",
        dotGlow: "md:shadow-[0_0_8px_rgba(227,101,91,0.4)]",
        softBg: isMalam ? "bg-rose-900/50 md:bg-rose-500/10" : "bg-rose-100 md:bg-rose-50",
        softBorder: isMalam ? "border-rose-700 md:border-rose-500/20" : "border-rose-300 md:border-rose-200",
        timeIcon: "☀️",
      },
      Sore: {
        dot: "bg-rose-500",
        dotGlow: "md:shadow-[0_0_8px_rgba(244,63,94,0.5)]",
        softBg: isMalam ? "bg-rose-900/50 md:bg-rose-500/10" : "bg-rose-100 md:bg-rose-50",
        softBorder: isMalam ? "border-rose-700 md:border-rose-500/20" : "border-rose-300 md:border-rose-200",
        timeIcon: "🌆",
      },
      Malam: {
        dot: "bg-cyan-400",
        dotGlow: "md:shadow-[0_0_8px_#22d3ee]",
        softBg: "bg-cyan-900/50 md:bg-cyan-500/10",
        softBorder: "border-cyan-700 md:border-cyan-500/20",
        timeIcon: "🌙",
      }
    };

    const currentTime = timeVibes[sapaan] || timeVibes.Siang;

    // Situasi - bisa ditambahkan logika dinamis
    const situasi = {
      viral: {
        text: isMalam ? "text-rose-400" : "text-rose-700",
        bg: isMalam ? "bg-rose-900/50 md:bg-rose-500/10" : "bg-rose-100",
        border: isMalam ? "border-rose-700 md:border-rose-500/20" : "border-rose-300",
        icon: "🔥",
        label: "Viral",
      },
      ramai: {
        text: isMalam ? "text-amber-400" : "text-amber-700",
        bg: isMalam ? "bg-amber-900/50 md:bg-amber-500/10" : "bg-amber-100",
        border: isMalam ? "border-amber-700 md:border-amber-500/20" : "border-amber-300",
        icon: "👥",
        label: "Ramai",
      },
      sepi: {
        text: isMalam ? "text-emerald-400" : "text-emerald-700",
        bg: isMalam ? "bg-emerald-900/50 md:bg-emerald-500/10" : "bg-emerald-100",
        border: isMalam ? "border-emerald-700 md:border-emerald-500/20" : "border-emerald-300",
        icon: "🍃",
        label: "Sepi",
      }
    };

    return {
      ...base,
      isMalam,
      sapaan,
      timeInfo,
      ...currentTime, // Langsung spread currentTime
      statusText: base.statusText, // Gunakan dari base
      statusBg: base.statusBg,     // Gunakan dari base
      situasi,
      getSituasi: (type) => situasi[type] || situasi.ramai,
      vibeInfo: {
        icon: currentTime.timeIcon,
        label: sapaan,
      },
    };
  }, [sapaan, timeInfo, isMalam]);
}