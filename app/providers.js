"use client";

import LocationProvider from "@/components/LocationProvider";
import { TimeProvider } from "@/app/components/feed/FeedCard"; // ✅ IMPORT TimeProvider

export function Providers({ children }) {
  return (
    <LocationProvider>
      <TimeProvider>  {/* ✅ BUNGKUS dengan TimeProvider */}
        {children}
      </TimeProvider>
    </LocationProvider>
  );
}