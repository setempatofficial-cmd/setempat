"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Megaphone, Loader2 } from "lucide-react";

export default function TabKentongan({ theme }) {
  const [announcements, setAnnouncements] = useState([]);
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

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("announcements")
      .select("*, profiles:created_by (full_name, username, avatar_url)")
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });
    
    if (data) setAnnouncements(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
      </div>
    );
  }

  if (announcements.length === 0) {
    return (
      <div className="text-center py-12">
        <Megaphone size="32" className="mx-auto mb-3 text-slate-400/30" />
        <p className={`text-xs ${theme.textMuted}`}>Belum ada pengumuman</p>
        <p className={`text-[10px] ${theme.textMuted} opacity-50 mt-1`}>
          Pengumuman dari petinggi akan muncul di sini
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {announcements.map((item) => (
        <div
          key={item.id}
          className={`p-3 rounded-xl border ${isMalam ? "bg-slate-800/30 border-slate-700/50" : "bg-white/50 border-slate-100"}`}
        >
          <div className="flex items-start gap-3">
            <div className="p-1.5 rounded-full bg-orange-500/10 flex-shrink-0">
              <Megaphone size="14" className="text-orange-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className={`font-bold text-xs ${theme.text}`}>{item.title}</h3>
                {item.is_pinned && (
                  <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-600">
                    📌 PINNED
                  </span>
                )}
              </div>
              <p className={`text-[11px] ${theme.textMuted} mt-1`}>{item.content}</p>
              <div className={`flex items-center gap-3 mt-2 text-[9px] ${theme.textMuted} opacity-70`}>
                <span>👑 {item.profiles?.full_name || "Petinggi"}</span>
                <span>🕐 {formatWaktu(item.created_at)}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}