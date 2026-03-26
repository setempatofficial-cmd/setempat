"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { useLocation } from "@/components/LocationProvider";
import { useTheme } from "@/app/hooks/useTheme";
import { useWeather } from "@/hooks/useWeather";

export default function LaporanWarga({
  tempat = [],
  locationReady,
  displayLocation,
  location,
  forceShow = false,
  onHide,
}) {
  const { sapaan } = useLocation();
  const theme = useTheme();

  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const shownOnceRef = useRef(false);

  useEffect(() => { setMounted(true); }, []);

  const validatedLocation = useMemo(() => {
    if (locationReady && location) {
      if (typeof location === "object") {
        return location.nama || location.address || location.kecamatan ||
          location.kota || location.daerah || displayLocation || "Lokasi Anda";
      }
      return location;
    }
    return displayLocation || null;
  }, [locationReady, location, displayLocation]);

  const { weather } = useWeather(validatedLocation);

  const stats = useMemo(() => {
    if (!tempat?.length) return { titikRamai: 0, titikDekat: 0, viralCount: 0, topPlace: null };
    const titikRamai = tempat.filter(t => parseInt(t.estimasi_orang) > 20).length;
    const titikDekat = tempat.filter(t => t.distance && t.distance < 1.5).length;
    const viralCount = tempat.filter(t => t.is_viral || parseInt(t.estimasi_orang) > 50).length;
    const topPlace = [...tempat].sort((a, b) => (parseInt(b.estimasi_orang) || 0) - (parseInt(a.estimasi_orang) || 0))[0];
    return { titikRamai, titikDekat, viralCount, topPlace };
  }, [tempat]);

  const getStatDisplay = useMemo(() => {
    if (stats.viralCount > 0) return { icon: "🔴", text: `${stats.viralCount} VIRAL`, color: "text-rose-500" };
    if (stats.titikRamai > 0) return { icon: "👥", text: `${stats.titikRamai} RAMAI`, color: "text-amber-500" };
    return theme.isMalam
      ? { icon: "🌙", text: "TENANG", color: "text-cyan-400" }
      : { icon: "🍃", text: "SEPI", color: "text-emerald-500" };
  }, [stats.viralCount, stats.titikRamai, theme.isMalam]);

  const getTrafficInfo = useMemo(() => {
    const n = stats.titikRamai;
    if (stats.viralCount > 0 || n > 20) return { icon: "🚦", text: "PADAT", color: "text-rose-500" };
    if (n > 10) return { icon: "🚗", text: "RAMAI", color: "text-amber-500" };
    return { icon: "🛵", text: "LANCAR", color: "text-emerald-500" };
  }, [stats.titikRamai, stats.viralCount]);

  const hide = useCallback(() => {
    setVisible(false);
    setExpanded(false);
    onHide?.();
  }, [onHide]);

  useEffect(() => {
    if (locationReady && tempat.length > 0 && !shownOnceRef.current) {
      shownOnceRef.current = true;
      setTimeout(() => setVisible(true), 800);
    }
  }, [locationReady, tempat.length]);

  useEffect(() => {
    if (forceShow) { setVisible(true); setExpanded(false); }
  }, [forceShow]);



  if (!locationReady || !validatedLocation || !mounted) return null;

  const popup = (
    <AnimatePresence>
      {visible && (
        <>
          {/* ── BACKDROP — tutup saat tap di luar, hanya saat expanded ── */}
          {expanded && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[997]"
              onClick={hide}
            />
          )}

          {/* ── POPUP PANEL ── */}
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.97 }}
            transition={{ type: "spring", damping: 22, stiffness: 220 }}
            className="fixed z-[998] px-3"
            style={{
              top: "70px",
              left: 0,
              right: 0,
              maxWidth: "420px",
              margin: "0 auto",
            }}
          >
            <div className={`relative w-full rounded-2xl border shadow-xl
              ${theme.isMalam
                ? "bg-zinc-900 border-white/10 shadow-black/40"
                : "bg-white border-slate-200 shadow-slate-300/40"
              }`}
            >

              {/* ── BARIS UTAMA ── */}
              <div
                className="flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none"
                onClick={() => setExpanded(v => !v)}
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 animate-pulse ${theme.dot} ${theme.dotGlow}`} />

                <div className="flex-1 flex items-center gap-2 min-w-0 overflow-hidden">
                  <span className={`text-[11px] font-black uppercase whitespace-nowrap ${getStatDisplay.color}`}>
                    {getStatDisplay.icon} {getStatDisplay.text}
                  </span>
                  <span className={`w-px h-3 flex-shrink-0 ${theme.isMalam ? "bg-white/20" : "bg-slate-200"}`} />
                  <span className={`text-[11px] font-black uppercase whitespace-nowrap ${getTrafficInfo.color}`}>
                    {getTrafficInfo.icon} {getTrafficInfo.text}
                  </span>
                  {weather && (
                    <>
                      <span className={`w-px h-3 flex-shrink-0 ${theme.isMalam ? "bg-white/20" : "bg-slate-200"}`} />
                      <span className={`text-[11px] font-black whitespace-nowrap ${theme.text}`}>
                      {weather.temp}°C
                      </span>
                      {weather.short && (
                        <>
                          <span className={`w-px h-3 flex-shrink-0 ${theme.isMalam ? "bg-white/20" : "bg-slate-200"}`} />
                          <span className={`text-[10px] font-black whitespace-nowrap ${theme.isMalam ? "text-sky-300" : "text-sky-500"}`}>
                            {weather.short}
                          </span>
                        </>
                      )}
                    </>
                  )}
                  <span className={`text-[11px] font-medium truncate ${theme.textMuted} ml-auto`}>
                   {validatedLocation}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <motion.svg
                    animate={{ rotate: expanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className={`w-3.5 h-3.5 ${theme.textMuted}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                  </motion.svg>
                  <button
                    onClick={e => { e.stopPropagation(); hide(); }}
                    className="w-6 h-6 flex items-center justify-center rounded-full bg-rose-500/90 text-white text-[13px] font-black active:scale-90 transition-all shadow-sm hover:bg-rose-600"
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* ── EXPANDED DETAIL ── */}
              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: "easeInOut" }}
                    style={{ overflow: "hidden" }}
                  >
                    <div className={`px-3 pb-3 pt-1 border-t space-y-2.5
                      ${theme.isMalam ? "border-white/10" : "border-slate-100"}`}
                    >
                      {/* Grid stats */}
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: "Titik Ramai", value: stats.titikRamai, color: getStatDisplay.color },
                          { label: "Dekat Kamu", value: stats.titikDekat, color: theme.text },
                          { label: "Viral", value: stats.viralCount, color: "text-rose-500" },
                        ].map((s, i) => (
                          <div key={i} className={`p-2.5 rounded-xl border
                            ${theme.isMalam ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-100"}`}
                          >
                            <p className={`text-[9px] font-black uppercase mb-1 ${theme.textMuted}`}>{s.label}</p>
                            <p className={`text-base font-black ${s.color}`}>{s.value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Lalu lintas */}
                      <div className={`flex items-center gap-2.5 p-2.5 rounded-xl border
                        ${theme.isMalam ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-100"}`}
                      >
                        <span className="text-lg">{getTrafficInfo.icon}</span>
                        <div>
                          <span className={`text-[12px] font-black uppercase ${getTrafficInfo.color}`}>
                            Lalu Lintas {getTrafficInfo.text}
                          </span>
                          <p className={`text-[10px] ${theme.textMuted}`}>
                            {stats.viralCount > 0 || stats.titikRamai > 20
                              ? "Antrean panjang, cari jalur alternatif"
                              : stats.titikRamai > 10
                              ? "Volume kendaraan tinggi"
                              : "Kondisi normal, jalanan lancar"}
                          </p>
                        </div>
                      </div>

                      {/* Top place */}
                      {stats.topPlace && (
                        <button
                          onClick={() => {
                            hide();
                            setTimeout(() => {
                              document.getElementById(`feed-card-${stats.topPlace.id}`)
                                ?.scrollIntoView({ behavior: "smooth", block: "center" });
                            }, 300);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all active:scale-[0.98]
                            ${theme.isMalam
                              ? "bg-white/5 border-white/10 hover:bg-white/10"
                              : "bg-slate-50 border-slate-100 hover:bg-slate-100"}`}
                        >
                          <div className="text-left">
                            <p className={`text-[9px] font-black uppercase ${theme.textMuted}`}>
                              Paling ramai sekarang
                            </p>
                            <p className={`text-[13px] font-black ${theme.text}`}>
                              {stats.topPlace.name}
                            </p>
                          </div>
                          <span className={`text-[11px] font-black px-2 py-1 rounded-lg flex-shrink-0
                            ${theme.isMalam ? "bg-cyan-500/20 text-cyan-400" : "bg-[#E3655B]/10 text-[#E3655B]"}`}
                          >
                            Lihat →
                          </span>
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  // Render via Portal agar tidak terpengaruh z-index parent manapun
  return createPortal(popup, document.body);
}
