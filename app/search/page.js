"use client";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import LocationProvider, { useLocation } from "@/components/LocationProvider";
import { useTheme } from "@/app/hooks/useTheme";
import FeedCard from "@/app/components/feed/FeedCard";
import AIModalDetail from "@/app/components/ai/AIModalDetail";
import AIModalOverview from "@/app/components/ai/AIModalOverview";
import KomentarModal from "@/app/components/feed/KomentarModal";
import { calculateDistance } from "@/lib/distance";
import dynamic from "next/dynamic";
import {
  ChevronLeft,
  Mic,
  X,
  MapPin,
  FileText,
  Sparkles,
  TrendingUp,
  Clock,
  Grid3x3,
  List,
} from "lucide-react";

const VoiceSearch = dynamic(() => import("react-voice-search"), { ssr: false });

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
  clear() {
    this.cache.clear();
  }
}

const thumbnailCache = new LRUCache(150);

// ========== KOMPONEN CARD ==========
const getThumbnail = (item) => {
  if (!item) return `https://placehold.co/400x225/1a1a1a/666666?text=📝`;

  const cacheKey = item.id ?? item.name ?? null;
  if (cacheKey) {
    const cached = thumbnailCache.get(cacheKey);
    if (cached) return cached;
  }

  const url =
    item.image_url ||
    item.photo_url ||
    `https://placehold.co/400x225/1a1a1a/666666?text=${item?.name?.charAt(0) || "📝"}`;

  if (cacheKey) thumbnailCache.set(cacheKey, url);
  return url;
};

const getBadgeColor = (tipe) => {
  switch (tipe?.toLowerCase()) {
    case "ramai":
      return "bg-orange-500/20 text-orange-500";
    case "sepi":
      return "bg-blue-500/20 text-blue-500";
    case "macet":
      return "bg-red-500/20 text-red-500";
    default:
      return "bg-gray-500/20 text-gray-400";
  }
};

// ========== CARD UNTUK TEMPAT ==========
const TempatCard = ({ item, onCardClick, showDistance = false }) => {
  const handleClick = useCallback(() => onCardClick(item), [onCardClick, item]);
  const thumbnail = useMemo(() => getThumbnail(item), [item]);
  const isNewReport = useMemo(() => {
    if (!item?.laporan_terbaru?.length) return false;
    const latestDate = item.laporan_terbaru[0]?.created_at;
    return latestDate && (Date.now() - new Date(latestDate)) / (1000 * 60 * 60) <= 24;
  }, [item?.laporan_terbaru]);
  const latestReport = item?.laporan_terbaru?.[0];

  return (
    <button
      onClick={handleClick}
      className="flex flex-col text-left rounded-2xl overflow-hidden border bg-white/5 border-white/10 w-full relative group hover:scale-[1.02] transition-transform"
    >
      {isNewReport && (
        <div className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-green-500/20 text-green-500">
          BARU
        </div>
      )}
      {latestReport?.tipe && (
        <div
          className={`absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${getBadgeColor(
            latestReport.tipe
          )}`}
        >
          {latestReport.tipe}
        </div>
      )}
      <div className="aspect-video bg-zinc-800 relative">
        <img src={thumbnail} className="w-full h-full object-cover" loading="lazy" alt={item?.name || "Tempat"} />
        {item?.matchingKeyword && (
          <div className="absolute bottom-2 left-2 z-10 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-blue-500/80 text-white backdrop-blur-sm">
            {item.matchingKeyword}
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between">
          <h4 className="text-xs font-black uppercase truncate flex-1">{item?.name || "Tanpa Nama"}</h4>
          {showDistance && item?.distance !== undefined && (
            <span className="text-[10px] opacity-60 ml-2 flex-shrink-0">📍 {item.distance.toFixed(1)} km</span>
          )}
        </div>
        <p className="text-[10px] opacity-40 truncate">{item?.category || "Umum"}</p>
        {item?.laporan_terbaru?.length > 0 && (
          <p className="text-[10px] opacity-60 mt-1 line-clamp-1">
            {item.laporan_terbaru[0]?.content?.substring(0, 50)}
          </p>
        )}
      </div>
    </button>
  );
};

// ========== CARD UNTUK LAPORAN MANDIRI ==========
const LaporanCard = ({ item, onCardClick }) => {
  const handleClick = useCallback(() => onCardClick(item), [onCardClick, item]);
  const thumbnail = useMemo(() => getThumbnail(item), [item]);

  return (
    <button
      onClick={handleClick}
      className="flex flex-col text-left rounded-2xl overflow-hidden border bg-white/5 border-white/10 w-full relative group hover:scale-[1.02] transition-transform"
    >
      {item?.tipe && (
        <div className={`absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${getBadgeColor(item.tipe)}`}>
          {item.tipe}
        </div>
      )}
      <div className="aspect-video bg-zinc-800 relative">
        <img src={thumbnail} className="w-full h-full object-cover" loading="lazy" alt="Laporan" />
        <div className="absolute bottom-2 left-2 z-10 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-purple-500/80 text-white backdrop-blur-sm">
          📝 Laporan
        </div>
      </div>
      <div className="p-3">
        <p className="text-xs font-medium line-clamp-2">{item?.content || "Tidak ada konten"}</p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] opacity-40">{item?.user_name || "Anonim"}</span>
          <span className="text-[10px] opacity-40">
            {item?.created_at ? new Date(item.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" }) : "-"}
          </span>
        </div>
        {item?.alamat && <p className="text-[10px] opacity-40 mt-1">📍 {item.alamat}</p>}
      </div>
    </button>
  );
};

function getPreloadedSuggestions(placeName) {
  const hour = new Date().getHours();
  const suggestions = [];
  if (hour >= 5 && hour < 11) suggestions.push("sarapan", "cafe pagi");
  else if (hour >= 11 && hour < 15) suggestions.push("makan siang", "restaurant");
  else if (hour >= 15 && hour < 18) suggestions.push("cafe sore", "ngabuburit");
  else if (hour >= 18 && hour < 23) suggestions.push("makan malam", "kuliner malam");
  else suggestions.push("24 jam");

  suggestions.push("lalu lintas", "kondisi", "tempat ramai", "macet");
  if (placeName) suggestions.push(placeName);
  suggestions.push("kopi", "kuliner", "cafe", "wisata");

  return [...new Set(suggestions)].slice(0, 8);
}

const FILTER_TABS = ["Semua", "Lagi ramai", "Sekitarmu", "Baru"];

function AIModal({ isOpen, onClose, tempat }) {
  // Cek apakah ini mode overview
  const isOverviewMode = tempat?._isOverview === true;

  // Jika mode overview, tampilkan Google AI Overview style
  if (isOverviewMode) {
    return <AIModalOverview isOpen={isOpen} onClose={onClose} data={tempat} />;
  }

  // Jika ada item dan bukan overview, buka chat detail
  if (tempat?.id) {
    return <AIModalDetail isOpen={isOpen} onClose={onClose} item={tempat} />;
  }

  return null;
}

// ==================== SEARCH CONTENT ====================
function SearchContent() {
  const router = useRouter();
  const { isMalam, isSore, bg: themeBg, text: themeText } = useTheme();
  const { location, locationStatus, placeName, requestLocation } = useLocation();

  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("Semua");
  const [searchMode, setSearchMode] = useState("semua");
  const [viewMode, setViewMode] = useState("grid");

  const [allTempat, setAllTempat] = useState([]);
  const [allLaporan, setAllLaporan] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isTyping, setIsTyping] = useState(true);
  const [exploreMode, setExploreMode] = useState(false);
  const [exploreItems, setExploreItems] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [smartSuggestions, setSmartSuggestions] = useState([]);
  const [showAISummary, setShowAISummary] = useState(false);
  const [aiSummary, setAiSummary] = useState("");

  const [nearbyResults, setNearbyResults] = useState([]);
  const [recentResults, setRecentResults] = useState([]);
  const [ramaiResults, setRamaiResults] = useState([]);

  const initialLoadDone = useRef(false);
  const isMountedRef = useRef(true);

  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isKomentarModalOpen, setIsKomentarModalOpen] = useState(false);
  const [selectedForAI, setSelectedForAI] = useState(null);
  const [selectedForKomentar, setSelectedForKomentar] = useState(null);

  const deferredQuery = query;
  const isTypingDeferred = isTyping;

  const inputRef = useRef(null);

  // ===== AUTO FOCUS =====
  useEffect(() => {
    const t = setTimeout(() => {
      if (inputRef.current) inputRef.current.focus();
    }, 100);
    return () => clearTimeout(t);
  }, []);

  // ========== FETCH DATA ==========
  const fetchData = useCallback(async () => {
    if (!supabase) {
      console.error("Supabase client not initialized");
      setError("Database tidak terhubung");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const tempatPromise = supabase
        .from("tempat")
        .select("id, name, category, alamat, photos, latitude, longitude, created_at, image_url, description, jam_buka, estimasi_orang, latest_condition, vibe_count")
        .order("name", { ascending: true })
        .limit(500);

      const laporanPromise = supabase
        .from("laporan_warga")
        .select(
          "id, tempat_id, photo_url, video_url, content, created_at, user_name, tipe, time_tag, estimated_people, estimated_wait_time, latitude:lokasi_lat, longitude:lokasi_lng, alamat:lokasi_name"
        )
        .order("created_at", { ascending: false })
        .limit(500);

      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Request timeout")), 10000));

      const [tempatResult, laporanResult] = await Promise.race([
        Promise.all([tempatPromise, laporanPromise]),
        timeoutPromise.then(() => {
          throw new Error("Timeout fetching data");
        }),
      ]);

      if (tempatResult?.error) {
        const { message, details, hint, code } = tempatResult.error;
        console.error("Supabase tempat error:", { message, details, hint, code });
        throw new Error(message || details || hint || `Gagal mengambil data tempat${code ? ` (code: ${code})` : ""}`);
      }
      if (laporanResult?.error) {
        const { message, details, hint, code } = laporanResult.error;
        console.error("Supabase laporan error:", { message, details, hint, code });
        throw new Error(message || details || hint || `Gagal mengambil data laporan${code ? ` (code: ${code})` : ""}`);
      }

      const tempatData = tempatResult?.data || [];
      const laporanData = laporanResult?.data || [];

      console.log(`✅ Data fetched: ${tempatData.length} tempat, ${laporanData.length} laporan`);

      const laporanWithTempat = laporanData.filter((l) => l?.tempat_id);
      const laporanMandiri = laporanData.filter((l) => !l?.tempat_id);

      const laporanMap = new Map();
      for (const laporan of laporanWithTempat) {
        if (!laporanMap.has(laporan.tempat_id)) laporanMap.set(laporan.tempat_id, []);
        const list = laporanMap.get(laporan.tempat_id);
        if (list.length < 5) list.push(laporan);
      }

      const mergedTempat = tempatData.map((tempat) => ({
        ...tempat,
        laporan_terbaru: laporanMap.get(tempat.id) || [],
      }));

      if (isMountedRef.current) {
        setAllTempat(mergedTempat);
        setAllLaporan(laporanMandiri);
        setError(null);

        try {
          sessionStorage.setItem(
            "search_cache_v3",
            JSON.stringify({ tempat: mergedTempat, laporan: laporanMandiri, timestamp: Date.now() })
          );
        } catch (e) {
          console.warn("Cache storage failed:", e);
        }
      }
    } catch (err) {
      console.error("Fetch error:", err);

      try {
        const cached = sessionStorage.getItem("search_cache_v3");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed?.tempat?.length > 0) {
            console.log("📦 Using cached data due to error");
            setAllTempat(parsed.tempat);
            setAllLaporan(parsed.laporan || []);
            setError("Menampilkan data cached, koneksi database bermasalah");
            if (isMountedRef.current) setLoading(false);
            return;
          }
        }
      } catch (e) {
        console.warn("Cache read failed:", e);
      }

      if (isMountedRef.current) {
        setError(err.message || "Gagal mengambil data. Silakan coba lagi.");
        setAllTempat([]);
        setAllLaporan([]);
      }
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, []);

  // ========== HITUNG ULANG FILTER ==========
  useEffect(() => {
    if (!allTempat.length) {
      setNearbyResults([]);
      setRecentResults([]);
      setRamaiResults([]);
      return;
    }

    if (location?.latitude && location?.longitude) {
      const withDistance = allTempat
        .filter((item) => item?.latitude && item?.longitude)
        .map((item) => ({
          ...item,
          distance: calculateDistance(location.latitude, location.longitude, item.latitude, item.longitude),
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 20);
      setNearbyResults(withDistance);
    } else {
      setNearbyResults([]);
    }

    const withRecent = allTempat
      .filter((item) => item?.laporan_terbaru?.length > 0)
      .map((item) => ({ ...item, latestReportDate: item.laporan_terbaru[0]?.created_at }))
      .sort((a, b) => new Date(b.latestReportDate) - new Date(a.latestReportDate))
      .slice(0, 20);
    setRecentResults(withRecent);

    const withRamai = allTempat
      .filter((item) => item?.laporan_terbaru?.some((l) => l?.tipe?.toLowerCase() === "ramai"))
      .map((item) => ({ ...item, latestReportDate: item.laporan_terbaru[0]?.created_at }))
      .sort((a, b) => new Date(b.latestReportDate) - new Date(a.latestReportDate))
      .slice(0, 20);
    setRamaiResults(withRamai);
  }, [allTempat, location]);

  // ========== LOGIC FILTER/SEARCH ==========
  const getFilteredResults = useCallback(
    (term, filterTab) => {
      const normalizedTerm = (term || "").toLowerCase().trim();

      if (filterTab === "Sekitarmu") return nearbyResults;
      if (filterTab === "Baru") return recentResults;
      if (filterTab === "Lagi ramai") return ramaiResults;

      if (!normalizedTerm) return [];

      let filteredTempat = allTempat;
      let filteredLaporan = allLaporan;
      if (searchMode === "tempat") filteredLaporan = [];
      else if (searchMode === "laporan") filteredTempat = [];

      const tempatResults = filteredTempat
        .filter(
          (item) =>
            item?.name?.toLowerCase().includes(normalizedTerm) ||
            item?.alamat?.toLowerCase().includes(normalizedTerm) ||
            item?.category?.toLowerCase().includes(normalizedTerm) ||
            item?.description?.toLowerCase().includes(normalizedTerm) ||
            item?.laporan_terbaru?.some(
              (l) => l?.content?.toLowerCase().includes(normalizedTerm) || l?.tipe?.toLowerCase().includes(normalizedTerm)
            )
        )
        .map((item) => ({ ...item, _type: "tempat" }));

      const laporanResults = filteredLaporan
        .filter(
          (item) =>
            item?.content?.toLowerCase().includes(normalizedTerm) ||
            item?.alamat?.toLowerCase().includes(normalizedTerm) ||
            item?.tipe?.toLowerCase().includes(normalizedTerm) ||
            item?.user_name?.toLowerCase().includes(normalizedTerm)
        )
        .map((item) => ({ ...item, _type: "laporan" }));

      const combined = [...tempatResults, ...laporanResults];

      combined.sort((a, b) => {
        const aName = a?.name || a?.content || "";
        const bName = b?.name || b?.content || "";
        const aMatch = aName.toLowerCase().includes(normalizedTerm);
        const bMatch = bName.toLowerCase().includes(normalizedTerm);
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
        return 0;
      });

      return combined;
    },
    [allTempat, allLaporan, searchMode, nearbyResults, recentResults, ramaiResults]
  );

  const results = useMemo(
    () => getFilteredResults(deferredQuery, activeFilter),
    [deferredQuery, activeFilter, getFilteredResults]
  );

  // ========== AI SUMMARY RINGKAS (tanpa nomor) ==========
  const generateAISummary = useCallback((searchQuery, searchResults) => {
    if (!searchQuery || searchResults.length === 0) {
      setShowAISummary(false);
      return;
    }

    setShowAISummary(true);
    try {
      const total = searchResults.length;

      // Cari tempat yang cocok untuk ditampilkan deskripsinya
      const matchedPlace = searchResults.find(item =>
        item?._type === 'tempat' &&
        (item?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item?.category?.toLowerCase().includes(searchQuery.toLowerCase()))
      );

      if (matchedPlace && matchedPlace.description) {
        // Tampilkan deskripsi singkat jika ada
        const shortDesc = matchedPlace.description.length > 100
          ? matchedPlace.description.substring(0, 100) + '...'
          : matchedPlace.description;

        let summary = `📍 **${matchedPlace.name}**\n${shortDesc}`;

        // Tambahkan kondisi jika ada
        if (matchedPlace.latest_condition) {
          const conditionMap = {
            'ramai': '🟠 Ramai',
            'sepi': '🟢 Sepi',
            'macet': '🔴 Macet'
          };
          summary += `\n${conditionMap[matchedPlace.latest_condition] || matchedPlace.latest_condition}`;
        }

        if (matchedPlace.estimasi_orang) {
          summary += ` · 👥 ${matchedPlace.estimasi_orang} org`;
        }

        setAiSummary(summary);
      } else {
        // Fallback: tampilkan jumlah hasil
        const topResults = searchResults
          .slice(0, 2)
          .map((r) => r?.name || r?.content?.substring(0, 20) || "Item")
          .join(", ");

        let summary = `🔍 ${total} hasil untuk "${searchQuery}"`;
        if (topResults) {
          summary += `: ${topResults}`;
          if (total > 2) summary += `, +${total - 2} lainnya`;
        }
        setAiSummary(summary);
      }
    } catch (e) {
      setAiSummary(`🔍 ${searchResults.length} hasil untuk "${searchQuery}"`);
    }
  }, []);

  // ========== HANDLERS ==========
  const handleSearch = useCallback(
    (searchQuery) => {
      const trimmed = searchQuery.trim();
      if (!trimmed) return;

      setRecentSearches((prev) => {
        const updated = [trimmed, ...prev.filter((s) => s !== trimmed)].slice(0, 10);
        try {
          localStorage.setItem("recent_searches", JSON.stringify(updated));
        } catch (e) { }
        return updated;
      });

      setQuery(trimmed);
      setIsTyping(false);
      setExploreMode(false);

      const freshResults = getFilteredResults(trimmed, activeFilter);
      generateAISummary(trimmed, freshResults);
    },
    [activeFilter, getFilteredResults, generateAISummary]
  );

  const handleSelectSuggestion = useCallback((suggestion) => handleSearch(suggestion), [handleSearch]);

  const isVideoItem = useCallback((item) => {
    return Boolean(item?.video_url) || item?.media_type === "video" || item?.report_type === "story";
  }, []);

  const handleOpenExplore = useCallback(
    (item) => {
      if (!item?.id) return;

      if (isVideoItem(item)) {
        router.push(`/explore?story=${item.id}`);
        return;
      }

      setExploreItems([item]);
      setExploreMode(true);
      setIsTyping(false);
    },
    [isVideoItem, router]
  );

  const handleClearQuery = useCallback(() => {
    setQuery("");
    setIsTyping(true);
    setExploreMode(false);
    setShowAISummary(false);
    setTimeout(() => {
      if (inputRef.current) inputRef.current.focus();
    }, 0);
  }, []);

  const handleShare = useCallback(async (item) => {
    if (!item?.id) return;
    const shareUrl = `${window.location.origin}/post/${item.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: item?.name || "Setempat.id", text: `Lihat ${item?.name || "lokasi"} di Setempat.id`, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        alert("✅ Link disalin!");
      }
    } catch (_) { }
  }, []);

  const handleRetry = useCallback(() => {
    fetchData();
  }, [fetchData]);

  // ========== BUKA AI MODAL OVERVIEW (bukan chat) ==========
  const openAIOverview = useCallback(() => {
    let aiData = null;

    if (results.length > 0 || query) {
      const matchedPlace = results.find(item =>
        item?._type === 'tempat' &&
        (item?.name?.toLowerCase().includes(query.toLowerCase()) ||
          item?.category?.toLowerCase().includes(query.toLowerCase()))
      );

      aiData = {
        id: 'ai-overview',
        name: query || 'Semua tempat',
        _isOverview: true,
        _query: query || 'Semua tempat',
        _results: results.length > 0 ? results : allTempat,
        _totalResults: results.length || allTempat.length,
        _matchedPlace: matchedPlace || null,
        _allLaporan: allLaporan,
        _type: 'ai-overview'
      };
    } else {
      const popularPlaces = allTempat.slice(0, 5);
      aiData = {
        id: 'ai-overview',
        name: 'Tempat Populer',
        _isOverview: true,
        _query: 'Tempat populer',
        _results: popularPlaces,
        _totalResults: popularPlaces.length,
        _matchedPlace: popularPlaces[0] || null,
        _allLaporan: allLaporan,
        _type: 'ai-overview'
      };
    }

    setSelectedForAI(aiData);
    setIsAIModalOpen(true);
  }, [query, results, allTempat, allLaporan]);

  // ========== INITIAL LOAD ==========
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    isMountedRef.current = true;

    const loadInitial = async () => {
      try {
        const cached = sessionStorage.getItem("search_cache_v3");
        if (cached) {
          const parsed = JSON.parse(cached);
          const isFresh = parsed?.timestamp && Date.now() - parsed.timestamp < 5 * 60 * 1000;
          if (parsed?.tempat?.length > 0 && isFresh) {
            console.log("📦 Load from fresh cache");
            setAllTempat(parsed.tempat);
            setAllLaporan(parsed.laporan || []);
            setLoading(false);
          }
        }
      } catch (e) {
        console.warn("Cache read failed:", e);
      }

      await fetchData();
    };

    loadInitial();

    let channel = null;
    try {
      channel = supabase
        .channel("search-updates")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "laporan_warga" }, () => {
          console.log("📢 New report detected, refreshing...");
          setTimeout(() => fetchData(), 3000);
        })
        .subscribe((status) => {
          console.log("🔔 Subscription status:", status);
        });
    } catch (e) {
      console.warn("Subscription failed:", e);
    }

    try {
      const savedRecent = localStorage.getItem("recent_searches");
      if (savedRecent) setRecentSearches(JSON.parse(savedRecent));
    } catch (e) { }

    return () => {
      isMountedRef.current = false;
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (e) { }
      }
    };
  }, [fetchData]);

  useEffect(() => {
    setSmartSuggestions(getPreloadedSuggestions(placeName));
  }, [placeName]);

  // ========== RENDER ==========
  if (loading && allTempat.length === 0) {
    return (
      <div className={`min-h-screen w-full ${themeBg} ${themeText}`}>
        <div className="mx-auto max-w-[400px] flex justify-center items-center h-64">
          <div className="text-center">
            <div
              className="relative h-8 w-8 border-2 border-white/20 border-t-[#E3655B] border-b-[#25F4EE] rounded-full animate-spin mx-auto"
              style={{ animationDuration: "0.35s" }}
            ></div>
            <p className="text-xs opacity-50 mt-3">Memuat data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && allTempat.length === 0) {
    return (
      <div className={`min-h-screen w-full ${themeBg} ${themeText}`}>
        <div className="mx-auto max-w-[400px] flex flex-col items-center justify-center h-64 px-4 text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <h3 className="text-sm font-bold mb-2">Gagal Memuat Data</h3>
          <p className="text-xs opacity-60 mb-4">{error}</p>
          <button onClick={handleRetry} className="px-4 py-2 bg-[#E3655B] text-white rounded-full text-xs font-bold">
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen w-full ${themeBg} ${themeText} transition-colors duration-300`}>
      <div
        className="mx-auto w-full max-w-[400px] border-x"
        style={{
          borderLeft: `1px solid ${isMalam ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)"}`,
          borderRight: `1px solid ${isMalam ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)"}`,
        }}
      >
        {/* HEADER */}
        <div
          className={`sticky top-0 z-50 px-4 pt-4 pb-2 backdrop-blur-2xl transition-all duration-500 
          ${isMalam ? "bg-black/60 border-b border-white/5" : "bg-white/70 border-b border-slate-200/50"}`}
        >
          <div className="flex items-center gap-1.5">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => (exploreMode ? setExploreMode(false) : router.back())}
              className={`p-2 rounded-2xl transition-colors flex-shrink-0 ${isMalam ? "bg-white/5 hover:bg-white/10" : "bg-black/5 hover:bg-black/10"}`}
            >
              <ChevronLeft size={18} />
            </motion.button>

            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="search"
                autoFocus
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setIsTyping(true);
                  setExploreMode(false);
                  setShowAISummary(false);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleSearch(query)}
                placeholder="Cari tempat atau laporan..."
                autoComplete="off"
                className="w-full bg-transparent py-2 px-3 focus:outline-none focus:ring-0 text-sm"
              />
              {query && (
                <button onClick={handleClearQuery} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X size={16} className="opacity-40" />
                </button>
              )}
            </div>

            {/* ========== PERBAIKAN: Tombol dengan jarak lebih lega ========== */}
            <div className="flex items-center gap-6 flex-shrink-0">
              {/* Tombol AI Summary - Klik untuk buka modal lengkap */}
              <button
                onClick={openAIOverview}
                className="p-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg hover:scale-105 transition-all relative group flex-shrink-0"
                aria-label="Buka AI Summary Lengkap"
              >
                <Sparkles size={18} />
                {results.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse border-2 border-white"></span>
                )}
                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  AI Overview
                </span>
              </button>

              {/* Pemisah visual */}
              <div className={`w-px h-7 ${isMalam ? "bg-white/20" : "bg-black/10"}`}></div>

              {/* Voice Search */}
              <div className={`rounded-xl transition-all hover:shadow-md flex-shrink-0 ${isMalam ? "bg-white/10 border border-white/20" : "bg-black/[0.04] border border-black/5"
                }`}>
                <VoiceSearch
                  handleSearch={(transcript) => handleSearch(transcript)}
                  Error={(error) => console.error(error)}
                  placeholder="Bicara..."
                  width="34"
                  height="34"
                  language="id-ID"
                  customMicIcon={() => (
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-105 ${isMalam ? "bg-white hover:bg-gray-100" : "bg-[#E3655B] hover:bg-[#d55a50]"
                        }`}
                    >
                      <Mic size={16} className={isMalam ? "text-black" : "text-white"} />
                    </div>
                  )}
                />
              </div>
            </div>
          </div>

          {!exploreMode && !isTypingDeferred && (
            <div className="flex items-center justify-between py-3">
              <div className="flex gap-2 overflow-x-auto hide-scrollbar flex-1">
                {FILTER_TABS.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => {
                      setActiveFilter(tab);
                      setExploreMode(false);
                    }}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wide border whitespace-nowrap flex-shrink-0 ${activeFilter === tab
                      ? "bg-[#E3655B] border-[#E3655B] text-white"
                      : isMalam
                        ? "bg-white/5 border-white/10 text-white/50"
                        : "bg-black/5 border-black/5 text-slate-500"
                      }`}
                  >
                    {tab === "Sekitarmu" && "📍 "}
                    {tab}
                  </button>
                ))}
              </div>

              <button onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")} className={`p-1.5 rounded-lg ml-2 ${isMalam ? "bg-white/5" : "bg-black/5"}`}>
                {viewMode === "grid" ? <List size={16} /> : <Grid3x3 size={16} />}
              </button>
            </div>
          )}
        </div>

        {error && allTempat.length > 0 && (
          <div className="mx-4 mt-3 p-2 rounded-lg bg-yellow-500/20 border border-yellow-500/30">
            <p className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
              <span>⚠️</span>
              {error}
              <button onClick={handleRetry} className="underline text-[10px]">
                Refresh
              </button>
            </p>
          </div>
        )}

        {/* ========== AI SUMMARY RINGKAS (bisa diklik untuk buka modal) ========== */}
        {showAISummary && aiSummary && !isTyping && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-4 mt-3 p-3 rounded-xl bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800 cursor-pointer hover:shadow-lg transition-all"
            onClick={openAIOverview}
          >
            <div className="flex items-start gap-2">
              <Sparkles size={16} className="text-purple-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs whitespace-pre-line leading-relaxed">
                  {aiSummary.split('\n').map((line, idx) => {
                    if (line.startsWith('📍')) {
                      return <p key={idx} className="font-semibold text-purple-700 dark:text-purple-300">{line}</p>;
                    } else if (line.startsWith('🔍')) {
                      return <p key={idx} className="font-medium">{line}</p>;
                    } else {
                      return <p key={idx} className="opacity-80">{line}</p>;
                    }
                  })}
                </div>
                <p className="text-[10px] text-purple-500 mt-1">Klik untuk detail lengkap →</p>
              </div>
              <ChevronLeft size={14} className="text-purple-300 rotate-180 flex-shrink-0" />
            </div>
          </motion.div>
        )}

        {isTypingDeferred && query.length === 0 && (
          <div className="px-4 py-3">
            {recentSearches.length > 0 && (
              <div className="mb-5">
                <div className="flex justify-between items-center mb-2">
                  <h3 className={`text-[11px] font-bold uppercase ${isMalam ? "text-white/40" : "text-slate-400"}`}>
                    <Clock size={12} className="inline mr-1" /> Terakhir
                  </h3>
                  <button
                    onClick={() => {
                      setRecentSearches([]);
                      localStorage.removeItem("recent_searches");
                    }}
                    className="text-[10px] text-slate-400"
                  >
                    Hapus
                  </button>
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
            <div>
              <h3 className={`text-[11px] font-bold uppercase mb-2 ${isMalam ? "text-white/40" : "text-slate-400"}`}>
                <TrendingUp size={12} className="inline mr-1" /> Rekomendasi
              </h3>
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

        {isTypingDeferred && query.length > 0 && (
          <div className="mt-1 divide-y px-4 max-h-[60vh] overflow-y-auto">
            {results.slice(0, 8).map((item) => (
              <button
                key={item?.id || Math.random()}
                onClick={() => handleSelectSuggestion(item?.name || item?.content?.substring(0, 30) || "")}
                className="flex items-center gap-3 py-3 w-full hover:bg-white/5 rounded-lg px-3"
              >
                <div className="w-10 h-10 rounded-lg bg-black/5 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {item?._type === "laporan" ? <FileText size={18} className="text-purple-500" /> : <img src={getThumbnail(item)} className="w-full h-full object-cover" alt="" />}
                </div>
                <div className="flex flex-col text-left flex-1 min-w-0">
                  <span className="text-sm font-medium truncate">{item?.name || item?.content?.substring(0, 40) || "Item"}</span>
                  <span className="text-[10px] opacity-40 flex items-center gap-1">
                    {item?._type === "laporan" ? (
                      <>
                        <FileText size={10} /> Laporan {item?.tipe && `• ${item.tipe}`}
                      </>
                    ) : (
                      <>
                        <MapPin size={10} /> {item?.category || "Umum"}
                      </>
                    )}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {!isTypingDeferred && !exploreMode && (
          <>
            {activeFilter === "Sekitarmu" && !location?.latitude && (
              <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                <div className="text-4xl mb-3">📍</div>
                <h3 className="text-sm font-bold mb-1">Aktifkan Lokasi</h3>
                <p className="text-xs opacity-50 mb-4">Lihat tempat di sekitar Anda</p>
                <button onClick={requestLocation} className="px-4 py-2 bg-[#E3655B] text-white rounded-full text-xs font-bold">
                  Aktifkan Lokasi
                </button>
              </div>
            )}

            {(activeFilter !== "Sekitarmu" || location?.latitude) && results.length === 0 && query.length > 0 && (
              <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                <div className="text-4xl mb-3">🔍</div>
                <h3 className="text-sm font-bold mb-1">Tidak ada hasil</h3>
                <p className="text-xs opacity-50">Coba kata kunci lain atau cari laporan warga</p>
              </div>
            )}

            {(activeFilter !== "Sekitarmu" || location?.latitude) && results.length === 0 && query.length === 0 && activeFilter === "Semua" && (
              <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                <div className="text-4xl mb-3">🏠</div>
                <h3 className="text-sm font-bold mb-1">Mulai mencari</h3>
                <p className="text-xs opacity-50">Cari tempat favorit atau lihat laporan terbaru</p>
              </div>
            )}

            <div className={`${viewMode === "grid" ? "grid grid-cols-2" : "flex flex-col"} gap-3 py-4 pb-20 px-4`}>
              {results.map((item) =>
                item?._type === "laporan" ? (
                  <LaporanCard key={item?.id || Math.random()} item={item} onCardClick={handleOpenExplore} />
                ) : (
                  <TempatCard key={item?.id || Math.random()} item={item} onCardClick={handleOpenExplore} showDistance={activeFilter === "Sekitarmu"} />
                )
              )}
            </div>
          </>
        )}

        {exploreMode && exploreItems.length > 0 && (
          <div className="flex flex-col gap-5 py-4 pb-20 px-0">
            {exploreItems.map((item) => (
              <FeedCard
                key={item?.id || Math.random()}
                item={item}
                location={location}
                locationReady={locationStatus === "granted"}
                theme={{ isMalam, isSore }}
                openAIModal={() => {
                  setSelectedForAI(item);
                  setIsAIModalOpen(true);
                }}
                openKomentarModal={() => {
                  setSelectedForKomentar(item);
                  setIsKomentarModalOpen(true);
                }}
                onShare={() => handleShare(item)}
              />
            ))}
          </div>
        )}
      </div>

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
        .line-clamp-1 {
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
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