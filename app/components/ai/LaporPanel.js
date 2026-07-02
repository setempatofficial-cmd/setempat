"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CldUploadWidget } from "next-cloudinary";
import { supabase } from "@/lib/supabaseClient";
import DOMPurify from 'dompurify';
import { MapPin, Camera, Send, Sparkles, Search } from "lucide-react";
import { useLocationCache } from '@/lib/hooks/useLocationCache';

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

export default function LaporPanel({
  tempat,
  onClose,
  onSuccess,
  mode = "media",
  initialMediaUrl = null,
  initialMediaType = null
}) {
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

  // STATE UNTUK PENCARIAN (DI BAWAH)
  const [tempatList, setTempatList] = useState([]);
  const [tempatQuery, setTempatQuery] = useState("");
  const [nominatimResults, setNominatimResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const [isTextOnly, setIsTextOnly] = useState(false);

  // AI STATE
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [isAiDetecting, setIsAiDetecting] = useState(false);
  const [aiError, setAiError] = useState(null);

  const timeoutRef = useRef(null);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);
  const aiDebounceRef = useRef(null);

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

  // Get user session untuk caching
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
      }
    };
    getUser();
  }, []);

  // Hook caching
  const {
    cachedLocations,
    saveToCache,
    getFromCache,
    removeFromCache,
    clearCache
  } = useLocationCache(userId);

  // Cleanup
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current?.abort();
      if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current);
    };
  }, []);

  // ============================================
  // FUNGSI FETCH TEMPAT (DENGAN CACHE)
  // ============================================
  const fetchTempatList = async (searchQuery = "") => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    try {
      // 1. Cek CACHE dulu
      if (searchQuery.trim().length >= 2) {
        const cachedResults = getFromCache(searchQuery.trim());
        if (cachedResults.length > 0) {
          setTempatList(cachedResults.map(item => ({
            ...item,
            fromCache: true,
            isCached: true
          })));
          return;
        }
      }

      // 2. Jika tidak ada di cache, cari di database
      let query = supabase.from("tempat").select("id, name, category, alamat, latitude, longitude").limit(20);
      if (searchQuery.trim()) query = query.ilike('name', `%${searchQuery}%`);

      const { data, error } = await query;
      if (!error && data) {
        setTempatList(data);
        if (data.length > 0) {
          data.forEach(location => saveToCache(location));
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') console.error(err);
    }
  };

  // ============================================
  // FUNGSI SEARCH NOMINATIM
  // ============================================
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

  // ============================================
  // FUNGSI SELECT LOCATION (DENGAN CACHE)
  // ============================================
  const selectLocation = (location) => {
    const isFromNominatim = location.source === 'nominatim' || location.id?.toString().startsWith('nominatim_');

    setPickedTempat({
      id: location.id,
      name: location.name,
      category: location.category || 'tempat',
      alamat: location.fullName || location.alamat || location.name,
      latitude: location.lat || location.latitude,
      longitude: location.lng || location.longitude,
      source: isFromNominatim ? 'nominatim' : (location.source || 'database')
    });

    // SAVE KE CACHE
    if (location.id && location.name) {
      saveToCache(location);
    }

    setShowPickTempat(false);
    setTempatQuery("");
    setAiSuggestions([]);
    setAiError(null);
    setTempatList([]);
    setNominatimResults([]);
  };

  // PENCARIAN MANUAL - DI BAWAH
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      if (tempatQuery.length < 2) {
        setTempatList([]);
        setNominatimResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      await fetchTempatList(tempatQuery);

      if (tempatQuery.length >= 3 && tempatList.length < 2) {
        await searchNominatim(tempatQuery);
      } else {
        setNominatimResults([]);
      }
      setIsSearching(false);
    }, 500);
  }, [tempatQuery]);

  // ============================================
  // AI DETECTION - TETAP SAMA SEPERTI SEBELUMNYA
  // ============================================
  useEffect(() => {
    if (!showPickTempat || content.length < 10) {
      setAiSuggestions([]);
      setAiError(null);
      return;
    }

    if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current);

    aiDebounceRef.current = setTimeout(async () => {
      await detectLocationWithAI(content);
    }, 1000);

    return () => {
      if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current);
    };
  }, [content, showPickTempat]);

  // FUNGSI AI DETECTION dengan Groq
  const detectLocationWithAI = async (text) => {
    setIsAiDetecting(true);
    setAiError(null);

    try {
      // 1. Extract lokasi dari teks menggunakan Groq API
      const extractedLocation = await extractLocationWithGroq(text);

      if (!extractedLocation) {
        setAiSuggestions([]);
        return;
      }

      // 2. Cari di DATABASE dulu
      const { data, error } = await supabase
        .from('tempat')
        .select('id, name, category, alamat, latitude, longitude')
        .ilike('name', `%${extractedLocation}%`)
        .limit(3);

      if (error) throw error;

      // 3. Jika ditemukan di database, tampilkan sebagai rekomendasi
      if (data && data.length > 0) {
        setAiSuggestions(data.map(item => ({
          ...item,
          source: 'database',
          isSuggestion: true,
          confidence: 'high'
        })));
        return;
      }

      // 4. Jika TIDAK ditemukan di database, cari di NOMINATIM
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(extractedLocation)}&limit=3&addressdetails=1&countrycodes=id`,
          { signal: controller.signal }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error('Nominatim API error');
        }

        const results = await response.json();

        if (results && results.length > 0) {
          const nomResults = results.map(item => ({
            id: `nominatim_${item.place_id}`,
            name: item.display_name.split(',')[0],
            fullName: item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            category: item.category || 'lokasi',
            source: 'nominatim',
            isSuggestion: true,
            confidence: 'medium'
          }));

          setAiSuggestions(nomResults);
          return;
        } else {
          setAiSuggestions([]);
          setAiError('Lokasi tidak ditemukan. Coba dengan kata kunci lain.');
        }

      } catch (nomError) {
        if (nomError.name !== 'AbortError') {
          console.error('Nominatim error:', nomError);
          setAiError('Gagal mencari lokasi di peta');
        }
        setAiSuggestions([]);
      }

    } catch (error) {
      console.error('AI Detection error:', error);
      setAiError('Gagal mendeteksi lokasi');
      setAiSuggestions([]);
    } finally {
      setIsAiDetecting(false);
    }
  };

  // FUNGSI GROQ API - Extract lokasi dari teks
  const extractLocationWithGroq = async (text) => {
    try {
      const response = await fetch('/api/groq-location', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          prompt: `Ekstrak nama lokasi (tempat, jalan, atau area) dari teks berikut. 
        Jika ada beberapa lokasi, ambil yang paling spesifik/relevan.
        Hanya balas dengan nama lokasi, tanpa kalimat tambahan.
        
        Teks: "${text}"
        
        Lokasi:`
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API Error:', errorData);
        return extractLocationManually(text);
      }

      const data = await response.json();

      if (data.error) {
        console.error('API Error:', data.error);
        return extractLocationManually(text);
      }

      const location = data.location?.trim() || '';

      if (!location || location.length < 3 || location.length > 100) {
        return extractLocationManually(text);
      }

      const stopwords = ['yang', 'dan', 'di', 'ke', 'dari', 'pada', 'ini', 'itu', 'untuk', 'dengan', 'oleh'];
      const words = location.toLowerCase().split(' ');
      const isValid = words.some(w => w.length > 3 && !stopwords.includes(w));

      return isValid ? location : extractLocationManually(text);

    } catch (error) {
      console.error('Groq extraction error:', error);
      return extractLocationManually(text);
    }
  };

  // Fungsi fallback manual
  function extractLocationManually(text) {
    const stopwords = ['yang', 'dan', 'di', 'ke', 'dari', 'pada', 'ini', 'itu', 'untuk', 'dengan', 'oleh', 'sebagai', 'atau', 'jika', 'maka', 'saya', 'kami', 'kita', 'ada', 'banyak', 'sangat', 'cukup', 'terlalu', 'begitu', 'sekali', 'seperti', 'karena', 'namun', 'tetapi', 'sedangkan'];
    const words = text.toLowerCase().split(/\s+/);
    const potentialLocations = [];
    let currentPhrase = [];

    for (let i = 0; i < words.length; i++) {
      const word = words[i].replace(/[.,!?;:()"]/g, '');

      if (stopwords.includes(word) || word.length < 3) {
        if (currentPhrase.length > 0) {
          const phrase = currentPhrase.join(' ');
          if (phrase.length > 3 && !potentialLocations.includes(phrase)) {
            potentialLocations.push(phrase);
          }
          currentPhrase = [];
        }
        continue;
      }

      const originalText = text.split(/\s+/)[i] || '';
      if (originalText && originalText[0] === originalText[0].toUpperCase() && word.length > 2) {
        if (currentPhrase.length > 0) {
          const phrase = currentPhrase.join(' ');
          if (phrase.length > 3 && !potentialLocations.includes(phrase)) {
            potentialLocations.push(phrase);
          }
          currentPhrase = [];
        }
        currentPhrase.push(word);
      } else {
        currentPhrase.push(word);
      }
    }

    if (currentPhrase.length > 0) {
      const phrase = currentPhrase.join(' ');
      if (phrase.length > 3 && !potentialLocations.includes(phrase)) {
        potentialLocations.push(phrase);
      }
    }

    const locationKeywords = ['jalan', 'desa', 'kecamatan', 'kabupaten', 'kota', 'pasar', 'stasiun', 'terminal', 'bandara', 'alun-alun', 'taman', 'masjid', 'gereja', 'sekolah', 'kampus', 'rumah sakit', 'puskesmas', 'mall', 'supermarket', 'toko', 'warung', 'restoran', 'kafe'];

    let bestMatch = null;
    let bestScore = 0;

    for (const loc of potentialLocations) {
      let score = loc.length / 10;
      for (const keyword of locationKeywords) {
        if (loc.includes(keyword)) score += 2;
      }
      const wordsInLoc = loc.split(' ');
      for (const word of wordsInLoc) {
        for (const keyword of locationKeywords) {
          if (keyword.includes(word) || word.includes(keyword)) {
            score += 1.5;
            break;
          }
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = loc;
      }
    }

    if (bestMatch && bestScore > 1) {
      return bestMatch.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }

    const filteredWords = words.filter(w => w.length > 3 && !stopwords.includes(w) && !w.match(/^[0-9]+$/));
    if (filteredWords.length > 0) {
      const result = filteredWords.slice(0, 3).join(' ');
      return result.charAt(0).toUpperCase() + result.slice(1);
    }

    return null;
  }

  const handleUploadDone = (res) => {
    if (res?.event === "success" && res.info?.secure_url) {
      setMediaType(res.info.resource_type);
      setTempMediaUrl(res.info.secure_url);
    }
  };

  const finalizeUpload = async () => {
    if (isNominatim) {
      if (!selectedTraffic) {
        alert("Pilih kondisi lalu lintas");
        return;
      }
    } else {
      if (!selectedCondition && !selectedTraffic) {
        alert("Pilih kondisi");
        return;
      }
      if (selectedCondition === "Antri" && !selectedWaitTime) {
        alert("Pilih waktu antrian");
        return;
      }
    }

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
        tempat_id: !isNominatim && activeTempat?.id && !activeTempat.id?.toString().startsWith('nominatim_')
          ? parseInt(activeTempat.id)
          : null,
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

      const { data, error } = await supabase
        .from("laporan_warga")
        .insert([reportData])
        .select();

      if (error) throw error;

      const newReport = data?.[0] || reportData;

      window.dispatchEvent(new CustomEvent('story-upload-success', {
        detail: { tempatId: activeTempat?.id, isNominatim, newReport }
      }));

      window.dispatchEvent(new CustomEvent('refresh-citizenhub', {
        detail: { newReport, tempatId: activeTempat?.id }
      }));

      setStatus("success");

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

  // ============================================
  // RENDER - TETAP SAMA SEPERTI SEBELUMNYA
  // ============================================
  return createPortal(
    <AnimatePresence mode="wait">
      <motion.div
        key="lapor-panel"
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

          <div className="p-5 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Kirim Laporan</h3>
                <p className="text-[10px] font-bold text-cyan-600 uppercase tracking-widest mt-0.5 flex items-center gap-1.5">
                  {activeTempat?.name || "Pilih lokasi"}
                  {activeTempat?.source === 'nominatim' && (
                    <span className="text-[8px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
                      🗺️ Peta
                    </span>
                  )}
                  · {currentTimeTag}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 text-lg transition-colors"
              >
                ✕
              </button>
            </div>

            {/* ============================================ */}
            {/* TAMPILKAN LOKASI FAVORIT (CACHE) */}
            {/* ============================================ */}
            {showPickTempat && tempatQuery.length === 0 && cachedLocations.length > 0 && (
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
                    <span>⭐</span>
                    Lokasi Favorit
                    <span className="text-[8px] text-slate-300 font-normal">
                      ({cachedLocations.length})
                    </span>
                  </p>
                  <button
                    onClick={() => {
                      if (confirm('Hapus semua cache lokasi?')) {
                        clearCache();
                      }
                    }}
                    className="text-[8px] text-slate-400 hover:text-red-500 transition-colors"
                  >
                    Hapus semua
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {cachedLocations.slice(0, 5).map((loc) => (
                    <button
                      key={loc.id}
                      onClick={() => selectLocation(loc)}
                      className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-medium text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition-all flex items-center gap-1.5"
                    >
                      <span>⭐</span>
                      {loc.name}
                      <span className="text-[8px] text-emerald-400">
                        · {loc.useCount || 1}x
                      </span>
                    </button>
                  ))}
                  {cachedLocations.length > 5 && (
                    <span className="text-[10px] text-slate-400 self-center">
                      +{cachedLocations.length - 5} lainnya
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* ============================================ */}
            {/* UPLOAD AREA */}
            {/* ============================================ */}
            {!tempMediaUrl && mode !== "text" && !isTextOnly && (
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

            {/* Preview dengan textarea */}
            {tempMediaUrl && !isTextOnly && (
              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 mb-4 flex gap-3">
                <div className="w-14 h-16 rounded-xl overflow-hidden bg-slate-200 flex-shrink-0">
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

            {/* Tombol Lapor Tulisan Saja */}
            {!tempMediaUrl && !isTextOnly && (
              <button
                onClick={() => setIsTextOnly(true)}
                className="w-full py-3 rounded-xl border border-slate-200 text-[10px] font-bold text-slate-500 hover:bg-slate-50 mb-4 transition-colors"
              >
                Lapor Tulisan Saja →
              </button>
            )}

            {/* Textarea mode tulisan */}
            {isTextOnly && (
              <textarea
                placeholder="Ceritakan kondisinya... (contoh: hujan gerimis, ramai pengunjung, macet panjang, dll)"
                className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-[13px] mb-4 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 resize-none"
                rows={4}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                autoFocus
              />
            )}

            {/* ============================================ */}
            {/* BAGIAN PEMILIHAN LOKASI (DI BAWAH) */}
            {/* ============================================ */}

            {showPickTempat && (
              <div className="space-y-3 mb-4">
                {/* PENCARIAN MANUAL */}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={tempatQuery}
                    onChange={(e) => setTempatQuery(e.target.value)}
                    placeholder="Cari tempat atau jalan..."
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50 transition-all duration-200 focus:outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-500/10"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck="false"
                    enterKeyHint="search"
                  />
                  {isSearching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-3 h-3 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>

                {/* HASIL PENCARIAN MANUAL */}
                {tempatQuery.length >= 2 && (tempatList.length > 0 || nominatimResults.length > 0) && (
                  <div className="max-h-[200px] overflow-y-auto pr-1 space-y-3 custom-scrollbar border border-slate-100 rounded-xl p-2 bg-slate-50/50">
                    {/* Tampilkan CACHE dulu dengan label khusus */}
                    {tempatList.some(t => t.isCached) && (
                      <div className="space-y-1">
                        <div className="text-[9px] font-bold tracking-wider text-emerald-500 uppercase px-2 flex items-center gap-1.5">
                          <span>⚡</span>
                          Lokasi Favorit (Cache)
                          <span className="text-[8px] text-slate-400 font-normal">
                            ({tempatList.filter(t => t.isCached).length})
                          </span>
                        </div>
                        <div className="space-y-1">
                          {tempatList.filter(t => t.isCached).map(t => (
                            <button
                              key={`cache_${t.id}`}
                              onClick={() => selectLocation(t)}
                              className="w-full flex items-center gap-3 p-2 rounded-xl border border-emerald-100 bg-emerald-50/50 hover:border-emerald-300 hover:bg-emerald-50 transition-all duration-200 group text-left"
                            >
                              <div className="w-6 h-6 flex items-center justify-center bg-emerald-100 rounded-lg group-hover:bg-emerald-200 transition-colors">
                                <span className="text-sm">⭐</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold text-slate-700 group-hover:text-emerald-700 transition-colors truncate">
                                  {t.name}
                                </div>
                                <div className="text-[9px] text-emerald-600 font-medium truncate flex items-center gap-1">
                                  {t.category || 'Lokasi'}
                                  <span className="text-[8px] text-emerald-400">
                                    · Digunakan {t.useCount || 1}x
                                  </span>
                                </div>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeFromCache(t.id);
                                }}
                                className="text-slate-300 hover:text-red-500 transition-colors"
                              >
                                ✕
                              </button>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Database Results */}
                    {tempatList.some(t => !t.isCached && t.source !== 'nominatim') && (
                      <div className="space-y-1">
                        <div className="text-[9px] font-bold tracking-wider text-slate-400 uppercase px-2">
                          📌 Tempat Terdaftar
                        </div>
                        <div className="space-y-1">
                          {tempatList.filter(t => !t.isCached && t.source !== 'nominatim').map(t => (
                            <button
                              key={`db_${t.id}`}
                              onClick={() => selectLocation(t)}
                              className="w-full flex items-center gap-3 p-2 rounded-xl border border-transparent hover:border-cyan-100 hover:bg-cyan-50/50 transition-all duration-200 group text-left"
                            >
                              <div className="w-6 h-6 flex items-center justify-center bg-cyan-50 rounded-lg group-hover:bg-cyan-100 transition-colors">
                                <span className="text-sm">📍</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold text-slate-700 group-hover:text-cyan-700 transition-colors truncate">
                                  {t.name}
                                </div>
                                <div className="text-[9px] text-slate-400 font-medium truncate">
                                  {t.category}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {nominatimResults.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[9px] font-bold tracking-wider text-slate-400 uppercase px-2">
                          🗺️ Lokasi dari Peta
                        </div>
                        <div className="space-y-1">
                          {nominatimResults.map(t => (
                            <button
                              key={`nom_${t.id}`}
                              onClick={() => selectLocation(t)}
                              className="w-full flex items-center gap-3 p-2 rounded-xl border border-transparent hover:border-slate-200 hover:bg-slate-50 transition-all duration-200 group text-left"
                            >
                              <div className="w-6 h-6 flex items-center justify-center bg-slate-100 rounded-lg group-hover:bg-slate-200 transition-colors">
                                <span className="text-sm">🛣️</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold text-slate-700 group-hover:text-slate-900 transition-colors truncate">
                                  {t.name}
                                </div>
                                <div className="text-[9px] text-slate-400 truncate">
                                  {t.fullName}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* REKOMENDASI AI */}
                {content.length >= 10 && (
                  <div>
                    {isAiDetecting ? (
                      <div className="p-3 bg-gradient-to-r from-cyan-50 to-blue-50 rounded-xl border border-cyan-200">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                          <span className="text-[10px] font-medium text-cyan-700">AI mendeteksi lokasi...</span>
                        </div>
                      </div>
                    ) : aiSuggestions.length > 0 ? (
                      <div className="p-3 bg-gradient-to-r from-cyan-50 to-blue-50 rounded-xl border border-cyan-200">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[10px] font-bold text-cyan-700 flex items-center gap-1.5">
                            <Sparkles size={14} className="text-cyan-500" />
                            Rekomendasi Lokasi:
                          </p>
                          <span className="text-[8px] text-cyan-500 font-medium bg-white px-2 py-0.5 rounded-full">
                            {aiSuggestions.some(s => s.source === 'nominatim') ? '🗺️ Dari Peta' : '📌 Terdaftar'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {aiSuggestions.map((loc) => {
                            const isNominatim = loc.source === 'nominatim' || loc.id?.toString().startsWith('nominatim_');
                            return (
                              <button
                                key={loc.id || loc.uniqueId}
                                onClick={() => selectLocation(loc)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shadow-sm flex items-center gap-1.5
                                  ${isNominatim
                                    ? 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400'
                                    : 'bg-white border border-cyan-200 text-cyan-700 hover:bg-cyan-50 hover:border-cyan-300'
                                  }`}
                              >
                                <span>{isNominatim ? '🗺️' : '📍'}</span>
                                <span>{loc.name}</span>
                                {isNominatim && (
                                  <span className="text-[8px] text-slate-400 ml-1">(dari peta)</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[8px] text-cyan-600/70 mt-1.5">
                          💡 Klik rekomendasi di atas. {aiSuggestions.some(s => s.source === 'nominatim')
                            ? 'Lokasi dari peta akan disimpan sebagai lokasi umum.'
                            : 'Lokasi terdaftar akan tersimpan dengan ID tempat.'}
                        </p>
                      </div>
                    ) : aiError ? (
                      <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                        <p className="text-[10px] text-amber-600 flex items-center gap-1.5">
                          <span>⚠️</span>
                          {aiError}
                        </p>
                      </div>
                    ) : content.length >= 20 && !isAiDetecting && (
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <p className="text-[10px] text-slate-400 text-center">
                          🔍 Belum ada lokasi terdeteksi. Coba sebutkan nama tempat yang lebih spesifik.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Info jika belum pilih lokasi */}
                {content.length === 0 && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-[10px] text-slate-400 text-center">
                      📝 Tulis deskripsi untuk rekomendasi AI, atau cari manual di atas
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ============================================ */}
            {/* SURVEY OPTIONS */}
            {/* ============================================ */}
            {!showPickTempat && (
              <>
                <button
                  onClick={() => {
                    setShowPickTempat(true);
                    setTempatQuery("");
                  }}
                  className="mb-3 text-[9px] font-bold text-cyan-600 flex items-center gap-1 hover:text-cyan-700 transition-colors"
                >
                  <MapPin size={10} />
                  Ganti lokasi
                </button>

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

            {/* ============================================ */}
            {/* TOMBOL KIRIM */}
            {/* ============================================ */}
            <button
              onClick={finalizeUpload}
              disabled={isFormDisabled}
              className={`w-full py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all duration-200 
                ${isFormDisabled
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md hover:shadow-lg hover:scale-[1.01] active:scale-[0.99]'
                }`}
            >
              {status === "uploading" ? (
                <>
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Mengirim...
                </>
              ) : status === "success" ? (
                <>
                  <span>✅</span>
                  Berhasil!
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
          {status === "uploading" && (
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
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toast Success */}
        <AnimatePresence>
          {status === "success" && (
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
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}