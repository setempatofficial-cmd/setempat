"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { Bell, Heart, MessageCircle, AtSign, CheckCircle, Loader2 } from "lucide-react";

export default function TabWarungInfo({ theme, onUnreadCountChange }) {
  const router = useRouter();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const isMalam = theme.isMalam;

  const formatWaktu = (date) => {
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "baru saja";
    if (minutes < 60) return `${minutes} menit lalu`;
    if (hours < 24) return `${hours} jam lalu`;
    if (days < 7) return `${days} hari lalu`;
    return new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  };

  const getIcon = (type) => {
    switch(type) {
      case 'like': return <Heart size="14" className="text-pink-500" />;
      case 'comment': return <MessageCircle size="14" className="text-orange-500" />;
      case 'mention': return <AtSign size="14" className="text-blue-500" />;
      case 'ktp_verification': return <CheckCircle size="14" className="text-green-500" />;
      default: return <Bell size="14" className="text-slate-400" />;
    }
  };

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    
    if (data) {
      setNotifications(data);
      const unread = data.filter(n => !n.is_read).length;
      onUnreadCountChange?.(unread);
    }
    setLoading(false);
  }, [user?.id, onUnreadCountChange]);

  const markAsRead = async (id, actionUrl) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    const unread = notifications.filter(n => n.id !== id ? !n.is_read : false).length;
    onUnreadCountChange?.(unread);
    if (actionUrl) router.push(actionUrl);
  };

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="text-center py-12">
        <Bell size="32" className="mx-auto mb-3 text-slate-400/30" />
        <p className={`text-xs ${theme.textMuted}`}>Belum ada notifikasi</p>
        <p className={`text-[10px] ${theme.textMuted} opacity-50 mt-1`}>Notifikasi akan muncul di sini</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {notifications.map((notif) => (
        <div
          key={notif.id}
          onClick={() => markAsRead(notif.id, notif.action_url)}
          className={`p-3 rounded-xl border cursor-pointer transition-all
            ${!notif.is_read 
              ? isMalam 
                ? "bg-orange-500/5 border-orange-500/20" 
                : "bg-orange-50 border-orange-100"
              : isMalam 
                ? "bg-slate-800/30 border-slate-700/50 hover:bg-slate-800/50" 
                : "bg-white/50 border-slate-100 hover:bg-slate-50"
            }`}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              {getIcon(notif.type)}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className={`font-medium text-xs ${!notif.is_read ? "font-semibold" : ""} ${theme.text}`}>
                {notif.title}
              </h4>
              <p className={`text-[11px] ${theme.textMuted} mt-0.5 line-clamp-2`}>{notif.message}</p>
              <p className={`text-[9px] ${theme.textMuted} opacity-50 mt-1`}>
                🕐 {formatWaktu(notif.created_at)}
              </p>
            </div>
            {!notif.is_read && (
              <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse flex-shrink-0 mt-1" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}