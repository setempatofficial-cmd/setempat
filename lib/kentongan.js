// lib/kentongan.js
import { supabase } from "@/lib/supabaseClient";

// ========== UNTUK FEED (BREAK CARD) ==========
export async function getKentonganForFeed(userId) {
  if (!userId) return [];
  
  try {
    // 1. Ambil profile user untuk tahu desa/kecamatannya
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("desa, kecamatan")
      .eq("id", userId)
      .single();
    
    if (profileError) {
      console.error("Error fetching profile:", profileError);
      return [];
    }
    
    // 2. Ambil kentongan aktif
    const { data, error } = await supabase
      .from("kentongan")
      .select("*")
      .order("is_urgent", { ascending: false })
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(10);
    
    if (error) {
      console.error("Error fetching kentongan:", error);
      return [];
    }
    
    // 3. Filter berdasarkan lokasi user
    let filtered = data || [];
    
    if (profile?.desa) {
      filtered = filtered.filter(item => {
        // Global: tampilkan ke semua
        if (item.is_global === true) return true;
        // Target spesifik: harus match desa user
        if (item.target_desa === profile.desa) return true;
        return false;
      });
    } else {
      // User tanpa desa: hanya global
      filtered = filtered.filter(item => item.is_global === true);
    }
    
    return filtered.slice(0, 3); // Maksimal 3 kentongan di feed
    
  } catch (err) {
    console.error("Error in getKentonganForFeed:", err);
    return [];
  }
}

// ========== UNTUK TAB KENTONGAN DI WORO ==========
export async function getAllKentongan() {
  const { data, error } = await supabase
    .from("kentongan")
    .select("*")
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);
  
  if (error) throw error;
  return data || [];
}

// ========== UNTUK ADMIN KIRIM KENTONGAN ==========
export async function sendKentongan(payload) {
  const { data, error } = await supabase
    .from("kentongan")
    .insert(payload)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// ========== UNTUK DELETE (OPSIONAL) ==========
export async function deleteKentongan(id) {
  const { error } = await supabase
    .from("kentongan")
    .delete()
    .eq("id", id);
  
  if (error) throw error;
  return true;
}