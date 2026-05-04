import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

// 🔥 CACHE SINGLETON
let cachedRole = null;
let cachedIsAdmin = false;
let cachedIsSuperAdmin = false;
let cachedProfile = null;
let cachedTimestamp = null;
let cachePromise = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 menit

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [profile, setProfile] = useState(null);
  const [authError, setAuthError] = useState(null);

  const extractName = (userParam = null, profileParam = null) => {
    const targetUser = userParam || user;
    const targetProfile = profileParam || profile;
    
    if (!targetUser && !targetProfile) return "Warga";
    
    if (targetProfile?.full_name) return targetProfile.full_name;
    if (targetProfile?.name) return targetProfile.name;
    
    const meta = targetUser?.user_metadata || {};
    return (
      meta.full_name ||
      meta.name ||
      meta.preferred_username ||
      targetUser?.email?.split("@")[0] ||
      "Warga"
    );
  };

  const checkPermissions = async (userObj) => {
    if (!userObj) {
      return { role: "warga", isAdmin: false, isSuperAdmin: false, profile: null };
    }

    if (cachedRole !== null && cachedProfile !== null && cachedTimestamp) {
      const isExpired = Date.now() - cachedTimestamp > CACHE_DURATION;
      if (!isExpired) {
        console.log("📦 Using cached role:", cachedRole);
        return {
          role: cachedRole,
          isAdmin: cachedIsAdmin,
          isSuperAdmin: cachedIsSuperAdmin,
          profile: cachedProfile
        };
      }
    }

    if (cachePromise) {
      console.log("⏳ Waiting for existing fetch...");
      return await cachePromise;
    }

    cachePromise = (async () => {
      try {
        console.log("🔄 Fetching permissions for user:", userObj.id);
        
        const [profileRes, adminRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', userObj.id).maybeSingle(),
          supabase.from('admins').select('id').eq('user_id', userObj.id).maybeSingle()
        ]);

        if (profileRes.error) {
          console.error("Profile fetch error:", profileRes.error);
          throw profileRes.error;
        }

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

        console.log("✅ Permissions cached:", { currentRole, adminCheck, superCheck });
        
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

  const refreshProfile = async () => {
    if (!user?.id) return null;
    
    setLoading(true);
    cachedRole = null;
    cachedIsAdmin = false;
    cachedIsSuperAdmin = false;
    cachedProfile = null;
    cachedTimestamp = null;
    cachePromise = null;
    
    const perms = await checkPermissions(user);
    setRole(perms.role);
    setIsAdmin(perms.isAdmin);
    setIsSuperAdmin(perms.isSuperAdmin);
    setProfile(perms.profile);
    setLoading(false);
    
    return perms.profile;
  };

  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      try {
        setAuthError(null);
        const { data: { session } } = await supabase.auth.getSession();
        const currentUser = session?.user ?? null;
        
        if (isMounted) setUser(currentUser);
        
        if (currentUser) {
          const perms = await checkPermissions(currentUser);
          if (isMounted) {
            setRole(perms.role);
            setIsAdmin(perms.isAdmin);
            setIsSuperAdmin(perms.isSuperAdmin);
            setProfile(perms.profile);
          }
        } else if (isMounted) {
          setRole("warga");
          setIsAdmin(false);
          setIsSuperAdmin(false);
          setProfile(null);
        }
      } catch (err) {
        console.error("Init Auth Error:", err);
        setAuthError(err.message);
        if (isMounted) {
          setRole("warga");
          setProfile(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser = session?.user ?? null;
        
        if (isMounted) setUser(currentUser);
        
        if (currentUser) {
          const perms = await checkPermissions(currentUser);
          if (isMounted) {
            setRole(perms.role);
            setIsAdmin(perms.isAdmin);
            setIsSuperAdmin(perms.isSuperAdmin);
            setProfile(perms.profile);
          }
        } else if (isMounted) {
          cachedRole = null;
          cachedIsAdmin = false;
          cachedIsSuperAdmin = false;
          cachedProfile = null;
          cachedTimestamp = null;
          setRole("warga");
          setIsAdmin(false);
          setIsSuperAdmin(false);
          setProfile(null);
        }
        
        if (isMounted) setLoading(false);
      }
    );

    // Subscribe ke perubahan profile
    if (user?.id) {
      const profileSubscription = supabase
        .channel('profile_changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${user.id}`,
          },
          () => {
            console.log('🔄 Profile updated, refreshing...');
            refreshProfile();
          }
        )
        .subscribe();

      return () => {
        isMounted = false;
        subscription.unsubscribe();
        profileSubscription.unsubscribe();
      };
    }

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [user?.id]);

  const logout = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut({ scope: 'local' });
      
      cachedRole = null;
      cachedIsAdmin = false;
      cachedIsSuperAdmin = false;
      cachedProfile = null;
      cachedTimestamp = null;
      cachePromise = null;
      
      setUser(null);
      setRole("warga");
      setIsAdmin(false);
      setIsSuperAdmin(false);
      setProfile(null);
      setAuthError(null);
    } catch (error) {
      console.error("Logout error:", error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      
      cachedRole = null;
      cachedIsAdmin = false;
      cachedIsSuperAdmin = false;
      cachedProfile = null;
      cachedTimestamp = null;
      
      setUser(data.user);
      const perms = await checkPermissions(data.user);
      setRole(perms.role);
      setIsAdmin(perms.isAdmin);
      setIsSuperAdmin(perms.isSuperAdmin);
      setProfile(perms.profile);
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  };

  const register = async (email, password, metadata = {}) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: metadata },
      });
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  };

  const getUserName = () => extractName();

  return {
    user,
    loading,
    role,
    userRole: role,  // Untuk kompatibilitas
    isAdmin,
    isSuperAdmin,
    profile,
    authError,
    refreshProfile,
    logout,
    login,
    register,
    extractName,
    getUserName,
  };
}