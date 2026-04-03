"use client";
import { useState } from "react";
import { CldUploadWidget } from "next-cloudinary";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Check, Loader2, X, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export default function UploaderAdmin({ 
  tempatId, 
  timeLabel, 
  onRefreshNeeded 
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [tempUrl, setTempUrl] = useState("");
  const [toast, setToast] = useState({ show: false, message: "", isError: false });
  const [isReady, setIsReady] = useState(false);

  // Validasi tempatId
  useState(() => {
    if (tempatId && tempatId !== undefined && tempatId !== null) {
      const numericId = Number(tempatId);
      if (!isNaN(numericId) && numericId > 0) {
        setIsReady(true);
      }
    }
  }, [tempatId]);

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

  // 🔥 OPTIMASI: Fetch dan update dalam satu fungsi
  const handleSaveToDatabase = async (url) => {
    if (!isReady || !tempatId) {
      showToast("ID tempat tidak valid", true);
      return false;
    }

    const numericTempatId = Number(tempatId);
    setIsUploading(true);
    const timeTag = getCurrentTimeTag();

    try {
      // 1. Ambil data photos saat ini (tetap diperlukan)
      const { data: currentData, error: fetchError } = await supabase
        .from("tempat")
        .select("photos")
        .eq("id", numericTempatId)
        .single();

      if (fetchError) {
        console.error("Fetch error:", fetchError);
        // Jika error karena data tidak ada, tetap lanjut dengan photos kosong
        if (fetchError.code !== "PGRST116") {
          throw new Error(`Gagal mengambil data: ${fetchError.message}`);
        }
      }

      // 2. Update JSONB photos
      const currentPhotos = currentData?.photos || {};
      const updatedPhotos = {
        ...currentPhotos,
        [timeTag]: {
          url: url,
          caption: `Update official ${timeTag}`,
          updated_at: new Date().toISOString(),
        },
        official: url,
      };

      // 3. Simpan ke database
      const { error: updateError } = await supabase
        .from("tempat")
        .update({ 
          photos: updatedPhotos,
          image_url: url 
        })
        .eq("id", numericTempatId);

      if (updateError) {
        console.error("Update error:", updateError);
        throw new Error(`Gagal menyimpan: ${updateError.message}`);
      }

      showToast(`Wajah ${timeLabel} berhasil diperbarui!`);
      setShowModal(false);
      setTempUrl("");
      
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

  const handleUploadSuccess = (result) => {
    setTempUrl(result.info.secure_url);
    setShowModal(true);
  };

  if (!isReady) {
    return (
      <button
        disabled
        className="px-5 py-2.5 bg-zinc-700 text-white/50 cursor-not-allowed rounded-xl flex items-center justify-center gap-2 text-sm"
      >
        <Loader2 size={16} className="animate-spin" />
        Memuat...
      </button>
    );
  }

  return (
    <div className="relative">
      {/* TOAST */}
      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[100000] px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 ${
              toast.isError 
                ? "bg-red-950 border border-red-500/40" 
                : "bg-emerald-950 border border-emerald-500/40"
            }`}
          >
            {toast.isError ? (
              <AlertCircle size={14} className="text-red-400" />
            ) : (
              <Check size={14} className="text-emerald-400" />
            )}
            <span className="text-[10px] font-bold text-white">
              {toast.message}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOMBOL UPLOAD */}
      <CldUploadWidget
        uploadPreset="setempat_test"
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
            className="px-5 py-2.5 bg-white/90 hover:bg-white text-zinc-800 font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg"
          >
            {isUploading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <Camera size={16} />
                Update Wajah {timeLabel}
              </>
            )}
          </button>
        )}
      </CldUploadWidget>

      {/* MODAL PREVIEW */}
      <AnimatePresence>
        {showModal && tempUrl && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm bg-zinc-900 rounded-2xl overflow-hidden border border-white/10"
            >
              <div className="p-4 border-b border-white/10 flex justify-between">
                <h3 className="text-white font-bold text-sm">Preview</h3>
                <button onClick={() => setShowModal(false)} className="text-white/50 hover:text-white">
                  <X size={18} />
                </button>
              </div>
              <div className="p-4">
                <img src={tempUrl} className="w-full rounded-xl mb-4" alt="preview" />
                <button
                  onClick={() => handleSaveToDatabase(tempUrl)}
                  disabled={isUploading}
                  className="w-full bg-cyan-500 hover:bg-cyan-600 disabled:bg-zinc-700 text-white font-bold py-2.5 rounded-xl text-sm"
                >
                  {isUploading ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}