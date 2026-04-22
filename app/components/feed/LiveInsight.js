"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { formatRelativeTime } from "@/lib/feedEngine";
import { supabase } from "@/lib/supabaseClient";

// ============================================
// 🎯 FUNGSI AVATAR SAMA PERSIS DENGAN CITIZENHUB
// ============================================
const getAvatarUrl = (report) => {
  // Prioritas 1: avatar dari database (user_avatar)
  if (report?.user_avatar) return report.user_avatar;
  // Prioritas 2: fallback ke UI Avatars
  const name = report?.user_name || "Warga";
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff`;
};

// Komponen Avatar dengan error handling
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
  const touchMoved = useRef(false);
  const containerRef = useRef(null);
  
  const isDark = theme?.isMalam || theme?.name === "MALAM";

  // Navigasi dengan loop
  const navigate = useCallback((direction) => {
    setIndex(prev => {
      if (direction === 'next') return (prev + 1) % insightsLength;
      return (prev - 1 + insightsLength) % insightsLength;
    });
  }, []);

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
          reportData: s, // ✅ Kirim seluruh data report untuk avatar
          time: formatRelativeTime(s.created_at),
          sourceLabel: isMe ? "LAPORAN ANDA" : "WARGA",
          isUrgent: /(macet|kecelakaan|banjir|ramai|antri)/i.test((s.deskripsi || "").toLowerCase()),
          tipe: s.tipe || "Update",
          isMe
        };
      });
    }

    // Fallback ke info tempat
    if (list.length === 0 && descriptionFromDB) {
      const text = typeof descriptionFromDB === 'string' ? descriptionFromDB : descriptionFromDB.text;
      list.push({
        id: "desc",
        text: text,
        author: descriptionFromDB.name || locationName,
        reportData: null,
        time: "Terkini",
        sourceLabel: "TENTANG TEMPAT",
        fromDescription: true,
        isUrgent: false,
        tipe: "Informasi"
      });
    }

    return list;
  }, [signals, currentUser, descriptionFromDB, locationName]);

  const insightsLength = insights.length;
  
  // Auto slide
  useEffect(() => {
    if (insightsLength <= 1) return;
    const interval = setInterval(() => {
      setIndex(prev => (prev + 1) % insightsLength);
    }, 5000);
    return () => clearInterval(interval);
  }, [insightsLength]);

  // Fix index jika melebihi length
  useEffect(() => {
    if (insightsLength > 0 && index >= insightsLength) {
      setIndex(0);
    }
  }, [index, insightsLength]);

  // Touch handlers untuk swipe di HP
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

  const current = insights[index] || insights[0];
  if (!current || insightsLength === 0) return null;

  return (
    <div 
      ref={containerRef}
      className="px-3 py-1 w-full max-w-full overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className={`relative rounded-2xl overflow-hidden shadow-sm transition-all duration-300 border-l-[5px] ${
        isDark ? "bg-slate-900/90 border-l-emerald-500" : "bg-white border-l-emerald-600"
      } ${current?.isMe ? '!border-l-orange-500' : ''}`}>
        
        {/* Label Badge */}
        <div className={`absolute top-0 right-0 px-2 py-0.5 rounded-bl-lg text-[8px] font-black text-white z-10 ${
          current?.isMe ? 'bg-gradient-to-r from-orange-500 to-amber-600' : 
          current?.isUrgent ? 'bg-gradient-to-r from-red-500 to-rose-600' : 
          'bg-gradient-to-r from-emerald-500 to-teal-600'
        }`}>
          {current?.sourceLabel}
        </div>

        <div className="p-3">
          {/* Header dengan Avatar - PAKAI KOMPONEN AVATAR YANG SAMA */}
          <div className="flex items-center gap-2 mb-1.5">
            {current.reportData ? (
              <AvatarImage report={current.reportData} isDark={isDark} />
            ) : (
              <div className={`w-7 h-7 rounded-full flex items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-gray-200'}`}>
                <span className="text-[20px] font-bold">🏠</span>
              </div>
            )}
            <div className="flex flex-col min-w-0 flex-1">
              <span className={`text-[11px] font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {current?.author}
              </span>
              <span className="text-[8px] opacity-50 uppercase tracking-wide">{current?.time}</span>
            </div>
          </div>

          {/* Content */}
          <div className="min-h-[40px] flex items-center">
            <p className={`text-[12px] leading-relaxed line-clamp-2 italic ${isDark ? "text-slate-300" : "text-slate-600"}`}>
              “{current?.text}”
            </p>
          </div>

          {/* Footer Indicators */}
          <div className="mt-2 flex justify-between items-center">
            <div className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${current?.isUrgent ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`}></span>
              <span className="text-[8px] font-bold opacity-60 uppercase tracking-wide">{current?.tipe}</span>
            </div>
            
            {/* Dot Indicators */}
            {insightsLength > 1 && (
              <div className="flex gap-1.5">
                {insights.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setIndex(i)}
                    className={`h-1 rounded-full transition-all duration-300 ${
                      index === i ? 'w-3 bg-emerald-500' : 'w-1 bg-slate-300'
                    }`}
                    aria-label={`Go to slide ${i + 1}`}
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