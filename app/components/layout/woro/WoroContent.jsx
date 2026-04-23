"use client";

import { useState, useEffect, useMemo, useRef } from "react"; // ✅ Tambah useRef
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, Bell, Megaphone, Users, LayoutGrid, 
  Sparkles, Search 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/app/hooks/useTheme";
import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";

import SmartBottomNav from "@/app/components/layout/SmartBottomNav";
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
  
  // ✅ Ref untuk scroll container tabs
  const tabsContainerRef = useRef(null);
  const tabButtonsRef = useRef({});

  // ✅ Auto-scroll ke tab yang aktif
  useEffect(() => {
    const activeButton = tabButtonsRef.current[activeTab];
    const container = tabsContainerRef.current;
    
    if (activeButton && container) {
      // Hitung posisi scroll agar tab aktif terlihat di tengah
      const containerRect = container.getBoundingClientRect();
      const buttonRect = activeButton.getBoundingClientRect();
      
      const scrollLeft = buttonRect.left - containerRect.left + container.scrollLeft - 100;
      
      container.scrollTo({
        left: scrollLeft,
        behavior: 'smooth'
      });
    }
  }, [activeTab]);

  // ... useEffect untuk unreadCount tetap sama

  useEffect(() => {
    if (!user?.id) return;
    
    let isMounted = true;
    
    const fetchInitialUnread = async () => {
      const { count } = await supabase
        .from("warung_info")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      
      if (isMounted) {
        setUnreadCount(count || 0);
      }
    };

    fetchInitialUnread();

    const channel = supabase
      .channel(`woro_count_${user.id}`)
      .on("postgres_changes", { 
        event: "INSERT", 
        schema: "public", 
        table: "warung_info", 
        filter: `user_id=eq.${user.id}` 
      }, () => {
        if (isMounted) {
          setUnreadCount(prev => prev + 1);
        }
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "warung_info",
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        if (payload.new.is_read === true && isMounted) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      })
      .subscribe();

    return () => { 
      isMounted = false;
      supabase.removeChannel(channel); 
    };
  }, [user?.id]);

  const tabs = useMemo(() => [
    { id: "semua", name: "Semua", icon: <LayoutGrid size={14} /> },
    { id: "kentongan", name: "Kentongan", icon: <Megaphone size={14} /> },
    { id: "warung", name: "Warung Info", icon: <Bell size={14} />, badge: unreadCount },
    { id: "kampung", name: "Kampung Kita", icon: <Users size={14} /> },
  ], [unreadCount]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (tabId === "warung") {
      setUnreadCount(0);
    }
  };

  return (
    <main className={`relative min-h-screen pb-32 transition-colors duration-500 ${theme.bg}`}>
      
      {/* HEADER */}
      <div className={`sticky top-0 z-30 backdrop-blur-xl border-b transition-all ${
        isMalam ? "bg-[#111111]/80 border-white/5" : "bg-white/80 border-slate-100"
      }`}>
        <div className="mx-auto w-[92%] max-w-[400px]">
          <div className="flex flex-col gap-4 py-4">
            {/* Baris Atas */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.back()}
                  className={`p-2 rounded-xl transition-all active:scale-90 ${
                    isMalam ? "text-white" : "text-slate-900"
                  }`}
                >
                  <ArrowLeft size={20} />
                </button>
                <div>
                  <h1 className={`text-base font-[1000] tracking-tight ${theme.text}`}>
                    Woro-Woro
                  </h1>
                  <p className="text-[9px] font-black text-[#E3655B] uppercase tracking-[0.2em]">
                    Kabar Sekitarmu
                  </p>
                </div>
              </div>

              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${
                isMalam ? "bg-orange-500/10 border-orange-500/20" : "bg-orange-50 border-orange-100"
              }`}>
                <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
                <span className="text-[8px] font-black uppercase tracking-tighter text-orange-500">AI Live</span>
              </div>
            </div>
            
            {/* Search Bar */}
            <div 
              onClick={() => router.push("/search")}
              className={`group flex items-center gap-3 h-12 px-4 rounded-2xl border transition-all cursor-pointer ${
                isMalam 
                ? "bg-white/5 border-white/5 hover:border-white/10" 
                : "bg-slate-50 border-slate-100 hover:border-slate-200"
              }`}
            >
              <Search size={18} className="text-orange-500 group-hover:scale-110 transition-transform" />
              <span className={`flex-1 text-[11px] font-bold ${isMalam ? "text-slate-500" : "text-slate-400"}`}>
                Cari info kampung atau tanya AI...
              </span>
              <div className="flex items-center gap-1 bg-gradient-to-br from-[#E3655B] to-[#ff7d72] p-1.5 rounded-lg shadow-sm">
                <Sparkles size={12} className="text-white animate-pulse" />
              </div>
            </div>
          </div>

          {/* TABS dengan auto-scroll */}
          <div className="relative">
            <div 
              ref={tabsContainerRef}  // ✅ Tambahkan ref
              className="flex gap-3 pb-4 overflow-x-auto scrollbar-none snap-x px-1"
              style={{ scrollBehavior: 'smooth' }}
            >
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    ref={(el) => {
                      if (el) tabButtonsRef.current[tab.id] = el;  // ✅ Simpan ref setiap button
                    }}
                    onClick={() => {
                      setActiveTab(tab.id);
                      if (tab.id === "warung") setUnreadCount(0);
                    }}
                    className={`
                      relative flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-[1000] uppercase tracking-wider transition-all snap-start shrink-0
                      ${isActive 
                        ? "bg-gradient-to-br from-[#E3655B] to-[#ff7d72] text-white shadow-lg shadow-[#E3655B]/30 scale-105" 
                        : isMalam 
                          ? "bg-white/5 text-slate-400 border border-white/5" 
                          : "bg-slate-100 text-slate-500 border border-slate-200/50"
                      }
                    `}
                  >
                    {tab.icon}
                    <span>{tab.name}</span>
                    {tab.badge > 0 && !isActive && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[8px] font-black text-white ring-[3px] ring-[#111111]">
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
              <div className="min-w-[20px] shrink-0" />
            </div>
            {/* Fade Indicator */}
            <div className={`absolute right-0 top-0 bottom-4 w-12 pointer-events-none bg-gradient-to-l z-10 ${
              isMalam ? "from-[#111111]" : "from-white"
            }`} />
          </div>
        </div>
      </div>

      {/* CONTENT AREA */}
      <div className="mx-auto w-[92%] max-w-[400px] mt-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "semua" && (
              <TabSemua 
                theme={theme} 
                user={user} 
                onTabChange={handleTabChange}
              />
            )}
            {activeTab === "kentongan" && <TabKentongan theme={theme} />}
            {activeTab === "warung" && (
              <TabWarungInfo 
                theme={theme} 
                user={user} 
                onUnreadCountChange={setUnreadCount} 
              />
            )}
            {activeTab === "kampung" && <TabKampungKita theme={theme} user={user} />}
          </motion.div>
        </AnimatePresence>
      </div>

      <SmartBottomNav 
        activeNav="notif" 
        onOpenNotification={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        onOpenProfile={() => router.push("/rewang")}
      />
    </main>
  );
}