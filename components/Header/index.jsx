"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import UserMenu from "@/app/components/layout/UserMenu";
import { useTheme } from "@/app/hooks/useTheme";
import { useWeather } from "@/hooks/useWeather";
import { useRouter } from "next/navigation";

// ── 1. LUXURY LIVE CAPSULE ────────────────────────────────────────────────
function LiveStatus({ weather, theme, onShowStatistik }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 4000);
    return () => clearInterval(t);
  }, []);

  const statuses = [
    { label: "LIVE NOW", color: "bg-emerald-400" },
    weather?.short ? { label: weather.short, color: "bg-amber-400" } : null,
    weather?.temp ? { label: `${weather.temp}°C`, color: "bg-sky-400" } : null,
     { label: "AI ACTIVE", color: "bg-indigo-500" },
  ].filter(Boolean);

  const current = statuses[tick % statuses.length];

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
       onClick={onShowStatistik} 
      className={`group flex items-center gap-2.5 px-4 py-2 rounded-full backdrop-blur-xl border transition-all duration-500 ${
        theme.isMalam
          ? "bg-white/[0.03] border-white/10 text-white/80 hover:bg-white/[0.08]"
          : "bg-black/[0.02] border-black/5 text-slate-600 hover:bg-black/[0.05]"
      }`}
    >
      <div className="relative flex h-1.5 w-1.5">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-40 ${current.color}`} />
        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${current.color}`} />
      </div>
      <AnimatePresence mode="wait">
        <motion.span
          key={current.label}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          className="text-[8px] font-black uppercase tracking-[0.2em]"
        >
          {current.label}
        </motion.span>
      </AnimatePresence>
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
  onSelectTempat,
  onShowStatistik,
  onOpenAuthModal,
}) {
  const theme = useTheme();
  const router = useRouter();
  const { weather } = useWeather(villageLocation);


  // FIX: Tambahkan fungsi handleSelectTempat yang sempat hilang
  const handleSelectTempat = (tempat) => {
    setShowSearchModal(false);
    onSelectTempat?.(tempat);
  };

  return (
    <>
      <header className={`sticky top-0 z-[1000] transition-all duration-700 px-6 ${isScrolled ? "py-3" : "py-6"}`}>
        {/* Glass Background */}
        <div className={`absolute inset-0 transition-all duration-700 -z-10 ${
          isScrolled
            ? theme.isMalam
              ? "bg-black/40 backdrop-blur-3xl border-b border-white/[0.05]"
              : "bg-white/40 backdrop-blur-3xl border-b border-black/[0.03]"
            : "bg-transparent"
        }`} />

        <div className="max-w-7xl mx-auto flex items-center justify-between relative">
          
          {/* LEFT: ICONIC LOGO WITH DYNAMIC SCALE */}
          <div className="flex-1 flex items-center">
            <motion.div
              layout
              onClick={onOpenLocationModal}
              className="relative cursor-pointer group flex items-center gap-3"
            >
              <motion.div 
                animate={{ scale: isScrolled ? 0.85 : 1 }}
                className="relative"
              >
                {/* Active Location Dot */}
                <AnimatePresence>
                  {locationReady && (
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1 z-10 w-3.5 h-3.5 bg-emerald-500 border-[3px] rounded-full"
                      style={{ borderColor: theme.isMalam ? '#1a1a1a' : '#fff' }}
                    >
                      <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-40" />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Logo Box */}
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-500 ${
                  locationReady 
                    ? "bg-gradient-to-br from-[#E3655B] to-[#ff8e85] shadow-lg shadow-[#E3655B]/20" 
                    : "bg-slate-800 opacity-40 grayscale"
                }`}>
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                </div>
              </motion.div>

              {/* Text Location - Morphing out on scroll */}
              <AnimatePresence>
                {!isScrolled && (
                  <motion.div
                    initial={{ opacity: 0, x: -10, filter: "blur(10px)" }}
                    animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, x: -20, filter: "blur(10px)" }}
                    transition={{ duration: 0.4 }}
                    className="flex flex-col whitespace-nowrap"
                  >
                    <h1 className={`text-[10px] font-black tracking-[0.2em] ${theme.text} opacity-30 uppercase`}>
                      Setempat<span className="text-[#E3655B]">.id</span>
                    </h1>
                    <p className={`text-[13px] font-bold ${theme.text} leading-tight`}>
                      {villageLocation || "Pasuruan"}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>

          {/* CENTER: FLOATING STATUS */}
          <div className="flex justify-center flex-shrink-0">
            <LiveStatus
              weather={weather}
              theme={theme}
              onShowStatistik={onShowStatistik}
            />
          </div>

          {/* RIGHT: ACTIONS */}
          <div className="flex-1 flex items-center justify-end gap-3 sm:gap-4">
            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => router.push('/search')}
              className={`w-11 h-11 flex items-center justify-center rounded-2xl transition-all duration-500 ${
                theme.isMalam
                  ? "bg-white/[0.03] border border-white/10 hover:bg-white/[0.08]"
                  : "bg-black/[0.02] border border-black/5 hover:bg-black/[0.05]"
              }`}
            >
              <svg className="w-5 h-5 text-[#E3655B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </motion.button>

            <div className={`pl-2 border-l transition-colors duration-500 ${theme.isMalam ? "border-white/5" : "border-black/5"}`}>
              <UserMenu
                user={user}
                isAdmin={isAdmin}
                isScrolled={isScrolled}
                onOpenAuthModal={onOpenAuthModal}
                theme={theme}
              />
            </div>
          </div>

        </div>
      </header>
    </>
  );
}