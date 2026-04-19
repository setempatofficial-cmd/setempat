"use client";
import { BadgeCheck } from "lucide-react"; 
import { useMemo } from "react";

export default function VerifiedBadge({ size = "sm", showText = false, isMalam = true }) {
  const cfg = useMemo(() => {
    const iconSizes = { xs: 12, sm: 15, md: 20, lg: 24 };
    const textSizes = { xs: "text-[9px]", sm: "text-[11px]", md: "text-[13px]", lg: "text-[15px]" };
    
    const theme = isMalam ? {
      // MODE MALAM: Cyberpunk Blue (Glow & Glass)
      container: "bg-blue-500/10 backdrop-blur-md border-blue-400/30 shadow-[0_0_15px_rgba(59,130,246,0.2)]",
      icon: "text-blue-400 fill-blue-400/20",
      text: "text-blue-300 drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]",
      glow: "bg-blue-400/30",
      shimmer: "via-blue-400/40"
    } : {
      // MODE SIANG: Royal Crystal (Solid & Sharp)
      container: "bg-gradient-to-br from-blue-600 to-blue-700 border-blue-700 shadow-lg",
      icon: "text-white fill-white/20",
      text: "text-white drop-shadow-sm",
      glow: "bg-blue-600/40",
      shimmer: "via-white/60"
    };

    return { ...theme, iconSize: iconSizes[size], textSize: textSizes[size] };
  }, [size, isMalam]);

  const badgeContent = (
    <div className="flex items-center gap-1.5 relative z-10">
      <div className="relative flex items-center justify-center">
        {/* Subtle Pulse Effect for VIP feel */}
        <span className={`absolute inset-0 rounded-full animate-ping opacity-20 ${isMalam ? 'bg-blue-400' : 'bg-white'}`} style={{ animationDuration: '3s' }} />
        
        <BadgeCheck 
          size={cfg.iconSize} 
          strokeWidth={2.5}
          className={`
            ${cfg.icon}
            transition-all duration-500 group-hover:rotate-[15deg] group-hover:scale-110
          `} 
        />
      </div>

      {showText && (
        <span className={`
          font-black tracking-widest uppercase italic antialiased
          ${cfg.text} ${cfg.textSize}
        `}>
          Verified
        </span>
      )}
    </div>
  );

  // Layout untuk varian dengan teks (Pills)
  if (showText) {
    return (
      <div className={`
        inline-flex items-center px-4 py-1.5 rounded-full border relative overflow-hidden group cursor-default
        ${cfg.container} transition-all duration-500 hover:scale-[1.02] active:scale-95
      `}>
        {/* Sweep Shimmer Effect */}
        <div className={`absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-[1500ms] ease-in-out bg-gradient-to-r from-transparent ${cfg.shimmer} to-transparent`} />
        {badgeContent}
      </div>
    );
  }

  // Layout untuk varian Ikon saja (Minimalist)
  return (
    <div 
      className="inline-flex items-center justify-center relative group cursor-help p-0.5"
      title="Verified Account"
    >
      {/* Background Aura */}
      <div className={`
        absolute inset-0 blur-lg rounded-full opacity-0 
        group-hover:opacity-100 transition-all duration-700 scale-150
        ${cfg.glow}
      `} />
      
      {badgeContent}
    </div>
  );
}