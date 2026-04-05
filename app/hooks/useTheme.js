// hooks/useTheme.js - FINAL DENGAN KONTRAST YANG TERJAMIN UNTUK SEMUA MODE

import { useMemo } from "react";
import { useLocation } from "@/components/LocationProvider";

export function useTheme() {
  const { sapaan } = useLocation(); // "Pagi", "Siang", "Sore", "Malam"
  
  return useMemo(() => {
    const isMalam = sapaan === "Malam";
    
    // ==================== BASE THEME ====================
    const base = isMalam ? {
      // MALAM: gelap pekat
      bg: "bg-[#0f172a]",
      card: "bg-[#0f172a]",
      border: "border-slate-800",
      text: "text-white",
      textMuted: "text-slate-300",      // lebih terang dari sebelumnya
      accent: "text-cyan-400",
      accentBg: "bg-cyan-400",
      accentSoft: "bg-cyan-500/10",
      accentBorder: "border-cyan-500/20",
      cardHover: "hover:bg-[#1a2538]",
      statusBg: "bg-white/10",          // background untuk status island
      statusText: "text-white",          // teks putih untuk mode gelap
      timeText: "text-cyan-400",         // teks waktu
    } : {
      // SIANG: putih gading
      bg: "bg-[#F9F7F7]",
      card: "bg-white",
      border: "border-slate-200",
      text: "text-slate-900",
      textMuted: "text-slate-600",       // lebih gelap untuk kontras
      accent: "text-[#E3655B]",
      accentBg: "bg-[#E3655B]",
      accentSoft: "bg-rose-50",
      accentBorder: "border-rose-200",
      cardHover: "hover:bg-gray-50",
      statusBg: "bg-black/5",            // background untuk status island
      statusText: "text-slate-800",       // teks gelap untuk mode terang
      timeText: "text-[#E3655B]",         // teks waktu
    };
    
    // ==================== TIME VIBES ====================
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
        statusBg: isMalam ? "bg-rose-500/20" : "bg-rose-50",
      },
      Sore: {
        dot: "bg-rose-500",
        dotGlow: "shadow-[0_0_8px_rgba(244,63,94,0.5)]",
        softBg: isMalam ? "bg-rose-500/10" : "bg-rose-50",
        softBorder: isMalam ? "border-rose-500/20" : "border-rose-200",
        timeIcon: "🌆",
        statusText: isMalam ? "text-white" : "text-slate-800",
        statusBg: isMalam ? "bg-rose-500/20" : "bg-rose-50",
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
    
    // ==================== SITUASI ====================
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
      // Time-specific
      dot: currentTime.dot,
      dotGlow: currentTime.dotGlow,
      softBg: currentTime.softBg,
      softBorder: currentTime.softBorder,
      timeIcon: currentTime.timeIcon,
      statusText: currentTime.statusText,
      statusBg: currentTime.statusBg,
      // Situasi
      situasi,
      getSituasi: (type) => situasi[type] || situasi.ramai,
      vibeInfo: {
        icon: currentTime.timeIcon,
        label: sapaan,
      },
      bgGlass: isMalam ? "bg-[#0f172a]/80 backdrop-blur-sm" : "bg-white/80 backdrop-blur-sm",
    };
  }, [sapaan]);
}