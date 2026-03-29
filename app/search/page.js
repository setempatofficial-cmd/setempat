"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";

// IMPORT PROVIDER & HOOKS
import LocationProvider, { useLocation } from "@/components/LocationProvider";
import { useTheme } from "@/app/hooks/useTheme";

// IMPORT FeedCard
import FeedCard from "@/app/components/feed/FeedCard";

// IMPORT Modal Components
import AIModal from "@/app/components/feed/AIModal";
import KomentarModal from "@/app/components/feed/KomentarModal";

// 1. KOMPONEN KONTEN UTAMA
function SearchContent() {
  const router = useRouter();
  const { theme, isMalam, isSore } = useTheme();
  const { location, status: locationStatus, placeName } = useLocation();

  const [query, setQuery] = useState("");
  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recentSearches, setRecentSearches] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [comments, setComments] = useState({});
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState({});
  
  // State untuk modal
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isKomentarModalOpen, setIsKomentarModalOpen] = useState(false);
  const [selectedForAI, setSelectedForAI] = useState(null);
  const [selectedForKomentar, setSelectedForKomentar] = useState(null);
  const [aiResponse, setAiResponse] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Load Data & History
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log("Fetching feed data...");
        
        const { data, error: supabaseError } = await supabase
          .from("feed_view")
          .select("id, name, photos, alamat, category")
          .order("name", { ascending: true });
        
        if (supabaseError) {
          console.error("Supabase error details:", supabaseError);
          throw new Error(`Database error: ${supabaseError.message}`);
        }
        
        if (!data || data.length === 0) {
          console.warn("No data received from Supabase");
          setAllData([]);
        } else {
          console.log(`Successfully fetched ${data.length} items`);
          setAllData(data);
        }
        
      } catch (err) {
        console.error("Fetch error details:", err);
        
        let errorMessage = "Gagal memuat data. ";
        if (err.message.includes("connection")) {
          errorMessage += "Periksa koneksi internet Anda.";
        } else if (err.message.includes("permission")) {
          errorMessage += "Anda tidak memiliki izin untuk mengakses data.";
        } else {
          errorMessage += err.message || "Terjadi kesalahan tidak dikenal.";
        }
        
        setError(errorMessage);
        setAllData([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  // Load recent searches dari localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("recent_searches");
      if (saved) {
        const parsed = JSON.parse(saved);
        setRecentSearches(Array.isArray(parsed) ? parsed : []);
      }
    } catch (e) {
      console.error("Error loading recent searches:", e);
      setRecentSearches([]);
    }
  }, []);

  // Voice Search Logic
  const startVoiceSearch = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setVoiceError("Browser tidak mendukung Voice Search. Gunakan Chrome, Safari, atau Edge terbaru.");
      setTimeout(() => setVoiceError(null), 3000);
      return;
    }
    
    setVoiceError(null);
    
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "id-ID";
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      
      recognition.onstart = () => {
        setIsListening(true);
      };
      
      recognition.onend = () => {
        setIsListening(false);
      };
      
      recognition.onresult = (event) => {
        if (event.results && event.results[0]) {
          const transcript = event.results[0][0].transcript;
          setQuery(transcript);
          setVoiceError(null);
        }
      };
      
      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        
        switch(event.error) {
          case 'not-allowed':
            setVoiceError("Izin mikrofon ditolak. Izinkan akses mikrofon untuk menggunakan fitur ini.");
            break;
          case 'no-speech':
            setVoiceError("Tidak ada suara terdeteksi. Coba lagi dan pastikan mikrofon aktif.");
            break;
          case 'audio-capture':
            setVoiceError("Mikrofon tidak terdeteksi. Periksa koneksi mikrofon Anda.");
            break;
          default:
            setVoiceError(`Gagal memulai voice search. Coba lagi.`);
        }
        
        setIsListening(false);
        setTimeout(() => setVoiceError(null), 3000);
      };
      
      recognition.start();
    } catch (err) {
      console.error("Error starting speech recognition:", err);
      setVoiceError("Gagal memulai voice search. Silakan coba lagi.");
      setIsListening(false);
      setTimeout(() => setVoiceError(null), 3000);
    }
  }, []);

  // Filter Search
  const results = useMemo(() => {
    if (query.trim().length < 1) return [];
    const searchTerm = query.toLowerCase().trim();
    return allData
      .filter(item => {
        if (!item) return false;
        return (
          item.name?.toLowerCase().includes(searchTerm) || 
          item.category?.toLowerCase().includes(searchTerm) ||
          item.alamat?.toLowerCase().includes(searchTerm)
        );
      })
      .slice(0, 16);
  }, [query, allData]);

  // Handle ketika item dipilih
  const handleSelect = (item) => {
    if (!item) return;
    
    const term = item.name;
    const updated = [term, ...recentSearches.filter(s => s !== term)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem("recent_searches", JSON.stringify(updated));
    
    setSelectedItem(item);
    setSelectedPhotoIndex({ [item.id]: 0 });
    // Hapus scroll to top agar user tetap melihat konteks
    // window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearHistory = () => {
    setRecentSearches([]);
    localStorage.removeItem("recent_searches");
  };

  // Handle functions untuk FeedCard
  const handleOpenAIModal = useCallback(async (item, onUploadSuccess) => {
    setSelectedForAI(item);
    setIsAIModalOpen(true);
    setIsAiLoading(true);
    setAiResponse("");
    
    // Simulasi AI response
    setTimeout(() => {
      const response = `📊 **Analisis ${item.name}**\n\n` +
        `📍 **Lokasi:** ${item.alamat || "Area Setempat"}\n` +
        `🏷️ **Kategori:** ${item.category || "Tempat Umum"}\n\n` +
        `✨ **Rekomendasi:**\n` +
        `• Waktu terbaik berkunjung: Pagi hingga sore hari\n` +
        `• Aktivitas populer: Berinteraksi dengan warga sekitar\n` +
        `• Tips: Jaga kebersihan lingkungan\n\n` +
        `💡 **Insight:** Tempat ini aktif dikunjungi warga sekitar. Cocok untuk berinteraksi dan mendapatkan informasi terkini tentang kegiatan setempat.`;
      
      setAiResponse(response);
      setIsAiLoading(false);
    }, 1500);
  }, []);

  const handleOpenKomentarModal = useCallback((item) => {
    setSelectedForKomentar(item);
    setIsKomentarModalOpen(true);
  }, []);

  const handleShare = useCallback((item) => {
    if (navigator.share) {
      navigator.share({
        title: item.name,
        text: `Lihat ${item.name} di Setempat`,
        url: window.location.href,
      }).catch(err => console.log("Share cancelled:", err));
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert("Link telah disalin ke clipboard!");
    }
  }, []);

  const getBackgroundColor = () => {
    if (isMalam) return "bg-[#09090b]";
    if (isSore) return "bg-[#fff5f0]";
    return "bg-white";
  };

  const getBorderColor = () => {
    if (isMalam) return "border-white/[0.03]";
    return "border-black/[0.03]";
  };

  const locationReady = locationStatus === "granted" && location !== null;

  // Tampilkan loading
  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${getBackgroundColor()}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E3655B] mx-auto"></div>
          <p className="mt-4 text-sm opacity-60">Memuat data...</p>
        </div>
      </div>
    );
  }

  // Tampilkan error jika ada
  if (error) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${getBackgroundColor()}`}>
        <div className="text-center max-w-sm mx-auto p-6">
          <div className="text-5xl mb-4">⚠️</div>
          <h3 className="text-lg font-bold mb-2">Gagal Memuat Data</h3>
          <p className="text-sm opacity-70 mb-4">{error}</p>
          <div className="space-y-2">
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-[#E3655B] text-white rounded-xl text-sm font-bold"
            >
              Coba Lagi
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <main className={`min-h-screen transition-colors duration-1000 ${getBackgroundColor()}`}>
        <div className={`max-w-md mx-auto min-h-screen flex flex-col relative border-x ${getBorderColor()}`}>
          {/* HEADER PENCARIAN - SELALU TAMPIL */}
          <div className={`sticky top-0 z-50 px-4 py-3 backdrop-blur-3xl border-b transition-all duration-700 ${
            isMalam ? "bg-black/60 border-white/[0.05]" : "bg-white/60 border-black/[0.03]"
          }`}>
            <div className="flex items-center gap-2">
              <motion.button 
                whileTap={{ scale: 0.9 }}
                onClick={() => router.back()}
                className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all ${
                  isMalam ? "bg-white/[0.03] border-white/10 text-white" : "bg-black/[0.02] border-black/5 text-slate-900"
                }`}
                aria-label="Kembali"
              >
                <svg className="w-5 h-5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                </svg>
              </motion.button>

              <div className="flex-1 relative">
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={isListening ? "Mendengarkan..." : "Cari di Setempat..."}
                  className={`w-full py-2.5 pl-4 pr-10 rounded-xl text-sm font-bold outline-none border transition-all ${
                    isMalam 
                      ? "bg-white/[0.03] border-white/10 text-white focus:border-[#E3655B]/50 placeholder:text-white/20" 
                      : "bg-black/[0.02] border-black/5 text-slate-900 focus:border-[#E3655B]/50 placeholder:text-black/20"
                  }`}
                />
                <button 
                  onClick={startVoiceSearch}
                  disabled={isListening}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 transition-all ${
                    isListening 
                      ? "text-red-500 scale-110 animate-pulse" 
                      : "opacity-40 hover:opacity-100"
                  }`}
                  aria-label="Pencarian suara"
                >
                  <span className="text-sm">🎙️</span>
                </button>
              </div>
            </div>
            
            <AnimatePresence>
              {voiceError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-2 text-xs text-red-500 bg-red-500/10 px-3 py-2 rounded-lg"
                >
                  {voiceError}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* CONTENT AREA */}
          <div className="flex-1 px-4 py-6">
            <AnimatePresence mode="wait">
              {selectedItem ? (
                <motion.div
                  key="feedcard"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="pb-20"
                >
                  <FeedCard
                    item={selectedItem}
                    locationReady={locationReady}
                    location={location}
                    displayLocation={placeName}
                    tempat={[selectedItem]}
                    comments={comments}
                    selectedPhotoIndex={selectedPhotoIndex}
                    setSelectedPhotoIndex={setSelectedPhotoIndex}
                    openAIModal={handleOpenAIModal}
                    openKomentarModal={handleOpenKomentarModal}
                    onShare={handleShare}
                  />
                  
                  {/* Tampilkan SEMUA hasil pencarian lainnya di bawah FeedCard */}
{results.filter(item => item.id !== selectedItem.id).length > 0 && (
  <div className="mt-8">
    <h3 className={`text-[11px] font-black uppercase tracking-wider mb-4 ${
      isMalam ? "text-white/40" : "text-slate-400"
    }`}>
      HASIL TERKAIT LAINNYA ({results.filter(item => item.id !== selectedItem.id).length})
    </h3>
    <div className="grid grid-cols-2 gap-3">
      {results
        .filter(item => item.id !== selectedItem.id)
        .map((item) => (
          <motion.button
            key={item.id}
            onClick={() => handleSelect(item)}
            whileTap={{ scale: 0.98 }}
            className={`flex flex-col text-left rounded-2xl overflow-hidden border transition-all ${
              isMalam ? "bg-white/[0.03] border-white/10 hover:bg-white/10" : "bg-black/[0.02] border-black/5 hover:bg-black/10"
            }`}
          >
            <div className="aspect-[16/10] bg-zinc-900 relative">
              {item.photos?.[0] ? (
                <img 
                  src={item.photos[0]} 
                  className="w-full h-full object-cover" 
                  alt={item.name || "Tempat"}
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center opacity-10 text-xl">📍</div>
              )}
            </div>
            <div className={`p-3 ${isMalam ? "text-white" : "text-slate-900"}`}>
              <h4 className="text-[11px] font-black uppercase truncate tracking-tight leading-tight">
                {item.name || "Tidak ada nama"}
              </h4>
              <p className="text-[9px] font-bold opacity-30 uppercase truncate mt-0.5 tracking-wider">
                {item.category || "Tempat"}
              </p>
            </div>
          </motion.button>
        ))}
    </div>
  </div>
)}
                </motion.div>
              ) : query.length > 0 ? (
                <motion.div 
                  key="results"
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-2 gap-3 pb-20"
                >
                  {results.length > 0 ? (
                    results.map((item) => (
                      <motion.button
                        key={item.id}
                        onClick={() => handleSelect(item)}
                        whileTap={{ scale: 0.98 }}
                        className={`flex flex-col text-left rounded-2xl overflow-hidden border transition-all ${
                          isMalam ? "bg-white/[0.03] border-white/10" : "bg-black/[0.02] border-black/5"
                        }`}
                      >
                        <div className="aspect-[16/10] bg-zinc-900 relative">
                          {item.photos?.[0] ? (
                            <img 
                              src={item.photos[0]} 
                              className="w-full h-full object-cover" 
                              alt={item.name || "Tempat"}
                              loading="lazy"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.parentElement.innerHTML = '<div class="w-full h-full flex items-center justify-center opacity-10 text-xl">📍</div>';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center opacity-10 text-xl">📍</div>
                          )}
                        </div>
                        <div className={`p-3 ${isMalam ? "text-white" : "text-slate-900"}`}>
                          <h4 className="text-[11px] font-black uppercase truncate tracking-tight leading-tight">
                            {item.name || "Tidak ada nama"}
                          </h4>
                          <p className="text-[9px] font-bold opacity-30 uppercase truncate mt-0.5 tracking-wider">
                            {item.category || "Tempat"}
                          </p>
                        </div>
                      </motion.button>
                    ))
                  ) : (
                    <div className="col-span-2 text-center py-12">
                      <p className="text-sm opacity-60">Tidak ada hasil untuk "{query}"</p>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div 
                  key="empty"
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  className="space-y-8"
                >
                  {recentSearches.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className={`text-[9px] font-black uppercase tracking-[0.2em] opacity-30 ${isMalam ? "text-white" : "text-slate-900"}`}>
                          Terakhir Dicari
                        </h3>
                        <button 
                          onClick={clearHistory} 
                          className="text-[9px] font-black uppercase text-red-500/50 hover:text-red-500 transition-colors"
                        >
                          Hapus
                        </button>
                      </div>
                      <div className="flex flex-col gap-1">
                        {recentSearches.map((term, i) => (
                          <button 
                            key={i}
                            onClick={() => setQuery(term)}
                            className={`flex items-center gap-3 py-3 px-4 rounded-xl text-[12px] font-bold transition-all text-left ${
                              isMalam ? "text-white hover:bg-white/5" : "text-slate-900 hover:bg-black/5"
                            }`}
                          >
                            <span className="opacity-30 text-xs">🕒</span> 
                            <span className="truncate">{term}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <h3 className={`text-[9px] font-black uppercase tracking-[0.2em] opacity-30 ${isMalam ? "text-white" : "text-slate-900"}`}>
                      Populer di sekitarmu
                    </h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {['Kondisi Warung Kopi', 'Keramaian Wisata', 'Bakso', 'Suasana Prigen', 'Arus Lalin Bangil', 'Antrian Taman Safari'].map(tag => (
                        <button 
                          key={tag}
                          onClick={() => setQuery(tag)}
                          className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                            isMalam 
                              ? "bg-white/5 border-white/10 text-white hover:bg-white/10" 
                              : "bg-black/5 border-black/5 text-slate-900 hover:bg-black/10"
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* AI Modal */}
      <AIModal 
        isOpen={isAIModalOpen} 
        onClose={() => setIsAIModalOpen(false)} 
        tempat={selectedForAI}
        context="Pencarian"
        item={selectedForAI}
        aiResponse={aiResponse}
        isLoading={isAiLoading}
      />

      {/* Komentar Modal */}
      <KomentarModal 
        isOpen={isKomentarModalOpen} 
        onClose={() => setIsKomentarModalOpen(false)} 
        tempat={selectedForKomentar} 
        isAdmin={false} 
      />
    </>
  );
}

export default function SearchPage() {
  return (
    <LocationProvider>
      <SearchContent />
    </LocationProvider>
  );
}