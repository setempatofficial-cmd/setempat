// app/components/feed/LaporPanel.js
"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CldUploadWidget } from "next-cloudinary";
import { supabase } from "@/lib/supabaseClient";
import { createPortal } from "react-dom";

// KATEGORI YANG MEMILIKI ANTRIAN
const QUEUE_CATEGORIES = ['kuliner', 'transportasi', 'pasar'];

// KATEGORI YANG MEMILIKI LALU LINTAS
const TRAFFIC_CATEGORIES = ['jalan', 'jalan raya', 'simpang', 'tol', 'bypass', 'lingkar'];

export default function LaporPanel({ 
  tempat, 
  onClose, 
  onSuccess, 
  mode = "media", 
  theme = {},
  initialMediaUrl = null,
  initialMediaType = null
}) {
  const [step, setStep] = useState(() => {
    if (!tempat?.id) return "pick_tempat";
    if (mode === "text") return "form";
    if (initialMediaUrl) return "form";
    return "upload";
  });
  
  const [mediaUrl, setMediaUrl] = useState(initialMediaUrl);
  const [mediaType, setMediaType] = useState(initialMediaType);
  const [condition, setCondition] = useState(null);
  const [trafficCondition, setTrafficCondition] = useState(null);
  const [waitTime, setWaitTime] = useState(null);
  const [caption, setCaption] = useState("");
  const [pickedTempat, setPickedTempat] = useState(tempat || null);
  const [tempatList, setTempatList] = useState([]);
  const [tempatQuery, setTempatQuery] = useState("");
  const [isLoadingTempat, setIsLoadingTempat] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [status, setStatus] = useState("idle"); // idle, uploading, success
  const [uploadProgress, setUploadProgress] = useState({
    cloudinary: false,
    supabase: false
  });

  // Cek kategori
  const kategoriLower = (pickedTempat?.category || tempat?.category || "").toLowerCase();
  const namaLower = (pickedTempat?.name || tempat?.name || "").toLowerCase();
  
  const hasQueue = useMemo(() => 
    QUEUE_CATEGORIES.some(k => kategoriLower.includes(k)), 
    [kategoriLower]
  );
  
  const hasTraffic = useMemo(() => 
    TRAFFIC_CATEGORIES.some(k => kategoriLower.includes(k) || namaLower.includes(k)), 
    [kategoriLower, namaLower]
  );

  useEffect(() => {
    if (tempat?.id) return;
    fetchTempatList();
  }, [tempat?.id]);

  const fetchTempatList = async () => {
    setIsLoadingTempat(true);
    try {
      const { data, error } = await supabase
        .from("feed_view")
        .select("id, name, category, alamat")
        .limit(30);
      
      if (error) throw error;
      setTempatList(data || []);
    } catch (err) {
      console.error("Error fetching places:", err);
      setTempatList([]);
    } finally {
      setIsLoadingTempat(false);
    }
  };

  const filteredTempat = tempatList.filter(t =>
    !tempatQuery ||
    t.name?.toLowerCase().includes(tempatQuery.toLowerCase()) ||
    t.category?.toLowerCase().includes(tempatQuery.toLowerCase()) ||
    t.alamat?.toLowerCase().includes(tempatQuery.toLowerCase())
  );

  const activeTempat = pickedTempat || tempat;
  
  function getCurrentTimeTag() {
    const h = new Date().getHours();
    if (h >= 5 && h < 11) return "Pagi";
    if (h >= 11 && h < 15) return "Siang";
    if (h >= 15 && h < 18) return "Sore";
    return "Malam";
  }
  
  const currentTimeTag = getCurrentTimeTag();

  function getEstimatedPeople(condition, timeTag) {
    const defaults = {
      Sepi: { Pagi: 3, Siang: 5, Sore: 4, Malam: 2 },
      Ramai: { Pagi: 12, Siang: 25, Sore: 20, Malam: 15 },
      Antri: { Pagi: 8, Siang: 15, Sore: 12, Malam: 10 }
    };
    return defaults[condition]?.[timeTag] || 
           (condition === "Sepi" ? 4 : condition === "Ramai" ? 20 : 12);
  }

  function getConditionDescription(condition, waitTime, traffic) {
    if (condition === "Sepi") return `Suasana tenang di ${activeTempat?.name || "sini"}.`;
    if (condition === "Ramai") return `Suasana ramai di ${activeTempat?.name || "sini"}.`;
    if (condition === "Antri") {
      const waitText = waitTime === 5 ? "pendek (<5 menit)" : 
                       waitTime === 15 ? "sedang (5-15 menit)" : 
                       "panjang (>15 menit)";
      return `Antrian ${waitText} di ${activeTempat?.name || "sini"}.`;
    }
    if (traffic) {
      const trafficText = traffic === 'Lancar' ? 'lancar' : 
                          traffic === 'Ramai' ? 'ramai' : 
                          'macet';
      return `Lalu lintas ${trafficText} di ${activeTempat?.name || "sini"}.`;
    }
    return `Update dari ${activeTempat?.name || "sini"}.`;
  }

  const handleUploadDone = (res) => {
    if (res?.event === "success") {
      setMediaType(res.info?.resource_type);
      setMediaUrl(res.info.secure_url);
      setStep("form");
      setUploadProgress(prev => ({ ...prev, cloudinary: true }));
    } else if (res?.event === "error") {
      setUploadError("Gagal upload gambar. Coba lagi nanti.");
      console.error("Upload error:", res);
    }
  };

  const finalizeUpload = async () => {
    // Validasi
    if (!activeTempat?.id) {
      alert("Tempat tidak valid. Silakan pilih tempat terlebih dahulu.");
      setStep("pick_tempat");
      return;
    }
    
    if (!condition && !trafficCondition) {
      alert("Pilih kondisi tempat atau lalu lintas terlebih dahulu");
      return;
    }
    
    if (condition === "Antri" && !waitTime) {
      alert("Pilih estimasi waktu antrian");
      return;
    }
    
    if (status === "uploading") return;
    
    // Reset progress
    setUploadProgress({ cloudinary: !!mediaUrl, supabase: false });
    setStatus("uploading");
    
    // Timeout handler - 15 detik
    const timeoutId = setTimeout(() => {
      if (status === "uploading") {
        console.warn("Upload terlalu lama, timeout dipicu");
        setStatus("idle");
        alert("Proses penyimpanan sedang lambat. Coba lagi dalam beberapa saat.");
      }
    }, 15000);
    
    const startTime = Date.now();
    console.log("⏱️ Start Supabase insert...");
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Login diperlukan");
      
      const u = session.user;
      const meta = u.user_metadata || {};
      
      const tempatIdValue = activeTempat?.id ? parseInt(activeTempat.id) : null;
      
      if (!tempatIdValue) {
        throw new Error("ID tempat tidak valid");
      }
      
      const estimatedPeople = condition ? getEstimatedPeople(condition, currentTimeTag) : null;
      const estimatedWaitTime = condition === "Antri" ? waitTime : null;
      const mainType = condition || (trafficCondition ? "Lalu Lintas" : null);
      const finalDesc = caption.trim() || getConditionDescription(condition, waitTime, trafficCondition);
      
      // Update progress ke Supabase
      setUploadProgress(prev => ({ ...prev, supabase: true }));
      
      // OPTIMASI: Insert dengan select minimal dan single()
      const { data, error } = await supabase
        .from("laporan_warga")
        .insert([{
          tempat_id: tempatIdValue,
          user_id: u.id,
          user_name: meta.full_name || meta.name || u.email?.split("@")[0] || "Warga",
          user_avatar: meta.avatar_url || meta.picture || null,
          photo_url: mediaUrl ? (mediaType === "video" ? mediaUrl.replace(/\.[^/.]+$/, ".jpg") : mediaUrl) : null,
          video_url: mediaType === "video" ? mediaUrl : null,
          media_type: mediaType || "text",
          time_tag: currentTimeTag,
          tipe: mainType,
          estimated_people: estimatedPeople,
          estimated_wait_time: estimatedWaitTime,
          traffic_condition: trafficCondition,
          deskripsi: finalDesc,
          content: caption.trim(),
          status: "approved",
        }])
        .select("id, created_at")
        .single();
      
      const endTime = Date.now();
      console.log(`⏱️ Supabase insert selesai dalam ${endTime - startTime}ms`);
      
      if (endTime - startTime > 3000) {
        console.warn("⚠️ Supabase insert lambat!", {
          waktu: endTime - startTime,
          tempat_id: tempatIdValue,
          media_type: mediaType
        });
      }
      
      if (error) throw error;
      
      setStatus("success");
      
      setTimeout(() => {
        setStatus("idle");
        onSuccess?.(data);
        onClose();
      }, 1500);
      
    } catch (err) {
      console.error("Upload Error:", err);
      alert("Gagal mengirim: " + err.message);
      setStatus("idle");
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const cardBg = theme?.isMalam ? "bg-black/80 border-white/10" : "bg-white border-gray-200";

  return (
    <>
      {/* TOAST UPLOADING - Dengan Progress Detail */}
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
                {uploadProgress.cloudinary && uploadProgress.supabase 
                  ? "Menyimpan ke database..." 
                  : uploadProgress.cloudinary 
                    ? "Menyimpan data..." 
                    : "Sedang Mengirim..."}
              </span>
            </div>
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: uploadProgress.supabase ? "95%" : uploadProgress.cloudinary ? "75%" : "45%" }}
                transition={{ duration: uploadProgress.supabase ? 3 : 2 }}
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
              />
            </div>
            <p className="text-[8px] text-white/50 text-center">
              {uploadProgress.cloudinary && !uploadProgress.supabase 
                ? "Foto sudah diupload, menyimpan data..." 
                : !uploadProgress.cloudinary && mediaUrl
                  ? "Memproses data..."
                  : "Mohon tunggu sebentar..."}
            </p>
          </motion.div>,
          document.body
        )}
      </AnimatePresence>
      
      {/* TOAST SUCCESS */}
      <AnimatePresence>
        {status === "success" && createPortal(
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
          </motion.div>,
          document.body
        )}
      </AnimatePresence>

      {/* MAIN PANEL */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        className={`mx-4 mb-4 rounded-2xl ${cardBg} border overflow-hidden flex flex-col shadow-xl`}
        style={{ maxHeight: "80vh" }}
      >
        <div className="h-1 bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500 flex-shrink-0" />
        
        <div className="flex flex-col flex-1 min-h-0">
          {/* HEADER - PICK TEMPAT */}
          {step === "pick_tempat" && (
            <div className="flex flex-col p-4 gap-3">
              <div className="flex items-center justify-between">
                <p className={`text-[13px] font-bold ${theme?.isMalam ? "text-white" : "text-slate-700"}`}>📍 Cerita dari mana, Lur?</p>
                <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-200 text-slate-400 text-sm">✕</button>
              </div>
              
              {uploadError && (
                <div className="p-2 text-xs text-red-500 bg-red-50 rounded-lg">
                  {uploadError}
                </div>
              )}
              
              <input
                type="text"
                value={tempatQuery}
                onChange={e => setTempatQuery(e.target.value)}
                placeholder="Cari nama tempat atau area..."
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-[13px] focus:outline-none focus:ring-2 focus:ring-emerald-400/30 bg-white"
                autoFocus
              />
              <div className="overflow-y-auto flex flex-col gap-1" style={{ maxHeight: "50vh" }}>
                {isLoadingTempat ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-3">
                    <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                    <p className="text-[12px] text-slate-500">Memuat daftar tempat...</p>
                  </div>
                ) : filteredTempat.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2">
                    <span className="text-2xl">📍</span>
                    <p className="text-[12px] text-slate-400 text-center">
                      {tempatQuery ? "Tidak ditemukan tempat" : "Belum ada tempat tersedia"}
                    </p>
                  </div>
                ) : (
                  filteredTempat.map(t => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setPickedTempat(t);
                        setStep(mode === "text" ? "form" : "upload");
                      }}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-100 bg-white hover:bg-slate-50 text-left transition-colors active:scale-[0.98]"
                    >
                      <span className="text-lg flex-shrink-0">📍</span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-slate-800 truncate">{t.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">{t.category}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* HEADER - ACTIVE TEMPAT */}
          {step !== "pick_tempat" && (
            <div className={`flex-shrink-0 px-4 pt-3 pb-2 flex items-center justify-between border-b ${theme?.isMalam ? "border-white/10" : "border-slate-100"}`}>
              <div className="flex items-center gap-2 min-w-0">
                {!tempat?.id && activeTempat && (
                  <button onClick={() => setStep("pick_tempat")} className="text-[10px] font-black text-emerald-500 uppercase tracking-wide hover:underline flex-shrink-0">← Ganti</button>
                )}
                <p className={`text-[13px] font-bold ${theme?.isMalam ? "text-white" : "text-slate-700"} truncate`}>
                  {activeTempat?.name || "Cerita Cepat"} · {currentTimeTag}
                </p>
              </div>
              <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-200 text-slate-400 text-sm flex-shrink-0">✕</button>
            </div>
          )}

          {/* UPLOAD SECTION - Dengan Optimasi Cloudinary */}
          {step === "upload" && (
            <div className="p-4">
              {uploadError && (
                <div className="mb-3 p-2 text-xs text-red-500 bg-red-50 rounded-lg">
                  {uploadError}
                </div>
              )}
              <CldUploadWidget
                cloudName={process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}
                uploadPreset="setempat_preset"
                onSuccess={handleUploadDone}
                onError={(error) => {
                  console.error("Upload error:", error);
                  setUploadError("Gagal upload. Coba file yang lebih kecil (max 5MB).");
                }}
                options={{ 
                  maxFiles: 1, 
                  resourceType: "auto",
                  sources: ["camera", "local"],
                  defaultSource: "camera",
                  multiple: false,
                  cropping: false,
                  
                  // OPTIMASI UKURAN FILE
                  maxImageFileSize: 5000000, // 5MB max untuk image
                  maxVideoFileSize: 20000000, // 20MB max untuk video
                  clientAllowedFormats: ["image", "video"],
                  
                  // AUTO COMPRESS & OPTIMASI
                  transformations: [
                    { 
                      quality: "auto",
                      fetch_format: "auto",
                      width: 1200,
                      height: 1200,
                      crop: "limit"
                    }
                  ],
                  
                  // TAMPILAN
                  showAdvancedOptions: false,
                  showPoweredBy: false,
                  croppingShowDimensions: false,
                  
                  // UPLOAD
                  use_filename: false,
                  unique_filename: true,
                  overwrite: false,
                }}
              >
                {({ open }) => (
                  <button 
                    onClick={() => open()} 
                    className="w-full py-12 rounded-xl border-2 border-dashed border-slate-200 bg-white flex flex-col items-center gap-3 active:scale-95 transition-all"
                  >
                    <span className="text-4xl">📸</span>
                    <span className="text-[12px] font-black text-slate-500 uppercase">Ambil Foto Keadaan</span>
                    <span className="text-[9px] text-slate-400">Maksimal 5MB, auto compress</span>
                  </button>
                )}
              </CldUploadWidget>
              <button 
                onClick={() => setStep("form")} 
                className="w-full mt-3 text-[10px] font-bold text-slate-400 hover:text-emerald-500 transition-colors uppercase tracking-widest"
              >
                Cerita Tanpa Foto →
              </button>
            </div>
          )}

          {/* FORM LAPORAN */}
          {step === "form" && (
            <div className="flex-1 overflow-y-auto px-4 pt-3 pb-2 space-y-3 min-h-0">
              {/* Preview media */}
              {mediaUrl && (
                <div className="relative w-full h-28 rounded-xl overflow-hidden bg-slate-200">
                  {mediaType === "image" ? (
                    <img src={mediaUrl} className="w-full h-full object-cover" alt="preview" />
                  ) : (
                    <video src={mediaUrl} className="w-full h-full object-cover" muted autoPlay loop playsInline />
                  )}
                  <button 
                    onClick={() => { setMediaUrl(null); setMediaType(null); setStep("upload"); }} 
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 text-white text-xs flex items-center justify-center"
                  >
                    ✕
                  </button>
                </div>
              )}
              
              <textarea
                placeholder={mode === "text" ? "Ceritakan kondisi ringkas..." : "Ceritakan suasana di sekitar, Lur..."}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 resize-none"
                rows={mode === "text" ? 3 : 2} 
                value={caption} 
                onChange={(e) => setCaption(e.target.value)}
                autoFocus={mode === "text"}
              />

              {/* Kondisi Tempat */}
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">
                📍 Kondisi Tempat
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { emoji: "🍃", label: "Sepi", val: "Sepi", active: "bg-emerald-500 border-emerald-500 text-white" },
                  { emoji: "🏃", label: "Ramai", val: "Ramai", active: "bg-yellow-400 border-yellow-400 text-white" },
                ].map((c) => (
                  <button 
                    key={c.val} 
                    onClick={() => {
                      setCondition(c.val);
                      setTrafficCondition(null);
                      setWaitTime(null);
                    }}
                    className={`py-2.5 rounded-xl text-[10px] font-black border-2 transition-all flex flex-col items-center gap-0.5
                      ${condition === c.val ? c.active + " scale-[1.03] shadow-md" : "bg-white text-slate-400 border-slate-200"}`}
                  >
                    <span className="text-base">{c.emoji}</span>
                    <span className="uppercase tracking-wide">{c.label}</span>
                  </button>
                ))}
                
                {hasQueue && (
                  <button 
                    onClick={() => {
                      setCondition("Antri");
                      setTrafficCondition(null);
                    }}
                    className={`py-2.5 rounded-xl text-[10px] font-black border-2 transition-all flex flex-col items-center gap-0.5
                      ${condition === "Antri" ? "bg-rose-500 border-rose-500 text-white scale-[1.03] shadow-md" : "bg-white text-slate-400 border-slate-200"}`}
                  >
                    <span className="text-base">⏳</span>
                    <span className="uppercase tracking-wide">Antri</span>
                  </button>
                )}
              </div>

              {/* Waktu Antri */}
              {condition === "Antri" && (
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">
                    ⏱️ Estimasi waktu antri
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 5, label: "< 5 menit", desc: "Pendek", icon: "⚡" },
                      { value: 15, label: "5-15 menit", desc: "Sedang", icon: "⏱️" },
                      { value: 20, label: "> 15 menit", desc: "Panjang", icon: "🐢" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setWaitTime(opt.value)}
                        className={`py-2 rounded-xl text-[10px] font-bold border-2 transition-all text-center
                          ${waitTime === opt.value
                            ? "bg-cyan-500 border-cyan-500 text-white"
                            : "bg-white text-slate-500 border-slate-200"}`}
                      >
                        <div className="text-base">{opt.icon}</div>
                        <div>{opt.label}</div>
                        <div className="text-[8px] opacity-80">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Lalu Lintas */}
              {hasTraffic && (
                <>
                  <div className="flex items-center gap-2 my-1">
                    <div className="h-px flex-1 bg-slate-200" />
                    <span className="text-[8px] font-black text-slate-300 uppercase tracking-wider">atau</span>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>
                  
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                    🚦 Kondisi Lalu Lintas
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { emoji: "🛵", label: "Lancar", val: "Lancar", color: "bg-emerald-500", desc: "Jalanan lengang" },
                      { emoji: "🚗", label: "Ramai", val: "Ramai", color: "bg-yellow-500", desc: "Kendaraan mulai padat" },
                      { emoji: "🚦", label: "Macet", val: "Macet", color: "bg-rose-500", desc: "Antrean panjang" },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        onClick={() => {
                          setTrafficCondition(opt.val);
                          setCondition(null);
                          setWaitTime(null);
                        }}
                        className={`py-2 rounded-xl text-[10px] font-bold border-2 transition-all flex flex-col items-center gap-0.5
                          ${trafficCondition === opt.val
                            ? opt.color + " text-white border-transparent shadow-md"
                            : "bg-white text-slate-500 border-slate-200"}`}
                      >
                        <span className="text-base">{opt.emoji}</span>
                        <span className="uppercase tracking-wide">{opt.label}</span>
                        <span className="text-[8px] opacity-80">{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              <p className="text-[8px] text-center text-slate-400">
                ✨ Pilih kondisi tempat ATAU lalu lintas (sesuai yang kamu lihat)
              </p>
            </div>
          )}

          {/* BUTTON KIRIM */}
          {(step === "form" || step === "upload") && (
            <div className="flex-shrink-0 px-4 pt-2 pb-4 border-t border-slate-100">
              <button 
                onClick={finalizeUpload} 
                disabled={(!condition && !trafficCondition) || (condition === "Antri" && !waitTime) || status === "uploading"}
                className={`w-full py-4 rounded-xl font-black uppercase text-[12px] tracking-widest transition-all
                  ${(!condition && !trafficCondition) || (condition === "Antri" && !waitTime) || status === "uploading"
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg active:scale-[0.98]"
                  }`}
              >
                {status === "uploading" ? "Mengirim..." : "Kirim Laporan"}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}