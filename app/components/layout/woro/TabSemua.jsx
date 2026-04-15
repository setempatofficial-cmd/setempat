"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Loader2, Bell, Users, MapPin, Megaphone, Camera } from "lucide-react";

/** * HELPER: Format waktu yang lebih tegas
 */
const formatTime = (date) => {
  const diff = Math.floor((new Date() - new Date(date)) / 60000);
  if (diff < 1) return "Baru saja";
  if (diff < 60) return `${diff}m`;
  if (diff < 1440) return `${Math.floor(diff / 60)}j`;
  return new Date(date).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
};

export default function TabSemua({ theme, user }) {
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
    textMuted: isMalam ? "#888888" : "#64748B", // Abu-abu solid, bukan transparan
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
        ...(warung.data || []).map(i => ({ ...i, uId: `w_${i.id}`, type: "warung", isRead: i.is_read, content: i.message })),
        ...(warga.data || []).map(i => ({ ...i, uId: `kp_${i.id}`, type: "kampung", isRead: true, title: i.tempat?.name || 'Warga Sekitar', content: i.deskripsi }))
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      setNotifications(merged);
    } finally {
      setLoading(false);
    }
  }, [user?.id, userLocation]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRead = async (notif) => {
    // Optimistic Update
    setNotifications(prev => prev.map(n => n.uId === notif.uId ? { ...n, isRead: true } : n));
    
    if (notif.type === "warung" && !notif.isRead) {
      await supabase.from("warung_info").update({ is_read: true }).eq("id", notif.id);
    }
    
    const tid = notif.related_id || notif.tempat_id;
    if (tid) router.push(`/post/${tid}`);
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
    </div>
  );

  return (
    <div className={`flex flex-col ${colors.bg}`}>
      {notifications.map((notif) => (
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
                {notif.type === 'warung' && <Bell size={22} className="text-blue-500" />}
                {notif.type === 'kampung' && <MapPin size={22} className="text-orange-500" />}
              </div>
            )}
            {!notif.isRead && (
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
                {notif.title || notif.user_name}
              </span>
              <span className="text-[11px] font-medium ml-2 shrink-0" style={{ color: colors.textDim }}>
                {formatTime(notif.created_at)}
              </span>
            </div>

            <p 
              className="text-[13px] line-clamp-2 leading-snug"
              style={{ color: notif.isRead ? colors.textDim : (isMalam ? '#D1D1D1' : '#475569') }}
            >
              {notif.content}
            </p>

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
      ))}
    </div>
  );
}