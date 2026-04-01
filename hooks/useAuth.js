import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Perbaikan: Inisialisasi role sebagai null agar UI tidak menebak "warga" di awal
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

  // FUNGSI CEK KASTA (TERPADU)
  const checkPermissions = async (user) => {
    if (!user) {
      setRole("warga");
      setIsAdmin(false);
      setIsSuperAdmin(false);
      return;
    }

    try {
      // 1. Ambil data dari tabel profiles dan admins secara paralel (lebih cepat)
      const [profileRes, adminRes] = await Promise.all([
        supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
        supabase.from('admins').select('id').eq('user_id', user.id).maybeSingle()
      ]);

      const currentRole = profileRes.data?.role?.toLowerCase() || "warga";
      const isAdminTable = !!adminRes.data;

      // LOGIKA KASTA SETEMPAT
      const superCheck = currentRole === 'superadmin';
      const adminCheck = currentRole === 'admin' || superCheck || isAdminTable;

      setRole(currentRole);
      setIsSuperAdmin(superCheck);
      setIsAdmin(adminCheck);

      console.log("Kasta Terverifikasi:", currentRole);
    } catch (error) {
      console.error("Auth Check Error:", error);
      setRole("warga");
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        
        if (currentUser) {
          await checkPermissions(currentUser);
        } else {
          setRole("warga");
        }
      } catch (err) {
        console.error("Init Auth Error:", err);
      } finally {
        // Matikan loading hanya setelah semua pengecekan selesai
        setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        
        if (currentUser) {
          await checkPermissions(currentUser);
        } else {
          setRole("warga");
          setIsAdmin(false);
          setIsSuperAdmin(false);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const logout = async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
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
      setUser(data.user);
      await checkPermissions(data.user);
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