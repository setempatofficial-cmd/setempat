"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

// Format waktu relatif
const formatRelativeTime = (dateString) => {
  if (!dateString) return "";
  const now = new Date();
  const past = new Date(dateString);
  const diffInMin = Math.floor((now - past) / 60000);
  
  if (diffInMin < 1) return "Baru saja";
  if (diffInMin < 60) return `${diffInMin}m lalu`;
  if (diffInMin < 1440) return `${Math.floor(diffInMin / 60)}j lalu`;
  return past.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
};

const getAvatarUrl = (report) => {
  // ✅ Pakai user_avatar dari tabel
  if (report?.user_avatar) return report.user_avatar;
  const name = report?.user_name || report?.username || "Warga";
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff`;
};

const AvatarImage = ({ report, isDark }) => {
  const [imgError, setImgError] = useState(false);
  
  const avatarUrl = !imgError ? getAvatarUrl(report) : 
    `https://ui-avatars.com/api/?name=${encodeURIComponent(report?.user_name || "Warga")}&background=0D8ABC&color=fff`;
  
  return (
    <img 
      src={avatarUrl}
      className={`w-7 h-7 rounded-full object-cover ring-1 flex-shrink-0 ${isDark ? 'ring-slate-700' : 'ring-slate-100'}`}
      alt={report?.user_name || "avatar"}
      referrerPolicy="no-referrer"
      onError={() => setImgError(true)}
      loading="lazy"
    />
  );
};

export default function LiveInsightMulti({ 
  allPlaces = [], 
  theme, 
  currentUser = null,
  onSelectPlace = null,
  maxItems = 10
}) {
  const [index, setIndex] = useState(0);
  const touchStart = useRef(null);
  const touchMoved = useRef(false);
  const containerRef = useRef(null);
  
  const isDark = theme?.isMalam || theme?.name === "MALAM";

  // Generate insights dari laporan_warga
  const insights = useMemo(() => {
    let allReports = [];
    
    for (const place of allPlaces) {
      // ✅ laporan_terbaru dari feed_view berisi data laporan_warga
      const reports = place.laporan_terbaru || [];
      const placeName = place.name;
      const placeId = place.id;
      
      for (const report of reports) {
        const isMe = currentUser && report.user_id === currentUser.id;
        const authorName = isMe 
          ? (currentUser.user_metadata?.full_name || "Anda") 
          : (report.user_name || report.username || "Warga");
        
        const reportText = report.deskripsi || report.content || "Update tersedia";
        
        let urgencyScore = 0;
        const text = (report.deskripsi || report.content || "").toLowerCase();
        const urgentKeywords = ['macet', 'kecelakaan', 'banjir', 'ramai', 'antri', 'viral', 'demo', 'kebakaran'];
        for (const keyword of urgentKeywords) {
          if (text.includes(keyword)) urgencyScore += 20;
        }
        
        if (report.estimated_people) {
          if (report.estimated_people > 50) urgencyScore += 30;
          else if (report.estimated_people > 20) urgencyScore += 15;
        }
        
        if (place.isViral) urgencyScore += 50;
        if (place.isRamai) urgencyScore += 25;
        
        const timeScore = Math.max(0, 50 - (Date.now() - new Date(report.created_at).getTime()) / 60000);
        urgencyScore += Math.min(timeScore, 30);
        
        allReports.push({
          id: `${placeId}_${report.id}`,
          reportId: report.id,
          placeId: placeId,
          placeName: placeName,
          text: reportText,
          author: authorName,
          reportData: report,
          time: formatRelativeTime(report.created_at),
          sourceLabel: isMe ? "LAPORAN ANDA" : (report.tipe || "WARGA"),
          isUrgent: urgencyScore > 30,
          tipe: report.tipe || "Update",
          isMe: isMe,
          urgencyScore: urgencyScore,
          created_at: report.created_at,
          estimatedPeople: report.estimated_people
        });
      }
    }
    
    // Urutkan berdasarkan urgency score
    allReports.sort((a, b) => {
      if (a.urgencyScore !== b.urgencyScore) {
        return b.urgencyScore - a.urgencyScore;
      }
      return new Date(b.created_at) - new Date(a.created_at);
    });
    
    return allReports.slice(0, maxItems);
  }, [allPlaces, currentUser, maxItems]);

  const insightsLength = insights.length;
  
  const navigate = useCallback((direction) => {
    setIndex(prev => {
      if (direction === 'next') return (prev + 1) % insightsLength;
      return (prev - 1 + insightsLength) % insightsLength;
    });
  }, [insightsLength]);

  useEffect(() => {
    if (insightsLength <= 1) return;
    const interval = setInterval(() => {
      setIndex(prev => (prev + 1) % insightsLength);
    }, 5000);
    return () => clearInterval(interval);
  }, [insightsLength]);

  useEffect(() => {
    if (insightsLength > 0 && index >= insightsLength) {
      setIndex(0);
    }
  }, [index, insightsLength]);

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

  const handleInsightClick = () => {
    const currentInsight = insights[index];
    if (currentInsight && onSelectPlace && currentInsight.placeId) {
      const targetPlace = allPlaces.find(p => p.id === currentInsight.placeId);
      if (targetPlace) {
        onSelectPlace(targetPlace);
      }
    }
  };

  if (insightsLength === 0) {
    return (
      <div className="px-3 py-4 text-center">
        <p className={`text-sm opacity-50 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Belum ada update dari warga sekitar
        </p>
      </div>
    );
  }

  const current = insights[index];

  return (
    <div 
      ref={containerRef}
      className="px-3 py-1 w-full max-w-full overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div 
        onClick={handleInsightClick}
        className={`cursor-pointer rounded-2xl overflow-hidden shadow-sm transition-all duration-300 border-l-[5px] ${
          isDark ? "bg-slate-900/90 border-l-emerald-500" : "bg-white border-l-emerald-600"
        } ${current?.isMe ? '!border-l-orange-500' : ''}`}
      >
        <div className={`absolute top-0 right-0 px-2 py-0.5 rounded-bl-lg text-[8px] font-black text-white z-10 ${
          current?.isMe ? 'bg-gradient-to-r from-orange-500 to-amber-600' : 
          current?.isUrgent ? 'bg-gradient-to-r from-red-500 to-rose-600' : 
          'bg-gradient-to-r from-emerald-500 to-teal-600'
        }`}>
          {current?.sourceLabel}
        </div>

        <div className="p-3">
          <div className="flex items-center gap-2 mb-1.5">
            {current.reportData ? (
              <AvatarImage report={current.reportData} isDark={isDark} />
            ) : (
              <div className={`w-7 h-7 rounded-full flex items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-gray-200'}`}>
                <span className="text-[20px] font-bold">📍</span>
              </div>
            )}
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center gap-1 flex-wrap">
                <span className={`text-[11px] font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {current?.author}
                </span>
                <span className="text-[8px] opacity-50">·</span>
                <span className={`text-[9px] font-medium truncate ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                  📍 {current?.placeName}
                </span>
              </div>
              <span className="text-[8px] opacity-50 uppercase tracking-wide">{current?.time}</span>
            </div>
          </div>

          <div className="min-h-[40px] flex items-center">
            <p className={`text-[12px] leading-relaxed line-clamp-2 italic ${isDark ? "text-slate-300" : "text-slate-600"}`}>
              “{current?.text}”
            </p>
          </div>

          <div className="mt-2 flex justify-between items-center">
            <div className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${current?.isUrgent ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`}></span>
              <span className="text-[8px] font-bold opacity-60 uppercase tracking-wide">{current?.tipe}</span>
              {current?.estimatedPeople && (
                <span className="text-[8px] font-bold opacity-60 ml-1">
                  👥 {current.estimatedPeople}+
                </span>
              )}
            </div>
            
            {insightsLength > 1 && (
              <div className="flex gap-1.5">
                {insights.map((_, i) => (
                  <button
                    key={i}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIndex(i);
                    }}
                    className={`h-1 rounded-full transition-all duration-300 ${
                      index === i ? 'w-3 bg-emerald-500' : 'w-1 bg-slate-300'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}