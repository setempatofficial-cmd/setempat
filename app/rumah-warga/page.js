"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import QRCode from "react-qr-code";
import {
  Home, User, MapPin, ShoppingBag, Star, Award, Heart, Gift,
  ChevronRight, Clock, Truck, HelpingHand, Coins, Eye, CheckCircle,
  QrCode, ShieldCheck, Share2, Copy, Check, X, Plus, Image as ImageIcon,
  Fingerprint, Loader2, Flame, Trophy, Zap, ArrowRight, ArrowLeft, HelpCircle, Shield, Wallet, Sparkles, Ticket
} from "lucide-react";

// Import komponen existing
import KTPModal from "@/app/components/layout/KTPModal";
import KTPCard from "@/app/components/layout/KTPCard";
import StoryModalFullscreen from "@/app/components/feed/StoryModal";
import PointsModal from "./modals/PointsModal";
import SaldoModal from "./modals/SaldoModal";
import OpportunityModal from "./modals/OpportunityModal";
import { useRumahWargaData } from "./hooks/useRumahWargaData";

// ============================================================
// 🔥 1. SKELETON LOADING
// ============================================================
function SkeletonLoader() {
  return (
    <div className="min-h-screen bg-slate-900 flex justify-center">
      <div className="w-full max-w-[400px] bg-slate-900 min-h-screen p-5 space-y-6">
        <div className="animate-pulse">
          <div className="h-12 bg-slate-800 rounded-2xl mb-6" />
          <div className="flex justify-between items-start mb-6">
            <div className="space-y-2">
              <div className="h-4 w-24 bg-slate-800 rounded" />
              <div className="h-8 w-32 bg-slate-800 rounded" />
            </div>
            <div className="w-12 h-12 rounded-2xl bg-slate-800" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="h-20 bg-slate-800 rounded-2xl" />
            <div className="h-20 bg-slate-800 rounded-2xl" />
            <div className="h-20 bg-slate-800 rounded-2xl" />
            <div className="h-20 bg-slate-800 rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 🔥 2. KTP WIDGET
// ============================================================
function KTPWidget({ profile, user, theme, onOpenKTPCard, onOpenVouchers, userPoints, isOpen, onClose }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQRPresenter, setShowQRPresenter] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [qrMessage, setQrMessage] = useState("");
  const [username, setUsername] = useState(null);

  // Di KTPWidget, setelah useState
  useEffect(() => {
    if (isOpen) {
      setIsMenuOpen(true);
    }
  }, [isOpen]);

  // Untuk menutup dari luar
  useEffect(() => {
    if (!isMenuOpen && onClose) {
      onClose();
    }
  }, [isMenuOpen, onClose]);

  useEffect(() => {
    const getUsername = async () => {
      if (profile?.username) {
        setUsername(profile.username);
        return;
      }
      if (user?.user_metadata?.username) {
        setUsername(user.user_metadata.username);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user?.id)
        .single();
      if (data?.username) {
        setUsername(data.username);
      } else {
        setUsername(null);
      }
    };
    if (user?.id) getUsername();
  }, [user?.id, profile?.username, user?.user_metadata?.username]);

  const profileUrl = username
    ? `https://setempat.id/${username}`
    : `https://setempat.id/u/${user?.id?.substring(0, 8) || 'warga'}`;

  const userName = profile?.full_name?.split(' ')[0] || user?.user_metadata?.full_name?.split(' ')[0] || 'Warga';
  const displayId = username ? `@${username}` : `ID: ${user?.id?.substring(0, 8) || 'SETEMPAT'}`;

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(profileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setIsMenuOpen(false);
  };

  const handleShowQR = async () => {
    const token = crypto.randomUUID() + Date.now();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    await supabase.from("access_tokens").insert({
      token: token,
      user_id: user.id,
      expires_at: expiresAt.toISOString(),
      is_used: false
    });

    const qrLink = `https://setempat.id/${username}?token=${token}`;
    setQrData(qrLink);
    setShowQRPresenter(true);
  };

  const handleAccessPresensi = () => {
    alert("🚧 Fitur presensi dalam pengembangan");
    setIsMenuOpen(false);
  };

  const handleVoucherClick = () => {
    setIsMenuOpen(false);
    if (onOpenVouchers) onOpenVouchers();
  };

  return (
    <>
      <button
        onClick={() => setIsMenuOpen(true)}
        className="w-full bg-slate-950/40 border border-slate-800 rounded-2xl p-4 flex justify-between items-center hover:border-emerald-500/40 transition-all active:scale-98 group"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
            <QrCode className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
              KTP Digital {userName}
              {profile?.is_verified && <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />}
            </p>
            <p className="text-[10px] text-slate-500 font-mono">
              {displayId}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-emerald-400 text-[10px] font-bold">
          <span>KETUK</span>
          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </button>

      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
              onClick={() => setIsMenuOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 rounded-t-3xl border-t border-slate-800 shadow-2xl max-w-md mx-auto"
            >
              <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto mt-3 mb-4" />
              <div className="px-5 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-200">KTP Digital</h3>
                    <p className="text-[10px] text-slate-500">{profile?.full_name || user?.user_metadata?.full_name}</p>
                  </div>
                </div>
              </div>
              <div className="p-4 space-y-2">
                <button onClick={handleVoucherClick} className="w-full flex items-center gap-4 p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/40 to-slate-950/50 border border-emerald-500/20 hover:border-emerald-500/40 transition-all active:scale-98">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <Ticket className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                      Tukar Hadiah & Voucher
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Kamu punya <strong className="text-emerald-400">{userPoints || 0} Poin</strong> siap pakai
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-emerald-500" />
                </button>

                <button onClick={handleShowQR} className="w-full flex items-center gap-4 p-3.5 rounded-xl bg-slate-950/50 hover:bg-slate-800/50 transition-all active:scale-98">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center"><QrCode className="w-5 h-5 text-emerald-400" /></div>
                  <div className="flex-1 text-left"><p className="text-sm font-bold text-slate-200">Tunjukkan ke Klien / Toko</p><p className="text-[10px] text-slate-500">Tampilkan QR KTP untuk validasi cepat</p></div>
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </button>

                <button onClick={handleCopyLink} className="w-full flex items-center gap-4 p-3.5 rounded-xl bg-slate-950/50 hover:bg-slate-800/50 transition-all active:scale-98">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center"><Share2 className="w-5 h-5 text-sky-400" /></div>
                  <div className="flex-1 text-left"><p className="text-sm font-bold text-slate-200">Salin Link Verifikasi</p><p className="text-[10px] text-slate-500">{copied ? 'Tersalin!' : 'Bagikan tautan profil'}</p></div>
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-600" />}
                </button>

                <button onClick={handleAccessPresensi} className="w-full flex items-center gap-4 p-3.5 rounded-xl bg-slate-950/50 hover:bg-slate-800/50 transition-all active:scale-98">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center"><Fingerprint className="w-5 h-5 text-amber-400" /></div>
                  <div className="flex-1 text-left"><p className="text-sm font-bold text-slate-200">Akses Presensi / Gerbang</p><p className="text-[10px] text-slate-500">Validasi kehadiran fisik</p></div>
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </button>

                <button onClick={onOpenKTPCard} className="w-full flex items-center gap-4 p-3.5 rounded-xl bg-slate-950/50 hover:bg-slate-800/50 transition-all active:scale-98">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center"><User className="w-5 h-5 text-purple-400" /></div>
                  <div className="flex-1 text-left"><p className="text-sm font-bold text-slate-200">Lihat & Update Profil</p><p className="text-[10px] text-slate-500">Kelola data diri dan KTP</p></div>
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </button>
              </div>
              <div className="p-4 pt-0 pb-6">
                <button onClick={() => setIsMenuOpen(false)} className="w-full py-3.5 rounded-xl bg-slate-800/50 text-slate-400 text-sm font-bold hover:bg-slate-800 transition-all active:scale-98">Tutup</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showQRPresenter && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center p-6"
          >
            <button onClick={() => setShowQRPresenter(false)} className="absolute top-5 right-5 p-2 bg-slate-900 border border-slate-800 rounded-full">
              <X className="w-5 h-5 text-slate-400" />
            </button>

            <div className="text-center mb-8">
              <p className="text-xs text-emerald-400 font-bold uppercase tracking-wider">
                {qrMessage ? "KLAIM VOUCHER" : "QR CODE WARGA SETEMPAT"}
              </p>
              <p className="text-xl font-black text-white mt-1 uppercase tracking-tight">{profile?.full_name}</p>
              <p className="text-xs text-slate-500">{displayId}</p>

              {qrMessage && (
                <div className="mt-3 p-2 bg-emerald-500/20 rounded-xl">
                  <p className="text-xs text-emerald-400 whitespace-pre-line">{qrMessage}</p>
                </div>
              )}
            </div>

            <div className="bg-white p-5 rounded-3xl shadow-2xl shadow-emerald-950/20">
              <QRCode
                value={qrData || profileUrl}
                size={230}
                level="H"
                fgColor="#020617"
              />
            </div>

            <p className="text-center text-xs text-slate-400 mt-6 max-w-xs leading-relaxed">
              {qrMessage
                ? "Dekatkan QR ini ke merchant untuk klaim voucher."
                : "Dekatkan layar HP ini ke perangkat merchant untuk validasi reputasi, mengecek klaim voucher, atau mencatat presensi warga secara instan."}
            </p>

            <button onClick={() => setShowQRPresenter(false)} className="mt-8 px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl">
              Tutup ID Digital
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ============================================================
// 🔥 2b. SALDO MODAL TRIGGER (butuh Suspense boundary karena
//        pakai useSearchParams)
// ============================================================
function SaldoModalTrigger({ onTrigger }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('modal') === 'saldo') {
      onTrigger();
    }
  }, [searchParams, onTrigger]);

  return null;
}

// ============================================================
// 🔥 3. MAIN COMPONENT
// ============================================================
export default function RumahWargaPage({ onClose }) {
  const router = useRouter();
  const { user, profile, loading, role, isAdmin, refreshProfile } = useAuth();

  // ===== STATE =====
  const [isKTPCardOpen, setIsKTPCardOpen] = useState(false);
  const [isKTPMenuOpen, setIsKTPMenuOpen] = useState(false);
  const [isPointsModalOpen, setIsPointsModalOpen] = useState(false);
  const [isSaldoModalOpen, setIsSaldoModalOpen] = useState(false);
  const [selectedStory, setSelectedStory] = useState(null);
  const [isStoryModalOpen, setIsStoryModalOpen] = useState(false);
  const [userPoints, setUserPoints] = useState(0);
  const [userSaldo, setUserSaldo] = useState(0);
  const [pointOpportunities, setPointOpportunities] = useState([]);
  const [moneyOpportunities, setMoneyOpportunities] = useState([]);
  const [selectedOpportunity, setSelectedOpportunity] = useState(null);
  const [isOpportunityModalOpen, setIsOpportunityModalOpen] = useState(false);

  // ===== HOOK useRumahWargaData =====
  const {
    laporanTerbaru,
    data,
    loading: dataLoading,
    refetch,
    formatTanggal
  } = useRumahWargaData(user?.id);

  // ===== HANDLERS =====
  const handlePointsUpdated = useCallback((newPoints) => {
    setUserPoints(newPoints);
    const cached = sessionStorage.getItem('user_profile');
    if (cached) {
      try {
        const profile = JSON.parse(cached);
        sessionStorage.setItem('user_profile', JSON.stringify({
          ...profile,
          points: newPoints
        }));
      } catch (e) { /* ignore */ }
    }
  }, []);

  const handleSaldoUpdated = useCallback(async () => {
    if (!user?.id) return;

    // 🔥 Fetch ulang langsung dari database, jangan andalkan parameter
    const { data, error } = await supabase
      .from("profiles")
      .select("saldo")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("Gagal refresh saldo:", error);
      return;
    }

    const newSaldo = data?.saldo || 0;
    setUserSaldo(newSaldo);

    const cached = sessionStorage.getItem('user_profile');
    if (cached) {
      try {
        const profile = JSON.parse(cached);
        sessionStorage.setItem('user_profile', JSON.stringify({
          ...profile,
          saldo: newSaldo
        }));
      } catch (e) { /* ignore */ }
    }
  }, [user?.id]);

  // Di RumahWargaPage
  const handleAccessPurchased = useCallback((data) => {
    console.log('🔥 handleAccessPurchased:', data);

    const { action, voucher_type, isLive, id, voucher_name } = data;

    // 🔥 JIKA ACTION = SHOW_KTP
    if (action === 'show_ktp') {
      console.log('📱 Opening KTP Menu for:', voucher_name);
      setIsKTPMenuOpen(true); // 🔥 BUKA MENU KTP WIDGET
      return;
    }

    // 🔥 CEK JENIS VOUCHER
    if (voucher_type === 'live') {
      // ============================================================
      // 🔴 VOUCHER LIVE
      // ============================================================
      sessionStorage.setItem('live_purchased_pending', 'true');
      sessionStorage.setItem('live_purchase_time', String(Date.now()));
      if (id) {
        sessionStorage.setItem('live_transaction_id', id);
      }

      // Refresh data
      try {
        if (refetch) refetch();
        if (refreshProfile) refreshProfile();
      } catch (err) {
        console.error('Error refreshing:', err);
      }

      // Redirect ke live jika on-air
      if (isLive === true) {
        console.log('🚀 Live is ON-AIR, redirecting to /live');
        setTimeout(() => {
          router.push('/live');
        }, 300);
      } else {
        console.log('⏳ Live is OFF-AIR, staying on Rumah Warga');
        // Tampilkan toast sukses
        // Bisa tambahkan notifikasi di sini
      }

    } else if (voucher_type === 'video') {
      // ============================================================
      // 🎬 VOUCHER VIDEO
      // ============================================================
      console.log('🎬 Video voucher redeemed:', voucher_name);
      // Redirect ke halaman video atau tampilkan modal sukses
      // Tidak perlu redirect ke live

    } else if (voucher_type === 'subscription') {
      // ============================================================
      // 📺 VOUCHER SUBSCRIPTION
      // ============================================================
      console.log('📺 Subscription voucher redeemed:', voucher_name);
      // Redirect ke halaman premium atau tampilkan modal sukses

    } else {
      // ============================================================
      // 🎁 PHYSICAL VOUCHER (KOPI, MAKANAN, DLL)
      // ============================================================
      console.log('🎁 Physical voucher redeemed:', voucher_name);
      // Tampilkan sukses, TIDAK redirect ke mana-mana
      // Cukup update poin dan tutup modal

      // Tampilkan alert atau toast sukses
      // alert(`✅ Voucher "${voucher_name}" berhasil ditukar!`);
    }

    // Refresh points di UI
    if (refetch) refetch();

  }, [refetch, refreshProfile, router]);

  const handleShowQR = useCallback((data) => {
    console.log('📱 Show QR/KTP from PointsModal:', data);

    if (data?.action === 'show_ktp') {
      setIsKTPMenuOpen(true);
      return;
    }
  }, []);

  // ===== FETCH OPPORTUNITIES =====
  useEffect(() => {
    const fetchOpportunities = async () => {
      const now = new Date().toISOString();

      const { data: pointData } = await supabase
        .from("opportunities")
        .select("*")
        .eq("is_active", true)
        .eq("reward_type", "point")
        .gte("deadline", now)
        .order("deadline", { ascending: true })
        .limit(5);

      const { data: moneyData } = await supabase
        .from("opportunities")
        .select("*")
        .eq("is_active", true)
        .eq("reward_type", "money")
        .gte("deadline", now)
        .order("deadline", { ascending: true })
        .limit(5);

      if (pointData) setPointOpportunities(pointData);
      if (moneyData) setMoneyOpportunities(moneyData);
    };

    fetchOpportunities();
  }, []);

  // ===== DATA DARI useRumahWargaData =====
  const reputasi = data?.reputasi || {
    level: 1,
    gelar: "🌱 Warga Baru",
    color: "text-green-400",
    bg: "bg-green-500/10",
    skor: 0,
    progress: 0,
    nextLevelSkor: 25
  };

  const statistik = data?.statistik || {
    totalLaporan: 0,
    totalFoto: 0,
    totalVideo: 0,
    hariAktif: 0,
    totalLikes: 0,
    totalViews: 0,
    featuredCount: 0,
    laporanRamai: 0,
    laporanBerdampak: 0
  };
  const badges = data?.badges || [];

  // ===== FETCH POINTS & SALDO =====
  useEffect(() => {
    const fetchPoints = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from("profiles")
        .select("points")
        .eq("id", user.id)
        .single();
      if (data) setUserPoints(data.points);
    };
    fetchPoints();
  }, [user?.id]);

  useEffect(() => {
    const fetchSaldo = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from("profiles")
        .select("saldo")
        .eq("id", user.id)
        .single();
      if (data) setUserSaldo(data.saldo || 0);
    };
    fetchSaldo();
  }, [user?.id]);

  // ===== HANDLER LAINNYA =====
  const handleStoryClick = (story) => {
    const enrichedStory = {
      ...story,
      user_name: profile?.full_name || user?.user_metadata?.full_name || "Warga",
      user_avatar: profile?.avatar_url,
      user_id: user?.id,
      lokasi_display: story.lokasi_display || story.lokasi_name || story.lokasi_custom || "Lokasi Setempat",
      tempat: story.tempat || {
        id: story.tempat_id,
        name: story.lokasi_name || story.lokasi_custom || "Lokasi Setempat",
        alamat: null,
        category: null
      }
    };
    setSelectedStory(enrichedStory);
    setIsStoryModalOpen(true);
  };

  const handleOpportunityClick = (opportunity) => {
    setIsPointsModalOpen(false);
    setIsSaldoModalOpen(false);
    setSelectedOpportunity(opportunity);
    setIsOpportunityModalOpen(true);
  };

  // ============================================================
  // 🔥 RENDER - HANYA 1 KALI CEK
  // ============================================================

  // 🔥 CEK LOADING (HANYA 1 KALI)
  if (loading || dataLoading) return <SkeletonLoader />;

  // 🔥 CEK USER (HANYA 1 KALI)
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex justify-center items-center p-6">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <Home className="w-10 h-10 text-slate-600" />
          </div>
          <p className="text-slate-400 mb-4">Silakan login untuk melihat Rumah Warga</p>
          <a href="/" className="inline-block px-6 py-3 bg-emerald-600 rounded-xl text-white font-bold">
            Kembali ke Beranda
          </a>
        </div>
      </div>
    );
  }

  // 🔥 AMBIL DATA USER (HANYA 1 KALI)
  const name = profile?.full_name || user?.user_metadata?.full_name || "Warga";
  const initial = name.charAt(0).toUpperCase();
  const isVerified = profile?.is_verified || false;

  // ============================================================
  // 🔥 RENDER UTAMA
  // ============================================================
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 flex justify-center">
      {/* 🔥 Trigger buka modal saldo dari query param ?modal=saldo,
          dibungkus Suspense agar tidak menggagalkan static prerender */}
      <Suspense fallback={null}>
        <SaldoModalTrigger onTrigger={() => setIsSaldoModalOpen(true)} />
      </Suspense>

      <div className="w-full max-w-[400px] bg-slate-900 min-h-screen pb-24 shadow-2xl relative">

        {/* HEADER */}
        <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-2 py-2">
          <div className="flex items-center">
            <button onClick={() => router.push('/')} className="min-w-[44px] h-11 rounded-full bg-slate-800/50 flex items-center justify-center hover:bg-slate-700/50 transition-all active:scale-95 cursor-pointer">
              <ArrowLeft className="w-5 h-5 text-slate-300" />
            </button>
            <div className="flex-1 flex items-center justify-center">
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl py-1.5 px-4 flex items-center gap-2">
                <span className="text-base">🏠</span>
                <h1 className="font-extrabold text-xs tracking-widest uppercase bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">Rumah Warga</h1>
              </div>
            </div>
            <div className="min-w-[44px]" />
          </div>
        </header>

        <main className="p-5 space-y-6">
          {/* PROFIL HEADER */}
          <section className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-400 text-[11px] font-bold uppercase flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Warga Setempat
                </span>
                {isVerified && <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">Terverifikasi</span>}
              </div>
              <h2 className="text-2xl font-black tracking-tighter text-white uppercase leading-tight">{name}</h2>
              <div className="flex flex-col gap-1.5 pt-1">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <MapPin className="w-3.5 h-3.5 text-rose-500" />
                  <span className="font-medium">Akamsi {profile?.desa || profile?.kecamatan || "Purwosari"}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {profile?.is_seller && <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"><ShoppingBag className="w-3 h-3" /> Bakul</span>}
                  {profile?.is_driver && <span className="bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"><Truck className="w-3 h-3" /> Ojek</span>}
                  {profile?.is_rewang && <span className="bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"><HelpingHand className="w-3 h-3" /> Rewang</span>}
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-[1.5px] shadow-lg shadow-emerald-950/30">
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center overflow-hidden">
                  {profile?.avatar_url ? <img src={profile.avatar_url} className="w-full h-full object-cover" alt="avatar" /> : <span className="text-emerald-400 font-black text-xl">{initial}</span>}
                </div>
              </div>
              {isVerified && <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-slate-900 flex items-center justify-center"><CheckCircle className="w-2.5 h-2.5 text-white" /></div>}
            </div>
          </section>

          <hr className="border-slate-800/50" />

          {/* STATS GRID */}
          <div className="grid grid-cols-2 gap-3">
            <div className={`bg-slate-950/40 border border-slate-800 p-3.5 rounded-2xl ${reputasi.bg}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <Flame className={`w-4 h-4 ${reputasi.color}`} />
                <span className={`text-sm font-black ${reputasi.color}`}>Lv {reputasi.level}</span>
              </div>
              <p className={`text-[10px] font-bold uppercase ${reputasi.color}`}>
                {reputasi.gelar.split(' ')[1] || 'Akamsi'}
              </p>
            </div>

            <div className="bg-slate-950/40 border border-slate-800 p-3.5 rounded-2xl">
              <div className="flex items-center gap-1.5 text-sky-400 mb-1">
                <Trophy className="w-4 h-4" />
                <span className="text-sm font-black text-slate-200">{badges.length}</span>
              </div>
              <p className="text-[10px] text-slate-500 font-bold uppercase">Lencana</p>
            </div>

            <div className="bg-slate-950/40 border border-slate-800 p-3.5 rounded-2xl">
              <div className="flex items-center gap-1.5 text-rose-500 mb-1">
                <Heart className="w-4 h-4 fill-rose-500/10" />
                <span className="text-sm font-black text-slate-200">
                  {statistik.totalLikes > 0 ? statistik.totalLikes * 2 : 132}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-bold uppercase">Terbantu</p>
            </div>

            <button
              onClick={() => setIsPointsModalOpen(true)}
              className="bg-slate-950/40 hover:bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl text-left transition-all active:scale-95 group"
            >
              <div className="flex items-center justify-between w-full mb-1">
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <Coins className="w-4 h-4" />
                  <span className="text-sm font-black">{userPoints}</span>
                </div>
                <HelpCircle className="w-3.5 h-3.5 text-slate-600" />
              </div>
              <p className="text-[10px] text-slate-500 font-bold uppercase">Poin Saya</p>
            </button>
          </div>

          {/* LEVEL PROGRESS */}
          <div className="bg-slate-950/30 border border-slate-800/80 p-4 rounded-2xl space-y-2.5">
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">{reputasi.gelar.split(' ')[0] || '🌱'}</span>
                <span className={`font-extrabold ${reputasi.color}`}>{reputasi.gelar}</span>
              </div>
              <span className="text-[10px] text-slate-500 font-bold">{reputasi.skor} Skor</span>
            </div>

            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, reputasi.progress)}%` }}
              />
            </div>

            <div className="flex justify-between items-center text-[9px] text-slate-500 font-semibold uppercase">
              <span>Level {reputasi.level}</span>
              {reputasi.nextLevelSkor ? (
                <span>{reputasi.nextLevelSkor - reputasi.skor} skor lagi ke Level {reputasi.level + 1}</span>
              ) : (
                <span className="text-emerald-400">Level Maksimal! 🎉</span>
              )}
              <span>Level {reputasi.level + 1}</span>
            </div>
          </div>

          <hr className="border-slate-800/50" />

          {/* Saldo Kontribusi Card */}
          <section className="space-y-2">
            <button
              onClick={() => setIsSaldoModalOpen(true)}
              className="w-full bg-gradient-to-r from-emerald-900/30 to-teal-900/30 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between group hover:border-emerald-500/50 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="text-left">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Dompet Warga</p>
                  <p className="text-lg font-black text-emerald-400">Rp{(userSaldo || 0).toLocaleString()}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </section>

          {/* KTP WIDGET */}
          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-2"><span>🪪</span> KTP Warga Setempat</h3>
            <KTPWidget
              profile={profile}
              user={user}
              theme={{ isMalam: true }}
              onOpenKTPCard={() => setIsKTPCardOpen(true)}
              onOpenVouchers={() => setIsPointsModalOpen(true)}
              userPoints={userPoints}
              isOpen={isKTPMenuOpen}
              onClose={() => setIsKTPMenuOpen(false)}
            />
          </section>

          <hr className="border-slate-800/50" />

          {/* AKTIVITAS TERBARU */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-1.5"><span>📍</span> Aktivitas Terbaru</h3>
            <div className="grid grid-cols-2 gap-3">
              {laporanTerbaru.length > 0 ? laporanTerbaru.map((laporan) => {
                const namaLokasi = laporan.lokasi_display || "Lokasi Setempat";
                const mediaUrl = laporan.image_url || laporan.photo_url;
                return (
                  <button key={laporan.id} onClick={() => handleStoryClick(laporan)} className="bg-slate-950/30 border border-slate-800 rounded-2xl overflow-hidden group active:scale-98 transition-all text-left">
                    <div className="aspect-square bg-slate-900 relative">
                      {mediaUrl ? <img src={mediaUrl} alt={namaLokasi} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300" /> : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="text-slate-700 w-8 h-8" /></div>}
                      {laporan.traffic_condition && <span className="absolute top-2 right-2 bg-slate-900/80 backdrop-blur-sm border border-slate-700 px-1.5 py-0.5 rounded-lg text-[8px] font-bold text-slate-300">🚦</span>}
                    </div>
                    <div className="p-2">
                      <h4 className="font-bold text-xs text-slate-200 truncate">{namaLokasi}</h4>
                      <p className="text-[9px] text-slate-400 line-clamp-1 mt-0.5">{laporan.deskripsi?.substring(0, 40) || "Laporan kondisi terkini"}</p>
                      <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center gap-1 text-[8px] text-slate-600"><Clock className="w-2.5 h-2.5" /> {formatTanggal(laporan.created_at)}</div>
                        {laporan.status === "approved" && <span className="text-[7px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full">✓</span>}
                      </div>
                    </div>
                  </button>
                );
              }) : (
                <div className="col-span-2 text-center py-8 bg-slate-950/30 border border-slate-800 rounded-2xl">
                  <MapPin className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                  <p className="text-slate-500 text-xs">Belum ada aktivitas</p>
                  <p className="text-[9px] text-slate-600 mt-0.5">Mulai buat laporan pertama Anda!</p>
                </div>
              )}
            </div>
            {laporanTerbaru.length > 0 && (
              <button onClick={() => router.push('/aktivitas')} className="w-full py-2.5 text-[10px] font-bold text-slate-400 bg-slate-950/40 border border-slate-800/80 rounded-xl hover:text-emerald-400 hover:border-emerald-500/30 transition-all flex items-center justify-center gap-1.5 active:scale-98">Lihat Semua Aktivitas <ArrowRight className="w-3 h-3" /></button>
            )}
          </section>

          <hr className="border-slate-800/50" />

          {/* DAMPAK SAYA */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-1.5"><span>❤️</span> Dampak Saya</h3>
            <div className="bg-slate-950/30 border border-slate-800/60 rounded-2xl p-4 space-y-3 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <Eye className="w-3.5 h-3.5 text-emerald-400" />
                <span><strong className="text-emerald-400">{statistik.totalViews}</strong> warga melihat laporan Anda</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300 border-t border-slate-800/40 pt-3">
                <Heart className="w-3.5 h-3.5 text-rose-400" />
                <span><strong className="text-emerald-400">{statistik.totalLikes}</strong> apresiasi dari warga</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300 border-t border-slate-800/40 pt-3">
                <Star className="w-3.5 h-3.5 text-amber-400" />
                <span><strong className="text-emerald-400">{statistik.featuredCount}</strong> laporan jadi sorotan setempat</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300 border-t border-slate-800/40 pt-3">
                <Flame className="w-3.5 h-3.5 text-orange-400" />
                <span><strong className="text-emerald-400">{statistik.laporanRamai}</strong> laporan ramai dibicarakan</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300 border-t border-slate-800/40 pt-3">
                <Trophy className="w-3.5 h-3.5 text-emerald-400" />
                <span><strong className="text-emerald-400">{statistik.laporanBerdampak}</strong> laporan berdampak tinggi</span>
              </div>
            </div>
          </section>

          <hr className="border-slate-800/50" />

          {/* PERAN SAYA */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
              <span>🎭</span> Peran Saya
            </h3>
            <div className="flex flex-wrap gap-2">
              <div className="flex-1 min-w-[90px] bg-slate-950/50 border border-slate-800 p-3 rounded-xl flex items-center gap-2 text-xs font-bold text-slate-300">
                <MapPin className="w-4 h-4 text-rose-500" /> Akamsi
              </div>

              {(profile?.is_seller || badges.some(b => b.id === "bakul")) && (
                <div className="flex-1 min-w-[90px] bg-slate-950/50 border border-slate-800 p-3 rounded-xl flex items-center gap-2 text-xs font-bold text-slate-300">
                  <ShoppingBag className="w-4 h-4 text-amber-500" /> Bakul
                </div>
              )}

              {(profile?.is_driver || badges.some(b => b.id === "driver")) && (
                <div className="flex-1 min-w-[90px] bg-slate-950/50 border border-slate-800 p-3 rounded-xl flex items-center gap-2 text-xs font-bold text-slate-300">
                  <Truck className="w-4 h-4 text-sky-500" /> Ojek
                </div>
              )}

              {(profile?.is_rewang || badges.some(b => b.id === "rewang")) && (
                <div className="flex-1 min-w-[90px] bg-slate-950/50 border border-slate-800 p-3 rounded-xl flex items-center gap-2 text-xs font-bold text-slate-300">
                  <HelpingHand className="w-4 h-4 text-purple-500" /> Rewang
                </div>
              )}

              {!profile?.is_seller && !profile?.is_driver && !profile?.is_rewang &&
                !badges.some(b => b.id === "bakul" || b.id === "driver" || b.id === "rewang") && (
                  <button
                    onClick={() => router.push('/peken')}
                    className="flex-1 bg-slate-800/40 border border-dashed border-slate-700 p-3 rounded-xl text-slate-500 hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-400 transition-all active:scale-95 flex items-center justify-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-[10px]">Ambil Peran</span>
                  </button>
                )}
            </div>
          </section>

          {/* BADGES SECTION - TETAP SAMA */}
          <section className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                <span>🏆</span> Reputasi Akamsi
              </h3>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                {badges.length} Lencana Diraih
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {badges.length > 0 ? badges.map((badge) => (
                <div
                  key={badge.id}
                  className="bg-slate-950/40 border border-slate-800 rounded-2xl p-3 hover:border-emerald-500/30 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                      {badge.icon}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-200">{badge.name}</p>
                      <p className="text-[10px] text-slate-400">{badge.desc}</p>
                    </div>
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                  </div>

                  {badge.perks && (
                    <div className="mt-2 pt-2 border-t border-slate-700/50">
                      <p className="text-[9px] text-emerald-400 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        {badge.perks}
                      </p>
                    </div>
                  )}

                  {badge.earnedAt && (
                    <div className="mt-1">
                      <p className="text-[8px] text-slate-500">
                        Diraih: {new Date(badge.earnedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  )}
                </div>
              )) : (
                <div className="text-center py-6 bg-slate-950/30 border border-slate-800 rounded-2xl">
                  <p className="text-slate-500 text-sm mb-2">✨ Belum ada lencana diraih</p>
                  <div className="text-left text-[9px] text-slate-500 space-y-1 px-4">
                    <p className="font-medium text-slate-400 mb-1">Raih lencana spesialisasi untuk membuka:</p>
                    <p className="flex items-center gap-1">• 🚦 Bounty laporan lalu lintas</p>
                    <p className="flex items-center gap-1">• 🌧 Bounty laporan cuaca</p>
                    <p className="flex items-center gap-1">• 📸 Jual konten ke marketplace</p>
                    <p className="flex items-center gap-1">• 🎥 Royalti video</p>
                    <p className="flex items-center gap-1">• ⭐ Program mitra desa</p>
                  </div>
                  <p className="text-[8px] text-slate-600 mt-3">Fokus pada satu bidang untuk mendapat lencana!</p>
                </div>
              )}
            </div>

            {badges.length > 0 && (
              <button
                onClick={() => router.push('/rumah-warga/badges')}
                className="w-full text-center text-[9px] text-slate-500 hover:text-emerald-400 transition-colors py-1"
              >
                Lihat Semua Lencana →
              </button>
            )}
          </section>

          <hr className="border-slate-800/50" />

          {/* PENGATURAN */}
          <section className="space-y-3 pb-4">
            <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-1.5"><span>⚙️</span> Pengaturan</h3>
            <div className="bg-slate-950/40 border border-slate-800 rounded-2xl overflow-hidden">
              <button onClick={() => alert("Menu Pengaturan akan segera hadir")} className="w-full flex items-center justify-between p-4 text-xs font-medium text-slate-300 hover:bg-slate-950/80 transition-colors">
                <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-emerald-400" /><span>Privasi & Keamanan Akun</span></div>
                <ChevronRight className="w-4 h-4 text-slate-700" />
              </button>
            </div>
          </section>
        </main>

        {/* ============================================================
            🔥 MODALS
            ============================================================ */}

        <PointsModal
          isOpen={isPointsModalOpen}
          onClose={() => setIsPointsModalOpen(false)}
          userId={user?.id}
          userPoints={userPoints}
          userSaldo={userSaldo}
          pointOpportunities={pointOpportunities}
          onOpportunityClick={handleOpportunityClick}
          onPointsUpdated={handlePointsUpdated}
          onAccessPurchased={handleAccessPurchased}
          onShowQR={handleShowQR}
        />

        {isSaldoModalOpen && (
          <SaldoModal
            isOpen={isSaldoModalOpen}
            onClose={() => setIsSaldoModalOpen(false)}
            userId={user?.id}
            userSaldo={userSaldo}
            moneyOpportunities={moneyOpportunities}
            onOpportunityClick={handleOpportunityClick}
            onSaldoUpdated={handleSaldoUpdated}
          />
        )}

        {isKTPCardOpen && (
          <KTPModal isOpen={isKTPCardOpen} onClose={() => setIsKTPCardOpen(false)} theme={{ isMalam: true }}>
            <KTPCard user={user} role={role} theme={{ isMalam: true }} onProfileUpdated={() => { setIsKTPCardOpen(false); refreshProfile(); refetch(); }} />
          </KTPModal>
        )}

        {isStoryModalOpen && selectedStory && (
          <StoryModalFullscreen
            isOpen={isStoryModalOpen}
            onClose={() => { setIsStoryModalOpen(false); setSelectedStory(null); }}
            stories={[{
              ...selectedStory,
              user_name: profile?.full_name || user?.user_metadata?.full_name || "Warga",
              user_avatar: profile?.avatar_url,
              tempat: { name: selectedStory.tempat?.name || selectedStory.lokasi_display || "Lokasi Setempat" }
            }]}
            namaTempat={selectedStory.tempat?.name || selectedStory.lokasi_name || "Lokasi Setempat"}
            currentUserId={user?.id}
            isAdmin={isAdmin}
          />
        )}

        {isOpportunityModalOpen && selectedOpportunity && (
          <OpportunityModal
            isOpen={isOpportunityModalOpen}
            onClose={() => {
              setIsOpportunityModalOpen(false);
              setSelectedOpportunity(null);
            }}
            opportunity={selectedOpportunity}
            userId={user?.id}
          />
        )}

      </div>
    </div>
  );
}
