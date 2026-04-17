"use client";
import { ShieldCheck } from "lucide-react";
import { useMemo } from "react";

export default function VerifiedBadge({ size = "sm", showText = false, isMalam = true }) {
  const cfg = useMemo(() => {
    const iconSizes = { xs: 12, sm: 14, md: 18, lg: 22 };
    const textSizes = { xs: "text-[8px]", sm: "text-[10px]", md: "text-[11px]", lg: "text-[13px]" };
    
    const theme = isMalam ? {
      // MODE MALAM: Biru Neon Elektrik
      container: "bg-gradient-to-tr from-blue-600/20 via-sky-500/10 to-blue-400/5 border-blue-500/30",
      icon: "text-blue-400 fill-blue-400/10",
      text: "text-blue-400 drop-shadow-[0_0_10px_rgba(56,189,248,0.6)]",
      glow: "bg-blue-500/40",
      shimmer: "after:from-white/20"
    } : {
      // MODE SIANG: Biru Profesional Clean
      container: "bg-gradient-to-tr from-blue-500 to-sky-400 border-blue-600 shadow-md",
      icon: "text-white fill-white/10",
      text: "text-white",
      glow: "bg-blue-600",
      shimmer: "after:from-white/40"
    };

    return { ...theme, iconSize: iconSizes[size], textSize: textSizes[size] };
  }, [size, isMalam]);

  const badgeContent = (
    <div className="flex items-center gap-1.5 relative z-10">
      <ShieldCheck 
        size={cfg.iconSize} 
        strokeWidth={3} // Sedikit lebih tebal agar icon jelas
        className={`
          ${cfg.icon}
          transition-all duration-700 group-hover:scale-125 group-hover:rotate-[12deg]
          filter drop-shadow-[0_0_5px_rgba(56,189,248,0.4)]
        `} 
      />
      {showText && (
        <span className={`
          font-[1000] tracking-[0.15em] uppercase antialiased
          ${cfg.text} ${cfg.textSize}
        `}>
          Verified
        </span>
      )}
    </div>
  );

  if (showText) {
    return (
      <div className={`
        inline-flex items-center px-3 py-1 rounded-full border relative overflow-hidden group
        ${cfg.container} transition-all duration-500 hover:shadow-[0_0_20px_rgba(56,189,248,0.3)]
      `}>
        {/* Efek Kilat (Sweep Shimmer) yang lebih halus */}
        <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-[1200ms] ease-in-out bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        {badgeContent}
      </div>
    );
  }

  return (
    <div 
      className="inline-flex items-center justify-center relative group cursor-help p-1"
      title="Verified Account"
    >
      {/* Dynamic Aura Glow saat Hover */}
      <div className={`
        absolute inset-0 blur-xl rounded-full opacity-0 
        group-hover:opacity-100 transition-all duration-700 scale-50 group-hover:scale-150
        ${cfg.glow}
      `} />
      
      {badgeContent}
    </div>
  );
}