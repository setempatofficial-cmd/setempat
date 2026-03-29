"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

function useLockBodyScroll(lock) {
  useEffect(() => {
    if (lock) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = original; };
    }
  }, [lock]);
}

export default function SearchModal({
  isOpen,
  onClose,
  onSelectTempat,
  onOpenAIModal, 
  theme,
  allData = [],
}) {
  const [query, setQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const inputRef = useRef(null);

  useLockBodyScroll(isOpen);

  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem("recent_searches");
      if (saved) { try { setRecentSearches(JSON.parse(saved)); } catch (e) {} }
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const results = useMemo(() => {
    if (query.length < 2) return [];
    const searchLow = query.toLowerCase();
    return allData.filter(item => 
      item.name?.toLowerCase().includes(searchLow) || 
      item.category?.toLowerCase().includes(searchLow) ||
      item.alamat?.toLowerCase().includes(searchLow)
    ).slice(0, 10);
  }, [query, allData]);

  const handleSelection = (item) => {
    // Jalankan fungsi seleksi
    onSelectTempat(item);
    
    // Simpan history
    const term = item.name;
    const updated = [term, ...recentSearches.filter((s) => s !== term)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem("recent_searches", JSON.stringify(updated));
    
    // Tutup modal dengan sedikit delay agar state di parent sempat ter-update
    setTimeout(onClose, 50);
  };

  const startVoiceSearch = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Browser tidak support Voice Search");
    const recognition = new SpeechRecognition();
    recognition.lang = "id-ID";
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (e) => setQuery(e.results[0][0].transcript);
    recognition.start();
  }, []);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/90 backdrop-blur-2xl flex items-start justify-center z-[99999]"
      >
        {/* Overlay penutup - Pastikan ini di belakang (z-0) */}
        <div className="absolute inset-0 z-0" onClick={onClose} />

        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          onClick={(e) => e.stopPropagation()} // Mencegah klik di dalam modal menutup modal
          className={`relative z-10 w-full md:max-w-lg flex flex-col overflow-hidden shadow-2xl h-[100dvh] md:h-[750px] md:mt-10 rounded-t-[32px] md:rounded-[32px] ${
            theme.isMalam ? "bg-zinc-950 text-white border-t border-white/10" : "bg-white text-slate-900"
          }`}
        >
          {/* Header */}
          <div className="px-5 pt-8 pb-4 flex items-center gap-3">
            <button onClick={onClose} className="p-2 opacity-50 hover:opacity-100">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isListening ? "Mendengarkan..." : "Cari di Setempat..."}
                className={`w-full py-4 px-12 rounded-2xl text-sm font-bold outline-none ${
                  theme.isMalam ? "bg-white/5" : "bg-slate-100"
                }`}
              />
            </div>
          </div>

          {/* Results Area - Kunci utama: z-20 dan overflow-y-auto */}
          <div className="flex-1 overflow-y-auto px-5 pb-40 z-20 relative scrollbar-hide">
            {!query ? (
              <div className="py-4 flex flex-wrap gap-2">
                {recentSearches.map((term, i) => (
                  <button 
                    key={i} 
                    onClick={() => setQuery(term)}
                    className={`px-4 py-2 rounded-full text-xs font-bold ${theme.isMalam ? "bg-white/5" : "bg-slate-100"}`}
                  >
                    🕒 {term}
                  </button>
                ))}
              </div>
            ) : (
              <div className="py-4">
                {results.length === 0 ? (
                  <div className="py-20 text-center opacity-30 text-xs uppercase font-bold">Tidak ditemukan</div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {results.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleSelection(item);
                        }}
                        className={`group flex flex-col text-left rounded-2xl overflow-hidden border transition-all active:scale-95 ${
                          theme.isMalam ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <div className="aspect-[4/5] w-full relative bg-slate-500/10">
                          {item.photos?.[0] ? (
                            <img src={item.photos[0]} className="w-full h-full object-cover" alt={item.name} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center opacity-20 text-2xl">📍</div>
                          )}
                        </div>
                        <div className="p-3">
                          <h4 className="text-[11px] font-black uppercase truncate">{item.name}</h4>
                          <p className="text-[9px] font-bold opacity-40 uppercase truncate">{item.alamat?.split(",")[0]}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div className="absolute bottom-10 left-0 right-0 flex justify-center px-6 z-30 pointer-events-none">
            <div className="pointer-events-auto backdrop-blur-3xl border border-white/20 rounded-full px-7 py-4 shadow-2xl flex items-center gap-8 bg-zinc-900/95 text-white">
              <button onClick={startVoiceSearch} className="flex items-center gap-2 text-[10px] font-black uppercase">
                <span className="text-xl">🎙️</span> Suara
              </button>
              <div className="w-[1px] h-4 bg-white/10" />
              <button onClick={() => { onOpenAIModal(query || "Rekomendasi"); onClose(); }} className="flex items-center gap-2 text-[10px] font-black uppercase text-[#E3655B]">
                <span className="text-xl">🤖</span> AI
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}