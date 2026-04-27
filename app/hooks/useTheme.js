// hooks/useTheme.js - KONSISTEN dengan useClock
import { useMemo } from "react";
import { useClock } from "@/hooks/useClock";

export function useTheme() {
  const { timeLabel: sapaan, timeInfo } = useClock(); // Konsisten!
  const isMalam = sapaan === "Malam";
  
  return useMemo(() => {
    // ==================== BASE THEME ====================
    const base = isMalam ? {
      bg: "bg-[#0f172a]",
      card: "bg-slate-900/40 backdrop-blur-md",
      border: "border-slate-800/50",
      text: "text-white",
      textMuted: "text-slate-300",
      accent: "text-cyan-400",
      accentBg: "bg-cyan-400",
      accentSoft: "bg-cyan-500/10",
      accentBorder: "border-cyan-500/20",
      cardHover: "hover:bg-[#1a2538]",
      statusBg: "bg-white/10",
      statusText: "text-white",
      timeText: "text-cyan-400",
    } : {
      bg: "bg-[#F9F7F7]",
      card: "bg-white",
      border: "border-slate-200",
      text: "text-slate-900",
      textMuted: "text-slate-600",
      accent: "text-[#E3655B]",
      accentBg: "bg-[#E3655B]",
      accentSoft: "bg-rose-50",
      accentBorder: "border-rose-200",
      cardHover: "hover:bg-gray-50",
      statusBg: "bg-black/5",
      statusText: "text-slate-800",
      timeText: "text-[#E3655B]",
    };
    
    const timeVibes = {
      Pagi: {
        dot: "bg-orange-500",
        dotGlow: "shadow-[0_0_8px_rgba(249,115,22,0.5)]",
        softBg: isMalam ? "bg-orange-500/10" : "bg-orange-50",
        softBorder: isMalam ? "border-orange-500/20" : "border-orange-200",
        timeIcon: "🌅",
        statusText: isMalam ? "text-white" : "text-slate-800",
        statusBg: isMalam ? "bg-orange-500/20" : "bg-orange-50",
      },
      Siang: {
        dot: "bg-[#E3655B]",
        dotGlow: "shadow-[0_0_8px_rgba(227,101,91,0.4)]",
        softBg: isMalam ? "bg-rose-500/10" : "bg-rose-50",
        softBorder: isMalam ? "border-rose-500/20" : "border-rose-200",
        timeIcon: "☀️",
        statusText: isMalam ? "text-white" : "text-slate-800",
        statusBg: isMalam ? "bg-orange-500/20" : "bg-orange-50",
      },
      Sore: {
        dot: "bg-rose-500",
        dotGlow: "shadow-[0_0_8px_rgba(244,63,94,0.5)]",
        softBg: isMalam ? "bg-rose-500/10" : "bg-rose-50",
        softBorder: isMalam ? "border-rose-500/20" : "border-rose-200",
        timeIcon: "🌆",
        statusText: isMalam ? "text-white" : "text-slate-800",
        statusBg: isMalam ? "bg-orange-500/20" : "bg-orange-50",
      },
      Malam: {
        dot: "bg-cyan-400",
        dotGlow: "shadow-[0_0_8px_#22d3ee]",
        softBg: "bg-cyan-500/10",
        softBorder: "border-cyan-500/20",
        timeIcon: "🌙",
        statusText: "text-white",
        statusBg: "bg-white/10",
      }
    };
    
    const situasi = {
      viral: {
        text: isMalam ? "text-rose-400" : "text-rose-700",
        bg: isMalam ? "bg-rose-500/10" : "bg-rose-100",
        border: isMalam ? "border-rose-500/20" : "border-rose-300",
        icon: "🔥",
        label: "Viral",
      },
      ramai: {
        text: isMalam ? "text-amber-400" : "text-amber-700",
        bg: isMalam ? "bg-amber-500/10" : "bg-amber-100",
        border: isMalam ? "border-amber-500/20" : "border-amber-300",
        icon: "👥",
        label: "Ramai",
      },
      sepi: {
        text: isMalam ? "text-emerald-400" : "text-emerald-700",
        bg: isMalam ? "bg-emerald-500/10" : "bg-emerald-100",
        border: isMalam ? "border-emerald-500/20" : "border-emerald-300",
        icon: "🍃",
        label: "Sepi",
      }
    };
    
    const currentTime = timeVibes[sapaan] || timeVibes.Siang;
    
    return {
      ...base,
      isMalam,
      sapaan,
      timeInfo, // Info lengkap tentang waktu
      dot: currentTime.dot,
      dotGlow: currentTime.dotGlow,
      softBg: currentTime.softBg,
      softBorder: currentTime.softBorder,
      timeIcon: currentTime.timeIcon,
      statusText: currentTime.statusText,
      statusBg: currentTime.statusBg,
      situasi,
      getSituasi: (type) => situasi[type] || situasi.ramai,
      vibeInfo: {
        icon: currentTime.timeIcon,
        label: sapaan,
      },
      bgGlass: isMalam ? "bg-[#0f172a]/80 backdrop-blur-sm" : "bg-white/80 backdrop-blur-sm",
    };
  }, [sapaan, timeInfo]);
}