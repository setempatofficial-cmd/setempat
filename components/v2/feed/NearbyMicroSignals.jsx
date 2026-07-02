// components/v2/feed/NearbyMicroSignals.jsx
"use client";
import { motion } from "framer-motion";
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useWeather } from "@/hooks/useWeather";
import dynamic from 'next/dynamic';

const MiniMapV2 = dynamic(
  () => import('@/components/v2/maps/MiniMapV2'),
  {
    ssr: false,
    loading: () => <div className="h-[200px] w-full bg-gray-100 animate-pulse rounded-2xl" />
  }
);

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
  const [errorMessage, setErrorMessage] = useState(null);
  const [distanceToLocation, setDistanceToLocation] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Cek user login saat modal dibuka
  useEffect(() => {
    async function checkUserAuth() {
      if (!isOpen) return;

      setIsCheckingAuth(true);
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Session error:", error);
          setErrorMessage("Gagal memeriksa sesi login. Silakan refresh halaman.");
          setCurrentUser(null);
          return;
        }

        if (!session) {
          setErrorMessage("⚠️ Anda harus login terlebih dahulu untuk mengirim update keramaian.");
          setCurrentUser(null);
          return;
        }

        setCurrentUser({
          id: session.user.id,
          email: session.user.email,
          full_name: session.user.user_metadata?.full_name ||
            session.user.email?.split('@')[0] ||
            "Warga",
          avatar_url: session.user.user_metadata?.avatar_url
        });

        setErrorMessage(null);
      } catch (error) {
        console.error("Error checking auth:", error);
        setErrorMessage("Terjadi kesalahan. Silakan coba lagi.");
        setCurrentUser(null);
      } finally {
        setIsCheckingAuth(false);
      }
    }

    checkUserAuth();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && userLocation && tempatCoords) {
      const distance = calculateDistance(
        userLocation.lat, userLocation.lon,
        tempatCoords.latitude, tempatCoords.longitude
      );
      setDistanceToLocation(distance);
    }
    if (isOpen) {
      setErrorMessage(null);
      setEstimatedPeople(50);
      setDescription("");
    }
  }, [isOpen, userLocation, tempatCoords]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!currentUser) {
      setErrorMessage("⚠️ Anda harus login terlebih dahulu untuk mengirim update.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (!tempatId) {
        throw new Error("ID tempat tidak ditemukan");
      }

      if (estimatedPeople < 0 || estimatedPeople > 1000) {
        throw new Error("Jumlah orang tidak valid");
      }

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        throw new Error("Sesi login tidak valid. Silakan login kembali.");
      }

      if (!session) {
        throw new Error("Anda tidak terautentikasi. Silakan login terlebih dahulu.");
      }

      const laporanData = {
        tempat_id: tempatId,
        user_id: currentUser.id,
        username: currentUser.full_name,
        user_email: currentUser.email,
        estimated_people: estimatedPeople,
        deskripsi: description || `Laporan keramaian: sekitar ${estimatedPeople} orang`,
        tipe: estimatedPeople > 100 ? "antri" : estimatedPeople > 50 ? "ramai" : "sepi",
        status: "approved",
        created_at: new Date().toISOString(),
        report_type: "place"
      };

      console.log("Submitting laporan by user:", {
        id: currentUser.id,
        name: currentUser.full_name,
        email: currentUser.email
      });

      const { data, error } = await supabase
        .from('laporan_warga')
        .insert([laporanData])
        .select();

      if (error) {
        console.error("Supabase insert error:", error);

        if (error.code === '42501') {
          throw new Error("Tidak memiliki izin untuk menambah laporan. Silakan hubungi admin.");
        } else if (error.code === '23505') {
          throw new Error("Anda sudah mengirim laporan untuk lokasi ini baru-baru ini");
        } else if (error.code === '42P01') {
          throw new Error("Tabel laporan_warga tidak ditemukan. Silakan hubungi admin.");
        } else {
          throw new Error(`Gagal menyimpan laporan: ${error.message}`);
        }
      }

      console.log("Successfully submitted by:", currentUser.full_name, data);

      if (onSubmit) {
        await onSubmit(laporanData);
      }

      onClose();
      alert(`✅ Laporan berhasil dikirim oleh ${currentUser.full_name}!\nTerima kasih atas partisipasinya.`);

    } catch (error) {
      console.error("Error in handleSubmit:", error);
      setErrorMessage(error.message || "Gagal mengirim laporan. Silakan coba lagi.");
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
        <h3 className="font-bold text-lg mb-2 dark:text-white">📍 Update Keramaian</h3>

        {currentUser && !isCheckingAuth && (
          <div className="mb-3 px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white text-[10px]">
                {currentUser.full_name?.charAt(0) || '?'}
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-medium text-blue-600 dark:text-blue-400">
                  Mengirim sebagai:
                </p>
                <p className="text-[11px] font-bold text-blue-700 dark:text-blue-300">
                  {currentUser.full_name}
                </p>
              </div>
            </div>
          </div>
        )}

        {isCheckingAuth && (
          <div className="mb-3 px-3 py-2 bg-gray-500/10 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              <p className="text-[11px] text-gray-600 dark:text-gray-400">Memeriksa sesi login...</p>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="mb-3 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-[11px] text-red-600 dark:text-red-400 font-medium">
              ⚠️ {errorMessage}
            </p>
          </div>
        )}

        {distanceToLocation && (
          <div className={`mb-3 px-2 py-1.5 rounded-lg ${distanceToLocation <= 0.5
            ? 'bg-green-500/10 border border-green-500/30'
            : 'bg-yellow-500/10 border border-yellow-500/30'
            }`}>
            <p className={`text-[10px] font-medium flex items-center gap-1 ${distanceToLocation <= 0.5
              ? 'text-green-600 dark:text-green-400'
              : 'text-yellow-600 dark:text-yellow-400'
              }`}>
              {distanceToLocation <= 0.5 ? '📍' : '⚠️'}
              Anda berada {Math.round(distanceToLocation * 1000)}m dari lokasi
            </p>
          </div>
        )}

        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Update kondisi terkini di {tempatName}
        </p>

        <div className="mb-3">
          <label className="text-xs font-medium block mb-1 dark:text-gray-300">
            Perkiraan jumlah orang
          </label>
          <input
            type="range"
            min="0"
            max="300"
            value={estimatedPeople}
            onChange={(e) => setEstimatedPeople(Number(e.target.value))}
            className="w-full"
            disabled={!currentUser || isCheckingAuth}
          />
          <div className="flex justify-between text-xs mt-1">
            <span className={estimatedPeople <= 50 ? "text-green-500 font-bold" : "text-gray-500"}>
              Sepi (0-50)
            </span>
            <span className="font-bold text-blue-500">{estimatedPeople} orang</span>
            <span className={estimatedPeople >= 100 ? "text-red-500 font-bold" : "text-gray-500"}>
              Ramai (100+)
            </span>
          </div>
        </div>

        <div className="mb-4">
          <label className="text-xs font-medium block mb-1 dark:text-gray-300">
            Catatan (opsional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Contoh: Antrean panjang di kasir, suasana ramai pengunjung..."
            className="w-full p-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            rows={2}
            disabled={!currentUser || isCheckingAuth}
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !currentUser || isCheckingAuth}
            className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:from-blue-600 hover:to-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Mengirim...
              </span>
            ) : !currentUser ? "🔒 Login untuk Update" : "📤 Kirim Update"}
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 dark:bg-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition"
          >
            Batal
          </button>
        </div>

        {!currentUser && !isCheckingAuth && (
          <p className="text-[10px] text-center text-gray-500 dark:text-gray-400 mt-3">
            💡 Anda perlu login untuk mengirim update keramaian
          </p>
        )}
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
  const [currentUser, setCurrentUser] = useState(null);
  const [isLocationLoading, setIsLocationLoading] = useState(false);

  const channelRef = useRef(null);
  const isMountedRef = useRef(true);

  // Ambil user yang sedang login
  useEffect(() => {
    async function getCurrentUser() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Error getting session:", error);
          return;
        }

        if (session?.user) {
          setCurrentUser({
            id: session.user.id,
            email: session.user.email,
            full_name: session.user.user_metadata?.full_name ||
              session.user.email?.split('@')[0] ||
              "Warga"
          });
        }
      } catch (error) {
        console.error("Error in getCurrentUser:", error);
      }
    }
    getCurrentUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setCurrentUser({
          id: session.user.id,
          email: session.user.email,
          full_name: session.user.user_metadata?.full_name ||
            session.user.email?.split('@')[0] ||
            "Warga"
        });
      } else {
        setCurrentUser(null);
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  // Ambil koordinat tempat
  useEffect(() => {
    async function getTempatCoords() {
      try {
        const { data, error } = await supabase
          .from('tempat')
          .select('latitude, longitude, name')
          .eq('id', tempatId)
          .single();

        if (error) {
          console.error("Error fetching tempat coords:", error);
          setError("Gagal mengambil data tempat: " + error.message);
          return;
        }

        if (data) {
          setTempatCoords(data);
        } else {
          setError("Data tempat tidak ditemukan");
        }
      } catch (err) {
        console.error("Error in getTempatCoords:", err);
        setError(err.message);
      }
    }
    getTempatCoords();
  }, [tempatId]);

  // Cek lokasi user - SEKALI SAJA, bukan continuous watch
  const checkUserLocation = useCallback(() => {
    if (!tempatCoords) return;
    if (locationPermissionDenied) return; // Jangan coba lagi jika sudah ditolak
    if (isLocationLoading) return; // Hindari multiple request

    if (!navigator.geolocation) {
      setLocationPermissionDenied(true);
      return;
    }

    setIsLocationLoading(true);

    // Hanya sekali getCurrentPosition, BUKAN watchPosition
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!isMountedRef.current) return;

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
        setIsLocationLoading(false);
      },
      (error) => {
        if (!isMountedRef.current) return;

        // Handle error dengan lebih baik, jangan selalu console.error
        console.warn("Geolocation warning:", error.code, error.message);

        if (error.code === 1) { // PERMISSION_DENIED
          setLocationPermissionDenied(true);
        } else if (error.code === 3) { // TIMEOUT
          // Coba sekali lagi dengan timeout lebih lama
          setTimeout(() => {
            if (isMountedRef.current && !locationPermissionDenied) {
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  if (!isMountedRef.current) return;
                  const userLat = pos.coords.latitude;
                  const userLon = pos.coords.longitude;
                  const distance = calculateDistance(
                    userLat, userLon,
                    tempatCoords.latitude, tempatCoords.longitude
                  );
                  setUserLocation({ lat: userLat, lon: userLon });
                  setDistanceToTempat(distance);
                  setIsWithinRadius(distance <= radius);
                  setLocationPermissionDenied(false);
                  setIsLocationLoading(false);
                },
                (err) => {
                  if (!isMountedRef.current) return;
                  console.warn("Geolocation retry failed:", err.message);
                  setIsLocationLoading(false);
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
              );
            }
          }, 1000);
        } else {
          setIsLocationLoading(false);
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 } // Cache lokasi 1 menit
    );
  }, [tempatCoords, radius, locationPermissionDenied, isLocationLoading]);

  // Panggil check location ketika tempatCoords tersedia
  useEffect(() => {
    if (tempatCoords && !locationPermissionDenied) {
      checkUserLocation();
    }
  }, [tempatCoords, checkUserLocation, locationPermissionDenied]);

  const handleCrowdClick = useCallback(() => {
    if (!currentUser) {
      alert("⚠️ Anda harus login terlebih dahulu untuk mengirim update keramaian.\n\nSilakan login menggunakan akun Anda.");
      return;
    }

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
  }, [currentUser, isWithinRadius, distanceToTempat, radius, locationPermissionDenied]);

  const { weather: weatherData } = useWeather(tempatCoords?.name || '');

  const getWeatherData = useCallback(() => {
    if (weatherData && weatherData.short) {
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
  }, [weatherData]);

  const handleSignalClick = useCallback((signal) => {
    if (signal.label === "Lalu Lintas" && tempatCoords) {
      const { latitude, longitude, name } = tempatCoords;
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&query=${encodeURIComponent(name)}`, '_blank');
    }
    if (signal.label === "Keramaian") handleCrowdClick();
  }, [tempatCoords, handleCrowdClick]);

  const handleCrowdUpdate = useCallback(async (laporanData) => {
    console.log("Crowd update completed by user:", currentUser?.full_name, laporanData);
    await fetchLaporanWarga();
  }, [currentUser]);

  // Fetch laporan dengan error handling yang lebih baik
  const fetchLaporanWarga = useCallback(async () => {
    if (!tempatId || !isMountedRef.current) return;

    try {
      setLoading(true);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      console.log("Fetching laporan for tempat_id:", tempatId);
      console.log("Date range:", sevenDaysAgo.toISOString());

      // Coba ambil data dengan lebih sederhana dulu untuk testing
      const { data: laporanList, error: laporanError } = await supabase
        .from('laporan_warga')
        .select('*')  // Select all columns dulu untuk debugging
        .eq('tempat_id', tempatId)
        .eq('status', 'approved')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(100);  // Batasi jumlah data

      if (laporanError) {
        console.error("Detailed error fetching laporan:", {
          message: laporanError.message,
          code: laporanError.code,
          details: laporanError.details,
          hint: laporanError.hint
        });

        // Jika error karena kolom tidak ada, coba tanpa filter
        if (laporanError.code === 'PGRST204') {
          console.log("Trying without status filter...");
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('laporan_warga')
            .select('*')
            .eq('tempat_id', tempatId)
            .gte('created_at', sevenDaysAgo.toISOString())
            .order('created_at', { ascending: false })
            .limit(100);

          if (fallbackError) {
            throw fallbackError;
          }

          if (isMountedRef.current) {
            processLaporanData(fallbackData || []);
          }
        } else {
          throw laporanError;
        }
      } else {
        if (isMountedRef.current) {
          processLaporanData(laporanList || []);
        }
      }
    } catch (err) {
      if (isMountedRef.current) {
        console.error("Error in fetchLaporanWarga:", err);
        setError(`Gagal memuat data: ${err.message || "Unknown error"}`);
        setSignals(getFallbackSignals());
      }
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [tempatId, isWithinRadius, locationPermissionDenied, currentUser]);

  // Fungsi terpisah untuk memproses data laporan
  const processLaporanData = useCallback((allReports) => {
    const trafficReports = allReports.filter(r => {
      if (r.tipe === 'sepi' || r.tipe === 'ramai' || r.tipe === 'antri') return true;
      if (r.deskripsi) {
        const text = r.deskripsi.toLowerCase();
        if (text.includes('macet') || text.includes('lancar') || text.includes('padat') || text.includes('antri')) return true;
      }
      return false;
    });

    const crowdReports = allReports.filter(r => {
      if (r.estimated_people !== null && r.estimated_people !== undefined) return true;
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

    const reportsWithPeople = crowdReports.filter(r => r.estimated_people !== null && r.estimated_people !== undefined);
    const avgPeople = reportsWithPeople.length > 0 ? Math.round(reportsWithPeople.reduce((sum, r) => sum + r.estimated_people, 0) / reportsWithPeople.length) : null;

    const reportsWithWaitTime = crowdReports.filter(r => r.estimasi_menit !== null);
    const avgWaitTime = reportsWithWaitTime.length > 0 ? Math.round(reportsWithWaitTime.reduce((sum, r) => sum + r.estimasi_menit, 0) / reportsWithWaitTime.length) : null;

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
        color: crowdStatus.color, detail: avgPeople ? `±${avgPeople} org` : (avgWaitTime ? `±${avgWaitTime} mnt` : (crowdReports.length > 0 ? `${crowdReports.length} laporan` : "Belum ada laporan")),
        source: crowdReports.length > 0 ? "laporan_warga" : "no_data", isClickable: true,
        canUpdate: isWithinRadius && !locationPermissionDenied && !!currentUser
      },
    ]);
    setError(null);
  }, [isWithinRadius, locationPermissionDenied, currentUser, getWeatherData]);

  // ============ SETUP SUBSCRIPTION + POLLING FALLBACK ============
  useEffect(() => {
    if (!tempatId) return;

    isMountedRef.current = true;

    // Fetch data awal
    fetchLaporanWarga();

    let pollInterval = null;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 3;

    // Cleanup channel sebelumnya
    if (channelRef.current) {
      try {
        supabase.removeChannel(channelRef.current);
      } catch (e) {
        console.warn("Cleanup channel error:", e);
      }
      channelRef.current = null;
    }

    const timeoutId = setTimeout(() => {
      if (!isMountedRef.current) return;

      try {
        const newChannel = supabase.channel(`laporan_${tempatId}`, {
          config: {
            broadcast: { ack: false },
            presence: { key: '' }
          }
        });

        newChannel.on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'laporan_warga',
          filter: `tempat_id=eq.${tempatId}`
        }, (payload) => {
          if (isMountedRef.current) {
            console.log("📡 New laporan detected via Realtime");
            fetchLaporanWarga();
            // Reset reconnect attempts on success
            reconnectAttempts = 0;
          }
        });

        newChannel.subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            console.log(`✅ Subscribed to laporan_${tempatId}`);
            // 🔥 Hentikan polling jika realtime berhasil
            if (pollInterval) {
              clearInterval(pollInterval);
              pollInterval = null;
            }
          } else if (status === 'CHANNEL_ERROR') {
            console.warn(`⚠️ Subscription error for laporan_${tempatId}`, err);

            // 🔥 Mulai polling sebagai fallback
            if (!pollInterval) {
              console.log("🔄 Starting polling fallback (every 30s)");
              pollInterval = setInterval(() => {
                if (isMountedRef.current) {
                  fetchLaporanWarga();
                }
              }, 30000);
            }
          }
        });

        channelRef.current = newChannel;

      } catch (err) {
        console.error("❌ Failed to create channel:", err);
        // 🔥 Fallback ke polling
        if (!pollInterval) {
          console.log("🔄 Starting polling fallback (every 30s)");
          pollInterval = setInterval(() => {
            if (isMountedRef.current) {
              fetchLaporanWarga();
            }
          }, 30000);
        }
      }
    }, 500);

    return () => {
      clearTimeout(timeoutId);
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      isMountedRef.current = false;
      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current);
        } catch (e) {
          console.warn("Cleanup channel error:", e);
        }
        channelRef.current = null;
      }
    };
  }, [tempatId, fetchLaporanWarga]);

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
    if (reports.length === 0) return { status: "Tdk Ada Laporan", icon: "❓", color: "text-gray-400" };
    const reportsWithPeople = reports.filter(r => r.estimated_people !== null);
    if (reportsWithPeople.length > 0) {
      const avgPeople = reportsWithPeople.reduce((sum, r) => sum + r.estimated_people, 0) / reportsWithPeople.length;
      if (avgPeople > 100) return { status: "Sgt Ramai", icon: "👥👥👥", color: "text-red-400" };
      if (avgPeople > 50) return { status: "Ramai", icon: "👥👥", color: "text-orange-400" };
      if (avgPeople > 20) return { status: "Normal", icon: "👥", color: "text-amber-400" };
      if (avgPeople > 0) return { status: "Sepi", icon: "👤", color: "text-gray-400" };
    }
    const reportsWithWaitTime = reports.filter(r => r.estimasi_menit !== null);
    if (reportsWithWaitTime.length > 0) {
      const avgWait = reportsWithWaitTime.reduce((sum, r) => sum + r.estimasi_menit, 0) / reportsWithWaitTime.length;
      if (avgWait > 30) return { status: "Antri Pjg", icon: "🚶‍♂️🚶‍♀️", color: "text-red-400" };
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
      { id: 1, label: "Lalu Lintas", status: "Tdk Ada Data", icon: "❓", color: "text-gray-400", source: "fallback", isClickable: false },
      { id: 2, label: "Cuaca", status: "Memuat...", icon: "🌡️", color: "text-gray-400", source: "fallback", isClickable: false },
      { id: 3, label: "Keramaian", status: "Tdk Ada Data", icon: "❓", color: "text-gray-400", source: "fallback", isClickable: false },
    ];
  }

  if (loading && !signals) {
    return (
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map(i => (
          <div key={i} className={`p-3 rounded-2xl animate-pulse ${theme?.isMalam ? 'bg-white/5' : 'bg-black/5'}`}>
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
      <div className={`p-4 rounded-2xl text-center text-xs ${theme?.isMalam ? 'bg-red-500/10' : 'bg-red-100'}`}>
        <span>⚠️ {error}</span>
        <button
          onClick={() => fetchLaporanWarga()}
          className="ml-2 text-blue-500 underline"
        >
          Coba lagi
        </button>
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
                  if (!currentUser) {
                    alert("⚠️ Anda harus login terlebih dahulu untuk mengirim update keramaian.");
                  } else if (locationPermissionDenied) {
                    alert("⚠️ Izin lokasi diperlukan. Silakan izinkan akses lokasi di browser Anda.");
                  } else {
                    alert(`⚠️ Anda harus berada dalam radius ${radius} km dari lokasi untuk memberikan update.`);
                  }
                  return;
                }
                handleSignalClick(sig);
              }
            }}
            className={`p-3 rounded-2xl flex flex-col items-center justify-center text-center border transition-all ${sig.isClickable && (sig.label !== "Keramaian" || sig.canUpdate)
              ? `cursor-pointer ${theme?.isMalam ? 'bg-white/5 hover:bg-white/15' : 'bg-black/5 hover:bg-black/15'}`
              : `cursor-default ${theme?.isMalam ? 'bg-white/5 opacity-60' : 'bg-black/5 opacity-60'}`
              }`}
            title={sig.label === "Keramaian" && !sig.canUpdate
              ? (!currentUser ? "Harus login terlebih dahulu" : (locationPermissionDenied ? "Izin lokasi diperlukan" : `Harus dalam radius ${radius}km`))
              : `${sig.detail || ''}`}
          >
            <span className="text-lg mb-1">{sig.icon}</span>
            <p className={`text-[8px] font-black uppercase tracking-tighter opacity-40 mb-0.5 ${theme?.text || ''}`}>
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
              <div className="mt-1 text-[8px] text-green-500">✅ update</div>
            )}
            {sig.label === "Keramaian" && !sig.canUpdate && !locationPermissionDenied && currentUser && (
              <div className="mt-1 text-[8px] text-red-500">🔒 luar radius</div>
            )}
            {sig.label === "Keramaian" && !currentUser && (
              <div className="mt-1 text-[8px] text-yellow-500">🔒 perlu login</div>
            )}
            {sig.label === "Keramaian" && locationPermissionDenied && currentUser && (
              <div className="mt-1 text-[8px] text-yellow-500">⚠️ perlu izin</div>
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