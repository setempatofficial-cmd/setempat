"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, LogOut, Shield, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function UserMenu({ isScrolled, onOpenAuthModal, theme }) {
  const { user, isAdmin, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      setIsOpen(false);
      await logout();
      // Tidak perlu localStorage.clear() — cukup redirect
      window.location.href = "/";
    } catch (error) {
      console.error("Logout error:", error);
      // Tetap redirect meski error — session sudah di-clear di state
      window.location.href = "/";
    }
  };

  // ── BELUM LOGIN ──────────────────────────────────────────────────────────
  if (!user) {
    return (
      <button
        onClick={onOpenAuthModal}
        className={`relative rounded-full transition-all duration-500 active:scale-90 group
          ${isScrolled ? "scale-90" : "scale-100"}
          p-[1px] hover:from-[#E3655B]/30 hover:via-[#E3655B]/70 hover:to-[#E3655B]/30
          bg-gradient-to-tr from-transparent via-transparent to-transparent`}
      >
        <div className={`rounded-full w-9 h-9 flex items-center justify-center transition-all duration-300
          ${theme?.isMalam ? "bg-slate-900" : "bg-white"}`}
        >
          <User
            size={18}
            strokeWidth={2.5}
            className={`${theme?.isMalam ? "text-slate-400" : "text-slate-500"}
              group-hover:text-[#E3655B] group-hover:scale-110 transition-all duration-300`}
          />
        </div>
        <span className="absolute inset-0 rounded-full bg-[#E3655B] opacity-0 group-hover:opacity-20 group-hover:animate-ping pointer-events-none" style={{ animationDuration: "1.5s" }} />
        <div className={`absolute -bottom-9 left-1/2 -translate-x-1/2 px-2.5 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-[0.2em] whitespace-nowrap
          opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none shadow-lg
          ${theme?.isMalam ? "bg-[#E3655B] text-white" : "bg-slate-900 text-white"}`}
        >
          MLEBU
          <div className={`absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 ${theme?.isMalam ? "bg-[#E3655B]" : "bg-slate-900"}`} />
        </div>
      </button>
    );
  }

  // ── SUDAH LOGIN ──────────────────────────────────────────────────────────
  const meta = user?.user_metadata || {};
  // Fix: Google bisa simpan nama di 'name' atau 'full_name'
  const name = meta.full_name || meta.name || user?.email?.split("@")[0] || "Cak User";
  const avatar = meta.avatar_url || meta.picture || null;

  return (
    <div className="relative">
      <button
        onClick={() => !isLoggingOut && setIsOpen(!isOpen)}
        disabled={isLoggingOut}
        className={`relative rounded-full p-[2px] transition-all duration-300
          ${isAdmin ? "bg-orange-500" : "bg-[#E3655B]"}
          ${isScrolled ? "scale-90" : "scale-100"}
          ${isLoggingOut ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <div className={`rounded-full overflow-hidden border-2 w-9 h-9 bg-white flex items-center justify-center
          ${theme?.isMalam ? "border-slate-900" : "border-white"}`}
        >
          {avatar ? (
            <img src={avatar} className="w-full h-full object-cover" alt="profil" />
          ) : (
            <span className="text-xs font-black text-slate-600">
              {name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {/* Indikator loading logout */}
        {isLoggingOut && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
            <Loader2 size={14} className="animate-spin text-white" />
          </div>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-[90]" onClick={() => setIsOpen(false)} />

            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className={`absolute right-0 mt-3 w-52 z-[100] rounded-2xl shadow-xl border p-2
                ${theme?.isMalam ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}
            >
              {/* Info user */}
              <div className={`px-3 py-2 mb-1 border-b ${theme?.isMalam ? "border-slate-800" : "border-slate-100"}`}>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  {isAdmin ? "⭐ ADMIN" : "WARGA SETEMPAT"}
                </p>
                <p className={`text-xs font-bold truncate mt-0.5 ${theme?.isMalam ? "text-white" : "text-slate-800"}`}>
                  {name}
                </p>
                <p className="text-[9px] text-slate-400 truncate">{user.email}</p>
              </div>

              <div className="space-y-0.5">
                {isAdmin && (
                  <button className="w-full flex items-center gap-3 px-3 py-2.5 text-[11px] font-bold text-orange-500 hover:bg-orange-50 rounded-xl transition-colors">
                    <Shield size={13} /> PANEL KONTROL
                  </button>
                )}

                <button className={`w-full flex items-center gap-3 px-3 py-2.5 text-[11px] font-bold rounded-xl transition-colors
                  ${theme?.isMalam ? "text-slate-300 hover:bg-white/5" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  <User size={13} /> PROFIL SAYA
                </button>

                <div className={`h-px mx-2 my-1 ${theme?.isMalam ? "bg-slate-800" : "bg-slate-100"}`} />

                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-[11px] font-bold text-rose-500 hover:bg-rose-50 rounded-xl transition-colors disabled:opacity-50"
                >
                  {isLoggingOut ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <LogOut size={13} />
                  )}
                  {isLoggingOut ? "Keluar..." : "KELUAR"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
