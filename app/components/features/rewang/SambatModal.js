"use client";
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
    
    // Validasi user harus login (karena RLS membutuhkan auth.uid())
    if (!user) {
      setError("Login dulu, Lur!");
      return;
    }
    
    // Validasi form
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
      // Ambil data nama dari profile atau user metadata
      const namaPengirim = profile?.full_name || 
                          user.user_metadata?.full_name || 
                          user.email?.split('@')[0] || 
                          "Warga";
      
      const avatarPengirim = profile?.avatar_url || 
                            user.user_metadata?.avatar_url || 
                            null;
      
      // Data yang akan diinsert - SESUAI DENGAN SCHEMA
      const sambatanData = {
        user_id: user.id,           // Wajib: foreign key ke auth.users
        judul: formData.judul.trim(),
        deskripsi: formData.deskripsi.trim(),
        kategori: formData.kategori,
        lokasi_detail: formData.lokasi_detail.trim(),
        nama_pengirim: namaPengirim,
        avatar_pengirim: avatarPengirim,
        status: 'aktif'              // Default status aktif
        // created_at akan diisi otomatis oleh database
      };
      
      console.log("Mengirim data ke Supabase:", sambatanData);
      
      // INSERT ke tabel sambatan
      // RLS policy "Authenticated users can insert sambatan" akan mengizinkan ini
      const { data, error: insertError } = await supabase
        .from("sambatan")
        .insert([sambatanData])
        .select(); // .select() untuk mengambil data yang baru diinsert
      
      if (insertError) {
        console.error("Supabase error detail:", insertError);
        throw insertError;
      }
      
      console.log("✅ Data berhasil disimpan:", data);
      
      setSuccess(true);
      
      // Reset form
      setFormData({
        kategori: "Butuh Bantuan",
        judul: "",
        deskripsi: "",
        lokasi_detail: "",
      });
      
      // Panggil callback onSuccess untuk refresh data
      if (onSuccess) {
        onSuccess();
      }
      
      // Tutup modal setelah 1.5 detik
      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 1500);
      
    } catch (err) {
      console.error("❌ Error lengkap:", err);
      
      // Handle error berdasarkan tipe
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
        <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className={`relative w-full max-w-[450px] rounded-t-[32px] sm:rounded-[32px] overflow-hidden border transition-colors duration-300 ${
              isMalam ? "bg-[#0A0A0A] border-white/10" : "bg-white border-slate-100"
            }`}
          >
            {/* Header */}
            <div className={`p-5 border-b flex justify-between items-center ${isMalam ? "border-white/5" : "border-slate-50"}`}>
              <div>
                <h2 className={`text-base font-black uppercase tracking-tight ${isMalam ? "text-white" : "text-slate-900"}`}>
                  Sambat <span className="text-red-500">Warga</span>
                </h2>
                <p className={`text-[9px] font-bold ${isMalam ? "text-slate-500" : "text-slate-400"}`}>
                  Jelaskan bantuan yang sampeyan butuhkan
                </p>
              </div>
              <button 
                onClick={onClose} 
                className={`p-2 rounded-xl ${isMalam ? "bg-white/5 text-white" : "bg-slate-100 text-slate-500"}`}
              >
                <X size={18} />
              </button>
            </div>

            {/* Success Message */}
            {success && (
              <div className="mx-5 mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-2">
                <CheckCircle size={16} className="text-green-500" />
                <p className="text-[10px] font-bold text-green-500">
                  Sambatan berhasil disebarkan ke warga sekitar!
                </p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mx-5 mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-[10px] font-bold text-red-500">
                  {error}
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Kategori Selector */}
              <div className="grid grid-cols-2 gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, kategori: cat.id })}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-[9px] font-black transition-all border ${
                      formData.kategori === cat.id
                        ? "bg-red-500 text-white border-red-400 shadow-lg shadow-red-500/20"
                        : isMalam 
                          ? "bg-white/5 border-white/5 text-slate-500" 
                          : "bg-slate-50 border-slate-100 text-slate-500"
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
                    ? "bg-white/5 border-white/10 text-white focus:border-red-500/50" 
                    : "bg-slate-50 border-slate-100 text-slate-900 focus:border-red-500/30"
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
                    ? "bg-white/5 border-white/10 text-white focus:border-red-500/50" 
                    : "bg-slate-50 border-slate-100 text-slate-900 focus:border-red-500/30"
                }`}
                value={formData.deskripsi}
                onChange={(e) => setFormData({ ...formData, deskripsi: e.target.value })}
              />

              {/* Lokasi Detail */}
              <div className={`flex items-center gap-3 p-3 rounded-xl border ${
                isMalam ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-100"
              }`}>
                <MapPin size={14} className="text-red-500 flex-shrink-0" />
                <input
                  required
                  placeholder="Patokan lokasi (Misal: Depan Balai Desa)"
                  className="flex-1 bg-transparent text-[11px] font-bold outline-none placeholder:opacity-50"
                  style={{ color: isMalam ? "white" : "#0F172A" }}
                  value={formData.lokasi_detail}
                  onChange={(e) => setFormData({ ...formData, lokasi_detail: e.target.value })}
                />
              </div>

              {/* Action Button */}
              <button
                type="submit"
                disabled={loading || success}
                className="w-full h-12 bg-red-600 hover:bg-red-700 text-white rounded-xl flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-wider shadow-lg shadow-red-600/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
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
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}