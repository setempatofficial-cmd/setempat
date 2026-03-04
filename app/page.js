"use client";

import LocationProvider from "./components/LocationProvider";
import FeedContent from "./components/feed/FeedContent";

export default function Home() {
  return (
    <LocationProvider>
      <FeedContent />
    </LocationProvider>
  );
}