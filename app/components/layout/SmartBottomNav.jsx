"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Home, Compass, Plus, Bell, Contact2 } from "lucide-react";
import { useTheme } from "@/app/hooks/useTheme";
import { useAuth } from "@/app/context/AuthContext"; // IMPORT AuthContext

export default function SmartBottomNav({ onOpenLaporanForm, onOpenNotification, onOpenProfile, onOpenUpload }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isMalam } = useTheme();
  const { userRole, isAdmin, isSuperAdmin } = useAuth(); // AMBIL ROLE DARI CONTEXT
  
  const [isVisible, setIsVisible] = useState(true);
  const timeoutRef = useRef(null);
  const [activeTab, setActiveTab] = useState("");

  // Cek apakah user bisa upload (superadmin atau admin)
  const canUpload = isSuperAdmin || isAdmin;

  // Set active tab berdasarkan pathname
  useEffect(() => {
    if (pathname === "/") {
      setActiveTab("Home");
    } else if (pathname === "/search" || pathname === "/explore") {
      setActiveTab("Sekitar");
    } else if (pathname.startsWith("/balai")) {
      setActiveTab("Woro");
    } else if (pathname.startsWith("/rewang")) {
      setActiveTab("Rewang");
    }
  }, [pathname]);

  // Scroll hide/show logic
  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(false);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        setIsVisible(true);
      }, 250);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const springTransition = {
    type: "spring",
    stiffness: 300,
    damping: 30,
    mass: 0.8
  };

  // Handler navigasi
  const handleNavigation = (tabId) => {
    setActiveTab(tabId);
    
    switch (tabId) {
      case "Home":
        router.push("/");
        break;
      case "Sekitar":
        router.push("/search");
        break;
      case "Woro":
        if (onOpenNotification) {
          onOpenNotification();
        } else {
          router.push("/balai-warga");
        }
        break;
      case "Rewang":
        if (onOpenProfile) {
          onOpenProfile();
        } else {
          router.push("/rewang");
        }
        break;
      default:
        break;
    }
  };

  const handleLapor = () => {
    // Prioritas: upload dulu untuk admin/superadmin
    if (onOpenUpload) {
      onOpenUpload();
    } else if (onOpenLaporanForm) {
      onOpenLaporanForm();
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
      window.dispatchEvent(new CustomEvent("open-laporan-form"));
    }
  };

  // DEFINE TABS BERDASARKAN ROLE
  const tabs = [
    { id: "Home", icon: <Home size={22} />, label: "Home", path: "/" },
    { id: "Sekitar", icon: <Compass size={22} />, label: "Sekitar", path: "/search" },
    // Tombol Lapor hanya muncul jika canUpload = true (superadmin atau admin)
    ...(canUpload ? [{ id: "Lapor", isAction: true }] : []),
    { id: "Woro", icon: <Bell size={22} />, label: "Woro", badge: 3, path: "/balai" },
    { id: "Rewang", icon: <Contact2 size={22} />, label: "Rewang", path: "/rewang" },
  ];

  useEffect(() => {

  }, [userRole, isAdmin, isSuperAdmin, canUpload]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={springTransition}
          className="fixed bottom-8 left-0 right-0 z-[100] flex justify-center px-6 pointer-events-none"
        >
          <nav className={`
            flex items-center justify-around w-full max-w-[400px] h-[76px] px-4 pointer-events-auto
            backdrop-blur-3xl border transition-all duration-500 rounded-[30px]
            ${isMalam 
              ? "bg-[#0C0C0C]/80 border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]" 
              : "bg-white/70 border-black/5 shadow-[0_20px_40px_rgba(0,0,0,0.1)]"}
          `}>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;

              if (tab.isAction) {
                return (
                  <button
                    key="action-lapor"
                    onClick={handleLapor}
                    className={`relative -top-10 flex items-center justify-center w-15 h-15 
                      bg-gradient-to-br from-orange-500 to-amber-400 rounded-2xl rotate-45
                      shadow-[0_15px_30px_rgba(249,115,22,0.4)] border-[5px] active:scale-90 transition-all duration-200
                      ${isMalam ? "border-[#050505]" : "border-white"}`}
                  >
                    <Plus className="-rotate-45 text-black" strokeWidth={4} size={28} />
                  </button>
                );
              }

              return (
                <button
                  key={tab.id}
                  onClick={() => handleNavigation(tab.id)}
                  className="relative flex flex-col items-center justify-center flex-1 h-full pt-1"
                >
                  <div className={`relative transition-all duration-300 ${
                    isActive 
                      ? "text-orange-500 -translate-y-1 scale-110" 
                      : (isMalam ? "text-white/30" : "text-slate-400")
                  }`}>
                    {tab.icon}
                    
                    {tab.badge && !isActive && (
                      <span className="absolute top-[-6px] right-[-2px] flex h-4 min-w-[16px] items-center justify-center 
                        rounded-full bg-red-600 px-1 text-[8px] font-black text-white 
                        border-[1.5px] border-black shadow-sm ring-0 pointer-events-none"
                      >
                        {tab.badge}
                      </span>
                    )}
                  </div>
                  
                  <span className={`text-[8px] font-black uppercase tracking-[0.2em] mt-1.5 transition-all duration-300 ${
                    isActive ? "opacity-100 translate-y-0 text-orange-500" : "opacity-0 translate-y-2"
                  }`}>
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </nav>
        </motion.div>
      )}
    </AnimatePresence>
  );
}