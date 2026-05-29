'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import dynamic from 'next/dynamic';
import { useTheme } from "@/app/hooks/useTheme";
import { useLaporanWarga } from "@/hooks/useOptimizedFetch";

// ========== LOADING COMPONENT ==========
const LoadingSpinner = () => (
  <div className="flex items-center justify-center h-full w-full bg-black">
    <div className="animate-pulse font-black text-xs tracking-[0.2em] text-[#25F4EE]">
      Ronda Cerita Warga Setempat...
    </div>
  </div>
);

const InitialLoadingScreen = () => (
  <div className="h-[100dvh] w-full bg-black flex items-center justify-center">
    <div className="animate-pulse font-black text-xs tracking-[0.2em] text-[#25F4EE]">
      Ronda Cerita Warga Setempat...
    </div>
  </div>
);

// ========== LAZY LOAD COMPONENTS ==========
const SmartBottomNavWarga = dynamic(() =>
  import("@/app/components/layout/SmartBottomNavWarga").catch(() => ({ default: () => <div className="h-16 w-full bg-transparent" /> })), {
  loading: () => <div className="h-16 w-full bg-transparent" />,
  ssr: false
});

const FullscreenStoryModal = dynamic(() =>
  import("@/components/story/FullscreenStoryModal").catch(() => ({ default: () => <LoadingSpinner /> })), {
  loading: () => <LoadingSpinner />,
  ssr: false
});

const LaporPanel = dynamic(() =>
  import("@/app/components/ai/LaporPanel").catch(() => ({ default: () => null })), {
  loading: () => null,
  ssr: false
});

const KomentarLaporanModal = dynamic(() =>
  import("@/app/components/feed/KomentarLaporanModal").catch(() => ({ default: () => null })), {
  loading: () => null,
  ssr: false
});

const AuthModal = dynamic(() =>
  import("@/app/components/auth/AuthModal").catch(() => ({ default: () => null })), {
  loading: () => null,
  ssr: false
});

const AIModalTempat = dynamic(() =>
  import("@/app/components/ai/AIModalTempat").catch(() => ({ default: () => null })), {
  loading: () => null,
  ssr: false
});

const ExploreGridView = dynamic(() =>
  import("@/components/explore/ExploreSearchView").catch(() => ({ default: () => <LoadingSpinner /> })), {
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

// ========== CONTENT COMPONENT (Refactored) ==========
function CitizenHubContent({ userId, userRole }) {
  const { isMalam } = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();

  const { data: reports, loading, refresh, loadMore, hasMore, isFetchingMore } = useLaporanWarga({ limit: 10 });

  // ========== STATE DECLARATIONS ==========
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showLaporPanel, setShowLaporPanel] = useState(false);
  const [selectedTempat, setSelectedTempat] = useState(null);
  const [sessionUserId, setSessionUserId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [mounted, setMounted] = useState(false);

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

  const activeUserId = userId || sessionUserId;
  const validReports = useMemo(() => reports || [], [reports]);

  const theme = useMemo(() => ({
    isMalam,
    text: isMalam ? 'text-white' : 'text-gray-900',
    bg: isMalam ? 'bg-zinc-900' : 'bg-white',
    border: isMalam ? 'border-white/10' : 'border-gray-100',
  }), [isMalam]);

  // ========== HYDRATION SAFE ==========
  useEffect(() => {
    setMounted(true);
  }, []);

  // ========== CLIENT-ONLY EFFECTS ==========
  useEffect(() => {
    if (!mounted) return;

    const storyId = searchParams?.get('story');
    if (storyId && validReports.length > 0) {
      const targetIndex = validReports.findIndex(r => r.id === parseInt(storyId, 10));
      if (targetIndex !== -1 && targetIndex !== currentIndex) {
        setCurrentIndex(targetIndex);
        setViewMode('story');
      }
    }
  }, [searchParams, validReports, currentIndex, mounted]);

  useEffect(() => {
    if (!mounted) return;

    let isMounted = true;

    const getSession = async () => {
      try {
        if (typeof window === 'undefined') return;

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
      if (session?.user?.id && isMounted && typeof window !== 'undefined') {
        setSessionUserId(session.user.id);
        sessionStorage.setItem('supabase_session', JSON.stringify({
          userId: session.user.id,
          timestamp: Date.now()
        }));
      } else if (event === 'SIGNED_OUT' && isMounted && typeof window !== 'undefined') {
        setSessionUserId(null);
        sessionStorage.removeItem('supabase_session');
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [mounted]);

  useEffect(() => {
    if (!activeUserId || !mounted || typeof window === 'undefined') return;

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
  }, [activeUserId, mounted]);

  // ========== CALLBACKS ==========
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
    if (typeof window !== 'undefined') {
      const reportId = validReports[index]?.id;
      if (reportId) {
        window.history.pushState({}, '', `/explore?story=${reportId}`);
      }
    }
  }, [validReports]);

  const refreshData = useCallback(async () => {
    await refresh();
  }, [refresh]);

  const handleLaporanSuccess = useCallback(() => {
    handleCloseLaporPanel();
    refreshData();
    setCurrentIndex(0);
  }, [handleCloseLaporPanel, refreshData]);

  const handleShare = useCallback(async (report) => {
    if (!report?.id || typeof window === 'undefined') return;
    const shareUrl = `${window.location.origin}/explore?story=${report.id}`;

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

    setLikedLaporan(prev => {
      const next = new Set(prev);
      isCurrentlyLiked ? next.delete(report.id) : next.add(report.id);
      return next;
    });

    setLaporanLikeCounts(prev => ({
      ...prev,
      [report.id]: Math.max((prev[report.id] || 0) + (isCurrentlyLiked ? -1 : 1), 0)
    }));

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

  const handleNavigateToDetail = useCallback((reportId) => {
    router.push(`/explore?story=${reportId}`);
  }, [router]);

  // ========== RENDER ==========
  if (!mounted) {
    return <InitialLoadingScreen />;
  }

  if (loading && validReports.length === 0) {
    return <InitialLoadingScreen />;
  }

  return (
    <div className="h-[100dvh] w-full bg-black flex justify-center font-sans overflow-hidden select-none">
      <div className="w-full max-w-[400px] h-full bg-zinc-950 relative flex flex-col overflow-hidden">
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
              onNavigateToDetail={handleNavigateToDetail}
              onViewRecorded={handleViewRecorded}
              userId={activeUserId}
              theme={theme}
              isPaused={isStoryPaused}
              onLoadMore={handleLoadMore}
              hasMore={hasMore}
            />
          </Suspense>
        </div>

        <SmartBottomNavWarga
          onOpenLaporanForm={handleOpenLaporanForm}
          onOpenNotification={() => router.push("/woro")}
          onOpenProfile={() => router.push("/peken")}
        />

        {/* MODALS */}
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

// ========== MAIN EXPORT WRAPPED IN SUSPENSE ==========
export default function CitizenHub(props) {
  return (
    <Suspense fallback={<InitialLoadingScreen />}>
      <CitizenHubContent {...props} />
    </Suspense>
  );
}