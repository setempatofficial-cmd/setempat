"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Home, Compass, Plus, Bell, Contact2, RefreshCw } from "lucide-react";
import { useTheme } from "@/app/hooks/useTheme";
import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";

export default function SmartBottomNav({ 
  onOpenLaporanForm, 
  onOpenNotification, 
  onOpenProfile, 
  onOpenUpload,
  onRefreshFeed,  // Props untuk refresh feed
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isMalam } = useTheme();
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState("");
  const [mounted, setMounted] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPressing, setIsPressing] = useState(false); // ✅ State untuk sentuhan

  // Ambil jumlah notifikasi yang belum dibaca
  useEffect(() => {
    if (!user?.id) return;

    const fetchUnreadCount = async () => {
      try {
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

    const channel = supabase
      .channel(`unread_count_${user.id}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'warung_info',
        filter: `user_id=eq.${user.id}`
      }, () => fetchUnreadCount())
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'warung_info',
        filter: `user_id=eq.${user.id}`
      }, () => fetchUnreadCount())
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

  // ✅ FUNGSI REFRESH DENGAN FEEDBACK VISUAL
  const handleHomePress = async () => {
    // Jika sudah di halaman home, lakukan refresh
    if (pathname === "/") {
      if (isRefreshing) return; // Cegah double refresh
      
      setIsRefreshing(true);
      
      // Trigger refresh
      if (onRefreshFeed) {
        await onRefreshFeed();
      } else {
        window.dispatchEvent(new CustomEvent("refresh-feed"));
      }
      
      // Animasi refresh selesai setelah 1 detik
      setTimeout(() => setIsRefreshing(false), 1000);
    } else {
      // Jika tidak di home, navigasi ke home
      router.push("/");
    }
  };

  // ✅ HANDLE NAVIGASI DENGAN FEEDBACK SENTUHAN
  const handleNavigation = async (tabId) => {
    setActiveTab(tabId);
    
    // Feedback sentuhan: scale effect
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
    { id: "Home", icon: <Home size={22} />, refreshIcon: <RefreshCw size={22} />, label: "Home" },
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
          const isHomeRefreshing = tab.id === "Home" && isRefreshing && pathname === "/";

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
                {/* ✅ Tampilkan icon refresh berputar saat proses refresh di home */}
                {isHomeRefreshing ? (
                  <RefreshCw size={22} className="animate-spin" />
                ) : (
                  tab.icon
                )}
                
                {/* BADGE NOTIFIKASI */}
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