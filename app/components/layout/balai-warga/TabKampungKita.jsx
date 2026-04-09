"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Users, Loader2 } from "lucide-react";
import FeedCard from "@/app/components/feed/FeedCard";

export default function TabKampungKita({ theme, userLocation }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
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
          openAIModal={() => {}}
          openKomentarModal={() => {}}
          onShare={() => {}}
        />
      ))}
    </div>
  );
}