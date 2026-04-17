"use client";
import { memo } from "react";
import { motion } from "framer-motion";
import { useTheme } from "@/app/hooks/useTheme";
import { Sparkles, MapPin, Flame, BarChart3, Camera, Clock, Megaphone } from "lucide-react";

// Tone generator yang lebih variatif
const prefixes = [
  "Sekarang terlihat",
  "Saat ini",
  "Terpantau",
  "Dari laporan warga",
  "Di sekitar kamu",
  "Update terkini",
  "Hasil Ronda:",
];
const getRandomPrefix = () => prefixes[Math.floor(Math.random() * prefixes.length)];

// Level styles dengan efek Glassmorphism
const levelStyles = {
  A: {
    wrapper: "rounded-[28px] p-6 my-6 bg-gradient-to-br from-orange-500/20 via-amber-500/5 to-transparent border border-orange-500/20 backdrop-blur-md shadow-[0_20px_40px_-15px_rgba(249,115,22,0.1)]",
    titleColor: "text-orange-400",
    iconColor: "text-orange-500",
  },
  B: {
    wrapper: "rounded-[24px] p-5 my-4 bg-white/[0.03] dark:bg-black/20 border border-current/5 backdrop-blur-sm",
    titleColor: "opacity-60",
    iconColor: "opacity-40",
  },
  C: {
    wrapper: "",
  },
};

const typeConfig = {
  "area-summary": { label: "Kondisi Sekitar", icon: <MapPin size={16} />, defaultLevel: "B" },
  "heatmap-text": { label: "Titik Paling Aktif", icon: <Flame size={16} />, defaultLevel: "B" },
  "ai-insight": { label: "Insight Sekarang", icon: <Sparkles size={16} />, defaultLevel: "A" },
  "statistic": { label: "Aktivitas Hari Ini", icon: <BarChart3 size={16} />, defaultLevel: "B" },
  "trigger-action": { label: "Ikut Update", icon: <Camera size={16} />, defaultLevel: "A" },
  "time-divider": { label: "", icon: <Clock size={16} />, defaultLevel: "C" },
  // 🔥 TAMBAHKAN TIPE KENTONGAN
  "kentongan": { label: "KABAR SETEMPAT", icon: <Megaphone size={16} />, defaultLevel: "A" },
};

const BreakCard = memo(({ type, data, theme: themeProp, onClick, level: forcedLevel }) => {
  const theme = themeProp || useTheme();
  const isMalam = theme.isMalam;
  const config = typeConfig[type] || { label: "Info", icon: <MapPin size={16} />, defaultLevel: "B" };
  const level = forcedLevel || config.defaultLevel;
  const style = levelStyles[level];
  const prefix = getRandomPrefix();

  const variants = {
    hidden: { opacity: 0, scale: 0.95, y: 10 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
  };

  if (level === "C") {
    return (
      <motion.div
        variants={variants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="flex items-center justify-center gap-6 my-8 px-10"
      >
        <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-current opacity-10" />
        <div className="flex items-center gap-2 opacity-30">
          {config.icon}
          <span className="text-[10px] font-black uppercase tracking-[0.3em]">
            {data?.label || "TIMELINE"}
          </span>
        </div>
        <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-current opacity-10" />
      </motion.div>
    );
  }

  const isClickable = type === "trigger-action" || type === "kentongan";

  return (
    <div className="px-4 w-full">
      <motion.div
        variants={variants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        onClick={isClickable ? onClick : undefined}
        className={`
          ${style.wrapper} 
          ${isClickable ? "active:scale-[0.98] transition-transform cursor-pointer" : ""}
          relative overflow-hidden group
        `}
      >
        {/* Efek khusus untuk kentongan urgent */}
        {type === "kentongan" && data?.is_urgent && (
          <>
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-red-500/20 blur-[40px] rounded-full animate-pulse" />
            <div className="absolute inset-0 border-2 border-red-500/30 rounded-[28px] pointer-events-none" />
          </>
        )}

        <div className="flex items-center gap-2 mb-3">
          <span className={`${style.iconColor}`}>
            {config.icon}
          </span>
          <span className={`text-[10px] font-black uppercase tracking-widest ${style.titleColor || (isMalam ? "text-white/40" : "text-black/40")}`}>
            {config.label}
          </span>
          {type === "kentongan" && data?.is_urgent && (
            <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-red-500 text-white">
              URGENT
            </span>
          )}
        </div>

        <div className="space-y-1">
          <p className={`text-[10px] font-bold uppercase tracking-tighter opacity-40 ${isMalam ? "text-white" : "text-black"}`}>
            {prefix}
          </p>
          <p className={`text-[16px] font-bold leading-tight tracking-tight ${isMalam ? "text-white/90" : "text-neutral-900"}`}>
            {data?.text}
          </p>
          {/* Info target untuk kentongan */}
          {type === "kentongan" && data?.target_desa && !data?.is_global && (
            <p className="text-[10px] opacity-40 flex items-center gap-1 mt-2">
              <MapPin size={10} /> Target: {data.target_desa}
            </p>
          )}
        </div>

        {isClickable && (
          <div className="mt-4 flex items-center gap-2 text-[10px] font-black text-orange-500 uppercase">
            <span>{type === "kentongan" ? "Simak Detail Infonya" : "Ambil Foto Sekarang"}</span>
            <motion.span animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
              →
            </motion.span>
          </div>
        )}
      </motion.div>
    </div>
  );
});

BreakCard.displayName = "BreakCard";
export default BreakCard;