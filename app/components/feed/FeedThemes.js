// FeedThemes.js

export const FEED_THEMES = {
  Pagi: {
    name: "PAGI",
    bgCard: "bg-white",
    bgHeader: "bg-amber-50/50",
    border: "border-amber-100",
    accent: "text-orange-600",
    accentBg: "bg-orange-500",
    accentSoft: "bg-orange-50 border-orange-100",
    text: "text-slate-900",
    textMuted: "text-slate-500",
    textWhite: "text-slate-900",
    dot: "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]",
    liveBadge: "bg-orange-600 text-white",
    statusBg: "bg-orange-50/50 border-orange-100",
    statusText: "text-orange-800",
    glow: "shadow-[0_20px_50px_rgba(249,115,22,0.1)]",
    overlay: "from-white/90 via-white/20 to-transparent",
    icon: "🌅",
    gradient: "from-orange-400 to-yellow-300",
  },
  Siang: {
    name: "SIANG",
    bgCard: "bg-white",
    bgHeader: "bg-sky-50/50",
    border: "border-slate-200",
    accent: "text-[#E3655B]",
    accentBg: "bg-[#E3655B]",
    accentSoft: "bg-rose-100 border-rose-200",
    text: "text-slate-900",
    textMuted: "text-slate-500",
    textWhite: "text-slate-900",
    dot: "bg-[#E3655B] shadow-[0_0_8px_rgba(227,101,91,0.4)]",
    liveBadge: "bg-[#E3655B] text-white",
    statusBg: "bg-rose-50/80 border-rose-200",
    statusText: "text-slate-700",
    glow: "shadow-[0_20px_50px_rgba(227,101,91,0.1)]",
    overlay: "from-white/90 via-white/20 to-transparent",
    icon: "☀️",
    gradient: "from-amber-500 to-orange-400",
  },
  Sore: {
    name: "SORE",
    bgCard: "bg-white",
    bgHeader: "bg-rose-50/50",
    border: "border-rose-100",
    accent: "text-rose-600",
    accentBg: "bg-rose-600",
    accentSoft: "bg-rose-50 border-rose-100",
    text: "text-slate-900",
    textMuted: "text-rose-900/40",
    textWhite: "text-slate-900",
    dot: "bg-rose-500 shadow-[0_0_8px_rgba(225,29,72,0.5)]",
    liveBadge: "bg-rose-600 text-white",
    statusBg: "bg-rose-50/80 border-rose-100",
    statusText: "text-rose-800",
    glow: "shadow-[0_20px_50px_rgba(225,29,72,0.08)]",
    overlay: "from-white/90 via-white/20 to-transparent",
    icon: "🌆",
    gradient: "from-orange-500 to-rose-400",
  },
  Malam: {
    name: "MALAM",
    bgCard: "bg-[#0c0c0e]",
    bgHeader: "bg-zinc-900/50",
    border: "border-white/10",
    accent: "text-cyan-400",
    accentBg: "bg-cyan-400",
    accentSoft: "bg-cyan-500/10 border-cyan-500/20",
    text: "text-white",
    textMuted: "text-zinc-500",
    textWhite: "text-white",
    dot: "bg-cyan-400 shadow-[0_0_12px_#22d3ee]",
    liveBadge: "bg-emerald-500 text-white",
    statusBg: "bg-white/5 border-white/10",
    statusText: "text-cyan-100",
    glow: "shadow-[0_30px_60px_rgba(0,0,0,0.8)]",
    overlay: "from-black/90 via-black/40 to-transparent",
    icon: "🌙",
    gradient: "from-slate-800 to-slate-900",
  },
};

// Default untuk fallback
export const DEFAULT_FEED_THEME = FEED_THEMES.Siang;

// Helper functions
export function getFeedTheme(timeLabel) {
  return FEED_THEMES[timeLabel] || DEFAULT_FEED_THEME;
}

export function getFeedThemeByMode(isMalam) {
  return isMalam ? FEED_THEMES.Malam : FEED_THEMES.Siang;
}

// Hook untuk digunakan di komponen
export function useFeedTheme() {
  const { timeLabel, isClient } = useClock();

  return useMemo(() => {
    if (!isClient) return DEFAULT_FEED_THEME;
    return getFeedTheme(timeLabel);
  }, [timeLabel, isClient]);
}