"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CldUploadWidget } from "next-cloudinary";
import { supabase } from "@/lib/supabaseClient";
import { createPortal } from "react-dom";
import { Search, MapPin, Loader2, Building, Navigation } from "lucide-react";

export default function LaporPanel({
  onClose,
  onSuccess,
  theme = {},
  initialLatLng = null
}) {
  const [mediaUrl, setMediaUrl] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [condition, setCondition] = useState(null);
  const [incidentType, setIncidentType] = useState(null);
  const [caption, setCaption] = useState("");
  const [lokasiName, setLokasiName] = useState("");
  const [lokasiLat, setLokasiLat] = useState(initialLatLng?.lat || "");
  const [lokasiLng, setLokasiLng] = useState(initialLatLng?.lng || "");
  const [status, setStatus] = useState("idle");
  const [uploadProgress, setUploadProgress] = useState({
    cloudinary: false,
    supabase: false
  });

  // State untuk search campuran
  const [searchQuery, setSearchQuery] = useState("");
  const [nearbyPlaces, setNearbyPlaces] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const searchTimeoutRef = useRef(null);
  const hasLoadedNearby = useRef(false);

  // 🎨 Tema
  const textColor = theme?.isMalam ? "text-white" : "text-gray-900";
  const textMuted = theme?.isMalam ? "text-white/50" : "text-gray-500";
  const textLabel = theme?.isMalam ? "text-white/40" : "text-gray-400";
  const inputBg = theme?.isMalam ? "bg-white/5" : "bg-gray-50";
  const inputBorder = theme?.isMalam ? "border-white/10" : "border-gray-200";
  const inputText = theme?.isMalam ? "text-white" : "text-gray-900";
  const placeholderText = theme?.isMalam ? "placeholder:text-white/30" : "placeholder:text-gray-400";
  const cardBg = theme?.isMalam ? "bg-zinc-950 border-white/10" : "bg-white border-gray-200";
  const buttonGradient = "bg-gradient-to-r from-sky-500 to-blue-600";

  const currentTimeTag = () => {
    const h = new Date().getHours();
    if (h >= 5 && h < 11) return "Pagi";
    if (h >= 11 && h < 15) return "Siang";
    if (h >= 15 && h < 18) return "Sore";
    return "Malam";
  };

  // 📍 Ambil lokasi user (otomatis sekali saat pertama buka)
  const getUserLocation = () => {
    if (!navigator.geolocation) return;
    if (userLocation) return;

    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setUserLocation({ lat, lng });
        setIsGettingLocation(false);

        // Load rekomendasi tempat terdekat
        loadNearbyPlaces(lat, lng);
      },
      (error) => {
        console.error("Geolocation error:", error);
        setIsGettingLocation(false);
      },
      { timeout: 5000, enableHighAccuracy: false }
    );
  };

  // 🔍 Ambil rekomendasi tempat terdekat dari database
  const loadNearbyPlaces = async (lat, lng) => {
    try {
      const { data, error } = await supabase
        .rpc('find_nearest_places', {
          lat_input: lat,
          lng_input: lng,
          radius_meters: 500
        });

      if (error) throw error;
      setNearbyPlaces(data || []);
    } catch (err) {
      console.error("Error loading nearby places:", err);
      setNearbyPlaces([]);
    }
  };

  // 🔍 Cari lokasi dari Nominatim
  const searchNominatim = async (query) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1&countrycodes=id`
      );
      const data = await response.json();

      const results = data.map(item => ({
        id: `nominatim_${item.place_id}`,
        name: item.display_name.split(',')[0],
        fullName: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        source: 'nominatim',
        category: 'jalan'
      }));

      setSearchResults(results);
    } catch (error) {
      console.error("Error searching:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounce search
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    // Ambil lokasi user otomatis saat pertama kali
    if (!userLocation && !isGettingLocation && !hasLoadedNearby.current) {
      getUserLocation();
      hasLoadedNearby.current = true;
    }

    searchTimeoutRef.current = setTimeout(() => {
      if (searchQuery.length >= 2) {
        searchNominatim(searchQuery);
        setShowResults(true);
      } else {
        setSearchResults([]);
        setShowResults(false);
      }
    }, 400);

    return () => clearTimeout(searchTimeoutRef.current);
  }, [searchQuery]);

  // Pilih lokasi
  const selectLocation = (location) => {
    setLokasiName(location.name);
    setLokasiLat(location.lat.toString());
    setLokasiLng(location.lng.toString());
    setSearchQuery("");
    setSearchResults([]);
    setShowResults(false);
  };

  const showLoginNotification = () => {
    const toastNotif = document.createElement('div');
    toastNotif.className = `fixed top-20 left-1/2 -translate-x-1/2 z-[1000002] px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border bg-amber-950 border-amber-500/50 text-amber-100 animate-in`;
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
      alert("Pilih lokasi terlebih dahulu");
      return;
    }

    if (!condition && !incidentType) {
      alert("Pilih kondisi atau jenis kejadian terlebih dahulu");
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

      let finalDesc = caption.trim();
      if (!finalDesc) {
        if (condition) {
          finalDesc = `Lalu lintas ${condition} di ${lokasiName}.`;
        } else if (incidentType) {
          finalDesc = `Terjadi ${incidentType} di ${lokasiName}.`;
        }
      }

      setUploadProgress(prev => ({ ...prev, supabase: true }));

      const reportData = {
        tempat_id: null,
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
      };

      const { data, error } = await supabase
        .from("laporan_warga")
        .insert([reportData])
        .select()
        .single();

      if (error) throw error;

      setStatus("success");

      const toastNotif = document.createElement('div');
      toastNotif.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 z-[1000002] px-6 py-4 rounded-3xl shadow-2xl flex flex-col items-center gap-1 min-w-[280px] border text-center bg-sky-950 border-sky-500/50 text-sky-100';
      toastNotif.innerHTML = `
        <div class="text-2xl mb-1">🛣️</div>
        <span class="text-[12px] font-black uppercase tracking-widest">Laporan Terkirim</span>
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

  // Reset lokasi
  const resetLocation = () => {
    setLokasiName("");
    setLokasiLat("");
    setLokasiLng("");
    setSearchQuery("");
  };

  return createPortal(
    <>
      <AnimatePresence>
        {status === "uploading" && (
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
                Mengirim Laporan...
              </span>
            </div>
            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: uploadProgress.supabase ? "95%" : "45%" }}
                className="h-full bg-gradient-to-r from-sky-500 to-blue-500"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed inset-0 z-[999999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className={`w-full max-w-md rounded-3xl ${cardBg} border overflow-hidden flex flex-col shadow-2xl relative`}
          style={{ maxHeight: "90vh" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="h-1.5 w-full flex-shrink-0 bg-gradient-to-r from-sky-500 to-blue-500" />

          <div className="flex flex-col flex-1 min-h-0">
            {/* HEADER */}
            <div className={`flex-shrink-0 px-5 py-4 flex items-center justify-between border-b ${theme?.isMalam ? "border-white/10" : "border-gray-100"}`}>
              <div className="flex flex-col">
                <p className={`text-[13px] font-black truncate flex items-center gap-2 ${textColor}`}>
                  <span className="text-xl">📝</span>
                  Buat Laporan
                </p>
                <p className={`text-[9px] ${textMuted}`}>Laporkan kondisi sekitar</p>
              </div>
              <button onClick={onClose} className={`w-8 h-8 flex items-center justify-center rounded-full ${theme?.isMalam ? "bg-white/10 text-white/60 hover:bg-white/20" : "bg-gray-100 text-gray-500 hover:bg-gray-200"} transition-all`}>
                ✕
              </button>
            </div>

            {/* FORM SCROLLABLE */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 custom-scrollbar" style={{ maxHeight: "calc(90vh - 120px)" }}>

              {/* SEARCH LOKASI CAMPURAN */}
              <div className="space-y-2">
                <label className={`text-[10px] font-black uppercase tracking-wider ml-1 ${textLabel}`}>
                  📍 Cari Lokasi
                </label>

                <div className="relative">
                  <div className="relative">
                    <Search size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${textMuted}`} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onFocus={() => (nearbyPlaces.length > 0 || searchResults.length > 0) && setShowResults(true)}
                      placeholder="Ketik nama jalan, pasar, simpang, atau tempat..."
                      className={`w-full pl-10 pr-4 py-3 rounded-xl ${inputBg} border ${inputBorder} text-[13px] ${inputText} ${placeholderText} outline-none focus:ring-2 focus:ring-sky-500/20`}
                      autoFocus
                    />
                    {isSearching && (
                      <Loader2 size={16} className={`absolute right-3 top-1/2 -translate-y-1/2 animate-spin ${textMuted}`} />
                    )}
                  </div>

                  {/* HASIL CAMPURAN: Rekomendasi Terdekat + Hasil Nominatim */}
                  <AnimatePresence>
                    {showResults && (nearbyPlaces.length > 0 || searchResults.length > 0) && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={`absolute z-50 left-0 right-0 mt-1 rounded-xl border ${theme?.isMalam ? "bg-zinc-900 border-white/10" : "bg-white border-gray-200"} shadow-xl overflow-hidden max-h-80 overflow-y-auto`}
                      >
                        {/* REKOMENDASI TERDEKAT dari DATABASE */}
                        {nearbyPlaces.length > 0 && searchQuery.length < 3 && (
                          <div>
                            <div className={`px-4 py-2 ${theme?.isMalam ? "bg-white/5 text-white/40" : "bg-gray-50 text-gray-400"} text-[9px] font-bold uppercase tracking-wider`}>
                              🔥 Rekomendasi Terdekat
                            </div>
                            {nearbyPlaces.map((place) => (
                              <button
                                key={place.id}
                                onClick={() => selectLocation({ name: place.name, lat: place.lat, lng: place.lng })}
                                className={`w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-emerald-500/10 transition-all border-b ${theme?.isMalam ? "border-white/5" : "border-gray-100"}`}
                              >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${theme?.isMalam ? "bg-emerald-500/20" : "bg-emerald-100"}`}>
                                  <Building size={14} className="text-emerald-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-[13px] font-medium ${textColor} truncate`}>{place.name}</p>
                                  <p className={`text-[9px] ${textMuted}`}>
                                    📍 {Math.round(place.distance)}m • {place.category || "Tempat"}
                                  </p>
                                </div>
                                <span className="text-[9px] text-emerald-500">Pilih</span>
                              </button>
                            ))}
                          </div>
                        )}

                        {/* HASIL PENCARIAN dari NOMINATIM */}
                        {searchResults.length > 0 && (
                          <div>
                            {nearbyPlaces.length > 0 && searchQuery.length < 3 && (
                              <div className={`px-4 py-2 ${theme?.isMalam ? "bg-white/5 text-white/40" : "bg-gray-50 text-gray-400"} text-[9px] font-bold uppercase tracking-wider border-t ${theme?.isMalam ? "border-white/5" : "border-gray-100"}`}>
                                🔍 Hasil Pencarian
                              </div>
                            )}
                            {searchResults.map((result) => (
                              <button
                                key={result.id}
                                onClick={() => selectLocation(result)}
                                className={`w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-sky-500/10 transition-all border-b last:border-b-0 ${theme?.isMalam ? "border-white/5" : "border-gray-100"}`}
                              >
                                <MapPin size={16} className="text-sky-500 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className={`text-[13px] font-medium ${textColor} truncate`}>{result.name}</p>
                                  <p className={`text-[9px] ${textMuted} truncate`}>{result.fullName}</p>
                                </div>
                                <span className="text-[9px] text-sky-500">Pilih</span>
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Loading state */}
                        {isGettingLocation && nearbyPlaces.length === 0 && searchResults.length === 0 && (
                          <div className="px-4 py-8 text-center">
                            <Loader2 size={20} className="animate-spin mx-auto mb-2 text-sky-500" />
                            <p className={`text-[10px] ${textMuted}`}>Mendapatkan lokasi...</p>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Lokasi yang sudah dipilih */}
                {lokasiName && !searchQuery && (
                  <div className={`p-3 rounded-xl ${theme?.isMalam ? "bg-sky-500/10 border border-sky-500/20" : "bg-sky-50 border border-sky-200"}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className={`text-[12px] font-medium ${textColor}`}>
                          📌 {lokasiName}
                        </p>
                        {lokasiLat && lokasiLng && (
                          <p className={`text-[8px] ${textMuted} mt-1 font-mono`}>
                            {parseFloat(lokasiLat).toFixed(6)}, {parseFloat(lokasiLng).toFixed(6)}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={resetLocation}
                        className="text-[9px] text-red-400 hover:text-red-500 transition-colors"
                      >
                        Ganti
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* UPLOAD MEDIA */}
              <div className="space-y-2">
                <label className={`text-[10px] font-black uppercase tracking-wider ml-1 ${textLabel}`}>
                  📸 Foto / Video (opsional)
                </label>

                {mediaUrl ? (
                  <div className="relative group aspect-video rounded-2xl overflow-hidden shadow-md">
                    {mediaType === "image" ? (
                      <img src={mediaUrl} className="w-full h-full object-cover" alt="preview" />
                    ) : (
                      <video src={mediaUrl} className="w-full h-full object-cover" muted autoPlay loop playsInline />
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={() => { setMediaUrl(null); setMediaType(null); setUploadProgress(prev => ({ ...prev, cloudinary: false })); }}
                        className="px-4 py-2 bg-white/90 rounded-full text-[10px] font-black text-red-500"
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
                        className={`w-full aspect-video rounded-2xl border-2 border-dashed ${theme?.isMalam ? "border-white/20 bg-white/5 hover:bg-sky-500/10" : "border-gray-300 bg-gray-50 hover:bg-sky-50"} flex flex-col items-center justify-center gap-3 transition-all active:scale-95`}
                      >
                        <div className={`w-14 h-14 rounded-full ${theme?.isMalam ? "bg-white/10" : "bg-gray-100"} flex items-center justify-center text-2xl`}>
                          📷
                        </div>
                        <div className="text-center">
                          <p className={`text-[11px] font-medium ${theme?.isMalam ? "text-white/70" : "text-gray-600"}`}>Ambil Foto/Video</p>
                          <p className={`text-[8px] ${theme?.isMalam ? "text-white/30" : "text-gray-400"}`}>Bukti kondisi di lokasi</p>
                        </div>
                      </button>
                    )}
                  </CldUploadWidget>
                )}
              </div>

              {/* KONDISI */}
              <div className="space-y-2">
                <label className={`text-[10px] font-black uppercase tracking-wider ml-1 ${textLabel}`}>
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
                      <div className={`py-3 rounded-2xl border-2 ${theme?.isMalam ? "border-white/10 bg-white/5" : "border-gray-200 bg-gray-50"} text-center transition-all peer-checked:text-white peer-checked:scale-[1.02] peer-checked:border-transparent ${opt.color}`}>
                        <div className="text-xl mb-0.5">{opt.icon}</div>
                        <div className={`text-[10px] font-black uppercase ${theme?.isMalam ? "text-white/80" : "text-gray-700"}`}>{opt.val}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* KEJADIAN */}
              <div className="space-y-2">
                <label className={`text-[10px] font-black uppercase tracking-wider ml-1 ${textLabel}`}>
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
                      <div className={`py-2.5 rounded-xl border ${theme?.isMalam ? "border-white/10 bg-white/5" : "border-gray-200 bg-gray-50"} text-center transition-all peer-checked:text-white peer-checked:scale-[1.02] ${opt.color}`}>
                        <div className="text-base">{opt.icon}</div>
                        <div className={`text-[9px] font-bold uppercase ${theme?.isMalam ? "text-white/80" : "text-gray-700"}`}>{opt.val}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* KETERANGAN */}
              <div className="space-y-2">
                <label className={`text-[10px] font-black uppercase tracking-wider ml-1 ${textLabel}`}>
                  📝 Keterangan Tambahan
                </label>
                <textarea
                  placeholder="Contoh: Ada lubang besar di tengah jalan, antrean panjang, dll"
                  className={`w-full ${inputBg} border ${inputBorder} rounded-2xl px-4 py-3 text-[13px] ${inputText} ${placeholderText} outline-none focus:ring-2 focus:ring-sky-500/20 min-h-[80px] resize-none`}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                />
              </div>
            </div>

            {/* FOOTER */}
            <div className={`flex-shrink-0 p-5 border-t ${theme?.isMalam ? "border-white/10 bg-white/5" : "border-gray-100 bg-gray-50"}`}>
              <button
                onClick={finalizeReport}
                disabled={(!lokasiName.trim() && !lokasiLat && !lokasiLng) || (!condition && !incidentType) || status === "uploading"}
                className={`w-full py-4 rounded-2xl font-black uppercase text-[12px] tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-xl ${(!lokasiName.trim() && !lokasiLat && !lokasiLng) || (!condition && !incidentType) || status === "uploading"
                  ? `${inputBg} ${textMuted} cursor-not-allowed shadow-none`
                  : `${buttonGradient} text-white active:scale-95`
                  }`}
              >
                {status === "uploading" ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>Kirim Laporan</>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: ${theme?.isMalam ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: ${theme?.isMalam ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}; border-radius: 10px; }
        
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
    </>,
    document.body
  );
}