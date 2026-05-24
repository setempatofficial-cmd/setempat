"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CldUploadWidget } from "next-cloudinary";
import { supabase } from "@/lib/supabaseClient";
import DOMPurify from 'dompurify';
import { X, MapPin, Camera, Send } from "lucide-react";

// KONSTANTA
const QUEUE_CATEGORIES = ['kuliner', 'transportasi', 'pasar'];
const TRAFFIC_CATEGORIES = ['jalan', 'jalan raya', 'simpang', 'tol', 'bypass', 'lingkar'];

// Helper functions
const getCurrentTimeTag = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return "Pagi";
  if (hour >= 11 && hour < 15) return "Siang";
  if (hour >= 15 && hour < 18) return "Sore";
  return "Malam";
};

const ESTIMATED_PEOPLE = {
  Sepi: { Pagi: 3, Siang: 5, Sore: 4, Malam: 2 },
  Ramai: { Pagi: 12, Siang: 25, Sore: 20, Malam: 15 },
  Antri: { Pagi: 8, Siang: 15, Sore: 12, Malam: 10 }
};

export default function LaporPanel({ tempat, onClose, onSuccess, mode = "media", initialMediaUrl = null, initialMediaType = null }) {
  // STATE
  const [status, setStatus] = useState("idle");
  const [tempMediaUrl, setTempMediaUrl] = useState(initialMediaUrl);
  const [mediaType, setMediaType] = useState(initialMediaType);
  const [showPickTempat, setShowPickTempat] = useState(!tempat?.id);
  const [pickedTempat, setPickedTempat] = useState(tempat || null);
  const [selectedCondition, setSelectedCondition] = useState(null);
  const [selectedWaitTime, setSelectedWaitTime] = useState(null);
  const [selectedTraffic, setSelectedTraffic] = useState(null);
  const [content, setContent] = useState("");
  const [uploadProgress, setUploadProgress] = useState(false);

  const [tempatList, setTempatList] = useState([]);
  const [tempatQuery, setTempatQuery] = useState("");
  const [showNominatim, setShowNominatim] = useState(false);
  const [nominatimResults, setNominatimResults] = useState([]);

  const timeoutRef = useRef(null);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);

  // Computed values
  const kategoriLower = (pickedTempat?.category || tempat?.category || "").toLowerCase();
  const namaLower = (pickedTempat?.name || tempat?.name || "").toLowerCase();
  const hasQueue = QUEUE_CATEGORIES.some(k => kategoriLower.includes(k));
  const hasTraffic = TRAFFIC_CATEGORIES.some(k => kategoriLower.includes(k) || namaLower.includes(k));
  const isNominatim = pickedTempat?.source === 'nominatim';
  const activeTempat = pickedTempat || tempat;
  const currentTimeTag = getCurrentTimeTag();

  const isFormDisabled = (isNominatim && !selectedTraffic) ||
    (!isNominatim && !selectedCondition && !selectedTraffic) ||
    (selectedCondition === "Antri" && !selectedWaitTime) ||
    status === "uploading";

  // Cleanup
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current?.abort();
    };
  }, []);

  // Fetch tempat with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      if (tempatQuery.length > 1 || tempatQuery === "") {
        await fetchTempatList(tempatQuery);
        if (tempatQuery.length >= 3 && showNominatim) {
          await searchNominatim(tempatQuery);
        } else {
          setNominatimResults([]);
        }
      }
    }, 300);
  }, [tempatQuery, showNominatim]);

  const fetchTempatList = async (searchQuery = "") => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    try {
      let query = supabase.from("tempat").select("id, name, category, alamat, latitude, longitude").limit(20);
      if (searchQuery.trim()) query = query.ilike('name', `%${searchQuery}%`);

      const { data, error } = await query;
      if (!error && data) setTempatList(data);
    } catch (err) {
      if (err.name !== 'AbortError') console.error(err);
    }
  };

  const searchNominatim = async (query) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=3&addressdetails=1&countrycodes=id`,
        { signal: controller.signal }
      );

      clearTimeout(timeoutId);
      const data = await response.json();

      const results = data.slice(0, 3).map(item => ({
        id: `nominatim_${item.place_id}`,
        name: item.display_name.split(',')[0],
        fullName: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        source: 'nominatim',
        category: 'jalan'
      }));

      setNominatimResults(results);
    } catch (error) {
      if (error.name !== 'AbortError') console.error(error);
    }
  };

  const handleUploadDone = (res) => {
    if (res?.event === "success" && res.info?.secure_url) {
      setMediaType(res.info.resource_type);
      setTempMediaUrl(res.info.secure_url);
    }
  };

  const selectLocation = (location) => {
    setPickedTempat({
      id: location.id,
      name: location.name,
      category: location.category || 'tempat',
      alamat: location.fullName || location.alamat,
      latitude: location.lat || location.latitude,
      longitude: location.lng || location.longitude,
      source: location.source || 'database'
    });
    setShowPickTempat(false);
    setTempatQuery("");
  };

  const finalizeUpload = async () => {
    if (!activeTempat?.id && !isNominatim) { alert("Pilih lokasi dulu"); return; }
    if (!isNominatim && !selectedCondition && !selectedTraffic) { alert("Pilih kondisi"); return; }
    if (selectedCondition === "Antri" && !selectedWaitTime) { alert("Pilih waktu antrian"); return; }
    if (status === "uploading") return;

    const cleanContent = DOMPurify.sanitize(content, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
    const estimatedPeople = selectedCondition ? (ESTIMATED_PEOPLE[selectedCondition]?.[currentTimeTag] || 4) : null;

    const getAutoDesc = () => {
      if (selectedCondition === "Sepi") return `Suasana tenang di ${activeTempat?.name || "sini"}.`;
      if (selectedCondition === "Ramai") return `Suasana ramai di ${activeTempat?.name || "sini"}.`;
      if (selectedCondition === "Antri") {
        const waitText = selectedWaitTime === 5 ? "pendek (<5 menit)" : selectedWaitTime === 15 ? "sedang (5-15 menit)" : "panjang (>15 menit)";
        return `Antrian ${waitText} di ${activeTempat?.name || "sini"}.`;
      }
      if (selectedTraffic) {
        const text = selectedTraffic === 'Lancar' ? 'lancar' : selectedTraffic === 'Ramai' ? 'ramai' : 'macet';
        return `Lalu lintas ${text} di ${activeTempat?.name || "sini"}.`;
      }
      return `Update dari ${activeTempat?.name || "sini"}.`;
    };

    const finalDescription = cleanContent.trim() || getAutoDesc();

    setUploadProgress(false);
    setStatus("uploading");

    timeoutRef.current = setTimeout(() => {
      if (status === "uploading") {
        setStatus("idle");
        alert("Upload terlalu lama. Coba lagi.");
      }
    }, 20000);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Login diperlukan");

      setUploadProgress(true);

      const reportData = {
        tempat_id: !isNominatim && activeTempat?.id ? parseInt(activeTempat.id) : null,
        user_id: session.user.id,
        user_name: session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Warga",
        username: session.user.user_metadata?.username || session.user.email?.split("@")[0],
        user_avatar: session.user.user_metadata?.avatar_url || null,
        photo_url: tempMediaUrl ? (mediaType === "video" ? tempMediaUrl.replace(/\.[^/.]+$/, ".jpg") : tempMediaUrl) : null,
        video_url: mediaType === "video" ? tempMediaUrl : null,
        media_type: mediaType || "text",
        time_tag: currentTimeTag,
        tipe: selectedCondition || (selectedTraffic ? "Lalu Lintas" : null),
        estimated_people: estimatedPeople,
        estimated_wait_time: selectedCondition === "Antri" ? selectedWaitTime : null,
        traffic_condition: selectedTraffic || null,
        deskripsi: finalDescription,
        content: cleanContent,
        status: "approved",
        lokasi_name: isNominatim ? activeTempat.name : null,
        lokasi_lat: isNominatim ? activeTempat.latitude : null,
        lokasi_lng: isNominatim ? activeTempat.longitude : null,
        report_type: isNominatim ? 'general_location' : 'place',
      };

      // 🔥 PERBAIKAN 1: Tambah .select() untuk dapat data kembali
      const { data, error } = await supabase
        .from("laporan_warga")
        .insert([reportData])
        .select();

      if (error) throw error;

      // 🔥 PERBAIKAN 2: Ambil data laporan yang baru
      const newReport = data?.[0] || reportData;

      // 🔥 PERBAIKAN 3: Kirim event dengan data lengkap
      window.dispatchEvent(new CustomEvent('story-upload-success', {
        detail: {
          tempatId: activeTempat?.id,
          isNominatim,
          newReport: newReport
        }
      }));

      // 🔥 PERBAIKAN 4: Kirim event khusus untuk refresh CitizenHub
      window.dispatchEvent(new CustomEvent('refresh-citizenhub', {
        detail: {
          newReport: newReport,
          tempatId: activeTempat?.id
        }
      }));

      setStatus("success");

      // 🔥 PERBAIKAN 5: Kirim data ke onSuccess
      setTimeout(() => {
        onSuccess?.(newReport);
        onClose();
      }, 1500);

    } catch (err) {
      console.error("Upload Error:", err);
      alert("Gagal mengirim: " + err.message);
      setStatus("idle");
    } finally {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
  };

  const allResults = [...tempatList, ...nominatimResults];

  return createPortal(
    <AnimatePresence>
      {true && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100000] flex justify-center items-end sm:items-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 180 }}
            className="relative bg-white w-full max-w-[420px] rounded-[28px] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1.5 bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 w-full" />

            <div className="p-5">
              {/* Header */}
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Kirim Laporan</h3>
                  <p className="text-[10px] font-bold text-cyan-600 uppercase tracking-widest mt-0.5">
                    {activeTempat?.name || (showPickTempat ? "Pilih lokasi" : "Lokasi belum dipilih")} · {currentTimeTag}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 text-lg transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Pilih Lokasi Section */}
              {showPickTempat && (
                <div className="mb-4 space-y-3">
                  <div className="relative">
                    <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={tempatQuery}
                      onChange={(e) => setTempatQuery(e.target.value)}
                      placeholder="Cari tempat atau jalan..."
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-cyan-500/20 bg-slate-50 outline-none"
                      autoFocus
                    />
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showNominatim}
                      onChange={(e) => setShowNominatim(e.target.checked)}
                      className="w-3.5 h-3.5 rounded"
                    />
                    <span className="text-[9px] text-slate-500">🔍 Cari di peta (jalan, simpang)</span>
                  </label>

                  <div className="max-h-[200px] overflow-y-auto space-y-1.5">
                    {allResults.map(t => (
                      <button
                        key={t.id}
                        onClick={() => selectLocation(t)}
                        className="w-full flex items-center gap-2 p-2 rounded-xl bg-slate-50 hover:bg-cyan-50 text-left transition-colors"
                      >
                        <span className="text-base">{t.source === 'nominatim' ? '🛣️' : '📍'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-800 truncate">{t.name}</span>
                            {t.source === 'nominatim' && (
                              <span className="text-[7px] px-1 py-0.5 rounded bg-blue-100 text-blue-600">Jalan</span>
                            )}
                          </div>
                          <span className="text-[9px] text-slate-500 truncate block">
                            {t.source === 'nominatim' ? t.fullName : t.category}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Ganti Lokasi Button */}
              {!showPickTempat && activeTempat && (
                <button
                  onClick={() => setShowPickTempat(true)}
                  className="mb-3 text-[9px] font-bold text-cyan-600 flex items-center gap-1"
                >
                  <MapPin size={10} />
                  Ganti lokasi
                </button>
              )}

              {/* Upload Area */}
              {!tempMediaUrl && mode !== "text" && (
                <div className="mb-4">
                  <CldUploadWidget
                    uploadPreset="setempat_preset"
                    onSuccess={handleUploadDone}
                    options={{
                      maxFiles: 1,
                      resourceType: "auto",
                      sources: ["camera", "local"],
                      defaultSource: "camera",
                      multiple: false,
                      clientAllowedFormats: ["image", "video"],
                      maxImageFileSize: 5000000,
                      maxVideoFileSize: 20000000,
                    }}
                  >
                    {({ open }) => (
                      <button
                        onClick={() => open()}
                        className="w-full aspect-video rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-2 hover:bg-cyan-50 transition-colors"
                      >
                        <Camera size={32} className="text-slate-400" />
                        <span className="text-[11px] font-bold text-slate-700">Ambil Foto/Video</span>
                      </button>
                    )}
                  </CldUploadWidget>
                </div>
              )}

              {/* Preview + Textarea (ala Uploader) */}
              {tempMediaUrl && (
                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 mb-4 flex gap-3">
                  <div className="w-14 h-18 rounded-xl overflow-hidden bg-slate-200 flex-shrink-0 aspect-[3/4]">
                    {mediaType === "image" ? (
                      <img src={tempMediaUrl} className="w-full h-full object-cover" alt="preview" />
                    ) : (
                      <video src={tempMediaUrl} className="w-full h-full object-cover" muted autoPlay loop playsInline />
                    )}
                  </div>
                  <textarea
                    placeholder="Ceritakan kondisinya... (contoh: hujan gerimis, ramai pengunjung, macet panjang, dll)"
                    className="w-full bg-transparent border-none p-1 text-[13px] font-medium focus:ring-0 outline-none resize-none text-slate-700 placeholder:text-slate-300"
                    rows={3}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                </div>
              )}

              {/* Tombol Skip Upload */}
              {!tempMediaUrl && mode !== "media" && (
                <button
                  onClick={() => setTempMediaUrl("text-only")}
                  className="w-full py-3 rounded-xl border border-slate-200 text-[10px] font-bold text-slate-500 hover:bg-slate-50 mb-4"
                >
                  Lapor Tulisan Saja →
                </button>
              )}

              {/* Survey Options - ala Uploader */}
              {!isNominatim && !showPickTempat && (
                <>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">📍 Kondisi Tempat</p>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {[
                      { emoji: "🍃", label: "Sepi", val: "Sepi" },
                      { emoji: "🏃", label: "Ramai", val: "Ramai" },
                    ].map((btn) => (
                      <button
                        key={btn.val}
                        onClick={() => { setSelectedCondition(btn.val); setSelectedWaitTime(null); setSelectedTraffic(null); }}
                        className={`py-3 rounded-xl text-[11px] font-black border-2 transition-all flex flex-col items-center gap-1
                          ${selectedCondition === btn.val
                            ? (btn.val === "Sepi" ? "bg-emerald-500 border-emerald-500 text-white scale-[1.04] shadow-lg" : "bg-yellow-400 border-yellow-400 text-white scale-[1.04] shadow-lg")
                            : "bg-white text-slate-400 border-slate-100 hover:border-slate-200"}`}
                      >
                        <span className="text-lg">{btn.emoji}</span>
                        <span className="uppercase tracking-wider">{btn.label}</span>
                      </button>
                    ))}

                    {hasQueue && (
                      <button
                        onClick={() => { setSelectedCondition("Antri"); setSelectedWaitTime(null); setSelectedTraffic(null); }}
                        className={`py-3 rounded-xl text-[11px] font-black border-2 transition-all flex flex-col items-center gap-1
                          ${selectedCondition === "Antri" ? "bg-rose-500 border-rose-500 text-white scale-[1.04] shadow-lg" : "bg-white text-slate-400 border-slate-100 hover:border-slate-200"}`}
                      >
                        <span className="text-lg">⏳</span>
                        <span className="uppercase tracking-wider">Antri</span>
                      </button>
                    )}
                  </div>
                </>
              )}

              {/* Wait Time Options */}
              {selectedCondition === "Antri" && (
                <div className="mb-5">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">⏱️ Estimasi waktu antri</p>
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
                            : "bg-white text-slate-500 border-slate-200 hover:border-cyan-300"}`}
                      >
                        <div className="text-base">{option.icon}</div>
                        <div>{option.label}</div>
                        <div className="text-[8px] opacity-80">{option.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Traffic Options */}
              {(hasTraffic || isNominatim) && !showPickTempat && (
                <>
                  <div className="flex items-center gap-2 mt-2 mb-2">
                    <div className="h-px flex-1 bg-slate-200" />
                    <span className="text-[8px] font-black text-slate-300 uppercase tracking-wider">atau</span>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>

                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">🚦 Kondisi Lalu Lintas</p>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {[
                      { emoji: "🛵", label: "Lancar", val: "Lancar", desc: "Jalanan lengang" },
                      { emoji: "🚗", label: "Ramai", val: "Ramai", desc: "Kendaraan mulai padat" },
                      { emoji: "🚦", label: "Macet", val: "Macet", desc: "Antrean panjang" },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        onClick={() => {
                          setSelectedTraffic(opt.val);
                          setSelectedCondition(null);
                          setSelectedWaitTime(null);
                        }}
                        className={`py-2.5 rounded-xl text-[10px] font-bold border-2 transition-all flex flex-col items-center gap-0.5
                          ${selectedTraffic === opt.val
                            ? (opt.val === "Lancar" ? "bg-emerald-500" : opt.val === "Ramai" ? "bg-yellow-500" : "bg-rose-500") + " text-white border-transparent shadow-md scale-[1.02]"
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

              {/* Helper Text */}
              {((hasQueue || hasTraffic) && !showPickTempat) && (
                <p className="text-[8px] text-center text-slate-400 mb-3">
                  💡 Pilih kondisi tempat ATAU lalu lintas (sesuai yang kamu lihat)
                </p>
              )}

              {/* Submit Button */}
              <button
                onClick={finalizeUpload}
                disabled={isFormDisabled}
                className={`w-full py-4 rounded-2xl font-black uppercase text-[12px] tracking-widest transition-all flex items-center justify-center gap-2
                  ${isFormDisabled
                    ? "bg-slate-100 text-slate-300 cursor-not-allowed"
                    : "bg-gradient-to-r from-cyan-500 to-blue-600 text-white active:scale-[0.98] shadow-lg shadow-cyan-500/20"}`}
              >
                {status === "uploading" ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Mengirim...
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    Kirim Laporan
                  </>
                )}
              </button>

              {/* Validation Messages */}
              {selectedCondition === "Antri" && !selectedWaitTime && (
                <p className="text-[9px] text-amber-600 text-center mt-2">*Pilih estimasi waktu antri untuk melanjutkan</p>
              )}
              {!selectedCondition && !selectedTraffic && !isNominatim && !showPickTempat && (
                <p className="text-[9px] text-slate-400 text-center mt-2">*Pilih kondisi tempat atau lalu lintas</p>
              )}
            </div>
          </motion.div>

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
                    {uploadProgress ? "Menyimpan ke database..." : "Sedang Mengirim..."}
                  </span>
                </div>
                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    animate={{ width: uploadProgress ? "95%" : "65%" }}
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
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}