// components/feed/FeedStatusComponents.js

import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ==================== SKELETON LOADER ====================
export const SkeletonLoader = memo(() => (
  <div className="space-y-6 px-4">
    {[1, 2, 3].map(i => (
      <div key={i} className="bg-white/5 rounded-[40px] border border-white/5 overflow-hidden">
        <div className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse" />
          <div className="flex-1">
            <div className="h-4 w-32 bg-white/10 rounded animate-pulse mb-2" />
            <div className="h-3 w-24 bg-white/10 rounded animate-pulse" />
          </div>
        </div>
        <div className="aspect-video bg-white/10 animate-pulse" />
        <div className="p-4 space-y-3">
          <div className="h-4 w-full bg-white/10 rounded animate-pulse" />
          <div className="h-4 w-3/4 bg-white/10 rounded animate-pulse" />
          <div className="flex gap-2 mt-2">
            <div className="h-8 w-16 bg-white/10 rounded-full animate-pulse" />
            <div className="h-8 w-16 bg-white/10 rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    ))}
  </div>
));

SkeletonLoader.displayName = 'SkeletonLoader';

// ==================== ERROR STATE ====================
export const ErrorState = memo(({ error, onRetry }) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-12 px-4">
    <div className="text-6xl mb-4">⚠️</div>
    <h3 className="text-white/80 text-lg font-semibold mb-2">Gagal memuat data</h3>
    <p className="text-white/40 text-sm mb-4">{error}</p>
    <button onClick={onRetry} className="px-6 py-2 bg-white/10 rounded-xl text-white/80 hover:bg-white/20 transition-colors">
      Coba Lagi
    </button>
  </motion.div>
));

ErrorState.displayName = 'ErrorState';

// ==================== EMPTY STATE ====================
export const EmptyState = memo(({ radius, locationName, onExpandRadius }) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-12 px-4">
    <div className="text-6xl mb-4">📍</div>
    <h3 className="text-white/80 text-lg font-semibold mb-2">Tidak ada tempat di sekitar</h3>
    <p className="text-white/40 text-sm">Tidak ditemukan tempat dalam radius {radius}km dari {locationName}</p>
    <button onClick={onExpandRadius} className="mt-4 px-6 py-2 bg-white/10 rounded-xl text-white/80 hover:bg-white/20 transition-colors text-sm">
      Perluas radius ke {radius + 5}km
    </button>
  </motion.div>
));

EmptyState.displayName = 'EmptyState';

// ==================== INVISIBLE LOADING ====================
export const InvisibleLoading = memo(() => (
  <div className="h-20 w-full opacity-0 pointer-events-none" />
));

InvisibleLoading.displayName = 'InvisibleLoading';

// ==================== END OF FEED ====================
export const EndOfFeed = memo(() => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8">
    <p className="text-white/40 text-xs">✨ Semua konten di sekitar telah dimuat ✨</p>
  </motion.div>
));

EndOfFeed.displayName = 'EndOfFeed';

// ==================== PULL TO REFRESH INDICATOR ====================
export const PullToRefreshIndicator = memo(({ refreshing }) => (
  <AnimatePresence>
    {refreshing && (
      <motion.div
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -60, opacity: 0 }}
        className="fixed top-0 left-0 right-0 bg-black/80 backdrop-blur-md py-3 text-center text-white/70 text-sm z-50 shadow-lg"
      >
        <div className="flex items-center justify-center gap-3">
          <div className="relative flex items-center justify-center">
            <div className="absolute animate-ping h-8 w-8 rounded-full bg-[#E3655B] opacity-20"></div>
            <div className="absolute animate-ping h-8 w-8 rounded-full bg-[#25F4EE] opacity-20 [animation-delay:0.5s]"></div>
            <div className="relative h-6 w-6 border-[3px] border-t-[#E3655B] border-r-transparent border-b-[#25F4EE] border-l-transparent rounded-full animate-spin"></div>
          </div>
          <span>Perbarui Setempat ...</span>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
));

PullToRefreshIndicator.displayName = 'PullToRefreshIndicator';

// ==================== TOAST MESSAGE ====================
export const ToastMessage = memo(({ show, message }) => (
  <AnimatePresence>
    {show && (
      <motion.div
        initial={{ y: 50, x: "-50%", opacity: 0 }}
        animate={{ y: 0, x: "-50%", opacity: 1 }}
        exit={{ y: 50, x: "-50%", opacity: 0 }}
        className="fixed bottom-10 left-1/2 z-[100]"
      >
        <div className="bg-black/80 backdrop-blur-lg text-white px-5 py-2.5 rounded-full shadow-2xl text-sm font-medium border border-white/20">
          {message}
        </div>
      </motion.div>
    )}
  </AnimatePresence>
));

ToastMessage.displayName = 'ToastMessage';