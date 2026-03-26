"use client";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";

export default function FormLaporanAktif({ isOpen, onClose, villageLocation, theme, user }) {
  const [step, setStep] = useState(1); 
  const [loading, setLoading] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [deskripsi, setDeskripsi] = useState("");
  const fileInputRef = useRef(null);

  const handleCapture = (e) => {
    const file = e.target.files[0];
    if (file) setPhoto(URL.createObjectURL(file));
  };

  const kirimLaporan = async () => {
    if (!photo || !deskripsi) return;
    setLoading(true);
    setStep(2);

    try {
      // --- LOGIKA CLOUDINARY ---
      const file = fileInputRef.current.files[0];
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", "ml_default"); // SESUAIKAN PRESET ANDA

      const resCloud = await fetch(
        `https://api.cloudinary.com/v1_1/NAMA_CLOUD/image/upload`, // SESUAIKAN CLOUD NAME
        { method: "POST", body: formData }
      );
      const cloudData = await resCloud.json();

      // --- SINKRONISASI 5W+1H KE SUPABASE ---
      const { error } = await supabase
        .from('laporan_warga')
        .insert([{
          user_id: user?.id,            // WHO
          foto_url: cloudData.secure_url,
          deskripsi: deskripsi,         // WHAT, WHY, HOW
          lokasi: villageLocation,      // WHERE
          created_at: new Date(),       // WHEN
          status: 'pending',
          is_story: true
        }]);

      if (error) throw error;
      setStep(3);
    } catch (err) {
      console.error(err);
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[3000] flex items-end sm:items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
      />

      <motion.div
        initial={{ y: "100%", scale: 0.9 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: "100%", scale: 0.9 }}
        className={`relative w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl border ${
          theme.isMalam ? "bg-zinc-900 border-white/10" : "bg-white border-slate-200"
        }`}
      >
        <div className="p-6 pb-2 flex justify-between items-center border-b border-white/5">
          <div>
            <h2 className={`text-xl font-black ${theme.text}`}>INFO <span className="text-[#E3655B]">WARGA</span></h2>
            <p className="text-[10px] font-bold opacity-50 uppercase tracking-[0.2em]">Format 5W+1H Active</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5">✕</button>
        </div>

        <div className="p-6 space-y-5">
          {step === 1 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
              
              {/* WHERE (Otomatis) */}
              <div className={`px-4 py-2 rounded-full border text-[10px] font-bold w-fit ${theme.isMalam ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                📍 LOKASI: <span className="text-[#E3655B]">{villageLocation}</span>
              </div>

              {/* FOTO AREA */}
              <div 
                onClick={() => fileInputRef.current.click()}
                className={`group relative aspect-[4/3] rounded-[2rem] border-2 border-dashed flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all ${
                  photo ? 'border-none' : theme.isMalam ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50"
                }`}
              >
                {photo ? (
                  <img src={photo} className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-2xl bg-[#E3655B]/20 flex items-center justify-center mx-auto mb-2 text-xl">📸</div>
                    <p className="text-[10px] font-black uppercase tracking-widest">Ambil Bukti Foto</p>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCapture} />
              </div>

              {/* WHAT + WHY + HOW (Guided Textarea) */}
              <div className="space-y-2">
                <div className="flex justify-between items-center px-2">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Detail Kejadian</label>
                  <span className="text-[9px] font-bold text-[#E3655B] animate-pulse">GUIDE: WHAT, WHY, HOW</span>
                </div>
                <textarea 
                  value={deskripsi}
                  onChange={(e) => setDeskripsi(e.target.value)}
                  placeholder="Apa yang terjadi? Kenapa membahayakan? Bagaimana kondisinya saat ini?"
                  className={`w-full p-5 rounded-[1.8rem] border-none focus:ring-2 focus:ring-[#E3655B] text-sm font-medium ${
                    theme.isMalam ? "bg-white/5 text-white placeholder:text-white/20" : "bg-slate-100 text-slate-800"
                  }`}
                  rows={4}
                />
              </div>

              <button 
                disabled={!photo || !deskripsi || loading}
                onClick={kirimLaporan}
                className="w-full py-4 rounded-[1.5rem] bg-[#E3655B] text-white font-black tracking-[0.2em] text-[10px] shadow-xl shadow-[#E3655B]/20 active:scale-95 transition-all"
              >
                {loading ? "MENYINKRONKAN..." : "PUBLIKASIKAN LAPORAN"}
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <div className="py-12 text-center space-y-4">
               <div className="w-16 h-16 border-4 border-[#E3655B] border-t-transparent rounded-full animate-spin mx-auto" />
               <p className="text-xs font-black animate-pulse">AI SEDANG MENYUSUN NARASI 5W+1H...</p>
            </div>
          )}

          {step === 3 && (
            <div className="py-10 text-center space-y-6">
              <div className="w-20 h-20 bg-emerald-500 rounded-full mx-auto flex items-center justify-center text-white text-3xl shadow-lg shadow-emerald-500/30">✓</div>
              <h3 className={`text-xl font-black ${theme.text}`}>LAPORAN TERVERIFIKASI</h3>
              <button onClick={onClose} className="px-10 py-3 rounded-full bg-[#E3655B] text-white text-[10px] font-black uppercase tracking-widest">KEMBALI KE FEED</button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}