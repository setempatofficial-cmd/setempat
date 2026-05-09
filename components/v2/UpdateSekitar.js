"use client";

import { useState, useMemo } from "react";
import { formatRelativeTime } from "@/lib/feedEngine";

export default function UpdateSekitar({ 
  allPlaces = [], 
  onSelectPlace, 
  theme,
  currentUser 
}) {
  const [expanded, setExpanded] = useState(false);
  
  const updates = useMemo(() => {
    const items = [];
    
    for (const place of allPlaces) {
      const reports = place.laporan_terbaru || [];
      const placeName = place.name;
      const placeId = place.id;
      
      for (const report of reports.slice(0, 2)) {
        const isMe = currentUser && report.user_id === currentUser.id;
        const authorName = isMe 
          ? (currentUser.user_metadata?.full_name || "Anda") 
          : (report.user_name || report.username || "Warga");
        
        const reportText = report.deskripsi || report.content || "Update tersedia";
        
        // ✅ Ambil foto dari berbagai kemungkinan field
        const photoUrl = report.photo_url || report.image_url || report.user_avatar;
        
        let urgencyScore = 0;
        const text = (report.deskripsi || report.content || "").toLowerCase();
        const urgentKeywords = {
          'macet': 30, 'kecelakaan': 50, 'banjir': 40,
          'ramai': 25, 'rame': 25, 'antri': 20, 'viral': 35
        };
        
        for (const [keyword, weight] of Object.entries(urgentKeywords)) {
          if (text.includes(keyword)) urgencyScore += weight;
        }
        
        if (report.estimated_people) {
          if (report.estimated_people > 50) urgencyScore += 30;
          else if (report.estimated_people > 20) urgencyScore += 15;
        }
        
        const timeScore = Math.max(0, 50 - (Date.now() - new Date(report.created_at).getTime()) / 60000);
        urgencyScore += Math.min(timeScore, 30);
        
        items.push({
          id: `${placeId}_${report.id}`,
          reportId: report.id,
          placeId,
          placeName,
          name: authorName,
          time: formatRelativeTime(report.created_at),
          text: reportText,
          location: placeName,
          urgencyScore,
          isUrgent: urgencyScore > 30,
          isMe,
          created_at: report.created_at,
          avatar: report.user_avatar,
          photoUrl: photoUrl,  // ✅ Simpan foto
          tipe: report.tipe,
          estimatedPeople: report.estimated_people
        });
      }
    }
    
    items.sort((a, b) => {
      if (a.urgencyScore !== b.urgencyScore) {
        return b.urgencyScore - a.urgencyScore;
      }
      return new Date(b.created_at) - new Date(a.created_at);
    });
    
    return items;
  }, [allPlaces, currentUser]);
  
  const displayUpdates = expanded ? updates : updates.slice(0, 5);
  
  if (updates.length === 0) {
    return (
      <div className="mt-6">
        <h3 className="text-sm font-semibold mb-3">Update Sekitar</h3>
        <div className="text-center py-8 bg-zinc-800/30 rounded-xl">
          <p className="text-sm text-zinc-500">Belum ada update dari warga</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="mt-6 mb-4">
      <h3 className="text-sm font-semibold mb-3">Update Sekitar</h3>
      
      <div className="space-y-3">
        {displayUpdates.map((update) => (
          <button
            key={update.id}
            onClick={() => {
              const targetPlace = allPlaces.find(p => p.id === update.placeId);
              if (targetPlace && onSelectPlace) {
                onSelectPlace(targetPlace);
              }
            }}
            className="w-full text-left"
          >
            <div className={`bg-zinc-800/30 rounded-xl p-3 hover:bg-zinc-800/50 transition-colors border-l-4 ${
              update.isUrgent ? 'border-l-red-500' : 'border-l-cyan-500'
            }`}>
              <div className="flex items-start gap-3">
                
                {/* ✅ FOTO / AVATAR - PRIORITAS FOTO DULU */}
                <div className="flex-shrink-0 w-10 h-10 rounded-full overflow-hidden bg-zinc-700 flex items-center justify-center">
                  {update.photoUrl ? (
                    <img 
                      src={update.photoUrl} 
                      alt="" 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentElement.innerHTML = '<span class="text-lg">👤</span>';
                      }}
                    />
                  ) : update.avatar ? (
                    <img 
                      src={update.avatar} 
                      alt="" 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentElement.innerHTML = '<span class="text-lg">👤</span>';
                      }}
                    />
                  ) : (
                    <span className="text-lg">{update.isMe ? "👤" : "👥"}</span>
                  )}
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{update.name}</span>
                    <span className="text-xs text-zinc-500">{update.time}</span>
                    {update.tipe && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-zinc-700/50 text-zinc-300 rounded-full">
                        {update.tipe}
                      </span>
                    )}
                    {update.isUrgent && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded-full">
                        Urgent
                      </span>
                    )}
                    {update.estimatedPeople && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full">
                        👥 {update.estimatedPeople}+
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-300 mt-1 line-clamp-2">
                    {update.text}
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">
                    📍 {update.location}
                  </p>
                </div>
                
                <div className="flex-shrink-0 text-zinc-500 text-sm">
                  →
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
      
      {updates.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full mt-3 text-center text-sm text-cyan-400 py-2"
        >
          {expanded ? "Tampilkan lebih sedikit" : `Lihat ${updates.length - 5} update lainnya`}
        </button>
      )}
    </div>
  );
}