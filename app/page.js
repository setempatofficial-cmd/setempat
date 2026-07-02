// app/page.js - Versi Smooth dengan Transisi
'use client'

import { Providers } from "./providers";
import FeedContent from "./components/feed/FeedContent";
import { useTheme } from "@/app/hooks/useTheme";

function HomeContent() {
  const theme = useTheme();
  const { isMalam, isClient } = theme;

  return (
    <div
      suppressHydrationWarning
      className={`relative min-h-screen w-full ${theme.bg} ${theme.text} transition-colors duration-700 selection:bg-red-500/30`}
    >
      {/* Background base */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/5 to-transparent" />
      </div>

      {/* Efek malam - selalu ada di DOM, diatur via CSS */}
      <div
        className="fixed inset-0 z-0 pointer-events-none overflow-hidden transition-opacity duration-700"
        style={{
          opacity: isClient && isMalam ? 0.3 : 0,
        }}
        suppressHydrationWarning
      >
        <div
          className="absolute top-[-15%] left-[-10%] w-[120%] h-[50%] rounded-full opacity-[0.07] blur-[120px]"
          style={{ backgroundColor: '#3b82f6' }}
          suppressHydrationWarning
        />
        <div
          className="absolute bottom-[-10%] right-[-10%] w-[100%] h-[40%] rounded-full opacity-[0.05] blur-[100px]"
          style={{ backgroundColor: '#8b5cf6' }}
          suppressHydrationWarning
        />
      </div>

      <div className="relative z-10">
        <FeedContent />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Providers>
      <HomeContent />
    </Providers>
  );
}