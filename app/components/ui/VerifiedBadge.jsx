// app/components/ui/VerifiedBadge.jsx
"use client";
import { ShieldCheck } from "lucide-react";

export default function VerifiedBadge({ size = "sm", showText = false, isMalam = true }) {
  const iconSizes = {
    xs: 10,
    sm: 13,
    md: 16,
    lg: 20,
  };

  const textSizes = {
    xs: "text-[7px]",
    sm: "text-[9px]",
    md: "text-[10px]",
    lg: "text-xs",
  };

  // 🔥 CONFIG: Definisi warna berdasarkan tema
  // Di mode putih, kita pakai Amber-700 (Emas Gelap) agar kontrasnya dapet
  const themeConfig = isMalam ? {
    icon: "text-amber-400 fill-amber-400/20",
    text: "text-amber-400",
    stroke: "stroke-[2px]",
    shadow: "drop-shadow-[0_0_3px_rgba(251,191,36,0.6)]",
    bg: "bg-amber-500/10 border-amber-500/20"
  } : {
    icon: "text-amber-700 fill-amber-600/10", // Lebih gelap untuk bg putih
    text: "text-amber-800",
    stroke: "stroke-[2.8px]", // Garis lebih tebal agar definisi tajam
    shadow: "drop-shadow-[0_1px_1px_rgba(120,60,0,0.3)]",
    bg: "bg-amber-100 border-amber-300"
  };

  const badgeContent = (
    <>
      <ShieldCheck 
        size={iconSizes[size]} 
        className={`
          ${themeConfig.icon}
          ${themeConfig.stroke}
          ${themeConfig.shadow}
          transition-all duration-300
        `} 
      />
      {showText && (
        <span className={`font-black tracking-[0.1em] uppercase ml-1 ${themeConfig.text} ${textSizes[size]}`}>
          Verified
        </span>
      )}
    </>
  );

  if (showText) {
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full border transition-colors ${themeConfig.bg}`}>
        {badgeContent}
      </span>
    );
  }

  return (
    <span 
      className="inline-flex items-center justify-center relative group shrink-0" 
      title="Warga Ber-KTP"
    >
      {/* Efek Hover Glow */}
      <span className={`absolute inset-0 blur-md opacity-0 group-hover:opacity-40 transition-opacity ${isMalam ? "bg-amber-400" : "bg-amber-600"}`} />
      
      {badgeContent}
    </span>
  );
}