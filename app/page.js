"use client";

import { Providers } from "./providers";
import FeedContent from "./components/feed/FeedContent";
import { useTheme } from "@/hooks/useTheme";

// Konten utama yang pakai theme
function HomeContent() {
  const theme = useTheme();
  
  return (
    <div className={`relative min-h-screen w-full ${theme.bg} ${theme.text} transition-colors duration-300 selection:bg-red-500/30`}>
      
      {/* Ambient Effects - Hanya di Malam */}
      {theme.isMalam && (
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
          <div 
            className="absolute top-y[-15%] left-[-10%] w-[120%] h-[50%] rounded-full opacity-[0.07] blur-[120px]"
            style={{ backgroundColor: '#3b82f6' }} 
          />
          <div 
            className="absolute bottom-[-10%] right-[-10%] w-[100%] h-[40%] rounded-full opacity-[0.05] blur-[100px]"
            style={{ backgroundColor: '#8b5cf6' }} 
          />
        </div>
      )}

      {/* Ambient untuk Siang */}
      {!theme.isMalam && (
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden opacity-30">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/5 to-transparent" />
        </div>
      )}

      {/* Konten */}
      <div className="relative z-10">
        <FeedContent />
      </div>
    </div>
  );
}

// Halaman Utama
export default function Home() {
  return (
    <Providers>
      <HomeContent />
    </Providers>
  );
}