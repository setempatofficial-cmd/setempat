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
      {/* Background Glass - Lebih solid saat scroll */}
      <div 
        className={`absolute inset-0 transition-all duration-1000 -z-10 ${
          isScrolled
            ? theme.isMalam
              ? "bg-[#0a0a0a]/80 backdrop-blur-2xl border-b border-white/[0.05] shadow-2xl"
              : "bg-white/80 backdrop-blur-2xl border-b border-black/[0.02] shadow-sm"
            : "bg-transparent"
        }`} 
      />

      <div className="max-w-7xl mx-auto px-3 flex items-center justify-between relative">
        
        {/* LEFT: LOGO & LOCATION (SELALU ADA) */}
        <div className="flex-1 flex items-center">
          <motion.div
            layout
            onClick={onOpenLocationModal}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <motion.div 
              animate={{ scale: isScrolled ? 0.85 : 1 }}
              transition={{ duration: 0.5, ease: "circOut" }}
              className="relative flex-shrink-0"
            >
              <AnimatePresence>
                {locationReady && (
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute -top-1 -right-1 z-10 w-3.5 h-3.5 bg-emerald-500 border-[3px] rounded-full shadow-lg"
                    style={{ borderColor: theme.isMalam ? '#111' : '#fff' }}
                  >
                    <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-30" />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className={`w-11 h-11 rounded-[1.2rem] flex items-center justify-center transition-all duration-500 ${
                locationReady 
                  ? "bg-gradient-to-br from-[#E3655B] to-[#ff7d72] shadow-xl shadow-[#E3655B]/20" 
                  : "bg-slate-700/30 opacity-50 grayscale"
              }`}>
                <svg className="w-5.5 h-5.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
              </div>
            </motion.div>

            <motion.div 
              animate={{ 
                x: isScrolled ? -2 : 0,
                scale: isScrolled ? 0.95 : 1
              }}
              className="flex flex-col origin-left transition-all duration-500"
            >
              <h1 className={`text-[10px] font-black tracking-[0.25em] ${theme.text} opacity-40 uppercase mb-0.5 whitespace-nowrap`}>
                Setempat<span className="text-[#E3655B]">.id</span>
              </h1>
              <p className={`text-sm font-bold ${theme.text} leading-none tracking-tight whitespace-nowrap transition-all duration-500 ${isScrolled ? 'opacity-90' : 'opacity-100'}`}>
                {villageLocation || "Pasuruan"}
              </p>
            </motion.div>
          </motion.div>
        </div>

        {/* CENTER: FLOATING STATUS */}
        <div className="flex-none z-10 flex justify-center">
          <LiveStatus
            weather={weather}
            theme={theme}
            onShowStatistik={onShowStatistik}
            isScrolled={isScrolled}
          />
        </div>

        {/* RIGHT: ACTIONS */}
        <div className="flex-1 flex items-center justify-end gap-3 sm:gap-4">
          <motion.button
            animate={{ scale: isScrolled ? 0.9 : 1 }}
            whileHover={{ y: -2, backgroundColor: theme.isMalam ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" }}
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push('/search')}
            className={`w-11 h-11 flex items-center justify-center rounded-2xl transition-all duration-500 border ${
              theme.isMalam
                ? "bg-white/[0.03] border-white/5 text-[#E3655B]"
                : "bg-black/[0.02] border-black/5 text-[#E3655B]"
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </motion.button>

          <motion.div 
            animate={{ scale: isScrolled ? 0.9 : 1 }}
            className={`pl-2 border-l transition-colors duration-700 ${theme.isMalam ? "border-white/10" : "border-black/5"}`}
          >
            <UserMenu
              user={user}
              isAdmin={isAdmin}
              isScrolled={isScrolled}
              onOpenAuthModal={onOpenAuthModal}
              theme={theme}
            />
          </motion.div>
        </div>

      </div>
    </header>
  );
}