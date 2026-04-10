"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Users, Loader2 } from "lucide-react";
import FeedCard from "@/app/components/feed/FeedCard";
import KomentarModal from "@/app/components/feed/KomentarModal";
import AIModal from "@/app/components/feed/AIModal"; // ← IMPORT AI MODAL

export default function TabKampungKita({ theme, userLocation }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // State untuk modal komentar
  const [selectedTempat, setSelectedTempat] = useState(null);
  const [isKomentarModalOpen, setIsKomentarModalOpen] = useState(false);
  
  // State untuk AI modal
  const [selectedForAI, setSelectedForAI] = useState(null);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  
  const isMalam = theme?.isMalam ?? true;

  const fetchNearbyActivities = useCallback(async () => {
    if (!userLocation?.latitude || !userLocation?.longitude) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    const radius = 10;
    const lat = userLocation.latitude;
    const lng = userLocation.longitude;
    const latDelta = radius / 111;
    const lngDelta = radius / (111 * Math.cos(lat * Math.PI / 180));
    
    const { data } = await supabase
      .from("feed_view")
      .select("*")
      .gte('latitude', lat - latDelta)
      .lte('latitude', lat + latDelta)
      .gte('longitude', lng - lngDelta)
      .lte('longitude', lng + lngDelta)
      .order("created_at", { ascending: false })
      .limit(20);
    
    if (data) setActivities(data);
    setLoading(false);
  }, [userLocation?.latitude, userLocation?.longitude]);

  useEffect(() => {
    fetchNearbyActivities();
  }, [fetchNearbyActivities]);

  // Handler untuk membuka modal komentar
  const handleOpenKomentarModal = (item) => {
    setSelectedTempat(item);
    setIsKomentarModalOpen(true);
  };

  // Handler untuk membuka AI modal
  const handleOpenAIModal = (item) => {
    setSelectedForAI(item);
    setIsAIModalOpen(true);
  };

  // Handler untuk share
  const handleShare = async (item) => {
    const shareUrl = `${window.location.origin}/post/${item.id}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: item.name || "Setempat.id",
          text: `Lihat ${item.name || "tempat ini"} di Setempat.id`,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        alert("✅ Link disalin ke clipboard!");
      }
    } catch (err) {
      console.log("Share cancelled or failed:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <Users size="40" className="mx-auto mb-3 opacity-30" />
        <p className="text-sm">Belum ada aktivitas di sekitar</p>
        <p className="text-xs">Aktivitas warga dalam radius 10km akan muncul di sini</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {activities.map((item) => (
          <FeedCard
            key={item.id}
            item={item}
            locationReady={!!userLocation?.latitude}
            location={{ latitude: userLocation?.latitude, longitude: userLocation?.longitude }}
            comments={{}}
            selectedPhotoIndex={{}}
            setSelectedPhotoIndex={() => {}}
            openAIModal={() => handleOpenAIModal(item)}      // ← PERBAIKI
            openKomentarModal={() => handleOpenKomentarModal(item)}
            onShare={() => handleShare(item)}
          />
        ))}
      </div>

      {/* Modal Komentar */}
      <KomentarModal
        isOpen={isKomentarModalOpen}
        onClose={() => {
          setIsKomentarModalOpen(false);
          setSelectedTempat(null);
        }}
        tempat={selectedTempat}
        isAdmin={false}
      />

      {/* AI Modal */}
      <AIModal
        isOpen={isAIModalOpen}
        onClose={() => {
          setIsAIModalOpen(false);
          setSelectedForAI(null);
        }}
        tempat={selectedForAI}
        context="kampung"
      />
    </>
  );
}