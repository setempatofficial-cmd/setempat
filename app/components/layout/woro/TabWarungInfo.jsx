"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, Bell, Inbox, ArrowRight, AtSign, MessageSquare,
  Heart, Gift, UserPlus, Video, Crown, Clock, CheckCircle, XCircle
} from "lucide-react";

export default function TabWarungInfo({ theme, user, onUnreadCountChange }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const isMalam = theme?.isMalam ?? true;

  const updateUnreadCount = (data) => {
    const unreadCount = data.filter(n => !n.is_read).length;
    if (onUnreadCountChange) onUnreadCountChange(unreadCount);
  };

  // ==================== GET NOTIFICATION ICON ====================
  const getNotificationIcon = (type, isUnread) => {
    const iconClass = isUnread ? 'text-white' : 'text-slate-400';
    const bgClass = isUnread
      ? 'bg-orange-500 border-orange-400'
      : (isMalam ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100');

    switch (type) {
      case 'mention':
        return (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-300 ${bgClass}`}>
            <AtSign size={18} className={iconClass} />
          </div>
        );
      case 'komentar':
        return (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-300 ${bgClass}`}>
            <MessageSquare size={18} className={iconClass} />
          </div>
        );
      case 'like':
        return (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-300 ${bgClass}`}>
            <Heart size={18} className={iconClass} />
          </div>
        );
      case 'follow':
        return (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-300 ${bgClass}`}>
            <UserPlus size={18} className={iconClass} />
          </div>
        );
      case 'voucher':
      case 'voucher_redeemed':
        return (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-300 ${bgClass}`}>
            <Gift size={18} className={iconClass} />
          </div>
        );
      case 'live_pending':
        return (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-300 ${isUnread ? 'bg-amber-500 border-amber-400' : 'bg-white/5 border-white/5'}`}>
            <Clock size={18} className={isUnread ? 'text-white' : 'text-slate-400'} />
          </div>
        );
      case 'live_active':
      case 'live':
        return (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-300 ${isUnread ? 'bg-red-500 border-red-400' : 'bg-white/5 border-white/5'}`}>
            <Bell size={18} className={isUnread ? 'text-white' : 'text-slate-400'} />
          </div>
        );
      case 'video':
        return (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-300 ${bgClass}`}>
            <Video size={18} className={iconClass} />
          </div>
        );
      case 'subscription':
        return (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-300 ${bgClass}`}>
            <Crown size={18} className={iconClass} />
          </div>
        );
      case 'points_topup':
        return (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-300 ${bgClass}`}>
            <Gift size={18} className={iconClass} />
          </div>
        );

      // ✅ TAMBAHKAN BOUNTY
      case 'bounty_approved':
        return (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-300 
            ${isUnread ? 'bg-emerald-500 border-emerald-400' : 'bg-white/5 border-white/5'}`}>
            <CheckCircle size={18} className={isUnread ? 'text-white' : 'text-slate-400'} />
          </div>
        );
      case 'bounty_rejected':
        return (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-300 
            ${isUnread ? 'bg-rose-500 border-rose-400' : 'bg-white/5 border-white/5'}`}>
            <XCircle size={18} className={isUnread ? 'text-white' : 'text-slate-400'} />
          </div>
        );

      default:
        return (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-300 ${bgClass}`}>
            <Bell size={18} className={iconClass} />
          </div>
        );
    }
  };

  // ==================== FORMAT PESAN ====================
  const formatMessage = (notif) => {
    if (notif.type === 'mention') {
      if (notif.from_user_name) {
        return `${notif.from_user_name} menyebut Anda dalam komentar`;
      }
      return notif.message;
    }

    // 🔥 FORMAT UNTUK LIVE
    if (notif.type === 'live_pending') {
      return notif.message || "Akses Live berhasil dibeli. Tunggu notifikasi saat siaran dimulai.";
    }
    if (notif.type === 'live_active') {
      return notif.message || "Akses Live aktif! Siaran sedang berlangsung. Klik untuk menonton!";
    }
    if (notif.type === 'live') {
      return notif.message || "Siaran Live sedang berlangsung!";
    }

    // 🔥 FORMAT UNTUK VIDEO
    if (notif.type === 'video') {
      return notif.message || "Akses video aktif! Klik untuk menonton.";
    }

    // 🔥 FORMAT UNTUK SUBSCRIPTION
    if (notif.type === 'subscription') {
      return notif.message || "Berlangganan aktif! Nikmati konten premium.";
    }

    // 🔥 FORMAT UNTUK VOUCHER
    if (notif.type === 'voucher' || notif.type === 'voucher_redeemed') {
      return notif.message || "Voucher Anda telah diklaim oleh merchant";
    }

    // 🔥 FORMAT UNTUK TOP-UP POIN
    if (notif.type === 'points_topup') {
      return notif.message || "Top-Up Poin berhasil!";
    }

    // ✅ TAMBAHKAN BOUNTY (DI DALAM FUNCTION)
    if (notif.type === 'bounty_approved') {
      return notif.message || "✅ Submission Anda telah disetujui! Reward telah ditambahkan.";
    }
    if (notif.type === 'bounty_rejected') {
      return notif.message || "❌ Submission Anda ditolak. Coba lagi dengan konten yang lebih baik.";
    }

    return notif.message || "Info Petinggi Setempat";
  };


  // ==================== GET METADATA DARI CONTENT ====================
  const getMetadata = (notif) => {
    if (notif.metadata) return notif.metadata;
    if (notif.content) {
      try {
        return typeof notif.content === 'string' ? JSON.parse(notif.content) : notif.content;
      } catch (e) {
        return {};
      }
    }
    return {};
  };

  // ==================== DAPATKAN LINK TUJUAN ====================
  const getNotificationLink = (notif) => {
    // 🔥 CEK METADATA TERLEBIH DAHULU
    const metadata = getMetadata(notif);
    if (metadata.redirect_url) {
      return metadata.redirect_url;
    }

    if (notif.reference_id && notif.reference_type === 'komentar') {
      return `/post/${notif.tempat_id}?comment_id=${notif.reference_id}`;
    }
    if (notif.related_id) {
      return `/post/${notif.related_id}`;
    }
    if (notif.tempat_id) {
      return `/post/${notif.tempat_id}`;
    }
    return null;
  };

  // ==================== HANDLE KLIK NOTIFIKASI ====================
  const handleNotificationClick = async (notif) => {
    // Tandai sebagai sudah dibaca
    if (!notif.is_read) {
      const updatedNotif = notifications.map(n =>
        n.id === notif.id ? { ...n, is_read: true } : n
      );
      setNotifications(updatedNotif);
      updateUnreadCount(updatedNotif);

      await supabase
        .from("warung_info")
        .update({ is_read: true })
        .eq("id", notif.id);
    }

    const metadata = getMetadata(notif);

    // 🔥 CEK UNTUK LIVE (PENDING / ACTIVE)
    if (notif.type === 'live_pending' || notif.type === 'live_active' || notif.type === 'live') {
      router.push("/live");
      return;
    }

    // ✅ REDIRECT BERDASARKAN TIPE NOTIFIKASI
    switch (notif.type) {
      case 'video':
        const videoUrl = metadata.redirect_url || '/video';
        router.push(videoUrl);
        break;
      case 'subscription':
        router.push("/premium");
        break;
      case 'voucher':
      case 'voucher_redeemed':
        router.push("/rumah-warga");
        break;
      case 'points_topup':
        router.push("/rumah-warga");
        break;
      default:
        const link = getNotificationLink(notif);
        if (link) router.push(link);
        break;
    }
  };

  // ==================== FETCH DATA & REALTIME ====================
  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("warung_info")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setNotifications(data || []);
        updateUnreadCount(data || []);
      } catch (err) {
        console.error("Error Warung Info:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Realtime subscription
    const channel = supabase
      .channel(`warung_info_${user?.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "warung_info",
          filter: `user_id=eq.${user?.id}`
        },
        (payload) => {
          setNotifications(prev => {
            const updated = [payload.new, ...prev];
            updateUnreadCount(updated);
            return updated;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // ==================== LOADING STATE ====================
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        <p className={`text-xs font-black uppercase tracking-[0.2em] opacity-40 ${isMalam ? 'text-white' : 'text-slate-900'}`}>
          Memuat Info...
        </p>
      </div>
    );
  }

  // ==================== EMPTY STATE ====================
  if (notifications.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`flex flex-col items-center justify-center py-28 ${isMalam ? 'text-white' : 'text-slate-900'}`}
      >
        <div className={`w-20 h-20 rounded-2xl mb-4 flex items-center justify-center ${isMalam ? 'bg-white/5' : 'bg-slate-50'}`}>
          <Inbox size={28} className="opacity-20" />
        </div>
        <p className="text-sm font-bold uppercase tracking-widest opacity-40 text-center px-10">
          Belum ada woro-woro <br /> pribadi untukmu
        </p>
      </motion.div>
    );
  }

  // ==================== LIST NOTIFIKASI ====================
  return (
    <div className="space-y-2 pb-20">
      <AnimatePresence>
        {notifications.map((notif, index) => {
          const isUnread = !notif.is_read;
          const formattedMessage = formatMessage(notif);
          const metadata = getMetadata(notif);

          // 🔥 DETEKSI JENIS NOTIFIKASI UNTUK LABEL
          let label = notif.title || "Info Warung";
          if (notif.type === 'live_pending') label = "⏳ Menunggu Siaran";
          if (notif.type === 'live_active') label = "🔴 Siaran Live";
          if (notif.type === 'live') label = "🔴 Siaran Live";
          if (notif.type === 'video') label = "🎬 Akses Video";
          if (notif.type === 'subscription') label = "📺 Berlangganan";
          if (notif.type === 'voucher_redeemed') label = "🎉 Voucher Ditukar";
          if (notif.type === 'points_topup') label = "🪙 Top-Up Poin";

          if (notif.type === 'bounty_approved') label = "✅ Bounty Disetujui";
          if (notif.type === 'bounty_rejected') label = "❌ Bounty Ditolak";

          return (
            <motion.button
              key={notif.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => handleNotificationClick(notif)}
              className={`w-full relative flex items-start gap-4 p-4 transition-all text-left group
                ${isUnread
                  ? (isMalam ? 'bg-orange-500/[0.03]' : 'bg-orange-50/30')
                  : 'bg-transparent hover:opacity-70'}`}
            >
              {/* Status Indicator Bar */}
              {isUnread && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500 rounded-r-full" />
              )}

              {/* Icon Notifikasi */}
              {getNotificationIcon(notif.type, isUnread)}

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-2">
                    {notif.type === 'mention' && (
                      <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center text-white text-[10px] font-bold border border-white/20 shadow-sm">
                        {(notif.from_username?.[0] || (notif.from_user_name?.[0]) || '?').toUpperCase()}
                      </div>
                    )}
                    <h3 className={`text-sm tracking-tight leading-tight
                      ${isUnread
                        ? (isMalam ? 'text-white font-black' : 'text-slate-900 font-black')
                        : (isMalam ? 'text-white/40 font-bold' : 'text-slate-400 font-bold')}`}>
                      {label}
                    </h3>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-tighter shrink-0 opacity-40 ${isMalam ? 'text-white' : 'text-slate-900'}`}>
                    {new Date(notif.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                  </span>
                </div>

                {notif.type === 'mention' && notif.from_username && (
                  <p className={`text-[11px] font-bold mt-1 ${isUnread ? 'text-orange-500' : 'text-orange-500/40'}`}>
                    @{notif.from_username}
                  </p>
                )}

                <p className={`text-sm mt-1.5 leading-relaxed line-clamp-2
                  ${isUnread
                    ? (isMalam ? 'text-white/80 font-medium' : 'text-slate-700 font-medium')
                    : (isMalam ? 'text-white/30 font-normal' : 'text-slate-400 font-normal')}`}>
                  {formattedMessage}
                </p>

                {/* ✅ BADGE UNTUK BOUNTY */}
                {(notif.type === 'bounty_approved' || notif.type === 'bounty_rejected') && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className={`text-[10px] font-bold ${notif.type === 'bounty_approved' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {notif.type === 'bounty_approved' ? '💰 Reward telah masuk ke akun Anda' : '💪 Jangan menyerah, coba kesempatan lain!'}
                    </span>
                  </div>
                )}

                {/* 🔥 TAMBAHKAN INFO EKSTRA UNTUK LIVE */}
                {notif.type === 'live_pending' && (
                  <div className="mt-2 flex items-center gap-2 text-amber-400/70 text-[10px]">
                    <Clock size={12} />
                    <span>Menunggu siaran dimulai</span>
                  </div>
                )}
                {notif.type === 'live_active' && (
                  <div className="mt-2 flex items-center gap-2 text-red-400 text-[10px] animate-pulse">
                    <Bell size={12} />
                    <span className="font-bold">🔴 SIARAN BERLANGSUNG!</span>
                  </div>
                )}

                {/* 🔥 TAMBAHKAN INFO UNTUK VIDEO */}
                {notif.type === 'video' && (
                  <div className="mt-2 flex items-center gap-2 text-blue-400/70 text-[10px]">
                    <Video size={12} />
                    <span>Akses video 24 jam</span>
                  </div>
                )}

                {/* 🔥 TAMBAHKAN INFO UNTUK SUBSCRIPTION */}
                {notif.type === 'subscription' && (
                  <div className="mt-2 flex items-center gap-2 text-purple-400/70 text-[10px]">
                    <Crown size={12} />
                    <span>Berlangganan 30 hari</span>
                  </div>
                )}

                {notif.type === 'mention' && notif.tempat_name && (
                  <div className="flex items-center gap-1 mt-2">
                    <span className="text-[9px] font-black uppercase tracking-wider text-orange-500/60">
                      📍 {notif.tempat_name}
                    </span>
                  </div>
                )}

                {notif.type === 'mention' && notif.content && isUnread && (
                  <div className={`mt-2 p-2 rounded-lg text-[11px] italic ${isMalam ? 'bg-white/5 text-white/40' : 'bg-slate-50 text-slate-500'}`}>
                    "{notif.content.substring(0, 80)}"
                  </div>
                )}

                {notif.type === 'voucher_redeemed' && (
                  <div className="mt-3 flex items-center gap-2">
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push("/rumah-warga");
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white text-[10px] font-bold transition-all cursor-pointer inline-block"
                    >
                      Lihat Poin Saya →
                    </div>
                  </div>
                )}

                {/* 🔥 TOMBOL UNTUK LIVE */}
                {(notif.type === 'live_pending' || notif.type === 'live_active') && (
                  <div className="mt-3 flex items-center gap-2">
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push("/live");
                      }}
                      className={`px-3 py-1.5 rounded-lg text-white text-[10px] font-bold transition-all cursor-pointer inline-block ${notif.type === 'live_active'
                        ? 'bg-red-600 hover:bg-red-500 animate-pulse'
                        : 'bg-amber-600 hover:bg-amber-500'
                        }`}
                    >
                      {notif.type === 'live_active' ? '🔴 Nonton Sekarang' : '⏳ Ke Halaman Live'}
                    </div>
                  </div>
                )}

                {isUnread && notif.type !== 'voucher_redeemed' && notif.type !== 'live_pending' && notif.type !== 'live_active' && (
                  <div className="flex items-center gap-1.5 mt-3 text-orange-500 text-[10px] font-black uppercase tracking-widest">
                    <span>Lihat Detail</span>
                    <ArrowRight size={10} />
                  </div>
                )}
              </div>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}