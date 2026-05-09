"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { ChevronDown, Camera, Sparkles } from "lucide-react";

export default function AIQuickActions({ actions = [], onActionClick, onLaporClick, isMalam, isTyping }) {
  const [isExpanded, setIsExpanded] = useState(true);

  const theme = {
    bg: isMalam ? "bg-zinc-950" : "bg-white", 
    text: isMalam ? "text-zinc-500" : "text-zinc-400",
    border: isMalam ? "border-zinc-900" : "border-zinc-100",
    accent: isMalam 
      ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-400" 
      : "bg-cyan-50 border-cyan-100 text-cyan-700"
  };

  // Filter Aksi Utama (Pantauan/Situasi)
  const mainActions = actions.filter(a => 
    /kondisi|pantau|situasi/i.test(a.label)
  );

  // Aksi Pendukung Lainnya (Umum)
  const supportActions = actions.filter(a => 
    !/kondisi|pantau|situasi/i.test(a.label)
  );

  if (isTyping || actions.length === 0) return null;

  return (
    <div className={`w-full select-none border-t ${theme.border} ${theme.bg} transition-colors duration-500`}>
      
      {/* HEADER TOGGLE */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-zinc-500/5 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex items-center -space-x-1">
            <div className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
            <div className="h-1.5 w-1.5 rounded-full bg-cyan-500/30" />
          </div>
          <span className="text-[10px] font-black tracking-[0.2em] text-zinc-500 uppercase">
            Takon Cepat
          </span>
        </div>
        
        <div className="flex items-center gap-2">
           <motion.div animate={{ rotate: isExpanded ? 0 : 180 }}>
             <ChevronDown size={14} className="text-zinc-500" />
           </motion.div>
        </div>
      </div>

      {/* BODY ACTIONS */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-6 space-y-4">
              
              {/* TOMBOL UTAMA */}
              <div className="flex flex-wrap gap-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onLaporClick}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm"
                >
                  <Camera size={14} />
                  LAPOR
                </motion.button>

                {mainActions.map((action, i) => (
                  <motion.button
                    key={action.id || `main-${i}`}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onActionClick(action.query || action.prompt)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-bold border ${theme.accent} shadow-sm`}
                  >
                    <span>{action.emoji || action.icon}</span>
                    <span className="uppercase tracking-tight">{action.label}</span>
                  </motion.button>
                ))}
              </div>

              {/* TOMBOL PENDUKUNG */}
              {supportActions.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {supportActions.map((action, i) => (
                    <motion.button
                      key={action.id || `sup-${i}`}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => onActionClick(action.query || action.prompt)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-medium border ${theme.border} ${theme.bg} ${theme.text} hover:border-zinc-400 transition-colors shadow-sm`}
                    >
                      <span className="text-xs">{action.emoji || action.icon}</span>
                      {action.label}
                    </motion.button>
                  ))}
                </div>
              )}

              {/* FOOTER TIPS */}
              <div className="flex items-center gap-2 pt-1 opacity-40">
                <Sparkles size={10} className="text-cyan-500" />
                <p className="text-[9px] font-bold tracking-widest text-zinc-500 uppercase">
                  Pilih aksi atau ketik pertanyaanmu
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}