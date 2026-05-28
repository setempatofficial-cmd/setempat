'use client';

import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import dynamic from 'next/dynamic';
import { useTheme } from "@/app/hooks/useTheme";
import { useLaporanWarga } from "@/hooks/useOptimizedFetch";

// ========== LAZY LOAD COMPONENTS ==========
const SmartBottomNavWarga = dynamic(() => import("@/app/components/layout/SmartBottomNavWarga"), {
  loading: () => <div className="h-16 w-full bg-transparent" />,
  ssr: false
});

const FullscreenStoryModal = dynamic(() => import("@/components/story/FullscreenStoryModal"), {
  loading: () => <LoadingSpinner />,
  ssr: false
});

const LaporPanel = dynamic(() => import("@/app/components/ai/LaporPanel"), {
  loading: () => null,
  ssr: false
});

const KomentarLaporanModal = dynamic(() => import("@/app/components/feed/KomentarLaporanModal"), {
  loading: () => null,
  ssr: false
});

const AuthModal = dynamic(() => import("@/app/components/auth/AuthModal"), {
  loading: () => null,
  ssr: false
});

const AIModalTempat = dynamic(() => import("@/app/components/ai/AIModalTempat"), {
  loading: () => null,
  ssr: false
});

const ExploreGridView = dynamic(() => import("@/components/explore/ExploreSearchView"), {
  loading: () => <LoadingSpinner />,
  ssr: false
});

// ========== UTILITY FUNCTIONS ==========
const sanitizeText = (text) => {
  if (!text) return '';
  return text
    .replace(/[<>]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

// ========== LOADING COMPONENT ==========
const LoadingSpinner = () => (
  <div className="flex items-center justify-center h-full w-full bg-black">
    <div className="animate-pulse font-black text-xs tracking-[0.2em] text-[#25F4EE]">
      Ronda Cerita Warga Setempat...
    </div>
  </div>
);

const InitialLoadingScreen = () => (
  <div className="h-[100dvh] w-full bg-black flex items-center justify-center text-white">
    <div className="animate-pulse font-black text-xs tracking-[0.2em] text-[#25F4EE]">
      Ronda Cerita Warga Setempat...
    </div>
  </div>
);

// ========== MAIN COMPONENT ==========
export default function CitizenHub({ userId, userRole }) {
  const { isMalam } = useTheme();
  const router = useRouter();

  const { data: reports, loading, refresh, loadMore, hasMore, isFetchingMore } = useLaporanWarga({ limit: 10 });

  // ========== STATE DECLARATIONS ==========
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showLaporPanel, setShowLaporPanel] = useState(false);
  const [selectedTempat, setSelectedTempat] = useState(null);
  const [sessionUserId, setSessionUserId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  // Modal states
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [selectedAITempat, setSelectedAITempat] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [selectedLaporanForComment, setSelectedLaporanForComment] = useState(null);
  const [isKomentarLaporanModalOpen, setIsKomentarLaporanModalOpen] = useState(false);

  const [isStoryPaused, setIsStoryPaused] = useState(false);
  const [viewCounts, setViewCounts] = useState({});
  const [likedLaporan, setLikedLaporan] = useState(new Set());
  const [laporanLikeCounts, setLaporanLikeCounts] = useState({});
  const [viewMode, setViewMode] = useState('story');
  const [isHydrated, setIsHydrated] = useState(false);

  const activeUserId = userId || sessionUserId;
  const validReports = useMemo(() => reports || [], [reports]);

  // Theme configuration
  const theme = useMemo(() => ({
    isMalam,
    text: isMalam ? 'text-white' : 'text-gray-900',
    bg: isMalam ? 'bg-zinc-900' : 'bg-white',
    border: isMalam ? 'border-white/10' : 'border-gray-100',
  }), [isMalam]);

  // ========== OPTIMIZED EFFECTS ==========
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Optimized auth session sync with caching
  useEffect(() => {
    let isMounted = true;

    const getSession = async () => {
      try {
        const cachedSession = sessionStorage.getItem('supabase_session');
        if (cachedSession && isMounted) {
          const { userId, timestamp } = JSON.parse(cachedSession);
          if (Date.now() - timestamp < 5 * 60 * 1000) {
            setSessionUserId(userId);
            return;
          }
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id && isMounted) {
          setSessionUserId(session.user.id);
          sessionStorage.setItem('supabase_session', JSON.stringify({
            userId: session.user.id,
            timestamp: Date.now()
          }));
        }
      } catch (error) {
        console.error('Auth session error:', error);
      }
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user?.id && isMounted) {
        setSessionUserId(session.user.id);
        sessionStorage.setItem('supabase_session', JSON.stringify({
          userId: session.user.id,
          timestamp: Date.now()
        }));
      } else if (event === 'SIGNED_OUT' && isMounted) {
        setSessionUserId(null);
        sessionStorage.removeItem('supabase_session');
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  // Optimized fetch user profile with caching
  useEffect(() => {
    if (!activeUserId) return;

    let isMounted = true;

    async function fetchProfile() {
      try {
        const cachedProfile = sessionStorage.getItem(`profile_${activeUserId}`);
        if (cachedProfile && isMounted) {
          const { data, timestamp } = JSON.parse(cachedProfile);
          if (Date.now() - timestamp < 10 * 60 * 1000) {
            setCurrentUser(data);
            return;
          }
        }

        const { data } = await supabase
          .from("profiles")
          .select("username, full_name, avatar_url")
          .eq("id", activeUserId)
          .maybeSingle();

        if (data && isMounted) {
          const sanitizedData = {
            username: sanitizeText(data.username),
            full_name: sanitizeText(data.full_name),
            avatar_url: data.avatar_url
          };
          setCurrentUser(sanitizedData);
          sessionStorage.setItem(`profile_${activeUserId}`, JSON.stringify({
            data: sanitizedData,
            timestamp: Date.now()
          }));
        }
      } catch (error) {
        console.error('Profile fetch error:', error);
      }
    }

    fetchProfile();
  }, [activeUserId]);

  // Optimized view counts fetch
  useEffect(() => {
    if (!validReports.length) return;

    const fetchInitialViewCounts = async () => {
      try {
        const laporanIds = validReports.slice(0, 10).map(r => r.id);

        const { data, error } = await supabase
          .from('story_views')
          .select('laporan_id')
          .in('laporan_id', laporanIds);

        if (error) throw error;

        const counts = {};
        data?.forEach(view => {
          counts[view.laporan_id] = (counts[view.laporan_id] || 0) + 1;
        });

        setViewCounts(counts);
      } catch (err) {
        console.error('Failed to fetch view counts:', err);
      }
    };

    fetchInitialViewCounts();
  }, [validReports]);

  // ========== OPTIMIZED CALLBACKS ==========
  const handleOpenLaporanForm = useCallback(() => {
    setIsStoryPaused(true);
    setSelectedTempat(null);
    setShowLaporPanel(true);
  }, []);

  const handleCloseLaporPanel = useCallback(() => {
    setIsStoryPaused(false);
    setShowLaporPanel(false);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (loadMore && !isFetchingMore && hasMore) {
      loadMore();
    }
  }, [loadMore, isFetchingMore, hasMore]);

  const handleOpenFullscreenFromGrid = useCallback((index) => {
    setCurrentIndex(index);
    setViewMode('story');
  }, []);

  const refreshData = useCallback(async () => {
    await refresh();
  }, [refresh]);

  const handleLaporanSuccess = useCallback(() => {
    handleCloseLaporPanel();
    refreshData();
    setCurrentIndex(0);
  }, [handleCloseLaporPanel, refreshData]);

  const handleShare = useCallback(async (report) => {
    if (!report?.id) return;
    const shareUrl = `${window.location.origin}/post/${report.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Kondisi Setempat",
          text: report.deskripsi?.substring(0, 100),
          url: shareUrl
        });
      } catch (err) {
        if (err.name !== 'AbortError') console.log(err);
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      // Gunakan toast notification yang lebih ringan
      const toast = document.createElement('div');
      toast.textContent = 'Link berhasil disalin!';
      toast.className = 'fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-full text-sm z-50';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
    }
  }, []);

  const handleLaporanLike = useCallback(async (report) => {
    if (!activeUserId) {
      setIsAuthModalOpen(true);
      return;
    }

    const isCurrentlyLiked = likedLaporan.has(report.id);

    // Optimistic update
    setLikedLaporan(prev => {
      const next = new Set(prev);
      isCurrentlyLiked ? next.delete(report.id) : next.add(report.id);
      return next;
    });

    setLaporanLikeCounts(prev => ({
      ...prev,
      [report.id]: Math.max((prev[report.id] || 0) + (isCurrentlyLiked ? -1 : 1), 0)
    }));

    // Background sync
    try {
      if (isCurrentlyLiked) {
        await supabase
          .from("likes_laporan")
          .delete()
          .eq("laporan_id", report.id)
          .eq("user_id", activeUserId);
      } else {
        await supabase
          .from("likes_laporan")
          .insert({ laporan_id: report.id, user_id: activeUserId });
      }
    } catch (error) {
      // Rollback on error
      setLikedLaporan(prev => {
        const next = new Set(prev);
        isCurrentlyLiked ? next.add(report.id) : next.delete(report.id);
        return next;
      });
      setLaporanLikeCounts(prev => ({
        ...prev,
        [report.id]: Math.max((prev[report.id] || 0) + (isCurrentlyLiked ? 1 : -1), 0)
      }));
    }
  }, [activeUserId, likedLaporan]);

  const openAIChat = useCallback((report) => {
    if (report?.tempat) {
      setSelectedAITempat(report.tempat);
      setSelectedReport(report);
      setIsAIModalOpen(true);
    }
  }, []);

  const handleViewRecorded = useCallback((laporanId) => {
    setViewCounts(prev => ({
      ...prev,
      [laporanId]: (prev[laporanId] || 0) + 1
    }));
  }, []);

  const handleOpenKomentar = useCallback((report) => {
    setSelectedLaporanForComment(report);
    setIsKomentarLaporanModalOpen(true);
  }, []);

  // ========== RENDER OPTIMIZATION ==========
  if (!isHydrated || (loading && validReports.length === 0)) {
    return <InitialLoadingScreen />;
  }

  return (
    <div className="h-[100dvh] w-full bg-black flex justify-center font-sans overflow-hidden select-none">
      <div className="w-full max-w-[400px] h-full bg-zinc-950 relative flex flex-col overflow-hidden">

        {/* GRID MODE */}
        {viewMode === 'grid' && validReports.length > 0 && (
          <Suspense fallback={<LoadingSpinner />}>
            <ExploreGridView
              reports={validReports}
              loading={loading}
              onCardClick={handleOpenFullscreenFromGrid}
              onBackToStory={() => setViewMode('story')}
            />
          </Suspense>
        )}

        {/* FULLSCREEN MODE */}
        <div className="flex-1 w-full h-full relative z-10">
          <Suspense fallback={<LoadingSpinner />}>
            <FullscreenStoryModal
              isOpen={true}
              reports={validReports}
              initialIndex={currentIndex}
              viewCounts={viewCounts}
              likedLaporan={likedLaporan}
              laporanLikeCounts={laporanLikeCounts}
              onClose={() => setViewMode('grid')}
              onLike={handleLaporanLike}
              onShare={handleShare}
              onOpenAIChat={openAIChat}
              onOpenKomentar={handleOpenKomentar}
              onNavigateToDetail={(reportId) => router.push(`/post/${reportId}`)}
              onViewRecorded={handleViewRecorded}
              userId={activeUserId}
              theme={theme}
              isPaused={isStoryPaused}
              onLoadMore={handleLoadMore}
              hasMore={hasMore}
            />
          </Suspense>
        </div>

        {/* BOTTOM NAVIGATION */}
        <SmartBottomNavWarga
          onOpenLaporanForm={handleOpenLaporanForm}
          onOpenNotification={() => router.push("/woro")}
          onOpenProfile={() => router.push("/peken")}
        />

        {/* MODALS - Only render when needed */}
        {showLaporPanel && (
          <Suspense fallback={null}>
            <div className="fixed inset-0 z-[200] flex items-center justify-center">
              <div
                className="absolute inset-0 bg-black/75 backdrop-blur-md"
                onClick={handleCloseLaporPanel}
              />
              <div className="relative w-full max-w-md mx-4">
                <LaporPanel
                  tempat={selectedTempat}
                  onClose={handleCloseLaporPanel}
                  onSuccess={handleLaporanSuccess}
                  mode="media"
                  theme={{ isMalam }}
                  initialMediaUrl={null}
                  initialMediaType={null}
                />
              </div>
            </div>
          </Suspense>
        )}

        {isKomentarLaporanModalOpen && selectedLaporanForComment && (
          <Suspense fallback={null}>
            <KomentarLaporanModal
              isOpen={isKomentarLaporanModalOpen}
              onClose={() => {
                setIsKomentarLaporanModalOpen(false);
                setSelectedLaporanForComment(null);
              }}
              laporan={selectedLaporanForComment}
              currentUser={currentUser}
              activeUserId={activeUserId}
              theme={theme}
              onCommentSubmit={refreshData}
            />
          </Suspense>
        )}

        {isAuthModalOpen && (
          <Suspense fallback={null}>
            <AuthModal
              isOpen={isAuthModalOpen}
              onClose={() => setIsAuthModalOpen(false)}
              theme={{ isMalam }}
            />
          </Suspense>
        )}

        {isAIModalOpen && (
          <Suspense fallback={null}>
            <AIModalTempat
              isOpen={isAIModalOpen}
              onClose={() => {
                setIsAIModalOpen(false);
                setSelectedAITempat(null);
                setSelectedReport(null);
              }}
              tempat={selectedAITempat}
              activeReport={selectedReport}
              reports={validReports}
              stats={{
                total: validReports.length,
                ramai: validReports.filter(r => r.tipe === 'Ramai').length,
                sepi: validReports.filter(r => r.tipe === 'Sepi').length,
                antri: validReports.filter(r => r.tipe === 'Antri').length
              }}
              theme={{
                isMalam,
                card: 'bg-slate-900',
                border: 'border-white/10',
                text: 'text-white'
              }}
              onOpenAuthModal={() => setIsAuthModalOpen(true)}
              onUploadSuccess={() => { }}
            />
          </Suspense>
        )}

      </div>
    </div>
  );
}