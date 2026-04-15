"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Users, Loader2, MapPin, MessageSquare, Camera, User } from "lucide-react";

// Format waktu ringkas
function formatTime(dateString) {
  const date = new Date(dateString);
  const diffMins = Math.floor((new Date() - date) / 60000);
  if (diffMins < 1) return "baru saja";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}j`;
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

export default function TabKampungKita({ theme, user }) {
  const router = useRouter();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const isMalam = theme?.isMalam ?? true;

  // Ambil lokasi user dari profil
  useEffect(() => {
    const getUserLocation = async () => {
      if (!user?.id) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("latitude, longitude")
        .eq("id", user.id)
        .single();
        
      if (profile?.latitude) {
        setUserLocation({ latitude: profile.latitude, longitude: profile.longitude });
      } else {
        setLoading(false);
      }
    };
    getUserLocation();
  }, [user?.id]);

  const fetchRecentActivities = useCallback(async (reset = false) => {
    if (!userLocation?.latitude) return;
    
    const currentPage = reset ? 0 : page;
    const limit = 15;
    if (reset) setLoading(true);
    
    // Radius 10km Logic
    const radius = 10;
    const lat = userLocation.latitude;
    const lng = userLocation.longitude;
    const latDelta = radius / 111;
    const lngDelta = radius / (111 * Math.cos(lat * Math.PI / 180));
    
    try {
      const { data: laporanData } = await supabase
        .from("laporan_warga")
        .select(`
          id, 
          created_at, 
          user_name, 
          tipe, 
          deskripsi, 
          photo_url, 
          tempat_id, 
          tempat:tempat_id (id, name, latitude, longitude)
        `)
        // Filter radius dilakukan di sisi client/app jika query rpc tidak tersedia, 
        // tapi di sini kita filter koordinat dasar untuk performa
        .order('created_at', { ascending: false })
        .range(currentPage * limit, (currentPage * limit) + limit - 1);
      
      const formatted = (laporanData || [])
        .filter(item => {
          if (!item.tempat) return false;
          // Pastikan tempat masuk dalam kotak koordinat radius
          return (
            item.tempat.latitude >= lat - latDelta &&
            item.tempat.latitude <= lat + latDelta &&
            item.tempat.longitude >= lng - lngDelta &&
            item.tempat.longitude <= lng + lngDelta
          );
        })
        .map(item => ({
          id: item.id,
          tempatName: item.tempat?.name || 'Tempat Umum',
          reporter: item.user_name || 'Warga',
          description: item.deskripsi,
          time: item.created_at,
          tempatId: item.tempat_id,
          imageUrl: item.photo_url,
          tipe: item.tipe
        }));
      
      setActivities(prev => reset ? formatted : [...prev, ...formatted]);
      setHasMore(laporanData.length === limit);
      setPage(currentPage + 1);
    } catch (err) {
      console.error("Error Kampung Kita:", err);
    } finally {
      setLoading(false);
    }
  }, [userLocation, page]);

  useEffect(() => { 
    if (userLocation) fetchRecentActivities(true); 
  }, [userLocation]);

  if (loading && activities.length === 0) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-orange-500" /></div>;
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-20 opacity-30 px-10">
        <Users size={48} className="mx-auto mb-4" />
        <p className="text-sm font-medium">Belum ada kabar dari warga di sekitar radius 10km.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-white/5 pb-10">
      {activities.map((item) => (
        <button
          key={item.id}
          onClick={() => router.push(`/post/${item.tempatId}`)}
          className={`w-full flex items-start gap-4 p-5 transition-all active:bg-white/5 
            ${isMalam ? 'bg-transparent' : 'bg-white'}`}
        >
          {/* Visual: Image or Icon */}
          <div className="relative flex-shrink-0 mt-1">
            {item.imageUrl ? (
              <div className="relative">
                <img src={item.imageUrl} alt="" className="w-12 h-12 rounded-xl object-cover border border-white/10" />
                <div className="absolute -bottom-1 -right-1 p-1 bg-orange-500 rounded-lg border-2 border-[#0C0C0C]">
                  <Camera size={10} className="text-white" />
                </div>
              </div>
            ) : (
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center border
                ${isMalam ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200'}`}>
                <MapPin size={20} className="text-orange-500" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 text-left min-w-0">
            <div className="flex justify-between items-baseline gap-2">
              <h4 className={`text-[13px] font-bold truncate ${isMalam ? 'text-white' : 'text-slate-900'}`}>
                {item.tempatName}
              </h4>
              <span className="text-[10px] text-white/30 whitespace-nowrap">
                {formatTime(item.time)}
              </span>
            </div>

            <p className={`text-[12px] mt-1 line-clamp-2 leading-relaxed ${isMalam ? 'text-white/60' : 'text-slate-600'}`}>
              {item.description || `Laporan kondisi ${item.tipe || 'terkini'}`}
            </p>

            <div className="flex items-center gap-1.5 mt-2.5 opacity-50">
              <User size={10} />
              <span className="text-[10px] font-medium truncate italic">Oleh {item.reporter}</span>
            </div>
          </div>
        </button>
      ))}

      {hasMore && (
        <button
          onClick={() => fetchRecentActivities(false)}
          className="w-full py-8 text-[11px] font-bold tracking-[0.2em] uppercase opacity-20 hover:opacity-100 transition-opacity"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Lihat Kabar Lain'}
        </button>
      )}
    </div>
  );
}