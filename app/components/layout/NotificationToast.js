"use client";
import { motion, AnimatePresence } from "framer-motion";

export default function NotificationToast({ show, onClose, stats, msg, location }) {
  if (!stats?.topPlace) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 100, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 80, opacity: 0, scale: 0.95 }}
          className="fixed bottom-6 left-4 right-4 z-[9999] pointer-events-none flex justify-center"
        >
          <div className="pointer-events-auto w-full max-w-[360px] bg-slate-900 border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden">
            <div className="p-4">
              {/* Header Notif */}
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <div className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </div>
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Update Warga • {location}</span>
                </div>
                <button onClick={onClose} className="text-white/20 hover:text-white transition-colors">
                   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Konten Utama */}
              <div className="flex gap-4 items-center mb-4">
                <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-2xl shadow-inner">
                  {stats.ramai > 10 ? "📣" : "🍃"}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-bold text-[15px] leading-tight italic">
                    {msg.pre}<span className={msg.color}>"{msg.name}"</span>{msg.post}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Terdeteksi <span className="text-white font-bold">{stats.ramai} titik aktif</span> di sekitarmu.
                  </p>
                </div>
              </div>

              {/* Action Button */}
              <button 
                onClick={() => {
                  window.location.href = `/?id=${stats.topPlace.id}`;
                  onClose();
                }}
                className="w-full py-3 bg-white text-slate-900 rounded-xl text-[11px] font-black uppercase tracking-wider active:scale-[0.97] transition-all flex items-center justify-center gap-2"
              >
                ⚡ Cek Suasana Sekarang
              </button>
            </div>
            
            {/* Progress Bar dengan onAnimationComplete */}
            <motion.div 
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: 6, ease: "linear" }}
              onAnimationComplete={onClose}
              className="h-1 bg-[#E3655B] origin-left"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}