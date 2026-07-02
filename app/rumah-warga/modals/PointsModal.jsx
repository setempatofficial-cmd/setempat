"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Gift, Target, Award, Coffee, Utensils, Ticket, CheckCircle, Wallet, Loader2, Bell, Tv, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const getIconComponent = (iconName) => {
  const icons = {
    Coffee: Coffee,
    Utensils: Utensils,
    Ticket: Ticket,
    Gift: Gift,
    Tv: Tv,
  };
  const Icon = icons[iconName] || Gift;
  return Icon;
};

export default function PointsModal({
  isOpen,
  onClose,
  userId,
  userPoints = 0,
  userSaldo = 0,
  pointOpportunities = [],
  onOpportunityClick,
  onPointsUpdated,
  onAccessPurchased,
  onShowQR,
  voucherType = 'all',
}) {
  const [localPoints, setLocalPoints] = useState(userPoints);
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [redeemSuccess, setRedeemSuccess] = useState(false);
  const [vouchers, setVouchers] = useState([]);
  const [error, setError] = useState(null);
  const [isLive, setIsLive] = useState(false);

  const [lastTransactionId, setLastTransactionId] = useState(null);

  // ============================================================
  // 🔥 HELPER: CEK LIVE STATUS
  // ============================================================
  const checkLiveStatus = useCallback(async () => {
    const LIVE_INPUT_ID = process.env.NEXT_PUBLIC_CLOUDFLARE_LIVE_INPUT_ID || "";
    const STREAM_URL = `https://videodelivery.net/${LIVE_INPUT_ID}/manifest/video.m3u8`;

    if (!STREAM_URL || !LIVE_INPUT_ID) return false;

    const cached = sessionStorage.getItem('live_status');
    const cachedTime = sessionStorage.getItem('live_status_time');
    if (cached && cachedTime) {
      const elapsed = Date.now() - parseInt(cachedTime);
      if (elapsed < 2000) return cached === 'true';
    }

    try {
      const response = await fetch(STREAM_URL, {
        method: 'HEAD',
        headers: { 'Cache-Control': 'no-cache' }
      });
      const isLive = response.ok;

      sessionStorage.setItem('live_status', String(isLive));
      sessionStorage.setItem('live_status_time', String(Date.now()));

      return isLive;
    } catch (err) {
      console.warn('CORS error on live check, assuming live.');
      return true;
    }
  }, []);

  // ============================================================
  // 🔥 FETCH VOUCHERS
  // ============================================================
  useEffect(() => {
    const fetchVouchers = async () => {
      const { data } = await supabase
        .from("vouchers")
        .select("*")
        .eq("is_active", true)
        .gt("points_required", 0)
        .order("points_required", { ascending: true });

      if (data) {
        console.log("✅ Vouchers fetched:", data);
        console.log("🔴 Live vouchers:", data.filter(v => v.type === 'live'));
        setVouchers(data);
      }
    };

    if (isOpen) fetchVouchers();
  }, [isOpen]);

  // ============================================================
  // 🔥 SYNC POINTS
  // ============================================================
  useEffect(() => {
    setLocalPoints(userPoints);
  }, [userPoints]);

  useEffect(() => {
    if (!isOpen || !userId) return;

    const fetchCurrentPoints = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("points")
          .eq("id", userId)
          .single();

        if (error) throw error;
        if (data) {
          setLocalPoints(data.points || 0);

          const cached = sessionStorage.getItem('user_profile');
          if (cached) {
            const profile = JSON.parse(cached);
            sessionStorage.setItem('user_profile', JSON.stringify({
              ...profile,
              points: data.points || 0
            }));
          }
        }
      } catch (err) {
        console.error("Error fetching points:", err);
      }
    };

    fetchCurrentPoints();
  }, [isOpen, userId]);

  // ============================================================
  // 🔥 FILTER VOUCHER
  // ============================================================
  const getRelevantVouchers = () => {
    // Tampilkan semua voucher yang aktif
    return vouchers.sort((a, b) => a.points_required - b.points_required);
  };

  const relevantVouchers = getRelevantVouchers();
  const nextVoucher = vouchers.find((v) => v.points_required > localPoints);
  const isMaxed = !nextVoucher;
  const targetVoucher = nextVoucher || vouchers[vouchers.length - 1];
  const progressToNext = isMaxed || !targetVoucher ? 100 : Math.min(100, (localPoints / targetVoucher.points_required) * 100);
  const pointsNeeded = isMaxed || !targetVoucher ? 0 : targetVoucher.points_required - localPoints;
  const hiddenVouchersCount = vouchers.length - relevantVouchers.length;

  // ============================================================
  // 🔥 UPDATE CACHE HELPER
  // ============================================================
  const updateUserCache = useCallback((newPoints, newSaldo = null) => {
    const cached = sessionStorage.getItem('user_profile');
    if (cached) {
      try {
        const profile = JSON.parse(cached);
        const updated = {
          ...profile,
          points: newPoints !== undefined ? newPoints : profile.points,
          saldo: newSaldo !== null ? newSaldo : profile.saldo
        };
        sessionStorage.setItem('user_profile', JSON.stringify(updated));
      } catch (e) { /* ignore */ }
    }
  }, []);

  // ============================================================
  // 🔥 HELPER: INSERT NOTIFIKASI KE WARUNG_INFO
  // ============================================================
  const insertWarungInfo = async (userId, title, message, type, metadata = {}) => {
    try {
      if (!userId) {
        console.error("❌ userId is required");
        return { success: false, error: "userId is required" };
      }

      const insertData = {
        user_id: userId,
        title: title || "Notifikasi",
        message: message || "",
        type: type || "info",
        is_read: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        content: JSON.stringify({
          ...metadata,
          voucher_id: metadata.voucher_id || null,
          transaction_id: metadata.transaction_id || null,
          redirect_url: metadata.redirect_url || null,
          timestamp: new Date().toISOString()
        }),
        action_type: type,
        related_type: type,
        reference_type: type,
        reference_id: metadata.transaction_id ? parseInt(metadata.transaction_id) : null,
        from_user_id: userId,
        from_user_name: "Sistem",
        from_username: "sistem",
      };

      const { data, error } = await supabase
        .from("warung_info")
        .insert(insertData)
        .select();

      if (error) {
        console.error("❌ Error inserting warung_info:", error);
        return { success: false, error };
      }

      return { success: true, data };
    } catch (err) {
      console.error("❌ Failed to insert warung_info:", err);
      return { success: false, error: err };
    }
  };

  // ============================================================
  // 🔥 HANDLE REDEEM - FINAL (DIPERBAIKI)
  // ============================================================
  const handleRedeem = async () => {
    if (!selectedVoucher || redeeming) return;

    // ============================================================
    // 🔥 VOUCHER FISIK: TUKAR & BUAT TRANSAKSI
    // ============================================================
    if (selectedVoucher.type === 'physical' || !selectedVoucher.type) {
      setRedeeming(true);

      try {
        // 1. AMBIL POIN TERBARU
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("points")
          .eq("id", userId)
          .single();

        if (profileError) throw profileError;

        const currentPoints = profile?.points || 0;

        if (currentPoints < selectedVoucher.points_required) {
          setError(`Poin tidak mencukupi! Anda punya ${currentPoints} poin, butuh ${selectedVoucher.points_required} poin.`);
          setRedeeming(false);
          return;
        }

        // 2. KURANGI POIN
        const newPoints = currentPoints - selectedVoucher.points_required;

        const { error: updateError } = await supabase
          .from("profiles")
          .update({ points: newPoints })
          .eq("id", userId);

        if (updateError) throw updateError;

        setLocalPoints(newPoints);

        // Update cache
        const cached = sessionStorage.getItem('user_profile');
        if (cached) {
          const profile = JSON.parse(cached);
          sessionStorage.setItem('user_profile', JSON.stringify({
            ...profile,
            points: newPoints
          }));
        }

        if (onPointsUpdated) {
          onPointsUpdated(newPoints);
        }

        // 3. 🔥 BUAT RECORD DI VOUCHER_TRANSACTIONS
        const expiredAt = new Date();
        expiredAt.setDate(expiredAt.getDate() + 7); // Berlaku 7 hari

        const { data: txData, error: txError } = await supabase
          .from("voucher_transactions")
          .insert({
            user_id: userId,
            voucher_id: selectedVoucher.id,
            points_spent: selectedVoucher.points_required,
            status: "pending",
            redeemed_at: new Date().toISOString(),
            expired_at: expiredAt.toISOString(),
            user_points_before: currentPoints,
            access_method: "points",
            metadata: {
              voucher_name: selectedVoucher.name,
              merchant: selectedVoucher.merchant,
              type: "physical",
              redeemed_at: new Date().toISOString()
            },
            access_data: {
              claimed: false,
              claim_deadline: expiredAt.toISOString()
            }
          })
          .select();

        if (txError) {
          console.error("❌ Gagal membuat transaksi:", txError);
          throw txError;
        }

        // 4. INSERT WARUNG_INFO
        await insertWarungInfo(
          userId,
          "🎁 Voucher Fisik Berhasil Ditukar!",
          `Anda telah menukarkan ${selectedVoucher.points_required} Poin untuk voucher "${selectedVoucher.name}" dari ${selectedVoucher.merchant}. Jangan lupa klaim sebelum ${expiredAt.toLocaleDateString('id-ID')}!`,
          "voucher_physical",
          {
            voucher_id: selectedVoucher.id,
            voucher_name: selectedVoucher.name,
            merchant: selectedVoucher.merchant,
            transaction_id: txData?.[0]?.id,
            redirect_url: "/rumah-warga",
            expire_at: expiredAt.toISOString()
          }
        );

        // 5. TAMPILKAN SUKSES
        setRedeemSuccess(true);

      } catch (err) {
        console.error('❌ Redeem physical error:', err);
        setError(err.message || 'Gagal menukarkan voucher. Silakan coba lagi.');
        setTimeout(() => setError(null), 4000);
        setRedeeming(false);
      }
      return; // ⚠️ STOP di sini
    }

    // ============================================================
    // 🔥 VOUCHER DIGITAL (live/video/subscription): Proses RPC
    // ============================================================
    setRedeeming(true);

    try {
      // 1. AMBIL POIN TERBARU
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("points")
        .eq("id", userId)
        .single();

      if (profileError) throw profileError;

      const currentPoints = profile?.points || 0;

      if (currentPoints < selectedVoucher.points_required) {
        setError(`Poin tidak mencukupi! Anda punya ${currentPoints} poin, butuh ${selectedVoucher.points_required} poin.`);
        setLocalPoints(currentPoints);
        setTimeout(() => setError(null), 4000);
        setRedeeming(false);
        return;
      }

      setLocalPoints(currentPoints);

      // 2. CEK LIVE STATUS
      const isLiveStatus = await checkLiveStatus();
      setIsLive(isLiveStatus);

      const expiredAt = new Date();
      expiredAt.setHours(expiredAt.getHours() + 24);

      let transactionStatus = "active";
      if (selectedVoucher.type === 'live') {
        transactionStatus = isLiveStatus ? "active" : "pending";
      }

      // 3. PANGGIL RPC
      const { data: rpcData, error: rpcError } = await supabase.rpc('redeem_live_voucher', {
        p_user_id: userId,
        p_voucher_id: selectedVoucher.id,
        p_points_required: selectedVoucher.points_required,
        p_status: transactionStatus,
        p_expired_at: expiredAt.toISOString()
      });

      if (rpcError) {
        console.error("Detail DB Error:", rpcError);
        throw new Error(`Sistem Database Gagal: ${rpcError.message}`);
      }
      setLastTransactionId(rpcData.transaction_id);
      // 4. UPDATE STATE POIN
      const { data: freshProfile } = await supabase
        .from("profiles")
        .select("points")
        .eq("id", userId)
        .single();

      if (freshProfile) {
        setLocalPoints(freshProfile.points || 0);

        // Update cache
        const cached = sessionStorage.getItem('user_profile');
        if (cached) {
          const profile = JSON.parse(cached);
          sessionStorage.setItem('user_profile', JSON.stringify({
            ...profile,
            points: freshProfile.points || 0
          }));
        }

        if (onPointsUpdated) {
          onPointsUpdated(freshProfile.points || 0);
        }
      }

      // 5. INSERT WARUNG_INFO
      let warungTitle = "";
      let warungMessage = "";
      let warungType = "";
      let metadata = {
        transaction_id: rpcData.transaction_id,
        voucher_id: selectedVoucher.id,
        voucher_name: selectedVoucher.name,
        merchant: selectedVoucher.merchant,
        redirect_url: "/rumah-warga"
      };

      if (selectedVoucher.type === 'live') {
        if (isLiveStatus) {
          warungTitle = "🔴 Akses Live Aktif!";
          warungMessage = `Selamat! Anda sekarang memiliki akses ke siaran live. Klik untuk menonton!`;
          warungType = "live_active";
          metadata.redirect_url = "/live";
        } else {
          warungTitle = "⏳ Akses Live Dibeli";
          warungMessage = `Anda telah membeli akses live. Kami akan memberitahu Anda saat siaran dimulai.`;
          warungType = "live_pending";
          metadata.redirect_url = "/live";
        }
      } else if (selectedVoucher.type === 'video') {
        warungTitle = "🎬 Akses Video Aktif!";
        warungMessage = `Voucher "${selectedVoucher.name}" berhasil ditukar. Akses video berlaku 24 jam.`;
        warungType = "video";
        metadata.redirect_url = `/video/${selectedVoucher.video_id || '1'}`;
      } else if (selectedVoucher.type === 'subscription') {
        warungTitle = "📺 Berlangganan Aktif!";
        warungMessage = `Berlangganan "${selectedVoucher.name}" berhasil diaktifkan. Berlaku 30 hari.`;
        warungType = "subscription";
        metadata.redirect_url = "/premium";
      }

      await insertWarungInfo(userId, warungTitle, warungMessage, warungType, metadata);

      // 6. TAMPILKAN POPUP SUKSES
      if (onAccessPurchased) {
        onAccessPurchased({
          id: lastTransactionId,
          status: transactionStatus,
          voucher_id: selectedVoucher.id,
          voucher_type: selectedVoucher.type,
          voucher_name: selectedVoucher.name,
          isLive: isLiveStatus,
          merchant: selectedVoucher.merchant,
          points_held: selectedVoucher.points_required
        });
      }
      setRedeemSuccess(true);

    } catch (err) {
      console.error('Redeem error:', err);
      setError(err.message || 'Gagal menukarkan voucher. Silakan coba lagi.');
      setTimeout(() => setError(null), 4000);
    } finally {
      setRedeeming(false);
    }
  };

  // ============================================================
  // 🔥 HANDLE SHOW KTP
  // ============================================================
  const handleShowKTP = () => {
    setRedeemSuccess(false);
    setShowConfirmModal(false);
    setSelectedVoucher(null);
    setRedeeming(false);
    onClose();

    if (onAccessPurchased) {
      onAccessPurchased({
        action: "show_ktp",
        voucher_name: selectedVoucher?.name
      });
    }
  };

  // ============================================================
  // 🔥 HANDLE TOP-UP POIN
  // ============================================================
  const handleTopUpPoin = async (pkg) => {
    if (!userId) return;

    const isConfirmed = confirm(`Beli ${pkg.points} Poin seharga Rp${pkg.price.toLocaleString()}?`);
    if (!isConfirmed) return;

    setError(null);

    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("saldo, points")
        .eq("id", userId)
        .single();

      if (profileError || !profile) {
        throw new Error("Data user tidak ditemukan!");
      }

      if ((profile.saldo || 0) < pkg.price) {
        throw new Error(`Saldo tidak mencukupi! Saldo Anda: Rp${(profile.saldo || 0).toLocaleString()}`);
      }

      const newSaldo = (profile.saldo || 0) - pkg.price;
      const newPoints = (profile.points || 0) + pkg.points;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          saldo: newSaldo,
          points: newPoints
        })
        .eq("id", userId);

      if (updateError) throw updateError;

      updateUserCache(newPoints, newSaldo);
      setLocalPoints(newPoints);

      if (onPointsUpdated) {
        onPointsUpdated(newPoints);
      }

      await supabase
        .from("voucher_transactions")
        .insert({
          user_id: userId,
          voucher_id: null,
          points_spent: 0,
          amount: pkg.price,
          status: "completed",
          redeemed_at: new Date().toISOString(),
          metadata: {
            type: "topup_poin",
            points_added: pkg.points,
            price: pkg.price,
            saldo_before: profile.saldo || 0,
            saldo_after: newSaldo
          }
        });

      await insertWarungInfo(
        userId,
        "🪙 Top-Up Poin Berhasil!",
        `Anda telah membeli ${pkg.points} Poin seharga Rp${pkg.price.toLocaleString()}. Saldo Anda sekarang Rp${newSaldo.toLocaleString()}.`,
        "points_topup",
        {
          points_added: pkg.points,
          price: pkg.price,
          saldo_before: profile.saldo || 0,
          saldo_after: newSaldo
        }
      );

      alert(`✅ Berhasil! ${pkg.points} Poin telah ditambahkan.`);

    } catch (err) {
      console.error("Error top-up:", err);
      setError(err.message || "Gagal top-up. Silakan coba lagi.");
      setTimeout(() => setError(null), 4000);
    }
  };

  // ============================================================
  // 🔥 RENDER
  // ============================================================
  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-end justify-center sm:items-center p-0 sm:p-4"
            onClick={onClose}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 350 }}
              className="bg-slate-900 border border-slate-800/80 rounded-t-3xl sm:rounded-2xl w-full max-w-[380px] max-h-[85vh] overflow-y-auto shadow-2xl pb-6"
              onClick={(e) => e.stopPropagation()}
            >
              {/* HEADER */}
              <div className="sticky top-0 z-10 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/60 px-5 py-4 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <Award className="w-4 h-4 text-emerald-400" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-100">Poin & Hadiah</h3>
                </div>
                <button onClick={onClose} className="p-1.5 rounded-full bg-slate-800/60 hover:bg-slate-800 text-slate-400 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* ERROR MESSAGE */}
              {error && (
                <div className="mx-5 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}

              {/* ... (konten PointsModal tetap sama) ... */}
              <div className="p-5 space-y-5">
                {/* HERO POIN CARD */}
                <div className="bg-gradient-to-b from-slate-800/40 to-slate-800/10 rounded-2xl p-5 border border-slate-800/80 text-center">
                  <p className="text-xs font-semibold text-slate-400 tracking-wide uppercase">Total Poin Kamu</p>
                  <h2 className="text-4xl font-black text-emerald-400 my-1.5 tracking-tight">{localPoints}</h2>
                  <p className="text-xs text-slate-500">Kumpulkan terus untuk ditukar dengan voucher</p>
                </div>

                {/* PROGRESS TARGET */}
                {vouchers.length > 0 && targetVoucher && (
                  <div className="bg-slate-800/20 rounded-2xl p-4 border border-slate-800/50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold text-slate-200">
                          {isMaxed ? "Semua Target Tercapai 🎉" : "Target Voucher Berikutnya"}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        {localPoints} / {targetVoucher.points_required} Poin
                      </span>
                    </div>

                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-2 border border-slate-700/30">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progressToNext}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                      />
                    </div>

                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      {isMaxed ? (
                        <span>Kamu bisa menukarkan voucher apa saja!</span>
                      ) : (
                        <span><strong>{pointsNeeded}</strong> poin lagi untuk <strong>{targetVoucher.name}</strong></span>
                      )}
                    </p>
                  </div>
                )}

                {/* TUKAR HADIAH */}
                <div>
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <Gift className="w-4 h-4 text-slate-400" />
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Pilihan Voucher</h4>
                    </div>
                    {hiddenVouchersCount > 0 && (
                      <span className="text-[9px] text-slate-500">+{hiddenVouchersCount} voucher lainnya</span>
                    )}
                  </div>

                  <div className="space-y-2.5">
                    {relevantVouchers.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-slate-400 text-sm">Belum ada voucher tersedia</p>
                      </div>
                    ) : (
                      relevantVouchers.map((voucher) => {
                        const isAvailable = localPoints >= voucher.points_required;
                        const Icon = getIconComponent(voucher.icon);
                        return (
                          <div
                            key={voucher.id}
                            className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${isAvailable
                              ? "bg-slate-800/20 border-slate-800 hover:border-slate-700"
                              : "bg-slate-900/40 border-slate-800/40 opacity-70"
                              }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isAvailable ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-800 text-slate-500"
                                }`}>
                                <Icon className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-xs font-bold text-slate-200 truncate">{voucher.name}</p>
                                  {voucher.type === 'live' && (
                                    <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-[8px] rounded-full font-bold animate-pulse">🔴 LIVE</span>
                                  )}
                                  {voucher.type === 'video' && (
                                    <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-[8px] rounded-full font-bold">🎬 VIDEO</span>
                                  )}
                                  {voucher.type === 'subscription' && (
                                    <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 text-[8px] rounded-full font-bold">📺 BERLANGGANAN</span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500 truncate">{voucher.merchant || 'Setempat'}</p>
                                {voucher.type === 'live' && (
                                  <div className="mt-1">
                                    <p className="text-[8px] text-emerald-400/70">
                                      ⏰ Berlaku 24 jam sejak ditukar
                                    </p>
                                    <p className="text-[8px] text-slate-500 mt-0.5">
                                      🔄 Tukar lagi untuk live berikutnya
                                    </p>
                                  </div>
                                )}
                                {voucher.type === 'video' && (
                                  <p className="text-[8px] text-blue-400/70 mt-0.5">🎥 Akses video 24 jam</p>
                                )}
                                {voucher.type === 'subscription' && (
                                  <p className="text-[8px] text-purple-400/70 mt-0.5">📅 Berlangganan 30 hari</p>
                                )}
                                {(!voucher.type || voucher.type === 'physical') && (
                                  <p className="text-[9px] text-amber-400/70 mt-0.5">⏰ Berlaku 7 hari setelah tukar</p>
                                )}
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <p className="text-xs font-bold text-slate-300 mb-1.5">{voucher.points_required} Poin</p>
                              <button
                                onClick={() => {
                                  if (isAvailable) {
                                    setSelectedVoucher(voucher);
                                    setShowConfirmModal(true);
                                  }
                                }}
                                disabled={!isAvailable}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${isAvailable
                                  ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 active:scale-95 cursor-pointer"
                                  : "bg-slate-800 text-slate-500 cursor-not-allowed"
                                  }`}
                              >
                                {isAvailable ? "Tukar" : `${voucher.points_required - localPoints} Poin Lagi`}
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* TOP-UP POIN */}
                <div className="border-t border-slate-800 pt-4">
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <Wallet className="w-4 h-4 text-amber-400" />
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Top-Up Poin</h4>
                    <span className="ml-auto text-[10px] text-slate-500">
                      💰 Saldo: Rp{(userSaldo || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: '10 Poin', price: 5000, points: 10 },
                      { label: '25 Poin', price: 10000, points: 25 },
                      { label: '50 Poin', price: 15000, points: 50 },
                    ].map((pkg) => (
                      <button
                        key={pkg.points}
                        onClick={() => handleTopUpPoin(pkg)}
                        className="p-3 rounded-xl bg-slate-800/50 border border-slate-700 hover:border-emerald-500/50 transition-all text-center"
                      >
                        <p className="text-sm font-bold text-emerald-400">{pkg.points} Poin</p>
                        <p className="text-[10px] text-slate-400">Rp{pkg.price.toLocaleString()}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* KESEMPATAN DAPAT POIN */}
                {pointOpportunities.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3 px-1">
                      <Target className="w-4 h-4 text-amber-400" />
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Kesempatan Dapat Poin</h4>
                    </div>
                    <div className="space-y-2">
                      {pointOpportunities.map((opp) => (
                        <button
                          key={opp.id}
                          onClick={() => {
                            if (onOpportunityClick) {
                              onOpportunityClick(opp);
                            }
                          }}
                          className="w-full p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-left hover:bg-amber-500/20 transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <div className="text-xl">{opp.icon || "🎯"}</div>
                            <div className="flex-1">
                              <p className="text-xs font-bold text-slate-200">{opp.title}</p>
                              <p className="text-[9px] text-slate-400 line-clamp-1">{opp.description}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-bold text-amber-400">+{opp.reward_value} Poin</p>
                              <p className="text-[8px] text-slate-500">📅 {new Date(opp.deadline).toLocaleDateString('id-ID')}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CONFIRM REDEEM MODAL */}
      <AnimatePresence>
        {showConfirmModal && selectedVoucher && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => !redeeming && setShowConfirmModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 rounded-2xl max-w-[320px] w-full p-6 border border-slate-800"
              onClick={(e) => e.stopPropagation()}
            >
              {redeemSuccess ? (
                // SUCCESS MESSAGE
                <div className="text-center">
                  {/* LIVE VOUCHER */}
                  {selectedVoucher.type === 'live' ? (
                    <>
                      {isLive ? (
                        // 🔥 LIVE ON-AIR
                        <>
                          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                            <CheckCircle className="w-10 h-10 text-emerald-400" />
                          </div>
                          <h3 className="text-xl font-bold text-white mb-2">🎉 Akses Live Aktif!</h3>
                          <p className="text-slate-400 text-sm mb-4">Selamat menonton siaran live!</p>
                          <button
                            onClick={() => {
                              setRedeemSuccess(false);
                              setShowConfirmModal(false);
                              setSelectedVoucher(null);
                              setRedeeming(false);
                              onClose();
                              if (onAccessPurchased) {
                                onAccessPurchased({
                                  id: rpcData?.transaction_id,
                                  status: "active",
                                  voucher_type: selectedVoucher.type,
                                  voucher_name: selectedVoucher.name
                                });
                              }
                            }}
                            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white font-bold transition-colors"
                          >
                            🎬 Nonton Sekarang
                          </button>
                        </>
                      ) : (
                        // ⏳ LIVE OFF-AIR
                        <>
                          <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-3">
                            <Bell className="w-10 h-10 text-amber-400" />
                          </div>
                          <h3 className="text-xl font-bold text-white mb-2">⏳ Akses Live Dibeli!</h3>
                          <p className="text-slate-400 text-sm mb-2">Kami akan memberitahu saat siaran dimulai.</p>
                          <div className="bg-slate-800/50 rounded-xl p-3 mb-4">
                            <p className="text-xs text-slate-400">📬 Notifikasi akan masuk ke <strong className="text-amber-400">Warung Info</strong></p>
                          </div>
                          <button
                            onClick={() => {
                              setRedeemSuccess(false);
                              setShowConfirmModal(false);
                              setSelectedVoucher(null);
                              setRedeeming(false);
                              onClose();
                            }}
                            className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-white font-bold transition-colors"
                          >
                            🏠 Kembali ke Rumah Warga
                          </button>
                        </>
                      )}
                    </>
                  ) : selectedVoucher.type === 'physical' || !selectedVoucher.type ? (
                    // 🔥 PHYSICAL VOUCHER - TANPA QR CODE, LANGSUNG KE KTP
                    <>
                      <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                        <CheckCircle className="w-10 h-10 text-emerald-400" />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">✅ Voucher Berhasil Ditukar!</h3>
                      <p className="text-slate-400 text-sm mb-3">
                        Voucher "{selectedVoucher.name}" dari {selectedVoucher.merchant} siap diklaim.
                      </p>

                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-4">
                        <p className="text-xs text-amber-400 text-center">
                          🔑 Tunjukkan <strong>KTP Digital</strong> Anda ke merchant untuk klaim voucher.
                        </p>
                        <p className="text-[10px] text-slate-500 text-center mt-1">
                          Merchant akan scan QR Code KTP Anda
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={handleShowKTP}
                          className="py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white font-bold transition-colors"
                        >
                          📱 Tunjukkan KTP
                        </button>
                        <button
                          onClick={() => {
                            setRedeemSuccess(false);
                            setShowConfirmModal(false);
                            setSelectedVoucher(null);
                            setRedeeming(false);
                            onClose();
                          }}
                          className="py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-white font-bold transition-colors"
                        >
                          🏠 Kembali
                        </button>
                      </div>
                    </>
                  ) : (
                    // Voucher lainnya (video, subscription)
                    <>
                      <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                        <CheckCircle className="w-10 h-10 text-emerald-400" />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">✅ Berhasil!</h3>
                      <p className="text-slate-400 text-sm mb-4">Voucher berhasil ditukar!</p>
                      <button
                        onClick={() => {
                          setRedeemSuccess(false);
                          setShowConfirmModal(false);
                          setSelectedVoucher(null);
                          setRedeeming(false);
                          onClose();
                        }}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white font-bold transition-colors"
                      >
                        Tutup
                      </button>
                    </>
                  )}
                </div>
              ) : (
                // CONFIRMATION (tetap sama)
                <>
                  <div className="text-center mb-4">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                      {(() => {
                        const Icon = getIconComponent(selectedVoucher.icon);
                        return <Icon className="w-8 h-8 text-emerald-400" />;
                      })()}
                    </div>
                    <h3 className="text-lg font-bold text-white">Tukar Voucher</h3>
                    <p className="text-slate-400 text-sm mt-1">Kamu akan menukarkan poin untuk:</p>
                  </div>

                  <div className="bg-slate-800/50 rounded-xl p-4 mb-4">
                    <p className="text-center font-bold text-white">{selectedVoucher.name}</p>
                    <p className="text-center text-xs text-slate-400">{selectedVoucher.merchant}</p>

                    {selectedVoucher.type === 'live' && (
                      <div className="mt-2 p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                        <p className="text-center text-xs text-emerald-400 font-bold">✅ Beli sekarang, tonton saat siaran dimulai!</p>
                        <p className="text-center text-[9px] text-slate-500 mt-1">⏳ Notifikasi akan muncul saat live tayang</p>
                      </div>
                    )}

                    {selectedVoucher.type === 'video' && (
                      <div className="mt-2 p-2 bg-blue-500/10 rounded-lg">
                        <p className="text-center text-xs text-blue-400">🎬 Akses Video akan aktif selama 24 jam</p>
                      </div>
                    )}

                    {selectedVoucher.type === 'subscription' && (
                      <div className="mt-2 p-2 bg-purple-500/10 rounded-lg">
                        <p className="text-center text-xs text-purple-400">📅 Berlangganan aktif selama 30 hari</p>
                      </div>
                    )}

                    {(!selectedVoucher.type || selectedVoucher.type === 'physical') && (
                      <div className="mt-2 p-2 bg-amber-500/10 rounded-lg">
                        <p className="text-center text-xs text-amber-400">⏰ Berlaku 7 hari setelah tukar</p>
                      </div>
                    )}

                    <div className="flex justify-between mt-3 pt-3 border-t border-slate-700">
                      <span className="text-slate-400">Biaya</span>
                      <span className="text-emerald-400 font-bold">{selectedVoucher.points_required} Poin</span>
                    </div>
                    <div className="flex justify-between mt-2 pt-2 border-t border-slate-700/50">
                      <span className="text-slate-400 text-xs">Berlaku hingga</span>
                      <span className="text-amber-400 text-xs font-bold">
                        {(() => {
                          const expired = new Date();
                          if (selectedVoucher.type === 'live') {
                            expired.setHours(expired.getHours() + 24);
                            return expired.toLocaleString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            });
                          } else if (selectedVoucher.type === 'video') {
                            expired.setDate(expired.getDate() + 1);
                          } else if (selectedVoucher.type === 'subscription') {
                            expired.setDate(expired.getDate() + 30);
                          } else {
                            expired.setDate(expired.getDate() + 7);
                          }
                          return expired.toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          });
                        })()}
                      </span>
                    </div>

                    {selectedVoucher.type === 'live' && (
                      <p className="text-[9px] text-emerald-400/70 text-center mt-2 flex items-center justify-center gap-1">
                        <Bell className="w-3 h-3" /> Kamu akan mendapat notifikasi saat live dimulai
                      </p>
                    )}
                    {selectedVoucher.type === 'video' && (
                      <p className="text-[9px] text-blue-400/70 text-center mt-2">🎬 Akses video akan aktif segera setelah konfirmasi</p>
                    )}
                    {selectedVoucher.type === 'subscription' && (
                      <p className="text-[9px] text-purple-400/70 text-center mt-2">📅 Berlangganan akan aktif segera setelah konfirmasi</p>
                    )}
                    {(!selectedVoucher.type || selectedVoucher.type === 'physical') && (
                      <p className="text-[9px] text-amber-400/70 text-center mt-2">⚠️ Voucher akan kadaluarsa dalam 7 hari jika tidak diklaim</p>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      disabled={redeeming}
                      onClick={() => setShowConfirmModal(false)}
                      className="flex-1 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold rounded-xl transition-colors disabled:opacity-50"
                    >
                      Batal
                    </button>
                    <button
                      onClick={handleRedeem}
                      disabled={redeeming}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-colors flex items-center justify-center disabled:opacity-50"
                    >
                      {redeeming ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Memproses...
                        </>
                      ) : (
                        "Ya, Tukar"
                      )}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}  