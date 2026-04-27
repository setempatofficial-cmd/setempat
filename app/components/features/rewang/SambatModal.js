'use client';
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import { 
  X, AlertCircle, MapPin, Send, Loader2, Info, Package, Users, CheckCircle 
} from "lucide-react";

export default function SambatModal({ isOpen, onClose, user, profile, onSuccess, theme }) {
  const isMalam = theme?.isMalam;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    kategori: "Butuh Bantuan",
    judul: "",
    deskripsi: "",
    lokasi_detail: "",
  });

  const categories = [
    { id: "Butuh Bantuan", icon: <AlertCircle size={14} />, label: "Butuh Bantuan" },
    { id: "Pinjam Alat", icon: <Package size={14} />, label: "Pinjam Alat" },
    { id: "Konsumsi", icon: <Users size={14} />, label: "Konsumsi" },
    { id: "Lainnya", icon: <Info size={14} />, label: "Lainnya" },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    
    if (!user) {
      setError("Login dulu, Lur!");
      return;
    }
    
    if (!formData.judul.trim()) {
      setError("Judul harus diisi!");
      return;
    }
    
    if (!formData.deskripsi.trim()) {
      setError("Deskripsi harus diisi!");
      return;
    }
    
    if (!formData.lokasi_detail.trim()) {
      setError("Lokasi detail harus diisi!");
      return;
    }
    
    setLoading(true);
    
    try {
      const namaPengirim = profile?.full_name || 
                          user.user_metadata?.full_name || 
                          user.email?.split('@')[0] || 
                          "Warga";
      
      const avatarPengirim = profile?.avatar_url || 
                            user.user_metadata?.avatar_url || 
                            null;
      
      const sambatanData = {
        user_id: user.id,
        judul: formData.judul.trim(),
        deskripsi: formData.deskripsi.trim(),
        kategori: formData.kategori,
        lokasi_detail: formData.lokasi_detail.trim(),
        nama_pengirim: namaPengirim,
        avatar_pengirim: avatarPengirim,
        status: 'aktif'
      };
      
      console.log("Mengirim data ke Supabase:", sambatanData);
      
      const { data, error: insertError } = await supabase
        .from("sambatan")
        .insert([sambatanData])
        .select();
      
      if (insertError) {
        console.error("Supabase error detail:", insertError);
        throw insertError;
      }
      
      console.log("✅ Data berhasil disimpan:", data);
      
      setSuccess(true);
      
      setFormData({
        kategori: "Butuh Bantuan",
        judul: "",
        deskripsi: "",
        lokasi_detail: "",
      });
      
      if (onSuccess) {
        onSuccess();
      }
      
      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 1500);
      
    } catch (err) {
      console.error("❌ Error lengkap:", err);
      
      if (err.message?.includes("permission denied")) {
        setError("Tidak ada izin untuk menambah data. Pastikan Anda sudah login.");
      } else if (err.message?.includes("row-level security")) {
        setError("Error RLS: Pastikan Anda sudah login dengan benar.");
      } else {
        setError(err.message || "Gagal mengirim sambatan. Coba lagi.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal - Ukuran disamakan dengan modal lain (max-w-[420px]) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className={`relative w-full max-w-[420px] rounded-[28px] overflow-hidden shadow-2xl border transition-colors duration-300 ${
              isMalam ? "bg-[#0A0A0A] border-white/10" : "bg-white border-slate-100"
            }`}
          >
            {/* Handle Bar (opsional, seperti modal lain) */}
            <div className={`w-12 h-1 bg-slate-200 rounded-full mx-auto mt-3 ${isMalam ? "bg-white/10" : ""}`} />

            {/* Header */}
            <div className={`px-6 pt-4 pb-3 flex justify-between items-center ${isMalam ? "border-white/5" : "border-slate-50"}`}>
              <div>
                <h2 className={`text-base font-black uppercase tracking-tight ${isMalam ? "text-white" : "text-slate-900"}`}>
                  Sambat <span className="text-red-500">Warga</span>
                </h2>
                <p className={`text-[9px] font-medium ${isMalam ? "text-slate-500" : "text-slate-400"}`}>
                  Jelaskan bantuan yang sampeyan butuhkan
                </p>
              </div>
              <button 
                onClick={onClose} 
                className={`p-2 rounded-xl transition-all active:scale-95 ${
                  isMalam ? "bg-white/5 text-white hover:bg-white/10" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 pb-6">
              {/* Success Message */}
              {success && (
                <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2">
                  <CheckCircle size={16} className="text-emerald-500" />
                  <p className="text-[10px] font-bold text-emerald-500">
                    Sambatan berhasil disebarkan ke warga sekitar!
                  </p>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <p className="text-[10px] font-bold text-red-500">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Kategori Selector */}
                <div className="grid grid-cols-2 gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, kategori: cat.id })}
                      className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all border ${
                        formData.kategori === cat.id
                          ? "bg-red-500 border-red-400 text-white shadow-lg shadow-red-500/20"
                          : isMalam 
                            ? "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10" 
                            : "bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100"
                      }`}
                    >
                      {cat.icon} {cat.label}
                    </button>
                  ))}
                </div>

                {/* Input Judul */}
                <input
                  required
                  placeholder="Butuh apa? (Misal: Pinjam Tangga Bambu)"
                  className={`w-full h-11 px-4 rounded-xl text-[11px] font-bold outline-none border transition-all ${
                    isMalam 
                      ? "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-red-500/50" 
                      : "bg-slate-50 border-slate-100 text-slate-900 placeholder:text-slate-400 focus:border-red-500/30"
                  }`}
                  value={formData.judul}
                  onChange={(e) => setFormData({ ...formData, judul: e.target.value })}
                />

                {/* Input Deskripsi */}
                <textarea
                  required
                  placeholder="Detail bantuan (Kapan & untuk apa?)"
                  rows={3}
                  className={`w-full p-3 rounded-xl text-[11px] font-bold outline-none border transition-all resize-none ${
                    isMalam 
                      ? "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-red-500/50" 
                      : "bg-slate-50 border-slate-100 text-slate-900 placeholder:text-slate-400 focus:border-red-500/30"
                  }`}
                  value={formData.deskripsi}
                  onChange={(e) => setFormData({ ...formData, deskripsi: e.target.value })}
                />

                {/* Lokasi Detail */}
                <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  isMalam 
                    ? "bg-white/5 border-white/10 focus-within:border-red-500/50" 
                    : "bg-slate-50 border-slate-100 focus-within:border-red-500/30"
                }`}>
                  <MapPin size={14} className="text-red-500 flex-shrink-0" />
                  <input
                    required
                    placeholder="Patokan lokasi (Misal: Depan Balai Desa)"
                    className="flex-1 bg-transparent text-[11px] font-bold outline-none placeholder:text-slate-400"
                    style={{ color: isMalam ? "white" : "#0F172A" }}
                    value={formData.lokasi_detail}
                    onChange={(e) => setFormData({ ...formData, lokasi_detail: e.target.value })}
                  />
                </div>

                {/* Action Button */}
                <button
                  type="submit"
                  disabled={loading || success}
                  className="w-full h-12 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white rounded-xl flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-wider shadow-lg shadow-red-600/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Mengirim...
                    </>
                  ) : success ? (
                    <>
                      <CheckCircle size={16} />
                      Terkirim!
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      Sebarkan Sambatan
                    </>
                  )}
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}