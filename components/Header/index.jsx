"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import UserMenu from "@/app/components/layout/UserMenu";
import { useTheme } from "@/app/hooks/useTheme";
import { useWeather } from "@/hooks/useWeather";
import { useRouter } from "next/navigation";

// ── 1. LUXURY LIVE CAPSULE ──────────────────────────────────
function LiveStatus({ weather, theme, onShowStatistik, isScrolled }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 4000);
    return () => clearInterval(t);
  }, []);

  const statuses = [
    { label: "LIVE NOW", color: "bg-emerald-400" },
    weather?.short ? { label: weather.short.toUpperCase(), color: "bg-amber-400" } : null,
    weather?.temp ? { label: `${weather.temp}°C`, color: "bg-sky-400" } : null,
    { label: "AI ACTIVE", color: "bg-indigo-500" },
  ].filter(Boolean);

  const current = statuses[tick % statuses.length];

  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.98 }}
      onClick={onShowStatistik}
      animate={{ 
        scale: isScrolled ? 0.95 : 1,
      }}
      // min-w-[120px] menjaga agar tombol tidak goyang saat teks berubah
      className={`group flex items-center justify-center gap-2.5 px-4 py-2 rounded-full backdrop-blur-2xl border transition-all duration-700 min-w-[120px] ${
        theme.isMalam
          ? "bg-white/[0.04] border-white/10 text-white/90 hover:bg-white/[0.08]"
          : "bg-black/[0.03] border-black/5 text-slate-700 hover:bg-black/[0.06]"
      }`}
    >
      <div className="relative flex h-1.5 w-1.5 flex-shrink-0">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-40 ${current.color}`} />
        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${current.color}`} />
      </div>
      
      <div className="overflow-hidden relative h-3 flex items-center">
        <AnimatePresence mode="wait">
          <motion.span
            key={current.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="text-[9px] font-black uppercase tracking-[0.15em] whitespace-nowrap"
          >
            {current.label}
          </motion.span>
        </AnimatePresence>
      </div>
    </motion.button>
  );
}

// ── MAIN LUXURY HEADER ─────────────────────────────────────────────────────
export default function Header({
  user,
  isAdmin,
  locationReady,
  villageLocation,
  isScrolled,
  onOpenLocationModal,
  onShowStatistik,
  onOpenAuthModal,
}) {
  const theme = useTheme();
  const router = useRouter();
  const { weather } = useWeather(villageLocation);

  return (
    <header className={`sticky top-0 z-[1000] w-full transition-all duration-700 ${isScrolled ? "py-2" : "py-5"}`}>
      {/* Background Glass */}
      <div 
        className={`absolute inset-0 transition-all duration-1000 -z-10 ${
          isScrolled
            ? theme.isMalam
              ? "bg-[#0a0a0a]/80 backdrop-blur-2xl border-b border-white/[0.05] shadow-2xl"
              : "bg-white/80 backdrop-blur-2xl border-b border-black/[0.02] shadow-sm"
            : "bg-transparent"
        }`} 
      />

      <div className="max-w-7xl mx-auto px-4 flex items-center relative">
  
  {/* LEFT: LOGO & LOCATION - Diberi basis agar punya ruang tetap */}
  <div className="flex-[1.5] flex items-center min-w-0"> 
    <motion.div
      layout
      onClick={onOpenLocationModal}
      className="flex items-center gap-2.5 cursor-pointer group min-w-0"
    >
      <motion.div 
        animate={{ scale: isScrolled ? 0.8 : 1 }}
        className="relative flex-shrink-0"
      >
        <AnimatePresence>
          {locationReady && (
            <motion.div 
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 z-10 w-3 h-3 bg-emerald-500 border-2 rounded-full"
              style={{ borderColor: theme.isMalam ? '#111' : '#fff' }}
            />
          )}
        </AnimatePresence>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#E3655B] to-[#ff7d72]">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          </svg>
        </div>
      </motion.div>

      <div className="flex flex-col min-w-0">
        <h1 className={`text-[9px] font-black tracking-widest ${theme.text} opacity-40 uppercase truncate`}>
          Setempat<span className="text-[#E3655B]">.id</span>
        </h1>
        <p className={`text-[13px] font-bold ${theme.text} leading-none truncate`}>
          {villageLocation || "Pasuruan"}
        </p>
      </div>
    </motion.div>
  </div>

  {/* CENTER: LIVE STATUS - Pakai absolute center agar tidak memakan space flex kiri-kanan */}
  <div className="absolute left-1/2 -translate-x-1/2 flex-none z-10">
    <LiveStatus
      weather={weather}
      theme={theme}
      onShowStatistik={onShowStatistik}
      isScrolled={isScrolled}
    />
  </div>

  {/* RIGHT: ACTIONS - Basis lebih kecil dari kiri agar adil */}
  <div className="flex-1 flex items-center justify-end gap-3">
    <motion.button
      onClick={() => router.push('/search')}
      className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl border ${
        theme.isMalam ? "bg-white/5 border-white/5" : "bg-black/5 border-black/5"
      }`}
    >
      <svg className="w-5 h-5 text-[#E3655B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </motion.button>

    <div className={`pl-2 border-l flex-shrink-0 ${theme.isMalam ? "border-white/10" : "border-black/5"}`}>
      <UserMenu user={user} isAdmin={isAdmin} isScrolled={isScrolled} onOpenAuthModal={onOpenAuthModal} theme={theme} />
    </div>
  </div>

</div>
    </header>
  );
}