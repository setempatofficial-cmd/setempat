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

// Fetch permissions (hanya sekali)
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
      const [profileRes, adminRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userObj.id).maybeSingle(),
        supabase.from('admins').select('id').eq('user_id', userObj.id).maybeSingle()
      ]);

      const profileData = profileRes.data;
      const currentRole = profileData?.role?.toLowerCase() || "warga";
      const isAdminTable = !!adminRes.data;
      const superCheck = currentRole === 'superadmin';
      const adminCheck = currentRole === 'admin' || superCheck || isAdminTable;

      cachedRole = currentRole;
      cachedIsAdmin = adminCheck;
      cachedIsSuperAdmin = superCheck;
      cachedProfile = profileData;
      cachedTimestamp = Date.now();
      cachedUser = userObj;

      return {
        role: currentRole,
        isAdmin: adminCheck,
        isSuperAdmin: superCheck,
        profile: profileData
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