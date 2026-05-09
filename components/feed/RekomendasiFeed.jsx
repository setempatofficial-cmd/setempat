'use client';

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { MapPin, ArrowUpRight } from "lucide-react";

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default function RekomendasiFeed({
  currentItemId,
  userLocation,
  locationReady,
  theme,
}) {
  const router = useRouter();
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const isMalam = theme?.isMalam;

  useEffect(() => {
    let isMounted = true;
    
    async function fetchData() {
      setLoading(true);
      try {
        // 🔥 PERBAIKAN: Hanya kolom yang pasti ada
        const { data, error } = await supabase
          .from("feed_view")
          .select("id, name, latitude, longitude, photos, category")
          .neq("id", currentItemId)
          .limit(60);

        if (error) throw error;
        if (isMounted && data) setAllItems(data);
      } catch (err) {
        console.error("Fetch Error:", err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchData();
    return () => { isMounted = false; };
  }, [currentItemId]);

  const nearbyItems = useMemo(() => {
    if (!locationReady || !userLocation?.latitude) return [];

    return allItems
      .map(item => ({
        ...item,
        distance: calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          item.latitude,
          item.longitude
        )
      }))
      .filter(item => item.distance !== null && item.distance <= 10)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 6);
  }, [allItems, userLocation, locationReady]);

  if (loading) {
    return (
      <div className="space-y-4 px-2">
        {[1, 2, 3].map(i => (
          <div key={i} className={`h-20 rounded-[24px] animate-pulse ${isMalam ? 'bg-white/5' : 'bg-black/5'}`} />
        ))}
      </div>
    );
  }

  if (nearbyItems.length === 0) {
    return (
      <div className={`mx-2 p-8 text-center rounded-[24px] border-2 border-dashed ${
        isMalam ? 'border-white/5 bg-white/[0.02]' : 'border-black/5 bg-black/[0.01]'
      }`}>
        <div className="mb-2 flex justify-center opacity-20"><MapPin size={32}/></div>
        <p className={`text-xs font-medium ${isMalam ? 'text-white/40' : 'text-slate-400'}`}>
          {!locationReady ? "Aktifkan lokasi untuk melihat tempat terdekat" : "Belum ada rekomendasi di radius 10km"}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3 px-2 pb-6">
      <h3 className={`text-[11px] font-bold uppercase tracking-[0.2em] px-2 mb-4 opacity-50 ${isMalam ? 'text-white' : 'text-slate-900'}`}>
        Rekomendasi Kondisi Sekitar
      </h3>
      
      <AnimatePresence mode="popLayout">
        {nearbyItems.map((item, index) => {
          const isTerdekat = index === 0;
          const displayDist = item.distance < 1 
            ? `${(item.distance * 1000).toFixed(0)} m` 
            : `${item.distance.toFixed(1)} km`;

          const thumbnailUrl = item.photos?.[0] || null;

          return (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              onClick={() => {
                router.push(`/post/${item.id}`);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`
                group relative flex items-center gap-4 p-3 rounded-[24px] cursor-pointer
                transition-all duration-300 active:scale-[0.98]
                ${isMalam 
                  ? 'bg-zinc-900/60 hover:bg-zinc-800/80 border border-white/5 shadow-2xl shadow-black/50' 
                  : 'bg-white hover:bg-slate-50 border border-slate-100 shadow-sm'
                }
              `}
            >
              {/* Thumbnail Section */}
              <div className="relative h-16 w-16 flex-shrink-0 rounded-2xl overflow-hidden bg-zinc-800">
                {thumbnailUrl ? (
                  <Image 
                    src={thumbnailUrl}
                    alt={item.name}
                    fill
                    sizes="64px"
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full bg-orange-500/10 text-orange-500">
                    <MapPin size={20} />
                  </div>
                )}
              </div>

              {/* Info Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isTerdekat 
                      ? 'bg-green-500 text-white' 
                      : isMalam ? 'bg-white/10 text-white/70' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {displayDist}
                  </span>
                  {isTerdekat && (
                    <span className="text-[10px] font-bold text-green-500 animate-pulse">
                      Terdekat!
                    </span>
                  )}
                </div>
                
                <h4 className={`text-[15px] font-bold truncate leading-tight ${isMalam ? 'text-white' : 'text-slate-800'}`}>
                  {item.name}
                </h4>
                
                <div className="flex items-center gap-2 mt-1.5 overflow-hidden">
                  <span className={`text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                    isMalam ? 'border-white/10 text-white/40' : 'border-slate-200 text-slate-400'
                  }`}>
                    {item.category || 'Tempat'}
                  </span>
                </div>
              </div>

              {/* Action Icon */}
              <div className={`
                flex items-center justify-center w-9 h-9 rounded-2xl transition-all
                ${isMalam 
                  ? 'bg-white/5 text-white/40 group-hover:bg-orange-500 group-hover:text-white' 
                  : 'bg-slate-50 text-slate-300 group-hover:bg-orange-500 group-hover:text-white'
                }
              `}>
                <ArrowUpRight size={18} strokeWidth={2.5} />
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}