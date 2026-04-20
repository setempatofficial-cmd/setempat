// lib/kentongan.js
import { supabase } from "@/lib/supabaseClient";

// ========== UNTUK FEED (BREAK CARD) ==========
export async function getKentonganForFeed(userId) {
  if (!userId) return [];
  
  try {
    // 1. Ambil profile user - dengan error handling lebih baik
    let profile = null;
    
    // Coba dari tabel profiles dulu
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("desa, kecamatan")
      .eq("id", userId)
      .maybeSingle(); // ✅ Ganti .single() dengan .maybeSingle()
    
    if (profileError) {
      // Log detail error untuk debugging
      console.warn("Profile fetch error details:", {
        code: profileError.code,
        message: profileError.message,
        details: profileError.details,
        hint: profileError.hint
      });
      
      // Jika tabel profiles tidak ada, coba dari users
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("desa, kecamatan")
        .eq("id", userId)
        .maybeSingle();
      
      if (!userError && userData) {
        profile = userData;
      }
    } else {
      profile = profileData;
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
      console.warn("Kentongan fetch error:", error.message);
      return [];
    }
    
    if (!data || data.length === 0) {
      return [];
    }
    
    // 3. Filter berdasarkan lokasi user
    let filtered = data;
    
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
    console.warn("Unexpected error in getKentonganForFeed:", err.message);
    return [];
  }
}

// ========== UNTUK TAB KENTONGAN DI WORO ==========
export async function getAllKentongan() {
  try {
    const { data, error } = await supabase
      .from("kentongan")
      .select("*")
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);
    
    if (error) {
      console.warn("getAllKentongan error:", error.message);
      return [];
    }
    
    return data || [];
  } catch (err) {
    console.warn("Unexpected error in getAllKentongan:", err.message);
    return [];
  }
}

// ========== UNTUK ADMIN KIRIM KENTONGAN ==========
export async function sendKentongan(payload) {
  try {
    const { data, error } = await supabase
      .from("kentongan")
      .insert(payload)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error("Error sending kentongan:", err.message);
    throw err;
  }
}

// ========== UNTUK DELETE ==========
export async function deleteKentongan(id) {
  try {
    const { error } = await supabase
      .from("kentongan")
      .delete()
      .eq("id", id);
    
    if (error) throw error;
    return true;
  } catch (err) {
    console.error("Error deleting kentongan:", err.message);
    throw err;
  }
}