"use client";

import { motion, AnimatePresence } from "framer-motion";

export default function StatusIsland({ 
  item, 
  theme, 
  isExpanded, 
  setIsExpanded,
  jumlahWarga 
}) {
  
  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };

  // Tentukan level aktivitas dari data yang ada
  const getActivityLevel = () => {
    if (item.isViral) return "sangat ramai";
    if (item.isRamai) return "ramai";
    if (item.viewingCount > 5) return "cukup ramai";
    return "normal";
  };

  // Dapatkan status dari item (dari feedEngine)
  const currentStatus = item.badgeStatus || "Kondisi Terpantau Lancar";
  const activityLevel = getActivityLevel();
  
  // Status messages untuk variasi teks saat kondisi tertutup
  const statusMessages = [
    currentStatus,
    `${jumlahWarga || 0} warga memantau`,
    `Update ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
  ];

  const displayStatus = isExpanded 
    ? "LAPORAN VISUAL TERKINI" 
    : statusMessages[0];

  return (
    <div 
      onClick={handleToggle}
      className={`relative overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] cursor-pointer
        ${theme.statusBg} border ${theme.softBorder || theme.border} rounded-[28px]
        ${isExpanded ? 'p-6 shadow-inner' : 'h-14 px-5 flex items-center shadow-sm hover:shadow-md'}
      `}
    >
      <div className="w-full">
        <div className={`flex items-center justify-between ${isExpanded ? 'mb-4 border-b border-white/5 pb-3' : ''}`}>
          <div className="flex items-center gap-3 overflow-hidden">
            {/* Live indicator dengan pulse */}
            <div className="relative shrink-0">
              <div className={`h-2 w-2 rounded-full ${theme.dot}`} />
              <div className={`absolute inset-0 h-2 w-2 rounded-full ${theme.dot} animate-ping opacity-75`} />
            </div>
            
            <p className={`text-[11px] font-[1000] uppercase tracking-wider truncate ${theme.statusText}`}>
              {displayStatus}
            </p>
          </div>
          
          {/* INDIKATOR EXPAND - DIPERBAIKI */}
          <div className={`flex items-center gap-2 px-2 py-1 rounded-lg 
            ${theme.isMalam ? 'bg-white/5 border-white/5' : 'bg-black/5 border-black/5'}`}
          >
            <span className={`text-[8px] font-black uppercase opacity-60 ${theme.statusText}`}>
              {isExpanded ? 'Tutup' : 'Detail'}
            </span>
            <motion.span 
              animate={{ rotate: isExpanded ? 180 : 0 }}
              className={`text-[10px] ${theme.statusText} opacity-80`}
            >
              ▼
            </motion.span>
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="space-y-3 py-1">
                <p className={`text-[13px] leading-relaxed font-bold italic opacity-90 ${theme.statusText}`}>
                  "Live report warga menunjukkan{' '}
                  <span className={`px-1 rounded not-italic 
                    ${theme.isMalam ? 'bg-white/10' : 'bg-black/5'}`}>
                    {currentStatus}
                  </span>. 
                  Aktivitas terpantau{' '}
                  <span className="underline decoration-2 underline-offset-4">
                    {activityLevel}
                  </span>{' '}
                  dibandingkan data rata-rata jam sebelumnya."
                </p>
                
                <div className="flex items-center gap-4 pt-2">
                   <div className="flex -space-x-2">
                      {[1,2,3].map(i => (
                        <div 
                          key={i} 
                          className={`w-5 h-5 rounded-full border flex items-center justify-center text-[7px] font-black
                            ${theme.isMalam 
                              ? 'border-white/20 bg-gray-800 text-white' 
                              : 'border-black/20 bg-gray-200 text-slate-800'}`}
                        >
                          {String.fromCharCode(64 + i)}
                        </div>
                      ))}
                   </div>
                   <p className={`text-[9px] font-bold opacity-40 uppercase tracking-tighter
                     ${theme.isMalam ? 'text-white' : 'text-slate-800'}`}>
                     Tervalidasi {jumlahWarga || 0} Warga Setempat
                   </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}