// components/UploadModal.jsx - FULLY OPTIMIZED
"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { CldUploadWidget } from "next-cloudinary";
import { X, Search, MapPin, Camera, Loader2, Send, Link as LinkIcon, ShieldAlert } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

// ========== CONSTANTS ==========
const ALLOWED_ROLES = ["superadmin", "admin"];
const MAX_PHOTOS_PER_SLOT = 10;
const SEARCH_LIMIT = 30; // ✅ Turunkan dari 100 ke 30

export default function UploadModal({ isOpen, onClose, userId, userRole }) {
  const router = useRouter();
  
  // ========== STATE ==========
  const [tempatList, setTempatList] = useState([]);
  const [selectedTempat, setSelectedTempat] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [timeLabel, setTimeLabel] = useState("");
  const [mediaUrl, setMediaUrl] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [caption, setCaption] = useState("");
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(true);
  
  const abortControllerRef = useRef(null);

  // ========== VALIDASI AKSES ==========
  useEffect(() => {
    const hasAccess = userId && ALLOWED_ROLES.includes(userRole?.toLowerCase());
    setIsAuthorized(hasAccess);
    if (!hasAccess && isOpen) {
      setErrorMessage("Akses ditolak. Hanya Super Admin dan Admin yang dapat mengupload foto official.");
    }
  }, [userId, userRole, isOpen]);

  // ========== SET TIME LABEL ==========
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) setTimeLabel("pagi");
    else if (hour >= 11 && hour < 15) setTimeLabel("siang");
    else if (hour >= 15 && hour < 18) setTimeLabel("sore");
    else setTimeLabel("malam");
  }, []);

  // ========== LOAD TEMPAT (LANGSUNG DARI TABEL tempat) ==========
useEffect(() => {
  if (!isOpen || !isAuthorized) return;
  
  if (abortControllerRef.current) {
    abortControllerRef.current.abort();
  }
  abortControllerRef.current = new AbortController();
  
  const loadTempat = async () => {
    setLoading(true);
    setErrorMessage("");
    
    try {
      // ✅ LANGSUNG ke tabel tempat, bukan feed_view
      const { data, error } = await supabase
        .from("tempat")
        .select("id, name, category, alamat")
        .order("name", { ascending: true })  // 
        .limit(30)
        .abortSignal(abortControllerRef.current.signal);
      
      if (error) throw error;
      if (data) setTempatList(data);
      
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error("Load tempat error:", err);
        setErrorMessage("Gagal memuat daftar tempat");
      }
    } finally {
      setLoading(false);
    }
  };
  
  loadTempat();
  
  return () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };
}, [isOpen, isAuthorized]);

  // ========== FILTER TEMPAT (DEBOUNCED) ==========
  const filteredTempat = searchQuery.trim() 
    ? tempatList.filter(item => {
        const term = searchQuery.toLowerCase();
        return item.name?.toLowerCase().includes(term) ||
               item.category?.toLowerCase().includes(term) ||
               item.alamat?.toLowerCase().includes(term);
      })
    : [];

  const getCurrentTimeTag = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return "pagi";
    if (hour >= 11 && hour < 15) return "siang";
    if (hour >= 15 && hour < 18) return "sore";
    return "malam";
  };

  const handleUrlSubmit = () => {
    if (videoUrl && (videoUrl.includes('http') || videoUrl.includes('https'))) {
      setMediaUrl(videoUrl);
      setMediaType("external");
      setVideoUrl("");
      setErrorMessage("");
    } else {
      setErrorMessage("URL tidak valid. Pastikan diawali http:// atau https://");
    }
  };

  // ========== UPLOAD TO SUPABASE (OPTIMIZED) ==========
  const handleUploadToSupabase = async (url, type) => {
    if (!isAuthorized) {
      setErrorMessage("Anda tidak memiliki akses untuk upload");
      return;
    }

    if (!selectedTempat) {
      setErrorMessage("Pilih tempat terlebih dahulu");
      return;
    }

    if (!url) {
      setErrorMessage("Upload foto/video atau masukkan URL terlebih dahulu");
      return;
    }

    setUploading(true);
    setErrorMessage("");
    const timeTag = getCurrentTimeTag();

    try {
      // ✅ OPTIMASI: SELECT hanya kolom photos
      const { data: currentData, error: fetchError } = await supabase
        .from("tempat")
        .select("photos")
        .eq("id", selectedTempat.id)
        .single();

      if (fetchError) throw fetchError;

      // ✅ OPTIMASI: Struktur data sebagai array (bukan objek tunggal)
      const existingPhotos = currentData?.photos || {};
      const existingSlot = existingPhotos[timeTag] || [];
      
      const newPhoto = {
        url,
        type,
        caption: caption.trim() || `Suasana ${timeLabel}`,
        created_at: new Date().toISOString(),
        uploaded_by: userRole || "admin"
      };

      // ✅ OPTIMASI: Tambah ke array, jangan timpa
      const updatedPhotos = {
        ...existingPhotos,
        [timeTag]: Array.isArray(existingSlot) 
          ? [newPhoto, ...existingSlot].slice(0, MAX_PHOTOS_PER_SLOT)
          : [newPhoto]
      };

      // ✅ OPTIMASI: Update hanya kolom yang berubah
      const { error: updateError } = await supabase
        .from("tempat")
        .update({ 
          photos: updatedPhotos,
          image_url: url
        })
        .eq("id", selectedTempat.id);

      if (updateError) throw updateError;

      // Trigger refresh
      window.dispatchEvent(new CustomEvent("refresh-photoslider"));
      window.dispatchEvent(new CustomEvent("laporan-updated"));

      onClose();
      router.push(`/post/${selectedTempat.id}`);
      
    } catch (err) {
      console.error("Error saving:", err);
      setErrorMessage(err.message || "Gagal menyimpan ke database");
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedTempat(null);
    setSearchQuery("");
    setMediaUrl(null);
    setMediaType(null);
    setCaption("");
    setVideoUrl("");
    setErrorMessage("");
    onClose();
  };

  if (!isOpen) return null;

  // ========== TAMPILAN UNAUTHORIZED ==========
  if (!isAuthorized) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
        <div className="w-full max-w-sm bg-zinc-900 rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
          <div className="flex justify-between items-center p-4 border-b border-white/10">
            <h3 className="text-white font-semibold">Akses Ditolak</h3>
            <button onClick={handleClose} className="p-2 hover:bg-white/10 rounded-full transition">
              <X size={20} className="text-white/60" />
            </button>
          </div>
          <div className="p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
              <ShieldAlert size={32} className="text-red-400" />
            </div>
            <p className="text-white font-medium mb-2">Akses Tidak Diizinkan</p>
            <p className="text-white/40 text-sm mb-4">
              Halaman ini hanya dapat diakses oleh Super Admin dan Admin yang ditunjuk.
            </p>
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-red-500/20 text-red-400 rounded-xl text-sm font-medium"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // ========== TAMPILAN UTAMA ==========
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div className="w-full max-w-md bg-zinc-900 rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <h3 className="text-white font-semibold">Upload Official Photo</h3>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400">
              {userRole === "superadmin" ? "SUPER ADMIN" : "ADMIN"}
            </span>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-white/10 rounded-full transition">
            <X size={20} className="text-white/60" />
          </button>
        </div>

        <div className="p-4 max-h-[80vh] overflow-y-auto space-y-4">
          
          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-xl">
              <p className="text-red-400 text-xs">{errorMessage}</p>
            </div>
          )}

          {/* PENCARIAN TEMPAT */}
          <div>
            <label className="text-xs text-white/40 font-medium mb-1 block">Cari Tempat</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ketik nama tempat..."
                className="w-full pl-9 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-orange-500/50"
                autoFocus
              />
            </div>
            
            {/* Hasil pencarian */}
            {searchQuery && (
              <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                {loading ? (
                  <div className="p-4 text-center text-white/40 text-sm">
                    <Loader2 size={16} className="animate-spin inline mr-2" />
                    Memuat...
                  </div>
                ) : filteredTempat.length === 0 ? (
                  <div className="p-4 text-center text-white/40 text-sm">
                    Tidak ada tempat ditemukan
                  </div>
                ) : (
                  filteredTempat.map((tempat) => (
                    <button
                      key={tempat.id}
                      onClick={() => {
                        setSelectedTempat(tempat);
                        setSearchQuery("");
                        setErrorMessage("");
                      }}
                      className="w-full flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-xl transition text-left"
                    >
                      <MapPin size={16} className="text-orange-400 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-white text-sm font-medium truncate">{tempat.name}</div>
                        <div className="text-white/40 text-xs truncate">{tempat.category || tempat.alamat}</div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Tempat Terpilih */}
          {selectedTempat && (
            <div className="flex items-center gap-2 p-3 bg-orange-500/10 border border-orange-500/30 rounded-xl">
              <MapPin size={16} className="text-orange-400" />
              <div className="flex-1">
                <div className="text-white text-sm font-medium">{selectedTempat.name}</div>
                <div className="text-white/40 text-xs">{selectedTempat.category}</div>
              </div>
              <button
                onClick={() => setSelectedTempat(null)}
                className="text-xs text-white/40 hover:text-white"
              >
                Ganti
              </button>
            </div>
          )}

          {/* Upload Media */}
          {selectedTempat && (
            <>
              <div>
                <label className="text-xs text-white/40 font-medium mb-1 block">Upload Foto/Video</label>
                
                <div className="grid grid-cols-5 gap-2">
                  <div className="col-span-3">
                    <CldUploadWidget
                      uploadPreset="setempat_preset"
                      onSuccess={(res) => {
                        setMediaUrl(res.info.secure_url);
                        setMediaType(res.info.resource_type);
                        setIsUploadingMedia(false);
                        setErrorMessage("");
                      }}
                      onError={(err) => {
                        console.error("Cloudinary error:", err);
                        setErrorMessage("Gagal upload ke Cloudinary");
                        setIsUploadingMedia(false);
                      }}
                      onQueuesStart={() => setIsUploadingMedia(true)}
                      onQueuesComplete={() => setIsUploadingMedia(false)}
                    >
                      {({ open }) => (
                        <button
                          onClick={() => open()}
                          className="w-full flex items-center justify-center gap-2 py-3 bg-white/5 border-2 border-dashed border-white/20 rounded-xl hover:bg-white/10 hover:border-orange-500/50 transition group"
                        >
                          {isUploadingMedia ? (
                            <Loader2 size={16} className="animate-spin text-white/40" />
                          ) : (
                            <Camera size={16} className="text-white/40 group-hover:text-orange-400" />
                          )}
                          <span className="text-white/60 text-xs">
                            {isUploadingMedia ? "Upload..." : "File"}
                          </span>
                        </button>
                      )}
                    </CldUploadWidget>
                  </div>

                  <div className="col-span-2 relative">
                    <input
                      type="text"
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="URL Video..."
                      className="w-full h-full pl-3 pr-8 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-orange-500/50"
                    />
                    <button 
                      onClick={handleUrlSubmit}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 bg-white/10 rounded-lg text-white/40 hover:text-white transition"
                    >
                      <LinkIcon size={12} />
                    </button>
                  </div>
                </div>

                {/* Preview Media */}
                {mediaUrl && (
                  <div className="relative group mt-3">
                    <div className="aspect-video rounded-xl overflow-hidden bg-black/50">
                      {mediaType === "image" ? (
                        <img src={mediaUrl} className="w-full h-full object-cover" alt="Preview" />
                      ) : mediaType === "external" ? (
                        <div className="w-full h-full flex items-center justify-center bg-black/80">
                          <LinkIcon size={32} className="text-white/40" />
                          <span className="text-white/60 text-xs ml-2">Video Eksternal</span>
                        </div>
                      ) : (
                        <video src={mediaUrl} className="w-full h-full object-cover" controls />
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setMediaUrl(null);
                        setMediaType(null);
                        setVideoUrl("");
                      }}
                      className="absolute top-2 right-2 p-1.5 bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition"
                    >
                      <X size={14} className="text-white" />
                    </button>
                  </div>
                )}
              </div>

              {/* Caption */}
              <div>
                <label className="text-xs text-white/40 font-medium mb-1 block">Caption (Opsional)</label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder={`Suasana ${timeLabel} di ${selectedTempat.name}...`}
                  rows={2}
                  className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-orange-500/50 resize-none"
                />
              </div>

              {/* Info waktu */}
              <div className="flex items-center gap-2 p-3 bg-white/5 rounded-xl">
                <span className="text-xs text-white/40">🕐 Slot waktu:</span>
                <span className="text-xs font-medium text-orange-400 bg-orange-500/20 px-2 py-0.5 rounded-full">
                  {timeLabel}
                </span>
              </div>

              {/* Tombol Submit */}
              <button
                onClick={() => handleUploadToSupabase(mediaUrl, mediaType)}
                disabled={!mediaUrl || uploading}
                className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all
                  ${!mediaUrl || uploading 
                    ? 'bg-white/10 text-white/40 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white active:scale-95'}`}
              >
                {uploading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Mengupload...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Upload ke {timeLabel}
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}