// lib/userActivityInsight.js
import { supabase } from "@/lib/supabaseClient";

const getHoursAgo = (hours) => {
  const date = new Date();
  date.setHours(date.getHours() - hours);
  return date.toISOString();
};

export async function getPlaceActivityInsight(tempatId, hours = 4) {
  if (!tempatId) return null;

  // 1. Hitung like dari tabel likes
  const { count: likeCount, error: likeError } = await supabase
    .from('likes')
    .select('*', { count: 'exact', head: true })
    .eq('tempat_id', tempatId)
    .gte('created_at', getHoursAgo(hours));
  
  if (likeError) console.warn("Like error:", likeError);

  // 2. Hitung story view dari tabel story_views (diperbaiki)
  // Karena story_views terhubung ke laporan_warga, perlu JOIN
  let storyViewCount = 0;
  
  // Ambil dulu laporan_ids dari tempat ini
  const { data: laporanList, error: laporanError } = await supabase
    .from('laporan_warga')
    .select('id')
    .eq('tempat_id', tempatId);
  
  if (!laporanError && laporanList && laporanList.length > 0) {
    const { count, error: storyError } = await supabase
      .from('story_views')
      .select('*', { count: 'exact', head: true })
      .in('laporan_id', laporanList.map(l => l.id))
      .gte('viewed_at', getHoursAgo(hours));
    
    if (!storyError) storyViewCount = count || 0;
    if (storyError) console.warn("Story views error:", storyError);
  }

  // 3. View detail dari external_signals
  const { data: viewLogs, error: viewError } = await supabase
    .from('external_signals')
    .select('id')
    .eq('tempat_id', tempatId)
    .eq('source', 'user_activity')
    .eq('content', 'view_detail')
    .gte('created_at', getHoursAgo(hours));
  
  if (viewError) console.warn("View logs error:", viewError);
  
  const totalActiveUsers = (likeCount || 0) + storyViewCount + (viewLogs?.length || 0);
  
  // Return insight
  if (totalActiveUsers > 15) {
    return {
      isCrowded: true,
      text: `🔥 ${totalActiveUsers} orang berinteraksi dengan tempat ini dalam ${hours} jam terakhir`,
      level: 'high',
      breakdown: {
        likes: likeCount || 0,
        storyViews: storyViewCount,
        detailViews: viewLogs?.length || 0
      }
    };
  }
  
  if (totalActiveUsers > 5) {
    return {
      isActive: true,
      text: `👀 ${totalActiveUsers} orang tertarik dengan tempat ini`,
      level: 'medium',
      breakdown: {
        likes: likeCount || 0,
        storyViews: storyViewCount,
        detailViews: viewLogs?.length || 0
      }
    };
  }
  
  return null;
}