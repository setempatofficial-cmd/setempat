"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { CldUploadWidget } from "next-cloudinary";
import { supabase } from "@/lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";

export default function Uploader({ tempatId, namaTempat, onUploadSuccess }) {
  const [status, setStatus] = useState("idle");
  const [tempMediaUrl, setTempMediaUrl] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [showSurvey, setShowSurvey] = useState(false);
  const [selectedCondition, setSelectedCondition] = useState(null);
  const [content, setContent] = useState("");
  const [mounted, setMounted] = useState(false);

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

  const finalizeUpload = async () => {
    if (!selectedCondition || status === "uploading") return;

    const currentTimeTag = getCurrentTimeTag();
    const autoDesc = `Kondisi ${selectedCondition.toLowerCase()} di ${namaTempat || "sini"}.`;
    const finalDescription = content.trim() !== "" ? content.trim() : autoDesc;

    const capturedContent = content;
    const capturedCondition = selectedCondition;
    const capturedMedia = tempMediaUrl;
    const capturedType = mediaType;

    setShowSurvey(false);
    setStatus("uploading");

    const timeoutId = window.setTimeout(() => {
      if (status === "uploading") {
        console.warn("Upload terlalu lama, timeout dipicu");
        setStatus("idle");
        alert("Upload sedang lambat. Coba lagi dalam beberapa saat.");
      }
    }, 20000); // 20 detik timeout otomatis

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Login diperlukan");

      const user = session.user;

      const { data, error } = await supabase.from("laporan_warga").insert([{
        tempat_id: parseInt(tempatId),
        user_id: user.id,
        user_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Warga",
        user_avatar: user.user_metadata?.avatar_url || null,
        photo_url: capturedType === "video"
          ? capturedMedia.replace(/\.[^/.]+$/, ".jpg")
          : capturedMedia,
        video_url: capturedType === "video" ? capturedMedia : null,
        media_type: capturedType,
        time_tag: currentTimeTag,
        tipe: capturedCondition,
        deskripsi: finalDescription,
        content: capturedContent,
        status: "approved",
      }]).select();

      if (error) throw error;

      setStatus("success");
      onUploadSuccess?.(data[0]);

      setTimeout(() => {
        setStatus("idle");
        setTempMediaUrl(null);
        setContent("");
        setSelectedCondition(null);
      }, 3000);

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
          resourceType: "image",        // hanya foto
          sources: ["local", "camera"], // hanya galeri + kamera
          styles: {
            palette: {
              window: "#0a0a0a",
              windowBorder: "#22d3ee",
              tabIcon: "#22d3ee",
              menuIcons: "#ffffff",
              textDark: "#ffffff",
              textLight: "#0a0a0a",
              link: "#22d3ee",
              action: "#22d3ee",
              inactiveTabIcon: "#444444",
              error: "#f44235",
              inProgress: "#22d3ee",
              complete: "#22d3ee",
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
              // Plus icon SVG — lebih presisi dari teks "+"
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 1v10M1 6h10" stroke="#22d3ee" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            )}
          </button>
        )}
      </CldUploadWidget>

      {/* ── TOAST UPLOADING ── */}
      <AnimatePresence>
        {status === "uploading" && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[1000002] bg-zinc-900 border border-cyan-500/30 text-white px-5 py-3 rounded-2xl shadow-2xl flex flex-col gap-2 min-w-[200px]"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin shrink-0" />
              <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">
                Sedang Mengirim...
              </span>
            </div>
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: "95%" }}
                transition={{ duration: 8 }}
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TOAST SUCCESS ── */}
      <AnimatePresence>
        {status === "success" && (
          <motion.div
            initial={{ y: 50, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 50, opacity: 0, scale: 0.9 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[1000002] bg-emerald-950 border border-emerald-500/40 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 min-w-[200px]"
          >
            <span className="text-lg">✅</span>
            <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400">
              Berhasil Dikirim!
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MODAL SURVEY ── */}
      {showSurvey && createPortal(
        <AnimatePresence>
          <div className="fixed inset-0 z-[1000000] flex justify-center items-end sm:items-center p-4">

            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setShowSurvey(false)}
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 180 }}
              className="relative z-[1000001] bg-white w-full max-w-[420px] rounded-[28px] shadow-2xl overflow-hidden"
            >
              {/* Strip warna atas */}
              <div className="h-1.5 bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 w-full" />

              <div className="p-5">

                {/* Header */}
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">
                      Kirim Laporan
                    </h3>
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

                {/* Preview foto + textarea */}
                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 mb-4 flex gap-3">
                  <div className="w-14 h-18 rounded-xl overflow-hidden bg-slate-200 flex-shrink-0 aspect-[3/4]">
                    {mediaType === "image" ? (
                      <img src={tempMediaUrl} className="w-full h-full object-cover" alt="preview" />
                    ) : (
                      <video src={tempMediaUrl} className="w-full h-full object-cover" muted autoPlay loop />
                    )}
                  </div>
                  <textarea
                    placeholder="Ceritakan kondisinya, Lur..."
                    className="w-full bg-transparent border-none p-1 text-[13px] font-medium focus:ring-0 outline-none resize-none text-slate-700 placeholder:text-slate-300"
                    rows={3}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                </div>

                {/* Pilihan kondisi */}
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">
                  Kondisi sekarang
                </p>
                <div className="grid grid-cols-3 gap-2 mb-5">
                  {[
                    { emoji: "🍃", label: "Sepi", val: "Tenang", active: "bg-emerald-500 border-emerald-500 text-white shadow-emerald-100" },
                    { emoji: "🏃", label: "Ramai", val: "Ramai", active: "bg-yellow-400 border-yellow-400 text-white shadow-yellow-100" },
                    { emoji: "⏳", label: "Antri", val: "Antri", active: "bg-rose-500 border-rose-500 text-white shadow-rose-100" },
                  ].map((btn) => (
                    <button
                      key={btn.val}
                      onClick={() => setSelectedCondition(btn.val)}
                      className={`py-3 rounded-xl text-[11px] font-black border-2 transition-all flex flex-col items-center gap-1
                        ${selectedCondition === btn.val
                          ? btn.active + " scale-[1.04] shadow-lg"
                          : "bg-white text-slate-400 border-slate-100 hover:border-slate-200"
                        }`}
                    >
                      <span className="text-lg">{btn.emoji}</span>
                      <span className="uppercase tracking-wider">{btn.label}</span>
                    </button>
                  ))}
                </div>

                {/* Tombol kirim */}
                <button
                  onClick={finalizeUpload}
                  disabled={!selectedCondition || status === "uploading"}
                  className={`w-full py-4 rounded-2xl font-black uppercase text-[12px] tracking-widest transition-all
                    ${!selectedCondition
                      ? "bg-slate-100 text-slate-300 cursor-not-allowed"
                      : "bg-gradient-to-r from-cyan-500 to-blue-600 text-white active:scale-[0.98] shadow-lg shadow-cyan-500/20"
                    }`}
                >
                  {status === "uploading" ? "Mengirim..." : "Posting Sekarang"}
                </button>

              </div>
            </motion.div>
          </div>
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
