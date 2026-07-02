"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Loader2, Bell, Users, MapPin, Megaphone, Camera, CheckCircle, XCircle, Award } from "lucide-react";

/** * HELPER: Format waktu yang lebih tegas
 */
const formatTime = (date) => {
  const diff = Math.floor((new Date() - new Date(date)) / 60000);
  if (diff < 1) return "Baru saja";
  if (diff < 60) return `${diff}m`;
  if (diff < 1440) return `${Math.floor(diff / 60)}j`;
  return new Date(date).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
};

export default function TabSemua({ theme, user, onTabChange, onUnreadCountChange }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(null);

  const isMalam = theme?.isMalam ?? true;

  // Colors Strategy: Menggunakan solid hex untuk menghindari kesan "burem"
  const colors = {
    bg: isMalam ? "bg-[#0C0C0C]" : "bg-white",
    border: isMalam ? "border-white/10" : "border-slate-100",
    textMain: isMalam ? "#FFFFFF" : "#0F172A",
    textMuted: isMalam ? "#888888" : "#64748B",
    textDim: isMalam ? "#444444" : "#94A3B8",
    activeBg: isMalam ? "hover:bg-white/[0.03] active:bg-white/[0.05]" : "hover:bg-slate-50 active:bg-slate-100"
  };

  useEffect(() => {
    if (!user?.id) return;
    const getLoc = async () => {
      const { data } = await supabase.from("profiles").select("latitude, longitude").eq("id", user.id).single();
      if (data) setUserLocation(data);
    };
    getLoc();
  }, [user?.id]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [kento, warung, warga] = await Promise.all([
        supabase.from("kentongan").select("*").order("created_at", { ascending: false }).limit(10),
        supabase.from("warung_info").select("*").eq("user_id", user?.id).order("created_at", { ascending: false }).limit(10),
        userLocation ? supabase.from("laporan_warga").select(`*, tempat:tempat_id(name)`).order("created_at", { ascending: false }).limit(10) : { data: [] }
      ]);

      const merged = [
        ...(kento.data || []).map(i => ({ ...i, uId: `k_${i.id}`, type: "kentongan", isRead: true })),
        ...(warung.data || []).map(i => ({
          ...i,
          uId: `w_${i.id}`,
          type: "warung",
          notif_type: i.type,
          metadata: i.metadata,
          isRead: i.is_read,
          content: i.message || i.content
        })),
        ...(warga.data || []).map(i => ({ ...i, uId: `kp_${i.id}`, type: "kampung", isRead: true, title: i.tempat?.name || 'Warga Sekitar', content: i.deskripsi }))
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      setNotifications(merged);
    } finally {
      setLoading(false);
    }
  }, [user?.id, userLocation]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ==================== GET ICON UNTUK BOUNTY ====================
  const getBountyIcon = (notifType, isRead) => {
    const iconClass = isRead ? "text-slate-400" : "text-white";

    if (notifType === 'bounty_approved') {
      return <CheckCircle size={22} className={isRead ? "text-emerald-400" : "text-emerald-400"} />;
    }
    if (notifType === 'bounty_rejected') {
      return <XCircle size={22} className={isRead ? "text-rose-400" : "text-rose-400"} />;
    }
    return <Bell size={22} className="text-blue-500" />;
  };

  // ==================== GET LABEL UNTUK BOUNTY ====================
  const getBountyLabel = (notifType) => {
    if (notifType === 'bounty_approved') return '✅ Bounty Disetujui';
    if (notifType === 'bounty_rejected') return '❌ Bounty Ditolak';
    return 'Info Warung';
  };

  const handleRead = async (notif) => {
    // 🔥 UNTUK WARUNG INFO (termasuk bounty)
    if (notif.type === "warung" && !notif.isRead) {
      await supabase.from("warung_info").update({ is_read: true }).eq("id", notif.id);
      setNotifications(prev => prev.map(n =>
        n.uId === notif.uId ? { ...n, isRead: true } : n
      ));

      // ✅ Update unread count
      const updatedUnread = notifications.filter(n => !n.isRead).length - 1;
      if (onUnreadCountChange) onUnreadCountChange(updatedUnread);

      // 🔥 Redirect ke halaman yang sesuai
      if (notif.notif_type === 'bounty_approved' || notif.notif_type === 'bounty_rejected') {
        router.push('/rumah-warga');
        if (onTabChange) onTabChange("warung");
        return;
      }

      if (onTabChange) onTabChange("warung");
      return;
    }

    // 🔥 UNTUK KAMPUNG KITA
    if (notif.type === "kampung") {
      setNotifications(prev => prev.map(n =>
        n.uId === notif.uId ? { ...n, isRead: true } : n
      ));

      const remainingUnread = notifications.filter(n => n.uId !== notif.uId && !n.isRead).length;
      if (onUnreadCountChange) onUnreadCountChange(remainingUnread);

      if (onTabChange) onTabChange("kampung");
      return;
    }

    // 🔥 UNTUK KENTONGAN
    if (notif.type === "kentongan") {
      setNotifications(prev => prev.map(n =>
        n.uId === notif.uId ? { ...n, isRead: true } : n
      ));
      if (onTabChange) onTabChange("kentongan");
      return;
    }
  };

  // ==================== RENDER ====================
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        <p className={`text-xs font-black uppercase tracking-[0.2em] opacity-40 ${isMalam ? 'text-white' : 'text-slate-900'}`}>
          Memuat Notifikasi...
        </p>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-28 ${isMalam ? 'text-white' : 'text-slate-900'}`}>
        <div className={`w-20 h-20 rounded-2xl mb-4 flex items-center justify-center ${isMalam ? 'bg-white/5' : 'bg-slate-50'}`}>
          <Bell size={28} className="opacity-20" />
        </div>
        <p className="text-sm font-bold uppercase tracking-widest opacity-40 text-center px-10">
          Belum ada notifikasi
        </p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${colors.bg}`}>
      {notifications.map((notif) => {
        // 🔥 DETEKSI APAKAH INI BOUNTY NOTIFICATION
        const isBounty = notif.notif_type === 'bounty_approved' || notif.notif_type === 'bounty_rejected';
        const isUnread = !notif.isRead;

        return (
          <button
            key={notif.uId}
            onClick={() => handleRead(notif)}
            className={`w-full flex items-start gap-4 p-4 border-b ${colors.border} transition-colors ${colors.activeBg}`}
          >
            {/* Avatar Section */}
            <div className="relative flex-shrink-0 mt-0.5">
              {notif.photo_url ? (
                <img
                  src={notif.photo_url}
                  className={`w-12 h-12 object-cover ${notif.type === 'kampung' ? 'rounded-xl' : 'rounded-full'} border ${colors.border}`}
                  alt=""
                />
              ) : (
                <div className={`w-12 h-12 flex items-center justify-center ${notif.type === 'kampung' ? 'rounded-xl' : 'rounded-full'} ${isMalam ? 'bg-white/5' : 'bg-slate-100'}`}>
                  {notif.type === 'kentongan' && <Megaphone size={22} className="text-amber-500" />}
                  {notif.type === 'warung' && isBounty && getBountyIcon(notif.notif_type, notif.isRead)}
                  {notif.type === 'warung' && !isBounty && <Bell size={22} className="text-blue-500" />}
                  {notif.type === 'kampung' && <MapPin size={22} className="text-orange-500" />}
                </div>
              )}
              {isUnread && (
                <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-blue-500 rounded-full border-[3px] border-[#0C0C0C]" />
              )}
            </div>

            {/* Content Section */}
            <div className="flex-1 text-left min-w-0">
              <div className="flex justify-between items-center mb-0.5">
                <span
                  className="text-[14px] font-bold truncate"
                  style={{ color: notif.isRead ? colors.textMuted : colors.textMain }}
                >
                  {/* 🔥 TITLE UNTUK BOUNTY */}
                  {isBounty ? getBountyLabel(notif.notif_type) : (notif.title || notif.user_name)}
                </span>
                <span className="text-[11px] font-medium ml-2 shrink-0" style={{ color: colors.textDim }}>
                  {formatTime(notif.created_at)}
                </span>
              </div>

              <p
                className="text-[13px] line-clamp-2 leading-snug"
                style={{ color: notif.isRead ? colors.textDim : (isMalam ? '#D1D1D1' : '#475569') }}
              >
                {notif.content || notif.message}
              </p>

              {/* 🔥 BADGE UNTUK BOUNTY */}
              {isBounty && (
                <div className="flex items-center gap-1.5 mt-2.5">
                  <div className={`p-0.5 rounded ${notif.notif_type === 'bounty_approved' ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
                    {notif.notif_type === 'bounty_approved' ? (
                      <CheckCircle size={10} className="text-emerald-500" />
                    ) : (
                      <XCircle size={10} className="text-rose-500" />
                    )}
                  </div>
                  <span className={`text-[11px] font-semibold uppercase tracking-wider ${notif.notif_type === 'bounty_approved' ? 'text-emerald-500/80' : 'text-rose-500/80'}`}>
                    {notif.notif_type === 'bounty_approved' ? 'Reward telah masuk' : 'Coba lagi kesempatan lain'}
                  </span>
                </div>
              )}

              {notif.type === "kampung" && (
                <div className="flex items-center gap-1.5 mt-2.5">
                  <div className="p-0.5 rounded bg-orange-500/10">
                    <Users size={10} className="text-orange-500" />
                  </div>
                  <span className="text-[11px] font-semibold text-orange-500/80 uppercase tracking-wider">
                    Kiriman {notif.user_name}
                  </span>
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}