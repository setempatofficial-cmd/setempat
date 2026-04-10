"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  LogOut,
  Loader2,
  LayoutDashboard,
  Map,
  ChevronRight,
  PlusCircle,
  Zap,
  ShieldCheck,
  Home,
} from "lucide-react";
import { useAuth } from "@/app/context/AuthContext"; 
import VerifiedBadge from "@/app/components/ui/VerifiedBadge";

// Import komponen yang dibutuhkan
import Modal from "@/app/components/layout/KTPModal"; 
import KTPDigital from "@/app/components/layout/KTPCard"; 

export default function UserMenu({
  isScrolled,
  onOpenAuthModal,
  theme,
  toggleEditMode,
  isEditActive,
}) {
  const router = useRouter();
  const { user, loading, role, isAdmin, isSuperAdmin, profile, logout } = useAuth();
  
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  // State untuk mengontrol kemunculan Modal KTP
  const [isKTPModalOpen, setIsKTPModalOpen] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      setIsOpen(false);
      await logout();
      window.location.href = "/";
    } catch (error) {
      console.error("Logout error:", error);
      window.location.href = "/";
    }
  };

  // Handle KTP Digital click - bedakan berdasarkan role
  const handleKTPClick = () => {
    setIsOpen(false);
    
    if (isSuperAdmin) {
      // Superadmin → buka halaman verifikasi
      router.push("/admin/verifikasi-ktp");
    } else {
      // User biasa → buka modal KTPCard
      setIsKTPModalOpen(true);
    }
  };

  // Handle Balai Warga click (hanya untuk Warga Biasa)
  const handleBalaiWargaClick = () => {
    setIsOpen(false);
    router.push("/balai-warga");
  };

  // Handle Kantor Setempat click (untuk Superadmin)
  const handleKantorSetempatClick = () => {
    setIsOpen(false);
    router.push("/admin/dashboard");
  };

  // Handle Ruang RT click (untuk Admin)
  const handleRuangRTClick = () => {
    setIsOpen(false);
    router.push("/admin/ruang-rt");
  };

  // 1. LOADING STATE
  if (loading) {
    return (
      <div
        className={`w-9 h-9 rounded-full animate-pulse flex items-center justify-center
          ${theme?.isMalam ? "bg-slate-800" : "bg-slate-100"}`}
      >
        <Loader2 size={14} className="animate-spin text-slate-400" />
      </div>
    );
  }

  // 2. NOT LOGGED IN STATE
  if (!user) {
    return (
      <button
        onClick={onOpenAuthModal}
        className={`relative rounded-full transition-all duration-500 active:scale-90 group
          ${isScrolled ? "scale-90" : "scale-100"}
          p-[1px] hover:from-[#E3655B]/30 hover:via-[#E3655B]/70 hover:to-[#E3655B]/30
          bg-gradient-to-tr from-transparent via-transparent to-transparent`}
      >
        <div
          className={`rounded-full w-9 h-9 flex items-center justify-center transition-all duration-300
            ${theme?.isMalam ? "bg-slate-900" : "bg-white"}`}
        >
          <User
            size={18}
            strokeWidth={2.5}
            className={`${theme?.isMalam ? "text-slate-400" : "text-slate-500"}
              group-hover:text-[#E3655B] group-hover:scale-110 transition-all duration-300`}
          />
        </div>
        <span className="absolute inset-0 rounded-full bg-[#E3655B] opacity-0 group-hover:opacity-20 group-hover:animate-ping pointer-events-none" />
        <div
          className={`absolute -bottom-9 left-1/2 -translate-x-1/2 px-2.5 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-[0.2em] whitespace-nowrap
            opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none shadow-lg
            ${theme?.isMalam ? "bg-[#E3655B] text-white" : "bg-slate-900 text-white"}`}
        >
          MLEBU
          <div
            className={`absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 ${theme?.isMalam ? "bg-[#E3655B]" : "bg-slate-900"}`}
          />
        </div>
      </button>
    );
  }

  // 3. LOGGED IN DATA PREPARATION
  const name = profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Warga";
  const avatar = profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null;

  return (
    <div className="relative">
      {/* Tombol Avatar Profil */}
      <button
        onClick={() => !isLoggingOut && setIsOpen(!isOpen)}
        disabled={isLoggingOut}
        className={`relative rounded-full p-[2px] transition-all duration-500
          ${isSuperAdmin ? "bg-purple-500 shadow-lg shadow-purple-500/20" :
            isAdmin ? "bg-orange-500 shadow-lg shadow-orange-500/20" :
            "bg-[#E3655B] shadow-lg shadow-[#E3655B]/20"}
          ${isScrolled ? "scale-90" : "scale-100"}
          ${isLoggingOut ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <div
          className={`rounded-full overflow-hidden border-2 w-9 h-9 bg-white flex items-center justify-center
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
        {isLoggingOut && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm">
            <Loader2 size={14} className="animate-spin text-white" />
          </div>
        )}
      </button>

      {/* Dropdown Menu Utama */}
      <AnimatePresence>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-[90] bg-black/5 backdrop-blur-[1px]"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className={`absolute right-0 mt-3 w-60 z-[100] rounded-2xl shadow-2xl border p-2
                ${theme?.isMalam ? "bg-slate-900/95 border-slate-800 backdrop-blur-xl" : "bg-white/95 border-slate-100 backdrop-blur-xl"}`}
            >
              {/* Header Profil & Status Kasta */}
<div className={`px-3 py-3 mb-2 border-b ${theme?.isMalam ? "border-slate-800" : "border-slate-100"}`}>
  <p className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest inline-block mb-1 border...`}>
    {isSuperAdmin ? "⚡ PETINGGI" : isAdmin ? "⭐ RT SETEMPAT" : "WARGA SETEMPAT"}
  </p>
  
  {/* 🔥 TAMBAHKAN DIV INI UNTUK NAMA + BADGE */}
  <div className="flex items-center gap-2 mt-0.5">
    <p className={`text-sm font-bold truncate ${theme?.isMalam ? "text-white" : "text-slate-800"}`}>
      {name}
    </p>
    {profile?.is_verified && <VerifiedBadge size="xs" />}
  </div>
  
  <p className="text-[10px] text-slate-400 truncate opacity-70 font-medium">
    {user.email}
  </p>
</div>

              <div className="space-y-1">
                {/* FITUR KHUSUS ADMIN & SUPERADMIN: Siarkan Kabar */}
                {(isAdmin || isSuperAdmin) && (
                  <button className="w-full flex flex-col items-start gap-0.5 px-3 py-3 bg-gradient-to-br from-[#E3655B] to-orange-600 text-white rounded-xl shadow-lg shadow-[#E3655B]/20 active:scale-95 transition-all mb-2 group">
                    <div className="flex items-center gap-2">
                      <PlusCircle size={14} strokeWidth={3} />
                      <span className="text-[10px] font-black uppercase tracking-wider">Siarkan Kabar</span>
                    </div>
                    <p className="text-[8px] opacity-80 font-medium leading-tight">Update info real-time sekitarmu</p>
                  </button>
                )}

                {/* MENU 1: KANTOR SETEMPAT (Khusus Superadmin) */}
                {isSuperAdmin && (
                  <button
                    onClick={handleKantorSetempatClick}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-[11px] font-bold rounded-xl transition-all group
                      bg-purple-500/10 text-purple-500 hover:bg-purple-500/20`}
                  >
                    <div className="flex items-center gap-3">
                      <LayoutDashboard size={14} />
                      <span>KANTOR SETEMPAT</span>
                    </div>
                    <ChevronRight size={12} className="opacity-50 group-hover:translate-x-1 transition-transform" />
                  </button>
                )}

                {/* MENU KHUSUS ADMIN: RUANG RT */}
                {isAdmin && !isSuperAdmin && (
                  <button
                    onClick={handleRuangRTClick}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-[11px] font-bold rounded-xl transition-all group
                      bg-orange-500/10 text-orange-500 hover:bg-orange-500/20`}
                  >
                    <div className="flex items-center gap-3">
                      <Home size={14} />
                      <span>RUANG RT</span>
                    </div>
                    <ChevronRight size={12} className="opacity-50 group-hover:translate-x-1 transition-transform" />
                  </button>
                )}

                {/* MENU: BALAI WARGA (Hanya untuk Warga Biasa, BUKAN Admin) */}
                {!isSuperAdmin && !isAdmin && (
                  <button
                    onClick={handleBalaiWargaClick}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-[11px] font-bold rounded-xl transition-all group
                      ${theme?.isMalam ? "text-[#E3655B] bg-[#E3655B]/5 hover:bg-[#E3655B]/10" : "text-[#E3655B] bg-[#E3655B]/5 hover:bg-[#E3655B]/10"}`}
                  >
                    <div className="flex items-center gap-3">
                      <LayoutDashboard size={14} />
                      <span>BALAI WARGA</span>
                    </div>
                    <ChevronRight size={12} className="opacity-50 group-hover:translate-x-1 transition-transform" />
                  </button>
                )}

                {/* MENU: PETA SEKITAR (Semua User) */}
                <button
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-[11px] font-bold rounded-xl transition-colors
                    ${theme?.isMalam ? "text-slate-300 hover:bg-white/5" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  <Map size={14} /> PETA SEKITAR
                </button>

                {/* MENU: KTP DIGITAL */}
                <button
                  onClick={handleKTPClick}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-[11px] font-bold rounded-xl transition-colors
                    ${isSuperAdmin 
                      ? "bg-purple-500/10 text-purple-500 hover:bg-purple-500/20" 
                      : theme?.isMalam 
                        ? "text-slate-300 hover:bg-white/5" 
                        : "text-slate-600 hover:bg-slate-50"}`}
                >
                  <div className="flex items-center gap-3">
                    {isSuperAdmin ? <ShieldCheck size={14} /> : <User size={14} />}
                    <span>KTP DIGITAL</span>
                  </div>
                  {isSuperAdmin && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400">
                      verif
                    </span>
                  )}
                </button>

                {/* FITUR KHUSUS SUPERADMIN: Kendali Petinggi */}
                {isSuperAdmin && (
                  <button
                    onClick={() => {
                      toggleEditMode?.();
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-[11px] font-[1000] rounded-xl transition-all border mt-1
                      ${isEditActive
                        ? "bg-purple-600 text-white border-purple-400 shadow-lg shadow-purple-500/40"
                        : theme?.isMalam
                        ? "text-purple-400 border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/10"
                        : "text-purple-600 border-purple-100 bg-purple-50 hover:bg-purple-100"}`}
                  >
                    <div className="flex items-center gap-3">
                      <Zap
                        size={13}
                        fill={isEditActive ? "white" : "currentColor"}
                        className={isEditActive ? "animate-pulse" : ""}
                      />
                      <span>{isEditActive ? "MODE EDIT AKTIF" : "KENDALI PETINGGI"}</span>
                    </div>
                    {isEditActive && <div className="w-2 h-2 rounded-full bg-white animate-ping" />}
                  </button>
                )}

                <div className={`h-[1px] mx-2 my-1.5 ${theme?.isMalam ? "bg-slate-800" : "bg-slate-100"}`} />

                {/* LOGOUT */}
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-[11px] font-bold text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors"
                >
                  {isLoggingOut ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
                  {isLoggingOut ? "KELUAR..." : "KELUAR SEBENTAR"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* MODAL KTP DIGITAL (Hanya untuk user biasa) */}
      <Modal 
        isOpen={isKTPModalOpen} 
        onClose={() => setIsKTPModalOpen(false)}
        theme={theme}
      >
        <KTPDigital 
          user={user} 
          role={role} 
          theme={theme} 
          onProfileUpdated={() => {
            window.location.reload();
          }}
        />
      </Modal>
    </div>
  );
}