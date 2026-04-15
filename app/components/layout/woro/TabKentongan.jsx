"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Megaphone, Crown, Loader2, Pin } from "lucide-react";

// Format waktu ringkas (m, j, hari)
function formatTime(dateString) {
  const date = new Date(dateString);
  const diffMins = Math.floor((new Date() - date) / 60000);
  if (diffMins < 1) return "baru saja";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}j`;
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

export default function TabKentongan({ theme }) {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const isMalam = theme?.isMalam ?? true;

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("kentongan")
        .select("*")
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(30);
      
      if (error) throw error;
      setAnnouncements(data || []);
    } catch (err) {
      console.error("Error fetching announcements:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
    const channel = supabase.channel("kentongan_realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "kentongan" }, 
      () => fetchAnnouncements()).subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchAnnouncements]);

  if (loading && announcements.length === 0) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-orange-500" /></div>;
  }

  if (announcements.length === 0) {
    return (
      <div className="text-center py-20 opacity-30">
        <Megaphone size={48} className="mx-auto mb-4" />
        <p className="text-sm font-medium italic">Suasana masih sepi, Lur...</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-white/5 pb-10">
      {announcements.map((item) => (
        <div
          key={item.id}
          className={`relative flex items-start gap-4 p-5 transition-all
            ${item.is_urgent ? (isMalam ? 'bg-red-500/[0.03]' : 'bg-red-50/50') : ''}
          `}
        >
          {/* Aksen Garis Samping untuk Urgent */}
          {item.is_urgent && (
            <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
          )}

          {/* Icon Section */}
          <div className="relative flex-shrink-0 mt-1">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center border
              ${item.is_urgent 
                ? (isMalam ? 'bg-red-500/10 border-red-500/20' : 'bg-red-100 border-red-200')
                : (isMalam ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-100 border-amber-200')
              }`}>
              {item.is_urgent ? (
                <Megaphone size={18} className="text-red-500" />
              ) : (
                <Crown size={18} className="text-amber-500" />
              )}
            </div>
          </div>

          {/* Content Section */}
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start gap-2">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  {item.is_pinned && <Pin size={12} className="text-amber-500 fill-amber-500" />}
                  <h3 className={`text-[14px] font-bold tracking-tight
                    ${isMalam ? 'text-white' : 'text-slate-900'}`}>
                    {item.title}
                  </h3>
                </div>
                <div className="flex items-center gap-2 opacity-40">
                   <span className="text-[10px] font-bold uppercase tracking-widest">👑 Petinggi Setempat</span>
                </div>
              </div>
              <span className="text-[10px] text-white/30 font-medium whitespace-nowrap mt-1">
                {formatTime(item.created_at)}
              </span>
            </div>

            <p className={`text-[13px] mt-2 leading-relaxed
              ${isMalam ? 'text-white/70' : 'text-slate-600'}`}>
              {item.content}
            </p>

            {/* Badges */}
            {(item.is_urgent || item.is_pinned) && (
              <div className="flex gap-2 mt-3">
                {item.is_urgent && (
                  <span className="text-[9px] px-2 py-0.5 rounded-md font-black bg-red-500 text-white uppercase tracking-tighter">
                    PENTING
                  </span>
                )}
                {item.is_pinned && (
                  <span className="text-[9px] px-2 py-0.5 rounded-md font-black bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase tracking-tighter">
                    PINNED
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}