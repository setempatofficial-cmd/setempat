'use client';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, MapPin, Store, Users, LayoutDashboard, MessageSquare, Plus, AlertCircle, Truck, Gift, Bell, X, Play } from 'lucide-react';
import UserMenu from "@/app/components/layout/UserMenu";
import VideoCommentsModal from "@/app/peken/components/VideoCommentsModal";

// --- LAZY LOAD MODALS FOR BETTER PERFORMANCE ---
const RewangSection = lazy(() => import("@/app/components/peken/RewangSection"));
const PanyanganSection = lazy(() => import("@/app/components/peken/PanyanganSection"));
const LapakkuSection = lazy(() => import("@/app/components/peken/LapakkuSection"));
const PesenanSection = lazy(() => import("@/app/components/peken/PesenanSection"));
const KabarBakulSection = lazy(() => import("@/app/components/peken/KabarBakulSection"));
const OjekSection = lazy(() => import("@/app/components/peken/OjekSection"));
const DonasiSection = lazy(() => import("@/app/components/peken/DonasiSection"));
const FormOjek = lazy(() => import("@/app/components/features/ojek/FormOjek"));
const FormDonasi = lazy(() => import("@/app/components/features/donasi/FormDonasi"));
const FormDaftarBakul = lazy(() => import("@/app/components/features/penjual/FormDaftarBakul"));
const SambatModal = lazy(() => import("@/app/components/features/rewang/SambatModal"));
const DaftarRewangModal = lazy(() => import("@/app/components/features/rewang/DaftarRewangModal"));
const FormPanyangan = lazy(() => import("@/app/components/features/panyangan/FormPanyangan"));
const DetailProdukModal = lazy(() => import("@/app/components/peken/DetailProdukModal"));
const FullscreenVideoModal = lazy(() => import("@/app/peken/components/FullscreenVideoModal"));

// --- CONTEXTS ---
import { useAuth } from "@/app/context/AuthContext";
import { useLocation } from "@/components/LocationProvider";
import { supabase } from '@/lib/supabaseClient';
import UploadOptions from "@/app/components/upload/UploadOptions";

// Import komponen UploadVideoModal versi Cloudinary
import { UploadVideoModal } from "@/app/peken/components/UploadVideoModal";

// HAPUS state dari sini! State harus di dalam komponen

// ========== TYPES ==========
interface Video {
  id: string;
  video_url: string;
  thumbnail_url: string | null;
  judul: string;
  deskripsi: string | null;
  harga: number | null;
  role_type: 'bakul' | 'driver' | 'rewang';
  role_label: string;
  role_color: string;
  created_at: string;
  is_active: boolean;
  user_id?: string;
  views?: number;
  likes?: number;
  product_link?: string;
  product_title?: string;
  kategori?: string;
  tipe_video?: string;
  profiles?: {
    id: string;
    name: string | null;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
}

interface ModalState {
  daftarOjek: boolean;
  daftarRewang: boolean;
  donasi: boolean;
  sambat: boolean;
  formPanyangan: boolean;
  uploadVideo: boolean;
}

// ========== VIDEO FULLSCREEN PLAYER (SEDERHANA UNTUK GRID) ==========
const VideoFullscreenPlayer = React.memo(({ video, onClose }: { video: Video | null; onClose: () => void }) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEsc);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  if (!video) return null;

  return (
    <div className="fixed inset-0 z-[999] bg-black flex items-center justify-center">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-all active:scale-95"
        aria-label="Close video"
      >
        <X size={20} />
      </button>

      <video
        src={video.video_url}
        className="w-full h-full object-contain"
        controls
        autoPlay
        playsInline
        poster={video.thumbnail_url || undefined}
      />

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 text-white">
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${video.role_type === 'bakul' ? 'bg-orange-500' :
            video.role_type === 'driver' ? 'bg-emerald-500' : 'bg-purple-500'
            }`}>
            {video.role_type === 'bakul' ? 'B' : video.role_type === 'driver' ? 'D' : 'R'}
          </div>
          <span className="text-xs font-bold">{video.role_label}</span>
        </div>
        <h3 className="font-bold text-lg">{video.judul || "Video Promosi Peken"}</h3>
        <p className="text-sm opacity-80">{video.profiles?.name || 'Warga Setempat'}</p>
        {video.harga && (
          <p className="text-orange-400 font-bold mt-1">
            Rp {video.harga.toLocaleString()}
          </p>
        )}
        {video.deskripsi && (
          <p className="text-xs opacity-70 mt-2 line-clamp-3">{video.deskripsi}</p>
        )}
      </div>
    </div>
  );
});

VideoFullscreenPlayer.displayName = 'VideoFullscreenPlayer';

// ========== VIDEO CARD COMPONENT ==========
const VideoCard = React.memo(({ video, onClick }: { video: Video; onClick: () => void }) => {
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative aspect-[9/16] rounded-2xl overflow-hidden bg-slate-950 active:scale-95 transition-all duration-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
      aria-label={`Play video: ${video.judul}`}
    >
      {video.thumbnail_url && !imageError ? (
        <img
          src={video.thumbnail_url}
          alt={video.judul}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-slate-800 to-slate-950 flex items-center justify-center">
          <Play size={20} className="text-white/40" />
        </div>
      )}

      <div className={`absolute top-2 left-2 ${video.role_color} text-white text-[8px] font-bold px-2 py-0.5 rounded-full z-10 shadow-md`}>
        {video.role_label}
      </div>

      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-90 group-hover:opacity-100 transition-opacity z-10" />

      <div className="absolute bottom-0 left-0 right-0 p-2.5 text-white z-20 text-left">
        <p className="text-[10px] font-bold truncate leading-snug">{video.judul || "Promo Peken"}</p>
        <p className="text-[8px] opacity-80 truncate mt-0.5">{video.profiles?.name || 'Warga Setempat'}</p>
      </div>

      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-200 z-20 ${isHovered ? 'opacity-100 scale-110' : 'opacity-70 scale-100'
        }`}>
        <div className="w-7 h-7 bg-white/20 backdrop-blur-md border border-white/30 rounded-full flex items-center justify-center shadow-lg">
          <Play size={12} className="text-white fill-white ml-0.5" />
        </div>
      </div>

      {video.harga && (
        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-[8px] font-bold px-1.5 py-0.5 rounded-md z-20">
          Rp {video.harga.toLocaleString()}
        </div>
      )}
    </button>
  );
});

VideoCard.displayName = 'VideoCard';

// ========== PEKEN HOME COMPONENT ==========
interface PekenHomeProps {
  location: string;
  setActiveTab: (tab: string) => void;
  userId: string | undefined;
  isSeller: boolean;
  isDriver: boolean;
  isRewang: boolean;
  onRefreshVideos?: () => void;
  onOpenVideoModal?: (index: number) => void;
  allVideos?: Video[];
}

function PekenHome({ location, setActiveTab, userId, isSeller, isDriver, isRewang, onRefreshVideos, onOpenVideoModal, allVideos = [] }: PekenHomeProps) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [filterRole, setFilterRole] = useState<'semua' | 'bakul' | 'driver' | 'rewang'>('semua');

  const canUpload = isSeller || isDriver || isRewang;

  const fetchPekenVideos = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let filteredVideos = [...allVideos];

      if (filterRole !== 'semua') {
        filteredVideos = filteredVideos.filter(v => v.role_type === filterRole);
      }

      setVideos(filteredVideos);
    } catch (err) {
      console.error("Error filtering videos:", err);
      setError('Gagal memuat video. Silakan coba lagi.');
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }, [filterRole, allVideos]);

  useEffect(() => {
    fetchPekenVideos();
  }, [fetchPekenVideos]);

  const openFullscreen = useCallback((video: Video) => {
    setSelectedVideo(video);
    document.body.style.overflow = 'hidden';
  }, []);

  const closeFullscreen = useCallback(() => {
    setSelectedVideo(null);
    document.body.style.overflow = '';
  }, []);

  // HAPUS event listener dari sini! Pindahkan ke PekenContent

  const handleVideoClick = useCallback((index: number) => {
    if (onOpenVideoModal && allVideos.length > 0) {
      const actualVideo = videos[index];
      const actualIndex = allVideos.findIndex(v => v.id === actualVideo.id);
      onOpenVideoModal(actualIndex >= 0 ? actualIndex : index);
    } else {
      openFullscreen(videos[index]);
    }
  }, [videos, allVideos, onOpenVideoModal, openFullscreen]);

  const roleFilters: Array<{ value: typeof filterRole; label: string }> = [
    { value: 'semua', label: 'Semua' },
    { value: 'bakul', label: 'Bakul' },
    { value: 'driver', label: 'Ojek' },
    { value: 'rewang', label: 'Rewang' }
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8 pb-10">
      {/* ... konten PekenHome tetap sama ... */}
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-[32px] p-6 text-white shadow-xl shadow-orange-100">
        <h2 className="text-xl font-black leading-tight">
          Sugeng Rawuh <br />ing Peken {location}
        </h2>
        <p className="text-orange-100 text-xs mt-2 font-medium opacity-80">
          Pusat ekonomi & gotong royong warga {location}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <MenuCard onClick={() => setActiveTab('panyangan')} icon={Store} title="Panyangan" desc="Hasil bumi & barang" color="bg-blue-50 text-blue-600" />
        <MenuCard onClick={() => setActiveTab('rewang')} icon={Users} title="Rewang" desc="Jasa & Gotong Royong" color="bg-purple-50 text-purple-600" />
        <MenuCard onClick={() => setActiveTab('ojek')} icon={Truck} title="Ojek Warga" desc="Antar jemput & kirim" color="bg-emerald-50 text-emerald-600" />
        <MenuCard onClick={() => setActiveTab('donasi')} icon={Gift} title="Donasi" desc="Berbagi ke sesama" color="bg-red-50 text-red-600" />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
            </div>
            <h3 className="font-black text-slate-800 text-sm uppercase tracking-tight">Video Peken</h3>
            <span className="text-[9px] font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">PROMO</span>
          </div>

          <div className="flex gap-1">
            {roleFilters.map(role => (
              <button
                key={role.value}
                onClick={() => setFilterRole(role.value)}
                className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase transition-all active:scale-95 ${filterRole === role.value
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
              >
                {role.label}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="aspect-[9/16] bg-slate-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        )}

        {error && !loading && (
          <div className="bg-red-50 rounded-[28px] p-8 text-center border-2 border-red-100">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <p className="text-[11px] font-bold text-red-600">{error}</p>
            <button
              onClick={() => fetchPekenVideos()}
              className="mt-3 px-4 py-2 bg-red-600 text-white text-[10px] font-bold rounded-full active:scale-95 transition-all"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {!loading && !error && videos.length === 0 && (
          <div className="bg-slate-50 rounded-[28px] p-8 text-center border-2 border-dashed border-slate-200">
            <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-slate-300 mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-[11px] font-bold text-slate-500">Durung ana video peken</p>
            <p className="text-[10px] text-slate-400 mt-1">
              Bakul, Driver, lan Rewang bisa upload video promosi!
            </p>
          </div>
        )}

        {!loading && !error && videos.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {videos.map((video, idx) => (
              <VideoCard
                key={video.id}
                video={video}
                onClick={() => handleVideoClick(idx)}
              />
            ))}
          </div>
        )}

        {canUpload ? (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-upload-video'))}
            className="w-full mt-2 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl text-white text-[10px] font-bold uppercase tracking-wider active:scale-95 transition-all"
          >
            + Upload Video Promosi
          </button>
        ) : (
          <div className="mt-2 p-3 bg-slate-50 rounded-xl text-center border border-slate-100">
            <p className="text-[9px] text-slate-500">
              🔒 Daftar dadi <strong>Bakul, Driver, utowo Rewang</strong> kanggo upload video promosi
            </p>
            <button
              onClick={() => setActiveTab('lapakku')}
              className="mt-1.5 px-3 py-1 bg-orange-500 text-white text-[8px] font-bold rounded-full active:scale-95 transition-all"
            >
              Daftar Sekarang
            </button>
          </div>
        )}
      </div>

      {selectedVideo && (
        <VideoFullscreenPlayer
          video={selectedVideo}
          onClose={closeFullscreen}
        />
      )}
    </div>
  );
}

// ========== MAIN PEKEN CONTENT ==========
function PekenContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, refreshProfile } = useAuth();
  const { location, placeName } = useLocation();

  const [showUploadOptions, setShowUploadOptions] = useState(false);
  const [activeTab, setActiveTab] = useState('beranda');
  const [manualLocationName, setManualLocationName] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showDaftarBakul, setShowDaftarBakul] = useState(false);
  const [localProfile, setLocalProfile] = useState<any>(null);
  const [showHeader, setShowHeader] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [refreshVideos, setRefreshVideos] = useState(0);
  const [showFullscreenVideo, setShowFullscreenVideo] = useState(false);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(0);
  const [allVideos, setAllVideos] = useState<Video[]>([]);
  const [videoViewCounts, setVideoViewCounts] = useState<Record<string, number>>({});
  const [videoCommentCounts, setVideoCommentCounts] = useState<Record<string, number>>({});
  const [openProductId, setOpenProductId] = useState<string | null>(null);

  // ✅ STATE UNTUK MODAL KOMENTAR (DIPINDAHKAN KE SINI)
  const [showVideoComments, setShowVideoComments] = useState(false);
  const [selectedVideoForComment, setSelectedVideoForComment] = useState<any>(null);

  const [modals, setModals] = useState<ModalState>({
    daftarOjek: false,
    daftarRewang: false,
    donasi: false,
    sambat: false,
    formPanyangan: false,
    uploadVideo: false
  });

  const toggleModal = useCallback((key: keyof ModalState, value: boolean) => {
    setModals(prev => ({ ...prev, [key]: value }));
  }, []);

  const fetchProfileDirect = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setLocalProfile(data);
    } catch (error) {
      console.error("Error fetch profile:", error);
    }
  }, [user]);

  const fetchAllVideos = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('video_peken')
        .select(`
          id,
          video_url,
          thumbnail_url,
          judul,
          deskripsi,
          harga,
          role_type,
          user_id,
          created_at,
          is_active,
          views,
          likes,
          comment_count,
          product_link,
          product_title,
          kategori,
          tipe_video
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        setAllVideos([]);
        return;
      }

      const userIds = [...new Set(data.map(v => v.user_id).filter(Boolean))];
      let profilesMap = new Map();

      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url, desa, kecamatan')
          .in('id', userIds);

        if (profilesData) {
          profilesMap = new Map(profilesData.map(p => [p.id, p]));
        }
      }

      const videosWithProfile: Video[] = data.map(video => {
        const profile = profilesMap.get(video.user_id);
        const profileName = profile?.name || profile?.username || profile?.full_name || 'Warga Setempat';

        return {
          ...video,
          profiles: profile ? {
            ...profile,
            name: profileName,
            username: profile.username,
            full_name: profile.full_name
          } : {
            id: video.user_id || '',
            name: profileName,
            username: null,
            full_name: null,
            avatar_url: null
          },
          role_label: video.role_type === 'bakul' ? 'Bakul' :
            video.role_type === 'driver' ? 'Driver Ojek' : 'Rewang',
          role_color: video.role_type === 'bakul' ? 'bg-orange-500' :
            video.role_type === 'driver' ? 'bg-emerald-500' : 'bg-purple-500'
        } as Video;
      });

      setAllVideos(videosWithProfile);

      const viewsMap: Record<string, number> = {};
      const commentsMap: Record<string, number> = {};
      videosWithProfile.forEach(v => {
        viewsMap[v.id] = v.views || 0;
        commentsMap[v.id] = v.comment_count || 0;
      });
      setVideoViewCounts(viewsMap);
      setVideoCommentCounts(commentsMap);

    } catch (err) {
      console.error("Error fetching all videos:", err);
    }
  }, []);

  const handleAddProduct = useCallback(() => {
    setEditingProduct(null);
    toggleModal('formPanyangan', true);
  }, [toggleModal]);

  const handleRefreshStatus = useCallback(async () => {
    if (refreshProfile) {
      await refreshProfile();
    }
    window.dispatchEvent(new CustomEvent('refresh-lapak-status'));
    await fetchProfileDirect();
  }, [refreshProfile, fetchProfileDirect]);

  const handleOpenUploadOptions = useCallback(() => {
    if (!user?.id) {
      router.push('/login?redirect=/peken');
      return;
    }
    setShowUploadOptions(true);
  }, [user, router]);

  const handleOpenUploadVideoDirect = useCallback(() => {
    setShowUploadOptions(false);
    toggleModal('uploadVideo', true);
  }, [toggleModal]);

  const handleVideoUploadSuccess = useCallback(() => {
    setRefreshVideos(prev => prev + 1);
    toggleModal('uploadVideo', false);
    fetchAllVideos();
  }, [fetchAllVideos, toggleModal]);

  const getUserRoleForUpload = useCallback((): 'bakul' | 'driver' | 'rewang' | null => {
    if (localProfile?.is_seller) return 'bakul';
    if (localProfile?.is_driver) return 'driver';
    if (localProfile?.is_rewang) return 'rewang';
    return null;
  }, [localProfile]);

  const openVideoModal = useCallback((index: number) => {
    setSelectedVideoIndex(index);
    setShowFullscreenVideo(true);
  }, []);

  const closeVideoModal = useCallback(() => {
    setShowFullscreenVideo(false);
    setSelectedVideoIndex(0);
    fetchAllVideos();
  }, [fetchAllVideos]);

  // ✅ EVENT LISTENER UNTUK KOMENTAR (DIPINDAHKAN KE SINI)
  useEffect(() => {
    const handleOpenVideoComments = (e: CustomEvent) => {
      setSelectedVideoForComment(e.detail);
      setShowVideoComments(true);
    };
    window.addEventListener('open-video-comments', handleOpenVideoComments as EventListener);
    return () => window.removeEventListener('open-video-comments', handleOpenVideoComments as EventListener);
  }, []);

  // Fetch data on mount and refresh
  useEffect(() => {
    fetchProfileDirect();
    fetchAllVideos();
  }, [fetchProfileDirect, fetchAllVideos]);

  useEffect(() => {
    if (refreshVideos > 0) {
      fetchAllVideos();
    }
  }, [refreshVideos, fetchAllVideos]);

  useEffect(() => {
    const action = searchParams.get('action');
    if (!action) return;

    switch (action) {
      case 'daftar-bakul':
        setShowDaftarBakul(true);
        router.replace('/peken', { scroll: false });
        break;
      case 'daftar-ojek':
        toggleModal('daftarOjek', true);
        router.replace('/peken', { scroll: false });
        break;
      case 'daftar-rewang':
        toggleModal('daftarRewang', true);
        router.replace('/peken', { scroll: false });
        break;
      default:
        break;
    }
  }, [searchParams, router, toggleModal]);

  useEffect(() => {
    const controlHeader = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 80) {
        setShowHeader(false);
      } else {
        setShowHeader(true);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', controlHeader, { passive: true });
    return () => window.removeEventListener('scroll', controlHeader);
  }, [lastScrollY]);

  useEffect(() => {
    const handleLocationUpdate = (e: CustomEvent) => {
      const name = e.detail?.placeName?.split(",")[0].trim();
      if (name) setManualLocationName(name);
    };

    const handleRefreshProfile = () => {
      if (refreshProfile) refreshProfile();
      fetchProfileDirect();
      fetchAllVideos();
    };

    window.addEventListener('location-updated', handleLocationUpdate as EventListener);
    window.addEventListener('refresh-user-profile', handleRefreshProfile);
    window.addEventListener('refresh-peken-videos', () => fetchAllVideos());

    return () => {
      window.removeEventListener('location-updated', handleLocationUpdate as EventListener);
      window.removeEventListener('refresh-user-profile', handleRefreshProfile);
      window.removeEventListener('refresh-peken-videos', () => fetchAllVideos());
    };
  }, [refreshProfile, fetchProfileDirect, fetchAllVideos]);

  useEffect(() => {
    const handleOpenProductDetail = (e: CustomEvent) => {
      const { productId } = e.detail;
      setActiveTab('panyangan');
      setOpenProductId(productId);
    };

    const handleSetActiveTab = (e: CustomEvent) => {
      const { tab } = e.detail;
      setActiveTab(tab);
    };

    window.addEventListener('open-product-detail', handleOpenProductDetail as EventListener);
    window.addEventListener('set-active-tab', handleSetActiveTab as EventListener);

    return () => {
      window.removeEventListener('open-product-detail', handleOpenProductDetail as EventListener);
      window.removeEventListener('set-active-tab', handleSetActiveTab as EventListener);
    };
  }, []);

  const isSeller = localProfile?.is_seller === true;
  const isDriver = localProfile?.is_driver === true;
  const isRewang = localProfile?.is_rewang === true;
  const finalIsSeller = localProfile?.is_seller === true;
  const finalKtpStatus = localProfile?.ktp_status || 'belum_mengajukan';
  const userRole = getUserRoleForUpload();

  const finalLocationName = useMemo(() => {
    if (manualLocationName) return manualLocationName;
    if (placeName) return placeName.split(",")[0].trim();
    return "Pasuruan";
  }, [placeName, manualLocationName]);

  return (
    <div className="min-h-screen bg-[#FBFBFE] pb-32 max-w-[420px] mx-auto relative shadow-2xl overflow-x-hidden">
      <div className={`fixed top-0 left-0 right-0 z-[110] transition-transform duration-300 ease-in-out ${showHeader ? 'translate-y-0' : '-translate-y-full'
        }`}>
        <div className="max-w-[420px] mx-auto bg-[#FBFBFE]/90 backdrop-blur-md border-b border-slate-100 px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/')}
                className="p-2 -ml-2 rounded-full text-slate-600 active:scale-95 transition-all hover:bg-slate-100"
                aria-label="Back to home"
              >
                <ChevronLeft size={22} strokeWidth={2.5} />
              </button>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">PEKEN</h1>
                <div className="flex items-center text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">
                  <MapPin size={10} className="mr-1 text-orange-500" />
                  {finalLocationName}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('open-location-modal'))}
                className="p-2.5 bg-slate-100 rounded-2xl text-slate-600 active:scale-95 transition-all"
                aria-label="Change location"
              >
                <MapPin size={18} />
              </button>

              <UserMenu
                isScrolled={!showHeader}
                onOpenAuthModal={() => router.push('/login?redirect=/peken')}
                theme={{ isMalam: false }}
                toggleEditMode={() => { }}
                isEditActive={false}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="h-[84px]" />

      <main className="px-6">
        <Suspense fallback={
          <div className="flex justify-center items-center py-20">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        }>
          {activeTab === 'beranda' && (
            <PekenHome
              location={finalLocationName}
              setActiveTab={setActiveTab}
              userId={user?.id}
              isSeller={isSeller}
              isDriver={isDriver}
              isRewang={isRewang}
              onRefreshVideos={() => setRefreshVideos(prev => prev + 1)}
              onOpenVideoModal={openVideoModal}
              allVideos={allVideos}
            />
          )}
          {activeTab === 'kabarbakul' && (
            <KabarBakulSection
              locationName={finalLocationName}
              location={location}
              onNavigateToProduct={() => setActiveTab('panyangan')}
            />
          )}
          {activeTab === 'panyangan' && (
            <PanyanganSection
              locationName={finalLocationName}
              location={location}
              userId={user?.id}
              onBack={() => setActiveTab('beranda')}
              onAddProduct={handleAddProduct}
              openProductId={openProductId}
              onClearProductId={() => setOpenProductId(null)}
            />
          )}
          {activeTab === 'rewang' && (
            <RewangSection
              onBack={() => setActiveTab('beranda')}
              locationName={finalLocationName}
            />
          )}
          {activeTab === 'pesenan' && (
            <PesenanSection
              userId={user?.id}
              locationName={finalLocationName}
              onBack={() => setActiveTab('beranda')}
              onReviewOrder={(order) => {
                setSelectedProduct(order.produk);
                setShowReviewModal(true);
              }}
            />
          )}
          {activeTab === 'ojek' && (
            <OjekSection
              onBack={() => setActiveTab('beranda')}
              locationName={finalLocationName}
            />
          )}
          {activeTab === 'donasi' && (
            <DonasiSection
              onBack={() => setActiveTab('beranda')}
              locationName={finalLocationName}
            />
          )}
          {activeTab === 'lapakku' && (
            <LapakkuSection
              userId={user?.id}
              locationName={finalLocationName}
              onBack={() => setActiveTab('beranda')}
              onAddProduct={handleAddProduct}
              onEditProduct={(product) => {
                setEditingProduct(product);
                toggleModal('formPanyangan', true);
              }}
              isSeller={finalIsSeller}
              ktpStatus={finalKtpStatus}
              ktpRejectionReason={localProfile?.ktp_rejection_reason}
              onOpenDaftarBakul={() => setShowDaftarBakul(true)}
              onRefreshStatus={handleRefreshStatus}
            />
          )}
        </Suspense>
      </main>

      <BottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onPlusClick={handleOpenUploadOptions}
      />

      {/* Upload Options Modal */}
      {showUploadOptions && (
        <UploadOptions
          onClose={() => setShowUploadOptions(false)}
          isSeller={isSeller}
          isDriver={isDriver}
          isRewang={isRewang}
          onDaftarBakul={() => setShowDaftarBakul(true)}
          onDaftarOjek={() => toggleModal('daftarOjek', true)}
          onDaftarRewang={() => toggleModal('daftarRewang', true)}
          onDonasi={() => toggleModal('donasi', true)}
          onSambat={() => toggleModal('sambat', true)}
          onPanyangan={handleAddProduct}
          onUploadVideo={handleOpenUploadVideoDirect}
        />
      )}

      {/* Upload Video Modal (Cloudinary) */}
      <UploadVideoModal
        isOpen={modals.uploadVideo}
        onClose={() => toggleModal('uploadVideo', false)}
        userId={user?.id || ''}
        userRole={userRole}
        onSuccess={handleVideoUploadSuccess}
      />

      {/* Fullscreen Video Modal */}
      <Suspense fallback={null}>
        <FullscreenVideoModal
          isOpen={showFullscreenVideo}
          videos={allVideos}
          initialIndex={selectedVideoIndex}
          viewCounts={videoViewCounts}
          commentCounts={videoCommentCounts}
          userId={user?.id}
          onClose={closeVideoModal}
          onBuy={(video) => {
            if (video.product_link) {
              window.open(video.product_link, '_blank');
            }
          }}
          onChat={(video) => {
            window.dispatchEvent(new CustomEvent('open-chat', {
              detail: { userId: video.user_id }
            }));
          }}
          onShare={(video) => {
            if (navigator.share) {
              navigator.share({
                title: video.judul,
                text: video.deskripsi || 'Video menarik di Peken!',
                url: video.video_url,
              });
            } else {
              navigator.clipboard.writeText(video.video_url);
              alert('Link video telah disalin!');
            }
          }}
          onComment={(video) => {
            window.dispatchEvent(new CustomEvent('open-video-comments', {
              detail: {
                id: video.id,
                videoTitle: video.judul,
                videoOwnerId: video.user_id
              }
            }));
          }}
          onCommentRefresh={() => {
            fetchAllVideos(); // Refresh semua data video
          }}
        />
      </Suspense>

      {/* ✅ VIDEO COMMENTS MODAL - DITAMBAHKAN DI SINI */}
      <VideoCommentsModal
        isOpen={showVideoComments}
        onClose={() => {
          setShowVideoComments(false);
          setSelectedVideoForComment(null);
        }}
        video={selectedVideoForComment}
        isAdmin={false}
      />

      <Suspense fallback={null}>
        <FormDaftarBakul
          isOpen={showDaftarBakul}
          onClose={() => setShowDaftarBakul(false)}
          user={user}
          profile={profile}
          onSuccess={() => {
            setShowDaftarBakul(false);
            handleRefreshStatus();
          }}
        />

        <FormPanyangan
          isOpen={modals.formPanyangan}
          onClose={() => {
            toggleModal('formPanyangan', false);
            setEditingProduct(null);
          }}
          editingProduct={editingProduct}
          onSuccess={() => {
            window.dispatchEvent(new CustomEvent('refresh-lapak'));
            window.dispatchEvent(new CustomEvent('refresh-panyangan'));
          }}
          theme={{ isMalam: false }}
        />

        <SambatModal
          isOpen={modals.sambat}
          onClose={() => toggleModal('sambat', false)}
          user={user}
          profile={profile}
        />

        <DaftarRewangModal
          isOpen={modals.daftarRewang}
          onClose={() => toggleModal('daftarRewang', false)}
          profile={profile}
        />

        <FormOjek
          isOpen={modals.daftarOjek}
          onClose={() => toggleModal('daftarOjek', false)}
          user={user}
          profile={profile}
        />

        <FormDonasi
          isOpen={modals.donasi}
          onClose={() => toggleModal('donasi', false)}
          user={user}
          profile={profile}
        />

        <DetailProdukModal
          product={selectedProduct}
          isOpen={showReviewModal}
          onClose={() => {
            setShowReviewModal(false);
            setSelectedProduct(null);
          }}
          userId={user?.id}
          locationName={finalLocationName}
          autoOpenUlasan={true}
          onOrderSuccess={() => { }}
        />
      </Suspense>
    </div>
  );
}

// ========== MAIN PAGE COMPONENT ==========
export default function PekenPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#FBFBFE] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading Peken...</p>
        </div>
      </div>
    }>
      <PekenContent />
    </Suspense>
  );
}

// ========== BOTTOM NAVIGATION ==========
const BottomNav = React.memo(({ activeTab, setActiveTab, onPlusClick }: {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onPlusClick: () => void;
}) => {
  return (
    <div className="fixed bottom-6 left-0 right-0 z-[120] flex justify-center px-6 pointer-events-none">
      <nav className="flex items-center justify-between w-full max-w-[380px] bg-slate-900/95 backdrop-blur-xl p-2 rounded-[32px] shadow-2xl pointer-events-auto border border-white/10">
        <TabButton
          active={activeTab === 'beranda'}
          onClick={() => setActiveTab('beranda')}
          icon={Store}
          label="Peken"
        />
        <TabButton
          active={activeTab === 'kabarbakul'}
          onClick={() => setActiveTab('kabarbakul')}
          icon={Bell}
          label="Bakul"
        />
        <button
          onClick={onPlusClick}
          className="bg-orange-500 text-white p-4 rounded-2xl shadow-lg -mt-10 border-[6px] border-[#FBFBFE] active:scale-90 transition-all"
          aria-label="Add new item"
        >
          <Plus size={24} />
        </button>
        <TabButton
          active={activeTab === 'pesenan'}
          onClick={() => setActiveTab('pesenan')}
          icon={MessageSquare}
          label="Pesenan"
        />
        <TabButton
          active={activeTab === 'lapakku'}
          onClick={() => setActiveTab('lapakku')}
          icon={LayoutDashboard}
          label="Lapak"
        />
      </nav>
    </div>
  );
});

BottomNav.displayName = 'BottomNav';

// ========== MENU CARD COMPONENT ==========
const MenuCard = React.memo(({
  icon: Icon,
  title,
  desc,
  color,
  onClick
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
  color: string;
  onClick: () => void;
}) => {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start p-5 bg-white border border-slate-100 rounded-[32px] text-left hover:border-orange-200 transition-all active:scale-95 group focus:outline-none focus:ring-2 focus:ring-orange-500"
    >
      <div className={`p-3 rounded-2xl mb-3 transition-transform group-hover:scale-110 ${color}`}>
        <Icon size={22} />
      </div>
      <h4 className="font-black text-slate-800 text-xs uppercase tracking-tight leading-none">{title}</h4>
      <p className="text-[10px] text-slate-400 mt-1 font-medium leading-tight">{desc}</p>
    </button>
  );
});

MenuCard.displayName = 'MenuCard';

// ========== TAB BUTTON COMPONENT ==========
const TabButton = React.memo(({
  active,
  onClick,
  icon: Icon,
  label
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}) => {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center w-14 h-12 transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-orange-500 rounded-xl ${active ? 'text-orange-400' : 'text-slate-500 opacity-60'
        }`}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
    >
      <div className="relative">
        <Icon size={18} strokeWidth={active ? 2.5 : 2} />
        {label === 'Bakul' && (
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-slate-900 animate-pulse" />
        )}
      </div>
      <span className="text-[7px] font-black mt-1.5 uppercase">{label}</span>
    </button>
  );
});

TabButton.displayName = 'TabButton';