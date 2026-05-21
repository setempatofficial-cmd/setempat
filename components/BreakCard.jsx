"use client";
import { memo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useTheme } from "@/app/hooks/useTheme";
import {
  Megaphone, MapPin, Clock, ChevronRight,
  AlertTriangle, Bell, Camera, Sparkles, Image as ImageIcon
} from "lucide-react";

// ==================== TYPE CONFIG ====================
const typeConfig = {
  kentongan: {
    label: "INFO DESA",
    icon: <Megaphone size={13} />,
    bgLight: "bg-white",
    bgDark: "bg-[#1c1c1e]",
    accent: "text-orange-500",
    borderLight: "border-orange-100",
    borderDark: "border-orange-500/10"
  },
  "area-summary": {
    label: "UPDATE AREA",
    icon: <MapPin size={13} />,
    bgLight: "bg-white",
    bgDark: "bg-[#1c1c1e]",
    accent: "text-blue-500",
    borderLight: "border-blue-100",
    borderDark: "border-blue-500/10"
  },
  "trigger-action": {
    label: "AJAKAN",
    icon: <Camera size={13} />,
    bgLight: "bg-white",
    bgDark: "bg-[#1c1c1e]",
    accent: "text-purple-500",
    borderLight: "border-purple-100",
    borderDark: "border-purple-500/10"
  },
  "ai-insight": {
    label: "AI INSIGHT",
    icon: <Sparkles size={13} />,
    bgLight: "bg-white",
    bgDark: "bg-[#1c1c1e]",
    accent: "text-emerald-500",
    borderLight: "border-emerald-100",
    borderDark: "border-emerald-500/10"
  },
};

// ==================== PREMIUM SHIMMER LOADING ====================
const ImageShimmer = () => (
  <div className="absolute inset-0 bg-zinc-900 overflow-hidden">
    <div className="w-full h-full relative before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/[0.06] before:to-transparent" />
    <style jsx global>{`
      @keyframes shimmer {
        100% { transform: translateX(100%); }
      }
    `}</style>
  </div>
);

// ==================== BADGE URGENCY ====================
const UrgencyBadge = ({ isUrgent, urgency }) => {
  if (isUrgent) {
    return (
      <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500 text-white shadow-sm">
        <span className="w-1 h-1 rounded-full bg-white animate-ping" />
        <span className="text-[8px] font-bold tracking-wider uppercase">DARURAT</span>
      </div>
    );
  }

  if (urgency === 'high') {
    return (
      <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500 text-white">
        <AlertTriangle size={8} />
        <span className="text-[8px] font-bold tracking-wider uppercase">PENTING</span>
      </div>
    );
  }

  if (urgency === 'medium') {
    return (
      <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500 text-white">
        <Bell size={8} />
        <span className="text-[8px] font-bold tracking-wider uppercase">INFO</span>
      </div>
    );
  }

  return null;
};

// ==================== MAIN BREAKCARD ====================
const BreakCard = memo(({ type = "kentongan", data = {}, onClick, isNarrow = false }) => {
  const theme = useTheme();
  const isMalam = theme?.isMalam;
  const [imgError, setImgError] = useState(false);
  const [imgLoading, setImgLoading] = useState(true);

  const config = typeConfig[type] || typeConfig.kentongan;
  const imageUrl = data?.image_url || data?.photo_url || data?.thumbnail || null;
  const isUrgent = data?.is_urgent;

  useEffect(() => {
    setImgError(false);
    setImgLoading(true);
  }, [imageUrl]);

  const formatTime = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const now = new Date();
    const diffMins = Math.floor((now - date) / 60000);

    if (diffMins < 1) return "Baru saja";
    if (diffMins < 60) return `${diffMins} mnt lalu`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} jam lalu`;
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  };

  const timeText = formatTime(data?.created_at);
  const paddingX = `px-4 ${!isNarrow ? 'sm:px-5' : ''}`;

  return (
    <div className="w-full max-w-md mx-auto mb-4 sm:mb-5 select-none">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        onClick={onClick}
        className={`
          rounded-2xl overflow-hidden cursor-pointer w-full transform-gpu
          ${isMalam ? config.bgDark : config.bgLight}
          ${isUrgent
            ? 'border border-red-500/40 shadow-[0_4px_20px_rgba(239,68,68,0.08)]'
            : isMalam
              ? `border border-white/[0.06] ${config.borderDark} shadow-[0_4px_25px_rgba(0,0,0,0.2)]`
              : `border border-black/[0.04] ${config.borderLight} shadow-[0_4px_20px_rgba(0,0,0,0.02)]`
          }
          hover:opacity-95 transition-all duration-200
        `}
      >
        {/* ==================== BAGIAN FOTO (4:3) ==================== */}
        <div className="relative w-full aspect-[4/3] bg-zinc-950 overflow-hidden">
          {imageUrl && !imgError ? (
            <>
              {imgLoading && <ImageShimmer />}

              <img
                src={imageUrl}
                alt={data?.title || "Pantauan"}
                className={`w-full h-full object-cover transition-opacity duration-500 ease-in-out ${imgLoading ? 'opacity-0' : 'opacity-100'
                  }`}
                loading="lazy"
                onLoad={() => setImgLoading(false)}
                onError={() => {
                  setImgError(true);
                  setImgLoading(false);
                }}
              />
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-950">
              <ImageIcon size={28} className={isMalam ? 'text-white/10' : 'text-gray-300/60'} />
              <span className={`text-[9px] mt-1 tracking-wider uppercase font-medium ${isMalam ? 'text-white/20' : 'text-gray-400'}`}>
                Kondisi Lokasi
              </span>
            </div>
          )}

          {/* Overlay Kategori Glassmorphism */}
          <div className="absolute top-3 left-3 z-10">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg backdrop-blur-md bg-black/40 border border-white/[0.08] text-white text-[9px] font-semibold tracking-wide">
              <span className={config.accent}>{config.icon}</span>
              <span>{config.label}</span>
            </div>
          </div>

          {/* Urgency Badge */}
          <div className="absolute top-3 right-3 z-10">
            <UrgencyBadge isUrgent={isUrgent} urgency={data?.urgency} />
          </div>

          <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
        </div>

        {/* ==================== BAGIAN KONTEN ==================== */}
        <div className={`pt-4 pb-4 sm:pb-5 ${paddingX}`}>
          <h3 className={`text-[15px] font-bold leading-snug tracking-tight ${isMalam ? 'text-zinc-100' : 'text-zinc-900'
            } line-clamp-2`}>
            {data?.title || data?.text || "Update Warga"}
          </h3>

          {data?.content && (
            <p className={`text-[12px] mt-1.5 line-clamp-2 leading-relaxed ${isMalam ? 'text-zinc-400' : 'text-zinc-500'
              }`}>
              {data.content}
            </p>
          )}

          {/* Footer Card */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-black/[0.04] dark:border-white/[0.04]">
            <div className="flex items-center gap-3 text-[11px] text-zinc-400 font-medium truncate max-w-[75%]">
              {(data?.target_desa || data?.location) && (
                <div className="flex items-center gap-1 shrink-0">
                  <MapPin size={11} className={`${config.accent} opacity-90`} />
                  <span className={`${isMalam ? 'text-zinc-300' : 'text-zinc-600'} truncate max-w-[120px]`}>
                    {data.target_desa || data.location}
                  </span>
                </div>
              )}

              {timeText && (
                <div className="flex items-center gap-1 opacity-70 shrink-0">
                  <Clock size={11} />
                  <span>{timeText}</span>
                </div>
              )}
            </div>

            {/* Navigasi Aksi */}
            <motion.div
              whileHover={{ x: 2 }}
              className="flex items-center gap-0.5 text-emerald-500 text-[10px] font-bold tracking-wider uppercase shrink-0"
            >
              <span>Buka</span>
              <ChevronRight size={11} strokeWidth={2.5} />
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
});

BreakCard.displayName = "BreakCard";
export default BreakCard;