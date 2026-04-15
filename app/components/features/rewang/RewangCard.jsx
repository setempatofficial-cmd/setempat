"use client";
import { motion } from "framer-motion";
import { 
  Star, MessageCircle, ShieldCheck, 
  Sparkles, Zap, ArrowUpRight, Phone,
  CheckCircle2, Clock
} from "lucide-react";

export default function RewangCard({ profile, isMalam }) {
  const getAiInsight = () => {
    if (profile?.estimasi_biaya?.toLowerCase().includes("gratis")) return "Paling Hemat! Layanan sukarela";
    if (profile?.jam_operasional?.toLowerCase().includes("24")) return "Siaga 24 Jam saat darurat";
    return "Partner terpercaya di lingkunganmu";
  };

  const avatarUrl = profile?.avatar_url || 
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.full_name || "user"}`;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -4 }}
      viewport={{ once: true }}
      className={`group relative w-full p-5 rounded-[32px] border transition-all duration-300 ${
        isMalam 
          ? "bg-[#1A1A1A] border-white/10 shadow-2xl" 
          : "bg-white border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
      }`}
    >
      {/* AI Glow Effect - More Subtle */}
      <div className="absolute -right-10 -top-10 w-32 h-32 bg-orange-500/5 blur-[50px] group-hover:bg-orange-500/10 transition-colors pointer-events-none" />

      <div className="flex gap-5">
        {/* Profile Section */}
        <div className="relative shrink-0">
          <div className={`w-20 h-24 rounded-3xl overflow-hidden border-2 relative ${isMalam ? 'border-white/5' : 'border-slate-50'}`}>
            <img src={avatarUrl} alt="Rewang" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            
            {/* Lokasi Badge */}
            <div className="absolute bottom-2 inset-x-0 flex justify-center">
              <span className="px-2 py-0.5 bg-white/20 backdrop-blur-md rounded-full text-[7px] text-white font-bold uppercase tracking-widest border border-white/30">
                {profile?.desa || "Area Lokal"}
              </span>
            </div>
          </div>
          
          {/* Status Online/Verified */}
          <div className="absolute -bottom-1 -right-1 bg-emerald-500 p-1.5 rounded-full border-[3px] border-white dark:border-[#1A1A1A] shadow-sm">
            <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
          </div>
        </div>

        {/* Content Section */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start gap-2">
            <div className="truncate">
              <div className="flex items-center gap-1.5">
                <h3 className={`text-base font-extrabold truncate ${isMalam ? "text-white" : "text-slate-800"}`}>
                  {profile?.full_name || "Warga Rewang"}
                </h3>
                {profile?.ktp_status === "aktif" && (
                  <CheckCircle2 size={14} className="text-blue-500 fill-blue-500/10 shrink-0" />
                )}
              </div>
              <p className="text-[10px] font-bold text-orange-500 uppercase tracking-wider flex items-center gap-1 mt-0.5">
                <Zap size={10} fill="currentColor" /> {profile?.profesi || "Tenaga Jasa"}
              </p>
            </div>

            <div className={`flex items-center gap-1 px-2 py-1 rounded-xl shrink-0 ${isMalam ? "bg-white/5" : "bg-orange-50"}`}>
              <Star size={12} className="text-orange-500 fill-orange-500" />
              <span className="text-xs font-black text-orange-600 leading-none">
                {profile?.rating || "5.0"}
              </span>
            </div>
          </div>

          {/* AI Insight - Bento Style */}
          <div className={`mt-3 p-2.5 rounded-2xl border flex items-center gap-2.5 ${
            isMalam ? "bg-white/5 border-white/5" : "bg-blue-50/50 border-blue-100/50"
          }`}>
            <div className="p-1.5 bg-blue-500 rounded-lg shadow-sm">
              <Sparkles size={12} className="text-white" />
            </div>
            <p className={`text-[10px] font-bold leading-tight ${isMalam ? "text-blue-200/80" : "text-blue-800/80"}`}>
              {getAiInsight()}
            </p>
          </div>
        </div>
      </div>

      {/* Description & Tags */}
      <div className="mt-4">
        <p className={`text-xs leading-relaxed line-clamp-2 font-medium ${isMalam ? "text-slate-400" : "text-slate-600"}`}>
          {profile?.deskripsi_jasa || `Siap membantu kebutuhan ${profile?.profesi || "rumah tangga"} Anda dengan amanah.`}
        </p>
        
        <div className="flex flex-wrap gap-2 mt-3">
          {profile?.estimasi_biaya && (
            <div className={`px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-tight ${
              isMalam ? "border-white/10 bg-white/5 text-slate-300" : "border-slate-100 bg-slate-50 text-slate-600"
            }`}>
              💰 Mulai {profile?.estimasi_biaya}
            </div>
          )}
          {profile?.jam_operasional && (
            <div className={`px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-tight flex items-center gap-1.5 ${
              isMalam ? "border-white/10 bg-white/5 text-slate-300" : "border-slate-100 bg-slate-50 text-slate-600"
            }`}>
              <Clock size={10} /> {profile?.jam_operasional}
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons - High Contrast */}
      <div className="flex gap-3 mt-6">
        <button 
          onClick={() => {/* WhatsApp Logic */}}
          className="flex-[3] h-12 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20 border-b-4 border-emerald-800"
        >
          <Phone size={16} fill="white" />
          <span className="text-[11px] font-black uppercase tracking-widest">Hubungi Sekarang</span>
        </button>
        
        <button 
          className={`flex-1 h-12 rounded-2xl flex items-center justify-center transition-all active:scale-[0.98] border-2 ${
            isMalam 
              ? "border-white/10 hover:bg-white/5 text-white" 
              : "border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-900"
          }`}
        >
          <MessageCircle size={18} className="text-orange-500" />
        </button>
      </div>
    </motion.div>
  );
}