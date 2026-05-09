"use client";
import { memo, useMemo } from "react";
import { motion } from "framer-motion";
import { useTheme } from "@/app/hooks/useTheme";
import { Sparkles, MapPin, Flame, BarChart3, Camera, Clock, Megaphone, ChevronRight } from "lucide-react";
import Image from "next/image";

const prefixes = ["Terpantau", "Laporan Warga", "Update Terkini", "Kabar Desa", "Hasil Ronda"];
const getRandomPrefix = () => prefixes[Math.floor(Math.random() * prefixes.length)];

const levelStyles = {
  A: {
    wrapper: "rounded-[32px] my-6 bg-gradient-to-br from-orange-500/20 via-slate-900/60 to-black border border-orange-500/30 backdrop-blur-xl shadow-[0_20px_50px_-12px_rgba(249,115,22,0.2)]",
    titleColor: "text-orange-400",
    iconColor: "text-orange-500",
  },
  B: {
    wrapper: "rounded-[32px] my-4 bg-white/[0.03] dark:bg-black/40 border border-white/10 backdrop-blur-md",
    titleColor: "opacity-60",
    iconColor: "opacity-40",
  },
  C: { wrapper: "" },
};

const typeConfig = {
  "area-summary": { label: "Kondisi Sekitar", icon: <MapPin size={18} />, defaultLevel: "B" },
  "ai-insight": { label: "Insight Sekarang", icon: <Sparkles size={18} />, defaultLevel: "A" },
  "trigger-action": { label: "Ikut Update", icon: <Camera size={18} />, defaultLevel: "A" },
  "time-divider": { label: "", icon: <Clock size={18} />, defaultLevel: "C" },
  "kentongan": { label: "KABAR SETEMPAT", icon: <Megaphone size={18} />, defaultLevel: "A" },
};

const BreakCard = memo(({ type, data, theme: themeProp, onClick, level: forcedLevel }) => {
  const theme = themeProp || useTheme();
  const isMalam = theme.isMalam;
  const config = typeConfig[type] || typeConfig["area-summary"];
  const level = forcedLevel || config.defaultLevel;
  const style = levelStyles[level];
  const prefix = useMemo(() => getRandomPrefix(), [data?.text]);

  if (level === "C") {
    return (
      <div className="flex items-center gap-6 my-10 px-10 opacity-20">
        <div className="h-[1px] flex-1 bg-current" />
        <span className="text-[10px] font-black tracking-[0.5em] uppercase">{data?.label || "TIMELINE"}</span>
        <div className="h-[1px] flex-1 bg-current" />
      </div>
    );
  }

  return (
    <div className="px-4 w-full">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        onClick={onClick}
        className={`${style.wrapper} relative overflow-hidden group cursor-pointer active:scale-[0.98] transition-all duration-500 min-h-[220px] flex flex-col`}
      >
        {/* BACKGROUND IMAGE (Jika ada) */}
        {data?.image_url && (
          <div className="absolute inset-0 z-0">
            <Image 
              src={data.image_url} 
              alt="background" 
              fill 
              className="object-cover opacity-40 group-hover:scale-110 transition-transform duration-1000"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
          </div>
        )}

        {/* GLOW EFFECT UNTUK URGENT */}
        {data?.is_urgent && (
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-red-600/20 blur-[80px] animate-pulse" />
        )}

        {/* CONTENT CONTAINER */}
        <div className="relative z-10 p-7 flex flex-col h-full grow">
          {/* HEADER */}
          <div className="flex items-center justify-between mb-auto">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-2xl bg-white/5 border border-white/10 ${style.iconColor}`}>
                {config.icon}
              </div>
              <span className={`text-[11px] font-black tracking-[0.2em] uppercase ${style.titleColor}`}>
                {config.label}
              </span>
            </div>
            
            {data?.is_urgent && (
              <span className="bg-red-500 text-white text-[9px] font-black px-3 py-1 rounded-full shadow-[0_0_20px_rgba(239,68,68,0.5)]">
                URGENT
              </span>
            )}
          </div>

          {/* BODY */}
          <div className="mt-8 mb-6">
            <p className="text-[11px] font-bold uppercase tracking-widest opacity-50 mb-2 flex items-center gap-2">
              <span className="w-4 h-[1px] bg-current" />
              {prefix}
            </p>
            <h2 className={`text-2xl font-bold leading-tight tracking-tight ${isMalam ? "text-white" : "text-slate-900"}`}>
              {data?.text || data?.title}
            </h2>
            
            {(data?.target_desa || data?.location) && (
              <div className="flex items-center gap-2 mt-4 text-[12px] font-medium opacity-60">
                <MapPin size={14} className="text-orange-500" />
                <span>{data.target_desa || data.location}</span>
              </div>
            )}
          </div>

          {/* FOOTER / ACTION */}
          <div className="mt-auto pt-5 border-t border-white/10 flex items-center justify-between">
            <span className="text-[12px] font-black text-orange-500 uppercase tracking-tighter flex items-center gap-2">
              {type === "kentongan" ? "Simak Selengkapnya" : "Update Sekarang"}
              <ChevronRight size={16} />
            </span>
            <span className="text-[10px] opacity-30 font-medium italic">
              {data?.created_at ? new Date(data.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Baru saja'}
            </span>
          </div>
        </div>

        {/* SHIMMER EFFECT ON HOVER */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
      </motion.div>
    </div>
  );
});

BreakCard.displayName = "BreakCard";
export default BreakCard;