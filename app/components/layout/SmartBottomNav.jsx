"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Home, Compass, Plus, Bell, Contact2 } from "lucide-react";
import { useTheme } from "@/app/hooks/useTheme";
import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";

export default function SmartBottomNav({ onOpenLaporanForm, onOpenNotification, onOpenProfile, onOpenUpload }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isMalam } = useTheme();
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState("");
  const [mounted, setMounted] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Ambil jumlah notifikasi yang belum dibaca dari warung_info
  useEffect(() => {
    if (!user?.id) return;

    const fetchUnreadCount = async () => {
      try {
        // Hitung notifikasi yang belum dibaca dari warung_info
        const { count, error } = await supabase
          .from("warung_info")
          .select("*", { count: 'exact', head: true })
          .eq("user_id", user.id)
          .eq("is_read", false);
        
        if (error) throw error;
        setUnreadCount(count || 0);
      } catch (err) {
        console.error("Error fetching unread count:", err);
        setUnreadCount(0);
      }
    };

    fetchUnreadCount();

    // Subscribe ke perubahan is_read di warung_info untuk user ini
    const channel = supabase
      .channel(`unread_count_${user.id}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'warung_info',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        // Hanya refresh jika ada perubahan is_read
        if (payload.new && typeof payload.new.is_read !== 'undefined') {
          fetchUnreadCount();
        }
      })
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'warung_info',
        filter: `user_id=eq.${user.id}`
      }, () => {
        // Notifikasi baru masuk
        fetchUnreadCount();
      })
      .subscribe();

    return () => { 
      supabase.removeChannel(channel); 
    };
  }, [user?.id]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const canUpload = isSuperAdmin || isAdmin;

  useEffect(() => {
    if (pathname === "/") setActiveTab("Home");
    else if (pathname === "/search" || pathname === "/explore") setActiveTab("Sekitar");
    else if (pathname.startsWith("/woro")) setActiveTab("Woro");
    else if (pathname.startsWith("/rewang")) setActiveTab("Rewang");
  }, [pathname]);

  const handleNavigation = (tabId) => {
    setActiveTab(tabId);
    switch (tabId) {
      case "Home": router.push("/"); break;
      case "Sekitar": router.push("/explore"); break;
      case "Woro": 
        if (onOpenNotification) onOpenNotification();
        else router.push("/woro");
        break;
      case "Rewang": 
        if (onOpenProfile) onOpenProfile();
        else router.push("/rewang");
        break;
    }
  };

  const handleLapor = () => {
    if (typeof window !== "undefined") {
      if (onOpenUpload) onOpenUpload();
      else if (onOpenLaporanForm) onOpenLaporanForm();
      else {
        window.scrollTo({ top: 0, behavior: "smooth" });
        window.dispatchEvent(new CustomEvent("open-laporan-form"));
      }
    }
  };

  if (!mounted) return null;

  const tabs = [
    { id: "Home", icon: <Home size={22} />, label: "Home" },
    { id: "Sekitar", icon: <Compass size={22} />, label: "Sekitar" },
    ...(canUpload ? [{ id: "Lapor", isAction: true }] : []),
    { id: "Woro", icon: <Bell size={22} />, label: "Woro", badge: unreadCount },
    { id: "Rewang", icon: <Contact2 size={22} />, label: "Rewang" },
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

          if (tab.isAction) {
            return (
              <div key="action-lapor-container" className="relative w-14 flex justify-center">
                <button
                  onClick={handleLapor}
                  className={`absolute -top-7 flex items-center justify-center w-14 h-14
                    bg-gradient-to-br from-orange-500 to-amber-400 
                    rounded-2xl shadow-xl shadow-orange-500/40 active:scale-90 transition-all duration-200
                    border-[6px] ${isMalam ? "border-[#0C0C0C]" : "border-white"}`}
                >
                  <Plus className="text-black" strokeWidth={3} size={28} />
                </button>
              </div>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => handleNavigation(tab.id)}
              className="relative flex flex-col items-center justify-center flex-1 h-full pt-1"
            >
              <div
                className={`relative transition-all duration-300
                  ${isActive 
                    ? "text-orange-500 -translate-y-0.5" 
                    : isMalam ? "text-white/40" : "text-slate-400"}`}
              >
                {tab.icon}
                
                {/* BADGE NOTIFIKASI - Hanya tampil jika ada notifikasi belum dibaca */}
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