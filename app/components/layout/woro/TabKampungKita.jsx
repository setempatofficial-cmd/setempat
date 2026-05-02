"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Users, Loader2, MapPin, Camera, User, Navigation, AlertCircle, ChevronRight } from "lucide-react";

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
  const [locationStatus, setLocationStatus] = useState('checking'); // 'checking', 'missing', 'error', 'ready'
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const isMalam = theme?.isMalam ?? true;

  // Cek lokasi user dari database
  const checkUserLocation = useCallback(async () => {
    if (!user?.id) {
      setLocationStatus('missing');
      setLoading(false);
      return;
    }

    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("latitude, longitude")
        .eq("id", user.id)
        .single();
        
      if (error) {
        console.error("Error ambil profil:", error);
        setLocationStatus('error');
        setLoading(false);
        return;
      }
      
      if (profile?.latitude && profile?.longitude) {
        setUserLocation({ 
          latitude: profile.latitude, 
          longitude: profile.longitude 
        });
        setLocationStatus('ready');
      } else {
        setLocationStatus('missing');
        setLoading(false);
      }
    } catch (err) {
      console.error("Error:", err);
      setLocationStatus('error');
      setLoading(false);
    }
  }, [user?.id]);

  // Fungsi untuk meminta izin lokasi browser dan simpan ke database
  const requestAndSaveLocation = async () => {
    setIsRequestingLocation(true);
    
    if (!navigator.geolocation) {
      alert("Browser Anda tidak mendukung geolocation");
      setIsRequestingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        // Simpan ke database
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ 
            latitude, 
            longitude,
            updated_at: new Date().toISOString()
          })
          .eq("id", user.id);
        
        if (updateError) {
          console.error("Gagal simpan lokasi:", updateError);
          alert("Gagal menyimpan lokasi. Silakan coba lagi.");
          setIsRequestingLocation(false);
          return;
        }
        
        // Update state
        setUserLocation({ latitude, longitude });
        setLocationStatus('ready');
        setIsRequestingLocation(false);
        
        // Langsung fetch data
        fetchRecentActivities(true);
      },
      (error) => {
        console.error("Error dapat lokasi:", error);
        let errorMessage = "Gagal mendapatkan lokasi. ";
        
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMessage += "Anda menolak izin lokasi. Silakan izinkan di pengaturan browser.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage += "Informasi lokasi tidak tersedia.";
            break;
          case error.TIMEOUT:
            errorMessage += "Waktu permintaan lokasi habis.";
            break;
          default:
            errorMessage += "Silakan coba lagi.";
        }
        
        alert(errorMessage);
        setIsRequestingLocation(false);
        setLocationStatus('error');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const fetchRecentActivities = useCallback(async (reset = false) => {
    if (!userLocation?.latitude) return;
    
    const currentPage = reset ? 0 : page;
    const limit = 15;
    if (reset) setLoading(true);
    
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
        .order('created_at', { ascending: false })
        .range(currentPage * limit, (currentPage * limit) + limit - 1);
      
      const formatted = (laporanData || [])
        .filter(item => {
          if (!item.tempat) return false;
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

  // Initial check lokasi
  useEffect(() => { 
    checkUserLocation();
  }, [checkUserLocation]);

  // Fetch data jika lokasi ready
  useEffect(() => { 
    if (locationStatus === 'ready' && userLocation) {
      fetchRecentActivities(true);
    }
  }, [locationStatus, userLocation]);

  // RENDER BERDASARKAN STATUS LOKASI
  
  // 1. Sedang loading cek lokasi
  if (locationStatus === 'checking') {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
        <p className="ml-2 text-sm opacity-50">Memeriksa lokasi...</p>
      </div>
    );
  }

  // 2. Lokasi belum diatur - TAMPILKAN FORM SET LOKASI
  if (locationStatus === 'missing') {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-20 h-20 rounded-full bg-orange-500/10 flex items-center justify-center mb-4">
          <MapPin size={40} className="text-orange-500" />
        </div>
        
        <h3 className="text-lg font-semibold mb-2">
          Atur Lokasi Anda
        </h3>
        
        <p className="text-sm text-white/60 mb-6 max-w-xs">
          Aktifkan lokasi untuk melihat kegiatan warga di sekitar Anda (radius 10km)
        </p>
        
        <button
          onClick={requestAndSaveLocation}
          disabled={isRequestingLocation}
          className="px-6 py-3 bg-orange-500 hover:bg-orange-600 rounded-xl font-semibold flex items-center gap-2 transition-all"
        >
          {isRequestingLocation ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Mendapatkan lokasi...</span>
            </>
          ) : (
            <>
              <Navigation size={20} />
              <span>Izinkan Akses Lokasi</span>
            </>
          )}
        </button>
        
        <p className="text-xs text-white/40 mt-6 max-w-xs">
          🔒 Lokasi Anda aman dan hanya digunakan untuk filter konten. 
          Tidak akan dipublikasikan ke pengguna lain.
        </p>
   
      </div>
    );
  }

  // 3. Error saat cek lokasi
  if (locationStatus === 'error') {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
          <AlertCircle size={40} className="text-red-500" />
        </div>
        
        <h3 className="text-lg font-semibold mb-2">
          Gagal Memeriksa Lokasi
        </h3>
        
        <p className="text-sm text-white/60 mb-6">
          Terjadi kesalahan saat memeriksa lokasi Anda.
        </p>
        
        <button
          onClick={checkUserLocation}
          className="px-6 py-3 bg-orange-500 rounded-xl font-semibold"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  // 4. Loading data setelah lokasi ready
  if (loading && activities.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
        <p className="ml-2 text-sm opacity-50">Mencari kegiatan di sekitar...</p>
      </div>
    );
  }

  // 5. Tidak ada kegiatan dalam radius
  if (activities.length === 0) {
    return (
      <div className="text-center py-20 opacity-70 px-10">
        <Users size={48} className="mx-auto mb-4" />
        <p className="text-sm font-medium">Belum ada kabar dari warga di sekitar radius 10km.</p>
        <p className="text-xs mt-2 opacity-50">
          Jadi yang pertama melaporkan kegiatan di lingkungan Anda!
        </p>
      </div>
    );
  }

  // 6. Tampilkan daftar kegiatan
  return (
    <div className="pb-10">
      {/* Mini Header Info */}
      <div className={`sticky top-0 z-10 px-5 py-3 flex items-center justify-between backdrop-blur-md border-b ${isMalam ? 'bg-slate-900/80 border-white/5' : 'bg-white/80 border-slate-100'}`}>
        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 tracking-tight">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
          <span>RADIUS: 10KM SEKITAR ANDA</span>
        </div>
        <button
          onClick={() => { setUserLocation(null); setLocationStatus('missing'); }}
          className="text-indigo-400 font-bold text-[10px] uppercase tracking-tighter hover:text-indigo-300"
        >
          Ubah Titik
        </button>
      </div>
      
      <div className="divide-y divide-white/[0.03]">
        {activities.map((item) => (
          <button
            key={item.id}
            onClick={() => router.push(`/post/${item.tempatId}`)}
            className={`w-full flex items-start gap-4 p-5 transition-all active:bg-indigo-500/5 group
              ${isMalam ? 'bg-transparent text-white' : 'bg-white text-slate-900'}`}
          >
            {/* Thumbnail Image/Icon */}
            <div className="relative flex-shrink-0 mt-0.5">
              {item.imageUrl ? (
                <div className="relative overflow-hidden rounded-2xl border border-white/10 shadow-md">
                  <img src={item.imageUrl} alt="" className="w-14 h-14 object-cover transform group-hover:scale-110 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  <Camera size={10} className="absolute bottom-1.5 right-1.5 text-white/80" />
                </div>
              ) : (
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border shadow-sm
                  ${isMalam ? 'bg-slate-800 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                  <MapPin size={22} className="text-indigo-500/70" />
                </div>
              )}
            </div>

            {/* Content Text */}
            <div className="flex-1 text-left min-w-0">
              <div className="flex justify-between items-start mb-1">
                <h4 className="text-[15px] font-bold truncate leading-tight group-hover:text-indigo-400 transition-colors">
                  {item.tempatName}
                </h4>
                <span className="text-[10px] font-medium text-slate-500 ml-2 mt-1">
                  {formatTime(item.time)}
                </span>
              </div>

              <p className={`text-[13px] line-clamp-2 leading-[1.6] font-medium mb-3
                ${isMalam ? 'text-slate-400' : 'text-slate-600'}`}>
                {item.description || `Memantau kondisi ${item.tipe || 'di lokasi'}`}
              </p>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-500/5 border border-white/5">
                  <User size={10} className="text-indigo-400" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                    Kiriman: {item.reporter.split(' ')[0]}
                  </span>
                </div>
                <ChevronRight size={14} className="text-slate-700 group-hover:text-indigo-500 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Load More Button */}
      {hasMore && (
        <div className="px-5 mt-4">
          <button
            onClick={() => fetchRecentActivities(false)}
            className="w-full py-4 rounded-2xl border border-white/5 bg-white/5 text-[11px] font-extrabold tracking-widest uppercase text-slate-400 hover:bg-indigo-500/10 hover:text-indigo-400 transition-all"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Muat Laporan Lainnya'}
          </button>
        </div>
      )}
    </div>
  );
}