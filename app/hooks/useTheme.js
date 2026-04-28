// hooks/useTheme.js - VERSION HP OPTIMIZED
import { useMemo } from "react";
import { useClock } from "@/hooks/useClock";

export function useTheme() {
  const { timeLabel: sapaan, timeInfo } = useClock();
  const isMalam = sapaan === "Malam";
  
  // Deteksi HP (bisa juga pakai hook terpisah)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  
  return useMemo(() => {
    // ==================== BASE THEME ====================
    // HP: HAPUS semua backdrop-blur dan opacity
    // PC: Boleh pakai efek keren
    const base = isMalam ? {
      // HP FRIENDLY VERSION
      bg: isMobile ? "bg-slate-900" : "bg-[#0f172a]",
      card: isMobile ? "bg-slate-800" : "bg-slate-900/40 backdrop-blur-md",
      border: isMobile ? "border-slate-700" : "border-slate-800/50",
      text: "text-white",
      textMuted: isMobile ? "text-slate-400" : "text-slate-300",
      accent: "text-cyan-400",
      accentBg: "bg-cyan-400",
      accentSoft: isMobile ? "bg-cyan-900/50" : "bg-cyan-500/10",
      accentBorder: isMobile ? "border-cyan-700" : "border-cyan-500/20",
      cardHover: isMobile ? "hover:bg-slate-700" : "hover:bg-[#1a2538]",
      statusBg: isMobile ? "bg-slate-700" : "bg-white/10",
      statusText: "text-white",
      timeText: "text-cyan-400",
      // Khusus HP: disable blur effect
      bgGlass: isMobile ? "bg-slate-900" : "bg-[#0f172a]/80 backdrop-blur-sm",
    } : {
      bg: isMobile ? "bg-gray-100" : "bg-[#F9F7F7]",
      card: isMobile ? "bg-white" : "bg-white",
      border: isMobile ? "border-gray-300" : "border-slate-200",
      text: "text-slate-900",
      textMuted: isMobile ? "text-slate-500" : "text-slate-600",
      accent: "text-[#E3655B]",
      accentBg: "bg-[#E3655B]",
      accentSoft: isMobile ? "bg-rose-100" : "bg-rose-50",
      accentBorder: isMobile ? "border-rose-300" : "border-rose-200",
      cardHover: isMobile ? "hover:bg-gray-50" : "hover:bg-gray-50",
      statusBg: isMobile ? "bg-gray-200" : "bg-black/5",
      statusText: "text-slate-800",
      timeText: "text-[#E3655B]",
      bgGlass: isMobile ? "bg-white" : "bg-white/80 backdrop-blur-sm",
    };
    
    const timeVibes = {
      Pagi: {
        dot: "bg-orange-500",
        dotGlow: isMobile ? "" : "shadow-[0_0_8px_rgba(249,115,22,0.5)]", // HAPUS glow di HP
        softBg: isMalam ? (isMobile ? "bg-orange-900/50" : "bg-orange-500/10") : (isMobile ? "bg-orange-100" : "bg-orange-50"),
        softBorder: isMalam ? (isMobile ? "border-orange-700" : "border-orange-500/20") : (isMobile ? "border-orange-300" : "border-orange-200"),
        timeIcon: "🌅",
        statusText: isMalam ? "text-white" : "text-slate-800",
        statusBg: isMalam ? (isMobile ? "bg-orange-800" : "bg-orange-500/20") : (isMobile ? "bg-orange-200" : "bg-orange-50"),
      },
      Siang: {
        dot: "bg-[#E3655B]",
        dotGlow: isMobile ? "" : "shadow-[0_0_8px_rgba(227,101,91,0.4)]",
        softBg: isMalam ? (isMobile ? "bg-rose-900/50" : "bg-rose-500/10") : (isMobile ? "bg-rose-100" : "bg-rose-50"),
        softBorder: isMalam ? (isMobile ? "border-rose-700" : "border-rose-500/20") : (isMobile ? "border-rose-300" : "border-rose-200"),
        timeIcon: "☀️",
        statusText: isMalam ? "text-white" : "text-slate-800",
        statusBg: isMalam ? (isMobile ? "bg-orange-800" : "bg-orange-500/20") : (isMobile ? "bg-orange-200" : "bg-orange-50"),
      },
      Sore: {
        dot: "bg-rose-500",
        dotGlow: isMobile ? "" : "shadow-[0_0_8px_rgba(244,63,94,0.5)]",
        softBg: isMalam ? (isMobile ? "bg-rose-900/50" : "bg-rose-500/10") : (isMobile ? "bg-rose-100" : "bg-rose-50"),
        softBorder: isMalam ? (isMobile ? "border-rose-700" : "border-rose-500/20") : (isMobile ? "border-rose-300" : "border-rose-200"),
        timeIcon: "🌆",
        statusText: isMalam ? "text-white" : "text-slate-800",
        statusBg: isMalam ? (isMobile ? "bg-orange-800" : "bg-orange-500/20") : (isMobile ? "bg-orange-200" : "bg-orange-50"),
      },
      Malam: {
        dot: "bg-cyan-400",
        dotGlow: isMobile ? "" : "shadow-[0_0_8px_#22d3ee]",
        softBg: isMobile ? "bg-cyan-900/50" : "bg-cyan-500/10",
        softBorder: isMobile ? "border-cyan-700" : "border-cyan-500/20",
        timeIcon: "🌙",
        statusText: "text-white",
        statusBg: isMobile ? "bg-slate-700" : "bg-white/10",
      }
    };
    
    const situasi = {
      viral: {
        text: isMalam ? (isMobile ? "text-rose-400" : "text-rose-400") : "text-rose-700",
        bg: isMalam ? (isMobile ? "bg-rose-900/50" : "bg-rose-500/10") : (isMobile ? "bg-rose-100" : "bg-rose-100"),
        border: isMalam ? (isMobile ? "border-rose-700" : "border-rose-500/20") : (isMobile ? "border-rose-300" : "border-rose-300"),
        icon: "🔥",
        label: "Viral",
      },
      ramai: {
        text: isMalam ? (isMobile ? "text-amber-400" : "text-amber-400") : "text-amber-700",
        bg: isMalam ? (isMobile ? "bg-amber-900/50" : "bg-amber-500/10") : (isMobile ? "bg-amber-100" : "bg-amber-100"),
        border: isMalam ? (isMobile ? "border-amber-700" : "border-amber-500/20") : (isMobile ? "border-amber-300" : "border-amber-300"),
        icon: "👥",
        label: "Ramai",
      },
      sepi: {
        text: isMalam ? (isMobile ? "text-emerald-400" : "text-emerald-400") : "text-emerald-700",
        bg: isMalam ? (isMobile ? "bg-emerald-900/50" : "bg-emerald-500/10") : (isMobile ? "bg-emerald-100" : "bg-emerald-100"),
        border: isMalam ? (isMobile ? "border-emerald-700" : "border-emerald-500/20") : (isMobile ? "border-emerald-300" : "border-emerald-300"),
        icon: "🍃",
        label: "Sepi",
      }
    };
    
    const currentTime = timeVibes[sapaan] || timeVibes.Siang;
    
    return {
      ...base,
      isMalam,
      sapaan,
      timeInfo,
      dot: currentTime.dot,
      dotGlow: currentTime.dotGlow, // empty string di HP
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
      bgGlass: base.bgGlass,
      // Tambahan info untuk debugging
      isMobile,
      performanceMode: isMobile,
    };
  }, [sapaan, timeInfo, isMobile]);
}