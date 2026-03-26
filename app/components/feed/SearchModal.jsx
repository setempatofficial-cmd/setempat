"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabaseClient";

// ── Debounced search ke Supabase ──────────────────────────────────────────────
function useSearchResults(query) {
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const q = query?.trim();
    if (!q || q.length < 2) { setResults([]); return; }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const { data } = await supabase
          .from("feed_view")
          .select("id, name, category, alamat, photos")
          .or(`name.ilike.%${q}%,category.ilike.%${q}%,alamat.ilike.%${q}%`)
          .limit(10)
          .abortSignal(controller.signal);
        setResults(data || []);
      } catch (_) {}
      finally { setIsLoading(false); }
    }, 400);

    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  return { results, isLoading };
}

// ── SearchModal ───────────────────────────────────────────────────────────────
export default function SearchModal({ isOpen, onClose, onSelectTempat }) {
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef(null);
  const { results, isLoading } = useSearchResults(query);

  useEffect(() => { setMounted(true); return () => setMounted(false); }, []);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      // Focus input setelah animasi
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Back button Android
  useEffect(() => {
    if (!isOpen) return;
    window.history.pushState({ searchModal: true }, "");
    const handlePop = () => onClose();
    window.addEventListener("popstate", handlePop);
    return () => {
      window.removeEventListener("popstate", handlePop);
      if (window.history.state?.searchModal) window.history.go(-1);
    };
  }, [isOpen, onClose]);

  const handleSelect = (item) => {
    onClose();
    // Delay agar modal close dulu, baru AIModal buka
    setTimeout(() => onSelectTempat(item), 200);
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[3000] flex flex-col"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
        >
          {/* Tap backdrop untuk tutup */}
          <div className="absolute inset-0" onClick={onClose} />

          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="relative z-10 mx-4 mt-16 rounded-[24px] overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Search input */}
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-[24px] overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3.5">
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin flex-shrink-0" />
                ) : (
                  <svg className="w-5 h-5 text-white/60 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                )}
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Cari tempat, kategori, atau area..."
                  className="flex-1 bg-transparent text-white text-[15px] font-medium placeholder:text-white/40 focus:outline-none"
                  autoComplete="off"
                />
                {query.length > 0 ? (
                  <button onClick={() => setQuery("")}
                    className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0"
                  >
                    <span className="text-white/70 text-sm">✕</span>
                  </button>
                ) : (
                  <button onClick={onClose}
                    className="text-white/50 text-[12px] font-bold uppercase tracking-wider"
                  >
                    Batal
                  </button>
                )}
              </div>

              {/* Hasil pencarian */}
              <AnimatePresence>
                {results.length > 0 && (
                  <motion.div
                    initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                    className="overflow-hidden border-t border-white/10"
                  >
                    <div className="max-h-[60vh] overflow-y-auto py-1">
                      {results.map((item, i) => {
                        const foto = Array.isArray(item.photos) && item.photos[0];
                        return (
                          <motion.button
                            key={item.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.04 }}
                            onClick={() => handleSelect(item)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/10 active:bg-white/15 transition-colors text-left"
                          >
                            {/* Thumbnail */}
                            <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/10 flex-shrink-0">
                              {foto ? (
                                <img src={foto} className="w-full h-full object-cover" alt={item.name} />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-lg">📍</div>
                              )}
                            </div>
                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-[14px] font-bold text-white truncate">{item.name}</p>
                              <p className="text-[11px] text-white/50 truncate">
                                {item.category && <span className="text-cyan-400">{item.category}</span>}
                                {item.category && item.alamat && " · "}
                                {item.alamat?.split(",")[0]}
                              </p>
                            </div>
                            {/* Arrow */}
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <span className="text-[10px] font-black text-white/30 uppercase tracking-wider">Tanya AI</span>
                              <svg className="w-4 h-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Empty state */}
              {query.length >= 2 && !isLoading && results.length === 0 && (
                <div className="px-4 py-6 text-center border-t border-white/10">
                  <p className="text-white/40 text-[13px]">Tidak ditemukan untuk "{query}"</p>
                  <p className="text-white/25 text-[11px] mt-1">Coba kata kunci lain</p>
                </div>
              )}

              {/* Hint saat kosong */}
              {query.length === 0 && (
                <div className="px-4 py-4 border-t border-white/10">
                  <p className="text-white/30 text-[11px] text-center">
                    Ketik nama tempat, kategori, atau area untuk mencari
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
