// components/feed/FeedContent.jsx
"use client";
import React, { useState, useEffect, lazy, Suspense } from "react";
import { motion, LayoutGroup } from "framer-motion";
import HeroCard from "../HeroCard";
import StoryStrip from "../StoryStrip";
import LiveInsight from "../LiveInsight";
import { useTheme } from "@/app/hooks/useTheme";

import FeedCardWrapper from "@/components/FeedCardWrapper";
import FormLaporanAktif from "@/app/components/modals/FormLaporanAktif";
import SmartBottomNav from "@/app/components/layout/SmartBottomNav";

// Import komponen yang hilang (atau buat sederhana dulu)

const PullToRefreshIndicator = () => <div>Loading...</div>;
const SkeletonLoader = () => <div>Loading skeleton...</div>;
const BreakCard = ({ type, level, data, onClick }) => <div>Break Card</div>;
const ToastMessage = ({ show, message }) => show && <div>{message}</div>;
const EndOfFeed = () => <div>End of feed</div>;
const LoadingMore = () => <div>Loading more...</div>;

export default function FeedContent() {
  const theme = useTheme();
  
  // ✅ Definisikan semua state yang dibutuhkan
  const [villageLocation, setVillageLocation] = useState("Desa");
  const [feedOpacity, setFeedOpacity] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [orderedIds, setOrderedIds] = useState([]);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "" });
  
  // ✅ Definisikan data feed
  const [feedItemsWithBreaks, setFeedItemsWithBreaks] = useState([]);

  // Effect untuk load data
  useEffect(() => {
    // Fetch your data here
    setInitialLoad(false);
  }, []);

  return (
    <div className="flex flex-col w-full max-w-md mx-auto pb-20">
      {/* SECTION 1: VISUAL JANGKAR (V2) */}
      <section className="relative z-20">
        <HeroCard theme={theme} />
      </section>

      {/* SECTION 2: NAVIGASI WILAYAH (V2) */}
      <section className="mt-2 relative z-20">
        <StoryStrip theme={theme} />
      </section>

      {/* SECTION 3: RADAR AKTIVITAS (V2 - CLICKABLE) */}
      <section className="mt-1 px-2 relative z-20">
        <LiveInsight 
          theme={theme} 
          locationName={villageLocation} 
          tempatId="pusat-kota" 
        />
      </section>

      {/* SECTION 4: MAIN FEED */}
      <section 
        className="mt-6 px-4 transition-opacity duration-500" 
        style={{ opacity: feedOpacity }}
      >
        <div className="flex items-center justify-between mb-6 px-2">
          <h2 className="text-[11px] font-black tracking-[0.2em] uppercase opacity-40">
            Jelajah {villageLocation}
          </h2>
          <div className="h-[1px] flex-1 bg-white/5 mx-4" />
        </div>

        <PullToRefreshIndicator refreshing={refreshing} />
        
        <div className="space-y-6">
          {initialLoad ? (
            <SkeletonLoader />
          ) : (
            <LayoutGroup>
              {feedItemsWithBreaks.map((item, index) => (
                <motion.div key={item.id} layout>
                  {item._isBreak ? (
                    <BreakCard 
                      type={item.type} 
                      level={item.level} 
                      data={item.data} 
                      onClick={item.onClick} 
                    />
                  ) : (
                    <FeedCardWrapper
                      item={item}
                      index={index}
                      user={user}
                      isAdmin={isAdmin}
                      theme={theme}
                    />
                  )}
                </motion.div>
              ))}
            </LayoutGroup>
          )}
        </div>

        {loading && <LoadingMore />}
        {!hasMore && orderedIds.length > 0 && <EndOfFeed />}
      </section>

      <ToastMessage show={toast.show} message={toast.message} />
    </div>
  );
} // ✅ Sekarang benar