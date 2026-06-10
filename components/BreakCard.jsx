"use client";
import { memo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useTheme } from "@/app/hooks/useTheme";
import {
  Megaphone, MapPin, Clock, ChevronRight,
  AlertTriangle, Bell, Camera, Sparkles, Image as ImageIcon
} from "lucide-react";

// ==================== CONFIGURATION ====================
const typeConfig = {
  kentongan: {
    label: "INFO DESA",
    icon: <Megaphone size={12} />,
    bgLight: "bg-white",
    bgDark: "bg-zinc-900",
    accent: "text-orange-500",
    borderLight: "border-orange-100",
    borderDark: "border-orange-500/10",
    shadow: "shadow-orange-500/[0.03]"
  },
  "area-summary": {
    label: "UPDATE AREA",
    icon: <MapPin size={12} />,
    bgLight: "bg-white",
    bgDark: "bg-zinc-900",
    accent: "text-blue-500",
    borderLight: "border-blue-100",
    borderDark: "border-blue-500/10",
    shadow: "shadow-blue-500/[0.03]"
  },
  "trigger-action": {
    label: "AJAKAN",
    icon: <Camera size={12} />,
    bgLight: "bg-white",
    bgDark: "bg-zinc-900",
    accent: "text-purple-500",
    borderLight: "border-purple-100",
    borderDark: "border-purple-500/10",
    shadow: "shadow-purple-500/[0.03]"
  },
  "ai-insight": {
    label: "AI INSIGHT",
    icon: <Sparkles size={12} />,
    bgLight: "bg-white",
    bgDark: "bg-zinc-900",
    accent: "text-emerald-500",
    borderLight: "border-emerald-100",
    borderDark: "border-emerald-500/10",
    shadow: "shadow-emerald-500/[0.03]"
  },
};

// ==================== PREMIUM SHIMMER LOADING ====================
const ImageShimmer = () => (
  <div className="absolute inset-0 bg-zinc-900 overflow-hidden">
    <div className="w-full h-full relative before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/[0.08] before:to-transparent" />
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
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500 text-white shadow-[0_2px_10px_rgba(239,68,68,0.4)] backdrop-blur-md">
        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
        <span className="text-[9px] font-bold tracking-widest uppercase">DARURAT</span>
      </div>
    );
  }

  if (urgency === 'high') {
    return (
      <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/90 backdrop-blur-md text-white shadow-sm">
        <AlertTriangle size={9} />
        <span className="text-[9px] font-bold tracking-widest uppercase">PENTING</span>
      </div>
    );
  }

  if (urgency === 'medium') {
    return (
      <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/90 backdrop-blur-md text-white shadow-sm">
        <Bell size={9} />
        <span className="text-[9px] font-bold tracking-widest uppercase">INFO</span>
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
    // 1. Wrapper Luar: Mengunci ukuran layout (will-change) agar tidak mengganggu scroll container utama
    <div className="w-full max-w-md mx-auto mb-6 select-none p-0.5 will-change-transform">
      <motion.div
        initial={{ opacity: 0 }} // 2. AMAN SCROLL: Hanya mainkan Opacity, hilangkan 'y: 12' untuk cegah lompatan layout
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25, ease: "linear" }}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        className={`
          group rounded-2xl overflow-hidden cursor-pointer w-full transform-gpu transition-all duration-300
          ${isMalam ? `${config.bgDark} text-zinc-100` : `${config.bgLight} text-zinc-900`}
          ${isUrgent
            ? 'border border-red-500/50 shadow-[0_8px_30px_rgba(239,68,68,0.12)] ring-1 ring-red-500/20'
            : isMalam
              ? `border border-zinc-800/80 ${config.borderDark} shadow-[0_12px_30px_rgba(0,0,0,0.25)] ${config.shadow}`
              : `border border-zinc-100 ${config.borderLight} shadow-[0_12px_24px_rgba(0,0,0,0.03)] ${config.shadow}`
          }
          hover:shadow-md /* 3. AMAN SCROLL: Mengganti hover translat-y ke bayangan/shadow halus */
        `}
      >
        {/* ==================== IMAGE SECTION (4:3) ==================== */}
        <div className="relative w-full aspect-[1/1] bg-zinc-950 overflow-hidden">
          {imageUrl && !imgError ? (
            <>
              {imgLoading && <ImageShimmer />}
              <img
                src={imageUrl}
                alt={data?.title || "Pantauan"}
                className={`w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-103 ${imgLoading ? 'opacity-0' : 'opacity-100'
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
              <ImageIcon size={32} className={isMalam ? 'text-zinc-800' : 'text-zinc-300'} />
              <span className={`text-[10px] mt-2 tracking-widest uppercase font-semibold ${isMalam ? 'text-zinc-600' : 'text-zinc-400'}`}>
                Kondisi Lokasi
              </span>
            </div>
          )}

          {/* Overlay Glassmorphic Kategori */}
          <div className="absolute top-3.5 left-3.5 z-10">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl backdrop-blur-md bg-black/50 border border-white/10 text-white text-[9px] font-bold tracking-wider shadow-sm">
              <span className={`${config.accent} drop-shadow-[0_0_6px_rgba(255,255,255,0.2)]`}>
                {config.icon}
              </span>
              <span>{config.label}</span>
            </div>
          </div>

          {/* Urgency Badge */}
          <div className="absolute top-3.5 right-3.5 z-10">
            <UrgencyBadge isUrgent={isUrgent} urgency={data?.urgency} />
          </div>

          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 via-black/20 to-transparent pointer-events-none" />
        </div>

        {/* ==================== CONTENT SECTION ==================== */}
        <div className={`pt-4.5 pb-4 sm:pb-5 ${paddingX}`}>
          <h3 className={`text-[16px] font-bold leading-snug tracking-tight line-clamp-2 transition-colors duration-200 ${isMalam ? 'text-zinc-100 group-hover:text-white' : 'text-zinc-800 group-hover:text-black'
            }`}>
            {data?.title || data?.text || "Update Warga"}
          </h3>

          {data?.content && (
            <p className={`text-[12.5px] mt-2 line-clamp-2 leading-relaxed font-normal ${isMalam ? 'text-zinc-400' : 'text-zinc-500'
              }`}>
              {data.content}
            </p>
          )}

          {/* Footer Card */}
          <div className="flex items-center justify-between mt-5 pt-3.5 border-t border-zinc-100 dark:border-zinc-800/60">
            <div className="flex items-center gap-3.5 text-[11.5px] text-zinc-400 font-medium truncate max-w-[75%]">
              {(data?.target_desa || data?.location) && (
                <div className="flex items-center gap-1 shrink-0">
                  <MapPin size={12} className={`${config.accent} opacity-90`} />
                  <span className={`${isMalam ? 'text-zinc-300' : 'text-zinc-600'} truncate max-w-[130px] font-semibold`}>
                    {data.target_desa || data.location}
                  </span>
                </div>
              )}

              {timeText && (
                <div className="flex items-center gap-1 opacity-75 shrink-0 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-md text-[10.5px]">
                  <Clock size={11} />
                  <span>{timeText}</span>
                </div>
              )}
            </div>

            {/* Action Call to Action */}
            <div className="flex items-center gap-0.5 text-emerald-500 dark:text-emerald-400 text-[11px] font-bold tracking-wider uppercase shrink-0">
              <span>Buka</span>
              <ChevronRight size={12} strokeWidth={3} className="transform group-hover:translate-x-0.5 transition-transform duration-200" />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
});

BreakCard.displayName = "BreakCard";
export default BreakCard;