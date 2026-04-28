// app/post/[id]/page.js (SETELAH REFACTOR)
"use client";

import { use } from "react";
import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useTheme } from "@/app/hooks/useTheme";
import { useAuth } from "@/app/context/AuthContext";
import { useLocation } from "@/components/LocationProvider";
import { usePostDetail } from "@/hooks/usePostDetail";
import RekomendasiFeed from "@/components/feed/RekomendasiFeed";
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

  // ✅ PAKAI HOOK YANG SUDAH DIBUAT
  const { 
    data: postData, 
    loading, 
    error: fetchError, 
    refresh 
  } = usePostDetail(id, { cacheDuration: 5 * 60 * 1000 });

  const item = postData?.item || null;
  const comments = postData?.comments || {};

  // State untuk UI
  const [isScrolled, setIsScrolled] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showKomentarModal, setShowKomentarModal] = useState(false);
  const [showFormLaporan, setShowFormLaporan] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedTempat, setSelectedTempat] = useState(null);
  const [selectedLaporanWarga, setSelectedLaporanWarga] = useState([]);
  const [selectedUploadSuccess, setSelectedUploadSuccess] = useState(null);
  const [aiContext, setAiContext] = useState("general");
  const [initialQuery, setInitialQuery] = useState("");
  const [forceShowLaporan, setForceShowLaporan] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState({});
  const [toast, setToast] = useState({ show: false, message: "" });
  const [userId, setUserId] = useState(null);
  const [userRole, setUserRole] = useState(null);

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

  // Scroll handler
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // ==================== HANDLER FUNCTIONS ====================
  const openAICardModal = useCallback((item, onUploadSuccess, query = "") => {
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
  }, [user]);

  const openKomentarModal = useCallback((item) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    setSelectedTempat(item);
    setShowKomentarModal(true);
  }, [user]);

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

  // ==================== LOADING STATE ====================
  if (loading) {
    return (
      <div className={`relative min-h-screen w-full ${theme.bg} ${theme.text} transition-colors duration-300`}>
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen">
          <div className="flex justify-center items-center h-64">
  <div className="relative flex items-center justify-center">
    <div className="absolute animate-ping h-12 w-12 rounded-full bg-[#E3655B] opacity-20"></div>
    <div className="absolute animate-ping h-12 w-12 rounded-full bg-[#25F4EE] opacity-20 [animation-delay:0.5s]"></div>
    
    <div className="relative h-10 w-10 border-4 border-t-[#E3655B] border-r-transparent border-b-[#25F4EE] border-l-transparent rounded-full animate-spin"></div>
  </div>
</div>
          <p className={`text-sm mt-4 ${isMalam ? 'text-white/40' : 'text-slate-400'}`}>
            Memuat konten...
          </p>
        </div>
      </div>
    );
  }

  // ==================== ERROR STATE ====================
  if (fetchError || !item) {
    return (
      <div className={`relative min-h-screen w-full ${theme.bg} ${theme.text} transition-colors duration-300`}>
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-6 text-center">
          <div className="text-8xl mb-6">⚠️</div>
          <h1 className="text-2xl font-black mb-2 tracking-tight">Gagal Memuat Konten</h1>
          <p className={`text-sm mb-6 max-w-[280px] ${isMalam ? 'text-white/50' : 'text-slate-500'}`}>
            {fetchError?.message || "Terjadi kesalahan saat memuat konten"}
          </p>
          <div className="flex flex-col gap-3 w-full max-w-[280px]">
            <button
              onClick={() => refresh()}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-bold shadow-lg shadow-orange-500/25 active:scale-95 transition-all"
            >
              🔄 Muat Ulang
            </button>
            <button
              onClick={() => router.push("/")}
              className={`px-6 py-3 rounded-xl text-sm font-bold transition-all active:scale-95 ${isMalam ? 'bg-white/10 text-white/80' : 'bg-black/5 text-slate-700'}`}
            >
              🏠 Kembali ke Beranda
            </button>
          </div>
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
          <div className="absolute top-[-15%] left-[-10%] w-[120%] h-[50%] rounded-full opacity-[0.07] blur-[120px]" style={{ backgroundColor: '#3b82f6' }} />
          <div className="absolute bottom-[-10%] right-[-10%] w-[100%] h-[40%] rounded-full opacity-[0.05] blur-[100px]" style={{ backgroundColor: '#8b5cf6' }} />
        </div>
      )}

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

                {/* REKOMENDASI - PAKAI KOMPONEN TERPISAH */}
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

          <SmartBottomNav 
            onOpenUpload={() => setShowUploadModal(true)}
            onOpenLaporanForm={() => setShowFormLaporan(true)}
            onOpenNotification={() => router.push("/woro")}
            onOpenProfile={() => router.push("/peken")}            
          />

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