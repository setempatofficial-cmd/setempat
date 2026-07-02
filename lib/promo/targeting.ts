import { supabase } from "@/lib/supabaseClient";

export interface TargetingOptions {
  targetType: 'all' | 'radius' | 'region' | 'role' | 'active' | 'premium';
  radiusKm?: number;
  latitude?: number;
  longitude?: number;
  province?: string;
  city?: string;
  district?: string;
  village?: string;
  roles?: string[];
  activeDays?: number;
}

export interface PromoData {
  title: string;
  message: string;
  promoType: string;
  redirectUrl: string;
  ctaText: string;
  imageUrl?: string;
  discountValue?: string;
  discountCode?: string;
  validUntil?: string;
  targeting: TargetingOptions;
}

/**
 * Get targeted users based on targeting options
 */
export async function getTargetedUsers(targeting: TargetingOptions): Promise<string[]> {
  let query = supabase.from("profiles").select("id");

  switch (targeting.targetType) {
    case 'all':
      // Semua user
      break;

    case 'radius':
      // User dalam radius tertentu
      if (targeting.latitude && targeting.longitude && targeting.radiusKm) {
        const { data } = await supabase.rpc('get_users_in_radius', {
          lat: targeting.latitude,
          lng: targeting.longitude,
          radius_km: targeting.radiusKm
        });
        return data?.map(d => d.user_id) || [];
      }
      break;

    case 'region':
      // User berdasarkan wilayah
      const { data: regionUsers } = await supabase.rpc('get_users_by_region', {
        p_province: targeting.province || null,
        p_city: targeting.city || null,
        p_district: targeting.district || null,
        p_village: targeting.village || null
      });
      return regionUsers?.map(d => d.user_id) || [];

    case 'role':
      // User berdasarkan role
      if (targeting.roles && targeting.roles.length > 0) {
        const { data } = await supabase
          .from("profiles")
          .select("id")
          .in("role", targeting.roles);
        return data?.map(d => d.id) || [];
      }
      break;

    case 'active':
      // User aktif dalam N hari terakhir
      if (targeting.activeDays) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - targeting.activeDays);
        
        const { data } = await supabase
          .from("profiles")
          .select("id")
          .gt("last_active", cutoff.toISOString());
        return data?.map(d => d.id) || [];
      }
      break;

    case 'premium':
      // User premium (punya subscription aktif)
      const { data: premiumUsers } = await supabase
        .from("voucher_transactions")
        .select("user_id")
        .eq("status", "active")
        .eq("voucher_id", "subscription_voucher_id")
        .gt("expired_at", new Date().toISOString());
      return premiumUsers?.map(d => d.user_id) || [];

    default:
      break;
  }

  // Fallback: ambil semua user
  const { data } = await supabase.from("profiles").select("id");
  return data?.map(d => d.id) || [];
}

/**
 * Send promo to targeted users
 */
export async function sendPromo(promoData: PromoData, adminUserId: string) {
  // 1. Dapatkan user target
  const targetUsers = await getTargetedUsers(promoData.targeting);
  
  if (targetUsers.length === 0) {
    throw new Error("Tidak ada user yang sesuai dengan target");
  }

  // 2. Simpan ke promo_notifications
  const { data: promo, error: promoError } = await supabase
    .from("promo_notifications")
    .insert({
      title: promoData.title,
      message: promoData.message,
      promo_type: promoData.promoType,
      image_url: promoData.imageUrl || null,
      redirect_url: promoData.redirectUrl,
      cta_text: promoData.ctaText,
      discount_value: promoData.discountValue || null,
      discount_code: promoData.discountCode || null,
      valid_until: promoData.validUntil || null,
      target_type: promoData.targeting.targetType,
      target_radius_km: promoData.targeting.radiusKm || null,
      target_latitude: promoData.targeting.latitude || null,
      target_longitude: promoData.targeting.longitude || null,
      target_province: promoData.targeting.province || null,
      target_city: promoData.targeting.city || null,
      target_district: promoData.targeting.district || null,
      target_village: promoData.targeting.village || null,
      target_roles: promoData.targeting.roles || null,
      target_active_days: promoData.targeting.activeDays || null,
      created_by: adminUserId,
      sent_at: new Date().toISOString()
    })
    .select()
    .single();

  if (promoError) throw promoError;

  // 3. Batch insert ke warung_info
  const batchSize = 100;
  let inserted = 0;

  for (let i = 0; i < targetUsers.length; i += batchSize) {
    const batch = targetUsers.slice(i, i + batchSize);
    const notifications = batch.map(userId => ({
      user_id: userId,
      title: promoData.title,
      message: promoData.message,
      type: `promo_${promoData.promoType}`,
      is_read: false,
      created_at: new Date().toISOString(),
      metadata: {
        promo_id: promo.id,
        redirect_url: promoData.redirectUrl,
        cta_text: promoData.ctaText,
        discount_value: promoData.discountValue,
        discount_code: promoData.discountCode,
        promo_type: promoData.promoType,
        target_type: promoData.targeting.targetType,
        sent_by: adminUserId
      }
    }));

    const { error: insertError } = await supabase
      .from("warung_info")
      .insert(notifications);

    if (insertError) throw insertError;
    inserted += batch.length;
  }

  // 4. Simpan recipients untuk tracking
  const recipients = targetUsers.map(userId => ({
    promo_id: promo.id,
    user_id: userId,
    created_at: new Date().toISOString()
  }));

  await supabase
    .from("promo_recipients")
    .insert(recipients);

  return {
    promoId: promo.id,
    totalUsers: targetUsers.length,
    inserted: inserted
  };
}

/**
 * Get promo statistics
 */
export async function getPromoStats(promoId: string) {
  const { data } = await supabase
    .from("promo_recipients")
    .select(`
      *,
      profiles:user_id (full_name, username, city, role)
    `)
    .eq("promo_id", promoId);

  const total = data?.length || 0;
  const read = data?.filter(d => d.is_read).length || 0;
  const clicked = data?.filter(d => d.clicked_at).length || 0;
  const converted = data?.filter(d => d.converted_at).length || 0;

  return {
    total,
    read,
    clicked,
    converted,
    readRate: total > 0 ? (read / total * 100).toFixed(1) : 0,
    clickRate: total > 0 ? (clicked / total * 100).toFixed(1) : 0,
    conversionRate: total > 0 ? (converted / total * 100).toFixed(1) : 0,
    recipients: data || []
  };
}