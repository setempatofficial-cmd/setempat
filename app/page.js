"use client";

import LocationProvider from "./components/LocationProvider";
import FeedContent from "./components/feed/FeedContent";


export default function Home() {
  return (
    <LocationProvider>
      {/* Container Utama: 
        - bg-[#050505] adalah hitam OLED (Mewah & Hemat Baterai)
        - min-h-screen memastikan background penuh se-layar HP
      */}
      <div className="relative min-h-screen w-full bg-[#050505] text-white selection:bg-red-500/30">
        
        {/* --- 1. AMBIENT BACKGROUND (Fixed & Subtle) --- */}
        {/* Ini yang bikin mewah tanpa bikin boros data/baterai */}
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
          {/* Semburan cahaya biru redup di atas */}
          <div 
            className="absolute top-[-15%] left-[-10%] w-[120%] h-[50%] rounded-full opacity-[0.07] blur-[120px]"
            style={{ backgroundColor: '#3b82f6' }} 
          />
          {/* Semburan cahaya ungu redup di bawah */}
          <div 
            className="absolute bottom-[-10%] right-[-10%] w-[100%] h-[40%] rounded-full opacity-[0.05] blur-[100px]"
            style={{ backgroundColor: '#8b5cf6' }} 
          />
        </div>

        {/* --- 2. CONTENT LAYER --- */}
        {/* z-10 memastikan FeedContent berada di atas cahaya ambient */}
        <div className="relative z-10">
          <FeedContent />
        </div>

      </div>
    </LocationProvider>
  );
}