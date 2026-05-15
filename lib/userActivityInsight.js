// lib/userActivityInsight.js
export async function getPlaceActivityInsight(tempatId, hours = 4) {
  // Hitung like dari tabel likes
  const { count: likeCount } = await supabase
    .from('likes')
    .select('*', { count: 'exact', head: true })
    .eq('tempat_id', tempatId)
    .gte('created_at', getHoursAgo(hours));
  
  // Hitung story view dari tabel story_view
  const { count: storyViewCount } = await supabase
    .from('story_view')
    .select('*', { count: 'exact', head: true })
    .eq('tempat_id', tempatId)
    .gte('created_at', getHoursAgo(hours));
  
  // Bisa tambah dari external_signals jika ada log view_detail nanti
  const { data: viewLogs } = await supabase
    .from('external_signals')
    .select('id')
    .eq('tempat_id', tempatId)
    .eq('source', 'user_activity')
    .eq('content', 'view_detail')
    .gte('created_at', getHoursAgo(hours));
  
  const totalActiveUsers = likeCount + storyViewCount + (viewLogs?.length || 0);
  
  // Return insight
  if (totalActiveUsers > 15) {
    return {
      isCrowded: true,
      text: `🔥 ${totalActiveUsers} orang berinteraksi dengan tempat ini dalam ${hours} jam terakhir`,
      level: 'high'
    };
  }
  
  if (totalActiveUsers > 5) {
    return {
      isActive: true,
      text: `👀 ${totalActiveUsers} orang tertarik dengan tempat ini`,
      level: 'medium'
    };
  }
  
  return null;
}