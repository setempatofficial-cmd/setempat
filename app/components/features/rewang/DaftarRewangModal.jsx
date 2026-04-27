'use client';
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, ChevronDown, Loader2, AlertCircle, 
  ShieldCheck, UserPlus, Banknote, Clock, Briefcase, Send, User
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export default function DaftarRewangModal({ isOpen, onClose, profile, onSuccess, isMalam }) {
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

  const ADMIN_PHONE = "6281234567890";

  const handleDaftar = async () => {
    if (!selectedProfesi) {
      alert("Pilih keahlian dulu, Cak!");
      return;
    }
    
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
          ktp_status: 'menunggu_verifikasi',
          ktp_submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);

      if (error) throw error;

      const { error: insertError } = await supabase
        .from("pendaftar_rewang")
        .insert({
          user_id: profile.id,
          profesi: selectedProfesi,
          deskripsi: form.deskripsi,
          biaya: form.biaya,
          jam: form.jam,
          status: "menunggu_verifikasi"
        });

      if (insertError) throw insertError;

      const message = `*🛠️ PENDAFTARAN REWANG BARU* 🛠️\n\n` +
        `*Nama:* ${profile.full_name}\n` +
        `*Username:* @${profile.username || profile.email?.split('@')[0]}\n` +
        `*Email:* ${profile.email}\n` +
        `*WhatsApp:* ${profile.phone || profile.whatsapp || '-'}\n\n` +
        `*📋 Detail Rewang:*\n` +
        `▸ Profesi: ${selectedProfesi}\n` +
        `▸ Kategori: ${kat}\n` +
        `▸ Deskripsi: ${form.deskripsi || '-'}\n` +
        `▸ Estimasi Biaya: Rp ${form.biaya || '-'}\n` +
        `▸ Jam Kerja: ${form.jam || '-'}\n\n` +
        `*🔐 Verifikasi:*\n` +
        `Silakan minta foto KTP via chat untuk verifikasi.\n\n` +
        `_Dikirim dari aplikasi Setempat.id_`;

      const encodedMessage = encodeURIComponent(message);
      window.open(`https://wa.me/${ADMIN_PHONE}?text=${encodedMessage}`, '_blank');
      
      setStep(2);
      if (onSuccess) onSuccess();
      
      setTimeout(() => { 
        onClose(); 
        setStep(1);
        setSelectedProfesi("");
        setForm({ deskripsi: "", biaya: "", jam: "" });
      }, 2500);
      
    } catch (err) {
      alert("❌ Gagal: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-[420px] rounded-[28px] overflow-hidden shadow-2xl ${
          isMalam ? "bg-[#0F0F0F] border border-white/10" : "bg-white"
        }`}
      >
        {/* Handle Bar */}
        <div className={`w-12 h-1 bg-slate-200 rounded-full mx-auto mt-3 ${isMalam ? "bg-white/10" : ""}`} />

        {/* Header Section */}
        <div className={`px-6 pt-4 pb-3 ${isMalam ? "border-white/5" : "border-slate-100"}`}>
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
            <button 
              onClick={onClose} 
              className={`p-2 rounded-xl transition-all active:scale-95 ${
                isMalam ? "bg-white/5 text-white hover:bg-white/10" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-5 max-h-[80vh] overflow-y-auto">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div 
                key="form" 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                className="space-y-5"
              >
                {/* Info Verifikasi via WA */}
                <div className={`p-3 rounded-xl flex items-start gap-2 bg-emerald-500/5 border border-emerald-500/20`}>
                  <ShieldCheck size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[9px] font-bold text-emerald-600">Verifikasi via WhatsApp</p>
                    <p className="text-[8px] text-emerald-600/80 mt-0.5">
                      Foto KTP akan dikirim via WhatsApp ke Admin.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* 🆕 FIELD NAMA LENGKAP */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-orange-500 ml-1">
                      Nama Lengkap
                    </label>
                    <div className="relative">
                      <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-400" />
                      <input 
                        type="text" 
                        value={profile?.full_name || profile?.user_metadata?.full_name || 'Warga'}
                        disabled
                        className={`w-full pl-9 pr-3 py-2.5 rounded-xl text-sm font-medium outline-none border cursor-not-allowed ${
                          isMalam 
                            ? "bg-white/5 border-white/10 text-white/60" 
                            : "bg-slate-100 border-slate-200 text-slate-500"
                        }`}
                      />
                    </div>
                    <p className="text-[7px] text-slate-400 ml-1">*Terisi otomatis dari profil</p>
                  </div>

                  {/* Field Keahlian */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-orange-500 ml-1">
                      Kategori Keahlian
                    </label>
                    <div className="relative">
                      <button 
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)} 
                        className={`w-full h-11 px-4 rounded-xl text-sm font-medium transition-all flex items-center justify-between border ${
                          isMalam 
                            ? "bg-white/5 border-white/10 text-white" 
                            : "bg-slate-50 border-slate-100 text-slate-900"
                        }`}
                      >
                        <span className={selectedProfesi ? "opacity-100" : "opacity-40"}>
                          {selectedProfesi || "Pilih bidang keahlian..."}
                        </span>
                        <ChevronDown size={16} className={`transition-transform duration-300 ${isDropdownOpen ? "rotate-180" : ""}`} />
                      </button>
                      
                      {isDropdownOpen && (
                        <div className={`absolute z-50 left-0 right-0 mt-2 rounded-xl border shadow-lg overflow-hidden ${
                          isMalam ? "bg-[#1A1A1A] border-white/10" : "bg-white border-slate-100"
                        }`}>
                          <div className="max-h-56 overflow-y-auto p-1">
                            {profesiOptions.map(o => (
                              <button 
                                key={o.value} 
                                onClick={() => { 
                                  setSelectedProfesi(o.value); 
                                  setIsDropdownOpen(false); 
                                }} 
                                className={`w-full text-left px-4 py-2.5 rounded-lg text-[11px] font-medium transition-all ${
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
                    <label className="text-[10px] font-black uppercase tracking-wider text-orange-500 ml-1">
                      Deskripsi Layanan
                    </label>
                    <textarea 
                      placeholder="Contoh: Terima borongan cat, servis pompa air..." 
                      className={`w-full p-3 rounded-xl text-xs font-medium outline-none h-24 transition-all border ${
                        isMalam 
                          ? "bg-white/5 border-white/10 text-white placeholder:text-white/30" 
                          : "bg-slate-50 border-slate-100 text-slate-900 placeholder:text-slate-400"
                      }`} 
                      value={form.deskripsi} 
                      onChange={(e) => setForm({...form, deskripsi: e.target.value})} 
                    />
                  </div>

                  {/* Ongkos & Jam */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-orange-500 ml-1">
                        Estimasi Ongkos
                      </label>
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2">
                          <span className="text-[10px] font-black text-orange-500">Rp</span>
                        </div>
                        <input 
                          placeholder="50.000" 
                          className={`w-full pl-8 pr-3 py-2.5 rounded-xl text-[13px] font-bold outline-none transition-all border ${
                            isMalam 
                              ? "bg-white/5 border-white/10 text-white placeholder:text-white/30" 
                              : "bg-slate-50 border-slate-100 text-slate-900 placeholder:text-slate-400"
                          }`} 
                          value={form.biaya} 
                          onChange={(e) => setForm({...form, biaya: e.target.value})} 
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-orange-500 ml-1">
                        Jam Kerja
                      </label>
                      <div className="relative">
                        <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-400" />
                        <input 
                          placeholder="08.00 - 17.00" 
                          className={`w-full pl-8 pr-3 py-2.5 rounded-xl text-[13px] font-bold outline-none transition-all border ${
                            isMalam 
                              ? "bg-white/5 border-white/10 text-white placeholder:text-white/30" 
                              : "bg-slate-50 border-slate-100 text-slate-900 placeholder:text-slate-400"
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
                  className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-[10px] uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-emerald-50"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <><Send size={14} /> Kirim & Daftar</>}
                </button>
              </motion.div>
            ) : (
              <motion.div 
                key="success"
                initial={{ scale: 0.9, opacity: 0 }} 
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="py-12 text-center space-y-4"
              >
                <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-lg">
                  <ShieldCheck size={40} className="text-white" />
                </div>
                <div>
                  <h3 className={`text-lg font-black uppercase tracking-tight ${isMalam ? "text-white" : "text-slate-900"}`}>
                    Pendaftaran Terkirim!
                  </h3>
                  <p className="text-[10px] font-medium mt-1 opacity-60">
                    Silakan kirim foto KTP via WhatsApp
                  </p>
                  <p className={`text-[8px] mt-3 ${isMalam ? "text-slate-400" : "text-slate-500"}`}>
                    Petinggi Setempat akan memverifikasi dan mengaktifkan akun Rewang Anda
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}