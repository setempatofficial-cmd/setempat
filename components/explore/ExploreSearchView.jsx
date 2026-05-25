'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, MapPin, ArrowLeft } from "lucide-react";
import MediaRenderer from "@/components/media/MediaRenderer";
import DOMPurify from 'dompurify';

// Helper untuk membersihkan teks (dengan cache)
const sanitizeText = (text) => {
  if (!text) return '';
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
};

// Helper untuk warna badge tipe (dioptimasi)
const getBadgeStyles = (tipe) => {
  switch (tipe) {
    case "Ramai": return "bg-yellow-500/80 text-black";
    case "Antri": return "bg-rose-500/80 text-white";
    default: return "bg-emerald-500/80 text-white";
  }
};

// Komponen Card terpisah untuk performa
const SearchResultCard = ({ report, index, onClick, theme }) => {
  const mediaUrl = report.video_url || report.photo_url;
  const tipe = report.tipe || "Sepi";
  const [imageError, setImageError] = useState(false);

  const handleClick = useCallback(() => {
    onClick(index);
  }, [onClick, index]);

  return (
    <motion.div
      onClick={handleClick}
      whileTap={{ scale: 0.97 }}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.02 }}
      className="relative aspect-[3/4] rounded-xl overflow-hidden bg-zinc-900 cursor-pointer border border-white/10 active:opacity-80 transition-opacity"
    >
      {mediaUrl && !imageError ? (
        <>
          <MediaRenderer
            url={mediaUrl}
            className="w-full h-full object-cover"
            thumbnail={true}
            onError={() => setImageError(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
        </>
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center p-3">
          <p className="text-white text-xs text-center line-clamp-4 leading-relaxed">
            {sanitizeText(report.deskripsi || "Tidak ada deskripsi")}
          </p>
        </div>
      )}

      {/* Status Badge */}
      <div className="absolute top-2 right-2 z-10">
        <span className={`text-[10px] font-bold px-2 py-1 rounded-full backdrop-blur-md shadow-lg ${getBadgeStyles(tipe)}`}>
          {tipe === "Ramai" ? "🔥" : tipe === "Antri" ? "⏳" : "✨"} {tipe}
        </span>
      </div>

      {/* Location Info */}
      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none">
        <div className="flex items-center gap-1">
          <MapPin size={10} className="text-rose-500 shrink-0" />
          <p className="text-white text-[11px] font-bold truncate">
            {sanitizeText(report.display_location_name || report.tempat?.name || "Lokasi")}
          </p>
        </div>

        {/* Tambahan info waktu (opsional) */}
        {report.created_at && (
          <p className="text-white/40 text-[9px] mt-0.5 truncate">
            {new Date(report.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
          </p>
        )}
      </div>
    </motion.div>
  );
};

// Loading Skeleton
const SearchSkeleton = () => (
  <div className="grid grid-cols-2 gap-2 p-3">
    {[...Array(6)].map((_, i) => (
      <div key={i} className="aspect-[3/4] rounded-xl bg-white/5 animate-pulse" />
    ))}
  </div>
);

export default function ExploreSearchView({
  reports = [],
  onSelectReport,
  onBack,
  theme,
  isLoading = false
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isClosing, setIsClosing] = useState(false);
  const inputRef = useRef(null);

  // Auto focus input saat mount
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Memoized filter data dengan performa lebih baik
  const filteredReports = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return reports;

    // Gunakan array untuk menampung hasil filter
    const results = [];
    const queryLower = query;

    for (let i = 0; i < reports.length; i++) {
      const r = reports[i];
      if (
        r.display_location_name?.toLowerCase().includes(queryLower) ||
        r.tempat?.name?.toLowerCase().includes(queryLower) ||
        r.deskripsi?.toLowerCase().includes(queryLower)
      ) {
        results.push(r);
      }

      // Limit hasil untuk performa (max 50)
      if (results.length >= 50) break;
    }

    return results;
  }, [reports, searchQuery]);

  // Handler select dengan error handling
  const handleSelect = useCallback((filteredIndex) => {
    if (isClosing) return;

    const selectedReport = filteredReports[filteredIndex];
    if (!selectedReport) return;

    // Cari index asli di reports
    const originalIndex = reports.findIndex(r => r.id === selectedReport.id);

    if (originalIndex !== -1) {
      setIsClosing(true);
      // Kasih delay dikit biar animasi keliatan
      setTimeout(() => {
        onSelectReport(originalIndex);
      }, 50);
    }
  }, [filteredReports, reports, onSelectReport, isClosing]);

  // Handler clear search
  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    inputRef.current?.focus();
  }, []);

  // Handler back dengan animasi
  const handleBack = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      onBack();
    }, 150);
  }, [onBack, isClosing]);

  // Render empty state
  const renderEmptyState = () => (
    <div className="h-full flex flex-col items-center justify-center px-6">
      <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
        <Search size={32} className="text-white/20" />
      </div>
      <p className="text-white/40 text-sm text-center">
        {searchQuery ? "Tidak ditemukan" : "Cari lokasi berdasarkan nama tempat"}
      </p>
      {searchQuery && (
        <button
          onClick={handleClearSearch}
          className="mt-4 text-xs text-[#E3655B] hover:underline"
        >
          Hapus pencarian
        </button>
      )}
    </div>
  );

  return (
    <AnimatePresence mode="wait">
      {!isClosing && (
        <motion.div
          key="search-view"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="absolute inset-0 z-[200] bg-black flex flex-col overflow-hidden"
        >
          {/* Header & Search Bar */}
          <div className={`p-4 border-b ${theme?.isMalam ? 'border-white/10 bg-black/95' : 'border-gray-200 bg-white'}`}>
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={handleBack}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center active:scale-95 transition-transform"
                aria-label="Back"
              >
                <ArrowLeft size={18} className="text-white" />
              </button>
              <h2 className="text-white font-bold text-sm">🔍 Cari Lokasi</h2>
            </div>

            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ketik nama tempat..."
                className="w-full bg-white/10 border border-white/20 rounded-xl py-2.5 pl-10 pr-10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#E3655B] transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/10 flex items-center justify-center active:scale-90 transition-transform"
                  aria-label="Clear search"
                >
                  <X size={12} className="text-white/60" />
                </button>
              )}
            </div>

            {/* Hasil pencarian count */}
            {searchQuery && filteredReports.length > 0 && (
              <p className="text-white/40 text-[10px] mt-2 px-1">
                {filteredReports.length} lokasi ditemukan
              </p>
            )}
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-3 scrollbar-none">
            {isLoading ? (
              <SearchSkeleton />
            ) : filteredReports.length === 0 ? (
              renderEmptyState()
            ) : (
              <div className="grid grid-cols-2 gap-2 pb-4">
                {filteredReports.map((report, idx) => (
                  <SearchResultCard
                    key={report.id}
                    report={report}
                    index={idx}
                    onClick={handleSelect}
                    theme={theme}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Hint footer */}
          <div className="p-3 border-t border-white/5">
            <p className="text-white/20 text-[10px] text-center">
              Tap untuk langsung menuju story
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}