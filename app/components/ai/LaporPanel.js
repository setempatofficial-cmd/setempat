"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CldUploadWidget } from "next-cloudinary";
import { supabase } from "@/lib/supabaseClient";
import { createPortal } from "react-dom";

// KATEGORI
const QUEUE_CATEGORIES = ['kuliner', 'transportasi', 'pasar'];
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
  // 🚀 OPTIMASI 1: Gabungkan state yang sering berubah bersamaan
  const [formState, setFormState] = useState(() => ({
    step: (!tempat?.id) ? "pick_tempat" : (mode === "text" ? "form" : (initialMediaUrl ? "form" : "upload")),
    mediaUrl: initialMediaUrl,
    mediaType: initialMediaType,
    condition: null,
    trafficCondition: null,
    waitTime: null,
    caption: "",
    status: "idle",
  }));

  // Pisahkan state yang jarang berubah
  const [pickedTempat, setPickedTempat] = useState(tempat || null);
  const [tempatList, setTempatList] = useState([]);
  const [tempatQuery, setTempatQuery] = useState("");
  const [showNominatim, setShowNominatim] = useState(false);
  const [nominatimResults, setNominatimResults] = useState([]);

  // 🚀 OPTIMASI 2: Cache untuk hasil pencarian
  const tempatCache = useRef(new Map());
  const nominatimCache = useRef(new Map());
  const debounceTimer = useRef(null);
  const abortController = useRef(null);

  // 🚀 OPTIMASI 3: Hapus animasi yang tidak perlu
  const MotionDiv = motion.div;
  const MotionDivSimple = ({ children, ...props }) => (
    <div {...props}>{children}</div>
  );

  // 🚀 OPTIMASI 4: Fungsi ringan tanpa useCallback berlebihan
  const getCurrentTimeTag = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return "Pagi";
    if (hour >= 11 && hour < 15) return "Siang";
    if (hour >= 15 && hour < 18) return "Sore";
    return "Malam";
  };

  // 🚀 OPTIMASI 5: Simple object lookup
  const ESTIMATED_PEOPLE = {
    Sepi: { Pagi: 3, Siang: 5, Sore: 4, Malam: 2 },
    Ramai: { Pagi: 12, Siang: 25, Sore: 20, Malam: 15 },
    Antri: { Pagi: 8, Siang: 15, Sore: 12, Malam: 10 }
  };

  const getEstimatedPeople = (condition, timeTag) => {
    return ESTIMATED_PEOPLE[condition]?.[timeTag] ||
      (condition === "Sepi" ? 4 : condition === "Ramai" ? 20 : 12);
  };

  // 🚀 OPTIMASI 6: Fetch dengan caching dan abort
  const fetchTempatList = async (searchQuery = "") => {
    // Cek cache dulu
    const cacheKey = searchQuery || "all";
    if (tempatCache.current.has(cacheKey)) {
      setTempatList(tempatCache.current.get(cacheKey));
      return;
    }

    // Batalkan request sebelumnya
    if (abortController.current) {
      abortController.current.abort();
    }
    abortController.current = new AbortController();

    try {
      let query = supabase
        .from("tempat")
        .select("id, name, category, alamat, latitude, longitude")
        .limit(20); // Kurangi limit dari 30 ke 20

      if (searchQuery.trim()) {
        query = query.ilike('name', `%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Simpan ke cache
      tempatCache.current.set(cacheKey, data || []);
      setTempatList(data || []);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error("Error fetching places:", err);
        setTempatList([]);
      }
    }
  };

  // 🚀 OPTIMASI 7: Search dengan debounce lebih cepat (300ms)
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(() => {
      if (tempatQuery.length > 1 || tempatQuery === "") {
        fetchTempatList(tempatQuery);

        if (tempatQuery.length >= 3 && showNominatim) {
          searchNominatimFast(tempatQuery);
        } else {
          setNominatimResults([]);
        }
      }
    }, 300); // Turun dari 400 ke 300

    return () => clearTimeout(debounceTimer.current);
  }, [tempatQuery, showNominatim]);

  // 🚀 OPTIMASI 8: Nominatim dengan timeout dan cache
  const searchNominatimFast = async (query) => {
    if (!query.trim() || query.length < 3) return;

    // Cek cache
    if (nominatimCache.current.has(query)) {
      setNominatimResults(nominatimCache.current.get(query));
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // Timeout 3 detik

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

      // Simpan ke cache
      nominatimCache.current.set(query, results);
      setNominatimResults(results);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error("Nominatim error:", error);
      }
      setNominatimResults([]);
    }
  };

  // 🚀 OPTIMASI 9: Notifikasi lebih ringan
  const showLoginNotification = () => {
    const toastNotif = document.createElement('div');
    toastNotif.className = 'fixed top-20 left-1/2 -translate-x-1/2 z-[1000002] px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 border bg-amber-950 border-amber-500/50 text-amber-100';
    toastNotif.innerHTML = `
      <span>🔐</span>
      <span class="text-[11px] font-bold">Perlu Login</span>
      <button class="px-2 py-1 bg-amber-500/20 rounded-lg text-[9px] font-bold">Login</button>
    `;
    toastNotif.querySelector('button')?.addEventListener('click', () => {
      window.location.href = '/login';
    });
    document.body.appendChild(toastNotif);
    setTimeout(() => toastNotif.remove(), 3000);
  };

  // 🚀 OPTIMASI 10: Finalize upload tanpa state berlebihan
  const finalizeUpload = async () => {
    const { condition, trafficCondition, waitTime, caption, mediaUrl, mediaType } = formState;
    const isNominatimLocation = pickedTempat?.source === 'nominatim';
    const activeTempat = pickedTempat || tempat;

    // Validasi cepat
    if (!activeTempat?.id && !isNominatimLocation) {
      alert("Pilih lokasi dulu");
      return;
    }

    if (!isNominatimLocation && !condition && !trafficCondition) {
      alert("Pilih kondisi");
      return;
    }

    if (condition === "Antri" && !waitTime) {
      alert("Pilih waktu antrian");
      return;
    }

    if (formState.status === "uploading") return;

    setFormState(prev => ({ ...prev, status: "uploading" }));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Login needed");

      const currentTimeTag = getCurrentTimeTag();
      const estimatedPeople = condition ? getEstimatedPeople(condition, currentTimeTag) : null;
      const finalDesc = caption.trim() || getConditionDescription(condition, waitTime, trafficCondition, activeTempat?.name);

      const reportData = {
        tempat_id: !isNominatimLocation && activeTempat?.id ? parseInt(activeTempat.id) : null,
        user_id: session.user.id,
        user_name: session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Warga",
        username: session.user.user_metadata?.username || session.user.email?.split("@")[0],
        user_avatar: session.user.user_metadata?.avatar_url || null,
        photo_url: mediaUrl ? (mediaType === "video" ? mediaUrl.replace(/\.[^/.]+$/, ".jpg") : mediaUrl) : null,
        video_url: mediaType === "video" ? mediaUrl : null,
        media_type: mediaType || "text",
        time_tag: currentTimeTag,
        tipe: condition || (trafficCondition ? "Lalu Lintas" : null),
        estimated_people: estimatedPeople,
        estimated_wait_time: condition === "Antri" ? waitTime : null,
        traffic_condition: trafficCondition,
        deskripsi: finalDesc,
        content: caption.trim(),
        status: "approved",
        lokasi_name: isNominatimLocation ? activeTempat.name : null,
        lokasi_lat: isNominatimLocation ? activeTempat.latitude : null,
        lokasi_lng: isNominatimLocation ? activeTempat.longitude : null,
        report_type: isNominatimLocation ? 'general_location' : 'place',
      };

      const { error } = await supabase
        .from("laporan_warga")
        .insert([reportData])
        .select()
        .single();

      if (error) throw error;

      // Toast success ringan
      const toast = document.createElement('div');
      toast.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 z-[1000002] px-4 py-2 rounded-xl bg-emerald-950 border border-emerald-500/50 text-emerald-100 text-[11px] font-bold';
      toast.textContent = '✅ Laporan Terkirim!';
      document.body.appendChild(toast);

      setTimeout(() => {
        toast.remove();
        onSuccess?.();
        onClose();
      }, 1000);

    } catch (err) {
      console.error(err);
      alert("Gagal mengirim");
      setFormState(prev => ({ ...prev, status: "idle" }));
    }
  };

  const getConditionDescription = (condition, waitTime, traffic, name) => {
    if (condition === "Sepi") return `Suasana tenang di ${name || "sini"}.`;
    if (condition === "Ramai") return `Suasana ramai di ${name || "sini"}.`;
    if (condition === "Antri") {
      const waitText = waitTime === 5 ? "pendek" : waitTime === 15 ? "sedang" : "panjang";
      return `Antrian ${waitText} di ${name || "sini"}.`;
    }
    if (traffic) {
      const text = traffic === 'Lancar' ? 'lancar' : traffic === 'Ramai' ? 'ramai' : 'macet';
      return `Lalu lintas ${text} di ${name || "sini"}.`;
    }
    return `Update dari ${name || "sini"}.`;
  };

  // 🚀 OPTIMASI 11: Memo sederhana
  const kategoriLower = (pickedTempat?.category || tempat?.category || "").toLowerCase();
  const namaLower = (pickedTempat?.name || tempat?.name || "").toLowerCase();

  const hasQueue = QUEUE_CATEGORIES.some(k => kategoriLower.includes(k));
  const hasTraffic = TRAFFIC_CATEGORIES.some(k => kategoriLower.includes(k) || namaLower.includes(k));
  const isNominatimLocation = pickedTempat?.source === 'nominatim';
  const activeTempat = pickedTempat || tempat;
  const currentTimeTag = getCurrentTimeTag();

  const handleUploadDone = (res) => {
    if (res?.event === "success") {
      setFormState(prev => ({
        ...prev,
        mediaType: res.info?.resource_type,
        mediaUrl: res.info.secure_url,
        step: "form"
      }));
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
    setFormState(prev => ({ ...prev, step: mode === "text" ? "form" : "upload" }));
    setTempatQuery("");
  };

  const allResults = [...tempatList, ...nominatimResults];
  const cardBg = theme?.isMalam ? "bg-zinc-950 border-white/10" : "bg-white border-gray-200";
  const isFormDisabled = (isNominatimLocation && !formState.trafficCondition) ||
    (!isNominatimLocation && !formState.condition && !formState.trafficCondition) ||
    (formState.condition === "Antri" && !formState.waitTime) ||
    formState.status === "uploading";

  return (
    <>
      {/* Toast Upload - Hanya muncul jika uploading */}
      {formState.status === "uploading" && createPortal(
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[1000002] bg-black/80 backdrop-blur px-4 py-2 rounded-full text-white text-[11px] font-bold flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
          Mengirim...
        </div>,
        document.body
      )}

      {/* Main Panel - Tanpa animasi berat */}
      <div
        className={`mx-4 mb-4 rounded-3xl ${cardBg} border overflow-hidden flex flex-col shadow-2xl relative`}
        style={{ maxHeight: "85vh" }}
      >
        <div className={`h-1 w-full flex-shrink-0 ${formState.mediaUrl ? 'bg-gradient-to-r from-indigo-500 to-purple-500' : 'bg-gradient-to-r from-emerald-400 to-teal-500'}`} />

        <div className="flex flex-col flex-1 min-h-0">
          {/* STEP PICK TEMPAT */}
          {formState.step === "pick_tempat" && (
            <div className="flex flex-col p-4 gap-3">
              <div className="flex justify-between items-center">
                <h3 className={`text-sm font-black ${theme?.isMalam ? "text-white" : "text-slate-800"}`}>Pilih Lokasi</h3>
                <button onClick={onClose} className="w-7 h-7 rounded-full bg-slate-100 text-slate-400 text-sm">✕</button>
              </div>

              <input
                type="text"
                value={tempatQuery}
                onChange={e => setTempatQuery(e.target.value)}
                placeholder="Cari tempat atau jalan..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500/20 bg-slate-50/50 outline-none"
                autoFocus
              />

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showNominatim}
                  onChange={(e) => setShowNominatim(e.target.checked)}
                  className="w-3.5 h-3.5 rounded"
                />
                <span className="text-[9px] text-slate-500">🔍 Cari di peta (jalan, simpang)</span>
              </label>

              <div className="overflow-y-auto max-h-[45vh] space-y-1.5">
                {allResults.map(t => (
                  <button
                    key={t.id}
                    onClick={() => selectLocation(t)}
                    className="w-full flex items-center gap-2 p-2 rounded-xl bg-slate-50 hover:bg-emerald-50 text-left transition-colors"
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

          {/* STEP UPLOAD */}
          {formState.step === "upload" && (
            <div className="p-4">
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
                    onClick={() => open()}
                    className="w-full aspect-video rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-2 hover:bg-indigo-50 transition-colors"
                  >
                    <span className="text-3xl">📸</span>
                    <span className="text-[11px] font-bold text-slate-700">Ambil Foto/Video</span>
                  </button>
                )}
              </CldUploadWidget>

              <div className="relative py-3 flex items-center">
                <div className="flex-1 h-px bg-slate-100" />
                <span className="px-3 text-[9px] text-slate-300">ATAU</span>
                <div className="flex-1 h-px bg-slate-100" />
              </div>

              <button
                onClick={() => setFormState(prev => ({ ...prev, step: "form" }))}
                className="w-full py-3 rounded-xl border border-slate-200 text-[10px] font-bold text-slate-500 hover:bg-slate-50"
              >
                Lapor Tulisan Saja →
              </button>
            </div>
          )}

          {/* STEP FORM */}
          {formState.step === "form" && (
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              {formState.mediaUrl && (
                <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-100">
                  {formState.mediaType === "image" ? (
                    <img src={formState.mediaUrl} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <video src={formState.mediaUrl} className="w-full h-full object-cover" muted autoPlay loop playsInline />
                  )}
                </div>
              )}

              <textarea
                placeholder="Keterangan (opsional)..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs min-h-[70px] resize-none focus:ring-2 focus:ring-emerald-500/20 outline-none"
                value={formState.caption}
                onChange={(e) => setFormState(prev => ({ ...prev, caption: e.target.value }))}
              />

              {/* Kondisi Tempat */}
              {!isNominatimLocation && (
                <div className="space-y-2">
                  <div className="text-[9px] font-bold text-slate-400 uppercase">Status Tempat</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { label: "Sepi", val: "Sepi", icon: "🍃" },
                      { label: "Ramai", val: "Ramai", icon: "🏃" },
                      ...(hasQueue ? [{ label: "Antri", val: "Antri", icon: "⏳" }] : [])
                    ].map(c => (
                      <button
                        key={c.val}
                        onClick={() => setFormState(prev => ({ ...prev, condition: c.val, trafficCondition: null, waitTime: null }))}
                        className={`py-2.5 rounded-xl text-[10px] font-bold border-2 transition-all ${formState.condition === c.val ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-100 text-slate-500'}`}
                      >
                        <span className="text-base block">{c.icon}</span>
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Waktu Antri */}
              {formState.condition === "Antri" && (
                <div className="grid grid-cols-3 gap-1.5">
                  {[5, 15, 20].map(v => (
                    <button
                      key={v}
                      onClick={() => setFormState(prev => ({ ...prev, waitTime: v }))}
                      className={`py-2 rounded-lg text-[9px] font-bold border ${formState.waitTime === v ? 'bg-cyan-500 border-cyan-500 text-white' : 'bg-white border-slate-100 text-slate-400'}`}
                    >
                      {v === 5 ? "<5m" : v === 15 ? "5-15m" : ">15m"}
                    </button>
                  ))}
                </div>
              )}

              {/* Lalu Lintas */}
              {(hasTraffic || isNominatimLocation) && (
                <div className="space-y-2">
                  <div className="text-[9px] font-bold text-slate-400 uppercase">Lalu Lintas</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { val: "Lancar", icon: "🛵" },
                      { val: "Ramai", icon: "🚗" },
                      { val: "Macet", icon: "🚦" }
                    ].map(opt => (
                      <button
                        key={opt.val}
                        onClick={() => setFormState(prev => ({ ...prev, trafficCondition: opt.val, condition: null }))}
                        className={`py-2.5 rounded-xl text-[10px] font-bold border-2 transition-all ${formState.trafficCondition === opt.val ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-100 text-slate-500'}`}
                      >
                        <span className="text-base block">{opt.icon}</span>
                        {opt.val}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* FOOTER */}
          {(formState.step === "form" || formState.step === "upload") && (
            <div className="p-4 border-t border-slate-100">
              <button
                onClick={finalizeUpload}
                disabled={isFormDisabled}
                className={`w-full py-3.5 rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all ${isFormDisabled ? 'bg-slate-100 text-slate-300' : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white active:scale-95'}`}
              >
                Kirim Laporan
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}