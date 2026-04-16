"use client";

import { use } from "react";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import { useTheme } from "@/app/hooks/useTheme";
import { useAuth } from "@/app/context/AuthContext";
import { useLocation } from "@/components/LocationProvider";
import FeedCard from "@/app/components/feed/FeedCard";
import Header from "@/components/Header";
import LocationModal from "@/components/LocationModal";
import AuthModal from "@/app/components/auth/AuthModal";
import SearchModal from "@/app/components/feed/SearchModal";
import AIModal from "@/app/components/ai/AIModal";
import KomentarModal from "@/app/components/feed/KomentarModal";
import LaporanWarga from "@/app/components/layout/LaporanWarga";
import FormLaporanAktif from "@/app/components/modals/FormLaporanAktif";
import SmartBottomNav from "@/app/components/layout/SmartBottomNav";
import UploadModal from "@/components/UploadModal";

// ==================== KOMPONEN REKOMENDASI ====================
function RekomendasiFeed({
  currentItemId,
  userLocation,
  locationReady,
  theme,
  onOpenAIModal,
  onOpenKomentarModal,
  onShare,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [comments, setComments] = useState({});
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState({});
  const loaderRef = useRef(null);
  const isMalam = theme.isMalam;

  const MAX_ITEMS = 15;

  useEffect(() => {
    const loadCommentsForItems = async () => {
      const commentsMap = {};
      for (const item of items) {
        const { data } = await supabase
          .from("komentar")
          .select("*")
          .eq("tempat_id", item.id)
          .order("created_at", { ascending: false });
        commentsMap[item.id] = data || [];
      }
      setComments(commentsMap);
    };
    
    if (items.length > 0) {
      loadCommentsForItems();
    }
  }, [items]);

  const fetchRekomendasi = useCallback(
    async (reset = false) => {
      if (!hasMore && !reset) return;
      if (items.length >= MAX_ITEMS && !reset) return;

      const currentPage = reset ? 0 : page;
      const limit = 5;
      const offset = currentPage * limit;

      setLoading(true);

      try {
        let query = supabase
          .from("feed_view")
          .select("*")
          .neq("id", currentItemId)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);

        if (locationReady && userLocation?.latitude) {
          const radius = 10;
          const lat = userLocation.latitude;
          const lng = userLocation.longitude;
          const latDelta = radius / 111;
          const lngDelta = radius / (111 * Math.cos((lat * Math.PI) / 180));

          query = query
            .gte("latitude", lat - latDelta)
            .lte("latitude", lat + latDelta)
            .gte("longitude", lng - lngDelta);
        }

        const { data, error } = await query;
        if (error) throw error;

        const uniqueData = data
          ? Array.from(new Map(data.map((item) => [item.id, item])).values())
          : [];

        let newItems;
        if (reset) {
          newItems = uniqueData || [];
        } else {
          const combined = [...items, ...(uniqueData || [])];
          newItems = Array.from(
            new Map(combined.map((item) => [item.id, item])).values()
          );
        }

        if (newItems.length > MAX_ITEMS) {
          newItems = newItems.slice(0, MAX_ITEMS);
          setHasMore(false);
        } else {
          setHasMore(
            (data || []).length === limit && newItems.length < MAX_ITEMS
          );
        }

        setItems(newItems);
        setPage(currentPage + 1);
      } catch (err) {
        console.error("Error fetching rekomendasi:", err);
      } finally {
        setLoading(false);
      }
    },
    [currentItemId, page, hasMore, locationReady, userLocation, items.length]
  );

  useEffect(() => {
    if (!loaderRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          !loading &&
          hasMore &&
          items.length < MAX_ITEMS
        ) {
          fetchRekomendasi(false);
        }
      },
      { threshold: 0.1, rootMargin: "200px" }
    );

    observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [loading, hasMore, fetchRekomendasi, items.length]);

  useEffect(() => {
    fetchRekomendasi(true);
  }, []);

  if (loading && items.length === 0) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-5 h-5 border-2 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8">
        <p className={`text-xs ${isMalam ? "text-white/40" : "text-slate-400"}`}>
          Belum ada konten lain di sekitar
        </p>
      </div>
    );
  }

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {items.map((item, index) => (
        <motion.div
          key={`rekomendasi-${item.id}`}
          layout
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3, delay: index * 0.05 }}
          className="mb-6"
        >
          <FeedCard
            item={item}
            location={userLocation}
            locationReady={locationReady}
            comments={comments}
            selectedPhotoIndex={selectedPhotoIndex}
            setSelectedPhotoIndex={setSelectedPhotoIndex}
            openAIModal={onOpenAIModal}
            openKomentarModal={onOpenKomentarModal}
            onShare={onShare}
            priority={index < 2}
          />
        </motion.div>
      ))}
      
      {hasMore && items.length < MAX_ITEMS && (
        <div key="loader" ref={loaderRef} className="h-10" />
      )}

      {loading && items.length > 0 && (
        <div key="loading-indicator" className="flex justify-center py-4">
          <div className="w-4 h-4 border-2 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
        </div>
      )}

      {!hasMore && items.length >= MAX_ITEMS && (
        <div key="end-message" className="text-center py-4">
          <p className={`text-xs ${isMalam ? "text-white/40" : "text-slate-400"}`}>
            ✨ Semua rekomendasi telah ditampilkan ✨
          </p>
        </div>
      )}
    </AnimatePresence>
  );
}

// ==================== KOMPONEN UTAMA ====================
function PostDetailContent({ id }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const theme = useTheme();
  const { user, isAdmin } = useAuth();
  const {
    location,
    status: locationStatus,
    placeName,
    requestLocation,
    setManualLocation,
  } = useLocation();

  // State untuk data
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorType, setErrorType] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [comments, setComments] = useState({});
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState({});
  const [highlightCommentId, setHighlightCommentId] = useState(null);

  // Upload Modal States
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [userId, setUserId] = useState(null);
  const [userRole, setUserRole] = useState(null);

  // State untuk UI
  const [isScrolled, setIsScrolled] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showKomentarModal, setShowKomentarModal] = useState(false);
  const [showFormLaporan, setShowFormLaporan] = useState(false);
  const [selectedTempat, setSelectedTempat] = useState(null);
  const [selectedLaporanWarga, setSelectedLaporanWarga] = useState([]);
  const [selectedUploadSuccess, setSelectedUploadSuccess] = useState(null);
  const [aiContext, setAiContext] = useState("general");
  const [initialQuery, setInitialQuery] = useState("");
  const [forceShowLaporan, setForceShowLaporan] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "" });

  const cardRef = useRef(null);
  const isMalam = theme.isMalam;

  const komentarId = searchParams.get("komentar_id");
  const mention = searchParams.get("mention");
  const locationReady = locationStatus === "granted";
  const villageLocation = placeName?.split(",")[0] || "Pilih Lokasi";
  const districtLocation = placeName?.split(",")[1] || "";

  // Get User Data for Upload Modal
  useEffect(() => {
    const getUser = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        setUserId(authUser.id);
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', authUser.id)
          .single();
        setUserRole(profile?.role || 'warga');
      }
    };
    getUser();
  }, []);

  // Scroll handler untuk header
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Highlight comment dari URL
  useEffect(() => {
    if (komentarId) setHighlightCommentId(parseInt(komentarId));
  }, [komentarId]);

  // ==================== FETCH POST DETAIL DENGAN AUTO-RETRY ====================
  const fetchPostDetail = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    
    setError(null);
    setErrorType(null);
    
    try {
      // Validasi ID
      if (!id || id === "undefined" || id === "null" || isNaN(parseInt(id))) {
        setErrorType("invalid_id");
        throw new Error("ID konten tidak valid");
      }

      const postId = parseInt(id);
      
      // Coba cari di tabel tempat
      const { data: tempat, error: tempatError } = await supabase
        .from("tempat")
        .select("*")
        .eq("id", postId)
        .maybeSingle();

      if (tempat && !tempatError) {
        const { data: laporan } = await supabase
          .from("laporan_warga")
          .select("*")
          .eq("tempat_id", postId)
          .order("created_at", { ascending: false });

        const { data: komentarData } = await supabase
          .from("komentar")
          .select("*")
          .eq("tempat_id", postId)
          .order("created_at", { ascending: false });

        setItem({
          ...tempat,
          laporan_terbaru: laporan || [],
        });
        setComments({ [postId]: komentarData || [] });
        
        setRetryCount(0);
        setLoading(false);
        setIsRefreshing(false);
        return;
      }

      // Coba cari di laporan_warga
      const { data: laporan, error: laporanError } = await supabase
        .from("laporan_warga")
        .select("*, tempat:tempat_id(*)")
        .eq("id", postId)
        .maybeSingle();

      if (laporan && laporan.tempat && !laporanError) {
        setItem({
          ...laporan.tempat,
          laporan_terbaru: [laporan],
        });
        
        const { data: komentarData } = await supabase
          .from("komentar")
          .select("*")
          .eq("tempat_id", laporan.tempat_id)
          .order("created_at", { ascending: false });
          
        setComments({ [laporan.tempat_id]: komentarData || [] });
        
        setRetryCount(0);
        setLoading(false);
        setIsRefreshing(false);
        return;
      }

      // Data tidak ditemukan
      setErrorType("not_found");
      throw new Error("Konten tidak ditemukan");

    } catch (err) {
      console.error("Error fetchPostDetail:", err);
      
      // Auto retry untuk error jaringan (bukan not_found)
      if (retryCount < 3 && err.message !== "Konten tidak ditemukan" && err.message !== "ID konten tidak valid") {
        console.log(`🔄 Auto-retry attempt ${retryCount + 1}/3`);
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          fetchPostDetail(false);
        }, 1500);
        return;
      }
      
      // Set error message yang ramah
      if (err.message === "Konten tidak ditemukan" || errorType === "not_found") {
        setError("Konten yang Anda cari tidak tersedia atau telah dihapus");
      } else if (err.message === "ID konten tidak valid") {
        setError("Link yang Anda gunakan tidak valid");
      } else {
        setError("Terjadi kesalahan saat memuat konten. Silakan coba lagi.");
      }
      
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [id, retryCount]);

  // Fetch data post
  useEffect(() => {
    fetchPostDetail();
  }, [fetchPostDetail]);

  // ==================== HANDLER FUNCTIONS ====================

  const openAICardModal = useCallback(
    (item, onUploadSuccess, query = "") => {
      if (!user) {
        setIsAuthModalOpen(true);
        return;
      }
      setSelectedTempat(item);
      setSelectedLaporanWarga(item?.laporan_terbaru || []);
      setSelectedUploadSuccess(() => onUploadSuccess);
      setInitialQuery(query);
      setAiContext("card");
      setShowAIModal(true);
    },
    [user]
  );

  const openKomentarModal = useCallback(
    (item) => {
      if (!user) {
        setIsAuthModalOpen(true);
        return;
      }
      setSelectedTempat(item);
      setShowKomentarModal(true);
    },
    [user]
  );

  const handleShare = useCallback(async (item) => {
    const shareUrl = `${window.location.origin}/post/${item.id}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: item.name,
          text: `📍 Cek kondisi terkini di ${item.name}!`,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setToast({ show: true, message: "✅ Link disalin!" });
        setTimeout(() => setToast({ show: false, message: "" }), 3000);
      }
    } catch (err) {
      console.log("Share dibatalkan");
    }
  }, []);

  const handleSearchWithQuery = useCallback((q, item = null) => {
    setInitialQuery(q);
    setSelectedTempat(item || null);
    setSelectedUploadSuccess(null);
    setAiContext("search");
    setShowAIModal(true);
  }, []);

  const handleSearchSelect = useCallback((item) => {
    if (!item) return;
    setShowSearchModal(false);
    router.push(`/post/${item.id}`);
  }, [router]);

  const closeModals = useCallback(() => {
    setShowAIModal(false);
    setShowKomentarModal(false);
    setSelectedTempat(null);
    setSelectedLaporanWarga([]);
    setInitialQuery("");
  }, []);

  const handleGPSActivation = useCallback(async () => {
    await requestLocation();
    setToast({ show: true, message: `📍 Menggunakan lokasi GPS` });
    setTimeout(() => setToast({ show: false, message: "" }), 2000);
  }, [requestLocation]);

  const handleManualLocationSelect = useCallback((selectedLocation) => {
    setManualLocation(selectedLocation);
    const locationName = selectedLocation?.address || selectedLocation?.name || "lokasi baru";
    setToast({ show: true, message: `📍 Lokasi diubah ke ${locationName}` });
    setTimeout(() => setToast({ show: false, message: "" }), 2000);
  }, [setManualLocation]);

  // ==================== PULL TO REFRESH ====================
  useEffect(() => {
    let startY = 0;
    let isPulling = false;

    const handleTouchStart = (e) => {
      if (window.scrollY === 0 && !loading && !isRefreshing && !error) {
        startY = e.touches[0].pageY;
        isPulling = true;
      }
    };

    const handleTouchMove = (e) => {
      if (!isPulling || window.scrollY > 0) return;
      const pullDistance = e.touches[0].pageY - startY;
      if (pullDistance > 60 && !isRefreshing) {
        setIsRefreshing(true);
        fetchPostDetail(true);
      }
    };

    const handleTouchEnd = () => {
      isPulling = false;
    };

    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);
    
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [loading, isRefreshing, error, fetchPostDetail]);

  // ==================== LOADING STATE ====================
  if (loading) {
    return (
      <div className={`relative min-h-screen w-full ${theme.bg} ${theme.text} transition-colors duration-300`}>
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen">
          <div className="w-10 h-10 border-3 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
          <p className={`text-sm mt-4 ${isMalam ? 'text-white/40' : 'text-slate-400'}`}>
            Memuat konten...
          </p>
        </div>
      </div>
    );
  }

  // ==================== REFRESHING STATE ====================
  if (isRefreshing) {
    return (
      <div className={`relative min-h-screen w-full ${theme.bg} ${theme.text} transition-colors duration-300`}>
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen">
          <div className="w-10 h-10 border-3 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
          <p className={`text-sm mt-4 ${isMalam ? 'text-white/40' : 'text-slate-400'}`}>
            Memuat ulang konten...
          </p>
        </div>
      </div>
    );
  }

  // ==================== ERROR STATE YANG RAMAH ====================
  if (error || !item) {
    return (
      <div className={`relative min-h-screen w-full ${theme.bg} ${theme.text} transition-colors duration-300`}>
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-6 text-center">
          <div className="text-8xl mb-6">
            {errorType === "not_found" ? "🔍" : "⚠️"}
          </div>
          
          <h1 className="text-2xl font-black mb-2 tracking-tight">
            {errorType === "not_found" ? "Konten Tidak Ditemukan" : "Gagal Memuat Konten"}
          </h1>
          
          <p className={`text-sm mb-6 max-w-[280px] ${isMalam ? 'text-white/50' : 'text-slate-500'}`}>
            {error}
          </p>
          
          <div className="flex flex-col gap-3 w-full max-w-[280px]">
            <button
              onClick={() => {
                setRetryCount(0);
                fetchPostDetail(true);
              }}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-bold shadow-lg shadow-orange-500/25 active:scale-95 transition-all"
            >
              🔄 Muat Ulang Halaman
            </button>
            
            <button
              onClick={() => router.push("/")}
              className={`px-6 py-3 rounded-xl text-sm font-bold transition-all active:scale-95 ${isMalam ? 'bg-white/10 text-white/80' : 'bg-black/5 text-slate-700'}`}
            >
              🏠 Kembali ke Beranda
            </button>
          </div>
          
          {errorType !== "not_found" && (
            <div className={`mt-8 text-[11px] ${isMalam ? 'text-white/30' : 'text-slate-400'}`}>
              <p>💡 Tips: Periksa koneksi internet Anda</p>
              <p className="mt-1">📞 Jika masalah berlanjut, coba lagi beberapa saat</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==================== MAIN RETURN ====================
  return (
    <div className={`relative min-h-screen w-full ${theme.bg} ${theme.text} transition-colors duration-300`}>
      
      {/* Ambient Effects */}
      {theme.isMalam && (
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
          <div 
            className="absolute top-[-15%] left-[-10%] w-[120%] h-[50%] rounded-full opacity-[0.07] blur-[120px]"
            style={{ backgroundColor: '#3b82f6' }} 
          />
          <div 
            className="absolute bottom-[-10%] right-[-10%] w-[100%] h-[40%] rounded-full opacity-[0.05] blur-[100px]"
            style={{ backgroundColor: '#8b5cf6' }} 
          />
        </div>
      )}

      {!theme.isMalam && (
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden opacity-30">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/5 to-transparent" />
        </div>
      )}

      {/* Konten */}
      <div className="relative z-10">
        <main className="relative mx-auto w-[92%] max-w-[400px] bg-transparent">
          <Header
            user={user}
            isAdmin={isAdmin}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
            locationReady={locationReady}
            villageLocation={villageLocation}
            districtLocation={districtLocation}
            isScrolled={isScrolled}
            onOpenLocationModal={() => setIsLocationModalOpen(true)}
            onOpenSearchModal={() => setShowSearchModal(true)}
            onShowStatistik={() => {
              setForceShowLaporan(true);
              setTimeout(() => setForceShowLaporan(false), 100);
            }}
            onOpenLaporanForm={() => setShowFormLaporan(true)}
            onSearchWithQuery={handleSearchWithQuery}
            tempat={[]}
            location={location}
            displayLocation={villageLocation}
            searchRadius={10}
            onRadiusChange={() => {}}
          />

          <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
          
          <LocationModal
            isOpen={isLocationModalOpen}
            onClose={() => setIsLocationModalOpen(false)}
            locationReady={locationReady}
            isMalam={isMalam}
            onActivateGPS={handleGPSActivation}
            onSelectManual={handleManualLocationSelect}
          />

          <LaporanWarga
            tempat={item ? [item] : []}
            locationReady={locationReady}
            displayLocation={villageLocation}
            location={location}
            forceShow={forceShowLaporan}
            onHide={() => setForceShowLaporan(false)}
          />

          <FormLaporanAktif
            isOpen={showFormLaporan}
            onClose={() => setShowFormLaporan(false)}
            villageLocation={villageLocation}
            theme={theme}
            user={user}
          />

          <motion.div className="mt-4 space-y-2 min-h-[60vh] relative">
            <LayoutGroup>
              <motion.div layout className="space-y-2">
                {/* CARD UTAMA */}
                <motion.div
                  key={`main-${item.id}`}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  ref={cardRef}
                  className="mb-6"
                >
                  <FeedCard
                    item={item}
                    location={location}
                    locationReady={locationReady}
                    comments={comments}
                    selectedPhotoIndex={selectedPhotoIndex}
                    setSelectedPhotoIndex={setSelectedPhotoIndex}
                    openAIModal={openAICardModal}
                    openKomentarModal={openKomentarModal}
                    onShare={handleShare}
                    priority={true}
                    highlightCommentId={highlightCommentId}
                  />
                </motion.div>

                {/* SEPARATOR */}
                <div className="flex items-center gap-3 my-6">
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />
                  <span className={`text-[9px] font-bold uppercase tracking-wider ${isMalam ? "text-white/30" : "text-slate-400"}`}>
                    Jelajahi Sekitar
                  </span>
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />
                </div>

                {/* REKOMENDASI */}
                <RekomendasiFeed
                  currentItemId={parseInt(id)}
                  userLocation={location}
                  locationReady={locationReady}
                  theme={theme}
                  onOpenAIModal={openAICardModal}
                  onOpenKomentarModal={openKomentarModal}
                  onShare={handleShare}
                />
              </motion.div>
            </LayoutGroup>
          </motion.div>

          {/* MODALS */}
          <SearchModal
            isOpen={showSearchModal}
            onClose={() => setShowSearchModal(false)}
            onSelectTempat={handleSearchSelect}
            onOpenAIModal={handleSearchWithQuery}
            allData={[]}
            theme={theme}
            villageLocation={villageLocation}
          />

          <AIModal
            isOpen={showAIModal}
            onClose={closeModals}
            tempat={selectedTempat}
            context={aiContext}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
            onUploadSuccess={selectedUploadSuccess}
            initialQuery={initialQuery}
            item={selectedTempat}
            laporanWarga={selectedLaporanWarga}
          />

          <KomentarModal
            isOpen={showKomentarModal}
            onClose={closeModals}
            tempat={selectedTempat}
            isAdmin={isAdmin}
          />

          {/* BOTTOM NAV with Upload Modal */}
          <SmartBottomNav 
            onOpenUpload={() => setShowUploadModal(true)}
            onOpenLaporanForm={() => setShowFormLaporan(true)}
            onOpenNotification={() => router.push("/woro")}
            onOpenProfile={() => router.push("/rewang")}            
          />

          {/* UPLOAD MODAL for Superadmin & Admin */}
          <UploadModal
            isOpen={showUploadModal}
            onClose={() => setShowUploadModal(false)}
            userId={userId}
            userRole={userRole}
          />

          {/* TOAST MESSAGE */}
          <AnimatePresence>
            {toast.show && (
              <motion.div
                key="toast-message"
                initial={{ y: 50, x: "-50%", opacity: 0 }}
                animate={{ y: 0, x: "-50%", opacity: 1 }}
                exit={{ y: 50, x: "-50%", opacity: 0 }}
                className="fixed bottom-28 left-1/2 z-[100]"
              >
                <div className={`${isMalam ? 'bg-black/80' : 'bg-white/90'} backdrop-blur-lg px-5 py-2.5 rounded-full shadow-2xl text-sm font-medium border ${isMalam ? 'border-white/20 text-white' : 'border-slate-200 text-slate-800'}`}>
                  {toast.message}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

// ==================== WRAPPER ====================
export default function PostDetailPage({ params }) {
  const { id } = use(params);
  return <PostDetailContent id={id} />;
}