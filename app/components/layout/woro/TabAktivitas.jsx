"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Users, Loader2, Clock, MapPin, Camera, MessageSquare, TrendingUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";

export default function TabKampungKita({ theme, user, userLocation }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  
  const isMalam = theme?.isMalam ?? true;

  // Ambil notifikasi aktivitas terbaru di sekitar lokasi user
  const fetchRecentActivities = useCallback(async (reset = false) => {
    if (!userLocation?.latitude || !userLocation?.longitude) {
      setLoading(false);
      return;
    }
    
    const currentPage = reset ? 0 : page;
    const limit = 15;
    const offset = currentPage * limit;
    
    if (reset) setLoading(true);
    
    const radius = 10;
    const lat = userLocation.latitude;
    const lng = userLocation.longitude;
    const latDelta = radius / 111;
    const lngDelta = radius / (111 * Math.cos(lat * Math.PI / 180));
    
    try {
      // Ambil dari berbagai sumber aktivitas terbaru
      // 1. Laporan warga terbaru
      const { data: laporanData } = await supabase
        .from("laporan_warga")
        .select(`
          id,
          created_at,
          user_name,
          user_avatar,
          tipe,
          deskripsi,
          photo_url,
          tempat_id,
          tempat:tempat_id (id, name, alamat, category, latitude, longitude)
        `)
        .gte('tempat.latitude', lat - latDelta)
        .lte('tempat.latitude', lat + latDelta)
        .gte('tempat.longitude', lng - lngDelta)
        .lte('tempat.longitude', lng + lngDelta)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit);
      
      // 2. Story terbaru (dari photos di tabel tempat)
      const { data: storyData } = await supabase
        .from("tempat")
        .select(`
          id,
          name,
          alamat,
          category,
          photos,
          updated_at,
          latitude,
          longitude
        `)
        .not('photos', 'eq', {})
        .gte('latitude', lat - latDelta)
        .lte('latitude', lat + latDelta)
        .gte('longitude', lng - lngDelta)
        .lte('longitude', lng + lngDelta)
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit);
      
      // Gabungkan dan urutkan berdasarkan waktu
      let allActivities = [];
      
      // Proses laporan warga
      (laporanData || []).forEach(item => {
        allActivities.push({
          id: `laporan_${item.id}`,
          type: 'laporan',
          title: `Laporan baru dari ${item.user_name || 'Warga'}`,
          description: item.deskripsi || `Melaporkan: ${item.tipe || 'kondisi'}`,
          time: item.created_at,
          tempatId: item.tempat_id,
          tempatName: item.tempat?.name,
          imageUrl: item.photo_url,
          data: item
        });
      });
      
      // Proses story (update foto)
      (storyData || []).forEach(item => {
        const photos = item.photos;
        if (photos && typeof photos === 'object') {
          const timeSlots = ['pagi', 'siang', 'sore', 'malam'];
          const latestPhoto = timeSlots
            .map(slot => photos[slot])
            .find(p => p && p.url);
          
          if (latestPhoto) {
            allActivities.push({
              id: `story_${item.id}_${item.updated_at}`,
              type: 'story',
              title: `Story baru di ${item.name}`,
              description: latestPhoto.caption || `Update terbaru dari ${item.name}`,
              time: item.updated_at,
              tempatId: item.id,
              tempatName: item.name,
              imageUrl: latestPhoto.url,
              data: item
            });
          }
        }
      });
      
      // Urutkan berdasarkan waktu terbaru
      allActivities.sort((a, b) => new Date(b.time) - new Date(a.time));
      
      // Batasi jumlah
      const newNotifications = allActivities.slice(0, limit);
      
      if (reset) {
        setNotifications(newNotifications);
      } else {
        setNotifications(prev => [...prev, ...newNotifications]);
      }
      
      setHasMore(newNotifications.length === limit);
      setPage(currentPage + 1);
      
    } catch (err) {
      console.error("Error fetching activities:", err);
    } finally {
      setLoading(false);
    }
  }, [userLocation?.latitude, userLocation?.longitude, page]);

  useEffect(() => {
    fetchRecentActivities(true);
  }, [fetchRecentActivities]);

  // Subscribe ke perubahan realtime
  useEffect(() => {
    if (!userLocation?.latitude) return;
    
    const channel = supabase
      .channel('kampung-kita-updates')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'laporan_warga' },
        () => fetchRecentActivities(true)
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tempat', filter: 'photos=neq.null' },
        () => fetchRecentActivities(true)
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userLocation?.latitude, fetchRecentActivities]);

  const getIcon = (type) => {
    switch(type) {
      case 'laporan':
        return <MessageSquare size={16} className="text-orange-400" />;
      case 'story':
        return <Camera size={16} className="text-emerald-400" />;
      default:
        return <TrendingUp size={16} className="text-blue-400" />;
    }
  };

  const handleClickNotification = (notification) => {
    // Redirect ke halaman tempat yang bersangkutan
    window.location.href = `/post/${notification.tempatId}`;
  };

  if (loading && notifications.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="text-center py-12">
        <Users size="40" className="mx-auto mb-3 opacity-30" />
        <p className={`text-sm ${isMalam ? 'text-white/40' : 'text-slate-400'}`}>
          Belum ada aktivitas terbaru
        </p>
        <p className={`text-xs mt-1 ${isMalam ? 'text-white/30' : 'text-slate-300'}`}>
          Aktivitas warga dalam radius 10km akan muncul di sini
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-4">
      {notifications.map((notif) => (
        <button
          key={notif.id}
          onClick={() => handleClickNotification(notif)}
          className={`w-full text-left p-4 rounded-2xl transition-all active:scale-[0.98]
            ${isMalam 
              ? 'bg-white/5 hover:bg-white/10 border border-white/5' 
              : 'bg-white border border-slate-100 hover:shadow-md'}`}
        >
          <div className="flex gap-3">
            {/* Icon / Thumbnail */}
            <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center
              ${isMalam ? 'bg-white/10' : 'bg-slate-100'}`}>
              {notif.imageUrl ? (
                <img 
                  src={notif.imageUrl} 
                  alt="Preview" 
                  className="w-full h-full object-cover rounded-xl"
                />
              ) : (
                getIcon(notif.type)
              )}
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h4 className={`text-sm font-semibold ${isMalam ? 'text-white' : 'text-slate-800'} truncate`}>
                  {notif.title}
                </h4>
                <span className={`text-[10px] flex-shrink-0 ${isMalam ? 'text-white/30' : 'text-slate-400'}`}>
                  {formatDistanceToNow(new Date(notif.time), { addSuffix: true, locale: id })}
                </span>
              </div>
              
              <p className={`text-xs mt-0.5 line-clamp-2 ${isMalam ? 'text-white/50' : 'text-slate-500'}`}>
                {notif.description}
              </p>
              
              <div className="flex items-center gap-2 mt-2">
                <MapPin size={10} className={isMalam ? 'text-white/30' : 'text-slate-400'} />
                <span className={`text-[10px] ${isMalam ? 'text-white/40' : 'text-slate-400'}`}>
                  {notif.tempatName}
                </span>
              </div>
            </div>
          </div>
        </button>
      ))}
      
      {hasMore && (
        <button
          onClick={() => fetchRecentActivities(false)}
          className={`w-full py-3 text-center text-xs font-medium transition-all
            ${isMalam 
              ? 'text-white/40 hover:text-white/60' 
              : 'text-slate-400 hover:text-slate-600'}`}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
          ) : (
            'Muat lebih banyak'
          )}
        </button>
      )}
    </div>
  );
}