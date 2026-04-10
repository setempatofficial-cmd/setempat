"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { formatRelativeTime } from "@/lib/feedEngine";
import { useDataContext } from "@/contexts/DataContext";
import { generateFallbackInsight } from "@/lib/insightTone";
import { supabase } from "@/lib/supabaseClient";

export default function LiveInsight({ 
  signals, 
  theme, 
  locationName = "Sekitar", 
  currentUser = null,
  tempatId = null,
  placeCategory = "umum"
}) {
  const [index, setIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [userAvatars, setUserAvatars] = useState({});
  const { feedData, getAIContext } = useDataContext();
  
  // Ref untuk handle swipe manual
  const touchStart = useRef(null);

  const isDark = theme?.isMalam || theme?.name === "MALAM";

  // --- LOGIC: DATA FETCHING (ASLI) ---
  const effectiveSignals = useMemo(() => {
    if (signals?.length > 0) return signals;
    if (tempatId) return getAIContext(tempatId)?.recentReports || [];
    return feedData || [];
  }, [signals, tempatId, getAIContext, feedData]);

  // 🔥 FETCH AVATAR (ASLI)
  useEffect(() => {
    const fetchAvatars = async () => {
      const userIds = [...new Set(
        effectiveSignals
          .filter(s => s.user_id && !s.source_platform)
          .map(s => s.user_id)
      )];
      if (userIds.length === 0) return;
      try {
        const { data, error } = await supabase.from('profiles').select('id, avatar_url').in('id', userIds);
        if (data && !error) {
          const avatarMap = {};
          data.forEach(profile => { avatarMap[profile.id] = profile.avatar_url; });
          setUserAvatars(avatarMap);
        }
      } catch (err) { console.error('Error fetching avatars:', err); }
    };
    fetchAvatars();
  }, [effectiveSignals]);

  // --- LOGIC: DATA MAPPING (ASLI - SEMUA KONDISI DIKEMBALIKAN) ---
  const insights = useMemo(() => {
    const getSourceInfo = (item) => {
      const platform = (item.source_platform || item.source || "").toLowerCase();
      const isFromWarga = item.user_id && !item.source_platform;
      const username = item.username || item.user_name || "";
      const userId = item.user_id;
      
      if (isFromWarga || (!item.source_platform && item.user_name)) {
        let name = item.user_name || "Warga";
        let avatarUrl = userAvatars[userId];
        if (currentUser && item.user_id === currentUser.id) {
          name = currentUser.user_metadata?.full_name || name;
          avatarUrl = currentUser.user_metadata?.avatar_url || avatarUrl;
        }
        return { icon: avatarUrl ? null : "👤", avatarUrl, name, source: "warga", label: "CERITA WARGA" };
      }
      
      const platforms = {
        instagram: { icon: "📷", label: "INSTAGRAM" },
        tiktok: { icon: "🎵", label: "TIKTOK" },
        facebook: { icon: "📘", label: "FACEBOOK" },
        wartabromo: { icon: "📰", label: "WARTABROMO" },
        'radar bromo': { icon: "📰", label: "RADAR BROMO" },
        news: { icon: "📰", label: "MEDIA" }
      };

      const info = platforms[platform] || { icon: "📍", label: "UPDATE" };
      return { 
        icon: info.icon, 
        name: username || info.label, 
        isVerified: item.verified || platform.includes('bromo'), 
        source: platform === 'radar bromo' ? 'radarbromo' : platform,
        label: info.label
      };
    };

    if (!effectiveSignals?.length) return [generateFallbackInsight(locationName)];

    const recentSignals = effectiveSignals.filter(item => {
      const date = new Date(item.created_at || item.timestamp);
      return !isNaN(date) && (Date.now() - date.getTime()) <= 86400000;
    });

    if (recentSignals.length === 0) return [generateFallbackInsight(locationName)];

    return recentSignals
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5)
      .map(s => {
        const sourceInfo = getSourceInfo(s);
        const isUrgent = /(macet|kecelakaan|banjir|kebakaran|ramai|padat|antri|longsor)/i.test(
          (s.tipe || s.content || s.deskripsi || "").toLowerCase()
        );
        
        let text = s.deskripsi || s.content || "Update tersedia";
        if (s.estimated_wait_time) text += `, antri ${s.estimated_wait_time}m`;
        if (text.length > 120) text = text.substring(0, 117) + "...";

        return {
          ...s, text, author: sourceInfo.name, icon: sourceInfo.icon, avatarUrl: sourceInfo.avatarUrl,
          isVerified: sourceInfo.isVerified, time: formatRelativeTime(s.created_at),
          sourceLabel: sourceInfo.label, sourceType: sourceInfo.source, isUrgent,
          isAi: !!(s.is_ai || s.deskripsi_ai)
        };
      });
  }, [effectiveSignals, locationName, currentUser, placeCategory, userAvatars]);

  // --- LOGIC: NAVIGATION (Pindah Manual) ---
  const navigate = (direction) => {
    setIsVisible(false);
    setTimeout(() => {
      if (direction === 'next') setIndex((prev) => (prev + 1) % insights.length);
      else setIndex((prev) => (prev - 1 + insights.length) % insights.length);
      setIsVisible(true);
    }, 300);
  };

  // --- LOGIC: AUTO-SLIDE (ASLI) ---
  useEffect(() => {
    if (insights.length <= 1) return;
    const interval = setInterval(() => navigate('next'), 5000);
    return () => clearInterval(interval);
  }, [insights]);

  // --- LOGIC: SWIPE GESTURE ---
  const onTouchStart = (e) => touchStart.current = e.touches[0].clientX;
  const onTouchEnd = (e) => {
    if (!touchStart.current) return;
    const touchEnd = e.changedTouches[0].clientX;
    if (touchStart.current - touchEnd > 70) navigate('next'); // Swipe Kiri
    if (touchStart.current - touchEnd < -70) navigate('prev'); // Swipe Kanan
    touchStart.current = null;
  };

  const current = insights[index] || insights[0] || {};

  const getThemeColor = () => {
    if (current?.tipe === 'Ramai') return 'bg-yellow-500';
    if (current?.tipe === 'Antri') return 'bg-rose-500';
    if (current?.tipe === 'Sepi') return 'bg-emerald-500';
    if (current?.isUrgent) return 'bg-rose-600';
    if (current?.isAi) return 'bg-cyan-400';
    return isDark ? 'bg-emerald-400' : 'bg-emerald-600';
  };

  return (
    <div 
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className={`rounded-[32px] p-6 border transition-all duration-700 relative overflow-hidden shadow-xl backdrop-blur-xl cursor-grab active:cursor-grabbing ${
        isDark ? "bg-slate-900/60 border-white/10" : "bg-white/90 border-slate-200/60"
      }`}
    >
      {/* Background Glow */}
      <div className={`absolute -right-4 -top-4 w-32 h-32 blur-[50px] rounded-full opacity-20 transition-colors duration-1000 ${getThemeColor()}`} />

      <div className="flex items-start gap-4 relative z-10">
        {/* Live Pulse */}
        <div className="mt-2 relative flex h-2.5 w-2.5">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${getThemeColor()}`} />
          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${getThemeColor()}`} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className={`flex items-center gap-2 mb-2 transition-all duration-500 ${isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"}`}>
            {current?.avatarUrl ? (
              <img src={current.avatarUrl} alt={current.author} className="w-5 h-5 rounded-full object-cover border border-white/20" />
            ) : (
              <span className="text-xs">{current?.icon}</span>
            )}
            
            <span className={`text-[10px] font-black uppercase tracking-[0.2em] truncate ${current?.isAi ? 'text-cyan-500' : isDark ? 'text-slate-300' : 'text-slate-500'}`}>
              {current?.isAi ? "✨ AI WARGA LOKAL" : current?.author}
            </span>
            
            {current?.isVerified && (
              <svg className="w-3.5 h-3.5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
              </svg>
            )}
            <span className="ml-auto text-[10px] font-bold italic opacity-40 whitespace-nowrap">{current?.time}</span>
          </div>

          {/* Content */}
          <p className={`text-[16px] font-bold leading-snug tracking-tight transition-all duration-700 min-h-[48px] ${
            isVisible ? "opacity-100 scale-100" : "opacity-0 scale-[0.98]"
          } ${isDark ? "text-slate-100" : "text-slate-800"}`}>
            "{current?.text}"
          </p>

          {/* Footer Area */}
          <div className="mt-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 opacity-80">
                <span className="text-xs">{current?.icon}</span>
                <span className={`text-[9px] font-black tracking-[0.1em] ${
                  current?.sourceType === 'instagram' ? 'text-pink-500' :
                  current?.sourceType === 'tiktok' ? 'text-slate-400' :
                  current?.sourceType === 'wartabromo' ? 'text-blue-400' :
                  'text-slate-500'
                }`}>
                  {current?.sourceLabel}
                </span>
              </div>
              <span className={`text-[9px] font-black tracking-widest ${
                current?.tipe === 'Ramai' ? 'text-yellow-500' : 
                current?.tipe === 'Antri' ? 'text-rose-500' : 
                isDark ? 'text-emerald-400/70' : 'text-emerald-600/70'
              }`}>
                {current?.estimated_people ? `👥 ${current.estimated_people} ORG` : (current?.tipe || "UPDATE")}
              </span>
            </div>

            {/* Progress Bar Sinkron */}
            <div className={`h-1.5 w-full rounded-full overflow-hidden ${isDark ? "bg-white/5" : "bg-slate-100"}`}>
              <div
                key={`${index}-${isVisible}`} // Reset animasi saat pindah
                className={`h-full transition-all duration-[5000ms] ease-linear ${getThemeColor()}`}
                style={{ width: isVisible ? '100%' : '0%' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}