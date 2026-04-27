"use client";
import { motion } from "framer-motion";
import { 
  Star, ShieldCheck, MapPin, Heart, ChevronRight, 
  HandHelping, Briefcase, MessageCircle, Navigation,
  Award, Clock
} from "lucide-react";

export default function RewangCard({ profile, isMalam, onClick, onChat }) {
  const isSambatan = profile.type === 'kebutuhan';
  
  // Data ringkas
  const distance = profile.distance;
  const proyekSelesai = profile.proyek_selesai || 0;
  const deskripsi = profile.deskripsi_jasa || profile.deskripsi;
  

  return (
    <motion.div
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      className={`group relative w-full rounded-[24px] transition-all duration-300 cursor-pointer overflow-hidden border ${
        isMalam 
          ? "bg-[#161616] border-white/5 shadow-2xl" 
          : "bg-white border-stone-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)]"
      }`}
    >
      {/* 1. Subtle Static Gradient (Ganti Glow Mouse agar Enteng) */}
      <div className={`absolute top-0 right-0 w-32 h-32 blur-[40px] opacity-10 pointer-events-none transition-opacity group-hover:opacity-20 ${
        isSambatan ? "bg-rose-500" : "bg-emerald-500"
      }`} />

      <div className="relative p-4 z-10">
        {/* TOP SECTION */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex gap-3 items-center">
            <div className="relative">
              <img
                src={profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.id}`}
                className={`w-12 h-12 rounded-2xl object-cover ring-2 ${
                  isMalam ? "ring-white/5 bg-stone-800" : "ring-stone-50 bg-stone-100"
                }`}
                alt="avatar"
                loading="lazy" // Penting untuk performa
              />
              {profile.is_verified && (
                <div className="absolute -right-1 -bottom-1 bg-blue-500 p-0.5 rounded-full ring-2 ring-[#161616]">
                  <ShieldCheck size={8} className="text-white" strokeWidth={3} />
                </div>
              )}
            </div>
            
            <div>
              <h3 className={`text-[14px] font-black leading-tight tracking-tight ${isMalam ? "text-stone-100" : "text-stone-900"}`}>
                {isSambatan ? profile.judul : (profile.full_name || profile.display_name)}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[9px] font-bold uppercase tracking-wider ${isSambatan ? "text-rose-400" : "text-emerald-500"}`}>
                  {isSambatan ? "Sambatan" : profile.profesi || "Rewang"}
                </span>
                {!isSambatan && (
                  <div className="flex items-center gap-0.5 text-amber-500 font-bold text-[10px]">
                    <Star size={10} fill="currentColor" />
                    <span>{profile.rating_rewang || "5.0"}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${isMalam ? "bg-white/5" : "bg-stone-50"}`}>
              <Heart size={10} className="fill-rose-500 text-rose-500" />
              <span className={`text-[10px] font-black ${isMalam ? "text-white" : "text-stone-800"}`}>
                {profile.vibe_count || 0}
              </span>
            </div>
          </div>
        </div>

        {/* MIDDLE SECTION: Description */}
        {deskripsi && (
          <p className={`text-[11px] leading-[1.4] line-clamp-2 mb-3 opacity-80 ${isMalam ? "text-stone-400" : "text-stone-500"}`}>
            {deskripsi}
          </p>
        )}

        {/* META INFO GRID */}
        <div className="flex flex-wrap gap-3 mb-4 border-y border-white/5 py-2.5">
          <div className="flex items-center gap-1">
            <Navigation size={10} className="text-stone-400" />
            <span className={`text-[10px] font-bold ${isMalam ? "text-stone-300" : "text-stone-600"}`}>{distance} km</span>
          </div>
          <div className="flex items-center gap-1">
            <MapPin size={10} className="text-stone-400" />
            <span className={`text-[10px] font-medium ${isMalam ? "text-stone-400" : "text-stone-500"}`}>{profile.desa || "Pasuruan"}</span>
          </div>
          {!isSambatan && proyekSelesai > 0 && (
            <div className="flex items-center gap-1">
              <Award size={10} className="text-emerald-500" />
              <span className="text-[10px] font-bold text-emerald-500">{proyekSelesai} Job</span>
            </div>
          )}
        </div>

        {/* FOOTER SECTION */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[8px] font-bold text-stone-500 uppercase tracking-widest mb-0.5">Estimasi Biaya</p>
            <p className={`text-[13px] font-black ${isMalam ? "text-white" : "text-stone-900"}`}>
              {isSambatan ? "🤝 Sukarela" : (profile.estimasi_biaya ? `Rp ${parseInt(profile.estimasi_biaya).toLocaleString()}` : "💬 Nego")}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); onChat?.(profile); }}
              className={`p-2.5 rounded-xl transition-colors active:scale-90 ${
                isMalam 
                  ? "bg-stone-800 text-emerald-400 hover:bg-emerald-500/20" 
                  : "bg-stone-100 text-emerald-600 hover:bg-emerald-50"
              }`}
            >
              <MessageCircle size={18} strokeWidth={2.5} />
            </button>
            <div className={`p-2.5 rounded-xl ${isMalam ? "bg-white text-black" : "bg-black text-white shadow-lg shadow-black/10"}`}>
              <ChevronRight size={18} strokeWidth={3} />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}