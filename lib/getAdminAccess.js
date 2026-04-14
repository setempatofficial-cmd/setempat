// lib/getAdminAccess.js
import { supabase } from "@/lib/supabaseClient";

/**
 * Ambil semua tempat (untuk superadmin) - SAMA PERSIS DENGAN LaporPanel
 */
export async function getAllTempat() {
  try {
    console.log("🔍 Fetching all tempat from feed_view...");
    
    // SAMA PERSIS dengan fetchTempatList di LaporPanel.js
    const { data, error } = await supabase
      .from("feed_view")
      .select("id, name, category, alamat")
      .limit(30);  // Pakai limit 30 seperti di LaporPanel
      
    if (error) {
      console.error("Error fetching places:", error);
      return [];
    }
    
    console.log(`✅ Success: ${data?.length || 0} tempat ditemukan`);
    
    // Format output sesuai yang dibutuhkan UploadModal
    return (data || []).map(item => ({
      id: item.id,
      nama: item.name || "Tempat Tanpa Nama",
      lokasi: item.category || "",
      alamat: item.alamat || ""
    }));
    
  } catch (err) {
    console.error("Error in getAllTempat:", err);
    return [];
  }
}

/**
 * Ambil tempat yang bisa diakses admin (dari tabel admin_tempat)
 */
export async function getAdminTempatDetails(userId) {
  if (!userId) return [];
  
  try {
    // Step 1: Ambil daftar tempat_id dari admin_tempat
    const { data: adminAccess, error: accessError } = await supabase
      .from("admin_tempat")
      .select("tempat_id")
      .eq("user_id", userId);
    
    if (accessError) {
      console.error("Error fetching admin access:", accessError);
      return [];
    }
    
    if (!adminAccess || adminAccess.length === 0) {
      console.log("No admin access found for user:", userId);
      return [];
    }
    
    const tempatIds = adminAccess.map(a => a.tempat_id);
    console.log("Admin has access to tempat_ids:", tempatIds);
    
    // Step 2: Ambil detail tempat dari feed_view (sama seperti LaporPanel)
    const { data, error } = await supabase
      .from("feed_view")
      .select("id, name, category, alamat")
      .in("id", tempatIds)
      .limit(30);
      
    if (error) {
      console.error("Error fetching admin tempat details:", error);
      return [];
    }
    
    console.log(`✅ Admin: ${data?.length || 0} tempat ditemukan`);
    
    return (data || []).map(item => ({
      id: item.id,
      nama: item.name || "Tempat Tanpa Nama",
      lokasi: item.category || "",
      alamat: item.alamat || ""
    }));
    
  } catch (err) {
    console.error("Error in getAdminTempatDetails:", err);
    return [];
  }
}

/**
 * Get daftar tempat berdasarkan role (SUPER SIMPLE)
 */
export async function getUserAccessibleTempat(userId, role) {
  console.log(`🔍 getUserAccessibleTempat - role: ${role}, userId: ${userId}`);
  
  if (role === 'superadmin') {
    return await getAllTempat();
  }
  
  if (role === 'admin') {
    return await getAdminTempatDetails(userId);
  }
  
  console.log(`Role ${role} has no access`);
  return [];
}

/**
 * Cek akses admin ke tempat tertentu
 */
export async function checkAdminAccess(userId, tempatId) {
  if (!userId || !tempatId) return false;
  
  const { data, error } = await supabase
    .from("admin_tempat")
    .select("id")
    .eq("user_id", userId)
    .eq("tempat_id", tempatId)
    .maybeSingle();
  
  return !error && data !== null;
}