"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import RewangCard from "@/app/components/features/rewang/RewangCard";
import DaftarRewangModal from "@/app/components/features/rewang/DaftarRewangModal";
import SambatModal from "@/app/components/features/rewang/SambatModal";
import KTPDigital from "@/app/components/layout/KTPCard";
import KTPModal from "@/app/components/layout/KTPModal";
import { useTheme } from "@/app/hooks/useTheme";
import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { 
  ChevronLeft, MapPin, SlidersHorizontal, UserPlus, 
  Search, Hammer, HandHelping, Home, HeartPulse, 
  PackageSearch, Coffee, X, Navigation, AlertCircle, Plus, CheckCircle2, Loader2
} from "lucide-react";

export default function RewangPage() {
  const { isMalam } = useTheme();
  const router = useRouter();
  const { user, profile: authProfile } = useAuth();
  
  // States
  const [selectedCat, setSelectedCat] = useState("Semua");
  const [searchQuery, setSearchQuery] = useState("");
  const [userLocation, setUserLocation] = useState(null);
  const [userLocationName, setUserLocationName] = useState("");
  const [radius, setRadius] = useState(5);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [rewangList, setRewangList] = useState([]);
  const [isSearching, setIsSearching] = useState(true);
  const [showDaftarModal, setShowDaftarModal] = useState(false);
  const [showKTPModal, setShowKTPModal] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [showSambatModal, setShowSambatModal] = useState(false);
  const [userProfile, setUserProfile] = useState(null);

  // Fetch Profile Manual
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return;
      const { data } = await supabase 
        .from("profiles") 
        .select("*") 
        .eq("id", user.id) 
        .single();
      if (data) setUserProfile(data);
    };
    fetchProfile();
  }, [user?.id]);

  const profile = userProfile || authProfile;

  const categories = [
    { id: "Semua", icon: <Search size={12} /> },
    { id: "Butuh Bantuan", icon: <AlertCircle size={12} className="text-red-500" /> },
    { id: "Siap Rewang", icon: <HandHelping size={12} className="text-green-500" /> },
    { id: "Pinjam Alat", icon: <PackageSearch size={12} /> },
    { id: "Tenaga Ahli", icon: <Hammer size={12} /> },
    { id: "Konsumsi", icon: <Coffee size={12} /> },
  ];

  // LOGIKA LOKASI
  const reverseGeocode = async (lat, lng) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`);
      const data = await response.json();
      if (data && data.address) {
        return data.address.village || data.address.hamlet || data.address.suburb || data.address.city || "Sekitar Pasuruan";
      }
      return null;
    } catch (error) { return null; }
  };

  const getCurrentLocation = () => {
    setIsGettingLocation(true);
    if (!navigator.geolocation) {
      setIsGettingLocation(false);
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const coordString = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        setUserLocation(coordString);
        localStorage.setItem("setempat_location", coordString);
        
        const name = await reverseGeocode(latitude, longitude);
        if (name) {
          setUserLocationName(name);
          localStorage.setItem("setempat_location_name", name);
        }
        setIsGettingLocation(false);
      },
      () => setIsGettingLocation(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    const savedName = localStorage.getItem("setempat_location_name");
    if (savedName) setUserLocationName(savedName);

    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then((status) => {
        if (status.state === 'granted') getCurrentLocation();
        else if (!savedName) setUserLocationName("Aktifkan Lokasi");
      });
    }
  }, []);

  // 1. DATA FETCHING - LOGIKA HYBRID
  const fetchRewangData = async () => {
    setIsSearching(true);
    try {
      // Ambil Rewang (Penyedia Jasa)
      const { data: dataRewang } = await supabase
        .from("profiles")
        .select("*")
        .eq('is_rewang', true)
        .order('updated_at', { ascending: false });

      // Ambil Saling Bantu (Pencari Bantuan)
      const { data: dataSambatan } = await supabase
        .from("sambatan")
        .select("*")
        .eq('status', 'aktif')
        .order('created_at', { ascending: false });

      // GABUNGKAN DENGAN TYPE YANG JELAS
      const combined = [
        ...(dataRewang || []).map(item => ({ 
          ...item, 
          type: 'rewang', // Identitas asli
          display_category: item.kategori || "Tenaga Ahli",
        })),
        ...(dataSambatan || []).map(item => ({ 
          ...item, 
          type: 'kebutuhan', // Identitas asli
          display_category: "Butuh Bantuan",
        }))
      ];

      setRewangList(combined);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => { fetchRewangData(); }, []);

  // 2. FILTER LOGIC - SMART DIFFERENTIATION
  const filteredRewang = rewangList.filter((item) => {
    // Logika Search
    const searchTerm = searchQuery.toLowerCase();
    const matchesSearch = searchQuery === "" || 
      (item.full_name || item.nama_pengirim || "").toLowerCase().includes(searchTerm) ||
      (item.judul || item.profesi || "").toLowerCase().includes(searchTerm);

    // Logika Kategori (Inti Perbaikan)
    if (selectedCat === "Semua") return matchesSearch;
    
    if (selectedCat === "Butuh Bantuan") {
      return item.type === 'kebutuhan' && matchesSearch;
    }
    
    if (selectedCat === "Siap Rewang") {
      return item.type === 'rewang' && matchesSearch;
    }

    // Filter untuk kategori spesifik (Pinjam Alat, Konsumsi, dll)
    return item.kategori === selectedCat && matchesSearch;
  });

  return (
    <div className={`min-h-screen w-full transition-colors duration-700 flex justify-center ${isMalam ? "bg-[#050505]" : "bg-slate-50"}`}>
      <div className="w-full max-w-[400px] relative flex flex-col">
        
        {/* HEADER */}
        <header className={`fixed top-0 w-full max-w-[400px] z-[110] px-4 pt-4 pb-3 backdrop-blur-xl border-b transition-all ${
          isMalam ? "bg-[#050505]/80 border-white/5" : "bg-white/80 border-slate-200/60"
        }`}>
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => router.back()} className={`p-2 rounded-xl active:scale-90 ${isMalam ? "bg-white/5 text-white" : "bg-slate-100 text-slate-900"}`}>
              <ChevronLeft size={18} />
            </button>
            
            <button onClick={getCurrentLocation} disabled={isGettingLocation} className="text-center group active:scale-95 transition-all">
              <h1 className={`text-[11px] font-black uppercase tracking-[0.2em] ${isMalam ? "text-white" : "text-slate-900"}`}>
                Rewang <span className="text-orange-500">Warga</span>
              </h1>
              <div className="flex items-center justify-center gap-1 opacity-60">
                <MapPin size={8} className={`text-orange-500 ${isGettingLocation ? "animate-bounce" : "animate-pulse"}`} />
                <span className={`text-[7px] font-bold uppercase tracking-widest ${isMalam ? "text-white" : "text-slate-900"}`}>
                  {isGettingLocation ? "Mencari..." : (userLocationName || "Pasuruan")} • {radius} KM
                </span>
              </div>
            </button>
            
            <div className="relative">
              <button 
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={`p-2 rounded-xl transition-all ${isFilterOpen ? "bg-orange-500 text-white shadow-lg" : (isMalam ? "bg-white/5 text-white" : "bg-slate-100 text-slate-900")}`}
              >
                <SlidersHorizontal size={16} />
              </button>

              <AnimatePresence>
                {isFilterOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className={`absolute right-0 mt-3 w-40 p-2 rounded-[24px] border shadow-2xl z-[150] ${isMalam ? "bg-[#0A0A0A] border-white/10" : "bg-white border-slate-100"}`}
                  >
                    <p className="text-[8px] font-black uppercase tracking-widest p-2 opacity-40">Jarak Maksimal</p>
                    <div className="flex flex-col gap-1">
                      {[1, 5, 10, 20].map((r) => (
                        <button
                          key={r}
                          onClick={() => { setRadius(r); setIsFilterOpen(false); }}
                          className={`flex justify-between items-center px-4 py-2.5 rounded-2xl text-[10px] font-bold transition-all ${
                            radius === r ? "bg-orange-500 text-white" : (isMalam ? "hover:bg-white/5 text-white/60" : "hover:bg-slate-50 text-slate-600")
                          }`}
                        >
                          {r} KM {radius === r && <CheckCircle2 size={12} />}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className={`relative flex items-center h-11 rounded-2xl border px-4 transition-all ${
            isMalam ? "bg-white/5 border-white/5 focus-within:border-orange-500/40" : "bg-slate-100/50 border-slate-100 focus-within:border-orange-500/40"
          }`}>
            <Search size={14} className="text-orange-500" />
            <input 
              type="text"
              placeholder="Cari bantuan atau tawarkan jasa..."
              className={`flex-1 bg-transparent border-none outline-none px-3 text-[11px] font-bold ${isMalam ? "text-white" : "text-slate-900"}`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </header>
        
        <main className="px-5 pt-36 pb-32">
          {/* BANNER INTERAKTIF */}
          <div className={`mb-6 p-4 rounded-[24px] border ${isMalam ? "bg-orange-500/10 border-orange-500/20" : "bg-orange-50 border-orange-100"}`}>
             <p className={`text-[10px] font-bold leading-relaxed ${isMalam ? "text-orange-200" : "text-orange-700"}`}>
               "Urip iku urup, Lur. Ayo saling bantu antar tetangga agar lingkungan makin guyub."
             </p>
          </div>

          {/* TAB CATEGORIES (Tambahkan indikator jumlah jika perlu) */}
          <section className="mb-6 overflow-x-auto no-scrollbar flex gap-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCat(cat.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-[9px] font-black uppercase tracking-wider transition-all flex-shrink-0 border ${
                  selectedCat === cat.id
                    ? "bg-orange-500 text-white border-orange-400 shadow-lg"
                    : isMalam ? "bg-white/5 text-white/40 border-white/5" : "bg-white text-slate-400 border-slate-100"
                }`}
              >
                {cat.icon} {cat.id}
              </button>
            ))}
          </section>

          {/* LIST RESULTS - WITH TYPE HEADER */}
          <div className="grid gap-4 mt-2">
            {isSearching ? (
              <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-orange-500" /></div>
            ) : (
              <>
                {/* Info Dinamis Header List */}
                <div className="flex items-center gap-3 px-1 mb-2">
                  <h3 className="text-[9px] font-black uppercase tracking-widest text-orange-500">
                    {selectedCat === "Butuh Bantuan" ? "🆘 Warga Butuh Bantuan" : 
                     selectedCat === "Siap Rewang" ? "🛠️ Tetangga Siap Rewang" : "Semua Aktivitas Warga"}
                  </h3>
                  <div className={`h-[1px] flex-1 ${isMalam ? "bg-white/10" : "bg-slate-200"}`} />
                </div>

                <AnimatePresence mode="popLayout">
                  {filteredRewang.map((data) => (
                    <motion.div
                      key={`${data.type}_${data.id}`}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                    >
                      {/* Komponen RewangCard sekarang menerima objek yang sudah punya 'type' */}
                      <RewangCard profile={data} isMalam={isMalam} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </>
            )}

            {!isSearching && filteredRewang.length === 0 && (
              <div className="text-center py-20 opacity-40">
                <p className="text-[11px] font-black uppercase tracking-widest">Kosong, Lur.</p>
              </div>
            )}
          </div>
        </main>

        {/* FAB */}
        <div className="fixed bottom-8 w-full max-w-[400px] pointer-events-none z-[120] px-6 flex flex-col items-end gap-3">
          <AnimatePresence>
            {isFabOpen && (
              <motion.div 
                initial={{ opacity: 0, y: 15, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 15, scale: 0.9 }}
                className="flex flex-col items-end gap-3 mb-3"
              >
                <motion.div whileHover={{ x: -5 }} className="flex items-center gap-3 pointer-events-auto">
                  <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black shadow-sm border ${
                    isMalam ? "bg-[#1A1A1A] border-white/10 text-white" : "bg-white border-slate-200 text-slate-700"
                  }`}>
                    SAYA BUTUH BANTUAN
                  </span>
                  <button 
                    onClick={() => { setShowSambatModal(true); setIsFabOpen(false); }}
                    className="w-12 h-12 bg-red-500 text-white rounded-2xl shadow-lg flex items-center justify-center active:scale-90 border-b-4 border-red-800"
                  >
                    <AlertCircle size={20} />
                  </button>
                </motion.div>

                <motion.div whileHover={{ x: -5 }} className="flex items-center gap-3 pointer-events-auto">
                  <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black shadow-sm border ${
                    isMalam ? "bg-[#1A1A1A] border-white/10 text-white" : "bg-white border-slate-200 text-slate-700"
                  }`}>
                    DAFTAR JADI REWANG
                  </span>
                  <button 
                    onClick={() => { setShowDaftarModal(true); setIsFabOpen(false); }}
                    className="w-12 h-12 bg-emerald-600 text-white rounded-2xl shadow-lg flex items-center justify-center active:scale-90 border-b-4 border-emerald-800"
                  >
                    <UserPlus size={20} />
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsFabOpen(!isFabOpen)}
            className={`pointer-events-auto w-14 h-14 rounded-[22px] shadow-2xl flex items-center justify-center transition-all duration-300 ${
              isFabOpen 
                ? "bg-slate-800 text-white rotate-45" 
                : "bg-orange-500 text-white shadow-orange-500/40 border-b-4 border-orange-700"
            }`}
          >
            {isFabOpen ? (
              <X size={24} className="-rotate-45" />
            ) : (
              <div className="flex flex-col items-center gap-0.5">
                <Plus size={24} strokeWidth={3} />
                <span className="text-[7px] font-black leading-none">MENU</span>
              </div>
            )}
          </motion.button>
        </div>

        {/* MODALS */}


        <SambatModal 
          isOpen={showSambatModal} 
          onClose={() => setShowSambatModal(false)}
          user={user}
          profile={profile}
          onSuccess={() => {
            fetchRewangData();
          }}
          theme={{ isMalam }}
        />

        <DaftarRewangModal 
          isOpen={showDaftarModal} 
          onClose={() => setShowDaftarModal(false)} 
          profile={profile} 
          isMalam={isMalam}
          onSuccess={() => {
            fetchRewangData();
          }} 
        />
      </div>
    </div>
  );
}