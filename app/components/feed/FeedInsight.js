"use client";

export default function FeedInsight({
  aktivitasUtama,
  testimonialTerbaru,
  medsosTerbaru,
  topExternalComment,
  narasiCerita, // Pastikan prop ini dikirim dari FeedCard
  suasana,
  formatTimeAgo,
  isHujan,
  isRamai,
  theme: timeTheme
}) {
  // Logic pemilihan konten prioritas
  const highlight = aktivitasUtama || testimonialTerbaru || medsosTerbaru || topExternalComment;
  
  // Jika tidak ada data highlight, gunakan narasiCerita dari engine sebagai fallback
  const displayContent = highlight?.content || highlight?.text || highlight?.deskripsi || highlight?.konten || narasiCerita;

  const getInsightTheme = () => {
    const isDark = timeTheme?.name === "MALAM";

    // 1. Kondisi Hujan
    if (isHujan) return {
      border: isDark ? "border-blue-500/30" : "border-blue-200",
      bg: isDark ? "bg-blue-500/10" : "bg-blue-50",
      line: "from-blue-500 to-cyan-400",
      text: isDark ? "text-blue-400" : "text-blue-700",
      content: isDark ? "text-zinc-100" : "text-blue-950",
      label: "Kabar Cuaca"
    };

    // 2. Kondisi Ramai
    if (isRamai) return {
      border: isDark ? "border-orange-500/30" : "border-orange-200",
      bg: isDark ? "bg-orange-500/10" : "bg-orange-50",
      line: "from-orange-500 to-red-500",
      text: isDark ? "text-orange-400" : "text-orange-700",
      content: isDark ? "text-orange-950" : "text-orange-950",
      label: "Lagi Rame Pol"
    };

    // 3. Kondisi Normal (Ikut Tema Waktu)
    return {
      border: isDark ? "border-white/10" : (timeTheme?.border || "border-slate-200"),
      bg: isDark ? "bg-white/5" : (timeTheme?.bgHeader || "bg-slate-50"),
      line: isDark ? "from-indigo-500 to-purple-500" : "from-slate-400 to-slate-600",
      text: isDark ? "text-indigo-400" : (timeTheme?.accent || "text-slate-600"),
      content: isDark ? "text-zinc-100" : "text-slate-900", // Hitam pekat di mode terang
      label: "Update Terkini"
    };
  };

  const st = getInsightTheme();

  // Guard clause: jangan render apapun jika benar-benar kosong
  if (!displayContent && !suasana) return null;

  return (
    <div className="mt-4 relative animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className={`relative overflow-hidden rounded-2xl p-3.5 border ${st.border} ${st.bg} ${timeTheme?.name === 'MALAM' ? 'backdrop-blur-md' : 'shadow-sm'} transition-all duration-500`}>
        
        {/* Indikator Status (Dot Denyut) */}
        <div className="absolute top-4 right-4 flex h-2 w-2">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${st.line.split(' ')[0].replace('from-', 'bg-')}`}></span>
          <span className={`relative inline-flex rounded-full h-2 w-2 ${st.line.split(' ')[0].replace('from-', 'bg-')}`}></span>
        </div>

        <div className="flex gap-3.5">
          {/* Garis Gradasi Samping */}
          <div className={`w-1 rounded-full bg-gradient-to-b ${st.line} opacity-80`} />

          <div className="flex-1 space-y-1.5">
            {/* Label & Waktu */}
            <div className="flex items-center gap-2">
              <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${st.text}`}>
                {st.label}
              </span>
              {highlight?.created_at && (
                <span className={`text-[9px] font-bold opacity-40 uppercase ${timeTheme?.name === 'MALAM' ? 'text-zinc-500' : 'text-slate-500'}`}>
                  • {formatTimeAgo ? formatTimeAgo(highlight.created_at) : "Baru Saja"}
                </span>
              )}
            </div>

            {/* Isi Konten Utama */}
            <p className={`text-[13px] leading-relaxed font-bold tracking-tight ${st.content}`}>
              {displayContent}
            </p>

            {/* User Tag (Hanya muncul jika ada pengirim asli) */}
            {(highlight?.username || highlight?.user_name) && (
              <div className="flex items-center gap-1.5 pt-1">
                <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] border ${timeTheme?.name === 'MALAM' ? 'bg-white/10 border-white/5' : 'bg-slate-200 border-slate-300'}`}>
                  👤
                </div>
                <span className={`text-[10px] font-bold italic lowercase ${timeTheme?.name === 'MALAM' ? 'text-zinc-500' : 'text-slate-400'}`}>
                  @{highlight.username || highlight.user_name}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Suasana Extra */}
        {suasana?.deskripsi && (
          <div className={`mt-3 pt-2 border-t ${timeTheme?.name === 'MALAM' ? 'border-white/5' : 'border-slate-200/60'} flex items-center gap-2`}>
            <span className="text-[10px]">✨</span>
            <p className={`text-[10px] font-bold italic ${timeTheme?.name === 'MALAM' ? 'text-zinc-500' : 'text-slate-500'}`}>
              {suasana.deskripsi}
            </p>
          </div>
        )}
      </div>

      {/* Glow Effect khusus Malam */}
      {timeTheme?.name === "MALAM" && (
        <div className={`absolute -inset-1 blur-2xl opacity-[0.08] -z-10 rounded-full bg-gradient-to-r ${st.line}`} />
      )}
    </div>
  );
}