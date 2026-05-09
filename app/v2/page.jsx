"use client";

import { useState, useEffect, useCallback } from "react";
import { Providers } from "../providers";
import { useTheme } from "../hooks/useTheme";
import { useLocation } from "@/components/LocationProvider";
import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { processFeedItem } from "@/lib/feedEngine";

// Components
import Header from "@/components/Header";
import SmartBottomNav from "@/app/components/layout/SmartBottomNav";
import DynamicHero from "@/components/v2/DynamicHero";
import StoryStrip from "@/components/v2/StoryStrip";
import AIInsight from "@/components/v2/AIInsight";
import UpdateSekitar from "@/components/v2/UpdateSekitar";

import { getProminentPlacesInRadius } from "@/lib/v2/storyFilter";

function HomeContentV2() {
  const theme = useTheme();
  const { location, status, placeName, requestLocation } = useLocation();
  const { user } = useAuth();
  const locationReady = status === "granted" && location?.latitude && location?.longitude;
  
  // ✅ State dengan default value array kosong
  const [activeTempat, setActiveTempat] = useState(null);
  const [storyPlaces, setStoryPlaces] = useState([]);  // ✅ array kosong
  const [allTempat, setAllTempat] = useState([]);      // ✅ array kosong
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  
  const STORY_RADIUS = 5;
  
  // Scroll detection
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  const fetchData = useCallback(async () => {
    if (!locationReady) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    
    try {
      const lat = location.latitude;
      const lng = location.longitude;
      const bufferRadius = 20;
      const latDelta = bufferRadius / 111;
      const lngDelta = bufferRadius / (111 * Math.cos(lat * Math.PI / 180));
      
      const { data, error } = await supabase
        .from("feed_view")
        .select("*");
      
      if (error) throw error;
      
      if (!data || data.length === 0) {
        setAllTempat([]);
        setStoryPlaces([]);
        setLoading(false);
        return;
      }
      
      // Proses setiap item dengan feedEngine V1
      const processedItems = data.map(item => 
        processFeedItem({ 
          item, 
          locationReady, 
          location: { latitude: lat, longitude: lng },
          comments: {} 
        })
      );
      
      // Filter yang memiliki jarak
      const itemsWithDistance = processedItems.filter(item => item.distance !== null);
      
      setAllTempat(itemsWithDistance);
      
      const prominentPlaces = getProminentPlacesInRadius(
        itemsWithDistance,
        { latitude: lat, longitude: lng },
        STORY_RADIUS
      );
      
      // ✅ Pastikan prominentPlaces adalah array
      setStoryPlaces(Array.isArray(prominentPlaces) ? prominentPlaces : []);
      
      // Set active tempat
      if (!activeTempat && prominentPlaces && prominentPlaces.length > 0) {
        setActiveTempat(prominentPlaces[0]);
      }
      
    } catch (err) {
      console.error("Error fetching V2 data:", err);
      setAllTempat([]);
      setStoryPlaces([]);
    } finally {
      setLoading(false);
    }
  }, [locationReady, location, activeTempat]);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  const handleStorySelect = useCallback((tempat) => {
    if (tempat) {
      setActiveTempat(tempat);
      document.getElementById('dynamic-hero')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);
  
  const handleFeedSelect = useCallback((tempat) => {
    if (tempat) {
      setActiveTempat(tempat);
      document.getElementById('dynamic-hero')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);
  
  const handleSwipe = useCallback((direction) => {
    if (!storyPlaces || storyPlaces.length === 0 || !activeTempat) return;
    
    const currentIndex = storyPlaces.findIndex(p => p?.id === activeTempat.id);
    if (currentIndex === -1) return;
    
    if (direction === 'left') {
      const nextIndex = (currentIndex + 1) % storyPlaces.length;
      setActiveTempat(storyPlaces[nextIndex]);
    } else if (direction === 'right') {
      const prevIndex = (currentIndex - 1 + storyPlaces.length) % storyPlaces.length;
      setActiveTempat(storyPlaces[prevIndex]);
    }
  }, [storyPlaces, activeTempat]);
  
  // ✅ Loading state
  if (!locationReady) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme.bg} ${theme.text}`}>
        <div className="text-center px-6">
          <div className="text-5xl mb-4">📍</div>
          <h2 className="text-lg font-semibold mb-2">Aktifkan Lokasi</h2>
          <p className="text-sm opacity-60 mb-6">Izinkan akses lokasi untuk melihat update di sekitarmu</p>
          <button 
            onClick={() => requestLocation('gps')} 
            className="px-6 py-3 bg-cyan-500 rounded-full font-semibold"
          >
            Aktifkan Lokasi
          </button>
        </div>
      </div>
    );
  }
  
  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme.bg} ${theme.text}`}>
        <div className="text-center">
          <div className="relative flex items-center justify-center">
            <div className="absolute animate-ping h-12 w-12 rounded-full bg-cyan-500 opacity-20"></div>
            <div className="relative h-8 w-8 border-4 border-t-cyan-500 border-r-transparent border-b-cyan-500 border-l-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-sm opacity-60 mt-4">Memuat Setempat...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`relative min-h-screen w-full ${theme.bg} ${theme.text} transition-colors duration-300`}>
      <Header
        user={user}
        locationReady={locationReady}
        villageLocation={placeName || "Pilih Lokasi"}
        isScrolled={isScrolled}
        onOpenLocationModal={() => {}}
        onShowStatistik={() => {}}
        onOpenAuthModal={() => {}}
      />
      
      {/* Ambient effects */}
      {theme.isMalam && (
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-15%] left-[-10%] w-[120%] h-[50%] rounded-full opacity-[0.07] blur-[120px]" style={{ backgroundColor: '#3b82f6' }} />
          <div className="absolute bottom-[-10%] right-[-10%] w-[100%] h-[40%] rounded-full opacity-[0.05] blur-[100px]" style={{ backgroundColor: '#8b5cf6' }} />
        </div>
      )}
      
      <div className="relative z-10 pb-24">
        <div className="max-w-md mx-auto px-4 pt-4">
          {/* ✅ Pastikan storyPlaces adalah array */}
          <StoryStrip 
            places={storyPlaces || []}
            activePlace={activeTempat}
            onSelectPlace={handleStorySelect}
            theme={theme}
            locationReady={locationReady}
          />
          
          <div id="dynamic-hero">
            <DynamicHero 
              tempat={activeTempat}
              onSwipe={handleSwipe}
              onRefresh={fetchData}
              refreshing={refreshing}
              theme={theme}
            />
          </div>
          
          <AIInsight 
            activeTempat={activeTempat}
            theme={theme}
          />
          
          <UpdateSekitar 
            allPlaces={allTempat || []}
            onSelectPlace={handleFeedSelect}
            theme={theme}
            currentUser={user}
            title="Update Sekitar"
          />
        </div>
      </div>
      
      <SmartBottomNav />
    </div>
  );
}

export default function V2TestPage() {
  return (
    <Providers>
      <HomeContentV2 />
    </Providers>
  );
}