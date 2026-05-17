// app/components/feed/LaporJalanPanel.js
"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CldUploadWidget } from "next-cloudinary";
import { supabase } from "@/lib/supabaseClient";
import { createPortal } from "react-dom";

export default function LaporJalanPanel({ 
  onClose, 
  onSuccess, 
  theme = {},
  initialLatLng = null // opsional, dari lokasi user
}) {
  const [mediaUrl, setMediaUrl] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [condition, setCondition] = useState(null); // Lancar, Ramai, Macet
  const [incidentType, setIncidentType] = useState(null); // Kecelakaan, Jalan Rusak, Banjir, Lainnya
  const [caption, setCaption] = useState("");
  const [lokasiName, setLokasiName] = useState("");
  const [lokasiLat, setLokasiLat] = useState(initialLatLng?.lat || "");
  const [lokasiLng, setLokasiLng] = useState(initialLatLng?.lng || "");
  const [status, setStatus] = useState("idle");
  const [uploadProgress, setUploadProgress] = useState({
    cloudinary: false,
    supabase: false
  });
  const [isUsingCurrentLocation, setIsUsingCurrentLocation] = useState(false);

  const currentTimeTag = () => {
    const h = new Date().getHours();
    if (h >= 5 && h < 11) return "Pagi";
    if (h >= 11 && h < 15) return "Siang";
    if (h >= 15 && h < 18) return "Sore";
    return "Malam";
  };

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

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Browser Anda tidak mendukung geolocation");
      return;
    }

    setIsUsingCurrentLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLokasiLat(position.coords.latitude.toString());
        setLokasiLng(position.coords.longitude.toString());
        setIsUsingCurrentLocation(false);
        
        // Optional: Reverse geocoding untuk dapat nama jalan
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}&zoom=18&addressdetails=1`)
          .then(res => res.json())
          .then(data => {
            if (data.display_name) {
              const shortName = data.display_name.split(',')[0];
              setLokasiName(shortName);
            }
          })
          .catch(console.error);
      },
      (error) => {
        setIsUsingCurrentLocation(false);
        alert("Gagal mendapatkan lokasi: " + error.message);
      }
    );
  };

  const handleUploadDone = (res) => {
    if (res?.event === "success") {
      setMediaType(res.info?.resource_type);
      setMediaUrl(res.info.secure_url);
      setUploadProgress(prev => ({ ...prev, cloudinary: true }));
    } else if (res?.event === "error") {
      alert("Gagal upload gambar. Coba lagi nanti.");
    }
  };

  const finalizeReport = async () => {
    if (!lokasiName.trim() && (!lokasiLat || !lokasiLng)) {
      alert("Masukkan nama lokasi atau gunakan lokasi saat ini");
      return;
    }
    
    if (!condition && !incidentType) {
      alert("Pilih kondisi jalan atau jenis kejadian terlebih dahulu");
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
        showLoginNotification();
        throw new Error("Silakan login kembali");
      }
      
      const u = session.user;
      const meta = u.user_metadata || {};
      
      // Buat deskripsi otomatis
      let finalDesc = caption.trim();
      if (!finalDesc) {
        if (condition) {
          finalDesc = `Lalu lintas ${condition} di ${lokasiName || "lokasi ini"}.`;
        } else if (incidentType) {
          finalDesc = `Terjadi ${incidentType} di ${lokasiName || "lokasi ini"}.`;
        }
      }
      
      setUploadProgress(prev => ({ ...prev, supabase: true }));
      
      const { data, error } = await supabase
        .from("laporan_warga")
        .insert([{
          tempat_id: null, // NULL karena ini laporan jalan/umum
          user_id: u.id,
          user_name: meta.full_name || meta.name || u.email?.split("@")[0] || "Warga",
          username: session.user.user_metadata?.username || u.email?.split("@")[0],
          user_avatar: meta.avatar_url || meta.picture || null,
          photo_url: mediaUrl ? (mediaType === "video" ? mediaUrl.replace(/\.[^/.]+$/, ".jpg") : mediaUrl) : null,
          video_url: mediaType === "video" ? mediaUrl : null,
          media_type: mediaType || "text",
          time_tag: currentTimeTag(),
          tipe: condition || incidentType || "Laporan Umum",
          traffic_condition: condition,
          incident_type: incidentType,
          deskripsi: finalDesc,
          content: caption.trim(),
          lokasi_name: lokasiName.trim(),
          lokasi_lat: lokasiLat ? parseFloat(lokasiLat) : null,
          lokasi_lng: lokasiLng ? parseFloat(lokasiLng) : null,
          report_type: "general_location",
          status: "approved",
        }])
        .select()
        .single();
      
      if (error) throw error;
      
      setStatus("success");
      
      const toastNotif = document.createElement('div');
      toastNotif.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 z-[1000002] px-6 py-4 rounded-3xl shadow-2xl flex flex-col items-center gap-1 min-w-[280px] border text-center bg-sky-950 border-sky-500/50 text-sky-100';
      toastNotif.innerHTML = `
        <div class="text-2xl mb-1">🛣️</div>
        <span class="text-[12px] font-black uppercase tracking-widest">Laporan Jalan Terkirim</span>
        <span class="text-[10px] opacity-70">Terima kasih membantu warga lain!</span>
      `;
      document.body.appendChild(toastNotif);
      
      setTimeout(() => {
        setStatus("idle");
        toastNotif.remove();
        onSuccess?.(data);
        onClose();
      }, 1500);
      
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
                <div className="absolute inset-0 border-2 border-sky-500/20 rounded-full" />
                <div className="absolute inset-0 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
              </div>
              <span className="text-[11px] font-black uppercase tracking-widest text-sky-400">
                Mengirim Laporan Jalan...
              </span>
            </div>
            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: uploadProgress.supabase ? "95%" : "45%" }}
                className="h-full bg-gradient-to-r from-sky-500 to-blue-500"
              />
            </div>
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
        <div className="h-1.5 w-full flex-shrink-0 bg-gradient-to-r from-sky-500 to-blue-500" />
        
        <div className="flex flex-col flex-1 min-h-0">
          {/* HEADER */}
          <div className="flex-shrink-0 px-5 py-4 flex items-center justify-between border-b border-white/10">
            <div className="flex flex-col">
              <p className="text-[13px] font-black text-white truncate flex items-center gap-2">
                <span className="text-xl">🛣️</span>
                Laporan Jalan / Umum
              </p>
              <p className="text-[9px] text-white/40">Laporkan kondisi jalan, kecelakaan, dll</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white/60">
              ✕
            </button>
          </div>

          {/* FORM SCROLLABLE */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 custom-scrollbar">
            
            {/* LOKASI */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-white/50 uppercase tracking-wider ml-1">
                📍 Lokasi Kejadian
              </label>
              
              <button
                onClick={getCurrentLocation}
                disabled={isUsingCurrentLocation}
                className="w-full py-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[11px] font-bold flex items-center justify-center gap-2 active:scale-98 transition-all"
              >
                {isUsingCurrentLocation ? (
                  <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>📍 Gunakan Lokasi Saya</>
                )}
              </button>
              
              <input
                type="text"
                placeholder="Nama lokasi (contoh: Simpang Tugu, Jalan Sudirman KM 5)"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[13px] text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-sky-500/20"
                value={lokasiName}
                onChange={(e) => setLokasiName(e.target.value)}
              />
              
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Latitude (opsional)"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-[12px] text-white placeholder:text-white/30 outline-none"
                  value={lokasiLat}
                  onChange={(e) => setLokasiLat(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Longitude (opsional)"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-[12px] text-white placeholder:text-white/30 outline-none"
                  value={lokasiLng}
                  onChange={(e) => setLokasiLng(e.target.value)}
                />
              </div>
            </div>

            {/* UPLOAD MEDIA */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-white/50 uppercase tracking-wider ml-1">
                📸 Foto / Video (opsional)
              </label>
              
              {mediaUrl ? (
                <div className="relative group aspect-video rounded-2xl overflow-hidden shadow-md ring-4 ring-white/5">
                  {mediaType === "image" ? (
                    <img src={mediaUrl} className="w-full h-full object-cover" alt="preview" />
                  ) : (
                    <video src={mediaUrl} className="w-full h-full object-cover" muted autoPlay loop playsInline />
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button 
                      onClick={() => { setMediaUrl(null); setMediaType(null); setUploadProgress(prev => ({ ...prev, cloudinary: false })); }}
                      className="px-4 py-2 bg-white/90 rounded-full text-[10px] font-black text-red-500 shadow-xl"
                    >HAPUS</button>
                  </div>
                </div>
              ) : (
                <CldUploadWidget
                  uploadPreset="setempat_preset"
                  onSuccess={handleUploadDone}
                  options={{ 
                    maxFiles: 1, 
                    resourceType: "auto",
                    sources: ["camera", "local"],
                    maxImageFileSize: 5000000,
                  }}
                >
                  {({ open }) => (
                    <button 
                      onClick={() => open?.()}
                      className="w-full aspect-video rounded-2xl border-2 border-dashed border-white/20 bg-white/5 flex flex-col items-center justify-center gap-3 hover:bg-sky-500/10 hover:border-sky-500/30 transition-all active:scale-95 group"
                    >
                      <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                        📷
                      </div>
                      <div className="text-center">
                        <p className="text-[11px] font-medium text-white/70">Ambil Foto/Video</p>
                        <p className="text-[8px] text-white/30">Bukti kondisi di lokasi</p>
                      </div>
                    </button>
                  )}
                </CldUploadWidget>
              )}
            </div>

            {/* KONDISI JALAN */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-white/50 uppercase tracking-wider ml-1">
                🚦 Kondisi Lalu Lintas
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { val: "Lancar", icon: "🛵", color: "peer-checked:bg-emerald-500" },
                  { val: "Ramai", icon: "🚗", color: "peer-checked:bg-amber-500" },
                  { val: "Macet", icon: "🚦", color: "peer-checked:bg-rose-500" }
                ].map((opt) => (
                  <label key={opt.val} className="cursor-pointer">
                    <input 
                      type="radio" 
                      name="traffic" 
                      className="hidden peer" 
                      checked={condition === opt.val} 
                      onChange={() => { setCondition(opt.val); setIncidentType(null); }} 
                    />
                    <div className={`py-3 rounded-2xl border-2 border-white/10 bg-white/5 text-center transition-all peer-checked:text-white peer-checked:scale-[1.02] peer-checked:border-transparent ${opt.color}`}>
                      <div className="text-xl mb-0.5">{opt.icon}</div>
                      <div className="text-[10px] font-black uppercase">{opt.val}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* JENIS KEJADIAN */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-white/50 uppercase tracking-wider ml-1">
                ⚠️ Jenis Kejadian (opsional)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { val: "Kecelakaan", icon: "💥", color: "peer-checked:bg-red-500" },
                  { val: "Jalan Rusak", icon: "🕳️", color: "peer-checked:bg-orange-500" },
                  { val: "Banjir", icon: "🌊", color: "peer-checked:bg-blue-500" },
                  { val: "Lainnya", icon: "📢", color: "peer-checked:bg-purple-500" }
                ].map((opt) => (
                  <label key={opt.val} className="cursor-pointer">
                    <input 
                      type="radio" 
                      name="incident" 
                      className="hidden peer" 
                      checked={incidentType === opt.val} 
                      onChange={() => { setIncidentType(opt.val); setCondition(null); }} 
                    />
                    <div className={`py-2.5 rounded-xl border border-white/10 bg-white/5 text-center transition-all peer-checked:text-white peer-checked:scale-[1.02] ${opt.color}`}>
                      <div className="text-base">{opt.icon}</div>
                      <div className="text-[9px] font-bold uppercase">{opt.val}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* KETERANGAN */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-white/50 uppercase tracking-wider ml-1">
                📝 Keterangan Tambahan
              </label>
              <textarea
                placeholder="Contoh: Ada lubang besar di tengah jalan, antrean panjang, dll"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-[13px] text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-sky-500/20 min-h-[80px] resize-none"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
              />
            </div>
          </div>

          {/* FOOTER BUTTON */}
          <div className="p-5 border-t border-white/10 bg-white/5">
            <button 
              onClick={finalizeReport} 
              disabled={(!lokasiName.trim() && !lokasiLat && !lokasiLng) || (!condition && !incidentType) || status === "uploading"}
              className={`w-full py-4 rounded-2xl font-black uppercase text-[12px] tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-xl ${
                (!lokasiName.trim() && !lokasiLat && !lokasiLng) || (!condition && !incidentType) || status === "uploading"
                  ? "bg-white/5 text-white/20 cursor-not-allowed shadow-none"
                  : "bg-gradient-to-r from-sky-500 to-blue-600 text-white active:scale-95"
              }`}
            >
              {status === "uploading" ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>Kirim Laporan Jalan</>
              )}
            </button>
          </div>
        </div>
      </motion.div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 10px; }
        
        .animate-in {
          animation: slideInFromTop 0.3s ease-out;
        }
        
        @keyframes slideInFromTop {
          from { opacity: 0; transform: translate(-50%, -20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
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