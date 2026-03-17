"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, LogOut, Shield, Bell, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function UserMenu({ isScrolled, onOpenAuthModal, theme }) {
  const { user, isAdmin, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
      if (typeof window !== "undefined") {
        localStorage.clear();
        sessionStorage.clear();
        setTimeout(() => {
          window.location.href = "/";
        }, 500);
      }
    } catch (error) {
      console.error("Logout error:", error);
      window.location.href = "/";
    }
  };

  // =========================================
  // TOMBOL LOGIN (BELUM LOGIN) - VERSI HALUS
  // =========================================
  if (!user) {
    return (
      <button 
        onClick={onOpenAuthModal}
        className={`relative rounded-full transition-all duration-500 
          active:scale-90 active:brightness-110 group
          ${isScrolled ? 'scale-90' : 'scale-100'}
          p-[1px] 
          bg-gradient-to-tr from-transparent via-transparent to-transparent
          hover:from-[#E3655B]/30 hover:via-[#E3655B]/70 hover:to-[#E3655B]/30
          ${theme?.isMalam ? 'hover:via-[#E3655B]/90' : 'hover:via-[#E3655B]/70'}`}
      >
        {/* Lingkaran Utama */}
        <div className={`rounded-full w-9 h-9 flex items-center justify-center transition-all duration-300
          ${theme?.isMalam ? 'bg-slate-900' : 'bg-white'}`}
        >
          {/* Ikon User dengan Animasi Floating */}
          <User 
            size={18} 
            strokeWidth={2.5}
            className={`${theme?.isMalam ? 'text-slate-400' : 'text-slate-500'} 
              group-hover:text-[#E3655B] group-hover:scale-110 transition-all duration-300`} 
          />
        </div>

        {/* Efek Ping Lembut di Belakang */}
        <span 
          className="absolute inset-0 rounded-full bg-[#E3655B] opacity-0 
            group-hover:opacity-20 group-hover:animate-ping pointer-events-none" 
          style={{ animationDuration: '1.5s' }}
        />
        
        {/* Tooltip MLEBU dengan Segitiga */}
        <div className={`absolute -bottom-9 left-1/2 -translate-x-1/2 px-2.5 py-1.5 
          rounded-lg text-[8px] font-black uppercase tracking-[0.2em] whitespace-nowrap
          opacity-0 group-hover:opacity-100 group-hover:-bottom-10 transition-all duration-200 
          pointer-events-none shadow-lg
          ${theme?.isMalam 
            ? 'bg-[#E3655B] text-white' 
            : 'bg-slate-900 text-white'
          }`}
        >
          MLEBU
          {/* Segitiga Tooltip */}
          <div className={`absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 
            ${theme?.isMalam ? 'bg-[#E3655B]' : 'bg-slate-900'}`} 
          />
        </div>
      </button>
    );
  }

  // =========================================
  // MENU USER (SUDAH LOGIN)
  // =========================================
  const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || "Cak User";

  return (
    <div className="relative">
      <button 
        onClick={() => !isLoggingOut && setIsOpen(!isOpen)}
        className={`relative rounded-full p-[2px] transition-all duration-300 ${
          isAdmin ? 'bg-orange-500' : 'bg-[#E3655B]'
        } ${isScrolled ? 'scale-90' : 'scale-100'} ${isLoggingOut ? 'opacity-50' : ''}`}
      >
        <div className={`rounded-full overflow-hidden border-2 ${
          theme?.isMalam ? 'border-slate-900' : 'border-white'
        } w-9 h-9 bg-white flex items-center justify-center`}>
          {user?.user_metadata?.avatar_url ? (
            <img src={user.user_metadata.avatar_url} className="w-full h-full object-cover" alt="p" />
          ) : (
            <span className="text-xs font-black text-slate-600">{name.charAt(0).toUpperCase()}</span>
          )}
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-[90]" onClick={() => setIsOpen(false)} />
            
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className={`absolute right-0 mt-3 w-52 z-[100] rounded-2xl shadow-xl border p-2 ${
                theme?.isMalam ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
              }`}
            >
              <div className="px-3 py-2 border-b border-slate-100 mb-1">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  {isAdmin ? "ADMIN" : "WARGA SETEMPAT"}
                </p>
                <p className={`text-xs font-bold truncate ${theme?.isMalam ? 'text-white' : 'text-slate-800'}`}>
                  {name}
                </p>
              </div>

              <div className="space-y-0.5">
                {isAdmin && (
                  <button className="w-full flex items-center gap-3 px-3 py-2 text-[11px] font-bold text-orange-600 hover:bg-orange-50 rounded-lg transition-colors">
                    <Shield size={14} /> PANEL KONTROL
                  </button>
                )}
                <button className={`w-full flex items-center gap-3 px-3 py-2 text-[11px] font-bold ${
                  theme?.isMalam ? 'text-slate-300 hover:bg-white/5' : 'text-slate-600 hover:bg-slate-50'
                } rounded-lg transition-colors`}>
                  <User size={14} /> PROFIL SAYA
                </button>
                
                <div className="h-[1px] bg-slate-100 my-1 mx-2" />
                
                <button 
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="w-full flex items-center gap-3 px-3 py-2 text-[11px] font-bold text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isLoggingOut ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <LogOut size={14} />
                  )}
                  {isLoggingOut ? "SIK..." : "KELUAR"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}