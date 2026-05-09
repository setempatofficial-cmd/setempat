"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { formatRelativeTime } from "@/lib/feedEngine";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

const getAvatarUrl = (report) => {
  if (report?.user_avatar) return report.user_avatar;
  const name = report?.user_name || "Warga";
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff`;
};

const AvatarImage = ({ report }) => {
  const [imgError, setImgError] = useState(false);
  const avatarUrl = !imgError ? getAvatarUrl(report) : 
    `https://ui-avatars.com/api/?name=${encodeURIComponent(report?.user_name || "Warga")}&background=0D8ABC&color=fff`;
  
  return (
    <img 
      src={avatarUrl}
      className="w-6 h-6 rounded-full object-cover ring-1 ring-white/10 flex-shrink-0"
      alt={report?.user_name || "avatar"}
      onError={() => setImgError(true)}
      loading="lazy"
    />
  );
};

export default function LiveInsight({ 
  signals = [], 
  theme, 
  locationName = "Sekitar", 
  currentUser = null,
  tempatId = null,
  tempatData = null 
}) {
  const [index, setIndex] = useState(0);
  const [descriptionFromDB, setDescriptionFromDB] = useState(null);
  const touchStart = useRef(null);
  
  const isDark = theme?.isMalam || theme?.name === "MALAM" || false; // ✅ Fixed

  useEffect(() => {
    async function fetchInfo() {
      if (tempatData?.description) { 
        setDescriptionFromDB(tempatData.description); 
        return; 
      }
      if (!tempatId) return;
      const { data } = await supabase.from('tempat').select('name, description, category').eq('id', tempatId).single();
      if (data) setDescriptionFromDB({ text: data.description, name: data.name, category: data.category });
    }
    fetchInfo();
  }, [tempatId, tempatData]);

  const insights = useMemo(() => {
    let list = [];
    if (signals?.length > 0) {
      const now = Date.now();
      const recentSignals = signals
        .filter(s => (now - new Date(s.created_at).getTime()) <= 86400000)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      list = recentSignals.slice(0, 5).map(s => {
        const isMe = currentUser && s.user_id === currentUser.id;
        return {
          id: s.id,
          text: s.deskripsi || s.content || "Update tersedia",
          author: isMe ? "Laporan Anda" : (s.user_name || "Warga"),
          reportData: s,
          time: formatRelativeTime(s.created_at),
          sourceLabel: isMe ? "ANDA" : "WARGA",
          isUrgent: /(macet|kecelakaan|banjir|ramai|antri)/i.test((s.deskripsi || "").toLowerCase()),
          tipe: s.tipe || "Update",
          isMe
        };
      });
    }

    if (list.length === 0 && descriptionFromDB) {
      const text = typeof descriptionFromDB === 'string' ? descriptionFromDB : descriptionFromDB.text;
      list.push({
        id: "desc",
        text: text,
        author: descriptionFromDB.name || locationName,
        reportData: null,
        time: "Terkini",
        sourceLabel: "INFO",
        fromDescription: true,
        isUrgent: false,
        tipe: "Informasi"
      });
    }
    return list;
  }, [signals, currentUser, descriptionFromDB, locationName]);

  const insightsLength = insights.length;
  
  useEffect(() => {
    if (insightsLength <= 1) return;
    const interval = setInterval(() => setIndex(p => (p + 1) % insightsLength), 5000);
    return () => clearInterval(interval);
  }, [insightsLength]);

  // ✅ Fixed touch handlers
  const onTouchStart = (e) => {
    touchStart.current = e.touches[0].clientX;
  };
  
  const onTouchEnd = (e) => {
    if (touchStart.current === null) return;
    const diff = touchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      setIndex(p => diff > 0 ? (p + 1) % insightsLength : (p - 1 + insightsLength) % insightsLength);
    }
    touchStart.current = null;
  };

  const current = insights[index];
  if (!current) return null;

  return (
    <div className="px-6 py-2 w-full overflow-hidden">
      <Link 
        href={`/tempat/${tempatId}`} 
        className="block no-underline group active:scale-[0.98] transition-all duration-200"
      >
        <div 
          className="relative bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden p-4 shadow-2xl hover:bg-zinc-800/60 transition-colors"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div className={`absolute -right-4 -top-4 w-24 h-24 blur-[50px] opacity-20 rounded-full transition-colors duration-700 ${
            current.isUrgent ? 'bg-red-500' : 'bg-cyan-500'
          }`} />

          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              {current.reportData ? (
                <AvatarImage report={current.reportData} />
              ) : (
                <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30">
                  <span className="text-[10px]">🏠</span>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] font-black text-white/40 tracking-widest uppercase">
                  {current.sourceLabel} • {current.time}
                </span>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-white/20">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </div>
              </div>

              <p className="text-xs text-white/80 leading-relaxed italic line-clamp-2 pr-4">
                "{current.text}"
              </p>

              {/* ✅ Only show dots if more than 1 insight */}
              {insightsLength > 1 && (
                <div className="flex gap-1 mt-3">
                  {insights.map((_, i) => (
                    <div 
                      key={i} 
                      className={`h-0.5 rounded-full transition-all duration-500 ${
                        index === i ? 'w-4 bg-cyan-400' : 'w-1 bg-white/10'
                      }`} 
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}