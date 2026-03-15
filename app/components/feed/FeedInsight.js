"use client";

export default function FeedInsight({
  aktivitasUtama,
  testimonialTerbaru,
  medsosTerbaru,
  topExternalComment,
  narasiCerita,
  suasana,
  formatTimeAgo,
  isHujan,
  isRamai,
  theme: timeTheme
}) {
  const highlight = aktivitasUtama || testimonialTerbaru || medsosTerbaru || topExternalComment;
  const displayContent = highlight?.content || highlight?.text || highlight?.deskripsi || highlight?.konten || narasiCerita;

  const getInsightTheme = () => {
    const isDark = timeTheme?.name === "MALAM";
    if (isHujan) return { 
      accent: "text-blue-500", 
      bg: "bg-blue-500/5", 
      label: "Kabar Cuaca", 
      icon: "🌧️" 
    };
    if (isRamai) return { 
      accent: "text-orange-500", 
      bg: "bg-orange-500/5", 
      label: "Lagi Rame Pol", 
      icon: "🔥" 
    };
    return { 
      accent: isDark ? "text-cyan-400" : "text-slate-500", 
      bg: isDark ? "bg-white/5" : "bg-slate-100", 
      label: "Update Terkini", 
      icon: "✨" 
    };
  };

  const st = getInsightTheme();
  if (!displayContent && !suasana) return null;

  return (
    <div className="relative space-y-3 animate-in fade-in duration-700">
      
      {/* 1. Header Insight: Pakai Chip, bukan border penuh */}
      <div className="flex items-center justify-between">
        <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full ${st.bg} border border-current/10 ${st.accent}`}>
          <span className="text-[10px]">{st.icon}</span>
          <span className="text-[9px] font-black uppercase tracking-[0.15em]">
            {st.label}
          </span>
        </div>
        
        {highlight?.created_at && (
          <span className="text-[9px] font-bold opacity-30 uppercase tracking-tighter">
            {formatTimeAgo ? formatTimeAgo(highlight.created_at) : "Baru Saja"}
          </span>
        )}
      </div>

      {/* 2. Isi Konten: Tipografi yang kuat, hilangkan box luar */}
      <div className="px-1 relative">
        <p className={`text-[14px] leading-[1.4] font-medium tracking-tight ${timeTheme?.textWhite || 'text-slate-900'}`}>
          <span className={`inline-block w-1 h-1 rounded-full mr-2 mb-1 ${st.accent.replace('text', 'bg')}`} />
          {displayContent}
        </p>

        {/* User Tag: Minimalis di bawah teks */}
        {(highlight?.username || highlight?.user_name) && (
          <div className="mt-2 flex items-center gap-1.5 opacity-60">
            <div className="w-3.5 h-3.5 rounded-full bg-current/10 flex items-center justify-center text-[7px]">👤</div>
            <span className="text-[10px] font-bold italic">
              @{highlight.username || highlight.user_name}
            </span>
          </div>
        )}
      </div>

      {/* 3. Suasana: Dibuat seperti catatan kaki (Footer Note) */}
      {suasana?.deskripsi && (
        <div className={`mx-1 p-3 rounded-2xl border-l-2 ${st.accent.replace('text', 'border')} ${st.bg} italic`}>
          <p className="text-[11px] font-medium leading-relaxed opacity-80">
            "{suasana.deskripsi}"
          </p>
        </div>
      )}
    </div>
  );
}