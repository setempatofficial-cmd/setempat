"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { useLocation } from "@/components/LocationProvider";
import { useTheme } from "@/app/hooks/useTheme";
import { useWeather } from "@/hooks/useWeather";

// Helper function untuk level vibes yang user friendly
const getVibeLevel = (score) => {
  if (score > 80) return { 
    text: "SUPER HITS", 
    emoji: "🔥", 
    color: "text-rose-500",
    bg: "bg-rose-500/20",
    desc: "Lagi rame banget! Banyak warga berkumpul"
  };
  if (score > 65) return { 
    text: "RAMAI BANGET", 
    emoji: "🎉", 
    color: "text-amber-500",
    bg: "bg-amber-500/20",
    desc: "Suasana meriah, banyak aktivitas warga"
  };
  if (score > 50) return { 
    text: "LUMAYAN RAMAI", 
    emoji: "👥", 
    color: "text-yellow-500",
    bg: "bg-yellow-500/20",
    desc: "Mulai rame, warga berdatangan"
  };
  if (score > 35) return { 
    text: "NORMAL", 
    emoji: "🍃", 
    color: "text-emerald-500",
    bg: "bg-emerald-500/20",
    desc: "Kondisi biasa, seperti biasanya"
  };
  return { 
    text: "SEPI TENANG", 
    emoji: "😴", 
    color: "text-slate-400",
    bg: "bg-slate-400/20",
    desc: "Lengang, cocok buat santai"
  };
};

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

  // ============================================
  // STATISTIK MENGGUNAKAN DATA DARI FEEDENGINE
  // ============================================
  const stats = useMemo(() => {
    if (!tempat?.length) { 
      return { 
        titikRamai: 0, 
        titikDekat: 0, 
        viralCount: 0, 
        topPlace: null,
        totalLaporan: 0,
        rataRataSkor: 0
      }; 
    }
    
    const titikRamai = tempat.filter(t => t.isRamai === true || (t.realtimeScore > 70)).length;
    const titikDekat = tempat.filter(t => t.distance && t.distance < 1.5).length;
    const viralCount = tempat.filter(t => t.isViral === true || t.realtimeScore > 85).length;
    const topPlace = [...tempat].sort((a, b) => (b.realtimeScore || 0) - (a.realtimeScore || 0))[0];
    
    const totalSkor = tempat.reduce((sum, t) => sum + (t.realtimeScore || 0), 0);
    const rataRataSkor = Math.round(totalSkor / tempat.length);
    
    return { 
      titikRamai, 
      titikDekat, 
      viralCount, 
      topPlace,
      totalLaporan: tempat.length,
      rataRataSkor
    };
  }, [tempat]);

  // ============================================
  // DATA LALU LINTAS REAL DARI LAPORAN WARGA
  // ============================================
  const trafficStats = useMemo(() => {
    if (!tempat?.length) {
      return { 
        macet: 0, 
        ramai: 0, 
        lancar: 0, 
        kondisi: "Normal", 
        icon: "🛵", 
        color: "text-emerald-500",
        desc: "Belum ada laporan lalu lintas"
      };
    }
    
    const trafficReports = [];
    
    tempat.forEach(t => {
      if (t.laporan_terbaru && Array.isArray(t.laporan_terbaru)) {
        t.laporan_terbaru.forEach(l => {
          if (l.traffic_condition) {
            trafficReports.push({
              condition: l.traffic_condition,
              created_at: l.created_at,
              tempatName: t.name
            });
          }
          const text = (l.deskripsi || l.content || "").toLowerCase();
          if (!l.traffic_condition) {
            if (text.includes('macet') || text.includes('ngantre') || text.includes('mengular')) {
              trafficReports.push({ condition: 'Macet', created_at: l.created_at, tempatName: t.name });
            } else if (text.includes('padat') || text.includes('ramai') || text.includes('rame')) {
              trafficReports.push({ condition: 'Ramai', created_at: l.created_at, tempatName: t.name });
            } else if (text.includes('lancar') || text.includes('sepi') || text.includes('lengang')) {
              trafficReports.push({ condition: 'Lancar', created_at: l.created_at, tempatName: t.name });
            }
          }
        });
      }
      
      if (t.trafficCondition) {
        trafficReports.push({
          condition: t.trafficCondition,
          created_at: t.trafficUpdatedAt,
          tempatName: t.name,
          isRecent: t.trafficIsRecent
        });
      }
    });
    
    trafficReports.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    const macet = trafficReports.filter(r => r.condition === 'Macet').length;
    const ramai = trafficReports.filter(r => r.condition === 'Ramai').length;
    const lancar = trafficReports.filter(r => r.condition === 'Lancar').length;
    
    const latestReport = trafficReports[0];
    
    let kondisi = "Normal";
    let icon = "🛵";
    let color = "text-emerald-500";
    let desc = "Kondisi jalan normal";
    let isRecent = false;
    
    if (latestReport) {
      isRecent = latestReport.isRecent || (new Date() - new Date(latestReport.created_at)) < (2 * 60 * 60 * 1000);
    }
    
    if (macet > ramai && macet > lancar) {
      kondisi = "Macet";
      icon = "🚦";
      color = "text-rose-500";
      desc = latestReport && latestReport.condition === 'Macet' 
        ? `Macet di ${latestReport.tempatName || 'sekitar sini'}. Cari jalur alternatif!`
        : "Kemacetan terpantau di beberapa titik";
    } else if (ramai > macet && ramai > lancar) {
      kondisi = "Ramai";
      icon = "🚗";
      color = "text-amber-500";
      desc = "Volume kendaraan tinggi, hati-hati di jalan";
    } else if (lancar > 0) {
      kondisi = "Lancar";
      icon = "🛵";
      color = "text-emerald-500";
      desc = "Jalanan lancar, nyaman berkendara";
    }
    
    if (latestReport && isRecent && latestReport.condition) {
      const cond = latestReport.condition;
      if (cond === 'Macet') {
        kondisi = "Macet";
        icon = "🚦";
        color = "text-rose-500";
        desc = `Warga lapor: ${cond} di ${latestReport.tempatName || 'sekitar sini'}`;
      } else if (cond === 'Ramai') {
        kondisi = "Ramai";
        icon = "🚗";
        color = "text-amber-500";
        desc = `Warga lapor: lalu lintas ${cond} di ${latestReport.tempatName || 'sekitar sini'}`;
      } else if (cond === 'Lancar') {
        kondisi = "Lancar";
        icon = "🛵";
        color = "text-emerald-500";
        desc = `Warga lapor: jalanan ${cond} di ${latestReport.tempatName || 'sekitar sini'}`;
      }
    }
    
    return { macet, ramai, lancar, kondisi, icon, color, desc, hasReport: trafficReports.length > 0, latestReport, isRecent };
  }, [tempat]);

  // ============================================
  // STATUS UTAMA
  // ============================================
  const getStatDisplay = useMemo(() => {
    if (stats.viralCount > 0) { 
      return { 
        icon: "🔴", 
        text: `${stats.viralCount} TEMPAT VIRAL`, 
        color: "text-rose-500",
        desc: "Lagi hits! Banyak yang membicarakan"
      };
    }
    if (stats.titikRamai > 0) { 
      return { 
        icon: "👥", 
        text: `${stats.titikRamai} TEMPAT RAMAI`, 
        color: "text-amber-500",
        desc: "Suasana meriah, banyak warga berkumpul"
      };
    }
    return theme.isMalam
      ? { 
          icon: "🌙", 
          text: "SUASANA TENANG", 
          color: "text-cyan-400",
          desc: "Malam yang syahdu, cocok untuk santai"
        }
      : { 
          icon: "🍃", 
          text: "SUASANA SEPI", 
          color: "text-emerald-500",
          desc: "Tenang dan lengang, nyaman untuk jalan"
        };
  }, [stats.viralCount, stats.titikRamai, theme.isMalam]);

  // ============================================
  // STATUS LALU LINTAS (REAL DARI LAPORAN)
  // ============================================
  const getTrafficInfo = useMemo(() => {
    return {
      icon: trafficStats.icon,
      text: trafficStats.kondisi,
      color: trafficStats.color,
      desc: trafficStats.desc,
      isRecent: trafficStats.isRecent
    };
  }, [trafficStats]);

  // ============================================
  // CUACA DENGAN FALLBACK
  // ============================================
  const getWeatherDisplay = useMemo(() => {
    if (weather) {
      return {
        temp: weather.temp,
        short: weather.short,
        desc: weather.desc
      };
    }
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return { temp: 26, short: "Cerah", desc: "Pagi cerah" };
    if (hour >= 11 && hour < 15) return { temp: 32, short: "Panas", desc: "Siang terik" };
    if (hour >= 15 && hour < 18) return { temp: 28, short: "Teduh", desc: "Sore nyaman" };
    return { temp: 24, short: "Sejuk", desc: "Malam dingin" };
  }, [weather]);

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

  // Hitung vibe level untuk ditampilkan
  const vibeLevel = getVibeLevel(stats.rataRataSkor);

  if (!locationReady || !validatedLocation || !mounted) return null;

  const popup = (
    <AnimatePresence>
      {visible && (
        <>
          {expanded && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[997]"
              onClick={hide}
            />
          )}

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

              {/* BARIS UTAMA */}
              <div
                className="flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none"
                onClick={() => setExpanded(v => !v)}
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 animate-pulse ${theme.dot} ${theme.dotGlow}`} />

                <div className="flex-1 flex items-center gap-2 min-w-0 overflow-hidden flex-wrap">
                  <span className={`text-[11px] font-black uppercase whitespace-nowrap ${getStatDisplay.color}`}>
                    {getStatDisplay.icon} {getStatDisplay.text}
                  </span>
                  <span className={`w-px h-3 flex-shrink-0 ${theme.isMalam ? "bg-white/20" : "bg-slate-200"}`} />
                  <span className={`text-[11px] font-black uppercase whitespace-nowrap ${getTrafficInfo.color}`}>
                    {getTrafficInfo.icon} {getTrafficInfo.text}
                  </span>
                  {trafficStats.isRecent && (
                    <span className="text-[8px] font-black px-1 py-0.5 rounded-full bg-rose-500/20 text-rose-500 animate-pulse">
                      LIVE
                    </span>
                  )}
                  <span className={`w-px h-3 flex-shrink-0 ${theme.isMalam ? "bg-white/20" : "bg-slate-200"}`} />
                  <span className={`text-[11px] font-black whitespace-nowrap ${theme.text}`}>
                    {getWeatherDisplay.temp}°C
                  </span>
                  <span className={`text-[10px] font-black whitespace-nowrap ${theme.isMalam ? "text-sky-300" : "text-sky-500"}`}>
                    {getWeatherDisplay.short}
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

              {/* EXPANDED DETAIL */}
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
                          { label: "Tempat Ramai", value: stats.titikRamai, color: getStatDisplay.color, icon: "👥" },
                          { label: "Dekat Kamu", value: stats.titikDekat, color: theme.text, icon: "📍" },
                          { label: "Viral/Hits", value: stats.viralCount, color: "text-rose-500", icon: "🔥" },
                        ].map((s, i) => (
                          <div key={i} className={`p-2.5 rounded-xl border text-center
                            ${theme.isMalam ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-100"}`}
                          >
                            <p className={`text-[11px] font-black mb-1 ${s.color}`}>{s.icon} {s.label}</p>
                            <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Lalu Lintas (Real dari Laporan Warga) */}
                      <div className={`flex items-center gap-2.5 p-2.5 rounded-xl border
                        ${theme.isMalam ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-100"}`}
                      >
                        <span className="text-lg">{getTrafficInfo.icon}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-[12px] font-black uppercase ${getTrafficInfo.color}`}>
                              Lalu Lintas {getTrafficInfo.text}
                            </span>
                            {trafficStats.isRecent && (
                              <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-500">
                                UPDATE WARGA
                              </span>
                            )}
                          </div>
                          <p className={`text-[10px] ${theme.textMuted} mt-0.5`}>
                            {getTrafficInfo.desc}
                          </p>
                          {trafficStats.latestReport?.tempatName && (
                            <p className={`text-[8px] ${theme.textMuted} mt-1 opacity-60`}>
                              📍 Dari {trafficStats.latestReport.tempatName}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <span className={`text-[12px] font-black ${theme.text}`}>{getWeatherDisplay.temp}°C</span>
                          <p className={`text-[9px] ${theme.textMuted}`}>{getWeatherDisplay.desc}</p>
                        </div>
                      </div>

                      {/* VIBES HARI INI - User Friendly */}
                      {stats.rataRataSkor > 0 && (
                        <div className={`flex items-center gap-2.5 p-2.5 rounded-xl border
                          ${theme.isMalam ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-100"}`}
                        >
                          <span className="text-lg">{vibeLevel.emoji}</span>
                          <div className="flex-1">
                            <div className="flex justify-between items-center">
                              <span className={`text-[11px] font-black ${theme.text}`}>
                                🎉 Vibes Hari Ini
                              </span>
                              <span className={`text-[12px] font-black ${vibeLevel.color} ${vibeLevel.bg} px-2 py-0.5 rounded-full`}>
                                {vibeLevel.text}
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-white/20 rounded-full mt-2 overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all ${vibeLevel.color.replace('text', 'bg')}`}
                                style={{ width: `${Math.min(100, stats.rataRataSkor)}%` }}
                              />
                            </div>
                            <p className={`text-[9px] mt-1.5 ${theme.textMuted}`}>
                              {vibeLevel.desc}
                            </p>
                          </div>
                        </div>
                      )}

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
                              🏆 Paling Ramai Sekarang
                            </p>
                            <p className={`text-[13px] font-black ${theme.text}`}>
                              {stats.topPlace.name}
                            </p>
                            <p className={`text-[9px] ${theme.textMuted} mt-0.5`}>
                              {stats.topPlace.distance ? `${stats.topPlace.distance.toFixed(1)} km dari kamu` : ''}
                            </p>
                          </div>
                          <span className={`text-[11px] font-black px-2 py-1 rounded-lg flex-shrink-0
                            ${theme.isMalam ? "bg-cyan-500/20 text-cyan-400" : "bg-[#E3655B]/10 text-[#E3655B]"}`}
                          >
                            Lihat →
                          </span>
                        </button>
                      )}

                      {/* Informasi total laporan */}
                      <div className={`text-center pt-1 ${theme.textMuted}`}>
                        <p className="text-[9px] font-medium">
                          📊 {stats.totalLaporan} tempat dipantau • Update real-time dari warga
                        </p>
                        {trafficStats.hasReport && (
                          <p className="text-[8px] mt-0.5 opacity-60">
                            🚦 Lalu lintas dari laporan warga
                          </p>
                        )}
                      </div>
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

  return createPortal(popup, document.body);
}