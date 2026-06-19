"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Home, Bell, Store, MonitorPlay, RefreshCw } from "lucide-react";
import { useTheme } from "@/app/hooks/useTheme";
import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";

export default function SmartBottomNav({
  onOpenLaporanForm,
  onOpenNotification,
  onOpenProfile,
  onOpenUpload,
  onRefreshFeed,
  onOpenLiveStream,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isMalam } = useTheme();
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState("");
  const [mounted, setMounted] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pressingTab, setPressingTab] = useState(null);
  const [isLiveActive, setIsLiveActive] = useState(false);

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

  // Cek status Live
  useEffect(() => {
    const checkLiveStatus = async () => {
      try {
        const { data, error } = await supabase
          .from("live_streams")
          .select("is_active")
          .eq("is_active", true)
          .single();

        if (data) {
          setIsLiveActive(true);
        } else {
          setIsLiveActive(false);
        }
      } catch (err) {
        console.error("Error checking live status:", err);
        setIsLiveActive(false);
      }
    };

    checkLiveStatus();

    const channel = supabase
      .channel('live_status')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'live_streams'
      }, () => checkLiveStatus())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Sinkronisasi dari URL Pathname
  useEffect(() => {
    if (pathname === "/") setActiveTab("Home");
    else if (pathname.startsWith("/explore") || pathname.startsWith("/search")) setActiveTab("Ronda");
    else if (pathname.startsWith("/woro")) setActiveTab("Woro");
    else if (
      pathname.startsWith("/peken") ||
      pathname.startsWith("/rewang") ||
      pathname.startsWith("/panyangan")
    ) {
      setActiveTab("Peken");
    } else if (pathname.startsWith("/live")) {
      setActiveTab("Live");
    }
  }, [pathname]);

  const handleHomePress = async () => {
    if (pathname === "/") {
      if (isRefreshing) return;
      setIsRefreshing(true);

      if (onRefreshFeed) {
        await onRefreshFeed();
      } else {
        window.dispatchEvent(new CustomEvent("refresh-feed"));
      }
      setTimeout(() => setIsRefreshing(false), 1000);
    } else {
      router.push("/");
    }
  };

  const handleNavigation = async (tabId) => {
    setPressingTab(tabId);
    setTimeout(() => setPressingTab(null), 150);

    switch (tabId) {
      case "Home":
        await handleHomePress();
        break;
      case "Ronda":
        router.push("/explore");
        break;
      case "Woro":
        if (onOpenNotification) onOpenNotification();
        else router.push("/woro");
        break;
      case "Peken":
        router.push("/peken");
        break;
      case "Live":
        handleLivePress();
        break;
    }
  };

  const handleLivePress = () => {
    if (typeof window !== "undefined") {
      if (onOpenLiveStream) {
        onOpenLiveStream();
      } else {
        router.push("/live");
      }
    }
  };

  if (!mounted) return null;

  // Ikon Kamera Live standar IG/TikTok (Diperbesar sedikit stroke-nya & warna lebih hidup)
  const LiveIcon = ({ active }) => (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? "#FFFFFF" : isMalam ? "#E2E8F0" : "#475569"}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M23 7l-7 5 7 5V7z" fill={active ? "#FFFFFF" : "none"} />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" fill={active ? "#FFFFFF" : "none"} />
    </svg>
  );

  const tabs = [
    { id: "Home", icon: <Home size={22} />, label: "Home" },
    { id: "Ronda", icon: <MonitorPlay size={22} />, label: "Ronda" },
    { id: "Live", isAction: true },
    { id: "Woro", icon: <Bell size={22} />, label: "Woro", badge: unreadCount },
    { id: "Peken", icon: <Store size={22} />, label: "Peken" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] flex justify-center pointer-events-none">
      <nav
        className={`
          relative flex items-center justify-around w-full max-w-[400px] 
          h-[75px] px-2 pointer-events-auto
          backdrop-blur-2xl border-t transition-all duration-300
          rounded-t-xl
          ${isMalam
            ? "bg-[#0C0C0C]/95 border-white/10 shadow-[0_-8px_30px_rgba(0,0,0,0.5)]"
            : "bg-white/95 border-slate-200 shadow-[0_-8px_30px_rgba(0,0,0,0.06)]"}
        `}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const isHomeRefreshing = tab.id === "Home" && isRefreshing && pathname === "/";
          const isCurrentPressing = pressingTab === tab.id;

          // 1. GUNAKAN IF SEPERTI INI (JANGAN PAKAI KURUNG KURAWAL {} DAN &&)
          if (tab.isAction) {
            return (
              <div key="action-live-container" className="relative w-14 flex justify-center">
                <button
                  onClick={handleLivePress}
                  className="absolute -top-7 flex items-center justify-center w-14 h-14
            rounded-2xl active:scale-90 transition-all duration-200 border-[6px]"
                  style={{
                    background: isLiveActive
                      ? 'linear-gradient(to bottom right, #dc2626, #f43f5e)'
                      : isMalam
                        ? 'linear-gradient(to bottom right, #404040, #404040)'
                        : 'linear-gradient(to bottom right, #e2e8f0, #f1f5f9)',
                    color: isLiveActive ? '#ffffff' : isMalam ? '#a3a3a3' : '#64748b',
                    borderColor: isLiveActive ? '#0C0C0C' : isMalam ? '#0C0C0C' : '#ffffff',
                    boxShadow: isLiveActive ? '0 0 20px rgba(220, 38, 38, 0.4)' : 'none',
                    animation: isLiveActive ? 'pulse 2s infinite' : 'none',
                    pointerEvents: 'auto',
                  }}
                  aria-label="Lihat LIVE"
                >
                  <div className="relative flex items-center justify-center">
                    <LiveIcon active={isLiveActive} />
                    {isLiveActive && (
                      <span className="absolute -top-1 -right-1 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                      </span>
                    )}
                  </div>
                </button>
              </div>
            );
          }


          // RENDER TAB NORMAL
          return (
            <button
              key={tab.id}
              onClick={() => handleNavigation(tab.id)}
              className={`
                relative flex flex-col items-center justify-center flex-1 h-full pt-2 pb-1.5
                transition-transform duration-150
                ${isCurrentPressing ? 'scale-95' : 'scale-100'}
              `}
            >
              <div
                className={`relative transition-all duration-300
                  ${isActive
                    ? "text-orange-500 -translate-y-0.5"
                    : isMalam ? "text-white/60" : "text-slate-400"}`}
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
                ${isActive ? "text-orange-500 opacity-100" : "opacity-0 h-0 overflow-hidden mt-0"}`}
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