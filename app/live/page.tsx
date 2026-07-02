"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, VideoOff, Lock, Crown, RefreshCw, AlertCircle, Clock, Bell, Volume2, Send } from "lucide-react";
import Hls from "hls.js";
import { supabase } from "@/lib/supabaseClient";
import { checkStreamIsLive } from "@/lib/checkLiveStatus";

const LIVE_INPUT_ID = process.env.NEXT_PUBLIC_CLOUDFLARE_LIVE_INPUT_ID || "";
const STREAM_URL = `https://videodelivery.net/${LIVE_INPUT_ID}/manifest/video.m3u8`;

// ==================== TYPES ====================
interface Comment {
  id: number | string;
  user_id?: string;
  user_name: string;
  avatar_url: string | null;
  comment: string;
  created_at: string;
}

interface Profile {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  role: string;
  points: number;
  saldo: number;
}

export default function LivePage() {
  const router = useRouter();

  // ===== REFS =====
  const videoRef = useRef<HTMLVideoElement>(null);
  const commentContainerRef = useRef<HTMLDivElement>(null);
  const isMounted = useRef(true);
  const hlsRef = useRef<Hls | null>(null);
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previewIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pendingCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const viewersIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const previewStartedRef = useRef(false);
  const accessCheckedRef = useRef(false);
  const pendingCommentIds = useRef<Set<string>>(new Set());
  const liveCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const videoErrorRef = useRef<string | null>(null);

  const isPurchasingPointsRef = useRef(false);
  const isPurchasingSaldoRef = useRef(false);

  // ===== CORE STATES =====
  const [isLiveActive, setIsLiveActive] = useState<boolean | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [viewers, setViewers] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 🔥 DEFAULT COVER AGAR FULL SCREEN
  const [videoFit, setVideoFit] = useState<'cover' | 'contain'>('cover');

  // ===== USER STATES =====
  const [userData, setUserData] = useState<Profile | null>(null);
  const [userPoints, setUserPoints] = useState(0);
  const [userSaldo, setUserSaldo] = useState(0);

  // ===== COMMENTS =====
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isCommentLoading, setIsCommentLoading] = useState(true);

  // ===== PREVIEW =====
  const [isPreview, setIsPreview] = useState(false);
  const [previewTimer, setPreviewTimer] = useState(60);
  const [previewEnded, setPreviewEnded] = useState(false);

  // ===== PURCHASE =====
  const [isPurchasingPoints, setIsPurchasingPoints] = useState(false);
  const [isPurchasingSaldo, setIsPurchasingSaldo] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  // ===== 🔥 STATE UNTUK OFF AIR =====
  const [hasPendingAccess, setHasPendingAccess] = useState(false);

  // ==================== HELPERS ====================
  const getAvatarUrl = useCallback((avatarUrl: string | null, name: string | null) => {
    if (avatarUrl) return avatarUrl;
    const displayName = name || 'Warga';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random&size=32&bold=true&rounded=true`;
  }, []);

  const clearAllIntervals = useCallback(() => {
    if (previewIntervalRef.current) clearInterval(previewIntervalRef.current);
    if (pendingCheckIntervalRef.current) clearInterval(pendingCheckIntervalRef.current);
    if (viewersIntervalRef.current) clearInterval(viewersIntervalRef.current);
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    if (liveCheckIntervalRef.current) clearInterval(liveCheckIntervalRef.current);

    previewIntervalRef.current = null;
    pendingCheckIntervalRef.current = null;
    viewersIntervalRef.current = null;
    loadTimeoutRef.current = null;
    liveCheckIntervalRef.current = null;
  }, []);

  // ==================== 🔥 CEK AKSES USER ====================
  const checkUserHasPendingAccess = useCallback(async (userId: string): Promise<boolean> => {
    if (!userId) return false;

    try {
      const { data: vouchers } = await supabase
        .from("vouchers")
        .select("id")
        .eq("type", "live")
        .eq("is_active", true);

      if (!vouchers || vouchers.length === 0) {
        console.warn("Tidak ada voucher live aktif");
        return false;
      }

      const voucherIds = vouchers.map(v => v.id);

      const { data } = await supabase
        .from("voucher_transactions")
        .select("status, expired_at")
        .eq("user_id", userId)
        .in("voucher_id", voucherIds)
        .in("status", ["pending", "active"])
        .gt("expired_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      console.log("📊 Access check result:", data);
      return !!data;
    } catch (err) {
      console.error("Error checking user access:", err);
      return false;
    }
  }, []);

  // ==================== 🔥 EFFECT UNTUK CEK PENDING ACCESS ====================
  useEffect(() => {
    const checkPending = async () => {
      console.log("🔍 userData.id:", userData?.id);
      if (userData?.id) {
        const result = await checkUserHasPendingAccess(userData.id);
        console.log("📊 HasPendingAccess result:", result);
        setHasPendingAccess(result);
      }
    };
    checkPending();
  }, [userData?.id, checkUserHasPendingAccess]);

  // ==================== GRANT ACCESS FUNCTION ====================
  const grantAccess = useCallback(() => {
    setHasAccess(true);
    setPreviewEnded(false);
    setIsPreview(false);
    setIsMuted(false);
    previewStartedRef.current = false;
    sessionStorage.removeItem('live_access_pending');
    sessionStorage.removeItem('live_purchased_pending');
    sessionStorage.removeItem('live_purchase_time');

  }, []);

  // ==================== AUTH & PROFILE ====================
  const checkAuth = useCallback(async (): Promise<Profile | null> => {
    // 🔥 Cek cache dulu
    const cached = sessionStorage.getItem('user_profile');
    if (cached) {
      try {
        const profile = JSON.parse(cached);
        setUserData(profile);
        setUserPoints(profile.points || 0);
        setUserSaldo(profile.saldo || 0);
        return profile;
      } catch { /* ignore */ }
    }

    try {
      // 🔥 Gunakan getSession() sekali saja
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        console.warn('No session found');
        return null;
      }

      // 🔥 Ambil profile dengan select spesifik
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, role, points, saldo')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profileError || !profile) {
        const fallback: Profile = {
          id: session.user.id,
          full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || "Warga",
          username: session.user.user_metadata?.username || session.user.email?.split('@')[0] || null,
          avatar_url: session.user.user_metadata?.avatar_url || null,
          role: 'warga',
          points: 0,
          saldo: 0
        };
        setUserData(fallback);
        return fallback;
      }

      // 🔥 Cache profile
      sessionStorage.setItem('user_profile', JSON.stringify(profile));
      setUserData(profile);
      setUserPoints(profile.points || 0);
      setUserSaldo(profile.saldo || 0);
      return profile;
    } catch (err) {
      console.error('Error checking auth:', err);
      return null;
    }
  }, []);

  // ==================== LIVE STATUS ====================
  const checkLiveStatus = useCallback(async (): Promise<boolean> => {
    if (!STREAM_URL || !LIVE_INPUT_ID) {
      console.error('No STREAM_URL or LIVE_INPUT_ID configured');
      return false;
    }

    // 🔥 Cek cache dulu (2 detik)
    const cached = sessionStorage.getItem('live_status');
    const cachedTime = sessionStorage.getItem('live_status_time');
    if (cached && cachedTime) {
      const elapsed = Date.now() - parseInt(cachedTime);
      if (elapsed < 2000) {
        return cached === 'true';
      }
    }

    try {
      // 🔥 PAKAI HELPER YANG SUDAH TERBUKTI
      const isLive = await checkStreamIsLive(STREAM_URL);

      sessionStorage.setItem('live_status', String(isLive));
      sessionStorage.setItem('live_status_time', String(Date.now()));

      console.log(`📡 Live status: ${isLive ? 'ON AIR' : 'OFF AIR'}`);
      return isLive;
    } catch (err) {
      console.warn('Live status check error:', err);
      sessionStorage.setItem('live_status', 'false');
      sessionStorage.setItem('live_status_time', String(Date.now()));
      return false;
    }
  }, []);

  // ==================== PREMIUM MODE ====================
  const checkStreamMode = useCallback(async (): Promise<boolean> => {
    const cached = sessionStorage.getItem('premium_mode');
    if (cached) return cached === 'true';

    try {
      const res = await fetch('/api/live-mode', {
        signal: AbortSignal.timeout(3000)
      });
      if (!res.ok) return false;
      const data = await res.json();
      const isPremiumMode = data?.mode === 'premium';
      sessionStorage.setItem('premium_mode', String(isPremiumMode));
      return isPremiumMode;
    } catch {
      return false;
    }
  }, []);

  // ==================== VOUCHER HELPERS ====================
  const getVoucherIds = useCallback(async (): Promise<{ points: string | null; saldo: string | null }> => {
    const { data: vouchers } = await supabase
      .from("vouchers")
      .select("id, code")
      .in("code", ["live_access_points", "live_access_saldo"]);

    const pointsVoucher = vouchers?.find(v => v.code === "live_access_points");
    const saldoVoucher = vouchers?.find(v => v.code === "live_access_saldo");

    return {
      points: pointsVoucher?.id || null,
      saldo: saldoVoucher?.id || null
    };
  }, []);

  // ==================== ACTIVATE TRANSACTION ====================
  const activateTransaction = useCallback(async (transactionId: string, accessData: any) => {
    try {
      await supabase
        .from("voucher_transactions")
        .update({
          status: "active",
          access_data: {
            ...accessData,
            activated_at: new Date().toISOString()
          }
        })
        .eq("id", transactionId);

      const { data: existing } = await supabase
        .from("warung_info")
        .select("id")
        .eq("metadata->>transaction_id", transactionId)
        .eq("type", "live_active")
        .maybeSingle();

      if (!existing && userData?.id) {
        await supabase
          .from("warung_info")
          .insert({
            user_id: userData?.id,
            title: "🔴 Siaran Live Dimulai!",
            message: "Akses live Anda sekarang aktif! Klik untuk menonton.",
            type: "live_active",
            is_read: false,
            created_at: new Date().toISOString(),
            metadata: {
              redirect_url: "/live",
              transaction_id: transactionId
            }
          });
      }

      grantAccess();
    } catch (err) {
      console.error('Error activating transaction:', err);
    }
  }, [userData?.id, grantAccess]);

  // ==================== CHECK USER ACCESS ====================
  const checkUserAccess = useCallback(async (userId: string): Promise<boolean> => {
    if (!userId) return false;

    try {
      const { data: vouchers } = await supabase
        .from("vouchers")
        .select("id")
        .eq("type", "live")
        .eq("is_active", true);

      if (!vouchers || vouchers.length === 0) {
        console.warn("Tidak ada voucher live aktif");
        return false;
      }

      const voucherIds = vouchers.map(v => v.id);
      console.log("🔍 Checking access with voucher IDs:", voucherIds);

      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from("voucher_transactions")
        .select("id, status, expired_at, access_data")
        .eq("user_id", userId)
        .in("voucher_id", voucherIds)
        .in("status", ["pending", "active"])
        .gte("expired_at", now)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error checking access:", error);
        return false;
      }

      console.log("📊 User access data:", data);

      if (!data) {
        console.log("❌ No active transaction found");
        return false;
      }

      if (data.status === "pending") {
        console.log("⏳ Transaction is pending, activating...");
        const isLive = await checkLiveStatus();
        if (isLive) {
          await activateTransaction(data.id, data.access_data);
          return true;
        }
        return false;
      }

      if (data.status === "active") {
        console.log("✅ Transaction is active, granting access");
        grantAccess();
        return true;
      }

      return false;
    } catch (err) {
      console.error("Error checking live access:", err);
      return false;
    }
  }, [checkLiveStatus, activateTransaction, grantAccess]);

  // ==================== CHECK PENDING TRANSACTIONS ====================
  const checkPendingTransactions = useCallback(async () => {
    if (!userData?.id || !isLiveActive) return;

    try {
      const { points: pointsVoucherId, saldo: saldoVoucherId } = await getVoucherIds();
      const voucherIds = [pointsVoucherId, saldoVoucherId].filter(Boolean) as string[];
      if (voucherIds.length === 0) return;

      const { data: pendingTransactions } = await supabase
        .from("voucher_transactions")
        .select("id, access_data")
        .in("voucher_id", voucherIds)
        .eq("status", "pending")
        .eq("user_id", userData.id);

      if (!pendingTransactions || pendingTransactions.length === 0) return;

      for (const transaction of pendingTransactions) {
        await activateTransaction(transaction.id, transaction.access_data);
      }
    } catch (err) {
      console.error("Error checking pending transactions:", err);
    }
  }, [userData?.id, isLiveActive, getVoucherIds, activateTransaction]);

  // ==================== PREVIEW TIMER ====================
  const startPreview = useCallback((duration: number) => {
    if (previewStartedRef.current) return;
    previewStartedRef.current = true;

    if (previewIntervalRef.current) clearInterval(previewIntervalRef.current);

    setIsPreview(true);
    setPreviewEnded(false);
    setPreviewTimer(duration);
    setIsMuted(false);

    previewIntervalRef.current = setInterval(() => {
      setPreviewTimer(prev => {
        if (prev <= 1) {
          if (previewIntervalRef.current) clearInterval(previewIntervalRef.current);
          previewIntervalRef.current = null;
          setIsPreview(false);
          setPreviewEnded(true);
          setIsMuted(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // ==================== REFRESH POINTS ====================
  const refreshUserPoints = useCallback(async () => {
    if (!userData?.id) return;
    try {
      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("points, saldo")
        .eq("id", userData.id)
        .maybeSingle();

      if (profileError || !data) return;

      setUserPoints(data.points || 0);
      setUserSaldo(data.saldo || 0);

      const cached = sessionStorage.getItem('user_profile');
      if (cached) {
        const profile = JSON.parse(cached);
        sessionStorage.setItem('user_profile', JSON.stringify({
          ...profile,
          points: data.points || 0,
          saldo: data.saldo || 0
        }));
      }
    } catch (err) {
      console.error("Error refreshing points:", err);
    }
  }, [userData]);

  // ==================== TOAST HELPER ====================
  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ==================== PURCHASE ACCESS ====================
  const handlePurchase = useCallback(async (method: 'points' | 'saldo') => {
    if (!userData) return;

    // 🔥 SET STATE SESUAI METODE
    if (method === 'points') {
      isPurchasingPointsRef.current = true;
      setIsPurchasingPoints(true);
    } else {
      isPurchasingSaldoRef.current = true;
      setIsPurchasingSaldo(true);
    }

    const cost = method === 'points' ? 10 : 5000;
    const hasBalance = method === 'points' ? userPoints >= cost : userSaldo >= cost;

    if (!hasBalance) {
      setPurchaseError(`${method === 'points' ? 'Poin' : 'Saldo'} tidak cukup!`);
      showToast('error', `${method === 'points' ? 'Poin' : 'Saldo'} tidak cukup!`);
      setTimeout(() => {
        router.push('/rumah-warga?modal=saldo');
      }, 1800);
      // 🔥 RESET STATE
      if (method === 'points') isPurchasingPointsRef.current = false;
      else isPurchasingSaldoRef.current = false;
      return;
    }

    setPurchaseError(null);

    try {
      const voucherCode = method === 'points' ? "live_access_points" : "live_access_saldo";
      const { data: voucher, error: voucherError } = await supabase
        .from("vouchers")
        .select("id")
        .eq("code", voucherCode)
        .single();

      if (voucherError || !voucher) throw new Error("Voucher tidak ditemukan");

      const update = method === 'points'
        ? { points: userPoints - cost }
        : { saldo: userSaldo - cost };

      const { error: updateError } = await supabase
        .from("profiles")
        .update(update)
        .eq("id", userData.id);

      if (updateError) throw updateError;

      if (method === 'points') {
        setUserPoints(prev => prev - cost);
      } else {
        setUserSaldo(prev => prev - cost);
      }

      const updatedProfile = {
        ...userData,
        points: method === 'points' ? userPoints - cost : userPoints,
        saldo: method === 'saldo' ? userSaldo - cost : userSaldo
      };
      sessionStorage.setItem('user_profile', JSON.stringify(updatedProfile));

      const isLive = await checkLiveStatus();
      const status = isLive ? "active" : "pending";
      const expiredAt = new Date();
      expiredAt.setHours(expiredAt.getHours() + 24);

      const { data: transaction, error: insertError } = await supabase
        .from("voucher_transactions")
        .insert({
          user_id: userData.id,
          voucher_id: voucher.id,
          status: status,
          access_method: method,
          amount: method === 'saldo' ? cost : null,
          points_spent: method === 'points' ? cost : null,
          claimed_at: new Date().toISOString(),
          expired_at: expiredAt.toISOString(),
          access_data: {
            type: 'live',
            stream_id: LIVE_INPUT_ID,
            purchased_at: new Date().toISOString(),
            activated_at: isLive ? new Date().toISOString() : null,
            expires_at: expiredAt.toISOString()
          }
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // 🔥 TAMBAHKAN TOAST SUKSES
      if (isLive) {
        showToast('success', '✅ Akses Live berhasil! Selamat menonton! 🎉');

        grantAccess();
        await supabase.from("warung_info").insert({
          user_id: userData.id,
          title: "🔴 Akses Live Aktif",
          message: "Akses Live berhasil! Nikmati tontonan premium Anda.",
          type: "live_active",
          is_read: false,
          created_at: new Date().toISOString(),
          metadata: { redirect_url: "/live", transaction_id: transaction.id }
        });
      } else {
        showToast('success', '✅ Akses Live dibeli! Tunggu notifikasi saat live dimulai. 📢');

        sessionStorage.setItem('live_access_pending', 'true');
        sessionStorage.setItem('live_purchased_pending', 'true');
        sessionStorage.setItem('live_purchase_time', String(Date.now()));

        await supabase.from("warung_info").insert({
          user_id: userData.id,
          title: "✅ Akses Live Dibeli!",
          message: "Akses Berhasil dibeli. Notifikasi akan dikirim saat siaran dimulai.",
          type: "live_pending",
          is_read: false,
          created_at: new Date().toISOString(),
          metadata: { redirect_url: "/live", transaction_id: transaction.id }
        });
      }
    } catch (error) {
      console.error('Purchase error:', error);

      // 🔥 ROLLBACK
      try {
        const rollback = method === 'points'
          ? { points: userPoints }
          : { saldo: userSaldo };
        await supabase
          .from('profiles')
          .update(rollback)
          .eq('id', userData!.id);
        if (method === 'points') {
          setUserPoints(userPoints);
        } else {
          setUserSaldo(userSaldo);
        }
      } catch (rollbackErr) {
        console.error('Rollback failed:', rollbackErr);
      }

      showToast('error', '❌ Gagal membeli akses. Silakan coba lagi.');
      setPurchaseError('Gagal memproses transaksi. Silakan hubungi admin.');
    } finally {
      // 🔥 RESET STATE
      if (method === 'points') setIsPurchasingPoints(false);
      else setIsPurchasingSaldo(false);
    }
  }, [userData, isPurchasingPoints, isPurchasingSaldo, userPoints, userSaldo, checkLiveStatus, router, grantAccess, showToast]);

  // ==================== COMMENTS ====================
  const loadComments = useCallback(async () => {
    try {
      setIsCommentLoading(true);
      const { data: commentsData } = await supabase
        .from("live_comments")
        .select("id, user_id, user_name, comment, created_at")
        .eq("stream_id", LIVE_INPUT_ID)
        .order("created_at", { ascending: false })
        .limit(40);

      if (!commentsData) return;

      const formatted = commentsData.map(item => ({
        id: item.id,
        user_id: item.user_id || '',
        user_name: item.user_name || "Warga",
        avatar_url: null,
        comment: item.comment || "",
        created_at: item.created_at
      })).reverse();

      setComments(formatted);
    } catch (error) {
      console.error('Comments load error:', error);
    } finally {
      setIsCommentLoading(false);
    }
  }, []);

  const handleSendComment = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const text = newComment.trim();
    if (!text || !userData || !isLiveActive || (isPremium && !hasAccess)) return;

    setNewComment("");
    const tempId = `temp-${Date.now()}`;

    const tempComment: Comment = {
      id: tempId,
      user_id: userData.id,
      user_name: userData.full_name || userData.username || "Warga",
      avatar_url: userData.avatar_url,
      comment: text,
      created_at: new Date().toISOString()
    };

    pendingCommentIds.current.add(tempId);
    setComments(prev => [...prev, tempComment].slice(-40));

    try {
      const { data, error: insertErr } = await supabase
        .from("live_comments")
        .insert({
          user_id: userData.id,
          user_name: userData.full_name || userData.username || "Warga",
          comment: text,
          stream_id: LIVE_INPUT_ID
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      if (data?.id) {
        pendingCommentIds.current.delete(tempId);
        setComments(prev => prev.map(c => c.id === tempId ? { ...c, id: data.id } : c));
      }
    } catch (error) {
      console.error('Send comment error:', error);
      pendingCommentIds.current.delete(tempId);
      setComments(prev => prev.filter(c => c.id !== tempId));
      setNewComment(text);
    }
  }, [newComment, userData, isLiveActive, isPremium, hasAccess]);

  // app/live/page.tsx

  // ==================== VIDEO PLAYER ====================
  const initVideoPlayer = useCallback(async (retryCount = 0) => {
    const video = videoRef.current;
    if (!video || !STREAM_URL || !isLiveActive || isLoading) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);

    try {
      setIsVideoReady(false);
      setIsVideoLoading(true); // 🔥 MULAI LOADING
      setVideoError(null);
      videoErrorRef.current = null;

      const HlsClass = (await import('hls.js')).default;

      const setFullScreen = () => {
        setVideoFit('cover');
      };

      const handleResize = () => {
        setTimeout(setFullScreen, 100);
      };

      if (!HlsClass.isSupported()) {
        video.src = STREAM_URL;
        video.load();
        video.oncanplay = () => {
          if (isMounted.current) {
            setIsVideoReady(true);
            setIsVideoLoading(false); // 🔥 SELESAI LOADING
            setFullScreen();
            video.play().catch(() => { });
          }
        };
        video.onerror = () => {
          if (isMounted.current) {
            const errorMsg = 'Perangkat tidak mendukung enkapsulasi video stream.';
            setVideoError(errorMsg);
            videoErrorRef.current = errorMsg;
          }
        };
        return;
      }

      const hls = new HlsClass({
        enableWorker: true,
        lowLatencyMode: true,
        maxBufferLength: 30,
        backBufferLength: 10,
        manifestLoadingMaxRetry: 5,
        manifestLoadingRetryDelay: 1500,
        fragLoadingMaxRetry: 6,
        fragLoadingRetryDelay: 1000,
        manifestLoadingTimeOut: 10000,
        fragLoadingTimeOut: 10000,
        maxMaxBufferLength: 60,
        startLevel: -1,
        abrEwmaDefaultEstimate: 2000000,
        abrBandWidthFactor: 0.8,
        abrBandWidthUpFactor: 0.5,
      });

      hlsRef.current = hls;
      hls.loadSource(STREAM_URL);
      hls.attachMedia(video);

      // 🔥 LISTENER UNTUK VIDEO PLAYING
      const handlePlaying = () => {
        if (isMounted.current) {
          setIsVideoLoading(false); // 🔥 VIDEO BENAR-BENAR PLAY
          setIsVideoReady(true);
          console.log('🎬 Video playing - loading selesai');
        }
      };

      const handleWaiting = () => {
        if (isMounted.current) {
          setIsVideoLoading(true); // 🔥 VIDEO BUFFERING
          console.log('⏳ Video buffering...');
        }
      };

      video.addEventListener('playing', handlePlaying);
      video.addEventListener('waiting', handleWaiting);

      hls.on(HlsClass.Events.MANIFEST_PARSED, () => {
        if (isMounted.current) {
          setVideoError(null);
          videoErrorRef.current = null;
          setFullScreen();
          video.play().catch(() => console.log('Autoplay blocked'));
        }
      });

      hls.on(HlsClass.Events.LEVEL_LOADED, () => {
        setTimeout(setFullScreen, 100);
      });

      // 🔥 FRAG_LOADED - SEBAGAI FALLBACK
      let fragLoadedCount = 0;
      hls.on(HlsClass.Events.FRAG_LOADED, () => {
        fragLoadedCount++;
        if (fragLoadedCount >= 2 && isMounted.current && isVideoLoading) {
          // 🔥 FALLBACK: Jika 2 fragment sudah dimuat tapi masih loading
          setIsVideoLoading(false);
          setIsVideoReady(true);
          console.log('📦 Fallback: fragment loaded, loading selesai');
        }
      });

      // 🔥 Handle error dengan retry
      hls.on(HlsClass.Events.ERROR, (_, data) => {
        if (!isMounted.current) return;

        if (data.fatal) {
          switch (data.type) {
            case HlsClass.ErrorTypes.NETWORK_ERROR:
              if (retryCount < 3) {
                console.log(`🔄 Retry video (${retryCount + 1}/3)...`);
                setTimeout(() => {
                  initVideoPlayer(retryCount + 1);
                }, 2000 * (retryCount + 1));
              } else {
                const errorMsg = 'Koneksi bermasalah. Silakan refresh halaman.';
                setVideoError(errorMsg);
                videoErrorRef.current = errorMsg;
                setIsVideoLoading(false);
              }
              break;
            case HlsClass.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              const errorMsg = 'Koneksi penyiaran terputus.';
              setVideoError(errorMsg);
              videoErrorRef.current = errorMsg;
              setIsVideoReady(false);
              setIsVideoLoading(false);
              break;
          }
        }
      });

      // 🔥 Timeout handler
      loadTimeoutRef.current = setTimeout(() => {
        if (isMounted.current && !video.currentTime && !videoErrorRef.current) {
          console.warn('⏳ Video loading timeout, retrying...');
          if (retryCount < 3) {
            initVideoPlayer(retryCount + 1);
          } else {
            const errorMsg = 'Memuat siaran lambat, silakan refresh halaman.';
            setVideoError(errorMsg);
            videoErrorRef.current = errorMsg;
            setIsVideoLoading(false);
          }
        }
      }, 15000);

      // Event listeners untuk resize
      const handleLoadedMetadata = () => setTimeout(setFullScreen, 50);
      const handleLoadedData = () => setTimeout(setFullScreen, 50);

      video.addEventListener("loadedmetadata", handleLoadedMetadata);
      video.addEventListener("loadeddata", handleLoadedData);
      window.addEventListener("resize", handleResize);

      return () => {
        video.removeEventListener("loadedmetadata", handleLoadedMetadata);
        video.removeEventListener("loadeddata", handleLoadedData);
        video.removeEventListener('playing', handlePlaying);
        video.removeEventListener('waiting', handleWaiting);
        window.removeEventListener("resize", handleResize);
      };

    } catch (error) {
      console.error('HLS Init Error:', error);
      if (isMounted.current) {
        const errorMsg = 'Modul pemutar gagal dikonfigurasi.';
        setVideoError(errorMsg);
        videoErrorRef.current = errorMsg;
        setIsVideoLoading(false);
      }
    }
  }, [isLiveActive, isLoading]);

  const updateViewers = useCallback(() => {
    setViewers(prev => {
      const change = Math.random() > 0.5 ? 1 : -1;
      return Math.max(12, Math.min(85, prev + change));
    });
  }, []);

  // ==================== EFFECTS INITIALIZATION ====================
  useEffect(() => {
    isMounted.current = true;
    previewStartedRef.current = false;

    const initPage = async () => {
      try {
        setIsLoading(true);
        setError(null);
        accessCheckedRef.current = false;

        // 🔥 CEK CACHE DULU
        const cachedStatus = sessionStorage.getItem('live_status');
        const cachedTime = sessionStorage.getItem('live_status_time');
        let isLive = false;
        let useCache = false;

        if (cachedStatus && cachedTime) {
          const elapsed = Date.now() - parseInt(cachedTime);
          if (elapsed < 5000) { // 5 detik cache
            isLive = cachedStatus === 'true';
            useCache = true;
            console.log(`📦 Using cached live status: ${isLive ? 'ON AIR' : 'OFF AIR'}`);
          }
        }

        if (useCache) {
          if (!isLive) {
            setIsLiveActive(false);
            setIsLoading(false);
            accessCheckedRef.current = true;

            // 🔥 Tetap cek di background
            checkLiveStatus().then((result) => {
              if (result && isMounted.current) {
                // 🔥 CEK STATE PEMBELIAN
                if (!isPurchasingPoints && !isPurchasingSaldo) {
                  window.location.reload();
                }
              }
            });
            return;
          }
        } else {
          isLive = await checkLiveStatus();
        }

        if (!isMounted.current) return;

        if (!isLive) {
          setIsLiveActive(false);
          setIsLoading(false);
          accessCheckedRef.current = true;

          // 🔥 Interval cek tiap 30 detik - TANPA RELOAD
          liveCheckIntervalRef.current = setInterval(async () => {
            const stillLive = await checkLiveStatus();
            if (stillLive && isMounted.current) {
              clearInterval(liveCheckIntervalRef.current);

              // 🔥 CEK STATE PEMBELIAN - JANGAN RELOAD JIKA SEDANG MEMBELI
              if (!isPurchasingPointsRef.current && !isPurchasingSaldoRef.current) {
                window.location.reload();
              } else {
                // 🔥 KALAU SEDANG MEMBELI, TUNGGU SAMPAI SELESAI
                console.log('⏳ Menunggu pembelian selesai sebelum reload...');
                // Cek lagi dalam 5 detik
                setTimeout(async () => {
                  if (isMounted.current && !isPurchasingPoints && !isPurchasingSaldo) {
                    window.location.reload();
                  }
                }, 5000);
              }
            }
          }, 30000);

          return;
        }

        setIsLiveActive(true);

        const [isPremiumMode, profile] = await Promise.all([
          checkStreamMode(),
          checkAuth()
        ]);

        if (!isMounted.current) return;
        setIsPremium(isPremiumMode);

        if (!isPremiumMode) {
          setHasAccess(true);
          previewStartedRef.current = true;
        } else if (profile) {
          const hasValidAccess = await checkUserAccess(profile.id);
          if (hasValidAccess) grantAccess();
        } else {
          setHasAccess(false);
        }

        accessCheckedRef.current = true;
        setViewers(Math.floor(Math.random() * 15) + 20);

        viewersIntervalRef.current = setInterval(updateViewers, 12000);
        pendingCheckIntervalRef.current = setInterval(checkPendingTransactions, 10000);

      } catch (err) {
        console.error('Init global error:', err);
        setError('Inisialisasi sistem gagal.');
      } finally {
        if (isMounted.current) setIsLoading(false);
      }
    };

    initPage();

    return () => {
      isMounted.current = false;
      clearAllIntervals();
    };
  }, [
    checkLiveStatus,
    checkStreamMode,
    checkAuth,
    checkUserAccess,
    checkPendingTransactions,
    updateViewers,
    clearAllIntervals,
    grantAccess,
  ]);

  // EFFECT: PREVIEW HANDLER
  useEffect(() => {
    if (isLoading || !isLiveActive || !accessCheckedRef.current || hasAccess || previewEnded || isPreview || previewStartedRef.current) return;
    const duration = isPremium ? 60 : 5;
    startPreview(duration);
  }, [isLoading, isLiveActive, hasAccess, isPremium, previewEnded, isPreview, startPreview]);

  // EFFECT: VIDEO ATTACHMENT

  useEffect(() => {
    if (!isLiveActive ||
      isLoading) return;
    let listenerCleanup:
      (() => void) | undefined;
    initVideoPlayer().then(fn => {
      listenerCleanup = fn;
    });

    return () => {
      listenerCleanup?.();
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = '';
        videoRef.current.load();
      }
    };
  }, [isLiveActive, isLoading,
    initVideoPlayer]);

  // EFFECT: REALTIME COMMENTS SYSTEM
  useEffect(() => {
    if (!isLiveActive || isLoading) return;

    loadComments();

    const channel = supabase
      .channel(`live_comments:${LIVE_INPUT_ID}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "live_comments",
        filter: `stream_id=eq.${LIVE_INPUT_ID}`,
      }, (payload) => {
        const newComm = payload.new as any;
        if (!newComm?.comment || !isMounted.current) return;

        const commentId = String(newComm.id);
        if (pendingCommentIds.current.has(commentId)) return;

        const incomingComment: Comment = {
          id: newComm.id,
          user_id: newComm.user_id,
          user_name: newComm.user_name || "Warga",
          avatar_url: null,
          comment: newComm.comment,
          created_at: newComm.created_at
        };

        setComments(prev => {
          if (prev.some(c => String(c.id) === commentId)) return prev;
          return [...prev, incomingComment].slice(-40);
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isLiveActive, isLoading, loadComments]);

  // EFFECT: AUTO SCROLL SMOOTH
  useEffect(() => {
    if (commentContainerRef.current) {
      commentContainerRef.current.scrollTo({
        top: commentContainerRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [comments]);

  // EFFECT: WINDOW FOCUS RE-VALIDATION
  useEffect(() => {
    if (!userData?.id || !isLiveActive) return;

    const handleFocus = async () => {
      await refreshUserPoints();
      const hasValidAccess = await checkUserAccess(userData.id);
      if (hasValidAccess) grantAccess();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [userData?.id, isLiveActive, refreshUserPoints, checkUserAccess, grantAccess]);

  // ==================== RENDER VIEWS ====================

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-neutral-950 flex items-center justify-center z-[100]">
        <div className="w-full max-w-[420px] h-full flex flex-col items-center justify-center p-6">
          <div className="relative w-12 h-12 flex items-center justify-center">
            <div className="absolute inset-0 border-4 border-neutral-800 rounded-full" />
            <div className="absolute inset-0 border-4 border-t-red-500 rounded-full animate-spin" />
          </div>
          <p className="text-[11px] text-neutral-400 mt-4 tracking-widest font-semibold uppercase">Menghubungkan ke Siaran...</p>
          {/* 🔥 TAMBAHKAN INI */}
          <p className="text-[9px] text-neutral-600 mt-2">
            Sabar ya! ini mungkin memakan waktu beberapa detik
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-neutral-950 flex items-center justify-center z-[100]">
        <div className="w-full h-full max-w-[420px] bg-neutral-900 border-x border-neutral-800 flex flex-col items-center justify-center p-6 mx-auto text-center">
          <AlertCircle size={44} className="text-red-500 mb-3" />
          <h2 className="text-white font-bold text-base tracking-tight">Gangguan Sistem</h2>
          <p className="text-neutral-400 text-xs mt-2 max-w-[260px] leading-relaxed">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 px-5 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-medium rounded-full border border-neutral-700 transition flex items-center gap-2"
          >
            <RefreshCw size={14} /> Muat Ulang Halaman
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // ============ TAMPILAN OFF AIR / WAITING ============
  // ============================================================
  if (isLiveActive === false) {
    return (
      <div className="fixed inset-0 bg-neutral-950 flex items-center justify-center z-[100]">
        <div className="w-full h-full max-w-[420px] bg-neutral-950 border-x border-neutral-900 flex flex-col justify-between p-6 mx-auto relative">

          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white transition mt-2"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="flex flex-col items-center text-center my-auto">
            {hasPendingAccess ? (
              <>
                <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center text-amber-400 mb-4 shadow-xl">
                  <Clock size={28} />
                </div>
                <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold px-2.5 py-1 rounded-full uppercase tracking-wider mb-2">
                  Menunggu Siaran
                </span>
                <h2 className="text-white font-bold text-lg tracking-tight">⏳ Siaran Belum Dimulai</h2>
                <p className="text-neutral-400 text-xs mt-1.5 max-w-[250px] leading-relaxed">
                  Anda sudah memiliki akses. Kami akan memberi tahu saat siaran dimulai.
                </p>
                <div className="mt-4 bg-neutral-900/50 border border-neutral-800 rounded-xl p-3 w-full max-w-xs">
                  <div className="flex justify-between text-xs text-neutral-400">
                    <span>Status</span>
                    <span className="text-amber-400 font-bold">Menunggu Siaran</span>
                  </div>
                  <div className="flex justify-between text-xs text-neutral-400 mt-1 pt-1 border-t border-neutral-800">
                    <span>Notifikasi</span>
                    <span className="text-emerald-400 text-[10px] flex items-center gap-1">
                      <Bell size={12} /> Akan dikirim saat live
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-neutral-900 border border-neutral-800 rounded-2xl flex items-center justify-center text-neutral-500 mb-4 shadow-xl">
                  <VideoOff size={28} />
                </div>
                <span className="text-[10px] bg-neutral-900 text-neutral-400 border border-neutral-800 font-bold px-2.5 py-1 rounded-full uppercase tracking-wider mb-2">
                  Offline
                </span>
                <h2 className="text-white font-bold text-lg tracking-tight">Siaran Belum Dimulai</h2>
                <p className="text-neutral-500 text-xs mt-1.5 max-w-[250px] leading-relaxed">
                  Belum ada siaran langsung saat ini.
                  {isPremium && " Kamu bisa membeli akses untuk menonton nanti!"}
                </p>

                {isPremium && (
                  <div className="mt-4 w-full max-w-xs">
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5">
                      <p className="text-[11px] text-neutral-400 mb-2 text-center">
                        Beli akses sekarang, tonton saat live dimulai!
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handlePurchase('points')}
                          className="py-2 bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-[11px] rounded-lg transition"
                        >
                          🪙 10 Poin
                        </button>
                        <button
                          onClick={() => handlePurchase('saldo')}
                          className="py-2 bg-amber-600 hover:bg-amber-500 text-neutral-950 font-bold text-[11px] rounded-lg transition"
                        >
                          💰 Rp 5.000
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <button
            onClick={() => router.push('/')}
            className="w-full py-3 bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-white font-medium text-xs rounded-xl transition"
          >
            {hasPendingAccess ? "🏠 Kembali ke Rumah Warga" : "🏠 Kembali ke Beranda"}
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // ============ TAMPILAN LIVE (ON AIR) - FULL SCREEN ============
  // ============================================================
  // ============================================================
  // ============ TAMPILAN LIVE (ON AIR) - FULL SCREEN ============
  // ============================================================
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-[100]">
      <div className="relative w-full max-w-[420px] h-full bg-black overflow-hidden">

        {/* 🔥 TOAST NOTIFICATION */}
        {toast && (
          <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3.5 rounded-2xl shadow-2xl border backdrop-blur-xl max-w-[90%] min-w-[280px] text-center animate-in slide-in-from-top-4 duration-300 ${toast.type === 'success'
            ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-400'
            : 'bg-red-950/95 border-red-500/50 text-red-400'
            }`}>
            <div className="flex items-center justify-center gap-3">
              <span className="text-2xl">{toast.type === 'success' ? '✅' : '❌'}</span>
              <p className="text-sm font-bold">{toast.message}</p>
            </div>
          </div>
        )}

        {/* ================= 1. VIDEO LAYER ================= */}
        <div className="absolute inset-0 w-full h-full z-0">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            style={{
              objectFit: 'cover',
              objectPosition: 'center',
              width: '100%',
              height: '100%'
            }}
            playsInline
            muted={isMuted}
            onDoubleClick={() => {
              const video = videoRef.current;
              if (video?.requestFullscreen) {
                video.requestFullscreen().catch(() => { });
              }
            }}
          />

          {/* 🔥 LOADING OVERLAY - MUNCUL SAAT VIDEO LOADING */}
          {isVideoLoading && !videoError && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center z-10">
              {/* Spinner */}
              <div className="relative w-14 h-14 flex items-center justify-center">
                <div className="absolute inset-0 border-2 border-neutral-700/50 border-t-red-500 rounded-full animate-spin shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
                <div className="absolute w-10 h-10 border-2 border-transparent border-b-neutral-400 rounded-full animate-[spin_1s_linear_infinite_reverse]" />
                <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
              </div>

              {/* Teks Loading */}
              <p className="text-[11px] text-neutral-200 mt-5 tracking-widest font-medium uppercase animate-pulse">
                Memuat Siaran...
              </p>

              {/* Progress Bar */}
              <div className="w-32 h-[2px] bg-neutral-800 rounded-full mt-3 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-red-500 to-orange-500 rounded-full animate-[loading_4s_ease-in-out_infinite]" />
              </div>
            </div>
          )}
        </div>

        {/* ================= 2. HEADER OVERLAY (ATAS) ================= */}
        <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none">
          <div className="pointer-events-auto px-4 py-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push('/')}
                  className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-white/20 active:scale-95 transition"
                >
                  <ArrowLeft size={18} />
                </button>
                <div className="h-7 px-2.5 bg-red-600 rounded-full flex items-center gap-1.5 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  <span className="text-white font-bold text-[10px] tracking-wider uppercase">LIVE</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-7 px-2.5 bg-black/40 backdrop-blur-md border border-white/10 rounded-full flex items-center gap-1.5 text-neutral-200 text-[11px] font-medium">
                  <Eye size={13} className="text-neutral-300" />
                  <span>{viewers}</span>
                </div>
                {isPremium && (
                  <div className="h-7 px-2.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 backdrop-blur-md border border-amber-500/30 text-amber-400 rounded-full flex items-center gap-1.5 text-[10px] font-bold uppercase">
                    <Crown size={12} className="fill-amber-400" />
                    <span>Premium</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ================= 3. PREVIEW TIMER (POJOK KANAN ATAS) ================= */}
        {isPreview && !hasAccess && (
          <div className="absolute top-20 right-4 z-20 pointer-events-none">
            <div className="bg-black/60 backdrop-blur-md border border-white/15 px-3 py-1.5 rounded-full text-white text-[10px] font-mono flex items-center gap-1.5 shadow-lg">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
              <span>Preview: <span className="font-bold text-amber-400">{previewTimer}s</span></span>
            </div>
          </div>
        )}

        {/* ================= 4. LOCK OVERLAY (TENGAH - FULLSCREEN) ================= */}
        {/* 🔥 HANYA MUNCUL KALAU PREVIEW ENDED DAN BELUM PUNYA AKSES */}
        {previewEnded && !hasAccess && (
          <div className="absolute inset-0 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center pointer-events-auto p-6 z-30">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-500 mb-2">
              <Lock size={22} />
            </div>
            <h3 className="text-white font-bold text-sm tracking-tight">Waktu Pratinjau Selesai</h3>
            <p className="text-neutral-400 text-[11px] mt-1 mb-5 max-w-[240px] text-center">
              Siaran ini dikunci. Gunakan poin atau isi poin instan dari saldo untuk menonton.
            </p>

            <div className="bg-neutral-900 border border-white/10 rounded-xl p-4 w-full max-w-[320px] shadow-2xl">
              <div className="flex justify-between items-center mb-3 pb-2 border-b border-white/5">
                <span className="text-[10px] text-neutral-400 uppercase font-bold">Dompet Kamu</span>
                <div className="text-right">
                  <span className="text-xs font-bold text-amber-400 block">🪙 {userPoints} Poin</span>
                  <span className="text-[10px] text-neutral-400 block">Rp {userSaldo.toLocaleString('id-ID')}</span>
                </div>
              </div>

              {purchaseError && (
                <div className="mb-3 p-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-[10px] flex items-center gap-1.5">
                  <AlertCircle size={12} /> {purchaseError}
                </div>
              )}

              {/* 🔥 TOMBOL DENGAN STATE TERPISAH */}
              <div className="flex flex-col gap-2">
                {userPoints >= 10 ? (
                  <>
                    <button
                      disabled={isPurchasingPoints}
                      onClick={() => handlePurchase('points')}
                      className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 font-black text-xs rounded-xl transition shadow-lg flex items-center justify-center gap-1.5"
                    >
                      {isPurchasingPoints ? "Memproses..." : "🪙 Tukar 10 Poin & Buka Akses"}
                    </button>
                    <button
                      disabled={isPurchasingSaldo}
                      onClick={() => handlePurchase('saldo')}
                      className="w-full py-2.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-white font-medium text-xs rounded-xl transition border border-white/10 flex items-center justify-center gap-1.5"
                    >
                      {isPurchasingSaldo ? "Memproses..." : "💰 Gunakan Saldo (Rp 5.000)"}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      disabled={isPurchasingSaldo}
                      onClick={() => handlePurchase('saldo')}
                      className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 text-neutral-950 font-black text-xs rounded-xl transition shadow-lg flex items-center justify-center gap-1.5"
                    >
                      {isPurchasingSaldo ? "Memproses..." : "💰 Beli 10 Poin & Akses (Rp 5.000)"}
                    </button>
                    <button
                      disabled={true}
                      className="w-full py-2.5 bg-neutral-800/40 text-neutral-500 text-xs rounded-xl border border-white/5 flex items-center justify-center gap-1.5 cursor-not-allowed"
                    >
                      🪙 Tukar 10 Poin (Poin Kurang)
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= 5. BOTTOM OVERLAY (CHAT & INPUT) ================= */}
        {/* 🔥 CHAT HARUS TETAP TERLIHAT, TAPI INPUT DI-LOCK KALAU BELUM PUNYA AKSES */}
        <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none">
          <div className="pointer-events-auto w-full">
            {/* Comments Container */}
            <div
              ref={commentContainerRef}
              className="h-[180px] overflow-y-auto px-4 py-2 scrollbar-none"
              style={{ scrollbarWidth: 'none' }}
            >
              <div className="flex flex-col justify-end min-h-full">
                <div className="space-y-2 pb-2">
                  {isCommentLoading ? (
                    <div className="text-center text-white/40 text-[10px] py-2">Memuat komentar...</div>
                  ) : comments.length === 0 ? (
                    <div className="text-center text-white/30 text-[10px] py-2">Belum ada komentar.</div>
                  ) : (
                    comments.map((item) => (
                      <div key={item.id} className="flex items-start gap-2">
                        <img
                          src={getAvatarUrl(item.avatar_url, item.user_name)}
                          alt="Avatar"
                          className="w-6 h-6 rounded-full object-cover border border-white/10 mt-0.5 shrink-0"
                        />
                        <div className="flex flex-col bg-black/50 backdrop-blur-sm border border-white/10 px-3 py-1.5 rounded-xl rounded-tl-none max-w-[80%]">
                          <span className="text-[9px] font-bold text-neutral-300">{item.user_name}</span>
                          <p className="text-white text-[11px] mt-0.5 break-words">{item.comment}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Input Footer - PALING BAWAH SEKALI */}
            <div className="p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
              <form onSubmit={handleSendComment} className="flex items-center gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  disabled={isPremium && !hasAccess}
                  placeholder={isPremium && !hasAccess ? "🔒 Beli tiket untuk komentar" : "Ketik komentar..."}
                  className="flex-1 bg-black/50 backdrop-blur-md text-white placeholder-neutral-400 text-xs px-4 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-white/30 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!newComment.trim() || (isPremium && !hasAccess)}
                  className="w-9 h-9 bg-red-600 rounded-xl flex items-center justify-center text-white disabled:bg-neutral-800/50 transition"
                >
                  <Send size={14} />
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* ================= 6. VIDEO ERROR OVERLAY ================= */}
        {videoError && !previewEnded && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-auto z-40">
            <p className="text-neutral-400 text-xs text-center px-4">{videoError}</p>
            <button
              onClick={initVideoPlayer}
              className="mt-3 px-4 py-1.5 bg-white/10 border border-white/20 rounded-full text-white text-[10px] hover:bg-white/20 transition"
            >
              Coba Muat Ulang
            </button>
          </div>
        )}

      </div>
    </div>
  );
}