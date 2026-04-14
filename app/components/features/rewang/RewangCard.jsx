"use client";
import { motion } from "framer-motion";
import { 
  Star, MapPin, MessageCircle, ShieldCheck, 
  Sparkles, Zap, ArrowUpRight 
} from "lucide-react";

export default function RewangCard({ profile, isMalam }) {
  // AI Logic: Membuat insight otomatis berdasarkan data yang ada
  const getAiInsight = () => {
    // 🔥 Perbaikan: Cek estimasi_biaya dan jam_operasional
    if (profile?.estimasi_biaya && profile?.estimasi_biaya.toLowerCase().includes("gratis")) {
      return "Layanan gratis untuk warga kurang mampu";
    }
    if (profile?.jam_operasional?.toLowerCase().includes("24")) {
      return "Tersedia 24 jam, siap kapanpun dibutuhkan";
    }
    if (profile?.deskripsi_jasa && profile?.deskripsi_jasa.length > 50) {
      return "Deskripsi lengkap, siap bekerja profesional";
    }
    return "Tenaga ahli terverifikasi di wilayah Anda";
  };

  // Generate avatar fallback
  const avatarUrl = profile?.avatar_url || 
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.full_name || profile?.username || "user"}`;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`relative w-full p-4 rounded-[32px] border transition-all duration-500 overflow-hidden ${
        isMalam 
          ? "bg-[#111111] border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.5)]" 
          : "bg-white border-slate-100 shadow-xl shadow-slate-200/40"
      }`}
    >
      {/* AI Glow Effect */}
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-orange-500/10 blur-[30px] pointer-events-none" />

      <div className="flex gap-4">
        {/* Foto Profil */}
        <div className="relative shrink-0">
          <div className="w-20 h-24 rounded-[24px] overflow-hidden border border-white/10 relative bg-slate-800">
            <img 
              src={avatarUrl} 
              alt={profile?.full_name || "Rewang"} 
              className="w-full h-full object-cover" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            
            {/* Jarak Badge - Pakai desa/kecamatan */}
            <div className="absolute bottom-2 left-0 right-0 text-center">
              <span className="text-[7px] text-white font-black uppercase tracking-[0.1em]">
                {profile?.desa || profile?.kecamatan || "Area Sekitar"}
              </span>
            </div>
          </div>
          
          {/* Badge Verifikasi - Tampilkan jika KTP aktif */}
          {profile?.ktp_status === "aktif" && (
            <div className="absolute -top-1 -right-1 bg-blue-500 p-1.5 rounded-full border-[3px] border-[#111111] shadow-lg">
              <ShieldCheck size={10} className="text-white" />
            </div>
          )}
        </div>

        {/* Informasi Utama */}
        <div className="flex flex-col flex-1 pt-1">
          <div className="flex justify-between items-start">
            <div>
              <h3 className={`text-sm font-[1000] tracking-tight leading-none ${isMalam ? "text-white" : "text-slate-900"}`}>
                {profile?.full_name || profile?.username || "Warga"}
              </h3>
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-orange-500 mt-1.5">
                {profile?.profesi || "Tenaga Ahli"}
              </p>
            </div>
            
            {/* 🔥 Rating sementara pakai default, atau bisa dihitung dari transaksi nanti */}
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${isMalam ? "bg-white/5" : "bg-orange-50"}`}>
              <Star size={10} className="text-orange-500 fill-orange-500" />
              <span className="text-[10px] font-black text-orange-500">
                {profile?.rating || "5.0"}
              </span>
            </div>
          </div>

          {/* AI Insight Badge */}
          <div className={`mt-3 flex items-center gap-2 p-2 rounded-2xl border transition-all ${
            isMalam ? "bg-white/5 border-white/5" : "bg-orange-50 border-orange-100/50"
          }`}>
            <div className="relative">
              <Sparkles size={10} className="text-orange-500 animate-pulse" />
              <div className="absolute inset-0 bg-orange-400 blur-sm opacity-20 animate-pulse" />
            </div>
            <p className={`text-[9px] font-bold italic tracking-tight ${isMalam ? "text-orange-200/60" : "text-orange-700/80"}`}>
              AI: {getAiInsight()}
            </p>
          </div>
        </div>
      </div>

      {/* 🔥 Deskripsi Jasa - Pakai deskripsi_jasa */}
      <div className="mt-4 space-y-2">
        <p className={`text-[11px] font-medium leading-relaxed line-clamp-2 ${isMalam ? "text-white/50" : "text-slate-500"}`}>
          <Zap size={10} className="inline mr-1.5 text-orange-500" />
          {profile?.deskripsi_jasa || `Menyediakan jasa ${profile?.profesi || "profesional"} untuk warga sekitar.`}
        </p>
        
        {/* Detail Tambahan: Harga & Jam */}
        {(profile?.estimasi_biaya || profile?.jam_operasional) && (
          <div className="flex flex-wrap gap-2 pt-1">
            {profile?.estimasi_biaya && (
              <div className="flex items-center gap-1">
                <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-orange-500/10 text-orange-500 uppercase">
                  Mulai {profile?.estimasi_biaya}
                </span>
              </div>
            )}
            {profile?.jam_operasional && (
              <div className="flex items-center gap-1 opacity-60 italic text-[9px] font-bold">
                <span>🕒 {profile?.jam_operasional}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mt-5">
        <button 
          onClick={() => {
            const waNumber = profile?.whatsapp;
            if (!waNumber) {
              alert("Nomor WhatsApp belum diisi");
              return;
            }
            // Format nomor WhatsApp (hapus karakter non-digit)
            const cleanNumber = waNumber.replace(/\D/g, '');
            const waUrl = `https://wa.me/${cleanNumber.startsWith('62') ? cleanNumber : `62${cleanNumber}`}`;
            window.open(waUrl, '_blank');
          }}
          disabled={!profile?.whatsapp}
          className={`flex-[2] h-12 rounded-[20px] text-white text-[10px] font-black uppercase tracking-[0.2em] active:scale-95 transition-all flex items-center justify-center gap-2 border-b-4 flex-shrink-0
            ${profile?.whatsapp 
              ? "bg-orange-500 shadow-lg shadow-orange-500/20 border-orange-700 hover:bg-orange-600" 
              : "bg-slate-500 shadow-none border-slate-600 cursor-not-allowed opacity-50"
            }`}
        >
          Hubungi Warga
          <ArrowUpRight size={14} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
        </button>
        
        <button 
          onClick={() => {
            // TODO: Implement AI Chat
            alert("Fitur Tanya AI sedang dalam pengembangan");
          }}
          className={`flex-1 h-12 rounded-[20px] border flex items-center justify-center gap-2 active:scale-95 transition-all ${
            isMalam 
              ? "border-white/10 bg-white/5 text-white hover:bg-white/10" 
              : "border-slate-100 bg-slate-50 text-slate-900 hover:bg-slate-100"
          }`}
        >
          <MessageCircle size={16} className="text-orange-500" />
          <span className="text-[9px] font-black uppercase">Tanya AI</span>
        </button>
      </div>
    </motion.div>
  );
}