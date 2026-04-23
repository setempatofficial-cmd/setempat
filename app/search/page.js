"use client";
import { useState, useEffect, useMemo, useCallback, useRef, memo, useDeferredValue, startTransition } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import LocationProvider, { useLocation } from "@/components/LocationProvider";
import { useTheme } from "@/app/hooks/useTheme";
import FeedCard from "@/app/components/feed/FeedCard";
import AIModal from "@/app/components/ai/AIModal";
import KomentarModal from "@/app/components/feed/KomentarModal";
import { calculateDistance } from "@/lib/distance";
import dynamic from 'next/dynamic';
import { ChevronLeft } from 'lucide-react';

// Import komponen secara dinamis untuk mencegah error SSR
const VoiceSearch = dynamic(() => import('react-voice-search'), {
  ssr: false,
});

// ========== OPTIMASI: LRU Cache untuk thumbnail (limit 200) ==========
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

// ── Helper functions ─────────────────
const isVideoUrl = (url) => {
  if (!url) return false;
  const urlLower = url.toLowerCase();
  return urlLower.includes('.mp4') || urlLower.includes('.m3u8') || urlLower.includes('cctv') ||
         urlLower.includes('stream') || urlLower.includes('youtube.com') || urlLower.includes('youtu.be');
};

const extractYouTubeId = (url) => {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([^&?#]+)/,
    /youtube\.com\/embed\/([^/?]+)/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};



// ========== OPTIMASI: getThumbnail dengan LRU Cache ==========
const getThumbnail = (item) => {
  const cached = thumbnailCache.get(item.id);
  if (cached) return cached;
  
  const getVideoThumbnail = (url) => {
    if (!url) return null;
    const youtubeId = extractYouTubeId(url);
    if (youtubeId) return `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`;
    const urlLower = url.toLowerCase();
    if (urlLower.includes('.m3u8') || urlLower.includes('cctv') || urlLower.includes('stream'))
      return 'https://placehold.co/400x225/1a1a1a/ff0000?text=LIVE+CCTV';
    if (urlLower.includes('.mp4') || urlLower.includes('.webm') || urlLower.includes('.mov'))
      return 'https://placehold.co/400x225/1a1a1a/3b82f6?text=VIDEO';
    return null;
  };
  
  let result = 'https://placehold.co/400x225/1a1a1a/666666?text=NO+IMAGE';
  
  // Prioritaskan foto warga terbaru
  if (item.laporan_terbaru?.[0]?.photo_url && !isVideoUrl(item.laporan_terbaru[0].photo_url)) {
    result = item.laporan_terbaru[0].photo_url;
  } else if (item.laporan_terbaru?.[0]?.video_url) {
    const vt = getVideoThumbnail(item.laporan_terbaru[0].video_url);
    if (vt) result = vt;
  } else if (item.image_url && !isVideoUrl(item.image_url)) {
    result = item.image_url;
  } else if (item.photos && Array.isArray(item.photos) && item.photos[0]) {
    const firstPhoto = item.photos[0];
    const photoUrl = typeof firstPhoto === 'string' ? firstPhoto : firstPhoto.url;
    if (photoUrl && !isVideoUrl(photoUrl)) result = photoUrl;
  } else if (item.photos && typeof item.photos === 'object' && !Array.isArray(item.photos)) {
    const jam = new Date().getHours();
    let timeKey = "pagi";
    if (jam >= 11 && jam < 15) timeKey = "siang";
    else if (jam >= 15 && jam < 18) timeKey = "sore";
    else if (jam >= 18 || jam < 5) timeKey = "malam";
    const photoData = item.photos[timeKey];
    if (photoData) {
      if (Array.isArray(photoData)) {
        for (const p of photoData) {
          const url = typeof p === 'string' ? p : p.url;
          if (url && !isVideoUrl(url)) { result = url; break; }
        }
      } else if (typeof photoData === 'string' && !isVideoUrl(photoData)) result = photoData;
      else if (photoData.url && !isVideoUrl(photoData.url)) result = photoData.url;
    }
    if (item.photos.official && !isVideoUrl(item.photos.official)) result = item.photos.official;
  }
  
  thumbnailCache.set(item.id, result);
  return result;
};

const getBadgeColor = (tipe) => {
  switch (tipe?.toLowerCase()) {
    case 'ramai': return 'bg-orange-500/20 text-orange-500';
    case 'sepi': return 'bg-blue-500/20 text-blue-500';
    case 'macet': return 'bg-red-500/20 text-red-500';
    default: return 'bg-gray-500/20 text-gray-400';
  }
};

// ── StableGridCard (memo) ────────────────────────────────────────
const StableGridCard = memo(({ item, onCardClick, showDistance = false }) => {
  const handleClick = useCallback(() => onCardClick(item), [onCardClick, item]);
  const thumbnail = useMemo(() => getThumbnail(item), [item]);
  const isNewReport = useMemo(() => {
    if (!item.laporan_terbaru?.length) return false;
    const latestDate = item.laporan_terbaru[0]?.created_at;
    return latestDate && (Date.now() - new Date(latestDate)) / (1000 * 60 * 60) <= 24;
  }, [item.laporan_terbaru]);
  const latestReport = item.laporan_terbaru?.[0];

  return (
    <button onClick={handleClick} className="flex flex-col text-left rounded-2xl overflow-hidden border bg-white/5 border-white/10 w-full relative">
      {isNewReport && <div className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-green-500/20 text-green-500">BARU</div>}
      {latestReport?.tipe && (
        <div className={`absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${getBadgeColor(latestReport.tipe)}`}>
          {latestReport.tipe}
        </div>
      )}
      <div className="aspect-video bg-zinc-800">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumbnail} className="w-full h-full object-cover" loading="lazy" alt={item.name} />
      </div>
      <div className="p-3">
        <h4 className="text-xs font-black uppercase truncate">{item.name}</h4>
        <p className="text-[10px] opacity-40 truncate">{item.category}</p>
        {showDistance && item.distance !== undefined && <p className="text-[10px] opacity-60 mt-1">📍 {item.distance.toFixed(1)} km</p>}
        {item.laporan_terbaru?.length > 0 && <p className="text-[10px] opacity-60 mt-1">📊 {item.laporan_terbaru.length} laporan</p>}
      </div>
    </button>
  );
});
StableGridCard.displayName = 'StableGridCard';

// ========== OPTIMASI: Preload suggestions (tanpa fetch data) ==========
const getPreloadedSuggestions = (placeName) => {
  const hour = new Date().getHours();
  const suggestions = [];
  if (hour >= 5 && hour < 11) suggestions.push("sarapan", "cafe pagi");
  else if (hour >= 11 && hour < 15) suggestions.push("makan siang", "restaurant");
  else if (hour >= 15 && hour < 18) suggestions.push("cafe sore", "ngabuburit");
  else if (hour >= 18 && hour < 23) suggestions.push("makan malam", "kuliner malam");
  else suggestions.push("24 jam");
  if (placeName) suggestions.push(placeName);
  suggestions.push("kopi", "kuliner", "cafe"); // fallback trending
  return [...new Set(suggestions)].slice(0, 6);
};

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
  const [trendingKeywords, setTrendingKeywords] = useState([]);
  const [smartSuggestions, setSmartSuggestions] = useState([]);
  
  const [nearbyResults, setNearbyResults] = useState([]);
  const [recentResults, setRecentResults] = useState([]);
  
  const initialLoadDone = useRef(false);
  const isMountedRef = useRef(true);

  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isKomentarModalOpen, setIsKomentarModalOpen] = useState(false);
  const [selectedForAI, setSelectedForAI] = useState(null);
  const [selectedForKomentar, setSelectedForKomentar] = useState(null);
  
  const deferredQuery = useDeferredValue(query);
  const isTypingDeferred = useDeferredValue(isTyping);
  
  // ========== FETCH DATA (PARALLEL) - TANPA LIMIT ==========
const fetchFreshData = useCallback(async (showLoading = false) => {
  if (showLoading) setLoading(true);
  
  try {
    // ✅ PERUBAHAN UTAMA: Hapus limit, ambil semua data
    const [tempatResult, laporanResult] = await Promise.all([
      supabase
        .from("tempat")
        .select("id, name, category, alamat, photos, latitude, longitude, created_at, image_url")
        .order("name", { ascending: true })
        // .limit(20) ← HAPUS LIMIT INI! Ambil semua data
        ,
      supabase
        .from("laporan_warga")
        .select("id, tempat_id, photo_url, video_url, content, created_at, user_name, tipe, time_tag")
        .order("created_at", { ascending: false })
        // .limit(100) ← HAPUS LIMIT INI! Ambil semua data
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
      if (list.length < 3) list.push(laporan);
    }
    
    const merged = tempatData.map(tempat => ({
      ...tempat,
      laporan_terbaru: laporanMap.get(tempat.id) || []
    }));
    
    if (isMountedRef.current) {
      setAllData(merged);
      try {
        sessionStorage.setItem('search_cache_v2', JSON.stringify(merged));
      } catch (e) {}
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
        .slice(0, 20); // Tetap limit 20 untuk tampilan, tapi dari semua data
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
      .slice(0, 20); // Tetap limit 20 untuk tampilan, tapi dari semua data
    setRecentResults(withRecent);
  }, [allData, location]);
  
  // ========== HASIL FILTER (PENCARIAN) - TANPA LIMIT ==========
  const results = useMemo(() => {
    if (activeFilter === "Sekitarmu") return nearbyResults;
    if (activeFilter === "Baru terjadi") return recentResults;
    
    let filtered = allData;
    const term = deferredQuery.toLowerCase().trim();
    if (term) {
      filtered = filtered.filter(item =>
        item.name?.toLowerCase().includes(term) ||
        item.alamat?.toLowerCase().includes(term) ||
        item.category?.toLowerCase().includes(term)
      );
    }
    if (activeFilter === "Lagi ramai") {
      filtered = filtered.filter(item => item.laporan_terbaru?.some(l => l.tipe === "Ramai"));
    }
    return filtered; // ← HAPUS .slice(0,20) agar semua hasil pencarian muncul!
  }, [deferredQuery, allData, activeFilter, nearbyResults, recentResults]);
  
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
    handleSearch(item.name);
    setExploreItems([item]);
    setExploreMode(true);
  }, [handleSearch]);
  
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
    } catch (_) {}
  }, []);
  
  const handleGlobalRefresh = useCallback(async () => {
    thumbnailCache.clear(); // Clear cache saat refresh
    await fetchFreshData(true);
    router.refresh();
  }, [fetchFreshData, router]);
  
  // ========== INITIAL LOAD & REALTIME (FIXED) ==========
useEffect(() => {
  if (initialLoadDone.current) return;
  initialLoadDone.current = true;
  
  const loadInitial = async () => {
    // 1. TAMPILKAN SUGGESTIONS INSTAN
    const instantSuggestions = getPreloadedSuggestions(placeName);
    setSmartSuggestions(instantSuggestions);
    
    // 2. Ambil dari cache dulu (instan)
    let hasValidCache = false;
    try {
      const cached = sessionStorage.getItem('search_cache_v2');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.length > 0) {
          setAllData(parsed);
          setLoading(false);
          hasValidCache = true;
        }
      }
    } catch (e) {}
    
    // 3. Hanya fetch jika TIDAK ada cache
    if (!hasValidCache) {
      await fetchFreshData(true);
    } else {
      // Fetch di background TANPA loading indicator
      fetchFreshData(false);
    }
    
    // 4. Update suggestions dengan data real
    if (placeName) {
      const updatedSuggestions = getPreloadedSuggestions(placeName);
      setSmartSuggestions(updatedSuggestions);
    }
  };
  
  loadInitial();
  
  // Setup realtime subscription
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
}, []); // ✅ KOSONGKAN dependency array!
  
  // ========== RENDER ==========
  const getBorderColor = () => isMalam ? "border-white/[0.05]" : "border-black/[0.03]";
  
  // Loading spinner hanya jika benar-benar tidak ada data
  if (loading && allData.length === 0) {
    return (
      <div className={`relative min-h-screen w-full ${themeBg} ${themeText} transition-colors duration-300`}>
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <div className="w-8 h-8 border-2 border-[#E3655B] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }
  
  return (
    <div className={`relative min-h-screen w-full ${themeBg} ${themeText} transition-colors duration-300`}>
      {/* Ambient effects - ringan */}
      <div className={`fixed inset-0 z-0 pointer-events-none ${isMalam ? 'opacity-30' : 'opacity-20'}`}>
        <div className="absolute top-[-15%] left-[-10%] w-[120%] h-[50%] rounded-full blur-[120px]" style={{ backgroundColor: '#3b82f6' }} />
      </div>
      
      <div className="relative z-10">
        <div className={`max-w-md mx-auto min-h-screen flex flex-col relative border-x ${getBorderColor()}`}>
          {/* HEADER */}
<div className={`sticky top-0 z-50 px-4 pt-4 pb-2 backdrop-blur-xl ${isMalam ? "bg-black/80 border-b border-white/10" : "bg-white/80 border-b border-slate-100"}`}>
  <div className="flex items-center gap-2">
   {/* Tombol Back */}
<button 
  onClick={() => exploreMode ? setExploreMode(false) : router.back()} 
  className={`p-2 rounded-xl transition-colors ${isMalam ? "hover:bg-white/5 text-white" : "hover:bg-black/5 text-slate-900"}`}
>
  <ChevronLeft size={18} />
</button>
    
    {/* Input Teks */}
    <input
      autoFocus
      defaultValue={query}
      onChange={(e) => { setQuery(e.target.value); setIsTyping(true); setExploreMode(false); }}
      onKeyPress={(e) => e.key === 'Enter' && handleSearch(query)}
      placeholder="Cari tempat, lihat suasana..."
      className={`flex-1 py-3 px-4 rounded-2xl text-sm font-bold outline-none border ${isMalam ? "bg-white/[0.07] border-white/10 text-white placeholder:text-white/20" : "bg-black/[0.04] border-black/5 text-slate-900 placeholder:text-slate-400"}`}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck="false"
      name={`search_${Math.random().toString(36).substring(7)}`}
      data-lpignore="true"
      data-form-type="other"
    />
    
    {/* ========== VOICE SEARCH ========== */}
    <div className={`rounded-full p-1 ${isMalam ? "bg-white/10" : "bg-transparent"}`}>
  <VoiceSearch
    handleSearch={(transcript) => {
      console.log('🎤 Voice search result:', transcript);
      handleSearch(transcript);
    }}
    Error={(error) => console.error("Voice Search Error:", error)}
    placeholder="Klik dan bicara..."
    width="48"
    height="48"
    buttonColor={isMalam ? "#FFFFFF" : "#E3655B"}  // ← putih saat gelap
    buttonIconColor={isMalam ? "#1a1a1a" : "#FFFFFF"}  // ← icon hitam saat gelap
    language="id-ID"
  />
</div>
    {/* Tombol Refresh */}
    <button 
      onClick={handleGlobalRefresh} 
      className="p-2 rounded-xl hover:bg-white/10 text-white/70" 
      title="Refresh"
    >
      ↻
    </button>
    
    {/* Tombol Lokasi (jika belum ada izin) */}
    {!location?.latitude && (
      <button 
        onClick={requestLocation} 
        className="px-3 py-1.5 rounded-full bg-[#E3655B] text-white text-[10px] font-bold"
      >
        Lokasi
      </button>
    )}
  </div>
  
  {/* TABS FILTER */}
  {!exploreMode && !isTypingDeferred && (
    <div className="flex gap-2 overflow-x-auto py-3 hide-scrollbar">
      {["Semua", "Lagi ramai", "Sekitarmu", "Baru terjadi"].map(tab => (
        <button
          key={tab}
          onClick={() => { setActiveFilter(tab); if (tab === "Sekitarmu") { setIsTyping(false); setExploreMode(false); setQuery(""); } else setExploreMode(false); }}
          className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wide border whitespace-nowrap ${activeFilter === tab ? "bg-[#E3655B] border-[#E3655B] text-white" : isMalam ? "bg-white/5 border-white/10 text-white/50" : "bg-black/5 border-black/5 text-slate-500"}`}
        >
          {tab}
        </button>
      ))}
    </div>
  )}
</div>
          
          {/* SUGGESTIONS - TAMPIL INSTAN */}
          {isTypingDeferred && deferredQuery.length === 0 && (
            <div className="px-4 py-3">
              {recentSearches.length > 0 && (
                <div className="mb-5">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className={`text-[11px] font-bold uppercase ${isMalam ? "text-white/40" : "text-slate-400"}`}>Pencarian Terbaru</h3>
                    <button onClick={handleClearRecentSearches} className="text-[10px] text-slate-400">Hapus</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.slice(0, 5).map((search, idx) => (
                      <button key={idx} onClick={() => handleSelectSuggestion(search)} className={`px-3 py-1.5 rounded-full text-[11px] ${isMalam ? "bg-white/10 text-white/70" : "bg-black/5 text-slate-700"}`}>{search}</button>
                    ))}
                  </div>
                </div>
              )}
              <div className="mb-5">
                <h3 className={`text-[11px] font-bold uppercase mb-2 ${isMalam ? "text-white/40" : "text-slate-400"}`}>Rekomendasi</h3>
                <div className="flex flex-wrap gap-2">
                  {smartSuggestions.map((suggestion, idx) => (
                    <button key={idx} onClick={() => handleSelectSuggestion(suggestion)} className={`px-3 py-1.5 rounded-full text-[11px] ${isMalam ? "bg-white/10 text-white/70" : "bg-black/5 text-slate-700"}`}>{suggestion}</button>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {/* SEARCH RESULTS */}
          {isTypingDeferred && deferredQuery.length > 0 && (
            <div className="mt-1 divide-y">
              {results.slice(0, 5).map(item => (
                <button key={item.id} onClick={() => handleSelectSuggestion(item.name)} className="flex items-center gap-3 py-3 w-full px-4">
                  <div className="w-8 h-8 rounded-lg bg-black/5 flex items-center justify-center"><span className="text-xs">📍</span></div>
                  <div className="flex flex-col text-left flex-1">
                    <span className="text-sm font-bold">{item.name}</span>
                    <span className="text-[10px] opacity-40">{item.category}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
          
          {/* GRID CARDS - SEKARANG SEMUA HASIL PENCARIAN MUNCUL */}
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
              {(activeFilter !== "Sekitarmu" || location?.latitude) && results.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                  <div className="text-4xl mb-3">🔍</div>
                  <h3 className="text-sm font-bold mb-1">Tidak ada hasil</h3>
                  <p className="text-xs opacity-50">{activeFilter === "Baru terjadi" ? "Belum ada laporan terbaru" : "Coba kata kunci lain"}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 py-4 pb-20 px-4">
                {results.map(item => (
                  <StableGridCard key={item.id} item={item} onCardClick={handleOpenExplore} showDistance={activeFilter === "Sekitarmu"} />
                ))}
              </div>
            </>
          )}
          
          {/* EXPLORE MODE */}
          {exploreMode && (
            <div className="flex flex-col gap-5 py-4 pb-20 px-4">
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