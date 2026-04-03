"use client";
import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { CldUploadWidget } from "next-cloudinary";
import { supabase } from "@/lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";

// KATEGORI KHUSUS
const QUEUE_CATEGORIES = ['kuliner', 'transportasi', 'pasar'];
const TRAFFIC_CATEGORIES = ['jalan', 'jalan raya', 'simpang', 'tol', 'bypass', 'lingkar'];

export default function Uploader({
  tempatId,
  namaTempat,
  tempatKategori,
  onUploadSuccess,
  onRefreshNeeded,        // ← Prop untuk refresh Search Page
}) {
  const [status, setStatus] = useState("idle");
  const [tempMediaUrl, setTempMediaUrl] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [showSurvey, setShowSurvey] = useState(false);
  const [selectedCondition, setSelectedCondition] = useState(null);
  const [selectedWaitTime, setSelectedWaitTime] = useState(null);
  const [selectedTraffic, setSelectedTraffic] = useState(null);
  const [content, setContent] = useState("");
  const [mounted, setMounted] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({
    cloudinary: false,
    supabase: false,
  });

  // Cek kategori
  const kategoriLower = (tempatKategori || "").toLowerCase();
  const namaLower = (namaTempat || "").toLowerCase();

  const hasQueue = useMemo(() =>
    QUEUE_CATEGORIES.some(k => kategoriLower.includes(k)),
    [kategoriLower]
  );

  const hasTraffic = useMemo(() =>
    TRAFFIC_CATEGORIES.some(k => kategoriLower.includes(k) || namaLower.includes(k)),
    [kategoriLower, namaLower]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  const getCurrentTimeTag = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return "Pagi";
    if (hour >= 11 && hour < 15) return "Siang";
    if (hour >= 15 && hour < 18) return "Sore";
    return "Malam";
  };

  const getEstimatedPeople = (condition, timeTag) => {
    const defaults = {
      Sepi: { Pagi: 3, Siang: 5, Sore: 4, Malam: 2 },
      Ramai: { Pagi: 12, Siang: 25, Sore: 20, Malam: 15 },
      Antri: { Pagi: 8, Siang: 15, Sore: 12, Malam: 10 },
    };
    return defaults[condition]?.[timeTag] ||
           (condition === "Sepi" ? 4 : condition === "Ramai" ? 20 : 12);
  };

  const getConditionDescription = (condition, waitTime, traffic) => {
    if (condition === "Sepi") return `Suasana tenang di ${namaTempat || "sini"}.`;
    if (condition === "Ramai") return `Suasana ramai di ${namaTempat || "sini"}.`;
    if (condition === "Antri") {
      const waitText = waitTime === 5 ? "pendek (<5 menit)" :
                       waitTime === 15 ? "sedang (5-15 menit)" : "panjang (>15 menit)";
      return `Antrian ${waitText} di ${namaTempat || "sini"}.`;
    }
    if (traffic) {
      const trafficText = traffic === 'Lancar' ? 'lancar' :
                          traffic === 'Ramai' ? 'ramai' : 'macet';
      return `Lalu lintas ${trafficText} di ${namaTempat || "sini"}.`;
    }
    return `Update dari ${namaTempat || "sini"}.`;
  };

  const finalizeUpload = async () => {
    if (!selectedCondition && !selectedTraffic) return;
    if (selectedCondition === "Antri" && !selectedWaitTime) return;
    if (status === "uploading") return;

    const currentTimeTag = getCurrentTimeTag();
    const estimatedPeople = selectedCondition ? getEstimatedPeople(selectedCondition, currentTimeTag) : null;
    const estimatedWaitTime = selectedCondition === "Antri" ? selectedWaitTime : null;
    const trafficCondition = selectedTraffic || null;
    const mainType = selectedCondition || (selectedTraffic ? "Lalu Lintas" : null);
    const autoDesc = getConditionDescription(selectedCondition, selectedWaitTime, selectedTraffic);
    const finalDescription = content.trim() !== "" ? content.trim() : autoDesc;

    setShowSurvey(false);
    setUploadProgress({ cloudinary: true, supabase: false });
    setStatus("uploading");

    const timeoutId = window.setTimeout(() => {
      if (status === "uploading") {
        setStatus("idle");
        alert("Upload terlalu lama. Coba lagi.");
      }
    }, 20000);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Login diperlukan");

      setUploadProgress(prev => ({ ...prev, supabase: true }));

      const { data, error } = await supabase
        .from("laporan_warga")
        .insert([{
          tempat_id: parseInt(tempatId),
          user_id: session.user.id,
          user_name: session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Warga",
          user_avatar: session.user.user_metadata?.avatar_url || null,
          photo_url: mediaType === "video" ? tempMediaUrl.replace(/\.[^/.]+$/, ".jpg") : tempMediaUrl,
          video_url: mediaType === "video" ? tempMediaUrl : null,
          media_type: mediaType,
          time_tag: currentTimeTag,
          tipe: mainType,
          estimated_people: estimatedPeople,
          estimated_wait_time: estimatedWaitTime,
          traffic_condition: trafficCondition,
          deskripsi: finalDescription,
          content: content,
          status: "approved",
        }])
        .select();

      if (error) throw error;

      // Tunggu toast terlihat
      await new Promise(resolve => setTimeout(resolve, 1400));

      setStatus("success");
      onUploadSuccess?.(data[0]);

      // 🔥 Trigger refresh Search Page
      if (onRefreshNeeded) {
        setTimeout(() => {
          onRefreshNeeded();
        }, 800);
      }

      // Reset form
      setTimeout(() => {
        setStatus("idle");
        setTempMediaUrl(null);
        setContent("");
        setSelectedCondition(null);
        setSelectedWaitTime(null);
        setSelectedTraffic(null);
      }, 1800);

    } catch (err) {
      console.error("Upload Error:", err);
      alert("Gagal mengirim: " + err.message);
      setStatus("idle");
    } finally {
      clearTimeout(timeoutId);
    }
  };

  if (!mounted) return null;

  return (
    <>
      <CldUploadWidget
        cloudName={process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}
        uploadPreset="setempat_preset"
        onSuccess={(res) => {
          if (res?.event === "success") {
            setMediaType(res.info?.resource_type);
            setTempMediaUrl(res.info.secure_url);
            setShowSurvey(true);
          }
        }}
        options={{
          maxFiles: 1,
          resourceType: "auto",
          sources: ["camera", "local"],
          defaultSource: "camera",
          multiple: false,
          clientAllowedFormats: ["image", "video"],
          maxImageFileSize: 5000000,
          maxVideoFileSize: 20000000,
          transformations: [
            { quality: "auto", fetch_format: "auto", width: 1200, height: 1200, crop: "limit" }
          ],
          styles: {
            palette: {
              window: "#0a0a0a",
              windowBorder: "#22d3ee",
              tabIcon: "#22d3ee",
              action: "#22d3ee",
              sourceBg: "#111111",
            },
          },
        }}
      >
        {({ open }) => (
          <button
            onClick={() => open()}
            className="w-7 h-7 rounded-full flex items-center justify-center bg-black border border-white/20 shadow-[0_0_10px_rgba(34,211,238,0.15)] active:scale-90 transition-all relative overflow-hidden"
          >
            {status === "uploading" ? (
              <div className="w-3 h-3 border-[1.5px] border-cyan-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 1v10M1 6h10" stroke="#22d3ee" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            )}
          </button>
        )}
      </CldUploadWidget>

      {/* Toast Uploading */}
      <AnimatePresence>
        {status === "uploading" && createPortal(
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[1000002] bg-zinc-900 border border-cyan-500/30 text-white px-5 py-3 rounded-2xl shadow-2xl flex flex-col gap-2 min-w-[260px]"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin shrink-0" />
              <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">
                {uploadProgress.supabase ? "Menyimpan ke database..." : "Sedang Mengirim..."}
              </span>
            </div>
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                animate={{ width: uploadProgress.supabase ? "95%" : "65%" }}
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
              />
            </div>
          </motion.div>,
          document.body
        )}
      </AnimatePresence>

      {/* Toast Success */}
      <AnimatePresence>
        {status === "success" && createPortal(
          <motion.div
            initial={{ y: 50, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 50, opacity: 0, scale: 0.9 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[1000002] bg-emerald-950 border border-emerald-500/40 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5"
          >
            <span className="text-lg">✅</span>
            <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400">
              Berhasil Dikirim!
            </span>
          </motion.div>,
          document.body
        )}
      </AnimatePresence>

      {/* Modal Survey */}
      {showSurvey && createPortal(
        <AnimatePresence>
          <div className="fixed inset-0 z-[1000000] flex justify-center items-end sm:items-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setShowSurvey(false)}
            />
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 180 }}
              className="relative z-[1000001] bg-white w-full max-w-[420px] rounded-[28px] shadow-2xl overflow-hidden"
            >
              <div className="h-1.5 bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 w-full" />

              <div className="p-5">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Kirim Laporan</h3>
                    <p className="text-[10px] font-bold text-cyan-600 uppercase tracking-widest mt-0.5">
                      {namaTempat} · {getCurrentTimeTag()}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowSurvey(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 text-lg transition-colors"
                  >
                    ✕
                  </button>
                </div>

                {/* Preview + Textarea */}
                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 mb-4 flex gap-3">
                  <div className="w-14 h-18 rounded-xl overflow-hidden bg-slate-200 flex-shrink-0 aspect-[3/4]">
                    {mediaType === "image" ? (
                      <img src={tempMediaUrl} className="w-full h-full object-cover" alt="preview" />
                    ) : (
                      <video src={tempMediaUrl} className="w-full h-full object-cover" muted autoPlay loop playsInline />
                    )}
                  </div>
                  <textarea
                    placeholder="Ceritakan kondisinya, Lur... (contoh: hujan gerimis, ramai pengunjung, macet panjang, dll)"
                    className="w-full bg-transparent border-none p-1 text-[13px] font-medium focus:ring-0 outline-none resize-none text-slate-700 placeholder:text-slate-300"
                    rows={3}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                </div>

                {/* Kondisi Tempat, Antri, Lalu Lintas, Tombol Kirim */}
                {/* (Bagian ini sama persis dengan kode asli kamu) */}
                {/* Silakan copy-paste seluruh isi modal survey dari kode kamu yang paling lengkap */}

                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">📍 Kondisi Tempat</p>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { emoji: "🍃", label: "Sepi", val: "Sepi", active: "bg-emerald-500 border-emerald-500 text-white shadow-emerald-100" },
                    { emoji: "🏃", label: "Ramai", val: "Ramai", active: "bg-yellow-400 border-yellow-400 text-white shadow-yellow-100" },
                  ].map((btn) => (
                    <button
                      key={btn.val}
                      onClick={() => { setSelectedCondition(btn.val); setSelectedWaitTime(null); }}
                      className={`py-3 rounded-xl text-[11px] font-black border-2 transition-all flex flex-col items-center gap-1
                        ${selectedCondition === btn.val ? btn.active + " scale-[1.04] shadow-lg" : "bg-white text-slate-400 border-slate-100 hover:border-slate-200"}`}
                    >
                      <span className="text-lg">{btn.emoji}</span>
                      <span className="uppercase tracking-wider">{btn.label}</span>
                    </button>
                  ))}

                  {hasQueue && (
                    <button
                      onClick={() => { setSelectedCondition("Antri"); setSelectedWaitTime(null); }}
                      className={`py-3 rounded-xl text-[11px] font-black border-2 transition-all flex flex-col items-center gap-1
                        ${selectedCondition === "Antri" ? "bg-rose-500 border-rose-500 text-white shadow-rose-100 scale-[1.04] shadow-lg" : "bg-white text-slate-400 border-slate-100 hover:border-slate-200"}`}
                    >
                      <span className="text-lg">⏳</span>
                      <span className="uppercase tracking-wider">Antri</span>
                    </button>
                  )}
                </div>

                {/* Waktu Antri */}
                {selectedCondition === "Antri" && (
                  <div className="mb-5">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">
                      ⏱️ Estimasi waktu antri
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 5, label: "< 5 menit", desc: "Pendek", icon: "⚡" },
                        { value: 15, label: "5-15 menit", desc: "Sedang", icon: "⏱️" },
                        { value: 20, label: "> 15 menit", desc: "Panjang", icon: "🐢" },
                      ].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setSelectedWaitTime(option.value)}
                          className={`py-2 px-1 rounded-xl text-[10px] font-bold border-2 transition-all text-center
                            ${selectedWaitTime === option.value
                              ? "bg-cyan-500 border-cyan-500 text-white"
                              : "bg-white text-slate-500 border-slate-200 hover:border-cyan-300"
                            }`}
                        >
                          <div className="text-base">{option.icon}</div>
                          <div>{option.label}</div>
                          <div className="text-[8px] opacity-80">{option.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lalu Lintas */}
                {hasTraffic && (
                  <>
                    <div className="flex items-center gap-2 mt-2 mb-2">
                      <div className="h-px flex-1 bg-slate-200" />
                      <span className="text-[8px] font-black text-slate-300 uppercase tracking-wider">atau</span>
                      <div className="h-px flex-1 bg-slate-200" />
                    </div>
                    
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">
                      🚦 Kondisi Lalu Lintas
                    </p>
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {[
                        { emoji: "🛵", label: "Lancar", val: "Lancar", color: "bg-emerald-500", desc: "Jalanan lengang" },
                        { emoji: "🚗", label: "Ramai", val: "Ramai", color: "bg-yellow-500", desc: "Kendaraan mulai padat" },
                        { emoji: "🚦", label: "Macet", val: "Macet", color: "bg-rose-500", desc: "Antrean panjang" },
                      ].map((opt) => (
                        <button
                          key={opt.val}
                          onClick={() => {
                            setSelectedTraffic(opt.val);
                            if (selectedTraffic !== opt.val) {
                              setSelectedCondition(null);
                              setSelectedWaitTime(null);
                            }
                          }}
                          className={`py-2.5 rounded-xl text-[10px] font-bold border-2 transition-all flex flex-col items-center gap-0.5
                            ${selectedTraffic === opt.val
                              ? opt.color + " text-white border-transparent shadow-md scale-[1.02]"
                              : "bg-white text-slate-500 border-slate-200"
                            }`}
                        >
                          <span className="text-base">{opt.emoji}</span>
                          <span className="uppercase tracking-wide">{opt.label}</span>
                          <span className="text-[8px] opacity-80">{opt.desc}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {(hasQueue || hasTraffic) && (
                  <p className="text-[8px] text-center text-slate-400 mb-3">
                    💡 Pilih kondisi tempat ATAU lalu lintas (sesuai yang kamu lihat)
                  </p>
                )}

                {/* Tombol kirim */}
                <button
                  onClick={finalizeUpload}
                  disabled={
                    (!selectedCondition && !selectedTraffic) || 
                    (selectedCondition === "Antri" && !selectedWaitTime) || 
                    status === "uploading"
                  }
                  className={`w-full py-4 rounded-2xl font-black uppercase text-[12px] tracking-widest transition-all
                    ${(!selectedCondition && !selectedTraffic) || (selectedCondition === "Antri" && !selectedWaitTime)
                      ? "bg-slate-100 text-slate-300 cursor-not-allowed"
                      : "bg-gradient-to-r from-cyan-500 to-blue-600 text-white active:scale-[0.98] shadow-lg shadow-cyan-500/20"
                    }`}
                >
                  {status === "uploading" ? "Mengirim..." : "Posting Sekarang"}
                </button>
                
                {selectedCondition === "Antri" && !selectedWaitTime && (
                  <p className="text-[9px] text-amber-600 text-center mt-2">
                    *Pilih estimasi waktu antri untuk melanjutkan
                  </p>
                )}
                {!selectedCondition && !selectedTraffic && (
                  <p className="text-[9px] text-slate-400 text-center mt-2">
                    *Pilih kondisi tempat atau lalu lintas
                  </p>
                )}
              </div>
            </motion.div>
          </div>
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}