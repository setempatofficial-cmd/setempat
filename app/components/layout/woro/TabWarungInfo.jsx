"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Bell, Inbox, Circle, ArrowRight } from "lucide-react";

export default function TabWarungInfo({ theme, user, onUnreadCountChange }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const isMalam = theme?.isMalam ?? true;

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
    const updatedNotif = notifications.map(n => 
      n.id === notif.id ? { ...n, is_read: true } : n
    );
    setNotifications(updatedNotif);
    updateUnreadCount(updatedNotif);

    if (!notif.is_read) {
      await supabase
        .from("warung_info")
        .update({ is_read: true })
        .eq("id", notif.id);
    }

    if (notif.related_id) {
      router.push(`/post/${notif.related_id}`);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        <p className={`text-[10px] font-black uppercase tracking-[0.2em] opacity-40 ${isMalam ? 'text-white' : 'text-slate-900'}`}>
          Memuat Info...
        </p>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }}
        className={`flex flex-col items-center justify-center py-28 ${isMalam ? 'text-white' : 'text-slate-900'}`}
      >
        <div className={`w-20 h-20 rounded-[32px] mb-6 flex items-center justify-center ${isMalam ? 'bg-white/5' : 'bg-slate-50'}`}>
          <Inbox size={32} className="opacity-20" />
        </div>
        <p className="text-xs font-bold uppercase tracking-widest opacity-40 text-center px-10">
          Belum ada woro-woro <br/> pribadi untukmu
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-1 pb-20">
      <AnimatePresence>
        {notifications.map((notif, index) => {
          const isUnread = !notif.is_read;
          return (
            <motion.button
              key={notif.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => handleNotificationClick(notif)}
              className={`w-full relative flex items-start gap-4 p-5 transition-all text-left group
                ${isUnread 
                  ? (isMalam ? 'bg-orange-500/[0.03]' : 'bg-orange-50/30') 
                  : 'bg-transparent hover:opacity-70'}`}
            >
              {/* Status Indicator Bar */}
              {isUnread && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500 rounded-r-full" />
              )}

              <div className="relative shrink-0 mt-1">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all duration-300
                  ${isUnread 
                    ? 'bg-orange-500 border-orange-400 shadow-lg shadow-orange-500/20' 
                    : (isMalam ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100')}`}>
                  <Bell size={18} className={isUnread ? 'text-white' : 'text-slate-400'} />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-2">
                  <h3 className={`text-[13px] tracking-tight leading-tight
                    ${isUnread 
                      ? (isMalam ? 'text-white font-black' : 'text-slate-900 font-black') 
                      : (isMalam ? 'text-white/40 font-bold' : 'text-slate-400 font-bold')}`}>
                    {notif.title || "Info Warung"}
                  </h3>
                  <span className={`text-[9px] font-bold uppercase tracking-tighter shrink-0 opacity-40 ${isMalam ? 'text-white' : 'text-slate-900'}`}>
                    {new Date(notif.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
                
                <p className={`text-[12px] mt-1.5 leading-relaxed line-clamp-2
                  ${isUnread 
                    ? (isMalam ? 'text-white/80 font-medium' : 'text-slate-700 font-medium') 
                    : (isMalam ? 'text-white/30 font-normal' : 'text-slate-400 font-normal')}`}>
                  {notif.message}
                </p>

                {notif.related_id && isUnread && (
                  <div className="flex items-center gap-1 mt-3 text-orange-500 text-[10px] font-black uppercase tracking-widest">
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