"use client";
import { motion } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useWeather } from "@/hooks/useWeather";

// ============================================
// FUNGSI HAVERSINE (Hitung Jarak)
// ============================================
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ============================================
// MODAL UPDATE KERAMAIAN
// ============================================
function UpdateCrowdModal({ isOpen, onClose, tempatId, tempatName, onSubmit, userLocation, tempatCoords }) {
  const [estimatedPeople, setEstimatedPeople] = useState(50);
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [distanceToLocation, setDistanceToLocation] = useState(null);

  useEffect(() => {
    if (isOpen && userLocation && tempatCoords) {
      const distance = calculateDistance(
        userLocation.lat, userLocation.lon,
        tempatCoords.latitude, tempatCoords.longitude
      );
      setDistanceToLocation(distance);
    }
  }, [isOpen, userLocation, tempatCoords]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit({
        tempat_id: tempatId,
        estimated_people: estimatedPeople,
        deskripsi: description || `Laporan keramaian: sekitar ${estimatedPeople} orang`,
        tipe: estimatedPeople > 100 ? "antri" : estimatedPeople > 50 ? "ramai" : "sepi",
        status: "approved",
        location_verified: true,
        verification_distance_meters: distanceToLocation ? Math.round(distanceToLocation * 1000) : null
      });
      onClose();
    } catch (error) {
      console.error("Error submitting:", error);
      alert("Gagal mengirim laporan. Silakan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-gray-800 rounded-2xl p-5 w-80 max-w-[90%] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-bold text-lg mb-2 dark:text-white">📍 Saya juga di sini</h3>

        {distanceToLocation && (
          <div className="mb-3 px-2 py-1.5 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p className="text-[10px] text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
              <span>✅</span> Terverifikasi! Anda berada {Math.round(distanceToLocation * 1000)}m dari lokasi
            </p>
          </div>
        )}

        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Update kondisi terkini di {tempatName}
        </p>

        <div className="mb-3">
          <label className="text-xs font-medium block mb-1 dark:text-gray-300">Perkiraan jumlah orang</label>
          <input
            type="range"
            min="0"
            max="300"
            value={estimatedPeople}
            onChange={(e) => setEstimatedPeople(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs mt-1">
            <span>Sepi (0-50)</span>
            <span className="font-bold">{estimatedPeople} orang</span>
            <span>Ramai (100+)</span>
          </div>
        </div>

        <div className="mb-4">
          <label className="text-xs font-medium block mb-1 dark:text-gray-300">Catatan (opsional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Contoh: Antrean panjang di kasir..."
            className="w-full p-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            rows={2}
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 bg-blue-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition"
          >
            {isSubmitting ? "Mengirim..." : "Kirim Update"}
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 dark:bg-gray-700 py-2 rounded-lg text-sm font-medium"
          >
            Batal
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================
// KOMPONEN UTAMA
// ============================================
export default function NearbyMicroSignals({ tempatId, theme, radius = 1 }) {
  const [signals, setSignals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tempatCoords, setTempatCoords] = useState(null);
  const [showCrowdModal, setShowCrowdModal] = useState(false);

  const [userLocation, setUserLocation] = useState(null);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
  const [distanceToTempat, setDistanceToTempat] = useState(null);
  const [isWithinRadius, setIsWithinRadius] = useState(false);

  // Refs untuk subscription
  const channelRef = useRef(null);
  const isMountedRef = useRef(true);

  // Ambil koordinat tempat
  useEffect(() => {
    async function getTempatCoords() {
      const { data } = await supabase
        .from('tempat')
        .select('latitude, longitude, name')
        .eq('id', tempatId)
        .single();
      if (data) setTempatCoords(data);
    }
    getTempatCoords();
  }, [tempatId]);

  // Cek lokasi user
  const checkUserLocation = () => {
    if (!tempatCoords) return;

    if (!navigator.geolocation) {
      setLocationPermissionDenied(true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLon = position.coords.longitude;
        const distance = calculateDistance(
          userLat, userLon,
          tempatCoords.latitude, tempatCoords.longitude
        );

        setUserLocation({ lat: userLat, lon: userLon });
        setDistanceToTempat(distance);
        setIsWithinRadius(distance <= radius);
        setLocationPermissionDenied(false);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setLocationPermissionDenied(true);
        }
        setIsWithinRadius(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    if (tempatCoords) {
      checkUserLocation();
    }
  }, [tempatCoords]);

  // Handle klik
  const handleCrowdClick = () => {
    if (!isWithinRadius) {
      const distanceText = distanceToTempat ? `${Math.round(distanceToTempat * 1000)} meter` : "jauh";
      alert(`⚠️ Anda berada ${distanceText} dari lokasi ini.\n\nUpdate hanya bisa dilakukan jika berada dalam radius ${radius} km.`);
      return;
    }
    if (locationPermissionDenied) {
      alert("⚠️ Izin lokasi diperlukan. Silakan izinkan akses lokasi di browser.");
      return;
    }
    setShowCrowdModal(true);
  };

  const { weather: weatherData } = useWeather(tempatCoords?.name || '');

  const getWeatherData = () => {
    if (weatherData) {
      return {
        condition: weatherData.short,
        temp: weatherData.temp,
        icon: getWeatherIcon(weatherData.short),
        color: getWeatherColor(weatherData.short),
        source: 'weather_hook'
      };
    }
    const hour = new Date().getHours();
    let condition = 'Normal', icon = '🌡️', temp = 24;
    if (hour >= 5 && hour < 11) { condition = 'Cerah'; icon = '☀️'; temp = 26; }
    else if (hour >= 11 && hour < 15) { condition = 'Panas'; icon = '☀️🔥'; temp = 32; }
    else if (hour >= 15 && hour < 18) { condition = 'Teduh'; icon = '🌤️'; temp = 28; }
    else { condition = 'Sejuk'; icon = '🌙'; temp = 24; }
    return { condition, temp, icon, color: getWeatherColor(condition), source: 'time_fallback' };
  };

  const handleSignalClick = (signal) => {
    if (signal.label === "Lalu Lintas" && tempatCoords) {
      const { latitude, longitude, name } = tempatCoords;
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&query=${encodeURIComponent(name)}`, '_blank');
    }
    if (signal.label === "Keramaian") handleCrowdClick();
  };

  const handleCrowdUpdate = async (laporanData) => {
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from('laporan_warga').insert([{
      ...laporanData,
      created_at: new Date().toISOString(),
      user_id: userData?.user?.id || 'anonymous'
    }]);
    if (error) throw error;
    alert("✅ Terima kasih! Laporan Anda langsung terverifikasi.");
  };

  // Fetch laporan dengan subscription yang AMAN
  useEffect(() => {
    if (!tempatId) return;

    isMountedRef.current = true;

    const fetchLaporanWarga = async () => {
      if (!isMountedRef.current) return;

      try {
        setLoading(true);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { data: laporanList, error: laporanError } = await supabase
          .from('laporan_warga')
          .select('tipe, status, created_at, deskripsi, estimasi_menit, estimated_people')
          .eq('tempat_id', tempatId)
          .eq('status', 'approved')
          .gte('created_at', sevenDaysAgo.toISOString())
          .order('created_at', { ascending: false });

        if (laporanError) throw laporanError;

        const allReports = laporanList || [];

        const trafficReports = allReports.filter(r => {
          if (r.tipe === 'sepi' || r.tipe === 'ramai' || r.tipe === 'antri') return true;
          if (r.deskripsi) {
            const text = r.deskripsi.toLowerCase();
            if (text.includes('macet') || text.includes('lancar') || text.includes('padat') || text.includes('antri')) return true;
          }
          return false;
        });

        const crowdReports = allReports.filter(r => {
          if (r.estimated_people !== null) return true;
          if (r.tipe === 'ramai' || r.tipe === 'sepi' || r.tipe === 'antri') return true;
          if (r.deskripsi) {
            const text = r.deskripsi.toLowerCase();
            if (text.includes('ramai') || text.includes('sepi') || text.includes('antri')) return true;
          }
          return false;
        });

        const trafficStatus = getTrafficStatus(trafficReports);
        const crowdStatus = getCrowdStatus(crowdReports);
        const weatherDataResult = getWeatherData();

        const reportsWithPeople = crowdReports.filter(r => r.estimated_people !== null);
        const avgPeople = reportsWithPeople.length > 0 ? Math.round(reportsWithPeople.reduce((sum, r) => sum + r.estimated_people, 0) / reportsWithPeople.length) : null;

        const reportsWithWaitTime = crowdReports.filter(r => r.estimasi_menit !== null);
        const avgWaitTime = reportsWithWaitTime.length > 0 ? Math.round(reportsWithWaitTime.reduce((sum, r) => sum + r.estimasi_menit, 0) / reportsWithWaitTime.length) : null;

        if (isMountedRef.current) {
          setSignals([
            {
              id: 1, label: "Lalu Lintas", status: trafficStatus.status, icon: trafficStatus.icon,
              color: trafficStatus.color, detail: trafficReports.length > 0 ? `${trafficReports.length} laporan` : "Klik untuk rute",
              source: trafficReports.length > 0 ? "laporan_warga" : "no_data", isClickable: true
            },
            {
              id: 2, label: "Cuaca", status: weatherDataResult.condition, icon: weatherDataResult.icon,
              color: weatherDataResult.color, temp: weatherDataResult.temp, source: weatherDataResult.source, isClickable: false
            },
            {
              id: 3, label: "Keramaian", status: crowdStatus.status, icon: crowdStatus.icon,
              color: crowdStatus.color, detail: avgPeople ? `±${avgPeople} orang` : (avgWaitTime ? `±${avgWaitTime} menit` : (crowdReports.length > 0 ? `${crowdReports.length} laporan` : "Belum ada laporan")),
              source: crowdReports.length > 0 ? "laporan_warga" : "no_data", isClickable: true, canUpdate: isWithinRadius && !locationPermissionDenied
            },
          ]);
        }
      } catch (err) {
        if (isMountedRef.current) {
          console.error("Error:", err);
          setError(err.message);
          setSignals(getFallbackSignals());
        }
      } finally {
        if (isMountedRef.current) setLoading(false);
      }
    };

    // Panggil fetch pertama
    fetchLaporanWarga();

    // CLEANUP channel lama jika ada
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Buat channel baru dengan sedikit delay untuk memastikan cleanup sempurna
    const timeoutId = setTimeout(() => {
      if (!isMountedRef.current) return;

      const newChannel = supabase.channel(`laporan_${tempatId}`);

      newChannel
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'laporan_warga',
          filter: `tempat_id=eq.${tempatId}`
        }, () => {
          if (isMountedRef.current) {
            fetchLaporanWarga();
          }
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log(`✅ Subscribed to laporan_${tempatId}`);
          }
        });

      channelRef.current = newChannel;
    }, 100);

    // Cleanup function
    return () => {
      clearTimeout(timeoutId);
      isMountedRef.current = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [tempatId, weatherData, isWithinRadius, locationPermissionDenied]);

  // ============================================
  // FUNGSI STATUS
  // ============================================
  function getTrafficStatus(reports) {
    if (reports.length === 0) return { status: "Petunjuk Jalan", icon: "🗺️", color: "text-blue-400" };
    const statusCount = { Sepi: 0, Ramai: 0, Antri: 0 };
    reports.forEach(r => {
      let condition = null;
      if (r.tipe === 'sepi') condition = 'Sepi';
      else if (r.tipe === 'ramai') condition = 'Ramai';
      else if (r.tipe === 'antri') condition = 'Antri';
      if (!condition && r.estimated_people !== null) {
        if (r.estimated_people > 100) condition = 'Antri';
        else if (r.estimated_people > 50) condition = 'Ramai';
        else if (r.estimated_people < 20) condition = 'Sepi';
      }
      if (condition && statusCount[condition] !== undefined) statusCount[condition]++;
    });
    const totalCount = Object.values(statusCount).reduce((a, b) => a + b, 0);
    if (totalCount === 0) return { status: "Lancar", icon: "🚗", color: "text-emerald-400" };
    const dominantStatus = Object.keys(statusCount).reduce((a, b) => statusCount[a] > statusCount[b] ? a : b);
    const icons = { Sepi: "🚗 Lancar", Ramai: "🚙 Padat", Antri: "🛑 Macet" };
    const colors = { Sepi: "text-emerald-400", Ramai: "text-amber-400", Antri: "text-red-400" };
    return { status: dominantStatus, icon: icons[dominantStatus] || "🚗", color: colors[dominantStatus] || "text-gray-400" };
  }

  function getCrowdStatus(reports) {
    if (reports.length === 0) return { status: "Tidak Ada Laporan", icon: "❓", color: "text-gray-400" };
    const reportsWithPeople = reports.filter(r => r.estimated_people !== null);
    if (reportsWithPeople.length > 0) {
      const avgPeople = reportsWithPeople.reduce((sum, r) => sum + r.estimated_people, 0) / reportsWithPeople.length;
      if (avgPeople > 100) return { status: "Sangat Ramai", icon: "👥👥👥", color: "text-red-400" };
      if (avgPeople > 50) return { status: "Ramai", icon: "👥👥", color: "text-orange-400" };
      if (avgPeople > 20) return { status: "Normal", icon: "👥", color: "text-amber-400" };
      if (avgPeople > 0) return { status: "Sepi", icon: "👤", color: "text-gray-400" };
    }
    const reportsWithWaitTime = reports.filter(r => r.estimasi_menit !== null);
    if (reportsWithWaitTime.length > 0) {
      const avgWait = reportsWithWaitTime.reduce((sum, r) => sum + r.estimasi_menit, 0) / reportsWithWaitTime.length;
      if (avgWait > 30) return { status: "Antri Panjang", icon: "🚶‍♂️🚶‍♀️", color: "text-red-400" };
      if (avgWait > 15) return { status: "Antri", icon: "🚶‍♂️", color: "text-orange-400" };
      if (avgWait > 5) return { status: "Mulai Antri", icon: "⏱️", color: "text-amber-400" };
    }
    return { status: "Normal", icon: "👥", color: "text-amber-400" };
  }

  function getWeatherIcon(condition) {
    const icons = { Cerah: "☀️", Panas: "☀️🔥", Teduh: "🌤️", Sejuk: "🌙", Mendung: "☁️", Hujan: "🌧️", Badai: "⛈️" };
    return icons[condition] || "🌡️";
  }

  function getWeatherColor(condition) {
    const colors = { Cerah: "text-yellow-400", Panas: "text-orange-500", Teduh: "text-sky-400", Sejuk: "text-cyan-400", Mendung: "text-sky-400", Hujan: "text-blue-400", Badai: "text-indigo-400" };
    return colors[condition] || "text-gray-400";
  }

  function getFallbackSignals() {
    return [
      { id: 1, label: "Lalu Lintas", status: "Tidak Ada Data", icon: "❓", color: "text-gray-400", source: "fallback", isClickable: false },
      { id: 2, label: "Cuaca", status: "Memuat...", icon: "🌡️", color: "text-gray-400", source: "fallback", isClickable: false },
      { id: 3, label: "Keramaian", status: "Tidak Ada Data", icon: "❓", color: "text-gray-400", source: "fallback", isClickable: false },
    ];
  }

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map(i => (
          <div key={i} className={`p-3 rounded-2xl animate-pulse ${theme.isMalam ? 'bg-white/5' : 'bg-black/5'}`}>
            <div className="h-6 w-6 mx-auto mb-1 rounded-full bg-gray-500/20" />
            <div className="h-2 w-10 mx-auto mb-1 bg-gray-500/20 rounded" />
            <div className="h-3 w-12 mx-auto bg-gray-500/20 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (error && !signals) {
    return (
      <div className={`p-4 rounded-2xl text-center text-xs ${theme.isMalam ? 'bg-red-500/10' : 'bg-red-100'}`}>
        <span>⚠️ Gagal memuat sinyal sekitar</span>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {signals?.map((sig, idx) => (
          <motion.div
            key={sig.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            whileHover={{ scale: sig.isClickable && (sig.label !== "Keramaian" || sig.canUpdate) ? 1.02 : 1 }}
            onClick={() => {
              if (sig.isClickable) {
                if (sig.label === "Keramaian" && !sig.canUpdate) {
                  const msg = locationPermissionDenied
                    ? "⚠️ Izin lokasi diperlukan. Silakan izinkan akses lokasi di browser Anda."
                    : `⚠️ Anda harus berada dalam radius ${radius} km dari lokasi untuk memberikan update.`;
                  alert(msg);
                  return;
                }
                handleSignalClick(sig);
              }
            }}
            className={`p-3 rounded-2xl flex flex-col items-center justify-center text-center border transition-all ${sig.isClickable && (sig.label !== "Keramaian" || sig.canUpdate)
                ? `cursor-pointer ${theme.isMalam ? 'bg-white/5 hover:bg-white/15' : 'bg-black/5 hover:bg-black/15'}`
                : `cursor-default ${theme.isMalam ? 'bg-white/5 opacity-60' : 'bg-black/5 opacity-60'}`
              }`}
            title={sig.label === "Keramaian" && !sig.canUpdate
              ? (locationPermissionDenied ? "Izin lokasi diperlukan" : `Harus dalam radius ${radius}km`)
              : `${sig.detail || ''}`}
          >
            <span className="text-lg mb-1">{sig.icon}</span>
            <p className={`text-[8px] font-black uppercase tracking-tighter opacity-40 mb-0.5 ${theme.text}`}>
              {sig.label}
            </p>
            <p className={`text-[10px] font-bold ${sig.color} leading-none`}>
              {sig.status}
              {sig.temp && <span className="text-[8px] ml-0.5">°C</span>}
            </p>
            <div className="mt-1">
              {sig.source === 'laporan_warga' && (
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              )}
            </div>
            {sig.label === "Keramaian" && sig.canUpdate && (
              <div className="mt-1 text-[8px] text-green-500">✅ bisa update</div>
            )}
            {sig.label === "Keramaian" && !sig.canUpdate && !locationPermissionDenied && (
              <div className="mt-1 text-[8px] text-red-500">🔒 luar radius</div>
            )}
            {sig.label === "Keramaian" && locationPermissionDenied && (
              <div className="mt-1 text-[8px] text-yellow-500">⚠️ perlu izin lokasi</div>
            )}
            {sig.label === "Lalu Lintas" && (
              <div className="mt-1 text-[8px] opacity-50">✨ rute</div>
            )}
          </motion.div>
        ))}
      </div>

      <UpdateCrowdModal
        isOpen={showCrowdModal}
        onClose={() => setShowCrowdModal(false)}
        tempatId={tempatId}
        tempatName={tempatCoords?.name || "lokasi ini"}
        onSubmit={handleCrowdUpdate}
        userLocation={userLocation}
        tempatCoords={tempatCoords}
      />
    </>
  );
}