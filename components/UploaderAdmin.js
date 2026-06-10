// components/UploaderAdmin.jsx
"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { CldUploadWidget } from "next-cloudinary";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Check, Loader2, X, AlertCircle, Link as LinkIcon, Send, Building2, History } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export default function UploaderAdmin({ tempatId, timeLabel, onRefreshNeeded, onSuccess }) {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [tempUrl, setTempUrl] = useState("");
  const [mediaType, setMediaType] = useState("image");
  const [caption, setCaption] = useState("");
  const [kategori, setKategori] = useState("official"); // 'official' atau 'sejarah'
  const [tahun, setTahun] = useState("");
  const [toast, setToast] = useState({ show: false, message: "", isError: false });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const showToast = (message, isError = false) => {
    setToast({ show: true, message, isError });
    setTimeout(() => setToast({ show: false, message: "", isError: false }), 3000);
  };

  const handleSaveToDatabase = async (url, type = "image") => {
    if (!tempatId) return showToast("ID tempat tidak valid", true);

    setIsUploading(true);

    try {
      // Ambil data photos yang sudah ada (dalam bentuk array)
      const { data: currentData, error: fetchError } = await supabase
        .from("tempat")
        .select("photos")
        .eq("id", Number(tempatId))
        .single();

      if (fetchError) throw fetchError;

      // Parse existing photos (harus array)
      let existingPhotos = [];
      if (currentData?.photos) {
        if (Array.isArray(currentData.photos)) {
          existingPhotos = currentData.photos;
        } else if (typeof currentData.photos === 'object') {
          // Konversi dari object ke array jika perlu
          existingPhotos = Object.values(currentData.photos);
        }
      }

      // Data foto baru dengan kategori
      const newPhoto = {
        id: Date.now(),
        url: url,
        type: type,
        caption: caption.trim() || (kategori === "sejarah" ? "Dokumen Sejarah" : `Suasana ${timeLabel}`),
        kategori: kategori, // 'official' atau 'sejarah'
        uploader: "Admin",
        created_at: new Date().toISOString()
      };

      // Tambah tahun jika kategori sejarah
      if (kategori === "sejarah" && tahun) {
        newPhoto.tahun = tahun;
      }

      // Gabungkan dengan existing
      const updatedPhotos = [...existingPhotos, newPhoto];

      // Update ke database
      const { error: updateError } = await supabase
        .from("tempat")
        .update({
          photos: updatedPhotos,
          // Jika kategori official dan belum ada image_url, set sebagai image_url
          ...(kategori === "official" && !currentData?.image_url ? { image_url: url } : {})
        })
        .eq("id", Number(tempatId));

      if (updateError) throw updateError;

      showToast(`Berhasil menambahkan ke ${kategori === "sejarah" ? "Sejarah 📜" : "Official Media 🏢"}!`);

      if (onRefreshNeeded) onRefreshNeeded();

      setTimeout(() => {
        resetModal();
        if (onSuccess) {
          onSuccess(tempatId);
        }
      }, 1500);

    } catch (err) {
      console.error("Error saving:", err);
      showToast(err.message || "Gagal menyimpan", true);
      setIsUploading(false);
    }
  };

  const resetModal = () => {
    setShowModal(false);
    setTempUrl("");
    setCaption("");
    setTahun("");
    setKategori("official");
    setIsUploading(false);
  };

  if (!mounted) return null;

  return (
    <div className="w-full max-w-md mx-auto space-y-3">
      {/* Pilih Kategori */}
      <div className="flex gap-2 p-1 bg-zinc-900/50 rounded-2xl">
        <button
          onClick={() => setKategori("official")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${kategori === "official"
            ? "bg-blue-600 text-white shadow-lg"
            : "text-zinc-400 hover:text-white"
            }`}
        >
          <Building2 size={16} />
          Official Media
        </button>
        <button
          onClick={() => setKategori("sejarah")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${kategori === "sejarah"
            ? "bg-amber-600 text-white shadow-lg"
            : "text-zinc-400 hover:text-white"
            }`}
        >
          <History size={16} />
          Sejarah
        </button>
      </div>

      {/* Input URL / Upload */}
      <div className="relative">
        <input
          type="text"
          value={tempUrl}
          onChange={(e) => setTempUrl(e.target.value)}
          placeholder="URL Foto atau Video..."
          className="w-full pl-4 pr-24 py-3 bg-zinc-900/50 border border-white/10 rounded-2xl text-sm text-white focus:ring-1 focus:ring-white/30 outline-none"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
          <CldUploadWidget
            uploadPreset="setempat_preset"
            onSuccess={(res) => {
              setTempUrl(res.info.secure_url);
              setMediaType(res.info.resource_type || "image");
              setShowModal(true);
            }}
            options={{
              maxFiles: 1,
              clientAllowedFormats: ["jpg", "png", "webp", "jpeg", "mp4", "mov", "avi"],
              maxFileSize: 10000000 // 10MB
            }}
          >
            {({ open }) => (
              <button
                onClick={() => open()}
                className="p-2 bg-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all"
              >
                <Camera size={16} />
              </button>
            )}
          </CldUploadWidget>
          <button
            onClick={() => {
              if (tempUrl.includes('http')) {
                setShowModal(true);
              } else {
                showToast("URL tidak valid", true);
              }
            }}
            className="p-2 bg-blue-600 rounded-xl text-white hover:bg-blue-700 transition-all"
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      {/* Modal Konfirmasi */}
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
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-white font-medium flex items-center gap-2">
                      {kategori === "sejarah" ? <History size={16} /> : <Building2 size={16} />}
                      Tambah ke {kategori === "sejarah" ? "Sejarah" : "Official Media"}
                    </h3>
                    <button onClick={resetModal} className="p-2 bg-zinc-900 rounded-full text-zinc-400">
                      <X size={18} />
                    </button>
                  </div>

                  {/* Preview */}
                  <div className="aspect-video w-full bg-zinc-900 rounded-2xl mb-4 overflow-hidden border border-white/5">
                    {tempUrl && mediaType === "image" ? (
                      <img src={tempUrl} className="w-full h-full object-cover" alt="Preview" />
                    ) : tempUrl && mediaType !== "image" ? (
                      <video src={tempUrl} className="w-full h-full object-cover" controls />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-500">
                        <Camera size={32} className="opacity-20" />
                      </div>
                    )}
                  </div>

                  {/* Input Tahun (khusus sejarah) */}
                  {kategori === "sejarah" && (
                    <input
                      type="text"
                      placeholder="Tahun (contoh: 1990, 2005)"
                      value={tahun}
                      onChange={(e) => setTahun(e.target.value)}
                      className="w-full bg-zinc-900 border border-white/5 rounded-xl p-3 text-sm text-white focus:outline-none mb-3"
                    />
                  )}

                  {/* Caption */}
                  <textarea
                    placeholder="Caption atau deskripsi..."
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
                    {isUploading ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                    Simpan ke {kategori === "sejarah" ? "Sejarah" : "Official"}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Toast Notifikasi */}
      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[10000] px-4 py-2 rounded-full flex items-center gap-2 border shadow-xl ${toast.isError ? "bg-red-950 border-red-500/50 text-red-200" : "bg-zinc-900 border-white/10 text-white"
              }`}
          >
            {toast.isError ? <AlertCircle size={14} /> : <Check size={14} className="text-green-400" />}
            <span className="text-xs font-medium">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}