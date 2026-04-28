"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, LogOut, Loader2, LayoutDashboard, Map, ChevronRight, 
  Zap, ShieldCheck, Home, Store, Truck, Briefcase, 
  Settings, Bell, HelpCircle, Crown, UserCheck, FileCheck,
  Smartphone
} from "lucide-react";
import { useAuth } from "@/app/context/AuthContext"; 
import VerifiedBadge from "@/app/components/ui/VerifiedBadge";
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
  const pathname = usePathname();
  const { user, loading, role, isAdmin, isSuperAdmin, profile, logout } = useAuth();
  
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isKTPModalOpen, setIsKTPModalOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

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

  const handleKTPClick = () => {
    setIsOpen(false);
    if (isSuperAdmin) {
      router.push("/admin/verifikasi/ktp");
    } else {
      setIsKTPModalOpen(true);
    }
  };

  if (loading) {
    return (
      <div className={`w-10 h-10 rounded-full animate-pulse flex items-center justify-center
        ${theme?.isMalam ? "bg-slate-800" : "bg-slate-100"}`}>
        <Loader2 size={16} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <button
        onClick={onOpenAuthModal}
        className="w-10 h-10 rounded-full flex items-center justify-center bg-[#E3655B] text-white shadow-lg hover:scale-110 transition-all active:scale-90"
      >
        <User size={20} strokeWidth={2.5} />
      </button>
    );
  }

  // LOGIKA NAMA & AVATAR
  const name = profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || "Warga";
  const avatar = profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null;
  const initial = name.charAt(0).toUpperCase();

  const roleConfig = {
    superadmin: { label: "Petinggi Setempat", icon: Crown, color: "from-purple-600 to-indigo-600", text: "text-purple-500" },
    admin: { label: "RT Setempat", icon: ShieldCheck, color: "from-orange-500 to-amber-500", text: "text-orange-500" },
    warga: { label: "Warga Setempat", icon: User, color: "from-[#E3655B] to-[#ff8e84]", text: "text-slate-400" }
  };

  const currentRole = isSuperAdmin ? roleConfig.superadmin : (isAdmin ? roleConfig.admin : roleConfig.warga);

  return (
    <div className="relative">
      {/* TRIGGER BUTTON: MINIMALIS & DINAMIS */}
      <button
        onClick={() => !isLoggingOut && setIsOpen(!isOpen)}
        className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300
          ${isOpen ? "ring-4 ring-orange-500/20 scale-110" : "hover:scale-105 active:scale-95"}
          ${isLoggingOut ? "opacity-50" : ""}`}
      >
        <div className={`w-full h-full rounded-full overflow-hidden flex items-center justify-center border-2
          ${theme?.isMalam ? "border-slate-800" : "border-white shadow-sm"}
          ${!avatar ? `bg-gradient-to-tr ${currentRole.color} text-white font-black text-sm` : "bg-white"}`}>
          
          {avatar ? (
            <img src={avatar} className="w-full h-full object-cover" alt="profile" referrerPolicy="no-referrer" />
          ) : (
            <span>{initial}</span>
          )}
        </div>
        
        {isLoggingOut && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm">
            <Loader2 size={12} className="animate-spin text-white" />
          </div>
        )}
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[90]" 
              onClick={() => setIsOpen(false)} 
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className={`absolute right-0 mt-3 w-72 z-[100] rounded-3xl shadow-2xl border overflow-hidden
                ${theme?.isMalam ? "bg-slate-900/95 border-slate-800 backdrop-blur-xl" : "bg-white/95 border-slate-200 backdrop-blur-xl"}`}
            >
              {/* Header Profil dalam Dropdown */}
              <div className={`p-5 ${theme?.isMalam ? "bg-white/5" : "bg-slate-50"}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-lg overflow-hidden
                    ${!avatar ? `bg-gradient-to-tr ${currentRole.color}` : "bg-white border border-slate-100"}`}>
                    {avatar ? <img src={avatar} className="w-full h-full object-cover" alt="p" referrerPolicy="no-referrer" /> : initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <p className={`font-bold truncate ${theme?.isMalam ? "text-white" : "text-slate-800"}`}>{name}</p>
                      {profile?.is_verified && <VerifiedBadge size="xs" />}
                    </div>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${currentRole.text}`}>
                      {currentRole.label}
                    </p>
                  </div>
                </div>
              </div>

              {/* Menu List */}
              <div className="p-2 max-h-[60vh] overflow-y-auto">
                <div className="mb-2">
                  <p className="px-4 py-2 text-[8px] font-black text-slate-400 uppercase tracking-widest">Menu Utama</p>
                  
                  {isSuperAdmin ? (
                    <>
                      <MenuAction icon={LayoutDashboard} label="Dashboard Pusat" desc="Statistik global" onClick={() => router.push("/admin/dashboard")} theme={theme} color="purple" />
                      <MenuAction icon={FileCheck} label="Verifikasi KTP" desc="Review warga baru" onClick={handleKTPClick} theme={theme} color="purple" />
                      <MenuAction icon={UserCheck} label="Angkat RT" desc="Manajemen wilayah" onClick={() => router.push("/admin/angkat-rt")} theme={theme} color="purple" />
                      <MenuAction icon={Zap} label="Mode Kendali" desc="Edit Konten" onClick={() => toggleEditMode?.()} theme={theme} isActive={isEditActive} color="purple" />
                    </>
                  ) : isAdmin ? (
                    <>
                      <MenuAction icon={Home} label="Ruang RT" desc="Dashboard wilayah" onClick={() => router.push("/admin/dashboard")} theme={theme} color="orange" />
                      <MenuAction icon={Store} label="Verifikasi Penjual" desc="Review Bakul" onClick={() => router.push("/admin/verifikasi/penjual")} theme={theme} color="orange" />
                      <MenuAction icon={Truck} label="Verifikasi Driver" desc="Review Ojek" onClick={() => router.push("/admin/verifikasi/driver")} theme={theme} color="orange" />
                      <MenuAction icon={Briefcase} label="Verifikasi Rewang" desc="Review Jasa" onClick={() => router.push("/admin/verifikasi/rewang")} theme={theme} color="orange" />
                    </>
                  ) : (
                    <>
                      <MenuAction icon={LayoutDashboard} label="Balai Warga" desc="Info setempat" onClick={() => router.push("/")} theme={theme} color="rose" />
                      <MenuAction icon={Smartphone} label="KTP Digital" desc="Kartu identitas" onClick={handleKTPClick} theme={theme} color="rose" />
                    </>
                  )}
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 pt-2">
                  <MenuAction icon={Settings} label="Pengaturan" desc="Akun & privasi" onClick={() => router.push("/pengaturan")} theme={theme} />
                  <MenuAction icon={LogOut} label="Keluar" desc="Akhiri sesi" onClick={handleLogout} theme={theme} danger disabled={isLoggingOut} />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <Modal isOpen={isKTPModalOpen} onClose={() => setIsKTPModalOpen(false)} theme={theme}>
        <KTPDigital user={user} role={role} theme={theme} onProfileUpdated={() => window.location.reload()} />
      </Modal>
    </div>
  );
}

// Komponen Tombol Menu
function MenuAction({ icon: Icon, label, desc, onClick, theme, danger, isActive, color = "orange", disabled }) {
  const colorMap = {
    purple: "group-hover:text-purple-500 group-hover:bg-purple-500/10",
    orange: "group-hover:text-orange-500 group-hover:bg-orange-500/10",
    rose: "group-hover:text-rose-500 group-hover:bg-rose-500/10",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all group
        ${isActive ? "bg-purple-500/10" : "hover:bg-slate-100 dark:hover:bg-white/5"}
        ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer active:scale-95"}
      `}
    >
      <div className={`p-2 rounded-xl transition-all
        ${danger ? "text-rose-500 bg-rose-500/10" : 
          isActive ? "bg-purple-500 text-white" :
          theme?.isMalam ? "text-slate-400 bg-slate-800 " + colorMap[color] : "text-slate-500 bg-slate-100 " + colorMap[color]}
      `}>
        <Icon size={18} />
      </div>
      <div className="flex-1 text-left min-w-0">
        <p className={`text-[12px] font-bold ${danger ? "text-rose-500" : theme?.isMalam ? "text-white" : "text-slate-800"}`}>
          {label}
        </p>
        <p className="text-[9px] text-slate-400 truncate leading-none mt-0.5">{desc}</p>
      </div>
    </button>
  );
}