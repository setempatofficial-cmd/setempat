"use client";

export default function FeedActions({
  item,
  comments = {},
  openAIModal,
  openKomentarModal,
  onShare,
  handleSesuai,
  isSesuai,
}) {
  const jumlahKomentar = comments[item?.id]?.length || 0;

  return (
    <div className="flex items-center gap-2 pt-4 border-t border-white/[0.05]">
      
      {/* TANYA AI - Utama */}
{/* BUTTON TANYA AI - The Master Key */}
<button
  onClick={() => openAIModal(item)}
  className="relative flex-[2.5] group overflow-hidden py-4 rounded-2xl bg-zinc-900 border border-white/10 transition-all duration-500 active:scale-95 shadow-[0_0_20px_rgba(0,0,0,0.3)]"
>
  {/* Efek Cahaya Latar (Glow Layer) */}
  <div className="absolute inset-0 bg-gradient-to-r from-violet-600/20 via-indigo-600/20 to-cyan-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
  
  {/* Efek Garis Kilat (Shimmer Line) */}
  <div className="absolute inset-0 w-[200%] bg-gradient-to-r from-transparent via-white/[0.05] to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite] pointer-events-none" />

  <div className="relative flex items-center justify-center gap-3">
    {/* Icon AI dengan Glow kecil */}
    <div className="relative">
      <span className="text-lg">✨</span>
      <div className="absolute inset-0 blur-sm bg-violet-400/50 animate-pulse" />
    </div>
    
    <div className="flex flex-col items-start leading-none">
      <span className="text-[11px] font-black uppercase tracking-[0.15em] text-white">
        Tanya AI
      </span>
      <span className="text-[7px] font-medium uppercase tracking-widest text-zinc-500 mt-1 group-hover:text-violet-400 transition-colors">
        Wawasan Setempat
      </span>
    </div>
  </div>
</button>

      {/* PENGESAHAN - Perisai Solid */}
      <button 
        onClick={handleSesuai} 
        disabled={isSesuai} 
        className={`flex-1 flex flex-col items-center justify-center rounded-2xl border py-2 transition-colors duration-300 ${
          isSesuai 
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" 
            : "border-white/10 bg-white/5 text-zinc-500 active:bg-white/10"
        }`}
      >
        <span className={`text-xl mb-1 ${isSesuai ? "opacity-100" : "opacity-30"}`}>
          🛡️
        </span>
        <span className="text-[8px] font-black uppercase tracking-tighter">
          {isSesuai ? "Disahkan" : "Sahkan?"}
        </span>
      </button>

      {/* KOMENTAR */}
      <button
        onClick={() => openKomentarModal(item)}
        className="relative flex-1 flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5 py-2 text-zinc-500 active:bg-white/10 transition-all"
      >
        {jumlahKomentar > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[8px] font-black text-white">
            {jumlahKomentar}
          </span>
        )}
        <span className="text-xl mb-1 opacity-30">💬</span>
        <span className="text-[8px] font-black uppercase tracking-tighter">Ngobrol</span>
      </button>

      {/* SHARE */}
      <button 
        onClick={() => onShare(item)} 
        className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-zinc-500 active:scale-90 transition-all"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
        </svg>
      </button>
    </div>
  );
}