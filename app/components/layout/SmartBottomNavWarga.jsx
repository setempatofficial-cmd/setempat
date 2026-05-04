"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Home, Compass, Plus, Bell, Store, RefreshCw } from "lucide-react";
import { useTheme } from "@/app/hooks/useTheme";

export default function SmartBottomNavWarga({ 
  onOpenLaporanForm,  // untuk warga buka form laporan
  onOpenNotification, 
  onRefreshFeed,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isMalam } = useTheme();
  const [activeTab, setActiveTab] = useState("");
  const [mounted, setMounted] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPressing, setIsPressing] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (pathname === "/") setActiveTab("Home");
    else if (pathname === "/search" || pathname === "/explore") setActiveTab("Sekitar");
    else if (pathname.startsWith("/woro")) setActiveTab("Woro");
    else if (
      pathname.startsWith("/peken") ||
      pathname.startsWith("/rewang") ||
      pathname.startsWith("/panyangan")
    ) {
      setActiveTab("Peken");
    }
  }, [pathname]);

  const handleHomePress = async () => {
    if (pathname === "/") {
      if (isRefreshing) return;
      setIsRefreshing(true);
      if (onRefreshFeed) await onRefreshFeed();
      setTimeout(() => setIsRefreshing(false), 1000);
    } else {
      router.push("/");
    }
  };

  const handleWargaLapor = () => {
    setIsPressing(true);
    setTimeout(() => setIsPressing(false), 150);
    
    // Langsung buka form laporan untuk warga
    if (onOpenLaporanForm) {
      onOpenLaporanForm();
    } else {
      window.dispatchEvent(new CustomEvent("open-laporan-form"));
    }
  };

  const handleNavigation = async (tabId) => {
    setActiveTab(tabId);
    setIsPressing(true);
    setTimeout(() => setIsPressing(false), 150);
    
    switch (tabId) {
      case "Home": 
        await handleHomePress();
        break;
      case "Sekitar": 
        router.push("/explore"); 
        break;
      case "Woro": 
        if (onOpenNotification) onOpenNotification();
        else router.push("/woro");
        break;
      case "Peken": 
        router.push("/peken");
        break;
    }
  };

  if (!mounted) return null;

  const tabs = [
    { id: "Home", icon: <Home size={22} />, label: "Home" },
    { id: "Sekitar", icon: <Compass size={22} />, label: "Sekitar" },
    { id: "WargaLapor", isAction: true }, // Tombol plus untuk warga
    { id: "Woro", icon: <Bell size={22} />, label: "Woro", badge: unreadCount },
    { id: "Peken", icon: <Store size={22} />, label: "Peken" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] flex justify-center pointer-events-none">
      <nav
        className={`
          relative flex items-center justify-around w-full max-w-[400px] 
          h-[70px] px-2 pointer-events-auto
          backdrop-blur-2xl border-t transition-all duration-300
          rounded-none 
          ${isMalam 
            ? "bg-[#0C0C0C]/95 border-white/10 shadow-[0_-4px_20px_rgba(0,0,0,0.4)]" 
            : "bg-white/95 border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]"}
        `}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const isHomeRefreshing = tab.id === "Home" && isRefreshing && pathname === "/";

          if (tab.isAction) {
            return (
              <div key="action-warga-container" className="relative w-14 flex justify-center">
                <button
                  onClick={handleWargaLapor}
                  className={`absolute -top-7 flex items-center justify-center w-14 h-14
                    bg-gradient-to-br from-orange-500 to-amber-400 
                    rounded-2xl shadow-xl shadow-orange-500/40 active:scale-90 transition-all duration-200
                    border-[6px] ${isMalam ? "border-[#0C0C0C]" : "border-white"}`}
                  aria-label="Buat Laporan"
                >
                  <Plus className="text-white" strokeWidth={3} size={28} />
                </button>
              </div>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => handleNavigation(tab.id)}
              className={`
                relative flex flex-col items-center justify-center flex-1 h-full pt-1
                transition-transform duration-150
                ${isPressing ? 'scale-95' : 'scale-100'}
              `}
            >
              <div
                className={`relative transition-all duration-300
                  ${isActive 
                    ? "text-orange-500 -translate-y-0.5" 
                    : isMalam ? "text-white/40" : "text-slate-400"}`}
              >
                {isHomeRefreshing ? (
                  <RefreshCw size={22} className="animate-spin" />
                ) : (
                  tab.icon
                )}
                
                {!isActive && tab.badge > 0 && (
                  <span className={`absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center 
                    rounded-full bg-red-600 px-1 text-[8px] font-black text-white 
                    ring-2 ${isMalam ? "ring-[#0C0C0C]" : "ring-white"}`}
                  >
                    {tab.badge > 99 ? "99+" : tab.badge > 9 ? "9+" : tab.badge}
                  </span>
                )}
              </div>
              
              <span className={`text-[9px] font-bold mt-1 transition-all duration-300
                  ${isActive ? "text-orange-500 opacity-100" : "opacity-0"}`}
              >
                {tab.label}
              </span>

              {isActive && (
                <div className="absolute bottom-0 w-8 h-[3px] bg-orange-500 rounded-t-full" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}