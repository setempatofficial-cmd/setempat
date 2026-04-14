"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Briefcase, MapPin, CheckCircle, AlertCircle, UserPlus, FileText, Clock, DollarSign, Sparkles, ChevronDown } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useTheme } from "@/app/hooks/useTheme";

export default function DaftarRewangModal({ isOpen, onClose, profile, onSuccess }) {
  const { isMalam } = useTheme();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedProfesi, setSelectedProfesi] = useState("");
  const [customProfesi, setCustomProfesi] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [pelengkap, setPelengkap] = useState({
    deskripsi: "",
    estimasi_biaya: "",      // ← konsisten pakai estimasi_biaya
    jam_operasional: "",
  });

  const profesiOptions = [
    { value: "Tukang Batu", kategori: "Bangunan" },
    { value: "Tukang Las", kategori: "Bangunan" },
    { value: "Tukang Cat", kategori: "Bangunan" },
    { value: "Tukang Ledeng", kategori: "Bangunan" },
    { value: "Tukang Atap", kategori: "Bangunan" },
    { value: "Servis AC", kategori: "Elektronik" },
    { value: "Servis TV", kategori: "Elektronik" },
    { value: "Servis Kulkas", kategori: "Elektronik" },
    { value: "Servis HP", kategori: "Elektronik" },
    { value: "Servis Mesin Cuci", kategori: "Elektronik" },
    { value: "Masak", kategori: "Rumah Tangga" },
    { value: "Jahit", kategori: "Rumah Tangga" },
    { value: "Cuci Setrika", kategori: "Rumah Tangga" },
    { value: "Bersih Rumah", kategori: "Rumah Tangga" },
    { value: "Pijat/Urut", kategori: "Kesehatan" },
    { value: "Perawat Lansia", kategori: "Kesehatan" },
    { value: "Bekam", kategori: "Kesehatan" },
    { value: "Antar Barang", kategori: "Jasa Antar" },
    { value: "Belanja Pasar", kategori: "Jasa Antar" },
    { value: "Ojek Desa", kategori: "Jasa Antar" },
    { value: "Lainnya", kategori: "Lainnya", isCustom: true },
  ];

  if (!isOpen) return null;

  const handleDaftar = async () => {
    // Validasi profile
    if (!profile?.id) {
      alert("⚠️ Data profil tidak ditemukan. Silakan login ulang.");
      return;
    }

    // Validasi profesi
    let finalProfesi = selectedProfesi;
    let finalKategori = "Lainnya";
    
    if (selectedProfesi === "Lainnya") {
      if (!customProfesi.trim()) {
        alert("⚠️ Silakan tulis keahlian Anda.");
        return;
      }
      finalProfesi = customProfesi;
    } else if (!selectedProfesi) {
      alert("⚠️ Anda harus memilih profesi/keahlian terlebih dahulu.");
      return;
    } else {
      const selectedOption = profesiOptions.find(opt => opt.value === selectedProfesi);
      finalKategori = selectedOption?.kategori || "Lainnya";
    }

    setLoading(true);
    try {
      // 🔥 PERBAIKAN: Deklarasi error dengan benar
      const updateData = {
        profesi: finalProfesi,
        kategori: finalKategori,
        is_rewang: true,
        deskripsi_jasa: pelengkap.deskripsi || null,
        estimasi_biaya: pelengkap.estimasi_biaya || null,
        jam_operasional: pelengkap.jam_operasional || null,
        updated_at: new Date().toISOString(),
      };

      // Log untuk debugging
      console.log("Updating profile:", profile.id, updateData);

      const { data, error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", profile.id)
        .select(); // Optional: return updated data

      if (error) {
        console.error("Supabase error:", error);
        throw new Error(error.message);
      }

      console.log("Update success:", data);
      
      // Pindah ke step sukses
      setStep(2);
      
      // Reset form setelah sukses (setelah animation)
      setTimeout(() => {
        // Panggil callback onSuccess sebelum close
        if (onSuccess) onSuccess();
        
        // Reset semua state
        setStep(1);
        setSelectedProfesi("");
        setCustomProfesi("");
        setPelengkap({ deskripsi: "", estimasi_biaya: "", jam_operasional: "" });
        setIsDropdownOpen(false);
        
        // Tutup modal setelah reset
        onClose();
      }, 2000);

    } catch (error) {
      console.error("Gagal Daftar Rewang:", error);
      alert(`❌ Gagal mendaftar: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        className={`relative w-full max-w-[480px] rounded-t-[40px] sm:rounded-[40px] shadow-2xl overflow-hidden max-h-[95vh] flex flex-col
          ${isMalam ? "bg-[#050505] text-white border-t border-white/10" : "bg-white text-slate-900"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle Mobile */}
        <div className="w-12 h-1 bg-slate-500/20 rounded-full mx-auto mt-4 mb-2 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-500">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="text-sm font-[1000] uppercase tracking-[0.2em]">Daftar <span className="text-orange-500">Rewang</span></h3>
              <p className="text-[10px] opacity-40 font-bold uppercase tracking-widest">Lengkapi Profil Jasa Anda</p>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 rounded-2xl ${isMalam ? "bg-white/5" : "bg-slate-100"}`}>
            <X size="18" />
          </button>
        </div>

        <div className="overflow-y-auto no-scrollbar p-6 pt-2">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                
                {/* Data Diri (Read-only) */}
                <div className={`p-5 rounded-[30px] border ${isMalam ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-100"}`}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-orange-500 mb-4">Data Diri</p>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Briefcase size="16" className="text-orange-500/50" />
                      <p className="text-xs font-bold">Nama: <span className="opacity-60">{profile?.full_name || "—"}</span></p>
                    </div>
                    <div className="flex items-center gap-3">
                      <MapPin size="16" className="text-blue-500/50" />
                      <p className="text-xs font-bold">Lokasi: <span className="opacity-60">{profile?.desa || "—"}, {profile?.kabupaten || "—"}</span></p>
                    </div>
                  </div>
                </div>

                {/* Pilih Profesi */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-orange-500 px-1">
                    Pilih Profesi <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl border transition-all
                        ${isMalam ? "bg-white/5 border-white/10 hover:bg-white/10" : "bg-white border-slate-200 hover:border-orange-500"}`}
                    >
                      <span className={selectedProfesi ? "text-sm" : "text-sm opacity-40"}>
                        {selectedProfesi === "Lainnya" ? "Lainnya (isi sendiri)" : (selectedProfesi || "Pilih keahlian Anda...")}
                      </span>
                      <ChevronDown size="16" className={`transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
                    </button>
                    
                    {isDropdownOpen && (
                      <div className={`absolute z-10 left-0 right-0 mt-2 rounded-2xl border shadow-lg max-h-64 overflow-y-auto
                        ${isMalam ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}>
                        {profesiOptions.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              setSelectedProfesi(opt.value);
                              setIsDropdownOpen(false);
                              if (opt.value !== "Lainnya") {
                                setCustomProfesi("");
                              }
                            }}
                            className={`w-full text-left px-5 py-3 text-sm hover:bg-orange-500/10 transition-colors
                              ${selectedProfesi === opt.value ? "bg-orange-500/20 text-orange-500" : ""}`}
                          >
                            <span className="font-medium">{opt.value}</span>
                            {opt.value !== "Lainnya" && (
                              <span className={`text-[10px] ml-2 ${isMalam ? "text-white/40" : "text-slate-400"}`}>
                                {opt.kategori}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {selectedProfesi === "Lainnya" && (
                    <div className="mt-3 space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-orange-500 px-1">
                        Tulis Keahlian Anda <span className="text-red-500">*</span>
                      </label>
                      <div className={`relative rounded-2xl border transition-all ${isMalam ? "bg-white/5 border-white/5" : "bg-white border-slate-200"}`}>
                        <Briefcase size="16" className="absolute left-4 top-3.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Contoh: Peternak Lele, Pembuat Kerajinan, Ternak Ayam"
                          value={customProfesi}
                          onChange={(e) => setCustomProfesi(e.target.value)}
                          className="w-full pl-12 pr-4 py-3 bg-transparent outline-none text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Informasi Layanan (Opsional) */}
                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-orange-500 px-1">Informasi Layanan (Opsional)</p>
                  
                  <div className="group space-y-2">
                    <label className="text-[10px] font-bold uppercase opacity-40 ml-1">Deskripsi Jasa</label>
                    <div className={`relative rounded-2xl border transition-all ${isMalam ? "bg-white/5 border-white/5" : "bg-white border-slate-200"}`}>
                      <FileText size={16} className="absolute left-4 top-4 text-slate-400" />
                      <textarea
                        placeholder="Contoh: Menerima borongan bangun rumah, cat, dan pasang plafon..."
                        value={pelengkap.deskripsi}
                        onChange={(e) => setPelengkap({ ...pelengkap, deskripsi: e.target.value })}
                        rows={3}
                        className="w-full pl-12 pr-4 py-4 bg-transparent outline-none text-sm resize-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="group space-y-2">
                      <label className="text-[10px] font-bold uppercase opacity-40 ml-1">Estimasi Biaya</label>
                      <div className={`relative flex items-center h-14 rounded-2xl border ${isMalam ? "bg-white/5 border-white/5" : "bg-white border-slate-200"}`}>
                        <DollarSign size={16} className="ml-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Mulai Rp..."
                          value={pelengkap.estimasi_biaya}
                          onChange={(e) => setPelengkap({ ...pelengkap, estimasi_biaya: e.target.value })}
                          className="flex-1 px-3 bg-transparent outline-none text-sm"
                        />
                      </div>
                    </div>

                    <div className="group space-y-2">
                      <label className="text-[10px] font-bold uppercase opacity-40 ml-1">Jam Operasional</label>
                      <div className={`relative flex items-center h-14 rounded-2xl border ${isMalam ? "bg-white/5 border-white/5" : "bg-white border-slate-200"}`}>
                        <Clock size={16} className="ml-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Senin - Sabtu, 08.00 - 17.00"
                          value={pelengkap.jam_operasional}
                          onChange={(e) => setPelengkap({ ...pelengkap, jam_operasional: e.target.value })}
                          className="flex-1 px-3 bg-transparent outline-none text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info Footer */}
                <div className={`p-4 rounded-2xl flex items-start gap-3 border ${isMalam ? "bg-orange-500/5 border-orange-500/20" : "bg-orange-50 border-orange-100"}`}>
                  <AlertCircle size={16} className="text-orange-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] leading-relaxed text-orange-600 font-bold uppercase italic">
                    Data akan muncul di pencarian warga. Pastikan informasi yang Anda masukkan akurat.
                  </p>
                </div>

                {/* Tombol Aksi */}
                <div className="flex gap-3 pt-2 pb-6">
                  <button onClick={onClose} className={`flex-1 h-14 rounded-2xl font-black text-[10px] uppercase tracking-widest border transition-all ${isMalam ? "border-white/10 hover:bg-white/5" : "border-slate-200 hover:bg-slate-50"}`}>
                    Batal
                  </button>
                  <button
                    onClick={handleDaftar}
                    disabled={loading || (!selectedProfesi || (selectedProfesi === "Lainnya" && !customProfesi.trim()))}
                    className="flex-1 h-14 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-orange-500/30 flex items-center justify-center gap-2 border-b-4 border-orange-600 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><UserPlus size={16} /> Daftar Sekarang</>}
                  </button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-12 text-center flex flex-col items-center"
              >
                <div className="w-24 h-24 rounded-[35px] bg-emerald-500 shadow-2xl shadow-emerald-500/40 flex items-center justify-center mb-6">
                  <CheckCircle size={48} className="text-white" />
                </div>
                <h3 className="text-xl font-[1000] uppercase tracking-tighter mb-2">
                  Berhasil Mendaftar!
                </h3>
                <p className="text-[11px] font-bold opacity-40 uppercase leading-relaxed max-w-[240px]">
                  Terima kasih sudah bergabung Sebagai Rewang - Warga Bantu Warga
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}