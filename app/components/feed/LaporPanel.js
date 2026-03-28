// app/components/feed/LaporPanel.js
"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CldUploadWidget } from "next-cloudinary";
import { supabase } from "@/lib/supabaseClient";

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
    setIsLoadingTempat(true);
    supabase
      .from("feed_view")
      .select("id, name, category, alamat")
      .limit(30)
      .then(({ data }) => {
        setTempatList(data || []);
        setIsLoadingTempat(false);
      })
      .catch(() => {
        setTempatList([]);
        setIsLoadingTempat(false);
      });
  }, [tempat?.id]);

  const filteredTempat = tempatList.filter(t =>
    !tempatQuery ||
    t.name?.toLowerCase().includes(tempatQuery.toLowerCase()) ||
    t.category?.toLowerCase().includes(tempatQuery.toLowerCase()) ||
    t.alamat?.toLowerCase().includes(tempatQuery.toLowerCase())
  );

  const activeTempat = pickedTempat || tempat;
  const currentTimeTag = getCurrentTimeTag();

  function getCurrentTimeTag() {
    const h = new Date().getHours();
    if (h >= 5 && h < 11) return "pagi";
    if (h >= 11 && h < 15) return "siang";
    if (h >= 15 && h < 18) return "sore";
    return "malam";
  }

  function getEstimatedPeople(condition, timeTag) {
    const defaults = {
      Sepi: { pagi: 3, siang: 5, sore: 4, malam: 2 },
      Ramai: { pagi: 12, siang: 25, sore: 20, malam: 15 },
      Antri: { pagi: 8, siang: 15, sore: 12, malam: 10 }
    };
    return defaults[condition]?.[timeTag] || 
           (condition === "Sepi" ? 4 : condition === "Ramai" ? 20 : 12);
  }

  const handleUploadDone = (res) => {
    if (res?.event === "success") {
      setMediaType(res.info?.resource_type);
      setMediaUrl(res.info.secure_url);
      setStep("form");
    }
  };

  const handleSubmit = async () => {
    // Validasi: harus pilih salah satu (kondisi tempat ATAU lalu lintas)
    if (!condition && !trafficCondition) return;
    if (condition === "Antri" && !waitTime) return;
    
    setStep("sending");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Login diperlukan");
      const u = session.user;
      const meta = u.user_metadata || {};

      const estimatedPeople = condition ? getEstimatedPeople(condition, currentTimeTag) : null;
      const estimatedWaitTime = condition === "Antri" ? waitTime : null;
      const mainType = condition || (trafficCondition ? "Lalu Lintas" : null);
      
      // Buat deskripsi otomatis
      let autoDesc = "";
      if (condition === "Sepi") autoDesc = `Suasana tenang di ${activeTempat?.name || "sini"}.`;
      else if (condition === "Ramai") autoDesc = `Suasana ramai di ${activeTempat?.name || "sini"}.`;
      else if (condition === "Antri") {
        const waitText = waitTime === 5 ? "pendek (<5 menit)" : waitTime === 15 ? "sedang (5-15 menit)" : "panjang (>15 menit)";
        autoDesc = `Antrian ${waitText} di ${activeTempat?.name || "sini"}.`;
      } else if (trafficCondition === "Lancar") autoDesc = `Lalu lintas lancar di ${activeTempat?.name || "sini"}.`;
      else if (trafficCondition === "Ramai") autoDesc = `Lalu lintas ramai di ${activeTempat?.name || "sini"}.`;
      else if (trafficCondition === "Macet") autoDesc = `Lalu lintas macet di ${activeTempat?.name || "sini"}.`;
      
      const finalDesc = caption.trim() || autoDesc;

      const { data, error } = await supabase.from("laporan_warga").insert([{
        tempat_id: activeTempat?.id ? parseInt(activeTempat.id) : null,
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
      }]).select();

      if (error) throw error;
      setStep("done");
      setTimeout(() => onSuccess(data[0]), 1200);
    } catch (err) {
      alert("Gagal kirim: " + err.message);
      setStep("form");
    }
  };

  const cardBg = theme?.isMalam ? "bg-black/80 border-white/10" : "bg-white border-gray-200";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      className={`mx-4 mb-4 rounded-2xl ${cardBg} border overflow-hidden flex flex-col shadow-xl`}
      style={{ maxHeight: "80vh" }}
    >
      <div className="h-1 bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500 flex-shrink-0" />
      
      <div className="flex flex-col flex-1 min-h-0">
        {/* HEADER */}
        {step === "pick_tempat" && (
          <div className="flex flex-col p-4 gap-3">
            <div className="flex items-center justify-between">
              <p className={`text-[13px] font-bold ${theme?.isMalam ? "text-white" : "text-slate-700"}`}>📍 Cerita dari mana, Lur?</p>
              <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-200 text-slate-400 text-sm">✕</button>
            </div>
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

        {/* UPLOAD - Camera Default */}
        {step === "upload" && (
          <div className="p-4">
            <CldUploadWidget
              uploadPreset="setempat_preset"
              onSuccess={handleUploadDone}
              options={{ 
                maxFiles: 1, 
                resourceType: "image", 
                sources: ["camera", "local"],  // camera pertama
                defaultSource: "camera",        // default camera
              }}
            >
              {({ open }) => (
                <button 
                  onClick={() => open()} 
                  className="w-full py-12 rounded-xl border-2 border-dashed border-slate-200 bg-white flex flex-col items-center gap-3 active:scale-95 transition-all"
                >
                  <span className="text-4xl">📸</span>
                  <span className="text-[12px] font-black text-slate-500 uppercase">Ambil Foto Keadaan</span>
                  <span className="text-[9px] text-slate-400">Kamera akan terbuka otomatis</span>
                </button>
              )}
            </CldUploadWidget>
            <button onClick={() => setStep("form")} className="w-full mt-3 text-[10px] font-bold text-slate-400 hover:text-emerald-500 transition-colors uppercase tracking-widest">
              Cerita Tanpa Foto →
            </button>
          </div>
        )}

        {/* FORM LAPORAN */}
        {step === "form" && (
          <div className="flex-1 overflow-y-auto px-4 pt-3 pb-2 space-y-3 min-h-0">
            {/* Preview foto jika ada */}
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

            {/* Pilihan Kondisi Tempat */}
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

            {/* Pilihan Waktu Antri */}
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

            {/* Pilihan Lalu Lintas - khusus jalan */}
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
        {(step === "form" || step === "upload") && step !== "sending" && step !== "done" && (
          <div className="flex-shrink-0 px-4 pt-2 pb-4 border-t border-slate-100">
            <button 
              onClick={handleSubmit} 
              disabled={(!condition && !trafficCondition) || (condition === "Antri" && !waitTime)}
              className={`w-full py-4 rounded-xl font-black uppercase text-[12px] tracking-widest transition-all
                ${(!condition && !trafficCondition) || (condition === "Antri" && !waitTime)
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg active:scale-[0.98]"
                }`}
            >
              Kirim Laporan
            </button>
          </div>
        )}

        {/* LOADING & SUCCESS */}
        {(step === "sending" || step === "done") && (
          <div className="p-8 flex flex-col items-center gap-3">
            {step === "sending" && (
              <>
                <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">Mengirim...</p>
              </>
            )}
            {step === "done" && (
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center gap-2">
                <span className="text-4xl">✅</span>
                <p className="text-[13px] font-black text-emerald-600 uppercase tracking-wider">Berhasil!</p>
                <p className="text-[11px] text-slate-400 text-center">Makasih ceritanya, Lur! Warga lain jadi tahu.</p>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}