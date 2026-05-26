// app/api/tempat/[id]/detail/route.ts
export async function GET(req, { params }) {
  const { id } = params;
  
  // Query paralel
  const [tempat, sejarah, aktivitas, laporan] = await Promise.all([
    supabase.from('tempat').select('*').eq('id', id).single(),
    supabase.from('tempat_insiden_historis').select('*').eq('tempat_id', id).eq('is_verified', true).order('tanggal_mulai', { ascending: false }).limit(3),
    supabase.from('tempat_aktivitas_berkala').select('*').eq('tempat_id', id).eq('is_active', true).limit(5),
    supabase.from('laporan_warga').select('*').eq('tempat_id', id).eq('is_visible', true).order('vibe_count', { ascending: false }).limit(10)
  ]);
  
  return Response.json({ tempat, sejarah, aktivitas, laporan });
}