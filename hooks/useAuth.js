import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

// 🔥 CACHE SINGLETON - Data role hanya diambil sekali
let cachedRole = null;
let cachedIsAdmin = false;
let cachedIsSuperAdmin = false;
let cachePromise = null;

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const extractName = (user) => {
    if (!user) return "Warga";
    const meta = user.user_metadata || {};
    return (
      meta.full_name ||
      meta.name ||
      meta.preferred_username ||
      user.email?.split("@")[0] ||
      "Warga"
    );
  };

  // 🔥 FUNGSI CEK PERMISSIONS DENGAN CACHE
  const checkPermissions = async (user) => {
    if (!user) {
      return { role: "warga", isAdmin: false, isSuperAdmin: false };
    }

    // 🔥 Jika sudah ada cache, gunakan langsung
    if (cachedRole !== null) {
      console.log("📦 Using cached role:", cachedRole);
      return {
        role: cachedRole,
        isAdmin: cachedIsAdmin,
        isSuperAdmin: cachedIsSuperAdmin
      };
    }

    // 🔥 Jika sedang dalam proses fetch, tunggu hasilnya
    if (cachePromise) {
      return await cachePromise;
    }

    // 🔥 Fetch data dengan Promise.all
    cachePromise = (async () => {
      try {
        const [profileRes, adminRes] = await Promise.all([
          supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
          supabase.from('admins').select('id').eq('user_id', user.id).maybeSingle()
        ]);

        const currentRole = profileRes.data?.role?.toLowerCase() || "warga";
        const isAdminTable = !!adminRes.data;

        const superCheck = currentRole === 'superadmin';
        const adminCheck = currentRole === 'admin' || superCheck || isAdminTable;

        // Simpan ke cache
        cachedRole = currentRole;
        cachedIsAdmin = adminCheck;
        cachedIsSuperAdmin = superCheck;

        console.log("✅ Kasta Terverifikasi (cached):", currentRole);
        
        return {
          role: currentRole,
          isAdmin: adminCheck,
          isSuperAdmin: superCheck
        };
      } catch (error) {
        console.error("Auth Check Error:", error);
        return { role: "warga", isAdmin: false, isSuperAdmin: false };
      } finally {
        cachePromise = null;
      }
    })();

    return await cachePromise;
  };

  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUser = session?.user ?? null;
        
        if (isMounted) setUser(currentUser);
        
        if (currentUser) {
          const perms = await checkPermissions(currentUser);
          if (isMounted) {
            setRole(perms.role);
            setIsAdmin(perms.isAdmin);
            setIsSuperAdmin(perms.isSuperAdmin);
          }
        } else if (isMounted) {
          setRole("warga");
          setIsAdmin(false);
          setIsSuperAdmin(false);
        }
      } catch (err) {
        console.error("Init Auth Error:", err);
        if (isMounted) {
          setRole("warga");
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
          }
        } else if (isMounted) {
          // 🔥 Reset cache saat logout
          cachedRole = null;
          cachedIsAdmin = false;
          cachedIsSuperAdmin = false;
          setRole("warga");
          setIsAdmin(false);
          setIsSuperAdmin(false);
        }
        
        if (isMounted) setLoading(false);
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
      // 🔥 Reset cache saat logout
      cachedRole = null;
      cachedIsAdmin = false;
      cachedIsSuperAdmin = false;
      setUser(null);
      setRole("warga");
      setIsAdmin(false);
      setIsSuperAdmin(false);
    } catch (error) {
      console.error("Logout error:", error);
      setUser(null);
    }
  };

  const login = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      
      // 🔥 Reset cache agar di-refresh dengan data baru
      cachedRole = null;
      cachedIsAdmin = false;
      cachedIsSuperAdmin = false;
      
      setUser(data.user);
      const perms = await checkPermissions(data.user);
      setRole(perms.role);
      setIsAdmin(perms.isAdmin);
      setIsSuperAdmin(perms.isSuperAdmin);
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

  return {
    user,
    loading,
    role,
    isAdmin,
    isSuperAdmin,
    logout,
    login,
    register,
    extractName,
  };
}