export default function FeedInsight({
  aktivitasUtama,
  testimonialTerbaru,
  medsosTerbaru,
  topExternalComment,
  suasana,
  formatTimeAgo,
  isHujan, // Dari feedEngine
  isRamai  // Dari feedEngine
}) {
  const highlight = aktivitasUtama || testimonialTerbaru || medsosTerbaru || topExternalComment;

  // Menentukan skema warna berdasarkan keadaan (State-based UI)
  const getTheme = () => {
    if (isHujan) return {
      border: "border-blue-200/60",
      bg: "bg-blue-50/40",
      line: "from-blue-400 to-cyan-400",
      text: "text-blue-600",
      label: "Kabare Cuaca"
    };
    if (isRamai) return {
      border: "border-orange-200/60",
      bg: "bg-orange-50/40",
      line: "from-orange-500 to-red-500",
      text: "text-orange-700",
      label: "Lagi Rame Pol"
    };
    return {
      border: "border-slate-100/80",
      bg: "bg-slate-50/50",
      line: "from-indigo-400 to-purple-400",
      text: "text-indigo-600",
      label: "Update Terkini"
    };
  };

  const theme = getTheme();

  if (!highlight && !suasana) return null;

  return (
    <div className="mt-4 relative animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Container Utama dengan Glassmorphism & State Color */}
      <div className={`relative overflow-hidden rounded-2xl p-3 border ${theme.border} ${theme.bg} backdrop-blur-sm transition-colors duration-500`}>
        
        {/* EFEK BERDENYUT (The Pulse) - Menandakan Breaking News */}
        <div className="absolute top-3 right-3 flex h-2 w-2">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isRamai ? 'bg-orange-400' : isHujan ? 'bg-blue-400' : 'bg-indigo-400'}`}></span>
          <span className={`relative inline-flex rounded-full h-2 w-2 ${isRamai ? 'bg-orange-500' : isHujan ? 'bg-blue-500' : 'bg-indigo-500'}`}></span>
        </div>

        <div className="flex gap-3">
          {/* Garis Indikator Dinamis */}
          <div className={`w-1.5 rounded-full bg-gradient-to-b ${theme.line} shadow-sm`} />

          <div className="flex-1 space-y-1">
            {/* Label Status & Waktu */}
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-black uppercase tracking-widest ${theme.text}`}>
                {theme.label}
              </span>
              {highlight?.created_at && (
                <span className="text-[10px] text-slate-400 font-medium">
                  • {formatTimeAgo(highlight.created_at)}
                </span>
              )}
            </div>

            {/* Isi Berita / Insight */}
            <p className="text-[13px] leading-relaxed text-slate-800 font-semibold tracking-tight">
              {highlight?.content || highlight?.text || highlight?.deskripsi || highlight?.konten}
            </p>

            {/* Identitas Pengirim (Jika ada) */}
            {(highlight?.username || highlight?.user_name) && (
              <div className="flex items-center gap-1.5 pt-1">
                <div className="w-4 h-4 rounded-full bg-white/80 border border-slate-100 flex items-center justify-center text-[8px]">
                  👤
                </div>
                <span className="text-[11px] text-slate-500 font-medium">
                  @{highlight.username || highlight.user_name}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Suasana Tambahan di Bawah */}
        {suasana && (
          <div className="mt-2 pt-2 border-t border-slate-200/30 flex items-center gap-2">
            <span className="animate-pulse">✨</span>
            <p className="text-[11px] text-slate-600 font-medium italic">
              {suasana.deskripsi}
            </p>
          </div>
        )}
      </div>

      {/* Decorative Glow di belakang card */}
      <div className={`absolute -inset-1 blur-2xl opacity-10 -z-10 rounded-full bg-gradient-to-r ${theme.line}`} />
    </div>
  );
}