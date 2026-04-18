"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Bell, Inbox, ArrowRight, AtSign, MessageSquare, Heart, UserPlus } from "lucide-react";

export default function TabWarungInfo({ theme, user, onUnreadCountChange }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const isMalam = theme?.isMalam ?? true;

  // Update jumlah notifikasi yang belum dibaca
  const updateUnreadCount = (data) => {
    const unreadCount = data.filter(n => !n.is_read).length;
    if (onUnreadCountChange) onUnreadCountChange(unreadCount);
  };

  // ==================== GET ICON NOTIFIKASI ====================
  const getNotificationIcon = (type, isUnread) => {
    const iconClass = isUnread ? 'text-white' : 'text-slate-400';
    const bgClass = isUnread 
      ? 'bg-orange-500 border-orange-400' 
      : (isMalam ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100');
    
    switch(type) {
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
    return notif.message;
  };

  // ==================== DAPATKAN LINK TUJUAN ====================
  const getNotificationLink = (notif) => {
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
          setNotifications(prev => [payload.new, ...prev]);
          updateUnreadCount([payload.new, ...notifications]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // ==================== HANDLE KLIK NOTIFIKASI ====================
  const handleNotificationClick = async (notif) => {
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

    const link = getNotificationLink(notif);
    if (link) {
      router.push(link);
    }
  };

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
          Belum ada woro-woro <br/> pribadi untukmu
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
                    {/* Avatar pengirim */}
                    {notif.type === 'mention' && notif.from_avatar && (
                      <img 
                        src={notif.from_avatar} 
                        alt="avatar" 
                        className="w-5 h-5 rounded-full object-cover border border-white/20"
                        onError={(e) => e.target.src = "/default-avatar.png"}
                      />
                    )}
                    <h3 className={`text-sm tracking-tight leading-tight
                      ${isUnread 
                        ? (isMalam ? 'text-white font-black' : 'text-slate-900 font-black') 
                        : (isMalam ? 'text-white/40 font-bold' : 'text-slate-400 font-bold')}`}>
                      {notif.type === 'mention' ? 'Mention' : (notif.title || "Info Warung")}
                    </h3>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-tighter shrink-0 opacity-40 ${isMalam ? 'text-white' : 'text-slate-900'}`}>
                    {new Date(notif.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
                
                {/* Username pengirim */}
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

                {/* Info tempat */}
                {notif.type === 'mention' && notif.tempat_name && (
                  <div className="flex items-center gap-1 mt-2">
                    <span className="text-[9px] font-black uppercase tracking-wider text-orange-500/60">
                      📍 {notif.tempat_name}
                    </span>
                  </div>
                )}

                {/* Preview konten komentar */}
                {notif.type === 'mention' && notif.content && isUnread && (
                  <div className={`mt-2 p-2 rounded-lg text-[11px] italic ${
                    isMalam ? 'bg-white/5 text-white/40' : 'bg-slate-50 text-slate-500'
                  }`}>
                    "{notif.content.substring(0, 80)}"
                  </div>
                )}

                {isUnread && (
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