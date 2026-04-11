"use client";
import { use } from "react";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useTheme } from "@/app/hooks/useTheme";
import { useAuth } from "@/app/context/AuthContext"; 
import { useLocation } from "@/components/LocationProvider";
import FeedCard from "@/app/components/feed/FeedCard";
import Header from "@/components/Header";
import LocationModal from "@/components/LocationModal";
import AuthModal from "@/app/components/auth/AuthModal";
import SearchModal from "@/app/components/feed/SearchModal";
import AIModal from "@/app/components/feed/AIModal";
import KomentarModal from "@/app/components/feed/KomentarModal";
import LaporanWarga from "@/app/components/layout/LaporanWarga"; 
import { Loader2 } from "lucide-react";

// ==================== KOMPONEN FEED REKOMENDASI ====================
function RekomendasiFeed({ currentItemId, userLocation, locationReady, theme, onOpenAIModal, onOpenKomentarModal, onShare }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [comments, setComments] = useState({});
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState({});
  const loaderRef = useRef(null);
  const isMalam = theme.isMalam;
  
  const MAX_ITEMS = 15;

  const fetchRekomendasi = useCallback(async (reset = false) => {
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
        const lngDelta = radius / (111 * Math.cos(lat * Math.PI / 180));
        
        query = query
          .gte('latitude', lat - latDelta)
          .lte('latitude', lat + latDelta)
          .gte('longitude', lng - lngDelta);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      const uniqueData = data ? Array.from(
        new Map(data.map(item => [item.id, item])).values()
      ) : [];
      
      let newItems;
      if (reset) {
        newItems = uniqueData || [];
      } else {
        const combined = [...items, ...(uniqueData || [])];
        newItems = Array.from(
          new Map(combined.map(item => [item.id, item])).values()
        );
      }
      
      if (newItems.length > MAX_ITEMS) {
        newItems = newItems.slice(0, MAX_ITEMS);
        setHasMore(false);
      } else {
        setHasMore((data || []).length === limit && newItems.length < MAX_ITEMS);
      }
      
      setItems(newItems);
      setPage(currentPage + 1);
    } catch (err) {
      console.error("Error fetching rekomendasi:", err);
    } finally {
      setLoading(false);
    }
  }, [currentItemId, page, hasMore, locationReady, userLocation, items.length]);
  
  useEffect(() => {
    if (!loaderRef.current) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && hasMore && items.length < MAX_ITEMS) {
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
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
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
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-1 h-4 rounded-full bg-orange-500" />
        <h3 className={`text-xs font-bold uppercase tracking-wider ${isMalam ? "text-white/60" : "text-slate-500"}`}>
          REKOMENDASI UNTUK ANDA
        </h3>
      </div>
      
      {items.map((item) => (
        <FeedCard
          key={item.id}
          item={item}
          location={userLocation}
          locationReady={locationReady}
          comments={comments}
          selectedPhotoIndex={selectedPhotoIndex}
          setSelectedPhotoIndex={setSelectedPhotoIndex}
          openAIModal={onOpenAIModal}
          openKomentarModal={onOpenKomentarModal}
          onShare={onShare}
        />
      ))}
      
      {hasMore && items.length < MAX_ITEMS && (
        <div ref={loaderRef} className="h-10" />
      )}
      
      {loading && items.length > 0 && (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
        </div>
      )}
      
      {!hasMore && items.length >= MAX_ITEMS && (
        <div className="text-center py-4">
          <p className={`text-xs ${isMalam ? "text-white/40" : "text-slate-400"}`}>
            ✨ Semua rekomendasi telah ditampilkan ✨
          </p>
        </div>
      )}
    </div>
  );
}

// ==================== KOMPONEN UTAMA ====================
function PostDetailContent({ id }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const theme = useTheme();
  const { user, isAdmin } = useAuth();
  const { location, status: locationStatus, placeName, requestLocation } = useLocation();
  
  // State untuk data
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [comments, setComments] = useState({});
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState({});
  const [highlightCommentId, setHighlightCommentId] = useState(null);
  
  // State untuk UI
  const [isScrolled, setIsScrolled] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showKomentarModal, setShowKomentarModal] = useState(false);
  const [selectedTempat, setSelectedTempat] = useState(null);
  const [selectedLaporanWarga, setSelectedLaporanWarga] = useState([]);
  const [selectedUploadSuccess, setSelectedUploadSuccess] = useState(null);
  const [aiContext, setAiContext] = useState("general");
  const [initialQuery, setInitialQuery] = useState("");
  const [forceShowLaporan, setForceShowLaporan] = useState(false);
  
  const cardRef = useRef(null);
  const isMalam = theme.isMalam;
  
  const komentarId = searchParams.get("komentar_id");
  const mention = searchParams.get("mention");
  const locationReady = locationStatus === "granted";
  const villageLocation = placeName?.split(",")[0] || "Pilih Lokasi";
  const districtLocation = placeName?.split(",")[1] || "";
  
  // Scroll handler
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
  
  // Fetch data post
  useEffect(() => {
    fetchPostDetail();
  }, [id]);
  
  // Scroll to card setelah load
  useEffect(() => {
    if (!loading && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      
      if (highlightCommentId || mention) {
        setTimeout(() => {
          const highlightElement = document.querySelector(`.comment-highlight-${highlightCommentId}`);
          if (highlightElement) {
            highlightElement.scrollIntoView({ behavior: "smooth", block: "center" });
            highlightElement.classList.add("ring-2", "ring-orange-500", "animate-pulse");
            setTimeout(() => {
              highlightElement.classList.remove("ring-2", "ring-orange-500", "animate-pulse");
            }, 3000);
          }
        }, 500);
      }
    }
  }, [loading, highlightCommentId, mention]);
  
  const fetchPostDetail = async () => {
    setLoading(true);
    try {
      const { data: tempat, error: tempatError } = await supabase
        .from("tempat")
        .select("*")
        .eq("id", id)
        .single();
      
      if (!tempatError && tempat) {
        const { data: laporan } = await supabase
          .from("laporan_warga")
          .select("*")
          .eq("tempat_id", id)
          .order("created_at", { ascending: false });
        
        setItem({
          ...tempat,
          laporan_terbaru: laporan || []
        });
        
        // Load comments untuk tempat ini
        const { data: komentarData } = await supabase
          .from("komentar")
          .select("*")
          .eq("tempat_id", id)
          .order("created_at", { ascending: false });
        
        setComments({ [id]: komentarData || [] });
      } else {
        const { data: laporan, error: laporanError } = await supabase
          .from("laporan_warga")
          .select("*, tempat:tempat_id(*)")
          .eq("id", id)
          .single();
        
        if (!laporanError && laporan) {
          setItem({
            ...laporan.tempat,
            laporan_terbaru: [laporan]
          });
        } else {
          throw new Error("Konten tidak ditemukan");
        }
      }
    } catch (err) {
      console.error("Error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // ==================== HANDLER FUNCTIONS ====================
  
  // Handler untuk AI Modal
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
  
  // Handler untuk Komentar Modal
  const openKomentarModal = useCallback((item) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    setSelectedTempat(item);
    setShowKomentarModal(true);
  }, [user]);
  
  // Handler untuk Share
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
        alert("✅ Link berhasil disalin!");
      }
    } catch (err) {
      console.log("Share dibatalkan");
    }
  }, []);
  
  // Handler untuk Search
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);
  
  // Handler untuk Close Modal
  const closeModals = useCallback(() => {
    setShowAIModal(false);
    setShowKomentarModal(false);
    setSelectedTempat(null);
    setSelectedLaporanWarga([]);
    setInitialQuery("");
  }, []);
  
  if (loading) {
    return (
      <div className={`flex justify-center items-center min-h-screen ${isMalam ? 'bg-black' : 'bg-white'}`}>
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }
  
  if (error || !item) {
    return (
      <div className={`flex flex-col items-center justify-center min-h-screen p-4 ${isMalam ? 'bg-black' : 'bg-white'}`}>
        <p className={`text-sm mb-4 ${isMalam ? 'text-white/60' : 'text-slate-500'}`}>
          {error || "Konten tidak ditemukan"}
        </p>
        <button onClick={() => router.push("/")} className="px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-medium">
          Kembali ke Beranda
        </button>
      </div>
    );
  }
  
  return (
    <>
      <main className={`relative min-h-screen mx-auto w-[92%] max-w-[400px] ${isMalam ? 'bg-black' : 'bg-white'}`}>
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
          onOpenLaporanForm={() => {
            if (!user) {
              setIsAuthModalOpen(true);
              return;
            }
            // Buka form laporan jika perlu
          }}
          onSearchWithQuery={handleSearchWithQuery}
          tempat={[]}
          location={location}
          displayLocation={villageLocation}
          searchRadius={10}
          onRadiusChange={() => {}}
        />
        
        <div className="mt-4 space-y-2">
          <div ref={cardRef}>
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
              highlightCommentId={highlightCommentId}
            />
          </div>
          
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />
            <span className={`text-[9px] font-bold uppercase tracking-wider ${isMalam ? "text-white/30" : "text-slate-400"}`}>
              Jelajahi Sekitar
            </span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />
          </div>
          
          <RekomendasiFeed
            currentItemId={parseInt(id)}
            userLocation={location}
            locationReady={locationReady}
            theme={theme}
            onOpenAIModal={openAICardModal}
            onOpenKomentarModal={openKomentarModal}
            onShare={handleShare}
          />
        </div>
      </main>
      
      {/* MODALS */}
      <LocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        locationReady={locationReady}
        isMalam={isMalam}
        onActivateGPS={requestLocation}
        onSelectManual={() => {}}
      />
      
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
      />

      <LaporanWarga 
      tempat={item ? [item] : []}  // Kirim array dengan item saat ini
      locationReady={locationReady}
      displayLocation={villageLocation}
      location={location}
      forceShow={forceShowLaporan}
      onHide={() => setForceShowLaporan(false)}
      />
      
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
    </>
  );
}

// ==================== WRAPPER ====================
export default function PostDetailPage({ params }) {
  const { id } = use(params);
  return <PostDetailContent id={id} />;
}