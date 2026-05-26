// lib/supabaseQueries.ts
import { supabase } from "./supabaseClient";

export async function getPostDetailEnriched(tempatId: number) {
  const { data, error } = await supabase
    .from("post_detail_enriched")
    .select("*")
    .eq("id", tempatId)
    .single();

  if (error) {
    console.error("Error fetching post detail:", error);
    return null;
  }

  return data;
}

// Ambil khusus laporan unggulan untuk StoryStrip
export async function getFeaturedReports(tempatId: number, limit = 10) {
  const { data, error } = await supabase
    .from("laporan_warga")
    .select("*")
    .eq("tempat_id", tempatId)
    .eq("is_visible", true)
    .eq("status", "approved")
    .order("is_featured", { ascending: false })
    .order("vibe_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return [];
  return data || [];
}

// Ambil cerita sejarah
export async function getPlaceHistory(tempatId: number) {
  const { data, error } = await supabase
    .from("tempat_insiden_historis")
    .select("*")
    .eq("tempat_id", tempatId)
    .eq("is_verified", true)
    .order("tanggal_mulai", { ascending: false })
    .limit(5);

  if (error) return [];
  return data || [];
}

// Ambil aktivitas berkala
export async function getRecurringActivities(tempatId: number) {
  const { data, error } = await supabase
    .from("tempat_aktivitas_berkala")
    .select("*")
    .eq("tempat_id", tempatId)
    .eq("is_active", true)
    .order(
      `CASE hari 
        WHEN 'Senin' THEN 1 
        WHEN 'Selasa' THEN 2 
        WHEN 'Rabu' THEN 3 
        WHEN 'Kamis' THEN 4 
        WHEN 'Jumat' THEN 5 
        WHEN 'Sabtu' THEN 6 
        WHEN 'Minggu' THEN 7 
        ELSE 8 
      END`
    )
    .limit(8);

  if (error) return [];
  return data || [];
}