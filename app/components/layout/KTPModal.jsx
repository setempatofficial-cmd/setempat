"use client";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

export default function KTPModal({ 
  isOpen, 
  onClose, 
  children, 
  theme 
}) {
  const isMalam = theme?.isMalam ?? true;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
          
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className={`absolute inset-0 backdrop-blur-md transition-colors
              ${isMalam ? "bg-black/70" : "bg-slate-900/50"}`}
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.88, y: 30 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className={`relative w-full max-w-md overflow-hidden rounded-3xl shadow-2xl border
              ${isMalam 
                ? "bg-slate-900/95 border-slate-700" 
                : "bg-white/95 border-slate-200 shadow-xl"}`}
            onClick={(e) => e.stopPropagation()} // Mencegah modal tertutup saat klik di dalam
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className={`absolute top-4 right-4 z-20 p-2.5 rounded-full transition-all hover:scale-110
                ${isMalam 
                  ? "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700" 
                  : "bg-white text-slate-500 hover:text-slate-900 hover:bg-slate-100 shadow"}`}
            >
              <X size={20} strokeWidth={3} />
            </button>

            {/* Content Area */}
            <div className="pt-16 pb-8 px-6 flex items-center justify-center min-h-[380px]">
              {children}
            </div>

            {/* Footer */}
            <div className={`px-6 py-4 text-center border-t text-[10px] font-black tracking-[0.125em]
              ${isMalam 
                ? "border-slate-800 text-slate-500" 
                : "border-slate-100 text-slate-400"}`}>
              SETEMPAT.ID • DIGITAL IDENTITY CARD
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}