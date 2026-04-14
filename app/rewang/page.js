"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import RewangCard from "@/app/components/features/rewang/RewangCard";
import DaftarRewangModal from "@/app/components/features/rewang/DaftarRewangModal";
import KTPDigital from "@/app/components/layout/KTPCard";
import KTPModal from "@/app/components/layout/KTPModal";
import { useTheme } from "@/app/hooks/useTheme";
import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { 
  ChevronLeft, MapPin, SlidersHorizontal, UserPlus, 
  Search, Hammer, Tv, Home, HeartPulse, Truck, Globe, X 
} from "lucide-react";

export default function RewangPage() {
  const { isMalam } = useTheme();
  const router = useRouter();
  const { user, profile: authProfile } = useAuth();
  
  // States
  const [selectedCat, setSelectedCat] = useState("Semua");
  const [searchQuery, setSearchQuery] = useState("");
  const [userLocation, setUserLocation] = useState(null);
  const [userLocationName, setUserLocationName] = useState(""); // 🔥 Tambah state untuk nama lokasi
  const [rewangList, setRewangList] = useState([]);
  const [isSearching, setIsSearching] = useState(true);
  const [showDaftarModal, setShowDaftarModal] = useState(false);
  const [showKTPModal, setShowKTPModal] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [error, setError] = useState(null);

  const categories = [
    { id: "Semua", icon: <Search size={12} /> },
    { id: "Bangunan", icon: <Hammer size={12} /> },
    { id: "Elektronik", icon: <Tv size={12} /> },
    { id: "Rumah Tangga", icon: <Home size={12} /> },
    { id: "Kesehatan", icon: <HeartPulse size={12} /> },
    { id: "Jasa Antar", icon: <Truck size={12} /> },
    { id: "Lainnya", icon: <Globe size={12} /> },
  ];

  // 🔥 FUNGSI REVERSE GEOCODING (sama seperti di UpdateProfileForm)
  const reverseGeocode = async (lat, lng) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`
      );
      const data = await response.json();
      
      if (data && data.address) {
        const address = data.address;
        // Prioritaskan: desa > kecamatan > kabupaten
        const locationName = address.village || 
                             address.hamlet || 
                             address.suburb || 
                             address.county || 
                             address.district || 
                             address.city || 
                             address.town || 
                             "Lokasi Anda";
        return locationName;
      }
      return null;
    } catch (error) {
      console.error("Reverse geocode error:", error);
      return null;
    }
  };

  // 🔥 Fungsi untuk mendapatkan nama lokasi dari koordinat
  const getLocationName = async (lat, lng) => {
    const name = await reverseGeocode(lat, lng);
    if (name) {
      setUserLocationName(name);
      localStorage.setItem("setempat_location_name", name);
    } else {
      setUserLocationName("Lokasi tidak diketahui");
    }
  };

  // Fetch Rewang Data
  const fetchRewangData = async () => {
    setIsSearching(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq('is_rewang', true)
        .not('profesi', 'is', null)
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      
      console.log(`✅ Loaded ${data?.length || 0} Rewang profiles`);
      setRewangList(data || []);
      
    } catch (err) {
      console.error("Error fetching Rewang:", err);
      setError("Gagal memuat data Rewang");
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    fetchRewangData();
    
    // 🔥 Load location name from localStorage (bukan koordinat)
    const savedLocationName = localStorage.getItem("setempat_location_name");
    if (savedLocationName) {
      setUserLocationName(savedLocationName);
    }
    
    // Try to get GPS location and convert to name
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          
          // Simpan koordinat untuk keperluan lain (opsional)
          const coordString = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          setUserLocation(coordString);
          localStorage.setItem("setempat_location", coordString);
          
          // 🔥 Dapatkan nama lokasi dari koordinat
          await getLocationName(latitude, longitude);
        },
        (err) => {
          console.log("GPS not allowed or error:", err.message);
          // Fallback ke lokasi dari localStorage atau default
          const fallbackName = localStorage.getItem("setempat_location_name");
          if (fallbackName) {
            setUserLocationName(fallbackName);
          } else {
            setUserLocationName("Pasuruan");
          }
        }
      );
    } else {
      // Browser tidak support GPS
      setUserLocationName("Pasuruan");
    }

    const fetchProfile = async () => {
      if (!user?.id) return;
      const { data, error } = await supabase 
        .from("profiles") 
        .select("*") 
        .eq("id", user.id) 
        .single();
      if (!error && data) setUserProfile(data);
    };
    fetchProfile();
  }, [user?.id]);

  // Filter Logic
  const filteredRewang = rewangList.filter((item) => {
    const matchesCategory = selectedCat === "Semua" || item.kategori === selectedCat;
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = searchQuery === "" || 
      item.profesi?.toLowerCase().includes(searchLower) ||
      item.deskripsi_jasa?.toLowerCase().includes(searchLower) ||
      item.full_name?.toLowerCase().includes(searchLower);
    
    return matchesCategory && matchesSearch;
  });

  const handleDaftarClick = () => {
    if (!user) {
      alert("⚠️ Login dulu ya, Lur!");
      return;
    }
    setShowKTPModal(true);
  };

  // Event listener untuk membuka modal daftar Rewang dari komponen lain
  useEffect(() => {
    const handleOpenDaftarRewang = () => {
      setShowKTPModal(false);
      setShowDaftarModal(true);
    };
    window.addEventListener("open-daftar-rewang", handleOpenDaftarRewang);
    return () => window.removeEventListener("open-daftar-rewang", handleOpenDaftarRewang);
  }, []);

  const profile = userProfile || authProfile;

  return (
    <div className={`min-h-screen w-full transition-colors duration-700 flex justify-center ${
      isMalam ? "bg-[#050505]" : "bg-slate-50"
    }`}>
      <div className="w-full max-w-[400px] relative flex flex-col">
        
        {/* HEADER */}
        <header className={`fixed top-0 w-full max-w-[400px] z-[110] px-4 pt-4 pb-3 backdrop-blur-xl border-b transition-all ${
          isMalam ? "bg-[#050505]/80 border-white/5" : "bg-white/80 border-slate-200/60"
        }`}>
          <div className="flex items-center justify-between mb-4">
            <button 
              onClick={() => router.back()} 
              className={`p-2 rounded-xl ${isMalam ? "bg-white/5 text-white" : "bg-slate-100 text-slate-900"}`}
            >
              <ChevronLeft size={18} />
            </button>
            <div className="text-center">
              <h1 className={`text-[11px] font-black uppercase tracking-[0.2em] ${isMalam ? "text-white" : "text-slate-900"}`}>
                Rewang <span className="text-[#E3655B]">.</span>
              </h1>
              <div className="flex items-center justify-center gap-1 opacity-40">
                <MapPin size={8} className="text-orange-500" />
                <span className={`text-[7px] font-bold uppercase ${isMalam ? "text-white" : "text-slate-900"}`}>
                  {/* 🔥 TAMPILKAN NAMA LOKASI, BUKAN KOORDINAT */}
                  {userLocationName || "Mendapatkan lokasi..."}
                </span>
              </div>
            </div>
            <button className={`p-2 rounded-xl ${isMalam ? "bg-white/5 text-white" : "bg-slate-100 text-slate-900"}`}>
              <SlidersHorizontal size={16} />
            </button>
          </div>

          {/* SEARCH BAR */}
          <div className={`relative flex items-center h-11 rounded-2xl border px-4 transition-all ${
            isMalam ? "bg-white/5 border-white/5 focus-within:border-orange-500/40" : "bg-slate-100/50 border-slate-100 focus-within:border-orange-500/40"
          }`}>
            <Search size={14} className="text-orange-500" />
            <input 
              type="text"
              placeholder="Cari tukang atau jasa ahli..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`flex-1 bg-transparent border-none outline-none px-3 text-[11px] font-bold placeholder:font-medium ${isMalam ? "text-white" : "text-slate-900"}`}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")}>
                <X size={14} className="opacity-40 hover:opacity-100 transition" />
              </button>
            )}
          </div>
        </header>

        <main className="px-5 pt-36 pb-32">
          {/* CATEGORIES - Sama seperti sebelumnya */}
          <section className="mb-6 sticky top-[138px] z-[100] -mx-5 px-5 py-2">
            <div className={`absolute inset-0 -z-10 backdrop-blur-md ${isMalam ? "bg-[#050505]/60" : "bg-slate-50/60"}`} />
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCat(cat.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-[9px] font-black uppercase tracking-wider transition-all flex-shrink-0 border ${
                    selectedCat === cat.id
                      ? "bg-orange-500 text-white border-orange-400 shadow-lg shadow-orange-500/20"
                      : isMalam ? "bg-white/5 text-white/40 border-white/5" : "bg-white text-slate-400 border-slate-100 shadow-sm"
                  }`}
                >
                  {cat.icon}
                  {cat.id}
                </button>
              ))}
            </div>
          </section>

          {/* ERROR STATE */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
              <p className="text-[10px] text-red-500">{error}</p>
              <button 
                onClick={fetchRewangData}
                className="text-[8px] text-red-400 underline mt-1"
              >
                Coba lagi
              </button>
            </div>
          )}

          {/* LIST RESULTS */}
          <div className="grid gap-4 mt-2">
            <div className="flex items-center gap-3 px-1 mb-2">
              <h3 className="text-[9px] font-black uppercase tracking-widest text-[#E3655B]">
                {isSearching ? "Sinkronisasi..." : `${filteredRewang.length} Ahli Tersedia`}
              </h3>
              <div className={`h-[1px] flex-1 ${isMalam ? "bg-white/10" : "bg-slate-200"}`} />
            </div>

            <AnimatePresence mode="popLayout">
              {isSearching ? (
                [1, 2, 3].map((i) => (
                  <div key={i} className={`h-36 w-full rounded-[28px] animate-pulse ${isMalam ? "bg-white/5" : "bg-slate-200/50"}`} />
                ))
              ) : filteredRewang.length > 0 ? (
                filteredRewang.map((data) => (
                  <motion.div
                    key={data.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                  >
                    <RewangCard profile={data} isMalam={isMalam} />
                  </motion.div>
                ))
              ) : (
                <div className="py-20 text-center opacity-40">
                  <Search size={40} className="mx-auto mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest">
                    {searchQuery || selectedCat !== "Semua" 
                      ? "Tidak ditemukan" 
                      : "Belum ada Rewang terdaftar"}
                  </p>
                  <p className="text-[8px] mt-2 opacity-50">
                    {searchQuery || selectedCat !== "Semua" 
                      ? "Coba kata kunci lain" 
                      : "Jadi yang pertama dengan klik +"}
                  </p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </main>

        {/* FAB BUTTON */}
        <div className="fixed bottom-8 w-full max-w-[400px] pointer-events-none z-[120] px-6 flex justify-end">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleDaftarClick}
            className="pointer-events-auto w-14 h-14 bg-orange-500 text-white rounded-[22px] shadow-2xl shadow-orange-500/40 flex items-center justify-center border-b-4 border-orange-700 hover:bg-orange-600 transition-all"
          >
            <UserPlus size={22} strokeWidth={2.5} />
          </motion.button>
        </div>

        {/* MODALS */}
        <KTPModal isOpen={showKTPModal} onClose={() => setShowKTPModal(false)} theme={{ isMalam }}>
          <KTPDigital 
            user={user} 
            role={profile?.role || "warga"} 
            theme={{ isMalam }} 
            showDaftarRewangButton={true} 
            onProfileUpdated={() => { 
              setShowKTPModal(false); 
              setShowDaftarModal(true);
            }}
          />
        </KTPModal>

        <DaftarRewangModal 
          isOpen={showDaftarModal} 
          onClose={() => setShowDaftarModal(false)} 
          profile={profile} 
          onSuccess={() => {
            fetchRewangData();
          }} 
        />
      </div>
    </div>
  );
}