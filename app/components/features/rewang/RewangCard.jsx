'use client';

import { motion } from "framer-motion";
import { 
  Star, ShieldCheck, MapPin, Heart, ChevronRight, 
  MessageCircle, Navigation, Award, HandHelping, 
  Hammer, User
} from "lucide-react";

export default function RewangCard({ profile, isMalam, onClick, onChat }) {
  // Logic penentuan tipe: 'kebutuhan' = Sambatan (minta tolong), 'jasa' = Rewang (nawarkan tenaga)
  const isSambatan = profile.type === 'kebutuhan';
  
  // Data Cleanup
  const distance = profile.distance || '0';
  const proyekSelesai = profile.proyek_selesai || 0;
  const deskripsi = profile.deskripsi_jasa || profile.deskripsi;
  const rating = profile.rating_rewang || "5.0";
  const vibeCount = profile.vibe_count || 0;

  return (
    <motion.div
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      className={`group relative w-full rounded-[32px] transition-all duration-300 cursor-pointer overflow-hidden border ${
        isMalam 
          ? "bg-[#1A1A1A] border-white/5 shadow-2xl" 
          : "bg-white border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
      }`}
    >
      {/* 1. Dynamic Glow Background (Subtle) */}
      <div className={`absolute -top-10 -right-10 w-40 h-40 blur-[50px] opacity-[0.08] pointer-events-none transition-opacity group-hover:opacity-15 ${
        isSambatan ? "bg-rose-500" : "bg-emerald-500"
      }`} />

      <div className="relative p-5 z-10">
        {/* TOP SECTION: Avatar & Identity */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex gap-4 items-center">
            <div className="relative">
              <div className={`w-14 h-14 rounded-[20px] overflow-hidden ring-4 ${
                isMalam ? "ring-white/5 bg-stone-800" : "ring-slate-50 bg-slate-100"
              }`}>
                <img
                  src={profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.id}`}
                  className="w-full h-full object-cover"
                  alt="avatar"
                  loading="lazy"
                />
              </div>
              
              {/* Badge Status/Verified */}
              {profile.is_verified ? (
                <div className="absolute -right-1.5 -bottom-1.5 bg-blue-500 p-1 rounded-full ring-4 ring-[#1A1A1A]">
                  <ShieldCheck size={10} className="text-white" strokeWidth={3} />
                </div>
              ) : (
                <div className={`absolute -right-1.5 -bottom-1.5 p-1 rounded-full ring-4 ${isMalam ? "ring-[#1A1A1A] bg-stone-700" : "ring-white bg-slate-200"}`}>
                   {isSambatan ? <HandHelping size={10} className="text-rose-500" /> : <Hammer size={10} className="text-emerald-600" />}
                </div>
              )}
            </div>
            
            <div>
              <h3 className={`text-[15px] font-black leading-tight tracking-tight uppercase italic ${isMalam ? "text-stone-100" : "text-slate-900"}`}>
                {isSambatan ? profile.judul : (profile.full_name || profile.display_name)}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[9px] font-black uppercase tracking-[0.15em] px-2 py-0.5 rounded-md ${
                  isSambatan 
                    ? "bg-rose-500/10 text-rose-500" 
                    : "bg-emerald-500/10 text-emerald-500"
                }`}>
                  {isSambatan ? "SAMBATAN" : (profile.profesi || "REWANG")}
                </span>
                {!isSambatan && (
                  <div className="flex items-center gap-0.5 text-amber-500 font-black text-[10px]">
                    <Star size={10} fill="currentColor" />
                    <span>{rating}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Vibe/Like Count */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl ${isMalam ? "bg-white/5" : "bg-slate-50"}`}>
            <Heart size={12} className={vibeCount > 0 ? "fill-rose-500 text-rose-500" : "text-slate-400"} />
            <span className={`text-[11px] font-black ${isMalam ? "text-white" : "text-slate-800"}`}>
              {vibeCount}
            </span>
          </div>
        </div>

        {/* MIDDLE SECTION: Description */}
        {deskripsi && (
          <p className={`text-[12px] leading-relaxed line-clamp-2 mb-4 font-medium italic ${
            isMalam ? "text-stone-400" : "text-slate-500"
          }`}>
            "{deskripsi}"
          </p>
        )}

        {/* META INFO GRID (Pills style) */}
        <div className="flex flex-wrap gap-2 mb-5">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${
            isMalam ? "bg-white/5 border-white/5 text-stone-300" : "bg-slate-50 border-slate-100 text-slate-600"
          }`}>
            <Navigation size={12} className="text-emerald-500" />
            <span className="text-[10px] font-black">{distance} KM</span>
          </div>
          
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${
            isMalam ? "bg-white/5 border-white/5 text-stone-300" : "bg-slate-50 border-slate-100 text-slate-600"
          }`}>
            <MapPin size={12} className="text-slate-400" />
            <span className="text-[10px] font-bold">{profile.desa || "Pasuruan"}</span>
          </div>

          {!isSambatan && proyekSelesai > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/10 text-emerald-600">
              <Award size={12} />
              <span className="text-[10px] font-black">{proyekSelesai} JOB</span>
            </div>
          )}
        </div>

        {/* FOOTER SECTION: Price & Action */}
        <div className="flex items-center justify-between pt-4 border-t border-dashed border-slate-200/50">
          <div>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">ESTIMASI BIAYA</p>
            <p className={`text-[15px] font-black ${isMalam ? "text-white" : "text-slate-900"}`}>
              {isSambatan ? (
                <span className="text-rose-500">SUKARELA 🤝</span>
              ) : (
                profile.estimasi_biaya ? `Rp ${parseInt(profile.estimasi_biaya).toLocaleString('id-ID')}` : "NEGO 💬"
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); onChat?.(profile); }}
              className={`p-3 rounded-2xl transition-all active:scale-90 ${
                isMalam 
                  ? "bg-white/5 text-emerald-400 hover:bg-emerald-500/20" 
                  : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
              }`}
            >
              <MessageCircle size={20} strokeWidth={2.5} />
            </button>
            <div className={`p-3 rounded-2xl transition-transform group-hover:translate-x-1 ${
              isMalam ? "bg-emerald-500 text-white" : "bg-slate-900 text-white shadow-lg shadow-slate-200"
            }`}>
              <ChevronRight size={20} strokeWidth={3} />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}