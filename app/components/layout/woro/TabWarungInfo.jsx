"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Loader2, Bell, Inbox } from "lucide-react";

export default function TabWarungInfo({ theme, user, onUnreadCountChange }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const isMalam = theme?.isMalam ?? true;

  // Hitung dan kirim unread count ke parent
  const updateUnreadCount = (data) => {
    const unreadCount = data.filter(n => !n.is_read).length;
    if (onUnreadCountChange) onUnreadCountChange(unreadCount);
  };

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
  }, [user?.id]);

  const handleNotificationClick = async (notif) => {
    // 1. Update UI secara instan (Optimistic)
    const updatedNotif = notifications.map(n => 
      n.id === notif.id ? { ...n, is_read: true } : n
    );
    setNotifications(updatedNotif);
    
    // Update badge count setelah perubahan
    updateUnreadCount(updatedNotif);

    // 2. Update Database jika belum dibaca
    if (!notif.is_read) {
      await supabase
        .from("warung_info")
        .update({ is_read: true })
        .eq("id", notif.id);
    }

    // 3. Redirect jika ada target link
    if (notif.related_id) {
      router.push(`/post/${notif.related_id}`);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-24 opacity-30 ${isMalam ? 'text-white' : 'text-slate-900'}`}>
        <Inbox size={48} className="mb-4" />
        <p className="text-sm font-medium">Belum ada notifikasi pribadi</p>
      </div>
    );
  }

  return (
    <div className={`divide-y ${isMalam ? 'divide-white/5' : 'divide-slate-100'} pb-10`}>
      {notifications.map((notif) => (
        <button
          key={notif.id}
          onClick={() => handleNotificationClick(notif)}
          className={`w-full flex items-start gap-4 p-5 transition-all text-left active:bg-black/5
            ${!notif.is_read 
              ? (isMalam ? 'bg-orange-500/5' : 'bg-orange-50/50') 
              : (isMalam ? 'bg-transparent' : 'bg-white')}`}
        >
          <div className="relative flex-shrink-0 mt-1">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center border
              ${isMalam ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
              <Bell size={18} className={!notif.is_read ? 'text-orange-500' : 'text-slate-400'} />
            </div>
            
            {!notif.is_read && (
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-full border-2 border-[#0C0C0C]" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className={`text-[13px] transition-all
              ${!notif.is_read 
                ? (isMalam ? 'text-white font-bold' : 'text-slate-900 font-bold') 
                : (isMalam ? 'text-white/40 font-medium' : 'text-slate-400 font-medium')}`}>
              {notif.title || "Info Warung"}
            </h3>
            
            <p className={`text-[12px] mt-1 leading-relaxed
              ${!notif.is_read 
                ? (isMalam ? 'text-white/80' : 'text-slate-700') 
                : (isMalam ? 'text-white/30' : 'text-slate-400')}`}>
              {notif.message}
            </p>
            
            <span className={`text-[10px] mt-2 block opacity-30 ${isMalam ? 'text-white' : 'text-slate-900'}`}>
              {new Date(notif.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}