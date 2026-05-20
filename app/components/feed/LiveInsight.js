"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { formatRelativeTime } from "@/lib/feedEngine";
import { supabase } from "@/lib/supabaseClient";

// ============================================
// 🎯 FUNGSI AVATAR - TETAP SEDERHANA & CEPAT
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
      className={`w-6 h-6 rounded-full object-cover ring-1 flex-shrink-0 transition-transform duration-300 hover:scale-105 ${isDark ? 'ring-slate-800' : 'ring-white shadow-sm'
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
          sourceLabel: isMe ? "Laporan" : "Kabar",
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
        sourceLabel: "Profil",
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

  // Batasan text lebih ketat untuk micro-widget (potong jika > 75 karakter)
  const needsExpand = current?.text && (
    current.text.length > 75 ||
    (current.text.match(/\n/g) || []).length > 0
  );

  const isExpanded = expandedTextId === current.id;

  const getBadgeClass = () => {
    if (current?.isMe) return 'bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-900/20';
    if (current?.isUrgent) return 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/20';
    return 'bg-slate-50 text-slate-500 border-slate-100 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-700/30';
  };

  return (
    <div
      ref={containerRef}
      className="p-1 w-full max-w-full overflow-hidden select-none"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className={`relative rounded-xl border transition-all duration-300 p-2.5 backdrop-blur-md shadow-sm
        ${isDark
          ? "bg-slate-900/30 border-slate-800/50 text-slate-200"
          : "bg-white/50 border-slate-100/80 text-slate-800"
        }
        ${current?.isUrgent ? 'ring-1 ring-rose-500/10' : ''}
      `}>

        {/* Header Section - Dibuat Lebih Rapat */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            {current.reportData ? (
              <AvatarImage
                report={current.reportData}
                isDark={isDark}
                isMe={current.isMe}
                currentUserAvatar={userAvatar}
              />
            ) : (
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] shadow-sm shrink-0 ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500 border border-slate-200/60'
                }`}>
                🏠
              </div>
            )}
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={`text-[11px] font-bold truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                {current?.author}
              </span>
              <span className="text-[9px] text-slate-400/80 shrink-0">• {current?.time}</span>
            </div>
          </div>

          {/* Badge Mengecil */}
          <span className={`text-[8px] font-black tracking-wider uppercase px-1.5 py-0.5 rounded border shrink-0 ${getBadgeClass()}`}>
            {current?.sourceLabel}
          </span>
        </div>

        {/* Content Section - Line clamp diubah jadi 1 baris saat default agar super tipis */}
        <div className="relative px-0.5">
          <p className={`text-[12px] leading-normal transition-all duration-300 ${!isExpanded ? 'line-clamp-1' : 'line-clamp-none'
            } ${isDark ? "text-slate-300/90" : "text-slate-600"}`}>
            “{current?.text}”
          </p>

          {/* Readmore Button */}
          {needsExpand && (
            <button
              onClick={(e) => handleToggleExpand(current.id, e)}
              className={`text-[9px] font-bold mt-1 transition-colors inline-flex items-center gap-1 ${isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-700'
                }`}
            >
              <span>{isExpanded ? 'Tutup' : 'Selengkapnya'}</span>
              <svg
                className={`w-2.5 h-2.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
          )}
        </div>

        {/* Bottom Section - Tipis & Minimalis */}
        <div className="mt-2 pt-1.5 border-t border-dashed flex justify-between items-center border-slate-200/40 dark:border-slate-800/50">
          <div className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full relative flex ${current?.isUrgent ? 'bg-rose-500' : 'bg-emerald-500'}`}>
              {current?.isUrgent && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              )}
            </span>
            <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400/80">
              {current?.tipe}
            </span>
          </div>

          {/* Indicator Dots Mini */}
          {insightsLength > 1 && (
            <div className="flex gap-0.5">
              {insights.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  className={`h-0.5 rounded-full transition-all duration-300 ${index === i
                      ? 'w-2.5 bg-gradient-to-r from-emerald-500 to-teal-500'
                      : 'w-0.5 bg-slate-300/50 dark:bg-slate-700'
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