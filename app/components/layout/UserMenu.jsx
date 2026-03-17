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
      setIsLoggingOut(true); // Mulai loading
      
      // 1. Jalankan logout dari Supabase
      await logout();
      
      // 2. Sapu bersih sisa storage agar tidak Lock Broken
      if (typeof window !== "undefined") {
        localStorage.clear();
        sessionStorage.clear();
        
        // 3. Beri jeda sangat singkat agar UI loading sempat terlihat
        // Lalu banting ke halaman utama (Hard Reload)
        setTimeout(() => {
          window.location.href = "/";
        }, 500);
      }
    } catch (error) {
      console.error("Logout error:", error);
      window.location.href = "/"; // Paksa keluar meski error
    }
  };

  if (!user) {
    return (
      <button 
        onClick={onOpenAuthModal}
        className="px-5 py-2.5 bg-[#E3655B] text-white text-[11px] font-black rounded-xl shadow-sm active:scale-95 transition-all"
      >
        MLEBU
      </button>
    );
  }

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