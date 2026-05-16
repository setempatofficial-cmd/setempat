"use client";
import { memo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useTheme } from "@/app/hooks/useTheme";
import {
  Megaphone, MapPin, Clock, ChevronRight,
  AlertTriangle, Bell, Volume2, Camera, Sparkles, Image as ImageIcon
} from "lucide-react";

// ==================== TYPE CONFIG ====================
const typeConfig = {
  kentongan: {
    label: "INFO DESA",
    icon: <Megaphone size={14} />,
    bgLight: "bg-gradient-to-b from-orange-50 to-white",
    bgDark: "bg-zinc-900/80 backdrop-blur-md",
    accent: "text-orange-500",
    borderDark: "border-orange-500/20"
  },
  "area-summary": {
    label: "UPDATE AREA",
    icon: <MapPin size={14} />,
    bgLight: "bg-gradient-to-b from-blue-50 to-white",
    bgDark: "bg-zinc-900/80 backdrop-blur-md",
    accent: "text-blue-500",
    borderDark: "border-blue-500/20"
  },
  "trigger-action": {
    label: "AJAKAN",
    icon: <Camera size={14} />,
    bgLight: "bg-gradient-to-b from-purple-50 to-white",
    bgDark: "bg-zinc-900/80 backdrop-blur-md",
    accent: "text-purple-500",
    borderDark: "border-purple-500/20"
  },
  "ai-insight": {
    label: "AI INSIGHT",
    icon: <Sparkles size={14} />,
    bgLight: "bg-gradient-to-b from-emerald-50 to-white",
    bgDark: "bg-zinc-900/80 backdrop-blur-md",
    accent: "text-emerald-500",
    borderDark: "border-emerald-500/20"
  },
};

// ==================== BADGE URGENCY ====================
const UrgencyBadge = ({ isUrgent, urgency }) => {
  if (isUrgent) {
    return (
      <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500 text-white shadow-md shadow-red-500/20">
        <span className="w-1 h-1 rounded-full bg-white animate-ping" />
        <span className="text-[8px] font-black tracking-wider uppercase">DARURAT</span>
      </div>
    );
  }

  if (urgency === 'high') {
    return (
      <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-500 text-white">
        <AlertTriangle size={8} />
        <span className="text-[8px] font-black tracking-wider uppercase">PENTING</span>
      </div>
    );
  }

  if (urgency === 'medium') {
    return (
      <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500 text-white">
        <Bell size={8} />
        <span className="text-[8px] font-black tracking-wider uppercase">INFO</span>
      </div>
    );
  }

  return null;
};

// ==================== MAIN BREAKCARD ====================
const BreakCard = memo(({ type = "kentongan", data = {}, onClick, level = "A" }) => {
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

  return (
    <div className="px-4 w-full max-w-md mx-auto my-3 select-none">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -2 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        onClick={onClick}
        className={`
          rounded-t-2xl rounded-b-none overflow-hidden cursor-pointer
          ${isMalam ? config.bgDark : config.bgLight}
          ${isUrgent
            ? 'border-t-2 border-x border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.07)] animate-[pulse_3s_infinite]'
            : isMalam ? `border-t border-x border-white/5 ${config.borderDark}` : 'border-t border-x border-gray-100 shadow-sm'
          }
          hover:shadow-md transition-all duration-200
        `}
      >
        {/* ==================== BAGIAN FOTO ==================== */}
        {/* Menggunakan aspect-video (16:9) konsisten untuk mencegah pergeseran layout saat dimuat */}
        <div className="relative w-full aspect-[16/10] bg-zinc-950 overflow-hidden rounded-t-2xl">

          {imageUrl && !imgError ? (
            <>
              {imgLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                  <div className="w-5 h-5 border-2 border-zinc-700 border-t-white/60 rounded-full animate-spin" />
                </div>
              )}

              <img
                src={imageUrl}
                alt={data?.title || "Pantauan"}
                className={`w-full h-full object-cover transition-all duration-500 ${imgLoading ? 'opacity-0 scale-102' : 'opacity-100 scale-100'}`}
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
              <ImageIcon size={32} className={isMalam ? 'text-white/10' : 'text-gray-300/60'} />
              <span className={`text-[9px] mt-1 tracking-wider uppercase font-medium ${isMalam ? 'text-white/20' : 'text-gray-400'}`}>
                Kondisi Lokasi
              </span>
            </div>
          )}

          {/* Tag Kategori Glassmorphism */}
          <div className="absolute top-3 left-3 z-10">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg backdrop-blur-md bg-black/40 border border-white/10 text-white text-[9px] font-bold tracking-wide">
              <span className={config.accent}>{config.icon}</span>
              <span>{config.label}</span>
            </div>
          </div>

          {/* Urgency Badge */}
          <div className="absolute top-3 right-3 z-10">
            <UrgencyBadge isUrgent={isUrgent} urgency={data?.urgency} />
          </div>

          {/* Proteksi Gradasi Halus Bawah Foto */}
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/50 via-black/10 to-transparent pointer-events-none" />
        </div>

        {/* ==================== BAGIAN KONTEN ==================== */}
        <div className="p-4">
          <h3 className={`text-base font-black leading-snug tracking-tight ${isMalam ? 'text-zinc-100' : 'text-gray-900'} line-clamp-2`}>
            {data?.title || data?.text || "Update Warga"}
          </h3>

          {data?.content && (
            <p className={`text-[12px] mt-1.5 line-clamp-2 leading-relaxed font-medium ${isMalam ? 'text-zinc-400' : 'text-gray-600'}`}>
              {data.content}
            </p>
          )}

          {/* Footer Card */}
          <div className="flex items-center justify-between mt-3.5 pt-2.5 border-t border-zinc-500/10">
            <div className="flex items-center gap-2.5 text-[10px] text-zinc-500 font-medium truncate max-w-[75%]">
              {(data?.target_desa || data?.location) && (
                <div className="flex items-center gap-1 opacity-80 shrink-0">
                  <MapPin size={11} className={config.accent} />
                  <span className={isMalam ? 'text-zinc-300' : 'text-gray-700'}>
                    {data.target_desa || data.location}
                  </span>
                </div>
              )}

              {timeText && (
                <div className="flex items-center gap-1 opacity-60">
                  <Clock size={10} />
                  <span>{timeText}</span>
                </div>
              )}
            </div>

            {/* Navigasi Aksi */}
            <motion.div
              whileHover={{ x: 2 }}
              className="flex items-center gap-0.5 text-emerald-500 text-[10px] font-black tracking-wider uppercase shrink-0"
            >
              <span>Buka</span>
              <ChevronRight size={12} strokeWidth={3} />
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
});

BreakCard.displayName = "BreakCard";
export default BreakCard;