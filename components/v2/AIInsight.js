"use client";

import { useState, useEffect } from "react";

export default function AIInsight({ activeTempat, theme }) {
  const [displayText, setDisplayText] = useState("");
  
  // Logic data (tetap sama, hanya pembersihan sedikit)
  const reportCount = activeTempat?.laporan_terbaru?.length || 0;
  const isViral = activeTempat?.isViral;
  const isRamai = activeTempat?.isRamai;
  const vibeCount = activeTempat?.vibe_count || 0;
  const viewingCount = activeTempat?.viewingCount || 0;
  const hasRecentReport = activeTempat?.hasRecentWargaReport;
  const latestReport = activeTempat?.recentWargaLaporan;

  // Tentukan teks insight
  const getInsight = () => {
    if (isViral) return `⚠️ **${activeTempat.name}** sedang VIRAL! **${viewingCount}** orang memantau. Warga melaporkan situasi yang sangat intens di sini.`;
    if (isRamai) return `🔥 Aktivitas di **${activeTempat.name}** meningkat pesat. Terdeteksi **${viewingCount}** pemantau dengan **${vibeCount}** saksi mata di lokasi.`;
    if (hasRecentReport && latestReport) return `📢 Laporan terbaru warga: "${latestReport.text?.substring(0, 60)}..." Segera cek detail update di bawah.`;
    if (reportCount > 3) return `📊 Terpantau **${reportCount}** laporan masuk dalam waktu singkat. Kondisi di **${activeTempat.name}** memerlukan perhatian lebih.`;
    if (reportCount === 0) return `💡 Belum ada laporan di **${activeTempat.name}**. Kondisi terpantau landai. Jadilah warga pertama yang memberi update!`;
    
    const status = isRamai ? "cenderung ramai" : "cenderung normal";
    return `📍 **${activeTempat.name}** ${status}. Aktivitas warga masih dalam batas wajar dengan **${reportCount}** update terbaru.`;
  };

  // Efek Typing sederhana agar terasa seperti AI sedang "berpikir"
  useEffect(() => {
    if (activeTempat) {
      const fullText = getInsight();
      setDisplayText(""); // Reset teks
      let i = 0;
      const interval = setInterval(() => {
        setDisplayText(fullText.substring(0, i));
        i++;
        if (i > fullText.length) clearInterval(interval);
      }, 20); // Kecepatan ketik
      return () => clearInterval(interval);
    }
  }, [activeTempat]);

  if (!activeTempat) {
    return (
      <div className="mb-6 animate-pulse">
        <div className="h-28 bg-zinc-800/40 rounded-2xl border border-zinc-700/50"></div>
      </div>
    );
  }

  return (
    <div className="relative mb-6 group">
      {/* Efek Glow di Background */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
      
      <div className="relative bg-zinc-900/80 backdrop-blur-xl rounded-2xl p-5 border border-white/10 shadow-2xl">
        <div className="flex items-start gap-4">
          {/* Avatar AI dengan Animasi Ping */}
          <div className="relative flex-shrink-0">
            <div className="absolute -inset-1 bg-cyan-500 rounded-full blur opacity-40 animate-pulse"></div>
            <div className="relative w-10 h-10 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-full flex items-center justify-center shadow-inner">
              <span className="text-lg">✨</span>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <h3 className="text-xs font-bold uppercase tracking-widest text-cyan-400">AI Intelligence</h3>
              <span className="flex h-2 w-2 rounded-full bg-green-500 animate-ping"></span>
            </div>
            
            <p className="text-[14px] text-zinc-100 leading-relaxed font-medium">
              {/* Render teks manual atau gunakan library markdown jika perlu */}
              {displayText.split("**").map((part, i) => 
                i % 2 === 1 ? <b key={i} className="text-white">{part}</b> : part
              )}
              <span className="inline-block w-1 h-4 ml-1 bg-cyan-500 animate-bounce"></span>
            </p>

            <div className="mt-3 pt-3 border-t border-white/5 flex justify-between items-center">
              <p className="text-[10px] text-zinc-500 font-medium italic">
                Real-time analysis: {reportCount} laporan + {vibeCount} saksi
              </p>
              <div className="flex gap-1">
                <div className="w-1 h-1 rounded-full bg-zinc-700"></div>
                <div className="w-1 h-1 rounded-full bg-zinc-700"></div>
                <div className="w-1 h-1 rounded-full bg-zinc-700"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}