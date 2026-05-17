"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { formatRelativeTime } from "@/lib/feedEngine";
import { supabase } from "@/lib/supabaseClient";

// ============================================
// 🎯 FUNGSI AVATAR - DIPERBAIKI
// ============================================
const getAvatarUrl = (report, isMe, currentUserAvatar) => {
  if (isMe && currentUserAvatar) return currentUserAvatar;
  if (report?.user_avatar) return report.user_avatar;
  const name = report?.user_name || "Warga";
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff`;
};

const AvatarImage = ({ report, isDark, isMe, currentUserAvatar }) => {
  const [imgError, setImgError] = useState(false);

  const avatarUrl = !imgError ? getAvatarUrl(report, isMe, currentUserAvatar) :
    `https://ui-avatars.com/api/?name=${encodeURIComponent(report?.user_name || "Warga")}&background=0D8ABC&color=fff`;

  return (
    <img
      src={avatarUrl}
      className={`w-7 h-7 rounded-full object-cover ring-2 flex-shrink-0 transition-transform duration-300 hover:scale-105 ${isDark ? 'ring-slate-800' : 'ring-white shadow-sm'
        }`}
      alt={report?.user_name || "avatar"}
      referrerPolicy="no-referrer"
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
  tempatData = null,
  userAvatar = null,
  userProfile = null,
}) {
  const [index, setIndex] = useState(0);
  const [descriptionFromDB, setDescriptionFromDB] = useState(null);
  const [expandedTextId, setExpandedTextId] = useState(null);
  const touchStart = useRef(null);
  const touchMoved = useRef(false);
  const containerRef = useRef(null);
  const autoSlideIntervalRef = useRef(null);

  const isDark = theme?.isMalam || theme?.name === "MALAM";

  // Fetch Info Tempat
  useEffect(() => {
    async function fetchInfo() {
      if (tempatData?.description) {
        setDescriptionFromDB(tempatData.description);
        return;
      }
      if (!tempatId) return;

      const { data } = await supabase
        .from('tempat')
        .select('name, description, category')
        .eq('id', tempatId)
        .single();

      if (data) setDescriptionFromDB({
        text: data.description,
        name: data.name,
        category: data.category
      });
    }
    fetchInfo();
  }, [tempatId, tempatData]);

  // Generate insights
  const insights = useMemo(() => {
    let list = [];

    if (signals?.length > 0) {
      const now = Date.now();
      const recentSignals = signals
        .filter(s => (now - new Date(s.created_at).getTime()) <= 86400000)
        .sort((a, b) => {
          if (currentUser && a.user_id === currentUser.id) return -1;
          if (currentUser && b.user_id === currentUser.id) return 1;
          return new Date(b.created_at) - new Date(a.created_at);
        });

      list = recentSignals.slice(0, 5).map(s => {
        const isMe = currentUser && s.user_id === currentUser.id;
        const authorName = isMe
          ? (currentUser.user_metadata?.full_name || "Anda")
          : (s.user_name || "Warga");

        return {
          id: s.id,
          text: s.deskripsi || s.content || "Update tersedia",
          author: authorName,
          reportData: s,
          time: formatRelativeTime(s.created_at),
          sourceLabel: isMe ? "Laporan Anda" : "Kabar Warga",
          isUrgent: /(macet|kecelakaan|banjir|ramai|antri)/i.test((s.deskripsi || "").toLowerCase()),
          tipe: s.tipe || "Pantauan",
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
        sourceLabel: "Profil Tempat",
        fromDescription: true,
        isUrgent: false,
        tipe: "Informasi",
        isMe: false
      });
    }

    return list;
  }, [signals, currentUser, descriptionFromDB, locationName]);

  const insightsLength = insights.length;

  const pauseAutoSlide = useCallback(() => {
    if (autoSlideIntervalRef.current) {
      clearInterval(autoSlideIntervalRef.current);
      autoSlideIntervalRef.current = null;
    }
  }, []);

  const resumeAutoSlide = useCallback(() => {
    if (autoSlideIntervalRef.current) {
      clearInterval(autoSlideIntervalRef.current);
    }
    if (insightsLength <= 1) return;
    autoSlideIntervalRef.current = setInterval(() => {
      setIndex(prev => (prev + 1) % insightsLength);
    }, 5000);
  }, [insightsLength]);

  // Auto slide
  useEffect(() => {
    if (insightsLength <= 1) return;
    autoSlideIntervalRef.current = setInterval(() => {
      setIndex(prev => (prev + 1) % insightsLength);
    }, 5000);
    return () => {
      if (autoSlideIntervalRef.current) clearInterval(autoSlideIntervalRef.current);
    };
  }, [insightsLength]);

  useEffect(() => {
    if (insightsLength > 0 && index >= insightsLength) {
      setIndex(0);
    }
  }, [index, insightsLength]);

  // Touch handlers untuk swipe
  const onTouchStart = (e) => {
    touchStart.current = e.touches[0].clientX;
    touchMoved.current = false;
  };

  const onTouchMove = (e) => {
    if (!touchStart.current) return;
    const diff = Math.abs(touchStart.current - e.touches[0].clientX);
    if (diff > 10) touchMoved.current = true;
  };

  const onTouchEnd = (e) => {
    if (!touchStart.current || !touchMoved.current || insightsLength <= 1) {
      touchStart.current = null;
      touchMoved.current = false;
      return;
    }

    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart.current - touchEnd;

    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        setIndex(prev => (prev + 1) % insightsLength);
      } else {
        setIndex(prev => (prev - 1 + insightsLength) % insightsLength);
      }
    }

    touchStart.current = null;
    touchMoved.current = false;
  };

  const handleToggleExpand = useCallback((insightId, e) => {
    e.stopPropagation();

    if (expandedTextId === insightId) {
      setExpandedTextId(null);
      resumeAutoSlide();
    } else {
      setExpandedTextId(insightId);
      pauseAutoSlide();

      setTimeout(() => {
        setExpandedTextId(prev => prev === insightId ? null : prev);
        resumeAutoSlide();
      }, 12000);
    }
  }, [expandedTextId, pauseAutoSlide, resumeAutoSlide]);

  const current = insights[index] || insights[0];
  if (!current || insightsLength === 0) return null;

  const needsExpand = current?.text && (
    current.text.length > 100 ||
    (current.text.match(/\n/g) || []).length > 1 ||
    current.text.includes('. ') && current.text.split('. ').length > 2
  );

  const isExpanded = expandedTextId === current.id;

  // Utility untuk warna dinamis sesuai status keaktifan/kegentingan insight
  const getBadgeClass = () => {
    if (current?.isMe) return 'bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-900/30';
    if (current?.isUrgent) return 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/30';
    return 'bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700/50';
  };

  return (
    <div
      ref={containerRef}
      className="px-3 py-2 w-full max-w-full overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className={`relative rounded-2xl border transition-all duration-300 p-3.5 backdrop-blur-md shadow-sm
        ${isDark
          ? "bg-slate-900/40 border-slate-800/60 text-slate-200 shadow-slate-950/20"
          : "bg-white/60 border-slate-100 text-slate-800 shadow-slate-100/40"
        }
        ${current?.isUrgent ? 'ring-1 ring-rose-500/10' : ''}
      `}>

        {/* Header Section */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            {current.reportData ? (
              <AvatarImage
                report={current.reportData}
                isDark={isDark}
                isMe={current.isMe}
                currentUserAvatar={userAvatar}
              />
            ) : (
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shadow-sm shrink-0 ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-50 text-slate-600 border border-slate-100'
                }`}>
                🏠
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className={`text-xs font-bold tracking-tight truncate ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                {current?.author}
              </span>
              <span className="text-[9px] text-slate-400 font-medium tracking-wide">{current?.time}</span>
            </div>
          </div>

          {/* Source Badge Tag */}
          <span className={`text-[9px] font-black tracking-wider uppercase px-2 py-0.5 rounded-md border shrink-0 ${getBadgeClass()}`}>
            {current?.sourceLabel}
          </span>
        </div>

        {/* Content Section */}
        <div className="relative pl-1">
          <p className={`text-[12.5px] leading-relaxed transition-all duration-300 font-medium ${!isExpanded ? 'line-clamp-2' : ''
            } ${isDark ? "text-slate-300" : "text-slate-600"}`}>
            “{current?.text}”
          </p>

          {/* Readmore Button */}
          {needsExpand && (
            <button
              onClick={(e) => handleToggleExpand(current.id, e)}
              className={`text-[10px] font-bold mt-1.5 transition-colors inline-flex items-center gap-1.5 ${isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-700'
                }`}
            >
              <span>{isExpanded ? 'Tutup Detail' : 'Baca Selengkapnya'}</span>
              <svg
                className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
          )}
        </div>

        {/* Bottom Section Indicators */}
        <div className="mt-3 pt-2.5 border-t border-dashed flex justify-between items-center ${
          isDark ? 'border-slate-800' : 'border-slate-100'
        }">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full relative flex ${current?.isUrgent ? 'bg-rose-500' : 'bg-emerald-500'}`}>
              {current?.isUrgent && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              )}
            </span>
            <span className="text-[9px] font-extrabold opacity-70 uppercase tracking-widest text-slate-400">
              {current?.tipe}
            </span>
          </div>

          {/* Animated Sliders Dots */}
          {insightsLength > 1 && (
            <div className="flex gap-1">
              {insights.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  className={`h-1 rounded-full transition-all duration-300 ${index === i
                      ? 'w-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 shadow-sm'
                      : 'w-1 bg-slate-300/60 dark:bg-slate-700'
                    }`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}