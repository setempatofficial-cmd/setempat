"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/app/context/AuthContext";
import { 
  Star, MessageCircle, ShieldCheck, Phone, 
  Clock, AlertTriangle, Loader2, HandHelping,
  Package, Coffee, Info, MapPin, Heart
} from "lucide-react";

export default function RewangCard({ profile, isMalam }) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [localVibe, setLocalVibe] = useState(profile.vibe_count || 0);

  // LOGIKA IDENTIFIKASI: Sangat simpel, gak perlu fetch lagi
  const isSambatan = profile.type === 'kebutuhan'; 
  
  const handleAction = async () => {
    if (!user) return alert("Login dulu ya, Lur!");
    
    // Proteksi: Jasa (Rewang) wajib KTP, kalau Saling Bantu (Sambatan) bebas
    if (!isSambatan && !profile.is_verified) {
      return alert("⚠️ Demi keamanan, hubungi Rewang yang sudah Terverifikasi KTP (Centang Biru) dulu ya.");
    }

    setIsLoading(true);
    try {
      // 1. Log Transaksi (Supaya terekam di DB)
      const tableName = isSambatan ? 'transaksi_sambatan' : 'transaksi_rewang';
      await supabase.from(tableName).insert([{ 
        pencari_id: user.id,
        penyedia_id: profile.user_id || profile.id, 
        status: 'kontak_dimulai'
      }]);

      // 2. WhatsApp Logic
      const nomorWA = profile.whatsapp || profile.phone;
      const cleanPhone = nomorWA.replace(/\D/g, '');
      const formattedPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;
      
      const pesan = isSambatan 
        ? `Halo ${profile.nama_pengirim}, saya lihat postingan Saling Bantu: "${profile.judul}". Saya siap bantu, Lur!`
        : `Halo ${profile.full_name}, saya butuh jasa ${profile.profesi} dari Setempat.id.`;
      
      window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(pesan)}`, '_blank');
    } catch (err) {
      alert("Gagal memproses.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVibe = async (e) => {
    e.stopPropagation();
    // Update vibe count di tabel profiles
    const { error } = await supabase.rpc('increment_vibe', { row_id: profile.id });
    if (!error) setLocalVibe(prev => prev + 1);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      className={`relative w-full p-4 rounded-[30px] border-2 transition-all ${
        isMalam ? "bg-[#0F0F0F] border-white/5 shadow-2xl" : "bg-white border-slate-50 shadow-xl shadow-slate-200/50"
      }`}
    >
      {/* BADGE STATUS ATAS */}
      <div className="flex justify-between items-start mb-4">
        <div className={`px-3 py-1 rounded-full flex items-center gap-1.5 ${
          isSambatan ? "bg-red-500/10 text-red-500" : "bg-blue-500/10 text-blue-500"
        }`}>
          {isSambatan ? <HandHelping size={12} /> : <ShieldCheck size={12} />}
          <span className="text-[10px] font-black uppercase tracking-tighter">
            {isSambatan ? "Bantu Warga" : "Rewang Ahli"}
          </span>
        </div>

        <button onClick={handleVibe} className="flex items-center gap-1 group">
          <div className="p-1.5 rounded-full bg-orange-500/10 group-active:scale-150 transition-all">
            <Heart size={12} className="text-orange-500 fill-orange-500" />
          </div>
          <span className="text-[11px] font-black text-orange-500">{localVibe}</span>
        </button>
      </div>

      <div className="flex gap-4">
        {/* AVATAR SECTION */}
        <div className="relative shrink-0">
          <div className={`w-16 h-16 rounded-[22px] overflow-hidden border-2 ${
            isSambatan ? "border-red-500/20" : "border-blue-500/20"
          }`}>
            <img 
              src={profile.avatar_url || profile.avatar_pengirim || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.id}`} 
              className="w-full h-full object-cover" 
            />
          </div>
          {profile.is_verified && (
            <div className="absolute -top-1 -right-1 bg-blue-500 p-1 rounded-full text-white shadow-lg">
              <ShieldCheck size={10} strokeWidth={3} />
            </div>
          )}
        </div>

        {/* INFO SECTION */}
        <div className="flex-1 min-w-0">
          <h3 className={`text-[15px] font-black leading-none mb-1 truncate ${isMalam ? "text-white" : "text-slate-900"}`}>
            {isSambatan ? profile.judul : (profile.full_name || profile.display_name)}
          </h3>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
            {isSambatan ? `oleh ${profile.nama_pengirim}` : profile.profesi}
          </p>
          
          <div className="mt-2 flex flex-wrap gap-2">
             <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold ${isMalam ? "bg-white/5 text-slate-400" : "bg-slate-100 text-slate-600"}`}>
                <MapPin size={10} className="text-red-500" /> {profile.desa || profile.lokasi_detail}
             </div>
             {!isSambatan && (
               <div className="flex items-center gap-1 text-[9px] font-bold text-orange-600 bg-orange-500/10 px-2 py-0.5 rounded-md">
                 <Star size={10} fill="currentColor" /> {profile.rating_rewang || "5.0"}
               </div>
             )}
          </div>
        </div>
      </div>

      {/* CONTENT AREA */}
      <div className={`mt-4 p-3 rounded-2xl ${isMalam ? "bg-white/5" : "bg-slate-50"}`}>
        <p className={`text-[11px] leading-relaxed line-clamp-3 ${isMalam ? "text-slate-400" : "text-slate-600"}`}>
          {isSambatan ? profile.deskripsi : profile.deskripsi_jasa}
        </p>
      </div>

      {/* ACTION BUTTONS */}
      <div className="mt-4 flex gap-2">
        <button 
          onClick={handleAction}
          disabled={isLoading}
          className={`flex-1 h-12 rounded-[20px] flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg ${
            isSambatan 
              ? "bg-red-500 hover:bg-red-600 text-white shadow-red-500/20" 
              : (profile.is_verified 
                  ? "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20" 
                  : "bg-slate-200 text-slate-400 cursor-not-allowed")
          }`}
        >
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : (
            <><Phone size={14} fill="currentColor" /> {isSambatan ? "Bantu Sekarang" : "Hubungi Jasa"}</>
          )}
        </button>
        
        <button className={`w-12 h-12 rounded-[20px] flex items-center justify-center border-2 ${
          isMalam ? "border-white/5 bg-white/5 text-white" : "border-slate-100 bg-white text-slate-600"
        }`}>
          <MessageCircle size={20} />
        </button>
      </div>
    </motion.div>
  );
}