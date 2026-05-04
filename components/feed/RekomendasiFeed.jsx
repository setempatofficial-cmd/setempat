'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import FeedCard from "@/app/components/feed/FeedCard";
import BreakCard from "@/components/BreakCard";
import { useTheme } from "@/app/hooks/useTheme";

export default function RekomendasiFeed({
  currentItemId,
  userLocation,
  locationReady,
  theme,
  onOpenAIModal,
  onOpenKomentarModal,
  onShare,
}) {
  const { isMalam } = useTheme();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [comments, setComments] = useState({});
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState({});
  const loaderRef = useRef(null);
  const abortControllerRef = useRef(null);

  const MAX_ITEMS = 15;

  // State untuk BreakCard
  const previousConditionsRef = useRef({});
  const lastBreakTimeRef = useRef(Date.now());

  // ========== GENERATE BREAK CARD ==========
  const generateBreakCard = useCallback((scrollIndex, displayedPlaces) => {
    // Cek perubahan kondisi tempat
    let hasSignificantChange = false;
    let changeText = "";
    
    for (const place of displayedPlaces.slice(-3)) {
      const prev = previousConditionsRef.current[place.id];
      const curr = place.isRamai ? "ramai" : (place.isViral ? "viral" : "normal");
      if (prev === "sepi" && curr === "ramai") {
        hasSignificantChange = true;
        changeText = `🔥 Aktivitas mulai meningkat di ${place.name}`;
        break;
      }
      previousConditionsRef.current[place.id] = curr;
    }
    
    if (hasSignificantChange) {
      return {
        type: "area-summary",
        level: "B",
        data: { text: changeText },
      };
    }

    // Time divider (setiap 15 menit)
    const now = Date.now();
    if (now - lastBreakTimeRef.current > 15 * 60 * 1000) {
      lastBreakTimeRef.current = now;
      const hours = new Date().getHours();
      const minutes = new Date().getMinutes();
      return {
        type: "time-divider",
        level: "C",
        data: { label: `Update ${hours}:${minutes.toString().padStart(2, '0')}` },
      };
    }

    // Statistik setelah beberapa card
    if (scrollIndex >= 5 && scrollIndex % 5 === 0) {
      const totalLaporanHariIni = displayedPlaces.reduce((acc, p) => {
        const todayReports = (p.laporan_terbaru || []).filter(l => {
          const lDate = new Date(l.created_at);
          return lDate.toDateString() === new Date().toDateString();
        }).length;
        return acc + todayReports;
      }, 0);
      
      return {
        type: "statistic",
        level: "B",
        data: { text: `📊 ${displayedPlaces.length} lokasi aktif · ${totalLaporanHariIni} laporan hari ini` },
      };
    }

    return null;
  }, []);

  // Load komentar untuk items
  useEffect(() => {
    const loadCommentsForItems = async () => {
      if (items.length === 0) return;
      
      const commentsMap = {};
      const promises = items.map(async (item) => {
        const { data, error } = await supabase
          .from("komentar")
          .select("*")
          .eq("tempat_id", item.id)
          .order("created_at", { ascending: false })
          .limit(10); // Limit untuk performa
        
        if (!error && data) {
          commentsMap[item.id] = data;
        } else {
          commentsMap[item.id] = [];
        }
      });
      
      await Promise.all(promises);
      setComments(commentsMap);
    };
    
    loadCommentsForItems();
  }, [items]);

  const fetchRekomendasi = useCallback(
    async (reset = false) => {
      // Cancel previous request if exists
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      if (!hasMore && !reset) return;
      if (items.length >= MAX_ITEMS && !reset) return;

      const currentPage = reset ? 0 : page;
      const limit = 5;
      const offset = currentPage * limit;

      setLoading(true);
      
      // Create new abort controller
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        let query = supabase
          .from("feed_view")
          .select("*")
          .neq("id", currentItemId)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);

        if (locationReady && userLocation?.latitude && userLocation?.longitude) {
          const radius = 10;
          const lat = userLocation.latitude;
          const lng = userLocation.longitude;
          const latDelta = radius / 111;
          const lngDelta = radius / (111 * Math.cos((lat * Math.PI) / 180));

          query = query
            .gte("latitude", lat - latDelta)
            .lte("latitude", lat + latDelta)
            .gte("longitude", lng - lngDelta);
        }

        const { data, error } = await query;
        
        if (abortController.signal.aborted) return;
        
        if (error) throw error;

        const uniqueData = data
          ? Array.from(new Map(data.map((item) => [item.id, item])).values())
          : [];

        let newItems;
        if (reset) {
          newItems = uniqueData || [];
        } else {
          const combined = [...items, ...(uniqueData || [])];
          newItems = Array.from(
            new Map(combined.map((item) => [item.id, item])).values()
          );
        }

        if (newItems.length > MAX_ITEMS) {
          newItems = newItems.slice(0, MAX_ITEMS);
          setHasMore(false);
        } else {
          setHasMore(
            (data || []).length === limit && newItems.length < MAX_ITEMS
          );
        }

        setItems(newItems);
        setPage(currentPage + 1);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error("Error fetching rekomendasi:", err);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    },
    [currentItemId, page, hasMore, locationReady, userLocation, items.length]
  );

  // Infinite scroll observer
  useEffect(() => {
    if (!loaderRef.current || !hasMore || items.length >= MAX_ITEMS) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          !loading &&
          hasMore &&
          items.length < MAX_ITEMS
        ) {
          fetchRekomendasi(false);
        }
      },
      { threshold: 0.1, rootMargin: "200px" }
    );

    observer.observe(loaderRef.current);
    return () => {
      observer.disconnect();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loading, hasMore, fetchRekomendasi, items.length]);

  // Initial fetch
  useEffect(() => {
    fetchRekomendasi(true);
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Reset ketika currentItemId berubah
  useEffect(() => {
    setItems([]);
    setPage(0);
    setHasMore(true);
    setSelectedPhotoIndex({});
    fetchRekomendasi(true);
  }, [currentItemId]);

  // ========== GABUNGKAN FEED CARD DENGAN BREAK CARD ==========
  const feedItemsWithBreaks = useMemo(() => {
    if (!items.length) return [];
    
    const result = [];
    let cardsSinceLastBreak = 0;
    
    for (let i = 0; i < items.length; i++) {
      result.push(items[i]);
      cardsSinceLastBreak++;
      
      // Tambah BreakCard setiap 3-4 card
      const shouldAddBreak = cardsSinceLastBreak >= 3 && cardsSinceLastBreak % 3 === 0;
      
      if (shouldAddBreak && i !== items.length - 1) {
        const breakCard = generateBreakCard(i + 1, items.slice(0, i + 1));
        if (breakCard) {
          result.push({
            _isBreak: true,
            id: `break-${i}-${Date.now()}-${Math.random()}`,
            type: breakCard.type,
            level: breakCard.level,
            data: breakCard.data,
          });
        }
        cardsSinceLastBreak = 0;
      }
    }
    
    return result;
  }, [items, generateBreakCard]);

  // Handler untuk photo click di FeedCard
  const handlePhotoClick = useCallback((photos, index) => {
    // Bisa diimplementasikan untuk modal galeri
    console.log('Photo clicked:', photos, index);
  }, []);

  if (loading && items.length === 0) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-5 h-5 border-2 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (items.length === 0 && !loading) {
    return (
      <div className="text-center py-8">
        <p className={`text-xs ${isMalam ? "text-white/40" : "text-slate-400"}`}>
          Belum ada konten lain di sekitar
        </p>
      </div>
    );
  }

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {feedItemsWithBreaks.map((item, index) => {
        // Jika BreakCard
        if (item._isBreak) {
          return (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="mb-6"
            >
              <BreakCard
                type={item.type}
                data={item.data}
                theme={theme}
                level={item.level}
              />
            </motion.div>
          );
        }
        
        // FeedCard - pastikan semua props terdefinisi
        const isPriority = index < 2;
        const itemComments = comments[item.id] || [];
        
        return (
          <motion.div
            key={`rekomendasi-${item.id}`}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.5) }}
            className="mb-6"
          >
            <FeedCard
              item={item}
              location={userLocation}
              locationReady={locationReady}
              comments={itemComments}
              selectedPhotoIndex={selectedPhotoIndex[item.id] || 0}
              setSelectedPhotoIndex={(index) => {
                setSelectedPhotoIndex(prev => ({
                  ...prev,
                  [item.id]: index
                }));
              }}
              openAIModal={onOpenAIModal}
              openKomentarModal={onOpenKomentarModal}
              onShare={onShare}
              priority={isPriority}
              onPhotoClick={handlePhotoClick}
            />
          </motion.div>
        );
      })}
      
      {/* Loading indicator untuk infinite scroll */}
      {hasMore && items.length < MAX_ITEMS && items.length > 0 && (
        <div key="loader" ref={loaderRef} className="h-10" />
      )}

      {loading && items.length > 0 && (
        <div key="loading-indicator" className="flex justify-center py-4">
          <div className="w-4 h-4 border-2 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
        </div>
      )}

      {!hasMore && items.length >= MAX_ITEMS && items.length > 0 && (
        <div key="end-message" className="text-center py-4">
          <p className={`text-xs ${isMalam ? "text-white/40" : "text-slate-400"}`}>
            ✨ Semua rekomendasi telah ditampilkan ✨
          </p>
        </div>
      )}
    </AnimatePresence>
  );
}