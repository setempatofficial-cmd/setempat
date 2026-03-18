// hooks/useTheme.js - FINAL DENGAN STATUS TEXT UNTUK SEMUA MODE

import { useMemo } from "react";
import { useLocation } from "@/app/components/LocationProvider";

export function useTheme() {
  const { sapaan } = useLocation(); // "Pagi", "Siang", "Sore", "Malam"
  
  return useMemo(() => {
    const isMalam = sapaan === "Malam";
    
    const base = isMalam ? {
      // MALAM: konsisten semua #0f172a
      bg: "bg-[#0f172a]",        // background utama (header, laporan)
      card: "bg-[#0f172a]",       // card FEED SAMA PERSIS dengan bg
      border: "border-slate-800",
      text: "text-white",
      textMuted: "text-slate-400",
      accent: "text-cyan-400",
      accentBg: "bg-cyan-400",
      accentSoft: "bg-cyan-500/10",
      accentBorder: "border-cyan-500/20",
      // Efek hover tetap bisa beda tipis
      cardHover: "hover:bg-[#1a2538]",
    } : {
      // SIANG: bg putih gading, card putih bersih (beda tipis)
      bg: "bg-[#F9F7F7]",
      card: "bg-white",
      border: "border-slate-200",
      text: "text-slate-900",
      textMuted: "text-slate-500",
      accent: "text-[#E3655B]",
      accentBg: "bg-[#E3655B]",
      accentSoft: "bg-rose-50",
      accentBorder: "border-rose-200",
      cardHover: "hover:bg-gray-50",
    };
    
    const timeVibes = {
      Pagi: {
        dot: "bg-orange-500",
        dotGlow: "shadow-[0_0_8px_rgba(249,115,22,0.5)]",
        softBg: "bg-orange-50",
        softBorder: "border-orange-200",
        timeText: "text-orange-600",
        timeIcon: "🌅",
        statusText: "text-slate-800",      // ✅ TAMBAH: gelap untuk background terang
        statusBg: "bg-orange-50/80",        // ✅ TAMBAH: background untuk status island
      },
      Siang: {
        dot: "bg-[#E3655B]",
        dotGlow: "shadow-[0_0_8px_rgba(227,101,91,0.4)]",
        softBg: "bg-rose-50",
        softBorder: "border-rose-200",
        timeText: "text-[#E3655B]",
        timeIcon: "☀️",
        statusText: "text-slate-800",      // ✅ TAMBAH: gelap untuk background terang
        statusBg: "bg-rose-50/80",          // ✅ TAMBAH: background untuk status island
      },
      Sore: {
        dot: "bg-rose-500",
        dotGlow: "shadow-[0_0_8px_rgba(244,63,94,0.5)]",
        softBg: "bg-rose-50",
        softBorder: "border-rose-200",
        timeText: "text-rose-600",
        timeIcon: "🌆",
        statusText: "text-slate-800",      // ✅ TAMBAH: gelap untuk background terang
        statusBg: "bg-rose-50/80",          // ✅ TAMBAH: background untuk status island
      },
      Malam: {
        dot: "bg-cyan-400",
        dotGlow: "shadow-[0_0_8px_#22d3ee]",
        softBg: "bg-cyan-500/10",
        softBorder: "border-cyan-500/20",
        timeText: "text-cyan-400",
        timeIcon: "🌙",
        statusText: "text-white",           // ✅ TAMBAH: putih untuk background gelap
        statusBg: "bg-white/5",              // ✅ TAMBAH: background untuk status island
      }
    };
    
    const situasi = {
      viral: {
        text: isMalam ? "text-rose-400" : "text-rose-600",
        bg: isMalam ? "bg-rose-500/10" : "bg-rose-50",
        border: isMalam ? "border-rose-500/20" : "border-rose-200",
        icon: "🔥",
        label: "Viral",
      },
      ramai: {
        text: isMalam ? "text-amber-400" : "text-amber-600",
        bg: isMalam ? "bg-amber-500/10" : "bg-amber-50",
        border: isMalam ? "border-amber-500/20" : "border-amber-200",
        icon: "👥",
        label: "Ramai",
      },
      sepi: {
        text: isMalam ? "text-emerald-400" : "text-emerald-600",
        bg: isMalam ? "bg-emerald-500/10" : "bg-emerald-50",
        border: isMalam ? "border-emerald-500/20" : "border-emerald-200",
        icon: "🍃",
        label: "Sepi",
      }
    };
    
    return {
      ...base,
      isMalam,
      sapaan,
      ...timeVibes[sapaan] || timeVibes.Siang,
      situasi,
      getSituasi: (type) => situasi[type] || situasi.ramai,
      vibeInfo: {
        icon: timeVibes[sapaan]?.timeIcon || "☀️",
        label: sapaan,
      },
      bgGlass: isMalam ? "bg-[#0f172a]/80 backdrop-blur-sm" : "bg-white/80 backdrop-blur-sm",
    };
  }, [sapaan]);
}