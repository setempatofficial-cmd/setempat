"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, Sparkles, ChevronDown, Loader2, AlertCircle, 
  ShieldCheck, UserPlus, Banknote, Clock, Briefcase 
} from "lucide-react"; // Ganti DollarSign ke Banknote
import { supabase } from "@/lib/supabaseClient";

export default function DaftarRewangModal({ isOpen, onClose, profile, onSuccess, isMalam }) {
  // ... state tetap sama ...
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedProfesi, setSelectedProfesi] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [form, setForm] = useState({ deskripsi: "", biaya: "", jam: "" });

  const profesiOptions = [
    { value: "Tenaga Bangunan", kategori: "Teknis" },
    { value: "Teknisi Elektronik / AC", kategori: "Teknis" },
    { value: "Mekanik Kendaraan", kategori: "Teknis" },
    { value: "Layanan Kebersihan", kategori: "Jasa Rumah" },
    { value: "Masak / Katering", kategori: "Konsumsi" },
    { value: "Kurir / Ojek Lokal", kategori: "Logistik" },
    { value: "Kesehatan & Pijat", kategori: "Kesehatan" },
    { value: "Guru Les / Privat", kategori: "Pendidikan" },
    { value: "Admin / Desain / Digital", kategori: "Kreatif" },
    { value: "Lainnya / Serabutan", kategori: "Umum" },
  ];

  const handleDaftar = async () => {
    if (!profile?.id) return;
    setLoading(true);
    const kat = profesiOptions.find(o => o.value === selectedProfesi)?.kategori || "Lainnya";

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          is_rewang: true,
          profesi: selectedProfesi,
          kategori: kat,
          deskripsi_jasa: form.deskripsi,
          estimasi_biaya: form.biaya,
          jam_operasional: form.jam,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);

      if (error) throw error;
      setStep(2);
      if (onSuccess) onSuccess();
      setTimeout(() => { onClose(); setStep(1); }, 2000);
    } catch (err) {
      alert("Gagal: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-[480px] rounded-t-[32px] sm:rounded-[32px] overflow-hidden shadow-2xl ${
          isMalam ? "bg-[#0F0F0F] border border-white/10" : "bg-white"
        }`}
      >
        {/* Header Section */}
        <div className={`p-6 border-b ${isMalam ? "border-white/5" : "border-slate-100"}`}>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
                <Briefcase size={20} />
              </div>
              <div>
                <h3 className={`text-base font-black uppercase tracking-tight ${isMalam ? "text-white" : "text-slate-900"}`}>
                  Daftar <span className="text-orange-500">Rewang</span>
                </h3>
                <p className={`text-[10px] font-bold uppercase opacity-60 ${isMalam ? "text-slate-400" : "text-slate-500"}`}>
                  Bantu tetangga, cari barokah
                </p>
              </div>
            </div>
            <button onClick={onClose} className={`p-2 rounded-xl transition-colors ${isMalam ? "bg-white/5 text-white hover:bg-white/10" : "bg-slate-100 text-slate-900 hover:bg-slate-200"}`}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto no-scrollbar">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                
                {/* Alert Status Verifikasi */}
                <div className={`p-4 rounded-2xl border-2 flex items-start gap-3 ${
                  profile?.is_verified 
                    ? "bg-blue-500/5 border-blue-500/20 text-blue-500" 
                    : "bg-orange-500/5 border-orange-500/20 text-orange-600"
                }`}>
                  {profile?.is_verified ? <ShieldCheck size={18} className="mt-0.5" /> : <AlertCircle size={18} className="mt-0.5" />}
                  <div className="flex-1">
                    <p className="text-[11px] font-black uppercase tracking-wide">Status Identitas</p>
                    <p className={`text-[10px] font-bold leading-relaxed opacity-80 mt-0.5`}>
                      {profile?.is_verified 
                        ? "KTP Terverifikasi. Profil sampeyan bakal muncul tanda centang biru." 
                        : "Belum Verifikasi. Profil tetap tayang, tapi tanpa tanda centang."}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Field Keahlian */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-orange-500 ml-1">Kategori Keahlian</label>
                    <div className="relative">
                      <button 
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)} 
                        className={`w-full h-14 px-5 rounded-2xl border-2 flex items-center justify-between text-sm font-bold transition-all ${
                          isMalam 
                            ? "bg-white/5 border-white/5 text-white focus:border-orange-500/50" 
                            : "bg-slate-50 border-slate-100 text-slate-900 focus:border-orange-500/50"
                        }`}
                      >
                        <span className={selectedProfesi ? "opacity-100" : "opacity-40"}>
                          {selectedProfesi || "Pilih bidang keahlian..."}
                        </span>
                        <ChevronDown size={18} className={`transition-transform duration-300 ${isDropdownOpen ? "rotate-180" : ""}`} />
                      </button>
                      
                      {isDropdownOpen && (
                        <div className={`absolute z-50 left-0 right-0 mt-2 rounded-2xl border-2 shadow-2xl overflow-hidden ${
                          isMalam ? "bg-[#1A1A1A] border-white/10" : "bg-white border-slate-100"
                        }`}>
                          <div className="max-h-56 overflow-y-auto p-2 space-y-1">
                            {profesiOptions.map(o => (
                              <button 
                                key={o.value} 
                                onClick={() => { setSelectedProfesi(o.value); setIsDropdownOpen(false); }} 
                                className={`w-full text-left px-4 py-3 rounded-xl text-[11px] font-black uppercase transition-all ${
                                  isMalam ? "hover:bg-white/5 text-slate-300" : "hover:bg-orange-50 text-slate-600"
                                }`}
                              >
                                {o.value}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Field Deskripsi */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-orange-500 ml-1">Deskripsi Layanan</label>
                    <textarea 
                      placeholder="Contoh: Terima borongan cat, servis pompa air, atau pijat capek..." 
                      className={`w-full p-4 rounded-2xl border-2 text-xs font-bold outline-none h-28 transition-all ${
                        isMalam 
                          ? "bg-white/5 border-white/5 text-white focus:border-orange-500/50" 
                          : "bg-slate-50 border-slate-100 text-slate-900 focus:border-orange-500/50"
                      }`} 
                      value={form.deskripsi} 
                      onChange={(e) => setForm({...form, deskripsi: e.target.value})} 
                    />
                  </div>

                  {/* Ongkos & Jam */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-orange-500 ml-1">Estimasi Ongkos</label>
                      <div className="relative">
                        {/* GANTI KE BANKNOTE & TAMBAH Rp */}
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1">
                          <Banknote size={14} className="text-orange-500" />
                          <span className="text-[10px] font-black text-orange-500">Rp</span>
                        </div>
                        <input 
                          placeholder="50.000" 
                          className={`w-full h-12 pl-14 pr-4 rounded-2xl border-2 text-[13px] font-bold outline-none transition-all ${
    isMalam 
      ? "bg-[#1A1A1A] border-white/5 text-white focus:border-orange-500 focus:bg-black" 
      : "bg-slate-50 border-slate-100 text-slate-900 focus:border-orange-500 focus:bg-white"
  }`} 
                          value={form.biaya} 
                          onChange={(e) => setForm({...form, biaya: e.target.value})} 
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-orange-500 ml-1">Jam Kerja</label>
                      <div className="relative">
                        <Clock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-500" />
                        <input 
                          placeholder="08.00 - 17.00" 
                          className={`w-full h-12 pl-14 pr-4 rounded-2xl border-2 text-[13px] font-bold outline-none transition-all ${
    isMalam 
      ? "bg-[#1A1A1A] border-white/5 text-white focus:border-orange-500 focus:bg-black" 
      : "bg-slate-50 border-slate-100 text-slate-900 focus:border-orange-500 focus:bg-white"
  }`}
                          value={form.jam} 
                          onChange={(e) => setForm({...form, jam: e.target.value})} 
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handleDaftar} 
                  disabled={loading || !selectedProfesi} 
                  className="w-full h-14 bg-orange-500 text-white rounded-[20px] font-black text-xs uppercase tracking-tighter border-b-4 border-orange-700 active:border-b-0 active:translate-y-1 shadow-lg shadow-orange-500/30 transition-all flex items-center justify-center gap-3"
                >
                  {loading ? <Loader2 className="animate-spin" /> : <><UserPlus size={20} /> Aktifkan Profil Rewang</>}
                </button>
              </motion.div>
            ) : (
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="py-12 text-center space-y-6">
                <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/40">
                  <ShieldCheck size={48} className="text-white" />
                </div>
                <div className="space-y-2">
                  <h3 className={`text-xl font-black uppercase tracking-tight ${isMalam ? "text-white" : "text-slate-900"}`}>Berhasil Aktif!</h3>
                  <p className="text-[11px] font-bold opacity-60 uppercase tracking-widest">Wong Pasuruan Siap Rewang!</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}