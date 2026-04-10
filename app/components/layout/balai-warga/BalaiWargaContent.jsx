"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bell, Megaphone, Users } from "lucide-react";
import { useTheme } from "@/app/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import TabKentongan from "./TabKentongan";
import TabWarungInfo from "./TabWarungInfo";
import TabKampungKita from "./TabKampungKita";

export default function BalaiWargaContent() {
  const router = useRouter();
  const theme = useTheme();
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState("kentongan");
  const [unreadCount, setUnreadCount] = useState(0);

  const isMalam = theme.isMalam;

  const tabs = [
    { id: "kentongan", name: "Kentongan", icon: <Megaphone size="14" /> },
    { id: "warung", name: "Warung Info", icon: <Bell size="14" />, badge: unreadCount },
    { id: "kampung", name: "Kampung Kita", icon: <Users size="14" /> },
  ];

  const renderContent = () => {
    switch(activeTab) {
      case "kentongan":
        return <TabKentongan theme={theme} />;
      case "warung":
        return <TabWarungInfo theme={theme} onUnreadCountChange={setUnreadCount} />;
      case "kampung":
        return <TabKampungKita theme={theme} userLocation={profile} />;
      default:
        return null;
    }
  };

  return (
    <main className={`relative min-h-screen ${theme.bg}`}>
      {/* Header dengan tombol back */}
      <div className="sticky top-0 z-10 bg-inherit border-b border-slate-200/10">
        <div className="mx-auto w-[92%] max-w-[400px]">
          <div className="flex items-center gap-3 py-3">
            <button
              onClick={() => router.back()}
              className={`p-2 rounded-full transition-all active:scale-95
                ${isMalam ? "hover:bg-white/10" : "hover:bg-slate-100"}`}
            >
              <ArrowLeft size="18" className={theme.text} />
            </button>
            <h1 className={`text-base font-semibold ${theme.text}`}>Balai Warga</h1>
          </div>
        </div>
      </div>

      {/* Tab Navigation - Sederhana seperti feed */}
      <div className="mx-auto w-[92%] max-w-[400px]">
        <div className="flex gap-1 py-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all
                ${activeTab === tab.id 
                  ? "bg-orange-500 text-white" 
                  : isMalam 
                    ? "text-slate-400 hover:text-white hover:bg-white/10" 
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                }`}
            >
              {tab.icon}
              <span>{tab.name}</span>
              {tab.badge > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto w-[92%] max-w-[400px] mt-4 pb-20">
        {renderContent()}
      </div>
    </main>
  );
}