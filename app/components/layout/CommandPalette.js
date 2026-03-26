"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function CommandPalette({ 
  isOpen, 
  onClose, 
  villageLocation, 
  theme, 
  onOpenLaporanForm 
}) {
  const [query, setQuery] = useState("");

  // Shortcut Keyboard Handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const actions = [
    { id: "lapor", label: "LAPOR KONDISI JALAN", icon: "📢", cmd: "/lapor", color: "text-orange-500" },
    { id: "kafe", label: "CEK KERAMAIAN KAFE", icon: "☕", cmd: "/cek-kafe", color: "text-brown-500" },
    { id: "darurat", label: "KONTAK DARURAT", icon: "🚑", cmd: "/darurat", color: "text-red-500" },
    { id: "agenda", label: "AGENDA DESA & EVENT", icon: "🕌", cmd: "/agenda", color: "text-emerald-500" },
  ];

  const handleAction = (id) => {
    if (id === "lapor") onOpenLaporanForm();
    onClose();
    setQuery("");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[3000] flex items-start justify-center pt-[15vh] px-4">
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 dark:bg-black/80 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -10 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className={`relative w-full max-w-xl overflow-hidden rounded-[24px] border shadow-2xl ${
              theme.isMalam 
              ? "bg-[#0A0A0A] border-white/10 shadow-black" 
              : "bg-white border-black/[0.05] shadow-black/5"
            }`}
          >
            {/* Input Section */}
            <div className="flex items-center px-5 py-4 border-b border-black/[0.05] dark:border-white/[0.05]">
              <div className="w-2 h-2 rounded-full bg-[#E3655B] animate-pulse mr-4" />
              <input
                autoFocus
                placeholder={`Tanya AI di ${villageLocation || "Sekitarmu"}...`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className={`flex-1 bg-transparent outline-none text-base font-medium placeholder:opacity-30 ${theme.text}`}
              />
              <div className="flex items-center gap-1 opacity-20 ml-2">
                <kbd className="text-[10px] font-bold px-1.5 py-0.5 border rounded-md">ESC</kbd>
              </div>
            </div>

            {/* List Section */}
            <div className="p-2 max-h-[400px] overflow-y-auto custom-scrollbar">
              <div className="px-3 py-2">
                <p className="text-[10px] font-black tracking-[0.2em] opacity-30 uppercase mb-2">
                  Quick Actions
                </p>
                <div className="space-y-1">
                  {actions.map((action) => (
                    <button
                      key={action.id}
                      onClick={() => handleAction(action.id)}
                      className={`w-full flex items-center justify-between px-3 py-3 rounded-xl transition-all group ${
                        theme.isMalam 
                        ? "hover:bg-white/[0.03] text-white/80 hover:text-white" 
                        : "hover:bg-black/[0.02] text-black/70 hover:text-black"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-xl grayscale group-hover:grayscale-0 transition-all duration-300">
                          {action.icon}
                        </span>
                        <span className="text-[13px] font-bold tracking-tight">
                          {action.label}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono opacity-0 group-hover:opacity-30 transition-opacity uppercase font-bold">
                        {action.cmd}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Insight Shortcut Footer */}
              <div className={`mt-2 p-4 rounded-2xl mx-2 mb-2 flex items-center gap-4 transition-all ${
                theme.isMalam ? "bg-white/[0.02]" : "bg-black/[0.02]"
              }`}>
                <div className="w-8 h-8 rounded-lg bg-[#E3655B]/10 flex items-center justify-center">
                  <span className="text-xs">🤖</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[11px] font-black uppercase tracking-wider ${theme.text}`}>AI Setempat</p>
                  <p className="text-[10px] opacity-40 truncate">Ketik perintah atau tanya apapun tentang {villageLocation}</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}