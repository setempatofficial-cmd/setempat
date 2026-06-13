"use client";
import { useState, useEffect, useMemo, useCallback, useRef, memo, useDeferredValue } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import LocationProvider, { useLocation } from "@/components/LocationProvider";
import { useTheme } from "@/app/hooks/useTheme";
import FeedCard from "@/app/components/feed/FeedCard";
import AIModal from "@/app/components/ai/AIModal";
import KomentarModal from "@/app/components/feed/KomentarModal";
import { calculateDistance } from "@/lib/distance";
import dynamic from 'next/dynamic';
import { ChevronLeft, Mic, X } from 'lucide-react';

// Import komponen secara dinamis
const VoiceSearch = dynamic(() => import('react-voice-search'), { ssr: false });

// ========== OPTIMASI: LRU Cache ==========
class LRUCache {
  constructor(limit = 200) {
    this.limit = limit;
    this.cache = new Map();
  }
  get(key) {
    if (!this.cache.has(key)) return null;
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }
  set(key, value) {
    if (this.cache.has(key)) this.cache.delete(key);
    else if (this.cache.size >= this.limit) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }
  clear() { this.cache.clear(); }
}

const thumbnailCache = new LRUCache(150);

const getThumbnail = (item) => {
  // Pakai image_url langsung
  if (item.image_url) {
    return item.image_url;
  }

  // Kalau tidak ada, baru pakai placeholder
  return `https://placehold.co/400x225/1a1a1a/666666?text=${item.name?.charAt(0) || '?'}`;
};

const getBadgeColor = (tipe) => {
  switch (tipe?.toLowerCase()) {
    case 'ramai': return 'bg-orange-500/20 text-orange-500';
    case 'sepi': return 'bg-blue-500/20 text-blue-500';
    case 'macet': return 'bg-red-500/20 text-red-500';
    default: return 'bg-gray-500/20 text-gray-400';
  }
};

// ── StableGridCard ────────────────────────────────────────
const StableGridCard = memo(({ item, onCardClick, showDistance = false }) => {
  const handleClick = useCallback(() => onCardClick(item), [onCardClick, item]);
  const thumbnail = useMemo(() => getThumbnail(item), [item]);
  const isNewReport = useMemo(() => {
    if (!item.laporan_terbaru?.length) return false;
    const latestDate = item.laporan_terbaru[0]?.created_at;
    return latestDate && (Date.now() - new Date(latestDate)) / (1000 * 60 * 60) <= 24;
  }, [item.laporan_terbaru]);
  const latestReport = item.laporan_terbaru?.[0];
  const matchingKeyword = item.matchingKeyword;

  return (
    <button onClick={handleClick} className="flex flex-col text-left rounded-2xl overflow-hidden border bg-white/5 border-white/10 w-full relative">
      {isNewReport && <div className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-green-500/20 text-green-500">BARU</div>}
      {latestReport?.tipe && (
        <div className={`absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${getBadgeColor(latestReport.tipe)}`}>
          {latestReport.tipe}
        </div>
      )}
      {matchingKeyword && (
        <div className="absolute bottom-2 left-2 z-10 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-blue-500/80 text-white">
          {matchingKeyword}
        </div>
      )}
      <div className="aspect-video bg-zinc-800">
        <img src={thumbnail} className="w-full h-full object-cover" loading="lazy" alt={item.name} />
      </div>
      <div className="p-3">
        <h4 className="text-xs font-black uppercase truncate">{item.name}</h4>
        <p className="text-[10px] opacity-40 truncate">{item.category}</p>
        {showDistance && item.distance !== undefined && <p className="text-[10px] opacity-60 mt-1">📍 {item.distance.toFixed(1)} km</p>}
        {item.laporan_terbaru?.length > 0 && (
          <p className="text-[10px] opacity-60 mt-1">
            {item.laporan_terbaru[0]?.content?.substring(0, 30)}
            {item.laporan_terbaru[0]?.content?.length > 30 ? '...' : ''}
          </p>
        )}
      </div>
    </button>
  );
});
StableGridCard.displayName = 'StableGridCard';

// ==================== SEARCH CONTENT ====================
function SearchContent() {
  const router = useRouter();
  const { isMalam, isSore, bg: themeBg, text: themeText } = useTheme();
  const { location, locationStatus, placeName, requestLocation } = useLocation();

  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("Semua");
  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(true);
  const [exploreMode, setExploreMode] = useState(false);
  const [exploreItems, setExploreItems] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [smartSuggestions, setSmartSuggestions] = useState([]);

  const [nearbyResults, setNearbyResults] = useState([]);
  const [recentResults, setRecentResults] = useState([]);
  const [contextualResults, setContextualResults] = useState([]);

  const initialLoadDone = useRef(false);
  const isMountedRef = useRef(true);

  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isKomentarModalOpen, setIsKomentarModalOpen] = useState(false);
  const [selectedForAI, setSelectedForAI] = useState(null);
  const [selectedForKomentar, setSelectedForKomentar] = useState(null);

  const deferredQuery = useDeferredValue(query);
  const isTypingDeferred = useDeferredValue(isTyping);

  const inputRef = useRef(null);

  // ===== PERBAIKAN: Auto-focus saat halaman pertama kali dibuka =====
  useEffect(() => {
    // Fokus ke input setelah komponen mount
    if (inputRef.current) {
      // Delay kecil untuk memastikan DOM benar-benar siap
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);
    }
  }, []); // Empty dependency array - hanya berjalan sekali saat mount

  // Kata kunci kontekstual untuk pencarian situasi/lalu lintas
  const contextualKeywords = {
    laluLintas: ['macet', 'lalu lintas', 'lalin', 'padat', 'ramai lancar', 'arus lalin'],
    kemacetan: ['macet', 'padat', 'tersendat', 'stop and go', 'antre'],
    kondisi: ['ramai', 'sepi', 'normal', 'padat', 'lengang', 'sunyi'],
    cuaca: ['hujan', 'panas', 'mendung', 'berawan', 'gerimis']
  };

  // Fungsi untuk mengecek apakah query adalah pencarian kontekstual
  const isContextualSearch = useCallback((searchTerm) => {
    const term = searchTerm.toLowerCase();
    const allContextualWords = [
      ...contextualKeywords.laluLintas,
      ...contextualKeywords.kemacetan,
      ...contextualKeywords.kondisi,
      ...contextualKeywords.cuaca,
      'situasi', 'kondisi', 'arus', 'lalu', 'lintas', 'lalin'
    ];
    return allContextualWords.some(word => term.includes(word) || word.includes(term));
  }, []);

  // Fungsi untuk mencocokkan laporan dengan query
  const matchReportsWithQuery = useCallback((item, searchTerm) => {
    if (!searchTerm) return { matched: false, keyword: null };

    const term = searchTerm.toLowerCase();
    const matchedReports = [];

    for (const report of item.laporan_terbaru || []) {
      let matchReason = null;

      // Cek tipe laporan (ramai/macet/sepi)
      if (report.tipe && term.includes(report.tipe.toLowerCase())) {
        matchReason = report.tipe;
      }
      // Cek konten laporan
      else if (report.content && report.content.toLowerCase().includes(term)) {
        matchReason = 'dalam laporan';
      }
      // Cek kombinasi kata kunci kontekstual
      else {
        for (const [category, keywords] of Object.entries(contextualKeywords)) {
          if (keywords.some(kw => term.includes(kw) || (report.content && report.content.toLowerCase().includes(kw)))) {
            matchReason = category === 'laluLintas' ? 'Lalu Lintas' :
              category === 'kemacetan' ? 'Macet' :
                category === 'kondisi' ? report.tipe || 'Kondisi' : 'Info';
            break;
          }
        }
      }

      if (matchReason) {
        matchedReports.push({ report, reason: matchReason });
      }
    }

    return {
      matched: matchedReports.length > 0,
      keyword: matchedReports[0]?.reason || null,
      matchedReports
    };
  }, []);

  // ========== FETCH DATA ==========
  const fetchFreshData = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);

    try {
      const [tempatResult, laporanResult] = await Promise.all([
        supabase
          .from("tempat")
          .select("id, name, category, alamat, photos, latitude, longitude, created_at, image_url")
          .order("name", { ascending: true }),
        supabase
          .from("laporan_warga")
          .select("id, tempat_id, photo_url, video_url, content, created_at, user_name, tipe, time_tag")
          .order("created_at", { ascending: false })
      ]);

      if (tempatResult.error) throw tempatResult.error;
      if (laporanResult.error) throw laporanResult.error;

      const tempatData = tempatResult.data || [];
      const laporanData = laporanResult.data || [];

      // Group laporan by tempat_id
      const laporanMap = new Map();
      for (const laporan of laporanData) {
        if (!laporanMap.has(laporan.tempat_id)) {
          laporanMap.set(laporan.tempat_id, []);
        }
        const list = laporanMap.get(laporan.tempat_id);
        if (list.length < 5) list.push(laporan);
      }

      const merged = tempatData.map(tempat => ({
        ...tempat,
        laporan_terbaru: laporanMap.get(tempat.id) || []
      }));

      if (isMountedRef.current) {
        setAllData(merged);
        try {
          sessionStorage.setItem('search_cache_v2', JSON.stringify(merged));
        } catch (e) { }
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      if (isMountedRef.current && showLoading) setLoading(false);
    }
  }, []);

  // ========== HITUNG ULANG FILTER ==========
  useEffect(() => {
    if (!allData.length) return;

    if (location?.latitude && location?.longitude) {
      const withDistance = allData
        .filter(item => item.latitude && item.longitude)
        .map(item => ({
          ...item,
          distance: calculateDistance(location.latitude, location.longitude, item.latitude, item.longitude)
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 20);
      setNearbyResults(withDistance);
    } else {
      setNearbyResults([]);
    }

    const withRecent = allData
      .filter(item => item.laporan_terbaru?.length > 0)
      .map(item => {
        const latestDate = item.laporan_terbaru[0]?.created_at;
        return { ...item, latestReportDate: latestDate };
      })
      .sort((a, b) => new Date(b.latestReportDate) - new Date(a.latestReportDate))
      .slice(0, 20);
    setRecentResults(withRecent);
  }, [allData, location]);

  // ========== HASIL PENCARIAN KONTEKSTUAL ==========
  const results = useMemo(() => {
    if (activeFilter === "Sekitarmu") return nearbyResults;
    if (activeFilter === "Baru terjadi") return recentResults;

    const term = deferredQuery.toLowerCase().trim();

    if (!term) {
      setContextualResults([]);
      return [];
    }

    // Cek apakah ini pencarian kontekstual
    const isContextual = isContextualSearch(term);

    // Filter berdasarkan nama tempat dulu
    let nameMatches = allData.filter(item =>
      item.name?.toLowerCase().includes(term) ||
      item.alamat?.toLowerCase().includes(term) ||
      item.category?.toLowerCase().includes(term)
    );

    // Jika pencarian kontekstual, cari juga berdasarkan laporan
    let contextualMatches = [];
    if (isContextual || nameMatches.length === 0) {
      contextualMatches = allData
        .map(item => {
          const matchResult = matchReportsWithQuery(item, term);
          if (matchResult.matched) {
            return {
              ...item,
              matchingKeyword: matchResult.keyword,
              matchedReports: matchResult.matchedReports
            };
          }
          return null;
        })
        .filter(Boolean);
    }

    // Gabungkan hasil (prioritaskan yang match nama, lalu contextual)
    let combined = [...nameMatches];
    for (const ctxMatch of contextualMatches) {
      if (!combined.some(c => c.id === ctxMatch.id)) {
        combined.push(ctxMatch);
      }
    }

    // Sort: yang punya matchingKeyword lebih relevan
    combined.sort((a, b) => {
      if (a.matchingKeyword && !b.matchingKeyword) return -1;
      if (!a.matchingKeyword && b.matchingKeyword) return 1;
      return 0;
    });

    if (activeFilter === "Lagi ramai") {
      combined = combined.filter(item =>
        item.laporan_terbaru?.some(l => l.tipe === "ramai")
      );
    }

    setContextualResults(isContextual ? combined : []);
    return combined;
  }, [deferredQuery, allData, activeFilter, nearbyResults, recentResults, isContextualSearch, matchReportsWithQuery]);

  // ========== HANDLERS ==========
  const handleSearch = useCallback((searchQuery) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    setRecentSearches(prev => {
      const updated = [trimmed, ...prev.filter(s => s !== trimmed)].slice(0, 10);
      localStorage.setItem("recent_searches", JSON.stringify(updated));
      return updated;
    });
    setQuery(trimmed);
    setIsTyping(false);
    setExploreMode(false);
  }, []);

  const handleOpenExplore = useCallback((item) => {
    setExploreItems([item]);
    setExploreMode(true);
    setIsTyping(false);
  }, []);

  const handleSelectSuggestion = useCallback((suggestion) => handleSearch(suggestion), [handleSearch]);
  const handleClearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    localStorage.removeItem("recent_searches");
  }, []);

  const handleShare = useCallback(async (item) => {
    const shareUrl = `${window.location.origin}/post/${item.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: item.name, text: `Lihat ${item.name} di Setempat.id`, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        alert("✅ Link disalin!");
      }
    } catch (_) { }
  }, []);

  const handleGlobalRefresh = useCallback(async () => {
    thumbnailCache.clear();
    await fetchFreshData(true);
    router.refresh();
  }, [fetchFreshData, router]);

  // Perbaiki handleClearQuery function
  const handleClearQuery = useCallback(() => {
    setQuery("");
    setIsTyping(true);
    setExploreMode(false);
    // Fokus kembali ke input
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 0);
  }, []);

  // ========== INITIAL LOAD ==========
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    const loadInitial = async () => {
      const instantSuggestions = getPreloadedSuggestions(placeName);
      setSmartSuggestions(instantSuggestions);

      // STEP 1: COBA CACHE - LANGSUNG TAMPILKAN
      try {
        const cached = sessionStorage.getItem('search_cache_v2');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.length > 0) {
            setAllData(parsed);
            setLoading(false);
            console.log("✅ Load dari cache: CEPAT!");
          }
        }
      } catch (e) { }

      // STEP 2: FETCH DI BACKGROUND (tanpa loading state)
      try {
        const [tempatResult, laporanResult] = await Promise.all([
          supabase
            .from("tempat")
            .select("id, name, category, latitude, longitude, image_url")
            .limit(100)
            .order("name", { ascending: true }),
          supabase
            .from("laporan_warga")
            .select("id, tempat_id, content, created_at, tipe")
            .limit(200)
            .order("created_at", { ascending: false })
        ]);

        const tempatData = tempatResult.data || [];
        const laporanData = laporanResult.data || [];

        // Group laporan by tempat_id
        const laporanMap = new Map();
        for (const laporan of laporanData) {
          if (!laporanMap.has(laporan.tempat_id)) {
            laporanMap.set(laporan.tempat_id, []);
          }
          const list = laporanMap.get(laporan.tempat_id);
          if (list.length < 5) list.push(laporan);
        }

        const merged = tempatData.map(tempat => ({
          ...tempat,
          laporan_terbaru: laporanMap.get(tempat.id) || []
        }));

        setAllData(merged);
        sessionStorage.setItem('search_cache_v2', JSON.stringify(merged));
        console.log("✅ Fetch fresh selesai di background");
      } catch (err) {
        console.error("Background fetch error:", err);
      }
    };

    loadInitial();

    const channel = supabase
      .channel('search-laporan-updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'laporan_warga' }, () => {
        setTimeout(() => fetchFreshData(false), 3000);
      })
      .subscribe();

    const savedRecent = localStorage.getItem("recent_searches");
    if (savedRecent) setRecentSearches(JSON.parse(savedRecent));

    return () => {
      isMountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [fetchFreshData, placeName]);

  // Helper untuk preloaded suggestions
  const getPreloadedSuggestions = (placeName) => {
    const hour = new Date().getHours();
    const suggestions = [];
    if (hour >= 5 && hour < 11) suggestions.push("sarapan", "cafe pagi");
    else if (hour >= 11 && hour < 15) suggestions.push("makan siang", "restaurant");
    else if (hour >= 15 && hour < 18) suggestions.push("cafe sore", "ngabuburit");
    else if (hour >= 18 && hour < 23) suggestions.push("makan malam", "kuliner malam");
    else suggestions.push("24 jam");

    // Tambahkan saran kontekstual
    suggestions.push("lalu lintas", "kondisi macet", "tempat ramai");
    if (placeName) suggestions.push(placeName);
    suggestions.push("kopi", "kuliner", "cafe");

    return [...new Set(suggestions)].slice(0, 8);
  };

  // ========== RENDER ==========
  if (loading && allData.length === 0) {
    return (
      <div className={`min-h-screen w-full ${themeBg} ${themeText} transition-colors duration-300`}>
        <div
          className="mx-auto flex justify-center items-center h-64"
          style={{ maxWidth: '420px' }}
        >
          <div className="relative flex items-center justify-center">
            {/* Spin lebih cepat */}
            <div className="relative h-8 w-8 border-2 border-white/20 border-t-[#E3655B] border-b-[#25F4EE] rounded-full animate-spin"
              style={{ animationDuration: '0.35s' }}></div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className={`min-h-screen w-full ${themeBg} ${themeText} transition-colors duration-300`}>
      {/* Border di container luar (opsional) */}
      <div className="mx-auto w-full max-w-[400px] border-x"
        style={{
          width: '100%',
          maxWidth: '400px',
          borderLeft: `1px solid ${isMalam ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'}`,
          borderRight: `1px solid ${isMalam ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'}`
        }}
      >

        {/* HEADER */}
        <div
          className={`sticky top-0 z-50 px-4 sm:px-6 pt-4 pb-2 backdrop-blur-2xl transition-all duration-500 
            ${isMalam ? "bg-black/60 border-b border-white/5" : "bg-white/70 border-b border-slate-200/50"}`}
          style={{ width: '100%', margin: '0 auto' }}
        >
          <div className="flex items-center gap-1.5">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => exploreMode ? setExploreMode(false) : router.back()}
              className={`p-2 rounded-2xl transition-colors flex-shrink-0 ${isMalam ? "bg-white/5 hover:bg-white/10" : "bg-black/5 hover:bg-black/10"}`}
            >
              <ChevronLeft size={18} />
            </motion.button>


            {/* Search Input - OPTIMIZED with autoFocus */}
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="search"  // ✅ Tepat untuk kolom pencarian
                autoFocus={true}  // 🔥 PERBAIKAN: Auto focus saat halaman dibuka
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setIsTyping(true);
                  setExploreMode(false);
                }}
                // ✅ Diganti ke onKeyDown karena onKeyPress sudah deprecated
                onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}

                // Mencegah konflik *gesture* jika input berada di dalam komponen geser (slider/map)
                onTouchStart={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}

                onFocus={() => {
                  setIsTyping(true);
                  setExploreMode(false);
                }}
                placeholder="Cek Kondisi Lokasi Sekitar..."

                // ✅ Trik paling ampuh mematikan autofill data pribadi di browser modern
                autoComplete="one-time-code"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="search"

                // ✅ Nama & ID yang netral (hindari kata 'user', 'name', 'pass', 'mail')
                name="q-search"
                id="q-search-input"

                // ✅ Memaksa layout keyboard mobile memunculkan tombol "Cari" bukan "Go/Masuk"
                inputMode="search"
                className="flex-1 w-full bg-transparent py-2 px-3 focus:outline-none focus:ring-0"
              />

              {query && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClearQuery();
                    // Memastikan input kembali fokus setelah teks dihapus
                    if (inputRef.current) {
                      inputRef.current.focus();
                    }
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  type="button"
                >
                  <X size={16} className="opacity-40" />
                </button>
              )}
            </div>

            {/* Voice Search */}
            <div className={`flex-shrink-0 flex items-center justify-center rounded-xl transition-all duration-300 shadow-sm ${isMalam ? "bg-white border border-white/20" : "bg-black/[0.04] border border-black/5"
              }`}>
              <VoiceSearch
                handleSearch={(transcript) => handleSearch(transcript)}
                Error={(error) => console.error("Voice Search Error:", error)}
                placeholder="Klik dan bicara..."
                width="36"
                height="36"
                language="id-ID"
                customMicIcon={() => (
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isMalam ? "bg-white" : "bg-[#E3655B]"
                    }`}>
                    <Mic size={18} className={isMalam ? "text-black" : "text-white"} />
                  </div>
                )}
              />
            </div>


            {!location?.latitude && (
              <button
                onClick={requestLocation}
                className="flex-shrink-0 px-2 py-1 rounded-full bg-[#E3655B] text-white text-[9px] font-bold whitespace-nowrap"
              >
                Lokasi
              </button>
            )}
          </div>

          {/* TABS FILTER */}
          {!exploreMode && !isTypingDeferred && (
            <div className="flex gap-2 overflow-x-auto py-3 px-2 hide-scrollbar">
              {["Semua", "Lagi ramai", "Sekitarmu", "Baru"].map(tab => (
                <button
                  key={tab}
                  onClick={() => { setActiveFilter(tab); setExploreMode(false); }}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wide border whitespace-nowrap flex-shrink-0 ${activeFilter === tab
                    ? "bg-[#E3655B] border-[#E3655B] text-white"
                    : isMalam ? "bg-white/5 border-white/10 text-white/50" : "bg-black/5 border-black/5 text-slate-500"
                    }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* SUGGESTIONS */}
        {isTypingDeferred && query.length === 0 && (
          <div className="px-4 py-3">
            {recentSearches.length > 0 && (
              <div className="mb-5">
                <div className="flex justify-between items-center mb-2">
                  <h3 className={`text-[11px] font-bold uppercase ${isMalam ? "text-white/40" : "text-slate-400"}`}>Pencarian Terbaru</h3>
                  <button onClick={handleClearRecentSearches} className="text-[10px] text-slate-400">Hapus</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.slice(0, 5).map((search, idx) => (
                    <button key={idx} onClick={() => handleSelectSuggestion(search)} className={`px-3 py-1.5 rounded-full text-[11px] ${isMalam ? "bg-white/10 text-white/70" : "bg-black/5 text-slate-700"}`}>
                      {search}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="mb-5">
              <h3 className={`text-[11px] font-bold uppercase mb-2 ${isMalam ? "text-white/40" : "text-slate-400"}`}>Rekomendasi</h3>
              <div className="flex flex-wrap gap-2">
                {smartSuggestions.map((suggestion, idx) => (
                  <button key={idx} onClick={() => handleSelectSuggestion(suggestion)} className={`px-3 py-1.5 rounded-full text-[11px] ${isMalam ? "bg-white/10 text-white/70" : "bg-black/5 text-slate-700"}`}>
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SEARCH RESULTS - SUGGESTIONS SAAT TYPING */}
        {isTypingDeferred && query.length > 0 && (
          <div className="mt-1 divide-y px-4">
            {results.slice(0, 5).map(item => (
              <button key={item.id} onClick={() => handleSelectSuggestion(item.name)} className="flex items-center gap-3 py-3 w-full px-4">
                <div className="w-8 h-8 rounded-lg bg-black/5 flex items-center justify-center">
                  <span className="text-xs">{item.laporan_terbaru?.[0]?.tipe === 'macet' ? '🚗' : '📍'}</span>
                </div>
                <div className="flex flex-col text-left flex-1">
                  <span className="text-sm font-bold">{item.name}</span>
                  <span className="text-[10px] opacity-40">
                    {item.matchingKeyword ? `${item.matchingKeyword} • ` : ''}{item.category}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* GRID CARDS */}
        {!isTypingDeferred && !exploreMode && (
          <>
            {activeFilter === "Sekitarmu" && !location?.latitude && (
              <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                <div className="text-4xl mb-3">📍</div>
                <h3 className="text-sm font-bold mb-1">Aktifkan Lokasi</h3>
                <p className="text-xs opacity-50 mb-4">Lihat tempat di sekitar Anda</p>
                <button onClick={requestLocation} className="px-4 py-2 bg-[#E3655B] text-white rounded-full text-xs font-bold">Aktifkan Lokasi</button>
              </div>
            )}

            {(activeFilter !== "Sekitarmu" || location?.latitude) && results.length === 0 && query.length > 0 && (
              <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                <div className="text-4xl mb-3">🔍</div>
                <h3 className="text-sm font-bold mb-1">Tidak ada hasil</h3>
                <p className="text-xs opacity-50">
                  {isContextualSearch(query)
                    ? "Tidak ada laporan dengan situasi tersebut. Coba kata kunci lain."
                    : "Tidak ada tempat yang cocok. Coba kata kunci lain."}
                </p>
              </div>
            )}

            {(activeFilter !== "Sekitarmu" || location?.latitude) && results.length === 0 && query.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                <div className="text-4xl mb-3">🏠</div>
                <h3 className="text-sm font-bold mb-1">Mulai mencari</h3>
                <p className="text-xs opacity-50">Cari tempat favorit atau lihat situasi terkini</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 py-4 pb-20 px-4">
              {results.map(item => (
                <StableGridCard
                  key={item.id}
                  item={item}
                  onCardClick={handleOpenExplore}
                  showDistance={activeFilter === "Sekitarmu"}
                />
              ))}
            </div>
          </>
        )}

        {/* EXPLORE MODE */}
        {exploreMode && exploreItems.length > 0 && (
          <div className="flex flex-col gap-5 py-4 pb-20 px-0">
            {exploreItems.map(item => (
              <FeedCard
                key={item.id}
                item={item}
                location={location}
                locationReady={locationStatus === "granted"}
                theme={{ isMalam, isSore }}
                openAIModal={() => { setSelectedForAI(item); setIsAIModalOpen(true); }}
                openKomentarModal={() => { setSelectedForKomentar(item); setIsKomentarModalOpen(true); }}
                onShare={() => handleShare(item)}
              />
            ))}
          </div>
        )}
      </div>

      <AIModal isOpen={isAIModalOpen} onClose={() => setIsAIModalOpen(false)} tempat={selectedForAI} />
      <KomentarModal isOpen={isKomentarModalOpen} onClose={() => setIsKomentarModalOpen(false)} tempat={selectedForKomentar} />

      <style jsx global>{`
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}

// ==================== EXPORT ====================
export default function SearchPage() {
  return (
    <LocationProvider>
      <SearchContent />
    </LocationProvider>
  );
}