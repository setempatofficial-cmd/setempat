"use client";
import { ShieldCheck } from "lucide-react";
import { useMemo } from "react";

export default function VerifiedBadge({ size = "sm", showText = false, isMalam = true }) {
  // 1. Optimized Config with useMemo for performance
  const cfg = useMemo(() => {
    const iconSizes = { xs: 12, sm: 14, md: 18, lg: 22 };
    const textSizes = { xs: "text-[8px]", sm: "text-[10px]", md: "text-[11px]", lg: "text-[13px]" };
    
    const theme = isMalam ? {
      container: "bg-gradient-to-tr from-amber-500/20 to-yellow-400/5 border-amber-500/30",
      icon: "text-amber-400 fill-amber-400/10",
      text: "text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]",
      glow: "bg-amber-400",
      shimmer: "after:from-white/10"
    } : {
      container: "bg-gradient-to-tr from-amber-100 to-yellow-50 border-amber-200",
      icon: "text-amber-700 fill-amber-600/5",
      text: "text-amber-800",
      glow: "bg-amber-600",
      shimmer: "after:from-white/40"
    };

    return { ...theme, iconSize: iconSizes[size], textSize: textSizes[size] };
  }, [size, isMalam]);

  const badgeContent = (
    <div className="flex items-center gap-1.5 relative z-10">
      <ShieldCheck 
        size={cfg.iconSize} 
        strokeWidth={2.5}
        className={`
          ${cfg.icon}
          transition-transform duration-500 group-hover:scale-110 group-hover:rotate-[5deg]
        `} 
      />
      {showText && (
        <span className={`
          font-bold tracking-widest uppercase antialiased
          ${cfg.text} ${cfg.textSize}
        `}>
          Verified
        </span>
      )}
    </div>
  );

  // Mode: Full Badge (With Text)
  if (showText) {
    return (
      <div className={`
        inline-flex items-center px-2.5 py-1 rounded-full border relative overflow-hidden group
        ${cfg.container} transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/10
      `}>
        {/* Shimmer Effect */}
        <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        {badgeContent}
      </div>
    );
  }

  // Mode: Icon Only
  return (
    <div 
      className="inline-flex items-center justify-center relative group cursor-help p-0.5"
      title="Verified Account"
    >
      {/* Dynamic Glow Layer */}
      <div className={`
        absolute inset-0 blur-md rounded-full opacity-0 
        group-hover:opacity-100 transition-all duration-500 scale-50 group-hover:scale-125
        ${cfg.glow}
      `} />
      
      {badgeContent}
    </div>
  );
}