// components/feed/FeedStatusComponents.js

import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ==================== SKELETON LOADER ====================
export const SkeletonLoader = memo(({ theme }) => {
  const bgCard = theme?.bgCard || 'bg-white/5';
  const border = theme?.border || 'border-white/5';
  const bgPulse = theme?.isMalam ? 'bg-white/10' : 'bg-gray-200';

  return (
    <div className="space-y-6 px-4">
      {[1, 2, 3].map(i => (
        <div key={i} className={`${bgCard} rounded-[40px] ${border} overflow-hidden`}>
          <div className="p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full ${bgPulse} animate-pulse`} />
            <div className="flex-1">
              <div className={`h-4 w-32 ${bgPulse} rounded animate-pulse mb-2`} />
              <div className={`h-3 w-24 ${bgPulse} rounded animate-pulse`} />
            </div>
          </div>
          <div className={`aspect-video ${bgPulse} animate-pulse`} />
          <div className="p-4 space-y-3">
            <div className={`h-4 w-full ${bgPulse} rounded animate-pulse`} />
            <div className={`h-4 w-3/4 ${bgPulse} rounded animate-pulse`} />
            <div className="flex gap-2 mt-2">
              <div className={`h-8 w-16 ${bgPulse} rounded-full animate-pulse`} />
              <div className={`h-8 w-16 ${bgPulse} rounded-full animate-pulse`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});

SkeletonLoader.displayName = 'SkeletonLoader';

// ==================== ERROR STATE ====================
export const ErrorState = memo(({
  error,
  onRetry,
  onExpandRadius,
  isOnline,
  theme
}) => {
  const text = theme?.text || 'text-white';
  const textMuted = theme?.textMuted || 'text-white/40';
  const accentBg = theme?.accentBg || 'bg-[#E3655B]';
  const cardBg = theme?.card || 'bg-white/5';
  const border = theme?.border || 'border-white/10';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${cardBg} ${border} rounded-2xl p-8 mx-4 text-center`}
    >
      <div className="text-6xl mb-4">⚠️</div>
      <h3 className={`${text} text-lg font-semibold mb-2`}>
        {isOnline ? 'Gagal memuat data' : 'Koneksi terputus'}
      </h3>
      <p className={`${textMuted} text-sm mb-4`}>
        {error || (isOnline ? 'Terjadi kesalahan, coba lagi' : 'Periksa koneksi internet Anda')}
      </p>
      <div className="flex flex-wrap gap-3 justify-center">
        <button
          onClick={onRetry}
          className={`px-6 py-2 ${accentBg} text-white rounded-xl hover:opacity-80 transition-opacity text-sm font-medium`}
        >
          Coba Lagi
        </button>
        {onExpandRadius && (
          <button
            onClick={onExpandRadius}
            className={`px-6 py-2 ${cardBg} ${border} ${text} rounded-xl hover:bg-white/10 transition-colors text-sm`}
          >
            Perluas Radius
          </button>
        )}
      </div>
    </motion.div>
  );
});

ErrorState.displayName = 'ErrorState';

// ==================== EMPTY STATE ====================
export const EmptyState = memo(({
  onRefresh,
  onExpandRadius,
  isOnline,
  radius = 20,
  locationName = 'lokasi Anda',
  theme
}) => {
  const text = theme?.text || 'text-white';
  const textMuted = theme?.textMuted || 'text-white/40';
  const accentBg = theme?.accentBg || 'bg-[#E3655B]';
  const cardBg = theme?.card || 'bg-white/5';
  const border = theme?.border || 'border-white/10';
  const accentSoft = theme?.accentSoft || 'bg-white/5';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${cardBg} ${border} rounded-2xl p-8 mx-4 text-center`}
    >
      <div className="text-6xl mb-4">📍</div>
      <h3 className={`${text} text-lg font-semibold mb-2`}>
        {isOnline ? 'Belum ada tempat di sekitar' : 'Tidak dapat menemukan lokasi'}
      </h3>
      <p className={`${textMuted} text-sm mb-4`}>
        {isOnline
          ? `Tidak ditemukan tempat dalam radius ${radius}km dari ${locationName}`
          : 'Anda sedang offline, periksa koneksi internet'
        }
      </p>
      <div className="flex flex-wrap gap-3 justify-center">
        <button
          onClick={onRefresh}
          className={`px-6 py-2 ${accentBg} text-white rounded-xl hover:opacity-80 transition-opacity text-sm font-medium`}
        >
          Refresh
        </button>
        {onExpandRadius && isOnline && (
          <button
            onClick={onExpandRadius}
            className={`px-6 py-2 ${accentSoft} ${border} ${text} rounded-xl hover:bg-white/10 transition-colors text-sm`}
          >
            Perluas ke {radius + 5}km
          </button>
        )}
      </div>
    </motion.div>
  );
});

EmptyState.displayName = 'EmptyState';

// ==================== INVISIBLE LOADING ====================
export const InvisibleLoading = memo(() => (
  <div className="h-20 w-full opacity-0 pointer-events-none" />
));

InvisibleLoading.displayName = 'InvisibleLoading';

// ==================== END OF FEED ====================
export const EndOfFeed = memo(({
  onScrollToTop,
  theme
}) => {
  const text = theme?.text || 'text-white/70';
  const border = theme?.border || 'border-white/30';
  const accent = theme?.accent || 'text-[#E3655B]';
  const isMalam = theme?.isMalam || false;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="text-center py-10 flex flex-col items-center gap-3"
    >
      <div className="flex items-center gap-2">
        <span className={`${text} text-xs tracking-wider`}>
          {isMalam ? '🌙' : '☀️'} Kamu sudah melihat semua konten terdekat
        </span>
      </div>

      {onScrollToTop && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onScrollToTop}
          className={`px-4 py-1.5 ${border} rounded-full ${text} text-[11px] transition-colors flex items-center gap-1 hover:bg-white/5`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="m18 15-6-6-6 6" />
          </svg>
          Kembali ke atas
        </motion.button>
      )}
    </motion.div>
  );
});

EndOfFeed.displayName = 'EndOfFeed';

// ==================== PULL TO REFRESH INDICATOR ====================
export const PullToRefreshIndicator = memo(({
  refreshing,
  theme
}) => {
  const accentBg = theme?.accentBg || 'bg-[#E3655B]';
  const accent = theme?.accent || 'text-[#E3655B]';
  const text = theme?.text || 'text-white';
  const bgGlass = theme?.bgGlass || 'bg-black/80';

  return (
    <AnimatePresence>
      {refreshing && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          className={`fixed top-0 left-0 right-0 ${bgGlass} backdrop-blur-md py-3 text-center ${text} text-sm z-50 shadow-lg`}
        >
          <div className="flex items-center justify-center gap-3">
            <div className="relative flex items-center justify-center">
              <div className={`absolute animate-ping h-8 w-8 rounded-full ${accentBg} opacity-20`}></div>
              <div className="absolute animate-ping h-8 w-8 rounded-full bg-[#25F4EE] opacity-20 [animation-delay:0.5s]"></div>
              <div className={`relative h-6 w-6 border-[3px] border-t-[#E3655B] border-r-transparent border-b-[#25F4EE] border-l-transparent rounded-full animate-spin`}></div>
            </div>
            <span>Perbarui Setempat ...</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

PullToRefreshIndicator.displayName = 'PullToRefreshIndicator';

// ==================== TOAST MESSAGE ====================
export const ToastMessage = memo(({
  show,
  message,
  theme
}) => {
  const bgGlass = theme?.bgGlass || 'bg-black/80';
  const border = theme?.border || 'border-white/20';
  const text = theme?.text || 'text-white';

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 50, x: "-50%", opacity: 0 }}
          animate={{ y: 0, x: "-50%", opacity: 1 }}
          exit={{ y: 50, x: "-50%", opacity: 0 }}
          className="fixed bottom-10 left-1/2 z-[100]"
        >
          <div className={`${bgGlass} backdrop-blur-lg ${text} px-5 py-2.5 rounded-full shadow-2xl text-sm font-medium ${border}`}>
            {message}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

ToastMessage.displayName = 'ToastMessage';

// ==================== FEED CARD ERROR ====================
export const FeedCardError = memo(({
  message = "Gagal memuat data",
  onRetry,
  error,
  theme
}) => {
  const cardBg = theme?.card || 'bg-white/5';
  const border = theme?.border || 'border-red-500/20';
  const text = theme?.text || 'text-white';
  const textMuted = theme?.textMuted || 'text-white/40';
  const accentBg = theme?.accentBg || 'bg-red-500/20';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${cardBg} rounded-xl ${border} text-center my-4 mx-4 p-6`}
    >
      <div className="text-4xl mb-3">⚠️</div>
      <h3 className={`${text} text-base font-semibold mb-1`}>
        {message}
      </h3>
      {error && (
        <p className={`${textMuted} text-sm mb-4`}>{error}</p>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className={`px-6 py-2 ${accentBg} hover:bg-red-500/30 rounded-xl ${text} transition-colors text-sm`}
        >
          Coba Lagi
        </button>
      )}
    </motion.div>
  );
});

FeedCardError.displayName = 'FeedCardError';

// ==================== HELPER: DEFAULT THEME ====================
export const getDefaultStatusTheme = (isMalam = false) => ({
  isMalam,
  text: isMalam ? 'text-white' : 'text-slate-900',
  textMuted: isMalam ? 'text-white/40' : 'text-slate-500',
  card: isMalam ? 'bg-white/5' : 'bg-white',
  border: isMalam ? 'border-white/10' : 'border-slate-200',
  bgGlass: isMalam ? 'bg-black/80' : 'bg-white/80',
  accentBg: isMalam ? 'bg-cyan-400' : 'bg-[#E3655B]',
  accent: isMalam ? 'text-cyan-400' : 'text-[#E3655B]',
  bgCard: isMalam ? 'bg-white/5' : 'bg-gray-100',
});