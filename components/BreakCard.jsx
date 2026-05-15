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
    icon: <Megaphone size={18} />, 
    bgLight: "bg-orange-50",
    bgDark: "bg-orange-950/30",
  },
  "area-summary": { 
    label: "UPDATE AREA", 
    icon: <MapPin size={18} />, 
    bgLight: "bg-blue-50",
    bgDark: "bg-blue-950/30",
  },
  "trigger-action": { 
    label: "AJAKAN", 
    icon: <Camera size={18} />, 
    bgLight: "bg-purple-50",
    bgDark: "bg-purple-950/30",
  },
  "ai-insight": { 
    label: "AI INSIGHT", 
    icon: <Sparkles size={18} />, 
    bgLight: "bg-emerald-50",
    bgDark: "bg-emerald-950/30",
  },
};

// ==================== BADGE URGENCY ====================
const UrgencyBadge = ({ isUrgent, urgency }) => {
  if (isUrgent) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg">
        <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
        <span className="text-[9px] font-black">DARURAT</span>
      </div>
    );
  }
  
  if (urgency === 'high') {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500 text-white">
        <AlertTriangle size={10} />
        <span className="text-[9px] font-black">PENTING</span>
      </div>
    );
  }
  
  if (urgency === 'medium') {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500 text-white">
        <Bell size={10} />
        <span className="text-[9px] font-black">INFO</span>
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
  
  // ✅ AMBIL URL GAMBAR - PASTI KEAMBIL
  const imageUrl = data?.image_url || data?.photo_url || data?.thumbnail || null;
  
  // Reset error state ketika URL berubah
  useEffect(() => {
    setImgError(false);
    setImgLoading(true);
  }, [imageUrl]);
  
  // Format waktu
  const formatTime = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const now = new Date();
    const diffMins = Math.floor((now - date) / 60000);
    
    if (diffMins < 1) return "Baru saja";
    if (diffMins < 60) return `${diffMins} menit lalu`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} jam lalu`;
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  };
  
  const timeText = formatTime(data?.created_at);
  
  // Debug log (hapus di production)
  if (imageUrl && !imgError) {
    console.log('🎯 BreakCard loading image:', imageUrl);
  }
  
  return (
    <div className="px-4 w-full max-w-md mx-auto my-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -4 }}
        transition={{ duration: 0.3 }}
        onClick={onClick}
        className={`
          rounded-2xl overflow-hidden cursor-pointer
          ${isMalam ? config.bgDark : config.bgLight}
          ${isMalam ? 'border border-white/10' : 'border border-gray-200'}
          shadow-lg hover:shadow-xl transition-all duration-300
        `}
      >
        {/* ==================== BAGIAN FOTO ==================== */}
        <div className="relative w-full bg-gray-800 overflow-hidden" style={{ minHeight: '200px', height: 'auto' }}>
          
          {/* ✅ FOTO UTAMA - PAKAI img BIASA, TANPA next/image */}
          {imageUrl && !imgError ? (
            <>
              {/* Skeleton loading */}
              {imgLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                  <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={imageUrl}
                alt={data?.title || "Thumbnail"}
                className={`w-full object-cover transition-opacity duration-300 ${imgLoading ? 'opacity-0' : 'opacity-100'}`}
                style={{ maxHeight: '240px', minHeight: '200px' }}
                onLoad={() => {
                  console.log('✅ Image loaded successfully:', imageUrl);
                  setImgLoading(false);
                }}
                onError={(e) => {
                  console.error('❌ Image failed to load:', imageUrl);
                  setImgError(true);
                  setImgLoading(false);
                }}
              />
            </>
          ) : (
            // ✅ FALLBACK - TAMPILAN TANPA FOTO
            <div className="flex flex-col items-center justify-center" style={{ minHeight: '200px' }}>
              <div className="text-center">
                <ImageIcon size={48} className={`mx-auto mb-2 ${isMalam ? 'text-white/20' : 'text-gray-300'}`} />
                <span className={`text-xs ${isMalam ? 'text-white/30' : 'text-gray-400'}`}>
                  Tidak ada gambar
                </span>
              </div>
            </div>
          )}
          
          {/* Badge di atas foto */}
          <div className="absolute top-3 left-3 z-10">
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg backdrop-blur-md bg-black/60 text-white text-[10px] font-bold`}>
              {config.icon}
              <span>{config.label}</span>
            </div>
          </div>
          
          {/* Urgency badge di pojok kanan atas */}
          <div className="absolute top-3 right-3 z-10">
            <UrgencyBadge isUrgent={data?.is_urgent} urgency={data?.urgency} />
          </div>
          
          {/* Overlay gradient di bagian bawah foto */}
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
        </div>
        
        {/* ==================== BAGIAN KONTEN ==================== */}
        <div className="p-4">
          {/* Title */}
          <h3 className={`text-lg font-black leading-tight ${isMalam ? 'text-white' : 'text-gray-900'} line-clamp-2`}>
            {data?.title || data?.text || "Update Penting"}
          </h3>
          
          {/* Content preview */}
          {data?.content && (
            <p className={`text-[13px] mt-2 line-clamp-2 ${isMalam ? 'text-gray-300' : 'text-gray-600'}`}>
              {data.content}
            </p>
          )}
          
          {/* Footer info */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200/20">
            <div className="flex items-center gap-3 text-[11px] flex-wrap">
              {(data?.target_desa || data?.location) && (
                <div className="flex items-center gap-1 opacity-60">
                  <MapPin size={12} />
                  <span>{data.target_desa || data.location}</span>
                </div>
              )}
              
              {timeText && (
                <div className="flex items-center gap-1 opacity-40">
                  <Clock size={10} />
                  <span>{timeText}</span>
                </div>
              )}
            </div>
            
            {/* Tombol aksi */}
            <motion.div
              whileHover={{ x: 3 }}
              className="flex items-center gap-1 text-emerald-500 text-[11px] font-bold"
            >
              <span>Baca</span>
              <ChevronRight size={14} />
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
});

BreakCard.displayName = "BreakCard";
export default BreakCard;