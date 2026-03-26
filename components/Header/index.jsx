"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "../LocationProvider";
import UserMenu from "@/app/components/layout/UserMenu";
import { useTheme } from "@/app/hooks/useTheme";
import { supabase } from "@/lib/supabaseClient";
import { useWeather } from "@/hooks/useWeather";

// ── 1. LIVE STATUS CAPSULE ────────────────────────────────────────────────
function LiveStatus({ weather, theme, onShowStatistik }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 4000);
    return () => clearInterval(t);
  }, []);

  const statuses = [
    { label: "LIVE", color: "bg-emerald-500" },
    weather?.temp ? { label: `${weather.temp}°C`, color: "bg-sky-400" } : null,
    { label: "AI ACTIVE", color: "bg-indigo-500" },
  ].filter(Boolean);

  const current = statuses[tick % statuses.length];

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onShowStatistik}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md border transition-colors ${theme.isMalam
        ? "bg-white/5 border-white/10 text-white/90"
        : "bg-slate-900/5 border-slate-900/10 text-slate-700"
        }`}
    >
      <span className="relative flex h-2 w-2">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${current.color}`} />
        <span className={`relative inline-flex rounded-full h-2 w-2 ${current.color}`} />
      </span>
      <AnimatePresence mode="wait">
        <motion.span
          key={current.label}
          initial={{ opacity: 0, x: 5 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -5 }}
          className="text-[10px] font-black tracking-widest uppercase"
        >
          {current.label}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

// ── 3. MAIN HEADER COMPONENT ──────────────────────────────────────────────
export default function Header({
  user,
  isAdmin,
  locationReady,
  villageLocation,
  isScrolled,
  onOpenLocationModal,
  onOpenAIModal,
  onSearchWithQuery,
  onShowStatistik,
  onOpenLaporanForm,
  onOpenAuthModal,
}) {
  const theme = useTheme();
  const { weather } = useWeather(villageLocation);
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    const down = (e) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenAIModal();
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [onOpenAIModal]);

  const handleSubmit = (e) => {
    if (e.key === "Enter" && query.trim()) {
      onSearchWithQuery(query.trim());
      setQuery("");
      inputRef.current?.blur();
    }
  };

  return (
    <>
      <header className={`sticky top-0 z-[1000] transition-all duration-500 px-4 ${isScrolled ? "py-2" : "py-4"}`}>
        <div
          className={`absolute inset-0 transition-all duration-500 -z-10 ${isScrolled
            ? theme.isMalam
              ? "bg-black/60 backdrop-blur-2xl border-b border-white/5"
              : "bg-white/70 backdrop-blur-2xl border-b border-slate-200/50"
            : "bg-transparent"
            }`}
        />

        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <motion.div
              layout
              onClick={onOpenLocationModal}
              className={`cursor-pointer flex items-center gap-2 p-1 rounded-2xl transition-all ${isScrolled
                ? "bg-transparent"
                : theme.isMalam
                  ? "bg-white/5"
                  : "bg-slate-100"
                }`}
            >
              <div className="relative group">
                {/* EFEK KHUSUS: Aura Glow saat lokasi aktif */}
                {locationReady && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ 
                      opacity: [0.3, 0.6, 0.3], 
                      scale: [1, 1.2, 1],
                    }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-0 bg-[#E3655B] blur-xl rounded-full -z-10"
                  />
                )}
                
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-all duration-500 ${
                  locationReady 
                    ? "bg-gradient-to-br from-[#E3655B] to-[#ff8e85] scale-100 rotate-0" 
                    : "bg-slate-400 grayscale-[0.8] scale-95 opacity-80"
                }`}>
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                </div>
              </div>

              {!isScrolled && (
                <div className="pr-3 hidden sm:block">
                  <h1 className={`text-sm font-black tracking-tight ${theme.text}`}>
                    SETEMPAT<span className="text-[#E3655B]">ID</span>
                  </h1>
                  <p className={`text-[10px] font-medium opacity-60 truncate max-w-[100px] flex items-center gap-1 ${theme.text}`}>
                    {villageLocation || "Pilih Lokasi"}
                    {!locationReady && <span className="text-[8px] opacity-40">(Manual)</span>}
                  </p>
                </div>
              )}
            </motion.div>
          </div>

          <div className="flex-1 relative group">
            <motion.div
              animate={{
                scale: isFocused ? 1.02 : 1,
                boxShadow: isFocused ? "0 0 30px -5px rgba(227, 101, 91, 0.25)" : "0 0 0px 0px transparent",
              }}
              className={`relative flex items-center transition-all duration-300 rounded-2xl overflow-hidden border ${theme.isMalam
                ? isFocused
                  ? "bg-white/15 border-white/20"
                  : "bg-white/5 border-white/10"
                : isFocused
                  ? "bg-white border-[#E3655B]/30 shadow-xl"
                  : "bg-slate-100 border-transparent"
                }`}
            >
              <div className="pl-4 text-[#E3655B]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onKeyDown={handleSubmit}
                placeholder="Cari atau tanya AI..."
                className={`w-full py-3 px-3 bg-transparent text-sm font-medium focus:outline-none ${theme.text}`}
              />
            </motion.div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:block">
              <LiveStatus
                weather={weather}
                theme={theme}
                onShowStatistik={onShowStatistik}
              />
            </div>
            <UserMenu
              user={user}
              isAdmin={isAdmin}
              isScrolled={isScrolled}
              onOpenAuthModal={onOpenAuthModal}
              theme={theme}
            />
          </div>
        </div>
      </header>
    </>
  );
}

// ── 4. AI INSIGHT CARD ─────────────────────────
export function AIInsightCard({ villageLocation, weather, theme }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`relative overflow-hidden p-6 rounded-[2.5rem] ${theme.isMalam
        ? "bg-zinc-900 border border-white/5"
        : "bg-white border border-slate-100 shadow-xl shadow-slate-200/50"
        }`}
    >
      <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
        <div className="w-32 h-32 bg-[#E3655B] rounded-full blur-[60px]" />
      </div>

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-[#E3655B]/10 text-[#E3655B] text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider">
              AI Insight
            </span>
            <span className={`text-[10px] font-bold opacity-40 uppercase tracking-widest ${theme.text}`}>
              {villageLocation}
            </span>
          </div>
          <h2 className={`text-2xl font-bold leading-tight ${theme.text}`}>
            Laporan terkini: <span className="text-[#E3655B]">Bangil</span> lancar, cuaca cerah untuk aktivitas luar.
          </h2>
        </div>

        <div className="flex items-center gap-4 border-l border-slate-100 dark:border-white/5 pl-6">
          <div className="text-right">
            <p className={`text-3xl font-black ${theme.text}`}>
              {weather?.temp || "28"}°C
            </p>
            <p className="text-[10px] font-bold text-[#E3655B] uppercase tracking-tighter">
              Kelembaban Normal
            </p>
          </div>
          <button className="h-12 w-12 rounded-2xl bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 hover:scale-110 transition-transform">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </button>
        </div>
      </div>
    </motion.div>
  );
}