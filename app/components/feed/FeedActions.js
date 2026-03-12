"use client";

export default function FeedActions({
  item,
  comments = {},
  openAIModal,
  openKomentarModal,
  onShare,
}) {
  const jumlahKomentar = comments[item.id]?.length || 0;

  return (
    <div className="flex items-center gap-2 pt-4 border-t border-gray-100/60">
      
      {/* TANYA AI - Primary Action */}
      <button
        onClick={() => openAIModal(item)}
        className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 active:scale-95 text-white transition-all duration-200 shadow-md shadow-indigo-100"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
          <path d="M5 3v4M3 5h4M21 17v4M19 19h4"/>
        </svg>
        <span className="text-[13px] font-bold tracking-tight">Tanya AI</span>
      </button>

{/* COCOK - Secondary  Action */}

        <button onClick={handleSesuai} disabled={isSesuai} className={`flex-1 flex flex-col items-center justify-center rounded-2xl border py-2 transition-all ${isSesuai ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400" : "border-white/10 bg-white/5 text-zinc-500 active:bg-white/10"}`}>
          <span className="text-xl">{isSesuai ? "🛡️" : "💛"}</span>
          <span className="text-[8px] font-black uppercase tracking-tighter">{localValidationCount >= 5 ? "Info Valid" : "Cocok"}</span>
        </button>

      {/* KOMENTAR - Third Action */}
      <button
        onClick={() => openKomentarModal(item)}
        className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gray-50 hover:bg-gray-100 active:scale-95 text-gray-700 border border-gray-200/50 transition-all duration-200"
      >
        <div className="relative">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>
          </svg>
          {jumlahKomentar > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white border-2 border-white">
              {jumlahKomentar}
            </span>
          )}
        </div>
        <span className="text-[13px] font-bold tracking-tight text-gray-800">Obrolan</span>
      </button>

      {/* SHARE - Utility Action */}
      <button
        onClick={() => onShare(item)}
        className="flex items-center justify-center w-11 h-11 rounded-xl bg-gray-50 hover:bg-gray-100 active:scale-90 text-gray-500 border border-gray-200/50 transition-all duration-200"
        aria-label="Bagikan"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
        </svg>
      </button>

    </div>
  );
}