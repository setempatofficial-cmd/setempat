import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

export default function AIQuickActions({ actions = [], onActionClick, onLaporClick, isMalam, isTyping }) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Tema Solid & High Contrast (Premium AI Look)
  const theme = {
    bg: isMalam ? "bg-[#09090b]" : "bg-white", 
    text: isMalam ? "text-zinc-400" : "text-zinc-500",
    border: isMalam ? "border-zinc-800" : "border-zinc-100",
    mainText: isMalam ? "text-zinc-100" : "text-zinc-900",
    // Accent khusus kanggo tombol Pantauan
    accent: isMalam 
      ? "bg-cyan-500/5 border-cyan-500/20 text-cyan-400" 
      : "bg-cyan-50 border-cyan-200 text-cyan-600"
  };

  const mainActions = actions.filter(a => 
    a.label.toLowerCase().includes('kondisi') || 
    a.label.toLowerCase().includes('pantau') ||
    a.label.toLowerCase().includes('situasi')
  );

  const supportActions = actions.filter(a => 
    !a.label.toLowerCase().includes('kondisi') && 
    !a.label.toLowerCase().includes('pantau') &&
    !a.label.toLowerCase().includes('situasi')
  );

  if (isTyping || actions.length === 0) return null;

  return (
    <div className={`w-full select-none border-t ${theme.border} ${theme.bg} transition-colors duration-300`}>
      
      {/* HEADER TOGGLE - Lini interaksi utama */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-zinc-500/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="flex space-x-1">
            <div className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
            <div className="h-1.5 w-1.5 rounded-full bg-cyan-500/40" />
          </div>
          <span className="text-[10px] font-black tracking-[0.2em] text-zinc-500">SETEMPAT AI</span>
        </div>
        
        <div className="flex items-center gap-2">
           <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-tighter">
             {isExpanded ? "Sembunyikan" : "Tampilkan Aksi"}
           </span>
           <motion.span 
             animate={{ rotate: isExpanded ? 180 : 0 }}
             className="text-[10px] text-zinc-500"
           >
             ▼
           </motion.span>
        </div>
      </div>

      {/* BODY - Konten Aksi */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4">
              
              {/* GRUP 1: ACTION UTAMA */}
              <div className="flex flex-wrap gap-2">
                <motion.button
                  whileHover={{ scale: 1.02, x: 2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onLaporClick}
                  className="group flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-zinc-100 text-zinc-900 border border-zinc-200 dark:bg-zinc-100 dark:text-zinc-900 shadow-sm"
                >
                  <span className="group-hover:rotate-12 transition-transform">📸</span>
                  LAPOR
                </motion.button>

                {mainActions.map((action) => (
                  <motion.button
                    key={action.id}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onActionClick(action.query)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border ${theme.accent} shadow-sm transition-all`}
                  >
                    <span>{action.emoji}</span>
                    <span className="uppercase tracking-tight">{action.label}</span>
                  </motion.button>
                ))}
              </div>

              {/* GRUP 2: LAYANAN PENDUKUNG */}
              {supportActions.length > 0 && (
                <div className="space-y-2">
                  <div className="h-[1px] w-full bg-zinc-800/10 dark:bg-zinc-800/50" />
                  <div className="flex flex-wrap gap-2">
                    {supportActions.map((action) => (
                      <motion.button
                        key={action.id}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => onActionClick(action.query)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border ${theme.border} ${theme.bg} ${theme.text} hover:border-zinc-500 transition-colors shadow-sm`}
                      >
                        <span className="grayscale-[0.5] group-hover:grayscale-0">{action.emoji}</span>
                        {action.label}
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {/* FOOTER / TIPS */}
              <div className="flex items-center gap-2 opacity-50">
                <div className="h-[1px] w-4 bg-zinc-500" />
                <p className="text-[9px] font-medium tracking-tight text-zinc-500 uppercase">
                  Sapa AI kanggo bantuan luwih lanjut
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}