"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bell, Megaphone, Users, LayoutGrid } from "lucide-react";
import { useTheme } from "@/app/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabaseClient";

import TabKentongan from "./TabKentongan";
import TabWarungInfo from "./TabWarungInfo";
import TabKampungKita from "./TabKampungKita";
import TabSemua from "./TabSemua";  

export default function WoroContent() {
  const router = useRouter();
  const theme = useTheme();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("semua");  
  const [unreadCount, setUnreadCount] = useState(0);
  const isMalam = theme.isMalam;

  // Sinkronisasi jumlah unread secara Realtime
  useEffect(() => {
    if (!user?.id) return;

    let channel;

    const fetchInitialUnread = async () => {
      try {
        const { count, error } = await supabase
          .from("warung_info") // Disamakan dengan tabel di TabWarungInfo
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("is_read", false);

        if (!error) setUnreadCount(count || 0);
      } catch (err) {
        console.error("Gagal ambil unread:", err);
      }
    };

    fetchInitialUnread();

    // Setup channel dengan ID unik untuk mencegah error 'stolen lock'
    channel = supabase
      .channel(`woro_count_${user.id}`)
      .on(
        "postgres_changes",
        { 
          event: "INSERT", 
          schema: "public", 
          table: "warung_info", 
          filter: `user_id=eq.${user.id}` 
        },
        () => setUnreadCount(prev => prev + 1)
      )
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Gunakan useMemo agar array tabs tidak dibuat ulang setiap render
  const tabs = useMemo(() => [
    { id: "semua", name: "Semua", icon: <LayoutGrid size={14} /> },
    { id: "kentongan", name: "Kentongan", icon: <Megaphone size={14} /> },
    { id: "warung", name: "Warung Info", icon: <Bell size={14} />, badge: unreadCount },
    { id: "kampung", name: "Kampung Kita", icon: <Users size={14} /> },
  ], [unreadCount]);

  const renderContent = () => {
    const props = { theme, user };
    switch(activeTab) {
      case "semua": return <TabSemua {...props} />;
      case "kentongan": return <TabKentongan theme={theme} />;
      case "warung": return <TabWarungInfo theme={theme} onUnreadCountChange={setUnreadCount} />;
      case "kampung": return <TabKampungKita {...props} />;
      default: return null;
    }
  };

  return (
    <main className={`relative min-h-screen ${theme.bg}`}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-inherit border-b border-slate-200/10">
        <div className="mx-auto w-[92%] max-w-[400px]">
          <div className="flex items-center gap-3 py-3">
            <button
              onClick={() => router.back()}
              className={`p-2 rounded-full transition-all active:scale-95 ${isMalam ? "hover:bg-white/10" : "hover:bg-slate-100"}`}
            >
              <ArrowLeft size={18} className={theme.text} />
            </button>
            <h1 className={`text-base font-semibold ${theme.text}`}>Woro-Woro</h1>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="mx-auto w-[92%] max-w-[400px]">
        <div className="flex gap-1 py-2 overflow-x-auto scrollbar-none snap-x">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === "warung") setUnreadCount(0);
              }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap snap-start
                ${activeTab === tab.id 
                  ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" 
                  : isMalam 
                    ? "text-slate-400 hover:text-white hover:bg-white/10" 
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                }`}
            >
              {tab.icon}
              <span>{tab.name}</span>
              {tab.badge > 0 && activeTab !== tab.id && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold animate-pulse">
                  {tab.badge > 99 ? "99+" : tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content Area */}
      <div className="mx-auto w-[92%] max-w-[400px] mt-4 pb-24">
        {renderContent()}
      </div>
    </main>
  );
}