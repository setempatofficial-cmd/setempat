"use client";

import { useEffect, useState, useRef, useMemo } from "react";
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

  const statuses = useMemo(() => {
    return [
      { label: "LIVE NOW", color: "bg-emerald-400" },
      weather?.short ? { label: weather.short.toUpperCase(), color: "bg-amber-400" } : null,
      weather?.temp ? { label: `${weather.temp}°C`, color: "bg-sky-400" } : null,
      { label: "AI ACTIVE", color: "bg-indigo-500" },
    ].filter(Boolean);
  }, [weather]);

  const current = statuses[tick % statuses.length];

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onShowStatistik}
      animate={{ scale: isScrolled ? 0.9 : 1 }}
      className={`group flex items-center justify-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-2xl border transition-all duration-700 min-w-[100px] sm:min-w-[120px] ${theme.isMalam
        ? "bg-white/[0.04] border-white/10 text-white/90"
        : "bg-black/[0.03] border-black/5 text-slate-700"
        }`}
    >
      <div className="relative flex h-1.5 w-1.5 flex-shrink-0">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-40 ${current?.color}`} />
        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${current?.color}`} />
      </div>

      <div className="overflow-hidden relative h-3 flex items-center">
        <AnimatePresence mode="wait">
          <motion.span
            key={current?.label}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="text-[8px] sm:text-[9px] font-black uppercase tracking-[0.1em] whitespace-nowrap"
          >
            {current?.label}
          </motion.span>
        </AnimatePresence>
      </div>
    </motion.button>
  );
}

// ── 2. MAIN HEADER COMPONENT ────────────────────────────────
export default function Header({
  user,
  isAdmin,
  locationReady,
  villageLocation,
  isScrolled,
  onOpenLocationModal,
  onShowStatistik,
  onOpenAuthModal,
  // TAMBAHKAN PROPS BARU UNTUK FORM LAPORAN & UPLOAD
  onOpenLaporanForm,
  onOpenUpload,
}) {
  const theme = useTheme();
  const router = useRouter();
  const { weather } = useWeather(villageLocation);

  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const lastScrollYRef = useRef(0);
  const scrollTimeoutRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY <= 50) {
        setIsHeaderVisible(true);
        lastScrollYRef.current = currentScrollY;
        return;
      }

      if (Math.abs(currentScrollY - lastScrollYRef.current) < 30) return;

      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);

      scrollTimeoutRef.current = setTimeout(() => {
        if (currentScrollY > lastScrollYRef.current) {
          setIsHeaderVisible(false);
        } else {
          setIsHeaderVisible(true);
        }
        lastScrollYRef.current = currentScrollY;
      }, 50);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  return (
    <motion.header
      initial={{ y: 0 }}
      animate={{
        y: isHeaderVisible ? 0 : -140,
        opacity: isHeaderVisible ? 1 : 0,
      }}
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      className="fixed top-0 left-0 right-0 z-[1000] w-full"
    >
      {/* Glass Background */}
      <div
        className={`absolute inset-0 transition-all duration-700 -z-10 ${isScrolled
          ? theme.isMalam
            ? "bg-black/95 backdrop-blur-2xl border-b border-white/15 shadow-2xl"
            : "bg-white/95 backdrop-blur-2xl border-b border-black/10 shadow-md"
          : theme.isMalam
            ? "bg-gradient-to-b from-black/90 to-black/40 backdrop-blur-md border-b border-white/5"
            : "bg-gradient-to-b from-white/95 to-white/60 backdrop-blur-md border-b border-black/5"
          }`}
      />

      {/* Container Konten Dalam */}
      <div className={`mx-auto w-full max-w-[420px] px-4 transition-all duration-500 flex items-center justify-between relative ${isScrolled ? "h-14" : "h-16"
        }`}>

        {/* LEFT: BRAND & LOCATION */}
        <div className="flex-1 flex items-center min-w-0 pr-2">
          <motion.div
            layout
            onClick={onOpenLocationModal}
            className="flex items-center gap-2.5 cursor-pointer min-w-0"
          >
            <motion.div animate={{ scale: isScrolled ? 0.9 : 1 }} className="relative flex-shrink-0">
              <AnimatePresence>
                {locationReady && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute -top-0.5 -right-0.5 z-10 w-3 h-3 bg-emerald-500 border-2 rounded-full"
                    style={{ borderColor: theme.isMalam ? "#111" : "#fff" }}
                  />
                )}
              </AnimatePresence>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#E3655B] to-[#ff7d72] shadow-lg shadow-[#E3655B]/30">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
              </div>
            </motion.div>

            <div className="flex flex-col min-w-0">
              <h1 className={`text-[8px] sm:text-[9px] font-black tracking-widest ${theme.text} opacity-40 uppercase truncate`}>
                Setempat<span className="text-[#E3655B]">.id</span>
              </h1>
              <p className={`text-[12px] sm:text-[13px] font-bold ${theme.text} leading-none mt-0.5 truncate`}>
                {villageLocation || "Pilih Lokasi"}
              </p>
            </div>
          </motion.div>
        </div>

        {/* CENTER: LIVE STATUS */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
          <LiveStatus
            weather={weather}
            theme={theme}
            onShowStatistik={onShowStatistik}
            isScrolled={isScrolled}
          />
        </div>

        {/* RIGHT: ACTIONS */}
        <div className="flex-1 flex items-center justify-end gap-2 sm:gap-3 pl-2">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => router.push("/search")}
            className={`w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center rounded-xl border transition-colors ${theme.isMalam ? "bg-white/5 border-white/5" : "bg-black/5 border-black/5"
              }`}
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[#E3655B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </motion.button>

          <div className={`pl-2 border-l flex-shrink-0 ${theme.isMalam ? "border-white/10" : "border-black/5"}`}>
            <UserMenu
              user={user}
              isAdmin={isAdmin}
              isScrolled={isScrolled}
              onOpenAuthModal={onOpenAuthModal}
              theme={theme}
              // TAMBAHKAN PROPS INI:
              onOpenLaporanForm={onOpenLaporanForm}
              onOpenUpload={onOpenUpload}
            />
          </div>
        </div>

      </div>
    </motion.header>
  );
}