"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useMemo } from "react";

export default function AIIntelModal({ isOpen, onClose, item, theme, signals, laporanWarga, locationName }) {
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [intelSummary, setIntelSummary] = useState("");

  // --- LOGIC: ANALISIS DATA REALTIME ---
  const analysis = useMemo(() => {
    if (!isOpen) return null;
    
    // 1. Hitung dominasi sinyal (Misal: Berapa banyak sinyal 'Macet' vs 'Lancar')
    const totalSignals = signals.length;
    const positiveSignals = signals.filter(s => s.type === 'positive' || s.vibe === 'aman').length;
    const alertSignals = signals.filter(s => s.type === 'alert' || s.vibe === 'bahaya').length;
    
    // 2. Ambil poin laporan terbaru dari warga (Supabase)
    const lastReport = laporanWarga?.[0]?.content || "Tidak ada laporan teks terbaru.";
    
    return {
      confidence: totalSignals > 0 ? Math.round((positiveSignals / totalSignals) * 100) : 50,
      hasAlert: alertSignals > 0,
      recentContext: lastReport
    };
  }, [isOpen, signals, laporanWarga]);

  // --- EFFECT: TYPEWRITER SGE EFFECT ---
  useEffect(() => {
    if (isOpen && analysis) {
      setIsAnalyzing(true);
      
      // panggil Groq API dengan Prompt: 
      // "Ringkas data ini: ${JSON.stringify(signals)} dan laporan: ${analysis.recentContext}"
      
      const timer = setTimeout(() => {
        const summary = `Analisis Sistem: ${item.name} saat ini menunjukkan tingkat kondusivitas ${analysis.confidence}%. ` +
          `${analysis.hasAlert ? '⚠️ Terdeteksi gangguan di sekitar lokasi.' : '✅ Arus terpantau normal.'} ` +
          `Laporan warga terakhir menyebutkan: "${analysis.recentContext.slice(0, 100)}...". ` +
          `Rekomendasi: ${item.status === 'hujan' ? 'Sedia payung sebelum merapat.' : 'Waktu terbaik untuk berkunjung.'}`;
        
        setIntelSummary(summary);
        setIsAnalyzing(false);
      }, 1200);

      return () => clearTimeout(timer);
    }
  }, [isOpen, analysis, item.name, item.status]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-end justify-center p-0">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-md" />

        <motion.div
          initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className={`relative w-full max-w-xl ${theme.card} border-t ${theme.border} rounded-t-[40px] flex flex-col max-h-[90vh] shadow-2xl overflow-hidden`}
        >
          {/* DRAG HANDLE */}
          <div className="w-full flex justify-center py-4"><div className="w-12 h-1 bg-white/20 rounded-full" /></div>

          <div className="flex-1 overflow-y-auto px-7 pb-24">
            {/* HEADER INTEL */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${theme.accent}`}>Live Intelligence Report</span>
              </div>
              <h2 className={`text-2xl font-[1000] italic uppercase leading-none ${theme.text}`}>{item.name}</h2>
              <p className={`text-[10px] font-bold opacity-40 uppercase mt-2 tracking-wide`}>📍 {locationName}</p>
            </div>

            {/* GRID DATA (REAL SIGNALS) */}
            <div className="grid grid-cols-2 gap-3 mb-8">
               <div className={`${theme.statusBg} p-4 rounded-3xl border ${theme.border}`}>
                  <p className="text-[8px] font-black opacity-30 uppercase mb-2">Confidence Score</p>
                  <div className="flex items-end gap-2">
                    <span className={`text-2xl font-[1000] ${theme.text}`}>{analysis?.confidence}%</span>
                    <span className="text-[10px] font-bold text-emerald-500 mb-1">Reliable</span>
                  </div>
               </div>
               <div className={`${theme.statusBg} p-4 rounded-3xl border ${theme.border}`}>
                  <p className="text-[8px] font-black opacity-30 uppercase mb-2">Active Signals</p>
                  <div className="flex items-end gap-2">
                    <span className={`text-2xl font-[1000] ${theme.text}`}>{signals.length}</span>
                    <span className="text-[10px] font-bold opacity-50 mb-1">Warga</span>
                  </div>
               </div>
            </div>

            {/* THE AI INSIGHT (CONNECTED DATA) */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  {[1,2,3].map(i => <div key={i} className="w-6 h-6 rounded-full border-2 border-black bg-gray-800" />)}
                </div>
                <span className={`text-[10px] font-black uppercase opacity-50`}>AI & 32 Warga Menganalisis...</span>
              </div>

              <div className={`p-6 rounded-[32px] ${theme.isMalam ? 'bg-white/5' : 'bg-black/5'} border ${theme.border} relative overflow-hidden`}>
                {isAnalyzing ? (
                  <div className="space-y-3">
                    <div className="h-4 bg-white/10 rounded-full animate-pulse w-full" />
                    <div className="h-4 bg-white/10 rounded-full animate-pulse w-[90%]" />
                    <div className="h-4 bg-white/10 rounded-full animate-pulse w-[70%]" />
                  </div>
                ) : (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`text-[15px] font-medium leading-relaxed ${theme.text}`}>
                    {intelSummary}
                  </motion.p>
                )}
              </div>
            </div>
          </div>

          {/* FLOATING CHAT INPUT */}
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent backdrop-blur-md">
            <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
               {["Cek parkir", "Aman dari razia?", "Cuaca detail"].map(tag => (
                 <button key={tag} className="px-4 py-2 rounded-full bg-white/10 border border-white/10 text-[10px] font-bold text-white whitespace-nowrap uppercase">
                   {tag}
                 </button>
               ))}
            </div>
            <div className="relative group">
              <input 
                type="text" 
                placeholder={`Tanya Akamsi AI tentang ${item.name}...`}
                className={`w-full bg-white/10 border border-white/20 rounded-2xl py-4 px-6 pr-14 text-sm font-bold text-white placeholder:opacity-30 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all`}
              />
              <button className="absolute right-2 top-2 p-2.5 bg-emerald-500 rounded-xl text-white shadow-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}