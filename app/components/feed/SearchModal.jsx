"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";

// --- Lock body scroll (amankan modal) ---
function useLockBodyScroll(lock) {
  useEffect(() => {
    if (lock) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [lock]);
}

// --- Cache sederhana untuk hasil pencarian (sesi) ---
const searchCache = new Map();

const TRENDING_TOPICS = [
  { term: "Velocity Lebaran 2026", desc: "Sedang tren secara lokal", hot: true },
  { term: "Pasuruan Heritage Street", desc: "Aktivitas tinggi", hot: true },
  { term: "Kopi Kapiten Pasuruan", desc: "Pencarian populer", hot: false },
  { term: "Event Djoglo Kedjajan", desc: "Acara sedang berlangsung", hot: true },
];

export default function SearchModal({
  isOpen,
  onClose,
  onSelectTempat,
  onOpenAIModal, 
  theme,
  locationReady = false,
  villageLocation = "",
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Lock scroll saat modal terbuka
  useLockBodyScroll(isOpen);

  // Load riwayat pencarian dari localStorage
  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem("recent_searches");
      if (saved) {
        try {
          setRecentSearches(JSON.parse(saved));
        } catch (e) {}
      }
      // Fokus langsung
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Voice Search
  const startVoiceSearch = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Browser tidak support Voice Search");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "id-ID";
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (e) => setQuery(e.results[0][0].transcript);
    recognition.start();
  }, []);

  // Simpan riwayat
  const saveSearch = (term) => {
    if (!term.trim()) return;
    const updated = [term, ...recentSearches.filter((s) => s !== term)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem("recent_searches", JSON.stringify(updated));
  };

  const handleSelection = (item) => {
    saveSearch(item.name || query);
    onSelectTempat(item);
    onClose();
  };

  const handleAskAI = () => {
    saveSearch(query);
    if (onOpenAIModal) {
     // Kirim query ke AI modal
      onOpenAIModal(query || "Rekomendasi Setempat");
    }
    onClose();
  };

  // Pencarian ke Supabase dengan caching
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (query.length < 2) {
      setResults([]);
      setError(null);
      return;
    }

    // Cek cache
    const cached = searchCache.get(query);
    if (cached) {
      setResults(cached);
      setIsLoading(false);
      setError(null);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data, error: dbError } = await supabase
          .from("feed_view")
          .select("id, name, category, alamat, photo_url")
          .or(`name.ilike.%${query}%,category.ilike.%${query}%`)
          .limit(10);

        if (dbError) throw dbError;
        const resultsData = data || [];
        searchCache.set(query, resultsData);
        setResults(resultsData);
      } catch (err) {
        console.error("Search error:", err);
        setError("Gagal mencari data. Coba lagi nanti.");
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(searchTimeoutRef.current);
  }, [query]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-start justify-center pt-0 md:pt-20"
        style={{ zIndex: 99999 }}
      >
        <div className="absolute inset-0 z-0" onClick={onClose} />

        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          onClick={(e) => e.stopPropagation()}
          className={`relative z-10 w-full md:max-w-lg flex flex-col overflow-hidden shadow-2xl 
            md:rounded-[32px] md:h-[700px] h-[100dvh] rounded-t-[32px]
            ${theme.isMalam ? "bg-zinc-950 text-white border border-white/10" : "bg-white text-slate-900 border border-slate-200"}`}
        >
          {/* Input area */}
          <div className="px-5 pt-6 pb-4 flex items-center gap-3">
            <button onClick={onClose} className="p-2 -ml-2 opacity-50 hover:opacity-100 transition-opacity">
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
                className={`w-full py-3.5 px-12 rounded-2xl text-sm font-bold outline-none transition-all ${
                  isListening
                    ? "ring-2 ring-[#E3655B] bg-rose-500/5"
                    : theme.isMalam
                    ? "bg-white/5 focus:bg-white/10"
                    : "bg-slate-100 focus:bg-white focus:ring-2 focus:ring-[#E3655B]/20"
                }`}
              />
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#E3655B]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-5 pb-32 scrollbar-hide">
            {!query ? (
              <div className="py-4 space-y-8">
                {/* Riwayat */}
                {recentSearches.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center opacity-30 px-1">
                      <span className="text-[10px] font-black uppercase tracking-widest">Baru Saja</span>
                      <button
                        onClick={() => {
                          setRecentSearches([]);
                          localStorage.removeItem("recent_searches");
                        }}
                        className="text-[9px] font-bold hover:text-red-500"
                      >
                        HAPUS
                      </button>
                    </div>
                    {recentSearches.map((term, i) => (
                      <div
                        key={i}
                        onClick={() => setQuery(term)}
                        className="flex items-center justify-between group cursor-pointer py-1 font-bold text-sm opacity-60 hover:opacity-100 transition-opacity"
                      >
                        <span>🕒 {term}</span>
                        <span className="opacity-0 group-hover:opacity-20 text-xs">✕</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* TRENDING SECTION */}
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-widest opacity-30 px-1">Sedang Tren di Dekatmu</h3>
                    <div className="space-y-2">
                    {TRENDING_TOPICS.map((item, i) => (
                      <div
                        key={i}
                        onClick={() => setQuery(item.term)}
                        className="flex items-start gap-4 p-3 rounded-2xl hover:bg-slate-500/5 cursor-pointer group"
                      >
                        <div
                          className={`w-1.5 h-1.5 rounded-full mt-2 ${
                            item.hot
                              ? "bg-[#E3655B] shadow-[0_0_8px_#E3655B]"
                              : "bg-slate-400"
                          }`}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black group-hover:text-[#E3655B]">
                              {item.term}
                            </span>
                            {item.hot && (
                              <span className="text-[10px] italic font-black text-[#E3655B]">
                                ↗ HOT
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] font-bold opacity-30 uppercase">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-4">
                {error ? (
                  <div className="py-20 text-center text-red-400 text-xs font-bold uppercase">
                    {error}
                  </div>
                ) : isLoading ? (
                  <div className="py-20 text-center font-black italic text-[10px] opacity-20 uppercase tracking-[0.3em] animate-pulse">
                    Menelusuri Area Setempat...
                  </div>
                ) : results.length === 0 ? (
                  <div className="py-20 text-center opacity-30 font-bold text-xs uppercase italic">
                    Tempat tidak ditemukan
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {results.map((item) => (
                      <motion.div
                        key={item.id}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleSelection(item)}
                        className={`group cursor-pointer rounded-2xl overflow-hidden border transition-all ${
                          theme.isMalam
                            ? "bg-white/5 border-white/10"
                            : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <div className="aspect-[4/5] relative bg-slate-500/10">
                          {item.photo_url ? (
                            <img
                              src={item.photo_url}
                              alt={item.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-2xl grayscale opacity-20">
                              📍
                            </div>
                          )}
                          <div className="absolute bottom-2 left-2 px-2 py-1 rounded-lg bg-black/50 backdrop-blur-md text-[9px] font-black text-white uppercase tracking-tighter">
                            {item.category}
                          </div>
                        </div>
                        <div className="p-3">
                          <h4 className="text-[11px] font-[1000] uppercase truncate leading-tight">
                            {item.name}
                          </h4>
                          <p className="text-[9px] font-bold opacity-40 uppercase truncate">
                            {item.alamat?.split(",")[0]}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Floating native bar */}
          <div className="fixed bottom-8 left-0 right-0 flex justify-center px-6 md:hidden z-[5001] pointer-events-none">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className={`pointer-events-auto backdrop-blur-2xl border border-white/20 rounded-full px-7 py-4 shadow-2xl flex items-center gap-8 transition-all ${
                isListening ? "scale-110 ring-4 ring-[#E3655B]/20" : ""
              } ${theme.isMalam ? "bg-zinc-900/90" : "bg-white/90"}`}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startVoiceSearch();
                }}
                className="flex items-center gap-2 text-xs font-[1000] uppercase tracking-tighter"
              >
                <span className={`text-xl ${isListening ? "animate-bounce" : ""}`}>🎙️</span>
                {isListening ? "Listening" : "Suara"}
              </button>
              <div className="w-[1px] h-4 bg-current opacity-10" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAskAI();
                }}
                className="flex items-center gap-2 text-xs font-[1000] uppercase tracking-tighter text-[#E3655B]"
              >
                <span className="text-xl">🤖</span> Tanya AI AKAMSI
              </button>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}