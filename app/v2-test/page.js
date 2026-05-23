"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Providers } from "../providers";
import { useTheme } from "../hooks/useTheme";
import { useLocation } from "@/components/LocationProvider";
import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { processFeedItem } from "@/lib/feedEngine";

// ✅ HEADER & NAVIGATION
import Header from "@/components/Header";
import SmartBottomNav from "@/app/components/layout/SmartBottomNav";

// ✅ V2 COMPONENTS
import StoryStrip from "@/components/v2/StoryStrip";
import AIInsight from "@/components/v2/AIInsight";
import DynamicHero from "@/components/v2/DynamicHero";
import SmartCitizenButton from "@/app/components/feed/SmartCitizenButton";
import SolutionRadar from "@/components/v2/feed/SolutionRadar";
import NearbyMicroSignals from "@/components/v2/feed/NearbyMicroSignals";
import MiniMapV2 from "@/components/v2/maps/MiniMapV2";
import RekomendasiFeed from "@/components/feed/RekomendasiFeed";

// ✅ MODALS
import AuthModal from "@/app/components/auth/AuthModal";
import LocationModal from "@/components/LocationModal";
import AIModalDetail from "@/app/components/ai/AIModalDetail";
import KomentarModal from "@/app/components/feed/KomentarModal";

// ✅ UTILS
import { getProminentPlacesInRadius } from "@/lib/v2/storyFilter";

function PostDetailV2Content({ id }) {
  const router = useRouter();
  const theme = useTheme();
  const { user } = useAuth();
  const { location, status: locationStatus, placeName, requestLocation } = useLocation();
  const locationReady = locationStatus === "granted" && location?.latitude && location?.longitude;

  // State Data
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [storyPlaces, setStoryPlaces] = useState([]);
  const [isScrolled, setIsScrolled] = useState(false);

  // UI States
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showKomentarModal, setShowKomentarModal] = useState(false);
  const [selectedTempat, setSelectedTempat] = useState(null);
  const [initialQuery, setInitialQuery] = useState("");

  // Story Modal States
  const [showStoryModal, setShowStoryModal] = useState(false);
  const [selectedStories, setSelectedStories] = useState([]);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState(0);

  const STORY_RADIUS = 10;

  // Scroll detection
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fetch Post Detail
  const fetchPostDetail = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("feed_view")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      const processedItem = processFeedItem({
        item: data,
        locationReady,
        location: locationReady ? { latitude: location.latitude, longitude: location.longitude } : null,
        comments: {}
      });

      setItem(processedItem);

    } catch (err) {
      console.error("Error fetching post detail:", err);
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [id, locationReady, location]);

  // Fetch Story Places (tempat sekitar)
  const fetchStoryPlaces = useCallback(async () => {
    if (!locationReady || !location) return;

    try {
      const lat = location.latitude;
      const lng = location.longitude;

      const { data, error } = await supabase
        .from("feed_view")
        .select("*");

      if (error) throw error;

      const processedItems = data.map(item =>
        processFeedItem({
          item,
          locationReady: true,
          location: { latitude: lat, longitude: lng },
          comments: {}
        })
      );

      const itemsWithDistance = processedItems.filter(item => item.distance !== null);

      const storyPlacesList = getProminentPlacesInRadius(
        itemsWithDistance,
        { latitude: lat, longitude: lng },
        STORY_RADIUS
      );

      setStoryPlaces(Array.isArray(storyPlacesList) ? storyPlacesList : []);

    } catch (err) {
      console.error("Error fetching story places:", err);
    }
  }, [locationReady, location]);

  // Log aktivitas kunjungan
  useEffect(() => {
    if (!item?.id || !user?.id) return;

    const logDetailView = async () => {
      try {
        await supabase
          .from('external_signals')
          .insert({
            tempat_id: item.id,
            source: 'user_activity',
            source_id: `${user.id}_${item.id}_${Date.now()}`,
            username: user.id,
            content: 'view_detail',
            source_platform: 'setempat_app',
            created_at: new Date().toISOString(),
            fetched_at: new Date().toISOString(),
            confidence: 1.0,
            verified: true,
            verification_level: 'high',
            source_tier: 1
          });
      } catch (err) {
        console.warn('Failed to log detail view:', err);
      }
    };

    logDetailView();
  }, [item?.id, user?.id]);

  useEffect(() => {
    fetchPostDetail();
    if (locationReady) {
      fetchStoryPlaces();
    }
  }, [fetchPostDetail, locationReady, fetchStoryPlaces]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([fetchPostDetail(), fetchStoryPlaces()]).finally(() => setRefreshing(false));
  }, [fetchPostDetail, fetchStoryPlaces]);

  // AI Handlers
  const handleOpenAIModal = useCallback((query = "") => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    if (!item) return;

    const finalQuery = query || `Analisis situasi terkini di ${item.name}. Kondisi saat ini: ${item.latest_condition || "Normal"}. Berikan rekomendasi dan solusi.`;

    setSelectedTempat(item);
    setInitialQuery(finalQuery);
    setShowAIModal(true);
  }, [user, item]);

  const handleShare = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      // Toast notification bisa ditambahkan
    } catch (err) {
      console.error("Share failed:", err);
    }
  }, []);

  // Handler untuk story modal
  const handleOpenStoryModal = (tempatId, stories, startIndex = 0) => {
    setSelectedStories(stories);
    setSelectedStoryIndex(startIndex);
    setShowStoryModal(true);
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme.bg} ${theme.text}`}>
        <div className="text-center">
          <div className="relative flex items-center justify-center">
            <div className="absolute animate-ping h-12 w-12 rounded-full bg-cyan-500 opacity-20"></div>
            <div className="relative h-8 w-8 border-4 border-t-cyan-500 border-r-transparent border-b-cyan-500 border-l-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-sm opacity-60 mt-4">Memuat Detail...</p>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-10 ${theme.bg} ${theme.text}`}>
        <p className="opacity-40 font-bold uppercase text-[10px] tracking-widest">Data Tidak Ditemukan</p>
        <button
          onClick={() => router.push('/')}
          className="mt-4 px-6 py-2 bg-white/5 rounded-full text-xs hover:bg-white/10 transition-all"
        >
          Kembali
        </button>
      </div>
    );
  }

  return (
    <div className={`relative min-h-screen w-full ${theme.bg} ${theme.text}`}>

      {/* Ambient Effects */}
      {theme.isMalam && (
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-15%] left-[-10%] w-[120%] h-[50%] rounded-full opacity-[0.07] blur-[120px]" style={{ backgroundColor: '#3b82f6' }} />
          <div className="absolute bottom-[-10%] right-[-10%] w-[100%] h-[40%] rounded-full opacity-[0.05] blur-[100px]" style={{ backgroundColor: '#8b5cf6' }} />
        </div>
      )}

      {/* HEADER */}
      <div className="fixed top-0 left-0 right-0 z-[100] flex justify-center pointer-events-none">
        <div className="w-full max-w-[420px] pointer-events-auto">
          <Header
            user={user}
            locationReady={locationReady}
            villageLocation={placeName?.split(",")[0] || "Lokasi"}
            isScrolled={isScrolled}
            onOpenLocationModal={() => setIsLocationModalOpen(true)}
            onShowStatistik={() => { }}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
          />
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="relative z-10 pb-24 pt-20">
        <div className="px-4 max-w-md mx-auto">

          {/* 1. DYNAMIC HERO */}
          <DynamicHero
            tempat={item}
            onRefresh={handleRefresh}
            refreshing={refreshing}
            onAIClick={() => handleOpenAIModal()}
            onShareClick={handleShare}
            showActions={true}
            isDetail={true}
          />

          {/* 2. AI INSIGHT */}
          <AIInsight
            activeTempat={item}
            theme={theme}
          />

          {/* 3. SMART CITIZEN BUTTON */}
          <SmartCitizenButton
            tempatId={item.id}
            tempatName={item.name}
            kategori={item.category || "umum"}
            isInRadius={item.distance <= 0.5}
            adminPhone={item.admin_phone}
            handleOpenAIModal={handleOpenAIModal}
            onUpdate={() => handleRefresh()}
          />

          {/* 4. STORY STRIP (Cerita dari tempat ini) */}
          {item.laporan_terbaru && item.laporan_terbaru.length > 0 && (
            <StoryStrip
              laporanWarga={item.laporan_terbaru}
              tempatId={item.id}
              namaTempat={item.name}
              openStoryModal={handleOpenStoryModal}
              theme={theme}
            />
          )}

          {/* 5. RADAR SECTION */}
          <div className="mt-6 mb-4">
            <h3 className="text-xs font-black uppercase tracking-tighter mb-3 px-1">
              🛰️ RADAR SETEMPAT
            </h3>

            {/* Mini Map */}
            <div className="h-48 w-full rounded-2xl overflow-hidden mb-4 border border-white/10 shadow-inner">
              <MiniMapV2
                lat={item.latitude}
                lng={item.longitude}
                theme={theme}
                radius={1}
                showRadius={true}
                isInteractive={false}
                tempatId={item.id}
                showSignals={true}
              />
            </div>

            {/* Nearby Micro Signals */}
            <NearbyMicroSignals
              tempatId={item.id}
              theme={theme}
            />

            {/* Solution Radar */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Solusi Sekitar</p>
                <span className="text-[8px] opacity-30 font-bold italic">Radius 1KM</span>
              </div>
              <SolutionRadar
                item={item}
                theme={theme}
                userLocation={location}
              />
            </div>
          </div>

          {/* 6. REKOMENDASI TEMPAT */}
          <div className="mt-8 mb-4">
            <h3 className="text-xs font-black uppercase tracking-tighter mb-3 px-1">
              ✨ REKOMENDASI TEMPAT
            </h3>
            <RekomendasiFeed
              currentItemId={parseInt(id)}
              userLocation={location}
              locationReady={locationReady}
              theme={theme}
              onOpenAIModal={(it) => handleOpenAIModal(`Ceritakan tentang ${it.name}.`)}
            />
          </div>

        </div>
      </div>

      {/* BOTTOM NAVIGATION */}
      <SmartBottomNav />

      {/* MODALS */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      <LocationModal isOpen={isLocationModalOpen} onClose={() => setIsLocationModalOpen(false)} />
      <AIModalDetail
        isOpen={showAIModal}
        onClose={() => setShowAIModal(false)}
        item={selectedTempat}
        userId={user?.id}
        initialQuery={initialQuery}
      />
      <KomentarModal
        isOpen={showKomentarModal}
        onClose={() => setShowKomentarModal(false)}
        tempat={selectedTempat}
      />

      {/* STORY MODAL - bisa ditambahkan nanti */}
      {showStoryModal && selectedStories.length > 0 && (
        <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center">
          <button
            onClick={() => setShowStoryModal(false)}
            className="absolute top-5 right-5 text-white text-2xl z-10"
          >
            ✕
          </button>
          {/* Komponen Story Viewer bisa ditambahkan di sini */}
          <div className="text-center text-white">
            <p className="text-sm">Story Viewer</p>
            <p className="text-xs opacity-50">Total {selectedStories.length} cerita</p>
          </div>
        </div>
      )}

    </div>
  );
}

// PAGE COMPONENT
export default function PostDetailV2Page() {
  const params = useParams();
  const id = params?.id;

  return (
    <Providers>
      <PostDetailV2Content id={id} />
    </Providers>
  );
}