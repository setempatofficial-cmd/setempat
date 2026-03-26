"use client";

import { motion, AnimatePresence } from "framer-motion";

export default function StatusIsland({ 
  item, 
  theme, 
  isExpanded, 
  setIsExpanded, 
  jumlahWarga 
}) {
  
  // 1. Ambil data laporan warga (internal)
  const laporanInternal = item?.laporan_warga?.[0]; 
  
  // 2. Ambil data eksternal (misal dari kolom 'external_data' atau 'social_source')
  const dataEksternal = item?.external_source; 

  // 3. LOGIKA PENENTUAN STATUS (Prioritas)
  // Kita cek: Ada laporan warga ga? Kalau ga ada, ada info medsos ga?
  const dataSource = laporanInternal || dataEksternal;

  // Tentukan Label Sumber (Buat kasih tau warga ini info dari mana)
  const sourceLabel = laporanInternal ? "LIVE WARGA" : (dataEksternal ? "MEDSOS" : "SISTEM");

  const kondisiSekarang = dataSource?.tipe || dataSource?.status || "Normal";
  const waktuUpdate = dataSource?.time_tag || "Terkini";
  const deskripsiFinal = dataSource?.deskripsi || dataSource?.caption || "Kondisi terpantau lancar di lokasi.";

  const getActivityLevel = () => {
    const k = kondisiSekarang.toLowerCase();
    if (k.includes("antri") || k.includes("macet")) return "sangat ramai";
    if (k.includes("ramai") || k.includes("padat")) return "ramai";
    return "normal";
  };

  const displayStatus = isExpanded 
    ? `LAPORAN ${sourceLabel}` 
    : `Kondisi ${kondisiSekarang} • ${waktuUpdate}`;

  return (
    <div 
      onClick={() => setIsExpanded(!isExpanded)}
      className={`relative overflow-hidden transition-all duration-500 cursor-pointer
        ${theme.statusBg} border ${theme.softBorder || theme.border} rounded-[28px]
        ${isExpanded ? 'p-6 shadow-inner' : 'h-14 px-5 flex items-center shadow-sm'}
      `}
    >
      <div className="w-full">
        <div className={`flex items-center justify-between ${isExpanded ? 'mb-4 border-b border-white/5 pb-3' : ''}`}>
          <div className="flex items-center gap-3 overflow-hidden">
            {/* Indikator Warna sesuai sumber */}
            <div className="relative shrink-0">
              <div className={`h-2 w-2 rounded-full ${laporanInternal ? 'bg-cyan-400' : 'bg-pink-500'}`} />
              <div className={`absolute inset-0 h-2 w-2 rounded-full ${laporanInternal ? 'bg-cyan-400' : 'bg-pink-500'} animate-ping opacity-75`} />
            </div>
            
            <p className={`text-[11px] font-[1000] uppercase tracking-wider truncate ${theme.statusText}`}>
              {displayStatus}
            </p>
          </div>
          
          <div className={`flex items-center gap-2 px-2 py-1 rounded-lg ${theme.isMalam ? 'bg-white/5' : 'bg-black/5'}`}>
            <span className={`text-[8px] font-black uppercase opacity-60 ${theme.statusText}`}>
              {isExpanded ? 'Tutup' : 'Detail'}
            </span>
            <motion.span animate={{ rotate: isExpanded ? 180 : 0 }} className="text-[10px]">▼</motion.span>
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
              <div className="space-y-3 py-1">
                <p className={`text-[13px] leading-relaxed font-bold italic opacity-90 ${theme.statusText}`}>
                  "{deskripsiFinal}"
                </p>
                
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    {/* Badge Sumber Data */}
                    <span className={`text-[7px] font-black px-1.5 py-0.5 rounded border 
                      ${laporanInternal ? 'border-cyan-500/50 text-cyan-500' : 'border-pink-500/50 text-pink-500'}`}>
                      {sourceLabel}
                    </span>
                    <p className={`text-[9px] font-bold opacity-40 uppercase tracking-tighter ${theme.statusText}`}>
                      Update {waktuUpdate}
                    </p>
                  </div>

                  <span className="text-[9px] font-black underline opacity-60 uppercase">
                    {getActivityLevel()}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}