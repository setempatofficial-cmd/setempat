// app/components/feed/LaporPanel.js
"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
  const [status, setStatus] = useState("idle");
  const [uploadProgress, setUploadProgress] = useState({
    cloudinary: false,
    supabase: false
  });

  // FUNGSI NOTIFIKASI LOGIN
  const showLoginNotification = () => {
    const toastNotif = document.createElement('div');
    toastNotif.className = 'fixed top-20 left-1/2 -translate-x-1/2 z-[1000002] px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border bg-amber-950 border-amber-500/50 text-amber-100 animate-in';
    toastNotif.innerHTML = `
      <div class="text-2xl">🔐</div>
      <div class="flex flex-col">
        <span class="text-[12px] font-black uppercase tracking-widest">Perlu Login</span>
        <span class="text-[10px] opacity-80">Silakan login untuk membuat laporan</span>
      </div>
      <button class="ml-2 px-3 py-1 bg-amber-500/20 rounded-full text-[10px] font-bold hover:bg-amber-500/30 transition">Login</button>
    `;
    
    const loginBtn = toastNotif.querySelector('button');
    loginBtn?.addEventListener('click', () => {
      window.location.href = '/login';
    });
    
    document.body.appendChild(toastNotif);
    setTimeout(() => toastNotif.remove(), 4000);
  };

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

  // 🔥 FETCH TEMPAT DARI feed_view (TANPA CACHE)
  const fetchTempatList = useCallback(async (searchQuery = "") => {
    setIsLoadingTempat(true);
    try {
      let query = supabase
        .from("feed_view")
        .select("id, name, category, alamat")
        .limit(30);
      
      // 🔥 FILTER LANGSUNG DI DATABASE
      if (searchQuery.trim()) {
        query = query.ilike('name', `%${searchQuery}%`);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      setTempatList(data || []);
    } catch (err) {
      console.error("Error fetching places:", err);
      setTempatList([]);
    } finally {
      setIsLoadingTempat(false);
    }
  }, []);

  // 🔥 DEBOUNCE UNTUK PENCARIAN
  const debounceTimer = useRef(null);
  
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      if (tempatQuery.length > 1 || tempatQuery === "") {
        fetchTempatList(tempatQuery);
      }
    }, 400);
    
    return () => clearTimeout(debounceTimer.current);
  }, [tempatQuery, fetchTempatList]);

  // Initial load
  useEffect(() => {
    if (tempat?.id) return;
    fetchTempatList("");
  }, [tempat?.id, fetchTempatList]);

  // 🔥 FILTER DI FRONTEND (untuk pencarian yang sudah di-debounce)
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

  // FINALIZE UPLOAD
  const finalizeUpload = async () => {
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
    
    setUploadProgress({ cloudinary: !!mediaUrl, supabase: false });
    setStatus("uploading");
    
    const timeoutId = setTimeout(() => {
      if (status === "uploading") {
        setStatus("idle");
        alert("Proses penyimpanan sedang lambat. Coba lagi dalam beberapa saat.");
      }
    }, 15000);
    
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.user) {
        console.error("Session error:", sessionError);
        showLoginNotification();
        throw new Error("Silakan login kembali");
      }
      
      const u = session.user;
      const meta = u.user_metadata || {};
      const tempatIdValue = activeTempat?.id ? parseInt(activeTempat.id) : null;
      
      const estimatedPeople = condition ? getEstimatedPeople(condition, currentTimeTag) : null;
      const estimatedWaitTime = condition === "Antri" ? waitTime : null;
      const mainType = condition || (trafficCondition ? "Lalu Lintas" : null);
      const finalDesc = caption.trim() || getConditionDescription(condition, waitTime, trafficCondition);
      
      setUploadProgress(prev => ({ ...prev, supabase: true }));
      
      const { data, error } = await supabase
        .from("laporan_warga")
        .insert([{
          tempat_id: tempatIdValue,
          user_id: u.id,
          user_name: meta.full_name || meta.name || u.email?.split("@")[0] || "Warga",
          username: session.user.user_metadata?.username || session.user.email?.split("@")[0],
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
        .select()
        .single();
      
      if (error) throw error;
      
      setStatus("success");
      
      if (mediaUrl) {
        setTimeout(() => {
          setStatus("idle");
          onSuccess?.(data);
          onClose();
        }, 2000);
      } else {
        const toastNotif = document.createElement('div');
        toastNotif.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 z-[1000002] px-6 py-4 rounded-3xl shadow-2xl flex flex-col items-center gap-1 min-w-[280px] border text-center bg-emerald-950 border-emerald-500/50 text-emerald-100';
        toastNotif.innerHTML = `
          <div class="text-2xl mb-1">✅</div>
          <span class="text-[12px] font-black uppercase tracking-widest">Masuk ke LiveInsight</span>
          <span class="text-[10px] opacity-70">Laporanmu sudah tayang, Lur!</span>
        `;
        document.body.appendChild(toastNotif);
        
        setTimeout(() => {
          setStatus("idle");
          toastNotif.remove();
          onClose();
        }, 1500);
      }
      
    } catch (err) {
      console.error("Upload Error:", err);
      
      if (!err.message.includes("Silakan login")) {
        alert("Gagal mengirim: " + err.message);
      }
      setStatus("idle");
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const cardBg = theme?.isMalam ? "bg-zinc-950 border-white/10" : "bg-white border-gray-200";

  return (
    <>
      {/* TOAST UPLOADING */}
      <AnimatePresence>
        {status === "uploading" && createPortal(
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[1000002] bg-zinc-900/95 backdrop-blur-xl border border-white/10 text-white px-6 py-4 rounded-3xl shadow-2xl flex flex-col gap-3 min-w-[280px]"
          >
            <div className="flex items-center gap-3">
              <div className="relative w-5 h-5">
                <div className="absolute inset-0 border-2 border-emerald-500/20 rounded-full" />
                <div className="absolute inset-0 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              </div>
              <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400">
                Memproses Laporan...
              </span>
            </div>
            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: uploadProgress.supabase ? "95%" : "45%" }}
                className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500"
              />
            </div>
          </motion.div>,
          document.body
        )}
      </AnimatePresence>
      
      {/* TOAST SUCCESS */}
      <AnimatePresence>
        {status === "success" && createPortal(
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[1000002] px-6 py-4 rounded-3xl shadow-2xl flex flex-col items-center gap-1 min-w-[280px] border text-center ${
              mediaUrl 
                ? "bg-indigo-950 border-indigo-500/50 text-indigo-100" 
                : "bg-emerald-950 border-emerald-500/50 text-emerald-100"
            }`}
          >
            <div className="text-2xl mb-1">{mediaUrl ? "✨" : "✅"}</div>
            <span className="text-[12px] font-black uppercase tracking-widest">
              {mediaUrl ? "Masuk ke StoryCircle" : "Masuk ke LiveInsight"}
            </span>
            <span className="text-[10px] opacity-70">Laporanmu sudah tayang, Lur!</span>
          </motion.div>,
          document.body
        )}
      </AnimatePresence>

      {/* MAIN PANEL */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className={`mx-4 mb-4 rounded-3xl ${cardBg} border overflow-hidden flex flex-col shadow-2xl relative`}
        style={{ maxHeight: "85vh" }}
      >
        {/* Glow Header */}
        <div className={`h-1.5 w-full flex-shrink-0 ${mediaUrl ? 'bg-gradient-to-r from-indigo-500 to-purple-500' : 'bg-gradient-to-r from-emerald-400 to-teal-500'}`} />
        
        <div className="flex flex-col flex-1 min-h-0">
          {/* HEADER - PICK TEMPAT */}
          {step === "pick_tempat" && (
            <div className="flex flex-col p-5 gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className={`text-base font-black ${theme?.isMalam ? "text-white" : "text-slate-800"}`}>Pilih Lokasi</h3>
                  <p className="text-[10px] text-slate-500 font-medium">Kabari warga sekitar area ini</p>
                </div>
                <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-400">✕</button>
              </div>
              
              <div className="relative">
                <input
                  type="text"
                  value={tempatQuery}
                  onChange={e => setTempatQuery(e.target.value)}
                  placeholder="Cari nama tempat..."
                  className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 text-[13px] focus:ring-2 focus:ring-emerald-500/20 bg-slate-50/50 outline-none transition-all"
                  autoFocus
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
              </div>

              <div className="overflow-y-auto flex flex-col gap-2 pr-1 custom-scrollbar" style={{ maxHeight: "45vh" }}>
                {isLoadingTempat && tempatList.length === 0 ? (
                  <div className="py-20 flex flex-col items-center opacity-50"><div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent animate-spin rounded-full" /></div>
                ) : filteredTempat.length === 0 && tempatQuery ? (
                  <div className="py-20 text-center">
                    <p className="text-[12px] text-slate-500">Tempat "{tempatQuery}" tidak ditemukan</p>
                  </div>
                ) : (
                  filteredTempat.map(t => (
                    <button
                      key={t.id}
                      onClick={() => { setPickedTempat(t); setStep(mode === "text" ? "form" : "upload"); }}
                      className="flex items-center gap-3 p-3 rounded-2xl border border-transparent bg-slate-50 hover:bg-emerald-50 hover:border-emerald-100 text-left transition-all group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-lg group-hover:scale-110 transition-transform">📍</div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-slate-800 truncate">{t.name}</p>
                        <p className="text-[10px] text-slate-500 truncate">{t.category} • {t.alamat}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* HEADER - ACTIVE */}
          {step !== "pick_tempat" && (
            <div className={`flex-shrink-0 px-5 py-4 flex items-center justify-between border-b ${theme?.isMalam ? "border-white/5" : "border-slate-50"}`}>
              <div className="flex flex-col min-w-0">
                <p className={`text-[13px] font-black ${theme?.isMalam ? "text-white" : "text-slate-800"} truncate`}>
                  {activeTempat?.name}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-bold uppercase">{currentTimeTag}</span>
                  {!tempat?.id && (
                    <button onClick={() => setStep("pick_tempat")} className="text-[9px] font-bold text-emerald-500 hover:underline">GANTI LOKASI</button>
                  )}
                </div>
              </div>
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-400">✕</button>
            </div>
          )}

          {/* UPLOAD SECTION */}
          {step === "upload" && (
            <div className="p-5 flex flex-col gap-4">
              <CldUploadWidget
                uploadPreset="setempat_preset"
                onSuccess={handleUploadDone}
                options={{ 
                  maxFiles: 1, 
                  resourceType: "auto",
                  sources: ["camera", "local"],
                  maxImageFileSize: 5000000,
                  transformations: [{ quality: "auto", width: 1200, crop: "limit" }]
                }}
              >
                {({ open }) => (
                  <button 
                    onClick={() => {
                      const btn = document.activeElement;
                      if (btn) btn.style.transform = 'scale(0.97)';
                      setTimeout(() => {
                        open();
                        setTimeout(() => {
                          if (btn) btn.style.transform = '';
                        }, 150);
                      }, 50);
                    }}
                    className="w-full aspect-video rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-3 hover:bg-indigo-50 hover:border-indigo-200 transition-all active:scale-95 group"
                  >
                    <div className="w-16 h-16 rounded-full bg-white shadow-xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                      📸
                    </div>
                    <div className="text-center">
                      <p className="text-[12px] font-black text-slate-700 uppercase tracking-wider">Ambil Foto/Video</p>
                      <p className="text-[10px] text-slate-400">Otomatis masuk StoryCircle</p>
                    </div>
                  </button>
                )}
              </CldUploadWidget>
              
              <div className="relative py-2 flex items-center">
                <div className="flex-1 h-px bg-slate-100" />
                <span className="px-4 text-[10px] font-bold text-slate-300">ATAU</span>
                <div className="flex-1 h-px bg-slate-100" />
              </div>

              <button 
                onClick={() => setStep("form")} 
                className="w-full py-4 rounded-2xl border border-slate-200 text-[11px] font-black text-slate-500 hover:bg-slate-50 transition-colors uppercase tracking-[0.1em]"
              >
                Lapor Tulisan Saja →
              </button>
            </div>
          )}

          {/* FORM SECTION */}
          {step === "form" && (
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 pr-2 custom-scrollbar">
              {mediaUrl && (
                <div className="relative group aspect-video rounded-2xl overflow-hidden shadow-md ring-4 ring-slate-50">
                  {mediaType === "image" ? (
                    <img src={mediaUrl} className="w-full h-full object-cover" alt="preview" />
                  ) : (
                    <video src={mediaUrl} className="w-full h-full object-cover" muted autoPlay loop playsInline />
                  )}
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button 
                      onClick={() => { setMediaUrl(null); setStep("upload"); }}
                      className="px-4 py-2 bg-white/90 rounded-full text-[10px] font-black text-red-500 shadow-xl"
                    >HAPUS MEDIA</button>
                  </div>
                </div>
              )}
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Keterangan Tambahan</label>
                <textarea
                  placeholder="Apa yang sedang terjadi di sana, Lur?"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-[13px] text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20 min-h-[80px] resize-none"
                  value={caption} 
                  onChange={(e) => setCaption(e.target.value)}
                />
              </div>

              {/* Status Selector */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Status Tempat</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Sepi", val: "Sepi", icon: "🍃", color: "peer-checked:bg-emerald-500 peer-checked:border-emerald-500" },
                    { label: "Ramai", val: "Ramai", icon: "🏃", color: "peer-checked:bg-amber-400 peer-checked:border-amber-400" },
                    ...(hasQueue ? [{ label: "Antri", val: "Antri", icon: "⏳", color: "peer-checked:bg-rose-500 peer-checked:border-rose-500" }] : [])
                  ].map((c) => (
                    <label key={c.val} className="cursor-pointer">
                      <input type="radio" name="cond" className="hidden peer" checked={condition === c.val} onChange={() => { setCondition(c.val); setTrafficCondition(null); setWaitTime(null); }} />
                      <div className={`py-3 rounded-2xl border-2 border-slate-100 bg-white text-center transition-all peer-checked:text-white peer-checked:scale-[1.05] peer-checked:shadow-lg ${c.color}`}>
                        <div className="text-xl mb-0.5">{c.icon}</div>
                        <div className="text-[10px] font-black uppercase tracking-tighter">{c.label}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Wait Time */}
              {condition === "Antri" && (
                <div className="animate-in slide-in-from-top-2 duration-300">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1 mb-2 block">Lama Antrian</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[5, 15, 20].map((v) => (
                      <button key={v} onClick={() => setWaitTime(v)} className={`py-2.5 rounded-xl text-[10px] font-black border-2 transition-all ${waitTime === v ? 'bg-cyan-500 border-cyan-500 text-white shadow-md' : 'bg-white border-slate-100 text-slate-400'}`}>
                        {v === 5 ? "< 5 Menit" : v === 15 ? "5-15 Menit" : "> 15 Menit"}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Traffic Condition */}
              {hasTraffic && (
                <div className="pt-2 border-t border-slate-50 space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Kondisi Jalan</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { val: "Lancar", icon: "🛵", color: "peer-checked:bg-emerald-500" },
                      { val: "Ramai", icon: "🚗", color: "peer-checked:bg-orange-400" },
                      { val: "Macet", icon: "🚦", color: "peer-checked:bg-red-500" }
                    ].map((opt) => (
                      <label key={opt.val} className="cursor-pointer">
                        <input type="radio" name="traffic" className="hidden peer" checked={trafficCondition === opt.val} onChange={() => { setTrafficCondition(opt.val); setCondition(null); }} />
                        <div className={`py-3 rounded-2xl border-2 border-slate-100 bg-white text-center transition-all peer-checked:text-white peer-checked:border-transparent peer-checked:scale-[1.05] ${opt.color}`}>
                          <div className="text-xl mb-0.5">{opt.icon}</div>
                          <div className="text-[10px] font-black uppercase">{opt.val}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* FOOTER ACTION */}
          {(step === "form" || step === "upload") && (
            <div className="p-5 border-t border-slate-100 bg-white/50 backdrop-blur-sm">
              <button 
                onClick={finalizeUpload} 
                disabled={(!condition && !trafficCondition) || (condition === "Antri" && !waitTime) || status === "uploading"}
                className={`w-full py-4 rounded-2xl font-black uppercase text-[12px] tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-xl ${
                  (!condition && !trafficCondition) || (condition === "Antri" && !waitTime) || status === "uploading"
                    ? "bg-slate-100 text-slate-300 cursor-not-allowed shadow-none"
                    : mediaUrl 
                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white active:scale-95" 
                      : "bg-gradient-to-r from-emerald-500 to-teal-600 text-white active:scale-95"
                }`}
              >
                {status === "uploading" ? (
                   <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>Kirim Laporan {mediaUrl ? "Story" : "Cepat"}</>
                )}
              </button>
            </div>
          )}
        </div>
      </motion.div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }

        @keyframes fadeIn {
          from { opacity: 0; transform: translate(-50%, -10px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes slideInFromTop {
          from { opacity: 0; transform: translate(-50%, -20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        .animate-in {
          animation: slideInFromTop 0.3s ease-out;
        }

        button {
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }

        button:active {
          transform: scale(0.97);
          transition: transform 0.05s;
        }
      `}</style>
    </>
  );
}