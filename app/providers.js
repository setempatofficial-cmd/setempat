"use client";

import LocationProvider from "@/components/LocationProvider";

export function Providers({ children }) {
  return (
    <LocationProvider>
      {children}
    </LocationProvider>
  );
}