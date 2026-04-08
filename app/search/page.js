"use client";
import { useState, useEffect, useMemo, useCallback, useRef, memo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import LocationProvider, { useLocation } from "@/components/LocationProvider";
import { useTheme } from "@/app/hooks/useTheme";
import FeedCard from "@/app/components/feed/FeedCard";
import AIModal from "@/app/components/feed/AIModal";
import KomentarModal from "@/app/components/feed/KomentarModal";
import { calculateDistance } from "@/lib/distance";

// ── Groq & Cache Configuration ─────────────────────────────────────
const GROQ_CONFIG = {
  model: "mixtral-8x7b-32768",
  temperature: 0.7,
  maxTokens: 150,
};

class RateLimiter {
  constructor(maxCalls, timeWindowMs) {
    this.maxCalls = maxCalls;
    this.timeWindowMs = timeWindowMs;
    this.calls = [];
  }
  canCall() {
    const now = Date.now();
    this.calls = this.calls.filter(time => now - time < this.timeWindowMs);
    if (this.calls.length < this.maxCalls) {
      this.calls.push(now);
      return true;
    }
    return false;
  }
}

class AICache {
  constructor(maxSize = 30, ttlMinutes = 60) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttlMinutes * 60 * 1000;
  }
  get(key) {
    const item = this.cache.get(key);
    if (!item || Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }
  set(key, value) {
    if (this.cache.size >= this.maxSize) this.cache.delete(this.cache.keys().next().value);
    this.cache.set(key, { value, timestamp: Date.now() });
  }
}

const aiRateLimiter = new RateLimiter(5, 10 * 60 * 1000);
const aiCache = new AICache(30, 120);

// ── Helper: Deteksi apakah URL adalah video ─────────────────────────────────
const isVideoUrl = (url) => {
  if (!url) return false;
  const urlLower = url.toLowerCase();
  return urlLower.includes('.mp4') || 
         urlLower.includes('.m3u8') || 
         urlLower.includes('cctv') ||
         urlLower.includes('stream') ||
         urlLower.includes('youtube.com') ||
         urlLower.includes('youtu.be');
};

// ── Helper: Extract YouTube ID untuk thumbnail ─────────────────────────────────
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

// ── Helper: Ambil thumbnail dari item (SUPPORT VIDEO/CCTV dengan placeholder online) ─────────────────────────────────
const getThumbnail = (item) => {
  // Helper untuk mendapatkan URL thumbnail terbaik dari video
  const getVideoThumbnail = (url) => {
    if (!url) return null;
    
    // YouTube: ambil thumbnail dari YouTube
    const youtubeId = extractYouTubeId(url);
    if (youtubeId) {
      return `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`;
    }
    
    // CCTV/Stream/MP4: pakai placeholder ONLINE (tidak perlu file gambar)
    const urlLower = url.toLowerCase();
    if (urlLower.includes('.m3u8') || urlLower.includes('cctv') || urlLower.includes('stream')) {
      return 'https://placehold.co/400x225/1a1a1a/ff0000?text=LIVE+CCTV';
    }
    if (urlLower.includes('.mp4') || urlLower.includes('.webm') || urlLower.includes('.mov')) {
      return 'https://placehold.co/400x225/1a1a1a/3b82f6?text=VIDEO';
    }
    
    return null;
  };
  
  // PRIORITAS 1: Photo dari laporan terbaru (jika bukan video)
  if (item.laporan_terbaru?.[0]?.photo_url && !isVideoUrl(item.laporan_terbaru[0].photo_url)) {
    return item.laporan_terbaru[0].photo_url;
  }
  
  // PRIORITAS 2: Video dari laporan terbaru (ambil thumbnail)
  if (item.laporan_terbaru?.[0]?.video_url) {
    const videoThumb = getVideoThumbnail(item.laporan_terbaru[0].video_url);
    if (videoThumb) return videoThumb;
  }
  
  // PRIORITAS 3: image_url (jika bukan video)
  if (item.image_url && !isVideoUrl(item.image_url)) {
    return item.image_url;
  }
  
  // PRIORITAS 4: Dari photos array (jika ada URL gambar)
  if (item.photos && Array.isArray(item.photos) && item.photos[0]) {
    const firstPhoto = item.photos[0];
    const photoUrl = typeof firstPhoto === 'string' ? firstPhoto : firstPhoto.url;
    if (photoUrl && !isVideoUrl(photoUrl)) {
      return photoUrl;
    }
  }
  
  // PRIORITAS 5: Dari photos berdasarkan waktu (untuk struktur JSONB dengan pagi/siang/sore/malam)
  if (item.photos && typeof item.photos === 'object' && !Array.isArray(item.photos)) {
    const jam = new Date().getHours();
    let timeKey = "pagi";
    if (jam >= 11 && jam < 15) timeKey = "siang";
    else if (jam >= 15 && jam < 18) timeKey = "sore";
    else if (jam >= 18 || jam < 5) timeKey = "malam";
    
    const photoData = item.photos[timeKey];
    if (photoData) {
      // Coba ambil URL gambar (bukan video)
      if (Array.isArray(photoData)) {
        for (const p of photoData) {
          const url = typeof p === 'string' ? p : p.url;
          if (url && !isVideoUrl(url)) {
            return url;
          }
        }
      } else if (typeof photoData === 'string' && !isVideoUrl(photoData)) {
        return photoData;
      } else if (photoData.url && !isVideoUrl(photoData.url)) {
        return photoData.url;
      }
      
      // Jika semua isinya video, ambil yang pertama (akan dapat placeholder)
      if (Array.isArray(photoData) && photoData[0]) {
        const first = photoData[0];
        const videoUrl = typeof first === 'string' ? first : first.url;
        const videoThumb = getVideoThumbnail(videoUrl);
        if (videoThumb) return videoThumb;
      }
    }
    
    // Fallback ke official
    if (item.photos.official && !isVideoUrl(item.photos.official)) {
      return item.photos.official;
    }
  }
  
  // PRIORITAS 6: Cek video_url di laporan lain
  if (item.laporan_terbaru) {
    for (const laporan of item.laporan_terbaru) {
      if (laporan.video_url) {
        const videoThumb = getVideoThumbnail(laporan.video_url);
        if (videoThumb) return videoThumb;
      }
    }
  }
  
  // LAST RESORT: Placeholder default online
  return 'https://placehold.co/400x225/1a1a1a/666666?text=NO+IMAGE';
};

// ── StableGridCard ─────────────────────────────────────────────────
const StableGridCard = memo(({ item, onCardClick, showDistance = false, isNewReportTab = false }) => {
  const handleClick = useCallback(() => onCardClick(item), [onCardClick, item]);

  const getTypeBadgeColor = (tipe) => {
    switch (tipe?.toLowerCase()) {
      case 'ramai': return 'bg-orange-500/20 text-orange-500';
      case 'sepi': return 'bg-blue-500/20 text-blue-500';
      case 'macet': return 'bg-red-500/20 text-red-500';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const hasLaporan = item.laporan_terbaru?.length > 0;
  const latestReport = hasLaporan ? item.laporan_terbaru[0] : null;
  const thumbnail = getThumbnail(item);

  const isNewReport = useMemo(() => {
    if (!hasLaporan) return false;
    const latestDate = [...item.laporan_terbaru].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]?.created_at;
    return latestDate && (new Date() - new Date(latestDate)) / (1000 * 60 * 60) <= 24;
  }, [item.laporan_terbaru]);

  return (
    <button onClick={handleClick} className="flex flex-col text-left rounded-2xl overflow-hidden border bg-white/5 border-white/10 w-full relative">
      {isNewReport && <div className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-green-500/20 text-green-500">BARU</div>}
      {hasLaporan && latestReport?.tipe && (
        <div className={`absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${getTypeBadgeColor(latestReport.tipe)}`}>
          {latestReport.tipe}
        </div>
      )}

      <div className="aspect-video bg-zinc-800">
        <img 
          src={thumbnail} 
          className="w-full h-full object-cover" 
          loading="lazy" 
          alt={item.name}
          onError={(e) => { e.target.src = 'https://placehold.co/400x225/1a1a1a/666666?text=ERROR'; }}
        />
      </div>

      <div className="p-3">
        <h4 className="text-xs font-black uppercase truncate">{item.name}</h4>
        <p className="text-[10px] opacity-40 truncate">{item.category}</p>
        {showDistance && item.distance && <p className="text-[10px] opacity-60 mt-1">📍 {item.distance.toFixed(1)} km</p>}
        {hasLaporan && <p className="text-[10px] opacity-60 mt-1">📊 {item.laporan_terbaru.length} laporan</p>}
      </div>
    </button>
  );
});

StableGridCard.displayName = 'StableGridCard';

function SearchContent() {
  const router = useRouter();
  const { isMalam, isSore } = useTheme();
  const { location, status: locationStatus, placeName, requestLocation } = useLocation();

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
  const [isAiLoading, setIsAiLoading] = useState(false);

  const initialLoadDone = useRef(false);
  const suggestionsGeneratedRef = useRef(false);
  const debounceTimerRef = useRef(null);
  const isMountedRef = useRef(true);
  const channelRef = useRef(null);
  const intervalIdRef = useRef(null);

  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isKomentarModalOpen, setIsKomentarModalOpen] = useState(false);
  const [selectedForAI, setSelectedForAI] = useState(null);
  const [selectedForKomentar, setSelectedForKomentar] = useState(null);

  // ==================== UPDATE TRENDING KEYWORDS ====================
  const updateTrendingKeywords = useCallback((keyword) => {
    setTrendingKeywords(prev => {
      const updated = [keyword, ...prev.filter(k => k !== keyword)].slice(0, 10);
      localStorage.setItem("trending_keywords", JSON.stringify(updated));
      return updated;
    });
  }, []);

  // ==================== FETCH FRESH DATA ====================
  const fetchFreshData = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const { data: tempatData, error: tempatError } = await supabase
        .from("tempat")
        .select(`
          id, 
          name, 
          category, 
          alamat, 
          photos, 
          latitude, 
          longitude, 
          created_at,
          image_url
        `)
        .order("name", { ascending: true })
        .limit(80);

      if (tempatError) throw tempatError;

      const { data: laporanData, error: laporanError } = await supabase
        .from("laporan_warga")
        .select("id, tempat_id, photo_url, video_url, content, created_at, user_name, tipe, time_tag")
        .order("created_at", { ascending: false });

      if (laporanError) throw laporanError;

      const mergedData = tempatData.map(tempat => ({
        ...tempat,
        laporan_terbaru: (laporanData || [])
          .filter(l => l.tempat_id === tempat.id)
          .slice(0, 30)
      }));

      if (isMountedRef.current) {
        setAllData(mergedData);
        sessionStorage.setItem('feed_view_cache', JSON.stringify(mergedData));
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      if (isMountedRef.current && showLoading) setLoading(false);
    }
  }, []);

  // ==================== GLOBAL REFRESH ====================
  const handleGlobalRefresh = useCallback(async () => {
    console.log("🔄 Search page manual refresh");
    await fetchFreshData(true);
    router.refresh();
  }, [fetchFreshData, router]);

  // ==================== HANDLE SEARCH ====================
  const handleSearch = useCallback((searchQuery) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    setRecentSearches(prev => {
      const updated = [trimmed, ...prev.filter(s => s !== trimmed)].slice(0, 10);
      localStorage.setItem("recent_searches", JSON.stringify(updated));
      return updated;
    });
    updateTrendingKeywords(trimmed);
    setQuery(trimmed);
    setIsTyping(false);
    setExploreMode(false);
  }, [updateTrendingKeywords]);

  // ==================== HANDLE OPEN EXPLORE ====================
  const handleOpenExplore = useCallback((item) => {
    handleSearch(item.name);
    setExploreItems([item]);
    setExploreMode(true);
  }, [handleSearch]);

  // ==================== HANDLE SELECT SUGGESTION ====================
  const handleSelectSuggestion = useCallback((suggestion) => handleSearch(suggestion), [handleSearch]);

  // ==================== HANDLE CLEAR RECENT SEARCHES ====================
  const handleClearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    localStorage.removeItem("recent_searches");
  }, []);

  // ==================== EVENT LISTENER ====================
  useEffect(() => {
    const handleLaporanUpdated = (event) => {
      console.log("📢 Received laporan-updated event:", event?.detail);
      fetchFreshData(false);
    };
    
    window.addEventListener('laporan-updated', handleLaporanUpdated);
    window.refreshSearchPage = handleGlobalRefresh;
    
    return () => {
      window.removeEventListener('laporan-updated', handleLaporanUpdated);
      if (window.refreshSearchPage === handleGlobalRefresh) {
        delete window.refreshSearchPage;
      }
    };
  }, [handleGlobalRefresh, fetchFreshData]);

  // ==================== UPDATE EXPLORE ITEMS ====================
  useEffect(() => {
    if (!exploreMode || exploreItems.length === 0) return;
    
    const updatedItems = exploreItems.map(exploreItem => {
      const freshData = allData.find(d => d.id === exploreItem.id);
      return freshData || exploreItem;
    });
    
    if (JSON.stringify(updatedItems) !== JSON.stringify(exploreItems)) {
      setExploreItems(updatedItems);
    }
  }, [allData, exploreMode, exploreItems]);

  // ==================== INITIAL LOAD + REALTIME + PERIODIC REFRESH ====================
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    const loadInitialData = async () => {
      const cached = sessionStorage.getItem('feed_view_cache');
      if (cached) {
        setAllData(JSON.parse(cached));
        setLoading(false);
      } else {
        await fetchFreshData(true);
      }
    };

    loadInitialData();

    const setupRealtime = () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);

      channelRef.current = supabase
        .channel('search-laporan-updates')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'laporan_warga' },
          async (payload) => {
            console.log(`📢 New laporan for tempat_id: ${payload.new.tempat_id}`);
            
            setAllData(prev =>
              prev.map(tempat =>
                tempat.id === payload.new.tempat_id
                  ? { 
                      ...tempat, 
                      laporan_terbaru: [payload.new, ...(tempat.laporan_terbaru || [])].slice(0, 30) 
                    }
                  : tempat
              )
            );
            
            setTimeout(() => fetchFreshData(false), 1000);
          }
        )
        .subscribe();
    };

    setupRealtime();

    intervalIdRef.current = setInterval(() => {
      if (isMountedRef.current) {
        console.log("🔄 Periodic refresh search page");
        fetchFreshData(false);
      }
    }, 30000);

    const saved = localStorage.getItem("recent_searches");
    if (saved) setRecentSearches(JSON.parse(saved));

    const trending = localStorage.getItem("trending_keywords");
    if (trending) setTrendingKeywords(JSON.parse(trending));
    else setTrendingKeywords(["kopi", "kuliner", "cafe"]);

    return () => {
      isMountedRef.current = false;
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (intervalIdRef.current) clearInterval(intervalIdRef.current);
    };
  }, [fetchFreshData]);

  // ==================== AI & SUGGESTIONS ====================
  const callGroqAI = useCallback(async (prompt, context = {}) => {
    if (!aiRateLimiter.canCall()) return [];
    const cacheKey = `${prompt}_${JSON.stringify(context)}`;
    const cached = aiCache.get(cacheKey);
    if (cached) return cached;

    setIsAiLoading(true);
    try {
      const res = await fetch('/api/groq-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, context, ...GROQ_CONFIG }),
      });
      const data = await res.json();
      if (data.suggestions) {
        aiCache.set(cacheKey, data.suggestions);
        return data.suggestions;
      }
      return [];
    } catch {
      return [];
    } finally {
      setIsAiLoading(false);
    }
  }, []);

  const generateLocalSuggestions = useCallback(() => {
    const hour = new Date().getHours();
    const suggestions = [];
    if (hour >= 5 && hour < 11) suggestions.push("sarapan", "cafe pagi");
    else if (hour >= 11 && hour < 15) suggestions.push("makan siang", "restaurant");
    else if (hour >= 15 && hour < 18) suggestions.push("cafe sore", "ngabuburit");
    else if (hour >= 18 && hour < 23) suggestions.push("makan malam", "kuliner malam");
    else suggestions.push("24 jam");

    if (placeName) suggestions.push(placeName);
    suggestions.push(...trendingKeywords.slice(0, 2), ...recentSearches.slice(0, 2));

    return [...new Set(suggestions)].slice(0, 6);
  }, [placeName, trendingKeywords, recentSearches]);

  const generateSmartSuggestions = useCallback(() => {
    setSmartSuggestions(generateLocalSuggestions());
  }, [generateLocalSuggestions]);

  useEffect(() => {
    if (loading || suggestionsGeneratedRef.current || !placeName) return;
    suggestionsGeneratedRef.current = true;
    generateSmartSuggestions();
  }, [loading, placeName, generateSmartSuggestions]);

  useEffect(() => {
    if (!isTyping || query.length < 3) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(generateSmartSuggestions, 800);
    return () => clearTimeout(debounceTimerRef.current);
  }, [query, isTyping, generateSmartSuggestions]);

  // ==================== RESULTS ====================
  const results = useMemo(() => {
    if (activeFilter === "Sekitarmu") {
      if (!location?.latitude || !location?.longitude) return [];
      return allData
        .filter(item => item.latitude && item.longitude)
        .map(item => ({
          ...item,
          distance: calculateDistance(location.latitude, location.longitude, item.latitude, item.longitude)
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 20);
    }

    if (activeFilter === "Baru terjadi") {
      return allData
        .filter(item => item.laporan_terbaru?.length > 0)
        .map(item => {
          const latest = [...item.laporan_terbaru].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
          return { ...item, latestReportDate: latest?.created_at };
        })
        .sort((a, b) => new Date(b.latestReportDate) - new Date(a.latestReportDate))
        .slice(0, 20);
    }

    let filtered = allData;
    const term = query.toLowerCase().trim();
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
    return filtered.slice(0, 20);
  }, [query, allData, activeFilter, location]);

  const getBackgroundColor = useCallback(() => isMalam ? "bg-[#09090b]" : isSore ? "bg-[#fff5f0]" : "bg-white", [isMalam, isSore]);
  const getBorderColor = useCallback(() => isMalam ? "border-white/[0.05]" : "border-black/[0.03]", [isMalam]);

  if (loading && allData.length === 0) {
    return <div className={`min-h-screen flex items-center justify-center ${getBackgroundColor()}`}>
      <div className="w-8 h-8 border-2 border-[#E3655B] border-t-transparent rounded-full animate-spin" />
    </div>;
  }

  return (
    <>
      <main className={`min-h-screen transition-colors duration-700 ${getBackgroundColor()}`}>
        <div className={`max-w-md mx-auto min-h-screen flex flex-col relative border-x ${getBorderColor()}`}>

          {/* HEADER */}
          <div className={`sticky top-0 z-50 px-4 pt-4 pb-2 backdrop-blur-3xl ${isMalam ? "bg-black/80 border-b border-white/[0.05]" : "bg-white/80 border-b border-black/[0.03]"}`}>
            <div className="flex items-center gap-2">
              <button onClick={() => exploreMode ? setExploreMode(false) : router.back()} className={`p-2 rounded-xl ${isMalam ? "hover:bg-white/5 text-white" : "hover:bg-black/5 text-slate-900"}`}>
                ←
              </button>

              <input
                autoFocus
                value={query}
                onChange={(e) => { setQuery(e.target.value); setIsTyping(true); setExploreMode(false); }}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch(query)}
                placeholder="Cari tempat, lihat suasana dan kondisi..."
                className={`flex-1 py-3 px-4 rounded-2xl text-sm font-bold outline-none border ${isMalam ? "bg-white/[0.07] border-white/10 text-white placeholder:text-white/20" : "bg-black/[0.04] border-black/5 text-slate-900 placeholder:text-slate-400"}`}
              />

              <button onClick={handleGlobalRefresh} className="p-2 rounded-xl hover:bg-white/10 text-white/70" title="Refresh">↻</button>

              {!location?.latitude && (
                <button onClick={requestLocation} className="px-3 py-1.5 rounded-full bg-[#E3655B] text-white text-[10px] font-bold">
                  Lokasi
                </button>
              )}
            </div>

            {!exploreMode && !isTyping && (
              <div className="flex gap-2 overflow-x-auto py-3 hide-scrollbar">
                {["Semua", "Lagi ramai", "Sekitarmu", "Baru terjadi"].map(tab => (
                  <button
                    key={tab}
                    onClick={() => {
                      setActiveFilter(tab);
                      if (tab === "Sekitarmu") { setIsTyping(false); setExploreMode(false); setQuery(""); }
                      else setExploreMode(false);
                    }}
                    className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wide border whitespace-nowrap ${activeFilter === tab ? "bg-[#E3655B] border-[#E3655B] text-white" : isMalam ? "bg-white/5 border-white/10 text-white/50" : "bg-black/5 border-black/5 text-slate-500"}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* SUGGESTIONS SECTION */}
          {isTyping && query.length === 0 && (
            <div className="px-4 py-3">
              {recentSearches.length > 0 && (
                <div className="mb-5">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className={`text-[11px] font-bold uppercase ${isMalam ? "text-white/40" : "text-slate-400"}`}>
                      Pencarian Terbaru
                    </h3>
                    <button onClick={handleClearRecentSearches} className="text-[10px] text-slate-400">
                      Hapus
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.slice(0, 5).map((search, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSelectSuggestion(search)}
                        className={`px-3 py-1.5 rounded-full text-[11px] ${
                          isMalam ? "bg-white/10 text-white/70" : "bg-black/5 text-slate-700"
                        }`}
                      >
                        {search}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className={`text-[11px] font-bold uppercase ${isMalam ? "text-white/40" : "text-slate-400"}`}>
                    Rekomendasi
                  </h3>
                  {isAiLoading && <div className="w-3 h-3 border-2 border-[#E3655B] border-t-transparent rounded-full animate-spin" />}
                </div>
                <div className="flex flex-wrap gap-2">
                  {smartSuggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectSuggestion(suggestion)}
                      className={`px-3 py-1.5 rounded-full text-[11px] ${
                        isMalam ? "bg-white/10 text-white/70" : "bg-black/5 text-slate-700"
                      }`}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SEARCH RESULTS */}
          {isTyping && query.length > 0 && (
            <div className="mt-1 divide-y">
              {results.slice(0, 5).map(item => (
                <button 
                  key={item.id} 
                  onClick={() => handleSelectSuggestion(item.name)} 
                  className="flex items-center gap-3 py-3 w-full px-4"
                >
                  <div className="w-8 h-8 rounded-lg bg-black/5 flex items-center justify-center">
                    <span className="text-xs">📍</span>
                  </div>
                  <div className="flex flex-col text-left flex-1">
                    <span className="text-sm font-bold">{item.name}</span>
                    <span className="text-[10px] opacity-40">{item.category}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
          
          {/* GRID CARDS */}
          {!isTyping && !exploreMode && (
            <>
              {activeFilter === "Sekitarmu" && !location?.latitude && (
                <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                  <div className="text-4xl mb-3">📍</div>
                  <h3 className="text-sm font-bold mb-1">Aktifkan Lokasi</h3>
                  <p className="text-xs opacity-50 mb-4">
                    Lihat tempat di sekitar Anda
                  </p>
                  <button
                    onClick={async () => { try { await requestLocation(); } catch (err) {} }}
                    className="px-4 py-2 bg-[#E3655B] text-white rounded-full text-xs font-bold"
                  >
                    Aktifkan Lokasi
                  </button>
                </div>
              )}
              
              {(activeFilter !== "Sekitarmu" || location?.latitude) && results.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                  <div className="text-4xl mb-3">🔍</div>
                  <h3 className="text-sm font-bold mb-1">Tidak ada hasil</h3>
                  <p className="text-xs opacity-50">
                    {activeFilter === "Baru terjadi" ? "Belum ada laporan terbaru" : "Coba kata kunci lain"}
                  </p>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-3 py-4 pb-20 px-4">
                {results.map((item) => (
                  <StableGridCard 
                    key={item.id}
                    item={item}
                    onCardClick={handleOpenExplore}
                    showDistance={activeFilter === "Sekitarmu"}
                    isNewReportTab={activeFilter === "Baru terjadi"}
                  />
                ))}
              </div>
            </>
          )}

          {/* EXPLORE MODE */}
          {exploreMode && (
            <div className="flex flex-col gap-5 py-4 pb-20 px-4">
              {exploreItems.map((item) => (
                <FeedCard 
                  key={item.id}
                  item={item} 
                  location={location} 
                  locationReady={locationStatus === "granted"} 
                  openAIModal={() => { setSelectedForAI(item); setIsAIModalOpen(true); }}
                  openKomentarModal={() => { setSelectedForKomentar(item); setIsKomentarModalOpen(true); }} 
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <AIModal isOpen={isAIModalOpen} onClose={() => setIsAIModalOpen(false)} tempat={selectedForAI} />
      <KomentarModal isOpen={isKomentarModalOpen} onClose={() => setIsKomentarModalOpen(false)} tempat={selectedForKomentar} />
      
      <style jsx global>{`
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </>
  );
}

export default function SearchPage() {
  return (
    <LocationProvider>
      <SearchContent />
    </LocationProvider>
  );
}