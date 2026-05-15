"use client";

import { useState, useEffect, useCallback } from "react";
import { Providers } from "../providers";
import { useTheme } from "../hooks/useTheme";
import { useLocation } from "@/components/LocationProvider";
import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { processFeedItem } from "@/lib/feedEngine";

// ✅ PAKAI HEADER V1 LANGSUNG
import Header from "@/components/Header";
import SmartBottomNav from "@/app/components/layout/SmartBottomNav";

// V2 Components
import StoryStrip from "@/components/v2/StoryStrip";
import UpdateSekitar from "@/components/v2/UpdateSekitar";
import AIInsight from "@/components/v2/AIInsight";
import { getProminentPlacesInRadius } from "@/lib/v2/storyFilter";

// TIDAK PERLU import FeedCard, KomentarModal, SearchModal, dll!
// V1 Anda tidak pakai itu semua!

function HomeContentV2() {
  const theme = useTheme();
  const { location, status, placeName, requestLocation } = useLocation();
  const { user } = useAuth();
  const locationReady = status === "granted" && location?.latitude && location?.longitude;
  
  const [activeTempat, setActiveTempat] = useState(null);
  const [storyPlaces, setStoryPlaces] = useState([]);
  const [allTempat, setAllTempat] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  
  const STORY_RADIUS = 10;
  
  // Scroll detection untuk Header
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
      
      const processedItems = data.map(item => 
        processFeedItem({ 
          item, 
          locationReady, 
          location: { latitude: lat, longitude: lng },
          comments: {} 
        })
      );
      
      const itemsWithDistance = processedItems.filter(item => item.distance !== null);
      setAllTempat(itemsWithDistance);
      
      const storyPlacesList = getProminentPlacesInRadius(
        itemsWithDistance,
        { latitude: lat, longitude: lng },
        STORY_RADIUS
      );
      setStoryPlaces(Array.isArray(storyPlacesList) ? storyPlacesList : []);
      
      if (!activeTempat && itemsWithDistance.length > 0) {
        const nearest = [...itemsWithDistance].sort((a, b) => a.distance - b.distance)[0];
        setActiveTempat(nearest);
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
  
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData().finally(() => setRefreshing(false));
  }, [fetchData]);
  
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
    <div className={`relative min-h-screen w-full ${theme.bg} ${theme.text}`}>
      
      {/* Ambient Effects dari V1 */}
      {theme.isMalam && (
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-15%] left-[-10%] w-[120%] h-[50%] rounded-full opacity-[0.07] blur-[120px]" style={{ backgroundColor: '#3b82f6' }} />
          <div className="absolute bottom-[-10%] right-[-10%] w-[100%] h-[40%] rounded-full opacity-[0.05] blur-[100px]" style={{ backgroundColor: '#8b5cf6' }} />
        </div>
      )}
      
      {/* HEADER V1 */}
      <Header
  user={user}
  locationReady={locationReady}
  villageLocation={placeName || "Pilih Lokasi"}
  isScrolled={isScrolled}
  onOpenLocationModal={() => {}}
  onShowStatistik={() => {}}
  onOpenAuthModal={() => {}}
/>
      
      <div className="relative z-10 pb-24">
        <div className="px-4 max-w-md mx-auto">
          
          {/* 1. LOKASI AKTIF (Hero) dengan Foto */}
          {activeTempat && (
            <ActiveLocationCard 
              tempat={activeTempat} 
              theme={theme}
              onRefresh={handleRefresh}
              location={location}
            />
          )}
          
          {/* 2. AI INSIGHT */}
          <AIInsight 
            activeTempat={activeTempat}
            theme={theme}
          />
          
          {/* 3. STORY STRIP */}
          <StoryStrip 
            places={storyPlaces}
            activePlace={activeTempat}
            onSelectPlace={setActiveTempat}
            theme={theme}
          />
          
          {/* 4. UPDATE SEKITAR - SAMA PERSIS KAYA V1 */}
          <UpdateSekitar 
            allPlaces={allTempat}
            onSelectPlace={setActiveTempat}
            theme={theme}
            currentUser={user}
          />
          
        </div>
      </div>
      
      <SmartBottomNav />
    </div>
  );
}

// ActiveLocationCard dengan Hero Photo (dari V1)
function ActiveLocationCard({ tempat, theme, onRefresh, location }) {
  const latestReport = tempat.laporan_terbaru?.[0];
  const kondisi = tempat.latest_condition || (tempat.isRamai ? "RAMAI" : "LANCAR");
  const lastUpdate = latestReport?.created_at || tempat.created_at;
  const waktuLalu = formatTimeAgo(new Date(lastUpdate));
  
  // Ambil foto hero
  const heroPhoto = tempat.photos?.[0] || latestReport?.photo_url || latestReport?.image_url;
  
  // Hitung jarak
  let distanceText = "";
  if (location && tempat.latitude && tempat.longitude) {
    const distance = haversineDistance(
      location.latitude,
      location.longitude,
      tempat.latitude,
      tempat.longitude
    );
    if (distance < 1) {
      distanceText = `${Math.round(distance * 1000)}m`;
    } else {
      distanceText = `${distance.toFixed(1)}km`;
    }
  }
  
  const description = latestReport?.deskripsi || latestReport?.content || 
    tempat.narasiCerita || `Lalu lintas ${kondisi.toLowerCase()} di ${tempat.name} aktivitas normal`;
  
  return (
    <div className="mb-6 bg-zinc-900/40 rounded-2xl overflow-hidden border border-white/5">
      {heroPhoto && (
        <div className="relative h-32 w-full overflow-hidden">
          <img 
            src={heroPhoto} 
            alt={tempat.name}
            className="w-full h-full object-cover"
            onError={(e) => e.target.style.display = 'none'}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          {distanceText && (
            <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded-full text-xs text-white/80">
              📍 {distanceText}
            </div>
          )}
          <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-semibold
            ${kondisi === "LANCAR" ? 'bg-green-500/80 text-white' : 'bg-yellow-500/80 text-black'}`}>
            {kondisi}
          </div>
        </div>
      )}
      
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">⭕</span>
            <h3 className="text-lg font-bold">{tempat.name}</h3>
          </div>
          <button onClick={onRefresh} className="p-1 rounded-full hover:bg-white/10">
            <svg className="w-3 h-3 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
        
        <p className="text-xs text-zinc-500 mb-2">
          Terakhir update {waktuLalu}
        </p>
        
        <p className="text-sm text-zinc-300 mb-3 line-clamp-2">
          {description}
        </p>
        
        <button className="text-sm text-cyan-400 font-medium">
          Lihat Detail →
        </button>
      </div>
    </div>
  );
}

// Helper functions
function formatTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  
  if (diffMins < 1) return "Baru saja";
  if (diffMins < 60) return `${diffMins} menit lalu`;
  if (diffHours < 24) return `${diffHours} jam lalu`;
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// EXPORT
export default function V2TestPage() {
  return (
    <Providers>
      <HomeContentV2 />
    </Providers>
  );
}