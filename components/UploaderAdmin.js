"use client";
import { useState } from "react";
import { createPortal } from "react-dom";
import { CldUploadWidget } from "next-cloudinary";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Check, Loader2, X, AlertCircle, Link as LinkIcon } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export default function UploaderAdmin({ 
  tempatId, 
  timeLabel, 
  onRefreshNeeded 
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [tempUrl, setTempUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [mediaType, setMediaType] = useState("image");
  const [caption, setCaption] = useState("");
  const [toast, setToast] = useState({ show: false, message: "", isError: false });
  const [mounted, setMounted] = useState(false);

  useState(() => {
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

  const isValidUrl = (url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSaveToDatabase = async (url, type = "image") => {
    if (!tempatId) {
      showToast("ID tempat tidak valid", true);
      return false;
    }

    setIsUploading(true);
    const timeTag = getCurrentTimeTag();
    const numericTempatId = Number(tempatId);

    try {
      const { data: currentData } = await supabase
        .from("tempat")
        .select("photos")
        .eq("id", numericTempatId)
        .single();

      const currentPhotos = currentData?.photos || {};
      
      const mediaData = {
        url: url,
        type: type,
        caption: caption.trim() || `Suasana ${timeLabel} • ${timeTag}`,
        updated_at: new Date().toISOString()
      };

      const updatedPhotos = {
        ...currentPhotos,
        [timeTag]: mediaData,
        official: url,
        official_type: type
      };

      const { error } = await supabase
        .from("tempat")
        .update({ photos: updatedPhotos, image_url: url })
        .eq("id", numericTempatId);

      if (error) throw error;

      showToast(`Wajah ${timeLabel} berhasil diperbarui!`);
      setShowModal(false);
      setTempUrl("");
      setVideoUrl("");
      setCaption("");
      
      if (onRefreshNeeded) onRefreshNeeded();
      return true;

    } catch (err) {
      console.error("Save error:", err);
      showToast(err.message || "Gagal menyimpan", true);
      return false;
    } finally {
      setIsUploading(false);
    }
  };

  const handleExternalVideo = () => {
    if (!videoUrl.trim()) {
      showToast("Masukkan URL video terlebih dahulu", true);
      return;
    }
    if (!isValidUrl(videoUrl)) {
      showToast("URL tidak valid", true);
      return;
    }
    setTempUrl(videoUrl);
    setMediaType("external");
    setShowModal(true);
  };

  const handleUploadSuccess = (result) => {
    setTempUrl(result.info.secure_url);
    setMediaType("image");
    setShowModal(true);
  };

  const resetModal = () => {
    setShowModal(false);
    setTempUrl("");
    setVideoUrl("");
    setCaption("");
  };

  // 🔥 MODAL LEBIH KECIL - TIDAK MENUTUPI SELURUH SLIDER
  const modalContent = showModal && tempUrl && (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="w-[85%] max-w-sm mx-auto bg-zinc-900 rounded-xl overflow-hidden border border-white/20 shadow-2xl"
      >
        {/* Handle drag (opsional, untuk swipe down) */}
        <div className="flex justify-center pt-2">
          <div className="w-12 h-1 bg-white/20 rounded-full" />
        </div>

        <div className="p-4">
          {/* Preview Media - Lebih kecil */}
          <div className="aspect-video w-full rounded-lg overflow-hidden bg-zinc-800 mb-3">
            {mediaType === "image" ? (
              <img src={tempUrl} className="w-full h-full object-cover" alt="preview" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                <span className="text-3xl">🎬</span>
                <p className="text-white/50 text-xs text-center">Video Eksternal</p>
                <a 
                  href={tempUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-cyan-400 text-[10px] underline break-all text-center px-2"
                >
                  {tempUrl.length > 50 ? tempUrl.substring(0, 50) + "..." : tempUrl}
                </a>
              </div>
            )}
          </div>

          {/* Input Caption */}
          <textarea
            placeholder="Tulis caption (opsional)..."
            className="w-full bg-white/10 border border-white/20 rounded-lg p-3 text-white text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none mb-3"
            rows={2}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />

          {/* Info waktu */}
          <p className="text-white/40 text-[10px] text-center mb-3">
            Akan disimpan untuk <span className="text-cyan-400 font-semibold">{timeLabel}</span>
          </p>

          {/* Tombol Simpan */}
          <button
            onClick={() => handleSaveToDatabase(tempUrl, mediaType)}
            disabled={isUploading}
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 disabled:from-zinc-700 disabled:to-zinc-700 text-white font-bold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 text-sm"
          >
            {isUploading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <Check size={16} />
                Simpan
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );

  return (
    <div className="relative">
      {/* TOAST */}
      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100000] px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 bg-zinc-900 border border-white/10"
          >
            {toast.isError ? (
              <AlertCircle size={14} className="text-red-400" />
            ) : (
              <Check size={14} className="text-emerald-400" />
            )}
            <span className="text-[10px] font-bold text-white">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOMBOL UPLOAD */}
      <div className="flex flex-col gap-2">
        <CldUploadWidget
          uploadPreset="setempat_preset"
          onSuccess={handleUploadSuccess}
          onError={() => showToast("Gagal upload gambar", true)}
          options={{
            maxFiles: 1,
            resourceType: "image",
            sources: ["camera", "local"],
            defaultSource: "camera",
            clientAllowedFormats: ["jpg", "png", "webp", "jpeg"],
            maxImageFileSize: 5000000,
            transformations: [
              { quality: "auto:good", fetch_format: "auto", width: 800, height: 800, crop: "limit" }
            ],
          }}
        >
          {({ open }) => (
            <button
              onClick={() => open()}
              disabled={isUploading}
              className="w-full px-5 py-2.5 bg-white/90 hover:bg-white text-zinc-800 font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg disabled:opacity-50"
            >
              {isUploading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Camera size={16} />
              )}
              {isUploading ? "Menyimpan..." : `📷 Upload Foto ${timeLabel}`}
            </button>
          )}
        </CldUploadWidget>

        <div className="flex gap-2">
          <input
            type="text"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="Atau masukkan URL video (YouTube, TikTok, dll)"
            className="flex-1 px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            disabled={isUploading}
          />
          <button
            onClick={handleExternalVideo}
            disabled={isUploading || !videoUrl.trim()}
            className="px-4 py-2.5 bg-cyan-500/80 hover:bg-cyan-500 disabled:bg-zinc-700 text-white font-bold rounded-xl transition-all flex items-center gap-2 text-sm"
          >
            <LinkIcon size={16} />
            Pakai
          </button>
        </div>
      </div>

      {/* 🔥 MODAL - KECIL, TIDAK MENUTUPI SLIDER */}
      {mounted && createPortal(
        <AnimatePresence>
          {modalContent}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}