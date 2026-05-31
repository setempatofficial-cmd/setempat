import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

// 🔥 CACHE SINGLETON - lebih agresif
let cachedUser = null;
let cachedRole = null;
let cachedIsAdmin = false;
let cachedIsSuperAdmin = false;
let cachedProfile = null;
let cachedTimestamp = null;
let cachePromise = null;
const CACHE_DURATION = 10 * 60 * 1000; // 10 menit (ditingkatkan dari 5 menit)

// 🔥 SUBSCRIBER SYSTEM - semua komponen share state yang sama
let subscribers = new Set();
let globalAuthState = {
  user: null,
  role: 'warga',
  isAdmin: false,
  isSuperAdmin: false,
  profile: null,
  loading: true,
  authError: null
};

let isInitialized = false;
let initPromise = null;

// Notifikasi ke semua subscriber
const notifySubscribers = () => {
  subscribers.forEach(callback => callback(globalAuthState));
};

// Fetch permissions (dengan support multiple tables)
const fetchPermissions = async (userObj) => {
  if (!userObj) {
    return { role: "warga", isAdmin: false, isSuperAdmin: false, profile: null };
  }

  // Check cache
  if (cachedRole !== null && cachedProfile !== null && cachedTimestamp) {
    const isExpired = Date.now() - cachedTimestamp > CACHE_DURATION;
    if (!isExpired) {
      return {
        role: cachedRole,
        isAdmin: cachedIsAdmin,
        isSuperAdmin: cachedIsSuperAdmin,
        profile: cachedProfile
      };
    }
  }

  // Prevent multiple simultaneous fetches
  if (cachePromise) {
    return await cachePromise;
  }

  cachePromise = (async () => {
    try {
      // Fetch dari multiple tables PARALLEL untuk performance
      const [
        profileRes,
        adminRes,
        pointsRes,
        sellerRes,
        driverRes,
        rewangRes,
        ktpRes,
        rolesRes
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userObj.id).maybeSingle(),
        supabase.from('admins').select('id').eq('user_id', userObj.id).maybeSingle(),
        supabase.from('user_points').select('total_points').eq('user_id', userObj.id).maybeSingle(),
        supabase.from('seller_profiles').select('*').eq('user_id', userObj.id).maybeSingle(),
        supabase.from('driver_profiles').select('*').eq('user_id', userObj.id).maybeSingle(),
        supabase.from('rewang_profiles').select('*').eq('user_id', userObj.id).maybeSingle(),
        supabase.from('ktp_verifications').select('*').eq('user_id', userObj.id).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', userObj.id).maybeSingle()
      ]);

      const profileData = profileRes.data || {};

      // Ambil role dari user_roles dulu, fallback ke profiles.role
      let currentRole = rolesRes.data?.role || profileData.role || "warga";
      currentRole = currentRole.toLowerCase();

      const isAdminTable = !!adminRes.data;
      const superCheck = currentRole === 'superadmin';
      const adminCheck = currentRole === 'admin' || superCheck || isAdminTable;

      // Gabungkan semua data ke dalam satu object profile
      // Formatnya SAMA PERSIS dengan sebelumnya, jadi komponen tidak perlu diubah!
      const completeProfile = {
        // Data dasar dari profiles
        id: profileData.id,
        full_name: profileData.full_name,
        username: profileData.username,
        avatar_url: profileData.avatar_url,
        email: profileData.email,
        phone: profileData.phone,
        desa: profileData.desa,
        kecamatan: profileData.kecamatan,
        kabupaten: profileData.kabupaten,
        provinsi: profileData.provinsi,
        created_at: profileData.created_at,
        updated_at: profileData.updated_at,

        // Points dari user_points (fallback ke kolom points lama jika ada)
        points: pointsRes.data?.total_points || profileData.points || 0,

        // Seller data (Bakul)
        is_seller: !!sellerRes.data,
        toko_name: sellerRes.data?.toko_name || profileData.toko_name,
        business_type: sellerRes.data?.business_type || profileData.business_type,
        seller_rating: sellerRes.data?.rating || 0,
        total_sales: sellerRes.data?.total_sales || 0,

        // Driver data (Ojek)
        is_driver: !!driverRes.data,
        driver_status: driverRes.data?.driver_status || profileData.driver_status || 'offline',
        motor_info: driverRes.data?.motor_info || profileData.motor_info,
        plate_number: driverRes.data?.plate_number,
        driver_rating: driverRes.data?.driver_rating || profileData.driver_rating || 0,
        total_trips: driverRes.data?.total_trips || 0,

        // Rewang data (Jasa)
        is_rewang: !!rewangRes.data,
        kategori: rewangRes.data?.kategori || profileData.kategori,
        deskripsi_jasa: rewangRes.data?.deskripsi_jasa || profileData.deskripsi_jasa,
        estimasi_biaya: rewangRes.data?.estimasi_biaya || profileData.estimasi_biaya,
        jam_operasional: rewangRes.data?.jam_operasional || profileData.jam_operasional,
        rewang_rating: rewangRes.data?.rating || 0,
        total_orders: rewangRes.data?.total_orders || 0,

        // KTP Verifikasi
        ktp_status: ktpRes.data?.ktp_status || profileData.ktp_status || 'belum_mengajukan',
        foto_ktp: ktpRes.data?.foto_ktp || profileData.foto_ktp,
        ktp_verified_at: ktpRes.data?.verified_at || profileData.ktp_verified_at,
        ktp_rejection_reason: ktpRes.data?.rejection_reason || profileData.ktp_rejection_reason,
        is_verified: !!(ktpRes.data?.verified_at || profileData.is_verified),

        // Role (tetap dipertahankan untuk backward compatibility)
        role: currentRole,
      };

      // Update cache
      cachedRole = currentRole;
      cachedIsAdmin = adminCheck;
      cachedIsSuperAdmin = superCheck;
      cachedProfile = completeProfile;
      cachedTimestamp = Date.now();
      cachedUser = userObj;

      return {
        role: currentRole,
        isAdmin: adminCheck,
        isSuperAdmin: superCheck,
        profile: completeProfile
      };
    } catch (error) {
      console.error("Auth Check Error:", error);
      return { role: "warga", isAdmin: false, isSuperAdmin: false, profile: null };
    } finally {
      cachePromise = null;
    }
  })();

  return await cachePromise;
};

// Inisialisasi auth (hanya sekali)
const initAuth = async () => {
  if (isInitialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user ?? null;

      if (currentUser) {
        const perms = await fetchPermissions(currentUser);
        globalAuthState = {
          user: currentUser,
          role: perms.role,
          isAdmin: perms.isAdmin,
          isSuperAdmin: perms.isSuperAdmin,
          profile: perms.profile,
          loading: false,
          authError: null
        };
      } else {
        globalAuthState = {
          user: null,
          role: "warga",
          isAdmin: false,
          isSuperAdmin: false,
          profile: null,
          loading: false,
          authError: null
        };
      }

      isInitialized = true;
      notifySubscribers();
    } catch (err) {
      globalAuthState = {
        ...globalAuthState,
        loading: false,
        authError: err.message
      };
      notifySubscribers();
    }
  })();

  return initPromise;
};

// Subscribe ke auth changes (hanya sekali)
let authSubscriptionInitialized = false;
const initAuthSubscription = () => {
  if (authSubscriptionInitialized) return;
  authSubscriptionInitialized = true;

  supabase.auth.onAuthStateChange(async (_event, session) => {
    const currentUser = session?.user ?? null;

    if (currentUser) {
      const perms = await fetchPermissions(currentUser);
      globalAuthState = {
        user: currentUser,
        role: perms.role,
        isAdmin: perms.isAdmin,
        isSuperAdmin: perms.isSuperAdmin,
        profile: perms.profile,
        loading: false,
        authError: null
      };
    } else {
      // Reset cache on logout
      cachedRole = null;
      cachedIsAdmin = false;
      cachedIsSuperAdmin = false;
      cachedProfile = null;
      cachedTimestamp = null;
      cachedUser = null;

      globalAuthState = {
        user: null,
        role: "warga",
        isAdmin: false,
        isSuperAdmin: false,
        profile: null,
        loading: false,
        authError: null
      };
    }

    notifySubscribers();
  });
};

// ========== HOOK YANG DIOPTIMASI ==========
export function useAuth() {
  const [localState, setLocalState] = useState(globalAuthState);

  // Subscribe ke perubahan global
  useEffect(() => {
    // Mulai inisialisasi
    initAuth();
    initAuthSubscription();

    // Subscribe ke perubahan
    const callback = (newState) => {
      setLocalState(newState);
    };

    subscribers.add(callback);

    // Cleanup
    return () => {
      subscribers.delete(callback);
    };
  }, []);

  // Extract name helper
  const extractName = useCallback((userParam = null, profileParam = null) => {
    const targetUser = userParam || localState.user;
    const targetProfile = profileParam || localState.profile;

    if (!targetUser && !targetProfile) return "Warga";
    if (targetProfile?.full_name) return targetProfile.full_name;
    if (targetProfile?.name) return targetProfile.name;

    const meta = targetUser?.user_metadata || {};
    return meta.full_name || meta.name || meta.preferred_username ||
      targetUser?.email?.split("@")[0] || "Warga";
  }, [localState.user, localState.profile]);

  const refreshProfile = useCallback(async () => {
    if (!localState.user?.id) return null;

    // Clear cache
    cachedRole = null;
    cachedIsAdmin = false;
    cachedIsSuperAdmin = false;
    cachedProfile = null;
    cachedTimestamp = null;

    const perms = await fetchPermissions(localState.user);

    globalAuthState = {
      ...globalAuthState,
      role: perms.role,
      isAdmin: perms.isAdmin,
      isSuperAdmin: perms.isSuperAdmin,
      profile: perms.profile
    };

    notifySubscribers();
    return perms.profile;
  }, [localState.user]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut({ scope: 'local' });
    // Reset akan di-handle oleh onAuthStateChange
  }, []);

  const login = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { data: null, error };

    // Clear cache
    cachedRole = null;
    cachedIsAdmin = false;
    cachedIsSuperAdmin = false;
    cachedProfile = null;
    cachedTimestamp = null;

    return { data, error: null };
  }, []);

  const register = useCallback(async (email, password, metadata = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    });
    return { data, error };
  }, []);

  const getUserName = useCallback(() => extractName(), [extractName]);

  return {
    user: localState.user,
    loading: localState.loading,
    role: localState.role,
    userRole: localState.role,
    isAdmin: localState.isAdmin,
    isSuperAdmin: localState.isSuperAdmin,
    profile: localState.profile,
    authError: localState.authError,
    refreshProfile,
    logout,
    login,
    register,
    extractName,
    getUserName,
  };
}