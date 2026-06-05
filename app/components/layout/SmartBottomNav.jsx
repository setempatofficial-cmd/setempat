"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Home, Compass, Plus, Bell, Store, RefreshCw } from "lucide-react";
import { useTheme } from "@/app/hooks/useTheme";
import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";

export default function SmartBottomNav({
  onOpenLaporanForm,
  onOpenNotification,
  onOpenProfile,
  onOpenUpload,
  onRefreshFeed,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isMalam } = useTheme();
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState("");
  const [mounted, setMounted] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pressingTab, setPressingTab] = useState(null); // ✅ Diubah ke ID Tab agar tidak nge-scale semua tombol

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

  // ✅ Sinkronisasi murni dari URL Pathname (Source of Truth tunggal)
  useEffect(() => {
    if (pathname === "/") setActiveTab("Home");
    else if (pathname.startsWith("/explore") || pathname.startsWith("/search")) setActiveTab("Sekitar");
    else if (pathname.startsWith("/woro")) setActiveTab("Woro");
    else if (
      pathname.startsWith("/peken") ||
      pathname.startsWith("/rewang") ||
      pathname.startsWith("/panyangan")
    ) {
      setActiveTab("Peken");
    }
  }, [pathname]);

  useEffect(() => {
    const triggerUpload = () => {
      if (onOpenUpload) onOpenUpload();
      else if (onOpenLaporanForm) onOpenLaporanForm();
    };

    window.addEventListener("trigger-open-upload", triggerUpload);
    return () => window.removeEventListener("trigger-open-upload", triggerUpload);
  }, [onOpenUpload, onOpenLaporanForm]);

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

  // ✅ Pindah Halaman Bersih tanpa merusak State Internal sebelum URL berubah
  const handleNavigation = async (tabId) => {
    setPressingTab(tabId);
    setTimeout(() => setPressingTab(null), 150);

    switch (tabId) {
      case "Home":
        await handleHomePress();
        break;
      case "Sekitar":
        // Gunakan router bawaan Next agar tumpukan history tersinkronisasi dengan baik
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

  const handleLapor = () => {
    if (typeof window !== "undefined") {
      if (isSuperAdmin || isAdmin) {
        window.dispatchEvent(new CustomEvent("open-admin-upload-options"));
      } else {
        onOpenLaporanForm?.() || window.dispatchEvent(new CustomEvent("open-laporan-form"));
      }
    }
  };

  if (!mounted) return null;

  const tabs = [
    { id: "Home", icon: <Home size={22} />, label: "Home" },
    { id: "Sekitar", icon: <Compass size={22} />, label: "Sekitar" },
    ...(canUpload ? [{ id: "Lapor", isAction: true }] : []),
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
          const isCurrentPressing = pressingTab === tab.id; // ✅ Cek hanya tab ini yang ditekan

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
                ${isCurrentPressing ? 'scale-95' : 'scale-100'}
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