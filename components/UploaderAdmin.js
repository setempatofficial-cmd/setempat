"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { CldUploadWidget } from "next-cloudinary";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Check, Loader2, X, AlertCircle, Link as LinkIcon, Send } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export default function UploaderAdmin({ tempatId, timeLabel, onRefreshNeeded }) {
  const [isUploading, setIsUploading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [tempUrl, setTempUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [mediaType, setMediaType] = useState("image");
  const [caption, setCaption] = useState("");
  const [toast, setToast] = useState({ show: false, message: "", isError: false });
  const [mounted, setMounted] = useState(false);

  // Gunakan useEffect untuk mount client-side
  useEffect(() => {
    setMounted(true);
  }, []);

  const showToast = (message, isError = false) => {
    setToast({ show: true, message, isError });
    setTimeout(() => setToast({ show: false, message: "", isError: false }), 3000);
  };

  const getCurrentTimeTag = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return "pagi";
    if (hour >= 11 && hour < 15) return "siang";
    if (hour >= 15 && hour < 18) return "sore";
    return "malam";
  };

  const handleSaveToDatabase = async (url, type = "image") => {
    if (!tempatId) return showToast("ID tempat tidak valid", true);
    
    setIsUploading(true);
    const timeTag = getCurrentTimeTag();

    try {
      const { data: currentData } = await supabase
        .from("tempat")
        .select("photos")
        .eq("id", Number(tempatId))
        .single();

      const mediaData = {
        url,
        type,
        caption: caption.trim() || `Suasana ${timeLabel}`,
        updated_at: new Date().toISOString()
      };

      const updatedPhotos = {
        ...(currentData?.photos || {}),
        [timeTag]: mediaData,
        official: url,
        official_type: type
      };

      const { error } = await supabase
        .from("tempat")
        .update({ photos: updatedPhotos, image_url: url })
        .eq("id", Number(tempatId));

      if (error) throw error;

      showToast(`Berhasil memperbarui ${timeLabel}!`);
      resetModal();
      if (onRefreshNeeded) onRefreshNeeded();
    } catch (err) {
      showToast(err.message || "Gagal menyimpan", true);
    } finally {
      setIsUploading(false);
    }
  };

  const resetModal = () => {
    setShowModal(false);
    setTempUrl("");
    setVideoUrl("");
    setCaption("");
  };

  if (!mounted) return null;

  return (
    <div className="w-full max-w-md mx-auto space-y-3">
      {/* Tombol Utama */}
      <div className="grid grid-cols-5 gap-2">
        {/* Tombol Link - Sekarang di kiri */}
        <div className="col-span-2 relative">
          <input
            type="text"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="URL Video..."
            className="w-full h-full pl-4 pr-10 bg-zinc-900/50 border border-white/10 rounded-2xl text-xs text-white focus:ring-1 focus:ring-white/30 outline-none"
          />
          <button 
            onClick={() => {
                if(videoUrl.includes('http')) {
                    setTempUrl(videoUrl);
                    setMediaType("external");
                    setShowModal(true);
                } else {
                    showToast("URL tidak valid", true);
                }
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-zinc-800 rounded-lg text-zinc-400 hover:text-white"
          >
            <LinkIcon size={14} />
          </button>
        </div>

        {/* Tombol Foto - Sekarang di kanan */}
        <CldUploadWidget
          uploadPreset="setempat_preset"
          onSuccess={(res) => {
            setTempUrl(res.info.secure_url);
            setMediaType("image");
            setShowModal(true);
          }}
          options={{ 
            maxFiles: 1, 
            clientAllowedFormats: ["jpg", "webp", "jpeg"],
            maxImageFileSize: 3000000
          }}
        >
          {({ open }) => (
            <button
              onClick={() => open()}
              className="col-span-3 flex items-center justify-center gap-2 bg-white text-zinc-950 font-bold py-3 rounded-2xl shadow-sm active:scale-95 transition-all"
            >
              <Camera size={18} />
              <span className="text-sm">Foto {timeLabel}</span>
            </button>
          )}
        </CldUploadWidget>
      </div>

      {/* Portal Modal */}
      {createPortal(
        <AnimatePresence>
          {showModal && (
            <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                className="w-full max-w-sm bg-zinc-950 border border-white/10 rounded-t-[2rem] sm:rounded-[2rem] overflow-hidden"
              >
                <div className="p-6">
                  {/* Header */}
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-white font-medium">Konfirmasi Upload</h3>
                    <button onClick={resetModal} className="p-2 bg-zinc-900 rounded-full text-zinc-400"><X size={18}/></button>
                  </div>

                  {/* Preview */}
                  <div className="aspect-video w-full bg-zinc-900 rounded-2xl mb-4 overflow-hidden border border-white/5">
                    {mediaType === "image" ? (
                      <img src={tempUrl} className="w-full h-full object-cover" alt="Preview" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500">
                        <LinkIcon size={32} className="mb-2 opacity-20" />
                        <span className="text-[10px] px-4 text-center truncate w-full">{tempUrl}</span>
                      </div>
                    )}
                  </div>

                  <textarea
                    placeholder="Tambah caption..."
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/5 rounded-xl p-3 text-sm text-white focus:outline-none mb-4 resize-none"
                    rows={2}
                  />

                  <button
                    onClick={() => handleSaveToDatabase(tempUrl, mediaType)}
                    disabled={isUploading}
                    className="w-full bg-white text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isUploading ? <Loader2 className="animate-spin" size={18}/> : <Send size={18}/>}
                    Simpan Perubahan
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Toast Notification */}
      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[10000] px-4 py-2 rounded-full flex items-center gap-2 border shadow-xl ${
              toast.isError ? "bg-red-950 border-red-500/50 text-red-200" : "bg-zinc-900 border-white/10 text-white"
            }`}
          >
            {toast.isError ? <AlertCircle size={14}/> : <Check size={14} className="text-green-400"/>}
            <span className="text-xs font-medium">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}